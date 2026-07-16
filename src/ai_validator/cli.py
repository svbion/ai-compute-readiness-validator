import os
import sys
from typing import Optional
import typer
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from ai_validator.models import Cluster, Node, StatusEnum
from ai_validator.scoring import ScoringEngine
from ai_validator.demo.generator import DemoGenerator
from ai_validator.reporting.json_report import JsonReporter
from ai_validator.reporting.html import HtmlReporter
from ai_validator.reporting.markdown import MarkdownReporter

# Import collectors
from ai_validator.collectors.linux import LinuxCollector
from ai_validator.collectors.gpu import GpuCollector
from ai_validator.collectors.dcgm import DcgmCollector
from ai_validator.collectors.infiniband import InfiniBandCollector
from ai_validator.collectors.slurm import SlurmCollector
from ai_validator.collectors.kubernetes import KubernetesCollector
from ai_validator.collectors.storage import StorageCollector
from ai_validator.collectors.network import NetworkCollector

# Import benchmark parsers
from ai_validator.benchmarks.nccl import NcclParser
from ai_validator.benchmarks.hpl import HplParser
from ai_validator.benchmarks.fio import FioParser
from ai_validator.benchmarks.iperf import IperfParser
from ai_validator.benchmarks.osu import OsuParser

app = typer.Typer(help="AI Compute Readiness Validator - Assessment CLI")
console = Console()

def print_terminal_summary(cluster: Cluster):
    """Prints a beautiful Rich-formatted summary of the cluster validation to stdout."""
    console.print("\n")
    
    # Header Banner
    banner_text = Text()
    banner_text.append("AI COMPUTE READINESS ASSESSMENT", style="bold white")
    banner_text.append(f"\nCluster Identifier: {cluster.name} | Mode: {cluster.metadata.get('execution_mode', 'Validation')}", style="dim gray")
    banner_text.append(f"\nGenerated: {cluster.timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')}", style="dim gray")
    
    console.print(Panel(banner_text, border_style="green" if cluster.classification == "Ready" else "yellow" if cluster.classification == "Ready with warnings" else "red"))

    # Score Panel
    score_color = "green" if cluster.classification == "Ready" else "yellow" if cluster.classification == "Ready with warnings" else "red"
    score_text = Text()
    score_text.append(f"READINESS SCORE: {cluster.overall_score}%\n", style=f"bold {score_color} size=large")
    score_text.append(f"CLASSIFICATION: {cluster.classification.upper()}", style=f"bold {score_color}")
    
    console.print(Panel(score_text, border_style=score_color, title="Overall Result", title_align="left"))

    # Category Table
    table = Table(title="Category Score Breakdown", title_justify="left", show_header=True, header_style="bold cyan")
    table.add_column("Category", style="bold")
    table.add_column("Average Score", justify="right")
    table.add_column("Weight Contribution", justify="right")
    
    active_weights = cluster.metadata.get("active_weights", {})
    total_active_weight = cluster.metadata.get("total_active_weight", 1.0)
    category_averages = cluster.metadata.get("category_averages", {})
    
    for cat_id, weight in active_weights.items():
        name = cat_id.replace("_", " ").upper()
        avg = category_averages.get(cat_id, 0.0)
        rel_weight = (weight / total_active_weight) * 100
        
        # Color based on score
        color = "green" if avg >= 95 else "yellow" if avg >= 85 else "red"
        table.add_row(name, f"[{color}]{avg:.1f}%[/{color}]", f"{rel_weight:.1f}%")
        
    console.print(table)

    # Key Findings & Recommendations
    if cluster.recommendations:
        rec_table = Table(title="Remediation & Action Items Required", title_justify="left", show_header=True, header_style="bold red")
        rec_table.add_column("Action Item / Finding", style="red")
        
        for rec in cluster.recommendations:
            rec_table.add_row(rec)
        console.print(rec_table)
    else:
        console.print("[bold green]✓ Zero issues detected. All validation layers are healthy and active![/bold green]\n")

    # Node states
    node_table = Table(title="Node Inventory States", title_justify="left", show_header=True, header_style="bold magenta")
    node_table.add_column("Node Name")
    node_table.add_column("Status")
    
    for node in cluster.nodes:
        status_str = "[bold green]PASS[/bold green]" if node.status == StatusEnum.PASS else "[bold yellow]WARN[/bold yellow]" if node.status == StatusEnum.WARNING else "[bold red]FAIL[/bold red]"
        node_table.add_row(node.name, status_str)
        
    console.print(node_table)
    console.print("\n")


@app.command()
def validate(
    name: str = typer.Option("localhost-cluster", "--name", help="Name to assign to the validated cluster"),
    output_dir: str = typer.Option("artifacts", "--output-dir", help="Directory where reports are written")
):
    """
    Executes live validation on the local machine using secure, read-only system calls.
    Detects local host capabilities and generates detailed reports.
    """
    console.print("[bold green]Starting live compute diagnostic validation...[/bold green]")
    
    # Determine local hostname
    import socket
    hostname = socket.gethostname()
    
    # Run collectors
    collectors = [
        LinuxCollector(),
        GpuCollector(),
        DcgmCollector(),
        InfiniBandCollector(),
        SlurmCollector(),
        KubernetesCollector(),
        StorageCollector(),
        NetworkCollector()
    ]
    
    node_categories = {}
    for c in collectors:
        try:
            checks = c.collect(hostname)
            # Add to categories
            for chk in checks:
                cat_id = chk.category
                if cat_id not in node_categories:
                    node_categories[cat_id] = node_categories.get(cat_id, [])
                node_categories[cat_id].append(chk)
        except Exception as e:
            console.print(f"[bold red]Collector execution error on {c.__class__.__name__}: {str(e)}[/bold red]")

    # Build category models
    categories_dict = {}
    from ai_validator.config import DEFAULT_WEIGHTS
    for cat_id, checks_list in node_categories.items():
        categories_dict[cat_id] = {
            "id": cat_id,
            "name": cat_id.replace("_", " ").title(),
            "weight": DEFAULT_WEIGHTS.get(cat_id, 10.0),
            "checks": checks_list
        }
    
    # Standardize empty active categories that might have been skipped
    for cat_id, weight in DEFAULT_WEIGHTS.items():
        if cat_id not in categories_dict:
            categories_dict[cat_id] = {
                "id": cat_id,
                "name": cat_id.replace("_", " ").title(),
                "weight": weight,
                "checks": []
            }

    # Assemble models
    node = Node(
        name=hostname,
        ip_address=None,
        categories=categories_dict
    )
    
    cluster = Cluster(
        name=name,
        nodes=[node],
        metadata={"execution_mode": "Live Validation"}
    )
    
    # Calculate score
    scored_cluster = ScoringEngine.evaluate_cluster(cluster)
    
    # Write reports
    json_path = os.path.join(output_dir, "latest-results.json")
    html_path = os.path.join(output_dir, "latest-report.html")
    md_path = os.path.join(output_dir, "latest-report.md")
    
    JsonReporter.generate_report(scored_cluster, json_path)
    HtmlReporter.generate_report(scored_cluster, html_path)
    MarkdownReporter.generate_report(scored_cluster, md_path)
    
    # Output to stdout
    print_terminal_summary(scored_cluster)
    
    console.print(f"[bold green]Assessment reports successfully generated:[/bold green]")
    console.print(f" - JSON: [cyan]{json_path}[/cyan]")
    console.print(f" - HTML: [cyan]{html_path}[/cyan]")
    console.print(f" - Markdown: [cyan]{md_path}[/cyan]\n")


@app.command()
def demo(
    scenario: str = typer.Option("degraded", "--scenario", help="Scenario to simulate: 'healthy' or 'degraded'"),
    output_dir: str = typer.Option("artifacts", "--output-dir", help="Directory where reports are written")
):
    """
    Triggers demonstration mode for evaluating predefined virtual cluster profiles.
    Used for verifying scoring, reports, and overrides on systems without NVIDIA hardware.
    """
    console.print(f"[bold green]Starting cluster demonstration for scenario: [cyan]{scenario}[/cyan]...[/bold green]")
    
    try:
        scored_cluster = DemoGenerator.get_scenario(scenario)
    except ValueError as e:
        console.print(f"[bold red]Error: {str(e)}[/bold red]", err=True)
        sys.exit(1)
        
    # Write reports
    json_path = os.path.join(output_dir, "latest-results.json")
    html_path = os.path.join(output_dir, "latest-report.html")
    md_path = os.path.join(output_dir, "latest-report.md")
    
    JsonReporter.generate_report(scored_cluster, json_path)
    HtmlReporter.generate_report(scored_cluster, html_path)
    MarkdownReporter.generate_report(scored_cluster, md_path)
    
    # Output to stdout
    print_terminal_summary(scored_cluster)
    
    console.print(f"[bold green]Assessment reports successfully generated for [cyan]{scenario}[/cyan]:[/bold green]")
    console.print(f" - JSON: [cyan]{json_path}[/cyan]")
    console.print(f" - HTML: [cyan]{html_path}[/cyan]")
    console.print(f" - Markdown: [cyan]{md_path}[/cyan]\n")


@app.command()
def report(
    input_file: str = typer.Option("artifacts/latest-results.json", "--input", help="Stored JSON results file to regenerate reports from"),
    output_dir: str = typer.Option("artifacts", "--output-dir", help="Directory where reports are written")
):
    """
    Regenerates HTML and Markdown reports from an existing JSON results file.
    """
    if not os.path.exists(input_file):
        console.print(f"[bold red]Error: Specified input file '{input_file}' does not exist.[/bold red]", err=True)
        sys.exit(1)
        
    console.print(f"[bold green]Loading validation data from [cyan]{input_file}[/cyan]...[/bold green]")
    
    try:
        with open(input_file, "r", encoding="utf-8") as f:
            content = f.read()
        cluster = Cluster.model_validate_json(content)
    except Exception as e:
        console.print(f"[bold red]Error parsing stored JSON results: {str(e)}[/bold red]", err=True)
        sys.exit(1)
        
    # Re-evaluate to make sure scoring config updates are reflected
    scored_cluster = ScoringEngine.evaluate_cluster(cluster)
    
    html_path = os.path.join(output_dir, "latest-report.html")
    md_path = os.path.join(output_dir, "latest-report.md")
    
    HtmlReporter.generate_report(scored_cluster, html_path)
    MarkdownReporter.generate_report(scored_cluster, md_path)
    
    print_terminal_summary(scored_cluster)
    
    console.print(f"[bold green]Reports successfully regenerated:[/bold green]")
    console.print(f" - HTML: [cyan]{html_path}[/cyan]")
    console.print(f" - Markdown: [cyan]{md_path}[/cyan]\n")


@app.command()
def version():
    """
    Prints the AI Compute Readiness Validator version.
    """
    from ai_validator.config import APP_NAME, VERSION
    console.print(f"[bold cyan]{APP_NAME}[/bold cyan] version [green]v{VERSION}[/green]")


@app.command()
def benchmark(
    action: str = typer.Argument(..., help="Action to execute: 'ingest'"),
    benchmark_type: str = typer.Option("nccl", "--type", help="Benchmark log type to parse: 'nccl', 'hpl', 'fio', 'iperf', 'osu'"),
    file: str = typer.Option(..., "--file", help="Path to raw benchmark log file to ingest")
):
    """
    Ingests and parses historical execution logs of standard communication and compute benchmarks.
    Appends the parsed performance profiles to the current diagnostic reports.
    """
    if action.lower() != "ingest":
        console.print("[bold red]Unsupported action. Use 'ingest'.[/bold red]")
        sys.exit(1)
        
    if not os.path.exists(file):
        console.print(f"[bold red]Error: Benchmark log file '{file}' does not exist.[/bold red]", err=True)
        sys.exit(1)

    console.print(f"Ingesting [cyan]{benchmark_type.upper()}[/cyan] log from: [cyan]{file}[/cyan]")
    
    # Select parser
    parser_type = benchmark_type.strip().lower()
    if parser_type == "nccl":
        result = NcclParser.parse(file)
    elif parser_type == "hpl":
        result = HplParser.parse(file)
    elif parser_type == "fio":
        result = FioParser.parse(file)
    elif parser_type == "iperf":
        result = IperfParser.parse(file)
    elif parser_type in ("osu", "osu-mpi"):
        result = OsuParser.parse(file)
    else:
        console.print(f"[bold red]Unsupported benchmark type: '{benchmark_type}'. Supported: nccl, hpl, fio, iperf, osu[/bold red]", err=True)
        sys.exit(1)

    # Load existing latest cluster or start with placeholder
    latest_results_path = "artifacts/latest-results.json"
    cluster = None
    if os.path.exists(latest_results_path):
        try:
            with open(latest_results_path, "r", encoding="utf-8") as f:
                cluster = Cluster.model_validate_json(f.read())
        except Exception:
            pass

    if not cluster:
        # Create placeholder
        console.print("[dim]No active validation session found. Creating fresh benchmark report container...[/dim]")
        cluster = Cluster(
            name="benchmark-ingested-report",
            nodes=[],
            metadata={"execution_mode": "Benchmark Ingestion"}
        )

    # Add result
    cluster.benchmark_results.append(result)
    
    # Re-evaluate
    scored_cluster = ScoringEngine.evaluate_cluster(cluster)
    
    # Save reports
    JsonReporter.generate_report(scored_cluster, latest_results_path)
    HtmlReporter.generate_report(scored_cluster, "artifacts/latest-report.html")
    MarkdownReporter.generate_report(scored_cluster, "artifacts/latest-report.md")
    
    console.print(f"[bold green]Benchmark data parsed and saved successfully![/bold green]")
    console.print(f"Metrics extracted: [bold yellow]{result.metrics}[/bold yellow]")
    console.print(f"Updated HTML report at: [cyan]artifacts/latest-report.html[/cyan]\n")


if __name__ == "__main__":
    app()
