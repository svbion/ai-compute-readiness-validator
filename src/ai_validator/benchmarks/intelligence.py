from __future__ import annotations

import csv
import hashlib
import json
import re
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean
from typing import Any, Literal

BenchmarkType = Literal["nccl", "hpl", "triton_perf_analyzer", "genai_perf"]
ANSI_RE = re.compile(r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")


def strip_ansi(text: str) -> str:
    return ANSI_RE.sub("", text)


def num(value: str | None) -> float | None:
    if value is None:
        return None
    try:
        return float(value.replace(",", ""))
    except ValueError:
        return None


@dataclass
class BenchmarkRunModel:
    id: str
    schema_version: str
    engagement_id: str
    node_id: str | None
    benchmark_type: str
    benchmark_version: str | None
    tool_version: str | None
    collected_at: str
    uploaded_at: str
    status: str
    simulated: bool
    input_file: str
    sha256: str
    warnings: list[str]
    metrics: dict[str, Any]
    raw_storage_id: str
    provenance: dict[str, Any]


def parse_nccl(text: str, input_file: str) -> dict[str, Any]:
    clean = strip_ansi(text)
    lines = clean.splitlines()
    rows: list[dict[str, Any]] = []
    for idx, raw in enumerate(lines, start=1):
        line = raw.strip()
        if not line or line.startswith("#") or ("INFO" in line and not line[:1].isdigit()):
            continue
        parts = line.split()
        if len(parts) < 8 or not parts[0].isdigit() or not parts[1].isdigit() or parts[2].lower() not in {"char", "half", "float", "double", "int", "uint", "int64", "uint64"}:
            continue
        numbers = [num(part) for part in parts]
        numeric = [value for value in numbers if value is not None]
        if len(numeric) < 5:
            continue
        rows.append({"line": idx, "size": int(numeric[0]), "time": numeric[-4], "algbw": numeric[-3], "busbw": numeric[-2], "wrong": int(numeric[-1])})
    bus = [row["busbw"] for row in rows if row.get("busbw") is not None]
    alg = [row["algbw"] for row in rows if row.get("algbw") is not None]
    reported_avg_bus = num((re.search(r"Avg bus bandwidth\s*:?\s*([0-9.]+)", clean, re.I) or [None, None])[1])
    out_of_bounds = num((re.search(r"out of bounds values\s*:?\s*(\d+)", clean, re.I) or [None, None])[1])
    metrics = {
        "benchmark": (re.search(r"\b(all_reduce_perf|all_gather_perf|reduce_scatter_perf|broadcast_perf)\b", clean, re.I) or [None, "nccl_tests"])[1],
        "message_size": rows[-1]["size"] if rows else None,
        "algorithm_bandwidth": max(alg) if alg else None,
        "bus_bandwidth": max(bus) if bus else None,
        "average_bus_bandwidth": reported_avg_bus if reported_avg_bus is not None else (mean(bus) if bus else None),
        "average_algorithm_bandwidth": mean(alg) if alg else None,
        "time": rows[-1]["time"] if rows else None,
        "errors": sum(row.get("wrong", 0) for row in rows),
        "wrong_result_count": sum(row.get("wrong", 0) for row in rows),
        "out_of_bounds_count": int(out_of_bounds) if out_of_bounds is not None else None,
        "gpu_count": int((re.search(r"\b(?:nranks|ranks)\s*[:=]?\s*(\d+)", clean, re.I) or re.search(r"\b(\d+)\s+GPU", clean, re.I) or re.search(r"\bGPUs\s*:?\s*(\d+)\s*x", clean, re.I) or [None, 0])[1]) or None,
        "node_count": int(re.search(r"\b(?:nodes|nnodes)\s*[:=]?\s*(\d+)", clean, re.I).group(1)) if re.search(r"\b(?:nodes|nnodes)\s*[:=]?\s*(\d+)", clean, re.I) else None,
        "cuda_version": (re.search(r"CUDA(?: Version)?\s*[:=]?\s*([0-9][\w.-]+)", clean, re.I) or [None, None])[1],
        "nccl_version": (re.search(r"NCCL(?: version)?\s*[:=]?\s*([0-9][\w.+-]+)", clean, re.I) or [None, None])[1],
        "transport": (re.search(r"\b(NVLink|NVL|InfiniBand|IB|RoCE|TCP|Socket)\b", clean, re.I) or [None, None])[1],
    }
    return {"metrics": metrics, "warnings": [] if rows else ["No NCCL data rows were parsed."], "tool_version": metrics["nccl_version"], "benchmark_version": metrics["nccl_version"], "lines": [row["line"] for row in rows]}


def parse_hpl(text: str, input_file: str) -> dict[str, Any]:
    clean = strip_ansi(text)
    best: dict[str, Any] | None = None
    for idx, line in enumerate(clean.splitlines(), start=1):
        match = re.match(r"^\S+\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([0-9.eE+-]+)\s+([0-9.eE+-]+)", line.strip())
        if match:
            row = {"line": idx, "problem_size": int(match.group(1)), "block_size": int(match.group(2)), "P": int(match.group(3)), "Q": int(match.group(4)), "runtime": float(match.group(5)), "performance_gflops": float(match.group(6))}
            if best is None or row["performance_gflops"] > best["performance_gflops"]:
                best = row
    residual_failed = bool(re.search(r"FAILED|residual.*fail", clean, re.I))
    residual_passed = not residual_failed and bool(re.search(r"PASSED|residual.*pass", clean, re.I))
    gflops = best["performance_gflops"] if best else None
    metrics = {
        "problem_size": best["problem_size"] if best else None,
        "block_size": best["block_size"] if best else None,
        "P": best["P"] if best else None,
        "Q": best["Q"] if best else None,
        "runtime": best["runtime"] if best else None,
        "performance_gflops": gflops,
        "performance_tflops": gflops / 1000 if gflops is not None else None,
        "residual_pass": True if residual_passed else False if residual_failed else None,
        "gpu_count": int(re.search(r"\b(\d+)\s+GPU", clean, re.I).group(1)) if re.search(r"\b(\d+)\s+GPU", clean, re.I) else None,
        "node_count": int(re.search(r"\b(?:nodes|nnodes)\s*[:=]?\s*(\d+)", clean, re.I).group(1)) if re.search(r"\b(?:nodes|nnodes)\s*[:=]?\s*(\d+)", clean, re.I) else None,
    }
    warnings = []
    if not best:
        warnings.append("No HPL performance row was parsed.")
    if metrics["residual_pass"] is None:
        warnings.append("No explicit HPL residual pass/fail result was found.")
    return {"metrics": metrics, "warnings": warnings, "tool_version": (re.search(r"HPL(?: version)?\s*[:=]?\s*([0-9][\w.-]+)", clean, re.I) or [None, None])[1], "benchmark_version": None, "lines": [best["line"]] if best else []}


def find_metric(text: str, labels: list[str]) -> float | None:
    for label in labels:
        match = re.search(re.escape(label) + r"[^0-9\n\r+-]*([0-9][0-9,.eE+-]*)", text, re.I)
        value = num(match.group(1) if match else None)
        if value is not None:
            return value
    return None


def parse_inference(text: str, benchmark_type: BenchmarkType, input_file: str) -> dict[str, Any]:
    clean = strip_ansi(text)
    rows: list[dict[str, str]] = []
    if "," in clean.splitlines()[0] if clean.splitlines() else False:
        rows = list(csv.DictReader(clean.splitlines()))
    first = {k.lower(): v for k, v in (rows[0] if rows else {}).items()}

    def csv_metric(keys: list[str]) -> float | None:
        for wanted in keys:
            key = next((candidate for candidate in first if wanted in candidate), None)
            value = num(first.get(key, "") if key else None)
            if value is not None:
                return value
        return None

    metrics = {
        "throughput": csv_metric(["throughput", "infer/sec", "inferences/second"]) or find_metric(clean, ["Throughput", "Inferences/Second"]),
        "average_latency": csv_metric(["avg latency", "average latency"]) or find_metric(clean, ["Average latency", "Avg latency", "Request latency"]),
        "p95": csv_metric(["p95", "95"]) or find_metric(clean, ["p95", "95th percentile"]),
        "p99": csv_metric(["p99", "99"]) or find_metric(clean, ["p99", "99th percentile"]),
        "queue_time": csv_metric(["queue"]) or find_metric(clean, ["queue time", "Queue"]),
        "compute_time": csv_metric(["compute"]) or find_metric(clean, ["compute time", "Compute"]),
        "requests": csv_metric(["requests", "request count"]) or find_metric(clean, ["Requests", "request count"]),
        "tokens_per_second": csv_metric(["tokens/sec", "tokens per second"]) or find_metric(clean, ["tokens/sec", "tokens per second", "Output token throughput"]),
        "time_to_first_token": csv_metric(["time to first token", "ttft"]) or find_metric(clean, ["time to first token", "TTFT"]),
        "inter_token_latency": csv_metric(["inter token", "itl"]) or find_metric(clean, ["inter token latency", "ITL"]),
    }
    return {"metrics": metrics, "warnings": [] if any(v is not None for v in metrics.values()) else ["No inference benchmark metrics were parsed."], "tool_version": None, "benchmark_version": None, "lines": [1] if any(v is not None for v in metrics.values()) else []}


def parse_benchmark_file(benchmark_type: BenchmarkType, input_path: Path, *, engagement_id: str = "local-import", node_id: str | None = None, simulated: bool = False) -> BenchmarkRunModel:
    text = input_path.read_text(encoding="utf-8", errors="replace")
    digest = hashlib.sha256(input_path.read_bytes()).hexdigest()
    if benchmark_type == "nccl":
        parsed = parse_nccl(text, input_path.name)
    elif benchmark_type == "hpl":
        parsed = parse_hpl(text, input_path.name)
    elif benchmark_type in {"triton_perf_analyzer", "genai_perf"}:
        parsed = parse_inference(text, benchmark_type, input_path.name)
    else:
        raise ValueError(f"Unsupported benchmark type: {benchmark_type}")
    status = "rejected" if any(w.startswith("No ") for w in parsed["warnings"]) else "accepted"
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    return BenchmarkRunModel(
        id=f"bmk_{digest[:16]}",
        schema_version="1.0.0",
        engagement_id=engagement_id,
        node_id=node_id,
        benchmark_type=benchmark_type,
        benchmark_version=parsed["benchmark_version"],
        tool_version=parsed["tool_version"],
        collected_at=now,
        uploaded_at=now,
        status=status,
        simulated=simulated,
        input_file=str(input_path),
        sha256=digest,
        warnings=parsed["warnings"],
        metrics=parsed["metrics"],
        raw_storage_id=digest[:16],
        provenance={"input_file": str(input_path), "parser_version": "1.0.0", "source_lines": parsed["lines"], "parser": benchmark_type, "simulated": simulated},
    )


def write_import(run: BenchmarkRunModel, output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    target = output_dir / f"{run.raw_storage_id}.json"
    target.write_text(json.dumps(asdict(run), indent=2) + "\n", encoding="utf-8")
    return target
