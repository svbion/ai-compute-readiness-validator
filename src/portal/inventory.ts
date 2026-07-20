import type {
  ClusterComparison,
  ComparisonCell,
  Engagement,
  EngagementNode,
  EngagementReadiness,
  EvidenceRecordSummary,
  Finding,
  ProvenanceReference,
} from "./engagements";
import type { CheckStatus, Cluster, ValidationCheck } from "./assessment";
import { getAllChecks, getCheck } from "./assessment";

export type GpuInventoryValidationState = "passed" | "warning" | "failed" | "not_validated" | "unknown";
export type GpuInventoryHealth = "failed" | "warning" | "unknown" | "not_collected";
export type GpuInventoryCompleteness = "complete" | "partial" | "missing";
export type GpuInventorySource = "engagement_node" | "engagement_evidence" | "scenario_cluster";
export type GpuInventoryAvailability = "available" | "not_collected" | "not_applicable" | "derived";
export type GpuInventorySortKey =
  | "nodeName"
  | "gpuIndex"
  | "model"
  | "driverVersion"
  | "cudaVersion"
  | "validationStatus"
  | "evidenceCompleteness"
  | "lastValidatedAt";

export interface GpuInventoryFieldAvailability {
  vendor: GpuInventoryAvailability;
  model: GpuInventoryAvailability;
  uuid: GpuInventoryAvailability;
  serialNumber: GpuInventoryAvailability;
  memoryTotal: GpuInventoryAvailability;
  driverVersion: GpuInventoryAvailability;
  cudaVersion: GpuInventoryAvailability;
  computeCapability: GpuInventoryAvailability;
  pciBusId: GpuInventoryAvailability;
  numaNode: GpuInventoryAvailability;
  migMode: GpuInventoryAvailability;
  eccMode: GpuInventoryAvailability;
  nvlinkState: GpuInventoryAvailability;
  telemetry: GpuInventoryAvailability;
}

export interface GpuInventoryEvidenceSource {
  source: GpuInventorySource;
  evidenceId: string | null;
  command: string | null;
  sourceFile: string | null;
  collectedAt: string | null;
  sanitized: boolean | null;
  simulated: boolean;
  completeness: GpuInventoryCompleteness;
  commandCounts: {
    total: number | null;
    collected: number | null;
    missing: number | null;
    failed: number | null;
    skipped: number | null;
  };
  warnings: string[];
  provenance: ProvenanceReference[];
}

export interface GpuInventoryItem {
  id: string;
  clusterId: string | null;
  clusterName: string | null;
  engagementId: string | null;
  engagementName: string | null;
  nodeId: string | null;
  nodeName: string;
  gpuIndex: number | null;
  vendor: string | null;
  model: string | null;
  uuid: string | null;
  serialNumber: string | null;
  memoryTotal: string | null;
  driverVersion: string | null;
  cudaVersion: string | null;
  computeCapability: string | null;
  pciBusId: string | null;
  numaNode: string | null;
  migMode: string | null;
  eccMode: string | null;
  nvlinkState: string | null;
  validationStatus: GpuInventoryValidationState;
  healthStatus: GpuInventoryHealth;
  evidenceCompleteness: GpuInventoryCompleteness;
  evidenceSource: GpuInventoryEvidenceSource;
  lastValidatedAt: string | null;
  fieldAvailability: GpuInventoryFieldAvailability;
  warnings: string[];
  failures: string[];
}

export interface GpuInventorySummary {
  totalGpus: number;
  validatedGpus: number;
  warningGpus: number;
  failedGpus: number;
  incompleteEvidenceGpus: number;
  representedNodes: number;
  representedModels: number;
  representedDriverVersions: number;
  representedEngagements: number;
}

export interface GpuInventoryFilterState {
  query: string;
  validationStatus: "all" | GpuInventoryValidationState;
  healthStatus: "all" | GpuInventoryHealth;
  model: string;
  vendor: string;
  driverVersion: string;
  cudaVersion: string;
  engagementId: string;
  evidenceCompleteness: "all" | GpuInventoryCompleteness;
}

export interface GpuInventorySortState {
  key: GpuInventorySortKey;
  direction: "asc" | "desc";
}

export interface EngagementInventoryPayload {
  engagement: Engagement;
  nodes: EngagementNode[];
  evidenceRecords?: EvidenceRecordSummary[];
  comparison?: ClusterComparison | null;
  findings?: Finding[];
  readiness?: EngagementReadiness | null;
}

export const defaultGpuInventoryFilters: GpuInventoryFilterState = {
  query: "",
  validationStatus: "all",
  healthStatus: "all",
  model: "all",
  vendor: "all",
  driverVersion: "all",
  cudaVersion: "all",
  engagementId: "all",
  evidenceCompleteness: "all",
};

function valueFromCell<T = string>(cell: ComparisonCell | undefined): T | null {
  const value = cell?.value;
  return value === null || value === undefined || value === "" ? null : (value as T);
}

function provenanceFromCell(cell: ComparisonCell | undefined): ProvenanceReference[] {
  return cell?.provenance ? [cell.provenance] : [];
}

function evidenceForNode(records: EvidenceRecordSummary[] | undefined, nodeId: string): EvidenceRecordSummary | null {
  return (records ?? [])
    .filter((record) => record.node_id === nodeId && ["accepted", "received", "validating"].includes(record.ingestion_status))
    .sort((a, b) => String(b.collected_at || b.uploaded_at).localeCompare(String(a.collected_at || a.uploaded_at)))[0] ?? null;
}

function completenessFromCounts(record: EvidenceRecordSummary | null, hasGpuCount: boolean, hasGpuIdentity: boolean): GpuInventoryCompleteness {
  if (!record && !hasGpuCount) return "missing";
  if (!record) return "partial";
  if (record.failed_count > 0 || record.missing_count > 0 || record.skipped_count > 0 || !hasGpuIdentity) return "partial";
  return "complete";
}

function validationState(status: string | null | undefined): GpuInventoryValidationState {
  if (status === "ready" || status === "validated" || status === "pass") return "passed";
  if (status === "observations" || status === "ready_with_observations" || status === "warning") return "warning";
  if (status === "remediation_required" || status === "failed" || status === "fail" || status === "rejected") return "failed";
  if (status === "not_evaluated" || status === "awaiting_evidence") return "not_validated";
  return "unknown";
}

export function deriveGpuHealth(input: { validationStatus: GpuInventoryValidationState; findings: Finding[]; evidenceCompleteness: GpuInventoryCompleteness }): GpuInventoryHealth {
  if (input.findings.some((finding) => finding.blocking || finding.severity === "critical")) return "failed";
  if (input.findings.some((finding) => ["high", "medium"].includes(finding.severity))) return "warning";
  if (input.validationStatus === "failed") return "failed";
  if (input.validationStatus === "warning") return "warning";
  if (input.evidenceCompleteness === "missing") return "not_collected";
  return "unknown";
}

function fieldAvailability(item: {
  vendor?: unknown; model?: unknown; uuid?: unknown; serialNumber?: unknown; memoryTotal?: unknown; driverVersion?: unknown; cudaVersion?: unknown; computeCapability?: unknown; pciBusId?: unknown; numaNode?: unknown; migMode?: unknown; eccMode?: unknown; nvlinkState?: unknown;
}): GpuInventoryFieldAvailability {
  const available = (value: unknown): GpuInventoryAvailability => value === null || value === undefined || value === "" ? "not_collected" : "available";
  return {
    vendor: available(item.vendor),
    model: available(item.model),
    uuid: available(item.uuid),
    serialNumber: available(item.serialNumber),
    memoryTotal: available(item.memoryTotal),
    driverVersion: available(item.driverVersion),
    cudaVersion: available(item.cudaVersion),
    computeCapability: available(item.computeCapability),
    pciBusId: available(item.pciBusId),
    numaNode: available(item.numaNode),
    migMode: available(item.migMode),
    eccMode: available(item.eccMode),
    nvlinkState: available(item.nvlinkState),
    telemetry: "not_collected",
  };
}

function nodeFindings(findings: Finding[] | undefined, nodeId: string): Finding[] {
  return (findings ?? []).filter((finding) => finding.node_id === nodeId || finding.node_id === null);
}

function itemCount(value: number | null | undefined): number {
  if (!Number.isFinite(value) || Number(value) < 1) return 0;
  return Math.min(Math.floor(Number(value)), 256);
}

export function deriveGpuInventory(payloads: EngagementInventoryPayload[]): GpuInventoryItem[] {
  const items: GpuInventoryItem[] = [];
  for (const payload of payloads) {
    const comparisonByNode = new Map((payload.comparison?.rows ?? []).map((row) => [row.node_id, row]));
    for (const node of payload.nodes) {
      const row = comparisonByNode.get(node.id);
      const fields = row?.fields ?? {};
      const model = node.gpu_model ?? valueFromCell<string>(fields.gpu_model);
      const vendor = model?.toLowerCase().includes("nvidia") ? "NVIDIA" : null;
      const driverVersion = node.driver_version ?? valueFromCell<string>(fields.driver_version);
      const cudaVersion = node.cuda_version ?? valueFromCell<string>(fields.cuda_version);
      const gpuCount = itemCount(node.gpu_count ?? valueFromCell<number>(fields.gpu_count));
      const record = evidenceForNode(payload.evidenceRecords, node.id);
      const completeness = completenessFromCounts(record, gpuCount > 0, Boolean(model && gpuCount > 0));
      if (gpuCount === 0) continue;
      const relevantFindings = nodeFindings(payload.findings, node.id);
      const validation = validationState(node.validation_status);
      const health = deriveGpuHealth({ validationStatus: validation, findings: relevantFindings, evidenceCompleteness: completeness });
      const warnings = relevantFindings.filter((finding) => !finding.blocking).map((finding) => finding.title);
      const failures = relevantFindings.filter((finding) => finding.blocking).map((finding) => finding.title);
      const provenance = [
        ...provenanceFromCell(fields.gpu_model),
        ...provenanceFromCell(fields.gpu_count),
        ...provenanceFromCell(fields.driver_version),
        ...provenanceFromCell(fields.cuda_version),
        ...provenanceFromCell(fields.nvlink_status),
      ];
      const evidenceSource: GpuInventoryEvidenceSource = {
        source: record ? "engagement_evidence" : "engagement_node",
        evidenceId: record?.id ?? node.current_evidence_id ?? null,
        command: provenance.find((item) => item.source_command)?.source_command ?? null,
        sourceFile: provenance.find((item) => item.source_file)?.source_file ?? null,
        collectedAt: record?.collected_at ?? node.last_collection_at,
        sanitized: record?.sanitized ?? null,
        simulated: record?.simulated ?? node.simulated ?? payload.engagement.simulated,
        completeness,
        commandCounts: {
          total: record?.command_count ?? null,
          collected: record?.collected_count ?? null,
          missing: record?.missing_count ?? null,
          failed: record?.failed_count ?? null,
          skipped: record?.skipped_count ?? null,
        },
        warnings: record?.validation_warnings ?? [],
        provenance,
      };
      for (let index = 0; index < gpuCount; index += 1) {
        const partial: Omit<GpuInventoryItem, "fieldAvailability"> = {
          id: `${payload.engagement.id}:${node.id}:gpu:${index}`,
          clusterId: payload.engagement.id,
          clusterName: payload.engagement.name,
          engagementId: payload.engagement.id,
          engagementName: payload.engagement.name,
          nodeId: node.id,
          nodeName: node.display_name || node.source_hostname || node.id,
          gpuIndex: index,
          vendor,
          model,
          uuid: null,
          serialNumber: null,
          memoryTotal: null,
          driverVersion,
          cudaVersion,
          computeCapability: null,
          pciBusId: null,
          numaNode: null,
          migMode: null,
          eccMode: null,
          nvlinkState: valueFromCell<string>(fields.nvlink_status),
          validationStatus: validation,
          healthStatus: health,
          evidenceCompleteness: completeness,
          evidenceSource,
          lastValidatedAt: node.last_collection_at ?? record?.collected_at ?? payload.readiness?.evaluated_at ?? payload.engagement.updated_at,
          warnings,
          failures,
        };
        items.push({ ...partial, fieldAvailability: fieldAvailability(partial) });
      }
    }
  }
  return dedupeInventory(items);
}

function statusFromCheck(check: ValidationCheck | undefined): GpuInventoryValidationState {
  const status = check?.status;
  if (status === "pass") return "passed";
  if (status === "warning") return "warning";
  if (status === "fail") return "failed";
  if (status === "unavailable") return "not_validated";
  return "unknown";
}

function parseGpuCount(summary: string | undefined): number | null {
  const match = summary?.match(/(?:All\s+)?(\d+)\s+GPUs?/i);
  return match ? Number(match[1]) : null;
}

function parseDriver(summary: string | undefined): string | null {
  return summary?.match(/driver\s+v?([0-9][\w.-]+)/i)?.[1] ?? null;
}

function parseCuda(summary: string | undefined): string | null {
  return summary?.match(/CUDA\s+v?([0-9][\w.-]+)/i)?.[1] ?? null;
}

export function deriveGpuInventoryFromCluster(cluster: Cluster | null | undefined): GpuInventoryItem[] {
  if (!cluster) return [];
  const items: GpuInventoryItem[] = [];
  for (const node of cluster.nodes ?? []) {
    const ecc = getCheck(node, "gpu.ecc_errors");
    const driver = getCheck(node, "gpu.driver_cuda");
    const nvlink = getCheck(node, "gpu.nvlink");
    const gpuChecks = Object.values(node.categories?.gpu?.checks ?? []);
    const count = itemCount(parseGpuCount(ecc?.summary) ?? parseGpuCount(gpuChecks.map((check) => check.summary).join(" ")) ?? 0);
    if (count === 0) continue;
    const validation = [statusFromCheck(ecc), statusFromCheck(driver), statusFromCheck(nvlink)].includes("failed")
      ? "failed"
      : [statusFromCheck(ecc), statusFromCheck(driver), statusFromCheck(nvlink)].includes("warning")
        ? "warning"
        : "passed";
    const completeness: GpuInventoryCompleteness = gpuChecks.some((check) => check.evidence?.length) ? "partial" : "missing";
    const failedChecks = gpuChecks.filter((check) => check.status === "fail");
    const warningChecks = gpuChecks.filter((check) => check.status === "warning");
    const sourceCheck = gpuChecks.find((check) => check.evidence?.length) ?? driver ?? ecc ?? nvlink;
    const evidence = sourceCheck?.evidence?.[0];
    const evidenceSource: GpuInventoryEvidenceSource = {
      source: "scenario_cluster",
      evidenceId: null,
      command: evidence?.command?.join(" ") ?? null,
      sourceFile: null,
      collectedAt: evidence?.timestamp ?? cluster.metadata.collection_timestamp ?? cluster.timestamp,
      sanitized: null,
      simulated: cluster.metadata.simulated !== false,
      completeness,
      commandCounts: { total: gpuChecks.length, collected: gpuChecks.filter((check) => check.evidence?.length).length, missing: null, failed: failedChecks.length, skipped: null },
      warnings: cluster.metadata.limitations ?? [],
      provenance: [],
    };
    for (let index = 0; index < count; index += 1) {
      const partial: Omit<GpuInventoryItem, "fieldAvailability"> = {
        id: `scenario:${cluster.name}:${node.name}:gpu:${index}`,
        clusterId: cluster.name,
        clusterName: cluster.name,
        engagementId: null,
        engagementName: null,
        nodeId: node.name,
        nodeName: node.name,
        gpuIndex: index,
        vendor: "NVIDIA",
        model: null,
        uuid: null,
        serialNumber: null,
        memoryTotal: null,
        driverVersion: parseDriver(driver?.summary),
        cudaVersion: parseCuda(driver?.summary),
        computeCapability: null,
        pciBusId: null,
        numaNode: null,
        migMode: null,
        eccMode: ecc ? statusFromCheck(ecc) : null,
        nvlinkState: nvlink ? statusFromCheck(nvlink) : null,
        validationStatus: validation,
        healthStatus: failedChecks.length ? "failed" : warningChecks.length ? "warning" : "unknown",
        evidenceCompleteness: completeness,
        evidenceSource,
        lastValidatedAt: evidenceSource.collectedAt,
        warnings: warningChecks.map((check) => check.summary),
        failures: failedChecks.map((check) => check.summary),
      };
      items.push({ ...partial, fieldAvailability: fieldAvailability(partial) });
    }
  }
  return dedupeInventory(items);
}

function dedupeInventory(items: GpuInventoryItem[]): GpuInventoryItem[] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const identity = item.uuid ? `uuid:${item.uuid}` : `${item.engagementId ?? item.clusterId}:${item.nodeId}:${item.gpuIndex ?? "unknown"}`;
    const count = seen.get(identity) ?? 0;
    seen.set(identity, count + 1);
    if (count === 0) return item;
    return { ...item, id: `${item.id}:duplicate-${count}`, warnings: [...item.warnings, "Duplicate GPU identifier detected; row key was disambiguated." ] };
  });
}

export function deriveGpuInventorySummary(items: GpuInventoryItem[]): GpuInventorySummary {
  return {
    totalGpus: items.length,
    validatedGpus: items.filter((item) => item.validationStatus === "passed").length,
    warningGpus: items.filter((item) => item.validationStatus === "warning" || item.healthStatus === "warning").length,
    failedGpus: items.filter((item) => item.validationStatus === "failed" || item.healthStatus === "failed").length,
    incompleteEvidenceGpus: items.filter((item) => item.evidenceCompleteness !== "complete").length,
    representedNodes: new Set(items.map((item) => item.nodeName)).size,
    representedModels: new Set(items.map((item) => item.model).filter(Boolean)).size,
    representedDriverVersions: new Set(items.map((item) => item.driverVersion).filter(Boolean)).size,
    representedEngagements: new Set(items.map((item) => item.engagementId ?? item.clusterId).filter(Boolean)).size,
  };
}

function includes(value: string | null | undefined, query: string): boolean {
  return String(value ?? "").toLowerCase().includes(query);
}

export function filterGpuInventory(items: GpuInventoryItem[], filters: GpuInventoryFilterState): GpuInventoryItem[] {
  const query = filters.query.trim().toLowerCase();
  return items.filter((item) => {
    const queryMatch = !query || [item.nodeName, item.model, item.uuid, item.vendor, item.driverVersion, item.cudaVersion, item.engagementName, item.clusterName].some((value) => includes(value, query));
    return queryMatch
      && (filters.validationStatus === "all" || item.validationStatus === filters.validationStatus)
      && (filters.healthStatus === "all" || item.healthStatus === filters.healthStatus)
      && (filters.model === "all" || item.model === filters.model)
      && (filters.vendor === "all" || item.vendor === filters.vendor)
      && (filters.driverVersion === "all" || item.driverVersion === filters.driverVersion)
      && (filters.cudaVersion === "all" || item.cudaVersion === filters.cudaVersion)
      && (filters.engagementId === "all" || item.engagementId === filters.engagementId || item.clusterId === filters.engagementId)
      && (filters.evidenceCompleteness === "all" || item.evidenceCompleteness === filters.evidenceCompleteness);
  });
}

function sortableValue(item: GpuInventoryItem, key: GpuInventorySortKey): string | number {
  if (key === "gpuIndex") return item.gpuIndex ?? Number.MAX_SAFE_INTEGER;
  return String(item[key] ?? "").toLowerCase();
}

export function sortGpuInventory(items: GpuInventoryItem[], sort: GpuInventorySortState): GpuInventoryItem[] {
  return [...items].sort((a, b) => {
    const av = sortableValue(a, sort.key);
    const bv = sortableValue(b, sort.key);
    const result = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
    return sort.direction === "asc" ? result : -result;
  });
}

export function inventoryOptions(items: GpuInventoryItem[], field: "model" | "vendor" | "driverVersion" | "cudaVersion" | "engagement") {
  const values = new Map<string, string>();
  for (const item of items) {
    if (field === "engagement") {
      const id = item.engagementId ?? item.clusterId;
      const label = item.engagementName ?? item.clusterName;
      if (id && label) values.set(id, label);
    } else {
      const value = item[field];
      if (value) values.set(value, value);
    }
  }
  return [...values.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
}

export function exportGpuInventoryCsv(items: GpuInventoryItem[]): string {
  const headers = ["node", "gpu_index", "vendor", "model", "uuid", "driver_version", "cuda_version", "validation_status", "evidence_completeness", "last_validated_at", "engagement", "evidence_source", "evidence_id"];
  const rows = items.map((item) => [
    item.nodeName,
    item.gpuIndex ?? "",
    item.vendor ?? "",
    item.model ?? "",
    item.uuid ?? "",
    item.driverVersion ?? "",
    item.cudaVersion ?? "",
    item.validationStatus,
    item.evidenceCompleteness,
    item.lastValidatedAt ?? "",
    item.engagementName ?? item.clusterName ?? "",
    item.evidenceSource.source,
    item.evidenceSource.evidenceId ?? "",
  ]);
  return [headers, ...rows].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
}

export function validationStatusLabel(status: GpuInventoryValidationState): string {
  return status === "not_validated" ? "Not validated" : status.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}
