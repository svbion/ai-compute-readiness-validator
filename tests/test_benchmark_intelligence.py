from pathlib import Path

from typer.testing import CliRunner

from ai_validator.cli import app
from ai_validator.benchmarks.intelligence import parse_benchmark_file

runner = CliRunner()


def test_nccl_hpl_triton_genai_parsers(tmp_path: Path) -> None:
    nccl = tmp_path / "all_reduce.txt"
    nccl.write_text("\x1b[32mNCCL version 2.21.5\x1b[0m\nNCCL INFO bootstrap noise\n1048576 262144 float sum -1 35.0 29.9 56.1 0\n", encoding="utf-8")
    nccl_run = parse_benchmark_file("nccl", nccl, simulated=True)
    assert nccl_run.metrics["average_bus_bandwidth"] == 56.1
    assert nccl_run.metrics["wrong_result_count"] == 0
    assert nccl_run.status == "accepted"

    hpl = tmp_path / "hpl.txt"
    hpl.write_text("WR11R2C4      143360   288     4     4            1543.20          1.2754e+06\nResidual PASSED\n", encoding="utf-8")
    hpl_run = parse_benchmark_file("hpl", hpl)
    assert hpl_run.metrics["performance_tflops"] == 1275.4
    assert hpl_run.metrics["residual_pass"] is True

    triton = tmp_path / "perf.csv"
    triton.write_text("Concurrency,Inferences/Second,Avg latency,p95 latency,p99 latency\n16,12500,8.1,11.4,14.8\n", encoding="utf-8")
    triton_run = parse_benchmark_file("triton_perf_analyzer", triton)
    assert triton_run.metrics["throughput"] == 12500
    assert triton_run.metrics["average_latency"] == 8.1

    genai = tmp_path / "genai.txt"
    genai.write_text("Output token throughput: 7200\nTime to first token: 42.5\nInter token latency: 7.3\n", encoding="utf-8")
    genai_run = parse_benchmark_file("genai_perf", genai)
    assert genai_run.metrics["tokens_per_second"] == 7200
    assert genai_run.metrics["time_to_first_token"] == 42.5


def test_malformed_and_missing_metrics_are_rejected(tmp_path: Path) -> None:
    malformed = tmp_path / "malformed.txt"
    malformed.write_text("banner only\n", encoding="utf-8")
    run = parse_benchmark_file("nccl", malformed)
    assert run.status == "rejected"
    assert run.warnings


def test_cli_benchmark_import_persists_versioned_record(tmp_path: Path) -> None:
    input_file = tmp_path / "hpl.txt"
    input_file.write_text("WR11R2C4      143360   288     4     4            1543.20          1.2754e+06\nPASSED\n", encoding="utf-8")
    output_dir = tmp_path / "imports"
    result = runner.invoke(app, ["benchmark", "import", "--type", "hpl", "--input", str(input_file), "--output-dir", str(output_dir), "--engagement-id", "eng_test", "--node-id", "node01", "--simulated"])
    assert result.exit_code == 0, result.output
    records = list(output_dir.glob("*.json"))
    assert len(records) == 1
    content = records[0].read_text(encoding="utf-8")
    assert '"schema_version": "1.0.0"' in content
    assert '"benchmark_type": "hpl"' in content
    assert '"simulated": true' in content
