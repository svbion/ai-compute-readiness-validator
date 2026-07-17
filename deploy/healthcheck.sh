#!/usr/bin/env bash
# Lightweight service healthcheck. Returns non-zero when the portal health or
# public login entry is unavailable. Intended for operators and deployment scripts.

set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/ai-factory-validator}"
PORT="${PORT:-3000}"
BASE_URL_OVERRIDE="${BASE_URL:-}"
BASE_URL="${BASE_URL_OVERRIDE:-http://127.0.0.1:${PORT}}"
TIMEOUT="${TIMEOUT:-10}"

if [[ -f "${APP_DIR}/.env.production" ]]; then
  # shellcheck disable=SC1090
  set -a
  source "${APP_DIR}/.env.production"
  set +a
  BASE_URL="${BASE_URL_OVERRIDE:-http://127.0.0.1:${PORT:-3000}}"
fi

TMP_OUT="$(mktemp)"
trap 'rm -f "${TMP_OUT}"' EXIT

check() {
  local method="$1"
  local path="$2"
  local expected="$3"
  local data="${4:-}"
  local status

  if [[ "${method}" == "POST" ]]; then
    status="$(curl -sS -m "${TIMEOUT}" -o "${TMP_OUT}" -w '%{http_code}' \
      -H 'Content-Type: application/json' -X POST --data "${data}" "${BASE_URL}${path}")"
  else
    status="$(curl -sS -m "${TIMEOUT}" -o "${TMP_OUT}" -w '%{http_code}' \
      "${BASE_URL}${path}")"
  fi

  if [[ "${status}" != "${expected}" ]]; then
    printf 'Healthcheck failed: %s %s returned HTTP %s, expected %s\n' "${method}" "${path}" "${status}" "${expected}" >&2
    printf 'Response body:\n' >&2
    sed -n '1,80p' "${TMP_OUT}" >&2 || true
    return 1
  fi
}

check GET /healthz 200
check GET /login 200

printf 'Healthcheck passed for %s\n' "${BASE_URL}"
