#!/usr/bin/env bash
# Roll back the installed checkout to a supplied git tag or commit and restart.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

load_deploy_config
TARGET="${1:-}"

main() {
  [[ -n "${TARGET}" ]] || deploy_fail "Usage: sudo -E deploy/rollback.sh <tag-or-commit>"
  if [[ "${DRY_RUN}" == true ]]; then
    deploy_log "DRY RUN: zero-mutation rollback preview."
    print_effective_config
    deploy_log "DRY RUN: would fetch tags/refs, verify ${TARGET}, checkout detached target as ${APP_USER}, rebuild, restart, wait for readiness, and verify."
    exit 0
  fi

  require_root "rollback.sh"
  [[ -d "${APP_DIR}/.git" ]] || deploy_fail "${APP_DIR} is not a git checkout."
  run_cmd chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"
  ensure_clean_git_tree

  deploy_log "Fetching tags and refs as ${APP_USER}"
  git_in_repo fetch --all --tags --prune
  git_output_in_repo rev-parse --verify --quiet "${TARGET}^{commit}" >/dev/null \
    || deploy_fail "Target '${TARGET}' is not a known tag or commit."

  CURRENT="$(git -C "${APP_DIR}" rev-parse --short HEAD)"
  RESOLVED="$(git -C "${APP_DIR}" rev-parse --short "${TARGET}^{commit}")"
  deploy_log "Rolling back from ${CURRENT} to ${TARGET} (${RESOLVED})"
  git_in_repo checkout --detach "${TARGET}"

  create_env_if_missing
  validate_auth_config
  deploy_log "Reconciling dependencies and rebuilding"
  run_as_app_in_repo npm ci
  run_as_app_in_repo npm run build
  run_as_app_shell_in_repo "python3 -m venv .venv && . .venv/bin/activate && python -m pip install --upgrade pip && pip install -e '.[dev]'"
  run_as_app_shell_in_repo ". .venv/bin/activate && ai-validator demo --scenario healthy --output-dir artifacts && ai-validator demo --scenario degraded --output-dir artifacts"

  deploy_log "Restarting ${SERVICE_NAME}"
  run_cmd systemctl restart "${SERVICE_NAME}"
  wait_for_service_ready
  "${APP_DIR}/deploy/verify.sh"
  deploy_log "Rollback complete. Previous commit was ${CURRENT}; active commit is ${RESOLVED}."
}

main "$@"
