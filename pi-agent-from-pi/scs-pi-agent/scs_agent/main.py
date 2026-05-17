"""SCS Raspberry Pi 4 tower agent entry point."""

from __future__ import annotations

import json
import logging
import signal
import sys
import time

from .battery import BatteryMonitor
from .commands import CommandExecutor
from .config import Config, load_env_file
from .gpio_control import GpioController
from .mqtt_client import MqttBridge
from .rut_signal import RutSignalMonitor
from .telemetry import TelemetryReporter

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("scs-agent")


class TowerAgent:
    def __init__(self, config: Config) -> None:
        self._config = config
        self._running = True
        self._gpio = GpioController(config)
        self._battery = BatteryMonitor(config)
        self._rut = RutSignalMonitor(config)
        self._mqtt: MqttBridge | None = None
        self._commands = CommandExecutor(
            config,
            self._gpio,
            publish_led=self._publish_led_safe,
        )
        self._telemetry = TelemetryReporter(
            config, self._battery, self._rut, self._gpio, self._commands
        )

    def _publish_led_safe(self, text: str) -> None:
        if self._mqtt and self._mqtt.is_connected:
            self._mqtt.publish_led(text)
        else:
            log.warning("MQTT not connected — LED message queued locally only: %s", text)

    def start(self) -> None:
        log.info("Starting SCS agent tower=%s", self._config.tower_id)
        self._mqtt = MqttBridge(self._config, self._commands)
        self._mqtt.connect()

        # Wait briefly for MQTT
        for _ in range(20):
            if self._mqtt.is_connected:
                break
            time.sleep(0.25)

        while self._running:
            pending = self._telemetry.send()
            for cmd in pending:
                self._run_server_command(cmd)
            if self._mqtt:
                self._mqtt.publish_relays_status()
            self._watchdog()
            time.sleep(self._config.telemetry_interval)

    def _run_server_command(self, cmd: dict) -> None:
        cmd_id = cmd.get("id", "unknown")
        action = cmd.get("action", "")
        payload = cmd.get("payload") or {}
        result = self._commands.execute(action, payload)
        self._telemetry.ack_command(cmd_id, result.get("success", False), result)
        if self._mqtt:
            self._mqtt.publish_relays_status()

    def _watchdog(self) -> None:
        sec = self._config.watchdog_disconnect_sec
        if sec <= 0:
            return
        now = time.time()
        mqtt_ok = self._mqtt and self._mqtt.is_connected
        api_ok = (now - self._telemetry.last_success) < sec if self._telemetry.last_success else False
        if not mqtt_ok and not api_ok:
            log.warning("Watchdog: no connectivity — turning relays OFF")
            self._gpio.all_off()

    def stop(self) -> None:
        self._running = False
        if self._mqtt:
            self._mqtt.disconnect()
        self._gpio.close()
        log.info("Agent stopped")


def main() -> None:
    load_env_file()
    config = Config.from_env()

    weak_keys = ("change-me", "replace-in-production", "")
    if config.device_key.lower() in weak_keys:
        log.error("Set a strong DEVICE_KEY in /etc/scs-agent.env before production use")
        sys.exit(1)

    agent = TowerAgent(config)

    def _shutdown(signum, frame) -> None:
        log.info("Signal %s received", signum)
        agent.stop()
        sys.exit(0)

    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT, _shutdown)

    try:
        agent.start()
    except KeyboardInterrupt:
        agent.stop()


if __name__ == "__main__":
    main()
