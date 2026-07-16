# AI Compute Readiness Validator

AI Compute Readiness Validator is a read-only assessment toolkit for AI/HPC hosts and cluster demos. It combines:
- a Python CLI (`ai-validator`) that collects host evidence, scores readiness, and emits JSON/Markdown/standalone HTML reports
- a Vite/React + Express portal that loads the generated report data for an interview-friendly walkthrough

The project is intentionally zero-mutation: collectors only execute local read-only commands and tolerate missing platform utilities.

## What it validates

Current live collectors cover:
- Linux platform basics: OS, swap, huge pages, kernel errors
- NVIDIA GPU tooling and health: `nvidia-smi`, ECC, NVLink, DCGM
- InfiniBand and networking: `ibstat`, RDMA, link state, routes, packet drops
- Slurm reachability and node state
- Kubernetes reachability, node readiness, GPU Operator visibility
- Storage basics: filesystems, NVMe, shared-filesystem client presence

The CLI also supports offline benchmark log ingestion for:
- NCCL
- HPL
- fio
- iperf3
- OSU MPI

## Repository layout

```text
src/ai_validator/         Python package: CLI, collectors, scoring, reporting, demo scenarios
src/App.tsx               React dashboard
server.ts                 Express API + Vite middleware / static host
tests/test_validation.py  Pytest regression coverage
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
ai-validator demo --scenario healthy --output-dir artifacts/demo
ai-validator demo --scenario degraded --output-dir artifacts/demo
ai-validator report --input artifacts/demo/degraded-results.json --output-dir artifacts/regenerated
ai-validator benchmark ingest --type fio --file sample-data/sample-fio.json
```

Demo runs now emit both rolling and scenario-specific artifacts in the chosen output directory:
- `latest-results.json`, `latest-report.html`, `latest-report.md`
- `<scenario>-results.json`, `<scenario>-report.html`, `<scenario>-report.md`

### Frontend / portal

```bash
npm install
npm run lint
npm run build
npm run dev
```

Open `http://localhost:3000`.

Portal behavior:
- `GET /api/results?scenario=healthy|degraded` loads generated scenario artifacts from `artifacts/` when present, otherwise falls back to checked-in `sample-data/`
- `POST /api/run-scenario` runs the local CLI from `.venv` when available and refreshes the displayed data from the generated report files

## Report outputs

Each validation/demo run writes three deliverables:
- JSON: machine-readable scored cluster model
- Markdown: text report for sharing or versioning
- HTML: standalone self-contained report with inline CSS

Example generated files:
- `artifacts/latest-results.json`
- `artifacts/latest-report.md`
- `artifacts/latest-report.html`
- `artifacts/degraded-results.json`
- `artifacts/degraded-report.md`
- `artifacts/degraded-report.html`

## Validation commands used for this repo

```bash
npm run build
source .venv/bin/activate
pip install -e ".[dev]"
ai-validator --help
ai-validator version
ai-validator demo --scenario healthy
ai-validator demo --scenario degraded
pytest
```

## Current limitations

- Live validation is single-host only; it does not orchestrate remote cluster fan-out.
- The dashboard focuses on generated report visualization, not continuous background collection.
- Benchmark ingestion exists in the CLI; the UI benchmark buttons are still a lightweight demo path rather than a full upload workflow.
- The checked-in sample scenarios are synthetic interview fixtures, not captured production hardware snapshots.

See `docs/CURRENT_STATE.md` for the latest validated status and `docs/NEXT_ACTIONS.md` for the remaining follow-up list.
