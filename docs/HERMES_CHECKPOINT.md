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

## Phase 3B.1 multi-node validation engagement foundation

- Added versioned validation engagement and engagement-node domain models for customer infrastructure validation projects.
- Added file-backed JSON persistence at `artifacts/engagements/store.json` by default with `AI_VALIDATOR_ENGAGEMENT_STORE` override, schema versioning, missing-file handling, validation before persistence, and atomic temporary-file rename writes.
- Added authenticated administrative engagement APIs: list, create, read, patch, nodes, archive, and an idempotent NVIS simulated fixture loader.
- Enforced server-generated IDs, required names/customer names, platform profile validation, expected node count bounds, valid status transitions, and rejection of client-supplied calculated counters/readiness fields.
- Added derived engagement counts from nodes: received, ready, remediation, failed, and average readiness score when node scores exist.
- Added `/portal/engagements`, `/portal/engagements/new`, and `/portal/engagements/:engagementId` pages with search, status/platform filters, accessible form validation, detail dashboard sections, benchmark/evidence placeholders, and responsive authenticated navigation.
- Added NVIS Interview Demo fixture: `Two-Node H100 Cluster Acceptance`, `hgx-h100`, expected nodes `2`, status `collecting`, simulated `true`, with `node01` and `node02` simulated H100 placeholders awaiting evidence.
- The UI labels fixture data as `SIMULATED DEMO — not real hardware evidence`; no benchmark execution, evidence upload endpoint, PDF generation, or production credential handling was added.

### Phase 3B.1 files changed

- `README.md`
- `docs/ENGAGEMENTS.md`
- `docs/HERMES_CHECKPOINT.md`
- `server.ts`
- `src/App.tsx`
- `src/portal/engagements.ts`
- `src/server/engagements.ts`
- `tests-portal/engagements-api.test.ts`
- `tests-portal/engagements-portal.test.ts`

### Phase 3B.1 tests and smoke checks

- `python -m pytest`: passed, 30 tests.
- `npm run build`: passed.
- `npm run lint`: passed.
- `npm run test:portal`: passed, 26 tests, including engagement API and portal coverage.
- `npm run test:deploy`: passed.
- `git diff --check`: passed.
- `.env.production`: untouched and unstaged.

### Phase 3B.1 next milestone

- Secure evidence bundle ingestion and upload tokens.

## Phase 3B.2 secure evidence upload tokens and bundle ingestion

- Added versioned upload-token records with secure random plaintext tokens shown once, persisted token hashes only, timing-safe hash comparison, scoped engagement/node ownership, default two-hour lifetime, revocation, single-use marking, and derived expired status for list responses.
- Added authenticated administrative upload-token endpoints for create, list, and revoke under `/api/v1/engagements/{engagement_id}/nodes/{node_id}/upload-tokens`.
- Added bearer-token node upload endpoint `POST /api/v1/evidence/uploads` for outbound HTTPS collector bundle uploads; reviewer sessions do not authenticate node uploads.
- Implemented `.tar.gz` evidence validation for safe paths, duplicate paths, unsupported tar entry types, manifest/checksum presence, UTF-8 JSON, supported manifest/profile/checksum schema, declared-file existence, SHA-256 verification, count/timestamp sanity, fixture simulated labeling, and engagement/node scope mismatch rejection.
- Persisted accepted evidence outside public roots at `artifacts/evidence/{engagement_id}/{node_id}/{collection_id}/` by default, with original archive, normalized extracted evidence, manifest, command metadata, ingestion metadata, and storage-relative keys only.
- Added versioned evidence records, duplicate rejection, superseding of previous current evidence, activity entries, node collection updates, last collection timestamps, sanitized hostname display, and derived received node counts.
- Added `ai-validator bundle` for deterministic safe tar.gz packaging and `ai-validator upload` for HTTPS uploads using `--token-file` or `GPU_VALIDATOR_UPLOAD_TOKEN` without plaintext command-line token support.
- Added `scripts/create_demo_evidence.py` to generate safe simulated `node01` and `node02` fixture bundles labeled `simulated: true` and `collection_mode: fixture`.
- Enhanced `/portal/engagements/:engagementId` with node upload-token state, generate/revoke actions, copy-once token modal, upload instructions, evidence metadata, and activity history.
- Added `docs/EVIDENCE_INGESTION.md` and updated engagement/README documentation.

### Phase 3B.2 files changed

- `README.md`
- `docs/ENGAGEMENTS.md`
- `docs/EVIDENCE_INGESTION.md`
- `docs/HERMES_CHECKPOINT.md`
- `scripts/create_demo_evidence.py`
- `server.ts`
- `src/App.tsx`
- `src/ai_validator/cli.py`
- `src/ai_validator/evidence/archive.py`
- `src/portal/engagements.ts`
- `src/server/engagements.ts`
- `src/server/evidence.ts`
- `tests/test_evidence_upload_cli.py`
- `tests-portal/engagements-portal.test.ts`
- `tests-portal/evidence-api.test.ts`

### Phase 3B.2 next milestone

- Cluster comparison, findings derivation, and benchmark result importers.

## Phase 3B.3 cluster comparison and readiness evaluation

- Added versioned parsed node facts with per-value provenance for accepted evidence records.
- Added cluster comparison consensus, warnings for ties, mismatch/missing highlighting inputs, and authenticated comparison API.
- Added profile-policy-driven findings rules for cluster consistency, node health, and evidence quality.
- Added transparent node and engagement readiness scoring with category breakdowns and benchmark exclusion.
- Added acceptance decisions separate from score, with simulated evidence banner semantics.
- Added scoped evidence provenance API that does not expose raw storage paths or raw evidence content.
- Enhanced the engagement portal with acceptance summary, node comparison, finding filters, readiness breakdown, benchmark awaiting state, evidence provenance modal, and acceptance report preview.
- Updated the simulated demo generator so `node01` is ready and `node02` intentionally has a different NVIDIA driver, producing one high blocking remediation finding.
- Added `docs/CLUSTER_INTELLIGENCE.md`.

### Phase 3B.3 next milestone

- NCCL, NVIDIA HPL, and inference benchmark result importers.

## Phase 3B.4 NCCL, NVIDIA HPL, and inference benchmark intelligence

- Added versioned benchmark run records for `nccl`, `hpl`, `triton_perf_analyzer`, and `genai_perf` with status, SHA-256, metrics, warnings, storage ID, and provenance.
- Added parsers for NCCL Tests, NVIDIA HPL, Triton Performance Analyzer, and GenAI-Perf outputs. Parsers tolerate whitespace, comments, banners, ANSI colors, missing metrics, and unknown tool versions.
- Added token-authenticated `POST /api/v1/benchmarks/upload` and reviewer `GET /api/v1/engagements/{engagement_id}/benchmarks`; benchmark files are stored separately from infrastructure evidence.
- Added configurable benchmark findings for NCCL bandwidth thresholds, HPL residual failure, inference latency thresholds, missing/outdated benchmark evidence, and simulated benchmark evidence. No default performance thresholds are invented.
- Updated readiness to expose benchmark scoring as a 20-point evaluated category when benchmark evidence is present; absent benchmark evidence remains `Not Evaluated` and does not automatically fail acceptance.
- Replaced the engagement benchmark placeholder with NCCL, HPL, and Inference cards showing status, key metrics, and provenance links.
- Added CLI `ai-validator benchmark import --type nccl|hpl|triton|genai-perf --input <file>` for local import of existing benchmark files only; no benchmark execution, SSH, or software installation was added.
- Added simulated demo benchmark fixtures under `sample-data/benchmarks/` and documentation in `docs/BENCHMARK_INTELLIGENCE.md`.

### Phase 3B.4 next milestone

- Container-aware collector improvements and real benchmark execution, with explicit safety gates and lab approval before any execution support is introduced.

## Phase 3B.5 controlled benchmark execution plane and Operations Library

- Added a versioned benchmark-definition registry for NCCL AllReduce/AllGather/ReduceScatter/Broadcast, NVIDIA HPL, Triton Performance Analyzer, GenAI-Perf, and DCGM Level 1 Diagnostics.
- Added authenticated benchmark-job APIs with typed parameter validation, generated command previews, explicit approval for disruptive jobs, cancellation, expiration, claim locking, and file-backed persistence.
- Added node-runner registration tokens with secure random plaintext shown once, persisted hashes only, revocation, and runner bearer credentials that are never returned in list/read APIs.
- Added runner-authenticated outbound APIs for registration, heartbeat, job claim, status, bounded/redacted logs, complete, and fail. No SSH, remote shell, arbitrary commands, arbitrary env vars, or query-string secrets were added.
- Added Python `ai-validator runner` commands for capabilities, register, status, once, and run scaffolding plus safe NCCL adapter argv generation/redaction/checksum primitives.
- Extended NCCL parsing with a redacted real-format A100 fixture (`source_kind: redacted_real_format_fixture`) covering NCCL `2.25.1+cuda12.8`, four GPUs, zero wrong/out-of-bounds values, peak bus bandwidth `185.67 GB/s`, and reported average bus bandwidth `37.3098 GB/s` without hard-coded thresholds.
- Added authenticated Operations Library routes for Slurm, Lustre, NVIDIA Base Command Manager, and benchmarking cheat sheets with search, category filters, safety labels, copy controls, and no command execution.
- Added docs: `docs/BENCHMARK_EXECUTION_PLANE.md`, `docs/NODE_RUNNER.md`, and `docs/OPERATIONS_LIBRARY.md`.

### Phase 3B.5 next milestone

- Real Runpod runner registration, real NCCL job execution, production deployment, and executive report generation.

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
