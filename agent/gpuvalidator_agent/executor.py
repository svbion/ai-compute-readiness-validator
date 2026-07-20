from __future__ import annotations

import subprocess
import time
from datetime import datetime, timezone
from typing import Callable

from .commands import CommandDefinition, command_for, UnsupportedCommand
from .models import ExecutionResult
from .parsers import parse_result

def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

def sanitize(text: str) -> str:
    import re
    return re.sub(r"Authorization:\s*Bearer\s+\S+", "Authorization: Bearer ***", text).replace("GPUVALIDATOR_AGENT_TOKEN=", "GPUVALIDATOR_AGENT_TOKEN=[redacted]")

def truncate(text: str, limit: int) -> tuple[str, bool]:
    safe=sanitize(text or "")
    return safe[:limit], len(safe) > limit

class CommandExecutor:
    def __init__(self, runner: Callable | None = None):
        self.runner = runner or self._subprocess_runner
    def _subprocess_runner(self, argv: list[str], timeout: int):
        return subprocess.run(argv, capture_output=True, text=True, timeout=timeout, shell=False)
    def execute(self, definition: CommandDefinition) -> ExecutionResult:
        started=iso_now(); start=time.monotonic()
        try:
            completed = self.runner(definition.argv, timeout=definition.timeout_seconds)
            raw_stdout = getattr(completed, "stdout", "") or ""
            raw_stderr = getattr(completed, "stderr", "") or ""
            exit_code = int(getattr(completed, "returncode", 1))
            state = "completed" if exit_code == 0 else "failed"
        except FileNotFoundError as exc:
            raw_stdout=""; raw_stderr=str(exc); exit_code=None; state="unavailable"
        except subprocess.TimeoutExpired as exc:
            raw_stdout=exc.stdout or ""; raw_stderr=exc.stderr or "Command timed out"; exit_code=None; state="timed_out"
        except TimeoutError as exc:
            raw_stdout=""; raw_stderr=str(exc); exit_code=None; state="timed_out"
        except Exception as exc:
            raw_stdout=""; raw_stderr=str(exc); exit_code=None; state="failed"
        finished=iso_now(); duration=int((time.monotonic()-start)*1000)
        stdout, st = truncate(str(raw_stdout), definition.max_stdout_bytes)
        stderr, et = truncate(str(raw_stderr), definition.max_stderr_bytes)
        structured, warnings = parse_result(definition.type, stdout, stderr, state)
        return ExecutionResult(command_type=definition.type, argv=definition.argv, state=state, exit_code=exit_code, stdout=stdout, stderr=stderr, output_truncated=st or et, started_at=started, completed_at=finished, duration_ms=duration, structured_result=structured, parser_warnings=warnings)

def execute_job(job: dict, executor: CommandExecutor | None = None) -> ExecutionResult:
    command_type=str(job.get("command_type") or job.get("command", {}).get("type") or "")
    definition=command_for(command_type, job.get("command") or {})
    return (executor or CommandExecutor()).execute(definition)
