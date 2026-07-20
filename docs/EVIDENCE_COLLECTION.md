# Read-only evidence collection

GPU Validator includes an administrator-side local collector for producing deterministic evidence bundles from Linux and NVIDIA GPU hosts. The collector is intended to be run directly on the host being evaluated and is separate from the public reviewer portal.

The collector is read-only by design: it runs only an internal allowlist of commands with `subprocess` argv lists, never with `shell=True`; it does not use `sudo`; it does not install packages; it does not restart, enable, or reconfigure services; it does not run benchmarks; it does not upload data; and it does not perform remote execution.

## Supported profiles

- `linux-host`: Linux operating system, CPU, memory, storage, network, failed-unit, and bounded journal evidence.
- `gpu-workstation`: `linux-host` evidence plus lightweight NVIDIA GPU/DCGM discovery commands.
- `single-gpu-node`: `linux-host` evidence plus lightweight NVIDIA GPU/DCGM discovery commands for a single server.
- `dgx-class`: expected-capability profile for multi-GPU/NVLink/DCGM visibility. This is not a DGX authenticity claim; missing DGX-specific commands are recorded in the manifest rather than treated as fatal.

## Example usage

```bash
ai-validator collect \
  --profile linux-host \
  --output evidence-bundle

ai-validator collect \
  --profile dgx-class \
  --output evidence-bundle \
  --sanitize

ai-validator collect \
  --profile linux-host \
  --output evidence-bundle \
  --dry-run
```

Dry run validates the profile and prints the allowlisted commands that would be attempted. It does not create files and does not run commands.

The default per-command timeout is 30 seconds and can be overridden:

```bash
ai-validator collect --profile linux-host --output evidence-bundle --timeout 15
```

Optional DCGM diagnostics are skipped by default. Run them only when explicitly approved for the host:

```bash
ai-validator collect --profile dgx-class --output evidence-bundle --include-diagnostics
```

## Commands collected

### Linux commands

- `uname -a`
- `cat /etc/os-release`
- `hostnamectl`
- `lscpu`
- `lsmem`
- `lsblk`
- `df -hT`
- `findmnt`
- `ip -br address`
- `ip -s link`
- `systemctl --failed`
- `journalctl -p err -b --no-pager -n 500`

### NVIDIA GPU commands

- `nvidia-smi`
- `nvidia-smi -q`
- `nvidia-smi topo -m`
- `nvidia-smi nvlink --status`
- `dcgmi discovery -l`

Skipped by default unless `--include-diagnostics` is provided:

- `dcgmi diag -r 1`

NVIDIA and DCGM utilities are optional for profiles that include GPU evidence. Missing commands are represented in `metadata/commands.json` and manifest counts instead of causing overall collection failure.

## Bundle format

A typical bundle is:

```text
evidence-bundle/
├── manifest.json
├── checksums.sha256
├── linux/
│   ├── uname.txt
│   ├── os-release.txt
│   ├── hostnamectl.txt
│   ├── lscpu.txt
│   ├── lsmem.txt
│   ├── lsblk.txt
│   ├── df.txt
│   ├── findmnt.txt
│   ├── ip-address.txt
│   ├── ip-link.txt
│   ├── systemctl-failed.txt
│   └── journal-errors.txt
├── gpu/
│   ├── nvidia-smi.txt
│   ├── nvidia-smi-query.txt
│   ├── topology.txt
│   ├── nvlink-status.txt
│   └── dcgm-discovery.txt
└── metadata/
    ├── commands.json
    └── stderr/
        └── *.stderr.txt
```

`gpu/dcgm-diag.txt` is present only when diagnostics are explicitly included and the command succeeds.

## Command metadata

`metadata/commands.json` records one object per allowlisted command in deterministic order, including skipped optional diagnostics. Each object includes:

- command ID
- category
- exact argv list
- timezone-aware UTC `started_at` and `finished_at` when executed
- `duration_ms`
- `exit_code`
- status: `collected`, `missing`, `denied`, `timeout`, `failed`, or `skipped`
- stdout file path target
- stderr file path or error summary
- hostname or sanitized hostname
- collector version

## Manifest schema

`manifest.json` is versioned with `schema_version: "1.0.0"` and includes:

- `collector_version`
- `profile`
- `collection_mode`
- timezone-aware UTC `started_at` and `finished_at`
- `source_hostname`
- `sanitized`
- command counts: total, collected, missing, failed, skipped
- categories
- checksum algorithm
- captured evidence file entries with path, category, command ID, byte count, and SHA-256
- warnings for skipped diagnostics, missing optional utilities, and command failures

## Checksums

`checksums.sha256` contains deterministic SHA-256 checksums for every file in the bundle except `checksums.sha256` itself, including `manifest.json`, `metadata/commands.json`, captured stdout files, and captured stderr files.

## Sanitization

When `--sanitize` is used, the collector sanitizes captured stdout/stderr and bundle metadata only. It never modifies source host files.

Sanitization uses deterministic replacement values within a bundle:

- source hostname: `HOST-001`
- IPv4 addresses: `IPV4-001`, `IPV4-002`, ...
- IPv6 addresses: `IPV6-001`, `IPV6-002`, ...
- usernames in `/home/<user>` and `/Users/<user>` paths: `USER-001`, `USER-002`, ...
- email addresses: `EMAIL-001`, `EMAIL-002`, ...

The replacement is stable: repeated occurrences of the same value receive the same replacement within the bundle.

## Safety exclusions

The collector must never gather environment variables, SSH keys, password files, shell history, kubeconfig contents, tokens, private keys, arbitrary home-directory files, command-line secrets, browser data, or credentials. It does not execute commands supplied by the user; command selection comes only from the internal registry.

## Current limitations

- Local host collection only.
- No portal upload or import of collector bundles yet.
- No remote execution.
- No benchmark execution.
- No Slurm, Kubernetes, InfiniBand, or storage-specific collectors in this command yet beyond the initial Linux host commands.
- DGX-class remains an expected-capability profile and is not hardware identity proof.

## Future collectors

Recommended next collectors:

- InfiniBand/RDMA: `ibstat`, `ibv_devinfo`, `rdma link`, `ibdev2netdev`.
- Slurm: `sinfo`, `scontrol ping`, read-only node and partition state.
- Kubernetes: read-only node, pod, daemonset, and NVIDIA GPU Operator state with RBAC-denied results preserved as evidence limitations.
- Storage: NVMe, parallel filesystem, mount, capacity, and health evidence.
