from __future__ import annotations

import json
import platform
import shutil
import subprocess
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


def require_safe_url(url: str, allow_insecure_http: bool = False) -> str:
    parsed = urlparse(url)
    if parsed.scheme == "https":
        return url.rstrip("/")
    if parsed.scheme == "http" and allow_insecure_http and parsed.hostname in {"127.0.0.1", "localhost", "::1"}:
        return url.rstrip("/")
    raise ValueError("HTTPS is required; HTTP is allowed only for explicit local development")


def read_token_file(path: Path) -> str:
    token = path.read_text(encoding="utf-8").strip()
    if not token:
        raise ValueError("Token file is empty")
    return token


def read_credential_file(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not data.get("runner_id") or not data.get("bearer_token"):
        raise ValueError("Credential file must contain runner_id and bearer_token")
    return data


def write_credential_file(path: Path, credential: dict[str, Any], url: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    safe = {"runner_id": credential["runner_id"], "bearer_token": credential["bearer_token"], "url": url}
    path.write_text(json.dumps(safe, indent=2), encoding="utf-8")
    path.chmod(0o600)


def detect_capabilities() -> dict[str, Any]:
    nccl_dir = Path(__import__("os").environ.get("AI_VALIDATOR_NCCL_TESTS_DIR", "")) if __import__("os").environ.get("AI_VALIDATOR_NCCL_TESTS_DIR") else None
    gpu_count = 0
    gpu_model = None
    driver = None
    cuda = None
    utilization = None
    memory = None
    temperature = None
    power = None
    if shutil.which("nvidia-smi"):
        try:
            query = subprocess.run(
                ["nvidia-smi", "--query-gpu=name,driver_version,memory.used,memory.total,utilization.gpu,temperature.gpu,power.draw", "--format=csv,noheader,nounits"],
                check=False,
                capture_output=True,
                text=True,
                timeout=5,
            )
            rows = [line.strip() for line in query.stdout.splitlines() if line.strip()]
            gpu_count = len(rows)
            if rows:
                parsed = [part.strip() for part in rows[0].split(",")]
                gpu_model = parsed[0] if len(parsed) > 0 else None
                driver = parsed[1] if len(parsed) > 1 else None
                utilization = [float(line.split(",")[4].strip()) for line in rows if len(line.split(",")) > 4 and line.split(",")[4].strip().replace(".", "", 1).isdigit()]
                memory = [{"used_mib": float(parts[2].strip()), "total_mib": float(parts[3].strip())} for parts in ([part.strip() for part in line.split(",")] for line in rows) if len(parts) > 3 and parts[2].replace(".", "", 1).isdigit() and parts[3].replace(".", "", 1).isdigit()]
                temperature = [float(line.split(",")[5].strip()) for line in rows if len(line.split(",")) > 5 and line.split(",")[5].strip().replace(".", "", 1).isdigit()]
                power = [float(line.split(",")[6].strip()) for line in rows if len(line.split(",")) > 6 and line.split(",")[6].strip().replace(".", "", 1).isdigit()]
        except Exception:
            pass
        try:
            nvidia_smi = subprocess.run(["nvidia-smi"], check=False, capture_output=True, text=True, timeout=5)
            import re
            match = re.search(r"CUDA Version:\s*([0-9.]+)", nvidia_smi.stdout)
            cuda = match.group(1) if match else None
        except Exception:
            pass
    return {
        "hostname_display": platform.node() or "unknown",
        "operating_system": platform.platform(),
        "architecture": platform.machine(),
        "gpu_model": gpu_model,
        "nvidia_driver": driver,
        "cuda_runtime": cuda,
        "gpu_utilization_percentages": utilization,
        "memory_used_total": memory,
        "gpu_temperature_celsius": temperature,
        "gpu_power_watts": power,
        "container_runtime": "docker" if shutil.which("docker") else ("podman" if shutil.which("podman") else None),
        "mpi_available": shutil.which("mpirun") is not None or shutil.which("mpiexec") is not None,
        "nccl_tests_available": any(shutil.which(name) for name in ["all_reduce_perf", "all_gather_perf", "reduce_scatter_perf", "broadcast_perf"]) or bool(nccl_dir and nccl_dir.exists()),
        "hpl_available": shutil.which("xhpl") is not None or shutil.which("hpl.sh") is not None,
        "dcgm_available": shutil.which("dcgmi") is not None,
        "gpu_count": gpu_count,
        "last_capability_refresh": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "busy_state": False,
        "active_job_id": None,
    }


def post_json(url: str, path: str, payload: dict[str, Any], bearer: str | None = None, timeout: float = 30.0) -> dict[str, Any]:
    data = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if bearer:
        headers["Authorization"] = f"Bearer {bearer}"
    request = urllib.request.Request(f"{url.rstrip('/')}{path}", data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", "replace")
        raise RuntimeError(f"Runner API request failed: HTTP {exc.code} {body}") from exc
