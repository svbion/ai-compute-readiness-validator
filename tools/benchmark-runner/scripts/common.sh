#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'
umask 077

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
WORKSPACE="${WORKSPACE:-/workspace}"
RUN_ROOT="${RUN_ROOT:-${WORKSPACE}/gpu-benchmark-runs}"
NCCL_TESTS_DIR="${NCCL_TESTS_DIR:-${WORKSPACE}/nccl-tests}"

timestamp_utc() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
slugify() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9._-]+/-/g;s/^-+|-+$//g'; }
have() { command -v "$1" >/dev/null 2>&1; }
log() { printf '[%s] %s\n' "$(timestamp_utc)" "$*" | tee -a "${RUN_DIR:-/dev/null}/run.log"; }
warn() { printf '[%s] WARNING: %s\n' "$(timestamp_utc)" "$*" | tee -a "${RUN_DIR:-/dev/null}/run.log" >&2; }
die() { printf '[%s] ERROR: %s\n' "$(timestamp_utc)" "$*" >&2; exit 1; }

run_capture() {
  local outfile="$1"; shift
  { printf '$'; printf ' %q' "$@"; printf '\n\n'; "$@"; } >"$outfile" 2>&1
}
run_capture_optional() {
  local outfile="$1"; shift
  if ! run_capture "$outfile" "$@"; then
    local rc=$?
    printf '\n[exit_code=%s]\n' "$rc" >>"$outfile"
    warn "Optional command failed: $*"
  fi
}
sanitize_file() {
  local file="$1"
  [[ "${PUBLIC_SAFE:-1}" == "1" ]] || return 0
  perl -0pi -e '
    s/GPU-[0-9a-fA-F-]{16,}/GPU-REDACTED/g;
    s/\b(?:\d{1,3}\.){3}\d{1,3}\b/IP-REDACTED/g;
    s/\bpod[_-]?[A-Za-z0-9_-]{8,}\b/POD-REDACTED/gi;
    s/((?:api[_-]?key|token|secret|password)\s*[=:]\s*)\S+/${1}REDACTED/gi;
  ' "$file" 2>/dev/null || true
}
load_run_env() {
  local f="${PROJECT_DIR}/.current-run.env"
  [[ -f "$f" ]] || die "Missing $f; run collect.sh first."
  source "$f"
  export RUN_ID RUN_DIR META_DIR RAW_DIR LOG_DIR SUMMARY_DIR CHART_DIR REPORT_DIR
}
write_run_env() {
  cat >"${PROJECT_DIR}/.current-run.env" <<EOF
export RUN_ID=$(printf '%q' "$RUN_ID")
export RUN_DIR=$(printf '%q' "$RUN_DIR")
export META_DIR=$(printf '%q' "$META_DIR")
export RAW_DIR=$(printf '%q' "$RAW_DIR")
export LOG_DIR=$(printf '%q' "$LOG_DIR")
export SUMMARY_DIR=$(printf '%q' "$SUMMARY_DIR")
export CHART_DIR=$(printf '%q' "$CHART_DIR")
export REPORT_DIR=$(printf '%q' "$REPORT_DIR")
EOF
}
