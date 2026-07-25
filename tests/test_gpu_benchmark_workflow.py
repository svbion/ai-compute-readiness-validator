from __future__ import annotations

import json
import subprocess
from pathlib import Path

from ai_validator.benchmarks.workflow import BenchmarkOptions, STATUS_FAIL, STATUS_NOT_AVAILABLE, STATUS_PASS, run_workflow, write_dry_run


class FakeCompleted:
    def __init__(self, argv, returncode=0, stdout="", stderr=""):
        self.args = argv
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr


def test_dry_run_writes_plan_without_running_benchmarks(tmp_path: Path, monkeypatch) -> None:
    calls = []

    def fake_detect(*args, **kwargs):
        calls.append(args[0])
        return FakeCompleted(args[0], stdout="GPU 0: NVIDIA B200\nGPU 1: NVIDIA B200\n")

    monkeypatch.setattr("ai_validator.benchmarks.workflow.subprocess.run", fake_detect)
    output = tmp_path / "dry"
    plan = write_dry_run(BenchmarkOptions(platform="runpod", gpu="auto", output=output, dry_run=True, nccl_tests_path=tmp_path / "missing"))

    assert plan["dry_run"] is True
    assert plan["gpu"] == "auto"
    assert plan["gpu_label"] == "NVIDIA B200"
    assert plan["gpu_override"] is False
    assert plan["detected_gpu_model"] == "NVIDIA B200"
    assert plan["output_directory_verified"] is True
    assert plan["visible_gpu_count"] == 2
    assert (output / "dry-run-plan.json").exists()
    assert not any("_perf" in " ".join(call) for call in calls)


def test_benchmark_workflow_continues_on_missing_and_failed_collectives(tmp_path: Path, monkeypatch) -> None:
    bin_dir = tmp_path / "nccl" / "build"
    bin_dir.mkdir(parents=True)
    for name in ["all_reduce_perf", "all_gather_perf"]:
        path = bin_dir / name
        path.write_text("#!/bin/sh\n", encoding="utf-8")
        path.chmod(0o755)

    def fake_collect(**kwargs):
        raw = Path(kwargs["output_path"])
        (raw / "gpu").mkdir(parents=True, exist_ok=True)
        (raw / "gpu" / "topology.txt").write_text("GPU0 GPU1\nGPU0 X NV18\nGPU1 NV18 X\n", encoding="utf-8")
        (raw / "manifest.json").write_text('{"schema_version":"1.0.0"}\n', encoding="utf-8")
        (raw / "metadata").mkdir(exist_ok=True)
        (raw / "metadata" / "commands.json").write_text("[]\n", encoding="utf-8")

    def fake_runner(argv, **kwargs):
        if argv == ["nvidia-smi", "-L"]:
            return FakeCompleted(argv, stdout="GPU 0: NVIDIA B200\nGPU 1: NVIDIA B200\n")
        if "all_gather_perf" in argv[0]:
            return FakeCompleted(argv, returncode=2, stdout="", stderr="collective failed")
        return FakeCompleted(argv, stdout="NCCL version 2.25.1\n1048576 262144 float sum -1 35.0 29.9 56.1 0\n# Out of bounds values : 0\n# Avg bus bandwidth : 56.1\n")

    monkeypatch.setattr("ai_validator.benchmarks.workflow.collect_evidence", fake_collect)
    summary = run_workflow(BenchmarkOptions(platform="runpod", gpu="b200", output=tmp_path / "run", nccl_tests_path=tmp_path / "nccl", skip_archive=True), runner=fake_runner)

    statuses = {row["id"]: row["status"] for row in summary["benchmarks"]}
    assert summary["gpu"] == "b200"
    assert summary["gpu_label"] == "NVIDIA B200"
    assert summary["gpu_override"] is True
    assert summary["detected_gpu_model"] == "NVIDIA B200"
    assert statuses["all_reduce_perf"] == STATUS_PASS
    assert statuses["all_gather_perf"] == STATUS_FAIL
    assert statuses["reduce_scatter_perf"] == STATUS_NOT_AVAILABLE
    assert summary["status"] == STATUS_FAIL
    assert (tmp_path / "run" / "summary" / "benchmark-summary.csv").exists()
    assert (tmp_path / "run" / "summary" / "RESULTS.md").exists()
    assert "Detected GPU model:** NVIDIA B200" in (tmp_path / "run" / "summary" / "RESULTS.md").read_text(encoding="utf-8")
    assert (tmp_path / "run" / "report" / "results.html").exists()
    assert (tmp_path / "run" / "charts" / "average-bus-bandwidth.png").read_bytes().startswith(b"\x89PNG")
    assert (tmp_path / "run" / "sanitized" / "manifest.json").exists()
    assert "summary/benchmark-summary.json" in (tmp_path / "run" / "SHA256SUMS").read_text(encoding="utf-8")


def test_archive_and_checksum_created(tmp_path: Path, monkeypatch) -> None:
    def fake_collect(**kwargs):
        raw = Path(kwargs["output_path"])
        raw.mkdir(parents=True, exist_ok=True)
        (raw / "manifest.json").write_text('{"schema_version":"1.0.0"}\n', encoding="utf-8")
        (raw / "metadata").mkdir(exist_ok=True)
        (raw / "metadata" / "commands.json").write_text("[]\n", encoding="utf-8")

    def fake_runner(argv, **kwargs):
        if argv == ["nvidia-smi", "-L"]:
            return FakeCompleted(argv, stdout="GPU 0: NVIDIA H200\n")
        raise FileNotFoundError(argv[0])

    monkeypatch.setattr("ai_validator.benchmarks.workflow.collect_evidence", fake_collect)
    summary = run_workflow(BenchmarkOptions(platform="runpod", gpu="auto", output=tmp_path / "gpu"), runner=fake_runner)

    archive = Path(summary["archive"])
    assert archive.exists()
    assert Path(str(archive) + ".sha256").exists()


def test_auto_detection_accepts_future_gpu_models(tmp_path: Path, monkeypatch) -> None:
    def fake_collect(**kwargs):
        raw = Path(kwargs["output_path"])
        raw.mkdir(parents=True, exist_ok=True)
        (raw / "manifest.json").write_text('{"schema_version":"1.0.0"}\n', encoding="utf-8")
        (raw / "metadata").mkdir(exist_ok=True)
        (raw / "metadata" / "commands.json").write_text("[]\n", encoding="utf-8")

    def fake_runner(argv, **kwargs):
        if argv == ["nvidia-smi", "-L"]:
            return FakeCompleted(argv, stdout="GPU 0: NVIDIA X900-Prototype (UUID: GPU-abc)\n")
        raise FileNotFoundError(argv[0])

    monkeypatch.setattr("ai_validator.benchmarks.workflow.collect_evidence", fake_collect)
    summary = run_workflow(BenchmarkOptions(platform="lab", gpu="auto", output=tmp_path / "future", skip_archive=True), runner=fake_runner)

    assert summary["gpu"] == "auto"
    assert summary["gpu_label"] == "NVIDIA X900-Prototype"
    assert summary["detected_gpu_model"] == "NVIDIA X900-Prototype"
    assert summary["gpu_override"] is False
