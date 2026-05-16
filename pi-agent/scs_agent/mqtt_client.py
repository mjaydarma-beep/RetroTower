"""MQTT client for LED board publish and command subscribe."""

from __future__ import annotations

import json
import logging
import threading
from typing import Callable

import paho.mqtt.client as mqtt

from .config import Config
from .commands import CommandExecutor

log = logging.getLogger(__name__)


class MqttBridge:
    def __init__(
        self,
        config: Config,
        commands: CommandExecutor,
        on_command: Callable[[dict], None] | None = None,
    ) -> None:
        self._config = config
        self._commands = commands
        self._on_command = on_command
        self._connected = threading.Event()
        self._last_message = 0.0

        self._client = mqtt.Client(
            mqtt.CallbackAPIVersion.VERSION2,
            client_id=f"scs-pi-{config.tower_id}",
        )
        if config.mqtt_user:
            self._client.username_pw_set(config.mqtt_user, config.mqtt_password or None)
        if config.mqtt_tls:
            self._client.tls_set()

        self._client.on_connect = self._on_connect
        self._client.on_message = self._on_message
        self._client.on_disconnect = self._on_disconnect

    @property
    def is_connected(self) -> bool:
        return self._connected.is_set()

    def connect(self) -> bool:
        """Connect without crashing the service if broker is unreachable."""
        log.info("MQTT connect %s:%s", self._config.mqtt_host, self._config.mqtt_port)
        try:
            self._client.reconnect_delay_set(min_delay=2, max_delay=60)
            self._client.connect_async(
                self._config.mqtt_host,
                self._config.mqtt_port,
                self._config.mqtt_keepalive,
            )
            self._client.loop_start()
            return True
        except Exception as exc:
            log.error("MQTT setup failed: %s", exc)
            return False

    def disconnect(self) -> None:
        self._client.loop_stop()
        self._client.disconnect()

    def publish_led(self, text: str) -> None:
        topic = self._config.led_board_topic
        payload = json.dumps({"text": text, "towerId": self._config.tower_id})
        self._client.publish(topic, payload, qos=1, retain=True)
        log.info("LED MQTT publish %s: %s", topic, text[:80] if text else "(clear)")

        status_topic = f"scs/towers/{self._config.tower_id}/status/led"
        self._client.publish(
            status_topic,
            json.dumps({"text": text, "online": True}),
            qos=1,
        )

    def publish_relays_status(self) -> None:
        topic = f"scs/towers/{self._config.tower_id}/status/relays"
        self._client.publish(
            topic,
            json.dumps(self._commands.device_state()),
            qos=0,
        )

    def _on_connect(self, client, userdata, flags, reason_code, properties=None) -> None:
        if reason_code != 0:
            log.error("MQTT connect failed rc=%s", reason_code)
            return
        self._connected.set()
        log.info("MQTT connected")
        base = f"scs/towers/{self._config.tower_id}/cmd/#"
        client.subscribe(base, qos=1)
        log.info("Subscribed %s", base)

    def _on_disconnect(self, client, userdata, flags, reason_code, properties=None) -> None:
        self._connected.clear()
        log.warning("MQTT disconnected rc=%s", reason_code)

    def _on_message(self, client, userdata, message) -> None:
        import time

        self._last_message = time.time()
        result = self._commands.handle_mqtt_message(message.topic, message.payload)
        if result:
            self.publish_relays_status()
            if self._on_command:
                self._on_command(result)
