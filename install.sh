#!/usr/bin/env bash
# Leaseweb Dock installer for Linux servers (Debian, Ubuntu, CentOS, Rocky, Alma, Fedora…).
#
#   curl -fsSL https://raw.githubusercontent.com/MahdiGraph/LWDock/main/install.sh | sudo bash
#
# It asks where the panel should listen (all addresses, or 127.0.0.1 behind your own
# reverse proxy) and on which port, suggesting a free one. To skip the questions, set
# LISTEN_ADDRESS (0.0.0.0 or 127.0.0.1) and PORT. INSTALL_DIR defaults to /opt/leaseweb-dock.
# Running it again updates an existing installation and keeps your data.
set -euo pipefail

REPO_URL="https://github.com/MahdiGraph/LWDock.git"
INSTALL_DIR="${INSTALL_DIR:-/opt/leaseweb-dock}"
WANT_ADDRESS="${LISTEN_ADDRESS:-}"
WANT_PORT="${PORT:-}"
CONTAINER="leaseweb-dock"

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
  (umask 077 && printf 'PORT=3000\nAPP_SECRET=%s\nCOOKIE_SECURE=auto\n' "$SECRET" > .env)
fi

# ---------------------------------------------------------------- listen address and port

# True when something other than our own container listens on the port.
port_busy() {
  local p="$1"
  if docker port "$CONTAINER" 2>/dev/null | grep -qE ":$p\$"; then return 1; fi
  if command -v ss >/dev/null 2>&1; then
    ss -ltn 2>/dev/null | awk 'NR > 1 { print $4 }' | grep -qE ":$p\$"
  else
    (exec 3<>"/dev/tcp/127.0.0.1/$p") 2>/dev/null
  fi
}

random_free_port() {
  local p _
  for _ in $(seq 1 200); do
    p=$((20000 + RANDOM % 40000))
    port_busy "$p" || { echo "$p"; return 0; }
  done
  fail "Could not find a free port. Run again with PORT=<port>."
}

valid_port() { [[ "$1" =~ ^[0-9]+$ ]] && [ "$1" -ge 1 ] && [ "$1" -le 65535 ]; }

# The current value in .env is either "3000" or "127.0.0.1:3000".
CURRENT="$(grep -E '^PORT=' .env | tail -1 | cut -d= -f2- || true)"
CURRENT_PORT="${CURRENT##*:}"
CURRENT_ADDRESS="0.0.0.0"
[[ "$CURRENT" == *:* ]] && CURRENT_ADDRESS="${CURRENT%:*}"
valid_port "${CURRENT_PORT:-x}" || CURRENT_PORT=3000

if port_busy "$CURRENT_PORT"; then SUGGESTED_PORT="$(random_free_port)"; else SUGGESTED_PORT="$CURRENT_PORT"; fi

ADDRESS="$WANT_ADDRESS"
LISTEN_PORT="$WANT_PORT"

if (exec </dev/tty) 2>/dev/null; then
  if [ -z "$ADDRESS" ]; then
    echo
    echo "Where should the panel listen?"
    echo "  1) On all addresses: open it directly at http://SERVER-IP:PORT"
    echo "  2) On 127.0.0.1 only: you put Caddy, nginx or another reverse proxy in front of it"
    DEFAULT_CHOICE=1
    [ "$CURRENT_ADDRESS" = "127.0.0.1" ] && DEFAULT_CHOICE=2
    while [ -z "$ADDRESS" ]; do
      read -r -p "Choose 1 or 2 [$DEFAULT_CHOICE]: " CHOICE </dev/tty || CHOICE=""
      case "${CHOICE:-$DEFAULT_CHOICE}" in
        1) ADDRESS="0.0.0.0" ;;
        2) ADDRESS="127.0.0.1" ;;
        *) echo "Please type 1 or 2." ;;
      esac
    done
  fi
  while [ -z "$LISTEN_PORT" ]; do
    read -r -p "Port [$SUGGESTED_PORT]: " ANSWER </dev/tty || ANSWER=""
    ANSWER="${ANSWER:-$SUGGESTED_PORT}"
    if ! valid_port "$ANSWER"; then
      echo "Type a number between 1 and 65535."
    elif port_busy "$ANSWER"; then
      echo "Port $ANSWER is already in use on this server. Pick another one."
    else
      LISTEN_PORT="$ANSWER"
    fi
  done
fi

ADDRESS="${ADDRESS:-$CURRENT_ADDRESS}"
LISTEN_PORT="${LISTEN_PORT:-$SUGGESTED_PORT}"
valid_port "$LISTEN_PORT" || fail "PORT must be a number between 1 and 65535."
port_busy "$LISTEN_PORT" && fail "Port $LISTEN_PORT is already in use on this server. Run again and pick another port."

if [ "$ADDRESS" = "0.0.0.0" ]; then VALUE="$LISTEN_PORT"; else VALUE="$ADDRESS:$LISTEN_PORT"; fi
if grep -qE '^PORT=' .env; then
  sed -i "s|^PORT=.*|PORT=$VALUE|" .env
else
  printf 'PORT=%s\n' "$VALUE" >> .env
fi
say "Listening on $ADDRESS:$LISTEN_PORT"

# ---------------------------------------------------------------- start

if docker compose pull --quiet 2>/dev/null; then
  say "Starting the published image"
  docker compose up -d --remove-orphans
else
  say "No published image reachable, building from source (takes a few minutes)"
  docker compose up -d --build --remove-orphans || fail "The build failed. It needs Docker Hub and the npm registry; if either is blocked on this network, set a Docker registry mirror and NPM_REGISTRY in $INSTALL_DIR/.env, then run this again."
fi

echo
say "Leaseweb Dock is running."
if [ "$ADDRESS" = "0.0.0.0" ]; then
  IP="$(curl -fsS4 --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')"
  echo "    Open http://${IP:-your-server-ip}:$LISTEN_PORT and create the admin account right away."
  echo "    Put it behind HTTPS before sharing it (see the README)."
else
  echo "    It listens on $ADDRESS:$LISTEN_PORT. Point your reverse proxy at that address, for example in Caddy:"
  echo
  echo "        dock.example.com {"
  echo "            reverse_proxy $ADDRESS:$LISTEN_PORT"
  echo "        }"
  echo
  echo "    Then open your domain and create the admin account right away."
fi
echo "    Update later by running this installer again."
