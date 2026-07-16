# Roadmap

This roadmap keeps the project aligned with its current interview-MVP scope while making future expansion explicit.

## Phase 0: Interview MVP stabilization

Status: largely complete.

Delivered:
- Python packaging and CLI entry point
- deterministic healthy/degraded demo scenarios
- JSON, Markdown, and standalone HTML report generation
- live read-only collectors with graceful missing-command handling
- React/Express portal that can render generated report data
- documentation set for architecture, security, demo usage, current state, and next actions

Outstanding polish:
- optional frontend benchmark ingestion workflow beyond the current placeholder behavior
- optional JS-side automated tests if the frontend becomes a maintained product surface

## Phase 1: Better artifact and demo ergonomics

Potential next steps:
- explicit export/download controls for generated HTML/Markdown from the UI
- richer scenario catalog beyond healthy/degraded
- curated sample-data snapshots regenerated from scenario outputs on release checkpoints
- screenshot-backed interview script assets

## Phase 2: Multi-host live collection

Only pursue this if the project scope expands beyond interview MVP.

Possible additions:
- inventory-driven remote fan-out over SSH
- parallel multi-node collection and aggregation
- bastion-host execution patterns
- richer cluster identity and node-role modeling

## Phase 3: Benchmark workflow maturation

Possible additions:
- real upload or file-pick flow for benchmark ingestion in the UI
- benchmark thresholds wired into cluster recommendations
- side-by-side comparison of multiple benchmark runs

## Non-goals for current scope

The current project intentionally avoids:
- databases
- authentication systems
- cloud services
- telemetry pipelines
- LLM integration
- microservices
- mutating remediation automation
