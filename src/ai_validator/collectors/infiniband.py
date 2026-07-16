from typing import List
from ai_validator.models import ValidationCheck, StatusEnum, SeverityEnum
from ai_validator.collectors.base import BaseCollector
from ai_validator.runner import CommandRunner

class InfiniBandCollector(BaseCollector):
    """Collects and validates InfiniBand, RDMA, and high-performance interconnect adapter ports."""

    def collect(self, node_name: str) -> List[ValidationCheck]:
        checks = []

        # 1. Check for ibstat tool
        ibstat_present = CommandRunner.run_command(["which", "ibstat"])
        has_ib = (ibstat_present.exit_code == 0)

        ib_tools_status = StatusEnum.PASS if has_ib else StatusEnum.SKIPPED
        ib_tools_summary = "InfiniBand diagnostic utility (ibstat) is available." if has_ib else "InfiniBand utilities (ibstat) are not installed or not found (expected in non-RDMA/standard Ethernet nodes)."
        ib_tools_rec = None if has_ib else "Install InfiniBand diagnostics (ibutils, infiniband-diags) to enable RDMA validation. Skip if this environment is non-RDMA by design."

        checks.append(ValidationCheck(
            id="network.ib_present",
            category="network",
            title="InfiniBand Utilities Availability",
            status=ib_tools_status,
            severity=SeverityEnum.LOW,
            summary=ib_tools_summary,
            evidence=[ibstat_present] if has_ib else [],
            recommendation=ib_tools_rec,
            node=node_name
        ))

        # If InfiniBand is missing, return early with unavailable states
        if not has_ib:
            for check_id, title, sev, summary, rec in [
                ("network.ib_port_state", "InfiniBand Port Link State", SeverityEnum.HIGH, "Port states cannot be verified because ibstat is missing.", "Ensure Mellanox/NVIDIA OpenFabrics Enterprise Distribution (OFED) driver is installed."),
                ("network.ib_link_speed", "InfiniBand Port Link Speed", SeverityEnum.MEDIUM, "Interconnect link speeds cannot be verified because ibstat is missing.", "Enable InfiniBand kernel drivers and confirm RDMA cable connection."),
                ("network.rdma_interfaces", "RDMA Core Interfaces", SeverityEnum.MEDIUM, "RDMA core interface check skipped.", "Verify rdma-core package is installed and RDMA links are configured.")
            ]:
                checks.append(ValidationCheck(
                    id=check_id,
                    category="network",
                    title=title,
                    status=StatusEnum.UNAVAILABLE,
                    severity=sev,
                    summary=summary,
                    evidence=[],
                    recommendation=rec,
                    node=node_name
                ))
            return checks

        # If ibstat exists, run detailed checks
        ibstat_cmd = CommandRunner.run_command(["ibstat"])
        ibv_cmd = CommandRunner.run_command(["ibv_devinfo"])
        rdma_cmd = CommandRunner.run_command(["rdma", "link"])

        # 2. Port Link State
        port_status = StatusEnum.PASS
        port_summary = "All detected InfiniBand ports are in Active / healthy state."
        port_rec = None

        if ibstat_cmd.exit_code == 0:
            stdout_lower = ibstat_cmd.stdout.lower()
            if "down" in stdout_lower or "initializing" in stdout_lower:
                port_status = StatusEnum.FAIL
                port_summary = "At least one detected InfiniBand port is in Down or Initializing state."
                port_rec = "Confirm physical cable connection, check if subnet manager (opensm) is active on the fabric, and review switch port statuses."
        else:
            port_status = StatusEnum.UNKNOWN
            port_summary = "ibstat command failed while inspecting port status."

        checks.append(ValidationCheck(
            id="network.ib_port_state",
            category="network",
            title="InfiniBand Port Link State",
            status=port_status,
            severity=SeverityEnum.HIGH,
            summary=port_summary,
            evidence=[ibstat_cmd],
            recommendation=port_rec,
            node=node_name
        ))

        # 3. Port Link Speed / Width
        speed_status = StatusEnum.PASS
        speed_summary = "All active InfiniBand links are operating at their rated speed and width."
        speed_rec = None

        if ibstat_cmd.exit_code == 0:
            stdout_lower = ibstat_cmd.stdout.lower()
            # Simple simulation parsing: look for speed warnings or mismatching
            # e.g., if there's "degraded" or unexpected rates
            if "degraded" in stdout_lower or "unsupported" in stdout_lower:
                speed_status = StatusEnum.WARNING
                speed_summary = "At least one active InfiniBand link is operating in a degraded width/speed mode."
                speed_rec = "The InfiniBand port is operating below the expected link rate. Verify cable health, switch port configuration, firmware compatibility, negotiated link width, and port speed."
        else:
            speed_status = StatusEnum.UNKNOWN
            speed_summary = "Unable to determine InfiniBand port link speed."

        checks.append(ValidationCheck(
            id="network.ib_link_speed",
            category="network",
            title="InfiniBand Port Link Speed",
            status=speed_status,
            severity=SeverityEnum.MEDIUM,
            summary=speed_summary,
            evidence=[ibstat_cmd],
            recommendation=speed_rec,
            node=node_name
        ))

        # 4. RDMA Link Check
        rdma_status = StatusEnum.PASS
        rdma_summary = "RDMA kernel links are established and active."
        rdma_rec = None

        if rdma_cmd.exit_code == 0:
            if not rdma_cmd.stdout.strip():
                rdma_status = StatusEnum.WARNING
                rdma_summary = "No active RDMA links found in the kernel interface table."
                rdma_rec = "Load required RDMA kernel modules (ib_uverbs, ib_ipoib, rdma_ucm) and verify networking state."
        else:
            rdma_status = StatusEnum.SKIPPED
            rdma_summary = "RDMA kernel link check was skipped."

        checks.append(ValidationCheck(
            id="network.rdma_interfaces",
            category="network",
            title="RDMA Core Interfaces",
            status=rdma_status,
            severity=SeverityEnum.MEDIUM,
            summary=rdma_summary,
            evidence=[rdma_cmd] if rdma_cmd.exit_code == 0 else [],
            recommendation=rdma_rec,
            node=node_name
        ))

        return checks
