# DGX Access Playbook

This is a factual, action-oriented checklist for obtaining temporary access to real NVIDIA GPU infrastructure. It does not imply NVIDIA endorsement and does not claim that this repository has already tested real DGX hardware.

## NVIDIA LaunchPad

1. Create or verify an NVIDIA Developer account.
2. Inspect the current NVIDIA LaunchPad lab catalog.
3. Request an applicable DGX, GPU cluster, AI Enterprise, Base Command, or infrastructure validation lab.
4. Confirm access constraints before scheduling:
   - SSH availability
   - file upload/download availability
   - package installation policy
   - arbitrary read-only command policy
   - session time limit
   - outbound network restrictions
   - whether `nvidia-smi`, `dcgmi`, Slurm, Kubernetes, and InfiniBand tools are visible
5. If arbitrary commands are permitted, upload or clone this repository.
6. Run only read-only collection:
   ```bash
   PROFILE=dgx-class VALIDATION_NAME=launchpad-<date> tools/collect-live-evidence.sh
   ```
7. Sanitize and export only the sanitized archive.
8. Record access limitations in the validation notes.

## NVIDIA DGX Cloud / DGX Cloud Lepton

1. Confirm tenant/project access and acceptable-use policy.
2. Determine whether access is SSH, notebook, container shell, or managed job only.
3. Confirm whether host-level `nvidia-smi` output is visible.
4. Confirm whether Kubernetes/Slurm infrastructure evidence is available or intentionally abstracted.
5. Run `ai-validator validate --profile dgx-class` only when read-only host commands are permitted.
6. If only benchmark logs are available, import benchmark evidence and label infrastructure evidence as unavailable/abstracted.
7. Do not claim physical DGX identity unless platform identity evidence supports it.

## NVIDIA Innovation Lab / partner lab

1. Identify sponsor/contact and written scope for read-only validation.
2. Confirm maintenance window and non-disruptive command list.
3. Confirm no stress tests, no DCGM diagnostics, no resets, and no scheduler/Kubernetes mutations.
4. Run collection with the most accurate profile:
   - `dgx-class`
   - `hgx-based`
   - `oem-gpu-platform`
   - `slurm-gpu-cluster`
   - `kubernetes-gpu-cluster`
   - `ai-factory`
5. Sanitize evidence before removing it from the lab.
6. Preserve the redaction manifest and limitations.

## Cloud partner GPU capacity

1. Select an instance with real NVIDIA GPUs and SSH/shell access.
2. Prefer Ubuntu or enterprise Linux images with existing NVIDIA drivers.
3. Do not install drivers during this validation pass unless the provider image already supports it.
4. Run:
   ```bash
   ai-validator validate --profile single-gpu-node --name cloud-gpu-<date> --output-dir artifacts
   ```
5. Use `dgx-class` or `hgx-based` only if the instance/platform evidence supports those expected capabilities.
6. Sanitize public/private IPs, domain names, usernames, MAC addresses, and serial numbers before import.

## Customer or employer lab access

1. Get written permission for read-only evidence collection.
2. Confirm data-handling rules and redaction requirements.
3. Confirm whether raw evidence can leave the environment. If not, run sanitizer in-place and export only the sanitized manifest/report.
4. Ask for a host alias to avoid exposing real cluster names.
5. Run collection without sudo:
   ```bash
   PROFILE=ai-factory VALIDATION_NAME=<approved-alias> tools/collect-live-evidence.sh
   ```
6. Review sanitization manifest with the data owner.
7. Import only sanitized JSON/report artifacts.

## Rented NVIDIA GPU server

1. Choose a provider/image with working NVIDIA drivers.
2. Verify the server is yours to inspect and no other tenant workloads are present.
3. Run a minimal command check:
   ```bash
   nvidia-smi -L
   nvidia-smi --query-gpu=index,name,uuid,driver_version --format=csv,noheader
   ```
4. Run:
   ```bash
   PROFILE=single-gpu-node VALIDATION_NAME=rented-gpu-<date> tools/collect-live-evidence.sh
   ```
5. Do not run burn-in or stress tests in this pass.

## Evidence acceptance rules

- Real GPU evidence requires successful NVIDIA command output.
- Live Cluster Infrastructure requires real Slurm, Kubernetes, InfiniBand, or equivalent cluster command evidence.
- DGX/HGX identity requires reliable DMI/platform or provider evidence.
- Imported evidence must be sanitized, checksum-verified when possible, and marked as imported.
- Demo scenarios remain labelled simulated.
