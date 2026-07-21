import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";

import { createPortalServerApp } from "../server";

const authHeader = { "x-ai-factory-test-auth": "test-bypass-token" };
const agentToken = "deadline-agent-token";

async function withServer(fn: (baseUrl: string, storePath: string, reportsDir: string) => Promise<void>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gpu-validator-reports-api-test-"));
  const previous = { ...process.env };
  process.env.NODE_ENV = "production";
  process.env.AI_FACTORY_AUTH_REQUIRED = "true";
  process.env.AI_FACTORY_SESSION_SECRET = "0123456789abcdef0123456789abcdef";
  process.env.AI_FACTORY_REVIEWER_USERNAME = "reviewer";
  process.env.AI_FACTORY_REVIEWER_PASSWORD_HASH = "scrypt$abc$def";
  process.env.AI_FACTORY_AUTH_TEST_BYPASS_TOKEN = "test-bypass-token";
  process.env.AI_VALIDATOR_ENGAGEMENT_STORE = path.join(dir, "store.json");
  process.env.AI_VALIDATOR_REPORT_STORAGE_DIR = path.join(dir, "reports");
  process.env.GPUVALIDATOR_AGENT_TOKEN = agentToken;
  const app = await createPortalServerApp({ mountFrontend: false });
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    const address = server.address() as AddressInfo;
    await fn(`http://127.0.0.1:${address.port}`, process.env.AI_VALIDATOR_ENGAGEMENT_STORE, process.env.AI_VALIDATOR_REPORT_STORAGE_DIR);
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

async function seedLiveA100Validation(baseUrl: string) {
  const capabilities = ["nvidia_smi_list", "nvidia_smi_inventory", "nvidia_smi_topology", "cuda_version", "driver_version", "pytorch_gpu_count"].map((name) => ({ name, available: true, version: null }));
  const registered = await jsonRequest(baseUrl, "POST", "/api/v1/agents/register", { name: "runpod-a100x4-01", hostname: "3749527c40dd", gpu_count: 4, agent_version: "0.1.0", capabilities, metadata: { runpod_pod_id: "pod-live" } }, true);
  assert.equal(registered.response.status, 201, JSON.stringify(registered.payload));
  const agentId = registered.payload.agent.id;
  const created = await jsonRequest(baseUrl, "POST", "/api/v1/validations", { profile: "hardware-discovery", agent_id: agentId });
  assert.equal(created.response.status, 201, JSON.stringify(created.payload));
  for (const job of created.payload.jobs) {
    await jsonRequest(baseUrl, "POST", `/api/v1/agents/${agentId}/jobs/${job.id}/claim`, {}, true);
    await jsonRequest(baseUrl, "POST", `/api/v1/agents/${agentId}/jobs/${job.id}/running`, {}, true);
    const resultByType: Record<string, unknown> = {
      nvidia_smi_list: { state: "completed", stdout: "GPU 0: NVIDIA A100-SXM4-40GB (UUID: GPU-live-0)\nGPU 1: NVIDIA A100-SXM4-40GB (UUID: GPU-live-1)\nGPU 2: NVIDIA A100-SXM4-40GB (UUID: GPU-live-2)\nGPU 3: NVIDIA A100-SXM4-40GB (UUID: GPU-live-3)", structured_result: { gpus: [0, 1, 2, 3].map((index) => ({ index, model: "NVIDIA A100-SXM4-40GB", uuid: `GPU-live-${index}` })) } },
      nvidia_smi_inventory: { state: "completed", stdout: "0, NVIDIA A100-SXM4-40GB, GPU-live-0, 00000000:41:00.0, 40536, 535.104.05", structured_result: { gpus: [0, 1, 2, 3].map((index) => ({ index, name: "NVIDIA A100-SXM4-40GB", uuid: `GPU-live-${index}`, pci_bus_id: `00000000:${41 + index * 20}:00.0`, memory_total: "40536 MiB", driver_version: "535.104.05" })) } },
      nvidia_smi_topology: { state: "completed", stdout: "GPU0 GPU1 GPU2 GPU3\nGPU0 X NV4 NV4 NV4", structured_result: { topology: "NVLink matrix collected" } },
      cuda_version: { state: "completed", stdout: "Cuda compilation tools, release 12.2, V12.2.140", structured_result: { cuda_version: "12.2" } },
      driver_version: { state: "completed", stdout: "535.104.05", structured_result: { driver_version: "535.104.05" } },
      pytorch_gpu_count: { state: "completed", stdout: "4", structured_result: { gpu_count: 4 } },
    };
    await jsonRequest(baseUrl, "POST", `/api/v1/jobs/${job.id}/results`, { agent_id: agentId, exit_code: 0, ...(resultByType[job.command_type] as object) }, true);
  }
  return { agentId, validationId: created.payload.validation.id };
}

test("report generation uses live validation data, persists provenance, and downloads multiple formats", async () => {
  await withServer(async (baseUrl, _storePath, reportsDir) => {
    const { agentId, validationId } = await seedLiveA100Validation(baseUrl);

    const generated = await jsonRequest(baseUrl, "POST", "/api/v1/reports", {
      name: "RunPod A100 Customer Validation Report",
      report_type: "customer_validation",
      scope_type: "validation_run",
      scope_id: validationId,
      formats: ["html", "markdown", "json", "csv", "pdf", "docx"],
    });
    assert.equal(generated.response.status, 201, JSON.stringify(generated.payload));
    const report = generated.payload.report;
    assert.match(report.id, /^rpt_/);
    assert.equal(report.status, "generated");
    assert.equal(report.author_name, "Sabion P Frazier");
    assert.equal(report.purpose, "GPUValidator interview demonstration");
    assert.deepEqual(report.validation_ids, [validationId]);
    assert.deepEqual(report.agent_ids, [agentId]);
    assert.equal(report.source_counts.gpus, 4);
    assert.equal(report.checksum.length, 64);

    const history = await jsonRequest(baseUrl, "GET", "/api/v1/reports");
    assert.equal(history.response.status, 200);
    assert.equal(history.payload.reports[0].id, report.id);
    assert.equal(history.payload.reports[0].format_availability.pdf, true);
    assert.equal(fs.existsSync(path.join(reportsDir, report.id, `${report.slug}-v1.html`)), true);

    const html = await fetch(`${baseUrl}/api/v1/reports/${report.id}/download/html`, { headers: authHeader });
    assert.equal(html.status, 200);
    const htmlText = await html.text();
    assert.match(htmlText, /Generated by Sabion P Frazier/);
    assert.match(htmlText, /Purpose: GPUValidator interview demonstration/);
    assert.match(htmlText, /runpod-a100x4-01/);
    assert.match(htmlText, /NVIDIA A100-SXM4-40GB/);
    assert.match(htmlText, /GPU-live-3/);
    assert.match(htmlText, /Report Provenance/);

    for (const format of ["markdown", "json", "csv", "pdf", "docx"]) {
      const downloaded = await fetch(`${baseUrl}/api/v1/reports/${report.id}/download/${format}`, { headers: authHeader });
      assert.equal(downloaded.status, 200, format);
      const body = await downloaded.arrayBuffer();
      assert.ok(body.byteLength > 20, `${format} should contain persisted report content`);
    }
  });
});
