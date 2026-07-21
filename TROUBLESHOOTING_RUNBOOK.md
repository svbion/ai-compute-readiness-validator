Generated: 2026-07-21T15:46:36.995936+00:00
Source basis: repository audit of server.ts, src/App.tsx, src/server/*, src/portal/*, agent/gpuvalidator_agent/*, tests-portal/*, package.json, pyproject.toml. No production deployment was performed.

# Troubleshooting Runbook

## Agent offline
Check GPUVALIDATOR_API_URL, GPUVALIDATOR_AGENT_TOKEN, network reachability, backend logs, and /api/v1/agents.

## Hardware validation timed out
Inspect validation job diagnostics: queue timeout, command timeout, upload timeout, last_progress_at, stderr, exit code, command argv, and agent logs. Do not mark timeout if a live agent is reporting progress.

## GPU inventory empty
Confirm validation completed and nvidia_smi_list/nvidia_smi_inventory results contain parsed gpus arrays.

## NCCL unavailable
Confirm all_reduce_perf exists and at least two visible GPUs are available. If absent, report dependency issue, not benchmark failure.

## Report missing data
Open Report Provenance and source validation IDs. Missing fields must be rendered as Not collected/Not available rather than fabricated values.
