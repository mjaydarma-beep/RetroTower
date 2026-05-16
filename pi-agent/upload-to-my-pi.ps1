# Upload pi-agent to your Raspberry Pi
# Usage: .\upload-to-my-pi.ps1
# You will be prompted for the Pi password.

$PiHost = "192.168.1.20"
$PiUser = "manjula"
$ZipPath = "d:\SCS_Project\pi-agent-upload.zip"

if (-not (Test-Path $ZipPath)) {
    Write-Host "Creating zip..."
    & "$PSScriptRoot\package-for-pi.ps1"
}

$password = Read-Host "Pi password for $PiUser@$PiHost" -AsSecureString
$cred = New-Object System.Management.Automation.PSCredential($PiUser, $password)

if (-not (Get-Module -ListAvailable -Name Posh-SSH)) {
    Write-Host "Installing Posh-SSH module (one time)..."
    Install-Module Posh-SSH -Force -Scope CurrentUser
}
Import-Module Posh-SSH

Write-Host "Uploading $ZipPath to $PiUser@${PiHost}:~/ ..."
Set-SCPItem -ComputerName $PiHost -Credential $cred -Path $ZipPath -Destination "/home/$PiUser/" -AcceptKey

Write-Host ""
Write-Host "Upload done. Now run on the Pi:"
Write-Host "  ssh ${PiUser}@${PiHost}"
Write-Host "  unzip -o ~/pi-agent-upload.zip -d ~/scs-pi-agent"
Write-Host "  cd ~/scs-pi-agent && grep -q connect_async scs_agent/mqtt_client.py && echo OK-new-agent || echo OLD-zip-reupload"
Write-Host "  cd ~/scs-pi-agent && chmod +x install.sh && sudo ./install.sh"
Write-Host "  sudo nano /etc/scs-agent.env"
Write-Host "  sudo systemctl start scs-agent"
