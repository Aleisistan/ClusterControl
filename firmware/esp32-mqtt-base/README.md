# Firmware base ESP32

Plantilla PlatformIO para una placa ESP32 Dev Module. La guía
[Conectar una placa por MQTT](../../docs/conectar-dispositivo-mqtt.md) explica
el alta del cluster, la red y broker del servidor, las credenciales y la
verificación de la conexión.

## Preparar el equipo

1. Copia `config.h.example` como `config.h`.
2. Configura Wi-Fi, dirección y credenciales del broker MQTT y el `deviceId`
   numérico que muestra ClusterControl al crear el cluster.
3. Adapta `sensor_adapter.h` a los sensores y actuadores de tu placa. Respeta
   sus pines, alimentación y niveles lógicos.
4. Compila, carga el sketch y comprueba el monitor serie.

`config.h` puede contener credenciales: no lo subas al repositorio. Usa el
`deviceId` de la pantalla **Clusters**, no el ID interno de base de datos.

Con PlatformIO, desde este directorio:

```bash
pio run
pio run --target upload
pio device monitor
```

El proyecto usa ESP32 by Espressif Systems, PubSubClient y ArduinoJson 7. Las
funciones iniciales de `sensor_adapter.h` devuelven `NAN`; implementa lecturas
válidas para que el sketch publique telemetría. `CAMERA_IP` es opcional; la guía
de conexión explica el anuncio MQTT y la alternativa de registrar la cámara
desde la web.

La plantilla actual usa MQTT TCP sin TLS. Conecta el broker solo en una red
confiable o VPN y no expongas credenciales por Internet.
