#!/usr/bin/env bash
# Secret-safe production status summary for GPU Validator.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"
load_deploy_config
source_env_file_if_present

BASE_URL="${AI_FACTORY_BASE_URL:-${BASE_URL:-http://127.0.0.1:${PORT}}}"
STATUS_ERRORS=0

line() { printf '[status] %-34s %s\n' "$1" "$2"; }
warn_line() { line "$1" "$2"; }
error_line() { STATUS_ERRORS=$((STATUS_ERRORS + 1)); line "$1" "$2"; }
auth_line() { if [[ -n "${2:-}" ]]; then line "$1" SET; else line "$1" EMPTY; fi; }
http_status() {
  local status
  status="$(curl -sS -m "${HEALTH_TIMEOUT}" -o /dev/null -w '%{http_code}' "$1" 2>/dev/null)" || status="000"
  printf '%s' "${status}"
}

line product "GPU Validator"
line app_dir "${APP_DIR}"
line configured_branch "${REPO_BRANCH}"
line local_port "${PORT}"

if git_repo_readable_in_repo; then
  line checked_out_branch "$(git_current_branch_in_repo)"
  line commit_sha "$(git_commit_sha_in_repo)"
  line short_commit "$(git_short_commit_in_repo)"
  line commit_subject "$(git_commit_subject_in_repo)"
  line origin_sync "$(git_origin_sync_state_in_repo)"
  line working_tree "$(git_status_state_in_repo)"
else
  warn_line git_checkout missing
  warn_line checked_out_branch unknown
  warn_line commit_sha unknown
  warn_line short_commit unknown
  warn_line commit_subject unknown
  warn_line origin_sync unknown
  warn_line working_tree unknown
fi

line node "$(node --version 2>/dev/null || printf missing)"
line python "$(python3 --version 2>&1 || printf missing)"
if command -v systemctl >/dev/null 2>&1; then
  service_state="$(systemctl is-active "${SERVICE_NAME}" 2>/dev/null || printf unknown)"
  line service_state "${service_state}"
  [[ "${service_state}" == active || "${service_state}" == unknown ]] || STATUS_ERRORS=$((STATUS_ERRORS + 1))
  line service_pid "$(systemctl show -p MainPID --value "${SERVICE_NAME}" 2>/dev/null || printf unknown)"
else
  warn_line service_state systemctl-missing
fi
if command -v ss >/dev/null 2>&1; then
  listener="$(ss -ltnp "sport = :${PORT}" 2>/dev/null | awk 'NR==2 {print $0}' || true)"
  line port_listener "${listener:-none}"
else
  warn_line port_listener ss-missing
fi

healthz_status="$(http_status "${BASE_URL}/healthz")"
login_status="$(http_status "${BASE_URL}/login")"
line health_endpoint "${BASE_URL}/healthz -> ${healthz_status}"
line login_endpoint "${BASE_URL}/login -> ${login_status}"
[[ "${healthz_status}" == 200 ]] || STATUS_ERRORS=$((STATUS_ERRORS + 1))
[[ "${login_status}" == 200 ]] || STATUS_ERRORS=$((STATUS_ERRORS + 1))

if command -v caddy >/dev/null 2>&1; then
  line caddy_version "$(caddy version 2>/dev/null || printf installed)"
  if command -v systemctl >/dev/null 2>&1; then
    line caddy_state "$(systemctl is-active caddy 2>/dev/null || printf unknown)"
  else
    warn_line caddy_state systemctl-missing
  fi
  if [[ -f "${CADDY_CONFIG}" ]] && caddy validate --config "${CADDY_CONFIG}" >/dev/null 2>&1; then line caddy_config valid; else warn_line caddy_config invalid-or-missing; fi
else
  warn_line caddy_version missing
  warn_line caddy_state unknown
  warn_line caddy_config unknown
fi
if [[ -n "${DOMAIN}" ]]; then
  line domain "${DOMAIN}"
  if getent hosts "${DOMAIN}" >/dev/null 2>&1; then line dns resolves; else warn_line dns unresolved; fi
  line public_http "$(http_status "http://${DOMAIN}")"
  line public_https "$(http_status "https://${DOMAIN}")"
fi
for file in "${APP_DIR}"/artifacts/healthy-results.json "${APP_DIR}"/artifacts/degraded-results.json "${APP_DIR}"/artifacts/latest-results.json; do
  if [[ -e "${file}" ]]; then line "artifact_$(basename "${file}")" "$(stat -c '%y' "${file}" 2>/dev/null || stat -f '%Sm' "${file}" 2>/dev/null || printf present)"; fi
done
line disk_usage "$(df -h "${APP_DIR}" 2>/dev/null | awk 'NR==2 {print $5 " used, " $4 " available"}' || printf unknown)"
auth_line AI_FACTORY_SESSION_SECRET "${AI_FACTORY_SESSION_SECRET:-}"
auth_line AI_FACTORY_REVIEWER_EMAIL "${AI_FACTORY_REVIEWER_EMAIL:-}"
auth_line AI_FACTORY_REVIEWER_PASSWORD_HASH "${AI_FACTORY_REVIEWER_PASSWORD_HASH:-}"
auth_line AI_FACTORY_AUTH_TEST_BYPASS_TOKEN "${AI_FACTORY_AUTH_TEST_BYPASS_TOKEN:-}"

exit "${STATUS_ERRORS}"
