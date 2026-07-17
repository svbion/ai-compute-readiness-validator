#!/usr/bin/env bash
# Full deployment verification for a running portal. Exercises public health,
# login, authentication gates, read-only APIs, report routes, and
# generated JSON/Markdown/HTML files.

set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/ai-factory-validator}"
PORT="${PORT:-3000}"
BASE_URL_OVERRIDE="${BASE_URL:-}"
BASE_URL="${BASE_URL_OVERRIDE:-http://127.0.0.1:${PORT}}"
TIMEOUT="${TIMEOUT:-20}"
SERVICE_NAME="${SERVICE_NAME:-ai-factory-validator.service}"
CADDY_CONFIG="${CADDY_CONFIG:-/etc/caddy/Caddyfile}"
VERIFY_CADDY="${VERIFY_CADDY:-auto}"
VERIFY_TLS="${VERIFY_TLS:-auto}"
DOMAIN="${AI_FACTORY_DOMAIN:-}"
AUTH_REQUIRED="${AI_FACTORY_AUTH_REQUIRED:-}"
AUTH_TEST_TOKEN="${AI_FACTORY_AUTH_TEST_BYPASS_TOKEN:-}"

if [[ -f "${APP_DIR}/.env.production" ]]; then
  # shellcheck disable=SC1090
  set -a
  source "${APP_DIR}/.env.production"
  set +a
  BASE_URL="${BASE_URL_OVERRIDE:-http://127.0.0.1:${PORT:-3000}}"
  DOMAIN="${AI_FACTORY_DOMAIN:-${DOMAIN}}"
  AUTH_REQUIRED="${AI_FACTORY_AUTH_REQUIRED:-${AUTH_REQUIRED}}"
  AUTH_TEST_TOKEN="${AI_FACTORY_AUTH_TEST_BYPASS_TOKEN:-${AUTH_TEST_TOKEN}}"
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

log() { printf '[verify] %s\n' "$*"; }
fail() { printf '[verify] ERROR: %s\n' "$*" >&2; exit 1; }

is_auth_required() {
  case "$(printf '%s' "${AUTH_REQUIRED}" | tr '[:upper:]' '[:lower:]')" in
    1|true|yes|on) return 0 ;;
  esac
  [[ -z "${AUTH_REQUIRED}" && "${NODE_ENV:-}" == "production" ]]
}

curl_args() {
  if [[ -n "${AUTH_TEST_TOKEN}" ]]; then
    printf '%s\n' -H "x-ai-factory-test-auth: ${AUTH_TEST_TOKEN}"
  fi
}

request() {
  local method="$1"
  local path="$2"
  local expected="$3"
  local output="$4"
  local data="${5:-}"
  local status
  local -a extra_headers=()
  if [[ -n "${AUTH_TEST_TOKEN}" ]]; then
    extra_headers=(-H "x-ai-factory-test-auth: ${AUTH_TEST_TOKEN}")
  fi

  if [[ "${method}" == "POST" ]]; then
    status="$(curl -sS -m "${TIMEOUT}" -o "${output}" -w '%{http_code}' \
      "${extra_headers[@]}" -H 'Content-Type: application/json' -X POST --data "${data}" "${BASE_URL}${path}")"
  else
    status="$(curl -sS -m "${TIMEOUT}" -o "${output}" -w '%{http_code}' \
      "${extra_headers[@]}" "${BASE_URL}${path}")"
  fi

  [[ "${status}" == "${expected}" ]] || {
    sed -n '1,120p' "${output}" >&2 || true
    fail "${method} ${path} returned HTTP ${status}, expected ${expected}"
  }
}

request_without_auth() {
  local method="$1"
  local path="$2"
  local expected="$3"
  local output="$4"
  local status

  status="$(curl -sS -m "${TIMEOUT}" -o "${output}" -w '%{http_code}' -X "${method}" "${BASE_URL}${path}")"
  [[ "${status}" == "${expected}" ]] || {
    sed -n '1,80p' "${output}" >&2 || true
    fail "unauthenticated ${method} ${path} returned HTTP ${status}, expected ${expected}"
  }
}

assert_contains() {
  local file="$1"
  local pattern="$2"
  grep -E "${pattern}" "${file}" >/dev/null || fail "${file} did not contain pattern: ${pattern}"
}

log "Checking public health and login"
request_without_auth GET /healthz 200 "${TMP_DIR}/healthz.json"
python3 -m json.tool "${TMP_DIR}/healthz.json" >/dev/null
request_without_auth GET /login 200 "${TMP_DIR}/login.html"
assert_contains "${TMP_DIR}/login.html" '<div id="root"|AI Factory|script'

if is_auth_required; then
  log "Checking unauthenticated protection"
  request_without_auth GET /api/results?scenario=healthy 401 "${TMP_DIR}/unauth-api.json"
  request_without_auth GET /reports/degraded/json 401 "${TMP_DIR}/unauth-report.json"
  request_without_auth GET / 302 "${TMP_DIR}/unauth-root.html"
  [[ -n "${AUTH_TEST_TOKEN}" ]] || fail "AI_FACTORY_AUTH_TEST_BYPASS_TOKEN is required for authenticated deployment verification when auth is required."
fi

log "Checking authenticated portal root"
request GET / 200 "${TMP_DIR}/root.html"
assert_contains "${TMP_DIR}/root.html" '<div id="root"|AI Factory|script'

for scenario in healthy degraded; do
  log "Checking API results for ${scenario}"
  request GET "/api/results?scenario=${scenario}" 200 "${TMP_DIR}/${scenario}.json"
  python3 -m json.tool "${TMP_DIR}/${scenario}.json" >/dev/null
  assert_contains "${TMP_DIR}/${scenario}.json" '"classification"|"overall_score"'

  log "Checking reviewer surface remains read-only for scenario execution"
  request POST /api/run-scenario 405 "${TMP_DIR}/run-${scenario}.json" "{\"scenario\":\"${scenario}\"}"

  log "Checking report routes for ${scenario}"
  request GET "/reports/${scenario}/html" 200 "${TMP_DIR}/${scenario}.html"
  assert_contains "${TMP_DIR}/${scenario}.html" '<html|AI Factory|Validation Report'

  request GET "/reports/${scenario}/markdown" 200 "${TMP_DIR}/${scenario}.md"
  assert_contains "${TMP_DIR}/${scenario}.md" '^# AI Factory Validation Report|Evaluation Summary'

  request GET "/reports/${scenario}/json" 200 "${TMP_DIR}/${scenario}-report.json"
  python3 -m json.tool "${TMP_DIR}/${scenario}-report.json" >/dev/null
done

if [[ -d "${APP_DIR}" ]]; then
  log "Checking on-disk artifacts"
  for file in \
    artifacts/healthy-results.json \
    artifacts/healthy-report.html \
    artifacts/healthy-report.md \
    artifacts/degraded-results.json \
    artifacts/degraded-report.html \
    artifacts/degraded-report.md; do
    [[ -s "${APP_DIR}/${file}" ]] || fail "Missing or empty artifact: ${APP_DIR}/${file}"
  done
fi

if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files "${SERVICE_NAME}" >/dev/null 2>&1; then
  log "Checking systemd service ${SERVICE_NAME}"
  systemctl is-active --quiet "${SERVICE_NAME}" || fail "${SERVICE_NAME} is not active"
fi

if [[ "${VERIFY_CADDY}" == "1" || ("${VERIFY_CADDY}" == "auto" && -f "${CADDY_CONFIG}") ]]; then
  log "Validating Caddy config ${CADDY_CONFIG}"
  command -v caddy >/dev/null 2>&1 || fail "Caddy config verification requested but caddy is not installed."
  caddy validate --config "${CADDY_CONFIG}" >/dev/null
fi

if [[ "${VERIFY_TLS}" == "1" || ("${VERIFY_TLS}" == "auto" && -n "${DOMAIN}" && "${BASE_URL}" == https://*) ]]; then
  log "Checking TLS endpoint"
  curl -fsSIm "${TIMEOUT}" "https://${DOMAIN:-${BASE_URL#https://}}" >/dev/null
fi

log "Verification passed for ${BASE_URL}"
