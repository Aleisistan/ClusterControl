# Firmware base ESP32

Plantilla para dispositivos que publican telemetría en ClusterControl. Hay que
adaptar las conexiones de sensores y entradas en `sensor_adapter.h` a cada
placa.

## Preparar el equipo

1. Copia `config.h.example` como `config.h`.
2. Configura Wi-Fi, dirección del broker MQTT y el `deviceId` del cluster.
3. Adapta `sensor_adapter.h` y revisa tensiones, alimentación y conexiones.
4. Compila y carga el sketch con PlatformIO o Arduino IDE.
5. Comprueba en el dashboard que llegan datos al cluster correcto.

`config.h` puede contener credenciales: no lo subas al repositorio. Usa el
`deviceId` asignado al cluster desde la pantalla **Clusters**, no el ID interno
de la base de datos.

Con PlatformIO, desde este directorio:

```bash
pio run
pio run --target upload
pio device monitor
```

El proyecto utiliza ESP32 by Espressif Systems, PubSubClient y ArduinoJson 7.
La configuración de PlatformIO se encuentra en `platformio.ini`.

## MQTT y cámaras

La telemetría se publica en `datacenter/ambiente` (cada 15 segundos por
defecto), incluyendo `deviceId`, sensores y estados. Si se configura
`CAMERA_IP`, el equipo anuncia la IP de la cámara en
`datacenter/camera/ip`; el backend puede crear o actualizar el registro de esa
cámara. Si no usas este anuncio, agrega la cámara desde el menú **Clusters** de
la web. En ambos casos, el dashboard accede al video a través del relay de la
API.

El backend ignora telemetría de `deviceId` que no corresponda a un cluster
existente. Los tópicos de comandos de actuadores están reservados, pero no hay
un flujo de control completo implementado.

## Seguridad

El broker incluido permite conexiones anónimas por defecto. No lo expongas a
Internet ni lo uses en una red no confiable sin configurar autenticación, ACL
y TLS.
Verifica el cableado y los límites eléctricos antes de conectar hardware.
