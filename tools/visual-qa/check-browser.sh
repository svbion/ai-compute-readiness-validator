#!/usr/bin/env bash
set -euo pipefail

PORT="${GPUVALIDATOR_DEBUG_PORT:-9222}"

echo "=== Chrome Debug Endpoint ==="
curl -fsS "http://127.0.0.1:${PORT}/json/version"
echo
echo
echo "=== Open Targets ==="
curl -fsS "http://127.0.0.1:${PORT}/json"
echo
