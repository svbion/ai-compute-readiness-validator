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


def command(command_id: str, category: str, argv: list[str], stdout_file: str, hostname: str, collected_at: str) -> dict[str, object]:
    return {
        "command_id": command_id,
        "category": category,
        "argv": argv,
        "duration_ms": 0,
        "exit_code": 0,
        "status": "collected",
        "stdout_file": stdout_file,
        "stderr_file": None,
        "error_summary": None,
        "hostname": hostname,
        "collector_version": "ai-validator 0.1.0",
        "finished_at": collected_at,
    }


def create_node(root: Path, node_name: str) -> None:
    node_id = f"node_demo_{node_name}"
    node_root = root / node_name
    collected_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    hostname = f"HOST-{node_name[-2:]}"
    driver = "580.124.01" if node_name == "node01" else "575.99.01"
    cuda = "12.9"
    files = {
        "linux/uname.txt": f"Linux {node_name} 6.8.0-fixture x86_64 GNU/Linux\n",
        "linux/os-release.txt": 'NAME="Ubuntu"\nVERSION="24.04.2 LTS (Noble Numbat)"\nVERSION_ID="24.04"\nPRETTY_NAME="Ubuntu 24.04.2 LTS"\n',
        "linux/lscpu.txt": "Model name: Intel(R) Xeon(R) Platinum 8480C\nSocket(s): 2\nCore(s) per socket: 56\n",
        "linux/lsmem.txt": "Total online memory: 1T\n",
        "linux/findmnt.txt": "TARGET SOURCE FSTYPE OPTIONS\n/ /dev/nvme0n1p2 ext4 rw,relatime\n/data nfs01:/gpu-data nfs4 rw,relatime\n",
        "linux/df.txt": "Filesystem Type Size Used Avail Use% Mounted on\n/dev/nvme0n1p2 ext4 900G 100G 800G 12% /\n",
        "linux/systemctl-failed.txt": "0 loaded units listed.\n",
        "gpu/nvidia-smi.txt": f"NVIDIA-SMI {driver} Driver Version: {driver} CUDA Version: {cuda}\n" + "".join(f"|   {idx}  NVIDIA H100 80GB HBM3       On |\n" for idx in range(8)),
        "gpu/nvidia-smi-query.txt": f"Driver Version                            : {driver}\nCUDA Version                              : {cuda}\nAttached GPUs                             : 8\nProduct Name                              : NVIDIA H100 80GB HBM3\nFB Memory Usage\n    Total                                 : 81559 MiB\n",
        "gpu/topology.txt": "GPU0 GPU1 GPU2 GPU3 GPU4 GPU5 GPU6 GPU7 mlx5_0\nGPU0 X NV18 NV18 NV18 NV18 NV18 NV18 NV18 PIX\nGPU1 NV18 X NV18 NV18 NV18 NV18 NV18 NV18 PIX\n",
        "gpu/nvlink-status.txt": "GPU 0: NVIDIA H100 80GB HBM3\n Link 0: 26.562 GB/s\n Link 1: 26.562 GB/s\n",
        "gpu/dcgm-discovery.txt": "8 GPUs found.\n+ GPU 0: NVIDIA H100 80GB HBM3\n",
    }
    for rel, text in files.items():
        write_text(node_root / rel, text)
    command_specs = [
        ("uname", "linux", ["uname", "-a"], "linux/uname.txt"),
        ("os-release", "linux", ["cat", "/etc/os-release"], "linux/os-release.txt"),
        ("lscpu", "linux", ["lscpu"], "linux/lscpu.txt"),
        ("lsmem", "linux", ["lsmem"], "linux/lsmem.txt"),
        ("findmnt", "linux", ["findmnt"], "linux/findmnt.txt"),
        ("df", "linux", ["df", "-hT"], "linux/df.txt"),
        ("systemctl-failed", "linux", ["systemctl", "--failed"], "linux/systemctl-failed.txt"),
        ("nvidia-smi", "gpu", ["nvidia-smi"], "gpu/nvidia-smi.txt"),
        ("nvidia-smi-query", "gpu", ["nvidia-smi", "-q"], "gpu/nvidia-smi-query.txt"),
        ("nvidia-smi-topo", "gpu", ["nvidia-smi", "topo", "-m"], "gpu/topology.txt"),
        ("nvidia-smi-nvlink-status", "gpu", ["nvidia-smi", "nvlink", "--status"], "gpu/nvlink-status.txt"),
        ("dcgmi-discovery", "gpu", ["dcgmi", "discovery", "-l"], "gpu/dcgm-discovery.txt"),
    ]
    commands = [command(command_id, category, argv, stdout_file, hostname, collected_at) for command_id, category, argv, stdout_file in command_specs]
    write_text(node_root / "metadata" / "commands.json", json.dumps(commands, indent=2, sort_keys=True) + "\n")
    manifest_files = []
    command_by_file = {spec[3]: spec[0] for spec in command_specs}
    for rel in sorted(files):
        target = node_root / rel
        manifest_files.append({"path": rel, "category": rel.split("/")[0], "command_id": command_by_file[rel], "bytes": target.stat().st_size, "sha256": sha256(target)})
    manifest = {
        "schema_version": "1.0.0",
        "collector_version": "ai-validator 0.1.0",
        "profile": "dgx-class",
        "collection_mode": "fixture",
        "collection_id": f"demo-{node_name}-{collected_at.replace(':', '').replace('-', '')}",
        "engagement_id": "eng_demo_nvis_h100_two_node",
        "node_id": node_id,
        "started_at": collected_at,
        "finished_at": collected_at,
        "source_hostname": hostname,
        "sanitized": True,
        "simulated": True,
        "command_count": len(commands),
        "collected_count": len(commands),
        "missing_count": 0,
        "failed_count": 0,
        "skipped_count": 0,
        "categories": ["gpu", "linux"],
        "checksum_algorithm": "sha256",
        "files": manifest_files,
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
