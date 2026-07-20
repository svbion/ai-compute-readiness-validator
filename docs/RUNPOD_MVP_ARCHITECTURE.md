# RunPod MVP Architecture

Status: deadline sprint architecture audit for the July 21, 2026 2:00 PM America/New_York deadline.

Scope: define the smallest viable production architecture for connecting GPUValidator to real GPU execution through an outbound-polling RunPod agent. Step 2 implements the backend agent API, file-backed persistence, authentication, heartbeat, hardware-discovery validation-job queue, state transitions, and result upload protocol. Step 3 adds the standalone Python RunPod agent under `agent/`; external RunPod deployment/access is still not attempted from this repository.

## Deadline pivot

Visual redesign phases are paused. The immediate product path is:

```text
GPUValidator frontend
→ GPUValidator backend
→ queued validation job
→ outbound-polling RunPod agent
→ real GPU command execution
→ result upload
→ dashboard and inventory display
```

The backend must not SSH into RunPod during normal operation. The RunPod-side agent initiates all network traffic outbound over HTTPS.

## Repository architecture audit

### Backend framework

- `server.ts` is an Express 4 server.
- Development mounts Vite middleware with `createViteServer({ middlewareMode: true, appType: "spa" })`.
- Production serves `dist/` with `express.static` and falls back to `dist/index.html` for SPA routes.
- The Node server is bundled with esbuild to `dist/server.cjs`.

### Frontend framework

- Vite + React 19 + TypeScript.
- `src/App.tsx` uses manual `window.location.pathname` dispatch instead of React Router.
- Styling is tokenized through Tailwind/Vite CSS and `src/index.css`.

### Route handling

- Public root `/` now redirects deterministically to `/login` at the Express layer.
- `/login` serves the login UI; authenticated sessions visiting `/login` redirect to `/portal`.
- Protected HTML routes redirect unauthenticated users to `/login`.
- Protected API/report routes return `401` JSON while unauthenticated.
- Production SPA fallback preserves direct navigation to `/login`, `/portal`, `/portal/inventory/gpus`, and other client routes because Express serves `index.html` after auth middleware and static assets.

### Authentication

- Environment-driven auth in `src/server/auth.ts`.
- Production requires auth by default through `AI_FACTORY_AUTH_REQUIRED=true` or `NODE_ENV=production`.
- Session cookie: `ai_factory_session`, `HttpOnly`, `SameSite=Lax`, optionally `Secure`.
- Sessions are in memory; users are persisted separately.
- User auth supports a JSON user store and an environment reviewer fallback.
- Test/deploy checks may use `AI_FACTORY_AUTH_TEST_BYPASS_TOKEN`.

### Persistence layer

- No database exists today.
- No database migrations exist today.
- Persistence is file-backed JSON:
  - engagement store defaults to `artifacts/engagements/store.json` or `AI_VALIDATOR_ENGAGEMENT_STORE`
  - user store defaults to `artifacts/users/store.json` or `AI_VALIDATOR_USER_STORE`
  - evidence archives default under `artifacts/evidence` or `AI_VALIDATOR_EVIDENCE_STORAGE_DIR`
  - benchmark uploads default under `artifacts/benchmarks` or `AI_VALIDATOR_BENCHMARK_STORAGE_DIR`

### API structure

Current routes include:

- Auth: `/api/auth/config`, `/api/auth/session`, `/api/auth/login`, `/api/auth/logout`
- Scenario/live results: `/api/results`
- Evidence source selector: `/api/evidence-sources`
- Reports: `/reports/:scenario/:format`
- Engagements: `/api/v1/engagements*`
- Evidence upload and provenance: `/api/v1/evidence/uploads`, `/api/v1/engagements/:engagementId/evidence*`
- Intelligence: `/api/v1/engagements/:engagementId/comparison|findings|readiness`
- Benchmarks: `/api/v1/benchmarks/upload`, `/api/v1/engagements/:engagementId/benchmarks`
- Existing runner/benchmark execution scaffold: `/api/v1/runners/*` and `/api/v1/engagements/:engagementId/benchmark-jobs*`

### Current validation models

Python validation models live in `src/ai_validator/models.py` and related collectors/scoring modules. Portal engagement validation models live in `src/server/engagements.ts`:

- `Engagement`
- `EngagementNode`
- validation statuses: `not_evaluated`, `ready`, `observations`, `remediation_required`, `failed`
- acceptance statuses: `not_evaluated`, `ready`, `ready_with_observations`, `remediation_required`, `failed`

### Current evidence models

- Collector and archive schemas live under `src/ai_validator/evidence/*`.
- Server-side evidence ingestion lives in `src/server/evidence.ts`.
- Engagement evidence records include collection/upload timestamps, sanitized/simulated flags, command counts, bundle/manifest checksums, storage key, upload token ID, ingestion status, validation warnings, and display hostname.
- Raw storage paths are intentionally not exposed to the portal.

### Current `/api/results`

`GET /api/results` reads JSON artifacts from:

- `artifacts/<scenario>-results.json`
- `sample-data/<scenario>-cluster.json`
- `artifacts/live/latest-results.json`
- `artifacts/latest-live-results.json`
- `artifacts/imported-live/*/latest-results.json`

Live results are accepted only when metadata marks them non-simulated and valid for the requested live/imported source.

### Current `/api/evidence-sources`

`GET /api/evidence-sources` returns deterministic simulated sources plus live/imported sources only when valid artifacts exist. It does not create work or run commands.

### GPU Inventory data flow

`/portal/inventory/gpus` fetches all visible engagements and per-engagement node/evidence/comparison/findings/readiness data, then derives read-only GPU inventory in `src/portal/inventory.ts`. If no engagement GPU identity is available, it falls back to `/api/results?scenario=healthy` and labels that scope as simulated.

### Dashboard data flow

`/portal` uses `/api/evidence-sources` and `/api/results` to load scenario/live/imported validation payloads, then derives dashboard summaries in `src/portal/assessment.ts`. It does not invoke backend execution.

### Deployment architecture

- Single-server Node/Express app, built with Vite + esbuild.
- Repo-owned deployment scripts live under `deploy/`.
- Production app directory convention: `/opt/ai-factory-validator`.
- Optional Caddy reverse proxy can terminate TLS for `gpuvalidator.com` and `www.gpuvalidator.com`.
- `deploy/install.sh`, `deploy/update.sh`, `deploy/healthcheck.sh`, `deploy/verify.sh`, and `deploy/status.sh` are covered by `npm run test:deploy`.
- No Dockerfile exists in the repository.

### Environment variables

Important current variables:

- `PORT`
- `AI_FACTORY_AUTH_REQUIRED`
- `AI_FACTORY_SESSION_SECRET`
- `AI_FACTORY_REVIEWER_USERNAME`
- `AI_FACTORY_REVIEWER_PASSWORD_HASH`
- `AI_FACTORY_SESSION_TTL_SECONDS`
- `AI_FACTORY_COOKIE_SECURE`
- `AI_FACTORY_AUTH_TEST_BYPASS_TOKEN`
- `AI_VALIDATOR_USER_STORE`
- `AI_VALIDATOR_ENGAGEMENT_STORE`
- `AI_VALIDATOR_EVIDENCE_STORAGE_DIR`
- `AI_VALIDATOR_BENCHMARK_STORAGE_DIR`
- `AI_VALIDATOR_PUBLIC_BASE_URL`
- `AI_VALIDATOR_EVIDENCE_MAX_COMPRESSED_BYTES`
- `AI_VALIDATOR_EVIDENCE_MAX_EXPANDED_BYTES`
- `AI_VALIDATOR_EVIDENCE_MAX_FILE_BYTES`
- `AI_VALIDATOR_EVIDENCE_MAX_FILE_COUNT`
- `AI_VALIDATOR_UPLOAD_TOKEN_MAX_SECONDS`
- `AI_VALIDATOR_UPLOAD_TOKEN_DEFAULT_SECONDS`
- `AI_VALIDATOR_RUNNER_ONLINE_SECONDS`
- `AI_VALIDATOR_RUNNER_OFFLINE_SECONDS`
- benchmark threshold variables such as `AI_VALIDATOR_NCCL_MIN_AVERAGE_BUS_BANDWIDTH`

Proposed new RunPod agent variable:

- `GPUVALIDATOR_AGENT_TOKEN`

### Existing Docker files

None found. Production deployment currently assumes a Linux host running Node, Python, systemd, and optional Caddy rather than Docker.

### Current test structure

- Python tests: `tests/`, run with `pytest`.
- Portal/server TypeScript tests: `tests-portal/`, run with `npm run test:portal`.
- Playwright E2E tests: `tests-e2e/`, run with `npm run test:e2e`.
- Deployment shell tests: `tests-deploy/test-deployment-scripts.sh`, run with `npm run test:deploy`.

### Existing job or queue abstractions

A benchmark runner scaffold already exists:

- runner registration and heartbeat
- token creation/revocation
- benchmark job creation/approval/cancel
- runner job claim
- status/log/fail/complete endpoints
- file-backed `benchmark_jobs`, `runner_tokens`, and `node_runners`

This is a useful reference, but the RunPod MVP should generalize it for validation jobs rather than benchmark-only jobs.

### WebSockets

No WebSocket server or WebSocket client usage was found. MVP should remain HTTP polling.

### Database and migrations

No database and no migrations exist. MVP can safely start with the existing file-backed JSON store for deadline speed, but production hardening should later move agents/jobs/results to a transactional database with migrations.

### Frontend-to-backend connectivity

The frontend calls same-origin relative URLs such as `/api/results` and `/api/v1/engagements`. No CORS layer is currently required for the portal. RunPod agents should call the public HTTPS origin directly.

### CORS restrictions

No CORS middleware exists. Same-origin browser calls avoid CORS. Agent calls are server-to-server HTTPS and do not require browser CORS.

### Reverse-proxy and TLS assumptions

- Node listens on `0.0.0.0:$PORT`.
- Caddy may reverse proxy `gpuvalidator.com` to the Node service and handle TLS.
- `AI_FACTORY_COOKIE_SECURE=true` is expected in production behind HTTPS.
- Agent communication must use HTTPS in production.

## Step 4 RunPod installation workflow status

Prepared but not externally verified from this session:

- `docs/RUNPOD_SETUP.md` describes the exact RunPod terminal/SSH, GPU smoke-test, install, foreground run, durable `nohup`, log, stop, restart, troubleshooting, and first hardware-discovery validation workflow.
- `scripts/install-runpod-agent.sh` installs the local standalone agent in `agent/.venv`.
- `scripts/run-runpod-smoke-test.sh` checks safe host/GPU commands, optional PyTorch, DNS, HTTPS/TLS, `/healthz`, and optional agent registration/heartbeat/poll.
- `scripts/start-runpod-agent.sh` starts the agent with `nohup` and PID/log tracking.
- `scripts/stop-runpod-agent.sh` stops the tracked process without assuming systemd.

The expected demo pod remains one node with four visible GPUs. The general agent does not hardcode four GPUs; only the smoke test defaults to `GPUVALIDATOR_EXPECTED_GPU_COUNT=4` for this demo workflow.

## Smallest viable RunPod architecture

### Principles

1. Backend never SSHes into RunPod for normal operation.
2. RunPod agent polls outbound over HTTPS.
3. Backend stores jobs and accepted results.
4. Agent executes only allowlisted command definitions.
5. Raw output is bounded, sanitized, checksummed, and stored as evidence.
6. Dashboard and GPU Inventory read from accepted structured results/evidence, not from live shell sessions.

### Implemented API contract

Adapted to the existing `/api/v1` convention:

```text
POST /api/v1/agents/register
POST /api/v1/agents/heartbeat
GET  /api/v1/agents
GET  /api/v1/agents/:agentId
GET  /api/v1/agents/:agentId/jobs/next
POST /api/v1/agents/:agentId/jobs/:jobId/claim
POST /api/v1/jobs/:jobId/results
POST /api/v1/validations
GET  /api/v1/validations/:validationId
```

Mapping to existing conventions:

- `agents` is implemented as the validation-wide RunPod-facing protocol in `src/server/agents.ts`.
- `validations` creates hardware-discovery validation jobs, not benchmark-only jobs.
- `jobs/:jobId/results` accepts structured command evidence and bounded stdout/stderr excerpts.
- Authenticated reviewer/admin APIs remain cookie/session protected.
- Agent protocol APIs use `Authorization: Bearer <GPUVALIDATOR_AGENT_TOKEN>` and no browser session cookie.
- `POST /api/v1/agents/:agentId/jobs/:jobId/running` is also implemented for explicit running-state reporting.



### Step 2 implementation status

Implemented in `src/server/agents.ts`:

- Agent bearer-token authentication with `GPUVALIDATOR_AGENT_TOKEN`.
- Idempotent registration keyed by stable `name + hostname`.
- Heartbeat updates for status, capabilities, GPU count, agent version, and last error.
- Online/offline/degraded derivation at read time using `GPUVALIDATOR_AGENT_OFFLINE_SECONDS` (default 90 seconds).
- File-backed arrays in the existing engagement store: `validation_agents`, `validations`, `validation_jobs`, and `validation_results`.
- Hardware-discovery validation creation for online capable agents only.
- One queued job per allowlisted command.
- One-at-a-time job polling, claim conflict protection, running-state update, cancellation/timeout handling, wrong-agent rejection, duplicate-result idempotency, and conflicting-result rejection.
- Result upload for `completed`, `failed`, `unavailable`, and `timed_out` states with output truncation and command evidence checksums.

Not implemented in Step 2:

- RunPod agent process/binary.
- Frontend management UI for agents/validations.
- Database-backed queue or migrations.
- Automatic ingestion of uploaded structured results into the existing dashboard/GPU inventory derivation path.

### Proposed typed models

```ts
type AgentState = "online" | "offline" | "degraded";
type JobState = "queued" | "claimed" | "running" | "completed" | "failed" | "timed_out" | "cancelled";

type AgentCapability = {
  name: "nvidia_smi" | "nvidia_smi_query" | "nvidia_smi_topology" | "dcgm" | "lspci" | "cuda_version" | "driver_version" | "container_runtime";
  available: boolean;
  version: string | null;
  details?: Record<string, string | number | boolean | null>;
};

type Agent = {
  id: string;
  name: string;
  state: AgentState;
  runpod_pod_id: string | null;
  hostname_display: string | null;
  registered_at: string;
  last_seen_at: string;
  token_hash: string;
  capabilities: AgentCapability[];
  labels: string[];
};

type AgentHeartbeat = {
  agent_id: string;
  observed_at: string;
  state: AgentState;
  capabilities: AgentCapability[];
  active_job_id: string | null;
  disk_free_bytes?: number | null;
  gpu_count?: number | null;
};

type ValidationCommand = {
  id: string;
  name: string;
  argv: string[];
  timeout_seconds: number;
  max_stdout_bytes: number;
  max_stderr_bytes: number;
  required_capability: string;
  parser: "nvidia_smi_l" | "nvidia_smi_q" | "nvidia_smi_query" | "lspci" | "cuda_version" | "driver_version" | "topology" | "dcgm" | "raw_text";
};

type ValidationJob = {
  id: string;
  validation_id: string;
  state: JobState;
  created_at: string;
  claimed_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  expires_at: string;
  agent_id: string | null;
  commands: ValidationCommand[];
  retry_count: number;
  max_retries: number;
  failure_reason: string | null;
};

type CommandEvidence = {
  command_id: string;
  command_name: string;
  argv_display: string;
  started_at: string;
  finished_at: string;
  exit_code: number | null;
  timed_out: boolean;
  stdout_sha256: string | null;
  stderr_sha256: string | null;
  stdout_excerpt: string;
  stderr_excerpt: string;
  output_truncated: boolean;
  parser_warnings: string[];
};

type ValidationResult = {
  id: string;
  validation_id: string;
  job_id: string;
  agent_id: string;
  submitted_at: string;
  status: "accepted" | "accepted_with_warnings" | "rejected";
  command_evidence: CommandEvidence[];
  structured: Record<string, unknown>;
  raw_storage_ids: string[];
  duplicate_of_result_id: string | null;
};

type GpuInventoryRecord = {
  id: string;
  validation_id: string;
  agent_id: string;
  node_name: string;
  gpu_index: number | null;
  vendor: string | null;
  model: string | null;
  uuid: string | null;
  pci_bus_id: string | null;
  memory_total: string | null;
  driver_version: string | null;
  cuda_version: string | null;
  mig_mode: string | null;
  ecc_mode: string | null;
  nvlink_state: string | null;
  evidence_result_id: string;
  field_availability: Record<string, "available" | "not_collected" | "unavailable" | "failed">;
};
```

### Agent registration

- Agent starts with `GPUVALIDATOR_AGENT_TOKEN` from RunPod secrets or a mounted secret file.
- It posts capabilities and environment metadata to `POST /api/v1/agents/register`.
- Backend stores only a salted/hash digest of the token.
- Registration returns an `agent_id`, server policy version, polling interval, and allowed command definitions.

### Agent heartbeat

- Agent posts to `POST /api/v1/agents/heartbeat` every 15-30 seconds.
- Heartbeat updates `last_seen_at`, capability changes, active job, and degraded reasons.
- Backend marks agents:
  - `online`: heartbeat within online window and no degraded signal
  - `degraded`: heartbeat recent but capability/policy mismatch or local execution environment incomplete
  - `offline`: no heartbeat after offline threshold

### Job creation

- Authenticated reviewer/admin creates a validation through `POST /api/v1/validations`.
- Backend expands a validation template into one or more `ValidationJob` records with allowlisted `ValidationCommand` entries.
- Jobs start as `queued` and expire if not claimed before `expires_at`.

### Job claiming

- Agent polls `GET /api/v1/agents/:agentId/jobs/next`.
- Agent claims with `POST /api/v1/agents/:agentId/jobs/:jobId/claim`.
- Claim is atomic in the persistence layer. With JSON storage, writes must re-read, compare status, and write synchronously; with a future DB, use a transaction/conditional update.
- A job already claimed by another agent returns conflict/no job.

### Command allowlist

Allowed commands must be server-provided argv arrays, never free-form shell strings. Initial allowlist:

- `nvidia-smi -L`
- `nvidia-smi --query-gpu=index,name,uuid,pci.bus_id,memory.total,driver_version --format=csv,noheader,nounits`
- `nvidia-smi -q` only when output limits and sanitization are enforced
- `nvidia-smi topo -m`
- `lspci -D | grep -i nvidia` should be represented without shell; agent should run `lspci -D` and filter in process
- CUDA/driver version commands where installed and non-mutating
- optional DCGM level 1 diagnostics only if policy explicitly allows it

No arbitrary shell execution, no package installation, no SSH, no privilege escalation, no file exfiltration outside bounded evidence outputs.

### Step 3 standalone agent status

Implemented in `agent/gpuvalidator_agent`:

- Foreground Python command: `python -m gpuvalidator_agent`.
- Required config: `GPUVALIDATOR_API_URL`, `GPUVALIDATOR_AGENT_TOKEN`, `GPUVALIDATOR_AGENT_NAME`.
- Optional config: polling/heartbeat intervals, command timeout, TLS verification, log level, agent ID file, and explicit simulation mode.
- Capability discovery for hostname, OS, agent version, `nvidia-smi`, GPU count/models, CUDA, PyTorch, and NCCL test availability.
- Typed command allowlist matching backend hardware-discovery jobs.
- `subprocess.run(..., shell=False)` execution with timeout, stdout/stderr limits, exit code, timestamps, duration, unavailable-binary handling, and sanitized logs/output.
- Parsers for `nvidia-smi -L`, inventory CSV, topology text, driver version, CUDA version, and PyTorch GPU count.
- Outbound API client with bounded retry/backoff, authentication failure stop behavior, heartbeat, polling, claim, running-state report, and result upload.
- Graceful SIGINT/SIGTERM shutdown.
- Local simulation fixture mode for four GPUs, missing CUDA, missing PyTorch, malformed output, and timeout paths.

### Job timeout

- Each command has `timeout_seconds`.
- Each job has a wall-clock timeout.
- Agent kills timed-out child processes and reports `timed_out` evidence.
- Backend marks stale claimed/running jobs `timed_out` when heartbeats stop beyond threshold.

### Result upload

- Agent posts to `POST /api/v1/jobs/:jobId/results` with structured parsed output and bounded command evidence.
- Backend validates job ownership, state, schema version, command IDs, output size, checksums, and duplicate submissions.
- Accepted results feed evidence/intelligence and GPU inventory derivation.

### Raw evidence handling

- Raw outputs are stored only when bounded and sanitized.
- Evidence receives SHA-256 checksums, timestamps, command provenance, agent ID, and job ID.
- Storage should reuse `artifacts/evidence` initially, with raw storage IDs never exposed directly to the browser.

### Structured result handling

- Agent parses obvious local structures where safe, but backend remains authoritative for acceptance and inventory semantics.
- Backend parser maps `CommandEvidence` into node facts, findings, readiness, and `GpuInventoryRecord` data.
- Missing fields remain missing; absent telemetry is never interpreted as zero or healthy.

### Token authentication

- Agent sends `Authorization: Bearer <GPUVALIDATOR_AGENT_TOKEN>` or a registration-derived bearer credential.
- Tokens are stored as salted SHA-256 or stronger password-hash digests.
- Compare token digests with timing-safe equality.
- Logs mask tokens and Authorization headers.

### Retry behavior

- Polling retries use exponential backoff with jitter for network failures.
- Jobs may be retried only while `retry_count < max_retries` and when failure is transient.
- Non-transient failures such as unsupported command/capability mismatch should mark job failed/degraded without retry loops.

### Duplicate submission behavior

- Result upload is idempotent by `(job_id, agent_id, result_sha256)`.
- Exact duplicates return the existing accepted result.
- Conflicting second submissions after completion are rejected and audited.

### Output-size limits

Initial limits should mirror evidence safety defaults:

- per-command stdout excerpt: 64 KiB max
- per-command stderr excerpt: 16 KiB max
- per-result JSON body: 1-5 MiB max for MVP
- raw artifact upload: reuse evidence archive caps only when archive mode is explicitly added

### Logging

- Backend logs high-level audit events: register, heartbeat state change, job create/claim/start/finish/fail/timeout/result accepted.
- Agent logs local execution lifecycle without secrets.
- Raw command output goes to bounded evidence storage, not general logs.

### Failure states

- agent offline
- agent degraded
- no matching capability
- job queued timeout
- claim conflict
- command timeout
- command non-zero exit
- parser rejected evidence
- output too large
- duplicate submission
- backend unavailable
- unauthorized agent token

### Persistence approach

Deadline MVP:

- Extend the existing file-backed engagement store with `agents`, `validations`, `validation_jobs`, `validation_results`, and `gpu_inventory_records` arrays.
- Keep synchronous file writes and tests around duplicate/claim behavior.
- Add clear schema versions and migration notes in code comments.

Production hardening after deadline:

- Move agents/jobs/results to PostgreSQL or SQLite with migrations.
- Use transactional claim updates and indexes on `state`, `agent_id`, `expires_at`, and `validation_id`.

### Local development approach

- Run backend locally with `npm run dev` or production-style `npm run build && npm run start`.
- Use a fake/local RunPod agent process with `GPUVALIDATOR_AGENT_TOKEN=dev-agent-token`.
- Seed a validation through API or fixture.
- Agent polls localhost and executes only harmless mocked commands unless explicit operator opt-in is provided.

### Production deployment approach

- Keep existing single-server deployment and Caddy TLS for `gpuvalidator.com`.
- Set `AI_FACTORY_AUTH_REQUIRED=true`, `AI_FACTORY_COOKIE_SECURE=true`, and agent token secrets in production environment/secret manager.
- RunPod agent stores `GPUVALIDATOR_AGENT_TOKEN` as a RunPod secret, never in command args.
- Agent reaches `https://gpuvalidator.com/api/v1/...` outbound.
- Backend never needs inbound connectivity to the RunPod pod.

## Exact next implementation step

Implement the agent API scaffold and persistence models behind tests:

1. Add typed agent/validation/job/result models to the server domain layer.
2. Add token hashing/comparison for `GPUVALIDATOR_AGENT_TOKEN` or generated per-agent tokens.
3. Add `POST /api/v1/agents/register` and `POST /api/v1/agents/heartbeat`.
4. Add queued `POST /api/v1/validations` and polling/claim/result endpoints.
5. Add tests for auth, online/offline/degraded state, claim locking, duplicate results, output limits, and timeout transitions.

Do not begin additional visual redesign phases until this backend/agent path is working.
