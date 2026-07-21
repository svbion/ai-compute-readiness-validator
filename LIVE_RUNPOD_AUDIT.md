Generated: 2026-07-21T15:46:36.995936+00:00
Source basis: repository audit of server.ts, src/App.tsx, src/server/*, src/portal/*, agent/gpuvalidator_agent/*, tests-portal/*, package.json, pyproject.toml. No production deployment was performed.

# Live RunPod Audit

## Code-path audit
- Agent registration endpoint: POST /api/v1/agents/register in src/server/agents.ts. Requires GPUVALIDATOR_AGENT_TOKEN bearer auth and idempotently keys by agent name + hostname.
- Heartbeat endpoint: POST /api/v1/agents/heartbeat. Updates capabilities, gpu_count, agent_version, last_error, and derived online/degraded/offline state.
- Job polling endpoint: GET /api/v1/agents/:agentId/jobs/next. Returns one queued job for the selected agent.
- Claim endpoint: POST /api/v1/agents/:agentId/jobs/:jobId/claim. Performs state transition queued -> claimed and rejects duplicate claims.
- Running endpoint: POST /api/v1/agents/:agentId/jobs/:jobId/running. Sets started_at and command diagnostics.
- Result upload endpoint: POST /api/v1/jobs/:jobId/results. Validates agent ownership, result state, truncates output, hashes evidence, stores structured_result/stdout/stderr, and updates validation state.
- Frontend polling: useLiveAgentData in src/App.tsx polls agents and validations every 4-6 seconds depending page.
- Dashboard live panel: LiveAgentPanel in src/App.tsx.
- GPU Inventory live derivation: deriveLiveGpuInventory in src/portal/agents.ts.

## Current live target expectations
- Current target may appear as runpod-a100x4-01 / 3749527c40dd / 4 GPUs.
- Values are not hard-coded by the backend; tests seed similar fixtures only as contract tests.
- Report generation includes those fields only if present in the live agent/validation store.

## Verification command sequence
1. Ensure backend has GPUVALIDATOR_AGENT_TOKEN set.
2. Start local backend: npm run dev.
3. Start RunPod agent with GPUVALIDATOR_API_URL, GPUVALIDATOR_AGENT_TOKEN, GPUVALIDATOR_AGENT_NAME=runpod-a100x4-01.
4. Open /portal and confirm Live Agent panel shows one online agent and four GPUs.
5. Run hardware validation and watch queued -> claimed/running -> completed/failed/timed_out.
6. Open /portal/inventory/gpus and verify four A100 rows from Live Agent evidence.
7. Generate /portal/reports customer report and verify generated report includes live validation ID, agent ID, UUIDs, and provenance.

## Blockers that require live infrastructure access
- This local coding session did not query the actual RunPod pod or production backend. External verification still must be run against the live deployment and tokenized agent.
