"""Load configuration from environment file."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _env(key: str, default: str = "") -> str:
    return os.environ.get(key, default).strip()


def _env_bool(key: str, default: bool = False) -> bool:
    val = _env(key, str(default)).lower()
    return val in ("1", "true", "yes", "on")


def _env_int(key: str, default: int) -> int:
    try:
        return int(_env(key, str(default)))
    except ValueError:
        return default


@dataclass
class Config:
    tower_id: str
    tower_name: str
    api_url: str
    device_key: str
    mqtt_host: str
    mqtt_port: int
    mqtt_user: str
    mqtt_password: str
    mqtt_tls: bool
    mqtt_enabled: bool
    led_board_topic: str
    gpio_relay_beacon: int
    gpio_relay_aux: int
    gpio_active_high: bool
    beacon_flash_ms: int
    simulate_gpio: bool
    simulate_battery: bool
    enable_ina219: bool
    ina219_address: int
    rut_api_url: str
    rut_api_user: str
    rut_api_password: str
    enable_rut_signal: bool
    simulate_signal: bool
    camera_rtsp_url: str
    pi_reported_host: str
    telemetry_interval: int
    mqtt_keepalive: int
    watchdog_disconnect_sec: int

    @classmethod
    def from_env(cls) -> "Config":
        tower_id = _env("TOWER_ID", "TWR-001")
        return cls(
            tower_id=tower_id,
            tower_name=_env("TOWER_NAME", tower_id),
            api_url=_env("API_URL", "http://127.0.0.1:3001").rstrip("/"),
            device_key=_env("DEVICE_KEY", "change-me"),
            mqtt_host=_env("MQTT_HOST", "127.0.0.1"),
            mqtt_port=_env_int("MQTT_PORT", 1883),
            mqtt_user=_env("MQTT_USER"),
            mqtt_password=_env("MQTT_PASSWORD"),
            mqtt_tls=_env_bool("MQTT_TLS"),
            mqtt_enabled=_env_bool("MQTT_ENABLED", True),
            led_board_topic=_env("LED_BOARD_TOPIC", f"scs/towers/{tower_id}/led/display"),
            gpio_relay_beacon=_env_int("GPIO_RELAY_BEACON", 17),
            gpio_relay_aux=_env_int("GPIO_RELAY_AUX", 27),
            gpio_active_high=_env_bool("GPIO_ACTIVE_HIGH", True),
            beacon_flash_ms=_env_int("BEACON_FLASH_MS", 500),
            simulate_gpio=_env_bool("SIMULATE_GPIO"),
            simulate_battery=_env_bool("SIMULATE_BATTERY", True),
            enable_ina219=_env_bool("ENABLE_INA219"),
            ina219_address=_env_int("INA219_I2C_ADDRESS", 0x40),
            rut_api_url=_env("RUT_API_URL", "http://192.168.1.1").rstrip("/"),
            rut_api_user=_env("RUT_API_USER", "admin"),
            rut_api_password=_env("RUT_API_PASSWORD"),
            enable_rut_signal=_env_bool("ENABLE_RUT_SIGNAL"),
            simulate_signal=_env_bool("SIMULATE_SIGNAL"),
            camera_rtsp_url=_env("CAMERA_RTSP_URL"),
            pi_reported_host=_env("PI_REPORTED_HOST"),
            telemetry_interval=_env_int("TELEMETRY_INTERVAL", 15),
            mqtt_keepalive=_env_int("MQTT_KEEPALIVE", 60),
            watchdog_disconnect_sec=_env_int("WATCHDOG_DISCONNECT_SEC", 120),
        )


def load_env_file(path: str | Path | None = None) -> None:
    """Parse KEY=VALUE lines into os.environ (does not override existing)."""
    candidates = [
        path,
        os.environ.get("SCS_AGENT_ENV"),
        "/etc/scs-agent.env",
        Path(__file__).resolve().parent.parent / "config.env",
    ]
    for candidate in candidates:
        if not candidate:
            continue
        p = Path(candidate)
        if not p.is_file():
            continue
        for line in p.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            os.environ.setdefault(key, value)
        break
