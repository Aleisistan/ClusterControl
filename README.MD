# ClusterControl

Aplicación para supervisar y gestionar clusters de centros de datos. El repositorio contiene una interfaz web, una API, una base de datos PostgreSQL, un broker MQTT y un simulador de telemetría para desarrollo.

> **Estado del despliegue:** [docker-compose.dev.yml](./docker-compose.dev.yml) configura un entorno de desarrollo. No está preparado como configuración de producción.

## Arquitectura

| Servicio | Tecnología / imagen | Puerto en el host | Función |
| --- | --- | ---: | --- |
| `frontend` | Angular, Node.js 20 | 4200 | Interfaz web |
| `backend` | NestJS, Node.js 20 | 3000 | API y lógica de aplicación |
| `postgres` | PostgreSQL 16 | 5432 | Persistencia |
| `mosquitto` | Eclipse Mosquitto 2 | 1883 | Broker MQTT |
| `pgadmin` | pgAdmin 4 | 5050 | Administración de PostgreSQL |
| `simulator` | Node.js y MQTT.js | — | Publica telemetría de prueba |
| `corx` | `ghcr.io/venipa/corx:latest` | 3001 | Servicio auxiliar incluido en Compose |

Los contenedores comparten la red de Compose. Por eso, el backend debe conectarse a PostgreSQL mediante `postgres:5432` y al broker mediante `mosquitto:1883`, no mediante `localhost`.

## Requisitos

- Docker Desktop con Docker Compose v2, o Docker Engine y el complemento Docker Compose.
- Git para clonar el repositorio.
- Navegador web para acceder a la interfaz.

No es necesario instalar Node.js localmente para levantar los servicios con Compose. Los `Dockerfile` utilizan Node.js 20.

## Configuración inicial

1. Clonar el repositorio y abrir una terminal en su directorio raíz:

   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd ClusterControl
   ```

2. Crear los archivos locales de variables de entorno a partir de las plantillas. Los archivos `.env` se ignoran en Git. **No subir contraseñas, claves JWT ni claves de servicios externos al repositorio.**

   ```bash
   cp .env.example .env
   cp backend/.env.example backend/.env
   ```

   Las plantillas incluyen comentarios y tips para Docker, MQTT, PostgreSQL, JWT, SMTP y los servicios opcionales.

   En el archivo `.env` de la raíz, configurar las variables que consume Compose y PostgreSQL:

   ```dotenv
   POSTGRES_DB=datacenter
   POSTGRES_USER=dcuser
   POSTGRES_PASSWORD=cambiar_por_una_clave_local
   PGADMIN_EMAIL=admin@example.com
   PGADMIN_PASSWORD=cambiar_por_una_clave_local
   ```

   El usuario y la base de datos deben coincidir con los valores `dcuser` y `datacenter` que utiliza el healthcheck de PostgreSQL en Compose.

   Crear también `backend/.env`, que utiliza la API:

   ```dotenv
   PORT=3000
   DB_HOST=postgres
   DB_PORT=5432
   DB_USER=dcuser
   DB_PASSWORD=cambiar_por_una_clave_local
   DB_NAME=datacenter
   MQTT_SERVER=mosquitto
   MQTT_PORT=1883
   MQTT_USER=
   MQTT_PASSWORD=
   JWT_SECRET=reemplazar_por_un_secreto_largo_y_aleatorio
   JWT_EXPIRES=1d
   CAMERA_URL=
   OPENWEATHER_API_KEY=
   ```

   `DB_PASSWORD` debe coincidir con `POSTGRES_PASSWORD`. El broker está configurado para permitir conexiones anónimas; por eso `MQTT_USER` y `MQTT_PASSWORD` se dejan vacíos en el entorno local. `OPENWEATHER_API_KEY` solo es necesaria para las funciones que consultan ese servicio externo.

## Primera instalación

En un equipo nuevo, la primera ejecución crea la base, las tablas, el usuario administrador inicial y los clusters de demostración. Desde la raíz del proyecto:

```bash
docker compose -f docker-compose.dev.yml up --build -d
docker compose -f docker-compose.dev.yml ps
```

La primera cuenta es `admin` con contraseña `admin123`. Cambia esa contraseña desde la sección de usuarios antes de conectar equipos reales. Los clusters de demostración se crean una sola vez; si la base ya tiene datos, el seed no los reemplaza.

El volumen `postgres_data` conserva la instalación entre reinicios. `docker compose -f docker-compose.dev.yml down` detiene los servicios sin perder información. `down -v` elimina también la base y debe reservarse para una instalación de desarrollo que se quiera reiniciar desde cero.

## Levantar la aplicación en desarrollo

Desde el directorio raíz, construir las imágenes e iniciar los servicios:

```bash
docker compose -f docker-compose.dev.yml up --build -d
```

Comprobar el estado:

```bash
docker compose -f docker-compose.dev.yml ps
```

Accesos locales:

- Interfaz web: <http://localhost:4200>
- API: <http://localhost:3000>
- pgAdmin: <http://localhost:5050>
- MQTT: `localhost:1883` desde el host; dentro de la red Docker, `mosquitto:1883`
- PostgreSQL: `localhost:5432` desde el host; dentro de la red Docker, `postgres:5432`
- Servicio `corx`: <http://localhost:3001>

### Acceso externo y rate limiting de `corx`

En el Compose de desarrollo, `corx` tiene habilitado el rate limiting (`RATE_LIMIT_ENABLED=true`) y usa el servicio `redis` mediante `REDIS_URL=redis://redis:6379`. Compose inicia `corx` cuando Redis pasa su comprobación de salud. Redis no publica ningún puerto al host y solo es accesible dentro de la red privada de Compose.

Si se expone `corx` fuera de la máquina, el rate limiting seguirá activo. Redis debe permanecer en la red privada y no exponerse directamente a Internet. La exposición pública también requiere configurar la red, el firewall y, preferentemente, un proxy con HTTPS; este Compose es solo para desarrollo y no está preparado como configuración de producción.

El simulador publica cada 15 segundos mensajes de ejemplo en el tópico `datacenter/ambiente`. En una instalación conectada a hardware real, detenlo para no mezclar lecturas sintéticas con las del dispositivo:

```bash
docker compose -f docker-compose.dev.yml stop simulator
```

La API se suscribe a los tópicos definidos en [backend/src/config/topics.ts](./backend/src/config/topics.ts).

Para seguir los registros:

```bash
docker compose -f docker-compose.dev.yml logs -f
```

Para detener los contenedores sin borrar los datos persistidos:

```bash
docker compose -f docker-compose.dev.yml down
```

PostgreSQL conserva sus datos en el volumen `postgres_data`. Eliminar volúmenes con `docker compose -f docker-compose.dev.yml down -v` borra esos datos; hacerlo solo si se desea reiniciar la base desde cero.

## CI/CD y despliegue de producción

El workflow [ci-cd.yml](./.github/workflows/ci-cd.yml) ejecuta las pruebas y builds de backend y frontend en GitHub Actions. En cada push publica las imágenes de producción en GitHub Container Registry y Docker Hub:

- `ghcr.io/aleisistan/clustercontrol-backend`
- `ghcr.io/aleisistan/clustercontrol-frontend`
- `<DOCKERHUB_USERNAME>/clustercontrol-backend`
- `<DOCKERHUB_USERNAME>/clustercontrol-frontend`

Configurar en el repositorio los secrets `DOCKERHUB_USERNAME` y `DOCKERHUB_TOKEN` (usar un access token de Docker Hub, no la contraseña). Para el frontend, configurar opcionalmente las variables de repositorio `FRONTEND_API_URL`, `FRONTEND_CAMERA_1_URL` y `FRONTEND_CAMERA_2_URL`; se incorporan durante el build porque Angular genera un bundle estático.

El archivo [docker-compose.production.yml](./docker-compose.production.yml) no compila código, no monta el código fuente y no inicia watchers ni el simulador. **La fuente principal de imágenes es GitHub Container Registry (GHCR); Docker Hub se publica únicamente como backup.** En el servidor, copiar `.env` y `backend/.env` y ejecutar:

```bash
docker login ghcr.io
docker compose -f docker-compose.production.yml pull
docker compose -f docker-compose.production.yml up -d
```

Por defecto el Compose utiliza exclusivamente estas imágenes de GHCR con la etiqueta `latest`:

```text
ghcr.io/aleisistan/clustercontrol-backend:latest
ghcr.io/aleisistan/clustercontrol-frontend:latest
```

Docker Hub no se consulta durante el funcionamiento normal. Solo si GHCR no estuviera disponible se puede hacer un cambio manual de contingencia en `.env`:

```dotenv
BACKEND_IMAGE=<DOCKERHUB_USERNAME>/clustercontrol-backend:latest
FRONTEND_IMAGE=<DOCKERHUB_USERNAME>/clustercontrol-frontend:latest
```

El frontend se sirve con Nginx en el puerto `4200`; el backend se ejecuta con `node dist/main`, sin `--watch`, polling ni volúmenes de código. El servicio `simulator` queda deliberadamente fuera de producción para no inyectar telemetría sintética junto con los equipos reales.

## Inicialización y persistencia de la base de datos

Compose monta `backend/database` como directorio de inicialización de PostgreSQL. Los scripts de esa carpeta se ejecutan automáticamente cuando PostgreSQL inicializa por primera vez el volumen de datos. El script SQL actual es [backend/database/init.sql](./backend/database/init.sql).

Si el volumen ya fue inicializado, cambiar ese script no vuelve a ejecutarlo. Para aplicar cambios posteriores, utilizar una migración o una operación explícita sobre la base existente. Para recrear una base vacía en desarrollo, se puede borrar el volumen con el comando `down -v` indicado arriba.

## Historial de telemetría y cambios de estado

El dashboard permite consultar el historial de temperatura y humedad, y el historial de cambios del extractor, el aire, la puerta y la luz usando el mismo filtro de fechas. Cada cambio muestra la fecha y hora, el estado anterior y el nuevo, junto con las mediciones de ambos sensores de temperatura y humedad registradas en esa lectura.

El filtro «Últimos 7 días completos» excluye el día de hoy y abarca los siete días calendario anteriores. Debajo del gráfico, los días u horas se pueden seleccionar para ampliar el gráfico a ese período; la opción de volver al período completo restaura la vista anterior. Cada bloque indica si hubo lecturas o si figura «Sin registros». El historial de estados se obtiene de las muestras de telemetría ya guardadas, comparando cada muestra con la anterior; no requiere una tabla adicional. La API expone este historial en `GET /telemetry/state-history` y conserva el límite existente de 30 días y hasta 2000 resultados por consulta. Cuando hay más de 2000 muestras, el historial de temperatura y humedad selecciona hasta 2000 lecturas distribuidas a lo largo de todo el período consultado.

## Alta de un cluster y dispositivo

El cluster es el registro lógico del sitio en la base de datos. El dispositivo físico tiene además un `deviceId`, que es el valor que debe viajar en cada mensaje MQTT. Al crear un cluster desde `/admin/clusters`, el backend genera un `deviceId` numérico si no se proporciona uno y verifica que no esté repetido. Los IDs existentes se conservan para no romper equipos ya instalados.

La creación del cluster no programa el Arduino por sí sola. Después de guardarlo:

1. Copia el `deviceId` que aparece en la tabla de clusters.
2. Configura ese valor en `firmware/esp32-mqtt-base/config.h`.
3. Configura en el firmware la IP o nombre DNS del equipo que ejecuta Mosquitto.
4. Adapta las lecturas de sensores en `sensor_adapter.h`.
5. Carga el sketch y verifica en el monitor serie que el equipo se conecta.
6. Comprueba que el dashboard recibe telemetría del cluster correcto.

El backend ignora mensajes cuyo `deviceId` no existe y deja constancia en sus logs. No uses el `cluster.id` en el firmware: ese valor es interno de la base; el dispositivo debe usar el `deviceId` asignado.

El contrato de telemetría, el procedimiento de carga y las decisiones de seguridad están documentados en [firmware/esp32-mqtt-base/README.md](./firmware/esp32-mqtt-base/README.md). El sketch base se encuentra en [firmware/esp32-mqtt-base/esp32-mqtt-base.ino](./firmware/esp32-mqtt-base/esp32-mqtt-base.ino). La adaptación del hardware queda separada en [firmware/esp32-mqtt-base/sensor_adapter.h](./firmware/esp32-mqtt-base/sensor_adapter.h).

## Servicios y código fuente

- Compose de desarrollo: [docker-compose.dev.yml](./docker-compose.dev.yml)
- Dockerfiles de desarrollo: [backend/Dockerfile.dev](./backend/Dockerfile.dev) y [frontend/Dockerfile.dev](./frontend/Dockerfile.dev)
- Dockerfiles de producción: [backend/Dockerfile](./backend/Dockerfile) y [frontend/Dockerfile](./frontend/Dockerfile)
- Configuración del broker MQTT: [mosquitto/config/mosquitto.conf](./mosquitto/config/mosquitto.conf)
- API NestJS: [backend/src](./backend/src), con dependencias y scripts en [backend/package.json](./backend/package.json)
- Aplicación Angular: [frontend/src](./frontend/src), con dependencias y scripts en [frontend/package.json](./frontend/package.json)
- Simulador MQTT: [simulator/simulator.js](./simulator/simulator.js)
- Inicialización SQL: [backend/database/init.sql](./backend/database/init.sql)
- Pruebas industriales y endurance: [tests-industriales/README.md](./tests-industriales/README.md)

El simulador envía valores ficticios para dos dispositivos. Para probar la integración desde una placa, esta debe poder alcanzar por la red la dirección IP del equipo que ejecuta Docker y el puerto MQTT `1883`. En la configuración actual el broker permite conexiones anónimas, por lo que debe utilizarse solo en una red de desarrollo confiable y no exponerse directamente a Internet.

## Pendientes de endurecimiento para producción

El archivo [docker-compose.dev.yml](./docker-compose.dev.yml) sigue siendo solo para desarrollo. El despliegue real debe usar [docker-compose.production.yml](./docker-compose.production.yml), que ya excluye el simulador y ejecuta las imágenes compiladas sin watchers. Antes de exponerlo en Internet hay que completar, como mínimo, estas tareas:

- Cambiar `JWT_SECRET`, contraseñas de PostgreSQL, pgAdmin y MQTT.
- Desactivar MQTT anónimo y definir usuarios y ACL por dispositivo.
- No publicar PostgreSQL ni pgAdmin fuera de la red de administración.
- Servir el frontend y la API detrás de HTTPS y un proxy con límites de acceso.
- Fijar versiones de las imágenes y dependencias en lugar de depender de `latest`.
- Definir copias de seguridad y una política de restauración para `postgres_data`.
- Sustituir `synchronize: true` por migraciones controladas antes de modificar el esquema en producción.
- Revisar los topics de actuadores: están reservados, pero el backend todavía no implementa un flujo completo para comandarlos.

El broker de desarrollo escucha en el puerto `1883` y permite conexiones anónimas. Esa configuración es útil para probar una placa en una red local aislada, pero no debe exponerse directamente a Internet.

### Diseño electrónico

El repositorio no fija un modelo único de sensores, relés o cámaras. La distribución de pines, tensiones y protecciones debe documentarse junto con la variante de cada placa. El firmware base deja esa parte en `sensor_adapter.h` para que una adaptación no cambie el contrato MQTT ni mezcle credenciales con la lógica de sensores.
