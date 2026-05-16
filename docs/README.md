# SCS documentation

**SAFER COMMUNITY EMERGENCY CONTROL** — operator dashboard, tower agents, and integrations.

---

## Start here

| Guide | Who it's for | Contents |
|-------|----------------|----------|
| **[INSTRUCTIONS.md](INSTRUCTIONS.md)** | Everyone | Full setup: server, simulator, Pi, GPS, troubleshooting |
| **[DASHBOARD.md](DASHBOARD.md)** | Operators | Dashboard UI, map, controls, per-tower Raw JSON |
| **[INTEGRATIONS.md](INTEGRATIONS.md)** | Integrators | External MQTT broker and SIP/PA server (`server/.env`) |
| **[API.md](API.md)** | Developers | HTTP API endpoints and auth |

---

## Component guides

| Guide | Location |
|-------|----------|
| Tower simulator | [simulator/README.md](../simulator/README.md) |
| Raspberry Pi agent | [pi-agent/README.md](../pi-agent/README.md) |
| Upload agent to Pi (Windows) | [pi-agent/UPLOAD-TO-PI.md](../pi-agent/UPLOAD-TO-PI.md) |
| Pi ↔ PC networking | [CONNECT-PI.md](../CONNECT-PI.md) |
| Deploy from GitHub | [GITHUB-DEPLOY.md](../GITHUB-DEPLOY.md) |

---

## Quick reference

### Run demo (no hardware)

```powershell
# Terminal 1
cd d:\SCS_Project\server
copy .env.example .env
npm install
npm start

# Terminal 2
cd d:\SCS_Project\simulator
copy .env.example .env
.\run-sim.ps1
```

Open **http://localhost:3001** — login `operator` / `scs-operator`

### Main URLs

| URL | Page |
|-----|------|
| http://localhost:3001/ | Operator dashboard |
| http://localhost:3001/login.html | Sign in |
| http://localhost:3001/debug.html | Server & tower diagnostics |

### Default simulated towers

| ID | Location | GPS |
|----|----------|-----|
| TWR-SIM-001 | Fremantle Beach (South), Perth WA | -32.0781, 115.7589 |
| TWR-SIM-002 | Fremantle Beach (Port), Perth WA | -32.0358, 115.7514 |

Device keys must match `server/.env`: `PI_DEVICE_KEY`, `SIM_TWR_002_KEY`.

### Configuration files

| File | Purpose |
|------|---------|
| `server/.env` | Login, towers, MQTT, SIP, announcement slots |
| `simulator/.env` | Simulator API URL and optional tower overrides |
| `/etc/scs-agent.env` (Pi) | Pi tower ID, API URL, GPS, MQTT |

Restart the server after editing `server/.env`. Restart the Pi agent after editing `/etc/scs-agent.env`.

---

## Project layout

```
SCS_Project/
├── client/           Dashboard (HTML/CSS/JS)
├── server/           Node.js API + static files
├── simulator/        Dummy Pi telemetry
├── pi-agent/         Raspberry Pi tower agent
└── docs/             This documentation
```

---

## Typical workflows

**Stakeholder demo** — `npm start` + `.\run-sim.ps1` → show tower table, map, CCTV test stream.

**Production site** — Install `pi-agent` on Pi, set GPS and `DEVICE_KEY`, match keys on server.

**External PA / MQTT** — Configure `server/.env` per [INTEGRATIONS.md](INTEGRATIONS.md), restart server.

**Troubleshooting** — [INSTRUCTIONS.md § Troubleshooting](INSTRUCTIONS.md#troubleshooting)
