import test from "node:test";
import assert from "node:assert/strict";

import { reportStatuses, reportTypes, requiredReportFields } from "../src/server/reports";

test("report model exposes the reporting foundation statuses and scoped report types", () => {
  assert.deepEqual(reportStatuses, ["draft", "generating", "generated", "failed", "approved", "archived"]);
  assert.deepEqual(reportTypes, [
    "executive-summary",
    "customer-validation",
    "technical-infrastructure",
    "gpu-inventory",
    "cluster-readiness",
    "node-validation",
    "individual-gpu",
    "nccl-benchmark",
    "management-status",
  ]);
});

test("report model documents every required persisted field", () => {
  assert.deepEqual(requiredReportFields, [
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
  ]);
});
