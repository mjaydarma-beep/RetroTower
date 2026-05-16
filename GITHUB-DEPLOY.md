# Deploy Pi agent from GitHub (pull updates)

Your repo: **[github.com/mjaydarma-beep/RetroTower](https://github.com/mjaydarma-beep/RetroTower)**

Yes — push code from your PC to GitHub; the Pi **pulls** the latest `pi-agent` folder. Simpler than zip upload each time.

> **Note:** GitHub does not push to the Pi by itself. The Pi must **pull** (`git pull`) on a schedule or after you run a script.

---

## Part 1 — Upload project to GitHub (on your PC)

The RetroTower repo is **empty** until you push from `d:\SCS_Project`.

### Push from your PC

```powershell
cd d:\SCS_Project
git init
git add .
git commit -m "Initial RetroTower SCS control system"
git branch -M main
git remote add origin https://github.com/mjaydarma-beep/RetroTower.git
git push -u origin main
```

If `git remote add` says origin already exists:

```powershell
git remote set-url origin https://github.com/mjaydarma-beep/RetroTower.git
git push -u origin main
```

If Git asks for login, use a **Personal Access Token** as the password ([GitHub tokens](https://github.com/settings/tokens)).

---

## Part 2 — Pi pulls and installs

### 1. One-time setup on the Pi (SSH)

```bash
sudo apt-get update
sudo apt-get install -y git

# Your repo URL (HTTPS or SSH)
export SCS_GIT_REPO="https://github.com/mjaydarma-beep/RetroTower.git"
export SCS_GIT_BRANCH="main"
export SCS_GIT_DIR="/home/manjula/scs-repo"
```

**First deploy on Pi** (after you pushed from PC):

```bash
git clone https://github.com/mjaydarma-beep/RetroTower.git ~/scs-repo
cd ~/scs-repo/pi-agent
chmod +x deploy-from-github.sh install.sh
export SCS_GIT_REPO="https://github.com/mjaydarma-beep/RetroTower.git"
./deploy-from-github.sh
```

`install.sh` keeps your existing `/etc/scs-agent.env`.

### 2. Update Pi after you change code on PC

On PC: commit and push:

```powershell
cd d:\SCS_Project
git add .
git commit -m "Describe your change"
git push
```

On Pi:

```bash
export SCS_GIT_REPO="https://github.com/mjaydarma-beep/RetroTower.git"
~/scs-repo/pi-agent/deploy-from-github.sh
```

Or:

```bash
cd ~/scs-repo && git pull && cd pi-agent && sudo ./install.sh && sudo systemctl restart scs-agent
```

---

## Part 3 — Automatic updates every 5 minutes (optional)

On the Pi:

```bash
sudo nano /etc/scs-agent.env
```

Add:

```env
SCS_GIT_REPO=https://github.com/mjaydarma-beep/RetroTower.git
SCS_GIT_BRANCH=main
```

Create timer:

```bash
sudo tee /etc/systemd/system/scs-git-pull.service << 'EOF'
[Unit]
Description=SCS pull pi-agent from GitHub
After=network-online.target

[Service]
Type=oneshot
User=manjula
EnvironmentFile=/etc/scs-agent.env
ExecStart=/home/manjula/scs-repo/pi-agent/deploy-from-github.sh
EOF

sudo tee /etc/systemd/system/scs-git-pull.timer << 'EOF'
[Unit]
Description=SCS Git pull every 5 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min

[Install]
WantedBy=timers.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now scs-git-pull.timer
```

Check: `systemctl list-timers | grep scs-git`

---

## What gets updated / what does not

| Updated from GitHub | Stays on Pi |
|---------------------|-------------|
| `/opt/scs-agent/*.py` | `/etc/scs-agent.env` |
| `install.sh`, scripts | Wi-Fi, passwords, `API_URL` |

---

## Private repo on Pi

Use a **deploy key** or **PAT**:

```bash
git clone https://YOUR_TOKEN@github.com/mjaydarma-beep/RetroTower.git ~/scs-repo
```

Or SSH key: [GitHub SSH keys](https://docs.github.com/en/authentication/connecting-to-github-with-ssh).

---

## Workflow summary

```text
PC: edit code → git push → GitHub
                              ↓
Pi: timer or manual → git pull → install.sh → restart scs-agent
```

Server/dashboard runs on your **PC** — deploy that separately (`npm start`) or host on another machine; the Pi only needs the `pi-agent` folder.
