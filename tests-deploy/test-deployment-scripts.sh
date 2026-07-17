#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "${TMP_ROOT}"' EXIT

pass() { printf '[test-deploy] PASS: %s\n' "$*"; }
fail() { printf '[test-deploy] FAIL: %s\n' "$*" >&2; exit 1; }
assert_contains() { grep -F "$2" "$1" >/dev/null || fail "$1 missing: $2"; }
assert_not_contains() { ! grep -E "$2" "$1" >/dev/null || fail "$1 leaked forbidden pattern: $2"; }

run_dry_install() {
  local out="$1" app_dir="$2"
  shift 2
  (cd "${ROOT_DIR}" && env "$@" ./deploy/install.sh) >"${out}" 2>&1
}

# AI_FACTORY_DRY_RUN=true must not mutate even when the app dir does not exist.
app_dir="${TMP_ROOT}/dry-app"
out="${TMP_ROOT}/dry.out"
run_dry_install "${out}" "${app_dir}" \
  AI_FACTORY_DRY_RUN=true \
  AI_FACTORY_APP_DIR="${app_dir}" \
  AI_FACTORY_BRANCH=hermes-mvp \
  AI_FACTORY_DOMAIN=gpuvalidator.com \
  AI_FACTORY_ENABLE_CADDY=true \
  AI_FACTORY_AUTH_REQUIRED=true
[[ ! -e "${app_dir}" ]] || fail "dry run created ${app_dir}"
assert_contains "${out}" "DRY RUN"
assert_contains "${out}" "enable_caddy=true"
assert_contains "${out}" "branch=hermes-mvp"
assert_not_contains "${out}" 'scrypt\$|token_urlsafe|SESSION_SECRET=.*[A-Za-z0-9_-]{16}'
pass "AI_FACTORY_DRY_RUN=true causes zero mutations and masks secrets"

# Backward-compatible DRY_RUN=1 remains supported.
out="${TMP_ROOT}/legacy-dry.out"
run_dry_install "${out}" "${TMP_ROOT}/legacy-app" DRY_RUN=1 APP_DIR="${TMP_ROOT}/legacy-app" REPO_BRANCH=hermes-mvp DOMAIN=gpuvalidator.com ENABLE_CADDY=false
assert_contains "${out}" "dry_run=true"
assert_contains "${out}" "enable_caddy=false"
pass "DRY_RUN=1 and legacy aliases remain supported"

# Boolean parsing accepts true/yes/on/1 case-insensitively.
for value in 1 true TRUE yes YES on ON; do
  out="${TMP_ROOT}/bool-${value}.out"
  run_dry_install "${out}" "${TMP_ROOT}/bool-${value}" AI_FACTORY_DRY_RUN="${value}" AI_FACTORY_APP_DIR="${TMP_ROOT}/bool-${value}" AI_FACTORY_ENABLE_CADDY="${value}" AI_FACTORY_DOMAIN=gpuvalidator.com
  assert_contains "${out}" "dry_run=true"
  assert_contains "${out}" "enable_caddy=true"
done
pass "truthy boolean parsing supports 1/true/yes/on"

# Alias resolution prefers AI_FACTORY_* and accepts branch/app dir aliases.
out="${TMP_ROOT}/alias.out"
run_dry_install "${out}" "${TMP_ROOT}/preferred" AI_FACTORY_DRY_RUN=true DRY_RUN=0 AI_FACTORY_APP_DIR="${TMP_ROOT}/preferred" APP_DIR="${TMP_ROOT}/fallback" AI_FACTORY_BRANCH=hermes-mvp REPO_BRANCH=wrong AI_FACTORY_DOMAIN=gpuvalidator.com
assert_contains "${out}" "app_dir=${TMP_ROOT}/preferred"
assert_contains "${out}" "branch=hermes-mvp"
pass "AI_FACTORY_APP_DIR and AI_FACTORY_BRANCH aliases resolve correctly"

# Caddy-enabled dry run prints Caddy operations but does not create files.
out="${TMP_ROOT}/caddy.out"
run_dry_install "${out}" "${TMP_ROOT}/caddy-app" AI_FACTORY_DRY_RUN=on AI_FACTORY_APP_DIR="${TMP_ROOT}/caddy-app" AI_FACTORY_ENABLE_CADDY=on AI_FACTORY_DOMAIN=gpuvalidator.com
assert_contains "${out}" "configure Caddy"
[[ ! -e "${TMP_ROOT}/caddy-app" ]] || fail "Caddy dry run mutated app dir"
pass "Caddy-enabled dry-run path is non-mutating"

# Retry succeeds when HTTP becomes available after a delay.
port_file="${TMP_ROOT}/port"
python3 - <<'PY' "${port_file}" &
import http.server, json, socketserver, sys, time
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/healthz':
            self.send_response(200); self.end_headers(); self.wfile.write(b'{"ok":true}')
        elif self.path == '/login':
            self.send_response(200); self.end_headers(); self.wfile.write(b'<div id="root">GPU Validator</div>')
        else:
            self.send_response(404); self.end_headers()
    def log_message(self, *args): pass
with socketserver.TCPServer(('127.0.0.1', 0), H) as srv:
    open(sys.argv[1], 'w').write(str(srv.server_address[1]))
    time.sleep(1.2)
    srv.serve_forever()
PY
server_pid=$!
for _ in {1..50}; do [[ -s "${port_file}" ]] && break; sleep 0.1; done
port="$(cat "${port_file}")"
(cd "${ROOT_DIR}" && AI_FACTORY_APP_DIR="${TMP_ROOT}/no-env" AI_FACTORY_PORT="${port}" AI_FACTORY_HEALTH_RETRIES=5 AI_FACTORY_HEALTH_RETRY_DELAY=1 ./deploy/healthcheck.sh --retry) >"${TMP_ROOT}/retry-ok.out" 2>&1
kill "${server_pid}" 2>/dev/null || true
pass "health retry succeeds when HTTP becomes available after delay"

# Retry fails after configured attempts.
if (cd "${ROOT_DIR}" && AI_FACTORY_APP_DIR="${TMP_ROOT}/no-env" AI_FACTORY_PORT=9 AI_FACTORY_HEALTH_RETRIES=2 AI_FACTORY_HEALTH_RETRY_DELAY=0 ./deploy/healthcheck.sh --retry) >"${TMP_ROOT}/retry-fail.out" 2>&1; then
  fail "health retry unexpectedly succeeded against closed port"
fi
pass "health retry fails after configured attempts"

# Dirty Git working tree is rejected by shared helper.
repo="${TMP_ROOT}/repo"
git init "${repo}" >/dev/null
git -C "${repo}" config user.email test@example.invalid
git -C "${repo}" config user.name Test
printf 'clean\n' >"${repo}/file.txt"
git -C "${repo}" add file.txt && git -C "${repo}" commit -m init >/dev/null
printf 'dirty\n' >>"${repo}/file.txt"
if bash -c "source '${ROOT_DIR}/deploy/lib/common.sh'; AI_FACTORY_APP_DIR='${repo}' AI_FACTORY_APP_USER='$(id -un)' load_deploy_config; ensure_clean_git_tree" >"${TMP_ROOT}/dirty.out" 2>&1; then
  fail "dirty git tree was not rejected"
fi
assert_contains "${TMP_ROOT}/dirty.out" "Refusing to update dirty working tree"
pass "dirty Git working tree is rejected"

# Safe repository ownership behavior: git operations are routed through app-user helper.
out="${TMP_ROOT}/safe-git.out"
bash -c "source '${ROOT_DIR}/deploy/lib/common.sh'; AI_FACTORY_DRY_RUN=true AI_FACTORY_APP_DIR='${TMP_ROOT}/safe' AI_FACTORY_APP_USER='ai-validator' load_deploy_config; git_in_repo fetch --prune origin" >"${out}" 2>&1
assert_contains "${out}" "DRY RUN as ai-validator"
pass "safe Git helper routes repository Git operations as APP_USER"

# Shell syntax validation for every deploy script.
bash -n "${ROOT_DIR}"/deploy/*.sh "${ROOT_DIR}"/deploy/lib/*.sh "${ROOT_DIR}"/tests-deploy/*.sh
pass "shell syntax validation passes"

printf '[test-deploy] all deployment script tests passed\n'
