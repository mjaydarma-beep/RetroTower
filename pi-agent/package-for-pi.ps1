# Create pi-agent.zip for USB copy or upload to Raspberry Pi
$src = $PSScriptRoot
$zip = Join-Path (Split-Path $src -Parent) "pi-agent-upload.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
$temp = Join-Path $env:TEMP "pi-agent-pack"
if (Test-Path $temp) { Remove-Item $temp -Recurse -Force }
Copy-Item $src $temp -Recurse -Exclude @('venv', '__pycache__', '*.pyc', '.git')
Compress-Archive -Path "$temp\*" -DestinationPath $zip -Force
Remove-Item $temp -Recurse -Force
Write-Host "Created: $zip"
Write-Host "Copy this zip to the Pi, then: unzip pi-agent-upload.zip && cd pi-agent && sudo ./install.sh"
