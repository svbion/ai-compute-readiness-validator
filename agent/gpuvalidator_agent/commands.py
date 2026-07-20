from __future__ import annotations

from dataclasses import dataclass

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
}

def command_for(command_type: str, server_command: dict | None = None) -> CommandDefinition:
    if command_type not in COMMANDS:
        raise UnsupportedCommand(f"Unsupported command type: {command_type}")
    base = COMMANDS[command_type]
    if not server_command:
        return base
    argv = server_command.get("argv") or base.argv
    if not isinstance(argv, list) or [str(x) for x in argv] != base.argv:
        return base
    return CommandDefinition(base.type, list(base.argv), int(server_command.get("timeout_seconds") or base.timeout_seconds), int(server_command.get("max_stdout_bytes") or base.max_stdout_bytes), int(server_command.get("max_stderr_bytes") or base.max_stderr_bytes))
