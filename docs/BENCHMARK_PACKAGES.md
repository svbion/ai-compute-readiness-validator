# Benchmark Packages and NVLink Workflows

GPUValidator can ingest GPU Benchmark Lab package specification v0.1 directories or public tar.gz archives.

Examples:

```bash
gpu-validator benchmark ingest --input /path/to/benchmark-package --output-dir artifacts/benchmark-ingest
gpu-validator benchmark validate --input /path/to/benchmark-package --output-dir artifacts/benchmark-validate
gpu-validator benchmark summarize --input /path/to/benchmark-package --output-dir artifacts/benchmark-summary
gpu-validator benchmark compare --input /path/to/run-a --file /path/to/run-b --output-dir artifacts/benchmark-compare
```

The ingestion path validates checksums, parses NCCL outputs, topology, P2P matrices, NVLink status, NCCL topology XML/debug logs, and generates a GPU fabric validation report. It distinguishes NVLink-capable hardware from peer-visible NVLink connectivity.

The benchmark runner supports safe planning and execution flags including `--gpu auto`, `--full-suite`, `--output`, `--nccl-tests-path`, `--platform`, `--dry-run`, `--collect-only`, `--benchmark-only`, `--skip-telemetry`, `--skip-archive`, `--public-package`, `--sanitize`, `--lesson-output`, `--message-min`, `--message-max`, `--iterations`, and `--warmups`.

Do not redistribute compiled NCCL Tests binaries or NVIDIA proprietary binaries. Keep raw/private archives out of public repositories; publish only sanitized package contents.
