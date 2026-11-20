# Backend

API NestJS que autentica usuarios, recibe telemetría MQTT y ofrece los datos al
frontend. En el uso habitual, se ejecuta con el Compose de desarrollo desde la
raíz del repositorio. El código está montado desde el host y Nest reinicia la
API al guardar cambios, también en Docker Desktop para Windows.

```powershell
docker compose --env-file .env.development.local -f docker-compose.dev.yml up --build -d backend
docker compose --env-file .env.development.local -f docker-compose.dev.yml logs -f backend
```

Para trabajar directamente en el backend, requiere Node.js 22.22.3 (la versión
usada por Docker y CI), las variables del archivo raíz
`.env.development.local` y PostgreSQL y Mosquitto disponibles. `.env` en la
raíz se reserva para producción; no se usa un archivo de entorno dentro de
`backend/`.

Si PostgreSQL y Mosquitto aún no están activos, inicia esos servicios desde la
raíz:

```powershell
docker compose --env-file .env.development.local -f docker-compose.dev.yml up -d postgres mosquitto
```

Luego, desde `backend/`, instala dependencias y arranca la API. Como se ejecuta
en el host, usa `localhost` en lugar de los nombres Docker `postgres` y
`mosquitto`. Si cambiaste los puertos publicados, ajusta también `DB_PORT` y
`MQTT_PORT`:

```powershell
npm ci
$env:DB_HOST = "localhost"
$env:MQTT_SERVER = "localhost"
npm run start:dev
```

Para pruebas y compilación, ejecuta desde `backend/`:

```powershell
npm test -- --runInBand
npm run build
```

Las migraciones se ejecutan automáticamente al iniciar la API; el esquema no
se sincroniza automáticamente en ningún entorno. La migración inicial crea las
tablas en una base vacía y reconoce una base anterior solo si ya contiene todas
las tablas actuales. Si encuentra un esquema parcial, detiene el arranque en
lugar de modificarlo silenciosamente. Antes de actualizar una base existente,
haz una copia de seguridad.

Para generar una migración después de cambiar las entidades, usa una base de
desarrollo con el esquema anterior. Con el backend de desarrollo en ejecución,
lo más simple es hacerlo dentro del contenedor `backend`, donde
`DB_HOST=postgres` ya resuelve. Desde la raíz:

```powershell
docker compose --env-file .env.development.local -f docker-compose.dev.yml exec backend npm run migration:generate -- src/database/migrations/NombreDelCambio -d src/data-source.ts
```

Si ejecutas la generación desde el host, ve a `backend/`, cambia `DB_HOST` a
`localhost` y ajusta `DB_PORT` al puerto publicado:

```powershell
$env:DB_HOST = "localhost"
npm run migration:generate -- src/database/migrations/NombreDelCambio -d src/data-source.ts
```

El README principal explica cómo iniciar desarrollo y producción. Producción
usa una imagen compilada, sin montar el código fuente ni watch mode, y recibe
las peticiones del frontend mediante Nginx.
