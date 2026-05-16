#!/usr/bin/env python3
"""Simulate one or more SCS towers sending HTTP telemetry (no real Pi required)."""

from __future__ import annotations

import json
import os
import random
import socket
import sys
import time
from typing import Any

import requests

DEFAULT_TOWERS = [
    {
        "id": "TWR-SIM-001",
        "key": "pi4-twr-001-key",
        "name": "Simulated Tower 1",
        "piHost": "10.0.0.101",
        "lat": -32.0781,
        "lng": 115.7589,
        "location": "Fremantle Beach (South), Perth WA",
    },
    {
        "id": "TWR-SIM-002",
        "key": "pi4-sim-002-key",
        "name": "Simulated Tower 2",
        "piHost": "10.0.0.102",
        "lat": -32.0358,
        "lng": 115.7514,
        "location": "Fremantle Beach (Port), Perth WA",
    },
]


def _env(key: str, default: str = "") -> str:
    return os.environ.get(key, default).strip()


def _env_int(key: str, default: int) -> int:
    try:
        return int(_env(key, str(default)))
    except ValueError:
        return default


def load_towers() -> list[dict[str, Any]]:
    raw = _env("SIM_TOWERS")
    if raw:
        return json.loads(raw)
    if _env("TOWER_ID"):
        return [
            {
                "id": _env("TOWER_ID", "TWR-SIM-001"),
                "key": _env("DEVICE_KEY", "pi4-twr-001-key"),
                "name": _env("TOWER_NAME", "Simulated Tower"),
                "piHost": _env("PI_HOST", "127.0.0.1"),
                "lat": float(_env("TOWER_LAT", "-32.0781")),
                "lng": float(_env("TOWER_LNG", "115.7589")),
                "location": _env("TOWER_LOCATION", "Demo site"),
            }
        ]
    return DEFAULT_TOWERS


class TowerSimulator:
    def __init__(self, spec: dict[str, Any], api_url: str) -> None:
        self.spec = spec
        self.api_url = api_url.rstrip("/")
        self._start = time.time()
        self._battery = random.randint(55, 95)
        self._session = requests.Session()
        self._session.headers.update(
            {
                "X-Tower-Id": spec["id"],
                "X-Device-Key": spec["key"],
                "Content-Type": "application/json",
            }
        )
        self._session.timeout = 15

    def build_payload(self) -> dict[str, Any]:
        # Slow drift so the dashboard looks alive
        self._battery = max(15, min(100, self._battery + random.randint(-2, 1)))
        rssi = random.randint(-78, -58)
        beacon = random.random() < 0.05

        payload: dict[str, Any] = {
            "towerId": self.spec["id"],
            "towerName": self.spec.get("name", self.spec["id"]),
            "piHost": self.spec.get("piHost", "simulator"),
            "hostname": socket.gethostname(),
            "agentVersion": "sim-1.0",
            "uptime": int(time.time() - self._start),
            "cpuTemp": round(random.uniform(42.0, 58.0), 1),
            "battery": {
                "percent": self._battery,
                "voltage": round(11.8 + self._battery / 100, 1),
                "charging": self._battery < 80,
                "current": round(random.uniform(0.1, 0.8), 2),
                "health": "good" if self._battery > 25 else "critical",
            },
            "signal": {
                "rssi": rssi,
                "connected": True,
                "source": "simulated",
                "network": "Sim-RUT",
            },
            "routerConnected": True,
            "camera": {"online": True, "rtspUrl": ""},
            "devices": {
                "speaker": "Ready",
                "led": "SIM OK",
                "beacon": beacon,
                "beaconFlashing": False,
                "emergencyActive": False,
            },
            "deviceHealth": "healthy",
            "emergencyActive": False,
            "iotDevice": {
                "type": "Simulator",
                "model": "docker",
                "hostname": socket.gethostname(),
            },
        }
        lat = self.spec.get("lat")
        lng = self.spec.get("lng")
        if lat is not None and lng is not None:
            label = self.spec.get("location") or self.spec.get("name", "")
            payload["location"] = {"lat": lat, "lng": lng, "label": label}
            payload["gps"] = {"lat": lat, "lng": lng}
        return payload

    def tick(self) -> None:
        url = f"{self.api_url}/api/device/telemetry"
        payload = self.build_payload()
        try:
            resp = self._session.post(url, json=payload)
            if resp.status_code == 401:
                print(f"[{self.spec['id']}] AUTH FAILED — check DEVICE_KEY on server", file=sys.stderr)
                return
            resp.raise_for_status()
            pending = resp.json().get("pendingCommands") or []
            extra = f" · {len(pending)} cmd(s)" if pending else ""
            print(
                f"[{self.spec['id']}] OK bat={payload['battery']['percent']}% "
                f"sig={payload['signal']['rssi']} dBm{extra}"
            )
            for cmd in pending:
                self._ack_command(cmd)
        except requests.RequestException as exc:
            print(f"[{self.spec['id']}] ERROR {exc}", file=sys.stderr)

    def _ack_command(self, cmd: dict) -> None:
        cmd_id = cmd.get("id")
        if not cmd_id:
            return
        url = f"{self.api_url}/api/device/commands/{cmd_id}/ack"
        try:
            self._session.post(url, json={"success": True, "response": {"simulated": True}})
            print(f"[{self.spec['id']}] ACK command {cmd.get('action', cmd_id)}")
        except requests.RequestException:
            pass


def main() -> None:
    api_url = _env("API_URL", "http://127.0.0.1:3001")
    interval = _env_int("TELEMETRY_INTERVAL", 15)
    towers = load_towers()
    sims = [TowerSimulator(t, api_url) for t in towers]

    print(f"SCS tower simulator -> {api_url} | {len(sims)} tower(s) | every {interval}s")
    for t in towers:
        print(f"  - {t['id']} ({t.get('name', '')}) key={t['key'][:8]}…")

    while True:
        for sim in sims:
            sim.tick()
        time.sleep(interval)


if __name__ == "__main__":
    main()
