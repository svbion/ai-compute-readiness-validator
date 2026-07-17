from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List


@dataclass(frozen=True)
class ValidationProfile:
    id: str
    label: str
    expected_capabilities: List[str]
    notes: str


PROFILES: Dict[str, ValidationProfile] = {
    "auto": ValidationProfile(
        id="auto",
        label="Auto-detected NVIDIA infrastructure",
        expected_capabilities=["linux", "gpu_if_present", "fabric_if_present", "scheduler_if_present", "kubernetes_if_present"],
        notes="Collector output determines available capabilities. Auto selection never proves DGX/HGX identity by itself.",
    ),
    "gpu-workstation": ValidationProfile(
        id="gpu-workstation",
        label="GPU workstation",
        expected_capabilities=["linux", "nvidia_smi", "single_host_gpu"],
        notes="For workstation or desk-side GPU systems. No cluster fabric or scheduler is assumed.",
    ),
    "single-gpu-node": ValidationProfile(
        id="single-gpu-node",
        label="Single GPU server node",
        expected_capabilities=["linux", "nvidia_smi", "gpu_health", "local_storage", "network"],
        notes="For one read-only GPU server validation target.",
    ),
    "dgx-class": ValidationProfile(
        id="dgx-class",
        label="DGX-class expected-capability profile",
        expected_capabilities=["linux", "nvidia_smi", "multi_gpu", "nvlink_or_nvswitch", "dcgm_optional", "high_speed_fabric_optional"],
        notes="Expected-capability profile only. Do not display genuine DGX identity or authenticity unless platform evidence supports it.",
    ),
    "hgx-based": ValidationProfile(
        id="hgx-based",
        label="HGX-based expected-capability profile",
        expected_capabilities=["linux", "nvidia_smi", "multi_gpu", "nvlink_or_nvswitch", "oem_platform_identity"],
        notes="Expected-capability profile only. HGX authenticity requires reliable platform identity evidence.",
    ),
    "oem-gpu-platform": ValidationProfile(
        id="oem-gpu-platform",
        label="OEM GPU platform",
        expected_capabilities=["linux", "nvidia_smi", "gpu_health", "platform_identity"],
        notes="For OEM HGX-like or PCIe GPU platforms without vendor endorsement claims.",
    ),
    "slurm-gpu-cluster": ValidationProfile(
        id="slurm-gpu-cluster",
        label="Slurm GPU cluster",
        expected_capabilities=["linux", "nvidia_smi", "slurm", "node_state", "gpu_health"],
        notes="Scheduler state is read-only and distinguishes intentionally drained nodes from failures when evidence permits.",
    ),
    "kubernetes-gpu-cluster": ValidationProfile(
        id="kubernetes-gpu-cluster",
        label="Kubernetes GPU cluster",
        expected_capabilities=["linux", "nvidia_smi", "kubernetes", "gpu_operator", "device_plugin"],
        notes="Kubernetes evidence is read-only and RBAC-denied commands are reported as limitations.",
    ),
    "ai-factory": ValidationProfile(
        id="ai-factory",
        label="AI Factory validation target",
        expected_capabilities=["linux", "nvidia_smi", "gpu_health", "fabric", "scheduler", "kubernetes", "storage", "benchmarks_ingestable"],
        notes="Broad readiness profile for customer handoff. Selecting it does not imply Live Cluster Infrastructure without live evidence.",
    ),
}


def get_profile(profile_id: str) -> ValidationProfile:
    normalized = profile_id.strip().lower()
    if normalized not in PROFILES:
        supported = ", ".join(sorted(PROFILES))
        raise ValueError(f"Unsupported validation profile '{profile_id}'. Supported profiles: {supported}")
    return PROFILES[normalized]
