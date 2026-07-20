import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Cluster } from "../src/portal/assessment";
import type { Engagement, EngagementNode, EvidenceRecordSummary, Finding, ClusterComparison } from "../src/portal/engagements";
import {
  defaultGpuInventoryFilters,
  deriveGpuHealth,
  deriveGpuInventory,
  deriveGpuInventoryFromCluster,
  deriveGpuInventorySummary,
  exportGpuInventoryCsv,
  filterGpuInventory,
  sortGpuInventory,
} from "../src/portal/inventory";

function engagement(overrides: Partial<Engagement> = {}): Engagement {
  return {
    id: "eng_1",
    schema_version: "1.0.0",
    name: "Customer GPU Acceptance",
    customer_name: "Customer",
    description: "demo",
    platform_profile: "hgx-h100",
    expected_node_count: 1,
    received_node_count: 1,
    ready_node_count: 1,
    remediation_node_count: 0,
    failed_node_count: 0,
    status: "ready_for_review",
    acceptance_status: "ready",
    readiness_score: 98,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    collection_deadline: null,
    created_by: "test",
    simulated: false,
    tags: [],
    ...overrides,
  };
}

function node(overrides: Partial<EngagementNode> = {}): EngagementNode {
  return {
    id: "node_1",
    engagement_id: "eng_1",
    display_name: "node-01",
    source_hostname: "HOST-01",
    node_fingerprint: null,
    platform_profile: "hgx-h100",
    gpu_model: "NVIDIA H100 80GB HBM3",
    gpu_count: 2,
    driver_version: "580.124.01",
    cuda_version: "12.9",
    kernel_version: "6.8.0",
    operating_system: "Ubuntu",
    ofed_version: null,
    fabric_type: "InfiniBand",
    collection_status: "validated",
    validation_status: "ready",
    readiness_score: 99,
    last_collection_at: "2026-01-01T01:00:00.000Z",
    simulated: false,
    findings_count: 0,
    critical_findings_count: 0,
    high_findings_count: 0,
    current_evidence_id: "evd_1",
    upload_token_state: null,
    ...overrides,
  };
}

function evidence(overrides: Partial<EvidenceRecordSummary> = {}): EvidenceRecordSummary {
  return {
    id: "evd_1",
    engagement_id: "eng_1",
    node_id: "node_1",
    collection_id: "collection-1",
    collector_version: "ai-validator 0.1.0",
    collector_profile: "dgx-class",
    manifest_schema_version: "1.0.0",
    uploaded_at: "2026-01-01T01:05:00.000Z",
    collected_at: "2026-01-01T01:00:00.000Z",
    sanitized: true,
    simulated: false,
    command_count: 6,
    collected_count: 6,
    missing_count: 0,
    failed_count: 0,
    skipped_count: 0,
    bundle_sha256: "sha",
    manifest_sha256: "manifest",
    upload_token_id: "tok",
    ingestion_status: "accepted",
    validation_warnings: [],
    source_hostname_display: "HOST-01",
    supersedes_evidence_id: null,
    storage_id: "redacted",
    ...overrides,
  };
}

const comparison: ClusterComparison = {
  engagement_id: "eng_1",
  evaluated_at: "2026-01-01T02:00:00.000Z",
  warnings: [],
  rows: [{
    node_id: "node_1",
    node: "node-01",
    evidence_status: "validated",
    simulated: false,
    validation_status: "ready",
    node_readiness: 99,
    fields: {
      gpu_model: { value: "NVIDIA H100 80GB HBM3", consensus_value: "NVIDIA H100 80GB HBM3", matches_consensus: true, missing: false, provenance: { evidence_id: "evd_1", source_file: "gpu/nvidia-smi-query.txt", source_command_id: "nvidia-smi-query", source_command: "nvidia-smi -q", collection_timestamp: "2026-01-01T01:00:00.000Z", source_checksum: "abc", parsed_field: "gpu_model", parsed_value: "NVIDIA H100 80GB HBM3", sanitized: true, simulated: false } },
      gpu_count: { value: 2, consensus_value: 2, matches_consensus: true, missing: false, provenance: null },
      driver_version: { value: "580.124.01", consensus_value: "580.124.01", matches_consensus: true, missing: false, provenance: null },
      cuda_version: { value: "12.9", consensus_value: "12.9", matches_consensus: true, missing: false, provenance: null },
      nvlink_status: { value: "healthy", consensus_value: "healthy", matches_consensus: true, missing: false, provenance: null },
    },
  }],
};

test("derives GPU inventory from complete engagement data without fabricating unsupported identity", () => {
  const items = deriveGpuInventory([{ engagement: engagement(), nodes: [node()], evidenceRecords: [evidence()], comparison, findings: [] }]);
  assert.equal(items.length, 2);
  assert.equal(items[0].model, "NVIDIA H100 80GB HBM3");
  assert.equal(items[0].driverVersion, "580.124.01");
  assert.equal(items[0].cudaVersion, "12.9");
  assert.equal(items[0].uuid, null);
  assert.equal(items[0].serialNumber, null);
  assert.equal(items[0].memoryTotal, null);
  assert.equal(items[0].fieldAvailability.uuid, "not_collected");
  assert.equal(items[0].evidenceSource.command, "nvidia-smi -q");
});

test("derives inventory from sparse node data and keeps missing identity explicit", () => {
  const items = deriveGpuInventory([{ engagement: engagement(), nodes: [node({ gpu_model: null, gpu_count: 1, driver_version: null, cuda_version: null, validation_status: "not_evaluated" })], evidenceRecords: [], findings: [] }]);
  assert.equal(items.length, 1);
  assert.equal(items[0].model, null);
  assert.equal(items[0].driverVersion, null);
  assert.equal(items[0].validationStatus, "not_validated");
  assert.equal(items[0].evidenceCompleteness, "partial");
  assert.equal(items[0].fieldAvailability.driverVersion, "not_collected");
});

test("does not invent GPUs when identity and GPU count are missing", () => {
  const items = deriveGpuInventory([{ engagement: engagement(), nodes: [node({ gpu_model: null, gpu_count: null })], evidenceRecords: [], findings: [] }]);
  assert.equal(items.length, 0);
});

test("distinguishes unknown from failed state", () => {
  assert.equal(deriveGpuHealth({ validationStatus: "passed", findings: [], evidenceCompleteness: "complete" }), "unknown");
  const finding: Finding = { id: "f1", rule_id: "missing-expected-gpus", rule_version: "1", engagement_id: "eng_1", node_id: "node_1", category: "node_health", severity: "critical", title: "Missing expected GPUs", description: "", impact: "", recommendation: "", verification_command: "nvidia-smi -L", blocking: true, evidence_references: [], created_at: "2026-01-01T00:00:00Z", simulated: false };
  const items = deriveGpuInventory([{ engagement: engagement(), nodes: [node({ validation_status: "failed" })], evidenceRecords: [evidence()], findings: [finding] }]);
  assert.equal(items[0].healthStatus, "failed");
  assert.equal(items[0].failures.includes("Missing expected GPUs"), true);
});

test("evidence completeness reflects missing, partial, and complete evidence", () => {
  const complete = deriveGpuInventory([{ engagement: engagement(), nodes: [node()], evidenceRecords: [evidence()], findings: [] }])[0];
  const partial = deriveGpuInventory([{ engagement: engagement(), nodes: [node()], evidenceRecords: [evidence({ missing_count: 1 })], findings: [] }])[0];
  const missing = deriveGpuInventory([{ engagement: engagement(), nodes: [node({ gpu_model: null })], evidenceRecords: [], findings: [] }])[0];
  assert.equal(complete.evidenceCompleteness, "complete");
  assert.equal(partial.evidenceCompleteness, "partial");
  assert.equal(missing.evidenceCompleteness, "partial");
});

test("summary totals count validation, warnings, failures, nodes, models, and drivers", () => {
  const warning: Finding = { id: "f2", rule_id: "driver-version-mismatch", rule_version: "1", engagement_id: "eng_1", node_id: null, category: "cluster_consistency", severity: "high", title: "Driver mismatch", description: "", impact: "", recommendation: "", verification_command: "", blocking: false, evidence_references: [], created_at: "2026-01-01T00:00:00Z", simulated: false };
  const items = deriveGpuInventory([{ engagement: engagement(), nodes: [node({ validation_status: "observations" })], evidenceRecords: [evidence({ missing_count: 1 })], findings: [warning] }]);
  const summary = deriveGpuInventorySummary(items);
  assert.equal(summary.totalGpus, 2);
  assert.equal(summary.warningGpus, 2);
  assert.equal(summary.incompleteEvidenceGpus, 2);
  assert.equal(summary.representedNodes, 1);
  assert.equal(summary.representedModels, 1);
  assert.equal(summary.representedDriverVersions, 1);
});

test("filtering works in combination", () => {
  const items = deriveGpuInventory([{ engagement: engagement(), nodes: [node(), node({ id: "node_2", display_name: "node-02", gpu_model: "NVIDIA L40S", driver_version: "550.1", gpu_count: 1 })], evidenceRecords: [evidence()], findings: [] }]);
  const filtered = filterGpuInventory(items, { ...defaultGpuInventoryFilters, query: "node-02", model: "NVIDIA L40S", driverVersion: "550.1" });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].nodeName, "node-02");
});

test("sorting handles GPU index and missing values deterministically", () => {
  const items = deriveGpuInventory([{ engagement: engagement(), nodes: [node({ gpu_count: 3 })], evidenceRecords: [evidence()], findings: [] }]);
  const sorted = sortGpuInventory(items, { key: "gpuIndex", direction: "desc" });
  assert.deepEqual(sorted.map((item) => item.gpuIndex), [2, 1, 0]);
});

test("duplicate missing UUID rows remain stable and disambiguated by node plus GPU index", () => {
  const items = deriveGpuInventory([{ engagement: engagement(), nodes: [node({ gpu_count: 2 })], evidenceRecords: [evidence()], findings: [] }]);
  assert.equal(new Set(items.map((item) => item.id)).size, 2);
  assert.equal(items.every((item) => item.uuid === null), true);
});

test("field availability and malformed optional evidence are tolerated", () => {
  const malformed = { ...comparison, rows: [{ ...comparison.rows[0], fields: { gpu_count: { value: 1, consensus_value: 1, matches_consensus: true, missing: false, provenance: null } } }] };
  const items = deriveGpuInventory([{ engagement: engagement(), nodes: [node({ gpu_model: null, gpu_count: null, driver_version: null, cuda_version: null })], evidenceRecords: [evidence({ validation_warnings: ["Malformed optional GPU query output."] })], comparison: malformed, findings: [] }]);
  assert.equal(items.length, 1);
  assert.equal(items[0].fieldAvailability.model, "not_collected");
  assert.equal(items[0].evidenceSource.warnings[0], "Malformed optional GPU query output.");
});

test("cluster scenario inventory derives only truthful validation fields", () => {
  const cluster = JSON.parse(readFileSync(resolve(process.cwd(), "artifacts/healthy-results.json"), "utf8")) as Cluster;
  const items = deriveGpuInventoryFromCluster(cluster);
  assert.equal(items.length, 32);
  assert.equal(items[0].vendor, "NVIDIA");
  assert.equal(items[0].model, null);
  assert.equal(items[0].uuid, null);
  assert.equal(items[0].driverVersion, "535.104");
  assert.equal(items[0].cudaVersion, "12.2");
});

test("CSV export uses deterministic sanitized current-row columns", () => {
  const items = deriveGpuInventory([{ engagement: engagement(), nodes: [node({ gpu_count: 1 })], evidenceRecords: [evidence()], findings: [] }]);
  const csv = exportGpuInventoryCsv(items);
  assert.match(csv.split("\n")[0], /"node","gpu_index","vendor","model"/);
  assert.doesNotMatch(csv, /storage_id|storage_key|bundle_sha256/);
  assert.match(csv, /"node-01"/);
});
