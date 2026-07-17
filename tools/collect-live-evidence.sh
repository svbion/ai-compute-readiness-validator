#!/usr/bin/env bash
# Portable read-only live-evidence collection for NVIDIA GPU infrastructure.
# This script installs nothing, uses no sudo, changes no scheduler/Kubernetes
# state, and returns non-zero only when the validator itself cannot produce a
# report bundle.

set -Eeuo pipefail

PROFILE="${PROFILE:-auto}"
VALIDATION_NAME="${VALIDATION_NAME:-live-nvidia-evidence}"
OUTPUT_ROOT="${OUTPUT_ROOT:-live-evidence}"
CREATE_ARCHIVE="${CREATE_ARCHIVE:-1}"
SANITIZE="${SANITIZE:-1}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
COLLECT_DIR="${OUTPUT_ROOT}/${VALIDATION_NAME}-${TIMESTAMP}"
RAW_DIR="${COLLECT_DIR}/raw"
REPORT_DIR="${COLLECT_DIR}/reports"
MANIFEST="${COLLECT_DIR}/manifest.json"

mkdir -p "${RAW_DIR}" "${REPORT_DIR}"

log() { printf '[collect-live-evidence] %s\n' "$*"; }

run_optional() {
  local label="$1"
  shift
  local outfile="${RAW_DIR}/${label}.txt"
  printf '$ %q ' "$@" >"${outfile}"
  printf '\n' >>"${outfile}"
  if command -v "$1" >/dev/null 2>&1; then
    log "Collecting ${label}: $*"
    if "$@" >>"${outfile}" 2>&1; then
      printf '%s\n' "available" >"${RAW_DIR}/${label}.status"
    else
      printf '%s\n' "failed-or-denied" >"${RAW_DIR}/${label}.status"
    fi
  else
    log "Unavailable utility for ${label}: $1"
    printf 'utility unavailable: %s\n' "$1" >>"${outfile}"
    printf '%s\n' "unavailable" >"${RAW_DIR}/${label}.status"
  fi
}

if ! command -v python3 >/dev/null 2>&1; then
  log "python3 is required but unavailable"
  exit 2
fi

if command -v ai-validator >/dev/null 2>&1; then
  VALIDATOR=(ai-validator)
elif python3 -m ai_validator --help >/dev/null 2>&1; then
  VALIDATOR=(python3 -m ai_validator)
else
  log "ai-validator is not available on PATH and python3 -m ai_validator failed"
  exit 2
fi

log "Collecting into ${COLLECT_DIR}"

run_optional os-release cat /etc/os-release
run_optional uname uname -a
run_optional dmi-sys-vendor cat /sys/class/dmi/id/sys_vendor
run_optional dmi-product-name cat /sys/class/dmi/id/product_name
run_optional dmi-product-version cat /sys/class/dmi/id/product_version
run_optional dmi-board-vendor cat /sys/class/dmi/id/board_vendor
run_optional dmi-board-name cat /sys/class/dmi/id/board_name
run_optional nvidia-smi nvidia-smi
run_optional nvidia-smi-L nvidia-smi -L
run_optional nvidia-smi-q nvidia-smi -q
run_optional nvidia-smi-topo nvidia-smi topo -m
run_optional nvidia-smi-nvlink nvidia-smi nvlink --status
run_optional nvidia-smi-query nvidia-smi --query-gpu=index,name,uuid,serial,driver_version,pci.bus_id,temperature.gpu,ecc.errors.uncorrected.volatile.total --format=csv,noheader
run_optional dcgmi-discovery dcgmi discovery -l
run_optional dcgmi-health dcgmi health -c
run_optional ibstat ibstat
run_optional ibv-devinfo ibv_devinfo
run_optional rdma-link rdma link
run_optional ibdev2netdev ibdev2netdev
run_optional sinfo sinfo
run_optional sinfo-nodes sinfo -N -l
run_optional scontrol-ping scontrol ping
run_optional scontrol-show-node scontrol show node
run_optional scontrol-show-partition scontrol show partition
run_optional kubectl-context kubectl config current-context
run_optional kubectl-nodes kubectl get nodes -o json
run_optional kubectl-pods kubectl get pods -A
run_optional kubectl-daemonsets kubectl get daemonsets -A
run_optional kubectl-clusterpolicies kubectl get clusterpolicies.nvidia.com

log "Running validator profile ${PROFILE}"
if ! "${VALIDATOR[@]}" validate --profile "${PROFILE}" --name "${VALIDATION_NAME}" --output-dir "${REPORT_DIR}"; then
  log "validator failed to produce reports"
  exit 3
fi

GIT_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || printf 'unknown')"
python3 - <<'PY' "${MANIFEST}" "${COLLECT_DIR}" "${PROFILE}" "${VALIDATION_NAME}" "${TIMESTAMP}" "${GIT_COMMIT}"
import json, pathlib, sys
manifest, root, profile, name, timestamp, git_commit = sys.argv[1:]
root_path = pathlib.Path(root)
files = sorted(str(path.relative_to(root_path)) for path in root_path.rglob('*') if path.is_file() and path.name != 'manifest.json')
data = {
    'validation_source': 'Live Linux Host',
    'collection_timestamp': timestamp,
    'validation_name': name,
    'selected_profile': profile,
    'collector_version': 'ai-validator',
    'git_commit': git_commit,
    'simulated': False,
    'hardware_identity_verified': False,
    'source_confidence': 'live-host-read-only-commands',
    'limitations': ['Missing optional utilities are recorded as unavailable.', 'No sudo, package installation, restarts, scheduler mutation, Kubernetes mutation, stress tests, or DCGM diagnostics were executed.'],
    'files': files,
}
pathlib.Path(manifest).write_text(json.dumps(data, indent=2) + '\n')
PY

(cd "${COLLECT_DIR}" && shasum -a 256 $(find . -type f -not -name checksums.sha256 | sort) > checksums.sha256)

if [[ "${SANITIZE}" == "1" && -f tools/sanitize-evidence.py ]]; then
  log "Creating sanitized copy"
  python3 tools/sanitize-evidence.py "${COLLECT_DIR}" --output "${COLLECT_DIR}-sanitized" --redact-ips --redact-domains --redact-serials --redact-macs
fi

if [[ "${CREATE_ARCHIVE}" == "1" ]]; then
  ARCHIVE_TARGET="${COLLECT_DIR}-sanitized"
  [[ -d "${ARCHIVE_TARGET}" ]] || ARCHIVE_TARGET="${COLLECT_DIR}"
  tar -czf "${ARCHIVE_TARGET}.tar.gz" "${ARCHIVE_TARGET}"
  log "Created archive ${ARCHIVE_TARGET}.tar.gz"
fi

log "Collected files:"
find "${COLLECT_DIR}" -type f | sort
[[ -d "${COLLECT_DIR}-sanitized" ]] && find "${COLLECT_DIR}-sanitized" -type f | sort
log "Collection complete"
