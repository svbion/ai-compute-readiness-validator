#!/usr/bin/env bash
# Install the standalone GPUValidator RunPod agent into a local venv.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
AGENT_DIR="${GPUVALIDATOR_AGENT_DIR:-${REPO_ROOT}/agent}"
VENV_DIR="${GPUVALIDATOR_AGENT_VENV:-${AGENT_DIR}/.venv}"
PYTHON_BIN="${PYTHON_BIN:-python3}"

log() { printf '[runpod-agent-install] %s\n' "$*"; }
fail() { printf '[runpod-agent-install] ERROR: %s\n' "$*" >&2; exit 1; }
require_cmd() { command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"; }

main() {
  [[ -d "${AGENT_DIR}/gpuvalidator_agent" ]] || fail "Agent package not found at ${AGENT_DIR}. Clone/copy the repository first."
  require_cmd "${PYTHON_BIN}"
  log "Using Python: $(${PYTHON_BIN} --version 2>&1)"
  "${PYTHON_BIN}" -m venv "${VENV_DIR}"
  # shellcheck source=/dev/null
  . "${VENV_DIR}/bin/activate"
  python -m pip install --upgrade pip
  python -m pip install -e "${AGENT_DIR}"
  log "Installed gpuvalidator-agent into ${VENV_DIR}"
  log "Run: ${VENV_DIR}/bin/python -m gpuvalidator_agent"
}

main "$@"
