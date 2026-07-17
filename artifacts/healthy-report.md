# GPU Validator
AI Compute Infrastructure Readiness and Customer Acceptance Report
**Cluster Identifier:** `nvis-interview-demo`<br>
**Assessment Mode:** Demonstration - Healthy Scenario<br>
**Timestamp:** 2026-07-17 19:02:32 UTC<br>
**Tool Version:** v0.1.0

Validate GPU infrastructure before customer handoff.
Read-only validation for Linux, NVIDIA GPU compute, InfiniBand, Slurm, Kubernetes, storage, and customer acceptance.

## 📊 Evaluation Summary
| Metric | Value |
| :--- | :--- |
| **Overall Readiness Score** | **100.0%** |
| **Customer Acceptance Status** | **READY** |
| **Total Nodes Assessed** | 4 |
| **Critical Failures** | 0 |

### Category-level Breakdown
| Category | Average Score | Weight |
| :--- | :---: | :---: |
| GPU | 100.0% | 30.0% |
| NETWORK | 100.0% | 20.0% |
| LINUX | 100.0% | 15.0% |
| SLURM | 100.0% | 15.0% |
| STORAGE | 100.0% | 10.0% |
| KUBERNETES | 100.0% | 10.0% |

## ⚠️ Remediation & Recommendations
- ✨ No immediate action items. Cluster is fully operational and healthy.

## 🖥️ Node Status Inventory
| Node Name | Aggregated Status |
| :--- | :--- |
| `dgx01` | 🟢 PASS |
| `dgx02` | 🟢 PASS |
| `dgx03` | 🟢 PASS |
| `dgx04` | 🟢 PASS |

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


### Node: `dgx04`
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


---
**Score Transparency Statement:**
Category averages are aggregated from node checks. Fully unavailable categories are excluded, and weights are distributed proportionally. A single failing `CRITICAL` check restricts classification to 'Remediation Required' even with high overall numerical scores.