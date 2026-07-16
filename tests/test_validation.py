import os
import tempfile
import pytest
from ai_validator.models import Cluster, Node, StatusEnum, SeverityEnum
from ai_validator.scoring import ScoringEngine
from ai_validator.demo.generator import DemoGenerator
from ai_validator.reporting.json_report import JsonReporter
from ai_validator.reporting.html import HtmlReporter
from ai_validator.reporting.markdown import MarkdownReporter

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
