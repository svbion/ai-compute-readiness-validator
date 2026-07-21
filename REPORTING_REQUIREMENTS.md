Generated: 2026-07-21T15:46:36.995936+00:00
Source basis: repository audit of server.ts, src/App.tsx, src/server/*, src/portal/*, agent/gpuvalidator_agent/*, tests-portal/*, package.json, pyproject.toml. No production deployment was performed.

# Reporting Requirements

## Implemented required scopes
Report API accepts: organization, customer, engagement, site, datacenter, cluster, agent, node, gpu, gpu_group, validation_run, benchmark_run, incident, alert, comparison_period, custom.

## Implemented required report types
Templates exposed for Executive Summary, Customer Validation Report, Technical Infrastructure Report, GPU Health Report, GPU Inventory Report, Cluster Readiness Report, Node Validation Report, Individual GPU Report, NCCL Benchmark Report, HPL Benchmark Report, MLPerf Benchmark Report, Performance Regression Report, Incident Root Cause Report, Remediation Plan, Acceptance Test Report, Deployment Readiness Report, Evidence and Audit Report, Management Status Report, Weekly Operations Report, and Customer Handoff Package.

## Metadata defaults
- author_name default: Sabion P Frazier
- purpose default: GPUValidator interview demonstration
- Both are configurable in request/UI form.

## Server-side generation
- POST /api/v1/reports writes stable files under AI_VALIDATOR_REPORT_STORAGE_DIR or artifacts/reports/<report_id>/.
- Formats: HTML, Markdown, JSON, CSV, PDF, DOCX-compatible HTML.
- Every generated report stores metadata, source validation/benchmark/agent/node/GPU/evidence IDs, source timestamps, checksums, version, status, and format availability.

## Data integrity rule
Reports never fabricate absent data. The renderer uses Not collected, Not available, Not supported, Validation not run, or Not applicable when source records do not contain a field.
