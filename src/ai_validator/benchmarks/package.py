from __future__ import annotations

import csv
import hashlib
import json
import re
import shutil
import tarfile
import tempfile
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ANSI_RE = re.compile(r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")
GPU_LINE_RE = re.compile(r"^GPU\s+(\d+):\s+(.+?)\s+\(UUID:\s*([^)]*)\)")
LINK_LINE_RE = re.compile(r"Link\s+(\d+):\s+([0-9.]+)\s+GB/s")
NCCL_COLLECTIVES = [
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

class BenchmarkPackageError(ValueError):
    pass

def strip_ansi(text: str) -> str:
    return ANSI_RE.sub("", text or "")

def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()

def parse_gpu_inventory(text: str) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for line in strip_ansi(text).splitlines():
        match = GPU_LINE_RE.match(line.strip())
        if match:
            uuid = match.group(3).strip()
            out.append({"index": int(match.group(1)), "label": f"GPU{match.group(1)}", "model": match.group(2).strip(), "uuid_sanitized": "REDACTED" in uuid})
    return out

def parse_topology_matrix(text: str) -> dict[str, Any]:
    clean = strip_ansi(text)
    lines = [line.rstrip() for line in clean.splitlines() if line.strip()]
    header_idx = next((idx for idx, line in enumerate(lines) if re.search(r"\bGPU0\b", line)), None)
    if header_idx is None:
        return {"gpu_labels": [], "rows": [], "matrix": [], "gpu_pairs": 0, "nvlink_connected_pairs": 0, "all_visible_gpu_pairs_nvlink_connected": False, "topology_labels": [], "nvlink_width_labels": [], "cpu_affinity": {}, "numa_affinity": {}, "nic_names": {}, "warnings": ["No GPU topology header found."]}
    header = lines[header_idx].split()
    gpu_labels = [entry for entry in header if re.fullmatch(r"GPU\d+", entry)]
    rows: list[str] = []
    matrix: list[list[str]] = []
    cpu_affinity: dict[str, str] = {}
    numa_affinity: dict[str, str] = {}
    nic_names: dict[str, str] = {}
    for line in lines[header_idx + 1:]:
        parts = line.split()
        if not parts:
            continue
        if re.fullmatch(r"GPU\d+", parts[0]):
            rows.append(parts[0])
            matrix.append(parts[1 : 1 + len(gpu_labels)])
            tail = parts[1 + len(gpu_labels):]
            for token in tail:
                if re.fullmatch(r"[0-9,-]+", token) and "-" in token:
                    cpu_affinity[parts[0]] = token
                    break
            for token in tail:
                if re.fullmatch(r"\d+", token):
                    numa_affinity[parts[0]] = token
                    break
        nic_match = re.match(r"\s*(NIC\d+):\s*(\S+)", line)
        if nic_match:
            nic_names[nic_match.group(1)] = nic_match.group(2)
    offdiag = [(i, j, value) for i, row in enumerate(matrix) for j, value in enumerate(row) if i != j]
    nv_pairs = [(i, j, value) for i, j, value in offdiag if i < j and re.fullmatch(r"NV\d+", value)]
    non_nv = [value for _i, _j, value in offdiag if not re.fullmatch(r"NV\d+", value)]
    return {
        "gpu_labels": gpu_labels,
        "rows": rows,
        "matrix": matrix,
        "gpu_pairs": len(gpu_labels) * (len(gpu_labels) - 1) // 2,
        "nvlink_connected_pairs": len(nv_pairs),
        "all_visible_gpu_pairs_nvlink_connected": bool(offdiag) and not non_nv,
        "topology_labels": sorted({value for _i, _j, value in offdiag}),
        "nvlink_width_labels": sorted({value for _i, _j, value in offdiag if re.fullmatch(r"NV\d+", value)}),
        "cpu_affinity": cpu_affinity,
        "numa_affinity": numa_affinity,
        "nic_names": nic_names,
        "warnings": [f"Non-NVLink peer paths observed: {sorted(set(non_nv))}"] if non_nv else [],
    }

def _matrix_offdiag(matrix: list[list[str]]) -> list[tuple[int, int, str]]:
    return [(i, j, value) for i, row in enumerate(matrix) for j, value in enumerate(row) if i != j]

def parse_p2p_matrix(text: str, kind: str) -> dict[str, Any]:
    topo = parse_topology_matrix(text)
    pairs = []
    all_ok = bool(topo["matrix"])
    for i, j, value in _matrix_offdiag(topo["matrix"]):
        if value != "OK":
            all_ok = False
        pairs.append({"source": topo["rows"][i] if i < len(topo["rows"]) else f"GPU{i}", "target": topo["gpu_labels"][j] if j < len(topo["gpu_labels"]) else f"GPU{j}", "status": value})
    return {"kind": kind, "gpu_labels": topo["gpu_labels"], "matrix": topo["matrix"], "pairs": pairs, "all_ok": all_ok, "aggregate_status": "PASS" if all_ok else "WARNING" if pairs else "NOT AVAILABLE"}

def parse_nvlink_status(text: str) -> dict[str, Any]:
    current: str | None = None
    links: dict[str, int] = {}
    rates: dict[str, list[float]] = {}
    inactive: list[dict[str, str]] = []
    for line in strip_ansi(text).splitlines():
        gpu_match = GPU_LINE_RE.match(line.strip())
        if gpu_match:
            current = f"GPU{gpu_match.group(1)}"
            links[current] = 0
            rates[current] = []
            continue
        link_match = LINK_LINE_RE.search(line)
        if current and link_match:
            links[current] += 1
            rates[current].append(float(link_match.group(2)))
        elif current and "Inactive" in line:
            inactive.append({"gpu": current, "line": line.strip()})
    rate_set = sorted({rate for values in rates.values() for rate in values})
    counts = sorted(set(links.values()))
    return {"active_link_count_per_gpu": links, "inactive_links": inactive, "reported_rates_gbps": rate_set, "consistent_link_count": len(counts) <= 1, "consistent_rate": len(rate_set) <= 1, "all_links_active": bool(links) and all(count > 0 for count in links.values())}

def parse_nccl_output(text: str, collective: str | None = None) -> dict[str, Any]:
    clean = strip_ansi(text)
    collective = collective or (re.search(r"Collective test starting:\s*(\S+)", clean) or re.search(r"\b(" + "|".join(NCCL_COLLECTIVES) + r")\b", clean) or [None, "unknown"])[1]
    nccl_version = (re.search(r"NCCL version\s+([^\s]+)", clean) or [None, None])[1]
    args: dict[str, Any] = {}
    arg_match = re.search(r"nThread\s+(\d+)\s+nGpus\s+(\d+)\s+minBytes\s+(\d+)\s+maxBytes\s+(\d+).*?warmup iters:\s*(\d+)\s+iters:\s*(\d+)", clean)
    if arg_match:
        args = {"nthreads": int(arg_match.group(1)), "ngpus": int(arg_match.group(2)), "min_bytes": int(arg_match.group(3)), "max_bytes": int(arg_match.group(4)), "warmups": int(arg_match.group(5)), "iterations": int(arg_match.group(6))}
    rows: list[dict[str, Any]] = []
    warnings: list[str] = []
    dtypes = {"char", "half", "float", "double", "int", "uint", "int64", "uint64"}
    for line_number, raw in enumerate(clean.splitlines(), start=1):
        parts = raw.strip().split()
        if len(parts) < 9 or not re.fullmatch(r"\d+", parts[0]) or not re.fullmatch(r"\d+", parts[1]) or parts[2].lower() not in dtypes:
            continue
        def number(value: str) -> float | None:
            try:
                return float(value)
            except ValueError:
                return None
        numeric = [number(part) for part in parts[5:]]
        row = {"line": line_number, "collective": collective, "message_size_bytes": int(parts[0]), "element_count": int(parts[1]), "datatype": parts[2], "reduction_op": parts[3], "root": parts[4]}
        if len(numeric) >= 8:
            row.update({"out_of_place_time_us": numeric[0], "out_of_place_algorithm_bandwidth_gbps": numeric[1], "out_of_place_bus_bandwidth_gbps": numeric[2], "out_of_place_wrong": int(numeric[3] or 0), "in_place_time_us": numeric[4], "in_place_algorithm_bandwidth_gbps": numeric[5], "in_place_bus_bandwidth_gbps": numeric[6], "in_place_wrong": int(numeric[7] or 0)})
        else:
            warnings.append(f"Line {line_number}: incomplete NCCL row")
        rows.append(row)
    avg = (re.search(r"Avg bus bandwidth\s*:?\s*([0-9.eE+-]+)", clean) or [None, None])[1]
    out_of_bounds = (re.search(r"Out of bounds values\s*:?\s*(\d+)", clean, re.I) or [None, None])[1]
    if not rows:
        warnings.append("No NCCL data rows were parsed.")
    if re.search(r"\b(WARN|Failed|Could not find)\b", clean):
        warnings.append("NCCL output includes warning/fallback text.")
    validation_errors = sum((row.get("out_of_place_wrong") or 0) + (row.get("in_place_wrong") or 0) for row in rows)
    summary = {"collective": collective, "nccl_version": nccl_version, "process_thread_gpu_count": args.get("ngpus"), "benchmark_arguments": args, "row_count": len(rows), "average_bus_bandwidth_gbps": float(avg) if avg else None, "out_of_bounds_values": int(out_of_bounds) if out_of_bounds else None, "validation_errors": validation_errors, "max_out_of_place_bus_bandwidth_gbps": max([row.get("out_of_place_bus_bandwidth_gbps") or 0 for row in rows], default=None), "max_in_place_bus_bandwidth_gbps": max([row.get("in_place_bus_bandwidth_gbps") or 0 for row in rows], default=None), "warnings": warnings}
    return {"summary": summary, "rows": rows, "warnings": warnings}

def parse_nccl_topology_xml(text: str) -> dict[str, Any]:
    result = {"available": bool(text.strip()), "gpu_busids": [], "nic_names": [], "warnings": []}
    if not text.strip():
        result["warnings"].append("NCCL topology XML is empty or unavailable.")
        return result
    try:
        root = ET.fromstring(text)
    except ET.ParseError as exc:
        result["warnings"].append(f"Unable to parse NCCL topology XML: {exc}")
        return result
    result["gpu_busids"] = sorted({node.attrib.get("busid", "") for node in root.iter() if node.tag.lower().endswith("gpu") and node.attrib.get("busid")})
    result["nic_names"] = sorted({node.attrib.get("name", "") for node in root.iter() if node.tag.lower().endswith("net") and node.attrib.get("name")})
    return result

def parse_nccl_debug_logs(texts: list[str]) -> dict[str, Any]:
    joined = "\n".join(strip_ansi(text) for text in texts)
    transports = sorted(set(item for pair in re.findall(r"Using network\s+(\S+)|NET/(Socket|IB|Plugin)", joined) for item in pair if item))
    ring_lines = re.findall(r"(?:Channel\s+\d+\/\d+\s*:\s*[^\n]+|Ring\s+[^\n]+)", joined)
    tree_lines = re.findall(r"(?:Trees?\s*\[[^\n]+|Tree\s+[^\n]+)", joined)
    channels = sorted(set(re.findall(r"Channel\s+(\d+)", joined)), key=lambda value: int(value)) if re.findall(r"Channel\s+(\d+)", joined) else []
    warnings = [line for line in joined.splitlines() if any(token in line for token in ["WARN", "Failed", "Could not find", "Disabled"])]
    return {"nccl_version": (re.search(r"NCCL version\s+([^\s]+)", joined) or [None, None])[1], "transports": transports, "transport_evidence": [line for line in joined.splitlines() if "Using network" in line or "NET/" in line][:100], "ring_lines": ring_lines[:200], "tree_lines": tree_lines[:200], "channel_ids": channels, "warnings": warnings[:200]}

def analyze_gpu_fabric(inventory: list[dict[str, Any]], topology: dict[str, Any], p2p: dict[str, dict[str, Any]], nvlink: dict[str, Any]) -> dict[str, Any]:
    fully = bool(topology.get("all_visible_gpu_pairs_nvlink_connected"))
    active = bool(nvlink.get("all_links_active"))
    p2p_read = p2p.get("read", {}).get("aggregate_status", "NOT AVAILABLE")
    p2p_write = p2p.get("write", {}).get("aggregate_status", "NOT AVAILABLE")
    p2p_atomic = p2p.get("atomics", {}).get("aggregate_status", "NOT AVAILABLE")
    p2p_nvlink = p2p.get("nvlink", {}).get("aggregate_status", "NOT AVAILABLE")
    all_p2p_ok = all(value == "PASS" for value in [p2p_read, p2p_write, p2p_atomic, p2p_nvlink])
    if fully and active and all_p2p_ok:
        status = "PASS"
        conclusion = "Fully connected peer-visible NVLink fabric verified."
    elif active and not fully:
        status = "WARNING"
        conclusion = "NVLink-capable hardware reports active links, but allocated peer topology is not exposed as NVLink for every visible GPU pair."
    elif not topology.get("gpu_labels"):
        status = "NOT AVAILABLE"
        conclusion = "Managed environment did not expose enough topology evidence."
    else:
        status = "FAIL"
        conclusion = "Peer-visible NVLink fabric validation failed or is incomplete."
    return {"schema_version": "0.1.0", "status": status, "conclusion": conclusion, "gpu_count": len(inventory), "gpu_models": sorted({item["model"] for item in inventory}), "nvlink_capable_hardware": "PASS" if inventory else "NOT AVAILABLE", "active_physical_nvlink": "PASS" if active else "WARNING", "peer_nvlink_topology": "PASS" if fully else "WARNING", "peer_nvlink_transport": p2p_nvlink, "peer_read_support": p2p_read, "peer_write_support": p2p_write, "peer_atomic_support": p2p_atomic, "fully_connected_fabric": fully, "partial_fabric": bool(topology.get("nvlink_width_labels")) and not fully, "fabric_classification": "fully connected NVLink fabric" if fully else "partial or non-NVLink peer fabric", "nvlink_widths": topology.get("nvlink_width_labels", []), "reported_link_rates_gbps": nvlink.get("reported_rates_gbps", []), "findings": [{"status": "PASS" if inventory else "NOT AVAILABLE", "kind": "inventory", "message": f"{len(inventory)} visible GPUs listed."}, {"status": "PASS" if active else "WARNING", "kind": "physical_nvlink", "message": "Physical NVLink interfaces active." if active else "Physical NVLink state not fully active/available."}, {"status": "PASS" if fully else "WARNING", "kind": "peer_topology", "message": "Every visible GPU pair has an NV# topology token." if fully else "Some visible GPU pairs are not peer-visible NVLink paths."}], "evidence_citations": {"inventory": "evidence/gpu/nvidia-smi-list.txt", "topology": "evidence/topology/topology-matrix.txt", "p2p": "evidence/nvlink/p2p-*.txt", "nvlink_status": "evidence/nvlink/nvlink-status.txt"}, "remediation_recommendations": ["If topology is SYS while links are active, request an allocation exposing peer NVLink or document provider/container fabric limitations."], "confidence_notes": ["Evidence is limited to supplied package files; no physical switch layout is inferred."]}

@dataclass
class IngestResult:
    package_dir: Path
    output_dir: Path
    summary: dict[str, Any]

def discover_package(path: Path) -> Path:
    path = path.expanduser().resolve()
    if path.is_dir():
        return path
    if path.is_file() and path.name.endswith((".tar.gz", ".tgz")):
        tmp = Path(tempfile.mkdtemp(prefix="gpuvalidator-benchmark-package-"))
        with tarfile.open(path, "r:gz") as archive:
            archive.extractall(tmp)
        entries = [entry for entry in tmp.iterdir()]
        return entries[0] if len(entries) == 1 and entries[0].is_dir() else tmp
    raise BenchmarkPackageError(f"Benchmark package path does not exist: {path}")

def verify_sha256sums(package_dir: Path) -> list[str]:
    sums = package_dir / "SHA256SUMS"
    if not sums.exists():
        return ["SHA256SUMS is missing."]
    warnings: list[str] = []
    for line in sums.read_text(encoding="utf-8", errors="replace").splitlines():
        if not line.strip():
            continue
        try:
            digest, rel = line.split(None, 1)
            rel = rel.strip().lstrip("*")
        except ValueError:
            warnings.append(f"Malformed SHA256SUMS line: {line}")
            continue
        target = package_dir / rel
        if not target.exists():
            warnings.append(f"Checksum target missing: {rel}")
        elif sha256_file(target) != digest:
            warnings.append(f"Checksum mismatch: {rel}")
    return warnings

def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace") if path.exists() else ""

def ingest_package(path: Path, output_dir: Path | None = None) -> IngestResult:
    package_dir = discover_package(path)
    output_dir = (output_dir or package_dir / "gpuvalidator-ingest").expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    metadata = json.loads(_read_text(package_dir / "metadata.json") or "{}")
    manifest = json.loads(_read_text(package_dir / "manifest.json") or "{}")
    inventory = parse_gpu_inventory(_read_text(package_dir / "evidence/gpu/nvidia-smi-list.txt"))
    topology = parse_topology_matrix(_read_text(package_dir / "evidence/topology/topology-matrix.txt"))
    p2p = {"nvlink": parse_p2p_matrix(_read_text(package_dir / "evidence/nvlink/p2p-nvlink.txt"), "nvlink"), "read": parse_p2p_matrix(_read_text(package_dir / "evidence/nvlink/p2p-read.txt"), "read"), "write": parse_p2p_matrix(_read_text(package_dir / "evidence/nvlink/p2p-write.txt"), "write"), "atomics": parse_p2p_matrix(_read_text(package_dir / "evidence/nvlink/p2p-atomic.txt"), "atomics")}
    nvlink = parse_nvlink_status(_read_text(package_dir / "evidence/nvlink/nvlink-status.txt"))
    fabric = analyze_gpu_fabric(inventory, topology, p2p, nvlink)
    nccl: list[dict[str, Any]] = []
    for collective in NCCL_COLLECTIVES:
        source = package_dir / "evidence/nccl" / f"{collective}.txt"
        if source.exists():
            parsed = parse_nccl_output(_read_text(source), collective)
            nccl.append(parsed["summary"])
            (output_dir / f"{collective}.json").write_text(json.dumps(parsed, indent=2) + "\n", encoding="utf-8")
    xml = parse_nccl_topology_xml(_read_text(package_dir / "evidence/nccl/nccl-topology.xml"))
    debug = parse_nccl_debug_logs([_read_text(p) for p in sorted((package_dir / "evidence/nccl").glob("nccl-debug*.log"))[:2]]) if (package_dir / "evidence/nccl").exists() else {}
    checksum_warnings = verify_sha256sums(package_dir)
    summary = {"schema_version": "0.1.0", "package_dir": str(package_dir), "metadata": metadata, "manifest_file_count": len(manifest.get("files", [])), "checksum_status": "PASS" if not checksum_warnings else "FAIL", "checksum_warnings": checksum_warnings, "inventory": inventory, "topology": topology, "p2p": p2p, "nvlink": nvlink, "fabric": fabric, "nccl_collectives": nccl, "nccl_topology_xml": xml, "nccl_debug": debug, "status": "PASS" if not checksum_warnings and fabric["status"] == "PASS" else "WARNING"}
    (output_dir / "benchmark-ingest-summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    (output_dir / "gpu-fabric-summary.json").write_text(json.dumps(fabric, indent=2) + "\n", encoding="utf-8")
    report = render_report(summary)
    (output_dir / "GPU_BENCHMARK_REPORT.md").write_text(report, encoding="utf-8")
    return IngestResult(package_dir=package_dir, output_dir=output_dir, summary=summary)

def render_report(summary: dict[str, Any]) -> str:
    meta = summary.get("metadata", {})
    fabric = summary.get("fabric", {})
    lines = ["# GPU Benchmark Package Report", "", f"Benchmark ID: `{meta.get('benchmark_id', 'unknown')}`", f"Status: **{summary.get('status')}**", "", "## Fabric", "", f"- Result: {fabric.get('status')}", f"- Conclusion: {fabric.get('conclusion')}", f"- Fully connected: {fabric.get('fully_connected_fabric')}", "", "## NCCL collectives", ""]
    for item in summary.get("nccl_collectives", []):
        lines.append(f"- {item.get('collective')}: rows={item.get('row_count')}, avg bus bw={item.get('average_bus_bandwidth_gbps')}")
    lines += ["", "## Limitations", "", "No physical switch architecture, missing rings, channels, or unavailable transport details are inferred.", ""]
    return "\n".join(lines)

def compare_packages(path_a: Path, path_b: Path, output_dir: Path | None = None) -> dict[str, Any]:
    a = ingest_package(path_a, (output_dir / "a") if output_dir else None).summary
    b = ingest_package(path_b, (output_dir / "b") if output_dir else None).summary
    ma, mb = a.get("metadata", {}), b.get("metadata", {})
    comparable = []
    warnings = []
    for key in ["gpu_model", "gpu_count", "nccl_version", "cuda_version"]:
        same = ma.get(key) == mb.get(key)
        comparable.append({"dimension": key, "run_a": ma.get(key), "run_b": mb.get(key), "same": same})
        if not same:
            warnings.append(f"{key} differs; performance comparison may not be direct.")
    return {"schema_version": "0.1.0", "dimensions": comparable, "warnings": warnings, "run_a_status": a.get("status"), "run_b_status": b.get("status")}
