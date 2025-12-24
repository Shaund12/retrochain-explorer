#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/retrochain/retrochain-explorer"
BACKUP_DIR="/home/retrochain/retrochain-explorer.backups"
SERVICE_NAME="retrochain-explorer.service"
EXPLORER_REPO_URL="https://github.com/Shaund12/retrochain-explorer"
WEB_ROOT="/var/www/retrochain-explorer"

echo "===> Updating RetroChain Explorer from Git"
echo "     App dir: ${APP_DIR}"
echo

if [[ ! -d "${APP_DIR}" ]]; then
  echo "===> ${APP_DIR} does not exist; will clone ${EXPLORER_REPO_URL}"
  sudo -u retrochain mkdir -p "${APP_DIR%/*}"
  sudo -u retrochain git clone "${EXPLORER_REPO_URL}" "${APP_DIR}"
fi

# -------------------------------------------------------------------
# 0) Ensure Vite preview service is OFF (you said you don't want it)
# -------------------------------------------------------------------
if systemctl list-units --type=service --all | grep -q "^  ${SERVICE_NAME}"; then
  echo "===> Disabling Vite preview service: ${SERVICE_NAME}"
  sudo systemctl stop "${SERVICE_NAME}" || true
  sudo systemctl disable "${SERVICE_NAME}" || true
  sudo systemctl daemon-reload || true
else
  echo "===> No ${SERVICE_NAME} unit found (ok)"
fi

# -------------------------------------------------------------------
# 1) Backup (exclude huge/unnecessary folders)
# -------------------------------------------------------------------
echo
echo "===> Creating backup of current explorer directory (as retrochain)"
sudo -u retrochain bash << 'INNER_BACKUP'
set -euo pipefail
APP_DIR="/home/retrochain/retrochain-explorer"
BACKUP_DIR="/home/retrochain/retrochain-explorer.backups"

mkdir -p "$BACKUP_DIR"
TS=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/retrochain-explorer-${TS}.tar.gz"

echo "    - Writing backup to: ${BACKUP_FILE}"

# Exclude common heavy / regeneratable folders
tar czf "${BACKUP_FILE}" \
  --exclude="retrochain-explorer/node_modules" \
  --exclude="retrochain-explorer/dist" \
  --exclude="retrochain-explorer/.git" \
  --exclude="retrochain-explorer/.cache" \
  --exclude="retrochain-explorer/.vite" \
  -C "/home/retrochain" "retrochain-explorer"
INNER_BACKUP

# -------------------------------------------------------------------
# 2) Pull + build as retrochain
# -------------------------------------------------------------------
echo
echo "===> Pulling latest code, fixing .env, and building (as retrochain)"

sudo -u retrochain bash << 'INNER'
set -euo pipefail

APP_DIR="/home/retrochain/retrochain-explorer"
ENV_FILE="$APP_DIR/.env"
EXPLORER_REPO_URL="https://github.com/Shaund12/retrochain-explorer"

cd "$APP_DIR"

echo "===> Running as: $(whoami)"
echo "===> Working directory: $(pwd)"

command -v git >/dev/null 2>&1 || { echo "!!! git not installed"; exit 1; }

if [[ ! -d .git ]]; then
  echo "!!! ${APP_DIR} is not a git repo (missing .git); recloning"
  cd "$(dirname "$APP_DIR")"
  rm -rf "$APP_DIR"
  git clone "$EXPLORER_REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

echo "===> Ensuring origin remote is ${EXPLORER_REPO_URL}"
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$EXPLORER_REPO_URL"
else
  git remote add origin "$EXPLORER_REPO_URL"
fi

# Safer branch detection (handles detached HEAD)
CURRENT_BRANCH="$(git symbolic-ref --short -q HEAD || true)"
if [[ -z "${CURRENT_BRANCH}" ]]; then
  CURRENT_BRANCH="main"
fi
echo "===> Current branch: ${CURRENT_BRANCH}"

echo "===> Fetching latest from origin"
git fetch --all --prune

echo "===> Resetting local branch to origin/${CURRENT_BRANCH}"
git reset --hard "origin/${CURRENT_BRANCH}"

echo "===> Updating submodules"
git submodule update --init --recursive

echo
echo "===> Ensuring .env exists and setting REST/RPC/WS envs"
touch "$ENV_FILE"

update_kv() {
  local key="$1"
  local value="$2"

  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

# Path-based endpoints through nginx:
update_kv "VITE_REST_API_URL" "/api"
update_kv "VITE_RPC_URL" "/rpc"
update_kv "VITE_RPC_WS_URL" "wss://retrochain.ddns.net/rpc/websocket"

echo "    - VITE_REST_API_URL=/api"
echo "    - VITE_RPC_URL=/rpc"
echo "    - VITE_RPC_WS_URL=wss://retrochain.ddns.net/rpc/websocket"

echo
echo "===> Detecting package manager"
PKG="npm"
if [[ -f "pnpm-lock.yaml" ]]; then
  PKG="pnpm"
elif [[ -f "yarn.lock" ]]; then
  PKG="yarn"
elif [[ -f "package-lock.json" ]]; then
  PKG="npm"
fi
echo "    - Using: ${PKG}"

echo
echo "===> Installing dependencies (deterministic)"
case "${PKG}" in
  pnpm)
    command -v pnpm >/dev/null 2>&1 || { echo "!!! pnpm not installed"; exit 1; }
    pnpm install --frozen-lockfile
    ;;
  yarn)
    command -v yarn >/dev/null 2>&1 || { echo "!!! yarn not installed"; exit 1; }
    yarn install --frozen-lockfile
    ;;
  npm|*)
    command -v npm >/dev/null 2>&1 || { echo "!!! npm not installed"; exit 1; }
    if [[ -f "package-lock.json" ]]; then
      npm ci
    else
      npm install
    fi
    ;;
esac

echo
echo "===> Building Nomic app for RetroChain (embedded under /nomic)"
case "${PKG}" in
  pnpm) pnpm run nomic:prepare ;;
  yarn) yarn run nomic:prepare || npm run nomic:prepare ;;
  npm|*) npm run nomic:prepare ;;
esac

echo
echo "===> Running build script"
case "${PKG}" in
  pnpm) pnpm build ;;
  yarn) yarn build ;;
  npm|*) npm run build ;;
esac

echo
echo "===> Build complete. dist/ contents:"
ls -la dist | head -n 50

echo
echo "==================================================================="
echo "RetroChain Explorer updated from Git and built successfully."
echo "  - Backup dir: /home/retrochain/retrochain-explorer.backups"
echo "  - Branch: origin/${CURRENT_BRANCH}"
echo "  - .env RPC/REST/WS adjusted for nginx reverse proxies."
echo "  - Nomic port built and embedded to /nomic."
echo "==================================================================="
INNER

# -------------------------------------------------------------------
# 3) Deploy dist/ to nginx web root
# -------------------------------------------------------------------
echo
echo "===> Deploying dist/ to nginx web root: ${WEB_ROOT}"

if [[ ! -d "${APP_DIR}/dist" ]]; then
  echo "!!! Missing ${APP_DIR}/dist (build may have failed)"
  exit 1
fi

sudo mkdir -p "${WEB_ROOT}"

if command -v rsync >/dev/null 2>&1; then
  sudo rsync -a --delete "${APP_DIR}/dist/" "${WEB_ROOT}/"
else
  echo "!!! rsync not installed; falling back to rm+cp"
  sudo rm -rf "${WEB_ROOT}"/*
  sudo cp -a "${APP_DIR}/dist/." "${WEB_ROOT}/"
fi

sudo chown -R www-data:www-data "${WEB_ROOT}"
sudo find "${WEB_ROOT}" -type d -exec chmod 755 {} +
sudo find "${WEB_ROOT}" -type f -exec chmod 644 {} +

# -------------------------------------------------------------------
# 4) Reload nginx (serve updated dist/)
# -------------------------------------------------------------------
echo
echo "===> Reloading nginx"
sudo nginx -t
sudo systemctl reload nginx

echo "===> Done."
