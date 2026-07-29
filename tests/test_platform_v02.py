from __future__ import annotations

from pathlib import Path

import pytest

from ai_validator.platform import (
    ApprovalState,
    AuthorizationError,
    BenchmarkRun,
    EvidenceReference,
    PlatformService,
    PlatformStore,
    RemediationState,
    ValidationStatus,
    sanitize_secret_text,
    safe_archive_member,
)


def service(tmp_path: Path) -> PlatformService:
    store = PlatformStore(tmp_path / "platform-store.json")
    return PlatformService(store)


def test_seed_contains_required_platform_entities(tmp_path: Path):
    platform = service(tmp_path)
    snapshot = platform.seed_demo_fixture()

    required = {
        "organizations",
        "users",
        "roles",
        "permissions",
        "clusters",
        "racks",
        "nodes",
        "gpus",
        "nics",
        "fabric_links",
        "storage_targets",
        "schedulers",
        "kubernetes_clusters",
        "agents",
        "agent_heartbeats",
        "validation_definitions",
        "validation_runs",
        "validation_steps",
        "validation_findings",
        "benchmark_packages",
        "benchmark_runs",
        "benchmark_results",
        "benchmark_metrics",
        "benchmark_comparisons",
        "regression_findings",
        "alerts",
        "incidents",
        "investigations",
        "conversations",
        "conversation_messages",
        "evidence_references",
        "reports",
        "remediation_plans",
        "approval_requests",
        "audit_events",
        "academy_courses",
        "academy_lessons",
        "academy_labs",
        "academy_progress",
        "saved_investigations",
    }

    assert required.issubset(snapshot.keys())
    assert snapshot["organizations"]
    assert snapshot["clusters"]
    assert snapshot["audit_events"][-1]["action"] == "platform.seed_demo_fixture"


def test_rbac_and_organization_isolation(tmp_path: Path):
    platform = service(tmp_path)
    seeded = platform.seed_demo_fixture()
    org_id = seeded["organizations"][0]["id"]
    viewer = platform.create_user(org_id, "viewer@example.test", role_name="Viewer")
    other_org = platform.create_organization("Other Org")
    other_cluster = platform.create_cluster(other_org.id, "other-cluster")

    with pytest.raises(AuthorizationError):
        platform.require_permission(viewer, "cluster:write")

    visible = platform.list_clusters(viewer)
    assert all(item.organization_id == org_id for item in visible)
    assert other_cluster.id not in {item.id for item in visible}


def test_agent_registration_inventory_heartbeat_execution_and_result_upload(tmp_path: Path):
    platform = service(tmp_path)
    seeded = platform.seed_demo_fixture()
    org_id = seeded["organizations"][0]["id"]
    cluster_id = seeded["clusters"][0]["id"]

    agent, token = platform.register_agent(
        org_id,
        cluster_id,
        name="fixture-agent-01",
        version="0.2.0",
        capabilities=["inventory", "validation", "benchmark"],
    )
    assert token.startswith("gva_")
    assert agent.status == "registered"

    inventory = platform.submit_inventory(
        agent.id,
        token,
        {
            "hostname": "node-a",
            "operating_system": "Ubuntu 22.04",
            "kernel": "6.8.0",
            "cpu": "AMD EPYC",
            "numa": "0-1",
            "memory_gb": 2048,
            "gpus": [{"index": 0, "model": "NVIDIA H200", "memory_gb": 141, "pci_bus_id": "0000:01:00.0"}],
            "nics": [{"name": "mlx5_0", "kind": "InfiniBand", "link_state": "ACTIVE"}],
            "scheduler": {"kind": "slurm", "version": "24.05"},
            "kubernetes": {"version": None, "container_runtime": "containerd"},
            "storage_mounts": [{"name": "scratch", "mount_path": "/mnt/scratch", "kind": "lustre"}],
        },
    )
    assert inventory["node"].hostname == "node-a"
    assert inventory["gpus"][0].model == "NVIDIA H200"

    heartbeat = platform.record_heartbeat(agent.id, token, state="healthy", metrics={"gpu_utilization": 12})
    assert heartbeat.status == "healthy"

    job = platform.request_agent_execution(cluster_id, kind="validation", payload={"profile": "gpu-node-baseline"})
    claimed = platform.claim_next_execution(agent.id, token)
    assert claimed and claimed.id == job.id
    uploaded = platform.upload_execution_result(agent.id, token, claimed.id, status="completed", result={"finding_count": 0})
    assert uploaded.status == "completed"


def test_validation_persists_findings_evidence_score_and_audit(tmp_path: Path):
    platform = service(tmp_path)
    seeded = platform.seed_demo_fixture()
    cluster_id = seeded["clusters"][0]["id"]
    user = seeded["users"][0]

    run = platform.start_validation_run(cluster_id, "NCCL readiness", created_by=user["id"])
    finding = platform.add_validation_finding(
        run.id,
        category="NCCL",
        status=ValidationStatus.FAIL,
        severity="critical",
        expected="All all-reduce rows have valid bus bandwidth",
        observed="Average bus bandwidth dropped below baseline for 256MiB-1GiB rows",
        evidence=[EvidenceReference(kind="benchmark_result", target_id="run-current", label="NCCL all_reduce_perf")],
        remediation="Compare driver, NCCL, topology, and P2P evidence before scheduling workloads.",
        affected_resources=["node-a", "GPU0-GPU1"],
    )
    completed = platform.complete_validation_run(run.id)

    assert finding.status == ValidationStatus.FAIL
    assert completed.score < 100
    assert completed.critical_findings == 1
    assert platform.store.read()["audit_events"][-1]["action"] == "validation.complete"


def test_benchmark_history_comparison_and_regression_require_compatibility(tmp_path: Path):
    platform = service(tmp_path)
    seeded = platform.seed_demo_fixture()
    cluster_id = seeded["clusters"][0]["id"]

    baseline = platform.persist_benchmark_run(
        BenchmarkRun.fixture(
            cluster_id=cluster_id,
            benchmark_id="h200-baseline",
            package_version="0.1.0",
            gpu_model="NVIDIA H200",
            gpu_count=8,
            driver_version="550.54",
            cuda_version="12.4",
            nccl_version="2.21",
            metrics={"all_reduce:268435456:busbw": 820.0, "all_reduce:536870912:busbw": 830.0},
        )
    )
    current = platform.persist_benchmark_run(
        BenchmarkRun.fixture(
            cluster_id=cluster_id,
            benchmark_id="h200-current",
            package_version="0.1.0",
            gpu_model="NVIDIA H200",
            gpu_count=8,
            driver_version="550.54",
            cuda_version="12.4",
            nccl_version="2.21",
            metrics={"all_reduce:268435456:busbw": 700.0, "all_reduce:536870912:busbw": 760.0},
        )
    )

    comparison = platform.compare_benchmark_runs(baseline.id, current.id)
    assert comparison.compatible is True
    assert comparison.maximum_regression_percent < -8
    regressions = platform.detect_regressions(baseline.id, current.id, threshold_percent=5)
    assert regressions
    assert regressions[0].severity in {"warning", "high", "critical"}

    incompatible = platform.persist_benchmark_run(
        BenchmarkRun.fixture(
            cluster_id=cluster_id,
            benchmark_id="b200-current",
            package_version="0.1.0",
            gpu_model="NVIDIA B200",
            gpu_count=8,
            driver_version="555.1",
            cuda_version="12.5",
            nccl_version="2.22",
            metrics={"all_reduce:268435456:busbw": 900.0},
        )
    )
    comparison = platform.compare_benchmark_runs(baseline.id, incompatible.id)
    assert comparison.compatible is False
    assert "gpu_model" in comparison.compatibility_warnings[0]
    assert platform.detect_regressions(baseline.id, incompatible.id) == []


def test_topology_copilot_remediation_reports_academy_and_alerts(tmp_path: Path):
    platform = service(tmp_path)
    seeded = platform.seed_demo_fixture()
    org_id = seeded["organizations"][0]["id"]
    cluster_id = seeded["clusters"][0]["id"]
    user = seeded["users"][0]

    topology = platform.build_topology_graph(cluster_id)
    assert topology["nodes"]
    assert all(edge["source_type"] in {"observed", "inferred", "reported"} for edge in topology["edges"])

    answer = platform.ask_copilot(
        org_id,
        "Why did NCCL all-reduce bandwidth fall?",
        context_ids=["benchmark:h200-current", "comparison:latest"],
    )
    assert answer["summary"]
    assert answer["evidence_citations"]
    assert answer["confidence"] in {"low", "medium", "high"}

    plan = platform.create_remediation_plan(
        org_id,
        action="Drain node and run diagnostic validation",
        target="node-a",
        risk="high",
        evidence=[EvidenceReference(kind="regression", target_id="reg-1", label="bus bandwidth regression")],
    )
    assert plan.state == RemediationState.REVIEW_REQUIRED
    approval = platform.request_approval(plan.id, requested_by=user["id"], required_role="Administrator")
    assert approval.state == ApprovalState.REVIEW_REQUIRED
    with pytest.raises(AuthorizationError):
        platform.execute_remediation(plan.id)

    alert = platform.create_alert(org_id, "benchmark regression", severity="high", target="node-a")
    platform.acknowledge_alert(alert.id, user["id"], note="Investigating NCCL regression")
    report = platform.generate_report(org_id, "Regression Report", author="Sabion P Frazier")
    assert "Generated by Sabion P Frazier" in report.markdown
    assert report.json_payload["type"] == "Regression Report"

    course = platform.seed_academy_content(org_id)
    progress = platform.record_academy_progress(user["id"], course.lessons[0].id, status="completed")
    assert "Why did NCCL all-reduce bandwidth drop?" in course.labs[0].title
    assert progress.status == "completed"


def test_security_helpers_redact_secrets_and_reject_unsafe_archive_members():
    text = "token=abc123 password=hunter2 GPU-1234 internal host node01.local"
    redacted = sanitize_secret_text(text)
    assert "hunter2" not in redacted
    assert "abc123" not in redacted
    assert "node01.local" not in redacted

    assert safe_archive_member("evidence/nccl/all_reduce.txt") == "evidence/nccl/all_reduce.txt"
    for unsafe in ["../secret", "/tmp/secret", "evidence/../../secret", "evidence/\x00bad"]:
        with pytest.raises(ValueError):
            safe_archive_member(unsafe)
