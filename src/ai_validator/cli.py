import os
import sys
import json
import getpass
import hashlib
import secrets
from typing import Optional
from datetime import datetime
from pathlib import Path
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
from ai_validator.profiles import get_profile
from ai_validator.evidence.collector import collect_evidence, dry_run_commands
from ai_validator.evidence.archive import BundleValidationError, create_bundle, upload_bundle

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
from ai_validator.benchmarks.intelligence import parse_benchmark_file, write_import

app = typer.Typer(help="GPU Validator - Assessment CLI")
console = Console()
runner_app = typer.Typer(help="Outbound node runner commands")
app.add_typer(runner_app, name="runner")
users_app = typer.Typer(help="Production user administration commands")
app.add_typer(users_app, name="users")


def _user_store_path() -> Path:
    return Path(os.environ.get("AI_VALIDATOR_USER_STORE", "artifacts/users/store.json"))


def _normalize_username(username: str) -> str:
    import re
    normalized = username.strip().lower()
    if not re.match(r"^[a-z0-9][a-z0-9._-]{2,62}$", normalized):
        raise ValueError("Username must be 3-63 characters using letters, numbers, dot, dash, or underscore.")
    return normalized


def _validate_admin_password(password: str) -> None:
    if len(password) < 14 or not any(c.islower() for c in password) or not any(c.isupper() for c in password) or not any(c.isdigit() for c in password) or not any(not c.isalnum() for c in password):
        raise ValueError("Password must be at least 14 characters and include uppercase, lowercase, number, and symbol characters.")


def _create_scrypt_hash(password: str) -> str:
    salt = secrets.token_hex(16)
    derived = hashlib.scrypt(password.encode("utf-8"), salt=salt.encode("utf-8"), n=16384, r=8, p=1, dklen=64).hex()
    return f"scrypt${salt}${derived}"


def _read_user_store(path: Path) -> dict:
    if not path.exists():
        return {"schema_version": "1.0.0", "users": [], "audit_entries": []}
    return json.loads(path.read_text(encoding="utf-8"))


def _write_user_store(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    tmp.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    tmp.chmod(0o600)
    tmp.replace(path)


def normalize_text_artifact(path: str) -> None:
    """Strip trailing whitespace to keep generated artifacts diff-clean."""
    if not os.path.exists(path):
        return

    with open(path, "r", encoding="utf-8") as handle:
        content = handle.read()

    normalized = "\n".join(line.rstrip() for line in content.splitlines())
    if content.endswith("\n"):
        normalized += "\n"

    with open(path, "w", encoding="utf-8") as handle:
        handle.write(normalized)


def write_report_bundle(cluster: Cluster, output_dir: str, stems: list[str]) -> dict[str, dict[str, str]]:
    """Write JSON, HTML, and Markdown reports for one or more filename stems."""
    reporters = {
        "json": ("results.json", JsonReporter.generate_report),
        "html": ("report.html", HtmlReporter.generate_report),
        "markdown": ("report.md", MarkdownReporter.generate_report),
    }
    written: dict[str, dict[str, str]] = {}

    for stem in stems:
        written[stem] = {}
        for report_kind, (suffix, reporter) in reporters.items():
            output_path = os.path.join(output_dir, f"{stem}-{suffix}")
            written[stem][report_kind] = reporter(cluster, output_path)
            if report_kind in {"html", "markdown"}:
                normalize_text_artifact(written[stem][report_kind])

    return written


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
    profile: str = typer.Option("auto", "--profile", help="Validation profile: auto, gpu-workstation, single-gpu-node, dgx-class, hgx-based, oem-gpu-platform, slurm-gpu-cluster, kubernetes-gpu-cluster, ai-factory"),
    name: str = typer.Option("localhost-cluster", "--name", help="Name to assign to the validated cluster"),
    output_dir: str = typer.Option("artifacts", "--output-dir", help="Directory where reports are written")
):
    """
    Executes live validation on the local machine using secure, read-only system calls.
    Detects local host capabilities and generates detailed reports.
    """
    try:
        selected_profile = get_profile(profile)
    except ValueError as exc:
        console.print(f"[bold red]{exc}[/bold red]", err=True)
        sys.exit(1)

    console.print(f"[bold green]Starting live compute diagnostic validation with profile [cyan]{selected_profile.id}[/cyan]...[/bold green]")
    
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
        metadata={
            "execution_mode": "Live Validation",
            "validation_source": "Live Linux Host",
            "collection_timestamp": datetime.utcnow().isoformat() + "Z",
            "hostname": hostname,
            "selected_profile": selected_profile.id,
            "selected_profile_label": selected_profile.label,
            "expected_capabilities": selected_profile.expected_capabilities,
            "profile_notes": selected_profile.notes,
            "detected_environment": "local-linux-host",
            "hardware_identity_verified": False,
            "collector_version": "ai-validator 0.1.0",
            "git_commit": os.environ.get("AI_VALIDATOR_GIT_COMMIT", "unknown"),
            "operating_system_evidence": "linux.os_version",
            "gpu_evidence_source": "nvidia-smi when present; unavailable otherwise",
            "cluster_evidence_source": "Slurm/Kubernetes/InfiniBand commands when present; unavailable otherwise",
            "simulated": False,
            "sanitization_status": "sanitized-by-command-runner",
            "source_confidence": "live-host-read-only-commands",
            "limitations": [
                "No active diagnostics, stress tests, GPU resets, driver installation, firmware updates, or scheduler mutations were executed.",
                "DGX-class and HGX-based profiles are expected-capability profiles, not hardware authenticity claims.",
            ],
        }
    )
    
    # Calculate score
    scored_cluster = ScoringEngine.evaluate_cluster(cluster)
    written_reports = write_report_bundle(scored_cluster, output_dir, ["latest"])
    latest_paths = written_reports["latest"]
    
    # Output to stdout
    print_terminal_summary(scored_cluster)
    
    console.print(f"[bold green]Assessment reports successfully generated:[/bold green]")
    console.print(f" - JSON: [cyan]{latest_paths['json']}[/cyan]")
    console.print(f" - HTML: [cyan]{latest_paths['html']}[/cyan]")
    console.print(f" - Markdown: [cyan]{latest_paths['markdown']}[/cyan]\n")


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
        
    written_reports = write_report_bundle(scored_cluster, output_dir, ["latest", scenario])
    latest_paths = written_reports["latest"]
    scenario_paths = written_reports[scenario]
    
    # Output to stdout
    print_terminal_summary(scored_cluster)
    
    console.print(f"[bold green]Assessment reports successfully generated for [cyan]{scenario}[/cyan]:[/bold green]")
    console.print(f" - Latest JSON: [cyan]{latest_paths['json']}[/cyan]")
    console.print(f" - Latest HTML: [cyan]{latest_paths['html']}[/cyan]")
    console.print(f" - Latest Markdown: [cyan]{latest_paths['markdown']}[/cyan]")
    console.print(f" - Scenario JSON: [cyan]{scenario_paths['json']}[/cyan]")
    console.print(f" - Scenario HTML: [cyan]{scenario_paths['html']}[/cyan]")
    console.print(f" - Scenario Markdown: [cyan]{scenario_paths['markdown']}[/cyan]\n")


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
def collect(
    profile: str = typer.Option(
        ...,
        "--profile",
        help="Collection profile: linux-host, gpu-workstation, single-gpu-node, dgx-class",
    ),
    output: str = typer.Option(..., "--output", help="Evidence bundle output directory"),
    sanitize: bool = typer.Option(
        False,
        "--sanitize",
        help="Sanitize host-identifying fields in captured output",
    ),
    dry_run: bool = typer.Option(
        False,
        "--dry-run",
        help="Print commands without running them or writing files",
    ),
    timeout: int = typer.Option(30, "--timeout", min=1, help="Per-command timeout in seconds"),
    include_diagnostics: bool = typer.Option(
        False,
        "--include-diagnostics",
        help="Run optional lightweight DCGM diagnostics when explicitly approved",
    ),
):
    """
    Collects a local read-only evidence bundle from an administrator-side Linux/GPU host.
    """
    try:
        commands = dry_run_commands(profile, include_diagnostics=include_diagnostics)
    except ValueError as exc:
        console.print(f"[bold red]{exc}[/bold red]")
        sys.exit(1)

    if dry_run:
        console.print(
            f"[bold green]Dry run for collection profile [cyan]{profile}[/cyan]. "
            "No commands executed and no files written.[/bold green]"
        )
        for command in commands:
            if command.diagnostics and not include_diagnostics:
                console.print(f"[yellow]SKIP[/yellow] {command.id}: {' '.join(command.argv)}")
            else:
                console.print(f"[cyan]{command.category}[/cyan] {command.id}: {' '.join(command.argv)}")
        return

    try:
        summary = collect_evidence(
            profile=profile,
            output_path=output,
            timeout=timeout,
            sanitize=sanitize,
            include_diagnostics=include_diagnostics,
        )
    except Exception as exc:
        console.print(f"[bold red]Evidence collection failed: {exc}[/bold red]")
        sys.exit(1)

    console.print(f"[bold green]Evidence bundle written to [cyan]{summary.output_path}[/cyan][/bold green]")
    console.print(
        "Commands: "
        f"{summary.command_count}; collected: {summary.collected_count}; "
        f"missing: {summary.missing_count}; failed: {summary.failed_count}; "
        f"skipped: {summary.skipped_count}; warnings: {summary.warning_count}"
    )


@app.command()
def bundle(
    input: str = typer.Option(..., "--input", help="Existing collector evidence directory"),
    output: str = typer.Option(..., "--output", help="Output .tar.gz or .tgz archive path"),
    force: bool = typer.Option(False, "--force", help="Overwrite output archive if it already exists"),
):
    """Packages a validated collector evidence directory as a deterministic tar.gz archive."""
    try:
        digest = create_bundle(Path(input), Path(output), force=force)
    except BundleValidationError as exc:
        console.print(f"[bold red]Bundle creation failed: {exc}[/bold red]")
        sys.exit(1)
    console.print(f"[bold green]Evidence archive written:[/bold green] [cyan]{output}[/cyan]")
    console.print(f"SHA-256: {digest}")


@app.command()
def upload(
    bundle: str = typer.Option(..., "--bundle", help="Evidence .tar.gz/.tgz archive to upload"),
    url: str = typer.Option(..., "--url", help="GPU Validator evidence upload URL"),
    token_file: Optional[str] = typer.Option(None, "--token-file", help="File containing the upload token"),
    timeout: float = typer.Option(60.0, "--timeout", min=1.0, help="Upload timeout in seconds"),
    allow_insecure_http: bool = typer.Option(False, "--allow-insecure-http", help="Allow HTTP only for local development"),
):
    """Uploads an evidence bundle using a bearer token from a file or GPU_VALIDATOR_UPLOAD_TOKEN."""
    try:
        if token_file:
            token = Path(token_file).read_text(encoding="utf-8").strip()
        else:
            token = os.environ.get("GPU_VALIDATOR_UPLOAD_TOKEN", "").strip()
        if not token:
            raise BundleValidationError("Upload token is required via --token-file or GPU_VALIDATOR_UPLOAD_TOKEN")
        payload = upload_bundle(Path(bundle), url, token, timeout=timeout, allow_insecure_http=allow_insecure_http)
    except BundleValidationError as exc:
        message = str(exc).replace(os.environ.get("GPU_VALIDATOR_UPLOAD_TOKEN", "__never_match__"), "[redacted]")
        console.print(f"[bold red]{message}[/bold red]")
        sys.exit(1)
    evidence = payload.get("evidence", {}) if isinstance(payload, dict) else {}
    console.print("[bold green]Evidence upload accepted.[/bold green]")
    console.print(f"Evidence ID: {evidence.get('id', 'unknown')}")
    console.print(f"Collection ID: {payload.get('collection_id', evidence.get('collection_id', 'unknown'))}")


@app.command()
def version():
    """
    Prints the GPU Validator version.
    """
    from ai_validator.config import APP_NAME, VERSION
    console.print(f"[bold cyan]{APP_NAME}[/bold cyan] version [green]v{VERSION}[/green]")


@runner_app.command("capabilities")
def runner_capabilities():
    """Print local runner capability discovery without running benchmarks."""
    from ai_validator.runner_client import detect_capabilities
    console.print_json(data=detect_capabilities())


@users_app.command("bootstrap-admin")
def users_bootstrap_admin(
    username: str = typer.Option(..., "--username", help="Administrator username"),
    display_name: str = typer.Option(..., "--display-name", help="Administrator display name"),
    password_file: Optional[str] = typer.Option(None, "--password-file", help="File containing the administrator password"),
    recovery: bool = typer.Option(False, "--recovery", help="Allow bootstrap when an administrator already exists"),
):
    """Create the initial administrator without printing or storing plaintext passwords."""
    try:
        store_path = _user_store_path()
        data = _read_user_store(store_path)
        active_admins = [user for user in data.get("users", []) if user.get("role") == "administrator" and user.get("status") == "active" and not user.get("disabled_at")]
        if active_admins and not recovery:
            raise ValueError("An active administrator already exists; refusing bootstrap without --recovery.")
        if password_file:
            password = Path(password_file).read_text(encoding="utf-8").strip()
        else:
            if not sys.stdin.isatty():
                raise ValueError("Use --password-file when no interactive TTY is available.")
            first = getpass.getpass("Administrator password: ")
            second = getpass.getpass("Confirm administrator password: ")
            if first != second:
                raise ValueError("Passwords did not match.")
            password = first
        _validate_admin_password(password)
        normalized = _normalize_username(username)
        if any(user.get("username", "").lower() == normalized for user in data.get("users", [])):
            raise ValueError("Username is already in use.")
        now = datetime.utcnow().isoformat() + "Z"
        user_id = f"usr_{secrets.token_hex(16)}"
        user = {
            "id": user_id,
            "schema_version": "1.0.0",
            "username": normalized,
            "display_name": display_name.strip(),
            "email": None,
            "role": "administrator",
            "password_hash": _create_scrypt_hash(password),
            "status": "active",
            "created_at": now,
            "created_by": "cli-bootstrap",
            "updated_at": now,
            "last_login_at": None,
            "password_changed_at": now,
            "expires_at": None,
            "disabled_at": None,
            "failed_login_count": 0,
            "locked_until": None,
            "must_change_password": False,
            "session_version": 1,
            "notes": "Initial administrator bootstrap",
            "tags": ["bootstrap"],
        }
        data.setdefault("users", []).append(user)
        data.setdefault("audit_entries", []).append({"id": f"aud_{secrets.token_hex(16)}", "created_at": now, "actor": "cli-bootstrap", "action": "user.bootstrap_admin", "user_id": user_id, "metadata": {"username": normalized}})
        _write_user_store(store_path, data)
    except Exception as exc:
        console.print(f"[bold red]{exc}[/bold red]")
        sys.exit(1)
    console.print("[bold green]Administrator created.[/bold green]")
    console.print(f"Username: [cyan]{normalized}[/cyan]")
    console.print(f"User ID: [cyan]{user_id}[/cyan]")
    console.print("Password: [green]stored as hash only; plaintext was not printed[/green]")


@runner_app.command("register")
def runner_register(
    url: str = typer.Option(..., "--url", help="GPU Validator base URL"),
    node_id: str = typer.Option(..., "--node-id", help="Registered node ID"),
    token_file: str = typer.Option(..., "--token-file", help="File containing one-time runner registration token"),
    credential_file: str = typer.Option("runner-credential.json", "--credential-file", help="Output credential file"),
    allow_insecure_http: bool = typer.Option(False, "--allow-insecure-http", help="Allow HTTP only for local development"),
):
    """Register this node runner using a token file. Secrets are not printed."""
    from ai_validator.runner_client import detect_capabilities, post_json, read_token_file, require_safe_url, write_credential_file
    try:
        safe_url = require_safe_url(url, allow_insecure_http)
        token = read_token_file(Path(token_file))
        caps = detect_capabilities()
        payload = post_json(f"{safe_url}", "/api/v1/runners/register", {"node_id": node_id, "token": token, "runner_version": "0.1.0", "supported_benchmark_ids": ["nccl-all-reduce", "nccl-all-gather", "nccl-reduce-scatter", "nccl-broadcast"], "capabilities": caps, **caps})
        write_credential_file(Path(credential_file), payload["credential"], safe_url)
    except Exception as exc:
        secret = Path(token_file).read_text(encoding="utf-8").strip() if Path(token_file).exists() else "__never_match__"
        console.print(f"[bold red]{str(exc).replace(secret, '[redacted]')}[/bold red]")
        sys.exit(1)
    console.print(f"[bold green]Runner registered.[/bold green] Credential file: [cyan]{credential_file}[/cyan]")


@runner_app.command("status")
def runner_status(credential_file: str = typer.Option(..., "--credential-file", help="Runner credential JSON")):
    """Show safe local runner credential status without printing secrets."""
    from ai_validator.runner_client import read_credential_file
    try:
        cred = read_credential_file(Path(credential_file))
    except Exception as exc:
        console.print(f"[bold red]{exc}[/bold red]")
        sys.exit(1)
    console.print(f"Runner ID: [cyan]{cred['runner_id']}[/cyan]")
    console.print(f"URL: [cyan]{cred.get('url', 'unknown')}[/cyan]")
    console.print("Credential: [green]present (redacted)[/green]")


@runner_app.command("once")
def runner_once(
    url: str = typer.Option(..., "--url", help="GPU Validator base URL"),
    credential_file: str = typer.Option(..., "--credential-file", help="Runner credential JSON"),
    allow_insecure_http: bool = typer.Option(False, "--allow-insecure-http", help="Allow HTTP only for local development"),
):
    """Poll once. This safe scaffold does not execute arbitrary commands."""
    from ai_validator.runner_client import read_credential_file, require_safe_url
    try:
        require_safe_url(url, allow_insecure_http)
        cred = read_credential_file(Path(credential_file))
    except Exception as exc:
        console.print(f"[bold red]{exc}[/bold red]")
        sys.exit(1)
    console.print(f"Runner {cred['runner_id']} ready for one-shot claim polling. No arbitrary shell access is available.")


@runner_app.command("run")
def runner_run(
    url: str = typer.Option(..., "--url", help="GPU Validator base URL"),
    credential_file: str = typer.Option(..., "--credential-file", help="Runner credential JSON"),
    poll_interval: int = typer.Option(10, "--poll-interval", min=1, help="Polling interval seconds"),
    allow_insecure_http: bool = typer.Option(False, "--allow-insecure-http", help="Allow HTTP only for local development"),
):
    """Long-running runner scaffold with outbound polling only."""
    from ai_validator.runner_client import read_credential_file, require_safe_url
    try:
        require_safe_url(url, allow_insecure_http)
        cred = read_credential_file(Path(credential_file))
    except Exception as exc:
        console.print(f"[bold red]{exc}[/bold red]")
        sys.exit(1)
    console.print(f"Runner {cred['runner_id']} configured for outbound polling every {poll_interval}s. Use Ctrl-C to stop; no interactive shell is exposed.")


@app.command()
def benchmark(
    action: str = typer.Argument(..., help="Action to execute: 'import'"),
    benchmark_type: str = typer.Option("nccl", "--type", help="Benchmark log type to parse: nccl, hpl, triton, genai-perf"),
    input_file: Optional[str] = typer.Option(None, "--input", help="Path to raw benchmark output file to import"),
    file: Optional[str] = typer.Option(None, "--file", help="Deprecated alias for --input"),
    engagement_id: str = typer.Option("local-import", "--engagement-id", help="Engagement ID to attach in the local import record"),
    node_id: Optional[str] = typer.Option(None, "--node-id", help="Optional node ID to attach in the local import record"),
    output_dir: str = typer.Option("artifacts/benchmark-imports", "--output-dir", help="Directory for local imported benchmark JSON records"),
    simulated: bool = typer.Option(False, "--simulated", help="Mark imported benchmark output as simulated/demo evidence"),
):
    """
    Imports and parses existing NCCL, NVIDIA HPL, Triton perf_analyzer, or GenAI-Perf output.
    This command never launches benchmarks or installs benchmark software.
    """
    if action.lower() not in {"import", "ingest"}:
        console.print("[bold red]Unsupported action. Use 'import'.[/bold red]")
        sys.exit(1)

    selected_input = input_file or file
    if not selected_input or not os.path.exists(selected_input):
        console.print(f"[bold red]Error: Benchmark input file '{selected_input}' does not exist.[/bold red]", err=True)
        sys.exit(1)

    parser_type = benchmark_type.strip().lower().replace("-", "_")
    if parser_type == "triton":
        parser_type = "triton_perf_analyzer"
    if parser_type in {"genai", "genai_perf"}:
        parser_type = "genai_perf"
    if parser_type not in {"nccl", "hpl", "triton_perf_analyzer", "genai_perf"}:
        console.print(f"[bold red]Unsupported benchmark type: '{benchmark_type}'. Supported: nccl, hpl, triton, genai-perf[/bold red]", err=True)
        sys.exit(1)

    run = parse_benchmark_file(parser_type, Path(selected_input), engagement_id=engagement_id, node_id=node_id, simulated=simulated)  # type: ignore[arg-type]
    output_path = write_import(run, Path(output_dir))
    console.print("[bold green]Benchmark import parsed and persisted.[/bold green]")
    console.print(f"Benchmark ID: [cyan]{run.id}[/cyan]")
    console.print(f"Status: [cyan]{run.status}[/cyan]")
    console.print(f"SHA-256: {run.sha256}")
    console.print(f"Output: [cyan]{output_path}[/cyan]")
    console.print(f"Metrics extracted: [bold yellow]{run.metrics}[/bold yellow]")


if __name__ == "__main__":
    app()
