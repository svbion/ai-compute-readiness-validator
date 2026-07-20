# RC1 Username Authentication Validation

## Summary

GPU Validator RC1 authentication now uses username as the login identifier. Email remains optional user profile metadata and is not accepted as an authentication identifier.

## Implemented changes

- Login form labels and posts `username` + `password` only.
- Login username input uses `type="text"`, `name="username"`, `autocomplete="username"`, `spellCheck={false}`, `autoCapitalize="none"`, and placeholder `Username`.
- Backend authentication normalizes usernames by trimming whitespace and lowercasing.
- User-store authentication matches only `user.username`; `user.email` is ignored for login.
- Environment fallback reviewer authentication uses `AI_FACTORY_REVIEWER_USERNAME` with the existing scrypt password hash setting.
- Admin user creation requires Username, Display Name, and Role; Email, Expiration, Tags, and Notes remain optional profile metadata.
- Temporary interviewer credentials show Login URL, Username, Temporary Password, Role, and Expiration only.
- Existing user-store shape is preserved: username, display_name, optional email, password_hash, role, status, expiration, notes, tags, timestamps, and session_version.

## Security controls preserved

- scrypt password hashing and verification
- timing-safe password comparison
- secure signed session cookie flow
- HttpOnly/SameSite/Secure cookie flags
- server-side session records
- session TTL / inactivity timeout
- logout session invalidation
- account lockout and failed-login tracking
- disabled, expired, and locked account denial
- session_version invalidation for disable/reset/revoke operations
- administrator-only user-management routes
- deployment verification test-bypass token controls

## Validation evidence

Commands executed on this branch:

- `npm run test:portal` — 53 passed
- `.venv/bin/python -m pytest` — 43 passed
- `npm run lint` — passed
- `npm run build` — passed
- `npm run test:deploy` — passed
- `PORT=3201 npm run test:e2e` — 18 passed, 2 skipped by desktop/mobile project gating
- `AI_FACTORY_APP_DIR=$PWD AI_FACTORY_PORT=3200 AI_FACTORY_BASE_URL=http://127.0.0.1:3200 AI_FACTORY_AUTH_REQUIRED=true AI_FACTORY_AUTH_TEST_BYPASS_TOKEN='test-bypass-token' AI_FACTORY_VERIFY_CADDY=0 AI_FACTORY_VERIFY_TLS=0 ./deploy/verify.sh` — passed

## Acceptance coverage

- bootstrap-admin creates administrator: covered by `tests/test_users_cli.py`
- administrator login using username: covered by admin-authenticated API/session flows and user-store username login tests
- reviewer login using username: covered by `tests-portal/users-api.test.ts`
- temporary reviewer login using username: covered by `tests-portal/users-api.test.ts`
- email optional: covered by admin create-user tests with and without email metadata
- email ignored during authentication: covered by `login authenticates only by normalized username and ignores email metadata`
- sessions function: covered by portal auth and E2E login/logout/session checks
- lockout functions: covered by user-store tests and Playwright lockout path
- inactivity timeout functions: covered by auth TTL/session tests and middleware behavior
- portal authentication functions: covered by `npm run test:e2e` and `deploy/verify.sh`
- admin routes remain protected: covered by `tests-portal/users-api.test.ts`
- deployment verification passes: covered by local `deploy/verify.sh` run above

## Screenshot evidence

Updated login screenshot showing Username / Password / Sign In:

- `artifacts/rc1/login-username-desktop.png`

## Production readiness notes

The implementation is production-ready for RC1 username-based authentication. No schema migration is required. Existing users remain compatible because the stored username remains canonical and email remains nullable metadata. Deployments must replace legacy email-based reviewer configuration with `AI_FACTORY_REVIEWER_USERNAME` before activation.
