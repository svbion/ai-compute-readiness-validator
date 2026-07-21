import crypto from "crypto";
import express from "express";
import fs from "fs";
import path from "path";
import type { EngagementStore } from "./engagements";
import { deriveLiveGpuInventory } from "../portal/agents";
import { DOCX_MIME_TYPE, DOCX_TEMPLATE_VERSION, generateDocxReport } from "./docx-renderer";
import { generatePdfReport, PDF_MIME_TYPE, PDF_TEMPLATE_VERSION } from "./pdf-renderer";
import { renderHtmlReport } from "./report-renderer";

export const REPORT_SCHEMA_VERSION = "1.0.0";

export const reportTypes = [
  "executive-summary",
  "customer-validation",
  "technical-infrastructure",
  "gpu-inventory",
  "cluster-readiness",
  "node-validation",
  "individual-gpu",
  "nccl-benchmark",
  "management-status",
] as const;

export const reportStatuses = ["draft", "generating", "generated", "failed", "approved", "archived"] as const;

export const scopeTypes = [
  "organization",
  "customer",
  "engagement",
  "site",
  "datacenter",
  "cluster",
  "agent",
  "node",
  "gpu",
  "gpu_group",
  "validation_run",
  "benchmark_run",
  "custom",
] as const;

export const requiredReportFields = [
  "report_id",
  "name",
  "report_type",
  "status",
  "scope_type",
  "scope_id",
  "customer",
  "engagement_id",
  "cluster_id",
  "agent_ids",
  "node_ids",
  "gpu_ids",
  "validation_ids",
  "benchmark_ids",
  "evidence_ids",
  "author_name",
  "purpose",
  "confidentiality",
  "version",
  "created_at",
  "updated_at",
  "generated_at",
  "checksum",
  "error",
] as const;

export type ReportType = typeof reportTypes[number];
export type ReportStatus = typeof reportStatuses[number];
export type ReportScopeType = typeof scopeTypes[number];

export interface ReportRecord {
  report_id: string;
  schema_version: string;
  name: string;
  report_type: ReportType;
  status: ReportStatus;
  scope_type: ReportScopeType;
  scope_id: string | null;
  customer: string | null;
  engagement_id: string | null;
  cluster_id: string | null;
  agent_ids: string[];
  node_ids: string[];
  gpu_ids: string[];
  validation_ids: string[];
  benchmark_ids: string[];
  evidence_ids: string[];
  author_name: string;
  purpose: string;
  confidentiality: string;
  time_range?: string | null;
  finding_ids?: string[];
  include_evidence?: boolean;
  include_raw_logs?: boolean;
  include_charts?: boolean;
  include_appendices?: boolean;
  reviewer?: string | null;
  notes?: string | null;
  html_artifact_path?: string | null;
  html_generated_at?: string | null;
  html_sha256?: string | null;
  pdf_artifact_path?: string | null;
  pdf_mime_type?: string | null;
  pdf_size_bytes?: number | null;
  pdf_sha256?: string | null;
  pdf_generated_at?: string | null;
  pdf_template_version?: string | null;
  docx_artifact_path?: string | null;
  docx_mime_type?: string | null;
  docx_size_bytes?: number | null;
  docx_sha256?: string | null;
  docx_generated_at?: string | null;
  docx_template_version?: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  generated_at: string | null;
  checksum: string;
  error: string | null;
}

type StoreDoc = Record<string, any>;
type ValidationDetail = { validation: any; jobs: any[]; results: any[] };
type ValidationIssue = { field: string; message: string };
type Lineage = Pick<ReportRecord, "agent_ids" | "node_ids" | "gpu_ids" | "validation_ids" | "benchmark_ids" | "evidence_ids">;

const fieldSet = new Set<string>(requiredReportFields);
const serverOwnedPatchFields = new Set(["report_id", "created_at"]);
const builderDraftFields = ["time_range", "finding_ids", "include_evidence", "include_raw_logs", "include_charts", "include_appendices", "reviewer", "notes"];
const createOptionalFields = new Set(["status", "scope_id", "customer", "engagement_id", "cluster_id", "agent_ids", "node_ids", "gpu_ids", "validation_ids", "benchmark_ids", "evidence_ids", "author_name", "purpose", "confidentiality", "version", "generated_at", "checksum", "error", ...builderDraftFields]);
const patchableFields = new Set(["name", "report_type", "status", "scope_type", "scope_id", "customer", "engagement_id", "cluster_id", "agent_ids", "node_ids", "gpu_ids", "validation_ids", "benchmark_ids", "evidence_ids", "author_name", "purpose", "confidentiality", "version", "generated_at", "checksum", "error", ...builderDraftFields]);
const nullableStringFields = new Set(["scope_id", "customer", "engagement_id", "cluster_id", "generated_at", "error", "time_range", "reviewer", "notes"]);
const stringFields = new Set(["name", "scope_id", "customer", "engagement_id", "cluster_id", "author_name", "purpose", "confidentiality", "generated_at", "checksum", "error", "time_range", "reviewer", "notes"]);
const lineageFields: (keyof Lineage)[] = ["agent_ids", "node_ids", "gpu_ids", "validation_ids", "benchmark_ids", "evidence_ids"];
const builderArrayFields = new Set(["finding_ids"]);
const booleanFields = new Set(["include_evidence", "include_raw_logs", "include_charts", "include_appendices"]);

function nowIso() { return new Date().toISOString(); }
function id(prefix: string) { return `${prefix}_${crypto.randomUUID()}`; }
function isOneOf<T extends readonly string[]>(values: T, value: unknown): value is T[number] { return typeof value === "string" && values.includes(value as T[number]); }
function uniqueStrings(values: unknown[]): string[] { return [...new Set(values.map((item) => String(item).trim()).filter(Boolean))]; }
function cleanNullableString(value: unknown, maxLength = 240): string | null {
  if (value === undefined || value === null || value === "") return null;
  return String(value).trim().slice(0, maxLength) || null;
}
function cleanRequiredString(value: unknown, maxLength: number, field: string, details: ValidationIssue[]): string {
  const text = String(value ?? "").trim().slice(0, maxLength);
  if (!text) details.push({ field, message: `${field} is required.` });
  return text;
}
function validateIsoOrNull(value: unknown, field: string, details: ValidationIssue[]): string | null {
  const text = cleanNullableString(value, 80);
  if (text === null) return null;
  if (Number.isNaN(new Date(text).getTime())) details.push({ field, message: `${field} must be an ISO timestamp or null.` });
  return text;
}
function validateChecksum(value: unknown, details: ValidationIssue[]): string | null {
  const checksum = cleanNullableString(value, 64);
  if (checksum !== null && !/^[a-f0-9]{64}$/.test(checksum)) details.push({ field: "checksum", message: "checksum must be a lowercase SHA-256 hex digest." });
  return checksum;
}
function validateStringArray(input: Record<string, unknown>, field: keyof Lineage, details: ValidationIssue[]): string[] {
  const value = input[field];
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    details.push({ field, message: `${field} must be an array of strings.` });
    return [];
  }
  return uniqueStrings(value).slice(0, 500);
}
function validateVersion(value: unknown, details: ValidationIssue[]): number {
  const version = value === undefined ? 1 : Number(value);
  if (!Number.isInteger(version) || version < 1 || version > 9999) details.push({ field: "version", message: "version must be an integer between 1 and 9999." });
  return Number.isInteger(version) ? version : 1;
}
function ensureDoc(store: EngagementStore): StoreDoc {
  const doc = store.read() as StoreDoc;
  doc.reports = Array.isArray(doc.reports) ? doc.reports : [];
  return doc;
}
function writeDoc(store: EngagementStore, doc: StoreDoc) { (store as any).write(doc); }
function reportStorageRoot(): string { return process.env.AI_VALIDATOR_REPORT_STORAGE_DIR ?? path.join(process.cwd(), "artifacts", "reports"); }
function safeReportHtmlPath(reportId: string): string { return path.join(reportStorageRoot(), reportId, `${reportId}.html`); }
function safeFilenamePart(value: unknown, fallback: string, separator: "-" | "_" = "-"): string {
  const cleaned = String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, separator).replace(new RegExp(`^${separator}+|${separator}+$`, "g"), "").slice(0, 80);
  return cleaned || fallback;
}
function pdfFilename(report: ReportRecord, generatedAt: string): string {
  const date = generatedAt.slice(0, 10).replace(/-/g, "") || new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const scope = safeFilenamePart(report.cluster_id ?? report.scope_id ?? report.scope_type, "scope", "_");
  return `gpuvalidator_${safeFilenamePart(report.report_type, "report")}_${scope}_${date}_v${report.version}.pdf`;
}
function safeReportPdfPath(report: ReportRecord, generatedAt: string): string { return path.join(reportStorageRoot(), report.report_id, pdfFilename(report, generatedAt)); }
function docxFilename(report: ReportRecord, generatedAt: string): string { return pdfFilename(report, generatedAt).replace(/\.pdf$/, ".docx"); }
function safeReportDocxPath(report: ReportRecord, generatedAt: string): string { return path.join(reportStorageRoot(), report.report_id, docxFilename(report, generatedAt)); }
function detailsError(code: string, message: string, details: ValidationIssue[] = []) {
  return { code, message, details };
}
function sendError(res: express.Response, status: number, code: string, message: string, details: ValidationIssue[] = []) {
  return res.status(status).set("Cache-Control", "no-store").json({ error: detailsError(code, message, details) });
}
function publicReport(record: ReportRecord) { return { ...record }; }
function sortReports(reports: ReportRecord[]) { return reports.slice().sort((left, right) => right.updated_at.localeCompare(left.updated_at)); }
function previewStatusPage(title: string, message: string, report?: ReportRecord) {
  const esc = (value: unknown) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;" }[char] ?? char));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)} | GPUValidator</title><style>body{margin:0;background:#020617;color:#e2e8f0;font-family:Inter,ui-sans-serif,system-ui,sans-serif}.wrap{max-width:760px;margin:12vh auto;padding:32px;border:1px solid #1e293b;border-radius:24px;background:#0f172a}.eyebrow{color:#76b900;text-transform:uppercase;letter-spacing:.18em;font-size:12px}h1{margin:12px 0;color:#f8fafc}p{line-height:1.7;color:#cbd5e1}.meta{margin-top:20px;padding:16px;border-radius:16px;background:#020617;color:#94a3b8;font-size:13px}</style></head><body><main class="wrap"><div class="eyebrow">Report preview</div><h1>${esc(title)}</h1><p>${esc(message)}</p>${report ? `<div class="meta">Report ID: ${esc(report.report_id)}<br>Status: ${esc(report.status)}<br>Generated by Sabion P Frazier<br>Purpose: GPUValidator interview demonstration</div>` : ""}</main></body></html>`;
}

function generateHtmlPreview(document: StoreDoc, reports: ReportRecord[], index: number) {
  const report = reports[index];
  const generatedAt = nowIso();
  const htmlPath = safeReportHtmlPath(report.report_id);
  const rendered = renderHtmlReport({ ...report, status: "generated" }, document, generatedAt);
  fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
  fs.writeFileSync(htmlPath, rendered.html, { encoding: "utf8", mode: 0o600 });
  reports[index] = {
    ...report,
    status: "generated",
    generated_at: rendered.metadata.generated_at,
    updated_at: rendered.metadata.generated_at,
    html_artifact_path: htmlPath,
    html_generated_at: rendered.metadata.generated_at,
    html_sha256: rendered.metadata.html_sha256,
    agent_ids: rendered.metadata.source_lineage.agent_ids,
    node_ids: rendered.metadata.source_lineage.node_ids,
    gpu_ids: rendered.metadata.source_lineage.gpu_ids,
    validation_ids: rendered.metadata.source_lineage.validation_ids,
    benchmark_ids: rendered.metadata.source_lineage.benchmark_ids,
    evidence_ids: rendered.metadata.source_lineage.evidence_ids,
    error: null,
  };
  return { report: reports[index], html: rendered.html, path: htmlPath, metadata: rendered.metadata };
}

function validationDetails(document: StoreDoc): ValidationDetail[] {
  const validations = Array.isArray(document.validations) ? document.validations : [];
  const validationJobs = Array.isArray(document.validation_jobs) ? document.validation_jobs : [];
  const validationResults = Array.isArray(document.validation_results) ? document.validation_results : [];
  return validations.map((validation: any) => ({
    validation,
    jobs: validationJobs.filter((job: any) => job.validation_id === validation.id),
    results: validationResults.filter((result: any) => result.validation_id === validation.id),
  }));
}

function scopedDetails(document: StoreDoc, scopeType: ReportScopeType, scopeId: string | null): { agents: any[]; validations: ValidationDetail[]; benchmarks: any[]; evidence: any[] } {
  const agents = Array.isArray(document.validation_agents) ? document.validation_agents : [];
  const benchmarks = Array.isArray(document.benchmark_runs) ? document.benchmark_runs : [];
  const evidence = Array.isArray(document.evidence_records) ? document.evidence_records : [];
  let selectedValidations = validationDetails(document);
  let selectedBenchmarks = benchmarks;

  if (scopeType === "validation_run" && scopeId) selectedValidations = selectedValidations.filter((detail) => detail.validation.id === scopeId);
  if (scopeType === "agent" && scopeId) selectedValidations = selectedValidations.filter((detail) => detail.validation.agent_id === scopeId);
  if (scopeType === "benchmark_run" && scopeId) selectedBenchmarks = benchmarks.filter((run: any) => run.id === scopeId);
  if (scopeType === "gpu" && scopeId) selectedValidations = selectedValidations.filter((detail) => JSON.stringify(detail).includes(scopeId));

  const selectedAgentIds = new Set(selectedValidations.map((detail) => detail.validation.agent_id).filter(Boolean));
  const selectedNodeIds = new Set(selectedValidations.flatMap((detail) => detail.results.map((result) => result.node_id).filter(Boolean)));
  let selectedAgents = agents.filter((agent: any) => selectedAgentIds.has(agent.id) || selectedNodeIds.has(agent.node_id) || selectedNodeIds.has(agent.hostname));
  if (scopeType === "agent" && scopeId) selectedAgents = agents.filter((agent: any) => agent.id === scopeId);
  if (!scopeId || ["organization", "customer", "engagement", "cluster", "custom"].includes(scopeType)) selectedAgents = agents;

  return { agents: selectedAgents, validations: selectedValidations, benchmarks: selectedBenchmarks, evidence };
}

function deriveLineage(document: StoreDoc, scopeType: ReportScopeType, scopeId: string | null, explicit: Lineage): Lineage {
  const scoped = scopedDetails(document, scopeType, scopeId);
  const inventory = deriveLiveGpuInventory(scoped.agents, scoped.validations);
  const agentIds = uniqueStrings([
    ...scoped.agents.map((agent: any) => agent.id),
    ...scoped.validations.map((detail) => detail.validation.agent_id),
    ...explicit.agent_ids,
  ]);
  const nodeIds = uniqueStrings([
    ...scoped.agents.map((agent: any) => agent.node_id ?? agent.hostname),
    ...scoped.validations.flatMap((detail) => detail.results.map((result) => result.node_id)),
    ...explicit.node_ids,
  ]);
  const validationIds = uniqueStrings([...scoped.validations.map((detail) => detail.validation.id), ...explicit.validation_ids]);
  const benchmarkIds = uniqueStrings([...scoped.benchmarks.map((run: any) => run.id), ...explicit.benchmark_ids]);
  const evidenceIds = uniqueStrings([
    ...scoped.validations.flatMap((detail) => detail.results.map((result) => result.id)),
    ...scoped.evidence.filter((record: any) => !record.validation_id || validationIds.includes(record.validation_id)).map((record: any) => record.id),
    ...explicit.evidence_ids,
  ]);
  const gpuIds = uniqueStrings([
    ...inventory.map((gpu) => gpu.uuid ?? gpu.id),
    ...explicit.gpu_ids,
  ]);
  return { agent_ids: agentIds, node_ids: nodeIds, gpu_ids: gpuIds, validation_ids: validationIds, benchmark_ids: benchmarkIds, evidence_ids: evidenceIds };
}

function reportChecksum(report: Omit<ReportRecord, "checksum">, requestedChecksum?: string | null): string {
  if (requestedChecksum) return requestedChecksum;
  const canonical = JSON.stringify(report, Object.keys(report).sort());
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

function createReport(document: StoreDoc, input: Record<string, unknown>): { report?: ReportRecord; details: ValidationIssue[] } {
  const details: ValidationIssue[] = [];
  const allowedCreateFields = new Set(["name", "report_type", "scope_type", ...createOptionalFields]);
  for (const field of Object.keys(input)) {
    if (!allowedCreateFields.has(field)) details.push({ field, message: `${field} is not supported by the report create API.` });
  }

  const name = cleanRequiredString(input.name, 160, "name", details);
  const report_type = isOneOf(reportTypes, input.report_type) ? input.report_type : undefined;
  if (!report_type) details.push({ field: "report_type", message: `report_type must be one of: ${reportTypes.join(", ")}.` });
  const status = input.status === undefined ? "draft" : isOneOf(reportStatuses, input.status) ? input.status : undefined;
  if (!status) details.push({ field: "status", message: `status must be one of: ${reportStatuses.join(", ")}.` });
  const scope_type = isOneOf(scopeTypes, input.scope_type) ? input.scope_type : undefined;
  if (!scope_type) details.push({ field: "scope_type", message: `scope_type must be one of: ${scopeTypes.join(", ")}.` });
  const explicit = Object.fromEntries(lineageFields.map((field) => [field, validateStringArray(input, field, details)])) as Lineage;
  if (input.finding_ids !== undefined && !Array.isArray(input.finding_ids)) details.push({ field: "finding_ids", message: "finding_ids must be an array of strings." });
  const version = validateVersion(input.version, details);
  const generated_at = validateIsoOrNull(input.generated_at, "generated_at", details) ?? (status === "generated" ? nowIso() : null);
  const requestedChecksum = validateChecksum(input.checksum, details);

  if (details.length || !report_type || !status || !scope_type) return { details };

  const timestamp = nowIso();
  const scope_id = cleanNullableString(input.scope_id, 160);
  const lineage = deriveLineage(document, scope_type, scope_id, explicit);
  const base: Omit<ReportRecord, "checksum"> = {
    report_id: id("rpt"),
    schema_version: REPORT_SCHEMA_VERSION,
    name,
    report_type,
    status,
    scope_type,
    scope_id,
    customer: cleanNullableString(input.customer, 160),
    engagement_id: cleanNullableString(input.engagement_id, 160),
    cluster_id: cleanNullableString(input.cluster_id, 160),
    ...lineage,
    author_name: cleanRequiredString(input.author_name ?? "Sabion P Frazier", 120, "author_name", details),
    purpose: cleanRequiredString(input.purpose ?? "GPUValidator interview demonstration", 240, "purpose", details),
    confidentiality: cleanRequiredString(input.confidentiality ?? "Confidential", 120, "confidentiality", details),
    time_range: cleanNullableString(input.time_range, 160),
    finding_ids: Array.isArray(input.finding_ids) ? uniqueStrings(input.finding_ids).slice(0, 500) : [],
    include_evidence: input.include_evidence === undefined ? true : Boolean(input.include_evidence),
    include_raw_logs: Boolean(input.include_raw_logs),
    include_charts: input.include_charts === undefined ? true : Boolean(input.include_charts),
    include_appendices: input.include_appendices === undefined ? true : Boolean(input.include_appendices),
    reviewer: cleanNullableString(input.reviewer, 120),
    notes: cleanNullableString(input.notes, 2000),
    version,
    created_at: timestamp,
    updated_at: timestamp,
    generated_at,
    error: cleanNullableString(input.error, 2000),
  };
  return { report: { ...base, checksum: reportChecksum(base, requestedChecksum) }, details };
}

function patchReport(current: ReportRecord, input: Record<string, unknown>): { report?: ReportRecord; details: ValidationIssue[] } {
  const details: ValidationIssue[] = [];
  for (const field of Object.keys(input)) {
    if (serverOwnedPatchFields.has(field)) details.push({ field, message: `${field} is server-owned and cannot be patched.` });
    else if (!fieldSet.has(field) || !patchableFields.has(field)) details.push({ field, message: `${field} is not supported by the report patch API.` });
  }
  if (details.length) return { details };

  const next: ReportRecord = { ...current };
  for (const [field, value] of Object.entries(input)) {
    if (field === "report_type") {
      if (!isOneOf(reportTypes, value)) details.push({ field, message: `report_type must be one of: ${reportTypes.join(", ")}.` });
      else next.report_type = value;
    } else if (field === "status") {
      if (!isOneOf(reportStatuses, value)) details.push({ field, message: `status must be one of: ${reportStatuses.join(", ")}.` });
      else next.status = value;
    } else if (field === "scope_type") {
      if (!isOneOf(scopeTypes, value)) details.push({ field, message: `scope_type must be one of: ${scopeTypes.join(", ")}.` });
      else next.scope_type = value;
    } else if (field === "version") {
      next.version = validateVersion(value, details);
    } else if (lineageFields.includes(field as keyof Lineage)) {
      if (!Array.isArray(value)) details.push({ field, message: `${field} must be an array of strings.` });
      else (next as any)[field] = uniqueStrings(value).slice(0, 500);
    } else if (builderArrayFields.has(field)) {
      if (!Array.isArray(value)) details.push({ field, message: `${field} must be an array of strings.` });
      else (next as any)[field] = uniqueStrings(value).slice(0, 500);
    } else if (booleanFields.has(field)) {
      if (typeof value !== "boolean") details.push({ field, message: `${field} must be a boolean.` });
      else (next as any)[field] = value;
    } else if (field === "generated_at") {
      next.generated_at = validateIsoOrNull(value, field, details);
    } else if (field === "checksum") {
      const checksum = validateChecksum(value, details);
      if (checksum) next.checksum = checksum;
    } else if (nullableStringFields.has(field)) {
      (next as any)[field] = cleanNullableString(value, field === "error" ? 2000 : 240);
    } else if (stringFields.has(field)) {
      const cleaned = cleanRequiredString(value, field === "purpose" ? 240 : 160, field, details);
      (next as any)[field] = cleaned;
    }
  }
  if (details.length) return { details };
  next.updated_at = nowIso();
  if (!Object.prototype.hasOwnProperty.call(input, "checksum")) {
    const { checksum: _checksum, ...base } = next;
    next.checksum = reportChecksum(base);
  }
  return { report: next, details };
}

function reportTitle(type: ReportType) {
  return type.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
}

export function registerReportRoutes(app: express.Express, store: EngagementStore) {
  app.get("/api/v1/reports/templates", (_req, res) => {
    return res.set("Cache-Control", "no-store").json({
      templates: reportTypes.map((type) => ({
        id: type,
        name: reportTitle(type),
        schema_version: REPORT_SCHEMA_VERSION,
        supported_scopes: scopeTypes,
      })),
      statuses: reportStatuses,
    });
  });

  app.get("/api/v1/reports", (_req, res) => {
    const document = ensureDoc(store);
    return res.set("Cache-Control", "no-store").json({ reports: sortReports(document.reports as ReportRecord[]).map(publicReport) });
  });

  app.get("/portal/reports/:reportId/preview", (req, res) => {
    const document = ensureDoc(store);
    const reports = document.reports as ReportRecord[];
    const index = reports.findIndex((candidate) => candidate.report_id === req.params.reportId || (candidate as any).id === req.params.reportId);
    if (index < 0) return res.status(404).type("text/html; charset=utf-8").set("Cache-Control", "no-store").send(previewStatusPage("Report not found", "The requested report preview does not exist."));
    const report = reports[index];
    if (report.status === "generating") return res.status(202).type("text/html; charset=utf-8").set("Cache-Control", "no-store").send(previewStatusPage("Report still generating", "HTML generation has started but has not completed yet. Refresh this URL after the Generate Preview action finishes.", report));
    if (report.status === "failed") return res.status(500).type("text/html; charset=utf-8").set("Cache-Control", "no-store").send(previewStatusPage("Report generation failed", report.error ?? "The latest report generation failed without additional diagnostics.", report));
    if (report.status !== "generated") return res.status(409).type("text/html; charset=utf-8").set("Cache-Control", "no-store").send(previewStatusPage("Preview not generated", "Use Generate Preview from the report builder before opening this direct preview URL.", report));
    if (!report.html_artifact_path || !fs.existsSync(report.html_artifact_path)) return res.status(409).type("text/html; charset=utf-8").set("Cache-Control", "no-store").send(previewStatusPage("Generated preview unavailable", "The report is marked generated, but the persisted HTML artifact is not available on disk. Regenerate the preview.", report));
    return res.status(200).type("text/html; charset=utf-8").set("Cache-Control", "no-store").sendFile(path.resolve(report.html_artifact_path));
  });

  app.post("/api/v1/reports", (req, res) => {
    const document = ensureDoc(store);
    const input = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body as Record<string, unknown> : {};
    const { report, details } = createReport(document, input);
    if (!report || details.length) return sendError(res, 400, "invalid_report_request", "Report request validation failed.", details);
    document.reports.push(report);
    writeDoc(store, document);
    return res.status(201).set("Cache-Control", "no-store").json({ report: publicReport(report) });
  });

  app.get("/api/v1/reports/:reportId", (req, res) => {
    const document = ensureDoc(store);
    const report = (document.reports as ReportRecord[]).find((candidate) => candidate.report_id === req.params.reportId || (candidate as any).id === req.params.reportId);
    if (!report) return sendError(res, 404, "report_not_found", "Report not found.");
    return res.set("Cache-Control", "no-store").json({ report: publicReport(report) });
  });

  app.post("/api/v1/reports/:reportId/generate/html", (req, res) => {
    const document = ensureDoc(store);
    const reports = document.reports as ReportRecord[];
    const index = reports.findIndex((candidate) => candidate.report_id === req.params.reportId || (candidate as any).id === req.params.reportId);
    if (index < 0) return sendError(res, 404, "report_not_found", "Report not found.");
    const report = reports[index];
    reports[index] = { ...report, status: "generating", updated_at: nowIso(), error: null };
    writeDoc(store, document);
    try {
      const generated = generateHtmlPreview(document, reports, index);
      writeDoc(store, document);
      return res.status(200).set("Cache-Control", "no-store").json({ report: publicReport(generated.report), preview: { url: `/portal/reports/${generated.report.report_id}/preview`, html_artifact_path: generated.path, html_sha256: generated.metadata.html_sha256, generated_at: generated.metadata.generated_at } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown HTML generation failure.";
      const diagnostic = { technology: "server-html-renderer", report_id: report.report_id, output_path: safeReportHtmlPath(report.report_id), message };
      reports[index] = { ...report, status: "failed", updated_at: nowIso(), error: JSON.stringify(diagnostic).slice(0, 2000) };
      writeDoc(store, document);
      return sendError(res, 500, "html_generation_failed", "Server-side HTML generation failed.", [
        { field: "technology", message: diagnostic.technology },
        { field: "output_path", message: diagnostic.output_path },
        { field: "diagnostic", message: diagnostic.message.slice(0, 500) },
      ]);
    }
  });

  app.post("/api/v1/reports/:reportId/generate/pdf", async (req, res) => {
    const document = ensureDoc(store);
    const reports = document.reports as ReportRecord[];
    const index = reports.findIndex((candidate) => candidate.report_id === req.params.reportId || (candidate as any).id === req.params.reportId);
    if (index < 0) return sendError(res, 404, "report_not_found", "Report not found.");
    const report = reports[index];
    const generatedAt = nowIso();
    const pdfPath = safeReportPdfPath(report, generatedAt);

    try {
      const metadata = await generatePdfReport(report, document, pdfPath, generatedAt);
      reports[index] = {
        ...report,
        status: "generated",
        generated_at: metadata.generated_at,
        updated_at: metadata.generated_at,
        html_sha256: metadata.html_sha256,
        pdf_artifact_path: metadata.file_path,
        pdf_mime_type: metadata.mime_type,
        pdf_size_bytes: metadata.size_bytes,
        pdf_sha256: metadata.sha256,
        pdf_generated_at: metadata.generated_at,
        pdf_template_version: metadata.template_version,
        error: null,
      };
      writeDoc(store, document);
      return res.status(200).set("Cache-Control", "no-store").json({ report: publicReport(reports[index]), pdf: metadata });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown PDF generation failure.";
      const diagnostic = {
        technology: "playwright-chromium",
        report_id: report.report_id,
        output_path: pdfPath,
        template_version: PDF_TEMPLATE_VERSION,
        message,
      };
      reports[index] = { ...report, status: "failed", updated_at: nowIso(), error: JSON.stringify(diagnostic).slice(0, 2000) };
      writeDoc(store, document);
      return sendError(res, 500, "pdf_generation_failed", "Server-side PDF generation failed.", [
        { field: "technology", message: diagnostic.technology },
        { field: "output_path", message: diagnostic.output_path },
        { field: "template_version", message: diagnostic.template_version },
        { field: "diagnostic", message: diagnostic.message.slice(0, 500) },
      ]);
    }
  });

  app.get("/api/v1/reports/:reportId/download/pdf", (req, res) => {
    const document = ensureDoc(store);
    const report = (document.reports as ReportRecord[]).find((candidate) => candidate.report_id === req.params.reportId || (candidate as any).id === req.params.reportId);
    if (!report) return sendError(res, 404, "report_not_found", "Report not found.");
    if (!report.pdf_artifact_path || !fs.existsSync(report.pdf_artifact_path)) {
      return sendError(res, 409, "pdf_not_generated", "Generate the PDF before downloading it.", [
        { field: "pdf_artifact_path", message: report.pdf_artifact_path ? "Persisted PDF artifact is missing from disk." : "No PDF artifact has been generated for this report." },
      ]);
    }
    const filename = path.basename(report.pdf_artifact_path);
    return res.status(200)
      .type(report.pdf_mime_type ?? PDF_MIME_TYPE)
      .set("Cache-Control", "no-store")
      .set("Content-Disposition", `attachment; filename="${filename.replace(/[^a-zA-Z0-9._-]/g, "_" )}"`)
      .set("Content-Length", String(fs.statSync(report.pdf_artifact_path).size))
      .sendFile(path.resolve(report.pdf_artifact_path));
  });

  app.post("/api/v1/reports/:reportId/generate/docx", (req, res) => {
    const document = ensureDoc(store);
    const reports = document.reports as ReportRecord[];
    const index = reports.findIndex((candidate) => candidate.report_id === req.params.reportId || (candidate as any).id === req.params.reportId);
    if (index < 0) return sendError(res, 404, "report_not_found", "Report not found.");
    const report = reports[index];
    const generatedAt = nowIso();
    const docxPath = safeReportDocxPath(report, generatedAt);

    try {
      const metadata = generateDocxReport(report, document, docxPath, generatedAt);
      reports[index] = {
        ...report,
        status: "generated",
        generated_at: metadata.generated_at,
        updated_at: metadata.generated_at,
        docx_artifact_path: metadata.file_path,
        docx_mime_type: metadata.mime_type,
        docx_size_bytes: metadata.size_bytes,
        docx_sha256: metadata.sha256,
        docx_generated_at: metadata.generated_at,
        docx_template_version: metadata.template_version,
        error: null,
      };
      writeDoc(store, document);
      return res.status(200).set("Cache-Control", "no-store").json({ report: publicReport(reports[index]), docx: metadata });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown DOCX generation failure.";
      const diagnostic = { technology: "openxml-zip", report_id: report.report_id, output_path: docxPath, template_version: DOCX_TEMPLATE_VERSION, message };
      reports[index] = { ...report, status: "failed", updated_at: nowIso(), error: JSON.stringify(diagnostic).slice(0, 2000) };
      writeDoc(store, document);
      return sendError(res, 500, "docx_generation_failed", "Server-side DOCX generation failed.", [
        { field: "technology", message: diagnostic.technology },
        { field: "output_path", message: diagnostic.output_path },
        { field: "template_version", message: diagnostic.template_version },
        { field: "diagnostic", message: diagnostic.message.slice(0, 500) },
      ]);
    }
  });

  app.get("/api/v1/reports/:reportId/download/docx", (req, res) => {
    const document = ensureDoc(store);
    const report = (document.reports as ReportRecord[]).find((candidate) => candidate.report_id === req.params.reportId || (candidate as any).id === req.params.reportId);
    if (!report) return sendError(res, 404, "report_not_found", "Report not found.");
    if (!report.docx_artifact_path || !fs.existsSync(report.docx_artifact_path)) {
      return sendError(res, 409, "docx_not_generated", "Generate the DOCX before downloading it.", [
        { field: "docx_artifact_path", message: report.docx_artifact_path ? "Persisted DOCX artifact is missing from disk." : "No DOCX artifact has been generated for this report." },
      ]);
    }
    const filename = path.basename(report.docx_artifact_path);
    return res.status(200)
      .type(report.docx_mime_type ?? DOCX_MIME_TYPE)
      .set("Cache-Control", "no-store")
      .set("Content-Disposition", `attachment; filename="${filename.replace(/[^a-zA-Z0-9._-]/g, "_" )}"`)
      .set("Content-Length", String(fs.statSync(report.docx_artifact_path).size))
      .sendFile(path.resolve(report.docx_artifact_path));
  });

  app.patch("/api/v1/reports/:reportId", (req, res) => {
    const document = ensureDoc(store);
    const reports = document.reports as ReportRecord[];
    const index = reports.findIndex((candidate) => candidate.report_id === req.params.reportId || (candidate as any).id === req.params.reportId);
    if (index < 0) return sendError(res, 404, "report_not_found", "Report not found.");
    const input = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body as Record<string, unknown> : {};
    const { report, details } = patchReport(reports[index], input);
    if (!report || details.length) return sendError(res, 400, "invalid_report_request", "Report request validation failed.", details);
    reports[index] = report;
    writeDoc(store, document);
    return res.set("Cache-Control", "no-store").json({ report: publicReport(report) });
  });

  app.delete("/api/v1/reports/:reportId", (req, res) => {
    const document = ensureDoc(store);
    const reports = document.reports as ReportRecord[];
    const nextReports = reports.filter((candidate) => candidate.report_id !== req.params.reportId && (candidate as any).id !== req.params.reportId);
    if (nextReports.length === reports.length) return sendError(res, 404, "report_not_found", "Report not found.");
    document.reports = nextReports;
    writeDoc(store, document);
    return res.status(204).end();
  });
}
