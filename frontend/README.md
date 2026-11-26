# Frontend

Interfaz Angular para administrar clusters, cámaras y consultar telemetría. En
desarrollo se sirve con Angular CLI en el puerto 4200; en producción, Nginx
sirve los archivos compilados y hace de proxy para la API y Socket.IO.
El Compose de desarrollo monta el código local y usa polling para detectar
cambios; Angular actualiza la página al guardar archivos.

La forma recomendada de iniciar el frontend integrado con el backend es usar
el [Compose de desarrollo](../README.MD#desarrollo). Para ejecutarlo por
separado, requiere Node.js 22.22.3 (la versión usada por Docker y CI). Desde
este directorio:

```powershell
npm ci
npm start
```

La ejecución local espera que la API esté disponible en `localhost:3000`; para
usar otro host, define `API_URL` antes de ejecutar `npm start`.

En el dashboard, las capturas de apertura de puerta se ordenan de más nueva a
más antigua: se muestran hasta cuatro en línea y las demás quedan en un
desplegable. El panel de estado de pruebas industriales solo se muestra y
consulta en desarrollo.

Para compilar o ejecutar las pruebas unitarias:

```powershell
npm run build
npm test -- --watch=false --browsers=ChromeHeadless
```

En producción, `apiUrl` usa `/api`; el proxy de Nginx enruta las peticiones al
backend. La imagen productiva es compilada y no monta el código local; para
publicar cambios se construye y despliega una nueva imagen. No configures una
URL de API pública en el frontend productivo.
