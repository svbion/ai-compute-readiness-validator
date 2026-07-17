from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SANITIZER = REPO_ROOT / "tools" / "sanitize-evidence.py"
IMPORTER = REPO_ROOT / "tools" / "import-live-evidence.py"


def run_tool(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, *args],
        cwd=REPO_ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def live_cluster(*, simulated: bool = False, include_nvidia_smi: bool = True) -> dict:
    evidence = []
    if include_nvidia_smi:
        evidence.append(
            {
                "command": ["nvidia-smi", "-L"],
                "exit_code": 0,
                "duration_seconds": 0.01,
                "stdout": "GPU 0: NVIDIA H100 80GB HBM3 (UUID: GPU-redacted)",
                "stderr": "",
                "timestamp": "2026-07-17T12:00:00Z",
            }
        )
    return {
        "name": "sanitized-live-fixture",
        "overall_score": 100,
        "classification": "Ready",
        "nodes": [
            {
                "name": "node-a",
                "ip_address": None,
                "status": "pass",
                "categories": {
                    "gpu": {
                        "id": "gpu",
                        "name": "GPU",
                        "weight": 100,
                        "checks": [
                            {
                                "id": "gpu.inventory",
                                "category": "gpu",
                                "title": "GPU inventory",
                                "status": "pass",
                                "severity": "low",
                                "summary": "NVIDIA GPU inventory was captured from approved command output.",
                                "evidence": evidence,
                                "recommendation": None,
                                "node": "node-a",
                            }
                        ],
                        "score": 100,
                    }
                },
            }
        ],
        "recommendations": [],
        "benchmark_results": [],
        "timestamp": "2026-07-17T12:00:00Z",
        "metadata": {
            "validation_source": "Live GPU Hardware",
            "collection_timestamp": "2026-07-17T12:00:00Z",
            "selected_profile": "single-gpu-node",
            "simulated": simulated,
            "detected_environment": "sanitized fixture",
            "hardware_identity_status": "nvidia-smi proof present" if include_nvidia_smi else "unverified",
            "sanitization_status": "Sanitized with redaction manifest",
            "source_confidence": "High" if include_nvidia_smi else "Low",
            "limitations": [],
        },
    }


def write_bundle(root: Path, cluster: dict, *, checksum: bool = False) -> Path:
    reports = root / "reports"
    reports.mkdir(parents=True)
    report = reports / "fixture-results.json"
    report.write_text(json.dumps(cluster, indent=2) + "\n", encoding="utf-8")
    if checksum:
        digest = hashlib.sha256(report.read_bytes()).hexdigest()
        (root / "checksums.sha256").write_text(f"{digest}  reports/fixture-results.json\n", encoding="utf-8")
    return report


def test_sanitizer_redacts_ips_and_usernames(tmp_path: Path) -> None:
    source = tmp_path / "raw"
    source.mkdir()
    (source / "log.txt").write_text(
        "node 10.42.0.5 user path /home/alice/project and /Users/bob/archive\n",
        encoding="utf-8",
    )
    output = tmp_path / "sanitized"

    result = run_tool(str(SANITIZER), str(source), "--output", str(output), "--redact-ips")

    assert result.returncode == 0, result.stderr
    sanitized = (output / "log.txt").read_text(encoding="utf-8")
    assert "10.42.0.5" not in sanitized
    assert "/home/alice" not in sanitized
    assert "/Users/bob" not in sanitized
    assert "[REDACTED_IPV4]" in sanitized
    assert "/home/[REDACTED_USER]/" in sanitized
    assert "/Users/[REDACTED_USER]/" in sanitized


def test_sanitizer_rejects_path_traversal_symlink(tmp_path: Path) -> None:
    source = tmp_path / "raw"
    source.mkdir()
    outside = tmp_path / "outside-secret.txt"
    outside.write_text("do not copy", encoding="utf-8")
    (source / "escape.txt").symlink_to(outside)

    result = run_tool(str(SANITIZER), str(source), "--output", str(tmp_path / "sanitized"))

    assert result.returncode != 0
    assert "Refusing to follow symlink" in (result.stderr + result.stdout)


def test_importer_accepts_safe_fixture(tmp_path: Path) -> None:
    bundle = tmp_path / "bundle"
    write_bundle(bundle, live_cluster(), checksum=True)

    result = run_tool(str(IMPORTER), str(bundle), "--output-dir", str(tmp_path / "imported"), "--name", "safe-fixture")

    assert result.returncode == 0, result.stderr
    imported = json.loads((tmp_path / "imported" / "safe-fixture" / "latest-results.json").read_text(encoding="utf-8"))
    assert imported["metadata"]["validation_source"] == "Imported Live Evidence"
    assert imported["metadata"]["imported"] is True


def test_importer_rejects_malformed_json(tmp_path: Path) -> None:
    bundle = tmp_path / "bundle" / "reports"
    bundle.mkdir(parents=True)
    (bundle / "bad-results.json").write_text("{not-json", encoding="utf-8")

    result = run_tool(str(IMPORTER), str(bundle.parent), "--output-dir", str(tmp_path / "imported"))

    assert result.returncode != 0
    assert "Malformed JSON input" in (result.stderr + result.stdout)


def test_importer_rejects_invalid_checksum(tmp_path: Path) -> None:
    bundle = tmp_path / "bundle"
    write_bundle(bundle, live_cluster(), checksum=False)
    (bundle / "checksums.sha256").write_text("0" * 64 + "  reports/fixture-results.json\n", encoding="utf-8")

    result = run_tool(str(IMPORTER), str(bundle), "--output-dir", str(tmp_path / "imported"))

    assert result.returncode != 0
    assert "Checksum verification failed" in (result.stderr + result.stdout)


def test_importer_rejects_simulated_evidence_mislabeled_as_live(tmp_path: Path) -> None:
    bundle = tmp_path / "bundle"
    write_bundle(bundle, live_cluster(simulated=True))

    result = run_tool(str(IMPORTER), str(bundle), "--output-dir", str(tmp_path / "imported"))

    assert result.returncode != 0
    assert "simulated=false" in (result.stderr + result.stdout)


def test_importer_rejects_live_evidence_without_nvidia_smi_proof(tmp_path: Path) -> None:
    bundle = tmp_path / "bundle"
    write_bundle(bundle, live_cluster(include_nvidia_smi=False))

    result = run_tool(str(IMPORTER), str(bundle), "--output-dir", str(tmp_path / "imported"))

    assert result.returncode != 0
    assert "nvidia-smi" in (result.stderr + result.stdout)


def test_importer_rejects_path_traversal_import_name(tmp_path: Path) -> None:
    bundle = tmp_path / "bundle"
    write_bundle(bundle, live_cluster())

    result = run_tool(str(IMPORTER), str(bundle), "--output-dir", str(tmp_path / "imported"), "--name", "../escape")

    assert result.returncode != 0
    assert "Import name" in (result.stderr + result.stdout)
    assert not (tmp_path / "escape").exists()
