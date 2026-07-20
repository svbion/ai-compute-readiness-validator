from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field

MANIFEST_SCHEMA_VERSION = "1.0.0"
COLLECTOR_VERSION = "ai-validator 0.1.0"
CHECKSUM_ALGORITHM = "sha256"


class CommandStatus(str, Enum):
    COLLECTED = "collected"
    MISSING = "missing"
    DENIED = "denied"
    TIMEOUT = "timeout"
    FAILED = "failed"
    SKIPPED = "skipped"


class CollectionMode(str, Enum):
    LOCAL = "local"
    DRY_RUN = "dry-run"


class CommandSpec(BaseModel):
    id: str = Field(..., description="Stable command identifier")
    category: Literal["linux", "gpu"] = Field(..., description="Evidence category")
    argv: list[str] = Field(..., min_length=1, description="Allowlisted argv list")
    stdout_path: str = Field(..., description="Deterministic relative stdout path")
    stderr_path: str = Field(..., description="Deterministic relative stderr path")
    optional: bool = Field(True, description="Whether absence/failure is non-blocking")
    diagnostics: bool = Field(False, description="Whether this command is an explicit diagnostics opt-in")
    description: str = Field("", description="Human-readable description")


class CommandResult(BaseModel):
    command_id: str
    category: str
    argv: list[str]
    started_at: datetime | None = None
    finished_at: datetime | None = None
    duration_ms: int
    exit_code: int | None = None
    status: CommandStatus
    stdout_file: str | None = None
    stderr_file: str | None = None
    error_summary: str | None = None
    hostname: str
    collector_version: str = COLLECTOR_VERSION


class EvidenceFile(BaseModel):
    path: str
    category: str
    command_id: str | None = None
    bytes: int
    sha256: str


class CollectionSummary(BaseModel):
    profile: str
    output_path: str
    command_count: int
    collected_count: int
    missing_count: int
    failed_count: int
    skipped_count: int
    warning_count: int


class CollectionManifest(BaseModel):
    schema_version: str = MANIFEST_SCHEMA_VERSION
    collector_version: str = COLLECTOR_VERSION
    profile: str
    collection_mode: CollectionMode = CollectionMode.LOCAL
    started_at: datetime
    finished_at: datetime
    source_hostname: str
    sanitized: bool
    command_count: int
    collected_count: int
    missing_count: int
    failed_count: int
    skipped_count: int
    categories: list[str]
    checksum_algorithm: str = CHECKSUM_ALGORITHM
    files: list[EvidenceFile]
    warnings: list[str] = Field(default_factory=list)
