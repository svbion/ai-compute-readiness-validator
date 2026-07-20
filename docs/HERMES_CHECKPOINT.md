# Hermes Deployment Checkpoint

- Branch: `hermes-mvp`
- Implementation commit: `b7c5cbd fix(deploy): harden dry-run ownership health checks and caddy setup`
- Checkpoint created during recovery after confirming the previous deployment hardening work was already committed and present at `HEAD`.

## Work completed

- Preserved the existing deployment hardening implementation; no reset, clean, or production installer run was performed.
- Confirmed zero-mutation dry run accepts `AI_FACTORY_DRY_RUN=true` plus truthy `1`, `true`, `yes`, and `on` values.
- Confirmed canonical `AI_FACTORY_*` deployment variables are preferred while legacy aliases remain supported.
- Confirmed shared deployment helpers live in `deploy/lib/common.sh`.
- Confirmed repository Git operations are routed through the application user helper.
- Confirmed dirty working tree protection is implemented for update paths.
- Updated dirty working tree protection to ignore documented runtime-generated outputs only: `artifacts/**`, `.cache/**`, `.npm/**`, `.lesshst`, `dist/**`, `.venv/**`, and `node_modules/**`.
- Confirmed runtime-only dirty trees continue with a clear deployment message while source changes still block updates.
- Confirmed systemd and backend HTTP readiness retry logic is implemented.
- Confirmed Caddy is optional, installed/configured only when enabled, and activated after backend health passes.
- Confirmed authentication validation reports only `SET`/`EMPTY` states and does not print secret values.
- Fixed shell-sensitive production env parsing bug where unquoted `scrypt$...` hashes could be expanded by Bash under `set -u`.
- Added safe dotenv parsing in `deploy/lib/common.sh` via `dotenv_get` and `dotenv_load_selected`; deployment scripts no longer shell-source `.env.production`.
- Hardened first-install `.env.production` generation so generated secrets are single-quoted and never printed.
- Fixed Caddy render-time domain initialization so `set -u` cannot trip on a lower-case local `domain` referenced in its own declaration.
- Production is live at `https://gpuvalidator.com`; DNS, HTTPS, browser access, authentication, backend service, Caddy, and deployment verification have been validated.
- Improved production status and deployment summaries to inspect Git as `AI_FACTORY_APP_USER`, report branch/commit/origin sync accurately, and filter documented runtime artifacts.
- Removed Vite's `.env.production` `NODE_ENV` warning by keeping `NODE_ENV` in systemd/runtime and the npm build command, not in the dotenv file.
- Confirmed `deploy/preflight.sh`, `deploy/status.sh`, deployment shell tests, and Hetzner documentation exist.

## Files changed by implementation commit

- `README.md`
- `deploy/bootstrap.sh`
- `deploy/caddy/Caddyfile`
- `deploy/caddy/Caddyfile.template`
- `deploy/healthcheck.sh`
- `deploy/install.sh`
- `deploy/lib/common.sh`
- `deploy/preflight.sh`
- `deploy/rollback.sh`
- `deploy/status.sh`
- `deploy/update.sh`
- `deploy/verify.sh`
- `docs/HETZNER_DEPLOYMENT.md`
- `package.json`
- `tests-deploy/test-deployment-scripts.sh`

## Runtime-aware dirty-tree fix

- Added runtime-aware filtering in `deploy/lib/common.sh` for safe update checks.
- Added deployment tests covering runtime artifacts only, runtime artifacts plus source changes, and source changes only.
- Commit target: `fix(deploy): ignore runtime artifacts during safe update`.

## Shell-sensitive env parsing fix

- Bug root cause: deployment helpers sourced `.env.production` as Bash, so unquoted password hashes like `scrypt$...` were subject to shell parameter expansion; with `set -u`, substrings such as `$6` caused unbound-variable failures.
- Implementation commit: `b8d7991 fix(deploy): safely parse shell-sensitive production env values`.
- Files changed by implementation commit: `.env.production.example`, `README.md`, `deploy/lib/common.sh`, `docs/HETZNER_DEPLOYMENT.md`, and `tests-deploy/test-deployment-scripts.sh`.
- Safe parser preserves literal `$`, `=`, quotes, semicolons, command-substitution text, and backticks as data; it rejects malformed variable names and never uses `eval`.
- Deployment tests prove malicious dotenv content does not create files or execute commands, secret-safe status reports only `SET length=N` or `EMPTY`, existing `.env.production` is preserved, generated secrets are quoted, and `healthcheck.sh`/`verify.sh` load dollar-containing hashes safely.

## Caddy domain initialization fix

- Bug root cause: `render_caddy_config` declared `local output="$1" domain="$2" port="$3" www_domain="www.${domain}"`; Bash expands the full `local` assignment before the lower-case `domain` variable is initialized, so `set -u` failed with `domain: unbound variable` after Caddy installation.
- Fix: `deploy/lib/common.sh` now initializes Caddy render locals in separate steps and uses explicit `caddy_domain`/`caddy_port` names derived from canonical `DOMAIN` before rendering.
- Regression coverage: `tests-deploy/test-deployment-scripts.sh` now exercises the Caddy-enabled `install_or_update_caddy` render path in dry-run mode and asserts no unbound-variable failure.
- Commit target: `fix(deploy): fix caddy domain variable initialization`.

## Production operations cleanup

- Production is live at `https://gpuvalidator.com`; DNS, HTTPS, browser access, authentication, backend service, Caddy, and deployment verification have been validated.
- Current deployment cleanup commit: `390e444 fix(deploy): improve production status and build configuration`.
- Cleanup completed: Git inspection now validates repository readability, runs read-only Git commands as `AI_FACTORY_APP_USER`, reports configured branch, checked-out branch, deployed commit/subject, origin sync, and filtered working-tree state without treating inaccessible checkouts as detached.
- Deployment summaries in `install.sh`/`update.sh` use the shared Git helper and report the actual deployed commit when the repository is valid and readable.
- Vite cleanup remains in place: `.env.production.example` omits `NODE_ENV`; systemd sets runtime `NODE_ENV=production`; `npm run build` sets production build mode without loading `.env.production`.
- `deploy/status.sh` now reports operational status and authentication variables as `SET`/`EMPTY` only, without secret values or lengths.
- `docs/PRODUCTION_SMOKE_TEST.md` covers DNS, TLS, root/www, auth, protected APIs/reports, local service, Caddy, logs, rollback, and secret safety.
- Next objective: public landing page.

## Public product landing page

- Added public GPU Validator product experience while preserving the authenticated validation portal.
- Routes now separate public pages (`/`, `/docs`, `/security`, `/request-access`, `/login`) from the protected reviewer portal (`/portal`).
- Successful login redirects to `/portal`; unauthenticated `/portal`, protected APIs, and protected report routes remain private.
- Landing page positions GPU Validator as AI compute infrastructure validation and customer acceptance for GPU platforms, fabric, schedulers, storage, Kubernetes, and operational readiness.
- Added public docs, security/evidence-handling, and mailto-based early-access request pages with configurable `VITE_GPU_VALIDATOR_CONTACT_EMAIL`.
- Added SEO metadata, canonical URL, Open Graph metadata, structured data, favicon integration, `robots.txt`, and `sitemap.xml`.
- Public demo copy states that simulated evidence is used unless real evidence is imported and labeled.
- Commit target: `feat(web): add public GPU Validator product experience`.

## Phase 3A read-only evidence collector foundation

- Added `ai-validator collect` for administrator-side, local, read-only Linux and NVIDIA GPU evidence bundle collection.
- Supported initial collection profiles: `linux-host`, `gpu-workstation`, `single-gpu-node`, and `dgx-class`.
- Implemented an internal allowlisted command registry; user-supplied arbitrary commands are not accepted.
- Implemented argv-list subprocess execution with `shell=False`, per-command timeout, command metadata, missing-command handling, nonzero-exit recording, timeout recording, and optional diagnostics skip state.
- Kept default collection lightweight and read-only; `dcgmi diag -r 1` is skipped unless `--include-diagnostics` is explicitly provided.
- Implemented deterministic bundle layout with `manifest.json`, `metadata/commands.json`, category output directories, optional stderr captures, and deterministic `checksums.sha256`.
- Implemented manifest schema version `1.0.0` with timezone-aware UTC timestamps, collector version, profile, sanitized flag, command counts, categories, evidence files, checksum algorithm, and warnings.
- Implemented optional `--sanitize` mode for deterministic hostname, IPv4, IPv6, username path, and email replacement in captured output only.
- Implemented `--dry-run` to print the profile command plan without running commands or creating files.
- No portal upload, remote execution, benchmark execution, package installation, service mutation, sudo usage, or arbitrary home-directory collection was added.
- Final implementation commit SHA is reported after commit creation; Git cannot embed a commit object's final hash inside the content that defines that same object.

### Phase 3A files changed

- `README.md`
- `docs/EVIDENCE_COLLECTION.md`
- `docs/HERMES_CHECKPOINT.md`
- `src/ai_compute_readiness_validator.egg-info/PKG-INFO`
- `src/ai_compute_readiness_validator.egg-info/SOURCES.txt`
- `src/ai_validator/cli.py`
- `src/ai_validator/evidence/__init__.py`
- `src/ai_validator/evidence/collector.py`
- `src/ai_validator/evidence/models.py`
- `src/ai_validator/evidence/registry.py`
- `src/ai_validator/evidence/sanitizer.py`
- `tests/test_evidence_collector.py`

### Phase 3A tests and smoke checks

- `python -m pytest`: passed, 30 tests.
- `npm run build`: passed.
- `npm run lint`: passed.
- `npm run test:portal`: passed, 15 tests.
- `npm run test:deploy`: passed.
- `ai-validator collect --profile linux-host --output /tmp/gpu-validator-evidence-test --dry-run`: passed; zero-mutation command plan and no output directory created.
- `ai-validator collect --profile linux-host --output <tempdir>`: passed; manifest and checksums generated; missing Linux utilities on the non-Linux development host were recorded, not fatal.
- `git diff --check`: passed.
- `git status --short`: only intended tracked/untracked project changes before commit; clean expected after commit.
- `.env.production` must remain untouched and unstaged.

### Phase 3A next milestone

- Add InfiniBand, Slurm, Kubernetes, and storage collectors with the same read-only allowlist, metadata, manifest, checksum, sanitization, and missing-command semantics.

## Recovery changes

- Added this checkpoint file: `docs/HERMES_CHECKPOINT.md`.

## Tests and outcomes

- `bash -n deploy/*.sh deploy/lib/*.sh tests-deploy/*.sh`: passed.
- `npm run test:deploy`: passed.
- Caddy-enabled render regression test: passed.
- Runtime-aware dirty-tree deployment tests: passed.
- Zero-mutation dry-run fixture with temporary `AI_FACTORY_APP_DIR`: passed; app directory was not created and secret-like output was not printed.
- `npm run build`: passed.
- `npm run lint`: passed.
- `npm run test:portal`: passed, 15 tests.
- `npm run test:e2e`: passed, 18 tests with 2 desktop-only skips for mobile-specific checks.
- `pytest` using existing `.venv`: passed, 16 tests.
- Focused literal parse for `scrypt$1234567890abcdef$abcdef1234567890`: passed.
- Production status Git fixture tests: normal branch, detached HEAD, app-user Git, missing/inaccessible repo, runtime-only dirty paths, and source dirty paths passed.

## Production safety notes

- Do not print, commit, or transmit `.env.production` values or authentication secrets.
- Treat `.env.production` as dotenv data, not shell script; deployment tooling parses selected keys without shell evaluation.
- Keep password hashes and other `$`-containing values single-quoted for human clarity and Node dotenv compatibility.
- Do not use command substitutions or backticks in production env files.
- Existing `.env.production` is preserved by install/update paths.
- Use `AI_FACTORY_DRY_RUN=true` before any real server install or update.
- Do not expose port `3000` publicly after Caddy is verified; public access should be ports `80`/`443`.
- The deploy scripts reject source-code dirty working trees by default, but tolerate documented runtime-generated artifacts during update.
- Use `AI_FACTORY_ALLOW_DIRTY_UPDATE=true` only deliberately; it bypasses the safety check and should not be needed for normal artifact churn.
- Caddy should be enabled only after DNS points at the Hetzner server and backend health passes.

## Remaining server steps

- Create or access the Ubuntu 24.04 Hetzner server.
- Point `gpuvalidator.com` and `www.gpuvalidator.com` DNS records at the server.
- Configure Hetzner firewall and/or `ufw` for SSH, HTTP, and HTTPS.
- Run read-only preflight and zero-mutation dry run on the server.
- Run the real install or update only after dry run output is reviewed.
- Configure reviewer authentication values directly on the server without sharing them in chat or committing them.
- Run server status and verification scripts after deployment.

## Next exact commands

```bash
cd /opt/ai-factory-validator
git fetch origin
git checkout hermes-mvp
git pull --ff-only origin hermes-mvp
python3 - <<'PY'
import pathlib, re, sys
line = next((ln for ln in pathlib.Path('.env.production').read_text().splitlines() if ln.startswith('AI_FACTORY_REVIEWER_PASSWORD_HASH=')), '')
sys.exit(0 if re.match(r"^AI_FACTORY_REVIEWER_PASSWORD_HASH='[^']+'$", line) else 1)
PY
sudo -E env AI_FACTORY_DRY_RUN=true AI_FACTORY_APP_DIR=/opt/ai-factory-validator AI_FACTORY_BRANCH=hermes-mvp AI_FACTORY_DOMAIN=gpuvalidator.com AI_FACTORY_ENABLE_CADDY=true AI_FACTORY_AUTH_REQUIRED=true ./deploy/preflight.sh
sudo -E env AI_FACTORY_DRY_RUN=true AI_FACTORY_APP_DIR=/opt/ai-factory-validator AI_FACTORY_BRANCH=hermes-mvp AI_FACTORY_DOMAIN=gpuvalidator.com AI_FACTORY_ENABLE_CADDY=true AI_FACTORY_AUTH_REQUIRED=true ./deploy/update.sh
sudo -E env AI_FACTORY_APP_DIR=/opt/ai-factory-validator AI_FACTORY_BRANCH=hermes-mvp AI_FACTORY_DOMAIN=gpuvalidator.com AI_FACTORY_ENABLE_CADDY=true AI_FACTORY_AUTH_REQUIRED=true ./deploy/update.sh
sudo -E ./deploy/status.sh
sudo -E ./deploy/verify.sh
```
