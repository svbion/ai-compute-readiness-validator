#!/usr/bin/env bash
set -euo pipefail
OUTPUT="$1"
if command -v sha256sum >/dev/null 2>&1; then
  (cd "$OUTPUT" && find raw summary -type f -print0 | sort -z | xargs -0 sha256sum) > "$OUTPUT/SHA256SUMS"
else
  (cd "$OUTPUT" && find raw summary -type f -print0 | sort -z | xargs -0 shasum -a 256) > "$OUTPUT/SHA256SUMS"
fi
archive="${OUTPUT}.tar.gz"
tar -czf "$archive" -C "$(dirname "$OUTPUT")" "$(basename "$OUTPUT")"
if command -v sha256sum >/dev/null 2>&1; then sha256sum "$archive" > "$archive.sha256"; else shasum -a 256 "$archive" > "$archive.sha256"; fi
