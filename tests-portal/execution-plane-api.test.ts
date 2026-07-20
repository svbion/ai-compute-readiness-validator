import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";

import { createPortalServerApp } from "../server";

const authHeader = { "x-ai-factory-test-auth": "test-bypass-token" };

async function withServer(fn: (baseUrl: string, storePath: string) => Promise<void>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gpu-validator-execution-api-test-"));
  const previous = { ...process.env };
  process.env.NODE_ENV = "production";
  process.env.AI_FACTORY_AUTH_REQUIRED = "true";
  process.env.AI_FACTORY_SESSION_SECRET = "0123456789abcdef0123456789abcdef";
  process.env.AI_FACTORY_REVIEWER_USERNAME = "reviewer";
  process.env.AI_FACTORY_REVIEWER_PASSWORD_HASH = "scrypt$abc$def";
  process.env.AI_FACTORY_AUTH_TEST_BYPASS_TOKEN = "test-bypass-token";
  process.env.AI_VALIDATOR_ENGAGEMENT_STORE = path.join(dir, "store.json");
  process.env.AI_VALIDATOR_BENCHMARK_STORAGE_DIR = path.join(dir, "benchmarks");
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

async function jsonRequest(baseUrl: string, method: string, url: string, body?: unknown, authed = true, bearer?: string) {
  const response = await fetch(`${baseUrl}${url}`, { method, headers: { "Content-Type": "application/json", ...(authed ? authHeader : {}), ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { response, payload: await response.json().catch(() => ({})) };
}

async function prepareRunner(baseUrl: string) {
  await jsonRequest(baseUrl, "POST", "/api/v1/engagement-fixtures/nvis-interview-demo");
  const token = await jsonRequest(baseUrl, "POST", "/api/v1/engagements/eng_demo_nvis_h100_two_node/nodes/node_demo_node01/runner-tokens");
  assert.equal(token.response.status, 201, JSON.stringify(token.payload));
  assert.equal(token.payload.token.token_hash, undefined);
  assert.equal(typeof token.payload.plaintext, "string");
  const registered = await jsonRequest(baseUrl, "POST", "/api/v1/runners/register", { node_id: "node_demo_node01", token: token.payload.plaintext, runner_version: "0.1.0", hostname_display: "HOST-001", supported_benchmark_ids: ["nccl-all-reduce", "nvidia-hpl"], capabilities: { gpu_count: 8, nccl_tests_available: true, hpl_available: true, mpi_available: true } }, false);
  assert.equal(registered.response.status, 201, JSON.stringify(registered.payload));
  assert.equal(registered.payload.credential.token_hash, undefined);
  return registered.payload.credential as { runner_id: string; bearer_token: string };
}

test("benchmark definition catalog lists allowlisted versioned definitions", async () => {
  await withServer(async (baseUrl) => {
    const result = await jsonRequest(baseUrl, "GET", "/api/v1/benchmark-definitions");
    assert.equal(result.response.status, 200);
    assert.equal(result.payload.definitions.length, 8);
    assert.deepEqual(result.payload.definitions.map((item: any) => item.id), ["nccl-all-reduce", "nccl-all-gather", "nccl-reduce-scatter", "nccl-broadcast", "nvidia-hpl", "triton-perf-analyzer", "genai-perf", "dcgm-diag-level-1"]);
    assert.equal(result.payload.definitions.every((item: any) => item.supported_parameters && item.validation_rules && item.enabled === true), true);
  });
});

test("admin job creation validates target nodes, capabilities, parameters, injection, and approval", async () => {
  await withServer(async (baseUrl) => {
    await prepareRunner(baseUrl);
    assert.equal((await jsonRequest(baseUrl, "POST", "/api/v1/engagements/eng_demo_nvis_h100_two_node/benchmark-jobs", { benchmark_definition_id: "bad", target_node_ids: ["node_demo_node01"], parameters: {} })).response.status, 400);
    assert.equal((await jsonRequest(baseUrl, "POST", "/api/v1/engagements/eng_demo_nvis_h100_two_node/benchmark-jobs", { benchmark_definition_id: "nccl-all-reduce", target_node_ids: ["missing"], parameters: {} })).response.status, 400);
    assert.equal((await jsonRequest(baseUrl, "POST", "/api/v1/engagements/eng_demo_nvis_h100_two_node/benchmark-jobs", { benchmark_definition_id: "nccl-all-reduce", target_node_ids: ["node_demo_node01"], parameters: { iterations: 999999 } })).response.status, 400);
    assert.equal((await jsonRequest(baseUrl, "POST", "/api/v1/engagements/eng_demo_nvis_h100_two_node/benchmark-jobs", { benchmark_definition_id: "nccl-all-reduce", target_node_ids: ["node_demo_node01"], parameters: { operation: "all_reduce_perf; rm -rf /", environment: { BAD: "1" } } })).response.status, 400);
    const created = await jsonRequest(baseUrl, "POST", "/api/v1/engagements/eng_demo_nvis_h100_two_node/benchmark-jobs", { benchmark_definition_id: "nccl-all-reduce", target_node_ids: ["node_demo_node01"], parameters: { gpu_count: 4, maximum_bytes: "64M", iterations: 5 } });
    assert.equal(created.response.status, 201, JSON.stringify(created.payload));
    assert.equal(created.payload.job.status, "queued");
    assert.match(created.payload.job.generated_command_preview, /all_reduce_perf -b 8M -e 64M -f 2 -g 4 -w 5 -n 5/);
    const hpl = await jsonRequest(baseUrl, "POST", "/api/v1/engagements/eng_demo_nvis_h100_two_node/benchmark-jobs", { benchmark_definition_id: "nvidia-hpl", target_node_ids: ["node_demo_node01"], parameters: { preset: "smoke" } });
    assert.equal(hpl.payload.job.status, "awaiting_approval");
    const approved = await jsonRequest(baseUrl, "POST", `/api/v1/engagements/eng_demo_nvis_h100_two_node/benchmark-jobs/${hpl.payload.job.id}/approve`);
    assert.equal(approved.payload.job.status, "queued");
    const cancelled = await jsonRequest(baseUrl, "POST", `/api/v1/engagements/eng_demo_nvis_h100_two_node/benchmark-jobs/${created.payload.job.id}/cancel`);
    assert.equal(cancelled.payload.job.status, "cancelled");
  });
});

test("runner auth, claim locking, wrong runner rejection, lifecycle, logs, and result attachment", async () => {
  await withServer(async (baseUrl, storePath) => {
    const credential = await prepareRunner(baseUrl);
    const otherToken = await jsonRequest(baseUrl, "POST", "/api/v1/engagements/eng_demo_nvis_h100_two_node/nodes/node_demo_node02/runner-tokens");
    const otherRegistered = await jsonRequest(baseUrl, "POST", "/api/v1/runners/register", { node_id: "node_demo_node02", token: otherToken.payload.plaintext, runner_version: "0.1.0", supported_benchmark_ids: ["nccl-all-reduce"], capabilities: { gpu_count: 8, nccl_tests_available: true } }, false);
    const job = await jsonRequest(baseUrl, "POST", "/api/v1/engagements/eng_demo_nvis_h100_two_node/benchmark-jobs", { benchmark_definition_id: "nccl-all-reduce", target_node_ids: ["node_demo_node01"], parameters: { gpu_count: 4, iterations: 5 } });
    assert.equal((await jsonRequest(baseUrl, "POST", "/api/v1/runners/jobs/claim", {}, false)).response.status, 401);
    const wrong = await jsonRequest(baseUrl, "POST", "/api/v1/runners/jobs/claim", {}, false, otherRegistered.payload.credential.bearer_token);
    assert.equal(wrong.payload.job, null);
    const claimed = await jsonRequest(baseUrl, "POST", "/api/v1/runners/jobs/claim", {}, false, credential.bearer_token);
    assert.equal(claimed.payload.job.id, job.payload.job.id);
    assert.equal((await jsonRequest(baseUrl, "POST", "/api/v1/runners/jobs/claim", {}, false, credential.bearer_token)).payload.job, null);
    assert.equal((await jsonRequest(baseUrl, "POST", `/api/v1/runners/jobs/${job.payload.job.id}/status`, { status: "running", progress: 20 }, false, credential.bearer_token)).response.status, 200);
    assert.equal((await jsonRequest(baseUrl, "POST", `/api/v1/runners/jobs/${job.payload.job.id}/logs`, { chunk: "Authorization: Bearer SECRET\n\u001b[31mok\u001b[0m" }, false, credential.bearer_token)).response.status, 200);
    const complete = await jsonRequest(baseUrl, "POST", `/api/v1/runners/jobs/${job.payload.job.id}/complete`, { result_type: "nccl", filename: "redacted-real-nccl.txt", output: "NCCL version 2.25.1+cuda12.8\nnranks=4\n# out of bounds values : 0 OK\n8589934592 2147483648 float sum -1 9000 170.0 185.67 0\n# Avg bus bandwidth    : 37.3098\n" }, false, credential.bearer_token);
    assert.equal(complete.payload.job.status, "completed");
    assert.equal(complete.payload.benchmark.metrics.nccl_version, "2.25.1+cuda12.8");
    assert.equal(complete.payload.benchmark.metrics.wrong_result_count, 0);
    assert.equal(complete.payload.benchmark.metrics.bus_bandwidth, 185.67);
    const store = JSON.parse(fs.readFileSync(storePath, "utf8"));
    assert.equal(store.benchmark_runs.length, 1);
    assert.equal(store.benchmark_jobs[0].result_ids.length, 1);
    assert.doesNotMatch(JSON.stringify(store), /SECRET/);
  });
});

test("expired jobs are rejected and runner token revocation blocks use", async () => {
  await withServer(async (baseUrl, storePath) => {
    await jsonRequest(baseUrl, "POST", "/api/v1/engagement-fixtures/nvis-interview-demo");
    const token = await jsonRequest(baseUrl, "POST", "/api/v1/engagements/eng_demo_nvis_h100_two_node/nodes/node_demo_node01/runner-tokens");
    const revoked = await jsonRequest(baseUrl, "POST", `/api/v1/engagements/eng_demo_nvis_h100_two_node/nodes/node_demo_node01/runner-tokens/${token.payload.token.id}/revoke`);
    assert.equal(revoked.payload.token.status, "revoked");
    assert.equal((await jsonRequest(baseUrl, "POST", "/api/v1/runners/register", { node_id: "node_demo_node01", token: token.payload.plaintext, runner_version: "0.1.0" }, false)).response.status, 401);
    const credential = await prepareRunner(baseUrl);
    const job = await jsonRequest(baseUrl, "POST", "/api/v1/engagements/eng_demo_nvis_h100_two_node/benchmark-jobs", { benchmark_definition_id: "nccl-all-reduce", target_node_ids: ["node_demo_node01"], parameters: { gpu_count: 4 } });
    const store = JSON.parse(fs.readFileSync(storePath, "utf8"));
    store.benchmark_jobs[0].expires_at = "2000-01-01T00:00:00.000Z";
    fs.writeFileSync(storePath, `${JSON.stringify(store, null, 2)}\n`);
    assert.equal((await jsonRequest(baseUrl, "POST", "/api/v1/runners/jobs/claim", {}, false, credential.bearer_token)).payload.job, null);
    const read = await jsonRequest(baseUrl, "GET", `/api/v1/engagements/eng_demo_nvis_h100_two_node/benchmark-jobs/${job.payload.job.id}`);
    assert.equal(read.payload.job.status, "expired");
  });
});
