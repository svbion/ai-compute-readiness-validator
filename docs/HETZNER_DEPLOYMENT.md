# Hetzner Ubuntu 24.04 deployment

This guide deploys GPU Validator to one Ubuntu 24.04 Hetzner Cloud server using Node.js, Python, systemd, and Caddy. It intentionally avoids Docker, Kubernetes, Terraform, Ansible, databases, or external cloud services.

GPU Validator is the public product brand. AI Factory remains a validation profile and infrastructure-readiness concept. The Git repository stays `ai-compute-readiness-validator`, the `ai-validator` CLI remains unchanged, and the installed service/path names remain `ai-factory-validator` for compatibility. The canonical public URL is `https://gpuvalidator.com`, with `https://www.gpuvalidator.com` redirecting permanently to the root domain.

## Production readiness audit

Repository findings from `package.json`, `server.ts`, `pyproject.toml`, and `README.md`:

- Application shape: Vite/React frontend plus an Express server bundled to `dist/server.cjs`.
- Production startup: `NODE_ENV=production node dist/server.cjs`.
- Runtime port: defaults to `3000`; production can override with `PORT`.
- Bind address: Express listens on `0.0.0.0`; production firewall/Caddy should expose only ports `80` and `443` publicly after validation.
- Frontend build output: `dist/index.html` and `dist/assets/*` from `npm run build`.
- Server artifact: `dist/server.cjs` from the same `npm run build` command.
- API routes:
  - `GET /api/results?scenario=healthy|degraded`
  - `POST /api/run-scenario`
  - `GET /reports/:scenario/:format` where format is `html`, `markdown`, or `json`.
- Python runtime: Python `>=3.10`; Ubuntu 24.04 provides Python 3.12.
- Python package install: `python3 -m venv .venv` then `pip install -e ".[dev]"`.
- CLI entry point: `.venv/bin/ai-validator` or `python -m ai_validator.cli`.
- Generated artifacts: `artifacts/latest-*`, `artifacts/healthy-*`, and `artifacts/degraded-*`.
- Production environment variables: `PORT`, `NODE_ENV`, `PYTHONUNBUFFERED`, and authentication settings. Production defaults to authentication-required; session secrets, reviewer credential hashes, and deployment verification tokens are generated or supplied on the server and must never be committed.
- Persistent writable paths under systemd: `artifacts/` for generated reports. The service also reads `.venv/` and `dist/` generated during install/update.

## Target layout

Default paths used by the deployment scripts:

```text
/opt/ai-factory-validator/          Application checkout
/opt/ai-factory-validator/.venv/    Python virtual environment
/opt/ai-factory-validator/dist/     Built frontend and server bundle
/opt/ai-factory-validator/artifacts Generated reports
/etc/systemd/system/ai-factory-validator.service
/etc/caddy/Caddyfile
```

Override defaults with the canonical `AI_FACTORY_*` environment variables when running scripts. Legacy aliases such as `APP_DIR`, `REPO_BRANCH`, `DOMAIN`, `ENABLE_CADDY`, `DRY_RUN`, `SERVICE_NAME`, and `APP_USER` remain supported, but `AI_FACTORY_*` is the public operator interface:

```bash
sudo -E env \
  AI_FACTORY_APP_DIR=/srv/ai-factory-validator \
  AI_FACTORY_APP_USER=ai-validator \
  AI_FACTORY_BRANCH=hermes-mvp \
  deploy/install.sh
```

## 1. Create the Hetzner server

Recommended baseline:

- Ubuntu 24.04 LTS
- x86_64 instance
- 2 vCPU / 4 GB RAM or larger
- Public IPv4 enabled
- SSH key authentication enabled
- Backups/snapshots enabled if this is a long-lived demo endpoint

## 2. Install SSH key and connect

Add your SSH public key in the Hetzner Cloud console when creating the server, then connect:

```bash
ssh root@SERVER_IPV4
```

Update the base system:

```bash
apt-get update
apt-get upgrade -y
reboot
```

Reconnect after reboot.

## 3. Clone the repository

The install script can clone the repository itself. If you want to inspect scripts first:

```bash
apt-get update
apt-get install -y git
mkdir -p /opt
cd /opt
git clone --branch hermes-mvp https://github.com/svbion/ai-compute-readiness-validator.git ai-factory-validator
cd /opt/ai-factory-validator
```

## 4. Run preflight and install.sh

Run a read-only preflight first. Preflight reports warnings separately from blocking errors and never mutates the host:

```bash
cd /opt/ai-factory-validator
sudo -E env \
  AI_FACTORY_DRY_RUN=true \
  AI_FACTORY_APP_DIR=/opt/ai-factory-validator \
  AI_FACTORY_BRANCH=hermes-mvp \
  AI_FACTORY_DOMAIN=gpuvalidator.com \
  AI_FACTORY_ENABLE_CADDY=true \
  AI_FACTORY_AUTH_REQUIRED=true \
  ./deploy/preflight.sh
```

Run a true zero-mutation dry run. Dry run validates inputs, prints effective configuration, prints every planned operation, masks secrets, and does not run `apt`, create users, touch Git, write files, build, restart services, or configure Caddy:

```bash
sudo -E env \
  AI_FACTORY_DRY_RUN=true \
  AI_FACTORY_APP_DIR=/opt/ai-factory-validator \
  AI_FACTORY_BRANCH=hermes-mvp \
  AI_FACTORY_DOMAIN=gpuvalidator.com \
  AI_FACTORY_ENABLE_CADDY=true \
  AI_FACTORY_AUTH_REQUIRED=true \
  ./deploy/install.sh
```

When preflight and dry run look correct, run the real install:

```bash
sudo -E env \
  AI_FACTORY_APP_DIR=/opt/ai-factory-validator \
  AI_FACTORY_BRANCH=hermes-mvp \
  AI_FACTORY_DOMAIN=gpuvalidator.com \
  AI_FACTORY_ENABLE_CADDY=true \
  AI_FACTORY_AUTH_REQUIRED=true \
  ./deploy/install.sh
```

The installer is safe to rerun. It preserves existing `.env.production`, never replaces existing authentication secrets, rejects dirty Git working trees before update, runs repository Git operations as the application user, waits for systemd and HTTP readiness with retries, and activates Caddy only after backend health passes.

### Minimal install without Caddy

From a checked-out repository:

```bash
cd /opt/ai-factory-validator
sudo deploy/install.sh
```

Or from any location, let the script clone/update the repository:

```bash
curl -fsSL https://raw.githubusercontent.com/svbion/ai-compute-readiness-validator/hermes-mvp/deploy/install.sh -o /tmp/install-ai-factory-validator.sh
chmod +x /tmp/install-ai-factory-validator.sh
sudo /tmp/install-ai-factory-validator.sh
```

The real install script performs, in order:

- `apt-get update`
- installs `git`, `curl`, `python3`, `python3-venv`, `python3-pip`, `build-essential`, and Node.js 22
- clones or updates the repository
- runs `npm ci`
- runs `npm run build`
- creates `.venv`
- runs `pip install -e ".[dev]"`
- generates healthy and degraded artifacts
- installs and starts the systemd service
- waits for systemd and HTTP readiness with retry logic
- installs/configures Caddy only when `AI_FACTORY_ENABLE_CADDY=true`
- prints a secret-safe deployment summary

The first install creates `.env.production` from `.env.production.example`, generates a local session secret, and generates a local deployment verification token without printing either secret. Replace the placeholder reviewer email and password hash out-of-band before sharing the portal.

Generate a reviewer password hash on the server without storing the plaintext password in the repository:

```bash
cd /opt/ai-factory-validator
node --import tsx -e "import { createPasswordHash } from './src/server/auth.ts'; console.log(createPasswordHash(process.argv[1]))" 'temporary-password-to-rotate'
```

Then edit `/opt/ai-factory-validator/.env.production` and set the real reviewer email, the generated `scrypt$...` hash, a server-generated session secret, and a local-only `AI_FACTORY_AUTH_TEST_BYPASS_TOKEN` for deployment verification. Do not commit these values and do not send them over chat.

## 5. Verify the service

```bash
systemctl status ai-factory-validator --no-pager
journalctl -u ai-factory-validator -n 100 --no-pager
/opt/ai-factory-validator/deploy/healthcheck.sh
/opt/ai-factory-validator/deploy/verify.sh
npm run verify:production
```

Manual curl checks:

```bash
curl -fsS http://127.0.0.1:3000/healthz
curl -fsS http://127.0.0.1:3000/login
curl -fsS -H "x-ai-factory-test-auth: $AI_FACTORY_AUTH_TEST_BYPASS_TOKEN" \
  http://127.0.0.1:3000/api/results?scenario=healthy
curl -fsS -H "x-ai-factory-test-auth: $AI_FACTORY_AUTH_TEST_BYPASS_TOKEN" \
  http://127.0.0.1:3000/api/evidence-sources
curl -sS -o /tmp/run-scenario-readonly.json -w '%{http_code}\n' \
  -H "x-ai-factory-test-auth: $AI_FACTORY_AUTH_TEST_BYPASS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"scenario":"degraded"}' \
  http://127.0.0.1:3000/api/run-scenario
curl -fsS -H "x-ai-factory-test-auth: $AI_FACTORY_AUTH_TEST_BYPASS_TOKEN" \
  http://127.0.0.1:3000/reports/degraded/html
curl -fsS -H "x-ai-factory-test-auth: $AI_FACTORY_AUTH_TEST_BYPASS_TOKEN" \
  http://127.0.0.1:3000/reports/degraded/markdown
curl -fsS -H "x-ai-factory-test-auth: $AI_FACTORY_AUTH_TEST_BYPASS_TOKEN" \
  http://127.0.0.1:3000/reports/degraded/json
```

The `run-scenario` check should return HTTP `405`; the public reviewer portal is read-only. Generate scenario artifacts and import live evidence only through administrator-side CLI workflows.

## 6. Configure DNS

Create DNS records pointing your hostname to the Hetzner server:

```text
A      gpuvalidator.com        SERVER_IPV4
AAAA   gpuvalidator.com        SERVER_IPV6  # optional, only if IPv6 is enabled
A      www.gpuvalidator.com    SERVER_IPV4
AAAA   www.gpuvalidator.com    SERVER_IPV6  # optional, only if IPv6 is enabled
```

Wait for DNS propagation before enabling Caddy HTTPS. Confirm from your workstation:

```bash
dig +short gpuvalidator.com
```

## 7. Enable HTTPS with Caddy

The installer configures Caddy only when `AI_FACTORY_ENABLE_CADDY=true`. If disabled, no Caddy packages or files are changed. When enabled, the installer validates `AI_FACTORY_DOMAIN`, warns if DNS is not resolving, installs Caddy from the official Ubuntu repository when missing, renders a Caddyfile for the configured domain and app port, backs up an existing `/etc/caddy/Caddyfile`, validates the new config, and enables/reloads Caddy after backend health has passed.

Manual Caddy setup remains possible if you intentionally installed the backend first without Caddy. Install Caddy on Ubuntu 24.04:

```bash
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  > /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y caddy
```

Render or install this repository's Caddyfile after setting the same domain and port you use for the application:

```bash
AI_FACTORY_DOMAIN=gpuvalidator.com PORT=3000 bash -c '
  source /opt/ai-factory-validator/deploy/lib/common.sh
  load_deploy_config
  render_caddy_config /tmp/gpu-validator.Caddyfile "$DOMAIN" "$PORT"
'
cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak.$(date +%Y%m%d%H%M%S) 2>/dev/null || true
cp /tmp/gpu-validator.Caddyfile /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
systemctl status caddy --no-pager
```

The default example domain is `gpuvalidator.com`, and `www.gpuvalidator.com` redirects permanently to `https://gpuvalidator.com`. Caddy automatically requests and renews HTTPS certificates when ports `80` and `443` are reachable and DNS is correct. Do not expose port `3000` publicly; Caddy should proxy to `127.0.0.1:3000`.

If Git reports dubious ownership after an install, do not disable Git protections globally. The deploy scripts run repository Git commands as `AI_FACTORY_APP_USER`. To repair a manual root shell, either run update through `sudo -E ./deploy/update.sh` or add only the exact repository path for that root shell:

```bash
git config --global --add safe.directory /opt/ai-factory-validator
```

## 8. Hetzner firewall recommendations

Recommended inbound firewall rules:

```text
TCP 22    Your trusted admin IPs only
TCP 80    0.0.0.0/0 and ::/0
TCP 443   0.0.0.0/0 and ::/0
TCP 3000  Temporarily from your admin IP only during direct testing; remove after Caddy is verified
```

Recommended server-side `ufw` equivalent:

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
# Optional temporary direct testing only:
# ufw allow from YOUR_PUBLIC_IP to any port 3000 proto tcp
ufw enable
ufw status verbose
```

After Caddy is working, do not expose `3000` publicly.

## 9. Update the application

```bash
cd /opt/ai-factory-validator
sudo -E env AI_FACTORY_DRY_RUN=true AI_FACTORY_APP_DIR=/opt/ai-factory-validator AI_FACTORY_BRANCH=hermes-mvp deploy/update.sh
sudo -E env AI_FACTORY_APP_DIR=/opt/ai-factory-validator AI_FACTORY_BRANCH=hermes-mvp deploy/update.sh
```

The update script rejects dirty working trees unless `AI_FACTORY_ALLOW_DIRTY_UPDATE=true` is set deliberately, fast-forwards the configured branch as `AI_FACTORY_APP_USER`, preserves `.env.production`, installs dependencies, builds, regenerates artifacts, runs pytest, runs TypeScript lint, runs portal and deployment tests, restarts systemd, waits for readiness, optionally updates Caddy, and runs `verify.sh`.

## 10. Roll back

List available tags and commits:

```bash
cd /opt/ai-factory-validator
git tag --sort=-creatordate | head
git log --oneline --decorate -n 20
```

Roll back to a tag or commit:

```bash
sudo -E /opt/ai-factory-validator/deploy/rollback.sh v0.1.0-interview
# or
sudo -E /opt/ai-factory-validator/deploy/rollback.sh <commit-sha>
sudo -E env AI_FACTORY_DRY_RUN=true /opt/ai-factory-validator/deploy/rollback.sh <commit-sha>
```

Rollback checks out the target commit detached, reconciles dependencies, rebuilds, regenerates artifacts, restarts the service, and runs verification.

To return to the deployment branch later:

```bash
cd /opt/ai-factory-validator
sudo -E env AI_FACTORY_BRANCH=hermes-mvp deploy/update.sh
```

## 11. Troubleshooting

Service will not start:

```bash
cd /opt/ai-factory-validator
sudo -E ./deploy/status.sh
systemctl status ai-factory-validator --no-pager
journalctl -u ai-factory-validator -n 200 --no-pager
```

Port already in use:

```bash
ss -ltnp | grep ':3000'
```

Missing Node.js or wrong version:

```bash
node --version
npm --version
sudo -E ./deploy/preflight.sh
sudo -E ./deploy/install.sh
```

Python CLI unavailable from portal:

```bash
cd /opt/ai-factory-validator
sudo -u ai-validator bash -lc 'source .venv/bin/activate && ai-validator version'
sudo -u ai-validator bash -lc 'source .venv/bin/activate && ai-validator demo --scenario degraded --output-dir artifacts'
```

Caddy certificate problems:

```bash
journalctl -u caddy -n 200 --no-pager
dig +short gpuvalidator.com
curl -I http://gpuvalidator.com
```

Validation route failures:

```bash
/opt/ai-factory-validator/deploy/verify.sh
ls -lah /opt/ai-factory-validator/artifacts
```

## Remaining manual server steps

These cannot be completed by repository automation alone:

- Create the Hetzner server and attach an SSH key.
- Point DNS to the server.
- Choose the production hostname and set `AI_FACTORY_DOMAIN` for Caddy.
- Configure the Hetzner firewall and/or `ufw` for your admin IPs.
- Provide SSH access to the deployment engineer if you want remote installation performed from a workstation.
