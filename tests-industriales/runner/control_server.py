from __future__ import annotations

import hmac
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / "reports"
STATUS = REPORTS / "runner-status.json"
TOKEN = os.environ.get("INDUSTRIAL_TEST_CONTROL_TOKEN", "")
HOST = "0.0.0.0"
PORT = int(os.environ.get("INDUSTRIAL_TEST_CONTROL_PORT", "8765"))
MAX_HOURS = 8760
lock = Lock()
runner_process: subprocess.Popen | None = None


def status_is_active() -> bool:
    try:
        value = json.loads(STATUS.read_text(encoding="utf-8"))
        if value.get("active") is not True:
            return False
        updated = datetime.fromisoformat(value["updated_at"].replace("Z", "+00:00"))
        age = (datetime.now(timezone.utc) - updated).total_seconds()
        return age <= 300
    except (OSError, ValueError, KeyError, TypeError):
        return False


class Handler(BaseHTTPRequestHandler):
    def send_json(self, code: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def authorized(self) -> bool:
        supplied = self.headers.get("X-Industrial-Test-Token", "")
        return bool(TOKEN) and hmac.compare_digest(supplied, TOKEN)

    def do_GET(self) -> None:
        if self.path != "/health":
            self.send_json(404, {"error": "not_found"})
            return
        self.send_json(200, {"status": "ok"})

    def do_POST(self) -> None:
        global runner_process
        if self.path != "/runs":
            self.send_json(404, {"error": "not_found"})
            return
        if not self.authorized():
            self.send_json(401, {"error": "unauthorized"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 1 or length > 1024:
                raise ValueError("invalid_body")
            payload = json.loads(self.rfile.read(length))
            hours = payload.get("hours")
            if isinstance(hours, bool) or not isinstance(hours, int) or not 24 <= hours <= MAX_HOURS:
                self.send_json(400, {"error": "hours_must_be_integer_between_24_and_8760"})
                return
        except (ValueError, json.JSONDecodeError, AttributeError):
            self.send_json(400, {"error": "invalid_request"})
            return

        with lock:
            if runner_process is not None and runner_process.poll() is None:
                self.send_json(409, {"error": "runner_already_active"})
                return
            if status_is_active():
                self.send_json(409, {"error": "runner_already_active"})
                return

            REPORTS.mkdir(parents=True, exist_ok=True)
            log = (REPORTS / "runner-control.log").open("a", encoding="utf-8")
            try:
                runner_process = subprocess.Popen(
                    [
                        sys.executable,
                        str(ROOT / "runner" / "endurance.py"),
                        "--hours",
                        str(hours),
                    ],
                    cwd=ROOT.parent,
                    stdin=subprocess.DEVNULL,
                    stdout=log,
                    stderr=subprocess.STDOUT,
                    start_new_session=True,
                )
            except Exception:
                log.close()
                raise
            log.close()

        self.send_json(202, {"accepted": True, "requested_hours": hours})

    def log_message(self, fmt: str, *args) -> None:
        print("industrial-test-control: " + fmt % args, flush=True)


if not TOKEN:
    raise SystemExit("INDUSTRIAL_TEST_CONTROL_TOKEN must be configured")

REPORTS.mkdir(parents=True, exist_ok=True)
print(f"Industrial test control listening on {HOST}:{PORT}", flush=True)
ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
