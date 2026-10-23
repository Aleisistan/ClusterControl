import argparse
import csv
import json
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

TESTS_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TESTS_ROOT))

from industrial_config import ROOT, load_config


REPOSITORY_ROOT = ROOT.parent
REPORTS_ROOT = ROOT / "reports"
RUNNER_STATUS_PATH = REPORTS_ROOT / "runner-status.json"


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def describe_test_failure(test_name, result):
    message = result.attrib.get("message", "")
    details = message or (result.text or "")

    if any(
        marker in details
        for marker in (
            "ConnectionError",
            "RemoteDisconnected",
            "Connection refused",
            "Connection reset",
            "Failed to establish a new connection",
            "Max retries exceeded",
            "API did not become healthy",
        )
    ):
        return (
            "El servidor de la aplicación no respondió durante la prueba. "
            "Compruebe que el contenedor del servidor esté iniciado; el "
            "próximo ciclo volverá a comprobarlo."
        )

    if any(
        phrase in details
        for phrase in (
            "Could not connect to MQTT broker",
            "MQTT broker rejected the connection",
            "Could not subscribe to MQTT topic",
            "MQTT subscription",
            "MQTT broker rejected the subscription",
        )
    ):
        return (
            "No se pudo establecer comunicación con el sistema de monitoreo. "
            "Compruebe que los servicios estén iniciados y conectados."
        )

    if "Published MQTT telemetry was not observed through the API" in details:
        return (
            "Se enviaron datos de prueba, pero la aplicación no los mostró "
            "a tiempo. Compruebe que la aplicación esté funcionando."
        )

    if "MQTT publish failed" in details or "did not acknowledge publish" in details:
        return (
            "No se pudieron enviar los datos de prueba. Compruebe la conexión "
            "del sistema de comunicación."
        )

    if test_name == "test_target_device_publishes_live_telemetry":
        timeout_match = re.search(
            r"No live telemetry for device\s+(\S+)\s+arrived.*?within\s+(\d+)\s+seconds",
            details,
        )
        if timeout_match:
            device_id = timeout_match.group(1).strip("'\"")
            timeout = timeout_match.group(2)
            return (
                f"No llegaron datos del dispositivo {device_id} durante "
                f"{timeout} segundos. Compruebe que esté encendido, conectado "
                "y configurado con el ID correcto."
            )
        return (
            "No se pudo comprobar la llegada de datos del dispositivo. "
            "Compruebe que esté encendido, conectado y configurado con el "
            "ID correcto."
        )

    if "within" in details and "seconds" in details:
        return (
            "El sistema tardó más de lo esperado en responder. Compruebe que "
            "esté iniciado y conectado."
        )

    return (
        "Una comprobación del sistema no obtuvo el resultado esperado. "
        "Compruebe que el equipo y la aplicación estén funcionando."
    )


def parse_junit(path):
    if not path.exists():
        return {
            "tests": 0,
            "failures": 0,
            "errors": 0,
            "skipped": 0,
            "failed_tests": [],
        }
    root = ET.parse(path).getroot()
    suites = [root] if root.tag == "testsuite" else list(root.findall("testsuite"))
    summary = {
        key: sum(int(suite.attrib.get(key, 0)) for suite in suites)
        for key in ("tests", "failures", "errors", "skipped")
    }
    summary["failed_tests"] = list(
        dict.fromkeys(
            describe_test_failure(test.attrib.get("name", "unknown"), result)
            for test in root.iter("testcase")
            for result in (*test.findall("failure"), *test.findall("error"))
        )
    )
    return summary


def main():
    parser = argparse.ArgumentParser(
        description="Run the industrial integration suite for a configurable duration."
    )
    parser.add_argument("--hours", type=float)
    parser.add_argument(
        "--interval-seconds",
        type=int,
    )
    parser.add_argument("--config", help="YAML config file (also settable via environment)")
    parser.add_argument(
        "--once", action="store_true", help="Run one cycle and exit (smoke test)"
    )
    args = parser.parse_args()
    config = load_config(args.config)
    args.hours = (
        args.hours if args.hours is not None else config["endurance"]["hours"]
    )
    args.interval_seconds = (
        args.interval_seconds
        if args.interval_seconds is not None
        else config["endurance"]["interval_seconds"]
    )
    if args.hours <= 0 or args.interval_seconds <= 0:
        parser.error("--hours and --interval-seconds must be greater than zero")

    started_at = datetime.now(timezone.utc)
    run_dir = REPORTS_ROOT / started_at.strftime("%Y%m%dT%H%M%S%fZ")
    run_dir.mkdir(parents=True, exist_ok=False)
    deadline = time.monotonic() + (0 if args.once else args.hours * 3600)
    cycles = []
    cycle_number = 0
    final_state = "completed"

    print(f"Run evidence directory: {run_dir}")
    write_runner_status(
        state="running",
        started_at=started_at,
        run_dir=run_dir,
        args=args,
        cycle_number=cycle_number,
        cycles=cycles,
    )
    try:
        while cycle_number == 0 or time.monotonic() < deadline:
            cycle_number += 1
            write_runner_status(
                state="running",
                started_at=started_at,
                run_dir=run_dir,
                args=args,
                cycle_number=cycle_number,
                cycles=cycles,
            )
            cycle_started_at = utc_now()
            cycle_start = time.monotonic()
            junit_path = run_dir / f"cycle-{cycle_number:04d}.xml"
            log_path = run_dir / f"cycle-{cycle_number:04d}.log"
            command = [
                sys.executable,
                "-m",
                "pytest",
                str(ROOT / "tests"),
                "-q",
                f"--junitxml={junit_path}",
            ]
            result = subprocess.run(
                command,
                cwd=REPOSITORY_ROOT,
                capture_output=True,
                text=True,
                check=False,
            )
            summary = parse_junit(junit_path)
            cycle = {
                "cycle": cycle_number,
                "started_at": cycle_started_at,
                "duration_seconds": round(time.monotonic() - cycle_start, 3),
                "exit_code": result.returncode,
                "status": "passed" if result.returncode == 0 else "failed",
                **summary,
                "junit": junit_path.name,
                "log": log_path.name,
            }
            log_path.write_text(
                result.stdout + ("\n" if result.stdout else "") + result.stderr,
                encoding="utf-8",
            )
            cycles.append(cycle)
            print(
                f'Cycle {cycle_number}: {cycle["status"]} '
                f'({summary["tests"]} tests, {summary["failures"]} failures, '
                f'{summary["errors"]} errors, {summary["skipped"]} skipped)'
            )
            write_report(run_dir, started_at, cycles, args)
            write_runner_status(
                state="running",
                started_at=started_at,
                run_dir=run_dir,
                args=args,
                cycle_number=cycle_number,
                cycles=cycles,
            )
            if args.once:
                break
            next_cycle_at = min(
                time.monotonic() + args.interval_seconds,
                deadline,
            )
            while time.monotonic() < next_cycle_at:
                time.sleep(min(30, next_cycle_at - time.monotonic()))
                write_runner_status(
                    state="running",
                    started_at=started_at,
                    run_dir=run_dir,
                    args=args,
                    cycle_number=cycle_number,
                    cycles=cycles,
                )
    except KeyboardInterrupt:
        print("\nEndurance run interrupted; writing partial evidence.")
        final_state = "interrupted"
    except Exception:
        final_state = "failed"
        raise
    finally:
        try:
            write_report(run_dir, started_at, cycles, args)
        finally:
            write_runner_status(
                state=final_state,
                started_at=started_at,
                run_dir=run_dir,
                args=args,
                cycle_number=cycle_number,
                cycles=cycles,
                active=False,
            )

    return 1 if any(cycle["status"] == "failed" for cycle in cycles) else 0


def write_runner_status(
    state, started_at, run_dir, args, cycle_number, cycles, active=True
):
    RUNNER_STATUS_PATH.parent.mkdir(parents=True, exist_ok=True)
    status = {
        "state": state,
        "active": active,
        "started_at": started_at.isoformat(),
        "updated_at": utc_now(),
        "run_directory": run_dir.name,
        "requested_hours": None if args.once else args.hours,
        "interval_seconds": args.interval_seconds,
        "current_cycle": cycle_number,
        "completed_cycles": len(cycles),
        "passed_cycles": sum(cycle["status"] == "passed" for cycle in cycles),
        "failed_cycles": sum(cycle["status"] == "failed" for cycle in cycles),
        "totals": {
            key: sum(cycle[key] for cycle in cycles)
            for key in ("tests", "failures", "errors", "skipped")
        },
        "failed_tests": sorted(
            {
                failed_test
                for cycle in cycles
                for failed_test in cycle.get("failed_tests", [])
            }
        ),
        "cycle_history": [
            {
                key: cycle[key]
                for key in (
                    "cycle",
                    "started_at",
                    "duration_seconds",
                    "status",
                    "tests",
                    "failures",
                    "errors",
                    "skipped",
                    "failed_tests",
                )
            }
            for cycle in cycles[-50:]
        ],
        "last_cycle_status": cycles[-1]["status"] if cycles else None,
    }
    if not active:
        status["finished_at"] = utc_now()
    with RUNNER_STATUS_PATH.open("w", encoding="utf-8", newline="\n") as status_file:
        json.dump(status, status_file, indent=2, ensure_ascii=False)
        status_file.write("\n")
        status_file.flush()


def write_report(run_dir, started_at, cycles, args):
    fields = [
        "cycle",
        "started_at",
        "duration_seconds",
        "status",
        "tests",
        "failures",
        "errors",
        "skipped",
        "exit_code",
        "junit",
        "log",
        "failed_tests",
    ]
    with (run_dir / "cycles.csv").open("w", newline="", encoding="utf-8") as report:
        writer = csv.DictWriter(report, fieldnames=fields)
        writer.writeheader()
        writer.writerows(
            {
                **cycle,
                "failed_tests": " | ".join(cycle.get("failed_tests", [])),
            }
            for cycle in cycles
        )

    summary = {
        "started_at": started_at.isoformat(),
        "finished_at": utc_now(),
        "run_mode": "smoke" if args.once else "endurance",
        "requested_hours": None if args.once else args.hours,
        "actual_duration_seconds": round(
            (datetime.now(timezone.utc) - started_at).total_seconds(), 3
        ),
        "interval_seconds": args.interval_seconds,
        "cycles": len(cycles),
        "passed_cycles": sum(cycle["status"] == "passed" for cycle in cycles),
        "failed_cycles": sum(cycle["status"] == "failed" for cycle in cycles),
        "totals": {
            key: sum(cycle[key] for cycle in cycles)
            for key in ("tests", "failures", "errors", "skipped")
        },
        "cycle_results": cycles,
    }
    (run_dir / "summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    raise SystemExit(main())
