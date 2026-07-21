# GPUValidator Deadline MVP Demo Runbook

Status: final deadline-demo operator runbook. Do not commit real credentials, tokens, screenshots with secrets, or raw customer-sensitive identifiers.

## Pre-demo startup checklist

1. Confirm production server is on the latest deadline commit:

```bash
cd /opt/ai-factory-validator
git fetch origin
git checkout hermes-mvp
git pull --ff-only origin hermes-mvp
git log -1 --oneline
```

2. Confirm backend environment is present without printing secret values:

```bash
cd /opt/ai-factory-validator
sudo -E ./deploy/status.sh
sudo systemctl status ai-factory-validator --no-pager
```

Required production settings:

```text
AI_FACTORY_AUTH_REQUIRED=true
AI_FACTORY_COOKIE_SECURE=true
AI_VALIDATOR_USER_STORE=/opt/ai-factory-validator/shared/users/store.json
AI_VALIDATOR_ENGAGEMENT_STORE=/opt/ai-factory-validator/shared/engagements/store.json
AI_VALIDATOR_EVIDENCE_STORAGE_DIR=/opt/ai-factory-validator/shared/evidence
AI_VALIDATOR_BENCHMARK_STORAGE_DIR=/opt/ai-factory-validator/shared/benchmarks
GPUVALIDATOR_AGENT_TOKEN=<set in backend env and RunPod env; never print>
```

3. Confirm public routing and TLS:

```bash
curl -fsSI https://gpuvalidator.com/healthz
curl -fsSI https://gpuvalidator.com/login
curl -sSI https://gpuvalidator.com/ | sed -n '1,12p'
curl -sSI https://gpuvalidator.com/portal | sed -n '1,12p'
```

Expected:

```text
/healthz -> 200
/login -> 200
/ -> 302 Location: /login
/portal without a session -> 302 Location: /login...
```

4. Confirm authenticated deployment verification from the server only:

```bash
cd /opt/ai-factory-validator
sudo -E ./deploy/healthcheck.sh
sudo -E ./deploy/verify.sh
```

5. Confirm RunPod pod is idle and safe for hardware discovery:

```bash
nvidia-smi
nvidia-smi -L
nvidia-smi topo -m
```

Expected demo pod: one RunPod node, four visible GPUs, no unrelated workload that would make discovery misleading.

6. Install/refresh the RunPod agent package on the pod:

```bash
cd /workspace/ai-compute-readiness-validator
git fetch origin
git checkout hermes-mvp
git pull --ff-only origin hermes-mvp
scripts/install-runpod-agent.sh
```

7. Configure RunPod agent environment on the pod. Use an env file or exported variables; do not paste the token into screenshots:

```bash
export GPUVALIDATOR_API_URL="https://gpuvalidator.com"
export GPUVALIDATOR_AGENT_TOKEN="<secure token>"
export GPUVALIDATOR_AGENT_NAME="runpod-4gpu-01"
export GPUVALIDATOR_POLL_INTERVAL="3"
export GPUVALIDATOR_HEARTBEAT_INTERVAL="10"
export GPUVALIDATOR_TLS_VERIFY="true"
export GPUVALIDATOR_LOG_LEVEL="INFO"
export GPUVALIDATOR_AGENT_ID_FILE="./agent/.runpod-agent-id"
```

8. Run the safe RunPod smoke test:

```bash
scripts/run-runpod-smoke-test.sh
```

Expected: four visible GPUs, TLS/healthz reachable, agent registration/heartbeat/poll succeeds when env is configured.

9. Start the durable RunPod agent:

```bash
scripts/start-runpod-agent.sh
```

10. Confirm logs do not contain the raw token:

```bash
tail -n 80 agent/gpuvalidator-agent.log
```

## Demo sequence

1. Open `https://gpuvalidator.com`.
2. Confirm it redirects to `/login`.
3. Log in with the issued reviewer/admin account.
4. Open Dashboard (`/portal`).
5. Show RunPod agent online in the Live Agent panel.
6. Launch hardware discovery.
7. Watch queued/running state.
8. Open completed validation.
9. Show four discovered GPUs.
10. Open one GPU detail drawer.
11. Show UUID, model, memory, driver, and PCI identity.
12. Show topology evidence and raw command output.
13. Show unavailable CUDA/PyTorch states truthfully if applicable. Unavailable optional tools are not hardware-discovery failure by themselves.
14. Optional: run NCCL smoke test only if `all_reduce_perf` is present, four GPUs are confirmed, hardware discovery succeeded, the GPU workload is safe, and the pod is idle.

## Recovery commands

### Backend restart

```bash
sudo systemctl restart ai-factory-validator
sudo systemctl status ai-factory-validator --no-pager
sudo journalctl -u ai-factory-validator -n 100 --no-pager
curl -fsS https://gpuvalidator.com/healthz
```

### Backend deploy/update

```bash
cd /opt/ai-factory-validator
sudo -E env AI_FACTORY_DRY_RUN=true AI_FACTORY_APP_DIR=/opt/ai-factory-validator AI_FACTORY_BRANCH=hermes-mvp AI_FACTORY_DOMAIN=gpuvalidator.com AI_FACTORY_ENABLE_CADDY=true AI_FACTORY_AUTH_REQUIRED=true ./deploy/update.sh
sudo -E env AI_FACTORY_APP_DIR=/opt/ai-factory-validator AI_FACTORY_BRANCH=hermes-mvp AI_FACTORY_DOMAIN=gpuvalidator.com AI_FACTORY_ENABLE_CADDY=true AI_FACTORY_AUTH_REQUIRED=true ./deploy/update.sh
sudo -E ./deploy/status.sh
sudo -E ./deploy/verify.sh
```

### Agent restart

From the RunPod repo root:

```bash
scripts/stop-runpod-agent.sh
scripts/start-runpod-agent.sh
tail -f agent/gpuvalidator-agent.log
```

Foreground fallback:

```bash
cd agent
. .venv/bin/activate
python -m gpuvalidator_agent
```

### Agent offline/online check

1. Stop the agent:

```bash
scripts/stop-runpod-agent.sh
```

2. Wait longer than `GPUVALIDATOR_AGENT_OFFLINE_SECONDS` / backend offline threshold, then refresh Dashboard. Expected: agent offline.
3. Start the agent again:

```bash
scripts/start-runpod-agent.sh
```

4. Refresh Dashboard. Expected: same stable agent returns online; no duplicate registration for the same name/hostname.

### Invalid token test

Use a temporary shell only; do not edit committed files:

```bash
GPUVALIDATOR_AGENT_TOKEN=bad-token python -m gpuvalidator_agent
```

Expected: registration/authentication fails with 401 and the agent stops rather than exposing unauthenticated APIs.

### Command timeout / optional tool failures

Hardware-discovery result states should be truthful:

```text
completed
failed
timed_out
unavailable
```

Missing CUDA toolkit or PyTorch should appear as `unavailable`/truthful partial, not as fabricated versions. Malformed output should produce parser warnings and raw evidence.

## Log locations

Backend:

```bash
sudo journalctl -u ai-factory-validator -f
sudo journalctl -u caddy -f
/opt/ai-factory-validator/shared/
/opt/ai-factory-validator/artifacts/
```

RunPod agent:

```bash
agent/gpuvalidator-agent.log
agent/gpuvalidator-agent.pid
agent/.runpod-agent-id
```

## Known limitations

- Live demo requires the RunPod pod to be running, idle, reachable, and configured with the same backend `GPUVALIDATOR_AGENT_TOKEN`.
- Hardware discovery is read-only and does not prove benchmark performance.
- CUDA toolkit and PyTorch may be unavailable in the container even when the NVIDIA driver and GPUs are visible; report this truthfully.
- NCCL smoke is optional and must not block the deadline MVP if `all_reduce_perf` is absent.
- Do not claim InfiniBand or NVLink performance from the NCCL smoke result unless topology and output specifically support that claim.
- Production uses file-backed persistent stores under `/opt/ai-factory-validator/shared`; protect and back them up before destructive server work.

## Fallback if live RunPod becomes unavailable

1. State clearly that live RunPod validation is unavailable.
2. Do not use fake GPU records as live evidence.
3. Show the architecture and safety model using the RunPod setup docs and prior sanitized screenshots if already captured.
4. Use CI fixture data only with the visible simulated/demo labels intact.
5. Defer the live GPU proof until the RunPod pod returns and hardware discovery can complete end to end.
