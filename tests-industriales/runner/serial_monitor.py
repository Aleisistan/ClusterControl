import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

import serial


def main():
    parser = argparse.ArgumentParser(
        description="Capture timestamped lines from a serial device."
    )
    parser.add_argument("--port", required=True, help="Serial port, e.g. COM3")
    parser.add_argument("--baudrate", type=int, default=115200)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--timeout-seconds", type=float, default=1.0)
    args = parser.parse_args()
    if args.baudrate <= 0 or args.timeout_seconds <= 0:
        parser.error("--baudrate and --timeout-seconds must be greater than zero")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    try:
        with serial.Serial(
            args.port, args.baudrate, timeout=args.timeout_seconds
        ) as device, args.output.open("a", encoding="utf-8") as output:
            print(f"Capturing {args.port} at {args.baudrate} baud to {args.output}")
            while True:
                line = device.readline()
                if line:
                    record = (
                        f'{datetime.now(timezone.utc).isoformat()} '
                        f"{line.decode('utf-8', errors='replace').rstrip()}\n"
                    )
                    output.write(record)
                    output.flush()
    except KeyboardInterrupt:
        print("\nSerial capture stopped.")
    except serial.SerialException as error:
        parser.exit(1, f"Serial capture failed: {error}\n")


if __name__ == "__main__":
    raise SystemExit(main())
