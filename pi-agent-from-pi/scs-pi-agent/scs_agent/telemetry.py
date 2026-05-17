"""Build telemetry payload and POST to control center API."""

from __future__ import annotations

import logging
import platform
import socket
import subprocess
import time
from typing import Any

import requests

from .battery import BatteryMonitor
from .commands import CommandExecutor
from .config import Config
from .gpio_control import GpioController
from .rut_signal import RutSignalMonitor

log = logging.getLogger(__name__)


class TelemetryReporter:
    def __init__(
        self,
        config: Config,
        battery: BatteryMonitor,
        rut: RutSignalMonitor,
        gpio: GpioController,
        commands: CommandExecutor,
    ) -> None:
        self._config = config
        self._battery = battery
        self._rut = rut
        self._gpio = gpio
        self._commands = commands
        self._session = requests.Session()
        self._session.headers.update(
            {
                "X-Tower-Id": config.tower_id,
                "X-Device-Key": config.device_key,
                "Content-Type": "application/json",
            }
        )
        self._session.timeout = 15
        self._start_time = time.time()
        self._last_success = 0.0

    @property
    def last_success(self) -> float:
        return self._last_success

    def build_payload(self) -> dict[str, Any]:
        battery = self._battery.read()
        signal = self._rut.read()
        devices = self._commands.device_state()

        camera_online = False
        if self._config.camera_rtsp_url:
            camera_online = self._check_camera()

        return {
            "towerId": self._config.tower_id,
            "hostname": socket.gethostname(),
            "agentVersion": "1.0.0",
            "uptime": int(time.time() - self._start_time),
            "cpuTemp": self._cpu_temp(),
            "battery": battery,
            "signal": signal,
            "routerConnected": signal.get("connected", True),
            "camera": {
                "online": camera_online,
                "rtspUrl": self._config.camera_rtsp_url,
            },
            "devices": devices,
            "deviceHealth": self._health(battery, signal, camera_online),
            "emergencyActive": devices.get("emergencyActive", False),
            "iotDevice": {
                "type": "Raspberry Pi 4",
                "model": platform.machine(),
                "hostname": socket.gethostname(),
            },
        }

    def send(self) -> list[dict]:
        """POST telemetry; return pending commands from server if any."""
        url = f"{self._config.api_url}/api/device/telemetry"
        payload = self.build_payload()
        try:
            resp = self._session.post(url, json=payload)
            if resp.status_code == 404:
                log.debug("API telemetry endpoint not available (404) — MQTT only mode")
                return []
            resp.raise_for_status()
            self._last_success = time.time()
            data = resp.json()
            return data.get("pendingCommands") or []
        except requests.RequestException as exc:
            log.warning("Telemetry POST failed: %s", exc)
            return []

    def ack_command(self, cmd_id: str, success: bool, response: dict) -> None:
        url = f"{self._config.api_url}/api/device/commands/{cmd_id}/ack"
        try:
            self._session.post(
                url,
                json={"success": success, "response": response},
            )
        except requests.RequestException as exc:
            log.warning("Command ACK failed: %s", exc)

    def _cpu_temp(self) -> float | None:
        try:
            with open("/sys/class/thermal/thermal_zone0/temp") as f:
                return round(int(f.read()) / 1000.0, 1)
        except OSError:
            return None

    def _check_camera(self) -> bool:
        url = self._config.camera_rtsp_url
        if not url:
            return False
        try:
            result = subprocess.run(
                ["ping", "-c", "1", "-W", "2", self._extract_host(url)],
                capture_output=True,
                timeout=5,
            )
            return result.returncode == 0
        except Exception:
            return False

    @staticmethod
    def _extract_host(rtsp_url: str) -> str:
        # rtsp://192.168.1.50:554/stream -> 192.168.1.50
        without_scheme = rtsp_url.split("://", 1)[-1]
        return without_scheme.split("/")[0].split(":")[0]

    @staticmethod
    def _health(battery: dict, signal: dict, camera_online: bool) -> str:
        if battery.get("health") == "critical":
            return "degraded"
        if not signal.get("connected", True):
            return "offline"
        if not camera_online:
            return "degraded"
        return "healthy"
