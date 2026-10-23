import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import paho.mqtt.client as mqtt

TESTS_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TESTS_ROOT))

from industrial_config import ROOT, load_config


def main():
    config = load_config()
    parser = argparse.ArgumentParser(description="Record MQTT messages as JSON Lines.")
    parser.add_argument("--topic", default=config["mqtt"]["topic"])
    parser.add_argument("--host", default=config["mqtt"]["host"])
    parser.add_argument("--port", type=int, default=config["mqtt"]["port"])
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    output = args.output or (
        ROOT
        / "reports"
        / f'mqtt-{datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")}.jsonl'
    )
    output.parent.mkdir(parents=True, exist_ok=True)

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    output_file = output.open("a", encoding="utf-8")

    def on_connect(_client, _userdata, _flags, reason_code, _properties):
        if reason_code != 0:
            print(f"MQTT connection rejected: {reason_code}", file=sys.stderr)
            return
        _client.subscribe(args.topic, qos=1)
        print(f"Monitoring {args.topic} on {args.host}:{args.port}; writing {output}")

    def on_message(_client, _userdata, message):
        record = {
            "received_at": datetime.now(timezone.utc).isoformat(),
            "topic": message.topic,
            "qos": message.qos,
            "retained": message.retain,
            "payload": message.payload.decode("utf-8", errors="replace"),
        }
        output_file.write(json.dumps(record, ensure_ascii=False) + "\n")
        output_file.flush()

    client.on_connect = on_connect
    client.on_message = on_message
    try:
        client.connect(args.host, args.port, keepalive=30)
        client.loop_forever()
    except KeyboardInterrupt:
        print("\nMQTT monitor stopped.")
    except OSError as error:
        parser.exit(1, f"MQTT connection failed: {error}\n")
    finally:
        client.disconnect()
        output_file.close()


if __name__ == "__main__":
    main()
