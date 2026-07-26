#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNNER_DIR="$ROOT_DIR/tools/benchmark-runner"
PYTHON_BIN="${PYTHON_BIN:-python3}"
if [[ -x "$ROOT_DIR/.venv/bin/python" ]]; then
  PYTHON_BIN="$ROOT_DIR/.venv/bin/python"
fi

GPU="auto"
PLATFORM="runpod"
OUTPUT=""
NCCL_TESTS_PATH=""
DRY_RUN=0
COLLECT_ONLY=0
BENCHMARK_ONLY=0
SKIP_ARCHIVE=0
SKIP_TELEMETRY=0
PUBLIC_PACKAGE=0
SANITIZE=1
LESSON_OUTPUT=""
MIN_BYTES="8"
MAX_BYTES="1G"
ITERS="20"
WARMUP_ITERS="5"

usage() {
  cat <<'USAGE'
Usage: tools/run-gpu-benchmark.sh [options]

Options:
  --gpu auto|b300|b200|h200|h100|a100|LABEL
  --platform NAME
  --output DIR
  --nccl-tests-path DIR
  --dry-run
  --collect-only
  --benchmark-only
  --full-suite
  --skip-telemetry
  --skip-archive
  --public-package
  --sanitize
  --lesson-output DIR
  --min-bytes|--message-min VALUE
  --max-bytes|--message-max VALUE
  --iters|--iterations N
  --warmup-iters|--warmups N
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --gpu) GPU="$2"; shift 2 ;;
    --platform) PLATFORM="$2"; shift 2 ;;
    --output) OUTPUT="$2"; shift 2 ;;
    --nccl-tests-path) NCCL_TESTS_PATH="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --collect-only) COLLECT_ONLY=1; shift ;;
    --benchmark-only) BENCHMARK_ONLY=1; shift ;;
    --full-suite) shift ;;
    --skip-telemetry) SKIP_TELEMETRY=1; shift ;;
    --skip-archive) SKIP_ARCHIVE=1; shift ;;
    --public-package) PUBLIC_PACKAGE=1; shift ;;
    --sanitize) SANITIZE=1; shift ;;
    --skip-sanitize) SANITIZE=0; shift ;;
    --lesson-output) LESSON_OUTPUT="$2"; shift 2 ;;
    --min-bytes|--message-min) MIN_BYTES="$2"; shift 2 ;;
    --max-bytes|--message-max) MAX_BYTES="$2"; shift 2 ;;
    --iters|--iterations) ITERS="$2"; shift 2 ;;
    --warmup-iters|--warmups) WARMUP_ITERS="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ -z "$OUTPUT" ]]; then
  OUTPUT="$ROOT_DIR/results/gpu-$(date -u +%Y%m%d-%H%M%S)"
fi

export GPU PLATFORM OUTPUT NCCL_TESTS_PATH MIN_BYTES MAX_BYTES ITERS WARMUP_ITERS SKIP_TELEMETRY PUBLIC_PACKAGE SANITIZE LESSON_OUTPUT
mkdir -p "$OUTPUT"/{raw,summary}

if [[ "$DRY_RUN" -eq 1 ]]; then
  "$PYTHON_BIN" -m ai_validator.benchmarks.workflow --platform "$PLATFORM" --gpu "$GPU" --output "$OUTPUT" --dry-run --nccl-tests-path "${NCCL_TESTS_PATH:-}" --message-min "$MIN_BYTES" --message-max "$MAX_BYTES" --iterations "$ITERS" --warmups "$WARMUP_ITERS"
  exit 0
fi

if [[ "$BENCHMARK_ONLY" -eq 0 ]]; then
  "$RUNNER_DIR/collect-gpu-fabric.sh" --output "$OUTPUT"
  "$PYTHON_BIN" "$RUNNER_DIR/analyze-gpu-fabric.py" \
    --input "$OUTPUT/raw" \
    --json "$OUTPUT/summary/gpu-fabric-summary.json" \
    --markdown "$OUTPUT/summary/GPU_FABRIC_VALIDATION.md"
fi

if [[ "$COLLECT_ONLY" -eq 0 ]]; then
  "$RUNNER_DIR/run-nccl-tests.sh" --output "$OUTPUT"
fi

if [[ "$SKIP_ARCHIVE" -eq 0 ]]; then
  "$RUNNER_DIR/archive-results.sh" "$OUTPUT"
fi

echo "Completed GPU benchmark workflow: $OUTPUT"
