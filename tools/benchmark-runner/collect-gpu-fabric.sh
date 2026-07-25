#!/usr/bin/env bash
set -euo pipefail

OUTPUT=""
DRY_RUN=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --output) OUTPUT="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done
[[ -n "$OUTPUT" ]] || { echo "--output is required" >&2; exit 2; }
mkdir -p "$OUTPUT/raw"

capture() {
  local name="$1"; shift
  local stdout="$OUTPUT/raw/${name}.txt"
  local stderr="$OUTPUT/raw/${name}.stderr.txt"
  local meta="$OUTPUT/raw/${name}.meta.json"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf 'DRY RUN: %q ' "$@"; echo
    return 0
  fi

  local started ended rc
  started="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  set +e
  "$@" >"$stdout" 2>"$stderr"
  rc=$?
  set -e
  ended="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  python3 - "$meta" "$name" "$started" "$ended" "$rc" "$@" <<'PY'
import json, sys
meta, name, started, ended, rc, *argv = sys.argv[1:]
with open(meta, "w", encoding="utf-8") as f:
    json.dump({
        "name": name,
        "argv": argv,
        "started_at": started,
        "ended_at": ended,
        "return_code": int(rc),
        "status": "PASS" if int(rc) == 0 else "NOT_AVAILABLE_OR_FAILED",
    }, f, indent=2)
PY
}

capture nvidia-smi-list nvidia-smi -L
capture nvidia-smi-query nvidia-smi --query-gpu=index,name,uuid,pci.bus_id --format=csv
capture topology-matrix nvidia-smi topo -m
capture p2p-nvlink nvidia-smi topo -p2p n
capture p2p-read nvidia-smi topo -p2p r
capture p2p-write nvidia-smi topo -p2p w
capture p2p-atomics nvidia-smi topo -p2p a
capture nvlink-status nvidia-smi nvlink --status
capture nvlink-remote-info nvidia-smi nvlink --remotelinkinfo
capture nvlink-remote-pci nvidia-smi nvlink --pcibusid
capture fabric-full nvidia-smi -q
capture topo-pcie-only nvidia-smi topo -mp
capture driver-version nvidia-smi --query-gpu=driver_version --format=csv,noheader
capture cuda-version bash -lc 'command -v nvcc >/dev/null 2>&1 && nvcc --version || true'
capture hostname hostname
capture uname uname -a
capture lscpu lscpu
capture numactl bash -lc 'command -v numactl >/dev/null 2>&1 && numactl --hardware || true'
capture lspci bash -lc 'command -v lspci >/dev/null 2>&1 && lspci -D | grep -Ei "NVIDIA|Mellanox|InfiniBand|Ethernet" || true'
