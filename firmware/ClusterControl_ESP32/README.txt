CLUSTERCONTROL ESP32 - MIGRACION MODULAR

1) Abrir ClusterControl_ESP32.ino con Arduino IDE.
2) Completar config.h localmente con SSID, contraseña Wi-Fi y contraseña MQTT.
3) No compartir config.h ni subirlo a Git.
4) Instalar:
   - ESP32 by Espressif Systems (Boards Manager)
   - PubSubClient (Nick O'Leary)
   - DHT sensor library (Adafruit)
   - Adafruit Unified Sensor (dependencia de DHT)
   - IRremoteESP8266 (para IRsend.h / sendCOOLIX)
5) Seleccionar la placa ESP32 y el puerto correcto.
6) Compilar antes de cargar.

PINES CONSERVADOS:
DHT11 #1 GPIO 4
DHT11 #2 GPIO 14
Extractor GPIO 18
Puerta GPIO 27
Luz GPIO 19
IR COOLIX GPIO 25

IMPORTANTE:
- El archivo config.h contiene placeholders. No cargar el firmware sin completarlos.
- MQTT_USERNAME debe ser el usuario de Mosquitto autorizado para dispositivos.
- DEVICE_ID debe existir en ClusterControl y ser numérico.
- La publicación conserva los nombres temp1, hum1, temp2, hum2,
  extractor, aire, puerta y agrega luzEncendida.
- El aire usa el mismo código IR_POWER toggle que el original. El estado
  de software no confirma que el equipo haya recibido el comando.
- La cámara no publica su IP en esta primera migración: CAMERA_IP queda
  reservada en config.h, pero el firmware original adjunto tampoco implementa
  publicación de IP de cámara.
- No se cambió la polaridad de relés ni la lógica HIGH de puerta abierta.
