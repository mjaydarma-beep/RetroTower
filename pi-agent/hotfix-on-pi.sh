#!/bin/bash
# Run on the Raspberry Pi (fixes crash-loop from blocking MQTT connect)
set -euo pipefail

MQTT="/opt/scs-agent/scs_agent/mqtt_client.py"
MAIN="/opt/scs-agent/scs_agent/main.py"
CONFIG="/opt/scs-agent/scs_agent/config.py"
ENV="/etc/scs-agent.env"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run: sudo bash hotfix-on-pi.sh"
  exit 1
fi

if grep -q connect_async "$MQTT" 2>/dev/null; then
  echo "mqtt_client.py already has connect_async"
else
  echo "Patching $MQTT ..."
  cp "$MQTT" "${MQTT}.bak.$(date +%s)"
  python3 << 'PY'
from pathlib import Path
p = Path("/opt/scs-agent/scs_agent/mqtt_client.py")
text = p.read_text()
if "connect_async" in text:
    print("already patched")
    raise SystemExit(0)
if "self._client.connect(" not in text:
    print("ERROR: unexpected mqtt_client.py — copy new files from PC instead")
    raise SystemExit(1)
text = text.replace("self._client.connect(", "self._client.connect_async(", 1)
old_def = "    def connect(self) -> None:"
new_def = "    def connect(self) -> bool:"
if old_def in text:
    text = text.replace(old_def, new_def, 1)
    text = text.replace(
        "        self._client.loop_start()",
        """        try:
            self._client.reconnect_delay_set(min_delay=2, max_delay=60)
            self._client.loop_start()
            return True
        except Exception as exc:
            log.error("MQTT setup failed: %s", exc)
            return False""",
        1,
    )
p.write_text(text)
print("mqtt_client.py patched")
PY
fi

# Ensure env has PC API (user should edit IP if needed)
grep -q '^MQTT_ENABLED=' "$ENV" || echo 'MQTT_ENABLED=false' >> "$ENV"
sed -i 's/^MQTT_ENABLED=.*/MQTT_ENABLED=false/' "$ENV" 2>/dev/null || true

grep -q '^DEVICE_KEY=pi4-twr-001-key' "$ENV" || {
  if grep -q '^DEVICE_KEY=change-me' "$ENV" || ! grep -q '^DEVICE_KEY=.' "$ENV"; then
    echo "WARNING: set DEVICE_KEY=pi4-twr-001-key in $ENV"
  fi
}

systemctl restart scs-agent
sleep 2
systemctl status scs-agent --no-pager || true
echo ""
journalctl -u scs-agent -n 15 --no-pager
