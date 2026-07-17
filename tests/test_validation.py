import os
import tempfile
import pytest
from typer.testing import CliRunner
from ai_validator.models import Cluster, Node, StatusEnum, SeverityEnum
from ai_validator.scoring import ScoringEngine
from ai_validator.cli import app
from ai_validator.demo.generator import DemoGenerator
from ai_validator.reporting.json_report import JsonReporter
from ai_validator.reporting.html import HtmlReporter
from ai_validator.reporting.markdown import MarkdownReporter
from ai_validator.runner import CommandRunner
from ai_validator.profiles import get_profile


runner = CliRunner()

def test_scoring_engine_healthy():
    """Verify that a healthy demo scenario evaluates to 100% and 'Ready'."""
    cluster = DemoGenerator.get_scenario("healthy")
    assert cluster.overall_score == 100.0
    assert cluster.classification == "Ready"
    assert len(cluster.nodes) == 4
    assert len(cluster.recommendations) == 0

def test_scoring_engine_degraded():
    """Verify that a degraded scenario has recommendations, is marked 'Remediation Required', and scores appropriately."""
    cluster = DemoGenerator.get_scenario("degraded")
    assert cluster.overall_score < 100.0
    assert cluster.classification == "Remediation required"
    assert len(cluster.recommendations) > 0
    
    # Check that key specific warnings and failures are present
    recommendations_str = " ".join(cluster.recommendations)
    assert "InfiniBand" in recommendations_str or "link rate" in recommendations_str
    assert "ECC" in recommendations_str or "hardware support" in recommendations_str
    assert "Slurm" in recommendations_str or "slurmd" in recommendations_str
    assert "GPU Operator" in recommendations_str or "device-plugin" in recommendations_str

def test_scoring_redistribution():
    """Verify that if some categories have no checks, their weight is proportionally redistributed to other categories."""
    scenario = DemoGenerator.get_scenario("healthy")
    # Let's remove the checks for Kubernetes and Slurm from node 0 and recalculate
    for node in scenario.nodes:
        node.categories["kubernetes"].checks = []
        node.categories["slurm"].checks = []
        
    scored = ScoringEngine.evaluate_cluster(scenario)
    active_weights = scored.metadata.get("active_weights", {})
    assert "kubernetes" not in active_weights
    assert "slurm" not in active_weights
    assert "gpu" in active_weights
    assert scored.overall_score == 100.0 # still 100% since no failures

def test_report_generation():
    """Verify that the JSON, HTML, and Markdown reporters generate files without error."""
    cluster = DemoGenerator.get_scenario("degraded")
    
    with tempfile.TemporaryDirectory() as tmpdir:
        json_file = os.path.join(tmpdir, "test.json")
        html_file = os.path.join(tmpdir, "test.html")
        md_file = os.path.join(tmpdir, "test.md")
        
        # Test JSON
        JsonReporter.generate_report(cluster, json_file)
        assert os.path.exists(json_file)
        
        # Read back JSON and validate
        with open(json_file, "r") as f:
            content = f.read()
        loaded_cluster = Cluster.model_validate_json(content)
        assert loaded_cluster.name == cluster.name
        
        # Test HTML
        HtmlReporter.generate_report(cluster, html_file)
        assert os.path.exists(html_file)
        
        # Test Markdown
        MarkdownReporter.generate_report(cluster, md_file)
        assert os.path.exists(md_file)


def test_demo_command_writes_latest_and_scenario_reports():
    with tempfile.TemporaryDirectory() as tmpdir:
        result = runner.invoke(app, ["demo", "--scenario", "degraded", "--output-dir", tmpdir])

        assert result.exit_code == 0
        for file_name in [
            "latest-results.json",
            "latest-report.html",
            "latest-report.md",
            "degraded-results.json",
            "degraded-report.html",
            "degraded-report.md",
        ]:
            assert os.path.exists(os.path.join(tmpdir, file_name))


def test_command_runner_blocks_mutating_commands():
    evidence = CommandRunner.run_command(["sudo", "rm", "-rf", "/tmp/demo"])

    assert evidence.exit_code == 126
    assert "blocked" in evidence.stderr.lower()


def test_validate_command_accepts_real_hardware_profiles():
    with tempfile.TemporaryDirectory() as tmpdir:
        result = runner.invoke(app, ["validate", "--profile", "dgx-class", "--name", "profile-smoke", "--output-dir", tmpdir])

        assert result.exit_code == 0
        assert os.path.exists(os.path.join(tmpdir, "latest-results.json"))
        with open(os.path.join(tmpdir, "latest-results.json"), "r", encoding="utf-8") as handle:
            content = handle.read()
        assert '"selected_profile": "dgx-class"' in content
        assert '"simulated": false' in content


def test_dgx_profile_is_not_hardware_identity_claim():
    profile = get_profile("dgx-class")

    assert "expected-capability" in profile.notes.lower()
    assert "authenticity" in profile.notes.lower()
