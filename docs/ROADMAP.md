# Roadmap

This roadmap keeps the project aligned with its current interview-MVP scope while making future expansion explicit.

## Phase 0: Interview MVP stabilization

Status: complete enough for a senior infrastructure interview demo.

Delivered:
- Python packaging and CLI entry point
- deterministic healthy/degraded demo scenarios
- JSON, Markdown, and standalone HTML report generation
- live read-only collectors with graceful missing-command handling
- acceptance-oriented React/Express portal
- separation of aggregate readiness score from customer acceptance gate
- topology, GPU, fabric, scheduler, and handoff presentation
- safe report-link routing from the portal
- documentation for architecture, security, roadmap, and demo usage

## Phase 1: Customer acceptance workflow maturation

Potential next steps:
- explicit evidence bundles for signoff review
- waiver tracking for non-blocking findings
- baseline comparison between acceptance runs
- configuration-drift summaries against a reference profile
- customer acceptance workflow automation

## Phase 2: Multi-node live collection

Only pursue this if the project scope expands beyond interview MVP.

Possible additions:
- Ansible multi-node collection
- inventory-driven remote fan-out over SSH
- bastion-host execution patterns
- richer cluster identity and node-role modeling
- aggregated multi-node evidence packaging

## Phase 3: GPU and fabric operational deepening

Possible additions:
- DCGM orchestration for richer diagnostics
- NCCL execution orchestration
- HPL execution orchestration
- HPL-AI execution orchestration
- HPCG execution orchestration
- richer InfiniBand topology and counter collection
- customer-visible remediation runbooks tied to findings

## Phase 4: Evidence and benchmark integration

Possible additions:
- MLPerf result integration
- side-by-side comparison of benchmark runs
- benchmark thresholds tied into readiness recommendations
- signed or archived evidence bundles for customer handoff

## Phase 5: Enterprise platform integrations

Possible additions:
- Base Command Manager integration
- richer scheduler/orchestrator inventory synchronization
- configuration profile import/export
- acceptance-ready deployment profile templates

## Non-goals for current scope

The current project intentionally avoids:
- databases
- authentication systems
- cloud services
- telemetry pipelines
- LLM integration
- microservices
- mutating remediation automation
