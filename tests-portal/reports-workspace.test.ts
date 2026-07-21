import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const appSource = fs.readFileSync(path.join(process.cwd(), "src", "App.tsx"), "utf8");
const reportsSource = appSource.slice(appSource.indexOf("function ReportsPage"), appSource.indexOf("function SettingsPage"));

test("reports workspace declares landing, new, and detail routes", () => {
  assert.match(appSource, /pathName === "\/portal\/reports"/);
  assert.match(appSource, /pathName === "\/portal\/reports\/new"/);
  assert.match(appSource, /\/portal\/reports\/:reportId\/preview/);
  assert.match(appSource, /pathName\.startsWith\("\/portal\/reports\/"\)/);
  assert.match(reportsSource, /isNewReportRoute/);
  assert.match(reportsSource, /selectedReportId/);
});

test("reports workspace links open report records to server-rendered HTML preview", () => {
  assert.match(reportsSource, /Preview HTML/);
  assert.match(reportsSource, /\/portal\/reports\/\$\{encodeURIComponent\(selectedReport\.report_id\)\}\/preview/);
  assert.doesNotMatch(reportsSource, /Download PDF|Download DOCX|download\/pdf|download\/docx/i);
});

test("reports workspace loads API reports and renders required metadata columns", () => {
  assert.match(reportsSource, /fetch\("\/api\/v1\/reports"/);
  for (const label of ["Report name", "Report type", "Scope", "Customer", "Author", "Status", "Version", "Generated", "Modified"]) {
    assert.match(reportsSource, new RegExp(label), `${label} should be visible in reports workspace`);
  }
  for (const field of ["name", "report_type", "scope_type", "scope_id", "customer", "author_name", "status", "version", "generated_at", "updated_at"]) {
    assert.match(reportsSource, new RegExp(`report\\.${field}`), `${field} should be rendered from API records`);
  }
});

test("reports workspace exposes functional filters, search, and truthful async states", () => {
  for (const control of ["Search reports", "Filter report type", "Filter status", "Filter scope", "Filter customer"]) {
    assert.match(reportsSource, new RegExp(control), `${control} control should exist`);
  }
  for (const stateText of ["Loading reports", "Unable to load reports", "Retry", "No reports yet", "No reports match the current filters"]) {
    assert.match(reportsSource, new RegExp(stateText), `${stateText} state should exist`);
  }
  assert.match(reportsSource, /filteredReports/);
});

test("reports workspace primary controls call real API or real navigation", () => {
  for (const label of ["New Report", "Open", "Duplicate", "Archive", "Delete", "Refresh"]) {
    assert.match(reportsSource, new RegExp(label), `${label} control should be rendered`);
  }
  assert.match(reportsSource, /window\.history\.pushState/);
  assert.match(reportsSource, /method: "POST"/);
  assert.match(reportsSource, /method: "PATCH"/);
  assert.match(reportsSource, /method: "DELETE"/);
  assert.doesNotMatch(reportsSource, /placeholder/i);
  assert.doesNotMatch(reportsSource, /Download PDF|Download DOCX|download\/pdf|download\/docx/i);
});

test("new report route exposes the scoped report builder with all required fields", () => {
  for (const label of [
    "Report name",
    "Report type",
    "Customer",
    "Engagement",
    "Scope type",
    "Scope selector",
    "Time range",
    "Included validations",
    "Included benchmarks",
    "Included findings",
    "Include evidence",
    "Include raw logs",
    "Include charts",
    "Include appendices",
    "Author",
    "Purpose",
    "Confidentiality",
    "Version",
    "Reviewer",
    "Notes",
  ]) {
    assert.match(reportsSource, new RegExp(label), `${label} should be rendered by the builder`);
  }
  for (const scope of ["Organization", "Customer", "Engagement", "Cluster", "Agent", "Node", "GPU", "Validation", "Benchmark", "Custom"]) {
    assert.match(reportsSource, new RegExp(scope), `${scope} scope should be available`);
  }
  assert.match(reportsSource, /Sabion P Frazier/);
  assert.match(reportsSource, /GPUValidator interview demonstration/);
});

test("report builder loads live source data and never fabricates missing sources", () => {
  assert.match(reportsSource, /useLiveAgentData\(/);
  assert.match(reportsSource, /deriveLiveGpuInventory\(/);
  assert.match(reportsSource, /fetch\("\/api\/v1\/benchmark-definitions"/);
  for (const text of ["Available live agents", "Available nodes", "Available GPUs", "Available validations", "Available benchmarks", "Not available", "Not collected"]) {
    assert.match(reportsSource, new RegExp(text), `${text} should be visible for source selection`);
  }
  assert.match(reportsSource, /multiple/);
});

test("report builder validates required fields and saves drafts through the report API", () => {
  assert.match(reportsSource, /builderErrors/);
  assert.match(reportsSource, /validateReportBuilder/);
  assert.match(reportsSource, /setBuilderErrors/);
  assert.match(reportsSource, /status: "draft"/);
  assert.match(reportsSource, /validation_ids/);
  assert.match(reportsSource, /benchmark_ids/);
  assert.match(reportsSource, /agent_ids/);
  assert.match(reportsSource, /node_ids/);
  assert.match(reportsSource, /gpu_ids/);
  assert.match(reportsSource, /time_range: builderForm\.time_range/);
  assert.match(reportsSource, /finding_ids: builderForm\.finding_ids/);
  assert.match(reportsSource, /include_evidence: builderForm\.include_evidence/);
  assert.match(reportsSource, /include_raw_logs: builderForm\.include_raw_logs/);
  assert.match(reportsSource, /include_charts: builderForm\.include_charts/);
  assert.match(reportsSource, /include_appendices: builderForm\.include_appendices/);
  assert.match(reportsSource, /reviewer: builderForm\.reviewer/);
  assert.match(reportsSource, /notes: builderForm\.notes/);
  for (const action of ["Save Draft", "Generate Preview", "Cancel"]) {
    assert.match(reportsSource, new RegExp(action), `${action} action should be rendered`);
  }
});

test("executive summary actions are available from dashboard, reports, and validation detail using live source selection", () => {
  assert.match(appSource, /function generateExecutiveSummaryReport/);
  assert.match(appSource, /report_type: "executive-summary"/);
  assert.match(appSource, /purpose: "GPUValidator interview demonstration"/);
  assert.match(appSource, /author_name: "Sabion P Frazier"/);
  assert.match(appSource, /scope_type: "validation_run"/);
  assert.match(appSource, /scope_type: "cluster"/);
  assert.match(appSource, /validation_ids: .*latest.*id/s);
  assert.match(appSource, /agent_ids: .*selectedAgentId/s);
  assert.match(appSource, /node_ids: .*agents\.map/s);
  assert.match(appSource, /gpu_ids: .*liveGpus\.map/s);
  assert.match(appSource, /Generate Executive Summary/);
  assert.match(reportsSource, /Generate Executive Summary/);
  assert.match(appSource.slice(appSource.indexOf("function ValidationResultsPage"), appSource.indexOf("function OperationsLibraryPage")), /Generate Executive Summary/);
  assert.match(appSource, /\/portal\/reports\/\$\{encodeURIComponent\(payload\.report\.report_id\)\}\/preview/);
  assert.match(appSource, /Reports history/);
});
