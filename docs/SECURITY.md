# Security

## Security posture

This project is designed as a read-only diagnostic/reporting tool. The intended safety model is:
- no privileged escalation
- no system mutation
- no shell interpolation of user input
- graceful handling of missing commands and restricted environments
- redaction of common secrets from captured command output

## Command execution model

`src/ai_validator/runner.py` centralizes command execution.

Key protections:
- commands are executed as argument arrays with `shell=False`
- execution is bounded by a timeout
- common mutating keywords are blocked before execution
- missing commands return structured evidence (`exit_code=127`) rather than crashing the CLI
- permission failures return structured evidence (`exit_code=13`) rather than crashing the CLI
- stdout/stderr are sanitized before persistence in report artifacts

The current regression suite includes a direct test that mutating commands are blocked.

## Collector behavior in constrained environments

Collectors are expected to run safely on machines that do not have:
- NVIDIA drivers
- DCGM
- InfiniBand tooling
- Slurm
- Kubernetes tooling
- NVMe utilities

Instead of failing hard, collectors produce `skipped`, `unavailable`, or `unknown` checks with clear recommendations. This was validated in the live local smoke run on macOS during this recovery session.

## Data handling

Persisted outputs are local files only:
- JSON reports
- Markdown reports
- standalone HTML reports

The project currently uses environment-driven invite-only portal authentication in production, implemented with local server-side sessions and no external identity provider or database. The project does not add:
- remote telemetry
- cloud upload
- public registration
- external auth flows
- database persistence

## Bootstrap administrator

Production server startup seeds the initial Platform Administrator only when authentication is required and a persistent user store is configured. The seeded account is:

- Michael Echavarria / `mechavarria`
- role: Platform Administrator (`administrator`)
- `must_change_password=true`

The source tree never contains a plaintext password. Operators may set `GPUVALIDATOR_INITIAL_ADMIN_PASSWORD` for first bootstrap, or omit it so the server generates a secure temporary password and prints it once to service logs. Subsequent startups are idempotent: if `mechavarria` already exists, the seed step leaves the account and password hash unchanged and does not print a credential.

The administrator role has full RBAC coverage for current product areas: platform administration, users, organizations, agents, clusters, validations, benchmarks, reports, monitoring, alerts, settings, audit logs, API keys, AI Copilot, licensing, and integrations.

## Threat model boundaries

This is not a hardened remote execution platform. Current intentional boundaries:
- local-only command execution
- no SSH orchestration yet
- no arbitrary user-supplied shell commands exposed through the web UI
- no public upload or browser-side live-evidence import path
- reviewer portal routes are read-only; live evidence import remains an administrator-side CLI action
- demo scenarios are deterministic fixtures, not remote-controlled payloads

## Operational caveats

- HTML reports are self-contained and portable, but they may include sanitized command evidence. Treat them as internal diagnostic artifacts.
- The portal's benchmark section is still demo-oriented; the authoritative ingestion workflow is the CLI.
- If future work introduces remote fan-out, file uploads, or multi-user access, the threat model and validation surface must be revisited.

## Product branding note

GPU Validator is the public product brand. AI Factory remains a validation profile and infrastructure-readiness concept, and the Git repository remains `ai-compute-readiness-validator` for compatibility. The canonical public URL is `https://gpuvalidator.com`.
