# Demo

The repository includes two deterministic portal scenarios that exercise the full scoring, reporting, and acceptance workflow without requiring GPU hardware, InfiniBand fabric, Slurm, or Kubernetes on the local machine.

## Scenario commands

```bash
source .venv/bin/activate
ai-validator demo --scenario healthy --output-dir artifacts
ai-validator demo --scenario degraded --output-dir artifacts
npm run dev
```

Open `http://localhost:3000`.

## Expected results

### Healthy scenario

Expected portal outcome:
- Overall Readiness Score: `100.00%`
- Customer Acceptance Status: `Approved for handoff`
- Recommendations: `0`
- Node states:
  - `dgx01`: pass
  - `dgx02`: pass
  - `dgx03`: pass
  - `dgx04`: pass

### Degraded scenario

Expected portal outcome:
- Overall Readiness Score: `97.01%`
- Customer Acceptance Status: `Remediation required`
- Recommendations: `4`
- Node states:
  - `dgx01`: pass
  - `dgx02`: pass
  - `dgx03`: warning
  - `dgx04`: fail

Injected degraded findings:
- `dgx03`: InfiniBand link negotiated below the expected rate
- `dgx04`: critical GPU ECC failure on `GPU 5`
- `dgx04`: Slurm node drained
- `dgx04`: Kubernetes GPU Operator / device plugin warning

## Why 97.01% can still equal Remediation required

The readiness score measures aggregate infrastructure health, while the customer acceptance gate enforces release-blocking conditions. A critical GPU fault blocks handoff even when most other checks pass.

That distinction is deliberate in the portal:
- the score shows overall cluster condition
- the acceptance gate shows whether handoff can proceed
- a critical blocker remains dominant even when the numerical score stays high

## Two-minute interview walkthrough

Suggested flow:

1. Start on the degraded scenario.
2. Point out the difference between Overall Readiness Score and Customer Acceptance Status.
3. Open Customer Acceptance Gate and explain why handoff is blocked.
4. Show Cluster Topology:
   - `dgx03` flagged for InfiniBand degradation
   - `dgx04` flagged for GPU and scheduler issues
5. Show GPU Health and call out `dgx04 / GPU 5` uncorrectable ECC errors.
6. Show Scheduler and Orchestration:
   - `dgx04` drained in Slurm
   - GPU Operator warning visible
   - emphasize intentional scheduler isolation during investigation
7. Show Customer Handoff Summary and report links.
8. Switch to the healthy scenario to show the same validation profile passing customer acceptance.
9. Open Benchmark Readiness and explain supported ingestion vs roadmap-only orchestration.

## API checks

Useful endpoint checks while the portal is running:

```bash
curl http://127.0.0.1:3000/api/results?scenario=healthy
curl http://127.0.0.1:3000/api/results?scenario=degraded
curl http://127.0.0.1:3000/api/evidence-sources
curl -i -X POST \
  -H "Content-Type: application/json" \
  -d '{"scenario":"degraded"}' \
  http://127.0.0.1:3000/api/run-scenario
```

`POST /api/run-scenario` should return `405`. The reviewer portal is read-only; generate demo artifacts with `ai-validator demo` and import live evidence with the administrator-side CLI tools.

Safe report routes:

```bash
open http://127.0.0.1:3000/reports/healthy/html
open http://127.0.0.1:3000/reports/degraded/html
open http://127.0.0.1:3000/reports/degraded/markdown
open http://127.0.0.1:3000/reports/degraded/json
```

## Generated artifacts

Healthy:
- `artifacts/healthy-results.json`
- `artifacts/healthy-report.html`
- `artifacts/healthy-report.md`

Degraded:
- `artifacts/degraded-results.json`
- `artifacts/degraded-report.html`
- `artifacts/degraded-report.md`

Rolling latest artifacts:
- `artifacts/latest-results.json`
- `artifacts/latest-report.html`
- `artifacts/latest-report.md`
