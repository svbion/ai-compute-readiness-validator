from __future__ import annotations

import os
import platform
import socket
import subprocess
from pathlib import Path
from types import SimpleNamespace
from typing import Callable

from . import __version__
from .commands import COMMANDS
from .models import Capability, CapabilitySnapshot
from .parsers import parse_cuda_version, parse_driver_version, parse_nvidia_smi_list

CUDA_VERSION_JSON = Path("/usr/local/cuda/version.json")

def _run(argv: list[str], runner: Callable | None = None):
    runner = runner or (lambda args, **kwargs: subprocess.run(args, capture_output=True, text=True, timeout=kwargs.get("timeout", 5), shell=False))
    try:
        return runner(argv, timeout=5)
    except FileNotFoundError:
        return SimpleNamespace(returncode=127, stdout="", stderr=f"{argv[0]} not found")
    except Exception as exc:
        return SimpleNamespace(returncode=1, stdout="", stderr=str(exc))

def discover_capabilities(runner: Callable | None = None) -> CapabilitySnapshot:
    caps=[]; gpu_count=None; gpu_models=[]
    list_res=_run(COMMANDS["nvidia_smi_list"].argv, runner)
    if list_res.returncode == 0:
        parsed=parse_nvidia_smi_list(list_res.stdout)
        gpu_count=parsed["gpu_count"]; gpu_models=[g.get("model") for g in parsed["gpus"] if g.get("model")]
        caps.extend([Capability("nvidia_smi_list", True, None), Capability("nvidia_smi_inventory", True, None), Capability("nvidia_smi_topology", True, None)])
    else:
        caps.extend([Capability("nvidia_smi_list", False, None), Capability("nvidia_smi_inventory", False, None), Capability("nvidia_smi_topology", False, None)])
    drv=_run(COMMANDS["driver_version"].argv, runner)
    if drv.returncode == 0:
        caps.append(Capability("driver_version", True, parse_driver_version(drv.stdout).get("driver_version")))
    else:
        caps.append(Capability("driver_version", False, None))
    cuda_text=""; cuda_available=False; cuda_version=None
    if CUDA_VERSION_JSON.exists():
        cuda_text=CUDA_VERSION_JSON.read_text(errors="replace"); cuda_available=True
    else:
        nvcc=_run(["nvcc", "--version"], runner)
        if nvcc.returncode == 0:
            cuda_text=nvcc.stdout; cuda_available=True
        elif list_res.returncode == 0:
            smi=_run(["nvidia-smi"], runner)
            if smi.returncode == 0:
                cuda_text=smi.stdout; cuda_available=True
    if cuda_available:
        cuda_version=parse_cuda_version(cuda_text).get("cuda_version")
    caps.append(Capability("cuda_version", bool(cuda_version), cuda_version))
    torch=_run(COMMANDS["pytorch_gpu_count"].argv, runner)
    caps.append(Capability("pytorch_gpu_count", torch.returncode == 0, None))
    nccl=_run(["all_reduce_perf", "--help"], runner)
    caps.append(Capability("nccl_tests", nccl.returncode == 0, None))
    return CapabilitySnapshot(hostname=socket.gethostname(), operating_system=f"{platform.system()} {platform.release()}", agent_version=__version__, gpu_count=gpu_count, capabilities=caps, gpu_models=gpu_models)
