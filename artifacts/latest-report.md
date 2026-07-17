# GPU Validator
AI Compute Infrastructure Readiness and Customer Acceptance Report
**Cluster Identifier:** `nvis-interview-demo`<br>
**Assessment Mode:** Demonstration - Degraded Scenario<br>
**Timestamp:** 2026-07-17 19:02:32 UTC<br>
**Tool Version:** v0.1.0

Validate GPU infrastructure before customer handoff.
Read-only validation for Linux, NVIDIA GPU compute, InfiniBand, Slurm, Kubernetes, storage, and customer acceptance.

## 📊 Evaluation Summary
| Metric | Value |
| :--- | :--- |
| **Overall Readiness Score** | **97.01%** |
| **Customer Acceptance Status** | **REMEDIATION REQUIRED** |
| **Total Nodes Assessed** | 4 |
| **Critical Failures** | 2 |

### Category-level Breakdown
| Category | Average Score | Weight |
| :--- | :---: | :---: |
| GPU | 96.4% | 30.0% |
| NETWORK | 98.2% | 20.0% |
| LINUX | 100.0% | 15.0% |
| SLURM | 91.7% | 15.0% |
| STORAGE | 100.0% | 10.0% |
| KUBERNETES | 96.9% | 10.0% |

## ⚠️ Remediation & Recommendations
- [dgx03] The InfiniBand port is operating below the expected link rate. Verify cable health, switch port configuration, firmware compatibility, negotiated link width, and port speed.
- [dgx04] Drain the node from production scheduling, preserve NVIDIA and kernel diagnostic evidence, run DCGM diagnostics, confirm whether the ECC condition is repeatable, and escalate for hardware support if the error persists.
- [dgx04] Inspect slurmd log files for registration errors. Resume the node into scheduling: 'scontrol update nodename=dgx04 state=resume reason=restored'.
- [dgx04] Inspect GPU Operator resource pod logs: 'kubectl logs -n gpu-operator-resources -l app=nvidia-device-plugin-daemonset'.

## 🖥️ Node Status Inventory
| Node Name | Aggregated Status |
| :--- | :--- |
| `dgx01` | 🟢 PASS |
| `dgx02` | 🟢 PASS |
| `dgx03` | 🟡 WARN |
| `dgx04` | 🔴 DEGRADED |

## 📋 Detailed Verification Records
### Node: `dgx01`
| Category | Check | Status | Summary |
| :--- | :--- | :--- | :--- |
| LINUX PLATFORM | Operating System Compatibility | **PASS** | Ubuntu 22.04.3 LTS enterprise kernel detected. |
| LINUX PLATFORM | System Swapping Allocation | **PASS** | Operating system memory swapping is disabled (recommended). |
| LINUX PLATFORM | Huge Pages Allocation | **PASS** | 1024 Huge Pages pre-allocated successfully. |
| LINUX PLATFORM | Kernel Logs Integrity | **PASS** | 0 OOM killer incidents or hardware fault lines found in kernel buffer. |
| NVIDIA GPU & DCGM | NVIDIA System Management Interface | **PASS** | NVIDIA System Management Interface (nvidia-smi) is available. |
| NVIDIA GPU & DCGM | NVIDIA Driver and CUDA Compatibility | **PASS** | NVIDIA driver v535.104 with CUDA v12.2 detected and active. |
| NVIDIA GPU & DCGM | NVIDIA GPU Hardware ECC Integrity | **PASS** | All 8 GPUs report healthy registers with 0 uncorrectable ECC errors. |
| NVIDIA GPU & DCGM | NVLink Inter-GPU Connection Status | **PASS** | All inter-GPU NVLink connections are active and running at full bandwidth. |
| NVIDIA GPU & DCGM | NVIDIA DCGM Diagnostics Support | **PASS** | NVIDIA DCGM engine is running. |
| NVIDIA GPU & DCGM | NVIDIA DCGM Active Health Engine | **PASS** | All monitored DCGM subsystems are healthy. |
| NVIDIA GPU & DCGM | NVIDIA DCGM On-Demand Diagnostics | **PASS** | Fast read-only Level 1 diagnostics passed. |
| INFINIBAND & NETWORKING | InfiniBand Utilities Availability | **PASS** | InfiniBand port status tool (ibstat) is available. |
| INFINIBAND & NETWORKING | InfiniBand Port Link State | **PASS** | All 8 detected InfiniBand links are ACTIVE. |
| INFINIBAND & NETWORKING | InfiniBand Port Link Speed | **PASS** | Mellanox NDR 400Gb/s link widths are negotiated and active. |
| INFINIBAND & NETWORKING | RDMA Core Interfaces | **PASS** | 8 RDMA kernel links detected and active. |
| INFINIBAND & NETWORKING | Network Link Interface State | **PASS** | All interfaces are UP and configured. |
| INFINIBAND & NETWORKING | Network IP Routing Table | **PASS** | Standard default gateway routing is present. |
| INFINIBAND & NETWORKING | Interface Link Dropped Packets | **PASS** | 0 dropped packets or hardware-level errors detected. |
| SLURM SCHEDULER | Slurm Scheduler Availability | **PASS** | Slurm sinfo and scontrol utilities are registered in path. |
| SLURM SCHEDULER | Slurm Controller Connectivity | **PASS** | Primary slurmctld is active and responding. |
| SLURM SCHEDULER | Slurm Compute Node Scheduling State | **PASS** | Node state is active (IDLE/ALLOCATED). |
| STORAGE SYSTEMS | Local Filesystem Capacities | **PASS** | Local root and scratch partitions are below 45% capacity. |
| STORAGE SYSTEMS | High-Performance NVMe Detection | **PASS** | 4 high-speed NVMe scratch storage modules detected. |
| STORAGE SYSTEMS | Parallel Enterprise Shared Storage | **PASS** | Lustre client version 2.15 is mounted on /mnt/lustre. |
| KUBERNETES & ORCHESTRATION | Kubernetes CLI Availability | **PASS** | Kubernetes control binary (kubectl) is active. |
| KUBERNETES & ORCHESTRATION | Kubernetes API Server Connection | **PASS** | API connection verified using context: k8s-ai-cluster. |
| KUBERNETES & ORCHESTRATION | Kubernetes Node Status Readiness | **PASS** | Kubernetes Node registered as Ready. |
| KUBERNETES & ORCHESTRATION | NVIDIA GPU Operator and Device Plugins | **PASS** | All GPU Operator daemonsets (driver, device-plugin) are healthy. |


### Node: `dgx02`
| Category | Check | Status | Summary |
| :--- | :--- | :--- | :--- |
| LINUX PLATFORM | Operating System Compatibility | **PASS** | Ubuntu 22.04.3 LTS enterprise kernel detected. |
| LINUX PLATFORM | System Swapping Allocation | **PASS** | Operating system memory swapping is disabled (recommended). |
| LINUX PLATFORM | Huge Pages Allocation | **PASS** | 1024 Huge Pages pre-allocated successfully. |
| LINUX PLATFORM | Kernel Logs Integrity | **PASS** | 0 OOM killer incidents or hardware fault lines found in kernel buffer. |
| NVIDIA GPU & DCGM | NVIDIA System Management Interface | **PASS** | NVIDIA System Management Interface (nvidia-smi) is available. |
| NVIDIA GPU & DCGM | NVIDIA Driver and CUDA Compatibility | **PASS** | NVIDIA driver v535.104 with CUDA v12.2 detected and active. |
| NVIDIA GPU & DCGM | NVIDIA GPU Hardware ECC Integrity | **PASS** | All 8 GPUs report healthy registers with 0 uncorrectable ECC errors. |
| NVIDIA GPU & DCGM | NVLink Inter-GPU Connection Status | **PASS** | All inter-GPU NVLink connections are active and running at full bandwidth. |
| NVIDIA GPU & DCGM | NVIDIA DCGM Diagnostics Support | **PASS** | NVIDIA DCGM engine is running. |
| NVIDIA GPU & DCGM | NVIDIA DCGM Active Health Engine | **PASS** | All monitored DCGM subsystems are healthy. |
| NVIDIA GPU & DCGM | NVIDIA DCGM On-Demand Diagnostics | **PASS** | Fast read-only Level 1 diagnostics passed. |
| INFINIBAND & NETWORKING | InfiniBand Utilities Availability | **PASS** | InfiniBand port status tool (ibstat) is available. |
| INFINIBAND & NETWORKING | InfiniBand Port Link State | **PASS** | All 8 detected InfiniBand links are ACTIVE. |
| INFINIBAND & NETWORKING | InfiniBand Port Link Speed | **PASS** | Mellanox NDR 400Gb/s link widths are negotiated and active. |
| INFINIBAND & NETWORKING | RDMA Core Interfaces | **PASS** | 8 RDMA kernel links detected and active. |
| INFINIBAND & NETWORKING | Network Link Interface State | **PASS** | All interfaces are UP and configured. |
| INFINIBAND & NETWORKING | Network IP Routing Table | **PASS** | Standard default gateway routing is present. |
| INFINIBAND & NETWORKING | Interface Link Dropped Packets | **PASS** | 0 dropped packets or hardware-level errors detected. |
| SLURM SCHEDULER | Slurm Scheduler Availability | **PASS** | Slurm sinfo and scontrol utilities are registered in path. |
| SLURM SCHEDULER | Slurm Controller Connectivity | **PASS** | Primary slurmctld is active and responding. |
| SLURM SCHEDULER | Slurm Compute Node Scheduling State | **PASS** | Node state is active (IDLE/ALLOCATED). |
| STORAGE SYSTEMS | Local Filesystem Capacities | **PASS** | Local root and scratch partitions are below 45% capacity. |
| STORAGE SYSTEMS | High-Performance NVMe Detection | **PASS** | 4 high-speed NVMe scratch storage modules detected. |
| STORAGE SYSTEMS | Parallel Enterprise Shared Storage | **PASS** | Lustre client version 2.15 is mounted on /mnt/lustre. |
| KUBERNETES & ORCHESTRATION | Kubernetes CLI Availability | **PASS** | Kubernetes control binary (kubectl) is active. |
| KUBERNETES & ORCHESTRATION | Kubernetes API Server Connection | **PASS** | API connection verified using context: k8s-ai-cluster. |
| KUBERNETES & ORCHESTRATION | Kubernetes Node Status Readiness | **PASS** | Kubernetes Node registered as Ready. |
| KUBERNETES & ORCHESTRATION | NVIDIA GPU Operator and Device Plugins | **PASS** | All GPU Operator daemonsets (driver, device-plugin) are healthy. |


### Node: `dgx03`
| Category | Check | Status | Summary |
| :--- | :--- | :--- | :--- |
| LINUX PLATFORM | Operating System Compatibility | **PASS** | Ubuntu 22.04.3 LTS enterprise kernel detected. |
| LINUX PLATFORM | System Swapping Allocation | **PASS** | Operating system memory swapping is disabled (recommended). |
| LINUX PLATFORM | Huge Pages Allocation | **PASS** | 1024 Huge Pages pre-allocated successfully. |
| LINUX PLATFORM | Kernel Logs Integrity | **PASS** | 0 OOM killer incidents or hardware fault lines found in kernel buffer. |
| NVIDIA GPU & DCGM | NVIDIA System Management Interface | **PASS** | NVIDIA System Management Interface (nvidia-smi) is available. |
| NVIDIA GPU & DCGM | NVIDIA Driver and CUDA Compatibility | **PASS** | NVIDIA driver v535.104 with CUDA v12.2 detected and active. |
| NVIDIA GPU & DCGM | NVIDIA GPU Hardware ECC Integrity | **PASS** | All 8 GPUs report healthy registers with 0 uncorrectable ECC errors. |
| NVIDIA GPU & DCGM | NVLink Inter-GPU Connection Status | **PASS** | All inter-GPU NVLink connections are active and running at full bandwidth. |
| NVIDIA GPU & DCGM | NVIDIA DCGM Diagnostics Support | **PASS** | NVIDIA DCGM engine is running. |
| NVIDIA GPU & DCGM | NVIDIA DCGM Active Health Engine | **PASS** | All monitored DCGM subsystems are healthy. |
| NVIDIA GPU & DCGM | NVIDIA DCGM On-Demand Diagnostics | **PASS** | Fast read-only Level 1 diagnostics passed. |
| INFINIBAND & NETWORKING | InfiniBand Utilities Availability | **PASS** | InfiniBand port status tool (ibstat) is available. |
| INFINIBAND & NETWORKING | InfiniBand Port Link State | **PASS** | All 8 detected InfiniBand links are ACTIVE. |
| INFINIBAND & NETWORKING | InfiniBand Port Link Speed | **WARN** | Port 1 negotiated at NDR 200Gb/s speed (2x width instead of 4x width). Interconnect is physically degraded. |
| INFINIBAND & NETWORKING | RDMA Core Interfaces | **PASS** | 8 RDMA kernel links detected and active. |
| INFINIBAND & NETWORKING | Network Link Interface State | **PASS** | All interfaces are UP and configured. |
| INFINIBAND & NETWORKING | Network IP Routing Table | **PASS** | Standard default gateway routing is present. |
| INFINIBAND & NETWORKING | Interface Link Dropped Packets | **PASS** | 0 dropped packets or hardware-level errors detected. |
| SLURM SCHEDULER | Slurm Scheduler Availability | **PASS** | Slurm sinfo and scontrol utilities are registered in path. |
| SLURM SCHEDULER | Slurm Controller Connectivity | **PASS** | Primary slurmctld is active and responding. |
| SLURM SCHEDULER | Slurm Compute Node Scheduling State | **PASS** | Node state is active (IDLE/ALLOCATED). |
| STORAGE SYSTEMS | Local Filesystem Capacities | **PASS** | Local root and scratch partitions are below 45% capacity. |
| STORAGE SYSTEMS | High-Performance NVMe Detection | **PASS** | 4 high-speed NVMe scratch storage modules detected. |
| STORAGE SYSTEMS | Parallel Enterprise Shared Storage | **PASS** | Lustre client version 2.15 is mounted on /mnt/lustre. |
| KUBERNETES & ORCHESTRATION | Kubernetes CLI Availability | **PASS** | Kubernetes control binary (kubectl) is active. |
| KUBERNETES & ORCHESTRATION | Kubernetes API Server Connection | **PASS** | API connection verified using context: k8s-ai-cluster. |
| KUBERNETES & ORCHESTRATION | Kubernetes Node Status Readiness | **PASS** | Kubernetes Node registered as Ready. |
| KUBERNETES & ORCHESTRATION | NVIDIA GPU Operator and Device Plugins | **PASS** | All GPU Operator daemonsets (driver, device-plugin) are healthy. |


### Node: `dgx04`
| Category | Check | Status | Summary |
| :--- | :--- | :--- | :--- |
| LINUX PLATFORM | Operating System Compatibility | **PASS** | Ubuntu 22.04.3 LTS enterprise kernel detected. |
| LINUX PLATFORM | System Swapping Allocation | **PASS** | Operating system memory swapping is disabled (recommended). |
| LINUX PLATFORM | Huge Pages Allocation | **PASS** | 1024 Huge Pages pre-allocated successfully. |
| LINUX PLATFORM | Kernel Logs Integrity | **PASS** | 0 OOM killer incidents or hardware fault lines found in kernel buffer. |
| NVIDIA GPU & DCGM | NVIDIA System Management Interface | **PASS** | NVIDIA System Management Interface (nvidia-smi) is available. |
| NVIDIA GPU & DCGM | NVIDIA Driver and CUDA Compatibility | **PASS** | NVIDIA driver v535.104 with CUDA v12.2 detected and active. |
| NVIDIA GPU & DCGM | NVIDIA GPU Hardware ECC Integrity | **FAIL** | GPU 5 reported 12 uncorrectable ECC double-bit physical memory errors. |
| NVIDIA GPU & DCGM | NVLink Inter-GPU Connection Status | **PASS** | All inter-GPU NVLink connections are active and running at full bandwidth. |
| NVIDIA GPU & DCGM | NVIDIA DCGM Diagnostics Support | **PASS** | NVIDIA DCGM engine is running. |
| NVIDIA GPU & DCGM | NVIDIA DCGM Active Health Engine | **PASS** | All monitored DCGM subsystems are healthy. |
| NVIDIA GPU & DCGM | NVIDIA DCGM On-Demand Diagnostics | **PASS** | Fast read-only Level 1 diagnostics passed. |
| INFINIBAND & NETWORKING | InfiniBand Utilities Availability | **PASS** | InfiniBand port status tool (ibstat) is available. |
| INFINIBAND & NETWORKING | InfiniBand Port Link State | **PASS** | All 8 detected InfiniBand links are ACTIVE. |
| INFINIBAND & NETWORKING | InfiniBand Port Link Speed | **PASS** | Mellanox NDR 400Gb/s link widths are negotiated and active. |
| INFINIBAND & NETWORKING | RDMA Core Interfaces | **PASS** | 8 RDMA kernel links detected and active. |
| INFINIBAND & NETWORKING | Network Link Interface State | **PASS** | All interfaces are UP and configured. |
| INFINIBAND & NETWORKING | Network IP Routing Table | **PASS** | Standard default gateway routing is present. |
| INFINIBAND & NETWORKING | Interface Link Dropped Packets | **PASS** | 0 dropped packets or hardware-level errors detected. |
| SLURM SCHEDULER | Slurm Scheduler Availability | **PASS** | Slurm sinfo and scontrol utilities are registered in path. |
| SLURM SCHEDULER | Slurm Controller Connectivity | **PASS** | Primary slurmctld is active and responding. |
| SLURM SCHEDULER | Slurm Compute Node Scheduling State | **FAIL** | Node state: DRAINED (Reason: GPU 5 uncorrectable ECC error reported by health check daemon) |
| STORAGE SYSTEMS | Local Filesystem Capacities | **PASS** | Local root and scratch partitions are below 45% capacity. |
| STORAGE SYSTEMS | High-Performance NVMe Detection | **PASS** | 4 high-speed NVMe scratch storage modules detected. |
| STORAGE SYSTEMS | Parallel Enterprise Shared Storage | **PASS** | Lustre client version 2.15 is mounted on /mnt/lustre. |
| KUBERNETES & ORCHESTRATION | Kubernetes CLI Availability | **PASS** | Kubernetes control binary (kubectl) is active. |
| KUBERNETES & ORCHESTRATION | Kubernetes API Server Connection | **PASS** | API connection verified using context: k8s-ai-cluster. |
| KUBERNETES & ORCHESTRATION | Kubernetes Node Status Readiness | **PASS** | Kubernetes Node registered as Ready. |
| KUBERNETES & ORCHESTRATION | NVIDIA GPU Operator and Device Plugins | **WARN** | DaemonSet 'nvidia-device-plugin-daemonset' reports 3/4 healthy pods. Pod 'nvidia-device-plugin-dgx04' is CrashLoopBackOff. |


---
**Score Transparency Statement:**
Category averages are aggregated from node checks. Fully unavailable categories are excluded, and weights are distributed proportionally. A single failing `CRITICAL` check restricts classification to 'Remediation Required' even with high overall numerical scores.