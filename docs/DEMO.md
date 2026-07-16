# Demo

The project includes two deterministic interview scenarios that exercise the full scoring/reporting pipeline without requiring NVIDIA, InfiniBand, Slurm, or Kubernetes on the local machine.

## Scenarios

### Healthy

Command:

```bash
ai-validator demo --scenario healthy --output-dir artifacts
```

Expected outcome:
- score: 100.0
- classification: `Ready`
- recommendations: 0
- generated files:
  - `artifacts/latest-results.json`
  - `artifacts/latest-report.md`
  - `artifacts/latest-report.html`
  - `artifacts/healthy-results.json`
  - `artifacts/healthy-report.md`
  - `artifacts/healthy-report.html`

### Degraded

Command:

```bash
ai-validator demo --scenario degraded --output-dir artifacts
```

Expected outcome:
- score: 97.01
- classification: `Remediation required`
- recommendations: 4
- generated files:
  - `artifacts/latest-results.json`
  - `artifacts/latest-report.md`
  - `artifacts/latest-report.html`
  - `artifacts/degraded-results.json`
  - `artifacts/degraded-report.md`
  - `artifacts/degraded-report.html`

Injected degraded findings:
- `dgx03`: InfiniBand link speed degraded
- `dgx04`: GPU ECC critical failure
- `dgx04`: Slurm node drained
- `dgx04`: Kubernetes GPU Operator/device plugin issue

## Frontend walkthrough

Start the portal:

```bash
npm run dev
```

Useful checks:
- `GET /api/results?scenario=healthy`
- `GET /api/results?scenario=degraded`
- `POST /api/run-scenario` with `{"scenario":"degraded"}`

The portal now prefers generated scenario outputs from `artifacts/` and falls back to `sample-data/` only when no generated scenario artifact exists yet.

## Interview artifact set

The degraded scenario is the strongest interview walkthrough because it demonstrates:
- weighted scoring that stays numerically high while still classifying as remediation-required
- critical-failure override behavior
- actionable remediation text
- node-level differentiation (`PASS`, `WARN`, `FAIL`)
- consistent JSON, Markdown, and standalone HTML deliverables
