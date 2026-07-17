# Real NVIDIA Hardware Validation

This project is ready to collect and import evidence from real NVIDIA GPU infrastructure when access is available. It does not acquire hardware, install drivers, run stress tests, or mutate a cluster.

Supported access sources include NVIDIA LaunchPad, DGX Cloud, DGX Cloud Lepton, NVIDIA Innovation Lab, NVIDIA Cloud Partner GPU capacity, customer or employer labs, rented NVIDIA GPU servers, DGX-class systems, HGX-based systems, and OEM GPU platforms.

Important: DGX-class and HGX-based are expected-capability profiles. They are not automatic authenticity claims. The portal must not display genuine DGX or HGX identity unless reliable platform identity evidence supports it.

## Read-only validator commands

Primary auto-detected collection:

```bash
ai-validator validate \
  --profile auto \
  --name <validation-name> \
  --output-dir <output-dir>
```

Explicit target profiles:

```bash
ai-validator validate --profile gpu-workstation
ai-validator validate --profile single-gpu-node
ai-validator validate --profile dgx-class
ai-validator validate --profile hgx-based
ai-validator validate --profile oem-gpu-platform
ai-validator validate --profile slurm-gpu-cluster
ai-validator validate --profile kubernetes-gpu-cluster
ai-validator validate --profile ai-factory
```

## Portable collection bundle

From a checked-out repository on the target host:

```bash
PROFILE=auto VALIDATION_NAME=<validation-name> tools/collect-live-evidence.sh
```

The script:

- uses `set -Eeuo pipefail`
- installs nothing
- uses no `sudo`
- restarts nothing
- changes no scheduler or Kubernetes state
- runs approved read-only commands only
- collects into a timestamped directory
- produces JSON, Markdown, and HTML through `ai-validator validate`
- creates `manifest.json`
- creates `checksums.sha256`
- optionally creates a sanitized copy and `.tar.gz` archive
- prints exactly what it collected
- records unavailable utilities without failing the collection

## Order of operations

1. Platform identity

Read-only sources:

```bash
cat /sys/class/dmi/id/sys_vendor
cat /sys/class/dmi/id/product_name
cat /sys/class/dmi/id/product_version
cat /sys/class/dmi/id/board_vendor
cat /sys/class/dmi/id/board_name
```

Do not require `dmidecode` or `sudo`. Mark hardware identity as unverified if these files are unavailable or inconclusive.

2. Operating system

```bash
cat /etc/os-release
uname -a
```

3. GPU inventory

```bash
nvidia-smi
nvidia-smi -L
nvidia-smi --query-gpu=index,name,uuid,serial,driver_version,pci.bus_id,temperature.gpu,ecc.errors.uncorrected.volatile.total --format=csv,noheader
```

Only display `Live GPU Hardware` when real NVIDIA command evidence exists.

4. GPU health

```bash
nvidia-smi -q
```

Review ECC, retired pages, driver/CUDA versions, persistence mode, temperature, power, and health indicators.

5. Topology

```bash
nvidia-smi topo -m
```

6. NVLink/NVSwitch

```bash
nvidia-smi nvlink --status
```

Missing NVLink evidence is expected on PCIe-only platforms. Do not claim NVSwitch unless the evidence supports it.

7. InfiniBand / RDMA

```bash
ibstat
ibv_devinfo
rdma link
ibdev2netdev
```

Unavailable commands should be labelled unavailable, not fatal, unless the selected profile requires fabric evidence.

8. Scheduler

```bash
sinfo
sinfo -N -l
scontrol ping
scontrol show node
scontrol show partition
```

Distinguish intentionally drained nodes from failed nodes where Slurm evidence permits. Never resume, drain, or update scheduler state during collection.

9. Kubernetes

```bash
kubectl config current-context
kubectl get nodes -o json
kubectl get pods -A
kubectl get daemonsets -A
kubectl get clusterpolicies.nvidia.com
```

RBAC-denied and permission-denied responses are valid evidence limitations.

10. Storage

Use existing validator storage collectors and optionally import safe benchmark results. Do not run destructive filesystem tests by default.

11. Optional DCGM health

Allowed passive checks:

```bash
dcgmi discovery -l
dcgmi health -c
```

Do not automatically run intrusive DCGM diagnostics, including:

```bash
dcgmi diag -r 3
```

Also do not run stress tests, burn-in tests, power-limit changes, clock changes, MIG reconfiguration, driver installation, firmware updates, or GPU reset.

12. Benchmark result ingestion

This pass supports ingestion and presentation of benchmark evidence, not automatic benchmark execution. Recognized benchmark families:

- NCCL Tests
- HPL
- HPL-AI
- HPCG
- OSU MPI
- fio
- iperf3
- MLPerf result metadata

Label each result as one of:

- benchmark recognized
- sample benchmark
- imported real result
- benchmark execution not performed
- benchmark failed
- baseline unavailable

13. Sanitization

Run:

```bash
tools/sanitize-evidence.py <bundle> --output <bundle-sanitized> --redact-ips --redact-domains --redact-serials --redact-macs
```

The sanitizer redacts usernames, emails, SSH material, tokens, Kubernetes bearer tokens/certificates, cloud metadata, selected IPs/domains/cluster names, serial numbers, MAC addresses, username paths, environment secrets, and command-line secrets. Redactions are recorded in a manifest without retaining original values.

14. Export

Share the sanitized archive only:

```bash
tar -czf <bundle-sanitized>.tar.gz <bundle-sanitized>
```

15. Import into the portal

```bash
tools/import-live-evidence.py <bundle-sanitized> --output-dir artifacts/imported-live --name <validation-name>
```

The importer validates JSON, verifies checksums when supplied, preserves provenance, marks evidence as imported, distinguishes imported live evidence from simulated scenarios, copies artifacts into a controlled path, and never executes imported content. Imported HTML is not trusted; regenerate reports from normalized JSON before public display.

## Required provenance fields

Every real run must include:

- `validation_source`
- `collection_timestamp`
- sanitized hostname or host alias
- `selected_profile`
- `detected_environment`
- `hardware_identity_verified`
- collector version
- Git commit
- operating-system evidence
- GPU evidence source
- cluster evidence source
- `simulated=false`
- sanitization status
- import timestamp if imported
- source confidence
- limitations

Allowed source labels:

- Live Linux Host
- Live GPU Hardware
- Live Cluster Infrastructure
- Imported Live Evidence
- Simulated Scenario

Never display Live Cluster Infrastructure solely because the AI Factory profile was selected.
