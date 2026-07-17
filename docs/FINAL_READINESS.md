# Final Public Deployment Readiness

Status: final Phase 11 documentation/authentication coverage pass on `hermes-mvp`.

This document records the final audit result for the AI Factory Validation Portal. It is intentionally conservative: no real NVIDIA/DGX/HGX hardware validation is claimed unless verified live evidence is collected and imported through the administrator-side workflow.

## 1. Starting audit summary

Repository state at the start of this pass:

- Branch: `hermes-mvp`
- Remote target: `origin/hermes-mvp`
- Recent completed work already present:
  - invite-only authentication entry
  - authenticated production verification
  - authenticated Playwright E2E coverage
  - portable live evidence collection
  - sanitized import workflow
  - live/imported evidence source context in the portal
  - read-only reviewer surface hardening
  - DGX access and real-hardware validation playbooks

Audit checks performed:

- Confirmed no public registration UI exists.
- Confirmed no upload, multipart, multer/formidable, or browser-side file-import path exists in application code.
- Confirmed `POST /api/run-scenario` is a read-only guard that returns HTTP `405`.
- Confirmed evidence generation/import remains administrator-side CLI only.
- Confirmed source switching clears stale cluster/result state and E2E asserts degraded-to-healthy does not retain `97.01%`.
- Confirmed docs now describe production authentication and no longer imply the portal has no auth in production.
- Confirmed docs include browser/accessibility review notes and a feature-by-feature functional matrix.

## 2. Login page implementation

The login page is implemented in `src/App.tsx` as an invite-only reviewer entry:

- modern dark enterprise layout
- responsive two-column desktop layout and stacked mobile layout
- labeled email and password fields
- password show/hide control
- `autocomplete="email"` and `autocomplete="current-password"`
- generic invalid-credential and lockout messages
- invitation-required copy
- attribution and no-endorsement disclaimer
- no public registration link or social login
- no browser local-storage credential persistence

Visual review results:

- desktop login page: polished, readable, no clipping or overlap observed
- mobile login page: readable, usable, controls visible, no clipping or overlap observed

Automated coverage:

- `tests-e2e/portal.spec.ts` verifies login page visibility, labels, password control, invalid credentials, lockout, login, logout, redirect-to-login, and mobile usability.
- `tests-portal/auth.test.ts` verifies auth configuration and password hashing/session primitives.

## 3. Authentication functionality and limitations

Authentication behavior:

- Production defaults to authentication-required.
- Development may explicitly disable or require auth via environment.
- `/healthz`, `/login`, and `/api/auth/config` remain public.
- Protected API/report routes return JSON `401` when unauthenticated.
- Protected browser routes redirect to `/login?reason=expired-session`.
- Sessions are server-side in-memory records signed with HMAC cookies.
- Password verification uses scrypt hashes configured through environment variables.
- Repeated failed logins are temporarily locked by attempt key.
- Deployment verification may use a server-side test bypass token configured only on the host.

Limitations:

- There is no user database.
- There is no public registration, password reset, social login, or external identity provider.
- In-memory sessions reset when the Node process restarts.
- Reviewer credentials, session secrets, and deployment verification tokens must be supplied out-of-band and never committed.

## 4. Complete feature inventory

Portal and reviewer UI:

- Invite-only login page
- Authenticated portal shell
- Logout
- Scenario controls: Simulated Healthy and Simulated Degraded
- Evidence source selector
- Source context panel
- Imported evidence warning banner
- Overall Readiness Score card
- Customer Acceptance Status card
- Active Findings card
- Validation Profile card
- Customer Acceptance Gate
- Category score rollup
- Cluster Topology
- Per-node detail and expandable evidence checks
- GPU Health
- InfiniBand / RDMA Fabric Health
- Scheduler and Orchestration
- Customer Handoff Summary
- Report Access links
- Interview Walkthrough
- Benchmark Readiness tab
- Future orchestration scope note
- Controlled error state
- Responsive mobile layout

API and report routes:

- `GET /healthz`
- `GET /login`
- `GET /api/auth/config`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `GET /api/results?scenario=healthy`
- `GET /api/results?scenario=degraded`
- `GET /api/results?source=latest-live`
- `GET /api/results?source=imported-live`
- `GET /api/evidence-sources`
- `GET /api/node-history/:nodeName`
- `POST /api/run-scenario` as a read-only `405` guard
- `GET /reports/:scenario/html`
- `GET /reports/:scenario/markdown`
- `GET /reports/:scenario/json`

CLI and operational tooling:

- `ai-validator --help`
- `ai-validator version`
- `ai-validator demo --scenario healthy --output-dir artifacts`
- `ai-validator demo --scenario degraded --output-dir artifacts`
- `ai-validator validate --profile auto --name local-live-smoke --output-dir artifacts/live-smoke`
- `tools/collect-live-evidence.sh`
- `tools/sanitize-evidence.py`
- `tools/import-live-evidence.py`
- `deploy/install.sh`
- `deploy/bootstrap.sh`
- `deploy/update.sh`
- `deploy/rollback.sh`
- `deploy/healthcheck.sh`
- `deploy/verify.sh`
- systemd service template
- Caddyfile template

Documentation:

- README
- Architecture notes
- Demo walkthrough
- Security posture
- Functional test matrix
- Current state
- Hetzner deployment guide
- DGX access playbook
- Real hardware validation guide
- Final readiness summary

## 5. Functional defects found

Defects found during the hardening/documentation pass:

1. Public reviewer surface still exposed a scenario-run affordance and API path from earlier demo behavior.
2. `POST /api/run-scenario` could previously execute the local CLI from the web server.
3. Deployment verification expected run-scenario execution instead of validating read-only behavior.
4. Sanitizer did not reject symlink traversal attempts.
5. Importer accepted traversal-like import names.
6. Importer accepted live-labeled NVIDIA evidence without successful `nvidia-smi` proof.
7. Playwright auth lockout test could collide between desktop and mobile projects because they reused the same invalid email.
8. Some documentation still described reviewer-triggered scenario execution or implied no authentication in production.
9. Functional matrix did not fully enumerate newer source selector, source context, imported banner, sanitizer, importer, and read-only reviewer behavior.

## 6. Functional defects fixed

Fixes applied and covered:

1. Removed the reviewer-side run button from the portal.
2. Changed `POST /api/run-scenario` to return HTTP `405` with a read-only/admin-CLI message.
3. Updated `deploy/verify.sh` to assert `POST /api/run-scenario` returns `405`.
4. Added `deploy/bootstrap.sh` wrapper for one-command first-time deployment compatibility.
5. Added sanitizer symlink rejection.
6. Added importer import-name validation to block path traversal.
7. Added importer `nvidia-smi` proof requirement for live NVIDIA imports.
8. Added `tests/test_evidence_tools.py` covering:
   - safe fixture import
   - IP address redaction
   - username path redaction
   - malformed JSON
   - invalid checksum
   - simulated evidence mislabeled as live
   - live evidence without `nvidia-smi` proof
   - path traversal attempts
9. Updated E2E tests to prove:
   - no run-scenario button exists
   - run-scenario API is read-only
   - healthy/degraded switching does not retain stale score/context
   - auth lockout test data is isolated per Playwright project/worker
10. Updated README, architecture, demo, security, deployment, current-state, real-hardware, and functional matrix documentation.

## Final verification summary

Commands run during final readiness validation:

```bash
npm run build
npm run lint
npm run test:portal
npm run test:e2e
source .venv/bin/activate
pytest -q
pytest tests/test_evidence_tools.py -q
ai-validator --help
ai-validator version
ai-validator demo --scenario healthy --output-dir artifacts
ai-validator demo --scenario degraded --output-dir artifacts
ai-validator validate --profile auto --name local-live-smoke --output-dir artifacts/live-smoke
bash -n deploy/install.sh deploy/bootstrap.sh deploy/update.sh deploy/rollback.sh deploy/healthcheck.sh deploy/verify.sh tools/collect-live-evidence.sh
python3 -m py_compile tools/sanitize-evidence.py tools/import-live-evidence.py
deploy/healthcheck.sh
deploy/verify.sh
git diff --check
```

Observed scenario results:

- Healthy scenario remains `100.0%` / `Ready`.
- Degraded scenario remains `97.01%` / `Remediation required`.

Hardware statement:

Real NVIDIA GPU validation was not executed in this pass. The local live smoke ran on the current local host only. No real DGX/HGX/DGX Cloud/LaunchPad hardware output was fabricated or introduced.
