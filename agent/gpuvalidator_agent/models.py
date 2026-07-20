from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

ResultState = Literal["completed", "failed", "timed_out", "unavailable"]

@dataclass
class Capability:
    name: str
    available: bool
    version: str | None = None
    details: dict[str, Any] = field(default_factory=dict)
    def to_dict(self) -> dict[str, Any]:
        data = {"name": self.name, "available": self.available, "version": self.version}
        if self.details:
            data["details"] = self.details
        return data

@dataclass
class CapabilitySnapshot:
    hostname: str
    operating_system: str
    agent_version: str
    gpu_count: int | None
    capabilities: list[Capability]
    gpu_models: list[str] = field(default_factory=list)
    last_error: str | None = None

@dataclass
class ExecutionResult:
    command_type: str
    argv: list[str]
    state: ResultState
    exit_code: int | None
    stdout: str
    stderr: str
    output_truncated: bool
    started_at: str
    completed_at: str
    duration_ms: int
    structured_result: dict[str, Any]
    parser_warnings: list[str] = field(default_factory=list)
    def to_payload(self, agent_id: str) -> dict[str, Any]:
        structured = dict(self.structured_result)
        if self.parser_warnings:
            structured["parser_warnings"] = self.parser_warnings
        return {"agent_id": agent_id, "state": self.state, "exit_code": self.exit_code, "started_at": self.started_at, "completed_at": self.completed_at, "duration_ms": self.duration_ms, "structured_result": structured, "stdout": self.stdout, "stderr": self.stderr, "output_truncated": self.output_truncated}
