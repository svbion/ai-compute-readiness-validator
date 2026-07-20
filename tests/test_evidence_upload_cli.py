from __future__ import annotations

import json
import os
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

from typer.testing import CliRunner

from ai_validator.cli import app
from ai_validator.evidence.archive import create_bundle, sha256_file

runner = CliRunner()


def make_evidence_dir(root: Path, *, node: str = "node_demo_node01", collection: str = "cli-collection") -> Path:
    evidence = root / "evidence"
    (evidence / "linux").mkdir(parents=True)
    (evidence / "metadata").mkdir(parents=True)
    (evidence / "linux" / "uname.txt").write_text("Linux HOST-001 fixture\n", encoding="utf-8")
    commands = [{"command_id": "uname", "category": "linux", "argv": ["uname", "-a"], "duration_ms": 0, "exit_code": 0, "status": "collected", "stdout_file": "linux/uname.txt", "stderr_file": None, "error_summary": None, "hostname": "HOST-001", "collector_version": "ai-validator 0.1.0"}]
    (evidence / "metadata" / "commands.json").write_text(json.dumps(commands, indent=2) + "\n", encoding="utf-8")
    evidence_file = evidence / "linux" / "uname.txt"
    manifest = {
        "schema_version": "1.0.0",
        "collector_version": "ai-validator 0.1.0",
        "profile": "linux-host",
        "collection_mode": "fixture",
        "collection_id": collection,
        "engagement_id": "eng_demo_nvis_h100_two_node",
        "node_id": node,
        "started_at": "2030-01-01T00:00:00Z",
        "finished_at": "2030-01-01T00:00:00Z",
        "source_hostname": "HOST-001",
        "sanitized": True,
        "simulated": True,
        "command_count": 1,
        "collected_count": 1,
        "missing_count": 0,
        "failed_count": 0,
        "skipped_count": 0,
        "categories": ["linux"],
        "checksum_algorithm": "sha256",
        "files": [{"path": "linux/uname.txt", "category": "linux", "command_id": "uname", "bytes": evidence_file.stat().st_size, "sha256": sha256_file(evidence_file)}],
        "warnings": ["fixture"],
    }
    (evidence / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    lines = []
    for path in sorted([evidence / "linux" / "uname.txt", evidence / "manifest.json", evidence / "metadata" / "commands.json"]):
        lines.append(f"{sha256_file(path)}  {path.relative_to(evidence).as_posix()}")
    (evidence / "checksums.sha256").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return evidence


def test_deterministic_bundle_creation_and_overwrite_protection(tmp_path: Path) -> None:
    evidence = make_evidence_dir(tmp_path)
    first = tmp_path / "node01-evidence.tar.gz"
    second = tmp_path / "node01-evidence-copy.tar.gz"

    result = runner.invoke(app, ["bundle", "--input", str(evidence), "--output", str(first)])
    assert result.exit_code == 0, result.output
    assert "SHA-256" in result.output
    create_bundle(evidence, second)
    assert first.read_bytes() == second.read_bytes()

    refused = runner.invoke(app, ["bundle", "--input", str(evidence), "--output", str(first)])
    assert refused.exit_code != 0
    assert "--force" in refused.output


def test_bundle_rejects_unsafe_input_symlink(tmp_path: Path) -> None:
    evidence = make_evidence_dir(tmp_path)
    (evidence / "linux" / "unsafe-link").symlink_to(evidence / "linux" / "uname.txt")

    result = runner.invoke(app, ["bundle", "--input", str(evidence), "--output", str(tmp_path / "out.tar.gz")])

    assert result.exit_code != 0
    assert "Symlinks are not allowed" in result.output


def test_upload_token_file_environment_https_and_no_plaintext_option(tmp_path: Path, monkeypatch) -> None:
    evidence = make_evidence_dir(tmp_path)
    bundle = tmp_path / "bundle.tar.gz"
    create_bundle(evidence, bundle)
    token_file = tmp_path / "upload-token.txt"
    token_file.write_text("secret-token", encoding="utf-8")

    help_result = runner.invoke(app, ["upload", "--help"])
    assert "--token-file" in help_result.output
    assert "--token " not in help_result.output

    insecure = runner.invoke(app, ["upload", "--bundle", str(bundle), "--url", "http://127.0.0.1/upload", "--token-file", str(token_file)])
    assert insecure.exit_code != 0
    assert "HTTPS upload URL is required" in insecure.output

    monkeypatch.setenv("GPU_VALIDATOR_UPLOAD_TOKEN", "env-secret-token")
    missing_server = runner.invoke(app, ["upload", "--bundle", str(bundle), "--url", "http://127.0.0.1:9/upload", "--allow-insecure-http"])
    assert missing_server.exit_code != 0
    assert "env-secret-token" not in missing_server.output


def test_successful_mocked_upload_with_token_file_and_environment_token(tmp_path: Path, monkeypatch) -> None:
    evidence = make_evidence_dir(tmp_path)
    bundle = tmp_path / "bundle.tar.gz"
    create_bundle(evidence, bundle)
    seen_tokens: list[str] = []

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):  # noqa: N802
            seen_tokens.append(self.headers.get("Authorization", ""))
            length = int(self.headers.get("Content-Length", "0"))
            assert self.rfile.read(length)
            self.send_response(201)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"evidence":{"id":"evd_mock","collection_id":"cli-collection"},"collection_id":"cli-collection"}')

        def log_message(self, format, *args):  # noqa: A002
            return

    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        url = f"http://127.0.0.1:{server.server_port}/api/v1/evidence/uploads"
        token_file = tmp_path / "upload-token.txt"
        token_file.write_text("file-token", encoding="utf-8")
        result = runner.invoke(app, ["upload", "--bundle", str(bundle), "--url", url, "--token-file", str(token_file), "--allow-insecure-http"])
        assert result.exit_code == 0, result.output
        assert "evd_mock" in result.output
        assert "file-token" not in result.output
        monkeypatch.setenv("GPU_VALIDATOR_UPLOAD_TOKEN", "env-token")
        env_result = runner.invoke(app, ["upload", "--bundle", str(bundle), "--url", url, "--allow-insecure-http"])
        assert env_result.exit_code == 0, env_result.output
        assert seen_tokens == ["Bearer file-token", "Bearer env-token"]
    finally:
        server.shutdown()
        server.server_close()
