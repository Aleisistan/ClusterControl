import requests


def test_api_root_is_available(config):
    response = requests.get(
        f'{config["api"]["base_url"]}/',
        timeout=config["api"]["timeout_seconds"],
    )
    assert response.status_code == 200
    assert response.text == "Hello World!"
    assert response.elapsed.total_seconds() * 1000 <= config["thresholds"][
        "max_api_latency_ms"
    ], f"API response took {response.elapsed.total_seconds() * 1000:.0f} ms"


def test_private_api_rejects_anonymous_requests(config):
    response = requests.get(
        f'{config["api"]["base_url"]}/clusters',
        timeout=config["api"]["timeout_seconds"],
    )
    assert response.status_code == 401
