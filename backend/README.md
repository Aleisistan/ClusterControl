# Backend

API NestJS que autentica usuarios, recibe telemetría MQTT y ofrece los datos al
frontend. En el uso habitual, se ejecuta con el Compose de desarrollo desde la
raíz del repositorio. El código está montado desde el host y Nest reinicia la
API al guardar cambios, también en Docker Desktop para Windows.

```powershell
docker compose --env-file .env.development.local -f docker-compose.dev.yml up --build -d backend
docker compose --env-file .env.development.local -f docker-compose.dev.yml logs -f backend
```

Para trabajar directamente en el backend, instala dependencias y usa el modo de
desarrollo:

```bash
npm ci
npm run start:dev
```

La ejecución directa requiere Node.js 22.22.3 o una versión compatible más
reciente, configurar las variables de entorno en el archivo raíz
`.env.development.local` y tener disponibles PostgreSQL y Mosquitto. `.env` en
la raíz se reserva para producción; ya no se usa un archivo de entorno dentro
de `backend/`. Para pruebas y compilación:

```bash
npm test -- --runInBand
npm run build
```

Las migraciones se ejecutan automáticamente al iniciar la API; el esquema no
se sincroniza automáticamente en ningún entorno. La migración inicial crea las
tablas en una base vacía y reconoce una base anterior solo si ya contiene todas
las tablas actuales. Si encuentra un esquema parcial, detiene el arranque en
lugar de modificarlo silenciosamente. Antes de actualizar una base existente,
haz una copia de seguridad.

Para generar futuras migraciones desde una base de desarrollo que refleje el
esquema anterior, usa el contenedor `backend` (que resuelve `DB_HOST=postgres`)
o cambia `DB_HOST` a `localhost` si ejecutas el comando en el host:

```bash
npm run migration:generate -- src/database/migrations/NombreDelCambio -d src/data-source.ts
```

El README principal explica cómo iniciar desarrollo y producción. Producción
usa una imagen compilada, sin montar el código fuente ni watch mode, y recibe
las peticiones del frontend mediante Nginx.
