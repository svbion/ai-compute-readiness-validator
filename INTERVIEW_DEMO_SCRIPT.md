Generated: 2026-07-21T15:46:36.995936+00:00
Source basis: repository audit of server.ts, src/App.tsx, src/server/*, src/portal/*, agent/gpuvalidator_agent/*, tests-portal/*, package.json, pyproject.toml. No production deployment was performed.

# Interview Demo Script

GPUValidator validates GPU infrastructure readiness continuously rather than as a one-off script. In this demo, the RunPod A100x4 agent registers, heartbeats, exposes GPU count, runs hardware discovery, feeds live inventory, and generates customer/management reports with provenance. When data is missing, GPUValidator says Not collected instead of inventing measurements.
