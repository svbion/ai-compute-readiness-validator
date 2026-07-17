#!/usr/bin/env python3
"""Import sanitized live evidence into a controlled portal artifact path."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

REQUIRED_METADATA = ["validation_source", "collection_timestamp", "selected_profile", "simulated"]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise SystemExit(f"Malformed JSON input {path}: {exc}") from exc


def verify_checksums(bundle: Path) -> None:
    checksum_file = bundle / "checksums.sha256"
    if not checksum_file.exists():
        return
    for line in checksum_file.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        expected, rel = line.split(maxsplit=1)
        rel = rel.lstrip("*./")
        target = bundle / rel
        if not target.exists() or sha256(target) != expected:
            raise SystemExit(f"Checksum verification failed for {rel}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Import sanitized AI Factory live evidence.")
    parser.add_argument("input", help="Sanitized evidence directory")
    parser.add_argument("--output-dir", default="artifacts/imported-live", help="Controlled import output directory")
    parser.add_argument("--name", default=None, help="Import name; defaults to bundle directory name")
    args = parser.parse_args()

    source = Path(args.input).resolve()
    if not source.is_dir():
        raise SystemExit(f"Input bundle does not exist: {source}")

    verify_checksums(source)

    candidates = sorted((source / "reports").glob("*-results.json")) if (source / "reports").is_dir() else []
    if not candidates:
        candidates = sorted(source.rglob("latest-results.json"))
    if not candidates:
        raise SystemExit("No validator JSON report found in bundle.")

    report_path = candidates[0]
    cluster = load_json(report_path)
    metadata = cluster.setdefault("metadata", {})
    for key in REQUIRED_METADATA:
        if key not in metadata:
            raise SystemExit(f"Live evidence report missing required metadata field: {key}")
    if metadata.get("simulated") is not False:
        raise SystemExit("Imported live evidence must declare simulated=false.")
    if metadata.get("validation_source") not in {"Live Linux Host", "Live GPU Hardware", "Live Cluster Infrastructure", "Imported Live Evidence"}:
        raise SystemExit("Unsupported validation_source for live import.")

    import_name = args.name or source.name
    dest = Path(args.output_dir).resolve() / import_name
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True)

    normalized = cluster.copy()
    normalized_metadata = normalized.setdefault("metadata", {})
    normalized_metadata.update({
        "validation_source": "Imported Live Evidence",
        "imported": True,
        "import_timestamp": datetime.now(timezone.utc).isoformat(),
        "import_source_bundle": source.name,
        "source_report_sha256": sha256(report_path),
        "html_trusted_from_import": False,
        "limitations": list(normalized_metadata.get("limitations", [])) + ["Imported HTML is not trusted; portal display must use normalized JSON or regenerated reports."],
    })

    output_json = dest / "latest-results.json"
    output_json.write_text(json.dumps(normalized, indent=2, default=str) + "\n", encoding="utf-8")
    shutil.copy2(output_json, dest / "imported-live-results.json")

    import_manifest = {
        "imported": True,
        "import_timestamp": normalized_metadata["import_timestamp"],
        "source_bundle": str(source),
        "source_report": str(report_path.relative_to(source)),
        "source_report_sha256": normalized_metadata["source_report_sha256"],
        "accepted_artifacts": ["latest-results.json", "imported-live-results.json"],
        "html_regeneration_required": True,
    }
    (dest / "import-manifest.json").write_text(json.dumps(import_manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Imported live evidence into {dest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
