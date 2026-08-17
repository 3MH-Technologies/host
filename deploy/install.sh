#!/usr/bin/env bash
# 3MH Host Automated Production Server Provisioning & Setup Script
# Usage: sudo bash deploy/install.sh

set -euo pipefail

echo "=========================================================="
echo "    3MH Host Zero-Trust Production Deployment Setup       "
echo "=========================================================="

if [ "$EUID" -ne 0 ]; then
  echo "[!] Please run this script as root (sudo bash deploy/install.sh)."
  exit 1
fi

INSTALL_DIR="/opt/3mh-host"

echo "[1/6] Installing Linux System Dependencies & Security Tools..."
apt-get update -qq
apt-get install -y -qq \
  curl \
  wget \
  git \
  unzip \
  nftables \
  iptables \
  lsof \
  jq \
  caddy

echo "[2/6] Installing Bun JavaScript Runtime..."
if ! command -v bun &> /dev/null; then
  curl -fsSL https://bun.sh/install | bash
  cp ~/.bun/bin/bun /usr/local/bin/bun
fi

echo "[3/6] Installing gVisor (runsc) Sandbox Container Runtime..."
if ! command -v runsc &> /dev/null; then
  ARCH=$(uname -m)
  URL="https://storage.googleapis.com/gvisor/releases/release/latest/${ARCH}"
  wget -q "${URL}/runsc" -O /usr/local/bin/runsc
  wget -q "${URL}/containerd-shim-runsc-v1" -O /usr/local/bin/containerd-shim-runsc-v1
  chmod +x /usr/local/bin/runsc /usr/local/bin/containerd-shim-runsc-v1

  # Configure Docker to use runsc runtime
  mkdir -p /etc/docker
  if [ -f /etc/docker/daemon.json ]; then
    cp /etc/docker/daemon.json /etc/docker/daemon.json.bak
  fi
  cat << EOF > /etc/docker/daemon.json
{
  "runtimes": {
    "runsc": {
      "path": "/usr/local/bin/runsc"
    }
  }
}
EOF
  systemctl restart docker || true
fi

echo "[4/6] Setting up Zero-Trust Firewall (nftables)..."
mkdir -p /etc/3mh/seccomp /etc/3mh/network
cp security/seccomp/strict-sandbox.json /etc/3mh/seccomp/
cp security/network/nftables-zero-trust.conf /etc/3mh/network/
nft -f /etc/3mh/network/nftables-zero-trust.conf || true

echo "[5/6] Building Application & Installing Dependencies..."
if [ ! -f .env ]; then
  cp deploy/production.env.example .env
  echo "[!] Created default .env file from deploy/production.env.example. Please update secret keys!"
fi

bun install
npx prisma db push
bun run build

echo "[6/6] Registering Systemd Production Services..."
cp deploy/3mh-host.service /etc/systemd/system/
cp deploy/3mh-process-manager.service /etc/systemd/system/
cp deploy/3mh-terminal-service.service /etc/systemd/system/
cp security/systemd/3mh-tenant-sandbox@.service /etc/systemd/system/

systemctl daemon-reload
systemctl enable 3mh-host 3mh-process-manager 3mh-terminal-service
systemctl restart 3mh-process-manager 3mh-terminal-service 3mh-host

echo "=========================================================="
echo " [✓] 3MH Host Production Server successfully deployed!"
echo "     Main Application Port: 3000"
echo "     Process Manager Port: 3001"
echo "     Terminal Service Port: 3002"
echo "=========================================================="
