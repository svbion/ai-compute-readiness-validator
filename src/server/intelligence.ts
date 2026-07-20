import fs from "fs";
import path from "path";
import crypto from "crypto";
import type express from "express";
import type { Engagement, EngagementNode, EvidenceRecord, EngagementStore, PlatformProfile, ValidationStatus, AcceptanceStatus } from "./engagements";

export const PARSER_VERSION = "1.0.0";
export const FINDINGS_RULE_VERSION = "1.0.0";

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface EvidenceProvenance {
  evidence_id: string;
  source_file: string;
  source_command_id: string | null;
  source_command: string | null;
  collection_timestamp: string;
  source_checksum: string | null;
  parsed_field?: string;
  parsed_value?: unknown;
  sanitized?: boolean;
  simulated?: boolean;
}

export interface ParsedValue<T> {
  value: T | null;
  provenance: EvidenceProvenance | null;
}

export interface ParsedNodeFacts {
  parser_version: string;
  parser_warnings: string[];
  node_id: ParsedValue<string>;
  evidence_id: ParsedValue<string>;
  collector_profile: ParsedValue<string>;
  source_hostname_display: ParsedValue<string>;
  collected_at: ParsedValue<string>;
  operating_system: ParsedValue<string>;
  operating_system_version: ParsedValue<string>;
  kernel_version: ParsedValue<string>;
  cpu_model: ParsedValue<string>;
  cpu_socket_count: ParsedValue<number>;
  cpu_core_count: ParsedValue<number>;
  total_memory_bytes: ParsedValue<number>;
  gpu_vendor: ParsedValue<string>;
  gpu_model: ParsedValue<string>;
  gpu_count: ParsedValue<number>;
  gpu_memory_bytes_per_gpu: ParsedValue<number>;
  driver_version: ParsedValue<string>;
  cuda_version: ParsedValue<string>;
  nvlink_present: ParsedValue<boolean>;
  nvlink_status: ParsedValue<string>;
  dcgm_available: ParsedValue<boolean>;
  dcgm_status: ParsedValue<string>;
  fabric_type: ParsedValue<string>;
  infiniband_device_count: ParsedValue<number>;
  infiniband_link_state: ParsedValue<string>;
  infiniband_link_rate: ParsedValue<string>;
  ofed_version: ParsedValue<string>;
  storage_mounts: ParsedValue<string[]>;
  failed_systemd_units: ParsedValue<string[]>;
  command_success_count: ParsedValue<number>;
  command_missing_count: ParsedValue<number>;
  command_failed_count: ParsedValue<number>;
  sanitized: ParsedValue<boolean>;
  simulated: ParsedValue<boolean>;
}

interface CommandMetadata {
  command_id?: string;
  argv?: string[];
  status?: string;
  stdout_file?: string;
  finished_at?: string;
}

interface ManifestFile {
  path?: string;
  command_id?: string;
  sha256?: string;
}

export interface ProfilePolicy {
  profile: PlatformProfile;
  expected_gpu_count_per_node: number | null;
  homogeneous_gpus_required: boolean;
  homogeneous_driver_versions_required: boolean;
  homogeneous_cuda_versions_required: boolean;
  nvlink_expected: boolean;
  infiniband_expected: boolean;
  required_evidence_domains: string[];
  stale_evidence_threshold_days: number;
  high_command_failure_rate_threshold: number;
  failed_systemd_units_blocking: boolean;
  dcgm_required: boolean;
}

export const profilePolicies: Record<PlatformProfile, ProfilePolicy> = {
  "linux-cluster": policy("linux-cluster", null, false, false, false, false, false, ["linux"]),
  "gpu-workstation": policy("gpu-workstation", null, false, false, false, false, false, ["linux", "gpu"]),
  "single-gpu-node": policy("single-gpu-node", 1, false, false, false, false, false, ["linux", "gpu"]),
  "dgx-a100": policy("dgx-a100", 8, true, true, true, true, true, ["linux", "gpu"]),
  "dgx-h100": policy("dgx-h100", 8, true, true, true, true, true, ["linux", "gpu"]),
  "dgx-b200": policy("dgx-b200", 8, true, true, true, true, true, ["linux", "gpu"]),
  "hgx-a100": policy("hgx-a100", 8, true, true, true, true, true, ["linux", "gpu"]),
  "hgx-h100": policy("hgx-h100", 8, true, true, true, true, true, ["linux", "gpu"]),
  "hgx-b200": policy("hgx-b200", 8, true, true, true, true, true, ["linux", "gpu"]),
  "generic-nvlink-cluster": policy("generic-nvlink-cluster", null, true, true, true, true, false, ["linux", "gpu"]),
};

function policy(profile: PlatformProfile, expected: number | null, homogGpu: boolean, homogDriver: boolean, homogCuda: boolean, nvlink: boolean, ib: boolean, domains: string[]): ProfilePolicy {
  return { profile, expected_gpu_count_per_node: expected, homogeneous_gpus_required: homogGpu, homogeneous_driver_versions_required: homogDriver, homogeneous_cuda_versions_required: homogCuda, nvlink_expected: nvlink, infiniband_expected: ib, required_evidence_domains: domains, stale_evidence_threshold_days: 365, high_command_failure_rate_threshold: 0.2, failed_systemd_units_blocking: false, dcgm_required: false };
}

function evidenceStorageRoot(): string {
  return process.env.AI_VALIDATOR_EVIDENCE_STORAGE_DIR ?? path.join(process.cwd(), "artifacts", "evidence");
}

function pv<T>(value: T | null, provenance: EvidenceProvenance | null): ParsedValue<T> {
  return { value, provenance: value === null ? null : provenance };
}

function emptyFacts(record: Pick<EvidenceRecord, "id" | "node_id" | "collector_profile" | "collected_at" | "sanitized" | "simulated" | "command_count" | "collected_count" | "missing_count" | "failed_count" | "source_hostname_display">): ParsedNodeFacts {
  const base: EvidenceProvenance = { evidence_id: record.id, source_file: "manifest.json", source_command_id: null, source_command: null, collection_timestamp: record.collected_at, source_checksum: null, sanitized: record.sanitized, simulated: record.simulated };
  return {
    parser_version: PARSER_VERSION,
    parser_warnings: [],
    node_id: pv(record.node_id, base), evidence_id: pv(record.id, base), collector_profile: pv(record.collector_profile, base), source_hostname_display: pv(record.source_hostname_display, base), collected_at: pv(record.collected_at, base),
    operating_system: pv(null, null), operating_system_version: pv(null, null), kernel_version: pv(null, null), cpu_model: pv(null, null), cpu_socket_count: pv(null, null), cpu_core_count: pv(null, null), total_memory_bytes: pv(null, null), gpu_vendor: pv(null, null), gpu_model: pv(null, null), gpu_count: pv(null, null), gpu_memory_bytes_per_gpu: pv(null, null), driver_version: pv(null, null), cuda_version: pv(null, null), nvlink_present: pv(null, null), nvlink_status: pv(null, null), dcgm_available: pv(null, null), dcgm_status: pv(null, null), fabric_type: pv(null, null), infiniband_device_count: pv(null, null), infiniband_link_state: pv(null, null), infiniband_link_rate: pv(null, null), ofed_version: pv(null, null), storage_mounts: pv(null, null), failed_systemd_units: pv(null, null),
    command_success_count: pv(record.collected_count, base), command_missing_count: pv(record.missing_count, base), command_failed_count: pv(record.failed_count, base), sanitized: pv(record.sanitized, base), simulated: pv(record.simulated, base),
  };
}

function readJsonSafe(filePath: string): any {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); } catch { return null; }
}

function readTextSafe(filePath: string): string | null {
  try { return fs.readFileSync(filePath, "utf8"); } catch { return null; }
}

function parseMemoryBytes(raw: string): number | null {
  const match = raw.match(/([\d.]+)\s*([KMGTPE]?i?B?|[KMGTPE])?/i);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = (match[2] || "B").toUpperCase().replace("IB", "").replace("B", "");
  const multipliers: Record<string, number> = { "": 1, K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4, P: 1024 ** 5, E: 1024 ** 6 };
  return Number.isFinite(value) ? Math.round(value * (multipliers[unit] ?? 1)) : null;
}

function parseKeyValueLine(text: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`^\\s*${escaped}\\s*(?:=|:)?\\s*(.+)$`, "im"));
  return match?.[1]?.trim().replace(/^"|"$/g, "") ?? null;
}

export function parseAcceptedEvidence(record: EvidenceRecord, evidenceRoot: string): ParsedNodeFacts {
  const facts = emptyFacts(record);
  const commands = readJsonSafe(path.join(evidenceRoot, "metadata", "commands.json"));
  const commandList: CommandMetadata[] = Array.isArray(commands) ? commands : [];
  const manifest = readJsonSafe(path.join(evidenceRoot, "manifest.json")) ?? {};
  const files: ManifestFile[] = Array.isArray(manifest.files) ? manifest.files : [];
  const commandByFile = new Map(commandList.filter((cmd) => cmd.stdout_file).map((cmd) => [String(cmd.stdout_file), cmd]));
  const manifestByFile = new Map(files.filter((file) => file.path).map((file) => [String(file.path), file]));
  const prov = (sourceFile: string, field: string, value: unknown): EvidenceProvenance => {
    const cmd = commandByFile.get(sourceFile);
    const file = manifestByFile.get(sourceFile);
    return { evidence_id: record.id, source_file: sourceFile, source_command_id: cmd?.command_id ?? file?.command_id ?? null, source_command: cmd?.argv?.join(" ") ?? null, collection_timestamp: cmd?.finished_at ?? record.collected_at, source_checksum: file?.sha256 ?? null, parsed_field: field, parsed_value: value, sanitized: record.sanitized, simulated: record.simulated };
  };
  const set = <K extends keyof ParsedNodeFacts>(key: K, value: any, sourceFile: string) => {
    (facts[key] as ParsedValue<any>) = pv(value, prov(sourceFile, String(key), value));
  };
  const text = (rel: string) => readTextSafe(path.join(evidenceRoot, rel));

  try {
    const osRelease = text("linux/os-release.txt");
    if (osRelease) {
      set("operating_system", parseKeyValueLine(osRelease, "PRETTY_NAME") ?? parseKeyValueLine(osRelease, "NAME"), "linux/os-release.txt");
      set("operating_system_version", parseKeyValueLine(osRelease, "VERSION_ID") ?? parseKeyValueLine(osRelease, "VERSION"), "linux/os-release.txt");
    }
    const uname = text("linux/uname.txt");
    if (uname) set("kernel_version", uname.trim().split(/\s+/)[2] ?? null, "linux/uname.txt");
    const lscpu = text("linux/lscpu.txt");
    if (lscpu) {
      set("cpu_model", parseKeyValueLine(lscpu, "Model name"), "linux/lscpu.txt");
      const sockets = Number(parseKeyValueLine(lscpu, "Socket(s)"));
      const coresPerSocket = Number(parseKeyValueLine(lscpu, "Core(s) per socket"));
      set("cpu_socket_count", Number.isFinite(sockets) ? sockets : null, "linux/lscpu.txt");
      set("cpu_core_count", Number.isFinite(sockets) && Number.isFinite(coresPerSocket) ? sockets * coresPerSocket : null, "linux/lscpu.txt");
    }
    const lsmem = text("linux/lsmem.txt");
    if (lsmem) set("total_memory_bytes", parseMemoryBytes(parseKeyValueLine(lsmem, "Total online memory") ?? lsmem), "linux/lsmem.txt");
    const findmnt = text("linux/findmnt.txt");
    if (findmnt) set("storage_mounts", findmnt.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 100), "linux/findmnt.txt");
    const df = text("linux/df.txt");
    if (!findmnt && df) set("storage_mounts", df.split(/\r?\n/).slice(1).map((line) => line.trim()).filter(Boolean).slice(0, 100), "linux/df.txt");
    const failed = text("linux/systemctl-failed.txt");
    if (failed) {
      const units = failed.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("0 loaded") && !line.startsWith("UNIT ") && !line.startsWith("LOAD "));
      set("failed_systemd_units", units, "linux/systemctl-failed.txt");
    }
  } catch (error) { facts.parser_warnings.push(`Linux parser warning: ${error instanceof Error ? error.message : "unknown"}`); }

  try {
    const smi = text("gpu/nvidia-smi.txt");
    const smiq = text("gpu/nvidia-smi-query.txt");
    const gpuText = [smi, smiq].filter(Boolean).join("\n");
    if (gpuText) {
      const driver = gpuText.match(/Driver Version\s*:?\s*([0-9][\w.\-]+)/i)?.[1] ?? null;
      const cuda = gpuText.match(/CUDA Version\s*:?\s*([0-9][\w.\-]+)/i)?.[1] ?? null;
      if (driver) set("driver_version", driver, smi?.includes(driver) ? "gpu/nvidia-smi.txt" : "gpu/nvidia-smi-query.txt");
      if (cuda) set("cuda_version", cuda, smi?.includes(cuda) ? "gpu/nvidia-smi.txt" : "gpu/nvidia-smi-query.txt");
      const product = parseKeyValueLine(gpuText, "Product Name") ?? gpuText.match(/NVIDIA\s+(?:A|H|B)\d{2,4}[^|\n)]*/i)?.[0]?.trim() ?? null;
      if (product) { set("gpu_vendor", "NVIDIA", smiq ? "gpu/nvidia-smi-query.txt" : "gpu/nvidia-smi.txt"); set("gpu_model", product, smiq ? "gpu/nvidia-smi-query.txt" : "gpu/nvidia-smi.txt"); }
      const attachedRaw = parseKeyValueLine(gpuText, "Attached GPUs");
      const attached = attachedRaw === null ? NaN : Number(attachedRaw);
      const lines = gpuText.match(/\|\s*\d+\s+NVIDIA\s+[^|]+\|/g)?.length;
      const simpleCount = gpuText.match(/(\d+)\s*x\s*NVIDIA/i)?.[1];
      set("gpu_count", Number.isFinite(attached) ? attached : (lines ?? (simpleCount ? Number(simpleCount) : null)), smiq ? "gpu/nvidia-smi-query.txt" : "gpu/nvidia-smi.txt");
      const mem = gpuText.match(/Total\s*:?\s*([0-9]+)\s*MiB/i)?.[1];
      if (mem) set("gpu_memory_bytes_per_gpu", Number(mem) * 1024 * 1024, smiq ? "gpu/nvidia-smi-query.txt" : "gpu/nvidia-smi.txt");
    }
    const topo = text("gpu/topology.txt");
    if (topo) {
      const hasNv = /NV\d+|NVL/i.test(topo);
      const hasIb = /mlx5|IB|InfiniBand/i.test(topo);
      set("nvlink_present", hasNv, "gpu/topology.txt");
      if (hasNv && !facts.nvlink_status.value) set("nvlink_status", "present", "gpu/topology.txt");
      if (hasIb) { set("fabric_type", "InfiniBand", "gpu/topology.txt"); const devs = new Set(topo.match(/mlx5_\d+/g) ?? []); set("infiniband_device_count", devs.size || null, "gpu/topology.txt"); }
    }
    const nvlink = text("gpu/nvlink-status.txt");
    if (nvlink) {
      const healthy = /GB\/s|active|up/i.test(nvlink) && !/inactive|down|disabled|error/i.test(nvlink);
      set("nvlink_present", true, "gpu/nvlink-status.txt");
      set("nvlink_status", healthy ? "healthy" : "degraded", "gpu/nvlink-status.txt");
    }
    const dcgm = text("gpu/dcgm-discovery.txt");
    if (dcgm) { set("dcgm_available", !/not found|error|failed/i.test(dcgm), "gpu/dcgm-discovery.txt"); set("dcgm_status", /not found|error|failed/i.test(dcgm) ? "unavailable" : "available", "gpu/dcgm-discovery.txt"); }
  } catch (error) { facts.parser_warnings.push(`GPU parser warning: ${error instanceof Error ? error.message : "unknown"}`); }

  const statuses = commandList.map((cmd) => String(cmd.status ?? ""));
  if (statuses.length) {
    const base = { evidence_id: record.id, source_file: "metadata/commands.json", source_command_id: null, source_command: null, collection_timestamp: record.collected_at, source_checksum: manifestByFile.get("metadata/commands.json")?.sha256 ?? null, sanitized: record.sanitized, simulated: record.simulated };
    facts.command_success_count = pv(statuses.filter((s) => s === "collected").length, base);
    facts.command_missing_count = pv(statuses.filter((s) => s === "missing").length, base);
    facts.command_failed_count = pv(statuses.filter((s) => ["failed", "timeout", "denied"].includes(s)).length, base);
  }
  return facts;
}

const comparableFields = ["operating_system_version", "kernel_version", "gpu_model", "gpu_count", "driver_version", "cuda_version", "nvlink_status", "fabric_type", "ofed_version", "total_memory_bytes"] as const;
type ComparableField = typeof comparableFields[number];

export interface ComparisonFieldMeta { consensus_value: unknown; warning?: string; }
export interface ComparisonCell { value: unknown; consensus_value: unknown; matches_consensus: boolean; missing: boolean; provenance: EvidenceProvenance | null; }
export interface ClusterComparison { engagement_id: string; parser_version: string; evaluated_at: string; warnings: string[]; fields: Record<string, ComparisonFieldMeta>; rows: Array<{ node_id: string; node: string; evidence_status: string; simulated: boolean; validation_status: ValidationStatus | "not_evaluated"; node_readiness: number | null; fields: Record<string, ComparisonCell> }>; }

function consensus(values: unknown[], field: string): { value: unknown; warning?: string } {
  const present = values.filter((value) => value !== null && value !== undefined && value !== "");
  if (!present.length) return { value: null };
  if (field === "total_memory_bytes") {
    const nums = present.filter((v): v is number => typeof v === "number");
    if (nums.length === present.length) {
      const first = nums[0];
      if (nums.every((n) => Math.abs(n - first) / Math.max(first, 1) <= 0.03)) return { value: first };
    }
  }
  const counts = new Map<string, { value: unknown; count: number }>();
  for (const value of present) {
    const key = JSON.stringify(value);
    const item = counts.get(key) ?? { value, count: 0 };
    item.count += 1;
    counts.set(key, item);
  }
  const sorted = [...counts.values()].sort((a, b) => b.count - a.count);
  if (sorted.length > 1 && sorted[0].count === sorted[1].count) return { value: null, warning: `Consensus tie for ${field}; no consensus selected.` };
  return { value: sorted[0].value };
}

function matches(value: unknown, consensusValue: unknown, field: string): boolean {
  if (value === null || value === undefined || consensusValue === null || consensusValue === undefined) return true;
  if (field === "total_memory_bytes" && typeof value === "number" && typeof consensusValue === "number") return Math.abs(value - consensusValue) / Math.max(consensusValue, 1) <= 0.03;
  return JSON.stringify(value) === JSON.stringify(consensusValue);
}

export function deriveClusterComparison(engagementId: string, facts: ParsedNodeFacts[], nodes: EngagementNode[]): ClusterComparison {
  const warnings: string[] = [];
  const fields: Record<string, ComparisonFieldMeta> = {};
  for (const field of comparableFields) {
    const result = consensus(facts.map((fact) => (fact[field] ?? pv(null, null)).value), field);
    fields[field] = { consensus_value: result.value, warning: result.warning };
    if (result.warning) warnings.push(result.warning);
  }
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  return {
    engagement_id: engagementId,
    parser_version: PARSER_VERSION,
    evaluated_at: new Date().toISOString(),
    warnings,
    fields,
    rows: facts.map((fact) => {
      const nodeId = fact.node_id.value ?? "unknown";
      const node = nodeById.get(nodeId);
      const cells: Record<string, ComparisonCell> = {};
      for (const field of comparableFields) {
        const parsed = fact[field] ?? pv(null, null);
        const value = parsed.value;
        const tieMismatch = Boolean(fields[field].warning && value !== null && value !== undefined && value !== "");
        cells[field] = { value, consensus_value: fields[field].consensus_value, matches_consensus: tieMismatch ? false : matches(value, fields[field].consensus_value, field), missing: value === null || value === undefined || value === "", provenance: parsed.provenance };
      }
      return { node_id: nodeId, node: node?.display_name ?? nodeId, evidence_status: node?.collection_status ?? "received", simulated: fact.simulated.value === true, validation_status: node?.validation_status ?? "not_evaluated", node_readiness: node?.readiness_score ?? null, fields: cells };
    }),
  };
}

export interface Finding { id: string; rule_id: string; rule_version: string; engagement_id: string; node_id: string | null; category: string; severity: Severity; title: string; description: string; impact: string; recommendation: string; verification_command: string; blocking: boolean; evidence_references: EvidenceProvenance[]; created_at: string; simulated: boolean; }

function makeFinding(input: Omit<Finding, "id" | "rule_version" | "created_at">): Finding {
  const stable = crypto.createHash("sha256").update(JSON.stringify([input.rule_id, input.engagement_id, input.node_id, input.evidence_references.map((ref) => [ref.evidence_id, ref.source_file, ref.parsed_field, ref.parsed_value])])).digest("hex").slice(0, 16);
  return { ...input, id: `fnd_${stable}`, rule_version: FINDINGS_RULE_VERSION, created_at: new Date().toISOString() };
}

function firstRefs(facts: ParsedNodeFacts[], field: ComparableField): EvidenceProvenance[] {
  return facts.map((fact) => fact[field].provenance).filter((item): item is EvidenceProvenance => Boolean(item));
}

export function deriveFindings(engagement: Engagement, facts: ParsedNodeFacts[], comparison: ClusterComparison, now = new Date()): Finding[] {
  const policy = profilePolicies[engagement.platform_profile];
  const findings: Finding[] = [];
  const clusterSimulated = facts.some((fact) => fact.simulated.value === true) || engagement.simulated;
  const mismatch = (field: ComparableField) => comparison.rows.some((row) => row.fields[field] && !row.fields[field].missing && !row.fields[field].matches_consensus);
  const addClusterMismatch = (field: ComparableField, ruleId: string, severity: Severity, blocking: boolean, title: string, recommendation: string) => {
    if (!mismatch(field)) return;
    findings.push(makeFinding({ rule_id: ruleId, engagement_id: engagement.id, node_id: null, category: "cluster_consistency", severity, title, description: `${title} across accepted node evidence.`, impact: blocking ? "Customer acceptance is blocked until homogeneous cluster configuration is restored or the profile policy is changed." : "Operational drift may complicate support and reproducibility.", recommendation, verification_command: "Review accepted collector output for the affected field on every node.", blocking, evidence_references: firstRefs(facts, field), simulated: clusterSimulated }));
    const baseline = comparison.rows.find((row) => !row.fields[field]?.missing)?.fields[field]?.value;
    for (const row of comparison.rows) {
      const cell = row.fields[field];
      if (baseline !== undefined && !cell?.missing && JSON.stringify(cell.value) !== JSON.stringify(baseline)) {
        findings.push(makeFinding({ rule_id: `${ruleId}-node-drift`, engagement_id: engagement.id, node_id: row.node_id, category: "cluster_consistency", severity, title, description: `${row.node} differs from the first accepted node for ${field}.`, impact: blocking ? "This node requires remediation before homogeneous cluster acceptance." : "This node has configuration drift for review.", recommendation, verification_command: "Review accepted collector output for the affected field on this node.", blocking, evidence_references: cell.provenance ? [cell.provenance] : [], simulated: row.simulated }));
      }
    }
  };
  if (policy.homogeneous_gpus_required) addClusterMismatch("gpu_model", "gpu-model-mismatch", "critical", true, "GPU model mismatch", "Align GPU inventory or split unlike nodes into separate engagements.");
  if (policy.homogeneous_gpus_required) addClusterMismatch("gpu_count", "gpu-count-mismatch", "critical", true, "GPU count mismatch", "Confirm all nodes expose the expected number of GPUs.");
  if (policy.homogeneous_driver_versions_required) addClusterMismatch("driver_version", "driver-version-mismatch", "high", true, "NVIDIA driver version mismatch", "Standardize the NVIDIA driver version across the homogeneous profile.");
  if (policy.homogeneous_cuda_versions_required) addClusterMismatch("cuda_version", "cuda-version-mismatch", "high", true, "CUDA version mismatch", "Standardize the CUDA runtime/toolkit version reported by NVIDIA tooling.");
  addClusterMismatch("kernel_version", "kernel-version-mismatch", "medium", false, "Kernel version mismatch", "Review kernel drift and confirm supportability.");
  addClusterMismatch("operating_system_version", "os-version-mismatch", "medium", false, "OS version mismatch", "Review OS image drift and patch policy.");
  if (policy.infiniband_expected) addClusterMismatch("ofed_version", "ofed-version-mismatch", "high", true, "OFED version mismatch", "Standardize OFED/RDMA stack versions for InfiniBand profiles.");

  for (const fact of facts) {
    const nodeId = fact.node_id.value;
    const refs = (...fields: (keyof ParsedNodeFacts)[]) => fields.map((field) => (fact[field] as ParsedValue<unknown> | undefined)?.provenance).filter((item): item is EvidenceProvenance => Boolean(item));
    const val = <T = unknown>(field: keyof ParsedNodeFacts) => (fact[field] as ParsedValue<T> | undefined)?.value ?? null;
    const simulated = fact.simulated.value === true || clusterSimulated;
    if (policy.expected_gpu_count_per_node !== null && val<number>("gpu_count") !== null && val<number>("gpu_count")! < policy.expected_gpu_count_per_node) findings.push(makeFinding({ rule_id: "missing-expected-gpus", engagement_id: engagement.id, node_id: nodeId, category: "node_health", severity: "critical", title: "Missing expected GPUs", description: `Node reports ${val<number>("gpu_count")} GPUs; policy expects ${policy.expected_gpu_count_per_node}.`, impact: "GPU acceptance is blocked for this node.", recommendation: "Verify GPU visibility, driver state, PCIe/NVSwitch health, and platform inventory.", verification_command: "nvidia-smi -L", blocking: true, evidence_references: refs("gpu_count"), simulated }));
    if (policy.nvlink_expected && val<boolean>("nvlink_present") === false) findings.push(makeFinding({ rule_id: "nvlink-unavailable", engagement_id: engagement.id, node_id: nodeId, category: "node_health", severity: "critical", title: "NVLink unavailable on NVLink profile", description: "No NVLink topology was detected in accepted evidence.", impact: "GPU collective communication topology is not acceptance-ready.", recommendation: "Inspect NVLink/NVSwitch state and platform cabling/service health.", verification_command: "nvidia-smi topo -m && nvidia-smi nvlink --status", blocking: true, evidence_references: refs("nvlink_present"), simulated }));
    if (policy.nvlink_expected && val<string>("nvlink_status") && !["healthy", "present"].includes(val<string>("nvlink_status")!)) findings.push(makeFinding({ rule_id: "nvlink-degraded", engagement_id: engagement.id, node_id: nodeId, category: "node_health", severity: "critical", title: "NVLink degraded or inactive", description: `NVLink status is ${val<string>("nvlink_status")}.`, impact: "GPU fabric readiness is blocked.", recommendation: "Repair inactive/degraded NVLink paths before acceptance.", verification_command: "nvidia-smi nvlink --status", blocking: true, evidence_references: refs("nvlink_status"), simulated }));
    if (policy.required_evidence_domains.includes("gpu") && val<string>("driver_version") === null) findings.push(makeFinding({ rule_id: "nvidia-command-missing", engagement_id: engagement.id, node_id: nodeId, category: "node_health", severity: "high", title: "NVIDIA command missing on GPU profile", description: "NVIDIA driver/runtime evidence was not available.", impact: "GPU readiness cannot be established.", recommendation: "Install/repair NVIDIA tooling or rerun the collector where nvidia-smi is available.", verification_command: "nvidia-smi", blocking: true, evidence_references: refs("command_missing_count", "collector_profile"), simulated }));
    if (val<boolean>("dcgm_available") === false || (policy.dcgm_required && val<boolean>("dcgm_available") !== true)) findings.push(makeFinding({ rule_id: "dcgm-unavailable", engagement_id: engagement.id, node_id: nodeId, category: "node_health", severity: "medium", title: "DCGM unavailable", description: "DCGM discovery evidence is unavailable or unhealthy.", impact: "Telemetry and diagnostics coverage is reduced.", recommendation: "Confirm DCGM is installed and healthy if required by the validation policy.", verification_command: "dcgmi discovery -l", blocking: policy.dcgm_required, evidence_references: refs("dcgm_available", "dcgm_status"), simulated }));
    if ((val<string[]>("failed_systemd_units")?.length ?? 0) > 0) findings.push(makeFinding({ rule_id: "failed-systemd-units", engagement_id: engagement.id, node_id: nodeId, category: "node_health", severity: "medium", title: "Failed systemd units detected", description: `${val<string[]>("failed_systemd_units")?.length ?? 0} failed units were reported.`, impact: "Node operational health has unresolved service failures.", recommendation: "Review failed units and remediate relevant platform services.", verification_command: "systemctl --failed", blocking: policy.failed_systemd_units_blocking, evidence_references: refs("failed_systemd_units"), simulated }));
    const total = (val<number>("command_success_count") ?? 0) + (val<number>("command_missing_count") ?? 0) + (val<number>("command_failed_count") ?? 0);
    const failureRate = total ? ((val<number>("command_missing_count") ?? 0) + (val<number>("command_failed_count") ?? 0)) / total : 0;
    if (failureRate > policy.high_command_failure_rate_threshold) findings.push(makeFinding({ rule_id: "high-command-failure-rate", engagement_id: engagement.id, node_id: nodeId, category: "node_health", severity: "high", title: "High command failure rate", description: `${Math.round(failureRate * 100)}% of expected commands were missing or failed.`, impact: "Evidence quality is insufficient for reliable acceptance.", recommendation: "Rerun collection with required commands available or document approved limitations.", verification_command: "Review metadata/commands.json", blocking: true, evidence_references: refs("command_missing_count", "command_failed_count"), simulated }));
    if (val<boolean>("sanitized") === false) findings.push(makeFinding({ rule_id: "unsanitized-evidence", engagement_id: engagement.id, node_id: nodeId, category: "evidence_quality", severity: "info", title: "Unsanitized evidence", description: "Evidence was accepted without collector sanitization metadata.", impact: "Reviewers should confirm evidence-handling policy before broader sharing.", recommendation: "Use --sanitize when customer policy requires redaction.", verification_command: "Review manifest.json sanitized flag", blocking: false, evidence_references: refs("sanitized"), simulated }));
    if (val<boolean>("simulated") === true) findings.push(makeFinding({ rule_id: "simulated-evidence", engagement_id: engagement.id, node_id: nodeId, category: "evidence_quality", severity: "info", title: "Simulated evidence", description: "This evidence is a fixture for demonstration only.", impact: "Computed acceptance is not valid for customer acceptance.", recommendation: "Replace with real customer-approved evidence before production acceptance.", verification_command: "Review manifest.json simulated flag", blocking: false, evidence_references: refs("simulated"), simulated: true }));
    const collectedValue = val<string>("collected_at");
    const collected = collectedValue ? Date.parse(collectedValue) : NaN;
    if (!Number.isFinite(collected) || now.getTime() - collected > policy.stale_evidence_threshold_days * 24 * 60 * 60 * 1000) findings.push(makeFinding({ rule_id: "stale-evidence", engagement_id: engagement.id, node_id: nodeId, category: "evidence_quality", severity: "high", title: "Stale evidence", description: `Evidence is older than ${policy.stale_evidence_threshold_days} days or has an invalid timestamp.`, impact: "Acceptance requires current evidence.", recommendation: "Collect a fresh evidence bundle before customer acceptance.", verification_command: "Review manifest collection timestamp", blocking: true, evidence_references: refs("collected_at"), simulated }));
  }
  if (engagement.received_node_count < engagement.expected_node_count) findings.push(makeFinding({ rule_id: "missing-required-domain", engagement_id: engagement.id, node_id: null, category: "node_health", severity: "high", title: "Evidence missing for expected node collection", description: `Received ${engagement.received_node_count} of ${engagement.expected_node_count} expected node collections.`, impact: "Engagement cannot be fully evaluated until expected nodes are represented.", recommendation: "Upload accepted evidence for every expected node or revise engagement scope.", verification_command: "Review engagement node evidence status", blocking: true, evidence_references: [], simulated: clusterSimulated }));
  return findings;
}

export interface ScoreSection { score: number; max: number; deductions: string[]; status?: string; }
export interface NodeReadiness { node_id: string; score: number; status: ValidationStatus; breakdown: Record<string, ScoreSection>; deduction_reasons: string[]; }
export interface EngagementReadiness { engagement_id: string; readiness_score: number | null; acceptance_status: AcceptanceStatus; expected_node_count: number; received_node_count: number; ready_node_count: number; remediation_node_count: number; failed_node_count: number; blocking_findings_count: number; evaluated_at: string; simulated_demo_warning: string | null; nodes: NodeReadiness[]; breakdown: Record<string, ScoreSection>; deduction_reasons: string[]; }

function section(max: number): ScoreSection { return { score: max, max, deductions: [] }; }
function deduct(sec: ScoreSection, amount: number, reason: string) { sec.score = Math.max(0, sec.score - amount); sec.deductions.push(reason); }
function nodeStatus(findings: Finding[], score: number): ValidationStatus {
  if (findings.some((f) => f.blocking && f.severity === "critical")) return "failed";
  if (findings.some((f) => f.blocking && f.severity === "high")) return "remediation_required";
  if (findings.some((f) => ["medium", "low"].includes(f.severity))) return "observations";
  return score >= 80 ? "ready" : "remediation_required";
}

export function deriveReadiness(engagement: Engagement, facts: ParsedNodeFacts[], findings: Finding[]): EngagementReadiness {
  const nodes = facts.map((fact): NodeReadiness => {
    const nodeId = fact.node_id.value ?? "unknown";
    const nodeFindings = findings.filter((finding) => finding.node_id === nodeId || finding.node_id === null);
    const val = <T = unknown>(field: keyof ParsedNodeFacts) => (fact[field] as ParsedValue<T> | undefined)?.value ?? null;
    const breakdown: Record<string, ScoreSection> = { evidence_completeness: section(20), linux: section(15), gpu: section(30), topology: section(15), fabric: section(10), consistency: section(10), benchmarks: { score: 0, max: 0, deductions: ["Benchmark results are evaluated separately and are not included in the current readiness score."], status: "not_evaluated" } };
    if (!val("operating_system") || !val("kernel_version")) deduct(breakdown.evidence_completeness, 5, "Missing Linux identity evidence.");
    if (!val("driver_version") || !val("gpu_count")) deduct(breakdown.evidence_completeness, 7, "Missing GPU inventory or driver evidence.");
    if ((val<number>("command_missing_count") ?? 0) > 0) deduct(breakdown.evidence_completeness, 4, "Collector reported missing commands.");
    if ((val<number>("command_failed_count") ?? 0) > 0) deduct(breakdown.evidence_completeness, 4, "Collector reported failed commands.");
    if ((val<string[]>("failed_systemd_units")?.length ?? 0) > 0) deduct(breakdown.linux, 5, "Failed systemd units detected.");
    if (!val("cpu_model") || !val("total_memory_bytes")) deduct(breakdown.linux, 3, "CPU or memory evidence is incomplete.");
    if (!val("gpu_count")) deduct(breakdown.gpu, 15, "GPU count is missing.");
    if (!val("driver_version")) deduct(breakdown.gpu, 10, "NVIDIA driver version is missing.");
    if (val("dcgm_available") !== true) deduct(breakdown.gpu, 3, "DCGM is unavailable or not reported.");
    if (val("nvlink_status") !== "healthy" && val("nvlink_status") !== "present") deduct(breakdown.topology, 8, "NVLink topology/status is missing or degraded.");
    if (!val("fabric_type")) deduct(breakdown.fabric, 5, "Fabric type is missing.");
    for (const finding of nodeFindings) {
      const amount = finding.severity === "critical" ? 18 : finding.severity === "high" ? 10 : finding.severity === "medium" ? 4 : finding.severity === "low" ? 2 : 0;
      const bucket = finding.category === "cluster_consistency" ? breakdown.consistency : finding.category === "evidence_quality" ? breakdown.evidence_completeness : finding.rule_id.includes("nvlink") ? breakdown.topology : finding.rule_id.includes("ofed") ? breakdown.fabric : finding.rule_id.includes("gpu") || finding.rule_id.includes("driver") || finding.rule_id.includes("cuda") ? breakdown.gpu : breakdown.linux;
      if (amount) deduct(bucket, amount, `${finding.severity.toUpperCase()}: ${finding.title}`);
    }
    const score = Math.round(Object.values(breakdown).reduce((sum, item) => sum + item.score, 0));
    return { node_id: nodeId, score, status: nodeStatus(nodeFindings.filter((f) => f.node_id === nodeId), score), breakdown, deduction_reasons: Object.values(breakdown).flatMap((item) => item.deductions) };
  });
  const blockingCritical = findings.some((f) => f.blocking && f.severity === "critical");
  const blockingHigh = findings.some((f) => f.blocking && f.severity === "high");
  const hasMediumLow = findings.some((f) => ["medium", "low"].includes(f.severity));
  const incomplete = engagement.received_node_count < engagement.expected_node_count;
  const acceptance_status: AcceptanceStatus = incomplete ? "not_evaluated" : blockingCritical ? "failed" : blockingHigh ? "remediation_required" : hasMediumLow ? "ready_with_observations" : "ready";
  const ready = nodes.filter((node) => node.status === "ready").length;
  const remediation = nodes.filter((node) => node.status === "remediation_required" || node.status === "observations").length;
  const failed = nodes.filter((node) => node.status === "failed").length;
  const readiness_score = nodes.length ? Math.round(nodes.reduce((sum, node) => sum + node.score, 0) / nodes.length) : null;
  const breakdown: Record<string, ScoreSection> = {};
  for (const key of ["evidence_completeness", "linux", "gpu", "topology", "fabric", "consistency", "benchmarks"]) {
    const max = nodes[0]?.breakdown[key]?.max ?? 0;
    const avg = nodes.length ? Math.round(nodes.reduce((sum, node) => sum + (node.breakdown[key]?.score ?? 0), 0) / nodes.length) : 0;
    breakdown[key] = { score: avg, max, deductions: [...new Set(nodes.flatMap((node) => node.breakdown[key]?.deductions ?? []))], status: key === "benchmarks" ? "not_evaluated" : undefined };
  }
  return { engagement_id: engagement.id, readiness_score, acceptance_status, expected_node_count: engagement.expected_node_count, received_node_count: engagement.received_node_count, ready_node_count: ready, remediation_node_count: remediation, failed_node_count: failed, blocking_findings_count: findings.filter((finding) => finding.blocking).length, evaluated_at: new Date().toISOString(), simulated_demo_warning: findings.some((finding) => finding.rule_id === "simulated-evidence") ? "DEMONSTRATION ONLY — NOT VALID FOR CUSTOMER ACCEPTANCE" : null, nodes, breakdown, deduction_reasons: Object.values(breakdown).flatMap((item) => item.deductions) };
}

export function evaluateEngagement(store: EngagementStore, engagementId: string) {
  const document = store.read();
  const engagement = document.engagements.find((item) => item.id === engagementId);
  if (!engagement) return null;
  const nodes = document.nodes.filter((node) => node.engagement_id === engagementId);
  const records = document.evidence_records.filter((record) => record.engagement_id === engagementId && record.ingestion_status === "accepted");
  const facts = records.map((record) => parseAcceptedEvidence(record, path.join(evidenceStorageRoot(), record.storage_key)));
  const workingEngagement = { ...engagement, received_node_count: nodes.filter((node) => node.collection_status !== "awaiting_evidence").length };
  const comparison = deriveClusterComparison(engagementId, facts, nodes);
  const findings = deriveFindings(workingEngagement, facts, comparison);
  const readiness = deriveReadiness(workingEngagement, facts, findings);
  const nodeById = new Map(readiness.nodes.map((node) => [node.node_id, node]));
  document.nodes = document.nodes.map((node) => {
    if (node.engagement_id !== engagementId) return node;
    const result = nodeById.get(node.id);
    const nodeFindings = findings.filter((finding) => finding.node_id === node.id);
    return { ...node, validation_status: result?.status ?? (node.collection_status === "awaiting_evidence" ? "not_evaluated" : node.validation_status), readiness_score: result?.score ?? node.readiness_score, findings_count: nodeFindings.length, critical_findings_count: nodeFindings.filter((finding) => finding.severity === "critical").length, high_findings_count: nodeFindings.filter((finding) => finding.severity === "high").length, gpu_model: facts.find((fact) => fact.node_id.value === node.id)?.gpu_model.value ?? node.gpu_model, gpu_count: facts.find((fact) => fact.node_id.value === node.id)?.gpu_count.value ?? node.gpu_count, driver_version: facts.find((fact) => fact.node_id.value === node.id)?.driver_version.value ?? node.driver_version, cuda_version: facts.find((fact) => fact.node_id.value === node.id)?.cuda_version.value ?? node.cuda_version, kernel_version: facts.find((fact) => fact.node_id.value === node.id)?.kernel_version.value ?? node.kernel_version, operating_system: facts.find((fact) => fact.node_id.value === node.id)?.operating_system.value ?? node.operating_system, ofed_version: facts.find((fact) => fact.node_id.value === node.id)?.ofed_version.value ?? node.ofed_version, fabric_type: facts.find((fact) => fact.node_id.value === node.id)?.fabric_type.value ?? node.fabric_type };
  });
  document.engagements = document.engagements.map((item) => item.id === engagementId ? { ...item, readiness_score: readiness.readiness_score, acceptance_status: readiness.acceptance_status, ready_node_count: readiness.ready_node_count, remediation_node_count: readiness.remediation_node_count, failed_node_count: readiness.failed_node_count, received_node_count: readiness.received_node_count, updated_at: readiness.evaluated_at } : item);
  store.write(document);
  return { facts, comparison, findings, readiness };
}

export function provenanceForEvidence(store: EngagementStore, engagementId: string, evidenceId: string): EvidenceProvenance[] | null {
  const record = store.read().evidence_records.find((item) => item.engagement_id === engagementId && item.id === evidenceId);
  if (!record) return null;
  const facts = parseAcceptedEvidence(record, path.join(evidenceStorageRoot(), record.storage_key));
  const refs: EvidenceProvenance[] = [];
  for (const [field, parsed] of Object.entries(facts)) {
    if (field === "parser_version" || field === "parser_warnings") continue;
    const value = parsed as ParsedValue<unknown>;
    if (value.provenance) refs.push({ ...value.provenance, parsed_field: field, parsed_value: value.value });
  }
  const seen = new Set<string>();
  return refs.filter((ref) => { const key = `${ref.source_file}:${ref.parsed_field}:${JSON.stringify(ref.parsed_value)}`; if (seen.has(key)) return false; seen.add(key); return true; });
}

function errorResponse(res: express.Response, status: number, message: string) { return res.status(status).json({ error: message }); }

export function registerIntelligenceRoutes(app: express.Express, store: EngagementStore) {
  app.post("/api/v1/engagements/:engagementId/evaluate", (req, res) => {
    const evaluated = evaluateEngagement(store, req.params.engagementId);
    if (!evaluated) return errorResponse(res, 404, "Engagement not found.");
    return res.set("Cache-Control", "no-store").json(evaluated);
  });
  app.get("/api/v1/engagements/:engagementId/comparison", (req, res) => {
    const evaluated = evaluateEngagement(store, req.params.engagementId);
    if (!evaluated) return errorResponse(res, 404, "Engagement not found.");
    return res.set("Cache-Control", "no-store").json({ comparison: evaluated.comparison, facts: evaluated.facts });
  });
  app.get("/api/v1/engagements/:engagementId/findings", (req, res) => {
    const evaluated = evaluateEngagement(store, req.params.engagementId);
    if (!evaluated) return errorResponse(res, 404, "Engagement not found.");
    return res.set("Cache-Control", "no-store").json({ findings: evaluated.findings });
  });
  app.get("/api/v1/engagements/:engagementId/readiness", (req, res) => {
    const evaluated = evaluateEngagement(store, req.params.engagementId);
    if (!evaluated) return errorResponse(res, 404, "Engagement not found.");
    return res.set("Cache-Control", "no-store").json({ readiness: evaluated.readiness });
  });
  app.get("/api/v1/engagements/:engagementId/evidence/:evidenceId/provenance", (req, res) => {
    if (!store.getEngagement(req.params.engagementId)) return errorResponse(res, 404, "Engagement not found.");
    const provenance = provenanceForEvidence(store, req.params.engagementId, req.params.evidenceId);
    if (!provenance) return errorResponse(res, 404, "Evidence not found.");
    return res.set("Cache-Control", "no-store").json({ evidence_id: req.params.evidenceId, provenance });
  });
}
