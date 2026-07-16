# Current State

Last validated in this engineering recovery run on branch `hermes-mvp`.

## Repository status inherited from the interrupted session

What was already working when this session resumed:
- Python packaging installed successfully with `pip install -e ".[dev]"`
- CLI entry points worked: `ai-validator --help`, `ai-validator version`
- Demo scenarios ran successfully and generated reports
- `pytest` was already green
- `npm run build` already produced a working production bundle
- checked-in demo JSON fixtures existed in `sample-data/healthy-cluster.json` and `sample-data/degraded-cluster.json`

What was still incomplete or broken:
- `docs/CURRENT_STATE.md` and `docs/NEXT_ACTIONS.md` did not exist
- README and supporting docs were stale versus actual repo behavior
- the frontend trigger endpoint used an invalid hard-coded interpreter path (`/.venv/bin/python`), so `POST /api/run-scenario` failed at runtime
- demo runs only refreshed `latest-*` artifacts; they did not preserve scenario-specific JSON/Markdown/HTML outputs for both healthy and degraded runs
- the portal preferred checked-in sample JSON for healthy/degraded views instead of generated scenario artifacts when they existed

## Status after this recovery session

Implemented in this session:
- fixed `server.ts` to resolve the local validator executable from the repo `.venv` and run demo scenarios successfully
- updated the results API to prefer generated `artifacts/healthy-results.json` / `artifacts/degraded-results.json` before falling back to `sample-data/`
- updated the CLI demo flow to emit both rolling `latest-*` files and scenario-specific `healthy-*` / `degraded-*` files
- added regression tests for scenario-specific demo outputs and command-runner mutation blocking
- refreshed README, architecture, security, roadmap, and demo documentation
- added this state file and a next-actions file

## Validated commands and outcomes

Validated successfully in this run:
- `npm run build`
- `pip install -e ".[dev]"`
- `ai-validator --help`
- `ai-validator version`
- `ai-validator demo --scenario healthy`
- `ai-validator demo --scenario degraded`
- `ai-validator validate --name local-smoke --output-dir artifacts/live-smoke`
- `pytest`
- `curl http://127.0.0.1:3000/api/results?scenario=healthy`
- `curl http://127.0.0.1:3000/api/results?scenario=degraded`
- `curl -X POST http://127.0.0.1:3000/api/run-scenario ...`

## Generated artifacts of interest

Current interview/demo outputs:
- `artifacts/latest-results.json`
- `artifacts/latest-report.md`
- `artifacts/latest-report.html`
- `artifacts/healthy-results.json`
- `artifacts/healthy-report.md`
- `artifacts/healthy-report.html`
- `artifacts/degraded-results.json`
- `artifacts/degraded-report.md`
- `artifacts/degraded-report.html`

## Known limitations

- Live validation remains local-host only.
- The UI benchmark ingestion controls are still demo-oriented; the authoritative benchmark workflow is the CLI.
- Sample scenario fixtures in `sample-data/` remain curated fixtures rather than regenerated per run.
