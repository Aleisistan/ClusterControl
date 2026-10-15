# Incidente: acceso simultáneo al stream de la cámara

## Síntoma

Al abrir el stream MJPEG de la cámara directamente y, al mismo tiempo, cargarlo
en el dashboard, el video podía quedar disponible solo para uno de los clientes.
También se observó que el primer dashboard mostraba video, pero un segundo
dashboard no, aunque ambos alcanzaban el backend.

## Causa

La cámara ESP32-CAM entrega un stream MJPEG en
`http://<IP_DE_CAMARA>:81/stream`. Una conexión abierta directamente desde el
navegador consume una conexión de la cámara y puede impedir que el backend abra
su propia conexión. Por eso, durante el uso compartido, el stream directo debe
permanecer cerrado.

El acceso de los dashboards se diseñó como un relay:

1. Cada dashboard solicita `GET /camera/stream/:clusterId` al backend.
2. El backend abre una conexión al stream de la cámara.
3. `CameraStreamService` distribuye los mismos bytes a todos los dashboards
   conectados a esa cámara.
4. Al desconectarse el último dashboard, el backend cierra la conexión con la
   cámara.

Se detectó además un error al admitir espectadores tardíos: el backend copiaba
el encabezado `Content-Type` de la cámara solo a los espectadores que ya estaban
conectados cuando se establecía la conexión upstream. Los siguientes recibían
los bytes MJPEG sin ese encabezado, por lo que el navegador no los interpretaba
como imagen. El relay ahora guarda el tipo de contenido y lo aplica también a
cada espectador nuevo.

## Cambios

- El relay compartido está implementado en
  [`backend/src/camera/camera-stream.service.ts`](../backend/src/camera/camera-stream.service.ts).
- La ruta autenticada por cluster está en
  [`backend/src/camera/camera.controller.ts`](../backend/src/camera/camera.controller.ts).
- El dashboard usa la ruta del backend y no debe conectarse directamente a la
  IP de la cámara:
  [`frontend/src/app/dashboard/dashboard.component.ts`](../frontend/src/app/dashboard/dashboard.component.ts).
- La prueba de relay comprueba que un espectador que se conecta después del
  primero recibe el `Content-Type` MJPEG y comparte la misma conexión upstream:
  [`backend/src/camera/camera-stream.service.spec.ts`](../backend/src/camera/camera-stream.service.spec.ts).

## Procedimiento de uso y verificación

1. Cerrar la URL directa `http://<IP_DE_CAMARA>:81/stream`.
2. Reiniciar o actualizar el backend para que ejecute el código actual. En el
   entorno de desarrollo Docker:

   ```powershell
   docker compose -f .\docker-compose.dev.yml restart backend
   ```

3. Abrir el dashboard en el primer dispositivo y después en el segundo.
4. En los logs del backend comprobar:
   - `Viewer conectado a cámara ... (1 viewer(s))` y después un contador de
     viewers que aumenta al abrir otro dashboard.
   - Una sola línea `Conexión upstream activa para cámara ...` mientras los
     dashboards comparten esa conexión.
   - `Viewer desconectado ...` cuando una pestaña se cierra. El stream upstream
     solo se cierra cuando ya no queda ningún espectador.
5. En DevTools → Network, seleccionar **All** o **Img** y buscar la petición
   `camera/stream/<clusterId>`. Un estado `200` que permanece pendiente es
   normal para un stream continuo; los bytes recibidos deben aumentar.

Para seguir los logs:

```powershell
docker compose -f .\docker-compose.dev.yml logs -f --since=2m backend
```

La ruta está autenticada. No compartir el valor del parámetro `token` que pueda
aparecer en la URL o en DevTools.

## Diagnóstico

- **No aparece `Viewer conectado`:** el navegador no está llegando a esta
  instancia del backend o el dashboard no solicitó la ruta de stream.
- **Aparece `Error conectando cluster`:** revisar conectividad desde el
  contenedor backend hacia la IP de la cámara.
- **Hay varios viewers y una conexión upstream, pero un dashboard no muestra
  imagen:** verificar que el backend desplegado incluya el reenvío del
  `Content-Type` también al espectador tardío; revisar el estado, bytes y
  encabezados de esa petición en DevTools.
- **La prueba a `http://<IP_DE_CAMARA>:81/stream` desde el contenedor devuelve
  `HTTP 200` y `multipart/x-mixed-replace`:** el contenedor puede alcanzar la
  cámara. Esta comprobación abre una conexión real; cerrarla antes de probar los
  dashboards para evitar competir por la conexión.
- **Una petición de stream devuelve `401`:** volver a iniciar sesión y comprobar
  la autenticación de esa petición. No registrar ni compartir tokens.

La prueba automatizada se ejecuta con:

```powershell
npm.cmd --prefix backend test -- --runInBand camera-stream.service.spec.ts
```

## Alcance

La conexión compartida vive en memoria en una instancia del backend. Si se
ejecutan varias instancias o réplicas, cada instancia podría abrir su propia
conexión a la cámara; en ese despliegue se necesita un relay único o una capa
compartida entre instancias.
