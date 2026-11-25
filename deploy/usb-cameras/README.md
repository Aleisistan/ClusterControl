# Publicar cámaras USB con µStreamer

Este Compose publica las cámaras V4L2 del Debian como streams MJPEG HTTP sin
acceso a `/dev/video*` desde ClusterControl:

- `/dev/video0` → `http://192.168.2.228:8081/stream`
- `/dev/video2` → `http://192.168.2.228:8082/stream`

La configuración publica MJPEG 1280×720 a 30 FPS, formato soportado por ambas
cámaras del servidor y transmitido directamente sin recodificación. Los puertos
se enlazan a la IP LAN `192.168.2.228`. Ajusta los mapeos de `compose.yaml` si
cambia esa dirección.

Desde este directorio, instala y arranca los servicios:

```sh
docker compose -f compose.yaml up -d --build
docker compose -f compose.yaml ps
```

Comprueba el estado de cada stream:

```sh
curl -I http://192.168.2.228:8081/stream
curl -I http://192.168.2.228:8082/stream
```

En **Clusters**, configura las URLs completas indicadas arriba. El backend usa
el stream para la vista en vivo y FFmpeg para extraer un JPEG al abrirse la
puerta, aunque el stream no tenga un endpoint `/capture`.

Para construir y activar el backend actualizado del proyecto sin intentar
descargar una imagen remota:

```sh
cd /opt/ClusterControl
docker build -t clustercontrol-backend-camera:local -f backend/Dockerfile backend
docker compose \
  -f docker-compose.yml \
  -f deploy/usb-cameras/backend.override.yaml \
  up -d --no-deps backend
```

Al actualizar el stack, conserva el override para que el backend siga usando
esta imagen local. El frontend ya permite guardar direcciones IP y URLs HTTP(S)
completas; selecciona una URL completa para cada stream.

Los streams no tienen autenticación propia. Mantén estos puertos en la red
confiable del servidor y no los publiques en Internet.
