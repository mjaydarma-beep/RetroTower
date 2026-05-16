# How to upload Pi agent code to Raspberry Pi 4

All agent code is in this folder: `d:\SCS_Project\pi-agent\`

---

## Before you start

| Item | What you need |
|------|----------------|
| Pi OS | Raspberry Pi OS **64-bit Lite** (Bookworm) |
| Network | Pi connected to **Teltonika RUT** (Ethernet) |
| SSH | Enabled on Pi (`sudo raspi-config` → Interface → SSH) |
| Pi IP | Find in router DHCP or `ping raspberrypi.local` |
| Control PC | Same LAN as Pi for first setup, or VPN later |

Default Pi login: user **`pi`** (or the user you created during imaging).

---

## Method 1 — SCP from Windows (recommended)

### Step 1: Create upload zip (optional)

In PowerShell on your PC:

```powershell
cd d:\SCS_Project\pi-agent
.\package-for-pi.ps1
```

This creates `d:\SCS_Project\pi-agent-upload.zip`.

### Step 2: Copy folder to Pi

Replace `192.168.1.10` with your Pi’s IP:

```powershell
scp -r d:\SCS_Project\pi-agent pi@192.168.1.10:~/scs-pi-agent
```

If you used the zip:

```powershell
scp d:\SCS_Project\pi-agent-upload.zip pi@192.168.1.10:~/
ssh pi@192.168.1.10 "unzip -o pi-agent-upload.zip -d scs-pi-agent && rm pi-agent-upload.zip"
```

### Step 3: SSH into Pi and install

```powershell
ssh pi@192.168.1.10
```

On the Pi:

```bash
cd ~/scs-pi-agent
chmod +x install.sh run-sim.sh
sudo ./install.sh
```

### Step 4: Configure this tower

```bash
sudo nano /etc/scs-agent.env
```

Set for **TWR-001** (example):

```bash
TOWER_ID=TWR-001
TOWER_NAME=Beach Tower 1
API_URL=http://10.8.0.1:3001
DEVICE_KEY=pi4-twr-001-key
MQTT_HOST=10.8.0.1
MQTT_PORT=1883
LED_BOARD_TOPIC=scs/towers/TWR-001/led/display
GPIO_RELAY_BEACON=17
GPIO_RELAY_AUX=27
SIMULATE_GPIO=false
```

For **local lab test** (Pi and PC on same Wi‑Fi, no VPN):

```bash
API_URL=http://192.168.1.100:3001
MQTT_HOST=192.168.1.100
DEVICE_KEY=pi4-twr-001-key
SIMULATE_GPIO=true
SIMULATE_BATTERY=true
```

Use your PC’s LAN IP instead of `192.168.1.100`.

### Step 5: Start service

```bash
sudo systemctl start scs-agent
sudo systemctl enable scs-agent
sudo systemctl status scs-agent
sudo journalctl -u scs-agent -f
```

You should see: `Starting SCS agent tower=TWR-001` and `MQTT connected`.

---

## Method 2 — USB flash drive

1. Run `package-for-pi.ps1` on PC.
2. Copy `pi-agent-upload.zip` to USB stick.
3. Plug USB into Pi; mount and copy:

```bash
mkdir -p ~/scs-pi-agent
cp /media/pi/USBNAME/pi-agent-upload.zip ~/
cd ~
unzip pi-agent-upload.zip -d scs-pi-agent
cd scs-pi-agent
chmod +x install.sh
sudo ./install.sh
```

---

## Method 3 — Git (if you use GitHub)

On the Pi:

```bash
git clone <your-repo-url>
cd SCS_Project/pi-agent
sudo ./install.sh
```

---

## Device keys (must match control center)

| Tower ID | DEVICE_KEY (default) |
|----------|----------------------|
| TWR-001 | `pi4-twr-001-key` |
| TWR-002 | `pi4-twr-002-key` |
| TWR-003 | `pi4-twr-003-key` |
| TWR-004 | `pi4-twr-004-key` |
| TWR-005 | `pi4-twr-005-key` |

---

## GPIO wiring

| BCM GPIO | Relay | Device |
|----------|-------|--------|
| 17 | Relay 1 | LED beacon |
| 27 | Relay 2 | Auxiliary |

---

## Test without relays

```bash
cd ~/scs-pi-agent
export SIMULATE_GPIO=true
export SIMULATE_BATTERY=true
export SCS_AGENT_ENV=./config.example.env
python3 -m venv venv && ./venv/bin/pip install -r requirements.txt
./venv/bin/python -m scs_agent.main
```

---

## Update code later

From PC:

```powershell
scp -r d:\SCS_Project\pi-agent pi@192.168.1.10:~/scs-pi-agent
ssh pi@192.168.1.10 "cd ~/scs-pi-agent && sudo ./install.sh && sudo systemctl restart scs-agent"
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Permission denied (publickey)` | Enable SSH; use correct user/password |
| MQTT not connected | Check `MQTT_HOST`, firewall, Mosquitto running on control PC |
| Telemetry 401 | `DEVICE_KEY` must match server for that `TOWER_ID` |
| GPIO error | Run as service (root); check wiring; try `SIMULATE_GPIO=true` |
| `rsync not found` on Pi | `sudo apt install rsync` or re-run install (uses `cp` fallback) |
