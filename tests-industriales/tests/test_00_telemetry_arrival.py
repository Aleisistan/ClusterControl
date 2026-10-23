import json
from threading import Event

import paho.mqtt.client as mqtt


def test_target_device_publishes_live_telemetry(config, target_device):
    connected = Event()
    subscribed = Event()
    telemetry_received = Event()
    connection_error = []
    subscription_error = []
    target_device_id = str(target_device["device_id"])
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)

    def on_connect(_client, _userdata, _flags, reason_code, _properties):
        if reason_code != 0:
            connection_error.append(str(reason_code))
        connected.set()

    def on_subscribe(_client, _userdata, _mid, reason_codes, _properties):
        if any(reason_code.is_failure for reason_code in reason_codes):
            subscription_error.extend(str(reason_code) for reason_code in reason_codes)
        subscribed.set()

    def on_message(_client, _userdata, message):
        try:
            payload = json.loads(message.payload)
        except (UnicodeDecodeError, json.JSONDecodeError):
            return

        if (
            isinstance(payload, dict)
            and str(payload.get("deviceId")) == target_device_id
        ):
            telemetry_received.set()

    client.on_connect = on_connect
    client.on_subscribe = on_subscribe
    client.on_message = on_message

    try:
        client.connect(config["mqtt"]["host"], config["mqtt"]["port"], keepalive=30)
        client.loop_start()

        assert connected.wait(config["mqtt"]["connect_timeout_seconds"]), (
            "Could not connect to MQTT broker: "
            + (connection_error[0] if connection_error else "connection timed out")
        )
        assert not connection_error, (
            f"MQTT broker rejected the connection: {connection_error[0]}"
        )

        result, _message_id = client.subscribe(config["mqtt"]["topic"], qos=1)
        assert result == mqtt.MQTT_ERR_SUCCESS, (
            f"Could not subscribe to MQTT topic {config['mqtt']['topic']!r}: "
            f"code {result}"
        )
        assert subscribed.wait(config["mqtt"]["connect_timeout_seconds"]), (
            f"MQTT subscription to {config['mqtt']['topic']!r} was not acknowledged"
        )
        assert not subscription_error, (
            f"MQTT broker rejected the subscription: {subscription_error[0]}"
        )
        assert telemetry_received.wait(config["mqtt"]["telemetry_timeout_seconds"]), (
            f"No live telemetry for device {target_device_id} arrived on "
            f"{config['mqtt']['topic']!r} within "
            f'{config["mqtt"]["telemetry_timeout_seconds"]} seconds'
        )
    finally:
        client.disconnect()
        client.loop_stop()
