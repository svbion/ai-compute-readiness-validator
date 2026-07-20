#!/usr/bin/env bash
# Stop the nohup-managed GPUValidator RunPod agent.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
AGENT_DIR="${GPUVALIDATOR_AGENT_DIR:-${REPO_ROOT}/agent}"
PID_FILE="${GPUVALIDATOR_AGENT_PID_FILE:-${AGENT_DIR}/gpuvalidator-agent.pid}"
TIMEOUT_SECONDS="${GPUVALIDATOR_STOP_TIMEOUT:-10}"

log() { printf '[runpod-agent-stop] %s\n' "$*"; }
fail() { printf '[runpod-agent-stop] ERROR: %s\n' "$*" >&2; exit 1; }

main() {
  [[ -f "${PID_FILE}" ]] || { log "No PID file at ${PID_FILE}; agent is not tracked as running."; exit 0; }
  pid="$(cat "${PID_FILE}")"
  [[ "${pid}" =~ ^[0-9]+$ ]] || fail "Invalid PID file contents: ${pid}"
  if ! kill -0 "${pid}" >/dev/null 2>&1; then
    log "PID ${pid} is not running; removing stale PID file."
    rm -f "${PID_FILE}"
    exit 0
  fi
  log "Stopping PID ${pid}"
  kill "${pid}"
  for _ in $(seq 1 "${TIMEOUT_SECONDS}"); do
    if ! kill -0 "${pid}" >/dev/null 2>&1; then
      rm -f "${PID_FILE}"
      log "Stopped."
      exit 0
    fi
    sleep 1
  done
  log "PID ${pid} did not exit after ${TIMEOUT_SECONDS}s; sending SIGKILL."
  kill -9 "${pid}" >/dev/null 2>&1 || true
  rm -f "${PID_FILE}"
}

main "$@"
