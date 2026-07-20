# Validation engagements

Validation engagements are the multi-node customer validation project model for GPU Validator. An engagement represents one customer infrastructure acceptance effort and will later receive evidence bundles from one or more GPU nodes.

Example simulated fixture:

- Customer: NVIS Interview Demo
- Engagement: Two-Node H100 Cluster Acceptance
- Platform profile: hgx-h100
- Expected nodes: 2
- Received nodes: 0
- Status: collecting
- Simulated: true

The fixture is labeled `SIMULATED DEMO` in the portal and must not be represented as real hardware evidence.

## Domain model

Engagement schema version: `1.0.0`.

Engagement fields:

- `id`: server-generated stable ID.
- `schema_version`: version of the persisted engagement document shape.
- `name`: engagement name.
- `customer_name`: customer or account name.
- `description`: operator-supplied scope text.
- `platform_profile`: expected platform profile.
- `expected_node_count`: planned number of nodes, 1-1024.
- `received_node_count`: derived from associated node collection status.
- `ready_node_count`: derived from associated node validation status.
- `remediation_node_count`: derived from associated node validation status.
- `failed_node_count`: derived from associated node validation or rejected collection status.
- `status`: engagement workflow state.
- `acceptance_status`: acceptance decision state.
- `readiness_score`: derived average from node scores when evidence exists; otherwise `null`.
- `created_at`, `updated_at`: timezone-aware UTC timestamps.
- `collection_deadline`: optional UTC timestamp.
- `created_by`: authenticated reviewer/admin identity or local fallback.
- `simulated`: true for demo-only fixture data.
- `tags`: small list of operator labels.

Node fields:

- `id`
- `engagement_id`
- `display_name`
- `source_hostname`
- `node_fingerprint`
- `platform_profile`
- `gpu_model`
- `gpu_count`
- `driver_version`
- `cuda_version`
- `kernel_version`
- `operating_system`
- `ofed_version`
- `fabric_type`
- `collection_status`
- `validation_status`
- `readiness_score`
- `last_collection_at`
- `simulated`
- `findings_count`
- `critical_findings_count`
- `high_findings_count`

Raw sensitive hardware identifiers are not shown in the portal. The node fingerprint field is reserved for future sanitized correlation.

Benchmark jobs, runner tokens, and node runners are persisted in the same file-backed store with server-owned lifecycle fields. Clients cannot directly write runner claim times, result IDs, approval fields, or calculated job lifecycle fields. See `docs/BENCHMARK_EXECUTION_PLANE.md` for the BenchmarkJob and node-runner models.

## Platform profiles

Initial supported platform profiles:

- `linux-cluster`
- `gpu-workstation`
- `single-gpu-node`
- `dgx-a100`
- `dgx-h100`
- `dgx-b200`
- `hgx-a100`
- `hgx-h100`
- `hgx-b200`
- `generic-nvlink-cluster`

These are expected-capability profiles. They do not prove DGX/HGX authenticity without supporting platform/provider evidence.

## Statuses and transitions

Engagement statuses:

- `draft`
- `collecting`
- `processing`
- `ready_for_review`
- `complete`
- `archived`

Valid transitions:

- `draft -> collecting`
- `collecting -> processing`
- `processing -> ready_for_review`
- `ready_for_review -> complete`
- non-archived states may transition to `archived`

Invalid transitions are rejected with a useful API error. Arbitrary status strings are not silently accepted.

Acceptance statuses:

- `not_evaluated`
- `ready`
- `ready_with_observations`
- `remediation_required`
- `failed`

Collection statuses:

- `awaiting_evidence`
- `received`
- `validating`
- `validated`
- `rejected`
- `superseded`

Validation statuses:

- `not_evaluated`
- `ready`
- `observations`
- `remediation_required`
- `failed`

## Derived counts

The backend derives these fields from associated nodes and does not trust client-supplied values:

- `received_node_count`
- `ready_node_count`
- `remediation_node_count`
- `failed_node_count`
- `readiness_score`
- `acceptance_status`

Clients attempting to overwrite derived or server-owned fields receive a validation error.

## Persistence

The current application uses lightweight file-backed persistence rather than a database. Engagements use the same operational style:

- deterministic JSON file at `artifacts/engagements/store.json` by default
- override path for tests or deployments with `AI_VALIDATOR_ENGAGEMENT_STORE`
- versioned document schema
- validation before persistence
- safe handling of missing storage files as an empty store
- atomic write pattern: write a temporary file in the same directory and rename it into place
- no production data committed to Git

Future schema changes should add explicit migration logic keyed by `schema_version` before accepting or rewriting older stores.

## API endpoints

Phase 3B.5 adds engagement-scoped benchmark-job and runner-token endpoints:

- `POST /api/v1/engagements/{engagement_id}/benchmark-jobs`
- `GET /api/v1/engagements/{engagement_id}/benchmark-jobs`
- `GET /api/v1/engagements/{engagement_id}/benchmark-jobs/{job_id}`
- `POST /api/v1/engagements/{engagement_id}/benchmark-jobs/{job_id}/approve`
- `POST /api/v1/engagements/{engagement_id}/benchmark-jobs/{job_id}/cancel`
- `POST /api/v1/engagements/{engagement_id}/nodes/{node_id}/runner-tokens`
- `POST /api/v1/engagements/{engagement_id}/nodes/{node_id}/runner-tokens/{token_id}/revoke`

All administrative endpoints require reviewer/admin authentication.

All engagement APIs are authenticated by the existing reviewer/admin access middleware. There is no public unauthenticated engagement enumeration.

- `GET /api/v1/engagements`
- `POST /api/v1/engagements`
- `GET /api/v1/engagements/{engagement_id}`
- `PATCH /api/v1/engagements/{engagement_id}`
- `GET /api/v1/engagements/{engagement_id}/nodes`
- `POST /api/v1/engagements/{engagement_id}/nodes/{node_id}/upload-tokens`
- `GET /api/v1/engagements/{engagement_id}/nodes/{node_id}/upload-tokens`
- `POST /api/v1/engagements/{engagement_id}/nodes/{node_id}/upload-tokens/{token_id}/revoke`
- `GET /api/v1/engagements/{engagement_id}/evidence`
- `GET /api/v1/engagements/{engagement_id}/activity`
- `GET /api/v1/engagements/{engagement_id}/comparison`
- `GET /api/v1/engagements/{engagement_id}/findings`
- `GET /api/v1/engagements/{engagement_id}/readiness`
- `GET /api/v1/engagements/{engagement_id}/evidence/{evidence_id}/provenance`
- `POST /api/v1/engagements/{engagement_id}/evaluate`
- `POST /api/v1/engagements/{engagement_id}/archive`
- `POST /api/v1/engagement-fixtures/nvis-interview-demo`
- `POST /api/v1/evidence/uploads` for bearer-token authenticated node uploads; this route intentionally bypasses reviewer sessions and accepts only scoped upload tokens.

Validation rules:

- `name` is required.
- `customer_name` is required.
- `expected_node_count` must be between 1 and 1024.
- `collection_deadline` must parse as a valid timestamp when supplied.
- unsupported platform profiles are rejected.
- invalid status transitions are rejected.
- IDs are generated server-side.
- calculated counters and readiness fields cannot be overwritten by clients.

## Portal routes

- `/portal/engagements`: engagement list with search, status filter, platform filter, create action, and demo fixture loader.
- `/portal/engagements/new`: new engagement form.
- `/portal/engagements/:engagementId`: customer acceptance dashboard shell.

The detail dashboard includes sections for top-level acceptance summary, nodes, node comparison, findings, readiness breakdown, benchmarks, evidence, acceptance report preview, and activity. Nodes show collection status, validation status, last collection, current evidence ID, upload-token state, token generation, token revocation, and outbound upload instructions. The evidence section shows accepted bundle metadata but does not expose raw downloads. Evidence links open provenance metadata only. Benchmark execution and PDF reports remain placeholders.

## Fixture behavior

The NVIS demo fixture is loaded only when explicitly requested through the authenticated fixture endpoint or portal button. Loading is idempotent:

- it creates the simulated engagement if missing;
- it creates missing simulated node placeholders if needed;
- it does not overwrite user-created engagements;
- it does not represent simulated nodes as real hardware evidence.

Fixture nodes:

- `node01`: awaiting evidence, NVIDIA H100 80GB HBM3, 8 GPUs.
- `node02`: awaiting evidence, NVIDIA H100 80GB HBM3, 8 GPUs. The generated simulated bundle intentionally uses a different NVIDIA driver to produce one high blocking remediation finding after upload.

## Evidence ingestion relationship

Secure evidence bundle ingestion now attaches validated collector `.tar.gz` bundles to engagement nodes through short-lived scoped upload tokens. Accepted evidence updates node collection state, node last collection time, current evidence ID, sanitized source hostname, derived engagement received counts, and activity history. Exact duplicate bundles are rejected and newer collections supersede previous accepted evidence without deleting audit history.

The upload model is outbound-only: the GPU node initiates HTTPS upload to GPU Validator. GPU Validator does not store SSH credentials, open SSH sessions, execute remote commands, require inbound cluster access, or install agents remotely. See `docs/EVIDENCE_INGESTION.md` for the detailed token model, archive validation, persistence layout, CLI commands, portal workflow, and current limitations.

## Cluster intelligence relationship

Accepted evidence is evaluated automatically by the comparison, findings, and readiness endpoints. Evaluation parses evidence into versioned facts with provenance, derives cluster consensus, applies profile-policy findings, computes node and engagement readiness scores, and updates server-controlled fields: `readiness_score`, `acceptance_status`, ready/remediation/failed node counts, node validation statuses, and node fact summaries. Clients cannot write these derived fields. See `docs/CLUSTER_INTELLIGENCE.md`.
