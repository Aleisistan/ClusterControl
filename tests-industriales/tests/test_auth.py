import pytest
import requests


def test_login_rejects_invalid_credentials(config):
    response = requests.post(
        f'{config["api"]["base_url"]}/auth/login',
        json={
            "username": "invalid-industrial-user",
            "password": "invalid-industrial-password",
        },
        timeout=config["api"]["timeout_seconds"],
    )
    assert response.status_code == 401


def test_valid_login_returns_access_token(config):
    username = config["test"]["username"]
    password = config["test"]["password"]
    if not username or not password:
        pytest.skip(
            "Set INDUSTRIAL_TEST_USERNAME and INDUSTRIAL_TEST_PASSWORD "
            "to validate a successful login"
        )

    response = requests.post(
        f'{config["api"]["base_url"]}/auth/login',
        json={"username": username, "password": password},
        timeout=config["api"]["timeout_seconds"],
    )
    assert response.status_code == 201, (
        f"Login failed with HTTP {response.status_code}: {response.text[:300]}"
    )
    body = response.json()
    assert body.get("access_token")
    assert body.get("user", {}).get("username") == username
