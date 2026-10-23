import sys
from pathlib import Path

import pytest
import requests


TEST_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TEST_ROOT))

from industrial_config import load_config, load_devices  # noqa: E402


@pytest.fixture(scope="session")
def config():
    return load_config()


@pytest.fixture(scope="session")
def target_device(config):
    device_id = str(config["test"]["target_device_id"])
    device = next(
        (
            item
            for item in load_devices()
            if str(item["device_id"]) == device_id
        ),
        None,
    )
    assert device is not None, (
        f"No device {device_id!r} is defined in config/devices.yaml"
    )
    return device


@pytest.fixture(scope="session")
def api_session(config):
    username = config["test"]["username"]
    password = config["test"]["password"]
    if not username or not password:
        pytest.skip(
            "Set INDUSTRIAL_TEST_USERNAME and INDUSTRIAL_TEST_PASSWORD "
            "to run authenticated API checks"
        )

    session = requests.Session()
    response = session.post(
        f'{config["api"]["base_url"]}/auth/login',
        json={"username": username, "password": password},
        timeout=config["api"]["timeout_seconds"],
    )
    assert response.status_code == 201, (
        f"Login failed with HTTP {response.status_code}: {response.text[:300]}"
    )
    token = response.json().get("access_token")
    assert token, "Login response did not include access_token"
    session.headers.update({"Authorization": f"Bearer {token}"})
    return session


@pytest.fixture(scope="session")
def target_cluster_id(config, api_session, target_device):
    response = api_session.get(
        f'{config["api"]["base_url"]}/clusters',
        timeout=config["api"]["timeout_seconds"],
    )
    assert response.status_code == 200, (
        f"Could not list clusters: HTTP {response.status_code}: {response.text[:300]}"
    )
    target_id = str(target_device["device_id"])
    cluster = next(
        (
            item
            for item in response.json()
            if str(item.get("deviceId")) == target_id
        ),
        None,
    )
    assert cluster is not None, (
        f"No cluster is configured for target device ID {target_id!r}"
    )
    return cluster["id"]
