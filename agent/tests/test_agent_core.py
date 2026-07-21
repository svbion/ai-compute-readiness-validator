import json
import os
import signal
import sys
import time
from pathlib import Path
from types import SimpleNamespace
from urllib.error import HTTPError, URLError

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def test_config_requires_values_masks_token_and_validates_url(monkeypatch, tmp_path):
    from gpuvalidator_agent.config import AgentConfig, ConfigError, mask_secret

    for key in ["GPUVALIDATOR_API_URL", "GPUVALIDATOR_AGENT_TOKEN", "GPUVALIDATOR_AGENT_NAME"]:
        monkeypatch.delenv(key, raising=False)
    with pytest.raises(ConfigError, match="GPUVALIDATOR_API_URL"):
        AgentConfig.from_env()

    monkeypatch.setenv("GPUVALIDATOR_API_URL", "ftp://bad")
    monkeypatch.setenv("GPUVALIDATOR_AGENT_TOKEN", "super-secret-token")
    monkeypatch.setenv("GPUVALIDATOR_AGENT_NAME", "agent-a")
    with pytest.raises(ConfigError, match="http"):
        AgentConfig.from_env()

    monkeypatch.setenv("GPUVALIDATOR_API_URL", "https://gpuvalidator.com/")
    monkeypatch.setenv("GPUVALIDATOR_AGENT_ID_FILE", str(tmp_path / "agent-id"))
    cfg = AgentConfig.from_env()
    assert cfg.api_url == "https://gpuvalidator.com"
    assert cfg.tls_verify is True
    assert cfg.agent_id_file == tmp_path / "agent-id"
    assert "secret" not in repr(cfg)
    assert mask_secret("super-secret-token") == "sup...ken"


def test_command_lookup_and_unsupported_command():
    from gpuvalidator_agent.commands import command_for, UnsupportedCommand

    assert command_for("nvidia_smi_list").argv == ["nvidia-smi", "-L"]
    assert command_for("nvidia_smi_inventory").argv[0] == "nvidia-smi"
    assert command_for("pytorch_gpu_count").argv[:2] == ["python3", "-c"]
    with pytest.raises(UnsupportedCommand):
        command_for("rm_rf")


def test_nccl_smoke_executable_unavailable(monkeypatch):
    from gpuvalidator_agent.commands import command_for

    monkeypatch.delenv("GPUVALIDATOR_NCCL_TESTS_PATH", raising=False)
    result = command_for("nccl_all_reduce_smoke", detector=lambda: {"available": False, "visible_gpu_count": 4})
    assert result.argv == ["all_reduce_perf"]
    assert result.timeout_seconds <= 180


def test_nccl_smoke_four_gpu_and_two_gpu_command_construction(monkeypatch, tmp_path):
    from gpuvalidator_agent.commands import command_for

    exe = tmp_path / "all_reduce_perf"
    exe.write_text("#!/bin/sh\n", encoding="utf-8")
    exe.chmod(0o755)
    monkeypatch.setenv("GPUVALIDATOR_NCCL_TESTS_PATH", str(tmp_path))
    four = command_for("nccl_all_reduce_smoke", detector=lambda: {"available": True, "executable_path": str(exe), "visible_gpu_count": 4})
    assert four.argv == [str(exe), "-b", "8M", "-e", "256M", "-f", "2", "-g", "4"]
    two = command_for("nccl_all_reduce_smoke", detector=lambda: {"available": True, "executable_path": str(exe), "visible_gpu_count": 2})
    assert two.argv[-2:] == ["-g", "2"]


def test_nccl_parser_success_malformed_nonzero_and_raw_evidence():
    from gpuvalidator_agent.parsers import parse_nccl_all_reduce_smoke

    output = """NCCL version 2.25.1+cuda12.8
# size count type redop root time algbw busbw #wrong
8388608 2097152 float sum -1 0.210 39.95 59.12 0
268435456 67108864 float sum -1 5.111 52.52 78.78 0
Out of bounds values : 0 OK
"""
    parsed = parse_nccl_all_reduce_smoke(output, "", "completed", 0)
    assert parsed["nccl_version"] == "2.25.1+cuda12.8"
    assert parsed["rows"][-1]["message_size"] == 268435456
    assert parsed["rows"][-1]["count"] == 67108864
    assert parsed["rows"][-1]["datatype"] == "float"
    assert parsed["rows"][-1]["operation"] == "sum"
    assert parsed["algorithm_bandwidth"] == 52.52
    assert parsed["bus_bandwidth"] == 78.78
    assert parsed["validation_errors"] == 0
    assert parsed["out_of_bounds_values"] == 0
    assert parsed["exit_code"] == 0
    assert "raw_output" in parsed
    malformed = parse_nccl_all_reduce_smoke("bad row only", "", "completed", 0)
    assert malformed["warnings"]
    nonzero = parse_nccl_all_reduce_smoke(output, "boom", "failed", 7)
    assert nonzero["exit_code"] == 7
    assert nonzero["warnings"]


def test_nccl_executor_timeout_and_unavailable_states():
    from gpuvalidator_agent.commands import CommandDefinition
    from gpuvalidator_agent.executor import CommandExecutor

    timed = CommandExecutor(runner=lambda argv, **kwargs: (_ for _ in ()).throw(TimeoutError("timeout"))).execute(CommandDefinition("nccl_all_reduce_smoke", ["all_reduce_perf", "-b", "8M", "-e", "256M", "-f", "2", "-g", "4"], 1, 8192, 8192))
    assert timed.state == "timed_out"
    assert timed.structured_result["command_type"] == "nccl_all_reduce_smoke"
    missing = CommandExecutor().execute(CommandDefinition("nccl_all_reduce_smoke", ["all_reduce_perf"], 1, 8192, 8192))
    assert missing.state == "unavailable"


def test_executor_handles_timeout_unavailable_and_truncation():
    from gpuvalidator_agent.commands import CommandDefinition
    from gpuvalidator_agent.executor import CommandExecutor

    def unavailable(argv, **kwargs):
        raise FileNotFoundError(argv[0])
    result = CommandExecutor(runner=unavailable).execute(CommandDefinition("missing", ["missing-bin"], 5, 10, 10))
    assert result.state == "unavailable"
    assert result.exit_code is None

    def timeout(argv, **kwargs):
        raise TimeoutError("timed out")
    result = CommandExecutor(runner=timeout).execute(CommandDefinition("slow", ["sleep", "99"], 1, 10, 10))
    assert result.state == "timed_out"

    def huge(argv, **kwargs):
        return SimpleNamespace(returncode=0, stdout="x" * 20, stderr="e" * 20)
    result = CommandExecutor(runner=huge).execute(CommandDefinition("huge", ["ok"], 5, 8, 4))
    assert result.state == "completed"
    assert result.stdout == "x" * 8
    assert result.stderr == "e" * 4
    assert result.output_truncated is True


def test_nvidia_smi_list_parser_tolerates_mig_and_malformed_output():
    from gpuvalidator_agent.parsers import parse_nvidia_smi_list

    parsed = parse_nvidia_smi_list("""GPU 0: NVIDIA A100-SXM4-40GB (UUID: GPU-abc)\n  MIG 1g.5gb Device 0: (UUID: MIG-GPU-abc/1/0)\nGPU 1: NVIDIA H100 80GB HBM3 (UUID: GPU-def)\nnot a gpu row\n""")
    assert parsed["gpu_count"] == 2
    assert parsed["gpus"][0]["model"] == "NVIDIA A100-SXM4-40GB"
    assert parsed["gpus"][0]["mig_devices"][0]["uuid"].startswith("MIG-GPU")
    assert parsed["warnings"]


def test_inventory_topology_cuda_and_pytorch_parsers_are_robust():
    from gpuvalidator_agent.parsers import parse_cuda_version, parse_driver_version, parse_inventory_csv, parse_pytorch_gpu_count, parse_topology

    inventory = parse_inventory_csv("0, NVIDIA A100, GPU-abc, 40960 MiB, 535.104, 00000000:01:00.0\nmalformed\n1,NVIDIA H100,GPU-def,81920,550.1,0000:02:00.0")
    assert len(inventory["gpus"]) == 2
    assert inventory["gpus"][0]["memory_total"] == "40960 MiB"
    assert inventory["warnings"]
    topology = parse_topology("GPU0 GPU1 CPU Affinity\nGPU0 X NV4 0-31\nGPU1 NV4 X 32-63")
    assert topology["matrix"][0]["GPU1"] == "NV4"
    assert parse_driver_version("535.104.05\n535.104.05") == {"driver_version": "535.104.05", "warnings": []}
    assert parse_cuda_version('{"cuda": {"version": "12.2.0"}}')["cuda_version"] == "12.2.0"
    assert parse_cuda_version("Cuda compilation tools, release 12.4, V12.4.99")["cuda_version"] == "12.4"
    assert parse_pytorch_gpu_count("4\n") == {"gpu_count": 4, "warnings": []}
    assert parse_pytorch_gpu_count("oops")["warnings"]


def test_capability_discovery_four_gpu_missing_cuda_and_pytorch(monkeypatch, tmp_path):
    from gpuvalidator_agent.capabilities import discover_capabilities

    outputs = {
        ("nvidia-smi", "-L"): SimpleNamespace(returncode=0, stdout="GPU 0: A (UUID: GPU-0)\nGPU 1: A (UUID: GPU-1)\nGPU 2: A (UUID: GPU-2)\nGPU 3: A (UUID: GPU-3)\n", stderr=""),
        ("nvidia-smi", "--query-gpu=driver_version", "--format=csv,noheader"): SimpleNamespace(returncode=0, stdout="535.104\n", stderr=""),
    }
    def runner(argv, **kwargs):
        key = tuple(argv)
        if key in outputs:
            return outputs[key]
        raise FileNotFoundError(argv[0])

    monkeypatch.setattr("gpuvalidator_agent.capabilities.CUDA_VERSION_JSON", tmp_path / "missing.json")
    info = discover_capabilities(runner=runner)
    names = {cap.name: cap for cap in info.capabilities}
    assert info.gpu_count == 4
    assert names["nvidia_smi_list"].available is True
    assert names["cuda_version"].available is False
    assert names["pytorch_gpu_count"].available is False


def test_local_simulation_fixture_covers_four_gpus_malformed_output_missing_cuda_and_pytorch(monkeypatch, tmp_path):
    from gpuvalidator_agent.capabilities import discover_capabilities
    from gpuvalidator_agent.commands import command_for
    from gpuvalidator_agent.executor import CommandExecutor
    from gpuvalidator_agent.simulation import simulation_runner

    monkeypatch.setattr("gpuvalidator_agent.capabilities.CUDA_VERSION_JSON", tmp_path / "missing.json")
    snapshot = discover_capabilities(runner=simulation_runner)
    assert snapshot.gpu_count == 4
    caps = {cap.name: cap for cap in snapshot.capabilities}
    assert caps["cuda_version"].available is False
    assert caps["pytorch_gpu_count"].available is False

    result = CommandExecutor(runner=simulation_runner).execute(command_for("nvidia_smi_inventory"))
    assert result.state == "completed"
    assert result.structured_result["gpus"][0]["model"] == "NVIDIA A100-SXM4-40GB"
    assert result.parser_warnings


def test_client_heartbeat_poll_upload_and_retry_behavior(monkeypatch):
    from gpuvalidator_agent.client import AgentApiClient, ApiAuthenticationError
    from gpuvalidator_agent.config import AgentConfig
    from gpuvalidator_agent.models import ExecutionResult

    cfg = AgentConfig(api_url="https://gpuvalidator.test", token="token", agent_name="agent", hostname="host")
    calls = []
    responses = [URLError("temporary"), (201, {"agent_id": "agt_1", "heartbeat_interval_seconds": 1, "poll_interval_seconds": 1}), (200, {"agent": {"id": "agt_1"}}), (200, {"job": {"id": "job_1", "command_type": "driver_version", "command": {"type": "driver_version", "argv": ["nvidia-smi"], "timeout_seconds": 1, "max_stdout_bytes": 100, "max_stderr_bytes": 100}}}), (200, {"job": {"id": "job_1", "state": "claimed"}}), (200, {"job": {"id": "job_1", "state": "running"}}), (200, {"result": {"id": "res_1"}})]
    def transport(method, url, body, headers, timeout, tls_verify):
        calls.append((method, url, body, headers))
        item = responses.pop(0)
        if isinstance(item, Exception):
            raise item
        return item
    client = AgentApiClient(cfg, transport=transport, sleep=lambda _: None)
    assert client.register([], 0)["agent_id"] == "agt_1"
    client.heartbeat("agt_1", [], 0)
    assert client.next_job("agt_1")["id"] == "job_1"
    client.claim_job("agt_1", "job_1")
    client.mark_running("agt_1", "job_1")
    res = ExecutionResult(command_type="driver_version", argv=["nvidia-smi"], state="completed", exit_code=0, stdout="535", stderr="", output_truncated=False, started_at="2026-01-01T00:00:00Z", completed_at="2026-01-01T00:00:01Z", duration_ms=1000, structured_result={"driver_version":"535"}, parser_warnings=[])
    client.upload_result("agt_1", {"id": "job_1"}, res)
    assert calls[0][3]["Authorization"] == "Bearer token"
    assert calls[0][1].endswith("/api/v1/agents/register")

    bad = AgentApiClient(cfg, transport=lambda *args: (401, {"error": "bad"}), sleep=lambda _: None)
    with pytest.raises(ApiAuthenticationError):
        bad.register([], 0)


def test_agent_loop_executes_one_job_and_shutdown_stops_cleanly(tmp_path):
    from gpuvalidator_agent.main import AgentRuntime
    from gpuvalidator_agent.models import Capability, ExecutionResult

    class FakeClient:
        def __init__(self):
            self.uploads = []
            self.heartbeats = 0
        def register(self, capabilities, gpu_count):
            return {"agent_id": "agt_1", "heartbeat_interval_seconds": 0.01, "poll_interval_seconds": 0.01}
        def heartbeat(self, agent_id, capabilities, gpu_count, status="online", last_error=None):
            self.heartbeats += 1
        def next_job(self, agent_id):
            if self.uploads:
                return None
            return {"id": "job_1", "command_type": "driver_version", "command": {"type": "driver_version", "argv": ["nvidia-smi"], "timeout_seconds": 1, "max_stdout_bytes": 100, "max_stderr_bytes": 100}}
        def claim_job(self, agent_id, job_id):
            return {"id": job_id, "state": "claimed"}
        def mark_running(self, agent_id, job_id):
            return {"id": job_id, "state": "running"}
        def upload_result(self, agent_id, job, result):
            self.uploads.append(result)

    class FakeDiscovery:
        def __call__(self):
            return SimpleNamespace(hostname="host", operating_system="Linux", agent_version="0.1.0", gpu_count=1, capabilities=[Capability("driver_version", True, "535")], gpu_models=["A100"])

    runtime = AgentRuntime(client=FakeClient(), discover=FakeDiscovery(), execute=lambda job: ExecutionResult(command_type="driver_version", argv=["nvidia-smi"], state="completed", exit_code=0, stdout="535", stderr="", output_truncated=False, started_at="s", completed_at="c", duration_ms=1, structured_result={"driver_version": "535"}, parser_warnings=[]), sleep=lambda _: None)
    runtime.run(max_iterations=2)
    assert runtime.client.uploads[0].structured_result == {"driver_version": "535"}
    runtime.request_shutdown(signal.SIGTERM, None)
    assert runtime.stop_requested is True
