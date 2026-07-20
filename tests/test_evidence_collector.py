from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest
from typer.testing import CliRunner

from ai_validator.cli import app
from ai_validator.evidence.collector import collect_evidence
from ai_validator.evidence.registry import get_profile_commands
from ai_validator.evidence.sanitizer import DeterministicSanitizer

runner = CliRunner()


def load_json(path: Path) -> dict | list:
    return json.loads(path.read_text(encoding="utf-8"))


def test_linux_host_profile_selection() -> None:
    commands = get_profile_commands("linux-host")

    assert {command.category for command in commands} == {"linux"}
    assert [command.id for command in commands][:2] == ["uname", "os-release"]


def test_dgx_class_profile_selection() -> None:
    commands = get_profile_commands("dgx-class")
    ids = {command.id for command in commands}

    assert {command.category for command in commands} == {"linux", "gpu"}
    assert "nvidia-smi" in ids
    assert "dcgm-diag" in ids


def test_optional_diagnostics_skipped_by_default(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_run(argv, **kwargs):
        assert argv != ["dcgmi", "diag", "-r", "1"]
        return subprocess.CompletedProcess(argv, 0, stdout="ok\n", stderr="")

    monkeypatch.setattr("ai_validator.evidence.collector.subprocess.run", fake_run)
    collect_evidence(profile="dgx-class", output_path=tmp_path, timeout=1)

    commands = load_json(tmp_path / "metadata" / "commands.json")
    diag = next(command for command in commands if command["command_id"] == "dcgm-diag")
    assert diag["status"] == "skipped"
    assert not (tmp_path / "gpu" / "dcgm-diag.txt").exists()


def test_dry_run_performs_zero_mutations(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    def fail_run(*args, **kwargs):  # pragma: no cover - should never be called
        raise AssertionError("dry-run must not execute commands")

    monkeypatch.setattr("ai_validator.evidence.collector.subprocess.run", fail_run)
    output = tmp_path / "bundle"

    result = runner.invoke(app, ["collect", "--profile", "linux-host", "--output", str(output), "--dry-run"])

    assert result.exit_code == 0, result.output
    assert "uname -a" in result.output
    assert not output.exists()


def test_successful_command_capture_manifest_counts_and_deterministic_names(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_run(argv, **kwargs):
        assert kwargs["shell"] is False
        return subprocess.CompletedProcess(argv, 0, stdout=f"output for {' '.join(argv)}\n", stderr="")

    monkeypatch.setattr("ai_validator.evidence.collector.subprocess.run", fake_run)
    collect_evidence(profile="linux-host", output_path=tmp_path, timeout=1)

    assert (tmp_path / "linux" / "uname.txt").exists()
    assert (tmp_path / "linux" / "journal-errors.txt").exists()
    manifest = load_json(tmp_path / "manifest.json")
    assert manifest["command_count"] == 12
    assert manifest["collected_count"] == 12
    assert manifest["missing_count"] == 0
    assert manifest["failed_count"] == 0
    assert manifest["skipped_count"] == 0
    assert manifest["categories"] == ["linux"]


def test_missing_command_recorded_not_fatal(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_run(argv, **kwargs):
        if argv[0] == "ip":
            raise FileNotFoundError("ip")
        return subprocess.CompletedProcess(argv, 0, stdout="ok\n", stderr="")

    monkeypatch.setattr("ai_validator.evidence.collector.subprocess.run", fake_run)
    collect_evidence(profile="linux-host", output_path=tmp_path, timeout=1)

    commands = load_json(tmp_path / "metadata" / "commands.json")
    missing = [command for command in commands if command["status"] == "missing"]
    assert {command["command_id"] for command in missing} == {"ip-address", "ip-link"}
    manifest = load_json(tmp_path / "manifest.json")
    assert manifest["missing_count"] == 2


def test_nonzero_exit_code_recorded_as_failed(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_run(argv, **kwargs):
        if argv[0] == "hostnamectl":
            return subprocess.CompletedProcess(argv, 1, stdout="", stderr="systemd unavailable\n")
        return subprocess.CompletedProcess(argv, 0, stdout="ok\n", stderr="")

    monkeypatch.setattr("ai_validator.evidence.collector.subprocess.run", fake_run)
    collect_evidence(profile="linux-host", output_path=tmp_path, timeout=1)

    commands = load_json(tmp_path / "metadata" / "commands.json")
    failed = next(command for command in commands if command["command_id"] == "hostnamectl")
    assert failed["status"] == "failed"
    assert failed["exit_code"] == 1
    assert failed["stderr_file"] == "metadata/stderr/linux-hostnamectl.stderr.txt"


def test_timeout_recorded(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_run(argv, **kwargs):
        if argv[0] == "journalctl":
            raise subprocess.TimeoutExpired(argv, timeout=1, output="partial", stderr="slow")
        return subprocess.CompletedProcess(argv, 0, stdout="ok\n", stderr="")

    monkeypatch.setattr("ai_validator.evidence.collector.subprocess.run", fake_run)
    collect_evidence(profile="linux-host", output_path=tmp_path, timeout=1)

    commands = load_json(tmp_path / "metadata" / "commands.json")
    timed_out = next(command for command in commands if command["command_id"] == "journal-errors")
    assert timed_out["status"] == "timeout"
    assert "Timed out" in timed_out["error_summary"]


def test_sha256_checksum_generation(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_run(argv, **kwargs):
        return subprocess.CompletedProcess(argv, 0, stdout="same\n", stderr="")

    monkeypatch.setattr("ai_validator.evidence.collector.subprocess.run", fake_run)
    collect_evidence(profile="linux-host", output_path=tmp_path, timeout=1)

    checksum_text = (tmp_path / "checksums.sha256").read_text(encoding="utf-8")
    assert "manifest.json" in checksum_text
    assert "metadata/commands.json" in checksum_text
    assert "linux/uname.txt" in checksum_text
    assert "checksums.sha256" not in checksum_text


def test_no_shell_execution(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    seen_shell_values = []

    def fake_run(argv, **kwargs):
        seen_shell_values.append(kwargs.get("shell"))
        return subprocess.CompletedProcess(argv, 0, stdout="ok\n", stderr="")

    monkeypatch.setattr("ai_validator.evidence.collector.subprocess.run", fake_run)
    collect_evidence(profile="linux-host", output_path=tmp_path, timeout=1)

    assert seen_shell_values
    assert set(seen_shell_values) == {False}


def test_sanitization_of_hostnames(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("ai_validator.evidence.collector.socket.gethostname", lambda: "node-a.example")

    def fake_run(argv, **kwargs):
        return subprocess.CompletedProcess(argv, 0, stdout="host node-a.example\n", stderr="")

    monkeypatch.setattr("ai_validator.evidence.collector.subprocess.run", fake_run)
    collect_evidence(profile="linux-host", output_path=tmp_path, timeout=1, sanitize=True)

    assert "HOST-001" in (tmp_path / "linux" / "uname.txt").read_text(encoding="utf-8")
    manifest = load_json(tmp_path / "manifest.json")
    assert manifest["source_hostname"] == "HOST-001"
    assert manifest["sanitized"] is True


def test_sanitization_of_ipv4_ipv6_usernames_and_emails() -> None:
    sanitizer = DeterministicSanitizer(source_hostname="node-a")
    text = "node-a 10.0.0.5 10.0.0.5 2001:db8::1 /home/alice/x /Users/bob/y admin@example.com admin@example.com"

    sanitized = sanitizer.sanitize(text)

    assert "node-a" not in sanitized
    assert "10.0.0.5" not in sanitized
    assert "2001:db8::1" not in sanitized
    assert "/home/alice" not in sanitized
    assert "/Users/bob" not in sanitized
    assert "admin@example.com" not in sanitized
    assert sanitized.count("IPV4-001") == 2
    assert "IPV6-001" in sanitized
    assert "/home/USER-001/x" in sanitized
    assert "/Users/USER-002/y" in sanitized
    assert sanitized.count("EMAIL-001") == 2


def test_output_path_safety_rejects_existing_file(tmp_path: Path) -> None:
    output = tmp_path / "not-a-directory"
    output.write_text("x", encoding="utf-8")

    with pytest.raises(ValueError, match="not a directory"):
        collect_evidence(profile="linux-host", output_path=output)


def test_timezone_aware_timestamps(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_run(argv, **kwargs):
        return subprocess.CompletedProcess(argv, 0, stdout="ok\n", stderr="")

    monkeypatch.setattr("ai_validator.evidence.collector.subprocess.run", fake_run)
    collect_evidence(profile="linux-host", output_path=tmp_path, timeout=1)

    manifest = load_json(tmp_path / "manifest.json")
    assert manifest["started_at"].endswith("Z") or manifest["started_at"].endswith("+00:00")
    assert manifest["finished_at"].endswith("Z") or manifest["finished_at"].endswith("+00:00")
