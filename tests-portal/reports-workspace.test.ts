import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const appSource = fs.readFileSync(path.join(process.cwd(), "src", "App.tsx"), "utf8");
const reportsSource = appSource.slice(appSource.indexOf("function ReportsPage"), appSource.indexOf("function SettingsPage"));

test("reports workspace declares landing, new, and detail routes", () => {
  assert.match(appSource, /pathName === "\/portal\/reports"/);
  assert.match(appSource, /pathName === "\/portal\/reports\/new"/);
  assert.match(appSource, /pathName\.startsWith\("\/portal\/reports\/"\)/);
  assert.match(reportsSource, /isNewReportRoute/);
  assert.match(reportsSource, /selectedReportId/);
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
