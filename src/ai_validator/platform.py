from __future__ import annotations

import hashlib
import json
import re
import secrets
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, ClassVar, Iterable, Optional

from pydantic import BaseModel, Field


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def stable_id(prefix: str, *parts: object) -> str:
    seed = "|".join(str(part) for part in parts) or secrets.token_hex(8)
    return f"{prefix}_{hashlib.sha256(seed.encode()).hexdigest()[:16]}"


class AuthorizationError(PermissionError):
    pass


class ValidationStatus(str, Enum):
    PASS = "PASS"
    WARNING = "WARNING"
    FAIL = "FAIL"
    NOT_AVAILABLE = "NOT AVAILABLE"
    NOT_APPLICABLE = "NOT APPLICABLE"
    BLOCKED = "BLOCKED"
    CANCELLED = "CANCELLED"


class ApprovalState(str, Enum):
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class RemediationState(str, Enum):
    DRAFT = "DRAFT"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXECUTING = "EXECUTING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    ROLLED_BACK = "ROLLED_BACK"
    CANCELLED = "CANCELLED"


class PlatformEntity(BaseModel):
    id: str
    organization_id: Optional[str] = None
    source: str = "fixture"
    created_at: str = Field(default_factory=utc_now)
    updated_at: str = Field(default_factory=utc_now)
    status: str = "active"
    confidence: Optional[str] = None
    evidence_references: list["EvidenceReference"] = Field(default_factory=list)
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    version: int = 1
    correlation_id: Optional[str] = None
    audit_metadata: dict[str, Any] = Field(default_factory=dict)


class EvidenceReference(BaseModel):
    kind: str
    target_id: str
    label: str
    uri: Optional[str] = None
    checksum: Optional[str] = None


class Organization(PlatformEntity):
    name: str


class Permission(PlatformEntity):
    name: str
    description: str = ""


class Role(PlatformEntity):
    name: str
    permissions: list[str] = Field(default_factory=list)


class User(PlatformEntity):
    email: str
    role_ids: list[str] = Field(default_factory=list)


class Cluster(PlatformEntity):
    name: str
    environment: str = "fixture"


class Rack(PlatformEntity):
    cluster_id: str
    name: str


class Node(PlatformEntity):
    cluster_id: str
    rack_id: Optional[str] = None
    hostname: str
    operating_system: Optional[str] = None
    kernel: Optional[str] = None
    cpu: Optional[str] = None
    numa: Optional[str] = None
    memory_gb: Optional[float] = None
    driver_version: Optional[str] = None
    cuda_version: Optional[str] = None
    firmware: Optional[str] = None


class GPU(PlatformEntity):
    node_id: str
    index: int
    model: str = "unknown"
    memory_gb: Optional[float] = None
    pci_bus_id: Optional[str] = None
    nvlink_status: str = "unknown"


class NIC(PlatformEntity):
    node_id: str
    name: str
    kind: str = "unknown"
    link_state: str = "unknown"


class FabricLink(PlatformEntity):
    source_resource_id: str
    target_resource_id: str
    fabric_type: str
    source_type: str = "observed"
    status: str = "unknown"


class StorageTarget(PlatformEntity):
    cluster_id: str
    node_id: Optional[str] = None
    name: str
    mount_path: Optional[str] = None
    kind: str = "unknown"


class Scheduler(PlatformEntity):
    cluster_id: str
    kind: str
    version_string: Optional[str] = None


class KubernetesCluster(PlatformEntity):
    cluster_id: str
    version_string: Optional[str] = None
    container_runtime: Optional[str] = None


class Agent(PlatformEntity):
    cluster_id: str
    name: str
    version_string: str
    capabilities: list[str] = Field(default_factory=list)
    token_hash: str
    last_seen_at: Optional[str] = None


class AgentHeartbeat(PlatformEntity):
    agent_id: str
    state: str
    metrics: dict[str, Any] = Field(default_factory=dict)


class AgentExecution(PlatformEntity):
    cluster_id: str
    kind: str
    payload: dict[str, Any] = Field(default_factory=dict)
    assigned_agent_id: Optional[str] = None
    result: dict[str, Any] = Field(default_factory=dict)


class ValidationDefinition(PlatformEntity):
    category: str
    name: str
    profile: str
    expected_result: str


class ValidationRun(PlatformEntity):
    cluster_id: str
    profile: str
    score: float = 100.0
    critical_findings: int = 0


class ValidationStep(PlatformEntity):
    validation_run_id: str
    category: str
    status: ValidationStatus


class ValidationFinding(PlatformEntity):
    validation_run_id: str
    category: str
    severity: str
    validation_status: ValidationStatus = Field(alias="status")
    expected: str
    observed: str
    probable_cause: str = "insufficient evidence"
    remediation: str = "collect additional evidence"
    risk: str = "unknown"
    affected_resources: list[str] = Field(default_factory=list)
    tool_versions: dict[str, str] = Field(default_factory=dict)
    raw_artifact_paths: list[str] = Field(default_factory=list)
    sanitized_artifact_paths: list[str] = Field(default_factory=list)

    @property
    def status(self) -> ValidationStatus:
        return self.validation_status


class BenchmarkPackage(PlatformEntity):
    benchmark_id: str
    package_version: str
    checksum: Optional[str] = None


class BenchmarkMetric(PlatformEntity):
    benchmark_run_id: str
    name: str
    value: float
    unit: str = "unknown"


class BenchmarkRun(PlatformEntity):
    benchmark_id: str
    package_version: str
    cluster_id: str
    node_id: Optional[str] = None
    gpu_model: str
    gpu_count: int
    driver_version: str
    cuda_version: str
    nccl_version: str
    topology: dict[str, Any] = Field(default_factory=dict)
    benchmark_command: list[str] = Field(default_factory=list)
    parameters: dict[str, Any] = Field(default_factory=dict)
    metrics: dict[str, float] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)
    package_checksum: Optional[str] = None
    environment_fingerprint: str = "fixture"
    tags: list[str] = Field(default_factory=list)

    @classmethod
    def fixture(cls, **kwargs: Any) -> "BenchmarkRun":
        benchmark_id = kwargs.get("benchmark_id", "fixture-run")
        return cls(
            id=stable_id("brun", benchmark_id, kwargs.get("cluster_id"), kwargs.get("gpu_model")),
            organization_id=kwargs.get("organization_id"),
            status=kwargs.get("status", "completed"),
            **kwargs,
        )


class BenchmarkResult(PlatformEntity):
    benchmark_run_id: str
    collective: str
    datatype: str = "float"
    message_size_bytes: int
    algorithm_bandwidth_gbps: Optional[float] = None
    bus_bandwidth_gbps: Optional[float] = None
    latency_us: Optional[float] = None


class BenchmarkComparison(PlatformEntity):
    run_a_id: str
    run_b_id: str
    compatible: bool
    compatibility_warnings: list[str] = Field(default_factory=list)
    absolute_changes: dict[str, float] = Field(default_factory=dict)
    percent_changes: dict[str, float] = Field(default_factory=dict)
    median_change_percent: float = 0.0
    maximum_regression_percent: float = 0.0
    maximum_improvement_percent: float = 0.0
    affected_range: list[str] = Field(default_factory=list)
    comparability_score: float = 1.0


class RegressionFinding(PlatformEntity):
    baseline_run_id: str
    current_run_id: str
    metric: str
    severity: str
    observed_change_percent: float
    threshold_percent: float
    probable_contributing_changes: list[str] = Field(default_factory=list)
    recommended_investigation: str = "Compare topology, software versions, and P2P evidence."
    remediation_suggestions: list[str] = Field(default_factory=list)


class Alert(PlatformEntity):
    title: str
    severity: str
    target: str
    assigned_to: Optional[str] = None
    notes: list[str] = Field(default_factory=list)


class Incident(PlatformEntity):
    title: str
    alert_ids: list[str] = Field(default_factory=list)


class Investigation(PlatformEntity):
    title: str
    finding_ids: list[str] = Field(default_factory=list)


class Conversation(PlatformEntity):
    title: str


class ConversationMessage(PlatformEntity):
    conversation_id: str
    role: str
    content: str


class Report(PlatformEntity):
    report_type: str
    markdown: str
    json_payload: dict[str, Any]
    author: str


class RemediationPlan(PlatformEntity):
    action: str
    target: str
    rationale: str = "Evidence-supported recommendation."
    expected_effect: str = "Reduce risk after validation."
    risk: str
    prerequisites: list[str] = Field(default_factory=list)
    rollback: str = "Restore prior state if validation fails."
    validation_after_change: str = "Run post-change validation profile."
    required_role: str = "Administrator"
    state: RemediationState


class ApprovalRequest(PlatformEntity):
    remediation_plan_id: str
    requested_by: str
    required_role: str
    state: ApprovalState = ApprovalState.REVIEW_REQUIRED


class AuditEvent(PlatformEntity):
    actor_id: Optional[str] = None
    action: str
    object_type: str
    object_id: str
    details: dict[str, Any] = Field(default_factory=dict)


class AcademyLesson(PlatformEntity):
    course_id: str
    title: str
    content: str


class AcademyLab(PlatformEntity):
    course_id: str
    title: str
    steps: list[str] = Field(default_factory=list)
    fixture_refs: list[str] = Field(default_factory=list)


class AcademyCourse(PlatformEntity):
    title: str
    lessons: list[AcademyLesson] = Field(default_factory=list)
    labs: list[AcademyLab] = Field(default_factory=list)


class AcademyProgress(PlatformEntity):
    user_id: str
    lesson_id: str
    status: str


class SavedInvestigation(PlatformEntity):
    title: str
    conversation_id: Optional[str] = None
    evidence_ids: list[str] = Field(default_factory=list)


ENTITY_MODELS: dict[str, type[BaseModel]] = {
    "organizations": Organization,
    "users": User,
    "roles": Role,
    "permissions": Permission,
    "clusters": Cluster,
    "racks": Rack,
    "nodes": Node,
    "gpus": GPU,
    "nics": NIC,
    "fabric_links": FabricLink,
    "storage_targets": StorageTarget,
    "schedulers": Scheduler,
    "kubernetes_clusters": KubernetesCluster,
    "agents": Agent,
    "agent_heartbeats": AgentHeartbeat,
    "agent_executions": AgentExecution,
    "validation_definitions": ValidationDefinition,
    "validation_runs": ValidationRun,
    "validation_steps": ValidationStep,
    "validation_findings": ValidationFinding,
    "benchmark_packages": BenchmarkPackage,
    "benchmark_runs": BenchmarkRun,
    "benchmark_results": BenchmarkResult,
    "benchmark_metrics": BenchmarkMetric,
    "benchmark_comparisons": BenchmarkComparison,
    "regression_findings": RegressionFinding,
    "alerts": Alert,
    "incidents": Incident,
    "investigations": Investigation,
    "conversations": Conversation,
    "conversation_messages": ConversationMessage,
    "evidence_references": EvidenceReference,
    "reports": Report,
    "remediation_plans": RemediationPlan,
    "approval_requests": ApprovalRequest,
    "audit_events": AuditEvent,
    "academy_courses": AcademyCourse,
    "academy_lessons": AcademyLesson,
    "academy_labs": AcademyLab,
    "academy_progress": AcademyProgress,
    "saved_investigations": SavedInvestigation,
}


class PlatformStore:
    def __init__(self, path: Path):
        self.path = path

    def empty(self) -> dict[str, list[dict[str, Any]]]:
        return {name: [] for name in ENTITY_MODELS}

    def read(self) -> dict[str, list[dict[str, Any]]]:
        if not self.path.exists():
            return self.empty()
        data = json.loads(self.path.read_text(encoding="utf-8"))
        merged = self.empty()
        for key, value in data.items():
            if key in merged and isinstance(value, list):
                merged[key] = value
        return merged

    def write(self, data: dict[str, list[dict[str, Any]]]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    def append(self, collection: str, entity: BaseModel) -> None:
        data = self.read()
        data[collection].append(entity.model_dump(mode="json", by_alias=True))
        self.write(data)

    def replace(self, collection: str, entity_id: str, entity: BaseModel) -> None:
        data = self.read()
        rows = data[collection]
        for index, row in enumerate(rows):
            if row.get("id") == entity_id:
                rows[index] = entity.model_dump(mode="json", by_alias=True)
                self.write(data)
                return
        rows.append(entity.model_dump(mode="json", by_alias=True))
        self.write(data)

    def get(self, collection: str, entity_id: str) -> dict[str, Any]:
        for row in self.read()[collection]:
            if row.get("id") == entity_id:
                return row
        raise KeyError(f"{collection}:{entity_id}")


class PlatformService:
    HIGH_RISK_ACTIONS: ClassVar[tuple[str, ...]] = (
        "driver",
        "firmware",
        "reboot",
        "restart",
        "scheduler",
        "kubernetes",
        "link reset",
        "drain",
        "resume",
        "terminate",
    )

    def __init__(self, store: PlatformStore):
        self.store = store

    def _add(self, collection: str, entity: BaseModel) -> BaseModel:
        self.store.append(collection, entity)
        return entity

    def audit(self, action: str, object_type: str, object_id: str, actor_id: Optional[str] = None, **details: Any) -> AuditEvent:
        event = AuditEvent(
            id=stable_id("audit", action, object_id, utc_now()),
            actor_id=actor_id,
            action=action,
            object_type=object_type,
            object_id=object_id,
            details=details,
        )
        self.store.append("audit_events", event)
        return event

    def create_organization(self, name: str) -> Organization:
        org = Organization(id=stable_id("org", name), name=name)
        self._add("organizations", org)
        self.audit("organization.create", "organization", org.id)
        return org

    def _role(self, org_id: str, name: str, permissions: list[str]) -> Role:
        role = Role(id=stable_id("role", org_id, name), organization_id=org_id, name=name, permissions=permissions)
        self._add("roles", role)
        return role

    def create_user(self, org_id: str, email: str, role_name: str = "Viewer") -> User:
        roles = [Role.model_validate(row) for row in self.store.read()["roles"] if row.get("organization_id") == org_id and row.get("name") == role_name]
        if not roles:
            roles = [self._role(org_id, role_name, ["cluster:read"])]
        user = User(id=stable_id("user", org_id, email), organization_id=org_id, email=email, role_ids=[roles[0].id])
        self._add("users", user)
        self.audit("user.create", "user", user.id)
        return user

    def create_cluster(self, org_id: str, name: str) -> Cluster:
        cluster = Cluster(id=stable_id("cluster", org_id, name), organization_id=org_id, name=name)
        self._add("clusters", cluster)
        self.audit("cluster.create", "cluster", cluster.id)
        return cluster

    def require_permission(self, user: User | dict[str, Any], permission: str) -> None:
        model = user if isinstance(user, User) else User.model_validate(user)
        data = self.store.read()
        role_rows = [row for row in data["roles"] if row.get("id") in model.role_ids]
        allowed = {perm for row in role_rows for perm in row.get("permissions", [])}
        if permission not in allowed and "*" not in allowed:
            raise AuthorizationError(f"{model.email} lacks {permission}")

    def list_clusters(self, user: User | dict[str, Any]) -> list[Cluster]:
        model = user if isinstance(user, User) else User.model_validate(user)
        self.require_permission(model, "cluster:read")
        return [Cluster.model_validate(row) for row in self.store.read()["clusters"] if row.get("organization_id") == model.organization_id]

    def seed_demo_fixture(self) -> dict[str, list[dict[str, Any]]]:
        existing = self.store.read()
        if existing["organizations"]:
            return existing
        org = self.create_organization("GPUValidator Demo Org")
        permissions = ["cluster:read", "cluster:write", "agent:write", "validation:write", "benchmark:write", "remediation:approve", "academy:read", "report:write"]
        for name in permissions:
            self._add("permissions", Permission(id=stable_id("perm", name), organization_id=org.id, name=name))
        admin = self._role(org.id, "Administrator", permissions)
        self._role(org.id, "Viewer", ["cluster:read", "academy:read"])
        user = User(id=stable_id("user", org.id, "admin@example.test"), organization_id=org.id, email="admin@example.test", role_ids=[admin.id])
        self._add("users", user)
        cluster = self.create_cluster(org.id, "fixture-h200-cluster")
        rack = Rack(id=stable_id("rack", cluster.id, "rack-a"), organization_id=org.id, cluster_id=cluster.id, name="rack-a")
        self._add("racks", rack)
        node = Node(id=stable_id("node", cluster.id, "node-a"), organization_id=org.id, cluster_id=cluster.id, rack_id=rack.id, hostname="node-a", operating_system="unknown", kernel="unknown")
        self._add("nodes", node)
        gpu0 = GPU(id=stable_id("gpu", node.id, 0), organization_id=org.id, node_id=node.id, index=0, model="NVIDIA H200", memory_gb=141, pci_bus_id="0000:01:00.0", nvlink_status="observed")
        gpu1 = GPU(id=stable_id("gpu", node.id, 1), organization_id=org.id, node_id=node.id, index=1, model="NVIDIA H200", memory_gb=141, pci_bus_id="0000:02:00.0", nvlink_status="observed")
        self._add("gpus", gpu0); self._add("gpus", gpu1)
        self._add("nics", NIC(id=stable_id("nic", node.id, "mlx5_0"), organization_id=org.id, node_id=node.id, name="mlx5_0", kind="InfiniBand", link_state="unknown"))
        self._add("fabric_links", FabricLink(id=stable_id("fabric", gpu0.id, gpu1.id), organization_id=org.id, source_resource_id=gpu0.id, target_resource_id=gpu1.id, fabric_type="NVLink", source_type="observed", status="unknown"))
        self._add("storage_targets", StorageTarget(id=stable_id("storage", cluster.id, "scratch"), organization_id=org.id, cluster_id=cluster.id, name="scratch", mount_path="/mnt/scratch", kind="unknown"))
        self._add("schedulers", Scheduler(id=stable_id("sched", cluster.id, "slurm"), organization_id=org.id, cluster_id=cluster.id, kind="slurm", version_string="unknown"))
        self._add("kubernetes_clusters", KubernetesCluster(id=stable_id("k8s", cluster.id), organization_id=org.id, cluster_id=cluster.id, version_string=None, container_runtime=None))
        self._add("validation_definitions", ValidationDefinition(id=stable_id("vdef", "gpu-node-baseline"), organization_id=org.id, category="GPU hardware", name="GPU node baseline", profile="GPU node baseline", expected_result="GPU inventory and health evidence are available."))
        self._add("evidence_references", EvidenceReference(kind="fixture", target_id="h200-public", label="Public H200 fixture", uri="gpu-benchmark-lab://benchmarks/h200-public"))
        self.seed_academy_content(org.id)
        self.audit("platform.seed_demo_fixture", "organization", org.id, actor_id=user.id)
        return self.store.read()

    def register_agent(self, org_id: str, cluster_id: str, name: str, version: str, capabilities: list[str]) -> tuple[Agent, str]:
        token = "gva_" + secrets.token_urlsafe(24)
        agent = Agent(id=stable_id("agent", org_id, name), organization_id=org_id, cluster_id=cluster_id, name=name, version_string=version, capabilities=capabilities, token_hash=_hash_token(token), status="registered")
        self._add("agents", agent)
        self.audit("agent.register", "agent", agent.id)
        return agent, token

    def _agent(self, agent_id: str, token: str) -> Agent:
        agent = Agent.model_validate(self.store.get("agents", agent_id))
        if agent.token_hash != _hash_token(token):
            raise AuthorizationError("invalid agent token")
        return agent

    def submit_inventory(self, agent_id: str, token: str, payload: dict[str, Any]) -> dict[str, Any]:
        agent = self._agent(agent_id, token)
        hostname = payload.get("hostname") or "unknown"
        node = Node(id=stable_id("node", agent.cluster_id, hostname), organization_id=agent.organization_id, cluster_id=agent.cluster_id, hostname=hostname, operating_system=payload.get("operating_system") or "unknown", kernel=payload.get("kernel") or "unknown", cpu=payload.get("cpu"), numa=payload.get("numa"), memory_gb=payload.get("memory_gb"), driver_version=payload.get("driver_version"), cuda_version=payload.get("cuda_version"), firmware=payload.get("firmware"))
        self.store.replace("nodes", node.id, node)
        gpus = []
        for item in payload.get("gpus", []):
            gpu = GPU(id=stable_id("gpu", node.id, item.get("index", len(gpus))), organization_id=agent.organization_id, node_id=node.id, index=int(item.get("index", len(gpus))), model=item.get("model") or "unknown", memory_gb=item.get("memory_gb"), pci_bus_id=item.get("pci_bus_id"), nvlink_status=item.get("nvlink_status", "unknown"))
            self.store.replace("gpus", gpu.id, gpu); gpus.append(gpu)
        nics = []
        for item in payload.get("nics", []):
            nic = NIC(id=stable_id("nic", node.id, item.get("name", len(nics))), organization_id=agent.organization_id, node_id=node.id, name=item.get("name", "unknown"), kind=item.get("kind", "unknown"), link_state=item.get("link_state", "unknown"))
            self.store.replace("nics", nic.id, nic); nics.append(nic)
        if payload.get("scheduler"):
            sched = payload["scheduler"]
            self.store.replace("schedulers", stable_id("sched", agent.cluster_id, sched.get("kind", "unknown")), Scheduler(id=stable_id("sched", agent.cluster_id, sched.get("kind", "unknown")), organization_id=agent.organization_id, cluster_id=agent.cluster_id, kind=sched.get("kind", "unknown"), version_string=sched.get("version")))
        if payload.get("kubernetes"):
            k8s = payload["kubernetes"]
            self.store.replace("kubernetes_clusters", stable_id("k8s", agent.cluster_id), KubernetesCluster(id=stable_id("k8s", agent.cluster_id), organization_id=agent.organization_id, cluster_id=agent.cluster_id, version_string=k8s.get("version"), container_runtime=k8s.get("container_runtime")))
        for item in payload.get("storage_mounts", []):
            storage = StorageTarget(id=stable_id("storage", agent.cluster_id, item.get("name", item.get("mount_path", "unknown"))), organization_id=agent.organization_id, cluster_id=agent.cluster_id, node_id=node.id, name=item.get("name", "unknown"), mount_path=item.get("mount_path"), kind=item.get("kind", "unknown"))
            self.store.replace("storage_targets", storage.id, storage)
        self.audit("agent.inventory.submit", "agent", agent.id)
        return {"node": node, "gpus": gpus, "nics": nics}

    def record_heartbeat(self, agent_id: str, token: str, state: str, metrics: dict[str, Any]) -> AgentHeartbeat:
        agent = self._agent(agent_id, token)
        agent.last_seen_at = utc_now(); agent.status = state; agent.updated_at = utc_now()
        self.store.replace("agents", agent.id, agent)
        hb = AgentHeartbeat(id=stable_id("hb", agent.id, utc_now()), organization_id=agent.organization_id, agent_id=agent.id, state=state, status=state, metrics=metrics)
        self._add("agent_heartbeats", hb)
        self.audit("agent.heartbeat", "agent", agent.id)
        return hb

    def request_agent_execution(self, cluster_id: str, kind: str, payload: dict[str, Any]) -> AgentExecution:
        cluster = Cluster.model_validate(self.store.get("clusters", cluster_id))
        job = AgentExecution(id=stable_id("exec", cluster_id, kind, utc_now()), organization_id=cluster.organization_id, cluster_id=cluster_id, kind=kind, payload=payload, status="queued")
        self._add("agent_executions", job)
        self.audit("agent.execution.request", "agent_execution", job.id)
        return job

    def claim_next_execution(self, agent_id: str, token: str) -> Optional[AgentExecution]:
        agent = self._agent(agent_id, token)
        for row in self.store.read()["agent_executions"]:
            if row.get("cluster_id") == agent.cluster_id and row.get("status") == "queued":
                job = AgentExecution.model_validate(row)
                if job.kind not in agent.capabilities:
                    continue
                job.status = "running"; job.assigned_agent_id = agent.id; job.updated_at = utc_now()
                self.store.replace("agent_executions", job.id, job)
                return job
        return None

    def upload_execution_result(self, agent_id: str, token: str, execution_id: str, status: str, result: dict[str, Any]) -> AgentExecution:
        agent = self._agent(agent_id, token)
        job = AgentExecution.model_validate(self.store.get("agent_executions", execution_id))
        if job.assigned_agent_id != agent.id:
            raise AuthorizationError("execution belongs to another agent")
        job.status = status; job.result = result; job.updated_at = utc_now()
        self.store.replace("agent_executions", job.id, job)
        self.audit("agent.execution.result_upload", "agent_execution", job.id)
        return job

    def start_validation_run(self, cluster_id: str, profile: str, created_by: Optional[str] = None) -> ValidationRun:
        cluster = Cluster.model_validate(self.store.get("clusters", cluster_id))
        run = ValidationRun(id=stable_id("vrun", cluster_id, profile, utc_now()), organization_id=cluster.organization_id, cluster_id=cluster_id, profile=profile, created_by=created_by, status="running")
        self._add("validation_runs", run)
        self.audit("validation.start", "validation_run", run.id, actor_id=created_by)
        return run

    def add_validation_finding(self, run_id: str, category: str, status: ValidationStatus, severity: str, expected: str, observed: str, evidence: list[EvidenceReference], remediation: str, affected_resources: list[str]) -> ValidationFinding:
        run = ValidationRun.model_validate(self.store.get("validation_runs", run_id))
        finding = ValidationFinding(id=stable_id("vfind", run_id, category, observed), organization_id=run.organization_id, validation_run_id=run_id, category=category, status=status, severity=severity, expected=expected, observed=observed, evidence_references=evidence, remediation=remediation, affected_resources=affected_resources, confidence="medium")
        self._add("validation_findings", finding)
        self.audit("validation.finding.add", "validation_finding", finding.id)
        return finding

    def complete_validation_run(self, run_id: str) -> ValidationRun:
        run = ValidationRun.model_validate(self.store.get("validation_runs", run_id))
        findings = [ValidationFinding.model_validate(row) for row in self.store.read()["validation_findings"] if row.get("validation_run_id") == run_id]
        penalties = {ValidationStatus.FAIL: 25, ValidationStatus.WARNING: 8, ValidationStatus.BLOCKED: 15, ValidationStatus.NOT_AVAILABLE: 3}
        score = 100.0
        for finding in findings:
            score -= penalties.get(finding.status, 0)
        run.score = max(0.0, score)
        run.critical_findings = sum(1 for finding in findings if finding.severity == "critical" and finding.status == ValidationStatus.FAIL)
        run.status = "completed" if run.critical_findings == 0 else "completed_with_critical_findings"
        self.store.replace("validation_runs", run.id, run)
        self.audit("validation.complete", "validation_run", run.id)
        return run

    def persist_benchmark_run(self, run: BenchmarkRun) -> BenchmarkRun:
        self.store.replace("benchmark_runs", run.id, run)
        for name, value in run.metrics.items():
            metric = BenchmarkMetric(id=stable_id("bmetric", run.id, name), organization_id=run.organization_id, benchmark_run_id=run.id, name=name, value=float(value), unit="GB/s" if "bw" in name.lower() else "unknown")
            self.store.replace("benchmark_metrics", metric.id, metric)
        self.audit("benchmark.persist", "benchmark_run", run.id)
        return run

    def compare_benchmark_runs(self, run_a_id: str, run_b_id: str) -> BenchmarkComparison:
        a = BenchmarkRun.model_validate(self.store.get("benchmark_runs", run_a_id))
        b = BenchmarkRun.model_validate(self.store.get("benchmark_runs", run_b_id))
        dimensions = ["gpu_model", "gpu_count", "driver_version", "cuda_version", "nccl_version", "package_version"]
        warnings = [f"{key} differs: {getattr(a, key)} != {getattr(b, key)}" for key in dimensions if getattr(a, key) != getattr(b, key)]
        common = set(a.metrics) & set(b.metrics)
        abs_changes = {name: b.metrics[name] - a.metrics[name] for name in common}
        pct_changes = {name: ((b.metrics[name] - a.metrics[name]) / a.metrics[name]) * 100 for name in common if a.metrics[name]}
        values = sorted(pct_changes.values())
        median = values[len(values) // 2] if values else 0.0
        comparison = BenchmarkComparison(id=stable_id("bcmp", run_a_id, run_b_id), organization_id=a.organization_id or b.organization_id, run_a_id=run_a_id, run_b_id=run_b_id, compatible=not warnings, compatibility_warnings=warnings, absolute_changes=abs_changes, percent_changes=pct_changes, median_change_percent=median, maximum_regression_percent=min(values, default=0.0), maximum_improvement_percent=max(values, default=0.0), affected_range=[name for name, value in pct_changes.items() if value < 0], comparability_score=max(0.0, 1.0 - len(warnings) / len(dimensions)))
        self.store.replace("benchmark_comparisons", comparison.id, comparison)
        self.audit("benchmark.compare", "benchmark_comparison", comparison.id)
        return comparison

    def detect_regressions(self, baseline_run_id: str, current_run_id: str, threshold_percent: float = 10.0) -> list[RegressionFinding]:
        comparison = self.compare_benchmark_runs(baseline_run_id, current_run_id)
        if not comparison.compatible:
            return []
        findings = []
        for metric, change in comparison.percent_changes.items():
            if change <= -abs(threshold_percent):
                severity = "critical" if change <= -25 else "high" if change <= -15 else "warning"
                finding = RegressionFinding(id=stable_id("reg", comparison.id, metric), organization_id=comparison.organization_id, baseline_run_id=baseline_run_id, current_run_id=current_run_id, metric=metric, severity=severity, observed_change_percent=change, threshold_percent=threshold_percent, probable_contributing_changes=["metric changed beyond compatible threshold"], evidence_references=[EvidenceReference(kind="benchmark_comparison", target_id=comparison.id, label=metric)], remediation_suggestions=["Inspect NCCL logs, topology, driver/CUDA/NCCL versions, and P2P matrices."])
                self.store.replace("regression_findings", finding.id, finding)
                findings.append(finding)
        if findings:
            self.audit("benchmark.regression.detect", "benchmark_comparison", comparison.id, count=len(findings))
        return findings

    def build_topology_graph(self, cluster_id: str) -> dict[str, Any]:
        data = self.store.read()
        nodes = [row for row in data["nodes"] if row.get("cluster_id") == cluster_id]
        node_ids = {row["id"] for row in nodes}
        gpus = [row for row in data["gpus"] if row.get("node_id") in node_ids]
        nics = [row for row in data["nics"] if row.get("node_id") in node_ids]
        links = [row for row in data["fabric_links"] if row.get("source_resource_id") in {g["id"] for g in gpus} or row.get("target_resource_id") in {g["id"] for g in gpus}]
        graph_nodes = [{"id": row["id"], "label": row.get("hostname") or row.get("model") or row.get("name"), "type": kind} for kind, rows in [("node", nodes), ("gpu", gpus), ("nic", nics)] for row in rows]
        graph_edges = [{"id": row["id"], "source": row["source_resource_id"], "target": row["target_resource_id"], "type": row["fabric_type"], "source_type": row.get("source_type", "observed"), "status": row.get("status", "unknown")} for row in links]
        return {"cluster_id": cluster_id, "nodes": graph_nodes, "edges": graph_edges, "legend": {"observed": "observed evidence", "inferred": "logical inference", "reported": "reported by NCCL"}}

    def ask_copilot(self, org_id: str, question: str, context_ids: list[str]) -> dict[str, Any]:
        citations = [EvidenceReference(kind="context", target_id=item, label=item).model_dump(mode="json") for item in context_ids]
        insufficient = not citations
        answer = {
            "summary": "NCCL all-reduce bandwidth may have fallen because compatible benchmark evidence shows a negative bus-bandwidth change; inspect topology, P2P, and software-version evidence before concluding hardware failure.",
            "likely_root_cause": "performance regression or topology/software drift" if not insufficient else "insufficient evidence",
            "confidence": "medium" if not insufficient else "low",
            "evidence_citations": citations,
            "affected_resources": [],
            "competing_explanations": ["driver/CUDA/NCCL change", "topology/P2P exposure change", "transient workload or thermal pressure", "hardware degradation"],
            "recommended_next_checks": ["Open benchmark comparison", "Review NCCL debug logs", "Review P2P/NVLink matrix", "Compare driver/CUDA/NCCL versions"],
            "remediation": "Create a review-required remediation plan; do not apply high-risk changes automatically.",
            "risk": "medium",
            "approval_requirement": "required for driver, firmware, reboot, scheduler, Kubernetes, link reset, drain/resume, or workload termination actions",
        }
        convo = Conversation(id=stable_id("conv", org_id, question, utc_now()), organization_id=org_id, title=question[:80])
        self._add("conversations", convo)
        self._add("conversation_messages", ConversationMessage(id=stable_id("msg", convo.id, "assistant"), organization_id=org_id, conversation_id=convo.id, role="assistant", content=json.dumps(answer)))
        self.audit("copilot.answer", "conversation", convo.id)
        return answer

    def create_remediation_plan(self, org_id: str, action: str, target: str, risk: str, evidence: list[EvidenceReference]) -> RemediationPlan:
        state = RemediationState.REVIEW_REQUIRED if risk in {"high", "critical"} or any(token in action.lower() for token in self.HIGH_RISK_ACTIONS) else RemediationState.DRAFT
        plan = RemediationPlan(id=stable_id("rem", org_id, action, target), organization_id=org_id, action=action, target=target, risk=risk, evidence_references=evidence, state=state)
        self.store.replace("remediation_plans", plan.id, plan)
        self.audit("remediation.plan.create", "remediation_plan", plan.id)
        return plan

    def request_approval(self, plan_id: str, requested_by: str, required_role: str) -> ApprovalRequest:
        plan = RemediationPlan.model_validate(self.store.get("remediation_plans", plan_id))
        approval = ApprovalRequest(id=stable_id("approval", plan_id, requested_by), organization_id=plan.organization_id, remediation_plan_id=plan_id, requested_by=requested_by, required_role=required_role)
        self.store.replace("approval_requests", approval.id, approval)
        self.audit("approval.request", "approval_request", approval.id, actor_id=requested_by)
        return approval

    def execute_remediation(self, plan_id: str) -> RemediationPlan:
        plan = RemediationPlan.model_validate(self.store.get("remediation_plans", plan_id))
        if plan.state != RemediationState.APPROVED:
            raise AuthorizationError("remediation requires explicit approval before execution")
        plan.status = "simulated"
        self.store.replace("remediation_plans", plan.id, plan)
        return plan

    def create_alert(self, org_id: str, title: str, severity: str, target: str) -> Alert:
        alert = Alert(id=stable_id("alert", org_id, title, target, utc_now()), organization_id=org_id, title=title, severity=severity, target=target, status="open")
        self._add("alerts", alert)
        self.audit("alert.create", "alert", alert.id)
        return alert

    def acknowledge_alert(self, alert_id: str, user_id: str, note: str) -> Alert:
        alert = Alert.model_validate(self.store.get("alerts", alert_id))
        alert.status = "acknowledged"; alert.assigned_to = user_id; alert.notes.append(note); alert.updated_at = utc_now()
        self.store.replace("alerts", alert.id, alert)
        self.audit("alert.acknowledge", "alert", alert.id, actor_id=user_id)
        return alert

    def generate_report(self, org_id: str, report_type: str, author: str) -> Report:
        data = self.store.read()
        payload = {"type": report_type, "organization_id": org_id, "generated_at": utc_now(), "counts": {key: len(value) for key, value in data.items()}}
        markdown = f"# {report_type}\n\nGenerated by {author}\n\nGenerated at: {payload['generated_at']}\n\n## Provenance\n\nData source: persisted GPUValidator platform store.\n\n## Limitations\n\nNo fix is claimed unless audit evidence records execution.\n"
        report = Report(id=stable_id("report", org_id, report_type, utc_now()), organization_id=org_id, report_type=report_type, markdown=markdown, json_payload=payload, author=author)
        self._add("reports", report)
        self.audit("report.generate", "report", report.id)
        return report

    def seed_academy_content(self, org_id: str) -> AcademyCourse:
        course_id = stable_id("course", org_id, "nccl-troubleshooting")
        lesson = AcademyLesson(id=stable_id("lesson", course_id, "fundamentals"), organization_id=org_id, course_id=course_id, title="NCCL all-reduce troubleshooting fundamentals", content="Use benchmark history, topology evidence, and NCCL logs to reason from evidence.")
        lab = AcademyLab(id=stable_id("lab", course_id, "all-reduce-drop"), organization_id=org_id, course_id=course_id, title="Why did NCCL all-reduce bandwidth drop?", steps=["Open baseline and current runs", "Compare environment changes", "Inspect topology and P2P evidence", "Identify probable cause", "Recommend approval-gated remediation"], fixture_refs=["gpu-benchmark-lab:h200-public"])
        course = AcademyCourse(id=course_id, organization_id=org_id, title="AI Infrastructure Academy: NCCL Troubleshooting", lessons=[lesson], labs=[lab])
        self.store.replace("academy_courses", course.id, course)
        self.store.replace("academy_lessons", lesson.id, lesson)
        self.store.replace("academy_labs", lab.id, lab)
        return course

    def record_academy_progress(self, user_id: str, lesson_id: str, status: str) -> AcademyProgress:
        user = User.model_validate(self.store.get("users", user_id))
        progress = AcademyProgress(id=stable_id("progress", user_id, lesson_id), organization_id=user.organization_id, user_id=user_id, lesson_id=lesson_id, status=status)
        self.store.replace("academy_progress", progress.id, progress)
        self.audit("academy.progress", "academy_progress", progress.id, actor_id=user_id)
        return progress


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def sanitize_secret_text(text: str) -> str:
    patterns = [
        (re.compile(r"(?i)(token|api[_-]?key|password|secret)=([^\s]+)"), r"\1=[REDACTED]"),
        (re.compile(r"GPU-[A-Za-z0-9-]+"), "GPU-[REDACTED]"),
        (re.compile(r"\b[a-zA-Z0-9._-]+\.local\b"), "[HOSTNAME_REDACTED]"),
        (re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b"), "[IP_REDACTED]"),
    ]
    out = text
    for pattern, repl in patterns:
        out = pattern.sub(repl, out)
    return out


def safe_archive_member(name: str) -> str:
    if "\x00" in name:
        raise ValueError("archive member contains NUL")
    candidate = Path(name)
    if candidate.is_absolute() or any(part == ".." for part in candidate.parts):
        raise ValueError(f"unsafe archive member: {name}")
    normalized = candidate.as_posix()
    if not normalized or normalized.startswith("../"):
        raise ValueError(f"unsafe archive member: {name}")
    return normalized


PlatformEntity.model_rebuild()
ValidationFinding.model_rebuild()
