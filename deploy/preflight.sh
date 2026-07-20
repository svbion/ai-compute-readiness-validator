#!/usr/bin/env bash
# Read-only production preflight checks for GPU Validator.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"
load_deploy_config

ERRORS=0
WARNINGS=0

ok() { printf '[preflight] OK: %s\n' "$*"; }
warn_p() { WARNINGS=$((WARNINGS + 1)); printf '[preflight] WARNING: %s\n' "$*" >&2; }
err_p() { ERRORS=$((ERRORS + 1)); printf '[preflight] ERROR: %s\n' "$*" >&2; }

check_url() {
  local name="$1" url="$2"
  if command -v curl >/dev/null 2>&1 && curl -fsSI --connect-timeout 5 --max-time 10 "${url}" >/dev/null 2>&1; then
    ok "outbound ${name}: ${url}"
  else
    warn_p "outbound ${name} unavailable or blocked: ${url}"
  fi
}

check_port() {
  local port="$1" label="$2"
  if command -v ss >/dev/null 2>&1 && ss -ltn "sport = :${port}" | grep -q LISTEN; then
    warn_p "port ${port} (${label}) already has a listener"
  else
    ok "port ${port} (${label}) has no detected listener"
  fi
}

print_effective_config

if [[ -r /etc/os-release ]]; then
  # shellcheck disable=SC1091
  source /etc/os-release
  if [[ "${ID:-}" == ubuntu && "${VERSION_ID:-}" == 24.04 ]]; then ok "Ubuntu ${VERSION_ID}"; else warn_p "expected Ubuntu 24.04, found ${PRETTY_NAME:-unknown}"; fi
else
  warn_p "/etc/os-release not readable"
fi

if [[ "${EUID}" -eq 0 ]]; then ok "root privileges available"; else warn_p "not running as root; install/update will require sudo -E"; fi
case "$(uname -m)" in x86_64|aarch64|arm64) ok "CPU architecture $(uname -m)" ;; *) warn_p "unusual CPU architecture $(uname -m)" ;; esac

mem_kb="$(awk '/MemTotal/ {print $2}' /proc/meminfo 2>/dev/null || printf 0)"
if (( mem_kb >= 1900000 )); then ok "RAM $((mem_kb / 1024)) MiB"; else warn_p "low RAM $((mem_kb / 1024)) MiB"; fi
avail_kb="$(df -Pk "$(dirname "${APP_DIR}")" 2>/dev/null | awk 'NR==2 {print $4}' || printf 0)"
if (( avail_kb >= 5000000 )); then ok "disk available $((avail_kb / 1024)) MiB near ${APP_DIR}"; else warn_p "low disk available $((avail_kb / 1024)) MiB near ${APP_DIR}"; fi

check_url GitHub https://github.com
check_url NodeSource https://deb.nodesource.com
check_url Ubuntu https://archive.ubuntu.com
if [[ "${ENABLE_CADDY}" == true ]]; then check_url Caddy https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt; fi

if [[ -n "${DOMAIN}" ]]; then
  if getent hosts "${DOMAIN}" >/dev/null 2>&1; then ok "DNS resolves for ${DOMAIN}"; else warn_p "DNS does not resolve for ${DOMAIN}"; fi
fi
check_port 80 http
check_port 443 https
check_port "${PORT}" app

if id -u "${APP_USER}" >/dev/null 2>&1; then ok "app user ${APP_USER} exists"; else warn_p "app user ${APP_USER} does not exist yet"; fi
if [[ -d "${APP_DIR}/.git" ]]; then
  ok "repository checkout exists at ${APP_DIR}"
  owner="$(stat -c '%U:%G' "${APP_DIR}" 2>/dev/null || stat -f '%Su:%Sg' "${APP_DIR}" 2>/dev/null || printf unknown)"
  ok "repository ownership ${owner}"
  status="$(git -C "${APP_DIR}" status --porcelain=v1 2>/dev/null || true)"
  if [[ -n "${status}" ]]; then warn_p "repository has local modifications"; else ok "repository working tree clean"; fi
else
  warn_p "repository checkout not present at ${APP_DIR}"
fi

if [[ -f "${APP_DIR}/.env.production" ]]; then
  perm="$(stat -c '%a' "${APP_DIR}/.env.production" 2>/dev/null || stat -f '%Lp' "${APP_DIR}/.env.production" 2>/dev/null || printf unknown)"
  ok ".env.production present with mode ${perm}"
  source_env_file_if_present
  secret_state AI_FACTORY_SESSION_SECRET "${AI_FACTORY_SESSION_SECRET:-}"
  secret_state AI_FACTORY_REVIEWER_USERNAME "${AI_FACTORY_REVIEWER_USERNAME:-}"
  secret_state AI_FACTORY_REVIEWER_PASSWORD_HASH "${AI_FACTORY_REVIEWER_PASSWORD_HASH:-}"
  secret_state AI_FACTORY_AUTH_TEST_BYPASS_TOKEN "${AI_FACTORY_AUTH_TEST_BYPASS_TOKEN:-}"
else
  warn_p ".env.production not present at ${APP_DIR}"
fi

if command -v node >/dev/null 2>&1; then ok "Node $(node --version)"; else warn_p "node not installed"; fi
if command -v python3 >/dev/null 2>&1; then ok "Python $(python3 --version 2>&1)"; else err_p "python3 not installed"; fi
if command -v systemctl >/dev/null 2>&1; then ok "systemd available"; else warn_p "systemctl not available on this host; Ubuntu production install requires systemd"; fi
if command -v caddy >/dev/null 2>&1; then ok "Caddy $(caddy version 2>/dev/null || printf installed)"; else warn_p "Caddy not installed"; fi
if command -v ufw >/dev/null 2>&1; then ok "ufw status: $(ufw status 2>/dev/null | head -1)"; else warn_p "ufw not detected"; fi

printf '[preflight] Summary: %s warning(s), %s error(s)\n' "${WARNINGS}" "${ERRORS}"
(( ERRORS == 0 )) || exit 1
