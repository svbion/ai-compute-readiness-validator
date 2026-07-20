from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

SECRET_PATTERNS = [
    (re.compile(r"Authorization:\s*Bearer\s+\S+", re.I), "Authorization: Bearer [redacted]"),
    (re.compile(r"token=\S+", re.I), "token=[redacted]"),
]
ANSI_RE = re.compile(r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def redact_log(text: str, limit: int = 16384) -> str:
    redacted = ANSI_RE.sub("", text)
    for pattern, replacement in SECRET_PATTERNS:
        redacted = pattern.sub(replacement, redacted)
    return redacted[:limit]


@dataclass
class NcclTestsAdapter:
    executable_path: str
    uses_shell: bool = False

    allowed_operations = {"all_reduce_perf", "all_gather_perf", "reduce_scatter_perf", "broadcast_perf"}
    allowed_sizes = {"1M", "8M", "16M", "64M", "128M", "1G", "8G"}
    allowed_dtypes = {"half", "float", "double", "int"}

    def validate_capabilities(self, capabilities: dict[str, Any]) -> None:
        if not capabilities.get("nccl_tests_available", False):
            raise ValueError("NCCL Tests are not available on this runner")
        gpu_count = int(capabilities.get("gpu_count") or 0)
        if gpu_count < 1:
            raise ValueError("At least one GPU is required")

    def validate_parameters(self, params: dict[str, Any]) -> None:
        allowed_keys = {"minimum_bytes", "maximum_bytes", "size_factor", "gpu_count", "warmup_iterations", "iterations", "data_type", "operation"}
        extra = set(params) - allowed_keys
        if extra:
            raise ValueError(f"Unsupported parameters: {sorted(extra)}")
        for key in ["minimum_bytes", "maximum_bytes"]:
            value = str(params.get(key, ""))
            if value not in self.allowed_sizes or any(ch in value for ch in ";&|`$<>/\\\n\r"):
                raise ValueError(f"Unsafe or unsupported {key}")
        operation = str(params.get("operation", ""))
        if operation not in self.allowed_operations:
            raise ValueError("Unsupported NCCL operation")
        if Path(self.executable_path).name != operation:
            raise ValueError("Executable does not match operation")
        if str(params.get("data_type", "float")) not in self.allowed_dtypes:
            raise ValueError("Unsupported data type")
        for key, minimum, maximum in [("size_factor", 2, 4), ("gpu_count", 1, 16), ("warmup_iterations", 1, 20), ("iterations", 1, 1000)]:
            value = params.get(key)
            if not isinstance(value, int) or value < minimum or value > maximum:
                raise ValueError(f"{key} is outside allowed bounds")

    def build_argv(self, params: dict[str, Any]) -> list[str]:
        self.validate_parameters(params)
        return [
            self.executable_path,
            "-b", str(params["minimum_bytes"]),
            "-e", str(params["maximum_bytes"]),
            "-f", str(params["size_factor"]),
            "-g", str(params["gpu_count"]),
            "-w", str(params["warmup_iterations"]),
            "-n", str(params["iterations"]),
        ]

    def build_environment(self) -> dict[str, str]:
        return {"PATH": "/usr/local/cuda/bin:/usr/bin:/bin", "LC_ALL": "C"}

    def prepare_workspace(self, root: Path) -> Path:
        workspace = root / "workspace"
        workspace.mkdir(parents=True, exist_ok=True)
        return workspace

    def collect_outputs(self, stdout: bytes, stderr: bytes) -> dict[str, Any]:
        return {"stdout": redact_log(stdout.decode("utf-8", "replace")), "stderr": redact_log(stderr.decode("utf-8", "replace")), "sha256": sha256_bytes(stdout + stderr)}
