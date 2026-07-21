import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import express from "express";
import type { EngagementStore } from "./engagements";
import { deriveLiveGpuInventory } from "../portal/agents";

export const REPORT_SCHEMA_VERSION = "1.0.0";
export const REPORT_TEMPLATE_VERSION = "1.0.0";

export const reportTypes = [
  "executive_summary", "customer_validation", "technical_infrastructure", "gpu_health", "gpu_inventory", "cluster_readiness", "node_validation", "individual_gpu", "nccl_benchmark", "hpl_benchmark", "mlperf_benchmark", "performance_regression", "incident_root_cause", "remediation_plan", "acceptance_test", "deployment_readiness", "evidence_audit", "management_status", "weekly_operations", "customer_handoff",
] as const;
export const reportStatuses = ["draft", "generating", "generated", "failed", "approved", "archived"] as const;
export const reportFormats = ["html", "markdown", "json", "csv", "pdf", "docx"] as const;
export const scopeTypes = ["organization", "customer", "engagement", "site", "datacenter", "cluster", "agent", "node", "gpu", "gpu_group", "validation_run", "benchmark_run", "incident", "alert", "comparison_period", "custom"] as const;

export type ReportType = typeof reportTypes[number];
export type ReportStatus = typeof reportStatuses[number];
export type ReportFormat = typeof reportFormats[number];
export type ReportScopeType = typeof scopeTypes[number];

export interface ReportRecord {
  id: string;
  schema_version: string;
  name: string;
  slug: string;
  report_type: ReportType;
  status: ReportStatus;
  version: number;
  template_version: string;
  scope_type: ReportScopeType;
  scope_id: string | null;
  customer: string | null;
  engagement: string | null;
  author_name: string;
  purpose: string;
  confidentiality: string;
  reviewer: string | null;
  approval_status: string;
  notes: string;
  created_at: string;
  generated_at: string;
  modified_at: string;
  checksum: string;
  validation_ids: string[];
  benchmark_ids: string[];
  agent_ids: string[];
  node_ids: string[];
  gpu_ids: string[];
  evidence_ids: string[];
  source_timestamps: string[];
  source_counts: { agents: number; nodes: number; gpus: number; validations: number; benchmarks: number; evidence: number };
  formats: Record<ReportFormat, { filename: string; content_type: string; bytes: number; checksum: string } | null>;
}

type StoreDoc = Record<string, any>;

type ReportSource = {
  agents: any[];
  validations: any[];
  benchmarks: any[];
  evidence: any[];
  inventory: ReturnType<typeof deriveLiveGpuInventory>;
  selectedValidationIds: string[];
  selectedBenchmarkIds: string[];
};

const formatContentType: Record<ReportFormat, string> = {
  html: "text/html; charset=utf-8",
  markdown: "text/markdown; charset=utf-8",
  json: "application/json; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
const formatExtension: Record<ReportFormat, string> = { html: "html", markdown: "md", json: "json", csv: "csv", pdf: "pdf", docx: "docx" };

function nowIso() { return new Date().toISOString(); }
function id(prefix: string) { return `${prefix}_${crypto.randomUUID()}`; }
function sha256(value: Buffer | string) { return crypto.createHash("sha256").update(value).digest("hex"); }
function storageRoot() { return process.env.AI_VALIDATOR_REPORT_STORAGE_DIR ?? path.join(process.cwd(), "artifacts", "reports"); }
function ensureDoc(store: EngagementStore): StoreDoc {
  const doc = store.read() as StoreDoc;
  doc.reports = Array.isArray(doc.reports) ? doc.reports : [];
  return doc;
}
function writeDoc(store: EngagementStore, doc: StoreDoc) { (store as any).write(doc); }
function isOneOf<T extends readonly string[]>(values: T, value: unknown): value is T[number] { return typeof value === "string" && values.includes(value as T[number]); }
function slugify(value: string) { return (value || "gpuvalidator-report").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "gpuvalidator-report"; }
function escapeHtml(value: unknown): string { return String(value ?? "Not available").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] ?? char)); }
function csvCell(value: unknown): string { const text = String(value ?? "Not available"); return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
function safeFormats(value: unknown): ReportFormat[] {
  const requested = Array.isArray(value) ? value : ["html", "markdown", "json", "csv", "pdf", "docx"];
  const formats = requested.filter((item): item is ReportFormat => isOneOf(reportFormats, item));
  return formats.length ? [...new Set(formats)] : ["html"];
}
function reportDirectory(reportId: string) { return path.join(storageRoot(), reportId); }

function resolveSources(document: StoreDoc, scopeType: ReportScopeType, scopeId: string | null): ReportSource {
  const agents = Array.isArray(document.validation_agents) ? document.validation_agents : [];
  const validations = Array.isArray(document.validations) ? document.validations : [];
  const validationJobs = Array.isArray(document.validation_jobs) ? document.validation_jobs : [];
  const validationResults = Array.isArray(document.validation_results) ? document.validation_results : [];
  const benchmarks = Array.isArray(document.benchmark_runs) ? document.benchmark_runs : [];
  const evidence = Array.isArray(document.evidence_records) ? document.evidence_records : [];

  const validationDetails = validations.map((validation: any) => ({
    validation,
    jobs: validationJobs.filter((job: any) => job.validation_id === validation.id),
    results: validationResults.filter((result: any) => result.validation_id === validation.id),
  }));

  let selectedValidations = validationDetails;
  let selectedBenchmarks = benchmarks;
  if (scopeType === "validation_run" && scopeId) selectedValidations = validationDetails.filter((detail: any) => detail.validation.id === scopeId);
  if (scopeType === "agent" && scopeId) selectedValidations = validationDetails.filter((detail: any) => detail.validation.agent_id === scopeId);
  if (scopeType === "benchmark_run" && scopeId) selectedBenchmarks = benchmarks.filter((run: any) => run.id === scopeId);
  if (scopeType === "gpu" && scopeId) selectedValidations = validationDetails.filter((detail: any) => JSON.stringify(detail).includes(scopeId));

  const selectedAgentIds = new Set(selectedValidations.map((detail: any) => detail.validation.agent_id));
  const scopedAgents = scopeType === "agent" && scopeId ? agents.filter((agent: any) => agent.id === scopeId) : agents.filter((agent: any) => selectedAgentIds.has(agent.id) || scopeType !== "validation_run");
  const inventory = deriveLiveGpuInventory(scopedAgents, selectedValidations);
  return { agents: scopedAgents, validations: selectedValidations, benchmarks: selectedBenchmarks, evidence, inventory, selectedValidationIds: selectedValidations.map((detail: any) => detail.validation.id), selectedBenchmarkIds: selectedBenchmarks.map((run: any) => run.id) };
}

function unavailable(value: unknown): string { return value === null || value === undefined || value === "" ? "Not collected" : String(value); }
function reportTitle(type: ReportType) { return type.split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" "); }

function buildMarkdown(record: Omit<ReportRecord, "checksum" | "formats">, source: ReportSource): string {
  const lines: string[] = [];
  lines.push(`# ${record.name}`);
  lines.push("");
  lines.push("GPUValidator");
  lines.push(`Generated by ${record.author_name}`);
  lines.push(`Purpose: ${record.purpose}`);
  lines.push(`Generated Date: ${record.generated_at}`);
  lines.push(`Confidentiality: ${record.confidentiality}`);
  lines.push("");
  lines.push("## Document Control");
  lines.push(`- Report ID: ${record.id}`);
  lines.push(`- Report type: ${reportTitle(record.report_type)}`);
  lines.push(`- Version: ${record.version}`);
  lines.push(`- Generated by ${record.author_name}`);
  lines.push(`- Purpose: ${record.purpose}`);
  lines.push(`- Approval status: ${record.approval_status}`);
  lines.push("");
  lines.push("## Executive Summary");
  lines.push(`This ${reportTitle(record.report_type)} summarizes the selected ${record.scope_type.replace(/_/g, " ")} scope using persisted GPUValidator source records. No measurements are fabricated; unavailable fields are labeled Not collected, Not available, Not supported, Validation not run, or Not applicable.`);
  lines.push("");
  lines.push("## Environment Summary");
  lines.push(`- Agents: ${source.agents.length}`);
  lines.push(`- Nodes: ${new Set(source.agents.map((agent) => agent.hostname).filter(Boolean)).size}`);
  lines.push(`- GPUs: ${source.inventory.length}`);
  lines.push(`- Validations: ${source.validations.length}`);
  lines.push(`- Benchmarks: ${source.benchmarks.length}`);
  lines.push(`- Evidence records: ${source.evidence.length}`);
  for (const agent of source.agents) {
    lines.push(`- Agent ${unavailable(agent.name)} / ${unavailable(agent.hostname)}: ${unavailable(agent.status)}, last heartbeat ${unavailable(agent.last_heartbeat_at)}, ${unavailable(agent.gpu_count)} GPUs`);
  }
  lines.push("");
  lines.push("## GPU Inventory");
  if (!source.inventory.length) lines.push("Validation not run or no GPU identity was collected.");
  for (const gpu of source.inventory) {
    lines.push(`- ${unavailable(gpu.nodeName)} GPU ${unavailable(gpu.gpuIndex)}: ${unavailable(gpu.model)}, UUID ${unavailable(gpu.uuid)}, driver ${unavailable(gpu.driverVersion)}, CUDA ${unavailable(gpu.cudaVersion)}, PCIe ${unavailable(gpu.pciBusId)}, memory ${unavailable(gpu.memoryTotal)}, validation ${unavailable(gpu.validationStatus)}`);
  }
  lines.push("");
  lines.push("## Validation Results");
  for (const detail of source.validations) {
    lines.push(`- ${detail.validation.id}: ${detail.validation.profile} ${detail.validation.state}; created ${detail.validation.created_at}; completed ${unavailable(detail.validation.completed_at)}; jobs ${detail.jobs.length}; results ${detail.results.length}`);
    for (const result of detail.results) lines.push(`  - ${result.command_evidence?.command_type ?? "command"}: ${result.state}; exit ${unavailable(result.exit_code)}; command ${(result.command_evidence?.argv ?? []).join(" ") || "Not available"}`);
  }
  if (!source.validations.length) lines.push("Validation not run.");
  lines.push("");
  lines.push("## Benchmark Results");
  if (!source.benchmarks.length) lines.push("Not collected. NCCL, HPL, MLPerf, and inference benchmark reports show Not collected until benchmark evidence is uploaded or a live smoke result completes.");
  for (const run of source.benchmarks) lines.push(`- ${run.id}: ${run.benchmark_type} ${run.status}; collected ${run.collected_at}; metrics ${JSON.stringify(run.metrics)}`);
  lines.push("");
  lines.push("## Findings, Risks, and Remediation");
  const failures = source.validations.flatMap((detail: any) => detail.results.filter((result: any) => result.state !== "completed"));
  if (!failures.length) lines.push("No failed command results were found in the selected source records. Continue operational review for unsupported or not-collected validations.");
  for (const result of failures) lines.push(`- ${result.command_evidence?.command_type}: ${result.state}. Remediation: review stderr/raw evidence, agent capability, command timeout, and platform dependency before rerun.`);
  lines.push("");
  lines.push("## Evidence");
  for (const detail of source.validations) for (const result of detail.results) lines.push(`- Evidence ${result.id}: ${result.command_evidence?.command_type}; stdout_sha256=${unavailable(result.command_evidence?.stdout_sha256)}; stderr_sha256=${unavailable(result.command_evidence?.stderr_sha256)}; output_truncated=${result.output_truncated}`);
  if (!source.validations.some((detail: any) => detail.results.length)) lines.push("Not collected.");
  lines.push("");
  lines.push("## Report Provenance");
  lines.push(`- report_id: ${record.id}`);
  lines.push(`- template_version: ${record.template_version}`);
  lines.push(`- validation_ids: ${record.validation_ids.join(", ") || "Not applicable"}`);
  lines.push(`- benchmark_ids: ${record.benchmark_ids.join(", ") || "Not applicable"}`);
  lines.push(`- agent_ids: ${record.agent_ids.join(", ") || "Not applicable"}`);
  lines.push(`- gpu_ids: ${record.gpu_ids.join(", ") || "Not applicable"}`);
  lines.push(`- generation timestamp: ${record.generated_at}`);
  lines.push(`- author: ${record.author_name}`);
  lines.push("");
  lines.push(`Generated by ${record.author_name}`);
  lines.push(`Purpose: ${record.purpose}`);
  return `${lines.join(os.EOL)}${os.EOL}`;
}

function markdownToHtml(markdown: string, title: string): string {
  const body = markdown.split(/\r?\n/).map((line) => {
    if (line.startsWith("# ")) return `<h1>${escapeHtml(line.slice(2))}</h1>`;
    if (line.startsWith("## ")) return `<h2>${escapeHtml(line.slice(3))}</h2>`;
    if (line.startsWith("- ")) return `<div class="li">${escapeHtml(line.slice(2))}</div>`;
    if (line.startsWith("  - ")) return `<div class="li child">${escapeHtml(line.slice(4))}</div>`;
    if (!line.trim()) return "<br />";
    return `<p>${escapeHtml(line)}</p>`;
  }).join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:Inter,Arial,sans-serif;color:#0f172a;margin:0;background:#f8fafc}.cover{background:#020617;color:#f8fafc;padding:56px;border-bottom:6px solid #76b900}.content{padding:40px;max-width:980px;margin:auto;background:white}h1{font-size:34px}h2{margin-top:32px;border-bottom:1px solid #dbe3ee;padding-bottom:8px}.li{padding:5px 0 5px 20px}.li:before{content:'• ';color:#76b900}.child{padding-left:40px;color:#334155}.footer{padding:24px 40px;color:#475569;border-top:1px solid #dbe3ee}</style></head><body><section class="cover"><div>GPUValidator</div><h1>${escapeHtml(title)}</h1><p>Generated by Sabion P Frazier</p><p>Purpose: GPUValidator interview demonstration</p></section><main class="content">${body}</main><footer class="footer">Generated by Sabion P Frazier • Purpose: GPUValidator interview demonstration • GPUValidator</footer></body></html>`;
}

function buildCsv(source: ReportSource): string {
  const rows = [["scope", "node", "gpu_index", "model", "uuid", "driver", "cuda", "pcie", "memory", "validation_status"]];
  if (!source.inventory.length) rows.push(["Not collected", "Not collected", "Not collected", "Not collected", "Not collected", "Not collected", "Not collected", "Not collected", "Not collected", "Validation not run"]);
  for (const gpu of source.inventory) rows.push(["gpu", gpu.nodeName, String(gpu.gpuIndex ?? "Not collected"), gpu.model ?? "Not collected", gpu.uuid ?? "Not collected", gpu.driverVersion ?? "Not collected", gpu.cudaVersion ?? "Not collected", gpu.pciBusId ?? "Not collected", gpu.memoryTotal ?? "Not collected", gpu.validationStatus]);
  return `${rows.map((row) => row.map(csvCell).join(",")).join(os.EOL)}${os.EOL}`;
}

function buildPdf(markdown: string): Buffer {
  const text = markdown.replace(/[()\\]/g, "\\$&").split(/\r?\n/).slice(0, 80).join("\\n");
  const stream = `BT /F1 10 Tf 40 780 Td (${text}) Tj ET`;
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${Buffer.byteLength(stream)} >> stream\n${stream}\nendstream endobj`,
  ];
  const header = "%PDF-1.4\n";
  let offset = Buffer.byteLength(header);
  const xref = ["0000000000 65535 f "];
  const body = objects.map((object) => { const current = offset; offset += Buffer.byteLength(`${object}\n`); xref.push(`${String(current).padStart(10, "0")} 00000 n `); return object; }).join("\n") + "\n";
  const trailer = `xref\n0 ${xref.length}\n${xref.join("\n")}\ntrailer << /Size ${xref.length} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`;
  return Buffer.from(header + body + trailer, "utf8");
}

function buildDocxLikeHtml(html: string): Buffer {
  return Buffer.from(`<!doctype html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>GPUValidator Report</title></head><body>${html}</body></html>`, "utf8");
}

function writeFormats(record: Omit<ReportRecord, "checksum" | "formats">, source: ReportSource, formats: ReportFormat[]) {
  const dir = reportDirectory(record.id);
  fs.mkdirSync(dir, { recursive: true });
  const markdown = buildMarkdown(record, source);
  const html = markdownToHtml(markdown, record.name);
  const json = `${JSON.stringify({ report: record, sources: { agents: source.agents, validations: source.validations, benchmarks: source.benchmarks, evidence: source.evidence, gpu_inventory: source.inventory } }, null, 2)}\n`;
  const csv = buildCsv(source);
  const contents: Record<ReportFormat, Buffer | string> = { html, markdown, json, csv, pdf: buildPdf(markdown), docx: buildDocxLikeHtml(html) };
  const availability = Object.fromEntries(reportFormats.map((format) => [format, null])) as ReportRecord["formats"];
  const combined = crypto.createHash("sha256");
  for (const format of formats) {
    const filename = `${record.slug}-v${record.version}.${formatExtension[format]}`;
    const fullPath = path.join(dir, filename);
    const body = contents[format];
    fs.writeFileSync(fullPath, body, { mode: 0o600 });
    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
    const digest = sha256(buffer);
    combined.update(digest);
    availability[format] = { filename, content_type: formatContentType[format], bytes: buffer.length, checksum: digest };
  }
  return { formats: availability, checksum: combined.digest("hex") };
}

function publicReport(record: ReportRecord) {
  return { ...record, format_availability: Object.fromEntries(reportFormats.map((format) => [format, Boolean(record.formats[format])])) };
}

function makeReport(document: StoreDoc, input: Record<string, unknown>): { record: ReportRecord; source: ReportSource; requestedFormats: ReportFormat[] } {
  const name = String(input.name ?? "GPUValidator Report").trim().slice(0, 160) || "GPUValidator Report";
  const report_type = isOneOf(reportTypes, input.report_type) ? input.report_type : "customer_validation";
  const scope_type = isOneOf(scopeTypes, input.scope_type) ? input.scope_type : "validation_run";
  const scope_id = input.scope_id === undefined || input.scope_id === null || input.scope_id === "" ? null : String(input.scope_id).slice(0, 160);
  const source = resolveSources(document, scope_type, scope_id);
  const timestamp = nowIso();
  const agentIds = [...new Set(source.agents.map((agent: any) => agent.id).filter(Boolean))];
  const nodeIds = [...new Set(source.agents.map((agent: any) => agent.hostname).filter(Boolean))];
  const gpuIds = [...new Set(source.inventory.map((gpu) => gpu.uuid ?? gpu.id).filter(Boolean))];
  const evidenceIds = [...new Set(source.validations.flatMap((detail: any) => detail.results.map((result: any) => result.id)))];
  const sourceTimestamps = [...new Set([
    ...source.agents.map((agent: any) => agent.last_heartbeat_at),
    ...source.validations.map((detail: any) => detail.validation.completed_at ?? detail.validation.created_at),
    ...source.benchmarks.map((run: any) => run.collected_at),
    ...source.evidence.map((record: any) => record.collected_at),
  ].filter(Boolean).map(String))];
  const base: Omit<ReportRecord, "checksum" | "formats"> = {
    id: id("rpt"), schema_version: REPORT_SCHEMA_VERSION, name, slug: slugify(name), report_type, status: "generated", version: 1, template_version: REPORT_TEMPLATE_VERSION, scope_type, scope_id,
    customer: input.customer ? String(input.customer).slice(0, 160) : null,
    engagement: input.engagement ? String(input.engagement).slice(0, 160) : null,
    author_name: String(input.author_name ?? "Sabion P Frazier").trim().slice(0, 120) || "Sabion P Frazier",
    purpose: String(input.purpose ?? "GPUValidator interview demonstration").trim().slice(0, 240) || "GPUValidator interview demonstration",
    confidentiality: String(input.confidentiality ?? "Confidential").trim().slice(0, 80) || "Confidential",
    reviewer: input.reviewer ? String(input.reviewer).slice(0, 120) : null,
    approval_status: String(input.approval_status ?? "Draft").slice(0, 80),
    notes: String(input.notes ?? "").slice(0, 2000),
    created_at: timestamp, generated_at: timestamp, modified_at: timestamp,
    validation_ids: source.selectedValidationIds, benchmark_ids: source.selectedBenchmarkIds, agent_ids: agentIds, node_ids: nodeIds, gpu_ids: gpuIds, evidence_ids: evidenceIds, source_timestamps: sourceTimestamps,
    source_counts: { agents: source.agents.length, nodes: nodeIds.length, gpus: source.inventory.length, validations: source.validations.length, benchmarks: source.benchmarks.length, evidence: evidenceIds.length },
  };
  const requestedFormats = safeFormats(input.formats);
  const rendered = writeFormats(base, source, requestedFormats);
  return { record: { ...base, checksum: rendered.checksum, formats: rendered.formats }, source, requestedFormats };
}

function errorResponse(res: express.Response, status: number, message: string) {
  return res.status(status).set("Cache-Control", "no-store").json({ error: message, error_id: `err_${crypto.randomBytes(8).toString("hex")}` });
}

export function registerReportRoutes(app: express.Express, store: EngagementStore) {
  app.get("/api/v1/reports/templates", (_req, res) => {
    return res.set("Cache-Control", "no-store").json({ templates: reportTypes.map((type) => ({ id: type, name: reportTitle(type), template_version: REPORT_TEMPLATE_VERSION, supported_scopes: scopeTypes, default_sections: ["Cover Page", "Document Control", "Executive Summary", "Environment Summary", "GPU Inventory", "Validation Results", "Benchmark Results", "Findings", "Evidence", "Report Provenance", "Signoff"] })) });
  });

  app.get("/api/v1/reports", (_req, res) => {
    const document = ensureDoc(store);
    const reports = (document.reports as ReportRecord[]).slice().sort((left, right) => String(right.modified_at).localeCompare(String(left.modified_at))).map(publicReport);
    return res.set("Cache-Control", "no-store").json({ reports });
  });

  app.post("/api/v1/reports", (req, res) => {
    try {
      const document = ensureDoc(store);
      const { record } = makeReport(document, req.body ?? {});
      document.reports.push(record);
      writeDoc(store, document);
      return res.status(201).set("Cache-Control", "no-store").json({ report: publicReport(record) });
    } catch (error) {
      return errorResponse(res, 400, error instanceof Error ? error.message : "Report generation failed.");
    }
  });

  app.get("/api/v1/reports/:reportId", (req, res) => {
    const document = ensureDoc(store);
    const report = (document.reports as ReportRecord[]).find((candidate) => candidate.id === req.params.reportId);
    if (!report) return errorResponse(res, 404, "Report not found.");
    return res.set("Cache-Control", "no-store").json({ report: publicReport(report) });
  });

  app.get("/api/v1/reports/:reportId/download/:format", (req, res) => {
    const format = req.params.format as ReportFormat;
    if (!isOneOf(reportFormats, format)) return errorResponse(res, 400, "Unsupported report format.");
    const document = ensureDoc(store);
    const report = (document.reports as ReportRecord[]).find((candidate) => candidate.id === req.params.reportId);
    if (!report) return errorResponse(res, 404, "Report not found.");
    const artifact = report.formats[format];
    if (!artifact) return errorResponse(res, 404, "Requested report format was not generated.");
    const fullPath = path.join(reportDirectory(report.id), artifact.filename);
    const resolved = path.resolve(fullPath);
    const root = path.resolve(reportDirectory(report.id));
    if (!resolved.startsWith(root + path.sep) || !fs.existsSync(resolved)) return errorResponse(res, 404, "Report artifact not found.");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", artifact.content_type);
    res.setHeader("Content-Disposition", `attachment; filename=\"${artifact.filename}\"`);
    return res.sendFile(resolved);
  });
}
