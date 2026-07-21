import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";

import { createPortalServerApp } from "../server";

const authHeader = { "x-ai-factory-test-auth": "test-bypass-token" };
const agentToken = "deadline-agent-token";

async function withServer(fn: (baseUrl: string, storePath: string) => Promise<void>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gpu-validator-agent-api-test-"));
  const previous = { ...process.env };
  process.env.NODE_ENV = "production";
  process.env.AI_FACTORY_AUTH_REQUIRED = "true";
  process.env.AI_FACTORY_SESSION_SECRET = "0123456789abcdef0123456789abcdef";
  process.env.AI_FACTORY_REVIEWER_USERNAME = "reviewer";
  process.env.AI_FACTORY_REVIEWER_PASSWORD_HASH = "scrypt$abc$def";
  process.env.AI_FACTORY_AUTH_TEST_BYPASS_TOKEN = "test-bypass-token";
  process.env.AI_VALIDATOR_ENGAGEMENT_STORE = path.join(dir, "store.json");
  process.env.GPUVALIDATOR_AGENT_TOKEN = agentToken;
  process.env.GPUVALIDATOR_AGENT_OFFLINE_SECONDS = "60";
  const app = await createPortalServerApp({ mountFrontend: false });
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    const address = server.address() as AddressInfo;
    await fn(`http://127.0.0.1:${address.port}`, process.env.AI_VALIDATOR_ENGAGEMENT_STORE);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    process.env = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function jsonRequest(baseUrl: string, method: string, url: string, body?: unknown, options: { user?: boolean; agent?: boolean; token?: string } = {}) {
  const response = await fetch(`${baseUrl}${url}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(options.user ? authHeader : {}),
      ...(options.agent ? { Authorization: `Bearer ${options.token ?? agentToken}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { response, payload: await response.json().catch(() => ({})) };
}

async function registerAgent(baseUrl: string, patch: Record<string, unknown> = {}) {
  return jsonRequest(baseUrl, "POST", "/api/v1/agents/register", {
    name: "runpod-a100-smoke",
    hostname: "rp-pod-001",
    agent_version: "0.1.0",
    gpu_count: 1,
    capabilities: [
      { name: "nvidia_smi_list", available: true, version: "535.104" },
      { name: "nvidia_smi_inventory", available: true, version: "535.104" },
      { name: "nvidia_smi_topology", available: true, version: "535.104" },
      { name: "cuda_version", available: true, version: "12.2" },
      { name: "driver_version", available: true, version: "535.104" },
      { name: "pytorch_gpu_count", available: true, version: "2.4" },
      { name: "nccl_all_reduce_smoke", available: true, version: "2.25.1", details: { executable_path: "/usr/local/nccl-tests/build/all_reduce_perf", visible_gpu_count: 4, at_least_two_gpus: true } },
    ],
    metadata: { runpod_pod_id: "pod-123" },
    ...patch,
  }, { agent: true });
}

test("agent registration is authenticated, token-safe, and idempotent by name plus hostname", async () => {
  await withServer(async (baseUrl, storePath) => {
    assert.equal((await jsonRequest(baseUrl, "POST", "/api/v1/agents/register", { name: "missing", hostname: "h" })).response.status, 401);
    assert.equal((await jsonRequest(baseUrl, "POST", "/api/v1/agents/register", { name: "bad", hostname: "h" }, { agent: true, token: "wrong" })).response.status, 401);
    assert.equal((await jsonRequest(baseUrl, "POST", "/api/v1/agents/register", { name: "bad", hostname: "h" }, { user: true })).response.status, 401);

    const first = await registerAgent(baseUrl);
    assert.equal(first.response.status, 201, JSON.stringify(first.payload));
    assert.match(first.payload.agent.id, /^agt_/);
    assert.equal(first.payload.agent.status, "online");
    assert.equal(first.payload.token, undefined);
    assert.equal(first.payload.agent.token_hash, undefined);
    assert.equal(first.payload.heartbeat_interval_seconds, 30);
    assert.equal(first.payload.poll_interval_seconds, 5);
    assert.equal(typeof first.payload.server_time, "string");

    const second = await registerAgent(baseUrl, { agent_version: "0.1.1", gpu_count: 2 });
    assert.equal(second.response.status, 200, JSON.stringify(second.payload));
    assert.equal(second.payload.agent.id, first.payload.agent.id);
    assert.equal(second.payload.agent.agent_version, "0.1.1");
    assert.equal(second.payload.agent.gpu_count, 2);

    const store = JSON.parse(fs.readFileSync(storePath, "utf8"));
    assert.equal(store.validation_agents.length, 1);
    assert.doesNotMatch(JSON.stringify(second.payload), new RegExp(agentToken));
  });
});

test("heartbeat updates capability, GPU count, agent version, degraded error state, and offline state is derived at read time", async () => {
  await withServer(async (baseUrl, storePath) => {
    const registered = await registerAgent(baseUrl);
    const agentId = registered.payload.agent.id;

    const heartbeat = await jsonRequest(baseUrl, "POST", "/api/v1/agents/heartbeat", {
      agent_id: agentId,
      status: "degraded",
      gpu_count: 4,
      agent_version: "0.2.0",
      last_error: "dcgm unavailable",
      capabilities: [{ name: "nvidia_smi_list", available: true, version: "535.104" }, { name: "dcgm", available: false, version: null }],
    }, { agent: true });
    assert.equal(heartbeat.response.status, 200, JSON.stringify(heartbeat.payload));
    assert.equal(heartbeat.payload.agent.status, "degraded");
    assert.equal(heartbeat.payload.agent.gpu_count, 4);
    assert.equal(heartbeat.payload.agent.last_error, "dcgm unavailable");
    assert.equal(heartbeat.payload.agent.capabilities.find((cap: any) => cap.name === "dcgm").available, false);

    const store = JSON.parse(fs.readFileSync(storePath, "utf8"));
    store.validation_agents[0].last_heartbeat_at = "2000-01-01T00:00:00.000Z";
    fs.writeFileSync(storePath, `${JSON.stringify(store, null, 2)}\n`);

    const list = await jsonRequest(baseUrl, "GET", "/api/v1/agents", undefined, { user: true });
    assert.equal(list.response.status, 200);
    assert.equal(list.payload.agents[0].status, "offline");
    assert.equal(list.payload.offline_threshold_seconds, 60);
    const read = await jsonRequest(baseUrl, "GET", `/api/v1/agents/${agentId}`, undefined, { user: true });
    assert.equal(read.payload.agent.status, "offline");
  });
});

test("hardware-discovery validation creation queues only supported allowlisted command jobs for an online agent", async () => {
  await withServer(async (baseUrl) => {
    const registered = await registerAgent(baseUrl, { capabilities: [{ name: "nvidia_smi_list", available: true, version: "535.104" }] });
    const unsupported = await jsonRequest(baseUrl, "POST", "/api/v1/validations", { profile: "unsupported", agent_id: registered.payload.agent.id }, { user: true });
    assert.equal(unsupported.response.status, 400);
    const incapable = await jsonRequest(baseUrl, "POST", "/api/v1/validations", { profile: "hardware-discovery", agent_id: registered.payload.agent.id }, { user: true });
    assert.equal(incapable.response.status, 400);
    assert.match(incapable.payload.error, /Unsupported command/);

    await registerAgent(baseUrl);
    const created = await jsonRequest(baseUrl, "POST", "/api/v1/validations", { profile: "hardware-discovery", agent_id: registered.payload.agent.id }, { user: true });
    assert.equal(created.response.status, 201, JSON.stringify(created.payload));
    assert.equal(created.payload.validation.profile, "hardware-discovery");
    assert.equal(created.payload.validation.state, "queued");
    assert.deepEqual(created.payload.jobs.map((job: any) => job.command_type), ["nvidia_smi_list", "nvidia_smi_inventory", "nvidia_smi_topology", "cuda_version", "driver_version", "pytorch_gpu_count"]);
    assert.equal(created.payload.jobs.every((job: any) => Array.isArray(job.command.argv) && job.command.argv.length > 0), true);
  });
});

test("job polling, atomic claim, running update, cancellation, and timeout recovery enforce the state machine", async () => {
  await withServer(async (baseUrl, storePath) => {
    const registered = await registerAgent(baseUrl);
    const agentId = registered.payload.agent.id;
    const created = await jsonRequest(baseUrl, "POST", "/api/v1/validations", { profile: "hardware-discovery", agent_id: agentId }, { user: true });
    const firstJob = created.payload.jobs[0];

    const next = await jsonRequest(baseUrl, "GET", `/api/v1/agents/${agentId}/jobs/next`, undefined, { agent: true });
    assert.equal(next.response.status, 200);
    assert.equal(next.payload.job.id, firstJob.id);

    const claimed = await jsonRequest(baseUrl, "POST", `/api/v1/agents/${agentId}/jobs/${firstJob.id}/claim`, {}, { agent: true });
    assert.equal(claimed.response.status, 200, JSON.stringify(claimed.payload));
    assert.equal(claimed.payload.job.state, "claimed");
    assert.equal((await jsonRequest(baseUrl, "POST", `/api/v1/agents/${agentId}/jobs/${firstJob.id}/claim`, {}, { agent: true })).response.status, 409);

    const running = await jsonRequest(baseUrl, "POST", `/api/v1/agents/${agentId}/jobs/${firstJob.id}/running`, {}, { agent: true });
    assert.equal(running.response.status, 200);
    assert.equal(running.payload.job.state, "running");
    assert.equal((await jsonRequest(baseUrl, "POST", `/api/v1/agents/${agentId}/jobs/${firstJob.id}/claim`, {}, { agent: true })).response.status, 409);

    const store = JSON.parse(fs.readFileSync(storePath, "utf8"));
    const queuedJob = store.validation_jobs.find((job: any) => job.state === "queued");
    queuedJob.state = "cancelled";
    const timedJob = store.validation_jobs.find((job: any) => job.state === "queued" && job.id !== queuedJob.id);
    timedJob.created_at = "2000-01-01T00:00:00.000Z";
    timedJob.timeout_seconds = 1;
    fs.writeFileSync(storePath, `${JSON.stringify(store, null, 2)}\n`);

    const afterMaintenance = await jsonRequest(baseUrl, "GET", `/api/v1/agents/${agentId}/jobs/next`, undefined, { agent: true });
    assert.notEqual(afterMaintenance.payload.job?.id, queuedJob.id);
    const read = await jsonRequest(baseUrl, "GET", `/api/v1/validations/${created.payload.validation.id}`, undefined, { user: true });
    assert.equal(read.payload.jobs.find((job: any) => job.id === queuedJob.id).state, "cancelled");
    assert.equal(read.payload.jobs.find((job: any) => job.id === timedJob.id).state, "timed_out");
  });
});

test("result upload accepts completed failed unavailable and timed-out states, truncates output, and is duplicate-safe", async () => {
  await withServer(async (baseUrl) => {
    const registered = await registerAgent(baseUrl);
    const agentId = registered.payload.agent.id;
    const created = await jsonRequest(baseUrl, "POST", "/api/v1/validations", { profile: "hardware-discovery", agent_id: agentId }, { user: true });
    const [completedJob, failedJob, unavailableJob, timeoutJob] = created.payload.jobs;

    for (const job of [completedJob, failedJob, unavailableJob, timeoutJob]) {
      await jsonRequest(baseUrl, "POST", `/api/v1/agents/${agentId}/jobs/${job.id}/claim`, {}, { agent: true });
      await jsonRequest(baseUrl, "POST", `/api/v1/agents/${agentId}/jobs/${job.id}/running`, {}, { agent: true });
    }

    const wrong = await registerAgent(baseUrl, { name: "other", hostname: "other-host" });
    assert.equal((await jsonRequest(baseUrl, "POST", `/api/v1/jobs/${completedJob.id}/results`, { agent_id: agentId, state: "completed" }, { agent: true, token: agentToken })).response.status, 200);
    assert.equal((await jsonRequest(baseUrl, "POST", `/api/v1/jobs/${failedJob.id}/results`, { state: "completed" }, { agent: true, token: "wrong" })).response.status, 401);
    assert.equal((await jsonRequest(baseUrl, "POST", `/api/v1/jobs/${failedJob.id}/results`, { agent_id: wrong.payload.agent.id, state: "failed", stderr: "wrong" }, { agent: true })).response.status, 403);

    const huge = "x".repeat(70_000);
    const failed = await jsonRequest(baseUrl, "POST", `/api/v1/jobs/${failedJob.id}/results`, { agent_id: agentId, state: "failed", exit_code: 1, stdout: huge, stderr: "boom", structured_result: { error: "boom" } }, { agent: true });
    assert.equal(failed.response.status, 200, JSON.stringify(failed.payload));
    assert.equal(failed.payload.result.state, "failed");
    assert.equal(failed.payload.result.output_truncated, true);
    assert.equal(failed.payload.result.stdout.length, 65536);

    const duplicate = await jsonRequest(baseUrl, "POST", `/api/v1/jobs/${failedJob.id}/results`, { agent_id: agentId, state: "failed", exit_code: 1, stdout: huge, stderr: "boom", structured_result: { error: "boom" } }, { agent: true });
    assert.equal(duplicate.response.status, 200);
    assert.equal(duplicate.payload.duplicate, true);
    assert.equal(duplicate.payload.result.id, failed.payload.result.id);

    const unavailable = await jsonRequest(baseUrl, "POST", `/api/v1/jobs/${unavailableJob.id}/results`, { agent_id: agentId, state: "unavailable", exit_code: null, stderr: "command missing" }, { agent: true });
    assert.equal(unavailable.payload.result.state, "unavailable");
    const timed = await jsonRequest(baseUrl, "POST", `/api/v1/jobs/${timeoutJob.id}/results`, { agent_id: agentId, state: "timed_out", exit_code: null, stderr: "timeout" }, { agent: true });
    assert.equal(timed.payload.result.state, "timed_out");

    const read = await jsonRequest(baseUrl, "GET", `/api/v1/validations/${created.payload.validation.id}`, undefined, { user: true });
    assert.equal(read.response.status, 200);
    assert.equal(read.payload.results.length, 4);
    assert.equal(read.payload.validation.state, "timed_out");
  });
});
