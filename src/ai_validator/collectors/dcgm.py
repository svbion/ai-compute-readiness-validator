from typing import List
from ai_validator.models import ValidationCheck, StatusEnum, SeverityEnum
from ai_validator.collectors.base import BaseCollector
from ai_validator.runner import CommandRunner

class DcgmCollector(BaseCollector):
    """Collects and validates NVIDIA Data Center GPU Manager (DCGM) engine diagnostics and health monitors."""

    def collect(self, node_name: str) -> List[ValidationCheck]:
        checks = []

        # Check if dcgmi is present
        dcgmi_present = CommandRunner.run_command(["which", "dcgmi"])
        has_dcgm = (dcgmi_present.exit_code == 0)

        dcgm_status = StatusEnum.PASS if has_dcgm else StatusEnum.SKIPPED
        dcgm_summary = "NVIDIA DCGM utility is available on this system." if has_dcgm else "NVIDIA DCGM daemon/utility (dcgmi) is missing or not configured (optional for basic GPU operation)."
        dcgm_rec = None if has_dcgm else "Install NVIDIA DCGM to enable continuous background hardware monitoring and detailed telemetry integration in production environments."

        checks.append(ValidationCheck(
            id="gpu.dcgm_present",
            category="gpu",
            title="NVIDIA DCGM Diagnostics Support",
            status=dcgm_status,
            severity=SeverityEnum.LOW,
            summary=dcgm_summary,
            evidence=[dcgmi_present] if has_dcgm else [],
            recommendation=dcgm_rec,
            node=node_name
        ))

        # If DCGM is not present, skip dcgm health and diag
        if not has_dcgm:
            for check_id, title in [
                ("gpu.dcgm_health", "NVIDIA DCGM Active Health Engine"),
                ("gpu.dcgm_diag", "NVIDIA DCGM On-Demand Diagnostics")
            ]:
                checks.append(ValidationCheck(
                    id=check_id,
                    category="gpu",
                    title=title,
                    status=StatusEnum.UNAVAILABLE,
                    severity=SeverityEnum.LOW,
                    summary="DCGM engine checks are unavailable because dcgmi is missing.",
                    evidence=[],
                    recommendation="Enable NVIDIA DCGM to utilize advanced hardware health checks.",
                    node=node_name
                ))
            return checks

        # If dcgmi is available, execute passive health checks only. Intrusive
        # diagnostics such as dcgmi diag -r 2/-r 3 are intentionally left to a
        # future explicit opt-in workflow.
        health_cmd = CommandRunner.run_command(["dcgmi", "health", "-c"])

        # Health check
        health_status = StatusEnum.PASS
        health_summary = "All monitored DCGM hardware subsystems are reported as healthy."
        health_rec = None

        if health_cmd.exit_code != 0:
            health_status = StatusEnum.WARNING
            health_summary = "DCGM health inspection reported warnings or errors."
            health_rec = "Run 'dcgmi health -s' to check specific sub-system states and identify thermal, memory, or power throttling conditions."

        checks.append(ValidationCheck(
            id="gpu.dcgm_health",
            category="gpu",
            title="NVIDIA DCGM Active Health Engine",
            status=health_status,
            severity=SeverityEnum.MEDIUM,
            summary=health_summary,
            evidence=[health_cmd],
            recommendation=health_rec,
            node=node_name
        ))

        checks.append(ValidationCheck(
            id="gpu.dcgm_diag",
            category="gpu",
            title="NVIDIA DCGM On-Demand Diagnostics",
            status=StatusEnum.SKIPPED,
            severity=SeverityEnum.HIGH,
            summary="Active DCGM diagnostics were not executed. This validator pass is read-only by default.",
            evidence=[],
            recommendation="Use a future explicit opt-in workflow for active DCGM diagnostics after draining workloads and obtaining maintenance approval.",
            node=node_name
        ))

        return checks
