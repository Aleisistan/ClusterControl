#include <Arduino.h>
#include <ArduinoJson.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <IRsend.h>

#include "config.h"
#include "sensor_adapter.h"
#include "control_adapter.h"

WiFiClient espClient;
PubSubClient mqttClient(espClient);

#if WIFI_USE_BSSID
const uint8_t wifiBssid[] = WIFI_BSSID;
#endif

unsigned long lastTelemetry = 0;
unsigned long lastMqttAttempt = 0;
unsigned long lastWifiAttempt = 0;
unsigned long lastSerialSummary = 0;
unsigned long lastCameraAnnouncement = 0;
bool wifiAttempted = false;
bool mqttAttempted = false;
bool cameraAnnouncementPending = false;
const unsigned long SERIAL_SUMMARY_INTERVAL_MS = 10000UL;
const char TELEMETRY_TOPIC[] = "datacenter/ambiente";
const char CAMERA_TOPIC[] = "datacenter/camera/ip";

bool deviceIdIsValid() {
  if (DEVICE_ID[0] == '\0') return false;
  for (size_t i = 0; DEVICE_ID[i] != '\0'; ++i) {
    if (DEVICE_ID[i] < '0' || DEVICE_ID[i] > '9') return false;
  }
  return true;
}

bool connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return true;

  const unsigned long now = millis();
  if (wifiAttempted && now - lastWifiAttempt < CONNECTION_RETRY_MS) return false;
  lastWifiAttempt = now;
  wifiAttempted = true;

  Serial.printf("[WIFI] Intentando conectar a %s...\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);

#if WIFI_USE_BSSID
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD, WIFI_CHANNEL, wifiBssid);
#else
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
#endif

  return false;
}

void connectMqtt() {
  if (WiFi.status() != WL_CONNECTED || mqttClient.connected()) return;

  const unsigned long now = millis();
  if (mqttAttempted && now - lastMqttAttempt < CONNECTION_RETRY_MS) return;
  lastMqttAttempt = now;
  mqttAttempted = true;

  char clientId[48];
  snprintf(clientId, sizeof(clientId), "clustercontrol-device-%s", DEVICE_ID);

  Serial.println("[MQTT] Intentando conectar...");
  const bool connected = MQTT_USERNAME[0] == '\0'
    ? mqttClient.connect(clientId)
    : mqttClient.connect(clientId, MQTT_USERNAME, MQTT_PASSWORD);

  if (connected) {
    Serial.println("[MQTT] Conectado");
    cameraAnnouncementPending = CAMERA_IP[0] != '\0';
  } else {
    Serial.printf("[MQTT] Error de conexion rc=%d\n", mqttClient.state());
  }
}

void applyControlLogic(float t1, float h1, float t2, float h2) {
  // Extractor por humedad: histéresis independiente para ambos sensores.
  if (h1 >= HUM_ON || h2 >= HUM_ON) extractorPorHum = true;
  else if (h1 <= HUM_OFF && h2 <= HUM_OFF) extractorPorHum = false;

  // Extractor por temperatura.
  if (t1 >= TEMP_ON || t2 >= TEMP_ON) extractorPorTemp = true;
  else if (t1 <= TEMP_OFF && t2 <= TEMP_OFF) extractorPorTemp = false;

  setExtractor(extractorPorTemp || extractorPorHum);

  // Aire acondicionado por temperatura.
  if (t1 >= TEMP_ON || t2 >= TEMP_ON) setAire(true);
  else if (t1 <= TEMP_OFF && t2 <= TEMP_OFF) setAire(false);
}

void publishTelemetry(float t1, float h1, float t2, float h2) {
  if (!mqttClient.connected()) return;

  char payload[320];
  const int written = snprintf(
    payload, sizeof(payload),
    "{\"deviceId\":%ld,\"temp1\":%.2f,\"hum1\":%.2f,"
    "\"temp2\":%.2f,\"hum2\":%.2f,\"extractor\":%s,"
    "\"aire\":%s,\"puerta\":%s,\"luzEncendida\":%s}",
    strtol(DEVICE_ID, nullptr, 10), t1, h1, t2, h2,
    extractorState ? "true" : "false",
    aireEncendido ? "true" : "false",
    puertaAbierta ? "true" : "false",
    luzEncendida ? "true" : "false"
  );

  if (written <= 0 || written >= (int)sizeof(payload)) {
    Serial.println("[MQTT] Error construyendo payload");
    return;
  }

  const bool published = mqttClient.publish(TELEMETRY_TOPIC, payload);
  Serial.printf("[MQTT] Publicacion: %s | %s\n",
                published ? "OK" : "ERROR", payload);
}

bool publishCameraIp() {
  JsonDocument document;
  document["deviceId"] = DEVICE_ID;
  document["ip"] = CAMERA_IP;

  char payload[192];
  const size_t written = serializeJson(document, payload, sizeof(payload));
  if (written == 0 || written >= sizeof(payload)) {
    Serial.println("[MQTT] Error construyendo anuncio de camara");
    return false;
  }

  const bool published = mqttClient.publish(CAMERA_TOPIC, payload);
  Serial.printf("[MQTT] Anuncio de camara: %s\n", published ? "OK" : "ERROR");
  return published;
}

void readAndPublishTelemetry() {
  const float h1 = readHumidity1();
  const float t1 = readTemperature1();
  const float h2 = readHumidity2();
  const float t2 = readTemperature2();

  if (!sensorsAreValid(t1, h1, t2, h2)) {
    Serial.println("[SENSORES] Telemetria cancelada: lectura invalida");
    serialLecturaValida = false;
    return;
  }

  serialTemp1 = t1;
  serialHum1 = h1;
  serialTemp2 = t2;
  serialHum2 = h2;
  serialLecturaValida = true;

  applyControlLogic(t1, h1, t2, h2);
  publishTelemetry(t1, h1, t2, h2);
}

void updateDoorAndLight() {
  puertaAbierta = readDoorState();
  if (puertaAbierta != puertaAnterior) {
    puertaAnterior = puertaAbierta;
    setLuz(puertaAbierta);
  }
}

void showSerialSummary() {
  const unsigned long seconds = millis() / 1000UL;
  Serial.println();
  Serial.println("========== ESTADO DEL CLUSTER ==========");

  Serial.printf("Tiempo desde inicio: %02lu:%02lu:%02lu\n",
                seconds / 3600UL, (seconds / 60UL) % 60UL, seconds % 60UL);

  if (serialLecturaValida) {
    Serial.printf("Sensor 1 | Temperatura: %.2f C | Humedad: %.2f %%\n",
                  serialTemp1, serialHum1);
    Serial.printf("Sensor 2 | Temperatura: %.2f C | Humedad: %.2f %%\n",
                  serialTemp2, serialHum2);
    Serial.printf("Promedio | Temperatura: %.2f C | Humedad: %.2f %%\n",
                  (serialTemp1 + serialTemp2) / 2.0f,
                  (serialHum1 + serialHum2) / 2.0f);
  } else {
    Serial.println("No hay mediciones validas disponibles.");
  }

  Serial.printf("Wi-Fi: %s\n", WiFi.status() == WL_CONNECTED ? "CONECTADO" : "DESCONECTADO");
  Serial.printf("MQTT: %s\n", mqttClient.connected() ? "CONECTADO" : "DESCONECTADO");
  Serial.printf("Extractor: %s\n", extractorState ? "ENCENDIDO" : "APAGADO");
  Serial.printf("Aire acondicionado: %s\n", aireEncendido ? "ENCENDIDO" : "APAGADO");
  Serial.printf("Luz: %s\n", luzEncendida ? "ENCENDIDA" : "APAGADA");
  Serial.printf("Puerta: %s\n", puertaAbierta ? "ABIERTA" : "CERRADA");
  Serial.println("========================================");
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\nINICIANDO CLUSTERCONTROL ESP32");

  if (!deviceIdIsValid()) {
    Serial.println("[ERROR] DEVICE_ID debe contener solo digitos.");
    while (true) delay(1000);
  }

  setupSensors();
  setupControls();

  // Mantiene la lógica eléctrica original: relés activos en LOW.
  setExtractor(false);
  puertaAbierta = readDoorState();
  puertaAnterior = puertaAbierta;
  setLuz(puertaAbierta);

  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setBufferSize(384);

  connectWifi();
  Serial.println("[SETUP] Inicializacion terminada");
}

void loop() {
  connectWifi();

  if (WiFi.status() == WL_CONNECTED) {
    connectMqtt();
    mqttClient.loop();
  }

  const unsigned long now = millis();
  if (
    mqttClient.connected() &&
    cameraAnnouncementPending &&
    now - lastCameraAnnouncement >= CONNECTION_RETRY_MS
  ) {
    lastCameraAnnouncement = now;
    cameraAnnouncementPending = !publishCameraIp();
  }

  updateDoorAndLight();

  if (now - lastTelemetry >= TELEMETRY_INTERVAL_MS) {
    lastTelemetry = now;
    readAndPublishTelemetry();
  }

  if (now - lastSerialSummary >= SERIAL_SUMMARY_INTERVAL_MS) {
    lastSerialSummary = now;
    showSerialSummary();
  }

  delay(10);
}
