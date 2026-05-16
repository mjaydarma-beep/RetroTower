"""Router/cellular signal — Teltonika RUT API, Pi Wi-Fi RSSI, or simulation."""

from __future__ import annotations

import logging
import random
import subprocess
from typing import Any

import requests

from .config import Config

log = logging.getLogger(__name__)


class RutSignalMonitor:
    def __init__(self, config: Config) -> None:
        self._config = config
        self._session = requests.Session()
        self._session.auth = (config.rut_api_user, config.rut_api_password)
        self._session.timeout = 8
        self._sim_rssi = -68.0

    def read(self) -> dict[str, Any]:
        if self._config.enable_rut_signal:
            return self._read_rut_api()

        if self._config.simulate_signal:
            return self._read_simulated()

        wifi = self._read_pi_wifi_rssi()
        if wifi is not None:
            return {
                "connected": True,
                "rssi": wifi,
                "operator": None,
                "network": "Wi-Fi",
                "source": "pi_wifi",
            }

        return self._read_simulated()

    def _read_rut_api(self) -> dict[str, Any]:
        try:
            url = f"{self._config.rut_api_url}/api/mobiled/status"
            resp = self._session.get(url)
            if resp.status_code == 401:
                log.warning("RUT API auth failed — check RUT_API_USER/PASSWORD")
                return self._fallback(False)
            resp.raise_for_status()
            data = resp.json()
            rssi = data.get("rssi") or data.get("signal")
            if rssi is not None:
                rssi = int(rssi)
            return {
                "connected": data.get("connection_state") == "connected"
                or data.get("connected", True),
                "rssi": rssi,
                "operator": data.get("operator") or data.get("provider"),
                "network": data.get("network_type") or data.get("connstate") or "LTE",
                "source": "rut_api",
            }
        except Exception as exc:
            log.debug("RUT signal poll failed: %s", exc)
            return self._fallback(True)

    def _read_simulated(self) -> dict[str, Any]:
        self._sim_rssi = max(-95.0, min(-55.0, self._sim_rssi + (random.random() - 0.5) * 2))
        return {
            "connected": True,
            "rssi": int(round(self._sim_rssi)),
            "operator": "Demo",
            "network": "Simulated",
            "source": "simulated",
        }

    @staticmethod
    def _read_pi_wifi_rssi() -> int | None:
        """Read wlan0 RSSI from /proc/net/wireless (dBm, typically negative)."""
        try:
            with open("/proc/net/wireless", encoding="utf-8") as f:
                lines = f.readlines()
            for line in lines[2:]:
                parts = line.split()
                if len(parts) >= 4 and parts[0].rstrip(":").startswith("wl"):
                    level = float(parts[3].replace(".", ""))
                    if level > 0:
                        continue
                    return int(level)
        except OSError:
            pass

        try:
            out = subprocess.run(
                ["iw", "dev", "wlan0", "link"],
                capture_output=True,
                text=True,
                timeout=3,
            )
            for line in out.stdout.splitlines():
                if "signal:" in line:
                    # signal: -45 dBm
                    token = line.split("signal:")[1].strip().split()[0]
                    return int(token)
        except (OSError, subprocess.SubprocessError, ValueError):
            pass

        return None

    def _fallback(self, assume_connected: bool) -> dict[str, Any]:
        return {
            "connected": assume_connected,
            "rssi": None,
            "operator": None,
            "network": "unknown",
            "source": "fallback",
        }
