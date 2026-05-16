"""GPIO relay control for beacon and auxiliary load."""

from __future__ import annotations

import logging
import threading
import time
from typing import Optional

from .config import Config

log = logging.getLogger(__name__)


class GpioController:
    def __init__(self, config: Config) -> None:
        self._config = config
        self._simulate = config.simulate_gpio
        self._beacon_on = False
        self._aux_on = False
        self._flash_stop: Optional[threading.Event] = None
        self._flash_thread: Optional[threading.Thread] = None
        self._relay_beacon = None
        self._relay_aux = None

        if not self._simulate:
            try:
                from gpiozero import OutputDevice

                active = config.gpio_active_high
                self._relay_beacon = OutputDevice(
                    config.gpio_relay_beacon, active_high=active, initial_value=False
                )
                self._relay_aux = OutputDevice(
                    config.gpio_relay_aux, active_high=active, initial_value=False
                )
                log.info(
                    "GPIO ready beacon=BCM%d aux=BCM%d",
                    config.gpio_relay_beacon,
                    config.gpio_relay_aux,
                )
            except Exception as exc:
                log.warning("GPIO init failed, using simulation: %s", exc)
                self._simulate = True

    def _set_beacon(self, on: bool) -> None:
        self._beacon_on = on
        if self._relay_beacon:
            self._relay_beacon.on() if on else self._relay_beacon.off()
        else:
            log.info("[SIM] Beacon relay %s", "ON" if on else "OFF")

    def _set_aux(self, on: bool) -> None:
        self._aux_on = on
        if self._relay_aux:
            self._relay_aux.on() if on else self._relay_aux.off()
        else:
            log.info("[SIM] Aux relay %s", "ON" if on else "OFF")

    def beacon_on(self) -> None:
        self.stop_flash()
        self._set_beacon(True)

    def beacon_off(self) -> None:
        self.stop_flash()
        self._set_beacon(False)

    def aux_on(self) -> None:
        self._set_aux(True)

    def aux_off(self) -> None:
        self._set_aux(False)

    def all_off(self) -> None:
        self.stop_flash()
        self.beacon_off()
        self.aux_off()

    def start_flash(self, interval_ms: int | None = None) -> None:
        self.stop_flash()
        ms = interval_ms or self._config.beacon_flash_ms
        self._flash_stop = threading.Event()

        def _loop() -> None:
            while self._flash_stop and not self._flash_stop.is_set():
                self._set_beacon(True)
                time.sleep(ms / 1000.0)
                if self._flash_stop.is_set():
                    break
                self._set_beacon(False)
                time.sleep(ms / 1000.0)
            self._set_beacon(False)

        self._flash_thread = threading.Thread(target=_loop, daemon=True, name="beacon-flash")
        self._flash_thread.start()
        log.info("Beacon flash started interval=%dms", ms)

    def stop_flash(self) -> None:
        if self._flash_stop:
            self._flash_stop.set()
        if self._flash_thread and self._flash_thread.is_alive():
            self._flash_thread.join(timeout=2)
        self._flash_stop = None
        self._flash_thread = None

    def status(self) -> dict:
        return {
            "beacon": self._beacon_on,
            "aux": self._aux_on,
            "flashing": self._flash_thread is not None and self._flash_thread.is_alive(),
        }

    def close(self) -> None:
        self.all_off()
        if self._relay_beacon:
            self._relay_beacon.close()
        if self._relay_aux:
            self._relay_aux.close()
