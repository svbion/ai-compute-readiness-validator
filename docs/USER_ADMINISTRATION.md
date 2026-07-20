# User administration

GPU Validator RC1 supports a versioned multi-user account store at `AI_VALIDATOR_USER_STORE` or `artifacts/users/store.json` by default. The store is JSON, written atomically with mode `0600`, and must not be committed when it contains production users.

## Account model

Roles: `administrator`, `reviewer`, `temporary_reviewer`.

Statuses: `active`, `disabled`, `expired`, `locked`.

User records include id, schema version, normalized unique username, display name, optional email, server-controlled role/status, scrypt password hash, timestamps, expiration, failed-login count, lockout, must-change-password flag, session version, notes, and tags. API responses never return `password_hash`.

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

## Portal workflow

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
