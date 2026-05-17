# Test Pi-downloaded agent against local SCS server (http://localhost:3001)
# Usage: .\run-sim-local.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$env:SCS_AGENT_ENV = Join-Path $PSScriptRoot "config.local.env"
$env:SIMULATE_GPIO = "true"
$env:SIMULATE_BATTERY = "true"
$env:ENABLE_RUT_SIGNAL = "false"

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Error "Python not found. Install Python 3.10+ and try again."
}

if (-not (Test-Path "venv\Scripts\python.exe")) {
    Write-Host "Creating venv and installing requirements..."
    python -m venv venv
    & .\venv\Scripts\pip install -q -r requirements.txt
}

Write-Host "Agent -> http://127.0.0.1:3001  tower TWR-001  (Ctrl+C to stop)"
Write-Host "Dashboard: http://localhost:3001  login: operator / scs-operator"
& .\venv\Scripts\python.exe -m scs_agent.main
