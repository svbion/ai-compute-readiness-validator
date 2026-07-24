from __future__ import annotations

import gzip
import hashlib
import http.client
import json
import os
import shutil
import tarfile
import tempfile
from pathlib import Path
from urllib.parse import urlparse

SUPPORTED_MANIFEST_SCHEMA = "1.0.0"
SUPPORTED_PROFILES = {"linux-host", "gpu-workstation", "single-gpu-node", "dgx-class", "gpu-benchmark"}
NESTED_ARCHIVE_SUFFIXES = (".zip", ".tar", ".tgz", ".tar.gz", ".tar.bz2", ".tar.xz")


class BundleValidationError(ValueError):
    pass


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _safe_rel(path: str) -> str:
    normalized = path.replace("\\", "/").lstrip("./")
    if not normalized or normalized.startswith("/") or "../" in normalized or normalized in {".", ".."} or normalized.startswith("../"):
        raise BundleValidationError(f"Unsafe bundle path: {path}")
    if Path(normalized).is_absolute():
        raise BundleValidationError(f"Unsafe bundle path: {path}")
    return normalized


def _iter_input_files(root: Path) -> list[Path]:
    files: list[Path] = []
    for path in sorted(root.rglob("*"), key=lambda item: item.relative_to(root).as_posix()):
        rel = path.relative_to(root).as_posix()
        if path.is_symlink():
            raise BundleValidationError(f"Symlinks are not allowed in evidence bundles: {rel}")
        if not path.is_file():
            continue
        _safe_rel(rel)
        if rel.endswith(NESTED_ARCHIVE_SUFFIXES):
            raise BundleValidationError(f"Nested archives are not allowed in evidence bundles: {rel}")
        files.append(path)
    return files


def _read_manifest(root: Path) -> dict:
    manifest_path = root / "manifest.json"
    if not manifest_path.is_file():
        raise BundleValidationError("manifest.json is required")
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise BundleValidationError("manifest.json must be valid UTF-8 JSON") from exc
    if manifest.get("schema_version") != SUPPORTED_MANIFEST_SCHEMA:
        raise BundleValidationError("Unsupported manifest schema_version")
    if manifest.get("profile") not in SUPPORTED_PROFILES:
        raise BundleValidationError("Unsupported collector profile")
    if manifest.get("checksum_algorithm") != "sha256":
        raise BundleValidationError("Unsupported checksum algorithm")
    if manifest.get("collection_mode") == "fixture" and manifest.get("simulated") is not True:
        raise BundleValidationError("Fixture evidence must be labeled simulated: true")
    return manifest


def validate_evidence_directory(input_dir: Path) -> None:
    root = input_dir.expanduser().resolve()
    if not root.is_dir():
        raise BundleValidationError(f"Input evidence directory does not exist: {input_dir}")
    files = _iter_input_files(root)
    rels = {path.relative_to(root).as_posix() for path in files}
    if "manifest.json" not in rels:
        raise BundleValidationError("manifest.json is required")
    if "checksums.sha256" not in rels:
        raise BundleValidationError("checksums.sha256 is required")
    if "metadata/commands.json" not in rels:
        raise BundleValidationError("metadata/commands.json is required")
    manifest = _read_manifest(root)
    commands = json.loads((root / "metadata" / "commands.json").read_text(encoding="utf-8"))
    if not isinstance(commands, list):
        raise BundleValidationError("metadata/commands.json must be a JSON array")
    if manifest.get("command_count") != len(commands):
        raise BundleValidationError("manifest command_count does not match metadata/commands.json")
    for entry in manifest.get("files", []):
        rel = _safe_rel(str(entry.get("path", "")))
        target = root / rel
        if not target.is_file():
            raise BundleValidationError(f"Declared evidence file is missing: {rel}")
        if entry.get("sha256") and entry["sha256"] != sha256_file(target):
            raise BundleValidationError(f"Manifest checksum mismatch for {rel}")


def validate_evidence_archive(archive: Path) -> None:
    archive = archive.expanduser().resolve()
    if not archive.is_file():
        raise BundleValidationError(f"Bundle archive does not exist: {archive}")
    with tempfile.TemporaryDirectory(prefix="gpu-validator-archive-check-") as tmp:
        tmp_root = Path(tmp)
        try:
            with tarfile.open(archive, "r:gz") as tar:
                members = tar.getmembers()
                seen: set[str] = set()
                for member in members:
                    rel = _safe_rel(member.name)
                    if rel in seen:
                        raise BundleValidationError(f"Duplicate archive path: {rel}")
                    seen.add(rel)
                    if member.issym() or member.islnk() or member.isdev() or member.isdir() or member.isfifo():
                        raise BundleValidationError(f"Unsafe archive member type: {rel}")
                    if not member.isfile():
                        raise BundleValidationError(f"Unsupported archive member type: {rel}")
                    target = tmp_root / rel
                    target.parent.mkdir(parents=True, exist_ok=True)
                    source = tar.extractfile(member)
                    if source is None:
                        raise BundleValidationError(f"Unable to read archive member: {rel}")
                    with source, target.open("wb") as handle:
                        shutil.copyfileobj(source, handle)
        except (tarfile.TarError, gzip.BadGzipFile) as exc:
            raise BundleValidationError("Malformed tar.gz archive") from exc
        entries = list(tmp_root.iterdir())
        root = tmp_root
        if len(entries) == 1 and entries[0].is_dir():
            root = entries[0]
        validate_evidence_directory(root)


def create_bundle(input_dir: Path, output: Path, *, force: bool = False) -> str:
    root = input_dir.expanduser().resolve()
    validate_evidence_directory(root)
    output = output.expanduser().resolve()
    if output.exists() and not force:
        raise BundleValidationError(f"Output archive already exists: {output}. Use --force to overwrite.")
    output.parent.mkdir(parents=True, exist_ok=True)
    tmp = output.with_name(f".{output.name}.{os.getpid()}.tmp")
    try:
        with tmp.open("wb") as raw, gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0) as gz, tarfile.open(fileobj=gz, mode="w", format=tarfile.PAX_FORMAT) as tar:
            for file_path in _iter_input_files(root):
                rel = file_path.relative_to(root).as_posix()
                info = tar.gettarinfo(str(file_path), arcname=rel)
                info.mtime = 0
                info.uid = 0
                info.gid = 0
                info.uname = ""
                info.gname = ""
                with file_path.open("rb") as handle:
                    tar.addfile(info, handle)
        shutil.move(str(tmp), str(output))
    finally:
        tmp.unlink(missing_ok=True)
    return sha256_file(output)


def upload_bundle(bundle: Path, url: str, token: str, *, timeout: float = 60.0, allow_insecure_http: bool = False) -> dict:
    parsed = urlparse(url)
    if parsed.scheme != "https" and not (allow_insecure_http and parsed.scheme == "http"):
        raise BundleValidationError("HTTPS upload URL is required unless --allow-insecure-http is set for local development")
    if not parsed.hostname:
        raise BundleValidationError("Upload URL must include a hostname")
    validate_evidence_archive(bundle)
    connection_cls = http.client.HTTPSConnection if parsed.scheme == "https" else http.client.HTTPConnection
    connection = connection_cls(parsed.hostname, parsed.port, timeout=timeout)
    target = parsed.path or "/"
    if parsed.query:
        target = f"{target}?{parsed.query}"
    try:
        connection.putrequest("POST", target)
        connection.putheader("Authorization", f"Bearer {token.strip()}")
        connection.putheader("Content-Type", "application/octet-stream")
        connection.putheader("Content-Length", str(bundle.stat().st_size))
        connection.putheader("X-GPU-Validator-Bundle-SHA256", sha256_file(bundle))
        connection.endheaders()
        with bundle.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                connection.send(chunk)
        response = connection.getresponse()
        body = response.read().decode("utf-8", errors="replace")
        if response.status < 200 or response.status >= 300:
            raise BundleValidationError(f"Upload failed with HTTP {response.status}: {body}")
        return json.loads(body)
    except OSError as exc:
        raise BundleValidationError(f"Upload failed: {exc}") from exc
    finally:
        connection.close()
