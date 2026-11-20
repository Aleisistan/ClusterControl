# Conectar una placa por MQTT

Crear un cluster en la web solo registra su nombre, ubicación y un `deviceId`.
No inicia una conexión remota ni instala firmware. La conexión aparece cuando
una placa configurada se conecta al mismo broker MQTT que escucha el backend y
publica telemetría válida con ese `deviceId`.

## 1. Crear el cluster y obtener el identificador

1. Inicia sesión como administrador y crea el cluster en **Clusters**.
2. Copia el `deviceId` que muestra el formulario después del alta. Es distinto
   del ID interno de la base de datos.
3. Usa ese mismo valor numérico en el firmware. No reutilices el ID de otro
   cluster: la telemetría se asocia buscando `deviceId`.

La pantalla informa el estado según la última telemetría real recibida:

- **Sin datos**: el backend aún no recibió una lectura del dispositivo.
- **Conectado**: recibió una lectura en los últimos 60 segundos.
- **Desconectado**: recibió datos anteriormente, pero lleva más de 60 segundos
  sin recibirlos.

El estado se actualiza cada 15 segundos. El simulador de desarrollo publica
datos sintéticos y no cuenta como conexión de una placa física.

## 2. Preparar el servidor y el broker

El backend y Mosquitto deben estar en ejecución y compartir la misma instancia
del broker. En Docker Compose, el backend se conecta internamente a
`mosquitto:1883`. Una placa fuera de Docker no puede usar ese nombre: debe usar
una IP o DNS del servidor que sea alcanzable desde su red.

### Desarrollo

Sigue los pasos de desarrollo del [README principal](../README.MD#desarrollo).
El Compose de desarrollo expone Mosquitto en el puerto del host definido por
`MQTT_HOST_PORT` (1883 por defecto) y permite conexiones anónimas. Es solo para
una red local de confianza y pruebas; detén el simulador si no quieres mezclar
lecturas sintéticas con las físicas.

Desde la placa usa:

- `MQTT_HOST`: IP/DNS LAN del equipo que ejecuta Docker.
- `MQTT_PORT`: `MQTT_HOST_PORT` del host; por defecto `1883`.
- No uses `localhost` (sería la propia placa) ni `mosquitto` (solo resuelve
  dentro de la red Docker).

Permite ese puerto en el firewall del servidor solo desde la red/VPN que lo
necesite. No hagas port-forward de un broker anónimo a Internet.

### Producción

El Compose de producción usa el archivo
[`mosquitto.production.conf`](../mosquitto/config/mosquitto.production.conf),
que deshabilita clientes anónimos y requiere contraseña y ACL. Antes del primer
`up`, desde la raíz del proyecto, crea el archivo operativo de ACL solo si aún
no existe. El ACL contiene permisos, no contraseñas:

```powershell
if (-not (Test-Path .\mosquitto\config\aclfile)) {
  Copy-Item .\mosquitto\config\aclfile.example .\mosquitto\config\aclfile
}
```

El archivo `aclfile` operativo es local y está excluido de Git. Si ya existe,
edita ese archivo; no lo reemplaces con la plantilla.

1. Configura en `.env` un `MQTT_USER=clustercontrol-backend` y una
   `MQTT_PASSWORD` segura. El usuario debe coincidir con el usuario del
   `aclfile`; la contraseña debe ser la misma que se ingrese para ese usuario
   al generar el `password_file`.
2. Genera el archivo de contraseñas en el directorio montado por el broker:

   La opción `-c` crea o reemplaza el archivo y sus usuarios. Úsala solo al
   configurarlo por primera vez; para agregar o cambiar usuarios después,
   vuelve a ejecutar `mosquitto_passwd` sin `-c`.

   ```powershell
   $configPath = (Resolve-Path .\mosquitto\config).Path
   $configMount = "type=bind,source=$configPath,target=/mosquitto/config"
   docker run --rm -it --mount $configMount eclipse-mosquitto:2 mosquitto_passwd -c /mosquitto/config/password_file clustercontrol-backend
   docker run --rm -it --mount $configMount eclipse-mosquitto:2 mosquitto_passwd /mosquitto/config/password_file clustercontrol-device
   ```

   `mosquitto_passwd` crea el archivo como `root`, pero el broker lee los
   archivos como el usuario `mosquitto`. Después de crear ambos archivos,
   asigna el propietario y limita sus permisos antes de iniciar Compose:

   ```powershell
   docker run --rm --mount $configMount --entrypoint chown eclipse-mosquitto:2 mosquitto:mosquitto /mosquitto/config/password_file /mosquitto/config/aclfile
   docker run --rm --mount $configMount --entrypoint chmod eclipse-mosquitto:2 600 /mosquitto/config/password_file /mosquitto/config/aclfile
   ```

   En los comandos de generación, el primero crea el archivo y el segundo
   agrega el usuario del dispositivo. Ingresa la misma contraseña configurada
   en `MQTT_PASSWORD` para el usuario del backend; para el usuario del
   dispositivo, usa una contraseña independiente y configúrala también en cada
   placa. Los nombres de usuario de los comandos son los valores por defecto:
   si los cambias, actualiza el nombre correspondiente en `.env`
   (`MQTT_USER`), en `mosquitto/config/aclfile` (después de `user`) y en el
   comando `mosquitto_passwd`; para el dispositivo actualízalo también en el
   firmware.
   El [`aclfile.example`](../mosquitto/config/aclfile.example) versionado
   muestra los permisos por defecto. El nombre tras `user` en el `aclfile`
   operativo debe coincidir exactamente con el que se usa al crear la entrada
   del `password_file`. El
   [`password_file.example`](../mosquitto/config/password_file.example) solo
   documenta los usuarios esperados: no lo copies como archivo operativo ni
   pongas contraseñas en texto plano allí. El archivo real `password_file` es
   local y está excluido de Git.
3. Inicia los servicios con Compose como indica el
   [README principal](../README.MD#producción). Comprueba los logs de Mosquitto
   y del backend antes de conectar una placa.
4. En cada dispositivo configura `MQTT_USERNAME=clustercontrol-device` y la
   contraseña de ese usuario. En la red del dispositivo usa la IP/DNS pública
   solo si el broker está publicado y protegido; es preferible una LAN o VPN.

El puerto MQTT del host es `MQTT_HOST_PORT` (1883 por defecto), mientras que el
backend continúa usando el puerto interno `1883`. El firewall debe limitar el
puerto publicado a la LAN/VPN de los dispositivos. La plantilla actual del
ESP32 usa MQTT TCP sin TLS: no envíes credenciales por redes no confiables ni
expongas el puerto a Internet. Para conexiones remotas se requiere una VPN o
implementar y configurar TLS en el broker y en el firmware.

La ACL de producción da al backend lectura de telemetría y a las placas permiso
para publicar telemetría y anuncios de cámara. No otorga permisos de escritura a
los tópicos de comandos: el control MQTT de actuadores no está implementado.
Las credenciales de dispositivo son compartidas por esta configuración base;
`deviceId` identifica el cluster en la aplicación, pero no es una credencial ni
una autenticación criptográfica del equipo.

## 3. Configurar el firmware y la placa

Sigue el [README del firmware](../firmware/ClusterControl_ESP32/README.md) para
crear `config.h`, compilar y cargar la placa. Para asociarla al sistema,
configura estos valores:

```cpp
#define WIFI_SSID "nombre-de-la-red"
#define WIFI_PASSWORD "clave-wifi"
#define MQTT_HOST "IP_O_DNS_DEL_SERVIDOR"
#define MQTT_PORT 1883
#define MQTT_USERNAME "clustercontrol-device"
#define MQTT_PASSWORD "clave-del-dispositivo"
#define DEVICE_ID "ID_NUMERICO_DEL_CLUSTER"
```

En desarrollo anónimo deja `MQTT_USERNAME` y `MQTT_PASSWORD` vacíos. En
producción usa las credenciales creadas para `clustercontrol-device`. No subas
`config.h` ni credenciales al repositorio.

Si hay una cámara con IP fija, define `CAMERA_IP`; el dispositivo anuncia su
IP en `datacenter/camera/ip` al conectarse. Si no hay cámara, deja el valor
vacío.

## 4. Verificar el flujo

La placa publica un objeto JSON cada 15 segundos en
`datacenter/ambiente`. Debe incluir un `deviceId` numérico igual al asignado y
los campos `temp1`, `temp2`, `hum1`, `hum2`, `extractor`, `aire`, `puerta` y
`luzEncendida`. El backend valida el mensaje, busca el cluster por `deviceId`,
guarda la telemetría y actualiza la última conexión.

Si no cambia el estado:

1. Revisa el monitor serie para confirmar que ESP32 se conectó a Wi-Fi y MQTT.
2. Confirma que `MQTT_HOST` es alcanzable desde la red de la placa y que
   `MQTT_PORT`, usuario y contraseña coinciden con el servidor.
3. Comprueba los logs de `mosquitto` y `backend` y que el backend indique MQTT
   conectado.
4. Verifica que `DEVICE_ID` sea el del cluster y que las lecturas tengan tipos y
   rangos válidos. El backend ignora identificadores desconocidos.

Un mensaje MQTT correcto confirma transporte y asociación lógica; no garantiza
que los sensores o actuadores estén cableados correctamente.
