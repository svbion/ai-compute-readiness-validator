import type { GpuInventoryItem, GpuInventoryValidationState } from "./inventory";

export type AgentStatus = "online" | "offline" | "degraded";
export type ValidationState = "queued" | "running" | "completed" | "failed" | "timed_out" | "cancelled";
export type ValidationResultState = "completed" | "failed" | "unavailable" | "timed_out";
export type ValidationCommandType = "nvidia_smi_list" | "nvidia_smi_inventory" | "nvidia_smi_topology" | "cuda_version" | "driver_version" | "pytorch_gpu_count";

export interface AgentCapability { name: string; available: boolean; version: string | null; details?: Record<string, unknown> }
export interface AgentRecord {
  id: string;
  schema_version: string;
  name: string;
  hostname: string;
  status: AgentStatus;
  capabilities: AgentCapability[];
  gpu_count: number | null;
  agent_version: string | null;
  registered_at: string;
  last_heartbeat_at: string;
  last_error: string | null;
  metadata: Record<string, unknown>;
}
export interface ValidationRecord { id: string; schema_version: string; profile: "hardware-discovery"; agent_id: string; state: ValidationState; created_at: string; completed_at: string | null; error: string | null; job_ids: string[] }
export interface ValidationJobRecord { id: string; validation_id: string; agent_id: string; state: string; command_type: ValidationCommandType; command?: { argv?: string[] } }
export interface ValidationResultRecord {
  id: string;
  schema_version: string;
  job_id: string;
  validation_id: string;
  agent_id: string;
  state: ValidationResultState;
  exit_code: number | null;
  started_at: string | null;
  completed_at: string;
  duration_ms: number | null;
  structured_result: Record<string, unknown>;
  stdout: string;
  stderr: string;
  output_truncated: boolean;
  command_evidence: { command_type: ValidationCommandType; argv: string[]; started_at: string | null; completed_at: string | null; exit_code: number | null; stdout_sha256: string | null; stderr_sha256: string | null; output_truncated: boolean };
  result_hash: string;
}
export interface ValidationDetail { validation: ValidationRecord; jobs: ValidationJobRecord[]; results: ValidationResultRecord[] }
export interface AgentListPayload { agents: AgentRecord[]; offline_threshold_seconds: number }
export interface ValidationListPayload { validations: ValidationDetail[] }

export interface LiveDashboardSummary {
  connectedAgents: number;
  onlineAgents: number;
  discoveredNodes: number;
  discoveredGpus: number;
  latestValidation: ValidationRecord | null;
  latestValidationTimestamp: string | null;
  stateLabel: "no agent configured" | "agent offline" | "agent online" | "validation queued" | "validation running" | "validation completed" | "validation failed" | "validation partial";
  selectableAgents: AgentRecord[];
}

function latestValidation(validations: ValidationDetail[]): ValidationDetail | null {
  return [...validations].sort((a, b) => String(b.validation.created_at).localeCompare(String(a.validation.created_at)))[0] ?? null;
}

function validationIsPartial(detail: ValidationDetail): boolean {
  return detail.validation.state === "completed" && detail.results.some((result) => result.state !== "completed");
}

export function summarizeLiveAgentDashboard(agents: AgentRecord[], validations: ValidationDetail[], _now = new Date().toISOString()): LiveDashboardSummary {
  const onlineAgents = agents.filter((agent) => agent.status === "online");
  const latest = latestValidation(validations);
  let stateLabel: LiveDashboardSummary["stateLabel"] = "no agent configured";
  if (agents.length && onlineAgents.length === 0) stateLabel = "agent offline";
  if (onlineAgents.length) stateLabel = "agent online";
  if (latest && onlineAgents.length > 0) {
    if (latest.validation.state === "queued") stateLabel = "validation queued";
    else if (latest.validation.state === "running") stateLabel = "validation running";
    else if (latest.validation.state === "completed") stateLabel = validationIsPartial(latest) ? "validation partial" : "validation completed";
    else if (["failed", "timed_out", "cancelled"].includes(latest.validation.state)) stateLabel = "validation failed";
  }
  return {
    connectedAgents: agents.length,
    onlineAgents: onlineAgents.length,
    discoveredNodes: new Set(agents.map((agent) => agent.hostname).filter(Boolean)).size,
    discoveredGpus: agents.reduce((sum, agent) => sum + (agent.gpu_count ?? 0), 0),
    latestValidation: latest?.validation ?? null,
    latestValidationTimestamp: latest?.validation.completed_at ?? latest?.validation.created_at ?? null,
    stateLabel,
    selectableAgents: onlineAgents,
  };
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null) : [];
}
function str(value: unknown): string | null { return value === undefined || value === null || value === "" ? null : String(value); }
function num(value: unknown): number | null { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function normalizeMemory(value: unknown): string | null {
  const text = str(value);
  if (!text) return null;
  return /mib|gib|gb|mb/i.test(text) ? text : `${text} MiB`;
}
function statusForValidation(state: ValidationState): GpuInventoryValidationState {
  if (state === "completed") return "passed";
  if (state === "queued" || state === "running") return "not_validated";
  if (state === "failed" || state === "timed_out") return "failed";
  return "unknown";
}

export function deriveLiveGpuInventory(agents: AgentRecord[], validations: ValidationDetail[]): GpuInventoryItem[] {
  const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
  const latestByAgent = new Map<string, ValidationDetail>();
  for (const detail of [...validations].sort((a, b) => String(a.validation.created_at).localeCompare(String(b.validation.created_at)))) {
    latestByAgent.set(detail.validation.agent_id, detail);
  }
  const items: GpuInventoryItem[] = [];
  for (const [agentId, detail] of latestByAgent) {
    const agent = agentsById.get(agentId);
    if (!agent) continue;
    const resultsByType = new Map(detail.results.map((result) => [result.command_evidence.command_type, result]));
    const list = resultsByType.get("nvidia_smi_list");
    const inventory = resultsByType.get("nvidia_smi_inventory");
    const driver = resultsByType.get("driver_version");
    const cuda = resultsByType.get("cuda_version");
    const topology = resultsByType.get("nvidia_smi_topology");
    const pytorch = resultsByType.get("pytorch_gpu_count");
    const gpuRows = asArray(inventory?.structured_result?.gpus).length ? asArray(inventory?.structured_result?.gpus) : asArray(list?.structured_result?.gpus);
    const warnings = [
      ...(cuda && cuda.state !== "completed" ? ["CUDA unavailable or not reported by the live agent."] : []),
      ...(pytorch && pytorch.state !== "completed" ? ["PyTorch unavailable or not reported by the live agent."] : []),
      ...detail.results.filter((result) => result.state === "failed" || result.state === "timed_out").map((result) => `${result.command_evidence.command_type} reported ${result.state}.`),
    ];
    const rawEvidence = detail.results.map((result) => [
      `$ ${result.command_evidence.argv.join(" ")}`,
      result.stdout,
      result.stderr ? `stderr:\n${result.stderr}` : "",
    ].filter(Boolean).join("\n")).join("\n\n---\n\n");
    for (const row of gpuRows) {
      const index = num(row.index) ?? items.length;
      const model = str(row.name) ?? str(row.model);
      const partial: Omit<GpuInventoryItem, "fieldAvailability"> = {
        id: `live:${detail.validation.id}:${agent.id}:gpu:${index}`,
        clusterId: null,
        clusterName: null,
        engagementId: null,
        engagementName: null,
        agentId: agent.id,
        agentName: agent.name,
        validationId: detail.validation.id,
        nodeId: agent.hostname,
        nodeName: agent.hostname,
        gpuIndex: index,
        vendor: model?.toLowerCase().includes("nvidia") || str(row.uuid)?.startsWith("GPU-") ? "NVIDIA" : null,
        model,
        uuid: str(row.uuid),
        serialNumber: null,
        memoryTotal: normalizeMemory(row.memory_total ?? row["memory.total"]),
        driverVersion: (str(row.driver_version) ?? str(driver?.structured_result?.driver_version) ?? str(driver?.stdout)?.trim()) || null,
        cudaVersion: cuda?.state === "completed" ? ((str(cuda.structured_result?.cuda_version) ?? str(cuda.structured_result?.version) ?? str(cuda.stdout)?.trim()) || null) : null,
        computeCapability: null,
        pciBusId: str(row.pci_bus_id) ?? str(row["pci.bus_id"]),
        numaNode: null,
        migMode: null,
        eccMode: null,
        nvlinkState: topology?.state === "completed" ? "available" : null,
        validationStatus: statusForValidation(detail.validation.state),
        healthStatus: detail.results.some((result) => result.state === "failed" || result.state === "timed_out") ? "failed" : warnings.length ? "warning" : "unknown",
        evidenceCompleteness: detail.results.every((result) => result.state === "completed") ? "complete" : detail.results.length ? "partial" : "missing",
        evidenceSource: {
          source: "live_agent",
          evidenceId: detail.validation.id,
          command: inventory?.command_evidence.argv.join(" ") ?? list?.command_evidence.argv.join(" ") ?? null,
          sourceFile: null,
          collectedAt: detail.validation.completed_at ?? detail.validation.created_at,
          sanitized: true,
          simulated: false,
          completeness: detail.results.every((result) => result.state === "completed") ? "complete" : "partial",
          commandCounts: { total: detail.validation.job_ids.length || detail.jobs.length || null, collected: detail.results.filter((result) => result.state === "completed").length, missing: null, failed: detail.results.filter((result) => result.state === "failed" || result.state === "timed_out").length, skipped: detail.results.filter((result) => result.state === "unavailable").length },
          warnings,
          provenance: [],
          rawEvidence,
          validationId: detail.validation.id,
          originLabel: "Live Agent",
        },
        lastValidatedAt: detail.validation.completed_at ?? detail.validation.created_at,
        warnings,
        failures: detail.results.filter((result) => result.state === "failed" || result.state === "timed_out").map((result) => `${result.command_evidence.command_type}: ${result.stderr || result.state}`),
      };
      items.push({ ...partial, fieldAvailability: {
        vendor: partial.vendor ? "available" : "not_collected",
        model: partial.model ? "available" : "not_collected",
        uuid: partial.uuid ? "available" : "not_collected",
        serialNumber: "not_collected",
        memoryTotal: partial.memoryTotal ? "available" : "not_collected",
        driverVersion: partial.driverVersion ? "available" : "not_collected",
        cudaVersion: partial.cudaVersion ? "available" : "not_collected",
        computeCapability: "not_collected",
        pciBusId: partial.pciBusId ? "available" : "not_collected",
        numaNode: "not_collected",
        migMode: "not_collected",
        eccMode: "not_collected",
        nvlinkState: partial.nvlinkState ? "available" : "not_collected",
        telemetry: "not_collected",
      } });
    }
  }
  return items;
}

async function json<T>(url: string, init?: RequestInit, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { ...init, signal, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((payload as { error?: string }).error ?? `Request failed: ${response.status}`);
  return payload as T;
}

export function fetchAgents(signal?: AbortSignal) { return json<AgentListPayload>("/api/v1/agents", undefined, signal); }
export function fetchValidations(signal?: AbortSignal) { return json<ValidationListPayload>("/api/v1/validations?profile=hardware-discovery", undefined, signal); }
export function createHardwareValidation(agentId: string, signal?: AbortSignal) {
  return json<{ validation: ValidationRecord; jobs: ValidationJobRecord[] }>("/api/v1/validations", { method: "POST", body: JSON.stringify({ profile: "hardware-discovery", agent_id: agentId }) }, signal);
}
