Generated: 2026-07-21T15:46:36.995936+00:00
Source basis: repository audit of server.ts, src/App.tsx, src/server/*, src/portal/*, agent/gpuvalidator_agent/*, tests-portal/*, package.json, pyproject.toml. No production deployment was performed.

# GPUValidator v1.0 Product Roadmap

## v0.7 Local interview MVP hardening
- Live RunPod agent registration/heartbeat/job/result workflow.
- Live GPU Inventory from hardware-discovery validation results.
- NCCL all-reduce smoke job support with raw evidence and parser output.
- Complete Reports section with server-side generation and downloads.
- Demo runbooks and audit docs.

## v0.8 Evidence and validation packs
- First-class evidence table/store for validation command results.
- Versioned validation pack manifest model.
- Pack coverage: hardware discovery, GPU health, driver, CUDA, ECC, PCIe, NVLink, topology, thermal, power, memory, Linux, NCCL.
- Explicit Not Supported/Not Installed/Not Collected/Not Applicable UI states.

## v0.9 Enterprise platform foundation
- Organizations, customers, engagements, sites, datacenters, clusters.
- Role and permission matrix with report/evidence authorization.
- Audit logs, retention policies, API keys, token rotation.
- Notification/alert delivery and regressions.

## v1.0 Commercial readiness
- Production DB and object storage.
- Report approval/versioning workflow.
- PDF/DOCX renderer suitable for customer delivery.
- AI Copilot with citations to validation/benchmark/evidence/report records.
- Licensing, customer-hosted and air-gapped deployment models.
- Acceptance demo: live RunPod A100x4, hardware validation complete, NCCL dependency status, customer and management reports generated.
