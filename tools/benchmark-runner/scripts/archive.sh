#!/usr/bin/env bash
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
load_run_env

find "$RUN_DIR" -type f ! -name SHA256SUMS ! -name '*.private' -print0 |
  sort -z | xargs -0 shasum -a 256 >"${RUN_DIR}/SHA256SUMS"

cat >"${RUN_DIR}/COMPLETION.md" <<EOF
# Benchmark Capture Completion

- **Run ID:** \`${RUN_ID}\`
- **Completed:** \`$(timestamp_utc)\`
- **Results:** \`summary/RESULTS.md\`
- **HTML report:** \`report/results.html\`
- **Checksums:** \`SHA256SUMS\`

Inspect every artifact before publishing.
EOF

if [[ -f "${META_DIR}/agent-stop-command.private" ]]; then
  cmd="$(cat "${META_DIR}/agent-stop-command.private")"
  bash -lc "$cmd" >"${LOG_DIR}/agent-stop.log" 2>&1 || true
  rm -f "${META_DIR}/agent-stop-command.private"
fi

RUN_ARCHIVE="${RUN_ROOT}/${RUN_ID}.tar.gz"
tar -C "$RUN_ROOT" -czf "$RUN_ARCHIVE" "$RUN_ID"
shasum -a 256 "$RUN_ARCHIVE" >"${RUN_ARCHIVE}.sha256"
cat >>"${PROJECT_DIR}/.current-run.env" <<EOF
export RUN_ARCHIVE=$(printf '%q' "$RUN_ARCHIVE")
EOF
log "Archive created: ${RUN_ARCHIVE}"
