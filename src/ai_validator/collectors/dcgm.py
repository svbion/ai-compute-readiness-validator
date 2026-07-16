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

        # If dcgmi is available, execute health and diagnostics checks
        health_cmd = CommandRunner.run_command(["dcgmi", "health", "-c"])
        diag_cmd = CommandRunner.run_command(["dcgmi", "diag", "-r", "1"])

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

        # Diagnostics check
        diag_status = StatusEnum.PASS
        diag_summary = "Fast read-only DCGM software diagnostic Level 1 tests passed."
        diag_rec = None

        if diag_cmd.exit_code != 0:
            diag_status = StatusEnum.FAIL
            diag_summary = "DCGM Level 1 diagnostics failed. Inter-GPU or memory errors were detected."
            diag_rec = "Isolate the node and run detailed stress diagnostics: 'dcgmi diag -r 2' or 'dcgmi diag -r 3' to confirm PCIe bandwidth, stress, and NVLink stability."

        checks.append(ValidationCheck(
            id="gpu.dcgm_diag",
            category="gpu",
            title="NVIDIA DCGM On-Demand Diagnostics",
            status=diag_status,
            severity=SeverityEnum.HIGH,
            summary=diag_summary,
            evidence=[diag_cmd],
            recommendation=diag_rec,
            node=node_name
        ))

        return checks
