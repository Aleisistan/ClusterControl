# Firmware ClusterControl para ESP32

Esta carpeta contiene el firmware para una placa **ESP32 Dev Module**. Se
puede compilar y cargar desde Arduino IDE; no hace falta PlatformIO.

## 1. Instalar Arduino IDE y el soporte ESP32

1. Instala y abre [Arduino IDE 2](https://www.arduino.cc/en/software).
2. En **Archivo > Preferencias** (Windows/Linux) o **Arduino IDE > Settings**
   (macOS), agrega esta dirección en **URLs adicionales de gestor de placas**:

   ```text
   https://espressif.github.io/arduino-esp32/package_esp32_index.json
   ```

   Si ya hay otras direcciones, sepáralas con comas.
3. Abre **Herramientas > Placa > Gestor de placas**, busca `esp32` e instala
   **esp32 by Espressif Systems**.
4. Conecta la placa por USB. Si el puerto no aparece, instala el controlador
   USB-serial correspondiente al chip de la placa (por ejemplo, CP210x o
   CH340).

## 2. Instalar las bibliotecas

Desde **Programa > Incluir biblioteca > Administrar bibliotecas**, busca e
instala estas bibliotecas:

| Buscar en el gestor | Biblioteca/editor |
|---|---|
| `ArduinoJson` | ArduinoJson, de Benoit Blanchon (versión 7) |
| `PubSubClient` | PubSubClient, de Nick O'Leary |
| `DHT sensor library` | DHT sensor library, de Adafruit |
| `Adafruit Unified Sensor` | Adafruit Unified Sensor, de Adafruit |
| `IRremoteESP8266` | IRremoteESP8266 |

`Adafruit Unified Sensor` es una dependencia de la biblioteca DHT. El soporte
de `WiFi.h` y `Arduino.h` se instala junto con el paquete ESP32; no se instalan
por separado. `IRsend.h` lo proporciona `IRremoteESP8266`.

## 3. Preparar y abrir el sketch

1. En el explorador de archivos, abre la carpeta
   `firmware/ClusterControl_ESP32` del repositorio.
2. Crea `config.h` copiando `config.h.example` y edítalo. En Windows
   PowerShell, desde la raíz del repositorio:

   ```powershell
   Copy-Item firmware\ClusterControl_ESP32\config.h.example firmware\ClusterControl_ESP32\config.h
   ```

   Si `config.h` ya existe, no lo reemplaces: conserva la configuración local.
3. En Arduino IDE, selecciona **Archivo > Abrir** y abre
   `firmware/ClusterControl_ESP32/ClusterControl_ESP32.ino`. Mantén juntos el
   `.ino`, `config.h`, `sensor_adapter.h` y `control_adapter.h` en esa carpeta.
4. En `config.h`, completa como mínimo:
   - `WIFI_SSID` y `WIFI_PASSWORD`: credenciales de la red Wi-Fi de 2.4 GHz.
   - `MQTT_HOST` y `MQTT_PORT`: dirección alcanzable del broker desde la placa
     (normalmente puerto `1883`).
   - `MQTT_USERNAME` y `MQTT_PASSWORD`: credenciales MQTT, si el broker las
     exige.
   - `DEVICE_ID`: ID numérico asignado al cluster en ClusterControl.
   - `CAMERA_IP`: opcional; déjalo como `""` si no corresponde anunciar una
     cámara IP.

   También se pueden ajustar los umbrales `TEMP_ON`, `TEMP_OFF`, `HUM_ON` y
   `HUM_OFF`, y los códigos infrarrojos `IR_POWER_ON` e `IR_POWER_OFF`.
   Comprueba los códigos con el modelo real del aire acondicionado antes de
   usarlos. No publiques ni compartas `config.h`: contiene credenciales.

## 4. Elegir placa y opciones de carga

En **Herramientas**, selecciona:

- **Placa > esp32 > ESP32 Dev Module**.
- **Puerto**: el puerto serie que aparece al conectar la placa (por ejemplo,
  `COM3` en Windows o `/dev/ttyUSB0` en Linux).
- Deja las demás opciones de placa en sus valores predeterminados para empezar.

Si la carga falla repetidamente, prueba una **Upload Speed** menor, por ejemplo
`115200`, y vuelve a cargar. Algunas placas requieren mantener presionado el
botón **BOOT** mientras Arduino IDE muestra `Connecting...`; suéltalo cuando
comience la carga. Las opciones disponibles pueden variar según la placa y la
versión del paquete ESP32 instalado.

## 5. Compilar, cargar y revisar el monitor serie

1. Pulsa **Verificar** (✓) para compilar y comprobar que las bibliotecas y la
   configuración están completas.
2. Pulsa **Subir** (→) para compilar y cargar el firmware en la placa.
3. Abre **Herramientas > Monitor serie** y selecciona **115200 baudios**.
   Reinicia la placa si no aparece el mensaje de inicio.
4. Comprueba en el monitor que se conecte a Wi-Fi y MQTT. Los errores muestran
   el estado de conexión y las lecturas inválidas de sensores.

Si Arduino IDE indica que no encuentra `config.h`, confirma que lo creaste en
la carpeta del sketch y que el archivo no quedó nombrado `config.h.txt`.
Si indica que no encuentra una biblioteca, vuelve al gestor de bibliotecas y
comprueba el nombre y editor de la tabla anterior.

## Conexiones y comportamiento

| Componente | GPIO | Comportamiento |
|---|---:|---|
| DHT11 1 | 4 | Temperatura y humedad |
| DHT11 2 | 14 | Temperatura y humedad |
| Extractor | 18 | Relé activo en LOW |
| Sensor de puerta | 27 | `HIGH` significa puerta abierta |
| Luz | 19 | Relé activo en LOW |
| Emisor infrarrojo | 25 | Envía comandos COOLIX |

La telemetría se publica cada 15 segundos en `datacenter/ambiente`, solo cuando
las lecturas de ambos sensores son válidas. El formato del mensaje y la
verificación del flujo se describen en la
[guía de conexión MQTT](../../docs/conectar-dispositivo-mqtt.md#4-verificar-el-flujo).

Los umbrales usan histéresis. El extractor se activa por temperatura o humedad;
el aire acondicionado, por temperatura. La luz se enciende cuando la entrada
indica que la puerta está abierta. El estado de aire informado por el firmware
es un estado de software y no confirma que el equipo haya respondido.

Si `CAMERA_IP` no está vacío, el dispositivo anuncia `{deviceId, ip}` en
`datacenter/camera/ip` al conectarse. En ese anuncio `deviceId` es texto; en
la telemetría es numérico.

Verifica el cableado, los relés, el sensor de puerta y los códigos infrarrojos
con el hardware real antes de energizar actuadores. Para configurar el broker
y asociar la placa, consulta
[Conectar una placa por MQTT](../../docs/conectar-dispositivo-mqtt.md).
