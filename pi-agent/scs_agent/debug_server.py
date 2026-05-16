"""Local Pi debug page — metrics and connection status (port 9080)."""

from __future__ import annotations

import json
import logging
import socket
import subprocess
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any

from .battery import BatteryMonitor
from .commands import CommandExecutor
from .config import Config, load_env_file
from .gpio_control import GpioController
from .rut_signal import RutSignalMonitor

log = logging.getLogger("scs-debug")


def _mask_env_value(key: str, value: str) -> str:
    if any(x in key.upper() for x in ("KEY", "PASSWORD", "SECRET")) and value:
        return "********"
    return value


def collect_status() -> dict[str, Any]:
    load_env_file()
    config = Config.from_env()
    gpio = GpioController(config)
    battery = BatteryMonitor(config)
    rut = RutSignalMonitor(config)
    commands = CommandExecutor(config, gpio, publish_led=lambda _: None)

    api_ok = False
    api_detail = ""
    url = f"{config.api_url.rstrip('/')}/api/device/telemetry"
    try:
        body = json.dumps({"towerId": config.tower_id, "debug": True}).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=body,
            headers={
                "Content-Type": "application/json",
                "X-Tower-Id": config.tower_id,
                "X-Device-Key": config.device_key,
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            api_ok = resp.status == 200
            api_detail = f"HTTP {resp.status} telemetry OK"
    except urllib.error.HTTPError as exc:
        api_detail = f"HTTP {exc.code}"
    except Exception as exc:
        api_detail = str(exc)

    mqtt_detail = "disabled"
    if config.mqtt_enabled:
        try:
            sock = socket.create_connection(
                (config.mqtt_host, config.mqtt_port), timeout=3
            )
            sock.close()
            mqtt_detail = f"TCP {config.mqtt_host}:{config.mqtt_port} OK"
        except OSError as exc:
            mqtt_detail = f"TCP failed: {exc}"

    agent_active = False
    try:
        r = subprocess.run(
            ["systemctl", "is-active", "scs-agent"],
            capture_output=True,
            text=True,
            timeout=3,
        )
        agent_active = r.stdout.strip() == "active"
    except (OSError, subprocess.SubprocessError):
        pass

    env_public = {
        k: _mask_env_value(k, v)
        for k, v in sorted(__import__("os").environ.items())
        if k.startswith(
            (
                "TOWER_",
                "API_",
                "DEVICE_",
                "MQTT_",
                "GPIO_",
                "SIMULATE_",
                "ENABLE_",
                "CAMERA_",
                "RUT_",
                "PI_",
                "TELEMETRY_",
            )
        )
    }

    return {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "hostname": socket.gethostname(),
        "agent": {"systemd": "active" if agent_active else "inactive"},
        "config": {
            "towerId": config.tower_id,
            "apiUrl": config.api_url,
            "mqttEnabled": config.mqtt_enabled,
            "mqttHost": f"{config.mqtt_host}:{config.mqtt_port}",
            "simulateBattery": config.simulate_battery,
            "simulateGpio": config.simulate_gpio,
            "enableRutSignal": config.enable_rut_signal,
            "simulateSignal": config.simulate_signal,
        },
        "connections": {
            "controlCenter": {"ok": api_ok, "detail": api_detail, "url": url},
            "mqttBroker": {"detail": mqtt_detail},
        },
        "metrics": {
            "battery": battery.read(),
            "signal": rut.read(),
            "gpio": gpio.status(),
            "devices": commands.device_state(),
        },
        "env": env_public,
    }


HTML_PAGE = """<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>SCS Pi Debug</title>
<style>
  body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:16px}
  h1{margin:0 0 4px;font-size:1.25rem}
  .muted{color:#94a3b8;font-size:.85rem}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin-top:16px}
  .card{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:14px}
  .ok{color:#4ade80}.bad{color:#f87171}
  pre{background:#020617;padding:10px;border-radius:8px;overflow:auto;font-size:12px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  td{padding:4px 0;vertical-align:top}
  td:first-child{color:#94a3b8;width:42%}
</style>
</head><body>
<h1>SCS Tower Agent — Debug</h1>
<p class="muted">Tower01 · auto-refresh 5s · <a href="/api/status" style="color:#60a5fa">JSON</a></p>
<div id="root">Loading…</div>
<script>
async function load(){
  const r=await fetch('/api/status');
  const d=await r.json();
  const cc=d.connections.controlCenter;
  const mq=d.connections.mqttBroker;
  const bat=d.metrics.battery;
  const sig=d.metrics.signal;
  document.getElementById('root').innerHTML=`
  <div class="grid">
    <div class="card"><h3>Agent</h3><table>
      <tr><td>Hostname</td><td>${d.hostname}</td></tr>
      <tr><td>Time</td><td>${d.timestamp}</td></tr>
      <tr><td>systemd</td><td class="${d.agent.systemd==='active'?'ok':'bad'}">${d.agent.systemd}</td></tr>
      <tr><td>Tower ID</td><td>${d.config.towerId}</td></tr>
    </table></div>
    <div class="card"><h3>Connections</h3><table>
      <tr><td>Control center</td><td class="${cc.ok?'ok':'bad'}">${cc.detail}</td></tr>
      <tr><td>API URL</td><td style="word-break:break-all">${d.config.apiUrl}</td></tr>
      <tr><td>MQTT</td><td>${mq.detail}</td></tr>
    </table></div>
    <div class="card"><h3>Battery</h3><pre>${JSON.stringify(bat,null,2)}</pre></div>
    <div class="card"><h3>Signal</h3><pre>${JSON.stringify(sig,null,2)}</pre></div>
    <div class="card"><h3>GPIO / devices</h3><pre>${JSON.stringify({gpio:d.metrics.gpio,devices:d.metrics.devices},null,2)}</pre></div>
    <div class="card"><h3>Config flags</h3><pre>${JSON.stringify(d.config,null,2)}</pre></div>
  </div>`;
}
load(); setInterval(load,5000);
</script>
</body></html>
"""


class DebugHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        log.debug(fmt, *args)

    def do_GET(self) -> None:
        if self.path in ("/", "/index.html"):
            body = HTML_PAGE.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if self.path == "/api/status":
            data = json.dumps(collect_status(), indent=2).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        self.send_error(404)

    def do_HEAD(self) -> None:
        if self.path in ("/", "/index.html", "/api/status"):
            self.do_GET()
        else:
            self.send_error(404)


def main() -> None:
    import os

    port = int(os.environ.get("DEBUG_PORT", "9080"))
    host = os.environ.get("DEBUG_HOST", "0.0.0.0")
    logging.basicConfig(level=logging.INFO)
    server = HTTPServer((host, port), DebugHandler)
    print(f"SCS Pi debug page: http://{host}:{port}/  (JSON: /api/status)")
    print("Press Ctrl+C to stop")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Stopped")


if __name__ == "__main__":
    main()
