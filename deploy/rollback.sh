#!/usr/bin/env bash
# Roll back the installed checkout to a supplied git tag or commit and restart.
# Usage: sudo deploy/rollback.sh <tag-or-commit>

set -Eeuo pipefail

APP_NAME="${APP_NAME:-ai-factory-validator}"
APP_USER="${APP_USER:-ai-validator}"
APP_DIR="${APP_DIR:-/opt/ai-factory-validator}"
SERVICE_NAME="${SERVICE_NAME:-ai-factory-validator.service}"
TARGET="${1:-}"
DRY_RUN="${DRY_RUN:-0}"

log() { printf '\n[%s] %s\n' "${APP_NAME}" "$*"; }
fail() { printf '\n[%s] ERROR: %s\n' "${APP_NAME}" "$*" >&2; exit 1; }
run_as_app() { sudo -H -u "${APP_USER}" bash -lc "cd '${APP_DIR}' && $*"; }

[[ "${EUID}" -eq 0 ]] || fail "rollback.sh must be run as root (use sudo)."
[[ -n "${TARGET}" ]] || fail "Usage: sudo deploy/rollback.sh <tag-or-commit>"
[[ -d "${APP_DIR}/.git" ]] || fail "${APP_DIR} is not a git checkout."

if [[ "${DRY_RUN}" == "1" ]]; then
  git -C "${APP_DIR}" rev-parse --verify --quiet "${TARGET}^{commit}" >/dev/null \
    || fail "Target '${TARGET}' is not a known local tag or commit; run without DRY_RUN to fetch remote refs first."
  log "Dry run requested; would roll back ${APP_DIR} to ${TARGET}, rebuild, restart ${SERVICE_NAME}, and run deploy/verify.sh."
  exit 0
fi

log "Fetching tags and refs"
git -C "${APP_DIR}" fetch --all --tags --prune

git -C "${APP_DIR}" rev-parse --verify --quiet "${TARGET}^{commit}" >/dev/null \
  || fail "Target '${TARGET}' is not a known tag or commit."

CURRENT="$(git -C "${APP_DIR}" rev-parse --short HEAD)"
RESOLVED="$(git -C "${APP_DIR}" rev-parse --short "${TARGET}^{commit}")"
log "Rolling back from ${CURRENT} to ${TARGET} (${RESOLVED})"

git -C "${APP_DIR}" checkout --detach "${TARGET}"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

log "Reconciling dependencies and rebuilding"
run_as_app "npm ci"
run_as_app "npm run build"
run_as_app "python3 -m venv .venv && . .venv/bin/activate && python -m pip install --upgrade pip && pip install -e '.[dev]'"
run_as_app ". .venv/bin/activate && ai-validator demo --scenario healthy --output-dir artifacts && ai-validator demo --scenario degraded --output-dir artifacts"

log "Restarting ${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"
"${APP_DIR}/deploy/verify.sh"

log "Rollback complete. Previous commit was ${CURRENT}; active commit is ${RESOLVED}."
