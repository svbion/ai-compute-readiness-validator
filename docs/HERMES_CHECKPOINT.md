# Hermes Deployment Checkpoint

- Branch: `hermes-mvp`
- Implementation commit: `b7c5cbd fix(deploy): harden dry-run ownership health checks and caddy setup`
- Checkpoint created during recovery after confirming the previous deployment hardening work was already committed and present at `HEAD`.

## Work completed

- Preserved the existing deployment hardening implementation; no reset, clean, or production installer run was performed.
- Confirmed zero-mutation dry run accepts `AI_FACTORY_DRY_RUN=true` plus truthy `1`, `true`, `yes`, and `on` values.
- Confirmed canonical `AI_FACTORY_*` deployment variables are preferred while legacy aliases remain supported.
- Confirmed shared deployment helpers live in `deploy/lib/common.sh`.
- Confirmed repository Git operations are routed through the application user helper.
- Confirmed dirty working tree protection is implemented for update paths.
- Confirmed systemd and backend HTTP readiness retry logic is implemented.
- Confirmed Caddy is optional, installed/configured only when enabled, and activated after backend health passes.
- Confirmed authentication validation reports only `SET`/`EMPTY` states and does not print secret values.
- Confirmed `deploy/preflight.sh`, `deploy/status.sh`, deployment shell tests, and Hetzner documentation exist.

## Files changed by implementation commit

- `README.md`
- `deploy/bootstrap.sh`
- `deploy/caddy/Caddyfile`
- `deploy/caddy/Caddyfile.template`
- `deploy/healthcheck.sh`
- `deploy/install.sh`
- `deploy/lib/common.sh`
- `deploy/preflight.sh`
- `deploy/rollback.sh`
- `deploy/status.sh`
- `deploy/update.sh`
- `deploy/verify.sh`
- `docs/HETZNER_DEPLOYMENT.md`
- `package.json`
- `tests-deploy/test-deployment-scripts.sh`

## Recovery changes

- Added this checkpoint file: `docs/HERMES_CHECKPOINT.md`.

## Tests and outcomes

- `bash -n deploy/*.sh deploy/lib/*.sh tests-deploy/*.sh`: passed.
- `npm run test:deploy`: passed.
- Zero-mutation dry-run fixture with temporary `AI_FACTORY_APP_DIR`: passed; app directory was not created and secret-like output was not printed.
- `npm run build`: passed.
- `npm run lint`: passed.
- `npm run test:portal`: passed, 14 tests.
- `pytest` using existing `.venv`: passed, 16 tests.

## Production safety notes

- Do not print, commit, or transmit `.env.production` values or authentication secrets.
- Existing `.env.production` is preserved by install/update paths.
- Use `AI_FACTORY_DRY_RUN=true` before any real server install or update.
- Do not expose port `3000` publicly after Caddy is verified; public access should be ports `80`/`443`.
- The deploy scripts reject dirty working trees by default; use `AI_FACTORY_ALLOW_DIRTY_UPDATE=true` only deliberately.
- Caddy should be enabled only after DNS points at the Hetzner server and backend health passes.

## Remaining server steps

- Create or access the Ubuntu 24.04 Hetzner server.
- Point `gpuvalidator.com` and `www.gpuvalidator.com` DNS records at the server.
- Configure Hetzner firewall and/or `ufw` for SSH, HTTP, and HTTPS.
- Run read-only preflight and zero-mutation dry run on the server.
- Run the real install or update only after dry run output is reviewed.
- Configure reviewer authentication values directly on the server without sharing them in chat or committing them.
- Run server status and verification scripts after deployment.

## Next exact commands

```bash
cd /opt/ai-factory-validator
git fetch origin
git checkout hermes-mvp
git pull --ff-only origin hermes-mvp
sudo -E env AI_FACTORY_DRY_RUN=true AI_FACTORY_APP_DIR=/opt/ai-factory-validator AI_FACTORY_BRANCH=hermes-mvp AI_FACTORY_DOMAIN=gpuvalidator.com AI_FACTORY_ENABLE_CADDY=true AI_FACTORY_AUTH_REQUIRED=true ./deploy/preflight.sh
sudo -E env AI_FACTORY_DRY_RUN=true AI_FACTORY_APP_DIR=/opt/ai-factory-validator AI_FACTORY_BRANCH=hermes-mvp AI_FACTORY_DOMAIN=gpuvalidator.com AI_FACTORY_ENABLE_CADDY=true AI_FACTORY_AUTH_REQUIRED=true ./deploy/update.sh
sudo -E env AI_FACTORY_APP_DIR=/opt/ai-factory-validator AI_FACTORY_BRANCH=hermes-mvp AI_FACTORY_DOMAIN=gpuvalidator.com AI_FACTORY_ENABLE_CADDY=true AI_FACTORY_AUTH_REQUIRED=true ./deploy/update.sh
sudo -E ./deploy/status.sh
sudo -E ./deploy/verify.sh
```
