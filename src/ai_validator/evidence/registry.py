from __future__ import annotations

from ai_validator.evidence.models import CommandSpec

LINUX_COMMANDS: tuple[CommandSpec, ...] = (
    CommandSpec(id="uname", category="linux", argv=["uname", "-a"], stdout_path="linux/uname.txt", stderr_path="metadata/stderr/linux-uname.stderr.txt", optional=False, description="Kernel and architecture"),
    CommandSpec(id="os-release", category="linux", argv=["cat", "/etc/os-release"], stdout_path="linux/os-release.txt", stderr_path="metadata/stderr/linux-os-release.stderr.txt", optional=False, description="Operating system release"),
    CommandSpec(id="hostnamectl", category="linux", argv=["hostnamectl"], stdout_path="linux/hostnamectl.txt", stderr_path="metadata/stderr/linux-hostnamectl.stderr.txt", description="System hostname metadata"),
    CommandSpec(id="lscpu", category="linux", argv=["lscpu"], stdout_path="linux/lscpu.txt", stderr_path="metadata/stderr/linux-lscpu.stderr.txt", description="CPU topology"),
    CommandSpec(id="lsmem", category="linux", argv=["lsmem"], stdout_path="linux/lsmem.txt", stderr_path="metadata/stderr/linux-lsmem.stderr.txt", description="Memory ranges"),
    CommandSpec(id="lsblk", category="linux", argv=["lsblk"], stdout_path="linux/lsblk.txt", stderr_path="metadata/stderr/linux-lsblk.stderr.txt", description="Block devices"),
    CommandSpec(id="df", category="linux", argv=["df", "-hT"], stdout_path="linux/df.txt", stderr_path="metadata/stderr/linux-df.stderr.txt", description="Filesystem capacity"),
    CommandSpec(id="findmnt", category="linux", argv=["findmnt"], stdout_path="linux/findmnt.txt", stderr_path="metadata/stderr/linux-findmnt.stderr.txt", description="Mount tree"),
    CommandSpec(id="ip-address", category="linux", argv=["ip", "-br", "address"], stdout_path="linux/ip-address.txt", stderr_path="metadata/stderr/linux-ip-address.stderr.txt", description="Brief IP addresses"),
    CommandSpec(id="ip-link", category="linux", argv=["ip", "-s", "link"], stdout_path="linux/ip-link.txt", stderr_path="metadata/stderr/linux-ip-link.stderr.txt", description="Link counters"),
    CommandSpec(id="systemctl-failed", category="linux", argv=["systemctl", "--failed"], stdout_path="linux/systemctl-failed.txt", stderr_path="metadata/stderr/linux-systemctl-failed.stderr.txt", description="Failed systemd units"),
    CommandSpec(id="journal-errors", category="linux", argv=["journalctl", "-p", "err", "-b", "--no-pager", "-n", "500"], stdout_path="linux/journal-errors.txt", stderr_path="metadata/stderr/linux-journal-errors.stderr.txt", description="Bounded boot journal errors"),
)

GPU_COMMANDS: tuple[CommandSpec, ...] = (
    CommandSpec(id="nvidia-smi", category="gpu", argv=["nvidia-smi"], stdout_path="gpu/nvidia-smi.txt", stderr_path="metadata/stderr/gpu-nvidia-smi.stderr.txt", description="NVIDIA SMI summary"),
    CommandSpec(id="nvidia-smi-query", category="gpu", argv=["nvidia-smi", "-q"], stdout_path="gpu/nvidia-smi-query.txt", stderr_path="metadata/stderr/gpu-nvidia-smi-query.stderr.txt", description="NVIDIA SMI full query"),
    CommandSpec(id="topology", category="gpu", argv=["nvidia-smi", "topo", "-m"], stdout_path="gpu/topology.txt", stderr_path="metadata/stderr/gpu-topology.stderr.txt", description="GPU topology"),
    CommandSpec(id="nvlink-status", category="gpu", argv=["nvidia-smi", "nvlink", "--status"], stdout_path="gpu/nvlink-status.txt", stderr_path="metadata/stderr/gpu-nvlink-status.stderr.txt", description="NVLink status"),
    CommandSpec(id="dcgm-discovery", category="gpu", argv=["dcgmi", "discovery", "-l"], stdout_path="gpu/dcgm-discovery.txt", stderr_path="metadata/stderr/gpu-dcgm-discovery.stderr.txt", description="DCGM discovery"),
    CommandSpec(id="dcgm-diag", category="gpu", argv=["dcgmi", "diag", "-r", "1"], stdout_path="gpu/dcgm-diag.txt", stderr_path="metadata/stderr/gpu-dcgm-diag.stderr.txt", diagnostics=True, description="Optional DCGM level 1 diagnostic"),
)

SUPPORTED_PROFILES = {
    "linux-host": ("linux",),
    "gpu-workstation": ("linux", "gpu"),
    "single-gpu-node": ("linux", "gpu"),
    "dgx-class": ("linux", "gpu"),
}


def get_profile_commands(profile: str, *, include_diagnostics: bool = False) -> list[CommandSpec]:
    normalized = profile.strip().lower()
    if normalized not in SUPPORTED_PROFILES:
        supported = ", ".join(sorted(SUPPORTED_PROFILES))
        raise ValueError(f"Unsupported collection profile '{profile}'. Supported profiles: {supported}")

    commands: list[CommandSpec] = []
    categories = SUPPORTED_PROFILES[normalized]
    if "linux" in categories:
        commands.extend(LINUX_COMMANDS)
    if "gpu" in categories:
        commands.extend(
            command
            for command in GPU_COMMANDS
            if include_diagnostics or not command.diagnostics
        )
        if not include_diagnostics:
            commands.append(
                next(command for command in GPU_COMMANDS if command.id == "dcgm-diag").model_copy()
            )
    return commands
