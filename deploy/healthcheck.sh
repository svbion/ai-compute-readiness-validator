#!/usr/bin/env bash
# Lightweight service healthcheck. One-shot by default; use --retry or
# AI_FACTORY_HEALTH_RETRIES for deployment startup polling.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"
load_deploy_config
source_env_file_if_present

BASE_URL_OVERRIDE="${AI_FACTORY_BASE_URL:-${BASE_URL:-}}"
BASE_URL="${BASE_URL_OVERRIDE:-http://127.0.0.1:${PORT}}"
TIMEOUT="${HEALTH_TIMEOUT}"
RETRY_MODE=false
if [[ "${1:-}" == "--retry" ]]; then
  RETRY_MODE=true
elif [[ "${HEALTH_RETRIES}" != "1" && "${AI_FACTORY_HEALTH_RETRIES+x}" == x ]]; then
  RETRY_MODE=true
fi

TMP_OUT="$(mktemp)"
trap 'rm -f "${TMP_OUT}"' EXIT

check_once() {
  local method="$1" path="$2" expected="$3" data="${4:-}" status
  if [[ "${method}" == "POST" ]]; then
    status="$(curl -sS -m "${TIMEOUT}" -o "${TMP_OUT}" -w '%{http_code}' -H 'Content-Type: application/json' -X POST --data "${data}" "${BASE_URL}${path}" 2>/dev/null)" || status="000"
  else
    status="$(curl -sS -m "${TIMEOUT}" -o "${TMP_OUT}" -w '%{http_code}' "${BASE_URL}${path}" 2>/dev/null)" || status="000"
  fi
  [[ "${status}" == "${expected}" ]] || {
    printf 'Healthcheck failed: %s %s returned HTTP %s, expected %s\n' "${method}" "${path}" "${status}" "${expected}" >&2
    sed -n '1,80p' "${TMP_OUT}" >&2 || true
    return 1
  }
}

check_all() {
  check_once GET /healthz 200
  check_once GET /login 200
}

if [[ "${RETRY_MODE}" == true ]]; then
  if ! retry "${HEALTH_RETRIES}" "${HEALTH_RETRY_DELAY}" "HTTP health ${BASE_URL}" check_all; then
    deploy_fail "Healthcheck failed for ${BASE_URL} after ${HEALTH_RETRIES} attempts."
  fi
else
  check_all
fi

printf 'Healthcheck passed for %s\n' "${BASE_URL}"
