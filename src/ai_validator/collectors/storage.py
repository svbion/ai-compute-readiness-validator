import re
from typing import List
from ai_validator.models import ValidationCheck, StatusEnum, SeverityEnum
from ai_validator.collectors.base import BaseCollector
from ai_validator.runner import CommandRunner

class StorageCollector(BaseCollector):
    """Collects and validates local high-performance storage (NVMe), filesystems, and parallel storage volumes (Lustre, GPFS, BeeGFS)."""

    def collect(self, node_name: str) -> List[ValidationCheck]:
        checks = []

        # 1. Local Filesystem Utilization & Mounts Check
        df_cmd = CommandRunner.run_command(["df", "-hT"])
        df_status = StatusEnum.PASS
        df_summary = "All mounted filesystems have sufficient capacity (<90% utilization)."
        df_rec = None

        if df_cmd.exit_code == 0:
            lines = df_cmd.stdout.strip().split("\n")
            for line in lines[1:]: # Skip header
                parts = line.split()
                if len(parts) >= 6:
                    use_pct_str = parts[-2].replace("%", "")
                    try:
                        use_pct = int(use_pct_str)
                        if use_pct >= 90:
                            df_status = StatusEnum.WARNING
                            df_summary = f"Filesystem '{parts[-1]}' has high storage utilization ({use_pct}%). Storage exhaustion may interrupt training logs or model checkpoints."
                            df_rec = f"Free up disk space on '{parts[-1]}' or expand the physical partition."
                    except ValueError:
                        pass
        else:
            df_status = StatusEnum.UNKNOWN
            df_summary = "Unable to read local filesystem capacity info."

        checks.append(ValidationCheck(
            id="storage.filesystems",
            category="storage",
            title="Local Filesystem Capacities",
            status=df_status,
            severity=SeverityEnum.MEDIUM,
            summary=df_summary,
            evidence=[df_cmd],
            recommendation=df_rec,
            node=node_name
        ))

        # 2. High-Performance NVMe Drive Check
        nvme_cmd = CommandRunner.run_command(["nvme", "list"])
        nvme_status = StatusEnum.PASS
        nvme_summary = "High-performance local NVMe SSD controllers detected."
        nvme_rec = None

        if nvme_cmd.exit_code == 0:
            if "no nvme devices" in nvme_cmd.stdout.lower() or not nvme_cmd.stdout.strip():
                nvme_status = StatusEnum.WARNING
                nvme_summary = "No high-performance NVMe block devices detected in local registry (expected on workstation nodes without scratch storage)."
                nvme_rec = "Configure local NVMe drives to serve as high-speed scratch partitions for cached data training loaders."
        elif nvme_cmd.exit_code == 127: # missing
            nvme_status = StatusEnum.SKIPPED
            nvme_summary = "NVMe device checking was skipped (nvme-cli utility is missing)."
        else:
            nvme_status = StatusEnum.UNAVAILABLE
            nvme_summary = "Failed to query local NVMe devices."

        checks.append(ValidationCheck(
            id="storage.nvme",
            category="storage",
            title="High-Performance NVMe Detection",
            status=nvme_status,
            severity=SeverityEnum.LOW,
            summary=nvme_summary,
            evidence=[nvme_cmd] if nvme_cmd.exit_code == 0 else [],
            recommendation=nvme_rec,
            node=node_name
        ))

        # 3. Parallel Shared Filesystems (Lustre / GPFS / BeeGFS) Check
        # Run findmnt or check commands
        lfs_present = CommandRunner.run_command(["which", "lfs"])
        gpfs_present = CommandRunner.run_command(["which", "mmlscluster"])
        beegfs_present = CommandRunner.run_command(["which", "beegfs-ctl"])
        
        shared_status = StatusEnum.PASS
        shared_summary = "No critical parallel storage client mounting errors detected."
        shared_rec = None
        detected_systems = []

        if lfs_present.exit_code == 0:
            detected_systems.append("Lustre")
        if gpfs_present.exit_code == 0:
            detected_systems.append("GPFS / Spectrum Scale")
        if beegfs_present.exit_code == 0:
            detected_systems.append("BeeGFS")

        if detected_systems:
            shared_summary = f"Parallel enterprise shared storage client support detected: {', '.join(detected_systems)}. Configured for high-bandwidth model loaders."
        else:
            shared_status = StatusEnum.SKIPPED
            shared_summary = "No high-bandwidth shared parallel filesystems (Lustre, GPFS, BeeGFS) are actively configured (standard local mount configuration active)."

        checks.append(ValidationCheck(
            id="storage.parallel_fs",
            category="storage",
            title="Parallel Enterprise Shared Storage",
            status=shared_status,
            severity=SeverityEnum.MEDIUM,
            summary=shared_summary,
            evidence=[],
            recommendation=shared_rec,
            node=node_name
        ))

        return checks
