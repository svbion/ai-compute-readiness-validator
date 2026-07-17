# Current State

Last updated during the final deployment, authentication-entry, functional-quality, and real-hardware readiness pass on branch `hermes-mvp`.

## Starting repository state

Pre-flight commands confirmed:

- Working directory: `/Users/svbion/Projects/ai-compute-readiness-validator`
- Branch: `hermes-mvp`
- Remote: `origin https://github.com/svbion/ai-compute-readiness-validator.git`
- Latest pushed commits at start of this pass:
  - `22add08 docs: add Hetzner deployment guide`
  - `a6fb9c8 feat: add systemd and caddy deployment assets`
  - `499bc13 feat: add production deployment automation`
- The working tree only contained generated artifact timestamp/content churn under `artifacts/` from prior validation runs.

## Application architecture observed

- React/Vite single-page portal in `src/App.tsx` with derivation helpers in `src/portal/assessment.ts`.
- Express server in `server.ts` serving:
  - `GET /api/results?scenario=healthy|degraded`
  - `GET /api/node-history/:nodeName`
  - `GET /api/evidence-sources`
  - `POST /api/run-scenario` as a read-only guard that returns `405`
  - `GET /reports/:scenario/:format`
  - Vite middleware in development and static `dist/` assets in production.
- Python Typer CLI in `src/ai_validator/cli.py` with commands:
  - `validate`
  - `demo`
  - `report`
  - `version`
  - `benchmark ingest`
- Read-only command execution is centralized in `src/ai_validator/runner.py`.
- Live collectors exist for Linux, GPU, DCGM, InfiniBand/RDMA, Slurm, Kubernetes, storage, and standard network state.
- Deterministic healthy/degraded demo scenarios are generated through `src/ai_validator/demo/generator.py`.
- JSON, Markdown, and standalone HTML reports are generated through `src/ai_validator/reporting/`.
- Deployment assets exist under `deploy/` for install, update, rollback, healthcheck, verify, systemd, and Caddy.

## Baseline validation run

The following baseline passed before feature work in this pass:

```bash
npm ci
npm run build
npm run lint
npm run test:portal
source .venv/bin/activate 2>/dev/null || true
pip install -e ".[dev]"
pytest
ai-validator --help
ai-validator version
ai-validator demo --scenario healthy --output-dir artifacts
ai-validator demo --scenario degraded --output-dir artifacts
NODE_ENV=production PORT=3000 node dist/server.cjs
APP_DIR="$PWD" deploy/healthcheck.sh
APP_DIR="$PWD" deploy/verify.sh
```

Observed results:

- Production build passed.
- TypeScript lint passed.
- Portal unit tests passed: 5/5.
- Python tests passed: 6/6.
- CLI help and version commands worked.
- Healthy scenario generated expected `100.0%` / `Ready` output.
- Degraded scenario generated expected `97.01%` / `Remediation required` output.
- Production server started on `0.0.0.0:3000`.
- Manual curl smoke checks passed for root, API results, node history, scenario execution, and report routes.
- `deploy/healthcheck.sh` passed locally with `APP_DIR="$PWD"`.
- `deploy/verify.sh` passed locally with `APP_DIR="$PWD"`.

## Gaps identified before implementation

Authentication and login:

- No existing secure authentication backend, session store, invite-only account workflow, or protected-route boundary existed.
- No login page existed.
- Production deployment did not yet expose auth-related environment variables.
- `/healthz` did not exist as a minimal public health endpoint.

Functional quality:

- No browser-level E2E test framework existed.
- Functional coverage existed for core derivation helpers, but not for browser login, scenario switching, report links, responsive layout, API error handling, logout, or session behavior.
- A formal feature-by-feature functional test matrix did not exist.

Deployment readiness:

- Deployment scripts installed and verified the service, but did not yet include dry-run support, Ubuntu/architecture validation, optional Caddy installation flow, auth environment variables, `/healthz`, authenticated verification, or `npm run verify:production`.

Real NVIDIA hardware readiness:

- Existing collectors were read-only and already covered many relevant utilities, but profile selection did not yet exist for `ai-validator validate --profile ...`.
- Provenance fields did not yet consistently label simulated versus live/imported evidence.
- No portable collection bundle, sanitizer, import workflow, real-hardware validation guide, or DGX access playbook existed.
- DCGM collector currently ran `dcgmi diag -r 1`; active diagnostics need to remain explicitly documented and non-intrusive by default.

## Constraints retained

- Preserve current React/Vite + Express + Python CLI architecture.
- Keep API and CLI compatibility.
- Keep validator operations read-only.
- Do not claim real NVIDIA hardware validation without verified command evidence.
- Do not add public registration, hard-coded credentials, telemetry, analytics, database dependency, Docker, Kubernetes deployment, Terraform, Ansible, or LLM dependencies.

## Product branding note

GPU Validator is the public product brand. AI Factory remains a validation profile and infrastructure-readiness concept, and the Git repository remains `ai-compute-readiness-validator` for compatibility. The canonical public URL is `https://gpuvalidator.com`.
