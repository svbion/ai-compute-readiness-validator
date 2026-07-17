# Next Actions

This file tracks the small, remaining follow-up list after the recovery run.

## Highest-priority completed items

- [x] Recover prior-session work without restarting from scratch
- [x] Confirm build, packaging, CLI, and pytest status
- [x] Fix frontend scenario trigger execution path
- [x] Preserve scenario-specific healthy/degraded artifacts
- [x] Refresh core project documentation

## Remaining follow-up items

- [ ] Add a real frontend benchmark ingestion flow that invokes `ai-validator benchmark ingest` instead of the current demo-only placeholder behavior
- [ ] Add focused frontend/API tests if this repo adopts a JS test runner
- [ ] Optionally refresh checked-in `sample-data/` HTML/Markdown fixtures from the latest scenario-specific generated outputs when a curated demo snapshot is desired
- [ ] Add multi-host inventory/orchestration only if the project scope expands beyond interview MVP status

## Recommended validation before any future release/tag

```bash
npm run build
source .venv/bin/activate
pip install -e ".[dev]"
ai-validator demo --scenario healthy
ai-validator demo --scenario degraded
pytest
```

## Product branding note

GPU Validator is the public product brand. AI Factory remains a validation profile and infrastructure-readiness concept, and the Git repository remains `ai-compute-readiness-validator` for compatibility. The canonical public URL is `https://gpuvalidator.com`.
