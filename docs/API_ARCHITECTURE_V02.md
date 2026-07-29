# GPUValidator API Architecture V02

## Current API style

Express routes return JSON with a shared response envelope: `surface`, `mode`, `generated_at`, `states`, `counts`, and surface-specific data.

## Implemented/added API routes

- GET `/api/results` existing validation/demo data
- GET `/api/node-history/:nodeName` existing deterministic history
- GET `/api/platform/summary` Dashboard
- GET `/api/platform/inventory` Inventory
- GET `/api/platform/clusters` Cluster Management
- GET `/api/platform/clusters/:id` Cluster Detail
- GET `/api/platform/validation` Validation Center/Run/Findings
- GET `/api/platform/benchmarks` Benchmark Center/NCCL Results/Comparison/Regression collections
- GET `/api/platform/topology/:clusterId` topology graph data
- GET `/api/platform/monitoring` live monitoring heartbeat/alert collections
- GET `/api/platform/alerts` alerts
- GET `/api/platform/reports` reports
- GET `/api/platform/academy` Academy courses/lessons/labs/progress
- GET `/api/platform/settings` RBAC and integration configuration state
- POST `/api/platform/copilot` evidence-citation response contract
- POST `/api/platform/remediation-plans` creates review-required plan and audit event

## Planned API routes

Agent HTTP endpoints for registration, heartbeat, job polling/claiming, upload, cancellation, and log upload are implemented in Python service contracts but not yet exposed as Express HTTP endpoints.


Status legend: IMPLEMENTED = present in this worktree; PARTIAL = scaffolded or fixture/demo mode; PLANNED = designed but not live; BLOCKED = requires hardware, credentials, or approval.

Public/private evidence boundary: GPU Benchmark Lab remains the public benchmark source. GPUValidator stores compact fixtures, references, checksums, citations, and generated operational records. Private raw artifacts, secrets, GPU UUIDs, internal IPs, and hostnames must be redacted or kept out of product-facing responses.
