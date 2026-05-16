"""Battery telemetry from INA219 or simulation."""

from __future__ import annotations

import logging
import random
import time

from .config import Config

log = logging.getLogger(__name__)


class BatteryMonitor:
    def __init__(self, config: Config) -> None:
        self._config = config
        self._ina = None
        self._sim_percent = 85.0

        if config.enable_ina219 and not config.simulate_battery:
            try:
                import board
                from adafruit_ina219 import INA219

                self._ina = INA219(board.I2C(), address=config.ina219_address)
                log.info("INA219 battery monitor at 0x%02x", config.ina219_address)
            except Exception as exc:
                log.warning("INA219 not available: %s — using simulation", exc)

    def read(self) -> dict:
        if self._ina:
            try:
                bus_v = float(self._ina.bus_voltage)
                current = float(self._ina.current) / 1000.0  # mA -> A
                percent = max(0, min(100, (bus_v - 10.0) / 3.0 * 100))
                health = "good" if percent > 40 else "fair" if percent > 20 else "critical"
                return {
                    "percent": round(percent, 1),
                    "voltage": round(bus_v, 2),
                    "current": round(abs(current), 2),
                    "charging": current > 0.5,
                    "health": health,
                }
            except Exception as exc:
                log.error("INA219 read error: %s", exc)

        # Simulation
        self._sim_percent = max(
            15.0, min(100.0, self._sim_percent + (random.random() - 0.5) * 0.5)
        )
        pct = self._sim_percent
        volt = 10.0 + (pct / 100.0) * 3.0
        return {
            "percent": round(pct, 1),
            "voltage": round(volt, 2),
            "current": round(0.5 + random.random() * 1.5, 2),
            "charging": False,
            "health": "good" if pct > 40 else "fair" if pct > 20 else "critical",
        }
