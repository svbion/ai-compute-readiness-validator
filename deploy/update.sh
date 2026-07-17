#!/usr/bin/env bash
# Update an installed GPU Validator checkout.
# Safe to rerun: updates code, reconciles dependencies, validates, restarts,
# and checks the running service.

set -Eeuo pipefail

APP_NAME="${APP_NAME:-ai-factory-validator}"
APP_USER="${APP_USER:-ai-validator}"
APP_DIR="${APP_DIR:-/opt/ai-factory-validator}"
REPO_BRANCH="${REPO_BRANCH:-hermes-mvp}"
SERVICE_NAME="${SERVICE_NAME:-ai-factory-validator.service}"
DRY_RUN="${DRY_RUN:-0}"

log() { printf '\n[%s] %s\n' "${APP_NAME}" "$*"; }
fail() { printf '\n[%s] ERROR: %s\n' "${APP_NAME}" "$*" >&2; exit 1; }
run_as_app() { sudo -H -u "${APP_USER}" bash -lc "cd '${APP_DIR}' && $*"; }

[[ "${EUID}" -eq 0 ]] || fail "update.sh must be run as root (use sudo)."
[[ -d "${APP_DIR}/.git" ]] || fail "${APP_DIR} is not a git checkout. Run deploy/install.sh first."

if [[ "${DRY_RUN}" == "1" ]]; then
  log "Dry run requested; planned update flow: fetch/pull ${REPO_BRANCH}, npm ci, build, Python install, artifact generation, pytest, lint, portal tests, restart ${SERVICE_NAME}, deploy/verify.sh."
  exit 0
fi

log "Fetching and fast-forwarding ${REPO_BRANCH}"
git -C "${APP_DIR}" fetch --prune origin
git -C "${APP_DIR}" checkout "${REPO_BRANCH}"
git -C "${APP_DIR}" pull --ff-only origin "${REPO_BRANCH}"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

log "Installing Node dependencies"
run_as_app "npm ci"

log "Building frontend and server bundle"
run_as_app "npm run build"

log "Installing Python package into .venv"
run_as_app "python3 -m venv .venv && . .venv/bin/activate && python -m pip install --upgrade pip && pip install -e '.[dev]'"

log "Regenerating deterministic demo artifacts"
run_as_app ". .venv/bin/activate && ai-validator demo --scenario healthy --output-dir artifacts && ai-validator demo --scenario degraded --output-dir artifacts"

log "Running validation gates"
run_as_app ". .venv/bin/activate && pytest"
run_as_app "npm run lint"
run_as_app "npm run test:portal"

log "Restarting ${SERVICE_NAME}"
systemctl daemon-reload
systemctl restart "${SERVICE_NAME}"

log "Verifying deployment"
"${APP_DIR}/deploy/verify.sh"

log "Update complete"
