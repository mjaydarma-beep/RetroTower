# SCS Tower Agent — Raspberry Pi 4

Python service that runs on each **remote tower** Raspberry Pi 4. It controls:

- **GPIO relays** — beacon (BCM17) and auxiliary (BCM27)
- **LED board** — messages via **MQTT**
- **Telemetry** — battery, VPN/router signal, camera status → control center API
- **Commands** — evacuation, stop alerts, reboot (via MQTT and HTTP)

SIP announcements are played by the **control-center phone system** calling the tower speaker; the Pi logs announcement commands only.

---

## Hardware wiring (example)

| Pi GPIO (BCM) | Relay module | Load |
|---------------|--------------|------|
| 17 | Relay 1 | LED beacon |
| 27 | Relay 2 | Auxiliary (siren/strobe) |

Use a **3.3 V relay board** with opto-isolation. Connect Pi ground to relay ground.

---

## How to load the agent onto the Raspberry Pi

### What you need

- Raspberry Pi 4 with **Raspberry Pi OS Lite 64-bit** (Bookworm)
- Network: Ethernet to **Teltonika RUT** (VPN to control center)
- This `pi-agent` folder copied to the Pi
- Control center **MQTT broker** and **API** reachable over VPN (e.g. `10.8.0.1`)

---

### Step 1 — Prepare the Pi

On the Pi (SSH or keyboard):

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git python3 python3-venv rsync
sudo raspi-config
# Optional: Interface Options → I2C → Enable (if using INA219 battery sensor)
```

---

### Step 2 — Copy `pi-agent` to the Pi

**Option A — USB / SCP from your PC**

From Windows (PowerShell), in the folder that contains `pi-agent`:

```powershell
scp -r d:\SCS_Project\pi-agent pi@192.168.1.10:~/scs-pi-agent
```

Replace `192.168.1.10` with the Pi’s IP on the tower LAN.

**Option B — Git clone** (if you push the repo to GitHub)

```bash
git clone <your-repo-url> ~/scs-pi-agent
cd ~/scs-pi-agent/pi-agent
```

---

### Step 3 — Configure the tower

```bash
cd ~/scs-pi-agent
cp config.example.env config.env
nano config.env
```

Set at minimum:

| Variable | Example | Meaning |
|----------|---------|---------|
| `TOWER_ID` | `tower-001` | Unique tower ID |
| `TOWER_NAME` | `North Perimeter Tower` | Display name |
| `API_URL` | `http://10.8.0.1:3001` | Control center API over VPN |
| `DEVICE_KEY` | *(secret from admin)* | Must match server |
| `MQTT_HOST` | `10.8.0.1` | MQTT broker over VPN |
| `LED_BOARD_TOPIC` | `scs/towers/tower-001/led/display` | LED board MQTT topic |
| `GPIO_RELAY_BEACON` | `17` | BCM pin |
| `GPIO_RELAY_AUX` | `27` | BCM pin |
| `CAMERA_RTSP_URL` | `rtsp://192.168.1.50/stream` | Local camera URL |

For **first test without control center**, set:

```bash
SIMULATE_GPIO=true
SIMULATE_BATTERY=true
MQTT_HOST=127.0.0.1   # or your PC IP if Mosquitto runs there
```

---

### Step 4 — Install and enable service

```bash
cd ~/scs-pi-agent
chmod +x install.sh
sudo ./install.sh
```

The installer:

- Copies files to `/opt/scs-agent`
- Creates `/etc/scs-agent.env` (if missing)
- Creates Python virtualenv and installs dependencies
- Installs **systemd** service `scs-agent`
- Enables start on boot

Edit production config:

```bash
sudo nano /etc/scs-agent.env
```

---

### Step 5 — Start and verify

```bash
sudo systemctl start scs-agent
sudo systemctl status scs-agent
sudo journalctl -u scs-agent -f
```

You should see:

- `Starting SCS agent tower=tower-001`
- `MQTT connected` (if broker is up)
- Periodic telemetry (or warnings if API not deployed yet)

---

### Step 6 — Test MQTT commands

With Mosquitto on the control center (replace host and tower ID):

```bash
# LED message
mosquitto_pub -h 10.8.0.1 -t "scs/towers/tower-001/cmd/led_message" \
  -m '{"text":"TEST MESSAGE"}'

# Beacon flash
mosquitto_pub -h 10.8.0.1 -t "scs/towers/tower-001/cmd/beacon_flash" \
  -m '{"intervalMs":500}'

# Stop all
mosquitto_pub -h 10.8.0.1 -t "scs/towers/tower-001/cmd/stop_alerts" -m '{}'
```

---

## Simulation mode (no relays connected)

```bash
cd ~/scs-pi-agent
chmod +x run-sim.sh
./run-sim.sh
```

Or:

```bash
export SIMULATE_GPIO=true SIMULATE_BATTERY=true
export SCS_AGENT_ENV=./config.example.env
python3 -m scs_agent.main
```

---

## MQTT topic reference

| Topic | Direction | Purpose |
|-------|-----------|---------|
| `scs/towers/{id}/cmd/led_message` | → Pi | `{"text":"..."}` |
| `scs/towers/{id}/cmd/beacon_on` | → Pi | Beacon relay ON |
| `scs/towers/{id}/cmd/beacon_off` | → Pi | Beacon OFF |
| `scs/towers/{id}/cmd/beacon_flash` | → Pi | `{"intervalMs":500}` |
| `scs/towers/{id}/cmd/evacuation` | → Pi | Full evacuation sequence |
| `scs/towers/{id}/cmd/stop_alerts` | → Pi | All off |
| `scs/towers/{id}/cmd/reboot` | → Pi | Reboot Pi |
| `scs/towers/{id}/led/display` | Pi → LED | LED board payload |
| `scs/towers/{id}/status/led` | Pi → | Status feedback |
| `scs/towers/{id}/status/relays` | Pi → | Relay state |

---

## Teltonika RUT signal (optional)

Set in `/etc/scs-agent.env`:

```bash
ENABLE_RUT_SIGNAL=true
RUT_API_URL=http://192.168.1.1
RUT_API_USER=admin
RUT_API_PASSWORD=your-rut-password
```

The Pi polls the RUT HTTP API and reports RSSI in telemetry. Exact API path may vary by RUT model/firmware — adjust `rut_signal.py` if needed.

---

## INA219 battery sensor (optional)

```bash
sudo apt install -y python3-dev
ENABLE_INA219=true
SIMULATE_BATTERY=false
```

Wire INA219 to Pi I2C (SDA/SCL). Enable I2C in `raspi-config`.

---

## Service management

| Command | Action |
|---------|--------|
| `sudo systemctl start scs-agent` | Start |
| `sudo systemctl stop scs-agent` | Stop |
| `sudo systemctl restart scs-agent` | Restart after config change |
| `sudo systemctl enable scs-agent` | Start on boot |
| `sudo journalctl -u scs-agent -f` | Live logs |

---

## Troubleshooting

| Problem | Check |
|---------|--------|
| MQTT not connecting | VPN up? `ping 10.8.0.1` · broker port 1883 open? |
| GPIO permission denied | Run as root (service does) · user in `gpio` group |
| Telemetry 404 | Control center API not deployed yet — MQTT still works |
| Reboot command fails | `/etc/sudoers.d/scs-agent-reboot` installed by `install.sh` |
| LED board no display | Confirm `LED_BOARD_TOPIC` matches board subscription |

---

## File layout

```
pi-agent/
├── install.sh           # Run on Pi with sudo
├── scs-agent.service    # systemd unit
├── config.example.env   # Template → /etc/scs-agent.env
├── requirements.txt
├── run-sim.sh           # Local simulation
└── scs_agent/
    ├── main.py          # Entry point
    ├── gpio_control.py
    ├── mqtt_client.py
    ├── telemetry.py
    ├── commands.py
    ├── battery.py
    └── rut_signal.py
```

---

## Next step

Deploy the **control center** (API + MQTT + dashboard) so telemetry and dashboard commands work end-to-end. Say **execute the plan** in Cursor to build the full stack.
