#!/usr/bin/env bash
# Compatibility entrypoint for first-time single-server setup.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"
load_deploy_config

if [[ "${DRY_RUN}" == true ]]; then
  deploy_log "DRY RUN: bootstrap delegates to install.sh without mutation."
fi
exec "${SCRIPT_DIR}/install.sh" "$@"
