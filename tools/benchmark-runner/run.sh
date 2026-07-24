#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PROJECT_DIR
VENV_DIR="${VENV_DIR:-${PROJECT_DIR}/.venv}"
SKIP_PYTHON_SETUP="${SKIP_PYTHON_SETUP:-0}"

if [[ "$SKIP_PYTHON_SETUP" != "1" ]]; then
  [[ -x "${VENV_DIR}/bin/python" ]] || python3 -m venv "$VENV_DIR"
  "${VENV_DIR}/bin/python" -m pip install --disable-pip-version-check -q -r "${PROJECT_DIR}/requirements.txt"
  export PYTHON_BIN="${VENV_DIR}/bin/python"
else
  export PYTHON_BIN="${PYTHON_BIN:-python3}"
fi

"${PROJECT_DIR}/scripts/collect.sh"
"${PROJECT_DIR}/scripts/benchmark.sh"
"${PYTHON_BIN}" "${PROJECT_DIR}/scripts/summarize.py"
"${PYTHON_BIN}" "${PROJECT_DIR}/scripts/topology.py"
"${PYTHON_BIN}" "${PROJECT_DIR}/scripts/charts.py"
"${PYTHON_BIN}" "${PROJECT_DIR}/scripts/report.py"
"${PROJECT_DIR}/scripts/archive.sh"

source "${PROJECT_DIR}/.current-run.env"
printf '\nRun complete.\nRun directory: %s\nArchive: %s\n' "$RUN_DIR" "$RUN_ARCHIVE"
