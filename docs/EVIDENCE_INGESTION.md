# Evidence ingestion

GPU Validator uses an outbound evidence upload architecture. A site administrator runs `ai-validator collect` and `ai-validator bundle` on the GPU node, then the node initiates an HTTPS upload to GPU Validator. GPU Validator does not store SSH credentials, open SSH sessions, execute remote commands, require inbound cluster access, or install agents remotely.

## Security model

Upload tokens are scoped to exactly one engagement and one node. Administrative token APIs require the normal reviewer/admin session. Node upload traffic uses only an upload bearer token on `POST /api/v1/evidence/uploads`; reviewer cookies are not accepted as node-upload authentication.

Plaintext upload tokens are generated with cryptographically secure randomness, returned only in the creation response, and never persisted. The file-backed engagement store persists only a SHA-256 token digest and compares presented digests with `crypto.timingSafeEqual`. API list responses never return token hashes or plaintext tokens.

Tokens default to a 2 hour lifetime, may be configured within safe bounds, are single-use by default, and may be explicitly revoked. Expired state is derived from `expires_at` when listing tokens.

## Token lifecycle

Administrative endpoints:

- `POST /api/v1/engagements/{engagement_id}/nodes/{node_id}/upload-tokens`
- `GET /api/v1/engagements/{engagement_id}/nodes/{node_id}/upload-tokens`
- `POST /api/v1/engagements/{engagement_id}/nodes/{node_id}/upload-tokens/{token_id}/revoke`

Creation returns the plaintext token once plus `upload_url`. Operators should copy it to a secure file on the source node and delete it after upload. Lists and revoke responses omit plaintext and hashes.

## Bundle requirements

The supported upload format for this milestone is `application/octet-stream` containing a `.tar.gz` or `.tgz` collector bundle. ZIP files are not accepted.

Expected bundle contents:

- `manifest.json`
- `checksums.sha256`
- `metadata/commands.json`
- `linux/*` and/or `gpu/*` evidence files, depending on collector profile

Supported manifest schema version: `1.0.0`.
Supported collector profiles: `linux-host`, `gpu-workstation`, `single-gpu-node`, and `dgx-class`.
Supported checksum algorithm: `sha256`.

Fixture/demo bundles must include `simulated: true` and `collection_mode: fixture`.

## Archive validation

The server validates the archive before it is finalized:

- maximum compressed size
- maximum expanded size
- maximum file count
- maximum individual file size
- gzip/tar parse validity
- no absolute paths or `../` traversal
- no duplicate paths
- no symlinks, hard links, devices, FIFOs, sockets, or directory entries as payload
- no nested archive files
- exactly one `manifest.json`
- exactly one `checksums.sha256`
- required `metadata/commands.json`
- valid UTF-8 JSON
- supported manifest schema/profile/checksum algorithm
- sane manifest command counts and timestamps
- every declared evidence file exists
- every checksum matches
- checksum paths cannot escape the bundle
- manifest engagement/node identity, when present, must match the upload token scope

Archive contents are never executed and no shell is invoked during validation.

## Size limits and configuration

Defaults:

- compressed upload: `50 MiB`
- expanded upload: `250 MiB`
- file count: `500`
- individual file: `25 MiB`
- upload token lifetime: `2 hours`

Environment overrides:

- `AI_VALIDATOR_EVIDENCE_MAX_COMPRESSED_BYTES`
- `AI_VALIDATOR_EVIDENCE_MAX_EXPANDED_BYTES`
- `AI_VALIDATOR_EVIDENCE_MAX_FILE_COUNT`
- `AI_VALIDATOR_EVIDENCE_MAX_FILE_BYTES`
- `AI_VALIDATOR_UPLOAD_TOKEN_DEFAULT_SECONDS`
- `AI_VALIDATOR_UPLOAD_TOKEN_MAX_SECONDS`
- `AI_VALIDATOR_EVIDENCE_STORAGE_DIR`
- `AI_VALIDATOR_PUBLIC_BASE_URL`

These values are not secrets. Do not print or commit production authentication secrets.

## Persistence layout

Accepted evidence is stored outside frontend/public directories. Default layout:

```text
artifacts/evidence/{engagement_id}/{node_id}/{collection_id}/
├── original-bundle.tar.gz
├── manifest.json
├── checksums.sha256
├── metadata/commands.json
├── linux/*
├── gpu/*
└── ingestion.json
```

API responses expose evidence metadata and a safe `storage_id`, not raw filesystem paths or `storage_key`.

Finalization order:

1. receive upload into a temporary directory
2. validate archive, manifest, files, and checksums
3. move validated extraction into final evidence storage
4. persist ingestion metadata and original archive
5. update engagement/node persistence
6. mark the token used

Temporary files are removed on success and failure. Generated evidence and production stores must not be committed.

## Duplicate and superseding behavior

Duplicates are detected by engagement ID, node ID, collection ID, and bundle SHA-256. Exact duplicate uploads are rejected with `409` and an activity entry.

A newer accepted collection for the same node supersedes the previous accepted evidence record. Previous evidence is preserved for audit history and marked `superseded`; only one accepted current evidence record is attached to the node.

Successful ingestion updates:

- node `collection_status` to `received`
- node `last_collection_at`
- node sanitized `source_hostname`
- node `current_evidence_id`
- engagement derived `received_node_count`
- engagement `updated_at`

Engagements may transition from `draft` to `collecting` when a token is created. Uploads do not automatically mark an engagement complete.

## CLI commands

Package an existing collector directory:

```bash
ai-validator bundle \
  --input evidence-directory \
  --output node01-evidence.tar.gz
```

Use `--force` to overwrite an existing output archive. The command validates input, rejects symlinks, creates deterministic archives, and prints the archive SHA-256.

Upload from a node:

```bash
export GPU_VALIDATOR_UPLOAD_TOKEN="$(cat /secure/path/upload-token.txt)"
ai-validator upload \
  --bundle /tmp/node01-evidence.tar.gz \
  --url https://gpuvalidator.com/api/v1/evidence/uploads
```

Or prefer an explicit token file:

```bash
ai-validator upload \
  --bundle /tmp/node01-evidence.tar.gz \
  --url https://gpuvalidator.com/api/v1/evidence/uploads \
  --token-file /secure/path/upload-token.txt
```

The CLI does not accept a plaintext token command-line option. HTTPS is required by default; local development may use `--allow-insecure-http`. TLS verification is not disabled.

## Portal workflow

On `/portal/engagements/:engagementId`, each node shows collection status, validation status, last collection time, current evidence ID, and upload-token state. Reviewers can generate an upload token, copy it from a one-time modal, and revoke an active token.

The modal warns that the token cannot be retrieved again. The token is not written to localStorage and is cleared from component state when the modal closes.

The Evidence section shows node, evidence ID, collector version/profile, collected/uploaded timestamps, sanitized/simulated labels, command counts, bundle checksum, status, and validation warnings. Raw evidence download is intentionally not exposed yet.

Accepted evidence is also evaluated by authenticated cluster-intelligence endpoints. The portal displays the derived comparison table, findings, readiness breakdown, acceptance decision, and evidence provenance modal. Provenance responses include source command, source file, collection timestamp, checksum, parsed field/value, and simulated/sanitized flags; raw content and filesystem paths are not exposed.

## Activity history

Activity entries are recorded for:

- upload token created
- upload token revoked
- evidence upload accepted
- duplicate upload rejected
- evidence superseded

Activity metadata never includes plaintext tokens or secret material.

## Demo helper

Create safe simulated bundles for `node01` and `node02`:

```bash
python scripts/create_demo_evidence.py \
  --output /tmp/gpu-validator-demo-evidence
```

The generated manifests include `simulated: true` and `collection_mode: fixture` and are not loaded automatically into production. `node01` is internally consistent and ready. `node02` intentionally reports a different NVIDIA driver version to demonstrate a high blocking cluster-consistency finding and `remediation_required` acceptance for the simulated engagement.

## Troubleshooting

- `401 Upload authentication failed`: missing, expired, revoked, used, malformed, or wrong token.
- `400 Evidence upload rejected`: malformed archive, unsafe path/type, unsupported manifest, checksum mismatch, or engagement/node mismatch.
- `409 Duplicate evidence bundle was already accepted`: the same collection and archive was already ingested.
- `413`: compressed upload or token-specific upload limit exceeded.

Use the response `error_id` for log correlation. Do not log or share plaintext tokens.

## Current limitations

- No benchmark parsing during bundle ingestion; benchmark status is `Awaiting Benchmark Evidence` and excluded from the current readiness score.
- No PDF report generation.
- No raw evidence downloads from the portal.
- No remote SSH execution or remote package installation.
- File-backed persistence remains the current storage model; future production database migration should preserve token hashing, audit history, and storage-key privacy.
