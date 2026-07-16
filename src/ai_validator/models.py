from datetime import datetime
from enum import Enum
from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field

class StatusEnum(str, Enum):
    PASS = "pass"
    WARNING = "warning"
    FAIL = "fail"
    SKIPPED = "skipped"
    UNAVAILABLE = "unavailable"
    UNKNOWN = "unknown"

class SeverityEnum(str, Enum):
    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class CommandEvidence(BaseModel):
    command: List[str] = Field(..., description="The command representing an argument list")
    exit_code: int = Field(..., description="Exit status code of the command")
    duration_seconds: float = Field(..., description="Duration of the command in seconds")
    stdout: str = Field("", description="Standard output captured from the execution")
    stderr: str = Field("", description="Standard error captured from the execution")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Time of execution")

class ValidationCheck(BaseModel):
    id: str = Field(..., description="Unique validation check identifier, e.g., gpu.ecc.uncorrectable")
    category: str = Field(..., description="The category name of the check, e.g., gpu")
    title: str = Field(..., description="A friendly human-readable title for the validation")
    status: StatusEnum = Field(..., description="Outcome of the check")
    severity: SeverityEnum = Field(..., description="Impact severity if validation fails or warns")
    summary: str = Field(..., description="A concise summary of the check result")
    evidence: List[CommandEvidence] = Field(default_factory=list, description="Associated command execution details")
    recommendation: Optional[str] = Field(None, description="Clear remediation advice if not passed")
    node: str = Field(..., description="The name of the node where this check ran")

class ValidationCategory(BaseModel):
    id: str = Field(..., description="Category id, e.g., gpu, linux, infiniband")
    name: str = Field(..., description="Friendly human-readable category name")
    weight: float = Field(..., description="The scoring weight assigned to this category")
    max_score: float = Field(100.0, description="The maximum score of the category")
    score: float = Field(0.0, description="The calculated score of the category based on checks")
    checks: List[ValidationCheck] = Field(default_factory=list, description="Checks belonging to this category")

class BenchmarkResult(BaseModel):
    benchmark_type: str = Field(..., description="Type of benchmark, e.g., NCCL, HPL, FIO, iperf3, OSU")
    file_path: Optional[str] = Field(None, description="Source log file path parsed")
    parsed_at: datetime = Field(default_factory=datetime.utcnow, description="Time parsed")
    metrics: Dict[str, Any] = Field(default_factory=dict, description="Key metrics parsed, e.g., bandwidth, GFLOPS, IOPS")
    raw_snippet: str = Field("", description="Snippet of raw log output containing result")
    status: StatusEnum = Field(StatusEnum.PASS, description="Pass/Fail status based on thresholds")

class Node(BaseModel):
    name: str = Field(..., description="Hostname of the compute node")
    ip_address: Optional[str] = Field(None, description="Node primary IP address")
    status: StatusEnum = Field(StatusEnum.UNKNOWN, description="Aggregated node readiness status")
    categories: Dict[str, ValidationCategory] = Field(default_factory=dict, description="Category-level check aggregates")

class Cluster(BaseModel):
    name: str = Field(..., description="The cluster name, e.g., nvis-interview-demo")
    nodes: List[Node] = Field(default_factory=list, description="List of nodes in the cluster")
    overall_score: float = Field(0.0, description="The overall weighted and normalized readiness score (0-100)")
    classification: str = Field("Not ready", description="Readiness classification: Ready, Ready with warnings, Remediation required, Not ready")
    recommendations: List[str] = Field(default_factory=list, description="Consolidated, de-duplicated remediation list")
    benchmark_results: List[BenchmarkResult] = Field(default_factory=list, description="Ingested benchmark results")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional context info")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Report generation timestamp")
    tool_version: str = Field("0.1.0", description="Validator version")
