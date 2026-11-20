# Firmware ESP32

Este es el único firmware del proyecto. Está preparado para una placa
**ESP32 Dev Module** y se compila con PlatformIO.

## Preparar y cargar

1. Desde esta carpeta, crea `config.h` solo si aún no existe:

   ```powershell
   if (-not (Test-Path config.h)) {
     Copy-Item config.h.example config.h
   }
   ```

2. Completa Wi-Fi, MQTT, el `DEVICE_ID` numérico del cluster y, si corresponde,
   `CAMERA_IP`. No subas `config.h` ni compartas sus credenciales.
3. Instala PlatformIO Core o la extensión PlatformIO de VS Code y abre una
   terminal donde el comando `pio` esté disponible. En esta carpeta, compila,
   carga y abre el monitor serie:

   ```powershell
   pio run
   pio run --target upload
   pio device monitor
   ```

El monitor serie usa 115200 baudios. PlatformIO descarga las dependencias
declaradas en `platformio.ini`.

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
las lecturas de ambos sensores son válidas. El formato completo del mensaje y
la verificación del flujo están en la
[guía de conexión MQTT](../../docs/conectar-dispositivo-mqtt.md#4-verificar-el-flujo).

Los umbrales `TEMP_ON`, `TEMP_OFF`, `HUM_ON` y `HUM_OFF` usan histéresis. Los
códigos de ejemplo `IR_POWER_ON` y `IR_POWER_OFF` deben verificarse con el
modelo real del aire acondicionado. El estado de aire informado por el
firmware es solo el estado de software; no confirma que el equipo haya
respondido.

El extractor se activa por temperatura o humedad; el aire acondicionado, por
temperatura. La luz se enciende cuando la entrada indica que la puerta está
abierta.

Si `CAMERA_IP` no está vacío, el dispositivo anuncia `{deviceId, ip}` en
`datacenter/camera/ip` al conectarse. En ese anuncio `deviceId` es texto; en
la telemetría es numérico.

Los relés, la puerta y los códigos infrarrojos deben verificarse con el
cableado y el hardware reales antes de energizar actuadores. La guía para
configurar el broker y asociar la placa está en
[Conectar una placa por MQTT](../../docs/conectar-dispositivo-mqtt.md).
