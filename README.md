# GPU Validator

GPU Validator is a read-only assessment toolkit and interview demo for GPU-accelerated AI compute infrastructure. It combines:

GPU Validator is the product brand and `https://gpuvalidator.com` is the canonical production URL. The Git repository remains `ai-compute-readiness-validator`, the Python package/CLI remain compatible, and AI Factory remains a validation profile and infrastructure-readiness concept rather than the product name.
- a Python CLI (`ai-validator`) that collects evidence, scores readiness, and emits JSON, Markdown, and standalone HTML reports
- a Vite/React + Express portal that visualizes the same report data as a customer-acceptance workflow

The portal is intentionally scoped as an enterprise validation and handoff interface for simulated, local, or imported sanitized evidence. It does not mutate host state, provision infrastructure, require a database, collect telemetry, or depend on cloud services. Production mode uses environment-driven invite-only authentication by default; local development may disable auth explicitly for operator testing.

This project is an independent portfolio project and is not affiliated with, sponsored by, or endorsed by NVIDIA.

## What the portal communicates

The current UI is designed to make the following operational domains legible during an interview walkthrough:
- Linux platform readiness
- GPU compute health and DCGM visibility
- InfiniBand / RDMA fabric health
- Slurm scheduler state
- Kubernetes GPU orchestration state
- storage readiness
- customer acceptance and handoff gating

Target profile language is compatibility-oriented only:
- DGX-class deployment
- HGX-based deployment
- OEM GPU platform
- Slurm-managed AI cluster
- Kubernetes GPU cluster

The included scenarios are simulated. The project does not claim the demo is running on DGX or HGX hardware.

## Portal highlights

The current portal separates and visualizes:
- Overall Readiness Score
- Customer Acceptance Status
- Customer Acceptance Gate
- Cluster Topology
- GPU Health
- InfiniBand / RDMA Fabric Health
- Scheduler and Orchestration
- Customer Handoff Summary
- Benchmark Readiness
- Interview Walkthrough

Important model:
- the readiness score represents aggregate infrastructure health
- the customer acceptance gate separately enforces release-blocking conditions
- a high aggregate score does not override a critical blocker

In the degraded scenario this is intentional: `97.01%` readiness still yields `Remediation required` because a critical GPU ECC finding blocks handoff.

## Repository layout

```text
src/ai_validator/         Python package: CLI, collectors, scoring, reporting, demo scenarios
src/App.tsx               React portal
src/portal/assessment.ts  UI derivation helpers for acceptance, GPU, and fabric summaries
server.ts                 Express API + Vite middleware / static host
tests/test_validation.py  Pytest regression coverage
tests-portal/             Node/TS portal regression checks
sample-data/              Checked-in demo JSON and sample benchmark input
artifacts/                Generated reports from local runs
docs/                     Architecture, security, roadmap, demo, current state
```

## Quick start

### Python CLI

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

Common commands:

```bash
ai-validator --help
ai-validator version
ai-validator validate --name local-cluster --output-dir artifacts/live
ai-validator collect --profile linux-host --output evidence-bundle
ai-validator collect --profile dgx-class --output evidence-bundle --sanitize
ai-validator collect --profile linux-host --output evidence-bundle --dry-run
ai-validator bundle --input evidence-bundle --output node01-evidence.tar.gz
ai-validator upload --bundle node01-evidence.tar.gz --url https://gpuvalidator.com/api/v1/evidence/uploads --token-file /secure/path/upload-token.txt
ai-validator benchmark import --type nccl --input all_reduce.txt
ai-validator benchmark import --type hpl --input hpl.txt
ai-validator benchmark import --type triton --input perf.csv
ai-validator runner capabilities
ai-validator runner register --url https://gpuvalidator.com --node-id <node-id> --token-file /secure/path/runner-token.txt --credential-file /secure/path/runner-credential.json
ai-validator runner once --url https://gpuvalidator.com --credential-file /secure/path/runner-credential.json
ai-validator demo --scenario healthy --output-dir artifacts
ai-validator demo --scenario degraded --output-dir artifacts
ai-validator report --input artifacts/degraded-results.json --output-dir artifacts/regenerated
```

`ai-validator collect` creates administrator-side local evidence bundles for Linux and NVIDIA GPU hosts. It is read-only, uses an internal command allowlist with argv-list subprocess execution, records per-command metadata and SHA-256 checksums, handles missing optional NVIDIA/DCGM utilities without failing the whole run, and can sanitize host-identifying fields with deterministic replacements. Optional DCGM diagnostics are skipped unless `--include-diagnostics` is explicitly passed. See `docs/EVIDENCE_COLLECTION.md` for supported profiles, exact commands, bundle layout, manifest schema, and safety exclusions.

`ai-validator bundle` packages a validated collector directory into a deterministic `.tar.gz` archive. `ai-validator upload` sends that archive outbound over HTTPS using a scoped upload bearer token from `--token-file` or `GPU_VALIDATOR_UPLOAD_TOKEN`; it never accepts plaintext tokens on the command line. See `docs/EVIDENCE_INGESTION.md` for token lifecycle, archive validation, storage layout, duplicate behavior, and portal workflow.

`ai-validator benchmark import` parses existing NCCL Tests, NVIDIA HPL, Triton Performance Analyzer, and GenAI-Perf output files into versioned benchmark records. It imports files only; it does not run benchmarks, install benchmark software, use SSH, or claim MLPerf compliance. See `docs/BENCHMARK_INTELLIGENCE.md` for supported formats, metrics, configurable thresholds, findings, readiness, provenance, and demo fixtures.

`ai-validator runner` provides outbound node-runner registration/capability/status scaffolding for the controlled benchmark execution plane. Runner tokens and credentials come from files, HTTPS is required by default, and the runner exposes no interactive shell. See `docs/NODE_RUNNER.md` and `docs/BENCHMARK_EXECUTION_PLANE.md`.

Demo runs emit both rolling and scenario-specific artifacts:
- `latest-results.json`, `latest-report.html`, `latest-report.md`
- `healthy-results.json`, `healthy-report.html`, `healthy-report.md`
- `degraded-results.json`, `degraded-report.html`, `degraded-report.md`

### Portal

```bash
npm install
npm run lint
npm run build
npm run dev
```

Open `http://localhost:3000/login`. The root URL `/` redirects deterministically to `/login` so the public application landing route is the private login page, not a marketing homepage.

Portal API behavior:
- `GET /api/results?scenario=healthy|degraded` loads generated scenario artifacts from `artifacts/` when present and otherwise falls back to checked-in `sample-data/`
- `GET /api/evidence-sources` lists simulated sources and only exposes live/imported choices when valid live artifacts exist
- `GET /api/v1/engagements` and related authenticated `/api/v1/engagements/*` routes manage multi-node validation engagements using file-backed JSON persistence
- authenticated `POST|GET /api/v1/engagements/:engagementId/nodes/:nodeId/upload-tokens` routes create/list scoped evidence upload tokens; revoke uses `/upload-tokens/:tokenId/revoke`
- `POST /api/v1/evidence/uploads` accepts token-authenticated outbound collector `.tar.gz` uploads and rejects unsafe, expired, duplicate, or malformed uploads
- `POST /api/v1/benchmarks/upload` accepts token-authenticated existing benchmark output files and stores them separately from infrastructure evidence
- `GET /api/v1/engagements/:engagementId/benchmarks` lists imported benchmark runs and benchmark findings
- `GET /api/v1/benchmark-definitions` lists the allowlisted benchmark catalog
- authenticated `/api/v1/engagements/:engagementId/benchmark-jobs*` routes create, approve, cancel, and inspect controlled benchmark jobs
- authenticated `/api/v1/engagements/:engagementId/nodes/:nodeId/runner-tokens*` routes create/revoke node-scoped runner registration tokens
- runner bearer-authenticated `/api/v1/runners/*` routes register, heartbeat, claim jobs, stream bounded logs, and complete/fail jobs
- `GET /api/v1/engagements/:engagementId/comparison|findings|readiness` evaluates accepted evidence into parsed facts, cluster comparison, rule-based findings, readiness score, and acceptance decision
- `GET /api/v1/engagements/:engagementId/evidence/:evidenceId/provenance` returns scoped parsed-value provenance without raw storage paths or raw file contents
- `POST /api/run-scenario` intentionally returns `405`; the reviewer portal is read-only and scenario/live evidence generation remains an administrator-side CLI workflow
- `GET /reports/:scenario/:format` serves safe report links for HTML, Markdown, and JSON evidence

## Live portal instructions

Recommended local interview flow:

```bash
source .venv/bin/activate
ai-validator demo --scenario healthy --output-dir artifacts
ai-validator demo --scenario degraded --output-dir artifacts
npm run dev
```

Then walk through:
1. healthy scenario for acceptance approval
2. degraded scenario for release-blocking behavior
3. `/portal/engagements` for the multi-node validation engagement foundation
4. the NVIS simulated demo engagement fixture, clearly labeled `SIMULATED DEMO`
5. report links for HTML, Markdown, and JSON evidence
6. benchmark cards for NCCL, HPL, and inference imports with provenance links
7. `/portal/library` for Slurm, Lustre, NVIDIA Base Command Manager, and benchmarking cheat sheets

Engagement demo flow:

```bash
npm run dev
# open http://localhost:3000/portal/engagements
# click "Load NVIS demo fixture"
# open the engagement detail page, generate one upload token per node, and copy it once
```

The fixture creates `NVIS Interview Demo / Two-Node H100 Cluster Acceptance` with two simulated H100 node placeholders awaiting evidence. It is idempotent and does not overwrite user-created data. For local ingestion smoke testing, generate simulated uploadable bundles with:

```bash
python scripts/create_demo_evidence.py --output /tmp/gpu-validator-demo-evidence
```

Uploading both generated bundles to the NVIS demo engagement intentionally demonstrates cluster intelligence: `node01` is ready, `node02` has a different NVIDIA driver version, the engagement receives 2/2 nodes, and acceptance is `remediation_required` with a `DEMONSTRATION ONLY — NOT VALID FOR CUSTOMER ACCEPTANCE` banner. See `docs/CLUSTER_INTELLIGENCE.md` for parser architecture, policies, findings, scoring, acceptance, APIs, and current limitations.

## Hosted deployment guidance

This project is intentionally simple to host because the portal only depends on static frontend assets plus the existing Express server.

Production single-server deployment is managed by the repo-owned `deploy/` scripts. The canonical zero-mutation dry run is:

```bash
sudo -E env \
  AI_FACTORY_DRY_RUN=true \
  AI_FACTORY_APP_DIR=/opt/ai-factory-validator \
  AI_FACTORY_BRANCH=hermes-mvp \
  AI_FACTORY_DOMAIN=gpuvalidator.com \
  AI_FACTORY_ENABLE_CADDY=true \
  AI_FACTORY_AUTH_REQUIRED=true \
  ./deploy/install.sh
```

Dry run performs zero mutations: it does not run apt, create users, touch Git, create `.env.production`, install dependencies, build, restart services, or configure Caddy. Real install uses the same command without `AI_FACTORY_DRY_RUN=true`. The installer supports reruns, preserves existing `.env.production` secrets, waits for backend health before Caddy activation, installs Caddy only when explicitly enabled, and runs Git operations as the application user to avoid dubious-ownership failures. Use `deploy/preflight.sh` for read-only host checks and `deploy/status.sh` for secret-safe operational status.

Production `.env.production` is dotenv data, not an arbitrary shell script. Deployment tooling safely parses selected `KEY=VALUE` records without shell evaluation, so password hashes containing `$` are supported without Bash expansion. Keep shell-sensitive values single-quoted for human clarity and Node `dotenv` compatibility, for example:

```dotenv
AI_VALIDATOR_USER_STORE=/opt/ai-factory-validator/shared/users/store.json
GPUVALIDATOR_INITIAL_ADMIN_PASSWORD='<set-once-operator-supplied-password-or-omit-for-generated-temporary-password>'
AI_FACTORY_REVIEWER_USERNAME=
AI_FACTORY_REVIEWER_PASSWORD_HASH=
AI_FACTORY_AUTH_TEST_BYPASS_TOKEN='token$with$dollar-signs'
```

Authentication uses username as the only login identifier. Email remains optional user profile metadata and is ignored during authentication. When production authentication is enabled and `AI_VALIDATOR_USER_STORE` is configured, server bootstrap idempotently seeds the initial Platform Administrator account only if username `mechavarria` is absent:

- name: Michael Echavarria
- username: `mechavarria`
- role: Platform Administrator (`administrator`)
- first-login posture: `must_change_password=true`
- permissions: full platform administration, user management, organization management, agent management, cluster management, validation management, benchmark management, reports, monitoring, alerts, settings, audit logs, API keys, AI Copilot, licensing, and integrations

Do not hardcode a password in source. Set `GPUVALIDATOR_INITIAL_ADMIN_PASSWORD` for deterministic first bootstrap, or omit it and the server will generate a secure temporary password and print it once to the service logs during the creation run. Reruns do not create duplicate users and do not reprint or rotate credentials for an existing `mechavarria` account. Environment reviewer credentials are only a temporary fallback.

The public UI is login-only. `/` always redirects to `/login`; legacy marketing/documentation paths redirect unauthenticated users to `/login`; authenticated `/login` redirects to `/portal`. Protected `/portal` routes remain unavailable without authentication.

Never use command substitutions or backticks in production env files, and never commit real `.env.production` secrets.

Recommended hosted pattern:
- build with `npm run build`
- run `node dist/server.cjs`
- keep generated artifacts under `artifacts/`
- generate demo/live/imported artifacts through administrator-side CLI tools before review; the public reviewer surface does not run validators or accept uploads

If you only need a static fallback demo, pre-generate artifacts locally and serve the built portal. In that mode the portal can still load `sample-data/` or generated `artifacts/` without needing live collection.


## Deadline RunPod MVP pivot

Visual redesign phases are paused for the July 21, 2026 deadline sprint. The next product step is backend/agent integration, documented in `docs/RUNPOD_MVP_ARCHITECTURE.md`: GPUValidator frontend → backend → queued validation job → outbound-polling RunPod agent → real GPU command execution → result upload → dashboard and inventory display. The backend should not SSH into RunPod during normal operation.

## Local fallback demo

If the host environment does not have GPU, Slurm, or InfiniBand tooling installed, use the deterministic scenarios:

```bash
source .venv/bin/activate
ai-validator demo --scenario healthy --output-dir artifacts
ai-validator demo --scenario degraded --output-dir artifacts
npm run dev
```

This preserves the interview walkthrough without depending on physical hardware.

## Benchmark intelligence scope

Current engagement benchmark import support:
- NCCL Tests (`all_reduce_perf`, `all_gather_perf`, `reduce_scatter_perf`, `broadcast_perf`)
- NVIDIA HPL
- Triton Performance Analyzer
- GenAI-Perf

Portal language distinguishes:
- supported result ingestion
- demonstrated sample data
- future orchestration

Roadmap-only items include:
- benchmark execution/orchestration
- HPL-AI execution
- HPCG execution
- MLPerf result integration
- Base Command Manager integration
- Ansible multi-node collection

## Validation commands used for this repo

```bash
npm run build
npm run lint
npm run test:portal
source .venv/bin/activate
pip install -e ".[dev]"
pytest
ai-validator demo --scenario healthy --output-dir artifacts
ai-validator demo --scenario degraded --output-dir artifacts
```

## Design system and redesign workflow

GPUValidator redesign preparation artifacts live in:
- `docs/DESIGN_SYSTEM.md` — permanent visual-system rules and anti-patterns
- `docs/PRODUCT_SITEMAP.md` — intended product hierarchy and route architecture
- `docs/REDESIGN_IMPLEMENTATION_PLAN.md` — page-by-page redesign migration plan
- `docs/REDESIGN_CURRENT_STATE.md` — current implementation audit before visual changes
- `docs/REDESIGN_CHANGELOG.md` — phase-by-phase redesign implementation record
- `design/README.md` — reference-image library and screenshot workflow
- `design/manifests/reference-images.json` — normalized reference image inventory
- `design/manifests/routes.json` — machine-readable intended route map

Screenshot commands:
```bash
npm run design:screenshot -- --route=/login --name=login
npm run design:screenshot:all
npm run design:compare -- --reference=design/references/authentication/login.png --current=design/implementation-screenshots/current/login-1536x1024.png
```

Generated reference images are visual guidance. The design-system document, tokens, current product behavior, accessibility, and operational usability take priority over literal generated-image text.

## Current limitations

- Live validation is single-host only; it does not orchestrate remote multi-node collection.
- Evidence bundle collection is local-only and administrator-side; engagement uploads are outbound HTTPS using scoped upload tokens.
- Benchmark intelligence imports existing output files only; it does not launch benchmarks or claim official MLPerf compliance.
- Scenario data is simulated interview evidence, not production telemetry.
- Benchmark execution is not orchestrated by the portal; benchmark readiness currently focuses on ingestion scope and presentation.
- Customer acceptance logic is derived from the existing readiness classification and structured findings; it is not a separate policy engine.

See `docs/DEMO.md` for the two-minute walkthrough, `docs/EVIDENCE_COLLECTION.md` for read-only bundle collection, `docs/ENGAGEMENTS.md` for multi-node validation engagements, `docs/ARCHITECTURE.md` for component flow, `docs/FUNCTIONAL_TEST_MATRIX.md` for coverage, `docs/FINAL_READINESS.md` for the final public deployment readiness audit, and `docs/ROADMAP.md` for future integration scope.
