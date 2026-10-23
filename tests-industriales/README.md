# Pruebas industriales de ClusterControl

Suite externa para validar la API, autenticación, flujo MQTT hacia PostgreSQL y
disponibilidad durante ejecuciones prolongadas. No reemplaza las pruebas Jest
unitarias/e2e del backend.

## Alcance actual

- API HTTP, latencia básica y rechazo de solicitudes anónimas.
- Login correcto e incorrecto; el login correcto y las pruebas protegidas
  requieren credenciales de prueba.
- Verificación pasiva de que el dispositivo objetivo publica telemetría MQTT
  durante la ventana de observación.
- Publicación de telemetría MQTT y verificación del dato recibido mediante la
  API, además de consistencia entre la última muestra y el historial persistido.
- Sonda de disponibilidad/recovery con límite configurable.
- Runner de endurance que repite la suite durante una cantidad configurable de
  horas y conserva XML JUnit, logs, CSV y resumen JSON por ejecución.
- Estado del runner disponible en el dashboard, y origen (dispositivo o test
  sintético) de la última lectura.
- Monitores opcionales para mensajes MQTT y salida serial.

El proyecto no cuenta actualmente con firmware/puerto serial configurado ni con
un actuador que consuma los tópicos de comandos. Por eso no se declaran pruebas
de firmware o actuadores como funcionales todavía. La prueba de recovery observa
la disponibilidad, pero no provoca cortes de servicios: las interrupciones
controladas deben agregarse cuando exista un entorno aislado para pruebas de
fallo.

## Requisitos y preparación

1. Inicia el entorno de desarrollo de ClusterControl según el [README principal](../README.MD).
   Para las pruebas de integración MQTT deben estar activos Mosquitto, el
   backend, PostgreSQL y el simulador. Para comprobar el hardware, detén el
   simulador para que no suplante sus publicaciones:

   ```powershell
   docker compose -f docker-compose.dev.yml stop simulator
   ```

   Configura `test.target_device_id` en `config/test-config.yaml` con el ID real
   del dispositivo y asegúrate de que esté listado en `config/devices.yaml`
   (marcado como `simulated: false` para documentarlo correctamente).
   La prueba de llegada se suscribe al tópico MQTT y falla si no recibe una
   publicación de ese dispositivo dentro del timeout configurado. El timeout
   por defecto es 30 segundos (`mqtt.telemetry_timeout_seconds`); ajústalo si el
   hardware publica con menor frecuencia. La prueba MQTT sintética posterior
   solo valida el flujo broker/API y no reemplaza esta comprobación.
2. Instala Python 3.10 o posterior y las dependencias:

   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   python -m pip install -r tests-industriales\requirements.txt
   ```

3. Configura las credenciales de un usuario de prueba existente. No uses ni
   guardes credenciales reales en el YAML:

   ```powershell
   $env:INDUSTRIAL_TEST_USERNAME = "usuario-de-prueba"
   $env:INDUSTRIAL_TEST_PASSWORD = "contraseña-local-de-prueba"
   ```

   Si no se configuran, las pruebas que requieren autenticación se reportan
   explícitamente como omitidas. Las credenciales no se incluyen en los
   informes.

## Ejecución

Desde la raíz del repositorio:

```powershell
python -m pytest tests-industriales\tests -v
```

Una corrida corta para comprobar integración:

```powershell
python tests-industriales\runner\endurance.py --once
```

Ejecución endurance durante ocho horas, con una corrida cada 60 segundos:

```powershell
python tests-industriales\runner\endurance.py --hours 8 --interval-seconds 60
```

Los valores iniciales y timeouts se encuentran en
`config/test-config.yaml`; `config/devices.yaml` identifica los dispositivos
simulados por el repositorio. Las variables de entorno disponibles son:

| Variable | Función |
| --- | --- |
| `CLUSTERCONTROL_API_URL` | URL base de la API (por defecto `http://localhost:3000`) |
| `CLUSTERCONTROL_MQTT_HOST` / `CLUSTERCONTROL_MQTT_PORT` | Dirección del broker (por defecto `localhost:1883`) |
| `INDUSTRIAL_TEST_USERNAME` / `INDUSTRIAL_TEST_PASSWORD` | Usuario de prueba para endpoints protegidos |
| `INDUSTRIAL_TEST_HOURS` | Duración del runner, en horas |
| `INDUSTRIAL_TEST_INTERVAL_SECONDS` | Espera entre ciclos |
| `INDUSTRIAL_TEST_CONFIG` | Ruta alternativa a la configuración YAML |

El tiempo de espera de la prueba de llegada MQTT se ajusta mediante
`mqtt.telemetry_timeout_seconds` en `config/test-config.yaml` (por defecto,
30 segundos).

El dashboard consulta `GET /industrial-tests/status` para mostrar si el runner
de endurance está activo. En Docker Compose, el directorio de reportes se monta
en el backend como solo lectura. Si el runner se cierra inesperadamente, el
estado aparece como desconocido cuando pasan cinco minutos sin actualización o
si el archivo de estado aún no existe; inicia el runner actualizado para
publicar su estado. El runner actualiza `runner-status.json` directamente para
evitar el reemplazo de archivos, que puede fallar con volúmenes compartidos en
Windows. El dashboard también muestra el resultado parcial/final:
ciclos aprobados y fallidos, cantidad de tests, fallas, errores y omitidos, y
por ciclo presenta una explicación breve en español de cada causa distinta,
sin repetir mensajes iguales ni incluir trazas técnicas. Los contadores siguen
reflejando todos los fallos. La última telemetría real se actualiza solo cuando
llegan datos del dispositivo; ejecutar pruebas industriales no la modifica.
El historial del dashboard conserva los últimos 50 ciclos de la corrida
actual o más reciente; el reporte de cada corrida conserva todos los ciclos.
Las publicaciones del test de integración llevan `source: industrial-test`;
el simulador publica `source: simulator` y las lecturas del hardware sin una
marca de origen se guardan como `device`. El dashboard muestra y grafica solo
lecturas `device`, y el historial original de cambios de estado también se
limita a ese origen. Las lecturas anteriores a esta clasificación se migran
como `device` por defecto y no se pueden distinguir retroactivamente con certeza
de las sintéticas.

## Evidencias

Cada ejecución del runner crea una carpeta con marca UTC en `reports/`, que
contiene un XML JUnit, log de consola por ciclo, `cycles.csv` y `summary.json`.
`reports/` está excluido del control de versiones para evitar acumular archivos
de ejecución.

Para capturar telemetría MQTT en JSON Lines:

```powershell
python tests-industriales\runner\mqtt_monitor.py
```

Para capturar líneas de un dispositivo serial conectado:

```powershell
python tests-industriales\runner\serial_monitor.py --port COM3 --baudrate 115200 --output tests-industriales\reports\serial.log
```

El monitor serial registra la salida tal como llega; requiere un firmware que
emita mensajes útiles para diagnóstico. Ejecuta las pruebas de hardware solo
contra equipos y brokers aislados/autorizados.
