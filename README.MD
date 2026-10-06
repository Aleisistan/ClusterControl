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

2. Crear los archivos locales de variables de entorno. El repositorio no incluye plantillas `.env.example`; los archivos `.env` se ignoran en Git. **No subir contraseñas, claves JWT ni claves de servicios externos al repositorio.**

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

## Levantar la aplicación

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

El simulador publica cada 15 segundos mensajes de ejemplo en el tópico `datacenter/ambiente`. La API se suscribe a los tópicos definidos en [backend/src/config/topics.ts](./backend/src/config/topics.ts).

Para seguir los registros:

```bash
docker compose -f docker-compose.dev.yml logs -f
```

Para detener los contenedores sin borrar los datos persistidos:

```bash
docker compose -f docker-compose.dev.yml down
```

PostgreSQL conserva sus datos en el volumen `postgres_data`. Eliminar volúmenes con `docker compose -f docker-compose.dev.yml down -v` borra esos datos; hacerlo solo si se desea reiniciar la base desde cero.

## Inicialización y persistencia de la base de datos

Compose monta `backend/database` como directorio de inicialización de PostgreSQL. Los scripts de esa carpeta se ejecutan automáticamente cuando PostgreSQL inicializa por primera vez el volumen de datos. El script SQL actual es [backend/database/init.sql](./backend/database/init.sql).

Si el volumen ya fue inicializado, cambiar ese script no vuelve a ejecutarlo. Para aplicar cambios posteriores, utilizar una migración o una operación explícita sobre la base existente. Para recrear una base vacía en desarrollo, se puede borrar el volumen con el comando `down -v` indicado arriba.

## Historial de telemetría y cambios de estado

El dashboard permite consultar el historial de temperatura y humedad, y el historial de cambios del extractor, el aire, la puerta y la luz usando el mismo filtro de fechas. Cada cambio muestra la fecha y hora, el estado anterior y el nuevo, junto con las mediciones de ambos sensores de temperatura y humedad registradas en esa lectura.

El filtro «Últimos 7 días completos» excluye el día de hoy y abarca los siete días calendario anteriores. Debajo del gráfico, los días u horas se pueden seleccionar para ampliar el gráfico a ese período; la opción de volver al período completo restaura la vista anterior. Cada bloque indica si hubo lecturas o si figura «Sin registros». El historial de estados se obtiene de las muestras de telemetría ya guardadas, comparando cada muestra con la anterior; no requiere una tabla adicional. La API expone este historial en `GET /telemetry/state-history` y conserva el límite existente de 30 días y hasta 2000 resultados por consulta. Cuando hay más de 2000 muestras, el historial de temperatura y humedad selecciona hasta 2000 lecturas distribuidas a lo largo de todo el período consultado.

## Servicios y código fuente

- Compose de desarrollo: [docker-compose.dev.yml](./docker-compose.dev.yml)
- Configuración del broker MQTT: [mosquitto/config/mosquitto.conf](./mosquitto/config/mosquitto.conf)
- API NestJS: [backend/src](./backend/src), con dependencias y scripts en [backend/package.json](./backend/package.json)
- Aplicación Angular: [frontend/src](./frontend/src), con dependencias y scripts en [frontend/package.json](./frontend/package.json)
- Simulador MQTT: [simulator/simulator.js](./simulator/simulator.js)
- Inicialización SQL: [backend/database/init.sql](./backend/database/init.sql)

El simulador envía valores ficticios para dos dispositivos. Para probar la integración desde una placa, esta debe poder alcanzar por la red la dirección IP del equipo que ejecuta Docker y el puerto MQTT `1883`. En la configuración actual el broker permite conexiones anónimas, por lo que debe utilizarse solo en una red de desarrollo confiable y no exponerse directamente a Internet.

## Firmware Arduino y diseño electrónico

### Firmware ESP32

Los archivos de firmware no se enlazan por ahora porque contienen credenciales de red o del broker configuradas directamente en el código. Permanecen en la copia local; antes de agregarlos o publicarlos, reemplaza esas credenciales por configuración local no versionada y verifica que no queden claves reales en los archivos.

### Diseño de la placa

Los archivos del diseño electrónico no se enlazan desde el README por ahora. Se agregarán los enlaces cuando el proyecto esté publicado y accesible desde el repositorio.
