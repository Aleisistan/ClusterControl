import time

import requests


def test_api_becomes_available_within_recovery_window(config):
    deadline = time.monotonic() + config["api"]["recovery_timeout_seconds"]
    last_error = "API did not respond"
    while time.monotonic() < deadline:
        try:
            response = requests.get(
                f'{config["api"]["base_url"]}/',
                timeout=config["api"]["timeout_seconds"],
            )
            if response.status_code == 200 and response.text == "Hello World!":
                return
            last_error = f"HTTP {response.status_code}: {response.text[:200]}"
        except requests.RequestException as error:
            last_error = str(error)
        time.sleep(1)

    raise AssertionError(
        "API did not become healthy within "
        f'{config["api"]["recovery_timeout_seconds"]} seconds; last result: '
        f"{last_error}"
    )
