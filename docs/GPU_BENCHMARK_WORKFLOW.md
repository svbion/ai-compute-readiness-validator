# GPU Benchmark Workflow

This document covers the benchmark-only GPU package and NCCL workflow. It intentionally excludes portal, Academy, product, and engagement artifacts.

## Benchmark package ingestion

Use a public or locally sanitized GPU benchmark package directory:

```bash
gpu-validator benchmark ingest \
  --input /path/to/gpu-benchmark-package \
  --output-dir artifacts/benchmark-package
```

The package reader verifies SHA256 entries when `SHA256SUMS` is present, parses NCCL outputs, topology matrices, P2P matrices, NVLink status, and NCCL topology XML, then writes benchmark summaries and a Markdown report to the output directory.

## Validation, summarization, and comparison

The `benchmark` command accepts these package-oriented actions:

```bash
gpu-validator benchmark validate --input /path/to/gpu-benchmark-package --output-dir artifacts/validate
gpu-validator benchmark summarize --input /path/to/gpu-benchmark-package --output-dir artifacts/summary
gpu-validator benchmark compare --input /path/to/package-a --file /path/to/package-b --output-dir artifacts/compare
```

`validate` and `summarize` use the same safe package reader as `ingest`; they do not run live benchmarks. `compare` writes a JSON comparison of two package summaries.

## Generic GPU workflow

The shell entry point runs the generic workflow without requiring a product-specific GPU profile:

```bash
tools/run-gpu-benchmark.sh \
  --gpu auto \
  --platform runpod \
  --output /path/to/output \
  --full-suite \
  --message-min 8M \
  --message-max 1G \
  --iterations 20 \
  --warmups 5
```

Use `--dry-run` to write a command plan without launching benchmarks or collecting evidence.

## `--gpu auto` and explicit overrides

`--gpu auto` inspects `nvidia-smi -L`, records the detected model and visible GPU count, and accepts future NVIDIA GPU names without requiring a code change. Explicit overrides remain supported for compatibility:

- `--gpu h200`
- `--gpu h100`
- `--gpu b200`
- `--gpu b300`
- `--gpu a100`

An explicit override is recorded in the summary so reviewers can distinguish declared intent from detected hardware.

## NCCL full-suite execution

With `--full-suite`, the runner attempts the standard NCCL collective binaries:

- `all_reduce_perf`
- `all_gather_perf`
- `reduce_scatter_perf`
- `broadcast_perf`
- `reduce_perf`
- `gather_perf`
- `scatter_perf`
- `alltoall_perf`
- `alltoallv_perf`
- `sendrecv_perf`

Missing binaries are recorded as `NOT AVAILABLE`; failed collectives are recorded as `FAIL`; successful collectives are parsed for algorithmic bandwidth, bus bandwidth, validation errors, and warnings.

## Topology, P2P, and NVLink evidence

The package parser distinguishes three evidence types:

1. NVIDIA topology matrix (`nvidia-smi topo -m`) for peer path labels such as `NV18`, `PIX`, `PXB`, `PHB`, `NODE`, or `SYS`.
2. P2P matrices for peer connectivity and operations such as read, write, atomics, and NVLink P2P status.
3. Physical NVLink status for active link counts and per-link rates.

Physical NVLink activity is not the same as full peer connectivity. H200 NVL systems can show active physical NVLink links while peer-to-peer matrices still report `NS`/not-supported paths. The fabric analysis reports these dimensions separately.

## Raw/private and public/sanitized packages

Raw lab packages must not be committed or published. Public examples and fixtures must be sanitized first:

- GPU UUIDs become `GPU-REDACTED`.
- Hostnames become `HOST-REDACTED` or deterministic placeholder host IDs.
- IP addresses become `IP-REDACTED` or deterministic placeholder IP IDs.
- Secret assignments use unmistakably fake values such as `API_KEY=REDACTED_TEST_VALUE`.
- Local paths use generic examples such as `/path/to/gpu-benchmark-package`.

Raw archive references in documentation should describe policy only; do not point to a committed private archive or host-specific path.

## Current limitations

- Package ingestion is filesystem-oriented and expects already collected artifacts.
- `validate` and `summarize` currently share the same parser/reporting path as `ingest`.
- Live NCCL execution requires the user-provided `nccl-tests` build path or binaries available in the expected environment.
- The workflow is read-only for system evidence collection but it does write output artifacts under the requested output directory.
- Fixture tests use compact sanitized evidence and do not represent a complete private lab archive.
