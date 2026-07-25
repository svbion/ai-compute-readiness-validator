#!/usr/bin/env bash
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
load_run_env

NCCL_TESTS_REPO="${NCCL_TESTS_REPO:-https://github.com/NVIDIA/nccl-tests.git}"
NCCL_TESTS_REF="${NCCL_TESTS_REF:-master}"
BEGIN_SIZE="${BEGIN_SIZE:-8}"; END_SIZE="${END_SIZE:-1G}"; STEP_FACTOR="${STEP_FACTOR:-2}"
ITERATIONS="${ITERATIONS:-20}"; WARMUP_ITERS="${WARMUP_ITERS:-5}"
CHECK_ITERS="${CHECK_ITERS:-1}"; DATATYPE="${DATATYPE:-float}"; AGG_ITERS="${AGG_ITERS:-1}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-900}"
BUILD_JOBS="${BUILD_JOBS:-$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 8)}"
GPU_COUNT="${GPU_COUNT:-$(grep '^benchmark_gpu_count=' "${META_DIR}/run-manifest.env" | cut -d= -f2)}"

if [[ ! -d "${NCCL_TESTS_DIR}/.git" ]]; then
  git clone --depth 1 --branch "$NCCL_TESTS_REF" "$NCCL_TESTS_REPO" "$NCCL_TESTS_DIR" >"${LOG_DIR}/nccl-tests-clone.log" 2>&1
else
  git -C "$NCCL_TESTS_DIR" fetch --depth 1 origin "$NCCL_TESTS_REF" >"${LOG_DIR}/nccl-tests-fetch.log" 2>&1 || true
  git -C "$NCCL_TESTS_DIR" checkout -f FETCH_HEAD >"${LOG_DIR}/nccl-tests-checkout.log" 2>&1 || true
fi

NCCL_TESTS_COMMIT="$(git -C "$NCCL_TESTS_DIR" rev-parse HEAD)"
echo "$NCCL_TESTS_COMMIT" >"${META_DIR}/nccl-tests-commit.txt"
CUDA_HOME="${CUDA_HOME:-/usr/local/cuda}"
args=("CUDA_HOME=${CUDA_HOME}")
[[ -z "${NCCL_HOME:-}" ]] || args+=("NCCL_HOME=${NCCL_HOME}")
make -C "$NCCL_TESTS_DIR" clean >"${LOG_DIR}/nccl-tests-clean.log" 2>&1 || true
make -C "$NCCL_TESTS_DIR" -j"$BUILD_JOBS" "${args[@]}" >"${LOG_DIR}/nccl-tests-build.log" 2>&1

TEST_BUILD_DIR="${NCCL_TESTS_DIR}/build"
tests=(all_reduce_perf all_gather_perf reduce_scatter_perf broadcast_perf reduce_perf alltoall_perf sendrecv_perf)

export CUDA_VISIBLE_DEVICES="${CUDA_VISIBLE_DEVICES:-$(seq -s, 0 $((GPU_COUNT - 1)))}"
export NCCL_DEBUG="${NCCL_DEBUG:-INFO}"
export NCCL_DEBUG_SUBSYS="${NCCL_DEBUG_SUBSYS:-INIT,ENV,GRAPH,NET}"
export NCCL_ASYNC_ERROR_HANDLING="${NCCL_ASYNC_ERROR_HANDLING:-1}"
export NCCL_CHECKS_DISABLE="${NCCL_CHECKS_DISABLE:-0}"

{ echo "CUDA_VISIBLE_DEVICES=${CUDA_VISIBLE_DEVICES}"; env | grep '^NCCL_' | grep -Ev 'KEY|TOKEN|SECRET|PASSWORD' | sort; } >"${META_DIR}/nccl-environment-safe.env"
cat >>"${META_DIR}/run-manifest.env" <<EOF
begin_size=${BEGIN_SIZE}
end_size=${END_SIZE}
step_factor=${STEP_FACTOR}
iterations=${ITERATIONS}
warmup_iterations=${WARMUP_ITERS}
check_iterations=${CHECK_ITERS}
datatype=${DATATYPE}
aggregate_iterations=${AGG_ITERS}
timeout_seconds=${TIMEOUT_SECONDS}
EOF

common=(-b "$BEGIN_SIZE" -e "$END_SIZE" -f "$STEP_FACTOR" -g "$GPU_COUNT" -w "$WARMUP_ITERS" -n "$ITERATIONS" -c "$CHECK_ITERS" -d "$DATATYPE" -a "$AGG_ITERS")

for test in "${tests[@]}"; do
  binary="${TEST_BUILD_DIR}/${test}"
  [[ -x "$binary" ]] || die "Missing benchmark binary: $binary"
  start="$(date +%s)"
  set +e
  if have timeout; then timeout --signal=TERM --kill-after=30 "$TIMEOUT_SECONDS" "$binary" "${common[@]}" >"${RAW_DIR}/${test}.txt" 2>"${RAW_DIR}/${test}.stderr.txt"; rc=$?
  else "$binary" "${common[@]}" >"${RAW_DIR}/${test}.txt" 2>"${RAW_DIR}/${test}.stderr.txt"; rc=$?; fi
  set -e
  end="$(date +%s)"
  cat >"${RAW_DIR}/${test}.meta.env" <<EOF
test=${test}
exit_code=${rc}
duration_seconds=$((end-start))
binary=${binary}
EOF
  sanitize_file "${RAW_DIR}/${test}.txt"; sanitize_file "${RAW_DIR}/${test}.stderr.txt"
  (( rc == 0 )) && log "$test completed in $((end-start)) seconds." || warn "$test failed with exit code $rc."
done
log "NCCL benchmark suite complete."
