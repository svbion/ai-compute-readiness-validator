# Architecture

## Goal

Provide an interview-ready enterprise validation MVP that can:
- run read-only host checks without sudo
- score observed evidence with transparent weighting
- generate portable reports in JSON, Markdown, and standalone HTML
- render the same report model in an acceptance-oriented portal
- distinguish aggregate health from customer handoff approval

## High-level flow

```text
Local host or deterministic demo scenario
        │
        ▼
Collectors / demo generators
        │
        ▼
Pydantic models (`Cluster`, `Node`, `ValidationCheck`, `CommandEvidence`)
        │
        ▼
Scoring engine (`ScoringEngine.evaluate_cluster`)
        │
        ├── JSON report
        ├── Markdown report
        ├── standalone HTML report
        └── Express API / React portal
```

## Python subsystem

Primary files:
- `src/ai_validator/cli.py` — Typer CLI commands: `validate`, `demo`, `report`, `version`, `benchmark`
- `src/ai_validator/runner.py` — centralized read-only command execution and output sanitization
- `src/ai_validator/models.py` — Pydantic models for checks, nodes, clusters, benchmark results, and evidence
- `src/ai_validator/scoring.py` — category scoring, weight redistribution, node status rollup, recommendation extraction, classification gates
- `src/ai_validator/collectors/*.py` — live collectors grouped by subsystem
- `src/ai_validator/demo/generator.py` — deterministic healthy/degraded demo scenarios
- `src/ai_validator/reporting/*.py` — JSON/Markdown/HTML generators
- `src/ai_validator/reporting/templates/report.html.j2` — inline-style standalone HTML template

### Live validation path

1. `ai-validator validate` instantiates all collectors.
2. Each collector returns `ValidationCheck` entries with command evidence.
3. Checks are grouped into categories on a single `Node`.
4. `ScoringEngine.evaluate_cluster` computes category averages, overall score, and final classification.
5. Reports are written as `latest-results.json`, `latest-report.md`, and `latest-report.html`.

### Demo path

1. `ai-validator demo --scenario healthy|degraded` loads deterministic fixture data.
2. The same scoring and reporting path is reused.
3. The CLI writes both rolling `latest-*` artifacts and scenario-specific `healthy-*` / `degraded-*` artifacts.

## Scoring and acceptance model

Default weights from `src/ai_validator/config.py`:
- GPU: 30
- Network: 20
- Linux: 15
- Slurm: 15
- Storage: 10
- Kubernetes: 10

Behavior:
- category scores are based on scorable checks only (`pass`, `warning`, `fail`)
- warnings receive partial credit in the Python scoring engine
- unavailable/skipped/unknown checks do not count toward a category denominator
- categories with no scorable checks are removed from the active-weight pool
- critical failed checks can cap classification at `Remediation required`

Portal interpretation:
- Overall Readiness Score represents aggregate infrastructure health
- Customer Acceptance Status is derived from the structured findings and existing classification
- a release-blocking critical finding remains dominant even when the numerical score is high

## Frontend / portal

Primary files:
- `server.ts` — Express API plus Vite dev middleware / static production hosting
- `src/App.tsx` — single-page portal rendering validation and acceptance views
- `src/portal/assessment.ts` — derivation helpers for acceptance, GPU, fabric, scheduler, benchmark, and report-link presentation

### API behavior

- `GET /api/results?scenario=healthy|degraded`
  - prefers generated `artifacts/<scenario>-results.json`
  - falls back to checked-in `sample-data/<scenario>-cluster.json`
- `GET /api/evidence-sources`
  - lists simulated sources by default
  - adds latest/imported live sources only when valid live artifacts exist
- `POST /api/run-scenario`
  - returns `405` by design
  - keeps the reviewer portal read-only; validation and import remain administrator-side CLI actions
- `GET /reports/:scenario/:format`
  - safe report route for scenario HTML, Markdown, and JSON evidence

### Information hierarchy

The portal is intentionally organized for customer-acceptance conversations:
1. product positioning and scenario controls
2. Overall Readiness Score vs Customer Acceptance Status
3. Customer Acceptance Gate
4. category score rollup
5. Cluster Topology
6. GPU Health
7. InfiniBand / RDMA Fabric Health
8. Scheduler and Orchestration
9. Customer Handoff Summary
10. Report Access and Interview Walkthrough
11. Benchmark Readiness

## Design constraints

- reviewer portal is read-only: no uploads, no browser-side imports, and no reviewer-triggered validators
- no database or external service dependency required for local demo success
- report files remain first-class artifacts; the UI reads the same JSON model produced by the CLI
- demo data remains deterministic so interview runs are reproducible
- target-profile language must not imply vendor endorsement or certification
