import os
from typing import List
from ai_validator.models import ValidationCheck, StatusEnum, SeverityEnum
from ai_validator.collectors.base import BaseCollector
from ai_validator.runner import CommandRunner
from ai_validator.config import COMMANDS

class LinuxCollector(BaseCollector):
    """Collects and evaluates Linux operating system, kernel, CPU, and memory topology."""

    def collect(self, node_name: str) -> List[ValidationCheck]:
        checks = []

        # 1. OS Check (os_release or uname)
        os_cmd = CommandRunner.run_command(["cat", "/etc/os-release"])
        os_status = StatusEnum.PASS
        os_summary = "RHEL or Ubuntu compatible enterprise OS detected."
        os_rec = None
        
        if os_cmd.exit_code != 0:
            uname_cmd = CommandRunner.run_command(["uname", "-s"])
            if "Darwin" in uname_cmd.stdout:
                os_status = StatusEnum.WARNING
                os_summary = f"macOS detected ({uname_cmd.stdout.strip()}). Non-Linux environments are supported in Demonstration Mode only."
                os_rec = "For live AI compute execution, use an enterprise Linux distribution such as Ubuntu 22.04+ or Red Hat Enterprise Linux 8/9."
            else:
                os_status = StatusEnum.UNAVAILABLE
                os_summary = "Operating system release details are inaccessible or command failed."
                os_rec = "Verify access to /etc/os-release and that basic shell commands can be executed."
        else:
            # Parse distribution
            stdout_lower = os_cmd.stdout.lower()
            if "ubuntu" in stdout_lower:
                os_summary = "Ubuntu Linux detected. Fully compatible with enterprise AI workloads."
            elif "rhel" in stdout_lower or "redhat" in stdout_lower or "centos" in stdout_lower or "rocky" in stdout_lower:
                os_summary = "Red Hat compatible Linux distribution detected. Fully compatible with enterprise AI workloads."
            else:
                os_status = StatusEnum.WARNING
                os_summary = "Non-standard Linux distribution detected."
                os_rec = "Verify OS alignment with NVIDIA GPU Operator and Slurm driver support matrix."

        checks.append(ValidationCheck(
            id="linux.os_version",
            category="linux",
            title="Operating System Compatibility",
            status=os_status,
            severity=SeverityEnum.MEDIUM,
            summary=os_summary,
            evidence=[os_cmd] if os_cmd.exit_code == 0 else [],
            recommendation=os_rec,
            node=node_name
        ))

        # 2. Memory Swapping Check
        mem_cmd = CommandRunner.run_command(["cat", "/proc/swaps"])
        swap_status = StatusEnum.PASS
        swap_summary = "Operating system memory swapping is disabled (recommended for high-performance workloads)."
        swap_rec = None
        
        if mem_cmd.exit_code == 0:
            lines = mem_cmd.stdout.strip().split("\n")
            if len(lines) > 1: # Header + swaps list
                swap_status = StatusEnum.WARNING
                swap_summary = "Active swap memory detected. Memory swapping can degrade latency during multi-node AI model training."
                swap_rec = "Disable swapping permanently by running 'swapoff -a' and editing '/etc/fstab' to remove any swap partition configurations."
        else:
            swap_status = StatusEnum.UNKNOWN
            swap_summary = "Unable to determine swap memory configuration."

        checks.append(ValidationCheck(
            id="linux.swap_disabled",
            category="linux",
            title="System Swapping Allocation",
            status=swap_status,
            severity=SeverityEnum.LOW,
            summary=swap_summary,
            evidence=[mem_cmd] if mem_cmd.exit_code == 0 else [],
            recommendation=swap_rec,
            node=node_name
        ))

        # 3. Huge Pages Configuration
        huge_cmd = CommandRunner.run_command(["cat", "/proc/meminfo"])
        huge_status = StatusEnum.PASS
        huge_summary = "Huge Pages memory configuration is validated."
        huge_rec = None
        
        if huge_cmd.exit_code == 0:
            # Search for HugePages_Total
            total_hp = 0
            for line in huge_cmd.stdout.split("\n"):
                if "HugePages_Total:" in line:
                    try:
                        total_hp = int(line.split()[1])
                    except (ValueError, IndexError):
                        pass
            if total_hp == 0:
                huge_status = StatusEnum.WARNING
                huge_summary = "No pre-allocated Huge Pages detected. Huge Pages (2MB/1GB) improve NUMA-aware memory allocation and speed up training."
                huge_rec = "Configure Huge Pages allocation in /etc/sysctl.conf (e.g., vm.nr_hugepages=1024) to optimize deep learning performance."
        else:
            huge_status = StatusEnum.UNAVAILABLE
            huge_summary = "Huge Pages details are unavailable on this platform."

        checks.append(ValidationCheck(
            id="linux.hugepages",
            category="linux",
            title="Huge Pages Allocation",
            status=huge_status,
            severity=SeverityEnum.LOW,
            summary=huge_summary,
            evidence=[huge_cmd] if huge_cmd.exit_code == 0 else [],
            recommendation=huge_rec,
            node=node_name
        ))

        # 4. Critical OOM or Hardware Kernels Check
        dmesg_cmd = CommandRunner.run_command(["dmesg", "-T", "--level=err,crit,alert,emerg"])
        dmesg_status = StatusEnum.PASS
        dmesg_summary = "No critical Out Of Memory (OOM) killer occurrences or system hardware faults found in the active kernel ring buffer."
        dmesg_rec = None
        
        if dmesg_cmd.exit_code == 0:
            stdout_lower = dmesg_cmd.stdout.lower()
            if "out of memory" in stdout_lower or "oom-killer" in stdout_lower or "killed process" in stdout_lower:
                dmesg_status = StatusEnum.FAIL
                dmesg_summary = "OOM Killer instances detected in kernel buffer! System memory has been exhausted by active tasks."
                dmesg_rec = "Identify memory-leaking processes, optimize batch sizes of training runs, and verify memory resource limits in your scheduling layer."
            elif "machine check" in stdout_lower or "hardware error" in stdout_lower or "mcelog" in stdout_lower:
                dmesg_status = StatusEnum.FAIL
                dmesg_summary = "System hardware faults / Machine Check Exceptions (MCE) detected in kernel ring buffer."
                dmesg_rec = "Drain the node, preserve diagnostic logs, run hardware-level IPMI/BMCs self-tests, and contact hardware vendor support."
        elif dmesg_cmd.exit_code == 13: # Permission denied (common for non-root dmesg)
            dmesg_status = StatusEnum.SKIPPED
            dmesg_summary = "Access to dmesg was skipped (requires root privileges or kernel.dmesg_restrict=0)."
        else:
            dmesg_status = StatusEnum.UNAVAILABLE
            dmesg_summary = "Unable to read kernel ring buffer messages."

        checks.append(ValidationCheck(
            id="linux.kernel_errors",
            category="linux",
            title="Kernel Logs Integrity",
            status=dmesg_status,
            severity=SeverityEnum.CRITICAL,
            summary=dmesg_summary,
            evidence=[dmesg_cmd] if dmesg_cmd.exit_code in (0, 13) else [],
            recommendation=dmesg_rec,
            node=node_name
        ))

        return checks
