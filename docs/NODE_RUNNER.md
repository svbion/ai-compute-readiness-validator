# Node runner

The node runner is an outbound HTTPS runner for controlled benchmark jobs. It is not a remote shell agent.

## Registration

An authenticated reviewer creates a node-scoped runner registration token in the portal/API. The plaintext token is shown once; GPU Validator persists only a hash. Copy the token to a secure file on the node.

```bash
ai-validator runner register \
  --url https://gpuvalidator.com \
  --node-id <node-id> \
  --token-file /secure/path/runner-token.txt \
  --credential-file /secure/path/runner-credential.json
```

HTTP is blocked by default. For local development only:

```bash
ai-validator runner register \
  --url http://127.0.0.1:3000 \
  --node-id <node-id> \
  --token-file /secure/path/runner-token.txt \
  --credential-file /secure/path/runner-credential.json \
  --allow-insecure-http
```

TLS verification is not disabled and no token CLI argument is supported.

## Commands

```bash
ai-validator runner capabilities
ai-validator runner status --credential-file /secure/path/runner-credential.json
ai-validator runner once --url https://gpuvalidator.com --credential-file /secure/path/runner-credential.json
ai-validator runner run --url https://gpuvalidator.com --credential-file /secure/path/runner-credential.json --poll-interval 10
```

## Safety model

The runner uses subprocess argv arrays, never `shell=True`. Executable paths come from allowlisted adapters, not from portal text. Environments are sanitized. Logs are bounded and redacted. Result bytes get SHA-256 checksums. Shutdown must not corrupt job state; jobs can be retried/fail explicitly through status APIs.

## NCCL adapter

The NCCL Tests adapter supports:

- `all_reduce_perf`
- `all_gather_perf`
- `reduce_scatter_perf`
- `broadcast_perf`

It detects/uses configured safe executables, including an approved `AI_VALIDATOR_NCCL_TESTS_DIR` root. It does not clone, compile, install, or download NCCL Tests automatically.

Generated argv example:

```bash
all_reduce_perf -b 8M -e 64M -f 2 -g 4 -w 5 -n 10
```

The adapter rejects arbitrary operations, shell fragments, file paths, unsupported env maps, and out-of-bounds values.

## Current limitation

The current milestone implements registration/status/capability scaffolding, safe NCCL argv generation, redaction/checksum primitives, and backend mocked runner lifecycle. Real Runpod runner registration and real NCCL job execution are the next milestone.
