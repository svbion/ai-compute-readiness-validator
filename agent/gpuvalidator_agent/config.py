from __future__ import annotations

import os
import socket
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

class ConfigError(RuntimeError):
    pass

def mask_secret(value: str | None) -> str:
    if not value:
        return ""
    if len(value) <= 8:
        return "***"
    return f"{value[:3]}...{value[-3:]}"

def _bool_env(value: str | None, default: bool) -> bool:
    if value is None or value == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}

@dataclass(frozen=True)
class AgentConfig:
    api_url: str
    token: str
    agent_name: str
    hostname: str = ""
    poll_interval: float = 5.0
    heartbeat_interval: float = 30.0
    command_timeout: int = 20
    tls_verify: bool = True
    log_level: str = "INFO"
    agent_id_file: Path | None = None
    simulate: bool = False

    def __post_init__(self):
        object.__setattr__(self, "api_url", self.api_url.rstrip("/"))
        if not self.hostname:
            object.__setattr__(self, "hostname", socket.gethostname())

    def __repr__(self) -> str:
        return f"AgentConfig(api_url={self.api_url!r}, token={mask_secret(self.token)!r}, agent_name={self.agent_name!r}, hostname={self.hostname!r}, tls_verify={self.tls_verify!r})"

    @classmethod
    def from_env(cls, env: dict[str, str] | None = None) -> "AgentConfig":
        env = env or os.environ
        missing = [key for key in ["GPUVALIDATOR_API_URL", "GPUVALIDATOR_AGENT_TOKEN", "GPUVALIDATOR_AGENT_NAME"] if not env.get(key)]
        if missing:
            raise ConfigError(f"Missing required configuration: {', '.join(missing)}")
        parsed = urlparse(env["GPUVALIDATOR_API_URL"])
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ConfigError("GPUVALIDATOR_API_URL must be an http(s) URL")
        return cls(api_url=env["GPUVALIDATOR_API_URL"], token=env["GPUVALIDATOR_AGENT_TOKEN"], agent_name=env["GPUVALIDATOR_AGENT_NAME"], hostname=env.get("GPUVALIDATOR_AGENT_HOSTNAME", socket.gethostname()), poll_interval=float(env.get("GPUVALIDATOR_POLL_INTERVAL", "5")), heartbeat_interval=float(env.get("GPUVALIDATOR_HEARTBEAT_INTERVAL", "30")), command_timeout=int(env.get("GPUVALIDATOR_COMMAND_TIMEOUT", "20")), tls_verify=_bool_env(env.get("GPUVALIDATOR_TLS_VERIFY"), True), log_level=env.get("GPUVALIDATOR_LOG_LEVEL", "INFO"), agent_id_file=Path(env["GPUVALIDATOR_AGENT_ID_FILE"]) if env.get("GPUVALIDATOR_AGENT_ID_FILE") else None, simulate=_bool_env(env.get("GPUVALIDATOR_SIMULATE"), False))
