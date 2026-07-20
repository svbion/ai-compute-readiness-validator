# Benchmark intelligence

GPU Validator imports benchmark output files that already exist. It does not perform remote execution, SSH, package installation, benchmark launch, GPU stress testing, or MLPerf compliance certification.

## Architecture

```text
Collector
  -> Evidence Bundle
  -> Benchmark Bundle / benchmark output file
  -> Import / Upload
  -> Parser
  -> Findings
  -> Readiness
  -> Acceptance
```

Benchmark files are stored separately from infrastructure evidence under `artifacts/benchmarks/` by default. The file-backed engagement store persists versioned `BenchmarkRun` records next to engagements, nodes, upload tokens, and evidence records.

## BenchmarkRun model

Each imported run uses `schema_version: "1.0.0"` and records:

- `id`
- `engagement_id`
- `node_id` (nullable)
- `benchmark_type`: `nccl`, `hpl`, `triton_perf_analyzer`, `genai_perf`
- `benchmark_version`
- `tool_version`
- `collected_at`
- `uploaded_at`
- `status`: `imported`, `parsed`, `accepted`, `rejected`, `superseded`
- `simulated`
- `input_file`
- `sha256`
- `warnings`
- `metrics`
- `raw_storage_id`
- `provenance`

Provenance links metric values back to the source file, parser version, source line numbers, parser type, and simulated flag. The API does not expose raw filesystem paths.

## Supported formats and metrics

### NCCL Tests

Supported NCCL command output includes:

- `all_reduce_perf`
- `all_gather_perf`
- `reduce_scatter_perf`
- `broadcast_perf`

Initial metrics:

- message size
- algorithm bandwidth
- bus bandwidth
- average bus bandwidth
- average algorithm bandwidth
- time
- errors / wrong result count
- GPU count
- node count
- CUDA version when available
- NCCL version when available
- transport when available

The parser strips ANSI colors, ignores comments, banners, and non-table `INFO` output, and tolerates whitespace variations.

### NVIDIA HPL

Supported inputs are NVIDIA HPL/HPL.dat style text outputs containing standard result rows. Initial metrics:

- problem size
- block size
- `P`
- `Q`
- runtime
- performance GFLOPS
- performance TFLOPS
- residual pass/fail
- GPU count when available
- node count when available

The parser records explicit `PASSED`/`FAILED` residual state when present.

### Triton Performance Analyzer and GenAI-Perf

Supported inputs include `perf_analyzer` CSV-like output and text summaries from GenAI-Perf. Initial metrics are optional and parsed when present:

- throughput
- average latency
- p95
- p99
- queue time
- compute time
- requests
- tokens per second
- time to first token
- inter-token latency

## Upload API

Node-scoped benchmark uploads use the existing upload token model:

```http
POST /api/v1/benchmarks/upload?type=nccl&filename=all_reduce.txt&simulated=true
Authorization: Bearer <upload-token>
Content-Type: text/plain
```

Supported type aliases:

- `nccl`
- `hpl`
- `triton` / `triton_perf_analyzer`
- `genai` / `genai_perf`

Reviewer/admin listing:

```http
GET /api/v1/engagements/{engagement_id}/benchmarks
```

The response includes benchmark runs and benchmark findings.

## CLI importer

Local import writes a versioned JSON record under `artifacts/benchmark-imports/` by default:

```bash
ai-validator benchmark import --type nccl --input all_reduce.txt
ai-validator benchmark import --type hpl --input hpl.txt
ai-validator benchmark import --type triton --input perf.csv
ai-validator benchmark import --type genai-perf --input genai.txt
```

Optional attachment metadata:

```bash
ai-validator benchmark import \
  --type nccl \
  --input all_reduce.txt \
  --engagement-id eng_demo \
  --node-id node01 \
  --simulated
```

The CLI only imports files; it never runs benchmark executables.

## Findings

Benchmark findings are generated from imported runs and configurable thresholds:

- NCCL bandwidth below threshold
- NCCL wrong results/errors
- HPL residual failed
- HPL performance below threshold
- inference latency exceeds threshold
- missing benchmark evidence
- outdated benchmark evidence
- simulated benchmark evidence

GPU Validator does not invent performance thresholds. Threshold findings are emitted only when the operator configures thresholds with environment variables:

- `AI_VALIDATOR_NCCL_MIN_AVERAGE_BUS_BANDWIDTH`
- `AI_VALIDATOR_NCCL_MIN_BUS_BANDWIDTH`
- `AI_VALIDATOR_HPL_MIN_TFLOPS`
- `AI_VALIDATOR_INFERENCE_MAX_AVERAGE_LATENCY`
- `AI_VALIDATOR_INFERENCE_MAX_P95`
- `AI_VALIDATOR_INFERENCE_MAX_P99`
- `AI_VALIDATOR_BENCHMARK_MAX_AGE_DAYS`

Correctness findings such as HPL residual failure or NCCL wrong results do not require performance thresholds.

## Readiness and acceptance

Readiness now exposes categories for infrastructure, GPU, fabric, storage, and benchmarks. Benchmarks contribute up to 20 points when benchmark evidence is present. If benchmark evidence is absent, the benchmark section is shown as `Not Evaluated` and does not automatically fail the engagement.

Blocking benchmark findings can affect acceptance when imported evidence fails correctness or configured thresholds.

## Portal

The engagement portal benchmark card now shows:

- NCCL: status, bandwidth, transport, GPUs, nodes, evidence provenance
- HPL: status, TFLOPS, residual, evidence provenance
- Inference: status, throughput, latency, evidence provenance

## Demo fixtures

Simulated fixtures live in `sample-data/benchmarks/`:

- healthy NCCL
- driver-mismatch NCCL
- healthy HPL
- failed HPL residual
- healthy Triton
- high-latency Triton
- healthy GenAI-Perf

All are marked `simulated=true` and are demonstration-only.

## Current limitations

- File-backed persistence remains the current store.
- No benchmark execution or scheduling is implemented.
- No SSH or remote orchestration is implemented.
- No official MLPerf compliance claim is made.
- Parser coverage is conservative and should be expanded with customer-approved real benchmark artifacts.
