#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

GPU_LINE = re.compile(r"^GPU\s+(\d+):\s+(.+?)\s+\(UUID:")
LINK_LINE = re.compile(r"Link\s+(\d+):\s+([0-9.]+)\s+GB/s")

def read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace") if path.exists() else ""

def parse_gpu_inventory(text: str) -> list[dict[str, Any]]:
    out = []
    for line in text.splitlines():
        m = GPU_LINE.match(line.strip())
        if m:
            out.append({"index": int(m.group(1)), "model": m.group(2).strip()})
    return out

def parse_matrix(text: str) -> tuple[list[str], list[list[str]]]:
    lines = [line.rstrip() for line in text.splitlines() if line.strip()]
    header_idx = next((i for i, line in enumerate(lines) if line.lstrip().startswith("GPU0")), None)
    if header_idx is None:
        return [], []
    header = lines[header_idx].split()
    gpu_cols = [x for x in header if re.fullmatch(r"GPU\d+", x)]
    matrix = []
    for line in lines[header_idx + 1:]:
        parts = line.split()
        if not parts or not re.fullmatch(r"GPU\d+", parts[0]):
            break
        matrix.append(parts[1:1 + len(gpu_cols)])
    return gpu_cols, matrix

def off_diagonal(values: list[list[str]]) -> list[str]:
    out = []
    for i, row in enumerate(values):
        for j, value in enumerate(row):
            if i != j:
                out.append(value)
    return out

def parse_nvlink_status(text: str) -> dict[str, Any]:
    current = None
    links: dict[str, list[float]] = {}
    for line in text.splitlines():
        gm = GPU_LINE.match(line.strip())
        if gm:
            current = gm.group(1)
            links[current] = []
            continue
        lm = LINK_LINE.search(line)
        if current is not None and lm:
            links[current].append(float(lm.group(2)))
    return {
        "links_per_gpu": {k: len(v) for k, v in links.items()},
        "link_speeds_gbps": {k: sorted(set(v)) for k, v in links.items()},
        "all_links_active": bool(links) and all(v for v in links.values()),
    }

def analyze(raw: Path) -> dict[str, Any]:
    inventory = parse_gpu_inventory(read(raw / "nvidia-smi-list.txt"))
    topo_names, topo_matrix = parse_matrix(read(raw / "topology-matrix.txt"))
    p2p = {}
    for key, filename in {
        "nvlink": "p2p-nvlink.txt",
        "read": "p2p-read.txt",
        "write": "p2p-write.txt",
        "atomics": "p2p-atomics.txt",
    }.items():
        _, matrix = parse_matrix(read(raw / filename))
        vals = off_diagonal(matrix)
        p2p[key] = {
            "all_ok": bool(vals) and all(v == "OK" for v in vals),
            "values": vals,
        }

    topo_vals = off_diagonal(topo_matrix)
    nv_tokens = [v for v in topo_vals if re.fullmatch(r"NV\d+", v)]
    non_nv_tokens = [v for v in topo_vals if not re.fullmatch(r"NV\d+", v)]
    link_status = parse_nvlink_status(read(raw / "nvlink-status.txt"))

    fully_connected = bool(topo_vals) and not non_nv_tokens
    nv_widths = sorted({int(v[2:]) for v in nv_tokens})

    if fully_connected and all(x["all_ok"] for x in p2p.values()) and link_status["all_links_active"]:
        result = "PASS"
        conclusion = "Fully connected NVLink/NVSwitch GPU fabric verified."
    elif link_status["all_links_active"] and not fully_connected:
        result = "WARNING"
        conclusion = "NVLink interfaces are active, but the visible GPU set is not fully connected through NVLink."
    else:
        result = "FAIL"
        conclusion = "NVLink fabric could not be verified for the visible GPU set."

    return {
        "result": result,
        "conclusion": conclusion,
        "gpu_count": len(inventory),
        "gpu_models": sorted({x["model"] for x in inventory}),
        "topology_gpu_names": topo_names,
        "topology_peer_values": topo_vals,
        "nvlink_peer_tokens": nv_tokens,
        "non_nvlink_peer_tokens": non_nv_tokens,
        "fully_connected_nvlink": fully_connected,
        "nvlink_widths": nv_widths,
        "physical_link_status": link_status,
        "p2p": p2p,
        "fabric_type": "NVSwitch/NVLink" if fully_connected and len(inventory) > 2 else "NVLink" if fully_connected else "Unknown or mixed",
        "evidence": {
            "topology": "topology-matrix.txt",
            "nvlink_status": "nvlink-status.txt",
            "p2p_nvlink": "p2p-nvlink.txt",
            "p2p_read": "p2p-read.txt",
            "p2p_write": "p2p-write.txt",
            "p2p_atomics": "p2p-atomics.txt",
            "remote_links": "nvlink-remote-info.txt",
            "fabric_full": "fabric-full.txt",
        },
    }

def render_markdown(data: dict[str, Any]) -> str:
    models = ", ".join(data["gpu_models"]) or "Unknown"
    widths = ", ".join(f"NV{x}" for x in data["nvlink_widths"]) or "None"
    p2p = data["p2p"]
    return f"""# GPU Fabric Validation

## Overall result

**{data['result']} — {data['conclusion']}**

## Inventory

- Visible GPU count: **{data['gpu_count']}**
- GPU model(s): **{models}**
- Fabric classification: **{data['fabric_type']}**

## NVLink topology

- Fully connected visible GPU fabric: **{'PASS' if data['fully_connected_nvlink'] else 'FAIL'}**
- Observed bonded-link width(s): **{widths}**
- Active physical links reported: **{'PASS' if data['physical_link_status']['all_links_active'] else 'FAIL'}**
- Links per GPU: `{json.dumps(data['physical_link_status']['links_per_gpu'], sort_keys=True)}`

## Peer capabilities

- NVLink peer transport: **{'PASS' if p2p['nvlink']['all_ok'] else 'FAIL'}**
- Peer reads: **{'PASS' if p2p['read']['all_ok'] else 'FAIL'}**
- Peer writes: **{'PASS' if p2p['write']['all_ok'] else 'FAIL'}**
- Peer atomics: **{'PASS' if p2p['atomics']['all_ok'] else 'FAIL'}**

## Interpretation

The report distinguishes between NVLink-capable hardware, active physical NVLink interfaces, actual GPU-to-GPU NVLink topology, and CUDA peer capabilities. A GPU model name alone is not treated as proof of NVLink connectivity.
"""

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True, type=Path)
    ap.add_argument("--json", required=True, type=Path)
    ap.add_argument("--markdown", required=True, type=Path)
    args = ap.parse_args()
    data = analyze(args.input)
    args.json.parent.mkdir(parents=True, exist_ok=True)
    args.markdown.parent.mkdir(parents=True, exist_ok=True)
    args.json.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    args.markdown.write_text(render_markdown(data), encoding="utf-8")

if __name__ == "__main__":
    main()
