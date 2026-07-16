import os
from typing import Dict, List, Any

# Application Metadata
VERSION = "0.1.0"
APP_NAME = "AI Compute Readiness Validator"

# Default Weights for Categories
DEFAULT_WEIGHTS: Dict[str, float] = {
    "gpu": 30.0,         # NVIDIA GPU, Topologies, and DCGM
    "network": 20.0,     # InfiniBand, RDMA, and standard Network Interfaces
    "linux": 15.0,       # OS, Kernel, Huge Pages, Memory, NUMA
    "slurm": 15.0,       # Scheduler reachability, node status, partition availability
    "storage": 10.0,     # Lustre, GPFS, BeeGFS, local NVMe capacity
    "kubernetes": 10.0,  # GPU Operator, Pod status, DaemonSets, node availability
}

# Readiness Score Classifications
SCORE_READY = 95.0
SCORE_WARN = 85.0
SCORE_REMEDIATE = 70.0

# Execution Configuration
DEFAULT_TIMEOUT_SECONDS = 10.0

# Command Definitions for each category
# Each command is a tuple: (command_id, argument_list, description)
COMMANDS: Dict[str, List[tuple]] = {
    "linux": [
        ("uname", ["uname", "-a"], "Kernel and architecture info"),
        ("os_release", ["cat", "/etc/os-release"], "Operating System distribution info"),
        ("uptime", ["uptime"], "System load averages and uptime"),
        ("cpu_info", ["lscpu"], "Detailed CPU architecture configuration"),
        ("numa", ["numactl", "--hardware"], "NUMA topology and nodes"),
        ("memory", ["free", "-b"], "System physical and swap memory allocation"),
        ("hugepages", ["cat", "/proc/meminfo"], "Detailed kernel memory and huge pages"),
        ("kernel_modules", ["lsmod"], "Loaded Linux kernel modules"),
        ("recent_dmesg", ["dmesg", "-T", "--level=err,crit,alert,emerg"], "Recent critical kernel ring buffer messages"),
    ],
    "gpu": [
        ("nvidia_smi_present", ["which", "nvidia-smi"], "Check if nvidia-smi tool is installed"),
        ("nvidia_smi_gpus", ["nvidia-smi", "-L"], "List detected GPUs and UUIDs"),
        ("nvidia_smi_query", ["nvidia-smi", "-q"], "Detailed query of all GPU attributes"),
        ("nvidia_topo", ["nvidia-smi", "topo", "-m"], "GPU-to-GPU affinity and NVLink topology matrix"),
        ("nvidia_nvlink", ["nvidia-smi", "nvlink", "--status"], "Verify NVLink active port status"),
        ("dcgm_discovery", ["dcgmi", "discovery", "-l"], "List DCGM-managed GPUs"),
        ("dcgm_health", ["dcgmi", "health", "-c"], "Check health status of DCGM entities"),
        ("dcgm_diag", ["dcgmi", "diag", "-r", "1"], "Run fast read-only DCGM diagnostics"),
    ],
    "network": [
        ("ibstat", ["ibstat"], "InfiniBand port status and state"),
        ("ibv_devinfo", ["ibv_devinfo"], "Verbs device capabilities and port physical state"),
        ("rdma_link", ["rdma", "link"], "RDMA links list and active status"),
        ("ibdev2netdev", ["ibdev2netdev"], "Mapping of InfiniBand HCAs to Ethernet network interfaces"),
        ("ip_addr", ["ip", "-d", "addr"], "IP address bindings and flags"),
        ("ip_link", ["ip", "-s", "link"], "Network link statistics including drop counters"),
        ("ip_route", ["ip", "route"], "Primary system routing table"),
    ],
    "slurm": [
        ("sinfo", ["sinfo", "-N", "-l"], "Detailed node and state allocation overview"),
        ("scontrol_ping", ["scontrol", "ping"], "Check if Slurm controller daemon is reachable"),
        ("scontrol_node", ["scontrol", "show", "node"], "Inspect detailed Slurm nodes configuration"),
        ("scontrol_partition", ["scontrol", "show", "partition"], "Check active scheduler partitions"),
        ("scontrol_config", ["scontrol", "show", "config"], "Retrieve Slurm controller configuration details"),
    ],
    "kubernetes": [
        ("kubectl_context", ["kubectl", "config", "current-context"], "Identify current cluster API context"),
        ("kubectl_nodes", ["kubectl", "get", "nodes", "-o", "json"], "Retrieve cluster nodes status and attributes"),
        ("kubectl_pods", ["kubectl", "get", "pods", "-A", "-o", "wide"], "List all failing or standard cluster pods"),
        ("kubectl_daemonsets", ["kubectl", "get", "daemonsets", "-A"], "NVIDIA DaemonSets state across all namespaces"),
        ("gpu_operator_policy", ["kubectl", "get", "clusterpolicies.nvidia.com"], "Check GPU Operator cluster policy configuration"),
    ],
    "storage": [
        ("filesystems", ["df", "-hT"], "List active filesystems, mount points, and capacities"),
        ("block_devices", ["lsblk", "-o", "NAME,SIZE,TYPE,MOUNTPOINTS,MODEL"], "Physical block devices and partition layout"),
        ("nvme_list", ["nvme", "list"], "Detect high-performance local NVMe storage controllers"),
        ("mount_types", ["findmnt"], "Show filesystem tree and active mount protocols"),
        ("lustre_version", ["lfs", "--version"], "Check Lustre parallel storage client support"),
        ("beegfs_version", ["beegfs-ctl", "--version"], "Check BeeGFS parallel storage client support"),
    ]
}
