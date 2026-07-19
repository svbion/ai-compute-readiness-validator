# GPU Validator production smoke test

Use this runbook after deploy/update on `https://gpuvalidator.com`. Do not paste real credentials, tokens, or `.env.production` values into chat or tickets.

## 1. DNS

```bash
dig +short gpuvalidator.com
dig +short www.gpuvalidator.com
```

Expected: records resolve to the production server IPs.

## 2. TLS and root domain

```bash
curl -fsSIL https://gpuvalidator.com
curl -fsS https://gpuvalidator.com/login >/tmp/gpuvalidator-login.html
```

Expected: HTTPS succeeds and the login page contains the GPU Validator app shell.

## 3. www redirect

```bash
curl -sSIL http://www.gpuvalidator.com | sed -n '1,8p'
curl -sSIL https://www.gpuvalidator.com | sed -n '1,8p'
```

Expected: `www.gpuvalidator.com` redirects permanently to `https://gpuvalidator.com`.

## 4. Unauthenticated protection

```bash
curl -sS -o /tmp/gpuvalidator-unauth-api.json -w '%{http_code}\n' https://gpuvalidator.com/api/results?scenario=healthy
curl -sS -o /tmp/gpuvalidator-unauth-report.json -w '%{http_code}\n' https://gpuvalidator.com/reports/degraded/json
```

Expected: protected API/report routes return `401` without credentials.

## 5. Login and logout

Use a browser:

1. Open `https://gpuvalidator.com/login`.
2. Submit the configured reviewer email and password.
3. Confirm the reviewer portal loads.
4. Submit an invalid password in a private/incognito session and confirm login is rejected.
5. Log out and confirm protected routes require login again.

Do not record or share the password.

## 6. Protected API and reports

From the server only, use the local verification token if configured:

```bash
cd /opt/ai-factory-validator
sudo -E ./deploy/verify.sh
```

Expected: health, login, authenticated root, protected API routes, healthy report, degraded report, and read-only scenario execution checks pass.

## 7. Local service health

```bash
sudo -E /opt/ai-factory-validator/deploy/status.sh
curl -fsS http://127.0.0.1:3000/healthz
curl -fsS http://127.0.0.1:3000/login >/tmp/gpuvalidator-local-login.html
```

Expected: service active, local health/login return HTTP 200, Git branch/commit are reported correctly, auth variables show only `SET length=N` or `EMPTY`.

## 8. Caddy health

```bash
systemctl status caddy --no-pager
caddy validate --config /etc/caddy/Caddyfile
journalctl -u caddy -n 100 --no-pager
```

Expected: Caddy active and config valid. Logs should not show certificate issuance or proxy errors.

## 9. Application logs

```bash
systemctl status ai-factory-validator --no-pager
journalctl -u ai-factory-validator -n 150 --no-pager
```

Expected: app service active with no crash loop, auth, or artifact-read errors.

## 10. Rollback point

Record the deployed commit without changing state:

```bash
cd /opt/ai-factory-validator
git rev-parse HEAD
git log --oneline -5
```

If rollback is required:

```bash
sudo -E /opt/ai-factory-validator/deploy/rollback.sh <known-good-commit>
```

## 11. Secret safety

- Never commit `.env.production`.
- Never paste reviewer credentials, password hashes, session secrets, or bypass tokens into chat.
- `deploy/status.sh`, `deploy/preflight.sh`, and `deploy/verify.sh` must report only secret presence/length, never values.
- Treat `.env.production` as dotenv data, not shell script; keep `$`-containing values single-quoted.
