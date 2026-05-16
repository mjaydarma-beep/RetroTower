# SAFER COMMUNITY EMERGENCY CONTROL

Remote tower system: **Raspberry Pi 4** edge agents, **MQTT** LED boards, **GPIO** relays, **SIP** announcements, **Teltonika RUT** VPN, and this **operator dashboard**.

## Quick start (dashboard + API)

```powershell
cd d:\SCS_Project\server
npm install
npm start
```

Open in browser: **http://localhost:3001**

The dashboard uses your **SAFER COMMUNITY EMERGENCY CONTROL** design in [`client/`](client/).

- Works in **demo mode** immediately (5 sample towers)
- Buttons send commands via API → MQTT → Raspberry Pi (when broker + Pi agent are running)

## Project layout

```
SCS_Project/
├── client/          # Your dashboard (HTML/CSS/JS)
├── server/          # Control center API + serves dashboard
├── pi-agent/        # Raspberry Pi 4 tower agent
└── preview/         # Old static preview (optional)
```

## Connect Raspberry Pi

See [`pi-agent/README.md`](pi-agent/README.md) for full install steps.

1. Copy `pi-agent` to the Pi
2. Set `TOWER_ID=TWR-001` (matches dashboard)
3. `sudo ./install.sh`
4. Point `MQTT_HOST` and `API_URL` to control center VPN IP

## MQTT (optional for live Pi control)

Install [Mosquitto](https://mosquitto.org/) on the control center PC/server, then:

```powershell
$env:MQTT_URL="mqtt://127.0.0.1:1883"
cd d:\SCS_Project\server
npm start
```

Commands publish to: `scs/towers/TWR-001/cmd/{action}`

## Tower IDs

Dashboard and Pi use: **TWR-001** … **TWR-005** (same as your design).
