"""Execute commands received via MQTT or HTTP."""

from __future__ import annotations

import json
import logging
import subprocess
from typing import Any, Callable

from .config import Config
from .gpio_control import GpioController

log = logging.getLogger(__name__)

EVACUATION_LED_TEXT = "EVACUATE IMMEDIATELY - Follow designated routes"


class CommandExecutor:
    def __init__(
        self,
        config: Config,
        gpio: GpioController,
        publish_led: Callable[[str], None],
    ) -> None:
        self._config = config
        self._gpio = gpio
        self._publish_led = publish_led
        self._emergency = False
        self._speaker_state = "idle"
        self._led_text = ""

    def execute(self, action: str, payload: dict[str, Any] | None = None) -> dict:
        payload = payload or {}
        log.info("Execute command: %s %s", action, payload)

        try:
            if action == "evacuation":
                return self._evacuation()
            if action == "led_message":
                return self._led_message(payload.get("text", ""))
            if action == "beacon_on":
                self._gpio.beacon_on()
                return {"success": True, "beacon": True}
            if action == "beacon_off":
                self._gpio.beacon_off()
                return {"success": True, "beacon": False}
            if action == "beacon_flash":
                self._gpio.start_flash(payload.get("intervalMs"))
                return {"success": True, "beacon": "flashing"}
            if action == "relay_aux_on":
                self._gpio.aux_on()
                return {"success": True, "aux": True}
            if action == "relay_aux_off":
                self._gpio.aux_off()
                return {"success": True, "aux": False}
            if action == "stop_alerts":
                return self._stop_alerts()
            if action == "announcement":
                # SIP is triggered from control-center PBX; Pi only logs/ACKs
                slot = payload.get("slot", 0)
                self._speaker_state = "playing"
                log.info("Announcement slot %s — speaker via SIP from control center", slot)
                return {"success": True, "speaker": "playing", "slot": slot}
            if action == "reboot":
                return self._reboot()
            return {"success": False, "error": f"Unknown action: {action}"}
        except Exception as exc:
            log.exception("Command failed: %s", action)
            return {"success": False, "error": str(exc)}

    def _evacuation(self) -> dict:
        self._emergency = True
        self._gpio.start_flash()
        self._led_text = EVACUATION_LED_TEXT
        self._publish_led(self._led_text)
        self._speaker_state = "playing"
        return {
            "success": True,
            "emergency": True,
            "led": self._led_text,
            "beacon": "flashing",
        }

    def _led_message(self, text: str) -> dict:
        self._led_text = text
        self._publish_led(text)
        return {"success": True, "led": text}

    def _stop_alerts(self) -> dict:
        self._emergency = False
        self._gpio.all_off()
        self._led_text = ""
        self._publish_led("")
        self._speaker_state = "idle"
        return {"success": True, "message": "All alerts stopped"}

    def _reboot(self) -> dict:
        log.warning("Reboot requested — restarting in 3 seconds")
        subprocess.Popen(
            ["bash", "-c", "sleep 3 && sudo /sbin/reboot"],
            start_new_session=True,
        )
        return {"success": True, "message": "Reboot initiated"}

    def device_state(self) -> dict:
        g = self._gpio.status()
        return {
            "beacon": g["beacon"] or g["flashing"],
            "beaconFlashing": g["flashing"],
            "aux": g["aux"],
            "speaker": self._speaker_state,
            "led": self._led_text,
            "emergencyActive": self._emergency,
        }

    def handle_mqtt_message(self, topic: str, payload_bytes: bytes) -> dict | None:
        """Parse incoming MQTT command topics."""
        base = f"scs/towers/{self._config.tower_id}/cmd/"
        if not topic.startswith(base):
            return None
        action = topic[len(base) :].strip("/")
        try:
            payload = json.loads(payload_bytes.decode("utf-8")) if payload_bytes else {}
        except json.JSONDecodeError:
            payload = {"raw": payload_bytes.decode("utf-8", errors="replace")}
        return self.execute(action, payload)
