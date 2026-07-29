# GPUValidator Validation Strategy V02

## Current gates

- `python -m compileall src tests -q`
- `python -m pytest -q`
- `python -m pip wheel . -w /tmp/gpuvalidator-platform-wheelhouse`
- `npm run lint`
- `npm run test:portal`
- `npm run build`
- `bash -n tools/run-gpu-benchmark.sh`
- `find tools -type f -name '*.sh' -exec bash -n {} \;`
- `gpu-validator --help`
- `gpu-validator benchmark --help`
- benchmark package ingest/validate/summarize/compare against public H200 package when a package path/archive is available

## Test categories covered by V02 Python service tests

Model/schema collection coverage, RBAC, organization isolation, agent registration, heartbeat, inventory ingestion, execution/result upload, validation finding/evidence persistence, benchmark history, compatibility-aware comparison, regression detection, topology graph data, Copilot citation behavior, insufficient evidence confidence, remediation approval gate, audit logging, alert lifecycle, report generation, Academy progress, archive traversal safety, and secret sanitization.

## Known blockers

No private GPU hardware should be required in CI. Live website extraction through Hermes web tools was unavailable; use local repo and direct HTTP/curl checks when needed.


Status legend: IMPLEMENTED = present in this worktree; PARTIAL = scaffolded or fixture/demo mode; PLANNED = designed but not live; BLOCKED = requires hardware, credentials, or approval.

Public/private evidence boundary: GPU Benchmark Lab remains the public benchmark source. GPUValidator stores compact fixtures, references, checksums, citations, and generated operational records. Private raw artifacts, secrets, GPU UUIDs, internal IPs, and hostnames must be redacted or kept out of product-facing responses.
