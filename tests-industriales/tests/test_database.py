from datetime import datetime, timedelta


def test_latest_telemetry_is_persisted_in_history(
    api_session, config, target_cluster_id
):
    base_url = config["api"]["base_url"]
    params = {"clusterId": target_cluster_id}
    latest_response = api_session.get(
        f"{base_url}/telemetry/latest",
        params=params,
        timeout=config["api"]["timeout_seconds"],
    )
    assert latest_response.status_code == 200, (
        "Could not read latest telemetry; confirm the MQTT simulator is running. "
        f"HTTP {latest_response.status_code}: {latest_response.text[:300]}"
    )
    latest = latest_response.json()
    assert latest.get("id") is not None
    assert latest.get("clusterId") == target_cluster_id

    latest_time = datetime.fromisoformat(
        latest["createdAt"].replace("Z", "+00:00")
    )
    history_response = api_session.get(
        f"{base_url}/telemetry/history",
        params={
            **params,
            "from": (latest_time - timedelta(minutes=1)).isoformat(),
            "to": (latest_time + timedelta(minutes=1)).isoformat(),
            "limit": 2000,
        },
        timeout=config["api"]["timeout_seconds"],
    )
    assert history_response.status_code == 200, (
        f"Could not read telemetry history: HTTP {history_response.status_code}"
    )
    history = history_response.json()
    assert isinstance(history, list)
    assert history, "Telemetry history is empty although latest telemetry exists"
    assert any(item["id"] == latest["id"] for item in history), (
        "Latest telemetry is missing from persisted history around its timestamp"
    )
