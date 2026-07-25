from pathlib import Path
import importlib.util

SCRIPT = Path(__file__).resolve().parents[1] / "tools" / "benchmark-runner" / "analyze-gpu-fabric.py"
spec = importlib.util.spec_from_file_location("fabric", SCRIPT)
fabric = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(fabric)

def write_case(tmp_path: Path, topology: str, p2p: str, status: str) -> Path:
    raw = tmp_path / "raw"
    raw.mkdir()
    (raw / "nvidia-smi-list.txt").write_text("GPU 0: NVIDIA H200 (UUID: a)\nGPU 1: NVIDIA H200 (UUID: b)\n")
    (raw / "topology-matrix.txt").write_text(topology)
    for name in ["p2p-nvlink.txt", "p2p-read.txt", "p2p-write.txt", "p2p-atomics.txt"]:
        (raw / name).write_text(p2p)
    (raw / "nvlink-status.txt").write_text(status)
    return raw

def test_fully_connected_nv18_pass(tmp_path):
    raw = write_case(tmp_path, " GPU0 GPU1\nGPU0 X NV18\nGPU1 NV18 X\n", " GPU0 GPU1\nGPU0 X OK\nGPU1 OK X\n", "GPU 0: NVIDIA H200 (UUID: a)\n Link 0: 26.562 GB/s\nGPU 1: NVIDIA H200 (UUID: b)\n Link 0: 26.562 GB/s\n")
    data = fabric.analyze(raw)
    assert data["result"] == "PASS"
    assert data["fully_connected_nvlink"] is True
    assert data["nvlink_widths"] == [18]

def test_active_links_but_sys_is_warning(tmp_path):
    raw = write_case(tmp_path, " GPU0 GPU1\nGPU0 X SYS\nGPU1 SYS X\n", " GPU0 GPU1\nGPU0 X NS\nGPU1 NS X\n", "GPU 0: NVIDIA H200 NVL (UUID: a)\n Link 0: 26.562 GB/s\nGPU 1: NVIDIA H200 NVL (UUID: b)\n Link 0: 26.562 GB/s\n")
    data = fabric.analyze(raw)
    assert data["result"] == "WARNING"
    assert data["fully_connected_nvlink"] is False
