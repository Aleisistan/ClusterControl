import json
import random
import time
from threading import Event

import paho.mqtt.client as mqtt


def test_mqtt_telemetry_reaches_api_and_database(
    api_session, config, target_cluster_id, target_device
):
    connected = Event()
    connection_error = []
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.on_connect = lambda _client, _userdata, _flags, reason_code, _properties: (
        connected.set()
        if reason_code == 0
        else connection_error.append(str(reason_code))
    )

    payload = {
        "deviceId": int(target_device["device_id"]),
        "temp1": round(random.uniform(20, 29), 2),
        "hum1": round(random.uniform(40, 60), 2),
        "temp2": round(random.uniform(20, 29), 2),
        "hum2": round(random.uniform(40, 60), 2),
        "extractor": False,
        "aire": True,
        "puerta": False,
        "luzEncendida": False,
        "source": "industrial-test",
    }
    client.connect(config["mqtt"]["host"], config["mqtt"]["port"], keepalive=30)
    client.loop_start()
    try:
        assert connected.wait(config["mqtt"]["connect_timeout_seconds"]), (
            "Could not connect to MQTT broker: "
            + (connection_error[0] if connection_error else "connection timed out")
        )
        publish_result = client.publish(
            config["mqtt"]["topic"], json.dumps(payload), qos=1
        )
        assert publish_result.rc == mqtt.MQTT_ERR_SUCCESS, (
            f"MQTT publish failed with code {publish_result.rc}"
        )
        publish_result.wait_for_publish(
            timeout=config["mqtt"]["message_timeout_seconds"]
        )
        assert publish_result.is_published(), "MQTT broker did not acknowledge publish"

        deadline = time.monotonic() + config["mqtt"]["message_timeout_seconds"]
        latest_url = f'{config["api"]["base_url"]}/telemetry/latest'
        observed = None
        while time.monotonic() < deadline:
            response = api_session.get(
                latest_url,
                params={"clusterId": target_cluster_id},
                timeout=config["api"]["timeout_seconds"],
            )
            if response.status_code == 200:
                record = response.json()
                if (
                    record.get("deviceId") == str(payload["deviceId"])
                    and record.get("temperature1") == payload["temp1"]
                    and record.get("humidity1") == payload["hum1"]
                ):
                    observed = record
                    break
            time.sleep(0.5)

        assert observed is not None, (
            "Published MQTT telemetry was not observed through the API within "
            f'{config["mqtt"]["message_timeout_seconds"]} seconds'
        )
    finally:
        client.disconnect()
        client.loop_stop()
