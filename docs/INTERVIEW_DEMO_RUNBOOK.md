# Interview demo runbook

## Recommended RC1 order

1. Open `https://gpuvalidator.com`; unauthenticated visitors should land on `/login`.
2. Log in as administrator.
3. Open `/portal/admin/users`.
4. Create an NVIDIA interviewer account and copy the one-time credentials.
5. Log out.
6. Log in with the temporary reviewer username and password, then confirm reviewer-only access.
7. Open `/portal/engagements` and load the NVIS simulated fixture.
8. Open the demo engagement and point out the `SIMULATED DEMO` and `DEMONSTRATION ONLY` labels.
9. Review acceptance, findings, readiness, evidence, benchmarks, and provenance.
10. Open `/portal/admin/demo` as administrator for the guided RC1 workspace.
11. Open `/portal/library`, `/portal/library/slurm`, `/portal/library/lustre`, `/portal/library/base-command-manager`, and `/portal/library/benchmarks`.
12. If a Runpod node is available, register the outbound runner and show live telemetry. Otherwise state clearly that live Runpod was not executed.
13. Submit a mocked NCCL smoke job for local E2E. Submit a real job only on an approved Runpod node.
14. Log out and verify browser back/direct portal URL requires login.

## Local demo commands

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
npm install
npm run build
npm run dev
```

Bootstrap local administrator:

```bash
printf '%s\n' '<strong password>' > /tmp/gpu-validator-admin-password.txt
chmod 600 /tmp/gpu-validator-admin-password.txt
AI_VALIDATOR_USER_STORE=artifacts/users/store.json \
  ai-validator users bootstrap-admin \
  --username admin \
  --display-name "GPU Validator Admin" \
  --password-file /tmp/gpu-validator-admin-password.txt
```

The sign-in page uses Username and Password only. Temporary reviewer credentials should be read back as Login URL, Username, Temporary Password, Role, and Expiration; do not display or request an email address for interview login.

## Production administrator check

Production uses the persistent store at `/opt/ai-factory-validator/shared/users/store.json`; do not use `artifacts/users/store.json` for the live service. Before an interview, run:

```bash
cd /opt/ai-factory-validator
. .venv/bin/activate
ai-validator users diagnose --username sfrazier
```

Confirm `active_user_store_path` is `/opt/ai-factory-validator/shared/users/store.json`, `user_exists` is true, `role` is `administrator`, `status` is `active`, and both `expired` and `locked` are false. The diagnostic output is safe to share because it does not print password hashes or secrets.

## Data labeling

Always distinguish:

- REAL HARDWARE DATA: real accepted evidence, live runner heartbeat, or real benchmark output uploaded from the runner.
- SIMULATED DEMONSTRATION DATA: sample data, NVIS fixture, generated demo evidence, and redacted parser regression fixtures.

Do not claim the redacted NCCL fixture is a live Runpod run.
