Generated: 2026-07-21T15:46:36.995936+00:00
Source basis: repository audit of server.ts, src/App.tsx, src/server/*, src/portal/*, agent/gpuvalidator_agent/*, tests-portal/*, package.json, pyproject.toml. No production deployment was performed.

# GPUValidator Gap Analysis

## Root causes found
1. Reports were the largest product gap: src/App.tsx previously labeled Reports as a landing page for existing safe report artifacts and explicitly deferred full custom generation. server.ts only served legacy /reports/:scenario/:format artifacts for healthy/degraded/latest scenarios.
2. Report lineage was missing from persistence: EngagementStore did not preserve a reports collection, so generated report metadata could not survive a write/read cycle.
3. Validation states were too compressed: src/server/agents.ts previously exposed queued/running/completed/failed/timed_out/cancelled only. This hid assignment, claim, upload, processing, and timeout reason details.
4. Timeout behavior used a single timeout basis per job and did not distinguish queue, command, and upload timeouts. It also lacked timeout_reason persistence.
5. Dashboard and GPU inventory can derive live data from /api/v1/agents and /api/v1/validations, but legacy scenario controls still expose simulated healthy/degraded fixtures for demo comparison. Those are labeled simulated, but production UX should default to live when live evidence exists.
6. Fabric and older dashboard detail sections still load scenario evidence from /api/results?scenario=degraded in some pages. This is an intentional demo fallback but remains a production-readiness gap.
7. Evidence engine supports archive ingestion and command metadata; validation result evidence is stored inline in validation_results rather than promoted to reusable evidence records/bundles.
8. Enterprise security foundations exist for sessions, admin users, token hashing, upload limits, and path traversal checks, but full org/customer/role-scoped authorization is not yet implemented.
9. Validation packs are represented as collectors/commands and operations library content, not yet formalized as versioned pack manifests for every listed platform/GPU family.
10. Benchmark ingestion and NCCL smoke exist; HPL/MLPerf live execution remains foundation/ingestion rather than full managed execution from the agent API.

## Closure in this build
- Added server-side report service, persistence, provenance, formats, API tests, and complete Reports UI section.
- Preserved report metadata across EngagementStore validation.
- Extended validation/job state and timestamp schema while keeping existing tests compatible.
- Added explicit report route coverage and UI controls for required report actions.

## Remaining production gaps
- Replace file store with durable DB/object storage.
- Promote inline validation command results into first-class evidence bundle records.
- Implement complete org/customer/engagement authorization checks for reports/evidence downloads.
- Implement full validation-pack manifest catalog with parsers/remediation/test coverage for every requested pack.
- Add real PDF/DOCX renderers if production-grade pagination/native Word editing is required.
