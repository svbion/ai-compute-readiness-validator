from __future__ import annotations

import csv
import argparse
import hashlib
import html
import json
import os
import shutil
import struct
import subprocess
import sys
import tarfile
import time
import zlib
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from ai_validator.benchmarks.intelligence import parse_nccl
from ai_validator.evidence.collector import collect_evidence, dry_run_commands, write_checksums
from ai_validator.evidence.sanitizer import DeterministicSanitizer

STATUS_PASS = "PASS"
STATUS_FAIL = "FAIL"
STATUS_SKIPPED = "SKIPPED"
STATUS_NOT_AVAILABLE = "NOT AVAILABLE"
GENERIC_BENCHMARK_PROFILE = "gpu-benchmark"
AUTO_GPU = "auto"
MANUAL_GPU_OVERRIDES = {
    "a100": "NVIDIA A100",
    "b300": "NVIDIA B300",
    "b200": "NVIDIA B200",
    "h100": "NVIDIA H100",
    "h200": "NVIDIA H200",
}
GPU_CHOICES = (AUTO_GPU, *sorted(MANUAL_GPU_OVERRIDES))
NCCL_TESTS = [
    "all_reduce_perf",
    "all_gather_perf",
    "reduce_scatter_perf",
    "broadcast_perf",
    "reduce_perf",
    "gather_perf",
    "scatter_perf",
    "alltoall_perf",
    "alltoallv_perf",
    "sendrecv_perf",
]


def evidence_profile_for_gpu(gpu: str) -> str:
    return GENERIC_BENCHMARK_PROFILE


@dataclass
class GpuDetection:
    requested: str
    label: str
    detected_model: str | None
    visible_count: int | None
    warning: str | None = None
    override: bool = False


@dataclass
class BenchmarkOptions:
    platform: str
    gpu: str
    output: Path
    dry_run: bool = False
    collect_only: bool = False
    benchmark_only: bool = False
    skip_charts: bool = False
    skip_archive: bool = False
    nccl_tests_path: Path | None = None
    min_bytes: str = "8M"
    max_bytes: str = "1G"
    iters: int = 20
    warmup_iters: int = 5
    timeout_seconds: int = 900
    sanitize: bool = True


@dataclass
class CommandRecord:
    id: str
    command: list[str]
    status: str
    return_code: int | None = None
    started_at: str | None = None
    finished_at: str | None = None
    elapsed_seconds: float = 0.0
    stdout_file: str | None = None
    stderr_file: str | None = None
    parsed_metrics: dict[str, Any] = field(default_factory=dict)
    message: str | None = None


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_options(options: BenchmarkOptions) -> None:
    gpu = options.gpu.lower().strip()
    if gpu not in GPU_CHOICES:
        raise ValueError("Unsupported GPU profile. Use --gpu auto, b300, b200, h200, h100, or a100.")
    if options.collect_only and options.benchmark_only:
        raise ValueError("--collect-only and --benchmark-only cannot be used together.")
    if options.iters <= 0 or options.warmup_iters < 0:
        raise ValueError("Iteration counts must be positive, with warmups zero or greater.")
    if options.timeout_seconds <= 0:
        raise ValueError("Timeout must be greater than zero seconds.")
    if options.output.exists() and options.output.is_symlink():
        raise ValueError(f"Output path must not be a symlink: {options.output}")


def safe_output_root(path: Path) -> Path:
    resolved = path.expanduser().resolve(strict=False)
    if resolved.exists() and not resolved.is_dir():
        raise ValueError(f"Output path exists and is not a directory: {resolved}")
    return resolved


def _parse_nvidia_smi_models(output: str) -> list[str]:
    models: list[str] = []
    for line in output.splitlines():
        line = line.strip()
        if not line.startswith("GPU ") or ":" not in line:
            continue
        model = line.split(":", 1)[1].strip()
        if " (UUID:" in model:
            model = model.split(" (UUID:", 1)[0].strip()
        if model:
            models.append(model)
    return models


def _summarize_gpu_models(models: list[str]) -> str | None:
    if not models:
        return None
    unique = sorted(set(models))
    if len(unique) == 1:
        return unique[0]
    return "Mixed GPUs: " + ", ".join(unique)


def detect_gpu_inventory(runner: Callable[..., subprocess.CompletedProcess[str]] | None = None) -> tuple[int | None, str | None, str | None]:
    runner = runner or subprocess.run
    try:
        result = runner(["nvidia-smi", "-L"], capture_output=True, text=True, timeout=20, shell=False)
    except FileNotFoundError:
        return None, None, "nvidia-smi not found"
    except Exception as exc:  # pragma: no cover - defensive boundary
        return None, None, str(exc)
    if result.returncode != 0:
        return None, None, result.stderr.strip() or "nvidia-smi -L failed"
    models = _parse_nvidia_smi_models(result.stdout)
    count = len(models)
    model = _summarize_gpu_models(models)
    return count, model, None if count else "No visible NVIDIA GPUs were listed"


def detect_gpu_count(runner: Callable[..., subprocess.CompletedProcess[str]] | None = None) -> tuple[int | None, str | None]:
    count, _model, warning = detect_gpu_inventory(runner=runner)
    return count, warning


def resolve_gpu_detection(options: BenchmarkOptions, runner: Callable[..., subprocess.CompletedProcess[str]] | None = None) -> GpuDetection:
    requested = options.gpu.lower().strip()
    count, detected_model, warning = detect_gpu_inventory(runner=runner)
    if requested == AUTO_GPU:
        return GpuDetection(
            requested=requested,
            label=detected_model or "Auto-detected NVIDIA GPU",
            detected_model=detected_model,
            visible_count=count,
            warning=warning,
            override=False,
        )
    return GpuDetection(
        requested=requested,
        label=MANUAL_GPU_OVERRIDES[requested],
        detected_model=detected_model,
        visible_count=count,
        warning=warning,
        override=True,
    )


def resolve_nccl_binary(test: str, base: Path | None = None) -> Path | None:
    candidates: list[Path] = []
    if base is not None:
        expanded = base.expanduser()
        candidates.extend([expanded / test, expanded / "build" / test])
        if expanded.name == test:
            candidates.insert(0, expanded)
    found = shutil.which(test)
    if found:
        candidates.append(Path(found))
    for candidate in candidates:
        try:
            resolved = candidate.resolve(strict=False)
        except Exception:
            continue
        if resolved.is_file() and os.access(resolved, os.X_OK):
            return resolved
    return None


def command_plan(options: BenchmarkOptions) -> list[dict[str, Any]]:
    evidence = [] if options.benchmark_only else [
        {"phase": "collect", "id": command.id, "argv": command.argv, "status": "planned"}
        for command in dry_run_commands(evidence_profile_for_gpu(options.gpu))
    ]
    benchmarks = [] if options.collect_only else [
        {
            "phase": "benchmark",
            "id": test,
            "argv": [
                str(resolve_nccl_binary(test, options.nccl_tests_path) or f"<missing:{test}>"),
                "-b", options.min_bytes,
                "-e", options.max_bytes,
                "-f", "2",
                "-g", "<visible-gpu-count>",
                "-w", str(options.warmup_iters),
                "-n", str(options.iters),
            ],
            "status": "planned" if resolve_nccl_binary(test, options.nccl_tests_path) else STATUS_NOT_AVAILABLE,
        }
        for test in NCCL_TESTS
    ]
    return evidence + benchmarks


def write_dry_run(options: BenchmarkOptions) -> dict[str, Any]:
    validate_options(options)
    output = safe_output_root(options.output)
    output.mkdir(parents=True, exist_ok=True)
    gpu_detection = resolve_gpu_detection(options)
    plan = {
        "dry_run": True,
        "platform": options.platform,
        "gpu": gpu_detection.requested,
        "gpu_label": gpu_detection.label,
        "gpu_override": gpu_detection.override,
        "detected_gpu_model": gpu_detection.detected_model,
        "output": str(output),
        "output_directory_verified": output.is_dir(),
        "visible_gpu_count": gpu_detection.visible_count,
        "gpu_detection_warning": gpu_detection.warning,
        "phases": {
            "collect": not options.benchmark_only,
            "benchmark": not options.collect_only,
            "sanitize": options.sanitize,
            "charts": not options.skip_charts,
            "archive": not options.skip_archive,
        },
        "commands": command_plan(options),
        "note": "Dry run executes no GPU benchmark commands.",
    }
    (output / "dry-run-plan.json").write_text(json.dumps(plan, indent=2) + "\n", encoding="utf-8")
    return plan


def _run_benchmark_command(test: str, argv: list[str], raw_dir: Path, timeout: int, runner: Callable[..., subprocess.CompletedProcess[str]] | None = None) -> CommandRecord:
    runner = runner or subprocess.run
    stdout = raw_dir / f"{test}.txt"
    stderr = raw_dir / f"{test}.stderr.txt"
    started = utc_now()
    start = time.perf_counter()
    try:
        completed = runner(argv, capture_output=True, text=True, timeout=timeout, shell=False)
        status = STATUS_PASS if completed.returncode == 0 else STATUS_FAIL
        stdout.write_text(completed.stdout or "", encoding="utf-8")
        stderr.write_text(completed.stderr or "", encoding="utf-8")
        metrics = parse_nccl(completed.stdout or "", stdout.name)["metrics"] if completed.stdout else {}
        if metrics.get("wrong_result_count") not in (None, 0) or metrics.get("out_of_bounds_count") not in (None, 0):
            status = STATUS_FAIL
        rc: int | None = completed.returncode
        message = None if status == STATUS_PASS else (completed.stderr.strip()[:500] or "Benchmark exited non-zero or reported correctness errors.")
    except subprocess.TimeoutExpired as exc:
        status = STATUS_FAIL
        rc = None
        out = exc.stdout or ""
        err = exc.stderr or "Benchmark timed out"
        if isinstance(out, bytes):
            out = out.decode(errors="replace")
        if isinstance(err, bytes):
            err = err.decode(errors="replace")
        stdout.write_text(out, encoding="utf-8")
        stderr.write_text(err, encoding="utf-8")
        metrics = parse_nccl(out, stdout.name)["metrics"] if out else {}
        message = f"Timed out after {timeout} seconds."
    finished = utc_now()
    elapsed = round(time.perf_counter() - start, 3)
    return CommandRecord(
        id=test,
        command=argv,
        status=status,
        return_code=rc,
        started_at=started,
        finished_at=finished,
        elapsed_seconds=elapsed,
        stdout_file=str(stdout.relative_to(raw_dir.parent)),
        stderr_file=str(stderr.relative_to(raw_dir.parent)),
        parsed_metrics=metrics,
        message=message,
    )


def collect_benchmarks(options: BenchmarkOptions, raw_dir: Path, gpu_count: int | None, runner: Callable[..., subprocess.CompletedProcess[str]] | None = None) -> list[CommandRecord]:
    records: list[CommandRecord] = []
    if options.collect_only:
        return [CommandRecord(id=test, command=[], status=STATUS_SKIPPED, message="Skipped by --collect-only") for test in NCCL_TESTS]
    if gpu_count is None or gpu_count < 1:
        return [CommandRecord(id=test, command=[], status=STATUS_NOT_AVAILABLE, message="No visible GPU count available from nvidia-smi") for test in NCCL_TESTS]
    for test in NCCL_TESTS:
        binary = resolve_nccl_binary(test, options.nccl_tests_path)
        if binary is None:
            records.append(CommandRecord(id=test, command=[], status=STATUS_NOT_AVAILABLE, message=f"{test} executable not found"))
            continue
        argv = [str(binary), "-b", options.min_bytes, "-e", options.max_bytes, "-f", "2", "-g", str(gpu_count), "-w", str(options.warmup_iters), "-n", str(options.iters)]
        records.append(_run_benchmark_command(test, argv, raw_dir, options.timeout_seconds, runner=runner))
    return records


def copy_sanitized(source: Path, target: Path) -> None:
    if target.exists():
        shutil.rmtree(target)
    sanitizer = DeterministicSanitizer(source_hostname=os.uname().nodename if hasattr(os, "uname") else None)
    for path in source.rglob("*"):
        rel = path.relative_to(source)
        out = target / rel
        if path.is_symlink():
            raise ValueError(f"Refusing to sanitize symlink: {rel}")
        if path.is_dir():
            out.mkdir(parents=True, exist_ok=True)
            continue
        out.parent.mkdir(parents=True, exist_ok=True)
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            shutil.copy2(path, out)
            continue
        out.write_text(sanitizer.sanitize(text), encoding="utf-8")
    (target / "sanitization-manifest.json").write_text(json.dumps({"sanitized": True, "source_path": str(source), "note": "Sanitized with GPUValidator DeterministicSanitizer; original sensitive values are not retained."}, indent=2) + "\n", encoding="utf-8")
    write_checksums(target)


def aggregate_status(records: list[CommandRecord]) -> str:
    runnable = [r for r in records if r.status not in {STATUS_NOT_AVAILABLE, STATUS_SKIPPED}]
    if runnable and all(r.status == STATUS_PASS for r in runnable):
        return STATUS_PASS
    if any(r.status == STATUS_FAIL for r in records):
        return STATUS_FAIL
    if any(r.status == STATUS_NOT_AVAILABLE for r in records):
        return STATUS_NOT_AVAILABLE
    return STATUS_SKIPPED


def write_summary_files(options: BenchmarkOptions, run_dir: Path, records: list[CommandRecord], gpu_detection: GpuDetection) -> dict[str, Any]:
    summary_dir = run_dir / "summary"
    summary_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "schema_version": "1.0.0",
        "workflow": "gpuvalidator-gpu-benchmark",
        "platform": options.platform,
        "gpu": gpu_detection.requested,
        "gpu_label": gpu_detection.label,
        "gpu_override": gpu_detection.override,
        "detected_gpu_model": gpu_detection.detected_model,
        "generated_at": utc_now(),
        "visible_gpu_count": gpu_detection.visible_count,
        "gpu_detection_warning": gpu_detection.warning,
        "status": aggregate_status(records),
        "parameters": {"min_bytes": options.min_bytes, "max_bytes": options.max_bytes, "iters": options.iters, "warmup_iters": options.warmup_iters},
        "benchmarks": [record.__dict__ for record in records],
        "limitations": [
            "Reports summarize only collected command evidence and parsed NCCL output; missing or failed evidence is not extrapolated.",
            "No infrastructure was deployed or rented by this workflow.",
        ],
    }
    (summary_dir / "benchmark-summary.json").write_text(json.dumps(payload, indent=2, default=str) + "\n", encoding="utf-8")
    fields = ["id", "status", "return_code", "elapsed_seconds", "algorithm_bandwidth", "bus_bandwidth", "average_bus_bandwidth", "wrong_result_count", "out_of_bounds_count", "stdout_file", "stderr_file"]
    with (summary_dir / "benchmark-summary.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for record in records:
            metrics = record.parsed_metrics or {}
            writer.writerow({
                "id": record.id,
                "status": record.status,
                "return_code": record.return_code,
                "elapsed_seconds": record.elapsed_seconds,
                "algorithm_bandwidth": metrics.get("algorithm_bandwidth"),
                "bus_bandwidth": metrics.get("bus_bandwidth"),
                "average_bus_bandwidth": metrics.get("average_bus_bandwidth"),
                "wrong_result_count": metrics.get("wrong_result_count"),
                "out_of_bounds_count": metrics.get("out_of_bounds_count"),
                "stdout_file": record.stdout_file,
                "stderr_file": record.stderr_file,
            })
    return payload


def write_topology(run_dir: Path) -> None:
    topo = run_dir / "raw" / "gpu" / "topology.txt"
    if not topo.exists():
        topo = run_dir / "raw" / "gpu" / "nvidia-smi-topo.txt"
    lines = ["graph LR"]
    if not topo.exists():
        lines.append("  A[Topology data unavailable]")
    else:
        rows = [line.split() for line in topo.read_text(encoding="utf-8", errors="replace").splitlines() if line.strip() and not line.startswith("$")]
        header = next((row for row in rows if row and row[0] == "GPU0"), [])
        cols = [item for item in header if item.startswith("GPU")]
        gpu_rows = [row for row in rows if row and row[0].startswith("GPU")]
        edges: set[tuple[str, str, str]] = set()
        for row in gpu_rows:
            lines.append(f"  {row[0]}[{row[0]}]")
            for target, rel in zip(cols, row[1:1 + len(cols)]):
                if row[0] != target and rel != "X":
                    a, b = sorted((row[0], target))
                    edges.add((a, b, rel))
        for a, b, rel in sorted(edges):
            lines.append(f"  {a} ---|{rel}| {b}")
        lines.append('  LEGEND["NV# = NVLink; PIX/PXB/PHB/SYS = PCIe or CPU path"]')
    (run_dir / "summary" / "topology.mmd").write_text("\n".join(lines) + "\n", encoding="utf-8")


def _png_chunk(kind: bytes, data: bytes) -> bytes:
    return struct.pack("!I", len(data)) + kind + data + struct.pack("!I", zlib.crc32(kind + data) & 0xFFFFFFFF)


def write_png_bar_chart(path: Path, values: list[float], *, width: int = 640, height: int = 360) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image = bytearray([255] * width * height * 3)
    max_value = max(values) if values else 1.0
    max_value = max(max_value, 1.0)
    bar_w = max(12, width // max(len(values) * 2, 1))
    for idx, value in enumerate(values):
        bar_h = int((height - 40) * max(value, 0.0) / max_value)
        x0 = 30 + idx * (bar_w * 2)
        for y in range(height - 20 - bar_h, height - 20):
            for x in range(x0, min(x0 + bar_w, width - 10)):
                off = (y * width + x) * 3
                image[off:off+3] = bytes((40, 120, 220))
    raw = b"".join(b"\x00" + image[y * width * 3:(y + 1) * width * 3] for y in range(height))
    png = b"\x89PNG\r\n\x1a\n" + _png_chunk(b"IHDR", struct.pack("!IIBBBBB", width, height, 8, 2, 0, 0, 0)) + _png_chunk(b"IDAT", zlib.compress(raw, 9)) + _png_chunk(b"IEND", b"")
    path.write_bytes(png)


def write_charts(run_dir: Path, records: list[CommandRecord]) -> None:
    chart_dir = run_dir / "charts"
    write_png_bar_chart(chart_dir / "average-bus-bandwidth.png", [float((record.parsed_metrics or {}).get("average_bus_bandwidth") or 0) for record in records])
    write_png_bar_chart(chart_dir / "peak-bus-bandwidth.png", [float((record.parsed_metrics or {}).get("bus_bandwidth") or 0) for record in records])
    write_png_bar_chart(chart_dir / "collective-duration.png", [float(record.elapsed_seconds or 0) for record in records])


def write_reports(run_dir: Path, summary: dict[str, Any], *, charts: bool) -> None:
    rows = summary["benchmarks"]
    table = "\n".join(f"| `{r['id']}` | {r['status']} | {r.get('elapsed_seconds', 0)} | {r.get('return_code')} | {r.get('message') or ''} |" for r in rows)
    caveat = "Performance claims are limited to successfully captured benchmark rows. Missing, skipped, or unavailable commands are not inferred."
    topology_text = (run_dir / "summary" / "topology.mmd").read_text(encoding="utf-8") if (run_dir / "summary" / "topology.mmd").exists() else "graph LR\n  A[Topology unavailable]"
    detected_model = summary.get("detected_gpu_model") or "Unavailable"
    override_note = " (manual override)" if summary.get("gpu_override") else ""
    md = f"""# {summary['gpu_label']} Benchmark Results

## Executive summary

- **Overall status:** {summary['status']}
- **Platform:** {summary['platform']}
- **GPU target:** {summary['gpu_label']}{override_note}
- **Detected GPU model:** {detected_model}
- **Visible GPU count:** {summary.get('visible_gpu_count') or 'Unavailable'}
- **Generated:** {summary['generated_at']}

{caveat}

## NCCL collective summary

| Collective | Status | Elapsed (s) | Return code | Notes |
|---|---:|---:|---:|---|
{table}

## Topology

```mermaid
{topology_text}
```

## Artifacts

- Raw evidence: `raw/`
- Sanitized evidence: `sanitized/`
- JSON summary: `summary/benchmark-summary.json`
- CSV metrics: `summary/benchmark-summary.csv`
- HTML report: `report/results.html`
- Checksums: `SHA256SUMS`
"""
    (run_dir / "summary" / "RESULTS.md").write_text(md, encoding="utf-8")
    (run_dir / "summary" / "INTERVIEW_NOTES.md").write_text(f"""# Interview Notes: {summary['gpu_label']} Benchmark Workflow

- Explain that GPUValidator captures environment, topology, command provenance, and NCCL output before drawing conclusions.
- Call out unavailable or failed collectives explicitly instead of filling gaps with baseline assumptions.
- Compare GPU benchmark runs only when detected model, GPU count, topology, CUDA/NCCL versions, and test parameters are comparable.
""", encoding="utf-8")
    (run_dir / "summary" / "RESUME_BULLETS.md").write_text(f"""# Resume Bullets

- Integrated a first-class GPUValidator benchmark evidence workflow that captures detected NVIDIA GPU model, NVIDIA SMI, CPU, memory, OS/kernel, CUDA/NCCL, topology, command provenance, sanitized artifacts, checksums, reports, and archives.
- Added NCCL collective execution handling for pass/fail/skipped/not-available outcomes with partial-failure continuation and parser-backed metrics export.
""", encoding="utf-8")
    body = "".join(f"<tr><td>{html.escape(r['id'])}</td><td>{html.escape(r['status'])}</td><td>{r.get('elapsed_seconds', 0)}</td><td>{html.escape(str(r.get('return_code')))}</td><td>{html.escape(str(r.get('message') or ''))}</td></tr>" for r in rows)
    imgs = "" if not charts else '<img src="../charts/average-bus-bandwidth.png" alt="Average bus bandwidth"><img src="../charts/peak-bus-bandwidth.png" alt="Peak bus bandwidth"><img src="../charts/collective-duration.png" alt="Collective duration">'
    page = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{html.escape(summary['gpu_label'])} Benchmark</title><style>body{{font:16px system-ui;margin:40px;max-width:1100px}}table{{border-collapse:collapse;width:100%}}td,th{{border:1px solid #ccc;padding:8px}}img{{max-width:32%;margin:8px;border:1px solid #ddd}}</style></head><body><h1>{html.escape(summary['gpu_label'])} Benchmark Results</h1><p><strong>Status:</strong> {html.escape(summary['status'])}</p><p><strong>Detected GPU model:</strong> {html.escape(detected_model)}</p><p>{html.escape(caveat)}</p><table><thead><tr><th>Collective</th><th>Status</th><th>Elapsed</th><th>Return code</th><th>Notes</th></tr></thead><tbody>{body}</tbody></table>{imgs}</body></html>"""
    report_dir = run_dir / "report"
    report_dir.mkdir(parents=True, exist_ok=True)
    (report_dir / "results.html").write_text(page, encoding="utf-8")


def write_checksum_manifest(run_dir: Path) -> None:
    lines = []
    for path in sorted(p for p in run_dir.rglob("*") if p.is_file() and p.name != "SHA256SUMS"):
        if path.suffix == ".tar.gz":
            continue
        lines.append(f"{sha256_file(path)}  {path.relative_to(run_dir).as_posix()}")
    (run_dir / "SHA256SUMS").write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")


def create_archive(run_dir: Path) -> Path:
    archive = run_dir.with_suffix(".tar.gz")
    with tarfile.open(archive, "w:gz") as tar:
        tar.add(run_dir, arcname=run_dir.name)
    (archive.with_suffix(archive.suffix + ".sha256")).write_text(f"{sha256_file(archive)}  {archive.name}\n", encoding="utf-8")
    return archive


def run_workflow(options: BenchmarkOptions, runner: Callable[..., subprocess.CompletedProcess[str]] | None = None) -> dict[str, Any]:
    runner = runner or subprocess.run
    validate_options(options)
    if options.dry_run:
        return write_dry_run(options)
    run_dir = safe_output_root(options.output)
    for child in ["raw", "summary", "charts", "report"]:
        (run_dir / child).mkdir(parents=True, exist_ok=True)
    if not options.benchmark_only:
        collect_evidence(profile=evidence_profile_for_gpu(options.gpu), output_path=run_dir / "raw", sanitize=False, include_diagnostics=False)
    gpu_detection = resolve_gpu_detection(options, runner=runner)
    records = collect_benchmarks(options, run_dir / "raw", gpu_detection.visible_count, runner=runner)
    summary = write_summary_files(options, run_dir, records, gpu_detection)
    write_topology(run_dir)
    if not options.skip_charts:
        write_charts(run_dir, records)
    write_reports(run_dir, summary, charts=not options.skip_charts)
    if options.sanitize:
        copy_sanitized(run_dir / "raw", run_dir / "sanitized")
    write_checksum_manifest(run_dir)
    if not options.skip_archive:
        summary["archive"] = str(create_archive(run_dir))
    return summary


def parse_args(argv: list[str] | None = None) -> BenchmarkOptions:
    parser = argparse.ArgumentParser(description="Run GPUValidator generic NVIDIA GPU benchmark evidence workflow.")
    parser.add_argument("--platform", required=True, help="Operator platform label, e.g. runpod")
    parser.add_argument("--gpu", default=AUTO_GPU, choices=GPU_CHOICES, help="GPU model selection: auto, b300, b200, h200, h100, or a100")
    parser.add_argument("--output", required=True, type=Path, help="Output directory, e.g. results/gpu-YYYYMMDD-HHMMSS")
    parser.add_argument("--dry-run", action="store_true", help="Validate paths and print an execution plan without benchmarks")
    parser.add_argument("--full-suite", action="store_true", help="Run the full supported NCCL collective suite (default behavior).")
    parser.add_argument("--collect-only", action="store_true", help="Collect environment evidence only")
    parser.add_argument("--benchmark-only", action="store_true", help="Run benchmarks only, without environment collection")
    parser.add_argument("--skip-telemetry", action="store_true", help="Skip telemetry collection where supported (currently records intent).")
    parser.add_argument("--public-package", action="store_true", help="Create public/sanitized package outputs when archive generation is enabled.")
    parser.add_argument("--lesson-output", type=Path, default=None, help="Optional directory for generated lesson/report outputs.")
    parser.add_argument("--skip-charts", action="store_true", help="Skip PNG chart generation")
    parser.add_argument("--skip-archive", action="store_true", help="Skip compressed archive generation")
    parser.add_argument("--nccl-tests-path", type=Path, default=None, help="Directory containing nccl-tests binaries or build/")
    parser.add_argument("--min-bytes", "--message-min", dest="min_bytes", default="8M", help="NCCL -b value")
    parser.add_argument("--max-bytes", "--message-max", dest="max_bytes", default="1G", help="NCCL -e value")
    parser.add_argument("--iters", "--iterations", dest="iters", type=int, default=20, help="NCCL measured iterations")
    parser.add_argument("--warmup-iters", "--warmups", dest="warmup_iters", type=int, default=5, help="NCCL warmup iterations")
    parser.add_argument("--timeout-seconds", type=int, default=900, help="Per-benchmark timeout")
    args = parser.parse_args(argv)
    return BenchmarkOptions(
        platform=args.platform,
        gpu=args.gpu,
        output=args.output,
        dry_run=args.dry_run,
        collect_only=args.collect_only,
        benchmark_only=args.benchmark_only,
        skip_charts=args.skip_charts,
        skip_archive=args.skip_archive,
        nccl_tests_path=args.nccl_tests_path,
        min_bytes=args.min_bytes,
        max_bytes=args.max_bytes,
        iters=args.iters,
        warmup_iters=args.warmup_iters,
        timeout_seconds=args.timeout_seconds,
    )


def main(argv: list[str] | None = None) -> int:
    try:
        result = run_workflow(parse_args(argv))
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
