# RunPod GPUValidator Agent Setup

Status: Step 4 deployment workflow for the existing RunPod demo environment. The expected demo pod is one node with four visible NVIDIA GPUs.

This document contains the exact installation and first-connection workflow. It does not include a real agent token. Do not paste tokens into screenshots, shell history shared with others, or committed files.

## Scope

Complete only:

```text
RunPod deployment material, live installation workflow, and first hardware-discovery connection
```

Do not modify unrelated frontend pages. Do not disable TLS verification for production.

## Files

Repository deployment helpers:

- `scripts/install-runpod-agent.sh`
- `scripts/run-runpod-smoke-test.sh`
- `scripts/start-runpod-agent.sh`
- `scripts/stop-runpod-agent.sh`
- `agent/.env.example`

Agent package:

- `agent/gpuvalidator_agent/`

## API URL

Use the backend origin, not an `/api` suffix:

```bash
export GPUVALIDATOR_API_URL="https://gpuvalidator.com"
```

The agent client appends paths such as `/api/v1/agents/register`, `/api/v1/agents/heartbeat`, and `/api/v1/agents/{agent_id}/jobs/next`.

## Required environment

On the RunPod pod:

```bash
export GPUVALIDATOR_API_URL="https://gpuvalidator.com"
export GPUVALIDATOR_AGENT_TOKEN="<secure token>"
export GPUVALIDATOR_AGENT_NAME="runpod-4gpu-01"
export GPUVALIDATOR_POLL_INTERVAL="3"
export GPUVALIDATOR_HEARTBEAT_INTERVAL="10"
```

Optional but recommended:

```bash
export GPUVALIDATOR_COMMAND_TIMEOUT="20"
export GPUVALIDATOR_TLS_VERIFY="true"
export GPUVALIDATOR_LOG_LEVEL="INFO"
export GPUVALIDATOR_AGENT_ID_FILE="./agent/.runpod-agent-id"
```

For a local env file on the pod only:

```bash
cp agent/.env.example agent/.env
chmod 600 agent/.env
vi agent/.env
```

Never commit `agent/.env`.

## 1. Open the RunPod terminal or SSH connection

Use one of the existing RunPod access methods:

- RunPod web UI: open the pod, click the web terminal/Connect shell.
- SSH: use the SSH command shown by RunPod for the pod.

Do not bypass RunPod access controls. Use only the authorized terminal/SSH method for the existing pod.

## 2. Confirm the pod is running

Inside the pod:

```bash
hostname
uname -a
python3 --version
pwd
```

Expected: commands return normally and Python 3.10+ is available. If `python3` is missing, choose a RunPod image with Python or install it only if your RunPod environment permits package installation.

## 3. Confirm the repository or agent package is available

If the full repository is already present:

```bash
cd /workspace/ai-compute-readiness-validator  # adapt if the repo is elsewhere
git status --short
git log --oneline -3
```

If the repository is not present, copy or clone the repository using the approved method for the pod:

```bash
cd /workspace
git clone https://github.com/svbion/ai-compute-readiness-validator.git
cd ai-compute-readiness-validator
git checkout hermes-mvp
git pull --ff-only
```

If GitHub access is not available, copy only the `agent/` directory and `scripts/` helpers into the pod.

## 4. Validate all four GPUs

Run the safe smoke test after the repository is available:

```bash
scripts/run-runpod-smoke-test.sh
```

The script runs:

```bash
hostname
uname -a
python3 --version
nvidia-smi
nvidia-smi -L
nvidia-smi topo -m
```

It also runs PyTorch GPU count only if PyTorch is installed:

```bash
python3 -c "import torch; print(torch.cuda.device_count())"
```

Expected demo environment:

```text
one node
four visible GPUs
```

The smoke test defaults to `GPUVALIDATOR_EXPECTED_GPU_COUNT=4` and fails clearly if a different GPU count is visible. This check is for the demo pod only; the general agent does not hardcode four GPUs.

If the pod intentionally exposes a different number of GPUs, override the smoke-test expectation:

```bash
GPUVALIDATOR_EXPECTED_GPU_COUNT=1 scripts/run-runpod-smoke-test.sh
```

## 5. Install the agent

From the repository root on the RunPod pod:

```bash
scripts/install-runpod-agent.sh
```

This creates:

```text
agent/.venv
```

and installs the local package with:

```bash
pip install -e agent
```

Equivalent manual command:

```bash
cd agent
python3 -m venv .venv
. .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e .
```

## 6. Configure environment variables

Use exported variables for foreground testing:

```bash
export GPUVALIDATOR_API_URL="https://gpuvalidator.com"
export GPUVALIDATOR_AGENT_TOKEN="<secure token>"
export GPUVALIDATOR_AGENT_NAME="runpod-4gpu-01"
export GPUVALIDATOR_POLL_INTERVAL="3"
export GPUVALIDATOR_HEARTBEAT_INTERVAL="10"
export GPUVALIDATOR_COMMAND_TIMEOUT="20"
export GPUVALIDATOR_TLS_VERIFY="true"
export GPUVALIDATOR_LOG_LEVEL="INFO"
export GPUVALIDATOR_AGENT_ID_FILE="./agent/.runpod-agent-id"
```

Or create `agent/.env` from `agent/.env.example` for the helper scripts. Keep permissions private:

```bash
chmod 600 agent/.env
```

## 7. Verify connectivity from RunPod

After environment variables are set:

```bash
scripts/run-runpod-smoke-test.sh
```

Connectivity checks include:

- DNS resolution for `gpuvalidator.com`
- HTTPS connection
- TLS certificate inspection
- `/healthz` API reachability
- agent registration response, if token/name are configured and the agent is installed
- heartbeat response
- polling response

Do not set `GPUVALIDATOR_TLS_VERIFY=false` except for explicitly local testing against a non-production development server.

## 8. Run in the foreground first

Use foreground mode before durable background execution:

```bash
cd agent
. .venv/bin/activate
python -m gpuvalidator_agent
```

Expected successful startup signs:

- the process logs startup without printing the token
- registration succeeds
- heartbeat succeeds
- polling continues when no jobs exist

Stop foreground mode with `Ctrl+C` after registration/heartbeat are confirmed.

## 9. Confirm backend registration

From an authenticated GPUValidator reviewer/admin session, check the agent list through the backend API or UI surface that uses:

```text
GET /api/v1/agents
```

Expected:

- agent name: `runpod-4gpu-01`
- status: `online`
- GPU count: `4` for the demo pod
- recent `last_heartbeat_at`
- capabilities for detected commands

If you have an authenticated local shell against the backend, the endpoint is:

```bash
curl -fsS https://gpuvalidator.com/api/v1/agents
```

This requires reviewer/session authentication and may return `401` from a plain unauthenticated shell.

## 10. Start durable background mode

Run from the repository root:

```bash
scripts/start-runpod-agent.sh
```

Default behavior:

```bash
nohup agent/.venv/bin/python -m gpuvalidator_agent > agent/gpuvalidator-agent.log 2>&1 &
```

PID file:

```text
agent/gpuvalidator-agent.pid
```

Log file:

```text
agent/gpuvalidator-agent.log
```

No systemd assumption is made.

## 11. View logs

```bash
tail -f agent/gpuvalidator-agent.log
```

The token should appear only as masked state, never as a raw value.

## 12. Stop the agent

```bash
scripts/stop-runpod-agent.sh
```

The script sends SIGTERM, waits, and removes stale PID files. It sends SIGKILL only after the stop timeout.

## 13. Restart the agent

```bash
scripts/stop-runpod-agent.sh
scripts/start-runpod-agent.sh
tail -f agent/gpuvalidator-agent.log
```

Registration is idempotent for stable `GPUVALIDATOR_AGENT_NAME + hostname`, so a restart should not create a duplicate agent record.

## 14. First live hardware discovery

Prerequisites:

- backend is deployed with Step 2 agent API
- backend has `GPUVALIDATOR_AGENT_TOKEN` configured to match the RunPod agent token
- RunPod agent is online and heartbeating
- reviewer/admin can create validations

Workflow:

1. Start the agent in durable mode.
2. Confirm `GET /api/v1/agents` shows the RunPod agent online.
3. Create a hardware-discovery validation for the agent:

```http
POST /api/v1/validations
Content-Type: application/json

{
  "profile": "hardware-discovery",
  "agent_id": "<agent id>"
}
```

4. Confirm the agent log shows polling, claim, running-state update, command execution, and result upload.
5. Read the validation:

```http
GET /api/v1/validations/<validation_id>
```

6. Confirm the backend reaches a terminal state:

- `completed` when all allowlisted jobs complete
- `failed` when one or more non-optional jobs fail/unavailable
- `timed_out` when a job exceeds timeout

7. Confirm uploaded evidence includes:

- discovered GPU count
- actual GPU model names
- UUIDs
- memory values
- driver version
- PCI bus IDs
- topology matrix/evidence
- CUDA availability/version or unavailable state
- PyTorch availability/GPU count or unavailable state

## Portal dashboard and inventory after upload

After the RunPod agent registers and uploads hardware-discovery results, the authenticated portal consumes the same-origin reviewer APIs:

```text
GET  /api/v1/agents
GET  /api/v1/validations?profile=hardware-discovery
POST /api/v1/validations
```

Open:

```text
/portal
/portal/inventory/gpus
```

Expected live UI behavior:

- `/portal` shows connected agents, online agents, discovered nodes, discovered GPUs, latest hardware-discovery validation, validation state, and latest validation timestamp.
- The "Run hardware validation" button requires an authenticated reviewer session and an explicit selected agent. It creates a `hardware-discovery` validation only; users cannot submit arbitrary commands.
- A queued state appears immediately after submission, then polling refreshes queued/running/completed/failed/partial states.
- `/portal/inventory/gpus` labels rows as `Live Agent`, `Imported Evidence`, or `Demo Fixture`; do not mix fixture screenshots with live proof.
- CUDA/PyTorch are shown only when command evidence reports them. Missing command results appear as unavailable warnings rather than fabricated values.

The dashboard polling interval is 5 seconds for the deadline demo. It uses same-origin authenticated APIs and cancels in-flight requests when the dashboard unmounts.

## Troubleshooting

### Bad token

Symptoms:

- agent exits with authentication error
- registration/heartbeat returns `401`

Fix:

- confirm backend `GPUVALIDATOR_AGENT_TOKEN`
- confirm RunPod `GPUVALIDATOR_AGENT_TOKEN`
- rotate both values together if needed
- do not print the token in logs

### API unreachable

Symptoms:

- DNS, HTTPS, or `/healthz` check fails
- transient API retries appear in logs

Fix:

```bash
python3 - <<'PY'
import socket
print(socket.gethostbyname('gpuvalidator.com'))
PY
curl -fsS https://gpuvalidator.com/healthz
```

Check RunPod outbound networking and backend availability.

### `nvidia-smi` unavailable

Symptoms:

- smoke test fails before registration
- agent advertises NVIDIA commands unavailable

Fix:

- confirm the RunPod pod is GPU-backed
- confirm NVIDIA runtime is enabled in the image
- choose a CUDA/NVIDIA RunPod template

### PyTorch unavailable

Symptoms:

- smoke test warns PyTorch is missing
- `pytorch_gpu_count` result is `unavailable`

This is not an agent crash. Install PyTorch only if the environment permits it and the demo requires PyTorch evidence.

### CUDA toolkit unavailable

Symptoms:

- `nvcc --version` unavailable
- CUDA version may still be parsed from `/usr/local/cuda/version.json` or `nvidia-smi`

This is not automatically fatal unless the validation policy requires CUDA toolkit evidence.

### Only some GPUs visible

Symptoms:

- `nvidia-smi -L` shows fewer than four GPUs
- smoke test fails with expected count mismatch

Fix:

- confirm RunPod pod GPU allocation
- confirm container visibility settings
- for non-demo pods, override `GPUVALIDATOR_EXPECTED_GPU_COUNT`

### Job timeout

Symptoms:

- agent uploads `timed_out`
- backend validation state becomes `timed_out`

Fix:

- check command duration
- tune `GPUVALIDATOR_COMMAND_TIMEOUT` only if justified
- inspect raw stdout/stderr excerpts

### Agent restart

Expected behavior:

- restart uses stable name/hostname registration
- backend returns same agent identity for duplicate registration
- stale heartbeat becomes online again after new heartbeat

### Duplicate registration

If duplicate records appear, confirm `GPUVALIDATOR_AGENT_NAME` and hostname are stable. Use `GPUVALIDATOR_AGENT_ID_FILE` for local traceability, but backend idempotency is keyed by name plus hostname.

### Stale heartbeat

The backend derives offline state when `last_heartbeat_at` is older than `GPUVALIDATOR_AGENT_OFFLINE_SECONDS` on the server, default 90 seconds.
