# Run tower simulator on Windows (server must be running: cd server && npm start)
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

if (-not (Test-Path "venv")) {
  python -m venv venv
}
& .\venv\Scripts\pip install -q -r requirements.txt

if (Test-Path ".env") {
  Get-Content ".env" | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
      [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim().Trim('"'), "Process")
    }
  }
}

if (-not $env:API_URL) { $env:API_URL = "http://127.0.0.1:3001" }
Write-Host "Sending telemetry to $env:API_URL (Ctrl+C to stop)"
& .\venv\Scripts\python.exe tower_sim.py
