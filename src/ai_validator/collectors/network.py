import re
from typing import List
from ai_validator.models import ValidationCheck, StatusEnum, SeverityEnum
from ai_validator.collectors.base import BaseCollector
from ai_validator.runner import CommandRunner

class NetworkCollector(BaseCollector):
    """Collects and validates standard network interfaces, link states, IP routings, and packet drops."""

    def collect(self, node_name: str) -> List[ValidationCheck]:
        checks = []

        # 1. IP Link Interface State Check
        ip_link_cmd = CommandRunner.run_command(["ip", "-s", "link"])
        link_status = StatusEnum.PASS
        link_summary = "All active Ethernet network links are online and operational."
        link_rec = None

        if ip_link_cmd.exit_code == 0:
            stdout_lower = ip_link_cmd.stdout.lower()
            # Simple check for DOWN state interfaces
            if "state down" in stdout_lower:
                # We can check if it's an interface that matters, let's trigger a warning
                link_status = StatusEnum.WARNING
                link_summary = "At least one detected network interface is in a DOWN / inactive link state."
                link_rec = "Bring up the offline interface: 'ip link set dev <interface> up' or check physical cabling."
        else:
            link_status = StatusEnum.UNAVAILABLE
            link_summary = "Failed to run 'ip link' command."

        checks.append(ValidationCheck(
            id="network.interfaces",
            category="network",
            title="Network Link Interface State",
            status=link_status,
            severity=SeverityEnum.MEDIUM,
            summary=link_summary,
            evidence=[ip_link_cmd] if ip_link_cmd.exit_code == 0 else [],
            recommendation=link_rec,
            node=node_name
        ))

        # 2. IP Routing Table Check
        ip_route_cmd = CommandRunner.run_command(["ip", "route"])
        route_status = StatusEnum.PASS
        route_summary = "Default gateway routing table is configured."
        route_rec = None

        if ip_route_cmd.exit_code == 0:
            if "default" not in ip_route_cmd.stdout:
                route_status = StatusEnum.WARNING
                route_summary = "No active default gateway route detected in the routing tables."
                route_rec = "Add default gateway route using 'ip route add default via <gateway_ip> dev <interface>'."
        else:
            route_status = StatusEnum.UNAVAILABLE
            route_summary = "Failed to fetch kernel routing configuration."

        checks.append(ValidationCheck(
            id="network.routing",
            category="network",
            title="Network IP Routing Table",
            status=route_status,
            severity=SeverityEnum.MEDIUM,
            summary=route_summary,
            evidence=[ip_route_cmd] if ip_route_cmd.exit_code == 0 else [],
            recommendation=route_rec,
            node=node_name
        ))

        # 3. Packet Drop & Interface Error Check
        drop_status = StatusEnum.PASS
        drop_summary = "All interfaces show healthy stats with 0 packet drops or receiver errors."
        drop_rec = None

        if ip_link_cmd.exit_code == 0:
            # Check for non-zero errors or dropped packets
            # Search for "errors" or "dropped" with non-zero values in the stdout
            errors_match = re.search(r"(errors|dropped)\s+([1-9]\d*)", ip_link_cmd.stdout)
            if errors_match:
                err_type = errors_match.group(1)
                err_val = errors_match.group(2)
                drop_status = StatusEnum.WARNING
                drop_summary = f"Detected {err_val} packet {err_type} on network interfaces! High packet loss will degrade RDMA throughput."
                drop_rec = "Inspect interface stats with 'ethtool -S <interface>' and investigate switch port configuration or network congestion."
        else:
            drop_status = StatusEnum.UNKNOWN
            drop_summary = "Skipped check for interface drops/errors."

        checks.append(ValidationCheck(
            id="network.link_health",
            category="network",
            title="Interface Link Dropped Packets",
            status=drop_status,
            severity=SeverityEnum.MEDIUM,
            summary=drop_summary,
            evidence=[ip_link_cmd] if ip_link_cmd.exit_code == 0 else [],
            recommendation=drop_rec,
            node=node_name
        ))

        return checks
