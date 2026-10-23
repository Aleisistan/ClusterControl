import sys
import tempfile
from pathlib import Path
from xml.etree.ElementTree import Element

sys.path.insert(0, str(Path(__file__).resolve().parent))

from endurance import describe_test_failure
from endurance import parse_junit


def test_live_telemetry_failure_is_explained_in_spanish():
    failure = Element(
        "failure",
        {
            "message": (
                "AssertionError: No live telemetry for device 36 arrived on "
                "'datacenter/ambiente' within 30 seconds"
            )
        },
    )
    failure.text = "Traceback included examples such as Could not connect to MQTT broker."

    assert describe_test_failure(
        "test_target_device_publishes_live_telemetry", failure
    ) == (
        "No llegaron datos del dispositivo 36 durante 30 segundos. "
        "Compruebe que esté encendido, conectado y configurado con el "
        "ID correcto."
    )


def test_unknown_failure_does_not_expose_technical_details():
    failure = Element(
        "failure",
        {"message": "AssertionError: internal diagnostic detail"},
    )

    assert describe_test_failure("test_unknown_case", failure) == (
        "Una comprobación del sistema no obtuvo el resultado esperado. "
        "Compruebe que el equipo y la aplicación estén funcionando."
    )


def test_server_connection_failure_is_explained_in_spanish():
    failure = Element(
        "error",
        {
            "message": (
                "requests.exceptions.ConnectionError: "
                "RemoteDisconnected('Remote end closed connection')"
            )
        },
    )

    assert describe_test_failure("test_api_root_is_available", failure) == (
        "El servidor de la aplicación no respondió durante la prueba. "
        "Compruebe que el contenedor del servidor esté iniciado; el "
        "próximo ciclo volverá a comprobarlo."
    )


def test_junit_summary_deduplicates_repeated_messages_without_changing_counts():
    junit = """<testsuite tests="3" failures="2" errors="0" skipped="0">
      <testcase name="test_api_root_is_available">
        <failure message="ConnectionError: RemoteDisconnected" />
      </testcase>
      <testcase name="test_private_api_rejects_anonymous_requests">
        <failure message="ConnectionError: RemoteDisconnected" />
      </testcase>
      <testcase name="test_api_is_available" />
    </testsuite>"""

    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / "junit.xml"
        path.write_text(junit, encoding="utf-8")
        summary = parse_junit(path)

    assert summary["failures"] == 2
    assert summary["tests"] == 3
    assert len(summary["failed_tests"]) == 1
