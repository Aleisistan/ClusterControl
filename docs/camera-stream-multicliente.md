# Cámaras: streams compartidos y capturas de puerta

## Configurar una cámara

En **Clusters**, un administrador puede asignar hasta dos cámaras por cluster,
cada una con nombre e IP o URL de stream.

- Si ingresas solo una IP, el relay usa `http://<IP>` sin añadir puerto ni
  ruta. Para cámaras que requieran un puerto o una ruta específicos, ingresa
  la URL completa, por ejemplo `http://<IP>:81/stream`.
- Si ingresas una URL completa con una IP como host, el backend la retransmite.
  Los streams MJPEG comparten una conexión de cámara entre los dashboards
  conectados a esa instancia; las URL HLS y sus recursos pasan por el proxy.
- Si la URL usa un nombre de dominio, el navegador abre el stream directamente
  desde su origen. En ese caso no se usa el relay compartido.

Ver el dashboard requiere iniciar sesión. Las rutas de stream servidas por el
backend también están autenticadas. Las URL con dominio se cargan directamente
desde el navegador: el inicio de sesión de la aplicación no protege ese origen,
que debe ser accesible y contar con su propia protección. No configures la
cámara en una variable de entorno.

Para compartir la conexión de una ESP32-CAM, no abras su URL directa
(`http://<IP>:81/stream`) en paralelo desde otro cliente: la cámara podría no
aceptar ambas conexiones.

## Comprobar el relay MJPEG

1. Inicia el entorno siguiendo el [README principal](../README.MD#desarrollo).
2. Cierra cualquier acceso directo al stream de la cámara.
3. Abre el dashboard y después otro dashboard para el mismo cluster.
4. En los logs del backend verifica que el contador de `Viewer conectado`
   aumente, mientras haya una sola `Conexión upstream activa` para esa cámara.
   Al cerrar el último dashboard, el backend cierra esa conexión.
5. En DevTools → Network, busca `camera/stream/<clusterId>`. Una respuesta
   `200` que queda abierta es normal para un stream continuo; los bytes
   recibidos deben aumentar.

El relay mantiene su estado en memoria dentro de una instancia del backend. Si
se ejecutan varias réplicas, cada una puede abrir su propia conexión a la
cámara.

El dashboard puede enviar un token en la URL de la petición al backend; no
compartas ni registres ese valor.

## Capturas al abrir la puerta

Cuando una telemetría de un dispositivo real registra un cambio de puerta
cerrada a abierta, el backend intenta guardar una imagen JPEG en PostgreSQL y
la agrega al historial del cluster. Si la cámara no responde, conserva la
telemetría y registra el error. No toma capturas repetidas mientras la puerta
sigue abierta: debe recibirse un cierre y una nueva apertura.

La captura automática está pensada para una ESP32-CAM y, cuando no hay un
stream activo, solicita `/capture` en el puerto `81`. Si ya hay un stream
compatible activo, se reutiliza el último frame JPEG completo; si el stream no
entrega un frame a tiempo, la captura falla. Si hay dos cámaras, no se puede
elegir cuál usa la captura automática. Cámaras con rutas o puertos
personalizados pueden mostrar el video y aun así no generar capturas.

El endpoint autenticado para descargar una imagen es
`GET /telemetry/door-snapshots/:id/image`.

## Diagnóstico

- **No aparece `Viewer conectado`:** confirma que el dashboard solicitó el
  stream y que la petición llegó a esta instancia del backend. Las URL con
  nombre de dominio no usan este relay.
- **El log muestra `Error conectando cluster`:** revisa que el contenedor del
  backend pueda alcanzar la IP, puerto y ruta configurados.
- **El stream no aparece en el dashboard:** revisa en DevTools el estado HTTP,
  los encabezados y el aumento de bytes. Un `401` requiere iniciar sesión de
  nuevo.
- **Hay video pero no captura de puerta:** confirma que la telemetría sea de un
  dispositivo real, que exista una transición de cerrada a abierta y que la
  cámara admita `/stream` o `/capture` en el puerto `81`.

La prueba unitaria del relay se ejecuta desde la raíz del repositorio en
PowerShell:

```powershell
npm.cmd --prefix backend test -- --runInBand camera-stream.service.spec.ts
```
