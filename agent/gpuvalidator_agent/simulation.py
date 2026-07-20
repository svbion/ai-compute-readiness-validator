from __future__ import annotations

import time
from types import SimpleNamespace

FOUR_GPU_LIST = """GPU 0: NVIDIA A100-SXM4-40GB (UUID: GPU-sim-0)
GPU 1: NVIDIA A100-SXM4-40GB (UUID: GPU-sim-1)
GPU 2: NVIDIA A100-SXM4-40GB (UUID: GPU-sim-2)
GPU 3: NVIDIA A100-SXM4-40GB (UUID: GPU-sim-3)
"""

MALFORMED_INVENTORY = """0, NVIDIA A100-SXM4-40GB, GPU-sim-0, 40960 MiB, 535.104, 00000000:01:00.0
malformed row
1, NVIDIA A100-SXM4-40GB, GPU-sim-1, 40960 MiB, 535.104, 00000000:02:00.0
"""


def simulation_runner(argv: list[str], timeout: int = 5):
    command = tuple(argv)
    if command == ("nvidia-smi", "-L"):
        return SimpleNamespace(returncode=0, stdout=FOUR_GPU_LIST, stderr="")
    if command == ("nvidia-smi", "--query-gpu=driver_version", "--format=csv,noheader"):
        return SimpleNamespace(returncode=0, stdout="535.104\n", stderr="")
    if command == ("nvidia-smi", "--query-gpu=index,name,uuid,memory.total,driver_version,pci.bus_id", "--format=csv,noheader,nounits"):
        return SimpleNamespace(returncode=0, stdout=MALFORMED_INVENTORY, stderr="")
    if command == ("nvidia-smi", "topo", "-m"):
        return SimpleNamespace(returncode=0, stdout="GPU0 GPU1 GPU2 GPU3 CPU Affinity\nGPU0 X NV4 NV4 NV4 0-31\nGPU1 NV4 X NV4 NV4 0-31\nGPU2 NV4 NV4 X NV4 32-63\nGPU3 NV4 NV4 NV4 X 32-63\n", stderr="")
    if command == ("nvcc", "--version"):
        raise FileNotFoundError("nvcc")
    if command[:2] == ("python3", "-c"):
        raise FileNotFoundError("python3 torch")
    if command == ("sleep", "timeout"):
        time.sleep(min(timeout, 1))
        raise TimeoutError("simulated timeout")
    return SimpleNamespace(returncode=127, stdout="", stderr=f"unsupported simulated command: {' '.join(argv)}")
