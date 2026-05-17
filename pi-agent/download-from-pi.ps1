# Download pi-agent from Raspberry Pi (reverse of upload-to-my-pi.ps1)
# Usage: .\download-from-pi.ps1
# Pulls /opt/scs-agent (installed), optional ~/scs-pi-agent, and /etc/scs-agent.env

$PiHost = "192.168.1.20"
$PiUser = "manjula"
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$Stamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$DestDir = Join-Path $ProjectRoot "pi-agent-from-pi-$Stamp"

$password = Read-Host "Pi password for $PiUser@$PiHost" -AsSecureString
$cred = New-Object System.Management.Automation.PSCredential($PiUser, $password)

if (-not (Get-Module -ListAvailable -Name Posh-SSH)) {
    Write-Host "Installing Posh-SSH module (one time)..."
    Install-Module Posh-SSH -Force -Scope CurrentUser
}
Import-Module Posh-SSH

$remotePack = @'
set -e
cd ~
rm -f scs-agent-backup.tar.gz scs-agent.env.backup scs-pi-agent-home.tar.gz
echo "Packing /opt/scs-agent (installed agent)..."
sudo tar czf ~/scs-agent-backup.tar.gz -C /opt/scs-agent \
  --exclude=venv \
  scs_agent requirements.txt install.sh scs-agent.service config.example.env \
  run-sim.sh hotfix-on-pi.sh debug-status.sh deploy-from-github.sh package-for-pi.ps1 2>/dev/null \
  || sudo tar czf ~/scs-agent-backup.tar.gz -C /opt/scs-agent --exclude=venv scs_agent requirements.txt install.sh
sudo chown $USER:$USER ~/scs-agent-backup.tar.gz
if [ -f /etc/scs-agent.env ]; then
  echo "Copying /etc/scs-agent.env..."
  sudo cp /etc/scs-agent.env ~/scs-agent.env.backup
  sudo chown $USER:$USER ~/scs-agent.env.backup
fi
if [ -d ~/scs-pi-agent ]; then
  echo "Packing ~/scs-pi-agent (home copy)..."
  tar czf ~/scs-pi-agent-home.tar.gz -C ~ scs-pi-agent --exclude=venv --exclude=__pycache__ 2>/dev/null || true
fi
echo "--- Files ready on Pi ---"
ls -lh ~/scs-agent-backup.tar.gz ~/scs-agent.env.backup ~/scs-pi-agent-home.tar.gz 2>/dev/null || true
'@

Write-Host "Connecting to ${PiUser}@${PiHost} and creating archives on Pi..."
$session = New-SSHSession -ComputerName $PiHost -Credential $cred -AcceptKey
if (-not $session) {
    Write-Error "SSH connection failed. Check IP, user, password, and that SSH is enabled on the Pi."
    exit 1
}

try {
    $result = Invoke-SSHCommand -SessionId $session.SessionId -Command $remotePack -TimeOut 120
    if ($result.Output) { Write-Host $result.Output }
    if ($result.Error) { Write-Host $result.Error -ForegroundColor Yellow }
    if ($result.ExitStatus -ne 0) {
        Write-Warning "Remote pack command exit code: $($result.ExitStatus)"
    }

    New-Item -ItemType Directory -Force -Path $DestDir | Out-Null
    $installedDir = Join-Path $DestDir "installed-opt-scs-agent"
    $homeDir = Join-Path $DestDir "home-scs-pi-agent"
    New-Item -ItemType Directory -Force -Path $installedDir | Out-Null

    Write-Host "Downloading to $DestDir ..."
    Get-SCPItem -SessionId $session.SessionId -Path "/home/$PiUser/scs-agent-backup.tar.gz" -Destination $DestDir -AcceptKey

    $envRemote = "/home/$PiUser/scs-agent.env.backup"
    $envCheck = Invoke-SSHCommand -SessionId $session.SessionId -Command "test -f $envRemote && echo yes || echo no"
    if ($envCheck.Output -match "yes") {
        Get-SCPItem -SessionId $session.SessionId -Path $envRemote -Destination $DestDir -AcceptKey
        Rename-Item -Path (Join-Path $DestDir "scs-agent.env.backup") -NewName "scs-agent.env.backup.txt" -ErrorAction SilentlyContinue
    }

    $homeCheck = Invoke-SSHCommand -SessionId $session.SessionId -Command "test -f /home/$PiUser/scs-pi-agent-home.tar.gz && echo yes || echo no"
    if ($homeCheck.Output -match "yes") {
        Get-SCPItem -SessionId $session.SessionId -Path "/home/$PiUser/scs-pi-agent-home.tar.gz" -Destination $DestDir -AcceptKey
        New-Item -ItemType Directory -Force -Path $homeDir | Out-Null
        tar -xzf (Join-Path $DestDir "scs-pi-agent-home.tar.gz") -C $homeDir
    }

    $mainTar = Join-Path $DestDir "scs-agent-backup.tar.gz"
    if (Test-Path $mainTar) {
        tar -xzf $mainTar -C $installedDir
        Write-Host "Extracted installed agent -> $installedDir"
    } else {
        Write-Error "scs-agent-backup.tar.gz not found after download."
        exit 1
    }

    Write-Host ""
    Write-Host "Download complete." -ForegroundColor Green
    Write-Host "  Folder:     $DestDir"
    Write-Host "  Installed:  $installedDir\scs_agent\  (from /opt/scs-agent)"
    if (Test-Path $homeDir) {
        Write-Host "  Home copy:  $homeDir\scs-pi-agent\  (from ~/scs-pi-agent, if present)"
    }
    $envFile = Get-ChildItem -Path $DestDir -Filter "scs-agent.env.backup*" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($envFile) {
        Write-Host "  Config:     $($envFile.FullName)  (DO NOT commit to Git)"
    }
    Write-Host ""
    Write-Host "Next: compare with D:\SCS_Project\pi-agent\ and merge your Pi changes into the repo."
    Write-Host "  e.g. WinMerge or: code --diff pi-agent\scs_agent pi-agent-from-pi-*\installed-opt-scs-agent\scs_agent"
}
finally {
    Remove-SSHSession -SessionId $session.SessionId | Out-Null
}
