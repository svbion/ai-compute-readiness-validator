#!/usr/bin/env bash
# Install or refresh AI Factory Validation Portal on Ubuntu 24.04.
# Safe to rerun: packages are ensured, the repository is cloned or updated,
# dependencies are reconciled, artifacts are regenerated, and systemd is updated.

set -Eeuo pipefail

APP_NAME="${APP_NAME:-ai-factory-validator}"
APP_USER="${APP_USER:-ai-validator}"
APP_DIR="${APP_DIR:-/opt/ai-factory-validator}"
REPO_URL="${REPO_URL:-https://github.com/svbion/ai-compute-readiness-validator.git}"
REPO_BRANCH="${REPO_BRANCH:-hermes-mvp}"
SERVICE_NAME="${SERVICE_NAME:-ai-factory-validator.service}"
NODE_MAJOR="${NODE_MAJOR:-22}"
DRY_RUN="${DRY_RUN:-0}"

log() { printf '\n[%s] %s\n' "${APP_NAME}" "$*"; }
fail() { printf '\n[%s] ERROR: %s\n' "${APP_NAME}" "$*" >&2; exit 1; }
require_root() { [[ "${EUID}" -eq 0 ]] || fail "install.sh must be run as root (use sudo)."; }
run_as_app() { sudo -H -u "${APP_USER}" bash -lc "cd '${APP_DIR}' && $*"; }

install_nodejs_22() {
  if command -v node >/dev/null 2>&1 && [[ "$(node -p 'process.versions.node.split(`.`)[0]')" == "${NODE_MAJOR}" ]]; then
    log "Node.js ${NODE_MAJOR} already installed: $(node --version)"
    return
  fi

  log "Installing Node.js ${NODE_MAJOR} from NodeSource"
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL "https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key" \
    | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update
  apt-get install -y nodejs
}

require_root

if [[ "${DRY_RUN}" == "1" ]]; then
  log "Dry run requested; validating inputs and printing the planned fresh-server flow."
  cat <<EOF
apt-get update
apt-get install -y ca-certificates curl git gnupg python3 python3-pip python3-venv build-essential
install Node.js ${NODE_MAJOR}
create service user ${APP_USER}
clone/update ${REPO_URL}#${REPO_BRANCH} at ${APP_DIR}
create ${APP_DIR}/.env.production with generated local-only secrets if missing
npm ci
npm run build
python3 -m venv .venv && pip install -e '.[dev]'
ai-validator demo --scenario healthy/degraded --output-dir artifacts
install and restart ${SERVICE_NAME}
run deploy/healthcheck.sh
EOF
  exit 0
fi

log "Updating apt metadata"
apt-get update

log "Installing OS prerequisites"
apt-get install -y \
  ca-certificates \
  curl \
  git \
  gnupg \
  python3 \
  python3-pip \
  python3-venv \
  build-essential

install_nodejs_22

if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  log "Creating system user ${APP_USER}"
  useradd --system --home-dir "${APP_DIR}" --shell /usr/sbin/nologin "${APP_USER}"
fi

if [[ -d "${APP_DIR}/.git" ]]; then
  log "Updating existing repository in ${APP_DIR}"
  git -C "${APP_DIR}" fetch --prune origin
  git -C "${APP_DIR}" checkout "${REPO_BRANCH}"
  git -C "${APP_DIR}" pull --ff-only origin "${REPO_BRANCH}"
else
  log "Cloning ${REPO_URL}#${REPO_BRANCH} to ${APP_DIR}"
  install -d -m 0755 "$(dirname "${APP_DIR}")"
  rm -rf "${APP_DIR}"
  git clone --branch "${REPO_BRANCH}" "${REPO_URL}" "${APP_DIR}"
fi

chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

if [[ ! -f "${APP_DIR}/.env.production" ]]; then
  log "Creating ${APP_DIR}/.env.production from example"
  cp "${APP_DIR}/.env.production.example" "${APP_DIR}/.env.production"
  python3 - <<'PY' "${APP_DIR}/.env.production"
import pathlib
import secrets
import sys

path = pathlib.Path(sys.argv[1])
text = path.read_text()
text = text.replace("replace-with-at-least-32-random-characters", secrets.token_urlsafe(48))
text = text.replace("AI_FACTORY_AUTH_TEST_BYPASS_TOKEN=", f"AI_FACTORY_AUTH_TEST_BYPASS_TOKEN={secrets.token_urlsafe(32)}")
path.write_text(text)
PY
  chown "${APP_USER}:${APP_USER}" "${APP_DIR}/.env.production"
  chmod 0640 "${APP_DIR}/.env.production"
  log "Generated local session secret and deployment verification token in .env.production; no secrets were printed."
fi

log "Installing Node dependencies"
run_as_app "npm ci"

log "Building frontend and bundled server"
run_as_app "npm run build"

log "Creating/updating Python virtual environment"
run_as_app "python3 -m venv .venv && . .venv/bin/activate && python -m pip install --upgrade pip && pip install -e '.[dev]'"

log "Generating healthy and degraded scenario artifacts"
run_as_app ". .venv/bin/activate && ai-validator demo --scenario healthy --output-dir artifacts && ai-validator demo --scenario degraded --output-dir artifacts"

log "Installing systemd service"
install -D -m 0644 "${APP_DIR}/deploy/systemd/ai-factory-validator.service" "/etc/systemd/system/${SERVICE_NAME}"
systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"

log "Verifying service and HTTP health"
systemctl --no-pager --full status "${SERVICE_NAME}" || fail "systemd service did not start cleanly."
"${APP_DIR}/deploy/healthcheck.sh"

log "Install complete. Portal is listening on localhost:$(grep -E '^PORT=' "${APP_DIR}/.env.production" | cut -d= -f2 || printf '3000')"
