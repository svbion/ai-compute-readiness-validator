# GPUValidator Agent API

Status: implemented backend protocol plus standalone outbound-polling Python RunPod agent. The agent lives under `agent/` and can be run with `python -m gpuvalidator_agent` after installation or with `PYTHONPATH=agent`.

## Authentication

Agent protocol endpoints use bearer-token authentication independent of reviewer/browser sessions.

Expected header:

```http
Authorization: Bearer <GPUVALIDATOR_AGENT_TOKEN>
```

Server configuration:

```dotenv
GPUVALIDATOR_AGENT_TOKEN=replace-with-agent-secret
```

Rules:

- Missing token returns `401`.
- Invalid token returns `401`.
- Reviewer session headers do not authenticate agent protocol endpoints.
- The token is never returned in API responses.
- The token is stored in persistence only as a one-way hash on agent records.
- Token comparisons use digest comparison with timing-safe equality.
- Logs and stored command output redact Authorization headers and `GPUVALIDATOR_AGENT_TOKEN=` values.

## Timing defaults

Registration responses include:

```json
{
  "heartbeat_interval_seconds": 30,
  "poll_interval_seconds": 5
}
```

Offline detection is derived at read time from `last_heartbeat_at`.

Default offline threshold:

```text
GPUVALIDATOR_AGENT_OFFLINE_SECONDS=90
```

Tests may override this threshold.

## Models

### Agent

```ts
type AgentStatus = "online" | "offline" | "degraded";

type AgentCapability = {
  name: string;
  available: boolean;
  version: string | null;
  details?: Record<string, string | number | boolean | null>;
};

type Agent = {
  id: string;
  name: string;
  hostname: string;
  status: AgentStatus;
  capabilities: AgentCapability[];
  gpu_count: number | null;
  agent_version: string | null;
  registered_at: string;
  last_heartbeat_at: string;
  last_error: string | null;
  metadata: Record<string, unknown>;
};
```

Private fields not returned:

- `stable_key`
- `token_hash`

### ValidationJob

```ts
type ValidationJobState = "queued" | "claimed" | "running" | "completed" | "failed" | "timed_out" | "cancelled";

type ValidationJob = {
  id: string;
  validation_id: string;
  agent_id: string;
  profile: "hardware-discovery";
  state: ValidationJobState;
  command_type: string;
  command: ValidationCommand;
  timeout_seconds: number;
  created_at: string;
  claimed_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
};
```

### ValidationCommand

Commands are server-defined argv arrays. The frontend cannot submit arbitrary shell commands.

Initial hardware-discovery commands:

- `nvidia_smi_list`
- `nvidia_smi_inventory`
- `nvidia_smi_topology`
- `cuda_version`
- `driver_version`
- `pytorch_gpu_count`

### ValidationResult

```ts
type ValidationResultState = "completed" | "failed" | "unavailable" | "timed_out";

type ValidationResult = {
  id: string;
  job_id: string;
  validation_id: string;
  agent_id: string;
  state: ValidationResultState;
  exit_code: number | null;
  started_at: string | null;
  completed_at: string;
  duration_ms: number | null;
  structured_result: Record<string, unknown>;
  stdout: string;
  stderr: string;
  output_truncated: boolean;
  command_evidence: CommandEvidence;
};
```

## Endpoints

### Register agent

```http
POST /api/v1/agents/register
Authorization: Bearer <GPUVALIDATOR_AGENT_TOKEN>
Content-Type: application/json
```

Request:

```json
{
  "name": "runpod-a100-smoke",
  "hostname": "rp-pod-001",
  "agent_version": "0.1.0",
  "gpu_count": 1,
  "capabilities": [
    { "name": "nvidia_smi_list", "available": true, "version": "535.104" },
    { "name": "nvidia_smi_inventory", "available": true, "version": "535.104" },
    { "name": "nvidia_smi_topology", "available": true, "version": "535.104" },
    { "name": "cuda_version", "available": true, "version": "12.2" },
    { "name": "driver_version", "available": true, "version": "535.104" },
    { "name": "pytorch_gpu_count", "available": true, "version": "2.4" }
  ],
  "metadata": { "runpod_pod_id": "pod-example" }
}
```

Response:

```json
{
  "agent_id": "agt_example",
  "agent": {
    "id": "agt_example",
    "name": "runpod-a100-smoke",
    "hostname": "rp-pod-001",
    "status": "online",
    "gpu_count": 1,
    "agent_version": "0.1.0",
    "registered_at": "2026-07-20T00:00:00.000Z",
    "last_heartbeat_at": "2026-07-20T00:00:00.000Z",
    "last_error": null,
    "capabilities": []
  },
  "heartbeat_interval_seconds": 30,
  "poll_interval_seconds": 5,
  "server_time": "2026-07-20T00:00:00.000Z"
}
```

Registration is idempotent for stable `name + hostname`. Re-registering the same agent updates metadata/capabilities and returns the same `agent_id`.

### Heartbeat

```http
POST /api/v1/agents/heartbeat
Authorization: Bearer <GPUVALIDATOR_AGENT_TOKEN>
```

Request:

```json
{
  "agent_id": "agt_example",
  "status": "online",
  "gpu_count": 1,
  "agent_version": "0.1.1",
  "last_error": null,
  "capabilities": [
    { "name": "nvidia_smi_list", "available": true, "version": "535.104" }
  ]
}
```

### List agents

Reviewer/session-authenticated endpoint:

```http
GET /api/v1/agents
```

Response includes derived online/offline/degraded status and `offline_threshold_seconds`.

### Read agent

```http
GET /api/v1/agents/:agentId
```

Reviewer/session-authenticated endpoint.

### Create validation

```http
POST /api/v1/validations
Content-Type: application/json
```

Reviewer/session-authenticated endpoint.

Request:

```json
{
  "profile": "hardware-discovery",
  "agent_id": "agt_example"
}
```

Behavior:

- The selected agent must exist.
- The selected agent must be online.
- The selected agent must advertise all required command capabilities as available.
- The server enqueues one job per allowlisted command.
- Unsupported validation profiles are rejected.

### Read validation

```http
GET /api/v1/validations/:validationId
```

Reviewer/session-authenticated endpoint. Returns validation, jobs, and uploaded results.

### Poll next job

```http
GET /api/v1/agents/:agentId/jobs/next
Authorization: Bearer <GPUVALIDATOR_AGENT_TOKEN>
```

Returns one queued job for that agent or `null`.

### Claim job

```http
POST /api/v1/agents/:agentId/jobs/:jobId/claim
Authorization: Bearer <GPUVALIDATOR_AGENT_TOKEN>
```

Claiming is atomic within the file-backed repository write. A duplicate claim returns `409` and does not duplicate work.

### Mark running

```http
POST /api/v1/agents/:agentId/jobs/:jobId/running
Authorization: Bearer <GPUVALIDATOR_AGENT_TOKEN>
```

Allowed from `claimed` or already `running`.

### Upload result

```http
POST /api/v1/jobs/:jobId/results
Authorization: Bearer <GPUVALIDATOR_AGENT_TOKEN>
Content-Type: application/json
```

Request:

```json
{
  "agent_id": "agt_example",
  "state": "completed",
  "exit_code": 0,
  "started_at": "2026-07-20T00:00:00.000Z",
  "completed_at": "2026-07-20T00:00:03.000Z",
  "stdout": "GPU 0: NVIDIA A100-SXM4-40GB (UUID: GPU-...)",
  "stderr": "",
  "structured_result": {
    "gpus": [
      { "index": 0, "model": "NVIDIA A100-SXM4-40GB" }
    ]
  },
  "output_truncated": false
}
```

Supported result states:

- `completed`
- `failed`
- `unavailable`
- `timed_out`

Result upload rules:

- Rejects missing/invalid token.
- Rejects wrong `agent_id` for the job.
- Accepts results only for `claimed` or `running` jobs.
- Exact duplicate submission returns the existing result with `duplicate: true`.
- Conflicting second submission returns `409`.
- stdout is truncated to the command max, currently up to 64 KiB.
- stderr is truncated to the command max, currently up to 16 KiB.
- Output is sanitized for bearer-token-looking values before storage.

## Persistence limitation

The deadline MVP uses the existing file-backed engagement store. It preserves these arrays:

- `validation_agents`
- `validations`
- `validation_jobs`
- `validation_results`

This is repository-consistent and testable, but not a long-term concurrent queue. Production hardening should move these records to a transactional database with migrations and indexed claim updates.


## Standalone Python agent

The Step 3 agent implementation lives in `agent/gpuvalidator_agent`.

Run foreground after configuring environment variables:

```bash
cd agent
python3 -m venv .venv
. .venv/bin/activate
pip install -e .
GPUVALIDATOR_API_URL=https://gpuvalidator.com \
GPUVALIDATOR_AGENT_TOKEN=replace-with-secret \
GPUVALIDATOR_AGENT_NAME=runpod-a100-1 \
python -m gpuvalidator_agent
```

Local simulation mode is available only when explicitly enabled:

```bash
GPUVALIDATOR_SIMULATE=true python -m gpuvalidator_agent
```

Simulation reports four GPUs, missing CUDA toolkit, missing PyTorch, malformed inventory rows, and timeout-capable fixtures for tests. Do not enable it in production.


## RunPod installation workflow

See `docs/RUNPOD_SETUP.md` for the Step 4 live pod workflow. Important points:

- `GPUVALIDATOR_API_URL` is the origin, for example `https://gpuvalidator.com`, not an `/api` suffixed URL.
- RunPod uses the same `Authorization: Bearer <GPUVALIDATOR_AGENT_TOKEN>` header documented above.
- `scripts/run-runpod-smoke-test.sh` can verify registration, heartbeat, and polling from the pod when the environment variables are configured.
- `scripts/start-runpod-agent.sh` uses `nohup` with PID and log files because RunPod images should not be assumed to have systemd.
