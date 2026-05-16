#!/bin/bash
# Pull latest pi-agent from GitHub and install to /opt/scs-agent
# Setup once on Pi, then run manually or on a timer (see GITHUB-DEPLOY.md)
set -euo pipefail

if [[ -f /etc/scs-agent.env ]]; then
  set -a
  # shellcheck disable=SC1091
  source /etc/scs-agent.env
  set +a
fi

REPO_URL="${SCS_GIT_REPO:?Set SCS_GIT_REPO e.g. https://github.com/YOUR_USER/SCS_Project.git}"
BRANCH="${SCS_GIT_BRANCH:-main}"
CLONE_DIR="${SCS_GIT_DIR:-/home/manjula/scs-repo}"
INSTALL_DIR="/opt/scs-agent"

echo "=== SCS Pi deploy from GitHub ==="
echo "Repo: $REPO_URL ($BRANCH)"

if [[ ! -d "$CLONE_DIR/.git" ]]; then
  echo "Cloning..."
  git clone --branch "$BRANCH" "$REPO_URL" "$CLONE_DIR"
else
  echo "Pulling..."
  git -C "$CLONE_DIR" fetch origin
  git -C "$CLONE_DIR" checkout "$BRANCH"
  git -C "$CLONE_DIR" pull --ff-only origin "$BRANCH"
fi

PI_DIR="$CLONE_DIR/pi-agent"
if [[ ! -f "$PI_DIR/install.sh" ]]; then
  echo "ERROR: $PI_DIR/install.sh not found — check repo path"
  exit 1
fi

echo "Installing to $INSTALL_DIR (keeps /etc/scs-agent.env)..."
cd "$PI_DIR"
chmod +x install.sh deploy-from-github.sh debug-status.sh 2>/dev/null || true
sudo ./install.sh

echo "Restarting agent..."
sudo systemctl restart scs-agent
sudo systemctl status scs-agent --no-pager || true
echo "Done. Commit: $(git -C "$CLONE_DIR" rev-parse --short HEAD)"
