# Connect your Raspberry Pi (192.168.1.20) to the dashboard

## 1. Find your PC IP address

On Windows PowerShell:

```powershell
ipconfig
```

Note **IPv4 Address** (example: `192.168.1.100`).

## 2. Start control center on PC

```powershell
cd d:\SCS_Project\server
npm start
```

Open: **http://localhost:3001**

You will see **one tower**: `TWR-001 — Manjul Raspberry Pi Tower` (offline until Pi connects).

## 3. Configure Pi (`/etc/scs-agent.env`)

SSH to Pi:

```powershell
ssh manjul@192.168.1.20
```

Edit config:

```bash
sudo nano /etc/scs-agent.env
```

Set (use **your PC IP**):

```bash
TOWER_ID=TWR-001
TOWER_NAME=Manjul Raspberry Pi Tower
API_URL=http://192.168.1.100:3001
MQTT_HOST=192.168.1.100
DEVICE_KEY=pi4-twr-001-key
PI_REPORTED_HOST=192.168.1.20
SIMULATE_GPIO=true
SIMULATE_BATTERY=true
```

Restart:

```bash
sudo systemctl restart scs-agent
sudo journalctl -u scs-agent -f
```

## 4. Dashboard goes live

Within ~15 seconds the tower shows **Online** with real battery data from the Pi.

No dummy towers — only your Pi appears.
