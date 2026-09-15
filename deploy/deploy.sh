#!/usr/bin/env bash
# Single-command server bootstrap: git clone && ./deploy/deploy.sh && done.
# Installs deps, builds web + binary, installs systemd service, starts it.
set -euo pipefail

APP_DIR="/opt/flagsapi"
SRC_DIR="$APP_DIR/src"
SERVICE="flagsapi"

if [ "$(id -u)" -ne 0 ]; then
  echo "run as root (installs packages, writes /opt, enables systemd)"
  exit 1
fi

apt-get update
apt-get install -y git rsync curl
# Go toolchain
if ! command -v go >/dev/null; then
  GO_TAR=go1.22.5.linux-arm64.tar.gz
  [ "$(uname -m)" = "x86_64" ] && GO_TAR=go1.22.5.linux-amd64.tar.gz
  curl -fsSL "https://go.dev/dl/$GO_TAR" -o "/tmp/$GO_TAR"
  rm -rf /usr/local/go && tar -C /usr/local -xzf "/tmp/$GO_TAR"
  ln -sf /usr/local/go/bin/go /usr/local/bin/go
fi
# Node for the web build
if ! command -v node >/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

id -u flagstack >/dev/null 2>&1 || useradd -r -m -d /opt/flagstack flagstack
mkdir -p "$SRC_DIR" "$APP_DIR/assets" "$APP_DIR/bin"
rsync -a --delete --exclude node_modules --exclude .next --exclude bin ./ "$SRC_DIR/"
rsync -a ./assets/ "$APP_DIR/assets/"
chown -R flagstack:flagstack "$APP_DIR"

cd "$SRC_DIR"
export PATH="$PATH:/usr/local/go/bin"
make build-all
install -m 0755 bin/flagsapi "$APP_DIR/bin/flagsapi"
install -m 0644 deploy/flagsapi.service /etc/systemd/system/flagsapi.service
systemctl daemon-reload
systemctl enable --now "$SERVICE"
echo "done: systemctl status $SERVICE"
