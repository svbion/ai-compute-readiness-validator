Generated: 2026-07-21T15:46:36.995936+00:00
Source basis: repository audit of server.ts, src/App.tsx, src/server/*, src/portal/*, agent/gpuvalidator_agent/*, tests-portal/*, package.json, pyproject.toml. No production deployment was performed.

# Security Model

Current controls: session auth, no public registration, hashed user passwords, bearer agent token, upload token hashing, path traversal checks, upload size limits, archive checksum validation, output truncation, token redaction, authenticated API routes.

Required next controls: org/customer-scoped authorization, OIDC/SAML, API keys, audit logs, report/evidence download authorization, token rotation, rate limiting, data retention, and secret scanning in CI.
