#!/usr/bin/env bash
set -euo pipefail
OUTPUT=""; DRY_RUN=0
while [[ $# -gt 0 ]]; do
  case "$1" in --output) OUTPUT="$2"; shift 2;; --dry-run) DRY_RUN=1; shift;; *) echo "Unknown argument: $1" >&2; exit 2;; esac
done
[[ -n "$OUTPUT" ]] || { echo "--output is required" >&2; exit 2; }
mkdir -p "$OUTPUT/raw"
GPU_COUNT="$(nvidia-smi -L 2>/dev/null | grep -c '^GPU ' || true)"
[[ "$GPU_COUNT" -ge 2 ]] || { echo "At least two visible GPUs are required for multi-GPU NCCL tests" >&2; exit 1; }
resolve() { [[ -n "${NCCL_TESTS_PATH:-}" && -x "$NCCL_TESTS_PATH/$1" ]] && echo "$NCCL_TESTS_PATH/$1" || command -v "$1"; }
for test in all_reduce_perf all_gather_perf reduce_scatter_perf broadcast_perf reduce_perf sendrecv_perf; do
  if ! bin="$(resolve "$test" 2>/dev/null)"; then echo "NOT AVAILABLE: $test" > "$OUTPUT/raw/${test}.stderr.txt"; continue; fi
  cmd=("$bin" -b "${MIN_BYTES:-8}" -e "${MAX_BYTES:-1G}" -f 2 -g "$GPU_COUNT" -n "${ITERS:-20}" -w "${WARMUP_ITERS:-5}")
  if [[ "$DRY_RUN" -eq 1 ]]; then printf 'DRY RUN: %q ' "${cmd[@]}"; echo; continue; fi
  NCCL_DEBUG=INFO NCCL_DEBUG_SUBSYS=INIT,GRAPH,P2P,SHM,NET "${cmd[@]}" >"$OUTPUT/raw/${test}.txt" 2>"$OUTPUT/raw/${test}.stderr.txt" || true
done
