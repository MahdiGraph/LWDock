#!/usr/bin/env bash
# Leaseweb Dock installer for Linux servers (Debian, Ubuntu, CentOS, Rocky, Alma, Fedora…).
#
#   curl -fsSL https://raw.githubusercontent.com/MahdiGraph/LWDock/main/install.sh | sudo bash
#
# Environment overrides: INSTALL_DIR (default /opt/leaseweb-dock), PORT (default 3000).
# Running it again updates an existing installation and keeps your data.
set -euo pipefail

REPO_URL="https://github.com/MahdiGraph/LWDock.git"
INSTALL_DIR="${INSTALL_DIR:-/opt/leaseweb-dock}"
PORT="${PORT:-3000}"

say() { printf '\033[1m==>\033[0m %s\n' "$*"; }
fail() { printf '\033[31mError:\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "Run this as root, for example: curl -fsSL … | sudo bash"

install_pkg() {
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$@"
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y -q "$@"
  elif command -v yum >/dev/null 2>&1; then
    yum install -y -q "$@"
  else
    fail "Please install: $*"
  fi
}

command -v git >/dev/null 2>&1 || { say "Installing git"; install_pkg git; }
command -v curl >/dev/null 2>&1 || { say "Installing curl"; install_pkg curl; }

if ! command -v docker >/dev/null 2>&1; then
  say "Installing Docker"
  if ! curl -fsSL https://get.docker.com | sh; then
    say "get.docker.com did not work, trying the distribution's Docker package"
    install_pkg docker.io || install_pkg docker || fail "Could not install Docker. Install it by hand and run this again."
  fi
fi
systemctl enable --now docker >/dev/null 2>&1 || true

# Leaseweb Dock needs Docker Compose v2, the "docker compose" plugin of the Docker CLI.
# The old standalone "docker-compose" 1.x is end-of-life and breaks on current Docker
# engines, so it is not used even when it is installed.
compose_ok() { docker compose version >/dev/null 2>&1; }

install_compose() {
  say "Installing the Docker Compose plugin"
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -qq >/dev/null 2>&1 || true
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq docker-compose-plugin >/dev/null 2>&1 \
      || DEBIAN_FRONTEND=noninteractive apt-get install -y -qq docker-compose-v2 >/dev/null 2>&1 \
      || true
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y -q docker-compose-plugin >/dev/null 2>&1 || true
  elif command -v yum >/dev/null 2>&1; then
    yum install -y -q docker-compose-plugin >/dev/null 2>&1 || true
  fi
  compose_ok && return 0

  # No package available: use the official binary from GitHub as a CLI plugin.
  local arch
  case "$(uname -m)" in
    x86_64 | amd64) arch=x86_64 ;;
    aarch64 | arm64) arch=aarch64 ;;
    armv7l | armv7) arch=armv7 ;;
    armv6l) arch=armv6 ;;
    ppc64le | s390x | riscv64) arch="$(uname -m)" ;;
    *) fail "There is no Docker Compose build for this CPU ($(uname -m))." ;;
  esac
  say "Downloading Docker Compose for $arch from GitHub"
  mkdir -p /usr/local/lib/docker/cli-plugins
  curl -fsSL --retry 3 -o /usr/local/lib/docker/cli-plugins/docker-compose \
    "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-${arch}" \
    && chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
}

compose_ok || install_compose
compose_ok || fail "Docker Compose v2 could not be installed. Follow https://docs.docker.com/compose/install/linux/ and run this again."
say "Using $(docker compose version)"

if [ -d "$INSTALL_DIR/.git" ]; then
  say "Updating $INSTALL_DIR"
  git -C "$INSTALL_DIR" pull --ff-only
else
  say "Downloading Leaseweb Dock into $INSTALL_DIR"
  git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
fi
cd "$INSTALL_DIR"

if [ ! -f .env ]; then
  say "Creating .env with a fresh secret"
  if command -v openssl >/dev/null 2>&1; then
    SECRET="$(openssl rand -hex 32)"
  else
    SECRET="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  fi
  umask 077
  printf 'PORT=%s\nAPP_SECRET=%s\nCOOKIE_SECURE=auto\n' "$PORT" "$SECRET" > .env
fi

if docker compose pull --quiet 2>/dev/null; then
  say "Starting the published image"
  docker compose up -d --remove-orphans
else
  say "No published image reachable, building from source (takes a few minutes)"
  docker compose up -d --build --remove-orphans || fail "The build failed. It needs Docker Hub and the npm registry; if either is blocked on this network, set a Docker registry mirror and NPM_REGISTRY in $INSTALL_DIR/.env, then run this again."
fi

PORT_IN_USE="$(grep -E '^PORT=' .env | cut -d= -f2)"
IP="$(curl -fsS4 --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')"
echo
say "Leaseweb Dock is running."
echo "    Open http://${IP:-your-server-ip}:${PORT_IN_USE:-3000} and create the admin account."
echo "    Put it behind HTTPS before sharing it (see the README)."
echo "    Update later with: cd $INSTALL_DIR && git pull && docker compose pull && docker compose up -d"
