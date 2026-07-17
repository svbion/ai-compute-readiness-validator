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
ai-validator demo --scenario healthy --output-dir artifacts
ai-validator demo --scenario degraded --output-dir artifacts
ai-validator report --input artifacts/degraded-results.json --output-dir artifacts/regenerated
```

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

Open `http://localhost:3000`.

Portal API behavior:
- `GET /api/results?scenario=healthy|degraded` loads generated scenario artifacts from `artifacts/` when present and otherwise falls back to checked-in `sample-data/`
- `GET /api/evidence-sources` lists simulated sources and only exposes live/imported choices when valid live artifacts exist
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
3. report links for HTML, Markdown, and JSON evidence
4. benchmark readiness tab for supported ingestion vs roadmap-only orchestration

## Hosted deployment guidance

This project is intentionally simple to host because the portal only depends on static frontend assets plus the existing Express server.

Recommended hosted pattern:
- build with `npm run build`
- run `node dist/server.cjs`
- keep generated artifacts under `artifacts/`
- generate demo/live/imported artifacts through administrator-side CLI tools before review; the public reviewer surface does not run validators or accept uploads

If you only need a static fallback demo, pre-generate artifacts locally and serve the built portal. In that mode the portal can still load `sample-data/` or generated `artifacts/` without needing live collection.

## Local fallback demo

If the host environment does not have GPU, Slurm, or InfiniBand tooling installed, use the deterministic scenarios:

```bash
source .venv/bin/activate
ai-validator demo --scenario healthy --output-dir artifacts
ai-validator demo --scenario degraded --output-dir artifacts
npm run dev
```

This preserves the interview walkthrough without depending on physical hardware.

## Benchmark readiness scope

Current CLI ingestion support:
- NCCL Tests
- HPL
- fio
- iperf3
- OSU MPI

Portal language distinguishes:
- supported result ingestion
- demonstrated sample data
- future orchestration

Roadmap-only items include:
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

## Current limitations

- Live validation is single-host only; it does not orchestrate remote multi-node collection.
- Scenario data is simulated interview evidence, not production telemetry.
- Benchmark execution is not orchestrated by the portal; benchmark readiness currently focuses on ingestion scope and presentation.
- Customer acceptance logic is derived from the existing readiness classification and structured findings; it is not a separate policy engine.

See `docs/DEMO.md` for the two-minute walkthrough, `docs/ARCHITECTURE.md` for component flow, `docs/FUNCTIONAL_TEST_MATRIX.md` for coverage, `docs/FINAL_READINESS.md` for the final public deployment readiness audit, and `docs/ROADMAP.md` for future integration scope.
