import os
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parent
DEFAULT_CONFIG_PATH = ROOT / "config" / "test-config.yaml"


def load_config(path=None):
    config_path = Path(
        path or os.environ.get("INDUSTRIAL_TEST_CONFIG", DEFAULT_CONFIG_PATH)
    )
    if not config_path.is_absolute():
        working_directory_path = (Path.cwd() / config_path).resolve()
        config_path = (
            working_directory_path
            if working_directory_path.exists()
            else (ROOT / config_path).resolve()
        )

    with config_path.open(encoding="utf-8") as config_file:
        config = yaml.safe_load(config_file)

    config["api"]["base_url"] = os.environ.get(
        "CLUSTERCONTROL_API_URL", config["api"]["base_url"]
    ).rstrip("/")
    config["mqtt"]["host"] = os.environ.get(
        "CLUSTERCONTROL_MQTT_HOST", config["mqtt"]["host"]
    )
    config["mqtt"]["port"] = int(
        os.environ.get("CLUSTERCONTROL_MQTT_PORT", config["mqtt"]["port"])
    )
    config["test"]["username"] = os.environ.get(
        "INDUSTRIAL_TEST_USERNAME", config["test"]["username"]
    )
    config["test"]["password"] = os.environ.get(
        "INDUSTRIAL_TEST_PASSWORD", config["test"]["password"]
    )
    config["endurance"]["hours"] = float(
        os.environ.get("INDUSTRIAL_TEST_HOURS", config["endurance"]["hours"])
    )
    config["endurance"]["interval_seconds"] = int(
        os.environ.get(
            "INDUSTRIAL_TEST_INTERVAL_SECONDS",
            config["endurance"]["interval_seconds"],
        )
    )
    return config


def load_devices(path=None):
    devices_path = Path(path or ROOT / "config" / "devices.yaml")
    if not devices_path.is_absolute():
        devices_path = (ROOT / devices_path).resolve()
    with devices_path.open(encoding="utf-8") as devices_file:
        return yaml.safe_load(devices_file)["devices"]
