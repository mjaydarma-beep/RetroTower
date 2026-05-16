#!/bin/bash
# Run agent in simulation mode on Pi or PC (no GPIO hardware required)
export SCS_AGENT_ENV="$(dirname "$0")/config.example.env"
export SIMULATE_GPIO=true
export SIMULATE_BATTERY=true
export ENABLE_RUT_SIGNAL=false
cd "$(dirname "$0")"
python3 -m venv venv 2>/dev/null || true
./venv/bin/pip install -q -r requirements.txt 2>/dev/null || pip install -r requirements.txt
python3 -m scs_agent.main
