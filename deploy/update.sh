#!/usr/bin/env bash
# Update an installed GPU Validator checkout.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

load_deploy_config

main() {
  if [[ "${DRY_RUN}" == true ]]; then
    deploy_log "DRY RUN: zero-mutation update preview."
    print_effective_config
    cat <<EOF
[deploy] DRY RUN planned operations:
[deploy]   verify ${APP_DIR} is a git checkout
[deploy]   reject dirty working tree unless AI_FACTORY_ALLOW_DIRTY_UPDATE=true
[deploy]   fetch, checkout, and fast-forward ${REPO_BRANCH} as ${APP_USER}
[deploy]   preserve .env.production and validate auth state
[deploy]   npm ci, build, Python install, artifact generation, pytest, lint, portal tests
[deploy]   daemon-reload, restart ${SERVICE_NAME}, wait for readiness, run verify.sh
[deploy]   update Caddy only if AI_FACTORY_ENABLE_CADDY=true and backend is healthy
EOF
    exit 0
  fi

  require_root "update.sh"
  [[ -d "${APP_DIR}/.git" ]] || deploy_fail "${APP_DIR} is not a git checkout. Run deploy/install.sh first."
  print_effective_config
  run_cmd chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"
  safe_git_update
  create_env_if_missing
  source_env_file_if_present
  ensure_runtime_state_paths
  validate_auth_config

  deploy_log "Installing Node dependencies"
  run_as_app_in_repo npm ci
  deploy_log "Building frontend and server bundle"
  run_as_app_in_repo npm run build
  deploy_log "Installing Python package into .venv"
  run_as_app_shell_in_repo "python3 -m venv .venv && . .venv/bin/activate && python -m pip install --upgrade pip && pip install -e '.[dev]'"
  deploy_log "Regenerating deterministic demo artifacts"
  run_as_app_shell_in_repo ". .venv/bin/activate && ai-validator demo --scenario healthy --output-dir artifacts && ai-validator demo --scenario degraded --output-dir artifacts"
  deploy_log "Running validation gates"
  run_as_app_shell_in_repo ". .venv/bin/activate && pytest"
  run_as_app_in_repo npm run lint
  run_as_app_in_repo npm run test:portal
  run_as_app_in_repo npm run test:deploy

  deploy_log "Restarting ${SERVICE_NAME}"
  run_cmd systemctl daemon-reload
  run_cmd systemctl restart "${SERVICE_NAME}"
  wait_for_service_ready
  install_or_update_caddy
  "${APP_DIR}/deploy/verify.sh"
  final_summary
}

main "$@"
