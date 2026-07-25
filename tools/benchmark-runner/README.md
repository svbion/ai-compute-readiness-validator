# GPU Benchmark Publishing Toolkit

A modular toolkit for collecting NVIDIA GPU metadata, running the official
`nccl-tests` suite, generating Markdown and HTML reports, creating charts,
producing Mermaid topology diagrams, and packaging public-safe evidence.

## Recommended order

1. Rent one **2× B200** Pod.
2. Run the toolkit.
3. Download and verify the archive.
4. Terminate the Pod.
5. Rent one **2× H200** Pod and repeat.

Running one system at a time minimizes billing risk.

## Quick start

```bash
cd /workspace/gpu-benchmark-publishing-toolkit
chmod +x run.sh scripts/*.sh

PLATFORM_LABEL="runpod-b200-2gpu" \
GPU_COUNT=2 \
BEGIN_SIZE=8 \
END_SIZE=1G \
STEP_FACTOR=2 \
WARMUP_ITERS=5 \
ITERATIONS=20 \
TIMEOUT_SECONDS=900 \
./run.sh
```

For H200, change only the label:

```bash
PLATFORM_LABEL="runpod-h200-2gpu" GPU_COUNT=2 ./run.sh
```

## Optional GPUValidator agent hooks

```bash
AGENT_START_CMD='/workspace/agent/start.sh' \
AGENT_HEALTH_CMD='pgrep -af gpuvalidator-agent' \
AGENT_STOP_CMD='/workspace/agent/stop.sh' \
PLATFORM_LABEL="runpod-b200-2gpu" \
GPU_COUNT=2 \
./run.sh
```

Keep credentials in RunPod secrets. Do not embed tokens in scripts.

## Outputs

Each run creates:

```text
gpu-benchmark-runs/<run-id>/
├── metadata/
├── raw/
├── logs/
├── summary/
│   ├── benchmark-summary.csv
│   ├── benchmark-summary.json
│   ├── RESULTS.md
│   ├── INTERVIEW_NOTES.md
│   ├── RESUME_BULLETS.md
│   └── topology.mmd
├── charts/
│   ├── average-bus-bandwidth.png
│   ├── peak-bus-bandwidth.png
│   └── collective-duration.png
├── report/
│   └── results.html
├── SHA256SUMS
└── COMPLETION.md
```

## Comparison caveat

Disclose GPU count, topology, driver, CUDA, NCCL, `nccl-tests` commit, message
sizes, warmups, and iterations. A four-GPU A100 run is not directly equivalent
to a two-GPU H200 or B200 run.

## Local validation

```bash
bash -n run.sh scripts/*.sh
python3 -m py_compile scripts/*.py
python3 -m unittest discover -s tests -v
```
