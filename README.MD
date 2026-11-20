# ClusterControl

Aplicación web para administrar clusters y consultar telemetría de dispositivos
conectados por MQTT. Incluye una API, una interfaz web, PostgreSQL y un broker
MQTT.

## Requisitos

- Docker Desktop o Docker Engine con Docker Compose v2.
- Git.

No necesitas instalar Node.js ni Python para iniciar la aplicación con Docker.

## Desarrollo

1. Si todavía no tienes el archivo local de desarrollo, créalo desde la
   plantilla:

   ```powershell
   if (-not (Test-Path .env.development.local)) {
     Copy-Item .env.example .env.development.local
   }
   ```

   `.env.development.local` es local y no se sube a Git. El Compose de desarrollo
   usa credenciales de prueba `admin` / `admin123` y crea clusters de ejemplo.
   No sobrescribas un archivo local que ya tenga tu configuración. No expongas
   este entorno ni uses esas credenciales en producción. El broker de desarrollo
   permite conexiones MQTT anónimas; mantenlo en una red local de confianza.
   Como `.env.example` contiene valores de producción, en
   `.env.development.local` cambia `API_URL` por una dirección accesible desde
   el navegador. Con los puertos locales predeterminados, usa:

   ```dotenv
   API_URL=http://localhost:3000
   SOCKET_URL=
   ```

   Si accedes desde otro equipo, reemplaza `localhost` por la IP o el DNS del
   servidor. `SOCKET_URL` vacío hace que Socket.IO use ese mismo host. Este es
   el único archivo de entorno de desarrollo; el backend también lo usa al
   ejecutarse directamente.

2. Desde la raíz del repositorio, inicia los servicios:

   ```powershell
   docker compose --env-file .env.development.local -f docker-compose.dev.yml up --build -d
   ```

3. Abre <http://localhost:4200> e inicia sesión. Otros accesos locales:

   - API: <http://localhost:3000>
   - pgAdmin: <http://localhost:5050> (por defecto, `admin@example.com` /
     `development-only-change-me`)
   - MQTT: `localhost:1883`

El código fuente del backend y frontend está montado desde el host. Al guardar
cambios, Nest reinicia la API y Angular actualiza la web automáticamente; no
hace falta reconstruir las imágenes para cambios de código. Los cambios en
dependencias o Dockerfiles sí requieren reconstrucción:

```powershell
docker compose --env-file .env.development.local -f docker-compose.dev.yml up --build -d backend frontend
```

El entorno incluye PostgreSQL, Mosquitto, el simulador MQTT y un contenedor de
pruebas industriales que queda en espera hasta que lo uses. El simulador
publica telemetría de ejemplo para China y Alemania; el dashboard de desarrollo
muestra esas lecturas junto con las de dispositivos reales, pero excluye los
datos de pruebas industriales. Si cambias la configuración del clima, agrega tu
`OPENWEATHER_API_KEY` a `.env.development.local` y recrea el backend:

```powershell
docker compose --env-file .env.development.local -f docker-compose.dev.yml up -d --force-recreate backend
```

Sin una clave válida de OpenWeather, el panel del clima no está disponible. El
simulador no necesita configuración adicional. Detenlo si vas a probar hardware
real sin lecturas sintéticas:

```powershell
docker compose --env-file .env.development.local -f docker-compose.dev.yml stop simulator
```

Para ver logs o detener el entorno:

```powershell
docker compose --env-file .env.development.local -f docker-compose.dev.yml logs -f
docker compose --env-file .env.development.local -f docker-compose.dev.yml down
```

Los datos se conservan al detener los servicios. `down -v` también elimina los
volúmenes de desarrollo y la base de datos.

## Producción

1. En la primera instalación, copia `.env.example` como `.env` en el servidor.
   No reemplaces un `.env` que ya contenga la configuración de producción.
2. Reemplaza todos los valores `REEMPLAZAR_*` por valores seguros. Configura
   `API_URL=/api` (para que Angular use el proxy Nginx) y, si el backend no es
   accesible como `backend` en la red de Compose, ajusta `BACKEND_URL`.
   Configura contraseñas únicas y asegúrate de que `POSTGRES_PASSWORD` y
   `DB_PASSWORD` coincidan.
3. Inicia o actualiza los servicios:

   ```bash
   docker compose --env-file .env -f docker-compose.yml up -d
   ```

   Si las imágenes son privadas, inicia sesión con `docker login ghcr.io`.
   El backend aplica las migraciones al iniciar; antes de actualizar una
   instalación existente, realiza una copia de seguridad de PostgreSQL.

El workflow de CI ejecuta pruebas en pull requests y publica las imágenes en
pushes a `main` o a etiquetas `v*` ([workflow](./.github/workflows/ci-cd.yml)).
Publica etiquetas `latest`, de commit y de versión para los tags `v*`. Por
defecto Compose usa `latest`; para fijar una versión, configura
`BACKEND_IMAGE` y `FRONTEND_IMAGE` en `.env` con sus etiquetas, por ejemplo
`ghcr.io/aleisistan/clustercontrol-backend:v1.0.0`. Compose consulta las
imágenes en cada `up`. Producción no monta el código fuente ni lo recarga
automáticamente.

La aplicación queda disponible en el puerto `FRONTEND_HOST_PORT` (80 por
defecto). Nginx sirve el frontend y pasa `/api` y Socket.IO al backend por la
red interna. Producción no incluye pgAdmin, simulador, clusters de muestra ni
runner de pruebas industriales. El administrador inicial se define mediante
`INITIAL_ADMIN_USERNAME` y `INITIAL_ADMIN_PASSWORD`. El panel de pruebas puede
seguir visible, pero sin runner no tendrá resultados y mostrará el estado
desconocido/inactivo.

El Compose de producción usa un listener MQTT autenticado. Antes de iniciar los
servicios, copia `mosquitto/config/aclfile.example` como `aclfile` en el
servidor, crea el archivo de contraseñas del broker y configura las credenciales
del backend en `.env`. El `aclfile` operativo y `password_file` son locales y
están excluidos de Git. Antes de iniciar el broker, asígnalos al usuario
`mosquitto` y restringe sus permisos según la
[guía de conexión](./docs/conectar-dispositivo-mqtt.md). Si cambias `MQTT_USER`
o el usuario del dispositivo, actualiza también los nombres en el `aclfile`
operativo y al generar `password_file`; la guía de conexión explica cómo
preparar el servidor, el firewall y las placas.

## Clusters, dispositivos y cámaras

Los administradores crean clusters desde **Clusters**. El alta registra el
cluster y asigna su `deviceId`; no descubre ni conecta una placa automáticamente.
Para emparejar el dispositivo, configura ese identificador y el broker MQTT en
su firmware, y verifica que llegue telemetría. Consulta la
[guía de conexión de dispositivos](./docs/conectar-dispositivo-mqtt.md). Los
clusters de demostración se crean solo en desarrollo.

En el mismo menú se pueden asociar hasta dos cámaras a cada cluster, con nombre
y dirección IP o URL de stream.

Para streams MJPEG con host IP, el backend comparte una conexión de cámara
entre los dashboards de esa instancia; las URL HLS con host IP se retransmiten
por proxy. Las URL con nombre de dominio se abren desde su origen y no usan el
relay compartido. No configures la cámara en una variable de entorno. Consulta
la [guía de cámaras](./docs/camera-stream-multicliente.md). Como alternativa,
un dispositivo que publique la IP de su cámara por MQTT puede crear o
actualizar ese registro.

## Hardware

Los esquemas y la placa están en [hardware/esp32/KiCad](./hardware/esp32/KiCad/)
y se describen en su [README](./hardware/esp32/KiCad/readme.md). El pinout,
los umbrales y la configuración del ESP32 están en la
[guía del firmware](./firmware/ClusterControl_ESP32/README.md).

## Pruebas

Para instalar dependencias, compilar y ejecutar pruebas unitarias, sigue los
README de [backend](./backend/README.md) y [frontend](./frontend/README.md).
Las pruebas industriales requieren el entorno de desarrollo; consulta su
[guía](./tests-industriales/README.md).
