#!/usr/bin/env bash
# Safe RunPod smoke test for GPU visibility and GPUValidator API/agent connectivity.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
AGENT_DIR="${GPUVALIDATOR_AGENT_DIR:-${REPO_ROOT}/agent}"
VENV_DIR="${GPUVALIDATOR_AGENT_VENV:-${AGENT_DIR}/.venv}"
ENV_FILE="${GPUVALIDATOR_ENV_FILE:-${AGENT_DIR}/.env}"
EXPECTED_GPU_COUNT="${GPUVALIDATOR_EXPECTED_GPU_COUNT:-4}"

log() { printf '[runpod-smoke] %s\n' "$*"; }
warn() { printf '[runpod-smoke] WARNING: %s\n' "$*" >&2; }
fail() { printf '[runpod-smoke] ERROR: %s\n' "$*" >&2; exit 1; }
run_optional() { if command -v "$1" >/dev/null 2>&1; then "$@"; else warn "Command unavailable: $1"; fi; }
load_env_file() {
  [[ -f "${ENV_FILE}" ]] || return 0
  set -a
  # shellcheck source=/dev/null
  . "${ENV_FILE}"
  set +a
}

main() {
  log "Host identity"
  hostname || true
  uname -a || true
  python3 --version || fail "python3 is required"

  log "NVIDIA visibility"
  command -v nvidia-smi >/dev/null 2>&1 || fail "nvidia-smi is unavailable; RunPod GPU runtime is not visible."
  nvidia-smi
  nvidia-smi -L
  visible_count="$(nvidia-smi -L | grep -c '^GPU ' || true)"
  log "Visible GPU count: ${visible_count}; expected demo count: ${EXPECTED_GPU_COUNT}"
  [[ "${visible_count}" == "${EXPECTED_GPU_COUNT}" ]] || fail "Expected ${EXPECTED_GPU_COUNT} visible GPUs for the demo pod, found ${visible_count}."
  nvidia-smi topo -m

  log "PyTorch check (optional)"
  if python3 -c 'import torch' >/dev/null 2>&1; then
    python3 -c 'import torch; print(torch.cuda.device_count())'
  else
    warn "PyTorch is not installed; pytorch_gpu_count will report unavailable."
  fi

  load_env_file
  if [[ -n "${GPUVALIDATOR_API_URL:-}" ]]; then
    log "DNS and HTTPS/API reachability for ${GPUVALIDATOR_API_URL}"
    python3 - "${GPUVALIDATOR_API_URL}" <<'PY'
import socket, ssl, sys, urllib.request
from urllib.parse import urlparse
url=sys.argv[1].rstrip('/')
parsed=urlparse(url)
print('dns=', socket.gethostbyname(parsed.hostname))
ctx=ssl.create_default_context()
with socket.create_connection((parsed.hostname, parsed.port or 443), timeout=10) as sock:
    with ctx.wrap_socket(sock, server_hostname=parsed.hostname) as ssock:
        print('tls_subject=', ssock.getpeercert().get('subject'))
print('healthz=', urllib.request.urlopen(url + '/healthz', timeout=10).status)
PY
  else
    warn "GPUVALIDATOR_API_URL is not set; skipping API reachability."
  fi

  if [[ -n "${GPUVALIDATOR_API_URL:-}" && -n "${GPUVALIDATOR_AGENT_TOKEN:-}" && -n "${GPUVALIDATOR_AGENT_NAME:-}" && -x "${VENV_DIR}/bin/python" ]]; then
    log "Agent registration/heartbeat/poll connectivity"
    PYTHONPATH="${AGENT_DIR}" "${VENV_DIR}/bin/python" - <<'PY'
import json
from gpuvalidator_agent.capabilities import discover_capabilities
from gpuvalidator_agent.client import AgentApiClient
from gpuvalidator_agent.config import AgentConfig
cfg=AgentConfig.from_env()
client=AgentApiClient(cfg)
snapshot=discover_capabilities()
registration=client.register(snapshot.capabilities, snapshot.gpu_count)
agent_id=registration['agent_id']
heartbeat=client.heartbeat(agent_id, snapshot.capabilities, snapshot.gpu_count)
next_job=client.next_job(agent_id)
print(json.dumps({'agent_id': agent_id, 'gpu_count': snapshot.gpu_count, 'models': snapshot.gpu_models, 'heartbeat_ok': bool(heartbeat.get('agent')), 'next_job': next_job['id'] if next_job else None}, sort_keys=True))
PY
  else
    warn "Skipping registration/heartbeat/poll check; install agent and set GPUVALIDATOR_API_URL/GPUVALIDATOR_AGENT_TOKEN/GPUVALIDATOR_AGENT_NAME first."
  fi
}

main "$@"
