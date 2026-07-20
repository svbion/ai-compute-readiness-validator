# Cluster intelligence

GPU Validator cluster intelligence turns accepted node evidence bundles into parsed facts, comparison metadata, findings, readiness scores, and acceptance decisions. It does not run remote commands, execute benchmarks, generate PDFs, or expose raw evidence files.

## Parser architecture

The backend evaluates only accepted evidence records already stored by secure ingestion. For each accepted record it reads the normalized extracted bundle from private evidence storage and parses known text files deterministically. Parsing is versioned with `parser_version: 1.0.0` and is tolerant of missing or malformed files: one parser warning does not fail the engagement.

Supported initial inputs:

- Linux: `linux/uname.txt`, `linux/os-release.txt`, `linux/hostnamectl.txt`, `linux/lscpu.txt`, `linux/lsmem.txt`, `linux/df.txt`, `linux/findmnt.txt`, `linux/systemctl-failed.txt`
- GPU: `gpu/nvidia-smi.txt`, `gpu/nvidia-smi-query.txt`, `gpu/topology.txt`, `gpu/nvlink-status.txt`, `gpu/dcgm-discovery.txt`
- Metadata: `manifest.json`, `metadata/commands.json`

The parser never invokes a shell and never treats missing commands as fatal.

## Fact model

Each parsed node fact is represented as `{ value, provenance }`. Initial fields include node/evidence IDs, collector profile, hostname display, collection time, OS/kernel/CPU/memory, NVIDIA GPU inventory, driver/CUDA, NVLink/DCGM/fabric, storage mounts, failed systemd units, command counts, and sanitized/simulated flags. Values are nullable when evidence is unavailable. The system does not invent values.

## Provenance

Every parsed value has provenance referencing:

- evidence ID
- source file inside the accepted bundle
- source command ID and command argv when available
- collection timestamp
- source checksum from manifest metadata
- sanitized/simulated flags

The provenance API returns parsed references only. It does not expose raw storage paths or raw file contents.

## Comparison consensus

`GET /api/v1/engagements/{engagement_id}/comparison` computes one row per node and consensus metadata for comparable fields. Consensus uses the most common non-null value. All-null fields produce no mismatch. Ties produce no consensus and a warning; non-null tied values are highlighted as differences for reviewer visibility. Total memory uses a 3% tolerance. GPU count matches exactly for homogeneous profiles.

## Profile policies

Policies are defined for:

- `linux-cluster`
- `gpu-workstation`
- `single-gpu-node`
- `dgx-a100`, `dgx-h100`, `dgx-b200`
- `hgx-a100`, `hgx-h100`, `hgx-b200`
- `generic-nvlink-cluster`

Each policy defines expected GPU count where known, homogeneous GPU/driver/CUDA requirements, NVLink and InfiniBand expectations, required evidence domains, stale evidence threshold, command failure threshold, and blocking overrides.

## Findings rules

The rule engine is versioned with `rule_version: 1.0.0`. Findings include rule ID, severity, category, blocking flag, node or cluster scope, impact, recommendation, verification command, evidence references, simulated flag, and creation time.

Initial rules cover:

- cluster consistency: GPU model/count, driver, CUDA, kernel, OS, and OFED mismatches
- node health: missing GPUs, NVLink unavailable/degraded, missing NVIDIA command, DCGM unavailable, failed systemd units, high command failure rate, missing expected node evidence
- evidence quality: unsanitized evidence, simulated evidence, stale evidence

No speculative performance findings are emitted yet.

## Scoring model

Readiness is deterministic and explainable. The initial 100-point model is:

- evidence completeness: 20
- Linux health: 15
- GPU inventory and driver health: 30
- topology and NVLink: 15
- fabric readiness: 10
- consistency across nodes: 10

Critical and high findings produce significant deductions. Missing evidence reduces the corresponding category. Benchmarks are explicitly `not_evaluated` and excluded from the score.

## Acceptance logic

Acceptance is separate from score:

- incomplete expected node collection: `not_evaluated`
- blocking critical finding: `failed`
- blocking high finding: `remediation_required`
- no blocking findings but medium/low findings: `ready_with_observations`
- no blocking findings: `ready`

Simulated evidence can compute a demo acceptance status, but the portal displays: `DEMONSTRATION ONLY — NOT VALID FOR CUSTOMER ACCEPTANCE`. Simulated evidence must not be treated as production/customer accepted.

## API endpoints

All endpoints are authenticated by the existing reviewer/admin middleware:

- `GET /api/v1/engagements/{engagement_id}/comparison`
- `GET /api/v1/engagements/{engagement_id}/findings`
- `GET /api/v1/engagements/{engagement_id}/readiness`
- `GET /api/v1/engagements/{engagement_id}/evidence/{evidence_id}/provenance`
- `POST /api/v1/engagements/{engagement_id}/evaluate`

Evaluation is safe to run automatically from these read endpoints: it parses accepted local evidence, computes derived results, and updates server-controlled engagement/node fields. It does not execute hardware commands.

## UI workflow

The engagement detail page shows an acceptance summary, node comparison table, findings filters, readiness breakdown, evidence metadata, provenance modal, benchmark awaiting state, and an acceptance report preview shell. Evidence links open provenance metadata only.

## Simulated-data behavior

The NVIS demo generator produces two simulated H100 node bundles. `node01` is intentionally ready. `node02` has a different NVIDIA driver version, producing a high blocking remediation finding. The engagement result demonstrates 2 received nodes, 1 ready node, 1 remediation node, and `remediation_required` acceptance with a demo-only warning.

## Current limitations

- File-backed persistence remains the current store.
- No raw evidence downloads.
- No PDF generation.
- No benchmark importers yet.
- No remote execution or benchmark execution.
- Parser coverage is intentionally conservative and will expand with real H100 lab evidence.

## Next milestone

Importers for NCCL, NVIDIA HPL, and inference benchmark result artifacts. Benchmark results should remain separate from current readiness until the benchmark scoring policy is defined.
