#!/usr/bin/env bash
# Secret-safe production status summary for GPU Validator.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"
load_deploy_config
source_env_file_if_present

BASE_URL="${AI_FACTORY_BASE_URL:-${BASE_URL:-http://127.0.0.1:${PORT}}}"

line() { printf '[status] %-34s %s\n' "$1" "$2"; }
http_status() {
  local status
  status="$(curl -sS -m "${HEALTH_TIMEOUT}" -o /dev/null -w '%{http_code}' "$1" 2>/dev/null)" || status="000"
  printf '%s' "${status}"
}

line product "GPU Validator"
line app_dir "${APP_DIR}"
line branch_config "${REPO_BRANCH}"
if [[ -d "${APP_DIR}/.git" ]]; then
  line git_branch "$(git -C "${APP_DIR}" branch --show-current 2>/dev/null || printf detached)"
  line git_commit "$(git -C "${APP_DIR}" rev-parse --short HEAD 2>/dev/null || printf unknown)"
  if [[ -z "$(git -C "${APP_DIR}" status --porcelain=v1 2>/dev/null || true)" ]]; then line git_status clean; else line git_status dirty; fi
else
  line git_checkout missing
fi
line node "$(node --version 2>/dev/null || printf missing)"
line python "$(python3 --version 2>&1 || printf missing)"
if command -v systemctl >/dev/null 2>&1; then
  line service_state "$(systemctl is-active "${SERVICE_NAME}" 2>/dev/null || printf unknown)"
  line service_pid "$(systemctl show -p MainPID --value "${SERVICE_NAME}" 2>/dev/null || printf unknown)"
else
  line service_state systemctl-missing
fi
if command -v ss >/dev/null 2>&1; then
  listener="$(ss -ltnp "sport = :${PORT}" 2>/dev/null | awk 'NR==2 {print $0}' || true)"
  line port_listener "${listener:-none}"
else
  line port_listener ss-missing
fi
line local_healthz "$(http_status "${BASE_URL}/healthz")"
line local_login "$(http_status "${BASE_URL}/login")"
if command -v caddy >/dev/null 2>&1; then
  line caddy_installed yes
  line caddy_state "$(systemctl is-active caddy 2>/dev/null || printf unknown)"
  if [[ -f "${CADDY_CONFIG}" ]] && caddy validate --config "${CADDY_CONFIG}" >/dev/null 2>&1; then line caddy_config valid; else line caddy_config invalid-or-missing; fi
else
  line caddy_installed no
fi
if [[ -n "${DOMAIN}" ]]; then
  line domain "${DOMAIN}"
  if getent hosts "${DOMAIN}" >/dev/null 2>&1; then line dns resolves; else line dns unresolved; fi
  line public_http "$(http_status "http://${DOMAIN}")"
  line public_https "$(http_status "https://${DOMAIN}")"
fi
for file in "${APP_DIR}"/artifacts/healthy-results.json "${APP_DIR}"/artifacts/degraded-results.json "${APP_DIR}"/artifacts/latest-results.json; do
  if [[ -e "${file}" ]]; then line "artifact_$(basename "${file}")" "$(stat -c '%y' "${file}" 2>/dev/null || stat -f '%Sm' "${file}" 2>/dev/null || printf present)"; fi
done
line disk_usage "$(df -h "${APP_DIR}" 2>/dev/null | awk 'NR==2 {print $5 " used, " $4 " available"}' || printf unknown)"
secret_state AI_FACTORY_SESSION_SECRET "${AI_FACTORY_SESSION_SECRET:-}"
secret_state AI_FACTORY_REVIEWER_EMAIL "${AI_FACTORY_REVIEWER_EMAIL:-}"
secret_state AI_FACTORY_REVIEWER_PASSWORD_HASH "${AI_FACTORY_REVIEWER_PASSWORD_HASH:-}"
secret_state AI_FACTORY_AUTH_TEST_BYPASS_TOKEN "${AI_FACTORY_AUTH_TEST_BYPASS_TOKEN:-}"
