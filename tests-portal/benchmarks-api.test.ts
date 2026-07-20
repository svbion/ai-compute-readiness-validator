import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";

import { createPortalServerApp } from "../server";
import { parseBenchmarkText, deriveBenchmarkFindings } from "../src/server/benchmarks";

const authHeader = { "x-ai-factory-test-auth": "test-bypass-token" };

async function withServer(fn: (baseUrl: string, storePath: string, benchmarkDir: string) => Promise<void>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gpu-validator-benchmark-api-test-"));
  const previous = { ...process.env };
  process.env.NODE_ENV = "production";
  process.env.AI_FACTORY_AUTH_REQUIRED = "true";
  process.env.AI_FACTORY_SESSION_SECRET = "0123456789abcdef0123456789abcdef";
  process.env.AI_FACTORY_REVIEWER_EMAIL = "reviewer@example.invalid";
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
    await fn(`http://127.0.0.1:${address.port}`, process.env.AI_VALIDATOR_ENGAGEMENT_STORE, process.env.AI_VALIDATOR_BENCHMARK_STORAGE_DIR);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    process.env = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function jsonRequest(baseUrl: string, method: string, url: string, body?: unknown, authed = true) {
  const response = await fetch(`${baseUrl}${url}`, { method, headers: { "Content-Type": "application/json", ...(authed ? authHeader : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { response, payload: await response.json().catch(() => ({})) };
}

test("benchmark parsers tolerate whitespace, ANSI colors, missing metrics, and unknown versions", () => {
  const nccl = parseBenchmarkText("nccl", "\u001b[32mNCCL version 2.21.5\u001b[0m\n# comment\nNCCL INFO noise\n  1048576 262144 float sum -1 35.0 29.9 56.1 0\n", "all_reduce.txt");
  assert.equal(nccl.metrics.average_bus_bandwidth, 56.1);
  assert.equal(nccl.metrics.wrong_result_count, 0);
  assert.equal(nccl.metrics.nccl_version, "2.21.5");
  const hpl = parseBenchmarkText("hpl", "WR11R2C4      143360   288     4     4            1543.20          1.2754e+06\nResidual FAILED\n", "hpl.txt");
  assert.equal(hpl.metrics.performance_tflops, 1275.4);
  assert.equal(hpl.metrics.residual_pass, false);
  const triton = parseBenchmarkText("triton_perf_analyzer", "Concurrency,Inferences/Second,Avg latency,p95 latency,p99 latency\n16,12500,8.1,11.4,14.8\n", "perf.csv");
  assert.equal(triton.metrics.throughput, 12500);
  assert.equal(triton.metrics.average_latency, 8.1);
  const genai = parseBenchmarkText("genai_perf", "Output token throughput: 7200\nTime to first token: 42.5\nInter token latency: 7.3\n", "genai.txt");
  assert.equal(genai.metrics.tokens_per_second, 7200);
  assert.equal(genai.metrics.time_to_first_token, 42.5);
  const malformed = parseBenchmarkText("nccl", "banner only\n", "bad.txt");
  assert.equal(malformed.warnings.some((warning) => warning.includes("No NCCL")), true);
});

test("benchmark threshold findings are configurable and do not invent defaults", () => {
  const run: any = { id: "bmk1", engagement_id: "eng", node_id: "node1", benchmark_type: "nccl", status: "accepted", simulated: true, collected_at: new Date().toISOString(), metrics: { average_bus_bandwidth: 20, wrong_result_count: 0 }, provenance: { input_file: "x", parser_version: "1", source_lines: [1], parser: "nccl", simulated: true } };
  assert.equal(deriveBenchmarkFindings("eng", ["node1"], [run]).some((finding) => finding.rule_id === "nccl-bandwidth-below-threshold"), false);
  assert.equal(deriveBenchmarkFindings("eng", ["node1"], [run], { nccl_min_average_bus_bandwidth: 50 }).some((finding) => finding.rule_id === "nccl-bandwidth-below-threshold" && finding.blocking), true);
  assert.equal(deriveBenchmarkFindings("eng", ["node1"], [run]).some((finding) => finding.rule_id === "benchmark-simulated"), true);
});

test("benchmark upload API reuses upload tokens, persists separately, and readiness exposes benchmark category", async () => {
  await withServer(async (baseUrl, storePath, benchmarkDir) => {
    await jsonRequest(baseUrl, "POST", "/api/v1/engagement-fixtures/nvis-interview-demo");
    const token = await jsonRequest(baseUrl, "POST", "/api/v1/engagements/eng_demo_nvis_h100_two_node/nodes/node_demo_node01/upload-tokens");
    assert.equal(token.response.status, 201);
    const body = Buffer.from("NCCL version 2.21.5\nnranks=16 nodes=2\n1048576 262144 float sum -1 35.0 29.9 56.1 0\n");
    const upload = await fetch(`${baseUrl}/api/v1/benchmarks/upload?type=nccl&filename=all_reduce.txt&simulated=true`, { method: "POST", headers: { Authorization: `Bearer ${token.payload.token}`, "Content-Type": "text/plain" }, body });
    const payload = await upload.json();
    assert.equal(upload.status, 201, JSON.stringify(payload));
    assert.equal(payload.benchmark.benchmark_type, "nccl");
    assert.equal(fs.existsSync(path.join(benchmarkDir, "eng_demo_nvis_h100_two_node", "node_demo_node01", payload.benchmark.raw_storage_id, "input.txt")), true);
    const listed = await jsonRequest(baseUrl, "GET", "/api/v1/engagements/eng_demo_nvis_h100_two_node/benchmarks");
    assert.equal(listed.response.status, 200);
    assert.equal(listed.payload.benchmarks.length, 1);
    const readiness = await jsonRequest(baseUrl, "GET", "/api/v1/engagements/eng_demo_nvis_h100_two_node/readiness");
    assert.equal(readiness.response.status, 200);
    const store = JSON.parse(fs.readFileSync(storePath, "utf8"));
    assert.equal(store.benchmark_runs.length, 1);
    assert.equal(store.evidence_records.length, 0);
  });
});
