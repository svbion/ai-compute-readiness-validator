#!/usr/bin/env bash
# Full deployment verification for a running portal. Exercises the frontend,
# API, scenario execution, report routes, and generated JSON/Markdown/HTML files.

set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/ai-factory-validator}"
PORT="${PORT:-3000}"
BASE_URL_OVERRIDE="${BASE_URL:-}"
BASE_URL="${BASE_URL_OVERRIDE:-http://127.0.0.1:${PORT}}"
TIMEOUT="${TIMEOUT:-20}"

if [[ -f "${APP_DIR}/.env.production" ]]; then
  # shellcheck disable=SC1090
  set -a
  source "${APP_DIR}/.env.production"
  set +a
  BASE_URL="${BASE_URL_OVERRIDE:-http://127.0.0.1:${PORT:-3000}}"
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

log() { printf '[verify] %s\n' "$*"; }
fail() { printf '[verify] ERROR: %s\n' "$*" >&2; exit 1; }

request() {
  local method="$1"
  local path="$2"
  local expected="$3"
  local output="$4"
  local data="${5:-}"
  local status

  if [[ "${method}" == "POST" ]]; then
    status="$(curl -sS -m "${TIMEOUT}" -o "${output}" -w '%{http_code}' \
      -H 'Content-Type: application/json' -X POST --data "${data}" "${BASE_URL}${path}")"
  else
    status="$(curl -sS -m "${TIMEOUT}" -o "${output}" -w '%{http_code}' "${BASE_URL}${path}")"
  fi

  [[ "${status}" == "${expected}" ]] || {
    sed -n '1,120p' "${output}" >&2 || true
    fail "${method} ${path} returned HTTP ${status}, expected ${expected}"
  }
}

assert_contains() {
  local file="$1"
  local pattern="$2"
  grep -E "${pattern}" "${file}" >/dev/null || fail "${file} did not contain pattern: ${pattern}"
}

log "Checking portal root"
request GET / 200 "${TMP_DIR}/root.html"
assert_contains "${TMP_DIR}/root.html" '<div id="root"|AI Factory|script'

for scenario in healthy degraded; do
  log "Checking API results for ${scenario}"
  request GET "/api/results?scenario=${scenario}" 200 "${TMP_DIR}/${scenario}.json"
  python3 -m json.tool "${TMP_DIR}/${scenario}.json" >/dev/null
  assert_contains "${TMP_DIR}/${scenario}.json" '"classification"|"overall_score"'

  log "Running scenario ${scenario} through API"
  request POST /api/run-scenario 200 "${TMP_DIR}/run-${scenario}.json" "{\"scenario\":\"${scenario}\"}"
  python3 -m json.tool "${TMP_DIR}/run-${scenario}.json" >/dev/null

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

log "Verification passed for ${BASE_URL}"
