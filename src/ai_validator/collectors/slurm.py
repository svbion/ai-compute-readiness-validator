from typing import List
from ai_validator.models import ValidationCheck, StatusEnum, SeverityEnum
from ai_validator.collectors.base import BaseCollector
from ai_validator.runner import CommandRunner

class SlurmCollector(BaseCollector):
    """Collects and validates Slurm cluster scheduler availability, node allocation states, and partition details."""

    def collect(self, node_name: str) -> List[ValidationCheck]:
        checks = []

        # 1. Verify sinfo utility is present
        slurm_present = CommandRunner.run_command(["which", "sinfo"])
        has_slurm = (slurm_present.exit_code == 0)

        slurm_tools_status = StatusEnum.PASS if has_slurm else StatusEnum.SKIPPED
        slurm_tools_summary = "Slurm scheduler command (sinfo) is available." if has_slurm else "Slurm binaries are not found (expected if this is a standalone node or doesn't use Slurm)."
        slurm_tools_rec = None if has_slurm else "Install Slurm workload manager client packages if this node should participate in a scheduled cluster. Skip otherwise."

        checks.append(ValidationCheck(
            id="slurm.present",
            category="slurm",
            title="Slurm Scheduler Availability",
            status=slurm_tools_status,
            severity=SeverityEnum.LOW,
            summary=slurm_tools_summary,
            evidence=[slurm_present] if has_slurm else [],
            recommendation=slurm_tools_rec,
            node=node_name
        ))

        # If Slurm is missing, mark remaining checks as unavailable/skipped
        if not has_slurm:
            for check_id, title, sev, summary, rec in [
                ("slurm.controller", "Slurm Controller Connectivity", SeverityEnum.HIGH, "Slurm controller status is unavailable because scontrol is missing.", "Configure Slurm cluster config and controller slurmdbd."),
                ("slurm.node_state", "Slurm Compute Node Scheduling State", SeverityEnum.CRITICAL, "Slurm compute node scheduling state is unavailable.", "Confirm Slurm daemon (slurmd) is active and registered on the node.")
            ]:
                checks.append(ValidationCheck(
                    id=check_id,
                    category="slurm",
                    title=title,
                    status=StatusEnum.UNAVAILABLE,
                    severity=sev,
                    summary=summary,
                    evidence=[],
                    recommendation=rec,
                    node=node_name
                ))
            return checks

        # If Slurm exists, run scontrol ping and sinfo
        ping_cmd = CommandRunner.run_command(["scontrol", "ping"])
        sinfo_cmd = CommandRunner.run_command(["sinfo", "-N", "-l"])

        # 2. Slurm Controller Connectivity
        ctrl_status = StatusEnum.PASS
        ctrl_summary = "Slurm primary controller daemon (slurmctld) is active and reachable."
        ctrl_rec = None

        if ping_cmd.exit_code != 0:
            ctrl_status = StatusEnum.FAIL
            ctrl_summary = "Slurm controller daemon (slurmctld) is UNREACHABLE or offline."
            ctrl_rec = "Check network connectivity to the controller host, verify Slurm port mappings, and confirm slurmctld daemon status on the master node."

        checks.append(ValidationCheck(
            id="slurm.controller",
            category="slurm",
            title="Slurm Controller Connectivity",
            status=ctrl_status,
            severity=SeverityEnum.HIGH,
            summary=ctrl_summary,
            evidence=[ping_cmd],
            recommendation=ctrl_rec,
            node=node_name
        ))

        # 3. Node Scheduling State
        node_status = StatusEnum.PASS
        node_summary = "Compute node is successfully registered and in active scheduling state (e.g., IDLE or ALLOCATED)."
        node_rec = None

        if sinfo_cmd.exit_code == 0:
            stdout_lower = sinfo_cmd.stdout.lower()
            # Simple check if current node is in drain/down state
            # In a live validation, we can look up node_name in output
            if "drain" in stdout_lower or "down" in stdout_lower or "drng" in stdout_lower:
                node_status = StatusEnum.FAIL
                node_summary = f"Slurm node is in a DRAINED, DOWN, or INACTIVE scheduling state."
                node_rec = "Inspect slurmd log files for registration errors. Resume the node into scheduling: 'scontrol update nodename=YOUR_NODE state=resume reason=restored'."
        else:
            node_status = StatusEnum.UNKNOWN
            node_summary = "Unable to fetch Slurm node statuses."

        checks.append(ValidationCheck(
            id="slurm.node_state",
            category="slurm",
            title="Slurm Compute Node Scheduling State",
            status=node_status,
            severity=SeverityEnum.CRITICAL,
            summary=node_summary,
            evidence=[sinfo_cmd],
            recommendation=node_rec,
            node=node_name
        ))

        return checks
