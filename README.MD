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
   No sobrescribas un archivo local que ya tenga tu configuración. Cambia las
   credenciales antes de conectar hardware real. Configura `API_URL` con una
   URL accesible desde el navegador (por ejemplo, `http://localhost:3000` o la
   IP del servidor); `SOCKET_URL` puede quedar vacío para usar la misma URL de
   API. Es el único archivo de entorno de desarrollo; el backend también lo usa
   al ejecutarse directamente.

2. Desde la raíz del repositorio, inicia los servicios:

   ```powershell
   docker compose --env-file .env.development.local -f docker-compose.dev.yml up --build -d
   ```

3. Abre <http://localhost:4200> e inicia sesión. Otros accesos locales:

   - API: <http://localhost:3000>
   - pgAdmin: <http://localhost:5050>
   - MQTT: `localhost:1883`

El código fuente del backend y frontend está montado desde el host. Al guardar
cambios, Nest reinicia la API y Angular actualiza la web automáticamente; no
hace falta reconstruir las imágenes para cambios de código. Los cambios en
dependencias o Dockerfiles sí requieren reconstrucción:

```powershell
docker compose --env-file .env.development.local -f docker-compose.dev.yml up --build -d backend frontend
```

El entorno incluye PostgreSQL, Mosquitto, el simulador MQTT y herramientas
opcionales para pruebas industriales. El simulador publica telemetría de
ejemplo para China y Alemania; el dashboard de desarrollo muestra esas lecturas
junto con las de dispositivos reales, pero excluye los datos de pruebas
industriales. Si cambias la configuración del clima, agrega tu
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

1. Copia `.env.example` como `.env` en el servidor.
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

El workflow de CI ejecuta pruebas en pull requests y publica las imágenes en
pushes a `main` o a etiquetas `v*` ([workflow](./.github/workflows/ci-cd.yml)).
El Compose usa la etiqueta `latest` y fuerza la consulta de las imágenes en
cada `up`; cuando CI publique una nueva versión, vuelve a ejecutar el comando
para actualizar los contenedores. Producción no monta el código fuente ni lo
recarga automáticamente.
La aplicación queda disponible en el puerto `FRONTEND_HOST_PORT` (80 por
defecto). Nginx sirve el frontend y pasa `/api` y Socket.IO al backend por la
red interna. Producción no incluye pgAdmin, simulador, clusters de muestra ni
runner de pruebas industriales. El administrador inicial se define mediante
`INITIAL_ADMIN_USERNAME` y `INITIAL_ADMIN_PASSWORD`. El panel de pruebas puede
seguir visible, pero sin runner no tendrá resultados y mostrará el estado
desconocido/inactivo.

Antes de exponer el servidor, configura HTTPS/firewall y asegura Mosquitto:
el broker incluido permite conexiones anónimas por defecto. Consulta
[`.env.example`](./.env.example) y [docker-compose.yml](./docker-compose.yml).

## Clusters, dispositivos y cámaras

Los administradores crean y gestionan clusters desde **Clusters** en la web.
Cada dispositivo debe publicar su `deviceId` en el tópico MQTT
`datacenter/ambiente`; este identificador no es el ID interno del cluster.
Los clusters de demostración se crean solo en desarrollo.

En el mismo menú se pueden asociar hasta dos cámaras a cada cluster, con nombre
y dirección IP o URL de stream.
Una misma instancia del backend retransmite el stream a todos los dashboards
conectados para compartir una conexión con la cámara. No configures la cámara
en una variable de entorno ni abras el stream directamente desde cada
navegador. Consulta
[la guía del relay de cámaras](./docs/camera-stream-multicliente.md) y
[la guía del firmware](./firmware/esp32-mqtt-base/README.md).
Como opción, un dispositivo que publique su IP de cámara por MQTT también
puede crear o actualizar ese registro.

## Pruebas

Desde `backend` o `frontend`, instala dependencias con `npm ci`; luego usa:

```bash
# backend
npm test -- --runInBand
npm run build

# frontend
npm test -- --watch=false --browsers=ChromeHeadless
npm run build
```

Las pruebas industriales requieren el entorno de desarrollo. Consulta
[tests-industriales/README.md](./tests-industriales/README.md).

Más detalles de cada componente: [backend](./backend/README.md) y
[frontend](./frontend/README.md).
