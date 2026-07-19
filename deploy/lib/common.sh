#!/usr/bin/env bash
# Shared deployment helpers for GPU Validator production scripts.
# shellcheck shell=bash

if [[ -n "${AI_FACTORY_COMMON_SH_LOADED:-}" ]]; then
  return 0
fi
AI_FACTORY_COMMON_SH_LOADED=1

APP_NAME_DEFAULT="ai-factory-validator"
REPO_URL_DEFAULT="https://github.com/svbion/ai-compute-readiness-validator.git"
BRANCH_DEFAULT="hermes-mvp"
APP_DIR_DEFAULT="/opt/ai-factory-validator"
APP_USER_DEFAULT="ai-validator"
SERVICE_NAME_DEFAULT="ai-factory-validator.service"
DOMAIN_DEFAULT="gpuvalidator.com"
NODE_MAJOR_DEFAULT="22"
PORT_DEFAULT="3000"
HEALTH_RETRIES_DEFAULT="30"
HEALTH_RETRY_DELAY_DEFAULT="2"
HEALTH_TIMEOUT_DEFAULT="10"

deploy_log() { printf '[deploy] %s\n' "$*"; }
deploy_warn() { printf '[deploy] WARNING: %s\n' "$*" >&2; }
deploy_fail() { printf '[deploy] ERROR: %s\n' "$*" >&2; exit 1; }

resolve_env() {
  local preferred="$1" fallback="$2" default_value="$3" value=""
  if [[ -n "${!preferred+x}" ]]; then
    value="${!preferred}"
  elif [[ -n "${!fallback+x}" ]]; then
    value="${!fallback}"
  else
    value="${default_value}"
  fi
  printf '%s' "${value}"
}

bool_is_true() {
  case "$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')" in
    1|true|yes|on) return 0 ;;
    *) return 1 ;;
  esac
}

bool_is_false() {
  case "$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')" in
    0|false|no|off|'') return 0 ;;
    *) return 1 ;;
  esac
}

mask_value() {
  local name="$1" value="${2:-}"
  case "${name}" in
    *SECRET*|*PASSWORD*|*TOKEN*|*KEY*|*HASH*)
      if [[ -n "${value}" ]]; then printf '[SET length=%s]' "${#value}"; else printf '[EMPTY]'; fi
      ;;
    *)
      printf '%s' "${value}"
      ;;
  esac
}

secret_state() {
  local name="$1" value="${2:-}"
  if [[ -n "${value}" ]]; then
    printf '%s=SET length=%s\n' "${name}" "${#value}"
  else
    printf '%s=EMPTY\n' "${name}"
  fi
}

trim_whitespace() {
  local value="$1"
  value="${value#"${value%%[!$' \t\r\n']*}"}"
  value="${value%"${value##*[!$' \t\r\n']}"}"
  printf '%s' "${value}"
}

is_valid_env_name() {
  [[ "${1:-}" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]
}

dotenv_unquote_value() {
  local value
  value="$(trim_whitespace "$1")"
  if [[ "${value}" == "'"*"'" && "${#value}" -ge 2 ]]; then
    printf '%s' "${value:1:${#value}-2}"
  elif [[ "${value}" == '"'*'"' && "${#value}" -ge 2 ]]; then
    printf '%s' "${value:1:${#value}-2}"
  else
    printf '%s' "${value}"
  fi
}

dotenv_get() {
  local file="$1" requested_key="$2" line key raw_value value line_no=0
  is_valid_env_name "${requested_key}" || deploy_fail "Invalid dotenv variable name requested: ${requested_key}"
  [[ -f "${file}" ]] || return 1

  while IFS= read -r line || [[ -n "${line}" ]]; do
    line_no=$((line_no + 1))
    line="$(trim_whitespace "${line}")"
    [[ -z "${line}" || "${line}" == \#* ]] && continue
    [[ "${line}" == *"="* ]] || deploy_fail "Malformed dotenv line ${line_no} in ${file}: missing KEY=VALUE."
    key="$(trim_whitespace "${line%%=*}")"
    raw_value="${line#*=}"
    is_valid_env_name "${key}" || deploy_fail "Malformed dotenv line ${line_no} in ${file}: invalid variable name."
    [[ "${key}" == "${requested_key}" ]] || continue
    value="$(dotenv_unquote_value "${raw_value}")"
    printf '%s' "${value}"
    return 0
  done <"${file}"
  return 1
}

dotenv_load_selected() {
  local file="$1" requested_key value
  shift
  [[ -f "${file}" ]] || return 0
  for requested_key in "$@"; do
    is_valid_env_name "${requested_key}" || deploy_fail "Invalid dotenv variable name requested: ${requested_key}"
    if value="$(dotenv_get "${file}" "${requested_key}")"; then
      printf -v "${requested_key}" '%s' "${value}"
      export "${requested_key}"
    fi
  done
}

single_quote_dotenv_value() {
  local value="$1"
  if [[ "${value}" == *"'"* ]]; then
    deploy_fail "Cannot safely single-quote dotenv value containing a single quote."
  fi
  printf "'%s'" "${value}"
}

load_deploy_config() {
  APP_NAME="$(resolve_env AI_FACTORY_APP_NAME APP_NAME "${APP_NAME_DEFAULT}")"
  APP_DIR="$(resolve_env AI_FACTORY_APP_DIR APP_DIR "${APP_DIR_DEFAULT}")"
  APP_USER="$(resolve_env AI_FACTORY_APP_USER APP_USER "${APP_USER_DEFAULT}")"
  REPO_URL="$(resolve_env AI_FACTORY_REPO_URL REPO_URL "${REPO_URL_DEFAULT}")"
  REPO_BRANCH="$(resolve_env AI_FACTORY_BRANCH REPO_BRANCH "${BRANCH_DEFAULT}")"
  SERVICE_NAME="$(resolve_env AI_FACTORY_SERVICE_NAME SERVICE_NAME "${SERVICE_NAME_DEFAULT}")"
  DOMAIN="$(resolve_env AI_FACTORY_DOMAIN DOMAIN "${DOMAIN_DEFAULT}")"
  ENABLE_CADDY_RAW="$(resolve_env AI_FACTORY_ENABLE_CADDY ENABLE_CADDY "false")"
  AUTH_REQUIRED="$(resolve_env AI_FACTORY_AUTH_REQUIRED AUTH_REQUIRED "")"
  DRY_RUN_RAW="$(resolve_env AI_FACTORY_DRY_RUN DRY_RUN "false")"
  NODE_MAJOR="$(resolve_env AI_FACTORY_NODE_MAJOR NODE_MAJOR "${NODE_MAJOR_DEFAULT}")"
  PORT="$(resolve_env AI_FACTORY_PORT PORT "${PORT_DEFAULT}")"
  HEALTH_RETRIES="$(resolve_env AI_FACTORY_HEALTH_RETRIES HEALTH_RETRIES "${HEALTH_RETRIES_DEFAULT}")"
  HEALTH_RETRY_DELAY="$(resolve_env AI_FACTORY_HEALTH_RETRY_DELAY HEALTH_RETRY_DELAY "${HEALTH_RETRY_DELAY_DEFAULT}")"
  HEALTH_TIMEOUT="$(resolve_env AI_FACTORY_HEALTH_TIMEOUT TIMEOUT "${HEALTH_TIMEOUT_DEFAULT}")"
  ALLOW_DIRTY_UPDATE="$(resolve_env AI_FACTORY_ALLOW_DIRTY_UPDATE ALLOW_DIRTY_UPDATE "false")"
  CADDY_CONFIG="$(resolve_env AI_FACTORY_CADDY_CONFIG CADDY_CONFIG "/etc/caddy/Caddyfile")"

  if bool_is_true "${DRY_RUN_RAW}"; then DRY_RUN=true; else DRY_RUN=false; fi
  if bool_is_true "${ENABLE_CADDY_RAW}"; then ENABLE_CADDY=true; else ENABLE_CADDY=false; fi

  validate_basic_config
}

validate_integer() {
  local name="$1" value="$2"
  [[ "${value}" =~ ^[0-9]+$ ]] || deploy_fail "${name} must be an integer, got '${value}'."
}

validate_basic_config() {
  [[ -n "${APP_DIR}" && "${APP_DIR}" = /* ]] || deploy_fail "AI_FACTORY_APP_DIR/APP_DIR must be an absolute path."
  [[ -n "${APP_USER}" ]] || deploy_fail "AI_FACTORY_APP_USER/APP_USER cannot be empty."
  [[ -n "${REPO_BRANCH}" ]] || deploy_fail "AI_FACTORY_BRANCH/REPO_BRANCH cannot be empty."
  [[ -n "${SERVICE_NAME}" ]] || deploy_fail "AI_FACTORY_SERVICE_NAME/SERVICE_NAME cannot be empty."
  validate_integer PORT "${PORT}"
  validate_integer AI_FACTORY_HEALTH_RETRIES "${HEALTH_RETRIES}"
  validate_integer AI_FACTORY_HEALTH_RETRY_DELAY "${HEALTH_RETRY_DELAY}"
  validate_integer AI_FACTORY_HEALTH_TIMEOUT "${HEALTH_TIMEOUT}"
  if [[ -n "${DOMAIN}" ]]; then validate_domain "${DOMAIN}"; fi
}

validate_domain() {
  local domain_name="$1"
  [[ "${domain_name}" =~ ^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$ ]] \
    || deploy_fail "Invalid domain '${domain_name}'. Use a hostname such as gpuvalidator.com."
}

require_root() {
  [[ "${EUID}" -eq 0 ]] || deploy_fail "$1 must be run as root for real mutations. Use sudo -E, or AI_FACTORY_DRY_RUN=true for a no-change preview."
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || deploy_fail "Required command not found: $1"
}

run_cmd() {
  if [[ "${DRY_RUN:-false}" == true ]]; then
    printf '[deploy] DRY RUN: '
    printf '%q ' "$@"
    printf '\n'
  else
    "$@"
  fi
}

run_cmd_capture_ok() {
  if [[ "${DRY_RUN:-false}" == true ]]; then
    printf '[deploy] DRY RUN: '
    printf '%q ' "$@"
    printf '\n'
    return 0
  fi
  "$@"
}

run_as_app() {
  if [[ "${DRY_RUN:-false}" == true ]]; then
    printf '[deploy] DRY RUN as %s: ' "${APP_USER}"
    printf '%q ' "$@"
    printf '\n'
    return 0
  fi
  sudo -H -u "${APP_USER}" -- "$@"
}

run_as_app_in_repo() {
  if [[ "${DRY_RUN:-false}" == true ]]; then
    printf '[deploy] DRY RUN as %s in %s: ' "${APP_USER}" "${APP_DIR}"
    printf '%q ' "$@"
    printf '\n'
    return 0
  fi
  if [[ "$(id -un 2>/dev/null || true)" == "${APP_USER}" ]]; then
    (cd "${APP_DIR}" && "$@")
  else
    (cd "${APP_DIR}" && sudo -H -u "${APP_USER}" -- "$@")
  fi
}

run_as_app_shell_in_repo() {
  local script="$1"
  if [[ "${DRY_RUN:-false}" == true ]]; then
    printf '[deploy] DRY RUN as %s in %s: bash -lc %q\n' "${APP_USER}" "${APP_DIR}" "${script}"
    return 0
  fi
  (cd "${APP_DIR}" && sudo -H -u "${APP_USER}" -- bash -lc "${script}")
}

git_in_repo() { run_as_app_in_repo git "$@"; }

git_output_in_repo() {
  if [[ "${DRY_RUN:-false}" == true ]]; then return 0; fi
  if [[ "$(id -un 2>/dev/null || true)" == "${APP_USER}" ]]; then
    (cd "${APP_DIR}" && git "$@")
  else
    (cd "${APP_DIR}" && sudo -H -u "${APP_USER}" -- git "$@")
  fi
}

is_runtime_generated_path() {
  local path="$1"
  case "${path}" in
    artifacts/*|.cache/*|.npm/*|.lesshst|dist/*|.venv/*|node_modules/*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_runtime_generated_status_line() {
  local line="$1" path old_path new_path
  path="${line:3}"
  if [[ "${path}" == *" -> "* ]]; then
    old_path="${path%% -> *}"
    new_path="${path##* -> }"
    is_runtime_generated_path "${old_path}" && is_runtime_generated_path "${new_path}"
    return
  fi
  is_runtime_generated_path "${path}"
}

filter_git_status() {
  local status="$1" mode="$2" blocking_status="" runtime_status="" line
  while IFS= read -r line; do
    [[ -n "${line}" ]] || continue
    if is_runtime_generated_status_line "${line}"; then
      runtime_status+="${line}"$'\n'
    else
      blocking_status+="${line}"$'\n'
    fi
  done <<<"${status}"
  case "${mode}" in
    blocking) printf '%s' "${blocking_status}" ;;
    runtime) printf '%s' "${runtime_status}" ;;
    state)
      if [[ -n "${blocking_status}" ]]; then printf dirty-source
      elif [[ -n "${runtime_status}" ]]; then printf runtime-only
      else printf clean
      fi
      ;;
    *) deploy_fail "Unknown filter_git_status mode: ${mode}" ;;
  esac
}

git_status_raw_in_repo() {
  [[ -d "${APP_DIR}/.git" ]] || return 1
  git_output_in_repo status --porcelain=v1 2>/dev/null
}

git_status_state_in_repo() {
  local status
  status="$(git_status_raw_in_repo 2>/dev/null || true)"
  filter_git_status "${status}" state
}

git_current_branch_in_repo() {
  local branch
  branch="$(git_output_in_repo branch --show-current 2>/dev/null || true)"
  if [[ -n "${branch}" ]]; then printf '%s' "${branch}"; else printf detached; fi
}

git_commit_sha_in_repo() { git_output_in_repo rev-parse HEAD 2>/dev/null || printf unknown; }
git_short_commit_in_repo() { git_output_in_repo rev-parse --short HEAD 2>/dev/null || printf unknown; }
git_commit_subject_in_repo() { git_output_in_repo log -1 --pretty=%s 2>/dev/null || printf unknown; }

git_origin_sync_state_in_repo() {
  local head upstream
  head="$(git_output_in_repo rev-parse HEAD 2>/dev/null || true)"
  upstream="$(git_output_in_repo rev-parse "origin/${REPO_BRANCH}" 2>/dev/null || true)"
  if [[ -z "${head}" ]]; then printf unknown
  elif [[ -z "${upstream}" ]]; then printf "origin/${REPO_BRANCH}-unknown"
  elif [[ "${head}" == "${upstream}" ]]; then printf "matches origin/%s" "${REPO_BRANCH}"
  else printf "differs from origin/%s" "${REPO_BRANCH}"
  fi
}

ensure_clean_git_tree() {
  [[ -d "${APP_DIR}/.git" ]] || return 0
  if bool_is_true "${ALLOW_DIRTY_UPDATE}"; then
    deploy_warn "AI_FACTORY_ALLOW_DIRTY_UPDATE is true; proceeding despite any local modifications."
    return 0
  fi
  local status blocking_status runtime_status
  status="$(git_status_raw_in_repo 2>/dev/null || git -C "${APP_DIR}" status --porcelain=v1)"
  blocking_status="$(filter_git_status "${status}" blocking)"
  runtime_status="$(filter_git_status "${status}" runtime)"
  if [[ -n "${blocking_status}" ]]; then
    printf '%s' "${blocking_status}" >&2
    deploy_fail "Refusing to update dirty working tree in ${APP_DIR}. Commit/stash changes or set AI_FACTORY_ALLOW_DIRTY_UPDATE=true deliberately."
  fi
  if [[ -n "${runtime_status}" ]]; then
    deploy_log "Repository contains runtime-generated artifacts only."
    deploy_log "Continuing with deployment."
  fi
}

safe_git_update() {
  ensure_clean_git_tree
  git_in_repo fetch --prune origin
  git_in_repo checkout "${REPO_BRANCH}"
  git_in_repo pull --ff-only origin "${REPO_BRANCH}"
}

retry() {
  local attempts="$1" delay="$2" description="$3"
  shift 3
  local i=1
  while (( i <= attempts )); do
    if "$@"; then
      deploy_log "${description}: ok"
      return 0
    fi
    deploy_log "${description}: attempt ${i}/${attempts} failed; retrying in ${delay}s"
    sleep "${delay}"
    i=$((i + 1))
  done
  return 1
}

source_env_file_if_present() {
  local env_file="${APP_DIR}/.env.production"
  if [[ -f "${env_file}" ]]; then
    dotenv_load_selected "${env_file}" \
      PORT NODE_ENV BASE_URL DOMAIN AUTH_REQUIRED VERIFY_CADDY VERIFY_TLS \
      AI_FACTORY_DOMAIN AI_FACTORY_AUTH_REQUIRED AI_FACTORY_SESSION_SECRET \
      AI_FACTORY_REVIEWER_EMAIL AI_FACTORY_REVIEWER_PASSWORD_HASH \
      AI_FACTORY_AUTH_TEST_BYPASS_TOKEN AI_FACTORY_BASE_URL \
      AI_FACTORY_VERIFY_CADDY AI_FACTORY_VERIFY_TLS
    PORT="${PORT:-${PORT_DEFAULT}}"
    DOMAIN="${AI_FACTORY_DOMAIN:-${DOMAIN:-${DOMAIN_DEFAULT}}}"
    AUTH_REQUIRED="${AI_FACTORY_AUTH_REQUIRED:-${AUTH_REQUIRED:-}}"
  fi
}

print_effective_config() {
  cat <<EOF
[deploy] Effective configuration${DRY_RUN:+ (DRY RUN if true)}:
[deploy]   product=GPU Validator
[deploy]   app_dir=${APP_DIR}
[deploy]   app_user=${APP_USER}
[deploy]   repo_url=${REPO_URL}
[deploy]   branch=${REPO_BRANCH}
[deploy]   service_name=${SERVICE_NAME}
[deploy]   port=${PORT}
[deploy]   domain=${DOMAIN}
[deploy]   enable_caddy=${ENABLE_CADDY}
[deploy]   auth_required=${AUTH_REQUIRED:-default-production}
[deploy]   dry_run=${DRY_RUN}
EOF
}

validate_auth_config() {
  local env_file="${APP_DIR}/.env.production"
  [[ -f "${env_file}" ]] || deploy_fail "Missing ${env_file}."
  source_env_file_if_present
  deploy_log "Authentication configuration state:"
  secret_state AI_FACTORY_SESSION_SECRET "${AI_FACTORY_SESSION_SECRET:-}"
  secret_state AI_FACTORY_REVIEWER_EMAIL "${AI_FACTORY_REVIEWER_EMAIL:-}"
  secret_state AI_FACTORY_REVIEWER_PASSWORD_HASH "${AI_FACTORY_REVIEWER_PASSWORD_HASH:-}"
  secret_state AI_FACTORY_AUTH_TEST_BYPASS_TOKEN "${AI_FACTORY_AUTH_TEST_BYPASS_TOKEN:-}"
  if bool_is_true "${AI_FACTORY_AUTH_REQUIRED:-${AUTH_REQUIRED:-}}" || [[ "${NODE_ENV:-}" == production && -z "${AI_FACTORY_AUTH_REQUIRED:-${AUTH_REQUIRED:-}}" ]]; then
    [[ -n "${AI_FACTORY_SESSION_SECRET:-}" && "${AI_FACTORY_SESSION_SECRET:-}" != "replace-with-at-least-32-random-characters" ]] \
      || deploy_fail "AI_FACTORY_SESSION_SECRET is required before production activation."
    [[ -n "${AI_FACTORY_REVIEWER_EMAIL:-}" && "${AI_FACTORY_REVIEWER_EMAIL:-}" != "reviewer@example.invalid" ]] \
      || deploy_fail "AI_FACTORY_REVIEWER_EMAIL must be set to the real reviewer email before public activation."
    [[ -n "${AI_FACTORY_REVIEWER_PASSWORD_HASH:-}" && "${AI_FACTORY_REVIEWER_PASSWORD_HASH:-}" != *replace-with* ]] \
      || deploy_fail "AI_FACTORY_REVIEWER_PASSWORD_HASH must be set before public activation. Generate it with src/server/auth.ts."
  fi
}

create_env_if_missing() {
  local env_file="${APP_DIR}/.env.production"
  if [[ -f "${env_file}" ]]; then
    deploy_log "Preserving existing ${env_file}; secrets are not overwritten."
    run_cmd chown "${APP_USER}:${APP_USER}" "${env_file}"
    run_cmd chmod 0640 "${env_file}"
    return 0
  fi
  deploy_log "Creating ${env_file} from .env.production.example and generating local secrets."
  run_cmd cp "${APP_DIR}/.env.production.example" "${env_file}"
  if [[ "${DRY_RUN:-false}" == false ]]; then
    python3 - "${env_file}" <<'PY'
import pathlib, secrets, sys
path = pathlib.Path(sys.argv[1])
text = path.read_text()
def sq(value: str) -> str:
    if "'" in value:
        raise ValueError("generated secret unexpectedly contained a single quote")
    return f"'{value}'"
text = text.replace("AI_FACTORY_SESSION_SECRET='replace-with-at-least-32-random-characters'", f"AI_FACTORY_SESSION_SECRET={sq(secrets.token_urlsafe(48))}")
text = text.replace("AI_FACTORY_AUTH_TEST_BYPASS_TOKEN='replace-with-local-verification-token'", f"AI_FACTORY_AUTH_TEST_BYPASS_TOKEN={sq(secrets.token_urlsafe(32))}")
path.write_text(text)
PY
  else
    deploy_log "DRY RUN: would generate AI_FACTORY_SESSION_SECRET and AI_FACTORY_AUTH_TEST_BYPASS_TOKEN without printing them."
  fi
  run_cmd chown "${APP_USER}:${APP_USER}" "${env_file}"
  run_cmd chmod 0640 "${env_file}"
}

install_nodejs() {
  if command -v node >/dev/null 2>&1 && [[ "$(node -p 'process.versions.node.split(`.`)[0]' 2>/dev/null || true)" == "${NODE_MAJOR}" ]]; then
    deploy_log "Node.js ${NODE_MAJOR} already installed: $(node --version)"
    return 0
  fi
  deploy_log "Installing Node.js ${NODE_MAJOR} from NodeSource"
  run_cmd install -d -m 0755 /etc/apt/keyrings
  if [[ "${DRY_RUN:-false}" == true ]]; then
    deploy_log "DRY RUN: would download NodeSource signing key and write apt source."
  else
    curl -fsSL "https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key" | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
    printf 'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_%s.x nodistro main\n' "${NODE_MAJOR}" > /etc/apt/sources.list.d/nodesource.list
  fi
  run_cmd apt-get update
  run_cmd apt-get install -y nodejs
}

wait_for_service_ready() {
  deploy_log "Waiting for systemd service ${SERVICE_NAME} to become active"
  if ! retry "${HEALTH_RETRIES}" "${HEALTH_RETRY_DELAY}" "systemd active" systemctl is-active --quiet "${SERVICE_NAME}"; then
    print_failure_diagnostics
    deploy_fail "${SERVICE_NAME} did not become active."
  fi
  deploy_log "Waiting for backend HTTP health on port ${PORT}"
  if ! "${APP_DIR}/deploy/healthcheck.sh" --retry; then
    print_failure_diagnostics
    deploy_fail "Backend HTTP health did not become ready."
  fi
}

print_failure_diagnostics() {
  deploy_warn "Failure diagnostics for ${SERVICE_NAME} and port ${PORT}:"
  systemctl --no-pager --full status "${SERVICE_NAME}" >&2 || true
  journalctl -u "${SERVICE_NAME}" -n 120 --no-pager >&2 || true
  if command -v ss >/dev/null 2>&1; then
    ss -ltnp "sport = :${PORT}" >&2 || true
  elif command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"${PORT}" -sTCP:LISTEN >&2 || true
  fi
}

render_caddy_config() {
  local output="$1" caddy_domain="$2" caddy_port="$3" www_domain
  www_domain="www.${caddy_domain}"
  validate_domain "${caddy_domain}"
  cat >"${output}" <<EOF
# Generated by GPU Validator deploy scripts. Do not commit production secrets here.
# Canonical domain: ${caddy_domain}

${www_domain} {
	redir https://${caddy_domain}{uri} permanent
}

${caddy_domain} {
	encode zstd gzip

	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
		X-Content-Type-Options "nosniff"
		X-Frame-Options "DENY"
		Referrer-Policy "strict-origin-when-cross-origin"
		Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()"
		-Server
	}

	reverse_proxy 127.0.0.1:${caddy_port}
}
EOF
}

install_or_update_caddy() {
  [[ "${ENABLE_CADDY}" == true ]] || { deploy_log "Caddy disabled; skipping Caddy install/configuration."; return 0; }
  [[ -n "${DOMAIN}" ]] || deploy_fail "AI_FACTORY_DOMAIN/DOMAIN is required when AI_FACTORY_ENABLE_CADDY=true."
  validate_domain "${DOMAIN}"
  deploy_log "Caddy enabled for ${DOMAIN}; backend health already passed."
  if ! getent hosts "${DOMAIN}" >/dev/null 2>&1; then
    deploy_warn "DNS for ${DOMAIN} does not resolve from this host yet. Caddy HTTPS issuance may fail until DNS points here."
  fi

  if ! command -v caddy >/dev/null 2>&1; then
    deploy_log "Installing Caddy from official repository"
    run_cmd apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
    if [[ "${DRY_RUN:-false}" == true ]]; then
      deploy_log "DRY RUN: would add official Caddy apt repository."
    else
      curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
      curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
    fi
    run_cmd apt-get update
    run_cmd apt-get install -y caddy
  else
    deploy_log "Caddy already installed: $(caddy version 2>/dev/null || printf 'version unavailable')"
  fi

  local rendered
  rendered="$(mktemp)"
  render_caddy_config "${rendered}" "${DOMAIN}" "${PORT}"
  if [[ "${DRY_RUN:-false}" == true ]]; then
    deploy_log "DRY RUN: would backup ${CADDY_CONFIG}, install rendered Caddyfile, validate, enable, and reload caddy."
    rm -f "${rendered}"
    return 0
  fi
  if [[ -f "${CADDY_CONFIG}" ]]; then
    cp "${CADDY_CONFIG}" "${CADDY_CONFIG}.bak.$(date +%Y%m%d%H%M%S)"
  fi
  install -D -m 0644 "${rendered}" "${CADDY_CONFIG}"
  rm -f "${rendered}"
  caddy validate --config "${CADDY_CONFIG}"
  systemctl enable caddy
  systemctl reload caddy || systemctl restart caddy
  systemctl is-active --quiet caddy || deploy_fail "Caddy did not become active."
}

final_summary() {
  local commit="unknown" short_commit="unknown" subject="unknown" branch="unknown" sync_state="unknown" service_state="unknown" health_state="not checked" caddy_state="disabled"
  if [[ -d "${APP_DIR}/.git" ]]; then
    branch="$(git_current_branch_in_repo)"
    commit="$(git_commit_sha_in_repo)"
    short_commit="$(git_short_commit_in_repo)"
    subject="$(git_commit_subject_in_repo)"
    sync_state="$(git_origin_sync_state_in_repo)"
  fi
  if command -v systemctl >/dev/null 2>&1; then
    service_state="$(systemctl is-active "${SERVICE_NAME}" 2>/dev/null || printf unknown)"
    if [[ "${ENABLE_CADDY}" == true ]]; then caddy_state="$(systemctl is-active caddy 2>/dev/null || printf unknown)"; fi
  fi
  if curl -fsS -m 3 "http://127.0.0.1:${PORT}/healthz" >/dev/null 2>&1; then health_state="ok"; else health_state="failed"; fi
  cat <<EOF

[deploy] Deployment summary
[deploy]   product: GPU Validator
[deploy]   configured branch: ${REPO_BRANCH}
[deploy]   checked-out branch: ${branch}
[deploy]   commit: ${commit}
[deploy]   short commit: ${short_commit}
[deploy]   commit subject: ${subject}
[deploy]   origin sync: ${sync_state}
[deploy]   app directory: ${APP_DIR}
[deploy]   service state: ${service_state}
[deploy]   local health: ${health_state}
[deploy]   domain: ${DOMAIN}
[deploy]   Caddy state: ${caddy_state}
[deploy]   public URL: https://${DOMAIN}
[deploy]   authentication required: ${AI_FACTORY_AUTH_REQUIRED:-${AUTH_REQUIRED:-default-production}}
[deploy]   secrets preserved: yes; existing .env.production values are not overwritten
[deploy]   next verification command: sudo -E ${APP_DIR}/deploy/status.sh && sudo -E ${APP_DIR}/deploy/verify.sh
EOF
}
