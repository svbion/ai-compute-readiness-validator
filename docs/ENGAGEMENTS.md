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

All engagement APIs are authenticated by the existing reviewer/admin access middleware. There is no public unauthenticated engagement enumeration.

- `GET /api/v1/engagements`
- `POST /api/v1/engagements`
- `GET /api/v1/engagements/{engagement_id}`
- `PATCH /api/v1/engagements/{engagement_id}`
- `GET /api/v1/engagements/{engagement_id}/nodes`
- `POST /api/v1/engagements/{engagement_id}/archive`
- `POST /api/v1/engagement-fixtures/nvis-interview-demo`

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

The detail dashboard includes sections for nodes, findings, benchmarks, evidence, acceptance report, and activity. For this milestone, evidence upload, benchmark execution, and PDF reports are placeholders only.

## Fixture behavior

The NVIS demo fixture is loaded only when explicitly requested through the authenticated fixture endpoint or portal button. Loading is idempotent:

- it creates the simulated engagement if missing;
- it creates missing simulated node placeholders if needed;
- it does not overwrite user-created engagements;
- it does not represent simulated nodes as real hardware evidence.

Fixture nodes:

- `node01`: awaiting evidence, NVIDIA H100 80GB HBM3, 8 GPUs.
- `node02`: awaiting evidence, NVIDIA H100 80GB HBM3, 8 GPUs.

## Future evidence upload relationship

The next milestone is secure evidence bundle ingestion and upload tokens. Evidence bundles from `ai-validator collect` should later attach to engagement nodes, update collection status, drive node validation, derive engagement counts, and produce acceptance reports without exposing raw credentials or untrusted imported content.
