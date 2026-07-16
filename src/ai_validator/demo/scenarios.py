from datetime import datetime
from typing import Dict, List
from ai_validator.models import Cluster, Node, ValidationCategory, ValidationCheck, CommandEvidence, StatusEnum, SeverityEnum
from ai_validator.config import DEFAULT_WEIGHTS

def create_mock_evidence(cmd: List[str], exit_code: int, stdout: str, stderr: str = "") -> CommandEvidence:
    """Generates a mock CommandEvidence record."""
    return CommandEvidence(
        command=cmd,
        exit_code=exit_code,
        duration_seconds=0.015,
        stdout=stdout,
        stderr=stderr,
        timestamp=datetime.utcnow()
    )

def generate_base_categories(node_name: str, healthy: bool = True) -> Dict[str, ValidationCategory]:
    """Creates default categories and checks for a node, optionally fully healthy or standard base."""
    categories = {}
    
    # 1. Linux
    linux_checks = [
        ValidationCheck(
            id="linux.os_version",
            category="linux",
            title="Operating System Compatibility",
            status=StatusEnum.PASS,
            severity=SeverityEnum.MEDIUM,
            summary="Ubuntu 22.04.3 LTS enterprise kernel detected.",
            evidence=[create_mock_evidence(["cat", "/etc/os-release"], 0, "NAME=\"Ubuntu\"\nVERSION=\"22.04.3 LTS (Jammy Jellyfish)\"")],
            node=node_name
        ),
        ValidationCheck(
            id="linux.swap_disabled",
            category="linux",
            title="System Swapping Allocation",
            status=StatusEnum.PASS,
            summary="Operating system memory swapping is disabled (recommended).",
            severity=SeverityEnum.LOW,
            evidence=[create_mock_evidence(["cat", "/proc/swaps"], 0, "Filename\t\t\t\tType\t\tSize\t\tUsed\t\tPriority\n")],
            node=node_name
        ),
        ValidationCheck(
            id="linux.hugepages",
            category="linux",
            title="Huge Pages Allocation",
            status=StatusEnum.PASS,
            summary="1024 Huge Pages pre-allocated successfully.",
            severity=SeverityEnum.LOW,
            evidence=[create_mock_evidence(["cat", "/proc/meminfo"], 0, "HugePages_Total:     1024\nHugePages_Free:      1024\nHugepagesize:       2048 kB")],
            node=node_name
        ),
        ValidationCheck(
            id="linux.kernel_errors",
            category="linux",
            title="Kernel Logs Integrity",
            status=StatusEnum.PASS,
            summary="0 OOM killer incidents or hardware fault lines found in kernel buffer.",
            severity=SeverityEnum.CRITICAL,
            evidence=[create_mock_evidence(["dmesg", "-T", "--level=err,crit"], 0, "")],
            node=node_name
        )
    ]
    categories["linux"] = ValidationCategory(id="linux", name="Linux Platform", weight=DEFAULT_WEIGHTS["linux"], checks=linux_checks)

    # 2. GPU & DCGM
    gpu_checks = [
        ValidationCheck(
            id="gpu.tools_present",
            category="gpu",
            title="NVIDIA System Management Interface",
            status=StatusEnum.PASS,
            summary="NVIDIA System Management Interface (nvidia-smi) is available.",
            severity=SeverityEnum.MEDIUM,
            evidence=[create_mock_evidence(["which", "nvidia-smi"], 0, "/usr/bin/nvidia-smi")],
            node=node_name
        ),
        ValidationCheck(
            id="gpu.driver_cuda",
            category="gpu",
            title="NVIDIA Driver and CUDA Compatibility",
            status=StatusEnum.PASS,
            summary="NVIDIA driver v535.104 with CUDA v12.2 detected and active.",
            severity=SeverityEnum.MEDIUM,
            evidence=[create_mock_evidence(["nvidia-smi", "-q"], 0, "Driver Version : 535.104\nCUDA Version : 12.2")],
            node=node_name
        ),
        ValidationCheck(
            id="gpu.ecc_errors",
            category="gpu",
            title="NVIDIA GPU Hardware ECC Integrity",
            status=StatusEnum.PASS,
            summary="All 8 GPUs report healthy registers with 0 uncorrectable ECC errors.",
            severity=SeverityEnum.CRITICAL,
            evidence=[create_mock_evidence(["nvidia-smi", "-q"], 0, "ECC Mode : Enabled\nUncorrectable : 0")],
            node=node_name
        ),
        ValidationCheck(
            id="gpu.nvlink",
            category="gpu",
            title="NVLink Inter-GPU Connection Status",
            status=StatusEnum.PASS,
            summary="All inter-GPU NVLink connections are active and running at full bandwidth.",
            severity=SeverityEnum.HIGH,
            evidence=[create_mock_evidence(["nvidia-smi", "nvlink", "--status"], 0, "GPU 0: NVLink Link 0: Active\nGPU 0: NVLink Link 1: Active")],
            node=node_name
        ),
        ValidationCheck(
            id="gpu.dcgm_present",
            category="gpu",
            title="NVIDIA DCGM Diagnostics Support",
            status=StatusEnum.PASS,
            summary="NVIDIA DCGM engine is running.",
            severity=SeverityEnum.LOW,
            evidence=[create_mock_evidence(["which", "dcgmi"], 0, "/usr/bin/dcgmi")],
            node=node_name
        ),
        ValidationCheck(
            id="gpu.dcgm_health",
            category="gpu",
            title="NVIDIA DCGM Active Health Engine",
            status=StatusEnum.PASS,
            summary="All monitored DCGM subsystems are healthy.",
            severity=SeverityEnum.MEDIUM,
            evidence=[create_mock_evidence(["dcgmi", "health", "-c"], 0, "Health status is healthy.")],
            node=node_name
        ),
        ValidationCheck(
            id="gpu.dcgm_diag",
            category="gpu",
            title="NVIDIA DCGM On-Demand Diagnostics",
            status=StatusEnum.PASS,
            summary="Fast read-only Level 1 diagnostics passed.",
            severity=SeverityEnum.HIGH,
            evidence=[create_mock_evidence(["dcgmi", "diag", "-r", "1"], 0, "Diagnostic Level 1 passed.")],
            node=node_name
        )
    ]
    categories["gpu"] = ValidationCategory(id="gpu", name="NVIDIA GPU & DCGM", weight=DEFAULT_WEIGHTS["gpu"], checks=gpu_checks)

    # 3. Network
    net_checks = [
        ValidationCheck(
            id="network.ib_present",
            category="network",
            title="InfiniBand Utilities Availability",
            status=StatusEnum.PASS,
            summary="InfiniBand port status tool (ibstat) is available.",
            severity=SeverityEnum.LOW,
            evidence=[create_mock_evidence(["which", "ibstat"], 0, "/usr/bin/ibstat")],
            node=node_name
        ),
        ValidationCheck(
            id="network.ib_port_state",
            category="network",
            title="InfiniBand Port Link State",
            status=StatusEnum.PASS,
            summary="All 8 detected InfiniBand links are ACTIVE.",
            severity=SeverityEnum.HIGH,
            evidence=[create_mock_evidence(["ibstat"], 0, "Port 1: Active\nPort 2: Active")],
            node=node_name
        ),
        ValidationCheck(
            id="network.ib_link_speed",
            category="network",
            title="InfiniBand Port Link Speed",
            status=StatusEnum.PASS,
            summary="Mellanox NDR 400Gb/s link widths are negotiated and active.",
            severity=SeverityEnum.MEDIUM,
            evidence=[create_mock_evidence(["ibstat"], 0, "Link speed: 400 Gb/s\nLink width: 4x")],
            node=node_name
        ),
        ValidationCheck(
            id="network.rdma_interfaces",
            category="network",
            title="RDMA Core Interfaces",
            status=StatusEnum.PASS,
            summary="8 RDMA kernel links detected and active.",
            severity=SeverityEnum.MEDIUM,
            evidence=[create_mock_evidence(["rdma", "link"], 0, "mlx5_0/1 up\nmlx5_1/1 up")],
            node=node_name
        ),
        ValidationCheck(
            id="network.interfaces",
            category="network",
            title="Network Link Interface State",
            status=StatusEnum.PASS,
            summary="All interfaces are UP and configured.",
            severity=SeverityEnum.MEDIUM,
            evidence=[create_mock_evidence(["ip", "link"], 0, "state UP")],
            node=node_name
        ),
        ValidationCheck(
            id="network.routing",
            category="network",
            title="Network IP Routing Table",
            status=StatusEnum.PASS,
            summary="Standard default gateway routing is present.",
            severity=SeverityEnum.MEDIUM,
            evidence=[create_mock_evidence(["ip", "route"], 0, "default via 10.0.0.1 dev eth0")],
            node=node_name
        ),
        ValidationCheck(
            id="network.link_health",
            category="network",
            title="Interface Link Dropped Packets",
            status=StatusEnum.PASS,
            summary="0 dropped packets or hardware-level errors detected.",
            severity=SeverityEnum.MEDIUM,
            evidence=[create_mock_evidence(["ip", "-s", "link"], 0, "RX: errors 0 dropped 0\nTX: errors 0 dropped 0")],
            node=node_name
        )
    ]
    categories["network"] = ValidationCategory(id="network", name="InfiniBand & Networking", weight=DEFAULT_WEIGHTS["network"], checks=net_checks)

    # 4. Slurm
    slurm_checks = [
        ValidationCheck(
            id="slurm.present",
            category="slurm",
            title="Slurm Scheduler Availability",
            status=StatusEnum.PASS,
            summary="Slurm sinfo and scontrol utilities are registered in path.",
            severity=SeverityEnum.LOW,
            evidence=[create_mock_evidence(["which", "sinfo"], 0, "/usr/bin/sinfo")],
            node=node_name
        ),
        ValidationCheck(
            id="slurm.controller",
            category="slurm",
            title="Slurm Controller Connectivity",
            status=StatusEnum.PASS,
            summary="Primary slurmctld is active and responding.",
            severity=SeverityEnum.HIGH,
            evidence=[create_mock_evidence(["scontrol", "ping"], 0, "Slurmctld at slurm-master is UP")],
            node=node_name
        ),
        ValidationCheck(
            id="slurm.node_state",
            category="slurm",
            title="Slurm Compute Node Scheduling State",
            status=StatusEnum.PASS,
            summary="Node state is active (IDLE/ALLOCATED).",
            severity=SeverityEnum.CRITICAL,
            evidence=[create_mock_evidence(["sinfo", "-N", "-l"], 0, "node01  idle  1.00")],
            node=node_name
        )
    ]
    categories["slurm"] = ValidationCategory(id="slurm", name="Slurm Scheduler", weight=DEFAULT_WEIGHTS["slurm"], checks=slurm_checks)

    # 5. Storage
    storage_checks = [
        ValidationCheck(
            id="storage.filesystems",
            category="storage",
            title="Local Filesystem Capacities",
            status=StatusEnum.PASS,
            summary="Local root and scratch partitions are below 45% capacity.",
            severity=SeverityEnum.MEDIUM,
            evidence=[create_mock_evidence(["df", "-hT"], 0, "/dev/sda1  ext4  100G  45G  45%  /\n")],
            node=node_name
        ),
        ValidationCheck(
            id="storage.nvme",
            category="storage",
            title="High-Performance NVMe Detection",
            status=StatusEnum.PASS,
            summary="4 high-speed NVMe scratch storage modules detected.",
            severity=SeverityEnum.LOW,
            evidence=[create_mock_evidence(["nvme", "list"], 0, "/dev/nvme0n1  960GB\n/dev/nvme1n1  960GB")],
            node=node_name
        ),
        ValidationCheck(
            id="storage.parallel_fs",
            category="storage",
            title="Parallel Enterprise Shared Storage",
            status=StatusEnum.PASS,
            summary="Lustre client version 2.15 is mounted on /mnt/lustre.",
            severity=SeverityEnum.MEDIUM,
            evidence=[create_mock_evidence(["lfs", "--version"], 0, "lfs 2.15.2")],
            node=node_name
        )
    ]
    categories["storage"] = ValidationCategory(id="storage", name="Storage Systems", weight=DEFAULT_WEIGHTS["storage"], checks=storage_checks)

    # 6. Kubernetes
    kube_checks = [
        ValidationCheck(
            id="kubernetes.present",
            category="kubernetes",
            title="Kubernetes CLI Availability",
            status=StatusEnum.PASS,
            summary="Kubernetes control binary (kubectl) is active.",
            severity=SeverityEnum.LOW,
            evidence=[create_mock_evidence(["which", "kubectl"], 0, "/usr/bin/kubectl")],
            node=node_name
        ),
        ValidationCheck(
            id="kubernetes.cluster_reach",
            category="kubernetes",
            title="Kubernetes API Server Connection",
            status=StatusEnum.PASS,
            summary="API connection verified using context: k8s-ai-cluster.",
            severity=SeverityEnum.HIGH,
            evidence=[create_mock_evidence(["kubectl", "config", "current-context"], 0, "k8s-ai-cluster")],
            node=node_name
        ),
        ValidationCheck(
            id="kubernetes.node_readiness",
            category="kubernetes",
            title="Kubernetes Node Status Readiness",
            status=StatusEnum.PASS,
            summary="Kubernetes Node registered as Ready.",
            severity=SeverityEnum.CRITICAL,
            evidence=[create_mock_evidence(["kubectl", "get", "nodes"], 0, "node-1  Ready")],
            node=node_name
        ),
        ValidationCheck(
            id="kubernetes.gpu_operator",
            category="kubernetes",
            title="NVIDIA GPU Operator and Device Plugins",
            status=StatusEnum.PASS,
            summary="All GPU Operator daemonsets (driver, device-plugin) are healthy.",
            severity=SeverityEnum.HIGH,
            evidence=[create_mock_evidence(["kubectl", "get", "daemonsets", "-n", "gpu-operator-resources"], 0, "nvidia-device-plugin-daemonset  Ready 4/4")],
            node=node_name
        )
    ]
    categories["kubernetes"] = ValidationCategory(id="kubernetes", name="Kubernetes & Orchestration", weight=DEFAULT_WEIGHTS["kubernetes"], checks=kube_checks)

    return categories


def get_healthy_scenario() -> Cluster:
    """Creates a fully operational and ready 4-node cluster."""
    nodes = []
    for node_name in ["dgx01", "dgx02", "dgx03", "dgx04"]:
        node_categories = generate_base_categories(node_name, healthy=True)
        nodes.append(Node(
            name=node_name,
            ip_address=f"10.110.0.{10+len(nodes)}",
            categories=node_categories
        ))
        
    return Cluster(
        name="nvis-interview-demo",
        nodes=nodes,
        metadata={"execution_mode": "Demonstration - Healthy Scenario"}
    )


def get_degraded_scenario() -> Cluster:
    """
    Creates a degraded 4-node cluster matching the precise interview criteria:
    - dgx01 and dgx02 healthy.
    - dgx03 has a degraded InfiniBand port link speed.
    - dgx04 has:
        1. GPU 5 uncorrectable ECC error (critical).
        2. Slurm state is DRAINED (critical).
        3. Kubernetes GPU Operator device plugin warning (warning).
    - Storage is healthy.
    """
    nodes = []
    
    # Node 1: dgx01 - Healthy
    node_categories = generate_base_categories("dgx01")
    nodes.append(Node(name="dgx01", ip_address="10.110.0.11", categories=node_categories))

    # Node 2: dgx02 - Healthy
    node_categories = generate_base_categories("dgx02")
    nodes.append(Node(name="dgx02", ip_address="10.110.0.12", categories=node_categories))

    # Node 3: dgx03 - Degraded InfiniBand Link Speed
    node_categories = generate_base_categories("dgx03")
    # Modify Network / IB speed check
    ib_speed_check = node_categories["network"].checks[2]
    ib_speed_check.status = StatusEnum.WARNING
    ib_speed_check.summary = "Port 1 negotiated at NDR 200Gb/s speed (2x width instead of 4x width). Interconnect is physically degraded."
    ib_speed_check.recommendation = "The InfiniBand port is operating below the expected link rate. Verify cable health, switch port configuration, firmware compatibility, negotiated link width, and port speed."
    ib_speed_check.evidence = [create_mock_evidence(["ibstat"], 0, "Port 1:\n\tState: Active\n\tPhysical state: LinkUp\n\tRate: 200\n\tWidth: 2x (Expected 4x)")]
    
    nodes.append(Node(name="dgx03", ip_address="10.110.0.13", categories=node_categories))

    # Node 4: dgx04 - Multi-level Degraded hardware / orchestrator
    node_categories = generate_base_categories("dgx04")
    
    # 4.1. GPU 5 uncorrectable ECC error (critical)
    ecc_check = node_categories["gpu"].checks[2]
    ecc_check.status = StatusEnum.FAIL
    ecc_check.summary = "GPU 5 reported 12 uncorrectable ECC double-bit physical memory errors."
    ecc_check.recommendation = "Drain the node from production scheduling, preserve NVIDIA and kernel diagnostic evidence, run DCGM diagnostics, confirm whether the ECC condition is repeatable, and escalate for hardware support if the error persists."
    ecc_check.evidence = [create_mock_evidence(["nvidia-smi", "-q"], 0, "GPU 00000000:0F:00.0\n\tECC Errors\n\t\tVolatile\n\t\t\tSRAM Uncorrectable: 0\n\t\t\tDouble Bit Uncorrectable: 12")]
    
    # 4.2. Slurm node is DRAINED (critical)
    slurm_node_check = node_categories["slurm"].checks[2]
    slurm_node_check.status = StatusEnum.FAIL
    slurm_node_check.summary = "Node state: DRAINED (Reason: GPU 5 uncorrectable ECC error reported by health check daemon)"
    slurm_node_check.recommendation = "Inspect slurmd log files for registration errors. Resume the node into scheduling: 'scontrol update nodename=dgx04 state=resume reason=restored'."
    slurm_node_check.evidence = [create_mock_evidence(["sinfo", "-N", "-l"], 0, "NODELIST   NODES   PARTITION   STATE    REASON\ndgx04       1       gpu*        drain    GPU 5 uncorrectable ECC error")]

    # 4.3. Kubernetes GPU Operator warning (warning)
    k8s_operator_check = node_categories["kubernetes"].checks[3]
    k8s_operator_check.status = StatusEnum.WARNING
    k8s_operator_check.summary = "DaemonSet 'nvidia-device-plugin-daemonset' reports 3/4 healthy pods. Pod 'nvidia-device-plugin-dgx04' is CrashLoopBackOff."
    k8s_operator_check.recommendation = "Inspect GPU Operator resource pod logs: 'kubectl logs -n gpu-operator-resources -l app=nvidia-device-plugin-daemonset'."
    k8s_operator_check.evidence = [create_mock_evidence(["kubectl", "get", "daemonsets", "-n", "gpu-operator-resources"], 0, "NAME                             DESIRED   CURRENT   READY   UP-TO-DATE   AVAILABLE\nnvidia-device-plugin-daemonset   4         4         3       4            3")]

    nodes.append(Node(name="dgx04", ip_address="10.110.0.14", categories=node_categories))

    return Cluster(
        name="nvis-interview-demo",
        nodes=nodes,
        metadata={"execution_mode": "Demonstration - Degraded Scenario"}
    )
