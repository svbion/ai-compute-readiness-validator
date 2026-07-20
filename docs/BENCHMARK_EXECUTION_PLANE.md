# Benchmark execution plane

GPU Validator now includes a controlled benchmark execution plane. It is not SSH orchestration and it is not a remote shell. The runner initiates all connections outbound to the control plane over HTTPS.

## Architecture

```text
GPU Validator control plane
  -> creates allowlisted benchmark job
Node runner
  -> polls/claims signed job over HTTPS
  -> executes local allowlisted adapter with argv arrays only
  -> uploads status, bounded logs, result output, checksum metadata
GPU Validator
  -> parses result through benchmark intelligence
  -> updates engagement benchmark cards/readiness provenance
```

## Security boundaries

The system does not store SSH passwords, SSH private keys, cloud credentials, root passwords, arbitrary shell commands, arbitrary flags, arbitrary environment variables, arbitrary host file paths, or arbitrary container image names. Runner registration tokens and runner credentials are random bearer secrets; only hashes are persisted. Plaintext registration tokens are shown once. Secrets are never placed in URLs.

Runner APIs use bearer authentication, timing-safe hash verification, node/engagement scoping, job claim locking, bounded/redacted logs, and generated command previews. Expired and cancelled jobs cannot be claimed. One runner cannot claim a job for another node.

## Benchmark catalog

The versioned benchmark-definition registry currently includes:

- `nccl-all-reduce`
- `nccl-all-gather`
- `nccl-reduce-scatter`
- `nccl-broadcast`
- `nvidia-hpl`
- `triton-perf-analyzer`
- `genai-perf`
- `dcgm-diag-level-1`

Definitions include schema version, display name, category, supported scope, GPU/fabric/runtime prerequisites, executable identifier, typed supported parameters, defaults, validation rules, duration class, disruptive level, approval requirement, parser type, result patterns, and documentation references.

## Parameter safety

NCCL jobs expose only typed parameters: minimum/maximum bytes, size factor, GPU count, warmups, iterations, data type, and operation. HPL and inference definitions expose only bounded/policy-approved fields. The server rejects unsupported parameters, shell metacharacters, arbitrary env maps, arbitrary file paths, arbitrary image names, and out-of-bounds values. The portal/API shows `generated_command_preview` before approval.

## Job lifecycle

Statuses are: `draft`, `awaiting_approval`, `queued`, `claimed`, `preparing`, `running`, `uploading`, `parsing`, `completed`, `completed_with_warnings`, `failed`, `cancelled`, `expired`, and `rejected`.

Low-disruption single-node NCCL smoke jobs can enter `queued` directly. HPL, DCGM diagnostics, large/disruptive jobs, and multi-node jobs require explicit approval. Multi-node execution has model/validation support and is conservatively gated; safe execution remains a next milestone.

## APIs

Administrative authenticated APIs:

- `GET /api/v1/benchmark-definitions`
- `POST /api/v1/engagements/{engagement_id}/benchmark-jobs`
- `GET /api/v1/engagements/{engagement_id}/benchmark-jobs`
- `GET /api/v1/engagements/{engagement_id}/benchmark-jobs/{job_id}`
- `POST /api/v1/engagements/{engagement_id}/benchmark-jobs/{job_id}/approve`
- `POST /api/v1/engagements/{engagement_id}/benchmark-jobs/{job_id}/cancel`
- `POST /api/v1/engagements/{engagement_id}/nodes/{node_id}/runner-tokens`
- `POST /api/v1/engagements/{engagement_id}/nodes/{node_id}/runner-tokens/{token_id}/revoke`

Runner-authenticated APIs:

- `POST /api/v1/runners/register`
- `POST /api/v1/runners/heartbeat`
- `POST /api/v1/runners/jobs/claim`
- `POST /api/v1/runners/jobs/{job_id}/status`
- `POST /api/v1/runners/jobs/{job_id}/logs`
- `POST /api/v1/runners/jobs/{job_id}/complete`
- `POST /api/v1/runners/jobs/{job_id}/fail`

## Real NCCL support

The NCCL parser supports a redacted real-format fixture with NCCL `2.25.1+cuda12.8`, four A100-SXM4-80GB GPUs, zero wrong results, zero out-of-bounds values, large-message bus bandwidth around `185.67 GB/s`, and reported average bus bandwidth `37.3098 GB/s`. The checked-in fixture is labeled `source_kind: redacted_real_format_fixture` and must not be described as a live execution artifact.

## Limitations

- Single-node job model, registration, claim, status, logging, completion, and parser attachment are implemented.
- The Python runner CLI includes safe registration/status/capability scaffolding and NCCL adapter safety primitives; full continuous execution loop remains next milestone.
- Multi-node execution is planned/gated, not fully enabled.
- HPL, Triton, GenAI-Perf, and DCGM execution adapters remain policy-gated/import-first unless explicitly configured later.
