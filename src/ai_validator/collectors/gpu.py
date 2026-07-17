import os
import re
from typing import List
from ai_validator.models import ValidationCheck, StatusEnum, SeverityEnum
from ai_validator.collectors.base import BaseCollector
from ai_validator.runner import CommandRunner

class GpuCollector(BaseCollector):
    """Collects and validates NVIDIA GPU configuration, driver status, ECC integrity, and topological NVLink connectivity."""

    def collect(self, node_name: str) -> List[ValidationCheck]:
        checks = []

        # 1. Verify nvidia-smi tool exists
        smi_present = CommandRunner.run_command(["which", "nvidia-smi"])
        has_gpu_tools = (smi_present.exit_code == 0)

        # 2. Check GPU Tools Availability
        gpu_tools_status = StatusEnum.PASS if has_gpu_tools else StatusEnum.UNAVAILABLE
        gpu_tools_summary = "NVIDIA System Management Interface (nvidia-smi) utility is available." if has_gpu_tools else "NVIDIA System Management Interface (nvidia-smi) is not installed or not found in system PATH."
        gpu_tools_rec = None if has_gpu_tools else "Ensure the proprietary NVIDIA GPU driver is installed and the utility is added to system PATH. If this system has no NVIDIA hardware, this is expected."

        checks.append(ValidationCheck(
            id="gpu.tools_present",
            category="gpu",
            title="NVIDIA System Management Interface",
            status=gpu_tools_status,
            severity=SeverityEnum.MEDIUM,
            summary=gpu_tools_summary,
            evidence=[smi_present] if has_gpu_tools else [],
            recommendation=gpu_tools_rec,
            node=node_name
        ))

        # If tools are not present, remaining GPU checks are marked unavailable
        if not has_gpu_tools:
            for check_id, title, sev, summary, rec in [
                ("gpu.driver_cuda", "NVIDIA Driver and CUDA Compatibility", SeverityEnum.MEDIUM, "GPU driver and CUDA status cannot be validated because nvidia-smi is missing.", "Install official NVIDIA enterprise drivers and CUDA toolkit."),
                ("gpu.ecc_errors", "NVIDIA GPU Hardware ECC Integrity", SeverityEnum.CRITICAL, "ECC memory diagnostics cannot be performed because nvidia-smi is missing.", "Ensure GPU hardware is available and NVIDIA management drivers are running."),
                ("gpu.nvlink", "NVLink Inter-GPU Connection Status", SeverityEnum.HIGH, "NVLink connectivity details are unavailable because nvidia-smi is missing.", "Confirm NVLink-equipped hardware (such as DGX or HGX systems) and driver initialization.")
            ]:
                checks.append(ValidationCheck(
                    id=check_id,
                    category="gpu",
                    title=title,
                    status=StatusEnum.UNAVAILABLE,
                    severity=sev,
                    summary=summary,
                    evidence=[],
                    recommendation=rec,
                    node=node_name
                ))
            return checks

        # If tools exist, run detailed checks
        smi_gpus = CommandRunner.run_command(["nvidia-smi", "-L"])
        smi_query = CommandRunner.run_command(["nvidia-smi", "-q"])
        smi_topo = CommandRunner.run_command(["nvidia-smi", "topo", "-m"])
        smi_inventory = CommandRunner.run_command(["nvidia-smi", "--query-gpu=index,name,uuid,serial,driver_version,pci.bus_id,temperature.gpu,ecc.errors.uncorrected.volatile.total", "--format=csv,noheader"])

        # 3. Driver & CUDA Check
        driver_status = StatusEnum.PASS
        driver_summary = "NVIDIA Kernel Driver and CUDA toolkit versions are active and verified."
        driver_rec = None

        if smi_query.exit_code == 0:
            driver_ver = ""
            cuda_ver = ""
            for line in smi_query.stdout.split("\n"):
                if "Driver Version" in line:
                    driver_ver = line.split(":")[-1].strip()
                if "CUDA Version" in line:
                    cuda_ver = line.split(":")[-1].strip()
            driver_summary = f"NVIDIA driver v{driver_ver} with CUDA v{cuda_ver} detected."
        else:
            driver_status = StatusEnum.WARNING
            driver_summary = "nvidia-smi was found, but query of GPU driver details failed."
            driver_rec = "Verify that the NVIDIA kernel modules are loaded and that nvidia-smi has correct access permissions."

        checks.append(ValidationCheck(
            id="gpu.driver_cuda",
            category="gpu",
            title="NVIDIA Driver and CUDA Compatibility",
            status=driver_status,
            severity=SeverityEnum.MEDIUM,
            summary=driver_summary,
            evidence=[cmd for cmd in [smi_query, smi_inventory] if cmd.exit_code == 0],
            recommendation=driver_rec,
            node=node_name
        ))

        # 4. ECC Integrity Check
        ecc_status = StatusEnum.PASS
        ecc_summary = "All active GPUs report healthy physical registers with 0 uncorrectable ECC errors."
        ecc_rec = None

        if smi_query.exit_code == 0:
            stdout_lower = smi_query.stdout.lower()
            # Check for uncorrectable ECC error flags in output
            # Simple check: search for non-zero values near "uncorrectable" or "ecc"
            uncorrectable_match = re.search(r"uncorrectable.*?:\s*([1-9]\d*)", stdout_lower, re.DOTALL)
            if "uncorrectable" in stdout_lower and uncorrectable_match:
                err_count = uncorrectable_match.group(1)
                ecc_status = StatusEnum.FAIL
                ecc_summary = f"Active GPU hardware reports {err_count} uncorrectable ECC errors. This indicates potential physical memory failure!"
                ecc_rec = "Drain the node from production scheduling, preserve NVIDIA and kernel diagnostic evidence, run DCGM diagnostics, confirm whether the ECC condition is repeatable, and escalate for hardware support if the error persists."
        else:
            ecc_status = StatusEnum.UNKNOWN
            ecc_summary = "Hardware ECC error registers are currently unreachable."

        checks.append(ValidationCheck(
            id="gpu.ecc_errors",
            category="gpu",
            title="NVIDIA GPU Hardware ECC Integrity",
            status=ecc_status,
            severity=SeverityEnum.CRITICAL,
            summary=ecc_summary,
            evidence=[cmd for cmd in [smi_query, smi_inventory] if cmd.exit_code == 0],
            recommendation=ecc_rec,
            node=node_name
        ))

        # 5. NVLink Connectivity
        nv_status = StatusEnum.PASS
        nv_summary = "NVLink inter-GPU communication channels are fully active and configured."
        nv_rec = None

        nv_cmd = CommandRunner.run_command(["nvidia-smi", "nvlink", "--status"])
        if nv_cmd.exit_code == 0:
            if "inactive" in nv_cmd.stdout.lower() or "disabled" in nv_cmd.stdout.lower():
                nv_status = StatusEnum.WARNING
                nv_summary = "Certain GPU NVLink ports are reported as inactive or disabled. Inter-GPU peer-to-peer transfers will degrade to PCIe."
                nv_rec = "Check system topologies, check whether NVLink bridges are physically seated correctly, and inspect BIOS/firmware settings for NVLink settings."
        else:
            # If command doesn't exist or fails (which is standard for non-NVLink devices, e.g., standard PCIe cards)
            nv_status = StatusEnum.SKIPPED
            nv_summary = "NVLink status query skipped or unsupported on this GPU architecture (expected on standard PCIe workstations)."

        checks.append(ValidationCheck(
            id="gpu.nvlink",
            category="gpu",
            title="NVLink Inter-GPU Connection Status",
            status=nv_status,
            severity=SeverityEnum.HIGH,
            summary=nv_summary,
            evidence=[cmd for cmd in [nv_cmd, smi_topo] if cmd.exit_code == 0],
            recommendation=nv_rec,
            node=node_name
        ))

        return checks
