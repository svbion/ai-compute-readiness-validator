import os
from pathlib import Path

import pytest

from ai_validator.benchmarks.package import (
    analyze_gpu_fabric,
    ingest_package,
    parse_gpu_inventory,
    parse_nccl_output,
    parse_nccl_topology_xml,
    parse_nvlink_status,
    parse_p2p_matrix,
    parse_topology_matrix,
    verify_sha256sums,
)

FIX = Path(__file__).parent / "fixtures" / "h200-public"
PACKAGE = Path(
    os.environ.get(
        "GPUVALIDATOR_PUBLIC_BENCHMARK_PACKAGE",
        Path(__file__).resolve().parents[2]
        / "gpu-benchmark-lab"
        / "benchmarks"
        / "runpod"
        / "h200-sxm5"
        / "5-gpu-nv18"
        / "2026-07-23",
    )
)

def test_parse_successful_nccl_all_reduce_fixture():
    parsed = parse_nccl_output((FIX / "all_reduce_perf.txt").read_text(), "all_reduce_perf")
    assert parsed["summary"]["collective"] == "all_reduce_perf"
    assert parsed["summary"]["validation_errors"] == 0
    assert parsed["rows"]
    assert parsed["rows"][0]["datatype"] == "float"

def test_parse_incomplete_nccl_output_warning():
    parsed = parse_nccl_output("# Collective test starting: all_reduce_perf\n# Avg bus bandwidth : 0\n", "all_reduce_perf")
    assert parsed["rows"] == []
    assert any("No NCCL data" in warning for warning in parsed["warnings"])

def test_parse_nccl_warning_lines():
    parsed = parse_nccl_output("NCCL version 2.25.1\nNCCL INFO Failed to open libibverbs.so\n8 2 float sum -1 1 1 1 0 1 1 1 0\n", "all_reduce_perf")
    assert parsed["rows"]
    assert any("warning" in warning.lower() or "fallback" in warning.lower() for warning in parsed["warnings"])

def test_parse_fully_connected_h200_nv18_topology_and_p2p():
    topology = parse_topology_matrix((FIX / "topology-matrix.txt").read_text())
    assert topology["gpu_pairs"] == 10
    assert topology["nvlink_connected_pairs"] == 10
    assert topology["all_visible_gpu_pairs_nvlink_connected"] is True
    assert topology["nvlink_width_labels"] == ["NV18"]
    for name in ["p2p-nvlink.txt", "p2p-read.txt", "p2p-write.txt", "p2p-atomic.txt"]:
        assert parse_p2p_matrix((FIX / name).read_text(), name)["aggregate_status"] == "PASS"

def test_detect_active_physical_links_without_peer_nvlink():
    inv = parse_gpu_inventory((FIX / "h200-nvl-inventory.txt").read_text())
    topology = parse_topology_matrix((FIX / "h200-nvl-sys-topology.txt").read_text())
    ns = parse_p2p_matrix((FIX / "h200-nvl-p2p-ns.txt").read_text(), "nvlink")
    ok = parse_p2p_matrix(" GPU0 GPU1\nGPU0 X OK\nGPU1 OK X\n", "read")
    nvlink = parse_nvlink_status((FIX / "h200-nvl-nvlink-status.txt").read_text())
    fabric = analyze_gpu_fabric(inv, topology, {"nvlink": ns, "read": ok, "write": ok, "atomics": ns}, nvlink)
    assert fabric["status"] == "WARNING"
    assert fabric["fully_connected_fabric"] is False
    assert fabric["active_physical_nvlink"] == "PASS"

def test_parse_nccl_topology_xml_fixture():
    parsed = parse_nccl_topology_xml((FIX / "nccl-topology.xml").read_text())
    assert parsed["available"] is True
    assert isinstance(parsed["gpu_busids"], list)

def test_verify_checksums_and_ingest_h200_package_end_to_end(tmp_path):
    if not PACKAGE.exists():
        pytest.skip("Set GPUVALIDATOR_PUBLIC_BENCHMARK_PACKAGE to run public package ingestion test")
    assert verify_sha256sums(PACKAGE) == []
    result = ingest_package(PACKAGE, tmp_path / "ingest")
    assert result.summary["checksum_status"] == "PASS"
    assert result.summary["fabric"]["status"] == "PASS"
    assert result.summary["nccl_collectives"]
    assert (tmp_path / "ingest" / "GPU_BENCHMARK_REPORT.md").exists()

def test_detect_corrupted_artifact(tmp_path):
    root = tmp_path / "pkg"
    root.mkdir()
    (root / "SHA256SUMS").write_text("0" * 64 + "  file.txt\n")
    (root / "file.txt").write_text("changed\n")
    assert verify_sha256sums(root) == ["Checksum mismatch: file.txt"]
