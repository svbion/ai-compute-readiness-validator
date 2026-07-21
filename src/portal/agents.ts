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

export interface HardwareDiscoveryCommandView {
  commandType: ValidationCommandType;
  label: string;
  status: ValidationResultState | "missing";
  exitCode: number | null;
  durationMs: number | null;
  parsedSummary: string;
  parserWarnings: string[];
  stdout: string;
  stderr: string;
  truncated: boolean;
  evidenceTimestamp: string | null;
  argv: string[];
}
export interface HardwareDiscoveryRuleView { id: string; label: string; status: "passed" | "warning" | "failed" | "unavailable"; detail: string }
export interface HardwareDiscoveryValidationView {
  validationId: string;
  profile: string;
  agentId: string;
  agentName: string;
  node: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  overallState: ValidationState;
  gpuCount: number;
  passedChecks: number;
  warnings: number;
  failedChecks: number;
  unavailableChecks: number;
  partial: boolean;
  commands: HardwareDiscoveryCommandView[];
  rules: HardwareDiscoveryRuleView[];
}

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

const commandLabels: Record<ValidationCommandType, string> = {
  nvidia_smi_list: "nvidia-smi GPU list",
  nvidia_smi_inventory: "GPU inventory",
  nvidia_smi_topology: "GPU topology",
  driver_version: "Driver version",
  cuda_version: "CUDA version",
  pytorch_gpu_count: "PyTorch GPU count",
};
const hardwareCommandOrder: ValidationCommandType[] = ["nvidia_smi_list", "nvidia_smi_inventory", "nvidia_smi_topology", "driver_version", "cuda_version", "pytorch_gpu_count"];

function commandSummary(commandType: ValidationCommandType, result: ValidationResultRecord | undefined): string {
  if (!result) return "No result uploaded.";
  if (result.state === "timed_out") return "Command timed out before evidence was collected.";
  if (result.state === "unavailable") return String(result.structured_result?.error ?? result.stderr ?? "Tool unavailable on agent.");
  const rows = asArray(result.structured_result?.gpus);
  if (commandType === "nvidia_smi_list") return rows.length ? `${rows.length} GPUs discovered` : "No GPUs parsed from nvidia-smi list output.";
  if (commandType === "nvidia_smi_inventory") {
    const uuidCount = rows.filter((row) => str(row.uuid)).length;
    const pciCount = rows.filter((row) => str(row.pci_bus_id) ?? str(row["pci.bus_id"])).length;
    return `${rows.length} GPU inventory rows, ${uuidCount} UUIDs, ${pciCount} PCI bus IDs`;
  }
  if (commandType === "nvidia_smi_topology") return result.stdout.trim() ? "Topology matrix collected." : "Topology output empty.";
  if (commandType === "driver_version") return (str(result.structured_result?.driver_version) ?? result.stdout.trim() ?? "Driver version not parsed.") || "Driver version not parsed.";
  if (commandType === "cuda_version") return (str(result.structured_result?.cuda_version) ?? str(result.structured_result?.version) ?? result.stdout.trim() ?? "CUDA toolkit state collected.") || "CUDA toolkit state collected.";
  if (commandType === "pytorch_gpu_count") return (str(result.structured_result?.gpu_count) ?? result.stdout.trim() ?? "PyTorch GPU count collected.") || "PyTorch GPU count collected.";
  return "Command evidence collected.";
}

function parserWarnings(commandType: ValidationCommandType, result: ValidationResultRecord | undefined): string[] {
  if (!result) return ["Result has not been uploaded by the agent."];
  const warnings: string[] = [];
  if (result.output_truncated || result.command_evidence.output_truncated) warnings.push("Output was truncated before storage.");
  if (result.state === "unavailable") warnings.push(`${commandLabels[commandType]} unavailable on the selected agent.`);
  if (result.state === "failed" || result.state === "timed_out") warnings.push(`${commandLabels[commandType]} reported ${result.state}.`);
  const rows = asArray(result.structured_result?.gpus);
  if ((commandType === "nvidia_smi_list" || commandType === "nvidia_smi_inventory") && result.state === "completed" && rows.length === 0) warnings.push("Parser did not find GPU rows in command output.");
  if (commandType === "nvidia_smi_inventory" && rows.some((row) => !str(row.uuid) || !(str(row.pci_bus_id) ?? str(row["pci.bus_id"])))) warnings.push("One or more inventory rows are missing UUID or PCI bus ID.");
  return warnings;
}

function rule(id: string, label: string, status: HardwareDiscoveryRuleView["status"], detail: string): HardwareDiscoveryRuleView { return { id, label, status, detail }; }

export function deriveHardwareDiscoveryValidationView(detail: ValidationDetail, agents: AgentRecord[]): HardwareDiscoveryValidationView {
  const agent = agents.find((candidate) => candidate.id === detail.validation.agent_id) ?? null;
  const byType = new Map(detail.results.map((result) => [result.command_evidence.command_type, result]));
  const commands = hardwareCommandOrder.map((commandType): HardwareDiscoveryCommandView => {
    const result = byType.get(commandType);
    return { commandType, label: commandLabels[commandType], status: result?.state ?? "missing", exitCode: result?.exit_code ?? null, durationMs: result?.duration_ms ?? null, parsedSummary: commandSummary(commandType, result), parserWarnings: parserWarnings(commandType, result), stdout: result?.stdout ?? "", stderr: result?.stderr ?? "", truncated: Boolean(result?.output_truncated || result?.command_evidence.output_truncated), evidenceTimestamp: result?.command_evidence.completed_at ?? result?.completed_at ?? null, argv: result?.command_evidence.argv ?? [] };
  });
  const listRows = asArray(byType.get("nvidia_smi_list")?.structured_result?.gpus);
  const inventoryRows = asArray(byType.get("nvidia_smi_inventory")?.structured_result?.gpus);
  const discoveredGpuCount = inventoryRows.length || listRows.length || agent?.gpu_count || 0;
  const uuidCount = inventoryRows.filter((row) => str(row.uuid)).length;
  const pciCount = inventoryRows.filter((row) => str(row.pci_bus_id) ?? str(row["pci.bus_id"])).length;
  const driver = byType.get("driver_version");
  const topology = byType.get("nvidia_smi_topology");
  const cuda = byType.get("cuda_version");
  const pytorch = byType.get("pytorch_gpu_count");
  const pytorchCount = num(pytorch?.structured_result?.gpu_count ?? pytorch?.stdout);
  const rules: HardwareDiscoveryRuleView[] = [
    rule("agent-online", "Agent was online", agent?.status === "online" ? "passed" : agent ? "failed" : "warning", agent ? `${agent.name} is ${agent.status}` : "Agent record was not found."),
    rule("nvidia-smi-executed", "nvidia-smi executed", byType.get("nvidia_smi_list")?.state === "completed" ? "passed" : "failed", commandSummary("nvidia_smi_list", byType.get("nvidia_smi_list"))),
    rule("gpus-discovered", "One or more GPUs discovered", discoveredGpuCount > 0 ? "passed" : "failed", `${discoveredGpuCount} GPUs discovered.`),
    rule("stable-uuids-collected", "Stable GPU UUIDs collected", inventoryRows.length > 0 && uuidCount === inventoryRows.length ? "passed" : "failed", `${uuidCount}/${inventoryRows.length} inventory rows include UUIDs.`),
    rule("inventory-count-matches", "Inventory row count matches discovered GPU count", inventoryRows.length > 0 && inventoryRows.length === (listRows.length || discoveredGpuCount) ? "passed" : "failed", `${inventoryRows.length} inventory rows for ${listRows.length || discoveredGpuCount} discovered GPUs.`),
    rule("driver-version-collected", "Driver version collected", driver?.state === "completed" && Boolean((str(driver.structured_result?.driver_version) ?? driver.stdout.trim())) ? "passed" : "failed", commandSummary("driver_version", driver)),
    rule("pci-bus-ids-collected", "PCI bus IDs collected", inventoryRows.length > 0 && pciCount === inventoryRows.length ? "passed" : "failed", `${pciCount}/${inventoryRows.length} inventory rows include PCI bus IDs.`),
    rule("topology-collected", "Topology collected", topology?.state === "completed" && Boolean(topology.stdout.trim()) ? "passed" : "failed", commandSummary("nvidia_smi_topology", topology)),
    rule("pytorch-count-matches", "PyTorch GPU count matches when available", pytorch?.state === "unavailable" ? "unavailable" : pytorch?.state === "completed" && (pytorchCount === null || pytorchCount === discoveredGpuCount) ? "passed" : "failed", pytorch?.state === "unavailable" ? "PyTorch unavailable; not a blocking failure." : `PyTorch reported ${pytorchCount ?? "unknown"} for ${discoveredGpuCount} discovered GPUs.`),
    rule("cuda-state-collected", "CUDA toolkit state collected or marked unavailable", cuda?.state === "completed" ? "passed" : cuda?.state === "unavailable" ? "unavailable" : "failed", cuda?.state === "unavailable" ? "CUDA toolkit unavailable; NVIDIA driver discovery may still pass." : commandSummary("cuda_version", cuda)),
  ];
  const started = detail.results.map((result) => result.started_at).filter((value): value is string => Boolean(value)).sort()[0] ?? null;
  const durationMs = started && detail.validation.completed_at ? new Date(detail.validation.completed_at).getTime() - new Date(started).getTime() : null;
  const failedChecks = rules.filter((item) => item.status === "failed").length;
  const unavailableChecks = rules.filter((item) => item.status === "unavailable").length;
  const warnings = rules.filter((item) => item.status === "warning" || item.status === "unavailable").length + commands.reduce((sum, command) => sum + command.parserWarnings.length, 0);
  return { validationId: detail.validation.id, profile: detail.validation.profile, agentId: detail.validation.agent_id, agentName: agent?.name ?? detail.validation.agent_id, node: agent?.hostname ?? "Not collected", createdAt: detail.validation.created_at, startedAt: started, completedAt: detail.validation.completed_at, durationMs, overallState: detail.validation.state, gpuCount: discoveredGpuCount, passedChecks: rules.filter((item) => item.status === "passed").length, warnings, failedChecks, unavailableChecks, partial: detail.validation.state === "completed" && (unavailableChecks > 0 || commands.some((command) => command.status === "missing" || command.status === "timed_out")), commands, rules };
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
export function fetchValidation(validationId: string, signal?: AbortSignal) { return json<ValidationDetail>(`/api/v1/validations/${encodeURIComponent(validationId)}`, undefined, signal); }
export function createHardwareValidation(agentId: string, signal?: AbortSignal) {
  return json<{ validation: ValidationRecord; jobs: ValidationJobRecord[] }>("/api/v1/validations", { method: "POST", body: JSON.stringify({ profile: "hardware-discovery", agent_id: agentId }) }, signal);
}
