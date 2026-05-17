"""Poll Teltonika RUT router for cellular signal metrics."""

from __future__ import annotations

import logging
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

    def read(self) -> dict[str, Any]:
        if not self._config.enable_rut_signal:
            return {
                "connected": True,
                "rssi": None,
                "operator": None,
                "network": "vpn",
                "source": "disabled",
            }

        try:
            # Teltonika RMS/RUT API varies by firmware; common mobiled endpoint:
            url = f"{self._config.rut_api_url}/api/mobiled/status"
            resp = self._session.get(url)
            if resp.status_code == 401:
                # Some models use /login first — document in README
                log.warning("RUT API auth failed — check RUT_API_USER/PASSWORD")
                return self._fallback(False)
            resp.raise_for_status()
            data = resp.json()
            return {
                "connected": data.get("connection_state") == "connected"
                or data.get("connected", True),
                "rssi": data.get("rssi") or data.get("signal"),
                "operator": data.get("operator") or data.get("provider"),
                "network": data.get("network_type") or data.get("connstate"),
                "source": "rut_api",
            }
        except Exception as exc:
            log.debug("RUT signal poll failed: %s", exc)
            return self._fallback(True)

    def _fallback(self, assume_connected: bool) -> dict:
        return {
            "connected": assume_connected,
            "rssi": None,
            "operator": None,
            "network": "unknown",
            "source": "fallback",
        }
