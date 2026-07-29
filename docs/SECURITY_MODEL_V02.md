# GPUValidator Security Model V02

## Implemented controls

- Organization-scoped entities in the Python platform model.
- Role/permission checks for cluster read/write behavior.
- Agent credential model stores SHA-256 token hashes; fixture registration returns a one-time bearer token.
- Remediation execution is blocked unless the plan is explicitly approved.
- Audit events are recorded for seed, organization/user/cluster create, agent lifecycle, validation, benchmark, Copilot, alerts, reports, remediation, approval, and Academy progress.
- `sanitize_secret_text` redacts tokens, passwords, GPU UUID-like values, internal IPs, and `.local` hostnames.
- `safe_archive_member` rejects absolute paths, parent traversal, and NUL-containing names.

## Enterprise boundaries

High-risk actions require explicit approval: driver changes, firmware changes, node reboot, service restart, scheduler changes, Kubernetes changes, link resets, node drain/resume, and workload termination. For this milestone execution remains recommendation-only/simulated.

## Planned controls

HTTP middleware auth, rate limiting, content-type validation, upload size caps, database-backed token lifecycle, retention policies, and integration-specific least-privilege credentials are planned.


Status legend: IMPLEMENTED = present in this worktree; PARTIAL = scaffolded or fixture/demo mode; PLANNED = designed but not live; BLOCKED = requires hardware, credentials, or approval.

Public/private evidence boundary: GPU Benchmark Lab remains the public benchmark source. GPUValidator stores compact fixtures, references, checksums, citations, and generated operational records. Private raw artifacts, secrets, GPU UUIDs, internal IPs, and hostnames must be redacted or kept out of product-facing responses.
