#!/usr/bin/env bash
# Compatibility entrypoint for first-time single-server setup.
# Keep deployment logic in install.sh; this wrapper exists so operators can run
# the documented bootstrap command without guessing which script owns install.

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "${SCRIPT_DIR}/install.sh" "$@"
