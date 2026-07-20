# RC1 production configuration

Use repo deployment scripts; do not commit real secrets.

Required non-secret locations can be configured with:

```bash
AI_VALIDATOR_USER_STORE=/opt/ai-factory-validator/shared/users/store.json
AI_VALIDATOR_ENGAGEMENT_STORE=/opt/ai-factory-validator/shared/engagements/store.json
AI_VALIDATOR_EVIDENCE_STORAGE_DIR=/opt/ai-factory-validator/shared/evidence
AI_VALIDATOR_BENCHMARK_STORAGE_DIR=/opt/ai-factory-validator/shared/benchmarks
AI_VALIDATOR_RUNNER_ONLINE_SECONDS=30
AI_VALIDATOR_RUNNER_OFFLINE_SECONDS=120
AI_VALIDATOR_TEMP_USER_MAX_HOURS=24
AI_VALIDATOR_UPLOAD_TOKEN_DEFAULT_SECONDS=7200
AI_VALIDATOR_UPLOAD_TOKEN_MAX_SECONDS=86400
AI_VALIDATOR_EVIDENCE_MAX_COMPRESSED_BYTES=52428800
AI_VALIDATOR_EVIDENCE_MAX_EXPANDED_BYTES=262144000
AI_VALIDATOR_NCCL_TESTS_DIR=/workspace/nccl-tests
```

Secret values such as `AI_FACTORY_SESSION_SECRET` belong only in the production env file or secret manager.

`AI_VALIDATOR_USER_STORE=/opt/ai-factory-validator/shared/users/store.json` is the canonical production user store. The Node service reads it through `.env.production`; the Python CLI also reads the same `.env.production` value when run from `/opt/ai-factory-validator`, so `ai-validator users bootstrap-admin --username sfrazier` writes to the same store the server uses for login.

Unauthenticated public UI is limited to `/login`. `/` and legacy public marketing paths redirect to `/login`; authenticated `/` and `/login` redirect to `/portal`.

Hetzner update:

```bash
cd /opt/ai-factory-validator
git fetch origin
git checkout hermes-mvp
git pull --ff-only origin hermes-mvp
sudo -E env AI_FACTORY_DRY_RUN=true AI_FACTORY_APP_DIR=/opt/ai-factory-validator AI_FACTORY_BRANCH=hermes-mvp AI_FACTORY_DOMAIN=gpuvalidator.com AI_FACTORY_ENABLE_CADDY=true AI_FACTORY_AUTH_REQUIRED=true ./deploy/update.sh
sudo -E env AI_FACTORY_APP_DIR=/opt/ai-factory-validator AI_FACTORY_BRANCH=hermes-mvp AI_FACTORY_DOMAIN=gpuvalidator.com AI_FACTORY_ENABLE_CADDY=true AI_FACTORY_AUTH_REQUIRED=true ./deploy/update.sh
sudo -E ./deploy/status.sh
sudo -E ./deploy/verify.sh
```

After deployment, confirm the administrator and store alignment without exposing secrets:

```bash
cd /opt/ai-factory-validator
sudo -u ai-validator -H bash -lc '. .venv/bin/activate && ai-validator users diagnose --username sfrazier'
```
