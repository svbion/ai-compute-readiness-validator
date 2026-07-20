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

# Caddy configuration rendering must initialize domain variables before use.
out="${TMP_ROOT}/caddy-render.out"
bash -c "source '${ROOT_DIR}/deploy/lib/common.sh'; AI_FACTORY_DRY_RUN=true AI_FACTORY_APP_DIR='${TMP_ROOT}/caddy-render-app' AI_FACTORY_ENABLE_CADDY=true AI_FACTORY_DOMAIN=gpuvalidator.com AI_FACTORY_PORT=3000 load_deploy_config; install_or_update_caddy" >"${out}" 2>&1
assert_contains "${out}" "Caddy enabled for gpuvalidator.com"
assert_contains "${out}" "would backup"
assert_not_contains "${out}" 'unbound variable'
pass "Caddy-enabled render path initializes domain variables"

# Safe dotenv parser handles shell-sensitive values without eval/expansion.
env_file="${TMP_ROOT}/safe.env"
bad_touch="${TMP_ROOT}/bad"
backtick_touch="${TMP_ROOT}/backtick-bad"
cat >"${env_file}" <<EOF
# Comments and blanks are ignored
ORDINARY=plain-value
SINGLE='single quoted value'
DOUBLE="double quoted value"
DOLLAR='scrypt\$6\$literal'
SCRYPT='scrypt\$1234567890abcdef\$abcdef1234567890'
MULTI_EQUALS='left=middle=right'
COMMAND='\$(touch ${bad_touch})'
BACKTICK='\`touch ${backtick_touch}\`'
META='semi; amp& pipe| redirect> star* literal'
AI_FACTORY_REVIEWER_PASSWORD_HASH='scrypt\$1234567890abcdef\$abcdef1234567890'
EOF
out="${TMP_ROOT}/dotenv.out"
bash -c "source '${ROOT_DIR}/deploy/lib/common.sh'; f='${env_file}'; printf 'ORDINARY=%s\n' \"\$(dotenv_get \"\${f}\" ORDINARY)\"; printf 'SINGLE=%s\n' \"\$(dotenv_get \"\${f}\" SINGLE)\"; printf 'DOUBLE=%s\n' \"\$(dotenv_get \"\${f}\" DOUBLE)\"; printf 'DOLLAR=%s\n' \"\$(dotenv_get \"\${f}\" DOLLAR)\"; printf 'SCRYPT=%s\n' \"\$(dotenv_get \"\${f}\" SCRYPT)\"; printf 'MULTI_EQUALS=%s\n' \"\$(dotenv_get \"\${f}\" MULTI_EQUALS)\"; printf 'COMMAND=%s\n' \"\$(dotenv_get \"\${f}\" COMMAND)\"; printf 'BACKTICK=%s\n' \"\$(dotenv_get \"\${f}\" BACKTICK)\"; printf 'META=%s\n' \"\$(dotenv_get \"\${f}\" META)\"; dotenv_load_selected \"\${f}\" AI_FACTORY_REVIEWER_PASSWORD_HASH; secret_state AI_FACTORY_REVIEWER_PASSWORD_HASH \"\${AI_FACTORY_REVIEWER_PASSWORD_HASH:-}\"" >"${out}" 2>&1
assert_contains "${out}" "ORDINARY=plain-value"
assert_contains "${out}" "SINGLE=single quoted value"
assert_contains "${out}" "DOUBLE=double quoted value"
assert_contains "${out}" 'DOLLAR=scrypt$6$literal'
assert_contains "${out}" 'SCRYPT=scrypt$1234567890abcdef$abcdef1234567890'
assert_contains "${out}" "MULTI_EQUALS=left=middle=right"
assert_contains "${out}" "COMMAND=\$(touch ${bad_touch})"
assert_contains "${out}" "BACKTICK=\`touch ${backtick_touch}\`"
assert_contains "${out}" "META=semi; amp& pipe| redirect> star* literal"
assert_contains "${out}" "AI_FACTORY_REVIEWER_PASSWORD_HASH=SET length=40"
assert_not_contains "${out}" 'AI_FACTORY_REVIEWER_PASSWORD_HASH=scrypt\$1234567890abcdef\$abcdef1234567890'
[[ ! -e "${bad_touch}" ]] || fail "dotenv command substitution was executed"
[[ ! -e "${backtick_touch}" ]] || fail "dotenv backtick command was executed"
pass "safe dotenv parser preserves shell-sensitive values without command execution"

malformed_env="${TMP_ROOT}/malformed.env"
printf 'BAD-NAME=value\n' >"${malformed_env}"
if bash -c "source '${ROOT_DIR}/deploy/lib/common.sh'; dotenv_get '${malformed_env}' ORDINARY" >"${TMP_ROOT}/malformed.out" 2>&1; then
  fail "malformed dotenv variable name was not rejected"
fi
assert_contains "${TMP_ROOT}/malformed.out" "invalid variable name"
pass "malformed dotenv variable names are rejected safely"

# Existing .env.production is preserved; first-install generated secrets are quoted.
env_app="${TMP_ROOT}/env-app"
mkdir -p "${env_app}"
cp "${ROOT_DIR}/.env.production.example" "${env_app}/.env.production.example"
printf "AI_FACTORY_SESSION_SECRET='existing-secret'\n" >"${env_app}/.env.production"
bash -c "source '${ROOT_DIR}/deploy/lib/common.sh'; run_cmd() { if [[ \"\$1\" == chown || \"\$1\" == chmod ]]; then return 0; fi; \"\$@\"; }; AI_FACTORY_APP_DIR='${env_app}' AI_FACTORY_APP_USER='$(id -un)' load_deploy_config; create_env_if_missing" >"${TMP_ROOT}/preserve.out" 2>&1
assert_contains "${env_app}/.env.production" "existing-secret"
pass "existing .env.production is not overwritten"

generated_app="${TMP_ROOT}/generated-app"
mkdir -p "${generated_app}"
cp "${ROOT_DIR}/.env.production.example" "${generated_app}/.env.production.example"
bash -c "source '${ROOT_DIR}/deploy/lib/common.sh'; run_cmd() { if [[ \"\$1\" == chown || \"\$1\" == chmod ]]; then return 0; fi; \"\$@\"; }; AI_FACTORY_APP_DIR='${generated_app}' AI_FACTORY_APP_USER='$(id -un)' load_deploy_config; create_env_if_missing" >"${TMP_ROOT}/generated.out" 2>&1
grep -E "^AI_FACTORY_SESSION_SECRET='[^']+'$" "${generated_app}/.env.production" >/dev/null || fail "generated session secret was not single-quoted"
grep -E "^AI_FACTORY_AUTH_TEST_BYPASS_TOKEN='[^']+'$" "${generated_app}/.env.production" >/dev/null || fail "generated auth test token was not single-quoted"
assert_not_contains "${TMP_ROOT}/generated.out" 'AI_FACTORY_SESSION_SECRET=.*[A-Za-z0-9_-]{16}|AI_FACTORY_AUTH_TEST_BYPASS_TOKEN=.*[A-Za-z0-9_-]{16}'
pass "first-install generated secrets are safely quoted and not printed"

# Retry succeeds when HTTP becomes available after a delay.
port_file="${TMP_ROOT}/port"
python3 - <<'PY' "${port_file}" &
import http.server, json, socketserver, sys, time
class H(http.server.BaseHTTPRequestHandler):
    def authed(self):
        return self.headers.get('x-ai-factory-test-auth') == 'token$with$characters'
    def do_GET(self):
        if self.path == '/healthz':
            self.send_response(200); self.end_headers(); self.wfile.write(b'{"ok":true}')
        elif self.path == '/login':
            self.send_response(200); self.end_headers(); self.wfile.write(b'<div id="root">GPU Validator</div>')
        elif self.path == '/':
            self.send_response(200); self.end_headers(); self.wfile.write(b'<div id="root">GPU Validator</div>')
        elif self.path == '/portal':
            if self.authed(): self.send_response(200); self.end_headers(); self.wfile.write(b'<div id="root">GPU Validator</div>')
            else: self.send_response(302); self.send_header('Location', '/login'); self.end_headers()
        elif self.path.startswith('/api/results'):
            if self.authed(): self.send_response(200); self.end_headers(); self.wfile.write(b'{"classification":"Ready","overall_score":100}')
            else: self.send_response(401); self.end_headers(); self.wfile.write(b'{"error":"auth required"}')
        elif self.path.startswith('/reports/'):
            if not self.authed(): self.send_response(401); self.end_headers(); self.wfile.write(b'{"error":"auth required"}'); return
            self.send_response(200); self.end_headers()
            if self.path.endswith('/html'): self.wfile.write(b'<html><body>GPU Validator Validation Report</body></html>')
            elif self.path.endswith('/markdown'): self.wfile.write(b'# GPU Validator\n\nEvaluation Summary')
            else: self.wfile.write(b'{"classification":"Ready"}')
        else:
            self.send_response(404); self.end_headers()
    def do_POST(self):
        if self.path == '/api/run-scenario':
            self.send_response(405); self.end_headers(); self.wfile.write(b'{"error":"read only"}')
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
verify_app="${TMP_ROOT}/verify-app"
mkdir -p "${verify_app}/artifacts"
for file in healthy-results.json degraded-results.json latest-results.json; do printf '{"classification":"Ready"}\n' >"${verify_app}/artifacts/${file}"; done
for file in healthy-report.html degraded-report.html; do printf '<html>GPU Validator Validation Report</html>\n' >"${verify_app}/artifacts/${file}"; done
for file in healthy-report.md degraded-report.md; do printf '# GPU Validator\n\nEvaluation Summary\n' >"${verify_app}/artifacts/${file}"; done
cat >"${verify_app}/.env.production" <<EOF
PORT=${port}
NODE_ENV=production
AI_FACTORY_AUTH_REQUIRED=true
AI_VALIDATOR_USER_STORE=/opt/ai-factory-validator/shared/users/store.json
AI_FACTORY_SESSION_SECRET='secret\$with\$characters'
AI_FACTORY_REVIEWER_USERNAME=reviewer
AI_FACTORY_REVIEWER_PASSWORD_HASH='scrypt\$1234567890abcdef\$abcdef1234567890'
AI_FACTORY_AUTH_TEST_BYPASS_TOKEN='token\$with\$characters'
AI_FACTORY_VERIFY_CADDY=0
AI_FACTORY_VERIFY_TLS=0
EOF
(cd "${ROOT_DIR}" && AI_FACTORY_APP_DIR="${verify_app}" AI_FACTORY_PORT="${port}" AI_FACTORY_HEALTH_RETRIES=2 AI_FACTORY_HEALTH_RETRY_DELAY=0 ./deploy/healthcheck.sh) >"${TMP_ROOT}/hash-healthcheck.out" 2>&1
(cd "${ROOT_DIR}" && AI_FACTORY_APP_DIR="${verify_app}" AI_FACTORY_PORT="${port}" AI_FACTORY_HEALTH_RETRIES=2 AI_FACTORY_HEALTH_RETRY_DELAY=0 ./deploy/verify.sh) >"${TMP_ROOT}/hash-verify.out" 2>&1
(cd "${ROOT_DIR}" && AI_FACTORY_APP_DIR="${verify_app}" AI_FACTORY_PORT="${port}" AI_FACTORY_HEALTH_RETRIES=2 AI_FACTORY_HEALTH_RETRY_DELAY=0 ./deploy/status.sh) >"${TMP_ROOT}/hash-status.out" 2>&1
assert_not_contains "${TMP_ROOT}/hash-healthcheck.out" 'scrypt\$1234567890abcdef\$abcdef1234567890|token\$with\$characters|secret\$with\$characters'
assert_not_contains "${TMP_ROOT}/hash-verify.out" 'scrypt\$1234567890abcdef\$abcdef1234567890|token\$with\$characters|secret\$with\$characters'
assert_not_contains "${TMP_ROOT}/hash-status.out" 'scrypt\$1234567890abcdef\$abcdef1234567890|token\$with\$characters|secret\$with\$characters|SET length='
assert_contains "${TMP_ROOT}/hash-status.out" "AI_FACTORY_SESSION_SECRET"
assert_contains "${TMP_ROOT}/hash-status.out" "AI_FACTORY_REVIEWER_PASSWORD_HASH"
grep -E '^\[status\] AI_FACTORY_SESSION_SECRET[[:space:]]+SET$' "${TMP_ROOT}/hash-status.out" >/dev/null || fail "status did not report session secret as SET only"
grep -E '^\[status\] AI_FACTORY_REVIEWER_PASSWORD_HASH[[:space:]]+SET$' "${TMP_ROOT}/hash-status.out" >/dev/null || fail "status did not report reviewer hash as SET only"
pass "healthcheck and verify load quoted dollar-containing auth values safely"
kill "${server_pid}" 2>/dev/null || true
pass "health retry succeeds when HTTP becomes available after delay"

# Retry fails after configured attempts.
if (cd "${ROOT_DIR}" && AI_FACTORY_APP_DIR="${TMP_ROOT}/no-env" AI_FACTORY_PORT=9 AI_FACTORY_HEALTH_RETRIES=2 AI_FACTORY_HEALTH_RETRY_DELAY=0 ./deploy/healthcheck.sh --retry) >"${TMP_ROOT}/retry-fail.out" 2>&1; then
  fail "health retry unexpectedly succeeded against closed port"
fi
pass "health retry fails after configured attempts"

init_dirty_repo() {
  local repo="$1"
  git init "${repo}" >/dev/null
  git -C "${repo}" config user.email test@example.invalid
  git -C "${repo}" config user.name Test
  mkdir -p "${repo}/artifacts" "${repo}/src"
  printf '{"clean":true}\n' >"${repo}/artifacts/latest-results.json"
  printf 'clean\n' >"${repo}/src/app.ts"
  git -C "${repo}" add artifacts/latest-results.json src/app.ts && git -C "${repo}" commit -m init >/dev/null
}

run_clean_check() {
  local repo="$1" out="$2"
  bash -c "source '${ROOT_DIR}/deploy/lib/common.sh'; AI_FACTORY_APP_DIR='${repo}' AI_FACTORY_APP_USER='$(id -un)' load_deploy_config; ensure_clean_git_tree" >"${out}" 2>&1
}

run_git_status_probe() {
  local repo="$1" out="$2"
  bash -c "source '${ROOT_DIR}/deploy/lib/common.sh'; AI_FACTORY_APP_DIR='${repo}' AI_FACTORY_APP_USER='$(id -un)' AI_FACTORY_BRANCH=main load_deploy_config; printf 'branch=%s\n' \"\$(git_current_branch_in_repo)\"; printf 'short=%s\n' \"\$(git_short_commit_in_repo)\"; printf 'subject=%s\n' \"\$(git_commit_subject_in_repo)\"; printf 'sync=%s\n' \"\$(git_origin_sync_state_in_repo)\"; printf 'tree=%s\n' \"\$(git_status_state_in_repo)\"" >"${out}" 2>&1
}

# Persistent shared user store is approved runtime state and is preserved by deployment helpers.
shared_repo="${TMP_ROOT}/git-shared-runtime"
init_dirty_repo "${shared_repo}"
mkdir -p "${shared_repo}/shared/users"
printf '{"schema_version":"1.0.0","users":[{"username":"sfrazier"}],"audit_entries":[]}\n' >"${shared_repo}/shared/users/store.json"
run_clean_check "${shared_repo}" "${TMP_ROOT}/shared-runtime.out"
assert_contains "${TMP_ROOT}/shared-runtime.out" "runtime-generated artifacts only"
shared_state="$(bash -c "source '${ROOT_DIR}/deploy/lib/common.sh'; AI_FACTORY_APP_DIR='${shared_repo}' AI_FACTORY_APP_USER='$(id -un)' load_deploy_config; printf '%s' \"\$(git_status_state_in_repo)\"")"
[[ "${shared_state}" == "runtime-only" ]] || fail "shared runtime state was not classified as runtime-only: ${shared_state}"
grep -F 'sfrazier' "${shared_repo}/shared/users/store.json" >/dev/null || fail "shared user store was not preserved"
pass "shared/users/store.json is approved persistent runtime state"

add_origin_for_repo() {
  local repo="$1" origin="$2"
  git init --bare "${origin}" >/dev/null
  git -C "${repo}" remote add origin "${origin}"
  git -C "${repo}" branch -M main
  git -C "${repo}" push -u origin main >/dev/null 2>&1
}

# Git status helpers report a normal branch, commit details, sync, and clean tree.
repo="${TMP_ROOT}/git-normal"
origin="${TMP_ROOT}/git-normal-origin.git"
init_dirty_repo "${repo}"
add_origin_for_repo "${repo}" "${origin}"
run_git_status_probe "${repo}" "${TMP_ROOT}/git-normal.out"
assert_contains "${TMP_ROOT}/git-normal.out" "branch=main"
assert_contains "${TMP_ROOT}/git-normal.out" "short="
assert_contains "${TMP_ROOT}/git-normal.out" "subject=init"
assert_contains "${TMP_ROOT}/git-normal.out" "sync=matches origin/main"
assert_contains "${TMP_ROOT}/git-normal.out" "tree=clean"
pass "Git status helper reports normal branch and origin sync"

# Git status helpers accurately report detached HEAD.
repo="${TMP_ROOT}/git-detached"
origin="${TMP_ROOT}/git-detached-origin.git"
init_dirty_repo "${repo}"
add_origin_for_repo "${repo}" "${origin}"
git -C "${repo}" checkout --detach HEAD >/dev/null 2>&1
run_git_status_probe "${repo}" "${TMP_ROOT}/git-detached.out"
assert_contains "${TMP_ROOT}/git-detached.out" "branch=detached"
pass "Git status helper reports detached HEAD only when actually detached"

# Git commands route through the application-user helper and work as the current user in tests.
repo="${TMP_ROOT}/git-app-user"
init_dirty_repo "${repo}"
bash -c "source '${ROOT_DIR}/deploy/lib/common.sh'; AI_FACTORY_APP_DIR='${repo}' AI_FACTORY_APP_USER='$(id -un)' load_deploy_config; git_output_in_repo rev-parse --short HEAD" >"${TMP_ROOT}/git-app-user.out" 2>&1
assert_not_contains "${TMP_ROOT}/git-app-user.out" 'sudo|dubious ownership|permission denied'
pass "Git status helper can run as APP_USER"

# Missing or inaccessible repositories do not masquerade as detached branches.
missing_repo="${TMP_ROOT}/missing-repo"
if bash -c "source '${ROOT_DIR}/deploy/lib/common.sh'; AI_FACTORY_APP_DIR='${missing_repo}' AI_FACTORY_APP_USER='$(id -un)' load_deploy_config; git_status_raw_in_repo" >"${TMP_ROOT}/git-missing.out" 2>&1; then
  fail "missing repository unexpectedly produced git status"
fi
pass "missing repository is detected without fake detached status"

# Inaccessible repositories report unknown Git fields rather than masquerading as detached HEAD.
repo="${TMP_ROOT}/git-inaccessible"
init_dirty_repo "${repo}"
chmod 000 "${repo}/.git"
bash -c "source '${ROOT_DIR}/deploy/lib/common.sh'; AI_FACTORY_APP_DIR='${repo}' AI_FACTORY_APP_USER='$(id -un)' load_deploy_config; printf 'readable=%s\n' \"\$(git_repo_readable_in_repo && printf yes || printf no)\"; printf 'branch=%s\n' \"\$(git_current_branch_in_repo)\"; printf 'commit=%s\n' \"\$(git_commit_sha_in_repo)\"" >"${TMP_ROOT}/git-inaccessible.out" 2>&1
chmod 700 "${repo}/.git"
assert_contains "${TMP_ROOT}/git-inaccessible.out" "readable=no"
assert_contains "${TMP_ROOT}/git-inaccessible.out" "branch=unknown"
assert_contains "${TMP_ROOT}/git-inaccessible.out" "commit=unknown"
pass "inaccessible repository is detected without fake detached status"

# Runtime-generated artifacts alone do not block safe updates.
repo="${TMP_ROOT}/runtime-only"
init_dirty_repo "${repo}"
printf '{"dirty":true}\n' >"${repo}/artifacts/latest-results.json"
mkdir -p "${repo}/.cache" "${repo}/.npm"
printf 'cache\n' >"${repo}/.cache/runtime"
printf 'npm\n' >"${repo}/.npm/runtime"
printf 'less history\n' >"${repo}/.lesshst"
run_clean_check "${repo}" "${TMP_ROOT}/runtime-only.out"
assert_contains "${TMP_ROOT}/runtime-only.out" "Repository contains runtime-generated artifacts only."
assert_contains "${TMP_ROOT}/runtime-only.out" "Continuing with deployment."
run_git_status_probe "${repo}" "${TMP_ROOT}/runtime-only-status.out"
assert_contains "${TMP_ROOT}/runtime-only-status.out" "tree=runtime-only"
pass "runtime-generated artifacts only do not block safe update"

# Runtime-generated artifacts plus a source change still block safe updates.
repo="${TMP_ROOT}/runtime-plus-source"
init_dirty_repo "${repo}"
printf '{"dirty":true}\n' >"${repo}/artifacts/latest-results.json"
printf 'source dirty\n' >>"${repo}/src/app.ts"
if run_clean_check "${repo}" "${TMP_ROOT}/runtime-plus-source.out"; then
  fail "runtime artifacts plus source change were not rejected"
fi
assert_contains "${TMP_ROOT}/runtime-plus-source.out" "src/app.ts"
assert_contains "${TMP_ROOT}/runtime-plus-source.out" "Refusing to update dirty working tree"
run_git_status_probe "${repo}" "${TMP_ROOT}/runtime-plus-source-status.out"
assert_contains "${TMP_ROOT}/runtime-plus-source-status.out" "tree=dirty-source"
pass "runtime artifacts plus source changes block safe update"

# Source changes alone still block safe updates.
repo="${TMP_ROOT}/source-only"
init_dirty_repo "${repo}"
printf 'source dirty\n' >>"${repo}/src/app.ts"
if run_clean_check "${repo}" "${TMP_ROOT}/source-only.out"; then
  fail "source-only dirty tree was not rejected"
fi
assert_contains "${TMP_ROOT}/source-only.out" "src/app.ts"
assert_contains "${TMP_ROOT}/source-only.out" "Refusing to update dirty working tree"
run_git_status_probe "${repo}" "${TMP_ROOT}/source-only-status.out"
assert_contains "${TMP_ROOT}/source-only-status.out" "tree=dirty-source"
pass "source-only dirty tree is rejected"

# Safe repository ownership behavior: git operations are routed through app-user helper.
out="${TMP_ROOT}/safe-git.out"
bash -c "source '${ROOT_DIR}/deploy/lib/common.sh'; AI_FACTORY_DRY_RUN=true AI_FACTORY_APP_DIR='${TMP_ROOT}/safe' AI_FACTORY_APP_USER='ai-validator' load_deploy_config; git_in_repo fetch --prune origin" >"${out}" 2>&1
assert_contains "${out}" "DRY RUN as ai-validator"
pass "safe Git helper routes repository Git operations as APP_USER"

# Shell syntax validation for every deploy script.
bash -n "${ROOT_DIR}"/deploy/*.sh "${ROOT_DIR}"/deploy/lib/*.sh "${ROOT_DIR}"/tests-deploy/*.sh
pass "shell syntax validation passes"

printf '[test-deploy] all deployment script tests passed\n'
