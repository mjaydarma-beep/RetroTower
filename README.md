# SAFER COMMUNITY EMERGENCY CONTROL (SCS)

Remote tower system: **Raspberry Pi 4** edge agents, optional **MQTT**, GPIO relays, and an **operator dashboard** on a Windows/Linux control PC.

## Quick start (no hardware)

Test the full dashboard with a **simulated tower**:

```powershell
# Terminal 1 — control center
cd d:\SCS_Project\server
copy .env.example .env
npm install
npm start

# Terminal 2 — dummy Pi telemetry
cd d:\SCS_Project\simulator
copy .env.example .env
.\run-sim.ps1
```

Open **http://localhost:3001** — login: `operator` / `scs-operator`

## Documentation

| Guide | Description |
|-------|-------------|
| **[docs/README.md](docs/README.md)** | **Documentation index** — start here |
| **[docs/INSTRUCTIONS.md](docs/INSTRUCTIONS.md)** | **Full setup** — server, simulator, Pi, GPS, troubleshooting |
| **[docs/DASHBOARD.md](docs/DASHBOARD.md)** | **Operator guide** — tower table, map, controls, per-tower Raw |
| **[docs/INTEGRATIONS.md](docs/INTEGRATIONS.md)** | **MQTT & SIP** — external broker and PA server (`server/.env`) |
| **[docs/API.md](docs/API.md)** | HTTP API reference |
| **[simulator/README.md](simulator/README.md)** | Tower simulator (Docker, custom towers) |
| **[pi-agent/README.md](pi-agent/README.md)** | Install agent on Raspberry Pi |
| **[pi-agent/UPLOAD-TO-PI.md](pi-agent/UPLOAD-TO-PI.md)** | Copy agent to Pi from Windows |
| **[CONNECT-PI.md](CONNECT-PI.md)** | Network setup Pi ↔ PC |
| **[GITHUB-DEPLOY.md](GITHUB-DEPLOY.md)** | Deploy from GitHub on Pi |

## Project layout

```
SCS_Project/
├── client/                 # Operator dashboard (HTML/JS)
├── server/                 # Node.js API + static files
├── simulator/              # Dummy Pi — HTTP telemetry for testing
├── pi-agent/               # Raspberry Pi tower agent
├── docs/                   # Guides (index, dashboard, API, integrations)
└── docker-compose.sim.yml  # Run simulator in Docker
```

## Main URLs

| URL | Purpose |
|-----|---------|
| http://localhost:3001/ | Dashboard |
| http://localhost:3001/login.html | Operator login |
| http://localhost:3001/debug.html | Server debug |

## Real Raspberry Pi

1. Configure `/etc/scs-agent.env` on the Pi (`API_URL`, `DEVICE_KEY`, `TOWER_ID`, GPS).
2. `DEVICE_KEY` must match `PI_DEVICE_KEY` on the server.
3. See **[pi-agent/README.md](pi-agent/README.md)**.

## Simulator vs real Pi

| | Simulator | Real Pi |
|---|-----------|---------|
| Hardware | None | Raspberry Pi 4 |
| Use case | Demo, dev, UI test | Production sites |
| Location | `simulator/.env` | `/etc/scs-agent.env` |
| Run | `.\run-sim.ps1` or Docker | `systemctl start scs-agent` |

Default sim towers: **TWR-SIM-001**, **TWR-SIM-002** (Fremantle Beach, Perth WA).

## MQTT (optional)

Commands can reach the Pi via **HTTP queue** (telemetry poll) without MQTT. For MQTT, install Mosquitto and set `MQTT_URL` on the server and `MQTT_ENABLED=true` on the Pi.
