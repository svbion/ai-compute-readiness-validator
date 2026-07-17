#!/usr/bin/env bash
# Install or refresh GPU Validator on Ubuntu 24.04.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

load_deploy_config

print_plan() {
  deploy_log "DRY RUN: zero-mutation install preview. No files, packages, users, services, Git checkout, Caddy config, or firewall state will be changed."
  print_effective_config
  cat <<EOF
[deploy] DRY RUN planned operations:
[deploy]   validate configuration and root requirements for real install
[deploy]   install OS prerequisites with apt-get update/install
[deploy]   install Node.js ${NODE_MAJOR} if missing
[deploy]   create service user ${APP_USER} if missing
[deploy]   clone or safely fast-forward ${REPO_URL}#${REPO_BRANCH} at ${APP_DIR}
[deploy]   preserve existing .env.production or create it from example with generated local secrets
[deploy]   validate production authentication config without printing secrets
[deploy]   run npm ci and npm run build as ${APP_USER}
[deploy]   create/update Python venv and install package as ${APP_USER}
[deploy]   generate healthy/degraded artifacts as ${APP_USER}
[deploy]   install systemd service ${SERVICE_NAME}, daemon-reload, enable, restart
[deploy]   wait for systemd active and HTTP /healthz + /login readiness with retries
[deploy]   configure Caddy only after backend health passes if AI_FACTORY_ENABLE_CADDY=true
[deploy]   print secret-safe deployment summary
EOF
}

install_prerequisites() {
  deploy_log "Updating apt metadata and installing OS prerequisites"
  run_cmd apt-get update
  run_cmd apt-get install -y ca-certificates curl git gnupg python3 python3-pip python3-venv build-essential sudo
  install_nodejs
}

ensure_app_user() {
  if id -u "${APP_USER}" >/dev/null 2>&1; then
    deploy_log "Service user ${APP_USER} already exists"
  else
    deploy_log "Creating system user ${APP_USER}"
    run_cmd useradd --system --home-dir "${APP_DIR}" --shell /usr/sbin/nologin "${APP_USER}"
  fi
}

checkout_or_update_repo() {
  if [[ -d "${APP_DIR}/.git" ]]; then
    deploy_log "Updating existing repository in ${APP_DIR} as ${APP_USER}"
    run_cmd chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"
    safe_git_update
  else
    deploy_log "Cloning ${REPO_URL}#${REPO_BRANCH} to ${APP_DIR}"
    run_cmd install -d -m 0755 "$(dirname "${APP_DIR}")"
    [[ ! -e "${APP_DIR}" ]] || deploy_fail "${APP_DIR} exists but is not a git checkout. Move it aside before installing."
    run_cmd git clone --branch "${REPO_BRANCH}" "${REPO_URL}" "${APP_DIR}"
    run_cmd chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"
  fi
}

install_dependencies_and_build() {
  deploy_log "Installing Node dependencies"
  run_as_app_in_repo npm ci
  deploy_log "Building frontend and server bundle"
  run_as_app_in_repo npm run build
  deploy_log "Creating/updating Python virtual environment"
  run_as_app_shell_in_repo "python3 -m venv .venv && . .venv/bin/activate && python -m pip install --upgrade pip && pip install -e '.[dev]'"
  deploy_log "Generating healthy and degraded scenario artifacts"
  run_as_app_shell_in_repo ". .venv/bin/activate && ai-validator demo --scenario healthy --output-dir artifacts && ai-validator demo --scenario degraded --output-dir artifacts"
}

install_systemd_service() {
  deploy_log "Installing and restarting systemd service ${SERVICE_NAME}"
  run_cmd install -D -m 0644 "${APP_DIR}/deploy/systemd/ai-factory-validator.service" "/etc/systemd/system/${SERVICE_NAME}"
  run_cmd systemctl daemon-reload
  run_cmd systemctl enable "${SERVICE_NAME}"
  run_cmd systemctl restart "${SERVICE_NAME}"
}

main() {
  if [[ "${DRY_RUN}" == true ]]; then
    print_plan
    # Validate domain and numeric inputs already happened in load_deploy_config.
    exit 0
  fi

  require_root "install.sh"
  print_effective_config
  install_prerequisites
  ensure_app_user
  checkout_or_update_repo
  create_env_if_missing
  validate_auth_config
  install_dependencies_and_build
  install_systemd_service
  wait_for_service_ready
  install_or_update_caddy
  final_summary
}

main "$@"
