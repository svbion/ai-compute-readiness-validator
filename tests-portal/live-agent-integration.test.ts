import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";

import { createPortalServerApp } from "../server";
import {
  deriveLiveGpuInventory,
  summarizeLiveAgentDashboard,
  type AgentRecord,
  type ValidationDetail,
} from "../src/portal/agents";

const authHeader = { "x-ai-factory-test-auth": "test-bypass-token" };
const agentToken = "deadline-agent-token";

async function withServer(fn: (baseUrl: string) => Promise<void>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gpu-validator-live-ui-test-"));
  const previous = { ...process.env };
  process.env.NODE_ENV = "production";
  process.env.AI_FACTORY_AUTH_REQUIRED = "true";
  process.env.AI_FACTORY_SESSION_SECRET = "0123456789abcdef0123456789abcdef";
  process.env.AI_FACTORY_REVIEWER_USERNAME = "reviewer";
  process.env.AI_FACTORY_REVIEWER_PASSWORD_HASH = "scrypt$abc$def";
  process.env.AI_FACTORY_AUTH_TEST_BYPASS_TOKEN = "test-bypass-token";
  process.env.AI_VALIDATOR_ENGAGEMENT_STORE = path.join(dir, "store.json");
  process.env.GPUVALIDATOR_AGENT_TOKEN = agentToken;
  const app = await createPortalServerApp({ mountFrontend: false });
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    const address = server.address() as AddressInfo;
    await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    process.env = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function jsonRequest(baseUrl: string, method: string, url: string, body?: unknown, agent = false) {
  const response = await fetch(`${baseUrl}${url}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authHeader,
      ...(agent ? { Authorization: `Bearer ${agentToken}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { response, payload: await response.json().catch(() => ({})) };
}

function fourGpuValidation(): ValidationDetail {
  const agent_id = "agt_live";
  const validation_id = "val_live";
  return {
    validation: { id: validation_id, schema_version: "1.0.0", profile: "hardware-discovery", agent_id, state: "completed", created_at: "2026-07-20T15:00:00.000Z", completed_at: "2026-07-20T15:02:00.000Z", error: null, job_ids: [] },
    jobs: [],
    results: [
      { id: "r1", schema_version: "1.0.0", job_id: "j1", validation_id, agent_id, state: "completed", exit_code: 0, started_at: "2026-07-20T15:00:00.000Z", completed_at: "2026-07-20T15:00:01.000Z", duration_ms: 1000, structured_result: { gpus: [
        { index: 0, model: "NVIDIA A100-SXM4-40GB", uuid: "GPU-live-0" },
        { index: 1, model: "NVIDIA A100-SXM4-40GB", uuid: "GPU-live-1" },
        { index: 2, model: "NVIDIA A100-SXM4-40GB", uuid: "GPU-live-2" },
        { index: 3, model: "NVIDIA A100-SXM4-40GB", uuid: "GPU-live-3" },
      ] }, stdout: "GPU 0: NVIDIA A100-SXM4-40GB (UUID: GPU-live-0)\nGPU 1: NVIDIA A100-SXM4-40GB (UUID: GPU-live-1)\nGPU 2: NVIDIA A100-SXM4-40GB (UUID: GPU-live-2)\nGPU 3: NVIDIA A100-SXM4-40GB (UUID: GPU-live-3)", stderr: "", output_truncated: false, command_evidence: { command_type: "nvidia_smi_list", argv: ["nvidia-smi", "-L"], started_at: "2026-07-20T15:00:00.000Z", completed_at: "2026-07-20T15:00:01.000Z", exit_code: 0, stdout_sha256: "sha", stderr_sha256: null, output_truncated: false }, result_hash: "h1" },
      { id: "r2", schema_version: "1.0.0", job_id: "j2", validation_id, agent_id, state: "completed", exit_code: 0, started_at: "2026-07-20T15:00:01.000Z", completed_at: "2026-07-20T15:00:02.000Z", duration_ms: 1000, structured_result: { gpus: [
        { index: 0, name: "NVIDIA A100-SXM4-40GB", uuid: "GPU-live-0", memory_total: "40536 MiB", driver_version: "535.104.05", pci_bus_id: "00000000:41:00.0" },
        { index: 1, name: "NVIDIA A100-SXM4-40GB", uuid: "GPU-live-1", memory_total: "40536 MiB", driver_version: "535.104.05", pci_bus_id: "00000000:61:00.0" },
        { index: 2, name: "NVIDIA A100-SXM4-40GB", uuid: "GPU-live-2", memory_total: "40536 MiB", driver_version: "535.104.05", pci_bus_id: "00000000:81:00.0" },
        { index: 3, name: "NVIDIA A100-SXM4-40GB", uuid: "GPU-live-3", memory_total: "40536 MiB", driver_version: "535.104.05", pci_bus_id: "00000000:A1:00.0" },
      ] }, stdout: "0, NVIDIA A100-SXM4-40GB, GPU-live-0, 40536, 535.104.05, 00000000:41:00.0", stderr: "", output_truncated: false, command_evidence: { command_type: "nvidia_smi_inventory", argv: ["nvidia-smi"], started_at: "2026-07-20T15:00:01.000Z", completed_at: "2026-07-20T15:00:02.000Z", exit_code: 0, stdout_sha256: "sha", stderr_sha256: null, output_truncated: false }, result_hash: "h2" },
      { id: "r3", schema_version: "1.0.0", job_id: "j3", validation_id, agent_id, state: "completed", exit_code: 0, started_at: "2026-07-20T15:00:02.000Z", completed_at: "2026-07-20T15:00:03.000Z", duration_ms: 1000, structured_result: { driver_version: "535.104.05" }, stdout: "535.104.05", stderr: "", output_truncated: false, command_evidence: { command_type: "driver_version", argv: ["nvidia-smi"], started_at: "2026-07-20T15:00:02.000Z", completed_at: "2026-07-20T15:00:03.000Z", exit_code: 0, stdout_sha256: "sha", stderr_sha256: null, output_truncated: false }, result_hash: "h3" },
      { id: "r4", schema_version: "1.0.0", job_id: "j4", validation_id, agent_id, state: "unavailable", exit_code: null, started_at: "2026-07-20T15:00:03.000Z", completed_at: "2026-07-20T15:00:04.000Z", duration_ms: 1000, structured_result: { available: false, error: "nvcc unavailable" }, stdout: "", stderr: "nvcc unavailable", output_truncated: false, command_evidence: { command_type: "cuda_version", argv: ["nvcc"], started_at: "2026-07-20T15:00:03.000Z", completed_at: "2026-07-20T15:00:04.000Z", exit_code: null, stdout_sha256: null, stderr_sha256: "sha", output_truncated: false }, result_hash: "h4" },
      { id: "r5", schema_version: "1.0.0", job_id: "j5", validation_id, agent_id, state: "completed", exit_code: 0, started_at: "2026-07-20T15:00:04.000Z", completed_at: "2026-07-20T15:00:05.000Z", duration_ms: 1000, structured_result: { topology: [["GPU0", "X", "NV4"]] }, stdout: "GPU0 GPU1\nGPU0 X NV4", stderr: "", output_truncated: false, command_evidence: { command_type: "nvidia_smi_topology", argv: ["nvidia-smi", "topo", "-m"], started_at: "2026-07-20T15:00:04.000Z", completed_at: "2026-07-20T15:00:05.000Z", exit_code: 0, stdout_sha256: "sha", stderr_sha256: null, output_truncated: false }, result_hash: "h5" },
      { id: "r6", schema_version: "1.0.0", job_id: "j6", validation_id, agent_id, state: "unavailable", exit_code: null, started_at: "2026-07-20T15:00:05.000Z", completed_at: "2026-07-20T15:00:06.000Z", duration_ms: 1000, structured_result: { available: false, error: "torch unavailable" }, stdout: "", stderr: "torch unavailable", output_truncated: false, command_evidence: { command_type: "pytorch_gpu_count", argv: ["python3", "-c"], started_at: "2026-07-20T15:00:05.000Z", completed_at: "2026-07-20T15:00:06.000Z", exit_code: null, stdout_sha256: null, stderr_sha256: "sha", output_truncated: false }, result_hash: "h6" },
    ],
  };
}

test("live GPU inventory derives four RunPod GPUs without fabricating missing CUDA or PyTorch", () => {
  const agent: AgentRecord = { id: "agt_live", schema_version: "1.0.0", name: "runpod-4gpu-01", hostname: "runpod-node-01", status: "online", capabilities: [], gpu_count: 4, agent_version: "0.1.0", registered_at: "2026-07-20T14:59:00.000Z", last_heartbeat_at: "2026-07-20T15:00:00.000Z", last_error: null, metadata: {} };
  const items = deriveLiveGpuInventory([agent], [fourGpuValidation()]);
  assert.equal(items.length, 4);
  assert.equal(items[0].evidenceSource.source, "live_agent");
  assert.equal(items[0].agentName, "runpod-4gpu-01");
  assert.equal(items[0].nodeName, "runpod-node-01");
  assert.equal(items[0].uuid, "GPU-live-0");
  assert.equal(items[0].memoryTotal, "40536 MiB");
  assert.equal(items[0].pciBusId, "00000000:41:00.0");
  assert.equal(items[0].driverVersion, "535.104.05");
  assert.equal(items[0].cudaVersion, null);
  assert.equal(items[0].fieldAvailability.cudaVersion, "not_collected");
  assert.match(items[0].evidenceSource.rawEvidence, /GPU0 X NV4/);
  assert.match(items[0].warnings.join(" "), /CUDA unavailable|PyTorch unavailable/);
});

test("dashboard summary handles no-agent offline queued running completed failed and partial states", () => {
  const now = "2026-07-20T15:05:00.000Z";
  assert.equal(summarizeLiveAgentDashboard([], [], now).stateLabel, "no agent configured");
  const offline: AgentRecord = { id: "agt_off", schema_version: "1.0.0", name: "offline", hostname: "node", status: "offline", capabilities: [], gpu_count: null, agent_version: null, registered_at: now, last_heartbeat_at: now, last_error: null, metadata: {} };
  assert.equal(summarizeLiveAgentDashboard([offline], [], now).stateLabel, "agent offline");
  const online = { ...offline, id: "agt_live", name: "runpod-4gpu-01", status: "online" as const, gpu_count: 4 };
  assert.equal(summarizeLiveAgentDashboard([online], [], now).stateLabel, "agent online");
  assert.equal(summarizeLiveAgentDashboard([online], [{ ...fourGpuValidation(), validation: { ...fourGpuValidation().validation, state: "queued" } }], now).stateLabel, "validation queued");
  assert.equal(summarizeLiveAgentDashboard([online], [{ ...fourGpuValidation(), validation: { ...fourGpuValidation().validation, state: "running" } }], now).stateLabel, "validation running");
  assert.equal(summarizeLiveAgentDashboard([online], [fourGpuValidation()], now).stateLabel, "validation partial");
  const failed = { ...fourGpuValidation(), validation: { ...fourGpuValidation().validation, state: "failed" as const } };
  assert.equal(summarizeLiveAgentDashboard([online], [failed], now).stateLabel, "validation failed");
});

test("reviewer API lists validations for dashboard polling and rejects unauthenticated validation creation", async () => {
  await withServer(async (baseUrl) => {
    const register = await jsonRequest(baseUrl, "POST", "/api/v1/agents/register", { name: "runpod-4gpu-01", hostname: "node", gpu_count: 4, capabilities: ["nvidia_smi_list", "nvidia_smi_inventory", "nvidia_smi_topology", "cuda_version", "driver_version", "pytorch_gpu_count"].map((name) => ({ name, available: true, version: null })) }, true);
    const unauth = await fetch(`${baseUrl}/api/v1/validations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile: "hardware-discovery", agent_id: register.payload.agent.id }) });
    assert.equal(unauth.status, 401);
    const created = await jsonRequest(baseUrl, "POST", "/api/v1/validations", { profile: "hardware-discovery", agent_id: register.payload.agent.id });
    assert.equal(created.response.status, 201, JSON.stringify(created.payload));
    const listed = await jsonRequest(baseUrl, "GET", "/api/v1/validations?profile=hardware-discovery");
    assert.equal(listed.response.status, 200);
    assert.equal(listed.payload.validations[0].validation.id, created.payload.validation.id);
    assert.equal(listed.payload.validations[0].jobs.length, 6);
  });
});
