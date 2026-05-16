# SCS — Full setup & operations guide

**SAFER COMMUNITY EMERGENCY CONTROL** — remote tower monitoring and control from a PC dashboard, with optional Raspberry Pi agents at each site.

---

## Table of contents

1. [What you need](#what-you-need)
2. [Quick start (no Pi)](#quick-start-no-pi)
3. [Control center (server + dashboard)](#control-center-server--dashboard)
4. [Tower simulator (dummy Pi)](#tower-simulator-dummy-pi)
5. [Real Raspberry Pi agent](#real-raspberry-pi-agent)
6. [Dashboard features](#dashboard-features)
7. [Debug page](#debug-page)
8. [GPS and map view](#gps-and-map-view)
9. [External MQTT and SIP](#external-mqtt-and-sip-central-configuration)
10. [Environment variables](#environment-variables)
11. [Troubleshooting](#troubleshooting)
12. [Related docs](#related-docs)

---

## What you need

| Component | Purpose |
|-----------|---------|
| **PC (control center)** | Runs Node.js server + web dashboard |
| **Browser** | Chrome or Edge recommended |
| **Node.js 18+** | For `server/` |
| **Python 3.10+** | For simulator or Pi agent (optional) |
| **Docker** | Optional — run tower simulator in a container |
| **Raspberry Pi 4** | Optional — real tower hardware |

**Network:** Pi and PC must reach each other on the same LAN (or VPN). Example: PC `192.168.0.2`, Pi `192.168.1.20` — set Pi `API_URL` to the PC IP.

---

## Quick start (no Pi)

Test everything with the **tower simulator** (fake telemetry).

### Step 1 — Start the server

```powershell
cd d:\SCS_Project\server
copy .env.example .env
npm install
npm start
```

Server listens on **http://localhost:3001** (or your PC LAN IP).

### Step 2 — Log in

Open: **http://localhost:3001**

| Field | Default |
|-------|---------|
| Username | `operator` |
| Password | `scs-operator` |

Change these in `server/.env` before production.

### Step 3 — Run the simulator

**New terminal:**

```powershell
cd d:\SCS_Project\simulator
copy .env.example .env
.\run-sim.ps1
```

You should see lines like:

```text
[TWR-SIM-001] OK bat=72% sig=-65 dBm
[TWR-SIM-002] OK bat=81% sig=-62 dBm
```

### Step 4 — Use the dashboard

- Refresh the dashboard — towers appear in the table.
- Click a row to select a tower (CCTV, controls).
- Click **Raw** at the end of a row to view that tower’s JSON.
- Click **Map view** to see green (live) / red (offline) pins.

Operator UI details: [`docs/DASHBOARD.md`](DASHBOARD.md)  
More simulator options: [`simulator/README.md`](../simulator/README.md).

---

## Control center (server + dashboard)

### Install

```powershell
cd d:\SCS_Project\server
npm install
```

### Configure

Copy and edit environment file:

```powershell
copy .env.example .env
notepad .env
```

Important settings:

```env
PORT=3001
OPERATOR_USERNAME=operator
OPERATOR_PASSWORD=scs-operator
SESSION_SECRET=change-this-to-a-long-random-string

TOWER_ID=TWR-001
TOWER_NAME=Manjul Raspberry Pi Tower
PI_DEVICE_KEY=pi4-twr-001-key
SIM_TWR_002_KEY=pi4-sim-002-key
```

### Run

```powershell
npm start
```

### URLs

| Page | URL |
|------|-----|
| Dashboard | http://localhost:3001/ |
| Login | http://localhost:3001/login.html |
| Debug | http://localhost:3001/debug.html |
| API towers | http://localhost:3001/api/towers (requires login cookie) |

From another device on LAN, use your PC IPv4 address, e.g. `http://192.168.0.2:3001`.

---

## Tower simulator (dummy Pi)

The simulator sends HTTP telemetry to the server — same format as a real Pi — so you can develop and demo without hardware.

### Default simulated towers

| Tower ID | Device key | Location (demo) |
|----------|------------|-----------------|
| TWR-SIM-001 | `pi4-twr-001-key` | Fremantle Beach South — -32.0781, 115.7589 |
| TWR-SIM-002 | `pi4-sim-002-key` | Fremantle Beach Port — -32.0358, 115.7514 |

Battery and signal values change slightly each cycle so the UI looks live.

### Run on Windows (PowerShell)

```powershell
cd d:\SCS_Project\simulator
copy .env.example .env
.\run-sim.ps1
```

### Run with Python directly

```powershell
cd d:\SCS_Project\simulator
python -m venv venv
.\venv\Scripts\pip install -r requirements.txt
$env:API_URL = "http://127.0.0.1:3001"
python tower_sim.py
```

### Run with Docker

**Terminal 1** — server on host:

```powershell
cd d:\SCS_Project\server
npm start
```

**Terminal 2** — simulator container:

```powershell
cd d:\SCS_Project
docker compose -f docker-compose.sim.yml up --build
```

Docker uses `http://host.docker.internal:3001` to reach the server on your PC.

### Custom single tower

Edit `simulator/.env`:

```env
API_URL=http://127.0.0.1:3001
TELEMETRY_INTERVAL=15

TOWER_ID=TWR-SIM-001
DEVICE_KEY=pi4-twr-001-key
TOWER_NAME=Beach test tower
TOWER_LAT=-32.0781
TOWER_LNG=115.7589
TOWER_LOCATION=Fremantle Beach, Perth WA
PI_HOST=10.0.0.99
```

If you use a **new** tower ID, add its key on the server:

```env
PI_DEVICE_KEYS=TWR-SIM-001:pi4-twr-001-key
```

in `server/.env`, then restart `npm start`.

### Multiple towers (JSON)

In `simulator/.env`:

```env
SIM_TOWERS=[{"id":"TWR-A","key":"pi4-twr-001-key","name":"Tower A","lat":-32.0781,"lng":115.7589,"piHost":"10.0.0.1","location":"Fremantle Beach (South), Perth WA"},{"id":"TWR-B","key":"pi4-sim-002-key","name":"Tower B","lat":-32.0358,"lng":115.7514,"piHost":"10.0.0.2","location":"Fremantle Beach (Port), Perth WA"}]
```

---

## Real Raspberry Pi agent

For production towers, install the agent on each Pi.

| Guide | Contents |
|-------|----------|
| [`pi-agent/README.md`](../pi-agent/README.md) | Install, GPIO, MQTT, systemd |
| [`pi-agent/UPLOAD-TO-PI.md`](../pi-agent/UPLOAD-TO-PI.md) | Copy files to Pi from Windows |
| [`CONNECT-PI.md`](../CONNECT-PI.md) | Network and first connection |
| [`GITHUB-DEPLOY.md`](../GITHUB-DEPLOY.md) | Deploy from GitHub on Pi |

### Minimum Pi configuration (`/etc/scs-agent.env`)

```env
TOWER_ID=TWR-001
TOWER_NAME=Site tower 1
API_URL=http://192.168.0.2:3001
DEVICE_KEY=pi4-twr-001-key
MQTT_ENABLED=false

TOWER_LAT=51.5074
TOWER_LNG=-0.1278
TOWER_LOCATION=Beach north

PI_REPORTED_HOST=192.168.1.20
SIMULATE_GPIO=true
SIMULATE_BATTERY=true
TELEMETRY_INTERVAL=15
```

Restart after changes:

```bash
sudo systemctl restart scs-agent
```

**`DEVICE_KEY`** must match `PI_DEVICE_KEY` on the server for that tower ID.

---

## Dashboard features

Full operator guide: **[DASHBOARD.md](DASHBOARD.md)**

### Tower table

- All towers in one row per site (status, battery, signal, GPS, etc.).
- **Click a row** to select a tower for detail panel.
- **Raw** (last column) — opens JSON for that tower below the table (**Copy** / **Close**).

### Selected tower panel

- Live metrics (battery, signal, devices).
- **CCTV** — paste HLS/MJPEG/go2rtc URL and click **Load**.
- **Test** — loads Mux test HLS stream.
- Emergency controls (evacuation, beacon, announcements, LED, reboot).

### Map view

1. Towers need **GPS** (`TOWER_LAT` / `TOWER_LNG` on Pi or simulator).
2. Click **Map view** in the top bar.
3. **Green** pin = online · **Red** = offline.
4. Click a pin → side panel with details + CCTV preview.
5. **Open in dashboard** selects that tower in the main view.

### Global evacuation

Sends evacuation command to all online towers (requires Pi/simulator receiving commands).

---

## Debug page

**http://localhost:3001/debug.html**

- Server uptime, MQTT status, tower connection breakdown.
- Full tower table (telemetry, MQTT, command queue).
- **Raw** button on each tower row (last column) — JSON for that tower from `/api/debug/status`.
- Panel below table: **Copy** and **Close** (no global Raw button in the header).
- Same light theme as the main dashboard.

Pi local debug (on the Pi): `python -m scs_agent.debug_server` → port **9080**.

---

## GPS and map view

Set on the **Pi** (or simulator):

```env
TOWER_LAT=-32.0781
TOWER_LNG=115.7589
TOWER_LOCATION=Fremantle Beach, Perth WA
```

Coordinates are sent in telemetry and stored on the server. The dashboard **GPS** column and **Map view** use these values.

Get coordinates from Google Maps: right-click a place → copy latitude/longitude.

---

## External MQTT and SIP (central configuration)

All integration endpoints are configured in **one place**: `server/.env`  
Restart the server after any change.

| File | Purpose |
|------|---------|
| `server/.env` | Your live settings (copy from `.env.example`) |
| `server/src/config/integrations.js` | Reads env — do not edit unless adding features |

### MQTT (commands to Pi / LED)

```env
MQTT_ENABLED=true
MQTT_URL=mqtt://your-mqtt-broker:1883
MQTT_USER=your_user
MQTT_PASSWORD=your_password
MQTT_TOPIC_PREFIX=scs/towers
```

Pi subscribes to: `scs/towers/TWR-001/cmd/{action}`  
LED board topic: `scs/towers/TWR-001/led/display`

Set `MQTT_ENABLED=false` to use **HTTP command queue only** (Pi polls on telemetry).

### SIP / PA announcements (dashboard triggers)

When an operator clicks **Announcement** or **Evacuation**, the server can call your external SIP/PA system:

```env
SIP_ENABLED=true
SIP_MODE=http
SIP_HTTP_URL=http://192.168.1.50:8088/api/announce
SIP_HTTP_TOKEN=your-api-key
SIP_DEFAULT_EXTENSION=100
SIP_EVAC_ANNOUNCE_SLOT=2
```

**HTTP body** sent to your SIP server:

```json
{
  "towerId": "TWR-001",
  "slot": 2,
  "label": "Evacuate beach",
  "sipRef": "2",
  "extension": "100",
  "timestamp": "2026-05-16T12:00:00.000Z"
}
```

**MQTT mode** (SIP gateway listens on MQTT):

```env
SIP_ENABLED=true
SIP_MODE=mqtt
SIP_MQTT_TOPIC=scs/sip/announce
```

**Both** HTTP and MQTT: `SIP_MODE=both`

### Announcement labels (dashboard buttons)

Optional JSON in `.env`:

```env
ANNOUNCEMENT_SLOTS_JSON=[{"slot":1,"label":"All clear","sipRef":"1"},{"slot":2,"label":"Evacuate beach","sipRef":"2"}]
```

Or use defaults from `integrations.js`.  
Dashboard can load slots from **GET /api/integrations** (after login).

### Check configuration

- **Debug page** → tower row **Raw** → inspect tower + `integrations` in full status payload  
- **API:** `GET /api/integrations` (requires operator login)

Full reference: [`docs/INTEGRATIONS.md`](INTEGRATIONS.md)

---

## Environment variables

### Server (`server/.env`)

| Variable | Description |
|----------|-------------|
| `PORT` | HTTP port (default `3001`) |
| `OPERATOR_USERNAME` / `OPERATOR_PASSWORD` | Dashboard login |
| `SESSION_SECRET` | Cookie signing — change in production |
| `TOWER_ID` / `TOWER_NAME` | Default tower in store |
| `PI_DEVICE_KEY` | Secret for Pi HTTP auth (tower `TWR-001`) |
| `PI_DEVICE_KEYS` | Extra towers: `TWR-002:key2,TWR-003:key3` |
| `SIM_TWR_002_KEY` | Key for simulator `TWR-SIM-002` |
| `TOWER_OFFLINE_MS` | Mark offline after no telemetry (default 90000) |
| `TEST_CAMERA_STREAM` | Default HLS URL for test button |
| `MQTT_ENABLED` / `MQTT_URL` / `MQTT_*` | External MQTT broker — see [INTEGRATIONS.md](INTEGRATIONS.md) |
| `SIP_ENABLED` / `SIP_MODE` / `SIP_*` | External SIP/PA triggers |
| `ANNOUNCEMENT_SLOTS_JSON` | Dashboard announcement button labels |
| `COMMAND_HTTP_FALLBACK` | Queue HTTP commands when MQTT fails |

### Simulator (`simulator/.env`)

| Variable | Description |
|----------|-------------|
| `API_URL` | Control center URL |
| `TELEMETRY_INTERVAL` | Seconds between posts (default `15`) |
| `TOWER_ID`, `DEVICE_KEY`, … | Single-tower mode |
| `SIM_TOWERS` | JSON array for multiple towers |

### Pi (`/etc/scs-agent.env`)

See `pi-agent/config.example.env` and [`pi-agent/README.md`](../pi-agent/README.md).

---

## Troubleshooting

### Dashboard shows no towers / offline

1. Is `npm start` running in `server/`?
2. Is the simulator or Pi running?
3. Check simulator console for `AUTH FAILED` → keys must match server.
4. Open **Debug** page — check telemetry age.

### Simulator: `Connection refused`

- Server not started, or wrong `API_URL`.
- Docker: use `http://host.docker.internal:3001` not `localhost`.

### Pi: 401 / tower offline

- `DEVICE_KEY` on Pi must match `PI_DEVICE_KEY` (or `PI_DEVICE_KEYS`) on server.
- `TOWER_ID` must match (e.g. `TWR-001`, not `tower-001` unless server allows legacy).

### Pi cannot reach PC

- Different subnets (`192.168.0.x` vs `192.168.1.x`) — use routing or put both on same subnet.
- Windows firewall — allow inbound TCP **3001**.

### Map view: no pins

- Set `TOWER_LAT` and `TOWER_LNG` on Pi/simulator.
- Restart agent/simulator after env change.
- Refresh dashboard.

### CCTV does not play

- Browsers cannot play `rtsp://` directly — use go2rtc HTTP page or HLS/MJPEG URL.
- Click **Test** to verify Mux HLS works.

### Commands not reaching Pi

- Server queues commands over **HTTP** when Pi posts telemetry (works without MQTT).
- For MQTT: install Mosquitto, set `MQTT_ENABLED=true` on Pi, `MQTT_URL` on server.

---

## Related docs

| Document | Topic |
|----------|--------|
| [`docs/README.md`](README.md) | Documentation index |
| [`docs/DASHBOARD.md`](DASHBOARD.md) | Operator dashboard guide |
| [`docs/INTEGRATIONS.md`](INTEGRATIONS.md) | MQTT & SIP configuration |
| [`docs/API.md`](API.md) | HTTP API reference |
| [`simulator/README.md`](../simulator/README.md) | Tower simulator only |
| [`pi-agent/README.md`](../pi-agent/README.md) | Pi agent install |
| [`pi-agent/UPLOAD-TO-PI.md`](../pi-agent/UPLOAD-TO-PI.md) | Upload from Windows |
| [`CONNECT-PI.md`](../CONNECT-PI.md) | Pi networking |
| [`GITHUB-DEPLOY.md`](../GITHUB-DEPLOY.md) | GitHub deploy to Pi |

---

## Typical workflows

### Demo for stakeholders (no hardware)

```powershell
cd server && npm start
# new terminal
cd simulator && .\run-sim.ps1
```

Open dashboard → show table, map view, CCTV test stream.

### Develop dashboard only

Server + simulator. Edit files in `client/`, refresh browser (Ctrl+F5).

### One real Pi + simulator

- Pi: `TWR-001` with real `DEVICE_KEY`.
- Simulator: `TWR-SIM-002` for second map pin.
- Both appear on dashboard and map.
