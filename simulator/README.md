# SCS Tower Simulator

Small Python program that **pretends to be one or more Raspberry Pi towers** — sends HTTP telemetry to the control center so you can test the dashboard without real hardware.

Same API as the real agent: `POST /api/device/telemetry` with headers `X-Tower-Id` and `X-Device-Key`.

---

## Prerequisites

1. **Control center running** on your PC:

   ```powershell
   cd d:\SCS_Project\server
   npm install
   npm start
   ```

2. **Python 3.10+** (for local run) **or** **Docker** (for container run).

---

## Quick start (Windows)

```powershell
cd d:\SCS_Project\simulator
copy .env.example .env
.\run-sim.ps1
```

Open **http://localhost:3001** and log in (`operator` / `scs-operator`).

---

## Default towers

Unless you override config, **two** towers are simulated:

| ID | Name | Key | GPS |
|----|------|-----|-----|
| TWR-SIM-001 | Simulated Tower 1 | `pi4-twr-001-key` | -32.0781, 115.7589 (Fremantle Beach South) |
| TWR-SIM-002 | Simulated Tower 2 | `pi4-sim-002-key` | -32.0358, 115.7514 (Fremantle Beach Port) |

The server accepts these keys automatically (see `server/src/routes/device.js`).

Each cycle (~15 s) sends:

- Battery % (slow random drift)
- Wi‑Fi style signal (dBm)
- GPS location
- Device state (LED, beacon, camera online)
- Optional command ACKs if the dashboard sent commands

---

## Configuration (`simulator/.env`)

```env
API_URL=http://127.0.0.1:3001
TELEMETRY_INTERVAL=15
```

### Single custom tower

Uncomment and set in `.env`:

```env
TOWER_ID=TWR-SIM-001
DEVICE_KEY=pi4-twr-001-key
TOWER_NAME=My test tower
TOWER_LAT=-32.0781
TOWER_LNG=115.7589
TOWER_LOCATION=Fremantle Beach, Perth WA
TOWER_LOCATION=Demo site
PI_HOST=10.0.0.50
```

If `TOWER_ID` is new, add to **server** `.env`:

```env
PI_DEVICE_KEYS=TWR-SIM-001:pi4-twr-001-key
```

Restart the server.

### Multiple towers (JSON)

```env
SIM_TOWERS=[{"id":"TWR-A","key":"pi4-twr-001-key","name":"Tower A","lat":-32.0781,"lng":115.7589,"piHost":"10.0.0.1","location":"Fremantle Beach (South), Perth WA"},{"id":"TWR-B","key":"pi4-sim-002-key","name":"Tower B","lat":-32.0358,"lng":115.7514,"piHost":"10.0.0.2","location":"Fremantle Beach (Port), Perth WA"}]
```

| JSON field | Required | Description |
|------------|----------|-------------|
| `id` | Yes | Tower ID (HTTP header) |
| `key` | Yes | Device key (must match server) |
| `name` | No | Shown on dashboard |
| `lat` / `lng` | No | Map position |
| `location` | No | Map label / site name |
| `piHost` | No | Shown as Pi IP in table |

---

## Docker

From project root (server must run on host):

```powershell
cd d:\SCS_Project
docker compose -f docker-compose.sim.yml up --build
```

Stop: `Ctrl+C` or `docker compose -f docker-compose.sim.yml down`.

### Custom env in Docker

Create `simulator/.env` and extend `docker-compose.sim.yml`:

```yaml
env_file:
  - ./simulator/.env
```

Or pass variables:

```yaml
environment:
  API_URL: http://host.docker.internal:3001
  TOWER_ID: TWR-SIM-001
```

---

## Manual Python run

```powershell
cd d:\SCS_Project\simulator
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
$env:API_URL = "http://127.0.0.1:3001"
python tower_sim.py
```

Linux/macOS:

```bash
cd simulator
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
export API_URL=http://127.0.0.1:3001
python tower_sim.py
```

---

## Console output

**Success:**

```text
SCS tower simulator → http://127.0.0.1:3001 · 2 tower(s) · every 15s
  - TWR-SIM-001 (Simulated Tower 1) key=pi4-twr-0…
  - TWR-SIM-002 (Simulated Tower 2) key=pi4-sim-0…
[TWR-SIM-001] OK bat=68% sig=-64 dBm
[TWR-SIM-002] OK bat=74% sig=-61 dBm
```

**Auth failure:**

```text
[TWR-SIM-001] AUTH FAILED — check DEVICE_KEY on server
```

Fix: match `DEVICE_KEY` in simulator with `PI_DEVICE_KEY` or `PI_DEVICE_KEYS` on server.

**Connection error:**

- Start `npm start` in `server/`.
- Check `API_URL` (Docker → `host.docker.internal:3001`).

---

## Testing dashboard features

| Feature | How to test |
|---------|-------------|
| Tower table | Run simulator, refresh dashboard |
| Select tower | Click table row |
| Map view | **Map view** button — green/red pins |
| CCTV | Select tower → **Test** stream or paste URL |
| Commands | Send beacon/LED — simulator ACKs in console |
| Debug page | `/debug.html` → **Raw data** |

---

## Files

| File | Purpose |
|------|---------|
| `tower_sim.py` | Main simulator script |
| `run-sim.ps1` | Windows helper (venv + run) |
| `requirements.txt` | Python deps (`requests`) |
| `.env.example` | Config template |
| `Dockerfile` | Container image |
| `../docker-compose.sim.yml` | Compose service |

---

## Full project guide

See [`docs/INSTRUCTIONS.md`](../docs/INSTRUCTIONS.md) for server, dashboard, Pi, map, and troubleshooting.
