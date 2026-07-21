from __future__ import annotations

import json
import re
from typing import Any

GPU_LINE = re.compile(r"^GPU\s+(?P<index>\d+):\s+(?P<model>.+?)\s+\(UUID:\s*(?P<uuid>[^)]+)\)")
MIG_LINE = re.compile(r"MIG\s+(?P<profile>.+?)\s+Device\s+(?P<index>\d+):\s+\(UUID:\s*(?P<uuid>[^)]+)\)")

def parse_nvidia_smi_list(text: str) -> dict[str, Any]:
    gpus: list[dict[str, Any]] = []
    warnings: list[str] = []
    current = None
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        m = GPU_LINE.match(line)
        if m:
            current = {"index": int(m.group("index")), "model": m.group("model").strip(), "uuid": m.group("uuid").strip(), "mig_devices": []}
            gpus.append(current)
            continue
        mig = MIG_LINE.search(line)
        if mig and current is not None:
            current["mig_devices"].append({"profile": mig.group("profile").strip(), "index": int(mig.group("index")), "uuid": mig.group("uuid").strip()})
            continue
        warnings.append(f"Unparsed nvidia-smi -L line: {line[:120]}")
    return {"gpu_count": len(gpus), "gpus": gpus, "warnings": warnings}

def parse_inventory_csv(text: str) -> dict[str, Any]:
    gpus=[]; warnings=[]
    for line_no, raw in enumerate(text.splitlines(), 1):
        if not raw.strip(): continue
        parts=[p.strip() for p in raw.split(",")]
        if len(parts) < 6:
            warnings.append(f"Malformed inventory row {line_no}"); continue
        try: index=int(parts[0])
        except ValueError:
            warnings.append(f"Invalid GPU index row {line_no}"); continue
        gpus.append({"index": index, "model": parts[1] or None, "uuid": parts[2] or None, "memory_total": parts[3] or None, "driver_version": parts[4] or None, "pci_bus_id": parts[5] or None})
    return {"gpus": gpus, "warnings": warnings}

def parse_topology(text: str) -> dict[str, Any]:
    lines=[ln.strip() for ln in text.splitlines() if ln.strip()]
    if not lines: return {"matrix": [], "warnings": ["Empty topology output"]}
    headers=lines[0].split()
    gpu_headers=[h for h in headers if h.startswith("GPU")]
    rows=[]; warnings=[]
    for raw in lines[1:]:
        parts=raw.split()
        if not parts or not parts[0].startswith("GPU"):
            continue
        row={"gpu": parts[0]}
        for i,h in enumerate(gpu_headers, 1):
            if i < len(parts): row[h]=parts[i]
        rows.append(row)
    if not rows: warnings.append("No GPU topology rows parsed")
    return {"matrix": rows, "warnings": warnings}

def parse_driver_version(text: str) -> dict[str, Any]:
    vals=[ln.strip() for ln in text.splitlines() if ln.strip()]
    if not vals: return {"driver_version": None, "warnings": ["No driver version found"]}
    warnings=[] if len(set(vals)) == 1 else ["Multiple driver versions reported"]
    return {"driver_version": vals[0], "warnings": warnings}

def parse_cuda_version(text: str) -> dict[str, Any]:
    stripped=text.strip(); warnings=[]
    if not stripped: return {"cuda_version": None, "warnings": ["No CUDA version output"]}
    try:
        data=json.loads(stripped)
        version=data.get("cuda", {}).get("version") or data.get("version")
        if version: return {"cuda_version": str(version), "warnings": []}
    except Exception:
        pass
    m=re.search(r"release\s+(\d+(?:\.\d+)*)", stripped, re.I) or re.search(r"CUDA Version:\s*(\d+(?:\.\d+)*)", stripped, re.I)
    if m: return {"cuda_version": m.group(1), "warnings": []}
    return {"cuda_version": None, "warnings": ["Unable to parse CUDA version"]}

def parse_pytorch_gpu_count(text: str) -> dict[str, Any]:
    try:
        return {"gpu_count": int(text.strip()), "warnings": []}
    except Exception:
        return {"gpu_count": None, "warnings": ["Unable to parse PyTorch GPU count"]}

def parse_nccl_all_reduce_smoke(stdout: str, stderr: str, state: str, exit_code: int | None) -> dict[str, Any]:
    text = f"{stdout or ''}\n{stderr or ''}"
    rows=[]; warnings=[]
    for line_no, raw in enumerate((stdout or "").splitlines(), 1):
        line=raw.strip()
        if not line or line.startswith("#") or not re.match(r"^\d+\s+\d+\s+\w+\s+\w+\s+", line):
            continue
        parts=line.split()
        try:
            row={
                "line": line_no,
                "message_size": int(parts[0]),
                "count": int(parts[1]),
                "datatype": parts[2],
                "operation": parts[3],
                "time": float(parts[5]),
                "algorithm_bandwidth": float(parts[6]),
                "bus_bandwidth": float(parts[7]),
                "validation_errors": int(float(parts[8])) if len(parts) > 8 and re.match(r"^[0-9.]+$", parts[8]) else None,
            }
        except Exception:
            warnings.append(f"Malformed NCCL row {line_no}")
            continue
        rows.append(row)
    if not rows:
        warnings.append("No NCCL all_reduce_perf data rows parsed")
    if state != "completed" or exit_code not in (0, None):
        warnings.append(f"NCCL command state {state} exit_code {exit_code}")
    alg=[row["algorithm_bandwidth"] for row in rows]
    bus=[row["bus_bandwidth"] for row in rows]
    errors=sum((row.get("validation_errors") or 0) for row in rows)
    out_of_bounds_match=re.search(r"out of bounds values\s*:?\s*(\d+)", text, re.I)
    version_match=re.search(r"NCCL(?:\s+version)?\s*[:=]?\s*([0-9][\w.+\-]*)", text, re.I)
    return {
        "command_type": "nccl_all_reduce_smoke",
        "nccl_version": version_match.group(1) if version_match else None,
        "rows": rows,
        "message_size": rows[-1]["message_size"] if rows else None,
        "count": rows[-1]["count"] if rows else None,
        "datatype": rows[-1]["datatype"] if rows else None,
        "operation": rows[-1]["operation"] if rows else None,
        "time": rows[-1]["time"] if rows else None,
        "algorithm_bandwidth": max(alg) if alg else None,
        "bus_bandwidth": max(bus) if bus else None,
        "validation_errors": errors,
        "out_of_bounds_values": int(out_of_bounds_match.group(1)) if out_of_bounds_match else None,
        "exit_code": exit_code,
        "warnings": warnings,
        "raw_output": text.strip(),
    }

def parse_result(command_type: str, stdout: str, stderr: str, state: str) -> tuple[dict[str, Any], list[str]]:
    if command_type == "nccl_all_reduce_smoke":
        parsed = parse_nccl_all_reduce_smoke(stdout, stderr, state, 0 if state == "completed" else None)
        warnings=list(parsed.pop("warnings", []))
        return parsed, warnings
    if state != "completed":
        return ({"error": stderr.strip()} if stderr.strip() else {}, [])
    try:
        mapping={"nvidia_smi_list": parse_nvidia_smi_list, "nvidia_smi_inventory": parse_inventory_csv, "nvidia_smi_topology": parse_topology, "driver_version": parse_driver_version, "cuda_version": parse_cuda_version, "pytorch_gpu_count": parse_pytorch_gpu_count}
        parsed=mapping[command_type](stdout)
        warnings=list(parsed.pop("warnings", []))
        return parsed, warnings
    except Exception as exc:
        return {}, [f"Parser failed for {command_type}: {exc}"]
