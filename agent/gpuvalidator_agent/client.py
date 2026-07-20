from __future__ import annotations

import json
import ssl
import time
from typing import Callable
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .config import AgentConfig
from .models import Capability, ExecutionResult

class ApiError(RuntimeError): pass
class ApiAuthenticationError(ApiError): pass
class ApiClientError(ApiError): pass

def default_transport(method: str, url: str, body: dict | None, headers: dict[str, str], timeout: float, tls_verify: bool):
    data=json.dumps(body).encode("utf-8") if body is not None else None
    ctx=None if tls_verify else ssl._create_unverified_context()
    req=Request(url, data=data, method=method, headers=headers)
    with urlopen(req, timeout=timeout, context=ctx) as resp:
        raw=resp.read().decode("utf-8")
        return resp.status, json.loads(raw) if raw else {}

class AgentApiClient:
    def __init__(self, config: AgentConfig, transport: Callable = default_transport, sleep: Callable[[float], None] = time.sleep):
        self.config=config; self.transport=transport; self.sleep=sleep
    def _request(self, method: str, path: str, body: dict | None = None, attempts: int = 3) -> dict:
        url=f"{self.config.api_url}{path}"
        headers={"Content-Type":"application/json", "Authorization": f"Bearer {self.config.token}"}
        last=None
        for attempt in range(attempts):
            try:
                status,payload=self.transport(method, url, body, headers, 15, self.config.tls_verify)
                if status == 401: raise ApiAuthenticationError("Agent authentication failed")
                if 400 <= status < 500: raise ApiClientError(str(payload.get("error") or status))
                if status >= 500: raise ApiError(str(payload.get("error") or status))
                return payload
            except HTTPError as exc:
                if exc.code == 401: raise ApiAuthenticationError("Agent authentication failed") from exc
                if 400 <= exc.code < 500: raise ApiClientError(f"HTTP {exc.code}") from exc
                last=exc
            except URLError as exc:
                last=exc
            except ApiAuthenticationError:
                raise
            except ApiClientError:
                raise
            if attempt < attempts-1:
                self.sleep(0.1 * (2**attempt))
        raise ApiError(f"API request failed after retries: {last}")
    def register(self, capabilities: list[Capability], gpu_count: int | None) -> dict:
        return self._request("POST", "/api/v1/agents/register", {"name": self.config.agent_name, "hostname": self.config.hostname, "agent_version": "0.1.0", "gpu_count": gpu_count, "capabilities": [c.to_dict() for c in capabilities], "metadata": {}})
    def heartbeat(self, agent_id: str, capabilities: list[Capability], gpu_count: int | None, status: str = "online", last_error: str | None = None) -> dict:
        return self._request("POST", "/api/v1/agents/heartbeat", {"agent_id": agent_id, "status": status, "gpu_count": gpu_count, "agent_version": "0.1.0", "last_error": last_error, "capabilities": [c.to_dict() for c in capabilities]})
    def next_job(self, agent_id: str) -> dict | None:
        return self._request("GET", f"/api/v1/agents/{agent_id}/jobs/next").get("job")
    def claim_job(self, agent_id: str, job_id: str) -> dict:
        return self._request("POST", f"/api/v1/agents/{agent_id}/jobs/{job_id}/claim", {}).get("job")
    def mark_running(self, agent_id: str, job_id: str) -> dict:
        return self._request("POST", f"/api/v1/agents/{agent_id}/jobs/{job_id}/running", {}).get("job")
    def upload_result(self, agent_id: str, job: dict, result: ExecutionResult) -> dict:
        return self._request("POST", f"/api/v1/jobs/{job['id']}/results", result.to_payload(agent_id))
