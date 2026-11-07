#include <Arduino.h>
#include <ArduinoJson.h>
#include <Network.h>
#include <PubSubClient.h>
#include <WiFi.h>

#include "config.h"
#include "sensor_adapter.h"

namespace {
constexpr char telemetryTopic[] = "datacenter/ambiente";
constexpr char cameraTopic[] = "datacenter/camera/ip";

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);
unsigned long lastTelemetryAt = 0;
unsigned long lastConnectionAttemptAt = 0;

bool deviceIdIsValid() {
  const char* deviceId = DEVICE_ID;
  if (deviceId[0] == '\0') {
    return false;
  }

  char* end = nullptr;
  const long value = strtol(deviceId, &end, 10);
  return end != deviceId && *end == '\0' && value >= 0;
}

bool sensorsAreValid(const float values[]) {
  for (size_t index = 0; index < 4; index++) {
    if (!isfinite(values[index])) {
      return false;
    }
  }

  return true;
}

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  Serial.printf("Conectando a Wi-Fi: %s\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  const unsigned long startedAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startedAt < CONNECTION_RETRY_MS) {
    delay(250);
    Serial.print('.');
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Wi-Fi conectado. IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("No se pudo conectar a Wi-Fi.");
  }
}

void connectMqtt() {
  if (mqttClient.connected() || WiFi.status() != WL_CONNECTED) {
    return;
  }

  const unsigned long now = millis();
  if (now - lastConnectionAttemptAt < CONNECTION_RETRY_MS) {
    return;
  }
  lastConnectionAttemptAt = now;

  Serial.printf("Conectando a MQTT %s:%d...\n", MQTT_HOST, MQTT_PORT);
  const bool connected = MQTT_USERNAME[0] == '\0'
    ? mqttClient.connect("clustercontrol-device-" DEVICE_ID)
    : mqttClient.connect(
        "clustercontrol-device-" DEVICE_ID,
        MQTT_USERNAME,
        MQTT_PASSWORD);

  if (connected) {
    Serial.println("MQTT conectado.");
  } else {
    Serial.printf("MQTT no disponible. Estado: %d\n", mqttClient.state());
  }
}

void publishCameraIp() {
  if (CAMERA_IP[0] == '\0') {
    return;
  }

  JsonDocument document;
  document["deviceId"] = DEVICE_ID;
  document["ip"] = CAMERA_IP;

  String payload;
  serializeJson(document, payload);
  mqttClient.publish(cameraTopic, payload.c_str());
}

void publishTelemetry() {
  const float sensorValues[] = {
    readTemperature1(),
    readTemperature2(),
    readHumidity1(),
    readHumidity2(),
  };

  if (!sensorsAreValid(sensorValues)) {
    Serial.println("Telemetria omitida: completa sensor_adapter.h antes de usar la placa.");
    return;
  }

  JsonDocument document;
  document["deviceId"] = strtol(DEVICE_ID, nullptr, 10);
  document["temp1"] = sensorValues[0];
  document["hum1"] = sensorValues[2];
  document["temp2"] = sensorValues[1];
  document["hum2"] = sensorValues[3];
  document["extractor"] = readExtractorState();
  document["aire"] = readAirConditionerState();
  document["puerta"] = readDoorState();
  document["luzEncendida"] = readLightState();

  String payload;
  serializeJson(document, payload);
  if (mqttClient.publish(telemetryTopic, payload.c_str())) {
    Serial.print("Telemetria publicada: ");
    Serial.println(payload);
  } else {
    Serial.println("No se pudo publicar la telemetria.");
  }
}
} // namespace

void setup() {
  Serial.begin(115200);
  delay(300);

  if (!deviceIdIsValid()) {
    Serial.println("ERROR: DEVICE_ID debe ser numerico y coincidir con ClusterControl.");
    while (true) {
      delay(1000);
    }
  }

  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  connectWifi();
  connectMqtt();
  publishCameraIp();
}

void loop() {
  connectWifi();
  connectMqtt();
  mqttClient.loop();

  if (!mqttClient.connected()) {
    return;
  }

  const unsigned long now = millis();
  if (now - lastTelemetryAt >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryAt = now;
    publishTelemetry();
  }
}
