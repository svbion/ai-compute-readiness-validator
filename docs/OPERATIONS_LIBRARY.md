# Operations Library

The Operations Library is an authenticated portal area for searchable GPU infrastructure cheat sheets. Routes:

- `/portal/library`
- `/portal/library/slurm`
- `/portal/library/lustre`
- `/portal/library/base-command-manager`
- `/portal/library/benchmarks`

The library is rendered by React and does not execute commands. Commands are displayed as escaped text with copy-to-clipboard controls and safety labels.

## Features

Each page includes:

- topic overview
- key concepts
- common commands
- troubleshooting workflow
- safety warnings
- interview questions
- copy buttons
- syntax-highlighted command blocks
- related GPU Validator features
- last reviewed/version note

The index supports topic/command search, category filters, keyboard-accessible native form controls, responsive layout, and copy feedback. It does not persist secrets.

## Pages

### Slurm

Covers `sinfo`, `squeue`, `scontrol show nodes`, partitions/config, `sacct`, `sstat`, `sbatch`, `srun`, `salloc`, `scancel`, filters, arrays, dependencies, reservations, constraints, GRES GPU requests, and multi-node NCCL launch patterns. Mutating scheduler actions are clearly labeled.

### Lustre

Covers `findmnt`, `lfs df`, `lfs check`, `lfs getstripe`, `lfs setstripe`, `lfs find`, `lfs quota`, `lctl dl`, `lctl get_param`, `lctl ping`, OST/MDT concepts, striping, capacity vs inode exhaustion, client troubleshooting, performance triage, and error interpretation. `lfs setstripe` is labeled mutating.

### NVIDIA Base Command Manager

Uses the product name NVIDIA Base Command Manager. Because exact commands vary by BCM/CMDaemon version, entries are marked illustrative where appropriate and emphasize `cmsh` help/tab-completion command discovery rather than claiming universal syntax.

### Benchmarking

Covers NCCL Tests, HPL, DCGM Level 1 diagnostics, Triton Performance Analyzer, GenAI-Perf, and MLPerf boundary language. It distinguishes local benchmark evidence, MLPerf-style evaluation, and official submitted MLPerf results.
