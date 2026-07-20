#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from ai_validator.evidence.archive import create_bundle


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def write_checksums(root: Path) -> None:
    lines = []
    for path in sorted(root.rglob("*"), key=lambda item: item.relative_to(root).as_posix()):
        if path.is_file() and path.name != "checksums.sha256":
            lines.append(f"{sha256(path)}  {path.relative_to(root).as_posix()}")
    write_text(root / "checksums.sha256", "\n".join(lines) + "\n")


def create_node(root: Path, node_name: str) -> None:
    node_id = f"node_demo_{node_name}"
    node_root = root / node_name
    collected_at = datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
    write_text(node_root / "linux" / "uname.txt", f"Linux {node_name} 6.8.0 fixture x86_64 GNU/Linux\n")
    write_text(node_root / "gpu" / "nvidia-smi.txt", f"{node_name}: 8 x NVIDIA H100 80GB HBM3 (simulated fixture)\n")
    commands = [
        {"command_id": "uname", "category": "linux", "argv": ["uname", "-a"], "duration_ms": 0, "exit_code": 0, "status": "collected", "stdout_file": "linux/uname.txt", "stderr_file": None, "error_summary": None, "hostname": f"HOST-{node_name[-2:]}", "collector_version": "ai-validator 0.1.0"},
        {"command_id": "nvidia-smi", "category": "gpu", "argv": ["nvidia-smi"], "duration_ms": 0, "exit_code": 0, "status": "collected", "stdout_file": "gpu/nvidia-smi.txt", "stderr_file": None, "error_summary": None, "hostname": f"HOST-{node_name[-2:]}", "collector_version": "ai-validator 0.1.0"},
    ]
    write_text(node_root / "metadata" / "commands.json", json.dumps(commands, indent=2, sort_keys=True) + "\n")
    files = []
    for rel, category, command_id in [("linux/uname.txt", "linux", "uname"), ("gpu/nvidia-smi.txt", "gpu", "nvidia-smi")]:
        target = node_root / rel
        files.append({"path": rel, "category": category, "command_id": command_id, "bytes": target.stat().st_size, "sha256": sha256(target)})
    manifest = {
        "schema_version": "1.0.0",
        "collector_version": "ai-validator 0.1.0",
        "profile": "dgx-class",
        "collection_mode": "fixture",
        "collection_id": f"demo-{node_name}-20260101T000000Z",
        "engagement_id": "eng_demo_nvis_h100_two_node",
        "node_id": node_id,
        "started_at": collected_at,
        "finished_at": collected_at,
        "source_hostname": f"HOST-{node_name[-2:]}",
        "sanitized": True,
        "simulated": True,
        "command_count": len(commands),
        "collected_count": len(commands),
        "missing_count": 0,
        "failed_count": 0,
        "skipped_count": 0,
        "categories": ["gpu", "linux"],
        "checksum_algorithm": "sha256",
        "files": files,
        "warnings": ["Simulated fixture evidence for local ingestion demonstration only."],
    }
    write_text(node_root / "manifest.json", json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    write_checksums(node_root)
    digest = create_bundle(node_root, root / f"{node_name}-evidence.tar.gz", force=True)
    print(f"{node_name}: {root / f'{node_name}-evidence.tar.gz'} sha256={digest}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Create safe simulated GPU Validator evidence bundles for node01 and node02.")
    parser.add_argument("--output", required=True, help="Output directory for evidence directories and tar.gz bundles")
    args = parser.parse_args()
    root = Path(args.output).expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)
    create_node(root, "node01")
    create_node(root, "node02")


if __name__ == "__main__":
    main()
