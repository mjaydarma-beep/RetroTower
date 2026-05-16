#!/bin/bash
# Quick CLI debug — no web server (run on Pi)
set -euo pipefail
cd /opt/scs-agent 2>/dev/null || cd "$(dirname "$0")"
export PYTHONPATH="${PYTHONPATH:-}:$(pwd)"
echo "=== SCS Agent CLI Debug ==="
/opt/scs-agent/venv/bin/python -c "
from scs_agent.debug_server import collect_status
import json
print(json.dumps(collect_status(), indent=2))
" 2>/dev/null || python3 -c "
from scs_agent.debug_server import collect_status
import json
print(json.dumps(collect_status(), indent=2))
"
