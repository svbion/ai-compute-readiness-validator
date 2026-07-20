from __future__ import annotations

import logging
import signal
import time
from pathlib import Path
from typing import Callable

from .capabilities import discover_capabilities
from .client import AgentApiClient, ApiAuthenticationError, ApiClientError, ApiError
from .commands import UnsupportedCommand
from .config import AgentConfig, ConfigError, mask_secret
from .executor import CommandExecutor, execute_job
from .models import CapabilitySnapshot, ExecutionResult
from .simulation import simulation_runner

LOG = logging.getLogger("gpuvalidator_agent")

class AgentRuntime:
    def __init__(self, client: AgentApiClient, discover: Callable[[], CapabilitySnapshot] = discover_capabilities, execute: Callable[[dict], ExecutionResult] | None = None, sleep: Callable[[float], None] = time.sleep, agent_id_file: Path | None = None):
        config = getattr(client, "config", None)
        self.client=client; self.discover=discover; self.execute=execute or (lambda job: execute_job(job, CommandExecutor())); self.sleep=sleep; self.agent_id_file=agent_id_file or getattr(config, "agent_id_file", None); self.stop_requested=False; self.agent_id=None; self.heartbeat_interval=getattr(config, "heartbeat_interval", 30.0); self.poll_interval=getattr(config, "poll_interval", 5.0); self.last_heartbeat=0.0
    def request_shutdown(self, signum, frame):
        self.stop_requested=True
    def _load_agent_id(self):
        if self.agent_id_file and self.agent_id_file.exists():
            text=self.agent_id_file.read_text().strip()
            if text: self.agent_id=text
    def _save_agent_id(self):
        if self.agent_id_file and self.agent_id:
            self.agent_id_file.parent.mkdir(parents=True, exist_ok=True)
            self.agent_id_file.write_text(self.agent_id)
    def register(self):
        snapshot=self.discover()
        response=self.client.register(snapshot.capabilities, snapshot.gpu_count)
        self.agent_id=response.get("agent_id") or response.get("agent", {}).get("id")
        self.heartbeat_interval=float(response.get("heartbeat_interval_seconds") or self.heartbeat_interval)
        self.poll_interval=float(response.get("poll_interval_seconds") or self.poll_interval)
        self._save_agent_id()
        return snapshot
    def heartbeat_if_due(self, snapshot: CapabilitySnapshot | None = None, force: bool = False, status="online", last_error=None):
        if not self.agent_id: return
        current=time.monotonic()
        if force or current - self.last_heartbeat >= self.heartbeat_interval:
            snapshot=snapshot or self.discover()
            self.client.heartbeat(self.agent_id, snapshot.capabilities, snapshot.gpu_count, status=status, last_error=last_error or getattr(snapshot, "last_error", None))
            self.last_heartbeat=current
    def process_one_job(self) -> bool:
        if not self.agent_id: return False
        job=self.client.next_job(self.agent_id)
        if not job: return False
        try:
            claimed=self.client.claim_job(self.agent_id, job["id"])
            self.client.mark_running(self.agent_id, claimed["id"])
            result=self.execute(claimed)
        except UnsupportedCommand as exc:
            result=ExecutionResult(command_type=str(job.get("command_type", "unknown")), argv=[], state="unavailable", exit_code=None, stdout="", stderr=str(exc), output_truncated=False, started_at="", completed_at="", duration_ms=0, structured_result={"error": str(exc)}, parser_warnings=[])
        self.client.upload_result(self.agent_id, job, result)
        return True
    def run(self, max_iterations: int | None = None):
        self._load_agent_id()
        snapshot=self.register()
        self.heartbeat_if_due(snapshot, force=True)
        iterations=0
        while not self.stop_requested:
            iterations += 1
            try:
                snapshot=self.discover()
                self.heartbeat_if_due(snapshot)
                self.process_one_job()
            except ApiAuthenticationError:
                LOG.error("Agent authentication failed; stopping. Check GPUVALIDATOR_AGENT_TOKEN.")
                raise
            except (ApiClientError, ApiError) as exc:
                LOG.warning("Transient agent loop API error: %s", exc)
            except Exception as exc:
                LOG.exception("Unexpected agent loop error: %s", exc)
            if max_iterations is not None and iterations >= max_iterations:
                break
            self.sleep(self.poll_interval)

def configure_logging(level: str):
    logging.basicConfig(level=getattr(logging, level.upper(), logging.INFO), format="%(asctime)s %(levelname)s %(name)s: %(message)s")

def main() -> int:
    try:
        cfg=AgentConfig.from_env()
    except ConfigError as exc:
        print(f"Configuration error: {exc}")
        return 2
    configure_logging(cfg.log_level)
    LOG.info("Starting GPUValidator agent name=%s api_url=%s token=%s tls_verify=%s", cfg.agent_name, cfg.api_url, mask_secret(cfg.token), cfg.tls_verify)
    if cfg.simulate:
        runtime=AgentRuntime(AgentApiClient(cfg), discover=lambda: discover_capabilities(runner=simulation_runner), execute=lambda job: execute_job(job, CommandExecutor(runner=simulation_runner)))
    else:
        runtime=AgentRuntime(AgentApiClient(cfg))
    signal.signal(signal.SIGINT, runtime.request_shutdown)
    signal.signal(signal.SIGTERM, runtime.request_shutdown)
    try:
        runtime.run()
    except ApiAuthenticationError:
        return 3
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
