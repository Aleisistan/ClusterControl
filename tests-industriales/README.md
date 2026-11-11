# Pruebas industriales

Pruebas de integración externas a Jest. Comprueban la API, autenticación,
comunicación MQTT, persistencia y disponibilidad. Se ejecutan en desarrollo,
contra el stack local; no se incluyen ni se ejecutan automáticamente en
producción.

## Ejecutar en Docker

Inicia el entorno siguiendo el [README principal](../README.MD#desarrollo). El
contenedor `industrial-tests` queda en espera hasta que ejecutes una prueba.
Desde la raíz del repositorio:

```powershell
docker compose --env-file .env.development.local -f docker-compose.dev.yml exec industrial-tests pytest tests -v
```

Para una corrida de endurance corta (un ciclo):

```powershell
docker compose --env-file .env.development.local -f docker-compose.dev.yml exec industrial-tests python runner/endurance.py --once
```

O especifica la duración y el intervalo entre ciclos:

```powershell
docker compose --env-file .env.development.local -f docker-compose.dev.yml exec industrial-tests python runner/endurance.py --hours 8 --interval-seconds 60
```

El simulador debe estar activo para las pruebas MQTT con datos sintéticos. Para
comprobar hardware real, detén el simulador, configura `test.target_device_id`
en `config/test-config.yaml` y asegúrate de que el dispositivo esté encendido y
publicando telemetría.

Las pruebas con endpoints protegidos usan un usuario de prueba. En Compose de
desarrollo se pasan por defecto `admin` / `admin123`; puedes reemplazarlos con
`INDUSTRIAL_TEST_USERNAME` y `INDUSTRIAL_TEST_PASSWORD` en
`.env.development.local`. No uses credenciales de producción.

## Panel y resultados

El panel **Pruebas industriales** del dashboard no ejecuta pruebas. Solo muestra
el estado y los resultados de la última corrida de endurance. El runner guarda
el estado en `tests-industriales/reports/runner-status.json`; la API lo expone
en `GET /industrial-tests/status` y el backend lo monta en modo solo lectura.
Si aún no se ejecutó el runner, el estado será desconocido/inactivo.

Los reportes de cada corrida quedan en `tests-industriales/reports/` y no se
versionan. Las pruebas publican datos marcados como `industrial-test` y no se
incluyen en los gráficos operativos. En desarrollo, esos gráficos pueden
mostrar tanto las lecturas `device` como las del `simulator`; en producción se
muestran solo las de dispositivos reales.

## Ejecutar en el host

Requiere Python 3.10 o posterior. Desde la raíz del repositorio:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r tests-industriales\requirements.txt
python -m pytest tests-industriales\tests -v
```

Las pruebas que requieren autenticación necesitan las credenciales de un
usuario local existente. En PowerShell, configúralas antes de ejecutar pytest:

```powershell
$env:INDUSTRIAL_TEST_USERNAME = "admin"
$env:INDUSTRIAL_TEST_PASSWORD = "admin123"
```

Usa las credenciales de tu entorno local; si no las configuras, esas pruebas se
omiten. Asegúrate también de tener PostgreSQL, Mosquitto y el backend activos.

La configuración de API, MQTT, dispositivo objetivo y timeouts se encuentra en
`config/test-config.yaml`. Los tests MQTT necesitan que el broker y el backend
estén disponibles. El modo Docker de desarrollo los conecta automáticamente.
