# Hetzner Ubuntu 24.04 deployment

This guide deploys the AI Factory Validation Portal to one Ubuntu 24.04 Hetzner Cloud server using Node.js, Python, systemd, and Caddy. It intentionally avoids Docker, Kubernetes, Terraform, Ansible, databases, or external cloud services.

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

Override defaults with environment variables when running scripts:

```bash
sudo APP_DIR=/srv/ai-factory-validator \
  APP_USER=ai-validator \
  REPO_BRANCH=hermes-mvp \
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

## 4. Run install.sh

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

The script performs:

- `apt-get update`
- installs `git`, `curl`, `python3`, `python3-venv`, `python3-pip`, `build-essential`, and Node.js 22
- clones or updates the repository
- runs `npm ci`
- runs `npm run build`
- creates `.venv`
- runs `pip install -e ".[dev]"`
- generates healthy and degraded artifacts
- installs and starts the systemd service
- runs the deployment healthcheck

For a no-change preview on a prepared checkout, run:

```bash
sudo DRY_RUN=1 deploy/install.sh
```

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

## 6. Configure DNS

Create DNS records pointing your hostname to the Hetzner server:

```text
A     validator.example.com    SERVER_IPV4
AAAA  validator.example.com    SERVER_IPV6  # optional, only if IPv6 is enabled
```

Wait for DNS propagation before enabling Caddy HTTPS. Confirm from your workstation:

```bash
dig +short validator.example.com
```

## 7. Enable HTTPS with Caddy

Install Caddy on Ubuntu 24.04:

```bash
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  > /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y caddy
```

Install this repository's Caddyfile:

```bash
cp /opt/ai-factory-validator/deploy/caddy/Caddyfile /etc/caddy/Caddyfile
mkdir -p /etc/systemd/system/caddy.service.d
cat >/etc/systemd/system/caddy.service.d/override.conf <<'EOF'
[Service]
Environment=AI_FACTORY_DOMAIN=validator.example.com
EOF
systemctl daemon-reload
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
systemctl status caddy --no-pager
```

Caddy automatically requests and renews HTTPS certificates when ports `80` and `443` are reachable and DNS is correct.

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
sudo deploy/update.sh
sudo DRY_RUN=1 deploy/update.sh
```

The update script fast-forwards the configured branch, installs dependencies, builds, regenerates artifacts, runs pytest, runs TypeScript lint, runs portal tests, restarts systemd, and runs `verify.sh`.

## 10. Roll back

List available tags and commits:

```bash
cd /opt/ai-factory-validator
git tag --sort=-creatordate | head
git log --oneline --decorate -n 20
```

Roll back to a tag or commit:

```bash
sudo /opt/ai-factory-validator/deploy/rollback.sh v0.1.0-interview
# or
sudo /opt/ai-factory-validator/deploy/rollback.sh <commit-sha>
sudo DRY_RUN=1 /opt/ai-factory-validator/deploy/rollback.sh <commit-sha>
```

Rollback checks out the target commit detached, reconciles dependencies, rebuilds, regenerates artifacts, restarts the service, and runs verification.

To return to the deployment branch later:

```bash
cd /opt/ai-factory-validator
sudo git checkout hermes-mvp
sudo git pull --ff-only origin hermes-mvp
sudo deploy/update.sh
```

## 11. Troubleshooting

Service will not start:

```bash
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
sudo deploy/install.sh
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
dig +short validator.example.com
curl -I http://validator.example.com
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
