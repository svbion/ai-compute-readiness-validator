# AI Compute Readiness Validator 🚀

An automated Linux, NVIDIA GPU, InfiniBand, Slurm, Kubernetes, storage, and benchmark validation and reporting tool designed for high-performance AI compute infrastructure. Built specifically as a polished, interview-ready MVP showcasing production-grade diagnostic engineering.

---

## 📖 Project Overview

High-performance AI compute clusters (e.g., NVIDIA DGX H100 SuperPODs) are incredibly complex systems. Before launching training runs (which can cost millions of dollars), engineers must validate that every node, network rail, storage volume, and scheduler queue is fully operational.

The **AI Compute Readiness Validator** provides a zero-sudo, secure, read-only diagnostic framework that collects system state variables, evaluates readiness scores using a weighted-contribution mathematical engine, and exports beautiful HTML, Markdown, and JSON reports.

### Key Features
*   **Zero-Mutation Execution**: All command checks represent secure, read-only queries. No root modifications or privileged mutations are executed.
*   **Degraded Mode Demonstrator**: Run full multi-node diagnostic evaluations on macOS or platforms without NVIDIA hardware using realistic mock profiles.
*   **Transparent Scoring Model**: Aggregates subsystem results and proportionally redistributes weights when checks or entire categories are unavailable (e.g., in a non-Kubernetes or non-Slurm environment).
*   **Command Evidence Logs**: Every check captures and archives the underlying command executed, the exit code, duration, and raw `stdout`/`stderr`.
*   **Historical Benchmark Ingestion**: Standard parser support for ingestible logs from NCCL Tests, HPL Linpack, fio block storage, iperf3, and OSU MPI.
*   **Polished Web Dashboard**: An interactive, full-stack companion dashboard (Express + React) that displays real-time execution terminals and nested detail grids.

---

## 🛠️ Repository Structure

```bash
├── pyproject.toml              # Python packaging, metadata, and dependencies
├── server.ts                   # Express.js backend serving APIs & Vite middleware
├── src/
│   ├── App.tsx                 # Interactive React dashboard frontend
│   └── ai_validator/           # Core Python source package
│       ├── cli.py              # CLI entry point using Typer and Rich
│       ├── models.py           # Structured Pydantic schemas (Cluster, Node, Check)
│       ├── scoring.py          # Weight redistribution and threshold logic
│       ├── runner.py           # Safe command executor with sanitization
│       ├── collectors/         # Subsystem state collectors
│       │   ├── linux.py        # CPU, swaps, huge pages, and dmesg log buffers
│       │   ├── gpu.py          # NVIDIA SMI, driver, CUDA, & NVLink topology
│       │   ├── dcgm.py         # DCGM diagnostic checks & monitoring engines
│       │   ├── infiniband.py   # Mellanox port states, rates, and widths
│       │   ├── slurm.py        # Slurm queue status, controller pings, & node states
│       │   ├── kubernetes.py   # Kubectl node states & GPU Operator status
│       │   ├── storage.py      # Local disk space, NVMe inventories, and Lustre clients
│       │   └── network.py      # IP routings, interface links, and packet drops
│       ├── benchmarks/         # Benchmark log extraction parsers
│       │   ├── nccl.py         # NCCL peak bus bandwidth
│       │   ├── hpl.py          # Linpack GFLOPS and TFLOPS
│       │   └── fio.py          # FIO read/write IOPS and MB/s
│       ├── demo/               # Pre-defined mock profiles
│       │   ├── scenarios.py    # Healthy and Degraded cluster data builders
│       │   └── generator.py    # Mock orchestrator and scoring hook
│       └── reporting/          # Document generators
│           ├── json_report.py  # JSON model serializer
│           ├── markdown.py     # Clean Markdown progress log
│           └── html.py         # Standalone HTML reporter with Jinja2 templates
└── tests/
    └── test_validation.py      # Pytest suite covering runner, scoring, & scenarios
```

---

## 🚀 Quick Start Instructions

### 1. Python Environment Setup
Install the `ai-validator` CLI package in editable mode:
```bash
# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install package with development dependencies
pip install -e ".[dev]"
```

### 2. Command Line Interface (CLI) Usage

The `ai-validator` command-line utility is globally exposed after package installation.

#### Run Live Host Validation
Executes safe system commands on your current machine to evaluate local readiness:
```bash
ai-validator validate --name my-local-cluster --output-dir artifacts/
```

#### Run Predefined Cluster Demonstrations
Simulate multi-node performance profiles. (Essential for showcasing scoring mechanics on macOS or non-NVIDIA systems):
```bash
# Simulate a 100% healthy enterprise cluster
ai-validator demo --scenario healthy --output-dir artifacts/

# Simulate a degraded cluster with specific hardware, Slurm, and IB faults
ai-validator demo --scenario degraded --output-dir artifacts/
```

#### Parse and Ingest Benchmark Logs
Extend the assessment reports by parsing raw benchmark files:
```bash
# Ingest an NCCL AllReduce bandwidth log
ai-validator benchmark ingest --type nccl --file sample-data/sample-nccl.log
```

#### Process GPU Benchmark Packages
The CLI also supports sanitized GPU benchmark packages with NCCL, topology,
P2P, NVLink, and fabric-analysis evidence:
```bash
gpu-validator benchmark ingest \
  --input /path/to/gpu-benchmark-package \
  --output-dir artifacts/benchmark-package
```

See `docs/BENCHMARK_PACKAGES.md` and `docs/GPU_BENCHMARK_WORKFLOW.md` for the
benchmark-only ingestion, validation, summarization, comparison, and generic
`--gpu auto` workflow.

---

## 📊 Evaluation Mechanics

The core scoring engine (`src/ai_validator/scoring.py`) utilizes a dynamic weighted schema to determine overall cluster readiness:

| Diagnostic Layer | Default Weight | Key Targets Verified |
| :--- | :---: | :--- |
| **NVIDIA GPU & DCGM** | `30%` | Driver/CUDA, SRAM/DRAM Uncorrectable ECC errors, NVLink, DCGM Level 1 |
| **InfiniBand Fabric** | `20%` | Port link states, NDR 400Gb/s speeds, RDMA core active links |
| **Linux Platform** | `15%` | Operating system/kernel version, huge pages allocation, swaps, dmesg OOMs |
| **Slurm Scheduler** | `15%` | Master active controller, compute node states (IDLE/ALLOCATED/DRAIN) |
| **Kubernetes** | `10%` | API reachability, node status, NVIDIA GPU Operator & Device Plugin pods |
| **Storage Systems** | `10%` | Filesystem allocations, high-speed NVMe mounts, Parallel Lustre client |

### Smart Logic Features
1.  **Proportional Weight Redistribution**: If a layer (like Kubernetes or Slurm) is completely missing from a node, its weight is automatically split and redistributed to active layers.
2.  **Critical Failure Override**: Any failing check marked with `SeverityEnum.CRITICAL` (e.g., Uncorrectable SRAM ECC errors, or DRAINED compute node state) triggers an override that limits the overall cluster status classification to **Remediation required**, regardless of the overall numerical average.

---

## 🖥️ Full-Stack Diagnostic Companion Portal

The companion web interface provides an interactive, executive-level dashboard showing diagnostic indicators and command trails.

### Start the Portal (Express Backend + React Dev)
```bash
# Install node packages
npm install

# Start the dev portal on Port 3000
npm run dev
```
Open your browser to `http://localhost:3000` to view the diagnostic dashboard live!

### Features
*   **Live Interactive Scans**: Toggle scenarios and trigger visual diagnostic loops.
*   **Remediation Action Plans**: Displays real-time checklists of remediation recommendations.
*   **Deep-Dive Terminal Inspector**: Click on any individual subsystem check to inspect its underlying terminal command, execution duration, and raw stdout.
