# Architecture

## Goal

Provide a polished interview-ready MVP that can:
- run read-only live host checks without sudo
- score the observed evidence with transparent weighting
- generate portable reports in JSON, Markdown, and standalone HTML
- drive a lightweight portal that visualizes the same report data

## High-level flow

```text
Local host or demo scenario
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
- `src/ai_validator/scoring.py` — category scoring, weight redistribution, node status rollup, recommendation extraction
- `src/ai_validator/collectors/*.py` — live collectors grouped by subsystem
- `src/ai_validator/demo/generator.py` — deterministic healthy/degraded demo scenarios
- `src/ai_validator/reporting/*.py` — JSON/Markdown/HTML generators
- `src/ai_validator/reporting/templates/report.html.j2` — inline-style standalone HTML template

### Live validation path

1. `ai-validator validate` instantiates all collectors.
2. Each collector returns `ValidationCheck` entries with command evidence.
3. Checks are grouped into categories on a single `Node`.
4. `ScoringEngine.evaluate_cluster` computes category scores and overall classification.
5. Reports are written as `latest-results.json`, `latest-report.md`, and `latest-report.html`.

### Demo path

1. `ai-validator demo --scenario healthy|degraded` loads deterministic fixture data.
2. The same scoring and reporting path is reused.
3. The CLI writes both rolling `latest-*` artifacts and scenario-specific `healthy-*` / `degraded-*` artifacts.

## Scoring model

Default weights from `src/ai_validator/config.py`:
- GPU: 30
- Network: 20
- Linux: 15
- Slurm: 15
- Storage: 10
- Kubernetes: 10

Behavior:
- category scores are based on scorable checks only (`pass`, `warning`, `fail`)
- warnings receive partial credit
- unavailable/skipped/unknown checks do not count toward a category denominator
- categories with no scorable checks are removed from the active-weight pool
- critical failed checks can cap classification at `Remediation required`

## Frontend / portal

Primary files:
- `server.ts` — Express API plus Vite dev middleware / static production hosting
- `src/App.tsx` — large single-page dashboard rendering cluster summaries, nodes, checks, evidence, and demo interactions

### API behavior

- `GET /api/results?scenario=healthy|degraded`
  - prefers generated `artifacts/<scenario>-results.json`
  - falls back to checked-in `sample-data/<scenario>-cluster.json`
- `GET /api/node-history/:nodeName`
  - returns deterministic synthetic trend data for presentation
- `POST /api/run-scenario`
  - resolves the validator executable from the repo `.venv` when available
  - runs `ai-validator demo --scenario ... --output-dir artifacts`
  - returns the generated scenario JSON

## Design constraints

- zero-mutation command execution only
- no database or external service dependency required for local demo success
- report files remain first-class artifacts; the UI reads the same JSON model produced by the CLI
- demo data must remain deterministic so interview runs are reproducible
