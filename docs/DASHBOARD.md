# Operator dashboard guide

The SCS dashboard is the control center for monitoring towers and sending emergency commands.

**URL:** http://localhost:3001/ (or `http://<your-pc-ip>:3001` on the LAN)

**Login:** Set in `server/.env` — default `operator` / `scs-operator`

---

## Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Top bar: Map view · Debug · Sign out · Global evacuation   │
├──────────────────┬──────────────────────────────────────────┤
│  Tower table     │  Selected tower                          │
│  (all sites)     │  Metrics · CCTV · Controls · History     │
└──────────────────┴──────────────────────────────────────────┘
```

### Summary bar

| Stat | Meaning |
|------|---------|
| Towers | Total registered towers |
| Online | Towers with recent telemetry |
| Alerts | Towers with battery warning |
| Emergency | Towers in evacuation state |

---

## Tower table (left panel)

One row per tower. Columns include ID, name, site, status, risk, battery, signal, GPS, Pi host, beacon, LED, camera, last seen.

| Action | How |
|--------|-----|
| **Select tower** | Click anywhere on the row (not the Raw button) |
| **View raw JSON** | Click **Raw** at the end of the row |

### Per-tower Raw data

Each row has a **Raw** button (last column). It opens a JSON panel below the table with the full tower object from the server (`GET /api/towers`).

- **Copy** — copies JSON to clipboard  
- **Close** — hides the panel  

Use this to inspect telemetry fields, camera URLs, and device state without leaving the dashboard.

---

## Selected tower panel (right)

Shown when a tower row is selected.

### Metrics

- **Battery** — percent and voltage  
- **Signal** — RSSI bars (from Pi / Teltonika RUT when available)  
- **Health** — Pi + router connection summary  
- **Devices** — speaker, LED, beacon status  

### CCTV

1. Paste an **HLS**, **MJPEG**, or **go2rtc** HTTP URL into the camera field.  
2. Click **Load** to play in the panel.  
3. Click **Test** to load the default Mux test stream (verifies browser playback).

Browsers cannot play `rtsp://` directly — convert to HLS via go2rtc or your NVR.

### Controls

| Button | Action |
|--------|--------|
| **Evacuation** | Emergency evacuation on selected tower |
| **Announcement** | Opens slot grid (1–10) for PA messages |
| **Beacon** | Flash warning beacon |
| **Stop alerts** | Stop beacon / alerts |
| **Reboot Pi** | Remote reboot (requires agent online) |
| **LED** | Send text to LED display (with MQTT or HTTP queue) |

Announcement button labels can be configured on the server — see [INTEGRATIONS.md](INTEGRATIONS.md).

### Command history

Recent commands for the session appear at the bottom of the right panel.

---

## Map view

Click **Map view** in the top bar.

| Element | Meaning |
|---------|---------|
| Green pin | Tower online |
| Red pin | Tower offline |
| Side panel | Tower details + CCTV preview when a pin is clicked |
| **Open in dashboard** | Selects that tower in the main view |

Towers need GPS coordinates from the Pi or simulator (`TOWER_LAT`, `TOWER_LNG`). Default sim towers are at **Fremantle Beach, Perth WA**.

Map opens centred on Fremantle when using default simulator locations.

---

## Global evacuation

**Global evacuation** (top bar, red) sends an evacuation command to **all online towers**.

Confirm the dialog before sending. Requires towers to receive commands via HTTP queue or MQTT.

---

## Debug page

**URL:** http://localhost:3001/debug.html

Server-focused diagnostics (no operator styling differences for function):

| Section | Contents |
|---------|----------|
| Metrics | Tower count, online count, uptime, MQTT |
| Connections | MQTT broker, API port, per-agent last seen |
| Tower table | Telemetry, MQTT, command queue per tower |
| **Raw** (per row) | JSON for that tower from `/api/debug/status` |
| Recent commands | Last commands issued |

Use Debug when the main dashboard shows offline towers but you need connection breakdown (telemetry age, MQTT, pending HTTP queue).

---

## Risk levels

| Display | Condition |
|---------|-----------|
| Normal | Online, battery OK |
| Battery Warning | Battery below ~25% |
| Evacuation | Emergency active |
| Offline | No recent telemetry |

Offline threshold is `TOWER_OFFLINE_MS` in `server/.env` (default 90 seconds).

---

## Tips

- **Hard refresh** the browser (`Ctrl+F5`) after server or client file changes.  
- If towers stay offline, open **Debug** and check telemetry age and AUTH on the simulator/Pi console.  
- For two demo sites without hardware, run the [simulator](../simulator/README.md) alongside the server.  
- Configure external MQTT and SIP in one place: `server/.env` — see [INTEGRATIONS.md](INTEGRATIONS.md).
