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

1. Inspect current access and marketplace availability through official NVIDIA DGX Cloud, DGX Cloud Lepton, or approved partner channels. Availability, instance names, and supported regions change over time.
2. Request access or enroll through official NVIDIA channels only. Do not use unofficial resale, credential-sharing, or bypass paths.
3. Confirm tenant/project access and acceptable-use policy before provisioning anything.
4. Confirm the instance provider and actual hardware type before treating evidence as DGX, HGX, H100/H200/B200, GB200, or another NVIDIA platform. Preserve the provider-visible instance type in notes.
5. Confirm hourly, reserved, marketplace, cloud-credit, or contract cost before provisioning.
6. Set a cost and time limit before provisioning. Record the planned stop time, budget cap, owner, and who is authorized to extend it.
7. Determine whether access is SSH, notebook, container shell, workload shell, or managed job only.
8. Confirm whether host-level `nvidia-smi` output is visible.
9. Confirm whether Kubernetes/Slurm infrastructure evidence is available or intentionally abstracted.
10. Confirm the data-egress policy before collecting evidence:
   - whether raw command output may leave the environment
   - whether sanitized JSON may leave the environment
   - whether screenshots are allowed
   - whether file download, object storage, clipboard, or browser download is permitted
11. Use the portable collector only when explicitly permitted by the lab/provider policy. Otherwise manually capture only approved command output.
12. Run `ai-validator validate --profile dgx-class` only when read-only host commands are permitted.
13. If only benchmark logs are available, import benchmark evidence and label infrastructure evidence as unavailable/abstracted.
14. Terminate capacity immediately after evidence collection and sanitization are complete. Verify the instance/job/storage allocation is stopped or deleted and record the termination timestamp.
15. Do not claim physical DGX identity unless platform identity evidence supports it.

Minimum DGX Cloud / Lepton evidence notes:

- access path used: DGX Cloud, DGX Cloud Lepton, partner marketplace, or other official channel
- provider/region/project/tenant alias, sanitized as required
- instance or workload type
- declared GPU model and count
- actual `nvidia-smi` GPU model and count if visible
- SSH/workload-shell availability
- host-level command visibility
- data-egress policy
- cost model and approved cost/time limit
- provisioning timestamp
- collection timestamp
- termination timestamp
- validation limitations

## NVIDIA Inception / Innovation Lab

1. Determine whether Sabion.AI or another eligible company can apply under current NVIDIA Inception program rules. Eligibility and benefit availability can change; inspect the current official program pages before starting.
2. Complete the official Inception company profile only through NVIDIA-controlled forms and portals.
3. Inspect current Inception benefits after approval. Look specifically for cloud credits, Innovation Lab access, technical enablement, partner credits, or startup infrastructure benefits.
4. Request Innovation Lab access, cloud-credit benefits, or partner GPU access through official NVIDIA channels only.
5. Confirm whether the benefit provides DGX-class hardware, DGX Cloud, partner cloud GPU capacity, a managed lab, or only credits/documentation.
6. Confirm command, SSH, file-transfer, package-install, benchmark, and data-egress policies before using any collector.
7. Set a cost and time limit if the benefit involves credits or metered cloud resources.
8. Document expiration for the benefit, lab reservation, credit grant, or cloud allocation.
9. Terminate any metered capacity after approved evidence collection.
10. Label all evidence by actual access path and hardware identity status. Inception membership or Innovation Lab participation is not itself proof of DGX hardware identity.

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
