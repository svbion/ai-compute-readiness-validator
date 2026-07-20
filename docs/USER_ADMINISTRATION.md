# User administration

GPU Validator RC1 supports a versioned multi-user account store at `AI_VALIDATOR_USER_STORE`. Production should set it to `/opt/ai-factory-validator/shared/users/store.json`. Local development may omit the variable and use `artifacts/users/store.json`. The store is JSON, written atomically with mode `0600` inside a `0700` parent directory, and must not be committed when it contains production users.

Public experience is login-only: unauthenticated `/`, `/docs`, `/security`, `/request-access`, and `/portal/*` requests redirect to `/login`. After authentication, `/` and `/login` redirect to `/portal` and the full GPU Validator portal remains protected.

## Account model

Roles: `administrator`, `reviewer`, `temporary_reviewer`.

Statuses: `active`, `disabled`, `expired`, `locked`.

User records include id, schema version, normalized unique username, display name, optional email, server-controlled role/status, scrypt password hash, timestamps, expiration, failed-login count, lockout, must-change-password flag, session version, notes, and tags. API responses never return `password_hash`.

Authentication uses the normalized username only. Email is optional profile metadata and is not accepted as a login identifier.

## Bootstrap initial administrator

Create a password file outside the repository:

```bash
install -m 600 /dev/null /secure/path/admin-password.txt
# paste the password into the file using an approved secure method
```

Then run:

```bash
AI_VALIDATOR_USER_STORE=/opt/ai-factory-validator/shared/users/store.json \
  ai-validator users bootstrap-admin \
  --username <username> \
  --display-name "<display name>" \
  --password-file /secure/path/admin-password.txt
```

The command refuses to run when an active administrator already exists unless `--recovery` is explicitly supplied. It prints only the created username and user ID, never the password.

The CLI resolves the user-store path in the same order as production operations: exported `AI_VALIDATOR_USER_STORE`, then `AI_VALIDATOR_USER_STORE` in `.env.production` in the current directory, then the local development fallback. Running `ai-validator users bootstrap-admin` from `/opt/ai-factory-validator` therefore writes to the same store that systemd passes to the Node service through `.env.production`.

For the production administrator, use username `sfrazier`:

```bash
sudo -u ai-validator -H bash -lc 'cd /opt/ai-factory-validator && . .venv/bin/activate && ai-validator users bootstrap-admin --username sfrazier --display-name "Sabion Frazier" --password-file /secure/path/admin-password.txt'
```

## Safe diagnostics

Run diagnostics without exposing password hashes or secrets:

```bash
cd /opt/ai-factory-validator
. .venv/bin/activate
ai-validator users diagnose --username sfrazier
```

The command reports the active store path, existence, owner uid/gid, file mode, user count, whether `sfrazier` exists, role, status, expired/locked state, must-change-password, and session version. It never prints plaintext passwords, password hashes, session secrets, or bypass tokens.

## Portal workflow

The login workflow displays `Username`, `Password`, and `Sign In`. Login requests send `{ "username": "...", "password": "..." }`; clients must not send an email field for authentication.

Administrator routes:

- `/portal/admin/users`
- `/portal/admin/users/new`
- `/portal/admin/users/:userId`

Administrative APIs:

- `GET /api/v1/admin/users`
- `POST /api/v1/admin/users`
- `GET /api/v1/admin/users/{user_id}`
- `PATCH /api/v1/admin/users/{user_id}` currently returns a controlled 501 explanation rather than silently doing nothing.
- `POST /api/v1/admin/users/{user_id}/disable`
- `POST /api/v1/admin/users/{user_id}/enable`
- `POST /api/v1/admin/users/{user_id}/reset-password`
- `POST /api/v1/admin/users/{user_id}/revoke-sessions`

Safety controls:

- Last active administrator cannot be disabled.
- Password reset and disable increment `session_version`, invalidating active sessions.
- Temporary passwords are returned only in the create/reset response.
- Login errors remain generic for invalid usernames/passwords.
- Temporary users are denied after expiration.

## Troubleshooting username login

- User exists in the wrong store: run `ai-validator users diagnose --username sfrazier` from `/opt/ai-factory-validator` and compare `active_user_store_path` with `systemctl show ai-factory-validator.service -p Environment` or `.env.production`. Move or recreate the account only in `/opt/ai-factory-validator/shared/users/store.json`.
- Server and CLI use different paths: set `AI_VALIDATOR_USER_STORE=/opt/ai-factory-validator/shared/users/store.json` in `.env.production`, restart the service, and run CLI commands from the app directory or export the same variable.
- Account locked: diagnostics show `locked: true`; wait for `locked_until` to expire or use administrator recovery to reset state without changing password verification rules.
- Account expired: diagnostics show `expired: true`; create a new active account or update expiration through administrator tooling.
- Wrong username normalization: login identifiers are trimmed and lowercased. Use `sfrazier`, not an email address. Email is metadata only.
- Stale service environment: after changing `.env.production`, run `sudo systemctl daemon-reload && sudo systemctl restart ai-factory-validator.service`.
- Stale frontend deployment: run `sudo -E ./deploy/update.sh`, then verify `/` redirects to `/login` and `/login` contains `GPU Infrastructure Readiness, Validated`.

## Fast NVIDIA interviewer accounts

Open `/portal/admin/users` and click `Create Interviewer Account`.

Default behavior:

- role: `temporary_reviewer`
- username: `nvidia-reviewer-<short-id>`
- expiration: 8 hours
- random cryptographic temporary password
- `must_change_password=false` for short interview use

The credential modal shows once:

- login URL
- username
- temporary password
- role
- expiration

Use `Copy All Credentials`, `Copy Username`, or `Copy Password`. Closing the modal clears credential state. The plaintext password is not persisted and cannot be retrieved later.
