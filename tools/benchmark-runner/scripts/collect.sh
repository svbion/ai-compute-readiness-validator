#!/usr/bin/env bash
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

GPU_COUNT="${GPU_COUNT:-}"
PLATFORM_LABEL="${PLATFORM_LABEL:-auto}"
PUBLIC_SAFE="${PUBLIC_SAFE:-1}"
AGENT_START_CMD="${AGENT_START_CMD:-}"
AGENT_HEALTH_CMD="${AGENT_HEALTH_CMD:-}"
AGENT_STOP_CMD="${AGENT_STOP_CMD:-}"

have nvidia-smi || die "nvidia-smi is required."
have git || die "git is required."
have make || die "make is required."

detected_gpu_count="$(nvidia-smi -L | grep -c '^GPU ' || true)"
(( detected_gpu_count > 0 )) || die "No NVIDIA GPUs detected."
[[ -n "$GPU_COUNT" ]] || GPU_COUNT="$detected_gpu_count"
(( GPU_COUNT <= detected_gpu_count )) || die "GPU_COUNT exceeds visible GPUs."

gpu_name="$(nvidia-smi --query-gpu=name --format=csv,noheader | head -n1 | xargs)"
[[ "$PLATFORM_LABEL" != "auto" ]] || PLATFORM_LABEL="$(slugify "$gpu_name")-${GPU_COUNT}gpu"

RUN_ID="$(date -u +'%Y%m%dT%H%M%SZ')-$(slugify "$PLATFORM_LABEL")"
RUN_DIR="${RUN_ROOT}/${RUN_ID}"
META_DIR="${RUN_DIR}/metadata"; RAW_DIR="${RUN_DIR}/raw"; LOG_DIR="${RUN_DIR}/logs"
SUMMARY_DIR="${RUN_DIR}/summary"; CHART_DIR="${RUN_DIR}/charts"; REPORT_DIR="${RUN_DIR}/report"
mkdir -p "$META_DIR" "$RAW_DIR" "$LOG_DIR" "$SUMMARY_DIR" "$CHART_DIR" "$REPORT_DIR"
export RUN_ID RUN_DIR META_DIR RAW_DIR LOG_DIR SUMMARY_DIR CHART_DIR REPORT_DIR
write_run_env
exec > >(tee -a "${RUN_DIR}/console.log") 2>&1

log "Collecting metadata for ${gpu_name} (${GPU_COUNT} GPUs)."
[[ -z "$AGENT_START_CMD" ]] || bash -lc "$AGENT_START_CMD" >"${LOG_DIR}/agent-start.log" 2>&1
[[ -z "$AGENT_HEALTH_CMD" ]] || bash -lc "$AGENT_HEALTH_CMD" >"${LOG_DIR}/agent-health.log" 2>&1
if [[ -n "$AGENT_STOP_CMD" ]]; then
  printf '%s' "$AGENT_STOP_CMD" >"${META_DIR}/agent-stop-command.private"
fi

cat >"${META_DIR}/run-manifest.env" <<EOF
run_id=${RUN_ID}
captured_at_utc=$(timestamp_utc)
platform_label=${PLATFORM_LABEL}
gpu_name=${gpu_name}
visible_gpu_count=${detected_gpu_count}
benchmark_gpu_count=${GPU_COUNT}
public_safe=${PUBLIC_SAFE}
EOF

run_capture_optional "${META_DIR}/nvidia-smi.txt" nvidia-smi
run_capture_optional "${META_DIR}/nvidia-smi-query.txt" nvidia-smi -q
run_capture_optional "${META_DIR}/nvidia-smi-list.txt" nvidia-smi -L
run_capture_optional "${META_DIR}/gpu-inventory.csv" nvidia-smi \
  --query-gpu=index,name,serial,pci.bus_id,driver_version,memory.total,power.limit,clocks.max.sm,clocks.max.memory,compute_cap,temperature.gpu,power.draw,utilization.gpu,utilization.memory,ecc.mode.current,ecc.errors.uncorrected.aggregate.total,clocks_throttle_reasons.active,pstate,pcie.link.gen.current,pcie.link.width.current,mig.mode.current \
  --format=csv,noheader,nounits

run_capture_optional "${META_DIR}/topo-m.txt" nvidia-smi topo -m
run_capture_optional "${META_DIR}/topo-mp.txt" nvidia-smi topo -mp
run_capture_optional "${META_DIR}/topo-p2p-read.txt" nvidia-smi topo -p2p r
run_capture_optional "${META_DIR}/topo-p2p-write.txt" nvidia-smi topo -p2p w
run_capture_optional "${META_DIR}/topo-p2p-nvlink.txt" nvidia-smi topo -p2p n
run_capture_optional "${META_DIR}/topo-p2p-atomics.txt" nvidia-smi topo -p2p a
run_capture_optional "${META_DIR}/topo-p2p-pcie.txt" nvidia-smi topo -p2p p

run_capture_optional "${META_DIR}/driver-version.txt" cat /proc/driver/nvidia/version
run_capture_optional "${META_DIR}/kernel.txt" uname -a
run_capture_optional "${META_DIR}/os-release.txt" cat /etc/os-release
run_capture_optional "${META_DIR}/cpu-lscpu.txt" lscpu
run_capture_optional "${META_DIR}/numa.txt" numactl --hardware
run_capture_optional "${META_DIR}/memory.txt" free -h
run_capture_optional "${META_DIR}/block-devices.txt" lsblk -e7 -o NAME,TYPE,SIZE,FSTYPE,MOUNTPOINTS,MODEL
run_capture_optional "${META_DIR}/filesystem.txt" df -hT
run_capture_optional "${META_DIR}/pci-nvidia.txt" bash -lc "lspci -nn | grep -Ei 'NVIDIA|3D controller|VGA' || true"
run_capture_optional "${META_DIR}/pci-tree.txt" lspci -tv
run_capture_optional "${META_DIR}/network-links.txt" ip -br link
run_capture_optional "${META_DIR}/network-addresses-redacted.txt" ip -br addr
run_capture_optional "${META_DIR}/rdma-links.txt" rdma link show
run_capture_optional "${META_DIR}/infiniband-devices.txt" ibv_devices
run_capture_optional "${META_DIR}/infiniband-device-info.txt" ibv_devinfo
run_capture_optional "${META_DIR}/ibstat.txt" ibstat
run_capture_optional "${META_DIR}/ofed-info.txt" ofed_info -s
run_capture_optional "${META_DIR}/cuda-nvcc.txt" nvcc --version
run_capture_optional "${META_DIR}/cuda-version-file.txt" bash -lc "cat /usr/local/cuda/version.json 2>/dev/null || cat /usr/local/cuda/version.txt 2>/dev/null || true"
run_capture_optional "${META_DIR}/compiler.txt" bash -lc "gcc --version 2>/dev/null | head -n1; g++ --version 2>/dev/null | head -n1"
run_capture_optional "${META_DIR}/loaded-nvidia-modules.txt" bash -lc "lsmod | grep -E 'nvidia|nv_peer_mem|nvidia_peermem' || true"
run_capture_optional "${META_DIR}/ldconfig-nccl-cuda.txt" bash -lc "ldconfig -p 2>/dev/null | grep -Ei 'libnccl|libcuda|libcudart' || true"
run_capture_optional "${META_DIR}/nccl-package-version.txt" bash -lc "dpkg -l 2>/dev/null | grep -i nccl || rpm -qa 2>/dev/null | grep -i nccl || true"

have p2pBandwidthLatencyTest && run_capture_optional "${META_DIR}/cuda-p2p-bandwidth-latency.txt" p2pBandwidthLatencyTest
have bandwidthTest && run_capture_optional "${META_DIR}/cuda-bandwidth-test.txt" bandwidthTest

{
  for key in RUNPOD_DC_ID RUNPOD_GPU_COUNT RUNPOD_CPU_COUNT CUDA_VERSION PYTORCH_VERSION; do
    [[ -z "${!key:-}" ]] || printf '%s=%s\n' "$key" "${!key}"
  done
} >"${META_DIR}/runtime-environment-safe.env"

find "$META_DIR" -type f ! -name '*.private' -print0 |
  while IFS= read -r -d '' f; do sanitize_file "$f"; done
log "Metadata collection complete."
