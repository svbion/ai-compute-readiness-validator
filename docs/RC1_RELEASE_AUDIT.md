# RC1 release audit

## Release commit

To be filled with the final implementation commit SHA after validation and commit.

## Scope

RC1 audit covered public routes, authenticated portal routes, Operations Library, administrator user-management routes, authentication/session/logout, engagement APIs, evidence upload APIs, benchmark import APIs, benchmark job APIs, runner registration/heartbeat/job APIs, node runner CLI, deployment scripts/docs, and automated tests.

Machine-readable inventory: `artifacts/rc1/application-inventory.json` (generated artifact; do not commit unless explicitly required).

## Routes audited

Public: `/`, `/login`, `/docs`, `/security`, `/request-access`.

Portal: `/portal`, `/portal/engagements`, `/portal/engagements/new`, `/portal/engagements/:engagementId`, `/portal/library`, `/portal/library/slurm`, `/portal/library/lustre`, `/portal/library/base-command-manager`, `/portal/library/benchmarks`.

Admin: `/portal/admin/users`, `/portal/admin/users/new`, `/portal/admin/users/:userId`, `/portal/admin/demo`, `/portal/admin/system`.

Unknown portal routes render a controlled not-found page.

## Authentication and authorization

RC1 adds a versioned file-backed multi-user account model while preserving legacy environment reviewer bootstrap behavior when no user store exists. Passwords use scrypt hashes. Login supports administrators, reviewers, and temporary reviewers. Session cookies remain HttpOnly/SameSite=Lax/Secure in production. Session version invalidates sessions after disable/reset/revoke. Admin APIs require administrator role.

## Runner communication

Outbound HTTPS runner model only. Registration tokens and runner credentials are random bearer secrets; only hashes are persisted. Runner APIs support registration, heartbeat, claim, status, bounded logs, completion/failure, and benchmark parser attachment. No SSH or arbitrary shell command execution is introduced.

## Benchmark execution

RC1 live scope is NCCL AllReduce single-node through allowlisted generated argv and typed parameters. HPL live execution remains deferred unless adapter, approval, container policy, and tests are complete. Parser regression covers the redacted four-A100 NCCL smoke format without hard-coded thresholds.

## Production configuration requirements

- `AI_FACTORY_AUTH_REQUIRED=true`
- `AI_FACTORY_SESSION_SECRET=<secret>`
- `AI_VALIDATOR_USER_STORE=/opt/ai-factory-validator/shared/users/store.json`
- `AI_VALIDATOR_ENGAGEMENT_STORE=/opt/ai-factory-validator/shared/engagements/store.json`
- `AI_VALIDATOR_EVIDENCE_STORAGE_DIR=/opt/ai-factory-validator/shared/evidence`
- `AI_VALIDATOR_BENCHMARK_STORAGE_DIR=/opt/ai-factory-validator/shared/benchmarks`
- `AI_VALIDATOR_RUNNER_ONLINE_SECONDS=30`
- `AI_VALIDATOR_RUNNER_OFFLINE_SECONDS=120`
- `AI_FACTORY_SESSION_TTL_SECONDS=3600`
- `AI_VALIDATOR_TEMP_USER_MAX_HOURS=24`
- `AI_VALIDATOR_NCCL_TESTS_DIR=/workspace/nccl-tests` on Runpod runner hosts

Never commit `.env.production`, password hashes, runner credentials, upload tokens, session cookies, production stores, or unsanitized real benchmark outputs.

## Defects

P0 blocking: 0 known from static implementation audit.
P1 critical: pending final validation.
P2 important: browser-level manual/mobile audit and real Runpod E2E remain pending unless run in the final validation stage.
P3 cosmetic: admin pages are intentionally minimal RC1 pages, not final design polish.

## Go/no-go decision

Pending validation. RC1 is GO only when requested tests pass, mocked runner E2E passes, admin login/logout/temp interviewer creation pass, no P0/P1 remain, and live Runpod is either verified or explicitly marked not live.

## Rollback

```bash
cd /opt/ai-factory-validator
git fetch origin
git checkout hermes-mvp
git reset --hard <previous-known-good-sha>
npm ci
npm run build
sudo systemctl restart ai-factory-validator
sudo -E ./deploy/verify.sh
```
