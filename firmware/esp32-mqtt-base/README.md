# Firmware base para ESP32

Este directorio contiene una base de firmware para los equipos que publican telemetría en ClusterControl. No reemplaza la adaptación eléctrica de cada placa: los sensores y actuadores reales se integran en `sensor_adapter.h`.

## Qué incluye

- Conexión Wi-Fi con reintentos.
- Conexión MQTT con reintentos y cliente único por `deviceId`.
- Publicación en `datacenter/ambiente`.
- Publicación opcional de la IP de cámara en `datacenter/camera/ip`.
- Validación de `DEVICE_ID` antes de iniciar.
- Rechazo de telemetría incompleta para no llenar el sistema con valores ficticios.
- Mensajes de diagnóstico por puerto serie a 115200 baudios.

## Dependencias

Instala estas bibliotecas desde el gestor de bibliotecas del Arduino IDE o de PlatformIO:

- ESP32 by Espressif Systems
- PubSubClient
- ArduinoJson 7

## Preparar una placa

1. Copia `config.h.example` como `config.h`.
2. Completa la red Wi-Fi y la dirección del broker.
3. Crea el cluster desde ClusterControl y copia el `deviceId` asignado por la API en `DEVICE_ID`.
4. Implementa las funciones de `sensor_adapter.h` según los sensores y entradas de la placa.
5. Revisa los límites eléctricos, niveles lógicos y alimentación antes de conectar actuadores.
6. Compila, carga el sketch y abre el monitor serie a 115200.
7. Comprueba en el dashboard que las lecturas pertenecen al cluster correcto.

`config.h` contiene credenciales locales y debe permanecer fuera del control de versiones. El archivo `.gitignore` de este directorio evita incluirlo por accidente.

Con PlatformIO, desde este directorio, instala las dependencias y compila así:

```bash
cp config.h.example config.h
# Edita config.h y sensor_adapter.h antes de cargar la placa.
pio run
pio run --target upload
pio device monitor
```

El archivo `platformio.ini` fija la placa ESP32 de referencia y las bibliotecas necesarias. En Arduino IDE, instala las mismas bibliotecas y abre `esp32-mqtt-base.ino`.

## Contrato MQTT

Telemetría publicada cada 15 segundos por defecto:

```json
{
  "deviceId": 4,
  "temp1": 24.5,
  "hum1": 55.0,
  "temp2": 25.1,
  "hum2": 57.0,
  "extractor": false,
  "aire": true,
  "puerta": false,
  "luzEncendida": false
}
```

Topic de telemetría:

```text
datacenter/ambiente
```

Si `CAMERA_IP` no está vacío, el equipo publica una vez al conectarse:

```json
{
  "deviceId": "4",
  "ip": "192.168.1.80"
}
```

Topic de cámara:

```text
datacenter/camera/ip
```

El backend valida `deviceId`, temperaturas, humedades y estados antes de persistir la lectura. Un dispositivo cuyo ID no exista en la tabla de clusters será ignorado y aparecerá en los logs del backend.

## Actuadores

El repositorio reserva los topics `datacenter/extractor/set`, `datacenter/aire/set`, `datacenter/door/set` y `datacenter/buzzer/set`, pero actualmente no hay handlers completos en el backend ni un flujo de comandos funcional. No conectes actuadores a esos topics esperando que el sistema los controle hasta implementar y probar ese contrato.

## Seguridad

La configuración de desarrollo permite MQTT anónimo. Para una instalación real usa usuario, contraseña, ACL por dispositivo, una red aislada y TLS si el broker atraviesa una red no confiable. No dejes credenciales dentro del sketch ni subas `config.h` al repositorio.
