#!/bin/bash
# SCS Tower Agent — install on Raspberry Pi 4 (Raspberry Pi OS Bookworm 64-bit)
set -euo pipefail

INSTALL_DIR="/opt/scs-agent"
ENV_FILE="/etc/scs-agent.env"
SERVICE_NAME="scs-agent"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo ./install.sh"
  exit 1
fi

echo "=== SCS Pi Agent Install ==="

apt-get update -qq
apt-get install -y python3 python3-venv python3-pip git rsync

mkdir -p "$INSTALL_DIR"

# Copy agent files (run this script from the pi-agent folder on the Pi)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if command -v rsync >/dev/null 2>&1; then
  rsync -a --exclude venv --exclude __pycache__ "$SCRIPT_DIR/" "$INSTALL_DIR/"
else
  cp -a "$SCRIPT_DIR/." "$INSTALL_DIR/"
  rm -rf "$INSTALL_DIR/venv" "$INSTALL_DIR/__pycache__" 2>/dev/null || true
fi

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$INSTALL_DIR/config.example.env" "$ENV_FILE"
  echo "Created $ENV_FILE — edit tower ID, MQTT, API URL, GPIO pins"
else
  echo "Keeping existing $ENV_FILE"
fi

python3 -m venv "$INSTALL_DIR/venv"
"$INSTALL_DIR/venv/bin/pip" install --upgrade pip
"$INSTALL_DIR/venv/bin/pip" install -r "$INSTALL_DIR/requirements.txt"

# Passwordless reboot for agent only
echo "root ALL=(ALL) NOPASSWD: /sbin/reboot" > /etc/sudoers.d/scs-agent-reboot
chmod 440 /etc/sudoers.d/scs-agent-reboot

cp "$INSTALL_DIR/scs-agent.service" "/etc/systemd/system/${SERVICE_NAME}.service"
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"

echo ""
echo "=== Install complete ==="
echo "1. Edit config:  sudo nano $ENV_FILE"
echo "2. Start agent:  sudo systemctl start $SERVICE_NAME"
echo "3. View logs:    sudo journalctl -u $SERVICE_NAME -f"
echo "4. Status:       sudo systemctl status $SERVICE_NAME"
