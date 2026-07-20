from pathlib import Path
from typer.testing import CliRunner
import json

from ai_validator.cli import app
from ai_validator.runner_adapters import NcclTestsAdapter, redact_log, sha256_bytes
from ai_validator.runner_client import require_safe_url, read_token_file

runner = CliRunner()


def test_runner_cli_commands_exist_and_http_is_blocked_by_default(tmp_path: Path) -> None:
    token_file = tmp_path / "runner-token.txt"
    token_file.write_text("secret-token\n", encoding="utf-8")
    result = runner.invoke(app, ["runner", "register", "--url", "http://validator.invalid", "--node-id", "node01", "--token-file", str(token_file)])
    assert result.exit_code != 0
    assert "HTTPS is required" in result.output
    result = runner.invoke(app, ["runner", "capabilities"])
    assert result.exit_code == 0
    assert "nccl_tests_available" in result.output


def test_runner_url_and_token_file_safety(tmp_path: Path) -> None:
    assert require_safe_url("https://gpuvalidator.com", False) == "https://gpuvalidator.com"
    assert require_safe_url("http://127.0.0.1:3000", True) == "http://127.0.0.1:3000"
    try:
        require_safe_url("http://gpuvalidator.com", False)
    except ValueError as exc:
        assert "HTTPS is required" in str(exc)
    else:
        raise AssertionError("HTTP URL should be blocked")
    token_file = tmp_path / "token.txt"
    token_file.write_text("runner-secret\n", encoding="utf-8")
    assert read_token_file(token_file) == "runner-secret"


def test_nccl_adapter_safe_argv_redaction_checksum_and_no_shell() -> None:
    adapter = NcclTestsAdapter(executable_path="/opt/nccl-tests/build/all_reduce_perf")
    params = {"minimum_bytes": "8M", "maximum_bytes": "64M", "size_factor": 2, "gpu_count": 4, "warmup_iterations": 5, "iterations": 10, "data_type": "float", "operation": "all_reduce_perf"}
    adapter.validate_parameters(params)
    argv = adapter.build_argv(params)
    assert argv == ["/opt/nccl-tests/build/all_reduce_perf", "-b", "8M", "-e", "64M", "-f", "2", "-g", "4", "-w", "5", "-n", "10"]
    assert adapter.uses_shell is False
    for bad in ["all_reduce_perf; rm -rf /", {"environment": {"BAD": "1"}}, {"maximum_bytes": "/tmp/out"}, {"iterations": 999999}]:
        invalid = dict(params)
        if isinstance(bad, dict):
            invalid.update(bad)
        else:
            invalid["operation"] = bad
        try:
            adapter.validate_parameters(invalid)
        except ValueError:
            pass
        else:
            raise AssertionError(f"unsafe parameters accepted: {invalid}")
    assert redact_log("Authorization: Bearer SECRET token=abc") == "Authorization: Bearer [redacted] token=[redacted]"
    assert sha256_bytes(b"abc") == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"


def test_runner_status_and_once_do_not_require_gpu(tmp_path: Path) -> None:
    cred = tmp_path / "credential.json"
    cred.write_text(json.dumps({"runner_id": "rnr_test", "bearer_token": "token", "url": "https://gpuvalidator.invalid"}), encoding="utf-8")
    result = runner.invoke(app, ["runner", "status", "--credential-file", str(cred)])
    assert result.exit_code == 0
    assert "rnr_test" in result.output
    assert "bearer_token" not in result.output
