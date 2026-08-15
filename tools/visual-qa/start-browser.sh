#!/usr/bin/env bash
set -euo pipefail

PORT="${GPUVALIDATOR_DEBUG_PORT:-9222}"
PROFILE="${GPUVALIDATOR_CHROME_PROFILE:-$HOME/.gpuvalidator-chrome-debug}"
URL="${GPUVALIDATOR_URL:-http://127.0.0.1:3000}"

mkdir -p "$PROFILE"

if command -v google-chrome-stable >/dev/null 2>&1; then
  BROWSER="$(command -v google-chrome-stable)"
elif command -v google-chrome >/dev/null 2>&1; then
  BROWSER="$(command -v google-chrome)"
elif command -v chromium >/dev/null 2>&1; then
  BROWSER="$(command -v chromium)"
else
  echo "No supported Chromium browser found." >&2
  exit 1
fi

exec "$BROWSER" \
  --remote-debugging-port="$PORT" \
  --user-data-dir="$PROFILE" \
  --no-first-run \
  --no-default-browser-check \
  "$URL"
