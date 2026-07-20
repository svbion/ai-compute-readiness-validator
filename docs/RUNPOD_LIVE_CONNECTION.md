# Runpod live connection

GPU Validator uses an outbound node-runner model. The application does not SSH to Runpod, does not store SSH credentials, and does not expose a remote shell.

## Architecture

```text
Runpod node runner
  -> outbound HTTPS registration
  -> outbound HTTPS heartbeat
  -> outbound HTTPS job polling/claim
  -> local allowlisted execution
  -> outbound HTTPS status/log/result upload
```

## Runner registration

1. In the portal, open an engagement node and create a runner registration token.
2. Copy the token once to the Runpod node:

```bash
install -m 600 /dev/null /workspace/gpu-validator-runner-token.txt
# paste the one-time token into the file using the approved secure channel
```

3. Register:

```bash
export AI_VALIDATOR_NCCL_TESTS_DIR=/workspace/nccl-tests
ai-validator runner register \
  --url https://gpuvalidator.com \
  --node-id <node-id> \
  --token-file /workspace/gpu-validator-runner-token.txt \
  --credential-file /workspace/gpu-validator-runner-credential.json
chmod 600 /workspace/gpu-validator-runner-credential.json
```

4. Start one-shot or polling mode:

```bash
ai-validator runner once \
  --url https://gpuvalidator.com \
  --credential-file /workspace/gpu-validator-runner-credential.json

ai-validator runner run \
  --url https://gpuvalidator.com \
  --credential-file /workspace/gpu-validator-runner-credential.json \
  --poll-interval 10
```

## Capability payload

The runner reports runner version, hostname display, operating system, architecture, GPU count/model, NVIDIA driver, CUDA runtime, NCCL Tests availability, HPL availability, DCGM availability, container runtime, MPI availability, last capability refresh, active job ID, and busy state. The UI and APIs must not expose GPU UUIDs or private identifiers.

## Heartbeat thresholds

Defaults:

- online: heartbeat within 30 seconds (`AI_VALIDATOR_RUNNER_ONLINE_SECONDS=30`)
- stale: heartbeat older than 30 seconds
- offline: heartbeat older than 120 seconds (`AI_VALIDATOR_RUNNER_OFFLINE_SECONDS=120`)

Live node API:

```http
GET /api/v1/engagements/{engagement_id}/nodes/{node_id}/live
```

Metrics are nullable. Missing utilization, memory, power, temperature, ECC, or NVLink values must not be displayed as fake zeros.

## NCCL smoke job

Supported live RC1 benchmark: NCCL AllReduce single-node through allowlisted generated argv. Use profiles:

- smoke: min 8, max 128M, factor 2, detected GPUs, warmups 3, iterations 10
- standard: min 8, max 1G, factor 2, detected GPUs, warmups 5, iterations 20
- extended: requires explicit approval and policy limit review

No arbitrary command input is accepted. HPL remains disabled for live RC1 unless an approved adapter/container policy is completed and tested.
