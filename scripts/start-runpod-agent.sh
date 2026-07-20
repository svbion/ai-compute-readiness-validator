#!/usr/bin/env bash
# Start the GPUValidator RunPod agent with nohup and PID tracking.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
AGENT_DIR="${GPUVALIDATOR_AGENT_DIR:-${REPO_ROOT}/agent}"
VENV_DIR="${GPUVALIDATOR_AGENT_VENV:-${AGENT_DIR}/.venv}"
PID_FILE="${GPUVALIDATOR_AGENT_PID_FILE:-${AGENT_DIR}/gpuvalidator-agent.pid}"
LOG_FILE="${GPUVALIDATOR_AGENT_LOG_FILE:-${AGENT_DIR}/gpuvalidator-agent.log}"
ENV_FILE="${GPUVALIDATOR_ENV_FILE:-${AGENT_DIR}/.env}"

log() { printf '[runpod-agent-start] %s\n' "$*"; }
fail() { printf '[runpod-agent-start] ERROR: %s\n' "$*" >&2; exit 1; }
mask_state() { local value="${1:-}"; if [[ -n "${value}" ]]; then printf 'SET length=%s' "${#value}"; else printf 'EMPTY'; fi; }
load_env_file() {
  [[ -f "${ENV_FILE}" ]] || return 0
  log "Loading environment from ${ENV_FILE}"
  set -a
  # shellcheck source=/dev/null
  . "${ENV_FILE}"
  set +a
}
require_env() {
  local name="$1"
  [[ -n "${!name:-}" ]] || fail "Missing required environment variable: ${name}"
}

main() {
  load_env_file
  require_env GPUVALIDATOR_API_URL
  require_env GPUVALIDATOR_AGENT_TOKEN
  require_env GPUVALIDATOR_AGENT_NAME
  [[ -x "${VENV_DIR}/bin/python" ]] || fail "Agent venv missing at ${VENV_DIR}. Run scripts/install-runpod-agent.sh first."
  if [[ -f "${PID_FILE}" ]] && kill -0 "$(cat "${PID_FILE}")" >/dev/null 2>&1; then
    fail "Agent already running with PID $(cat "${PID_FILE}")"
  fi
  log "API URL: ${GPUVALIDATOR_API_URL}"
  log "Agent name: ${GPUVALIDATOR_AGENT_NAME}"
  log "Agent token: $(mask_state "${GPUVALIDATOR_AGENT_TOKEN}")"
  log "Starting durable nohup agent; logs: ${LOG_FILE}"
  cd "${AGENT_DIR}"
  nohup "${VENV_DIR}/bin/python" -m gpuvalidator_agent >"${LOG_FILE}" 2>&1 &
  printf '%s\n' "$!" >"${PID_FILE}"
  log "Started PID $(cat "${PID_FILE}")"
}

main "$@"
