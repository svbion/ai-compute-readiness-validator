import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";

import { createPortalServerApp } from "../server";
import {
  deriveHardwareDiscoveryValidationView,
  summarizeLiveAgentDashboard,
  type AgentRecord,
  type ValidationDetail,
} from "../src/portal/agents";

const authHeader = { "x-ai-factory-test-auth": "test-bypass-token" };
const agentToken = "deadline-agent-token";

async function withServer(fn: (baseUrl: string) => Promise<void>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gpu-validator-nccl-smoke-test-"));
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

async function jsonRequest(baseUrl: string, method: string, url: string, body?: unknown, options: { user?: boolean; agent?: boolean } = {}) {
  const response = await fetch(`${baseUrl}${url}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(options.user ? authHeader : {}),
      ...(options.agent ? { Authorization: `Bearer ${agentToken}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { response, payload: await response.json().catch(() => ({})) };
}

async function registerAgent(baseUrl: string, gpuCount = 4, ncclAvailable = true) {
  return jsonRequest(baseUrl, "POST", "/api/v1/agents/register", {
    name: "runpod-a100-smoke",
    hostname: "rp-pod-001",
    agent_version: "0.1.0",
    gpu_count: gpuCount,
    capabilities: [
      { name: "nvidia_smi_list", available: true, version: "535.104" },
      { name: "nvidia_smi_inventory", available: true, version: "535.104" },
      { name: "nvidia_smi_topology", available: true, version: "535.104" },
      { name: "cuda_version", available: true, version: "12.2" },
      { name: "driver_version", available: true, version: "535.104" },
      { name: "pytorch_gpu_count", available: true, version: "2.4" },
      { name: "nccl_all_reduce_smoke", available: ncclAvailable, version: ncclAvailable ? "2.25.1" : null, details: { executable_path: ncclAvailable ? "/usr/local/nccl-tests/build/all_reduce_perf" : null, visible_gpu_count: gpuCount, at_least_two_gpus: gpuCount >= 2 } },
    ],
  }, { agent: true });
}

function ncclDetail(state: "queued" | "running" | "completed" = "completed"): ValidationDetail {
  const stdout = "NCCL version 2.25.1+cuda12.8\n8388608 2097152 float sum -1 0.210 39.95 59.12 0\n268435456 67108864 float sum -1 5.111 52.52 78.78 0\nOut of bounds values : 0 OK\n";
  return {
    validation: { id: "val_nccl", schema_version: "1.0.0", profile: "nccl-smoke", agent_id: "agt_live", state, created_at: "2026-07-20T15:00:00.000Z", completed_at: state === "completed" ? "2026-07-20T15:00:08.000Z" : null, error: null, job_ids: ["job_nccl"] },
    jobs: [{ id: "job_nccl", validation_id: "val_nccl", agent_id: "agt_live", state, command_type: "nccl_all_reduce_smoke", command: { argv: ["all_reduce_perf", "-b", "8M", "-e", "256M", "-f", "2", "-g", "4"] } }],
    results: state === "completed" ? [{ id: "res_nccl", schema_version: "1.0.0", job_id: "job_nccl", validation_id: "val_nccl", agent_id: "agt_live", state: "completed", exit_code: 0, started_at: "2026-07-20T15:00:00.000Z", completed_at: "2026-07-20T15:00:08.000Z", duration_ms: 8000, structured_result: { command_type: "nccl_all_reduce_smoke", rows: [{ message_size: 268435456, count: 67108864, datatype: "float", operation: "sum", time: 5.111, algorithm_bandwidth: 52.52, bus_bandwidth: 78.78, validation_errors: 0 }], algorithm_bandwidth: 52.52, bus_bandwidth: 78.78, validation_errors: 0, out_of_bounds_values: 0, raw_output: stdout }, stdout, stderr: "", output_truncated: false, command_evidence: { command_type: "nccl_all_reduce_smoke", argv: ["all_reduce_perf", "-b", "8M", "-e", "256M", "-f", "2", "-g", "4"], started_at: "2026-07-20T15:00:00.000Z", completed_at: "2026-07-20T15:00:08.000Z", exit_code: 0, stdout_sha256: "sha", stderr_sha256: null, output_truncated: false }, result_hash: "hash" }] : [],
  };
}

test("NCCL smoke validation queues one allowlisted job and result upload preserves bandwidth raw evidence", async () => {
  await withServer(async (baseUrl) => {
    const registered = await registerAgent(baseUrl, 4, true);
    const agentId = registered.payload.agent.id;
    const created = await jsonRequest(baseUrl, "POST", "/api/v1/validations", { profile: "nccl-smoke", agent_id: agentId }, { user: true });
    assert.equal(created.response.status, 201, JSON.stringify(created.payload));
    assert.equal(created.payload.validation.profile, "nccl-smoke");
    assert.deepEqual(created.payload.jobs.map((job: any) => job.command_type), ["nccl_all_reduce_smoke"]);
    assert.deepEqual(created.payload.jobs[0].command.argv, ["all_reduce_perf", "-b", "8M", "-e", "256M", "-f", "2", "-g", "4"]);

    const job = created.payload.jobs[0];
    await jsonRequest(baseUrl, "POST", `/api/v1/agents/${agentId}/jobs/${job.id}/claim`, {}, { agent: true });
    await jsonRequest(baseUrl, "POST", `/api/v1/agents/${agentId}/jobs/${job.id}/running`, {}, { agent: true });
    const stdout = "NCCL version 2.25.1+cuda12.8\n8388608 2097152 float sum -1 0.210 39.95 59.12 0\n268435456 67108864 float sum -1 5.111 52.52 78.78 0\nOut of bounds values : 0 OK\n";
    const upload = await jsonRequest(baseUrl, "POST", `/api/v1/jobs/${job.id}/results`, { agent_id: agentId, state: "completed", exit_code: 0, stdout, stderr: "", structured_result: { command_type: "nccl_all_reduce_smoke", algorithm_bandwidth: 52.52, bus_bandwidth: 78.78, validation_errors: 0, raw_output: stdout } }, { agent: true });
    assert.equal(upload.response.status, 200, JSON.stringify(upload.payload));
    assert.equal(upload.payload.result.structured_result.bus_bandwidth, 78.78);
    assert.match(upload.payload.result.stdout, /268435456/);
    const read = await jsonRequest(baseUrl, "GET", `/api/v1/validations/${created.payload.validation.id}`, undefined, { user: true });
    assert.equal(read.payload.validation.state, "completed");
    assert.equal(read.payload.results[0].command_evidence.command_type, "nccl_all_reduce_smoke");
  });
});

test("NCCL smoke validation stays unavailable when executable or two GPUs are absent", async () => {
  await withServer(async (baseUrl) => {
    const registered = await registerAgent(baseUrl, 1, false);
    const created = await jsonRequest(baseUrl, "POST", "/api/v1/validations", { profile: "nccl-smoke", agent_id: registered.payload.agent.id }, { user: true });
    assert.equal(created.response.status, 400);
    assert.match(created.payload.error, /NCCL smoke test unavailable/);
  });
});

test("frontend derivation shows NCCL queued running completed states bandwidth table and raw output", () => {
  const agent: AgentRecord = { id: "agt_live", schema_version: "1.0.0", name: "runpod-a100-smoke", hostname: "rp-pod-001", status: "online", capabilities: [], gpu_count: 4, agent_version: "0.1.0", registered_at: "2026-07-20T14:59:00.000Z", last_heartbeat_at: "2026-07-20T15:00:00.000Z", last_error: null, metadata: {} };
  assert.equal(summarizeLiveAgentDashboard([agent], [ncclDetail("queued")]).stateLabel, "validation queued");
  assert.equal(summarizeLiveAgentDashboard([agent], [ncclDetail("running")]).stateLabel, "validation running");
  const view = deriveHardwareDiscoveryValidationView(ncclDetail("completed"), [agent]);
  assert.equal(view.profile, "nccl-smoke");
  assert.equal(view.overallState, "completed");
  assert.equal(view.commands.length, 1);
  assert.equal(view.commands[0].commandType, "nccl_all_reduce_smoke");
  assert.equal(view.commands[0].bandwidthRows?.[0].busBandwidth, 78.78);
  assert.match(view.commands[0].stdout, /NCCL version/);
  assert.match(view.commands[0].parsedSummary, /AlgBW 52.52 GB\/s/);
});
