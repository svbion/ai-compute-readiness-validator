import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
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
    const recorded = await jsonRequest(baseUrl, "POST", `/api/v1/jobs/${job.id}/results`, { agent_id: agentId, exit_code: 0, ...(resultByType[job.command_type] as object) }, true);
    assert.equal(recorded.response.status, 200, JSON.stringify(recorded.payload));
  }
  return { agentId, validationId: created.payload.validation.id };
}

test("reports API creates a schema-first draft record with lineage and required defaults", async () => {
  await withServer(async (baseUrl, storePath) => {
    const { agentId, validationId } = await seedLiveA100Validation(baseUrl);

    const created = await jsonRequest(baseUrl, "POST", "/api/v1/reports", {
      name: "RunPod A100 Customer Validation Report",
      report_type: "customer-validation",
      scope_type: "validation_run",
      scope_id: validationId,
      customer: "NVIDIA interview demo",
      engagement_id: "eng_demo",
      cluster_id: "cluster_runpod_a100",
      confidentiality: "Confidential",
      time_range: "Last 24 hours",
      finding_ids: ["finding-ecc-warning"],
      include_evidence: true,
      include_raw_logs: false,
      include_charts: true,
      include_appendices: true,
      reviewer: "Technical reviewer",
      notes: "Draft notes are preserved for the report builder.",
    });

    assert.equal(created.response.status, 201, JSON.stringify(created.payload));
    const report = created.payload.report;
    assert.match(report.report_id, /^rpt_/);
    assert.equal(report.name, "RunPod A100 Customer Validation Report");
    assert.equal(report.report_type, "customer-validation");
    assert.equal(report.status, "draft");
    assert.equal(report.scope_type, "validation_run");
    assert.equal(report.scope_id, validationId);
    assert.equal(report.customer, "NVIDIA interview demo");
    assert.equal(report.engagement_id, "eng_demo");
    assert.equal(report.cluster_id, "cluster_runpod_a100");
    assert.deepEqual(report.agent_ids, [agentId]);
    assert.deepEqual(report.validation_ids, [validationId]);
    assert.deepEqual(report.gpu_ids, ["GPU-live-0", "GPU-live-1", "GPU-live-2", "GPU-live-3"]);
    assert.equal(report.author_name, "Sabion P Frazier");
    assert.equal(report.purpose, "GPUValidator interview demonstration");
    assert.equal(report.time_range, "Last 24 hours");
    assert.deepEqual(report.finding_ids, ["finding-ecc-warning"]);
    assert.equal(report.include_evidence, true);
    assert.equal(report.include_raw_logs, false);
    assert.equal(report.include_charts, true);
    assert.equal(report.include_appendices, true);
    assert.equal(report.reviewer, "Technical reviewer");
    assert.equal(report.notes, "Draft notes are preserved for the report builder.");
    assert.equal(report.version, 1);
    assert.equal(report.generated_at, null);
    assert.equal(report.error, null);
    assert.match(report.checksum, /^[a-f0-9]{64}$/);
    assert.ok(Date.parse(report.created_at));
    assert.ok(Date.parse(report.updated_at));

    const storeDoc = JSON.parse(fs.readFileSync(storePath, "utf8"));
    assert.equal(storeDoc.reports[0].report_id, report.report_id);
    assert.deepEqual(storeDoc.reports[0].validation_ids, [validationId]);
  });
});

test("reports API lists, reads, patches, and deletes reports by reportId", async () => {
  await withServer(async (baseUrl) => {
    const created = await jsonRequest(baseUrl, "POST", "/api/v1/reports", {
      name: "Management Status",
      report_type: "management-status",
      scope_type: "cluster",
      scope_id: "cluster-1",
      validation_ids: ["val_manual"],
      benchmark_ids: ["bmk_manual"],
      agent_ids: ["agt_manual"],
      node_ids: ["node-1"],
      gpu_ids: ["GPU-manual"],
      evidence_ids: ["evd_manual"],
    });
    assert.equal(created.response.status, 201, JSON.stringify(created.payload));
    const reportId = created.payload.report.report_id;

    const listed = await jsonRequest(baseUrl, "GET", "/api/v1/reports");
    assert.equal(listed.response.status, 200);
    assert.deepEqual(listed.payload.reports.map((item: any) => item.report_id), [reportId]);

    const read = await jsonRequest(baseUrl, "GET", `/api/v1/reports/${reportId}`);
    assert.equal(read.response.status, 200);
    assert.equal(read.payload.report.report_id, reportId);

    const patched = await jsonRequest(baseUrl, "PATCH", `/api/v1/reports/${reportId}`, {
      status: "approved",
      confidentiality: "Customer Confidential",
      version: 2,
      generated_at: "2026-07-21T10:00:00.000Z",
      checksum: "b".repeat(64),
    });
    assert.equal(patched.response.status, 200, JSON.stringify(patched.payload));
    assert.equal(patched.payload.report.status, "approved");
    assert.equal(patched.payload.report.confidentiality, "Customer Confidential");
    assert.equal(patched.payload.report.version, 2);
    assert.equal(patched.payload.report.generated_at, "2026-07-21T10:00:00.000Z");
    assert.equal(patched.payload.report.checksum, "b".repeat(64));

    const deleted = await jsonRequest(baseUrl, "DELETE", `/api/v1/reports/${reportId}`);
    assert.equal(deleted.response.status, 204);

    const missing = await jsonRequest(baseUrl, "GET", `/api/v1/reports/${reportId}`);
    assert.equal(missing.response.status, 404);
    assert.equal(missing.payload.error.code, "report_not_found");
  });
});

test("reports API validates request bodies and returns field-level errors", async () => {
  await withServer(async (baseUrl) => {
    const invalid = await jsonRequest(baseUrl, "POST", "/api/v1/reports", {
      name: "",
      report_type: "mlperf-benchmark",
      status: "done",
      scope_type: "cluster",
      agent_ids: "agt_1",
    });
    assert.equal(invalid.response.status, 400);
    assert.equal(invalid.payload.error.code, "invalid_report_request");
    assert.deepEqual(invalid.payload.error.details.map((item: any) => item.field), ["name", "report_type", "status", "agent_ids"]);

    const created = await jsonRequest(baseUrl, "POST", "/api/v1/reports", {
      name: "Valid draft",
      report_type: "executive-summary",
      scope_type: "customer",
      scope_id: "customer-1",
    });
    assert.equal(created.response.status, 201, JSON.stringify(created.payload));

    const forbidden = await jsonRequest(baseUrl, "PATCH", `/api/v1/reports/${created.payload.report.report_id}`, { report_id: "rpt_other", created_at: "2026-01-01T00:00:00.000Z" });
    assert.equal(forbidden.response.status, 400);
    assert.deepEqual(forbidden.payload.error.details.map((item: any) => item.field), ["report_id", "created_at"]);
  });
});

test("report preview route renders and persists professional HTML with source lineage", async () => {
  await withServer(async (baseUrl, storePath, reportsDir) => {
    const { agentId, validationId } = await seedLiveA100Validation(baseUrl);
    const created = await jsonRequest(baseUrl, "POST", "/api/v1/reports", {
      name: "RunPod A100 HTML Preview",
      report_type: "customer-validation",
      scope_type: "validation_run",
      scope_id: validationId,
      customer: "NVIDIA interview demo",
      engagement_id: "eng_demo",
      benchmark_ids: ["bmk_selected"],
      include_evidence: true,
      include_appendices: true,
    });
    assert.equal(created.response.status, 201, JSON.stringify(created.payload));
    const reportId = created.payload.report.report_id;

    const response = await fetch(`${baseUrl}/portal/reports/${reportId}/preview`, { headers: authHeader });
    const html = await response.text();
    assert.equal(response.status, 200, html);
    assert.match(response.headers.get("content-type") ?? "", /text\/html/);
    for (const section of ["Cover Page", "Document Control", "Generated By", "Purpose", "Executive Summary", "Environment Summary", "Hardware Inventory", "GPU Inventory", "Validation Results", "Benchmark Results", "Findings", "Risks", "Recommended Remediation", "Evidence References", "Report Provenance", "Appendices"]) {
      assert.match(html, new RegExp(section), `${section} should render in preview`);
    }
    for (const actual of ["Generated by Sabion P Frazier", "Purpose: GPUValidator interview demonstration", "NVIDIA A100-SXM4-40GB", "GPU-live-0", validationId, agentId, "Not collected", "Not available", "Not supported", "Validation not run"]) {
      assert.match(html, new RegExp(actual.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${actual} should be visible`);
    }
    assert.doesNotMatch(html, /Download PDF|Download DOCX/);

    const storeDoc = JSON.parse(fs.readFileSync(storePath, "utf8"));
    const persisted = storeDoc.reports.find((report: any) => report.report_id === reportId);
    assert.equal(persisted.status, "generated");
    assert.ok(Date.parse(persisted.generated_at));
    assert.ok(Date.parse(persisted.html_generated_at));
    assert.match(persisted.html_artifact_path, new RegExp(`${reportId}\\.html$`));
    assert.ok(persisted.html_artifact_path.startsWith(reportsDir));
    assert.ok(fs.existsSync(persisted.html_artifact_path));
    assert.match(fs.readFileSync(persisted.html_artifact_path, "utf8"), /Report Provenance/);
  });
});

test("reports API generates persists and downloads a valid server-side PDF artifact", async () => {
  await withServer(async (baseUrl, storePath, reportsDir) => {
    const { agentId, validationId } = await seedLiveA100Validation(baseUrl);
    const created = await jsonRequest(baseUrl, "POST", "/api/v1/reports", {
      name: "RunPod A100 Executive PDF",
      report_type: "executive-summary",
      scope_type: "validation_run",
      scope_id: validationId,
      customer: "NVIDIA interview demo",
      engagement_id: "eng_demo",
      cluster_id: "cluster_runpod_a100",
      confidentiality: "Customer Confidential",
      version: 3,
    });
    assert.equal(created.response.status, 201, JSON.stringify(created.payload));
    const reportId = created.payload.report.report_id;

    const generated = await jsonRequest(baseUrl, "POST", `/api/v1/reports/${reportId}/generate/pdf`);
    assert.equal(generated.response.status, 200, JSON.stringify(generated.payload));
    assert.equal(generated.payload.report.pdf_mime_type, "application/pdf");
    assert.match(generated.payload.report.pdf_artifact_path, /gpuvalidator_executive-summary_cluster_runpod_a100_\d{8}_v3\.pdf$/);
    assert.ok(generated.payload.report.pdf_artifact_path.startsWith(reportsDir));
    assert.ok(generated.payload.report.pdf_size_bytes > 1000);
    assert.match(generated.payload.report.pdf_sha256, /^[a-f0-9]{64}$/);
    assert.ok(Date.parse(generated.payload.report.pdf_generated_at));
    assert.equal(generated.payload.report.pdf_template_version, "1.0.0");
    assert.equal(generated.payload.report.error, null);
    assert.deepEqual(generated.payload.report.validation_ids, [validationId]);
    assert.deepEqual(generated.payload.report.agent_ids, [agentId]);

    const pdfPath = generated.payload.report.pdf_artifact_path;
    assert.ok(fs.existsSync(pdfPath));
    const pdf = fs.readFileSync(pdfPath);
    assert.equal(pdf.subarray(0, 5).toString("ascii"), "%PDF-");
    assert.equal(crypto.createHash("sha256").update(pdf).digest("hex"), generated.payload.report.pdf_sha256);
    assert.equal(pdf.length, generated.payload.report.pdf_size_bytes);
    assert.match(pdf.toString("latin1"), /GPUValidator|Sabion|Confidential|Page/);

    const downloaded = await fetch(`${baseUrl}/api/v1/reports/${reportId}/download/pdf`, { headers: authHeader });
    const downloadedPdf = Buffer.from(await downloaded.arrayBuffer());
    assert.equal(downloaded.status, 200);
    assert.match(downloaded.headers.get("content-type") ?? "", /application\/pdf/);
    assert.match(downloaded.headers.get("content-disposition") ?? "", /attachment; filename="gpuvalidator_executive-summary_cluster_runpod_a100_\d{8}_v3\.pdf"/);
    assert.equal(downloadedPdf.subarray(0, 5).toString("ascii"), "%PDF-");
    assert.equal(downloadedPdf.length, pdf.length);

    const storeDoc = JSON.parse(fs.readFileSync(storePath, "utf8"));
    const persisted = storeDoc.reports.find((report: any) => report.report_id === reportId);
    assert.equal(persisted.pdf_artifact_path, pdfPath);
    assert.equal(persisted.pdf_mime_type, "application/pdf");
    assert.equal(persisted.pdf_size_bytes, pdf.length);
    assert.equal(persisted.pdf_sha256, generated.payload.report.pdf_sha256);
    assert.ok(Date.parse(persisted.pdf_generated_at));
    assert.equal(persisted.pdf_template_version, "1.0.0");
  });
});

test("reports API returns detailed PDF diagnostics when download or generation cannot complete", async () => {
  await withServer(async (baseUrl) => {
    const created = await jsonRequest(baseUrl, "POST", "/api/v1/reports", {
      name: "PDF diagnostics",
      report_type: "management-status",
      scope_type: "cluster",
      scope_id: "cluster-diag",
    });
    assert.equal(created.response.status, 201, JSON.stringify(created.payload));
    const reportId = created.payload.report.report_id;

    const missingDownload = await fetch(`${baseUrl}/api/v1/reports/${reportId}/download/pdf`, { headers: authHeader });
    const missingPayload = await missingDownload.json();
    assert.equal(missingDownload.status, 409);
    assert.equal(missingPayload.error.code, "pdf_not_generated");
    assert.match(missingPayload.error.message, /Generate the PDF/);
    assert.deepEqual(missingPayload.error.details.map((item: any) => item.field), ["pdf_artifact_path"]);

    const missingReport = await jsonRequest(baseUrl, "POST", "/api/v1/reports/not-a-report/generate/pdf");
    assert.equal(missingReport.response.status, 404);
    assert.equal(missingReport.payload.error.code, "report_not_found");
  });
});
