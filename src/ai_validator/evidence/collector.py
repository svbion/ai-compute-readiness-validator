from __future__ import annotations

import hashlib
import json
import os
import socket
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

from ai_validator.evidence.models import (
    CHECKSUM_ALGORITHM,
    COLLECTOR_VERSION,
    CollectionManifest,
    CollectionMode,
    CollectionSummary,
    CommandResult,
    CommandSpec,
    CommandStatus,
    EvidenceFile,
)
from ai_validator.evidence.registry import SUPPORTED_PROFILES, get_profile_commands
from ai_validator.evidence.sanitizer import DeterministicSanitizer

DEFAULT_TIMEOUT_SECONDS = 30


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _safe_output_path(output: Path) -> Path:
    if output.exists() and output.is_symlink():
        raise ValueError(f"Output path must not be a symlink: {output}")
    output = output.expanduser().resolve(strict=False)
    if output.exists() and not output.is_dir():
        raise ValueError(f"Output path exists and is not a directory: {output}")
    return output


def _write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def _relative(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def _status_from_exception(exc: Exception) -> tuple[CommandStatus, int | None, str]:
    if isinstance(exc, FileNotFoundError):
        return CommandStatus.MISSING, 127, f"Command '{getattr(exc, 'filename', '')}' was not found on this system."
    if isinstance(exc, PermissionError):
        return CommandStatus.DENIED, 13, f"Permission denied: {exc}"
    return CommandStatus.FAILED, -2, f"Internal command execution error: {exc}"


def run_command(
    spec: CommandSpec,
    *,
    output: Path,
    timeout: int,
    hostname: str,
    sanitizer: DeterministicSanitizer | None,
    include_diagnostics: bool,
) -> CommandResult:
    stdout_rel = spec.stdout_path
    stderr_rel = spec.stderr_path

    if spec.diagnostics and not include_diagnostics:
        return CommandResult(
            command_id=spec.id,
            category=spec.category,
            argv=spec.argv,
            duration_ms=0,
            status=CommandStatus.SKIPPED,
            stdout_file=stdout_rel,
            stderr_file=stderr_rel,
            error_summary="Skipped by default; pass --include-diagnostics to run optional DCGM diagnostics.",
            hostname=hostname,
        )

    started_at = utc_now()
    perf_start = time.perf_counter()
    try:
        completed = subprocess.run(
            spec.argv,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=timeout,
            shell=False,
        )
        finished_at = utc_now()
        duration_ms = int(round((time.perf_counter() - perf_start) * 1000))
        stdout = completed.stdout or ""
        stderr = completed.stderr or ""
        if sanitizer is not None:
            stdout = sanitizer.sanitize(stdout)
            stderr = sanitizer.sanitize(stderr)
        if stdout:
            _write_text(output / stdout_rel, stdout)
        if stderr:
            _write_text(output / stderr_rel, stderr)
        status = CommandStatus.COLLECTED if completed.returncode == 0 else CommandStatus.FAILED
        return CommandResult(
            command_id=spec.id,
            category=spec.category,
            argv=spec.argv,
            started_at=started_at,
            finished_at=finished_at,
            duration_ms=duration_ms,
            exit_code=completed.returncode,
            status=status,
            stdout_file=stdout_rel,
            stderr_file=stderr_rel if stderr else None,
            error_summary=stderr.strip()[:500] if stderr and status == CommandStatus.FAILED else None,
            hostname=hostname,
        )
    except subprocess.TimeoutExpired as exc:
        finished_at = utc_now()
        duration_ms = int(round((time.perf_counter() - perf_start) * 1000))
        stdout = exc.stdout or ""
        stderr = exc.stderr or ""
        if isinstance(stdout, bytes):
            stdout = stdout.decode(errors="replace")
        if isinstance(stderr, bytes):
            stderr = stderr.decode(errors="replace")
        if sanitizer is not None:
            stdout = sanitizer.sanitize(stdout)
            stderr = sanitizer.sanitize(stderr)
        if stdout:
            _write_text(output / stdout_rel, stdout)
        if stderr:
            _write_text(output / stderr_rel, stderr)
        return CommandResult(
            command_id=spec.id,
            category=spec.category,
            argv=spec.argv,
            started_at=started_at,
            finished_at=finished_at,
            duration_ms=duration_ms,
            exit_code=None,
            status=CommandStatus.TIMEOUT,
            stdout_file=stdout_rel if stdout else None,
            stderr_file=stderr_rel if stderr else None,
            error_summary=f"Timed out after {timeout} seconds.",
            hostname=hostname,
        )
    except Exception as exc:
        finished_at = utc_now()
        duration_ms = int(round((time.perf_counter() - perf_start) * 1000))
        status, exit_code, summary = _status_from_exception(exc)
        if sanitizer is not None:
            summary = sanitizer.sanitize(summary)
        return CommandResult(
            command_id=spec.id,
            category=spec.category,
            argv=spec.argv,
            started_at=started_at,
            finished_at=finished_at,
            duration_ms=duration_ms,
            exit_code=exit_code,
            status=status,
            stdout_file=stdout_rel,
            stderr_file=None,
            error_summary=summary,
            hostname=hostname,
        )


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _bundle_files(output: Path) -> list[Path]:
    return sorted(
        path
        for path in output.rglob("*")
        if path.is_file() and path.name != "checksums.sha256"
    )


def _evidence_files(output: Path, results: list[CommandResult]) -> list[EvidenceFile]:
    files: list[EvidenceFile] = []
    for result in results:
        for rel_path in [result.stdout_file, result.stderr_file]:
            if not rel_path:
                continue
            path = output / rel_path
            if not path.exists() or not path.is_file():
                continue
            files.append(
                EvidenceFile(
                    path=rel_path,
                    category=result.category,
                    command_id=result.command_id,
                    bytes=path.stat().st_size,
                    sha256=_sha256(path),
                )
            )
    return sorted(files, key=lambda item: item.path)


def write_checksums(output: Path) -> None:
    lines = [f"{_sha256(path)}  {_relative(path, output)}" for path in _bundle_files(output)]
    _write_text(output / "checksums.sha256", "\n".join(lines) + ("\n" if lines else ""))


def dry_run_commands(profile: str, *, include_diagnostics: bool = False) -> list[CommandSpec]:
    return get_profile_commands(profile, include_diagnostics=include_diagnostics)


def collect_evidence(
    *,
    profile: str,
    output_path: str | os.PathLike[str],
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
    sanitize: bool = False,
    include_diagnostics: bool = False,
) -> CollectionSummary:
    if timeout <= 0:
        raise ValueError("Timeout must be greater than zero seconds.")
    normalized_profile = profile.strip().lower()
    if normalized_profile not in SUPPORTED_PROFILES:
        supported = ", ".join(sorted(SUPPORTED_PROFILES))
        raise ValueError(f"Unsupported collection profile '{profile}'. Supported profiles: {supported}")

    output = _safe_output_path(Path(output_path))
    output.mkdir(parents=True, exist_ok=True)

    started_at = utc_now()
    source_hostname = socket.gethostname()
    sanitizer = DeterministicSanitizer(source_hostname=source_hostname) if sanitize else None
    bundle_hostname = sanitizer.display_hostname() if sanitizer else source_hostname

    commands = get_profile_commands(normalized_profile, include_diagnostics=include_diagnostics)
    results = [
        run_command(
            spec,
            output=output,
            timeout=timeout,
            hostname=bundle_hostname,
            sanitizer=sanitizer,
            include_diagnostics=include_diagnostics,
        )
        for spec in commands
    ]
    finished_at = utc_now()

    warnings: list[str] = []
    if any(result.status == CommandStatus.SKIPPED for result in results):
        warnings.append("Optional DCGM diagnostics were skipped by default; rerun with --include-diagnostics if approved for this host.")
    missing = [result.command_id for result in results if result.status == CommandStatus.MISSING]
    if missing:
        warnings.append(f"Missing optional command utilities: {', '.join(missing)}")
    failures = [result.command_id for result in results if result.status in {CommandStatus.FAILED, CommandStatus.TIMEOUT, CommandStatus.DENIED}]
    if failures:
        warnings.append(f"Some commands did not collect successfully: {', '.join(failures)}")

    commands_json = [result.model_dump(mode="json") for result in results]
    _write_text(output / "metadata" / "commands.json", json.dumps(commands_json, indent=2, sort_keys=True) + "\n")

    collected_count = sum(result.status == CommandStatus.COLLECTED for result in results)
    missing_count = sum(result.status == CommandStatus.MISSING for result in results)
    failed_count = sum(result.status in {CommandStatus.FAILED, CommandStatus.TIMEOUT, CommandStatus.DENIED} for result in results)
    skipped_count = sum(result.status == CommandStatus.SKIPPED for result in results)
    categories = sorted({result.category for result in results})

    manifest = CollectionManifest(
        profile=normalized_profile,
        collection_mode=CollectionMode.LOCAL,
        started_at=started_at,
        finished_at=finished_at,
        source_hostname=bundle_hostname,
        sanitized=sanitize,
        command_count=len(results),
        collected_count=collected_count,
        missing_count=missing_count,
        failed_count=failed_count,
        skipped_count=skipped_count,
        categories=categories,
        checksum_algorithm=CHECKSUM_ALGORITHM,
        files=_evidence_files(output, results),
        warnings=warnings,
    )
    _write_text(output / "manifest.json", json.dumps(manifest.model_dump(mode="json"), indent=2, sort_keys=True) + "\n")
    write_checksums(output)

    return CollectionSummary(
        profile=normalized_profile,
        output_path=str(output),
        command_count=len(results),
        collected_count=collected_count,
        missing_count=missing_count,
        failed_count=failed_count,
        skipped_count=skipped_count,
        warning_count=len(warnings),
    )
