from __future__ import annotations

import os
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace
from typing import Callable, Any

class UnsupportedCommand(ValueError):
    pass

@dataclass(frozen=True)
class CommandDefinition:
    type: str
    argv: list[str]
    timeout_seconds: int
    max_stdout_bytes: int
    max_stderr_bytes: int

DEFAULT_STDOUT = 65_536
DEFAULT_STDERR = 16_384
COMMANDS: dict[str, CommandDefinition] = {
    "nvidia_smi_list": CommandDefinition("nvidia_smi_list", ["nvidia-smi", "-L"], 20, DEFAULT_STDOUT, DEFAULT_STDERR),
    "nvidia_smi_inventory": CommandDefinition("nvidia_smi_inventory", ["nvidia-smi", "--query-gpu=index,name,uuid,memory.total,driver_version,pci.bus_id", "--format=csv,noheader,nounits"], 20, DEFAULT_STDOUT, DEFAULT_STDERR),
    "nvidia_smi_topology": CommandDefinition("nvidia_smi_topology", ["nvidia-smi", "topo", "-m"], 20, DEFAULT_STDOUT, DEFAULT_STDERR),
    "cuda_version": CommandDefinition("cuda_version", ["nvcc", "--version"], 10, 8192, 8192),
    "driver_version": CommandDefinition("driver_version", ["nvidia-smi", "--query-gpu=driver_version", "--format=csv,noheader"], 10, 8192, 8192),
    "pytorch_gpu_count": CommandDefinition("pytorch_gpu_count", ["python3", "-c", "import torch; print(torch.cuda.device_count())"], 20, 8192, 8192),
    "nccl_all_reduce_smoke": CommandDefinition("nccl_all_reduce_smoke", ["all_reduce_perf"], 120, DEFAULT_STDOUT, DEFAULT_STDERR),
}

def _run(argv: list[str], timeout: int = 5):
    try:
        return subprocess.run(argv, capture_output=True, text=True, timeout=timeout, shell=False)
    except FileNotFoundError:
        return SimpleNamespace(returncode=127, stdout="", stderr=f"{argv[0]} not found")
    except Exception as exc:
        return SimpleNamespace(returncode=1, stdout="", stderr=str(exc))

def _safe_configured_nccl_path() -> str | None:
    configured = os.environ.get("GPUVALIDATOR_NCCL_TESTS_PATH", "").strip()
    if not configured:
        return None
    path = Path(configured).expanduser()
    candidates = [path] if path.name == "all_reduce_perf" else [path / "all_reduce_perf", path / "build" / "all_reduce_perf"]
    for candidate in candidates:
        try:
            resolved = candidate.resolve(strict=False)
        except Exception:
            continue
        if resolved.is_file() and os.access(resolved, os.X_OK):
            return str(resolved)
    return None

def detect_nccl_all_reduce(runner: Callable | None = None) -> dict[str, Any]:
    executable = _safe_configured_nccl_path() or shutil.which("all_reduce_perf")
    gpu_res = (runner or _run)(COMMANDS["nvidia_smi_list"].argv, timeout=5)
    gpu_count = sum(1 for line in str(getattr(gpu_res, "stdout", "")).splitlines() if line.strip().startswith("GPU ")) if getattr(gpu_res, "returncode", 1) == 0 else 0
    version = None
    if executable:
        help_res = (runner or _run)([executable, "--help"], timeout=5)
        text = f"{getattr(help_res, 'stdout', '')}\n{getattr(help_res, 'stderr', '')}"
        import re
        match = re.search(r"NCCL(?:\s+Tests)?(?:\s+version)?\s*[:=]?\s*([0-9][\w.+\-]*)", text, re.I)
        version = match.group(1) if match else None
    return {"available": bool(executable), "executable_path": executable, "nccl_version": version, "visible_gpu_count": gpu_count, "at_least_two_gpus": gpu_count >= 2}

def command_for(command_type: str, server_command: dict | None = None, detector: Callable[[], dict[str, Any]] | None = None) -> CommandDefinition:
    if command_type not in COMMANDS:
        raise UnsupportedCommand(f"Unsupported command type: {command_type}")
    base = COMMANDS[command_type]
    if command_type == "nccl_all_reduce_smoke":
        detected = detector() if detector else detect_nccl_all_reduce()
        if not detected.get("available"):
            return base
        gpu_count = int(detected.get("visible_gpu_count") or 0)
        if gpu_count < 2:
            return base
        executable = str(detected.get("executable_path") or base.argv[0])
        return CommandDefinition(base.type, [executable, "-b", "8M", "-e", "256M", "-f", "2", "-g", str(gpu_count)], base.timeout_seconds, base.max_stdout_bytes, base.max_stderr_bytes)
    if not server_command:
        return base
    argv = server_command.get("argv") or base.argv
    if not isinstance(argv, list) or [str(x) for x in argv] != base.argv:
        return base
    return CommandDefinition(base.type, list(base.argv), int(server_command.get("timeout_seconds") or base.timeout_seconds), int(server_command.get("max_stdout_bytes") or base.max_stdout_bytes), int(server_command.get("max_stderr_bytes") or base.max_stderr_bytes))
