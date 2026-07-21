import crypto from "crypto";
import express from "express";
import type { EngagementStore } from "./engagements";

export const AGENT_API_SCHEMA_VERSION = "1.0.0";
export const HARDWARE_DISCOVERY_PROFILE = "hardware-discovery";
export const NCCL_SMOKE_PROFILE = "nccl-smoke";

export type AgentStatus = "online" | "offline" | "degraded";
export type ValidationState = "queued" | "running" | "completed" | "failed" | "timed_out" | "cancelled";
export type ValidationJobState = "queued" | "claimed" | "running" | "completed" | "failed" | "timed_out" | "cancelled";
export type ValidationResultState = "completed" | "failed" | "unavailable" | "timed_out";
export type ValidationProfile = typeof HARDWARE_DISCOVERY_PROFILE | typeof NCCL_SMOKE_PROFILE;
export type ValidationCommandType = "nvidia_smi_list" | "nvidia_smi_inventory" | "nvidia_smi_topology" | "cuda_version" | "driver_version" | "pytorch_gpu_count" | "nccl_all_reduce_smoke";

export type AgentCapability = { name: string; available: boolean; version: string | null; details?: Record<string, string | number | boolean | null> };
export type AgentRecord = {
  id: string;
  schema_version: string;
  stable_key: string;
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
  token_hash: string;
};
export type ValidationCommand = { type: ValidationCommandType; argv: string[]; timeout_seconds: number; max_stdout_bytes: number; max_stderr_bytes: number };
export type ValidationRecord = { id: string; schema_version: string; profile: ValidationProfile; agent_id: string; state: ValidationState; created_at: string; completed_at: string | null; error: string | null; job_ids: string[] };
export type ValidationJobRecord = { id: string; schema_version: string; validation_id: string; agent_id: string; profile: ValidationProfile; state: ValidationJobState; command_type: ValidationCommandType; command: ValidationCommand; timeout_seconds: number; created_at: string; claimed_at: string | null; started_at: string | null; completed_at: string | null; error: string | null };
export type CommandEvidence = { command_type: ValidationCommandType; argv: string[]; started_at: string | null; completed_at: string | null; exit_code: number | null; stdout_sha256: string | null; stderr_sha256: string | null; output_truncated: boolean };
export type ValidationResultRecord = { id: string; schema_version: string; job_id: string; validation_id: string; agent_id: string; state: ValidationResultState; exit_code: number | null; started_at: string | null; completed_at: string; duration_ms: number | null; structured_result: Record<string, unknown>; stdout: string; stderr: string; output_truncated: boolean; command_evidence: CommandEvidence; result_hash: string };

type StoreDoc = Record<string, any>;

const heartbeatIntervalSeconds = 30;
const pollIntervalSeconds = 5;
const maxStdoutBytes = 65_536;
const maxStderrBytes = 16_384;

const commandDefinitions: Record<ValidationCommandType, ValidationCommand> = {
  nvidia_smi_list: { type: "nvidia_smi_list", argv: ["nvidia-smi", "-L"], timeout_seconds: 20, max_stdout_bytes: maxStdoutBytes, max_stderr_bytes: maxStderrBytes },
  nvidia_smi_inventory: { type: "nvidia_smi_inventory", argv: ["nvidia-smi", "--query-gpu=index,name,uuid,pci.bus_id,memory.total,driver_version", "--format=csv,noheader,nounits"], timeout_seconds: 20, max_stdout_bytes: maxStdoutBytes, max_stderr_bytes: maxStderrBytes },
  nvidia_smi_topology: { type: "nvidia_smi_topology", argv: ["nvidia-smi", "topo", "-m"], timeout_seconds: 20, max_stdout_bytes: maxStdoutBytes, max_stderr_bytes: maxStderrBytes },
  cuda_version: { type: "cuda_version", argv: ["nvcc", "--version"], timeout_seconds: 10, max_stdout_bytes: 8_192, max_stderr_bytes: 8_192 },
  driver_version: { type: "driver_version", argv: ["nvidia-smi", "--query-gpu=driver_version", "--format=csv,noheader"], timeout_seconds: 10, max_stdout_bytes: 8_192, max_stderr_bytes: 8_192 },
  pytorch_gpu_count: { type: "pytorch_gpu_count", argv: ["python3", "-c", "import torch; print(torch.cuda.device_count())"], timeout_seconds: 20, max_stdout_bytes: 8_192, max_stderr_bytes: 8_192 },
  nccl_all_reduce_smoke: { type: "nccl_all_reduce_smoke", argv: ["all_reduce_perf", "-b", "8M", "-e", "256M", "-f", "2", "-g", "auto"], timeout_seconds: 120, max_stdout_bytes: maxStdoutBytes, max_stderr_bytes: maxStderrBytes },
};
const hardwareDiscoveryCommands = Object.keys(commandDefinitions) as ValidationCommandType[];
const hardwareDiscoveryCommandTypes: ValidationCommandType[] = ["nvidia_smi_list", "nvidia_smi_inventory", "nvidia_smi_topology", "cuda_version", "driver_version", "pytorch_gpu_count"];
const ncclSmokeCommandTypes: ValidationCommandType[] = ["nccl_all_reduce_smoke"];

function nowIso() { return new Date().toISOString(); }
function id(prefix: string) { return `${prefix}_${crypto.randomUUID()}`; }
function hash(value: string, kind: string) { return crypto.createHash("sha256").update(`gpuvalidator-${kind}-v1:${value}`).digest("hex"); }
function timingSafeHexEqual(left: string, right: string) { const a = Buffer.from(left, "hex"); const b = Buffer.from(right, "hex"); return a.length === b.length && crypto.timingSafeEqual(a, b); }
function stableKey(name: string, hostname: string) { return `${name.trim().toLowerCase()}::${hostname.trim().toLowerCase()}`; }
function offlineThresholdSeconds() { return Number(process.env.GPUVALIDATOR_AGENT_OFFLINE_SECONDS ?? 90); }
function tokenDigest() { const token = process.env.GPUVALIDATOR_AGENT_TOKEN?.trim(); return token ? hash(token, "agent-token") : null; }
function normalizeCapabilities(value: unknown): AgentCapability[] { return Array.isArray(value) ? value.map((cap) => ({ name: String((cap as any)?.name ?? "").trim(), available: (cap as any)?.available === true, version: (cap as any)?.version === undefined || (cap as any)?.version === null ? null : String((cap as any).version), details: typeof (cap as any)?.details === "object" && (cap as any)?.details ? (cap as any).details : undefined })).filter((cap) => cap.name) : []; }
function hasCapability(agent: AgentRecord, command: ValidationCommandType) { return agent.capabilities.some((cap) => cap.name === command && cap.available === true); }
function capability(agent: AgentRecord, name: string) { return agent.capabilities.find((cap) => cap.name === name); }
function ncclCommandForAgent(agent: AgentRecord): ValidationCommand {
  const details = capability(agent, "nccl_all_reduce_smoke")?.details ?? {};
  const gpuCount = Number(details.visible_gpu_count ?? agent.gpu_count ?? 0);
  return { ...commandDefinitions.nccl_all_reduce_smoke, argv: ["all_reduce_perf", "-b", "8M", "-e", "256M", "-f", "2", "-g", String(Math.max(0, gpuCount))] };
}
function publicAgent(agent: AgentRecord): Omit<AgentRecord, "token_hash" | "stable_key"> { const { token_hash: _tokenHash, stable_key: _stableKey, ...safe } = { ...agent, status: deriveStatus(agent) }; return safe; }
function deriveStatus(agent: AgentRecord): AgentStatus { const age = Date.now() - new Date(agent.last_heartbeat_at).getTime(); if (!Number.isFinite(age) || age > offlineThresholdSeconds() * 1000) return "offline"; return agent.last_error ? "degraded" : agent.status === "degraded" ? "degraded" : "online"; }
function truncate(text: unknown, limit: number) { const value = String(text ?? "").replace(/Authorization:\s*Bearer\s+[^\s]+/gi, "Authorization: Bearer ***").replace(/GPUVALIDATOR_AGENT_TOKEN=([^\s]+)/g, "GPUVALIDATOR_AGENT_TOKEN=[redacted]"); return { value: value.slice(0, limit), truncated: value.length > limit }; }
function resultHash(payload: { state: string; stdout: string; stderr: string; structured_result: unknown; exit_code: unknown }) { return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex"); }

function ensureDoc(store: EngagementStore): StoreDoc {
  const document = store.read() as StoreDoc;
  document.validation_agents ??= [];
  document.validations ??= [];
  document.validation_jobs ??= [];
  document.validation_results ??= [];
  return document;
}
function writeDoc(store: EngagementStore, document: StoreDoc) { (store as any).write(document); }
function maintainJobs(document: StoreDoc) {
  const now = Date.now();
  for (const job of document.validation_jobs as ValidationJobRecord[]) {
    if (["queued", "claimed", "running"].includes(job.state)) {
      const base = job.started_at ?? job.claimed_at ?? job.created_at;
      if (now - new Date(base).getTime() > job.timeout_seconds * 1000) {
        job.state = "timed_out";
        job.completed_at = job.completed_at ?? nowIso();
        job.error = job.error ?? "Validation job timed out.";
      }
    }
  }
  for (const validation of document.validations as ValidationRecord[]) deriveValidationState(document, validation);
}
function deriveValidationState(document: StoreDoc, validation: ValidationRecord) {
  const jobs = (document.validation_jobs as ValidationJobRecord[]).filter((job) => job.validation_id === validation.id);
  if (!jobs.length) return validation;
  if (jobs.some((job) => ["failed", "timed_out"].includes(job.state))) validation.state = jobs.some((job) => job.state === "timed_out") ? "timed_out" : "failed";
  else if (jobs.every((job) => job.state === "completed")) validation.state = "completed";
  else if (jobs.some((job) => ["claimed", "running"].includes(job.state))) validation.state = "running";
  else if (jobs.every((job) => job.state === "cancelled")) validation.state = "cancelled";
  else validation.state = "queued";
  if (["completed", "failed", "timed_out", "cancelled"].includes(validation.state)) validation.completed_at ??= nowIso();
  return validation;
}
function requireAgent(req: express.Request, res: express.Response): boolean {
  const expected = tokenDigest();
  const auth = req.get("authorization") ?? "";
  if (!expected || !auth.startsWith("Bearer ")) { res.status(401).set("Cache-Control", "no-store").json({ error: "Agent authentication required." }); return false; }
  const got = hash(auth.slice("Bearer ".length).trim(), "agent-token");
  if (!timingSafeHexEqual(expected, got)) { res.status(401).set("Cache-Control", "no-store").json({ error: "Agent authentication required." }); return false; }
  return true;
}
function err(res: express.Response, status: number, message: string) { return res.status(status).set("Cache-Control", "no-store").json({ error: message }); }

export function registerAgentRoutes(app: express.Express, store: EngagementStore) {
  app.post("/api/v1/agents/register", (req, res) => {
    if (!requireAgent(req, res)) return;
    const name = String(req.body?.name ?? "").trim();
    const hostname = String(req.body?.hostname ?? "").trim();
    if (!name || !hostname) return err(res, 400, "Agent name and hostname are required.");
    const document = ensureDoc(store);
    const key = stableKey(name, hostname);
    const created = nowIso();
    const existing = (document.validation_agents as AgentRecord[]).find((agent) => agent.stable_key === key);
    const next: AgentRecord = existing ?? { id: id("agt"), schema_version: AGENT_API_SCHEMA_VERSION, stable_key: key, name, hostname, registered_at: created, token_hash: tokenDigest() ?? "", status: "online", last_heartbeat_at: created, capabilities: [], gpu_count: null, agent_version: null, last_error: null, metadata: {} };
    next.name = name;
    next.hostname = hostname;
    next.last_heartbeat_at = created;
    next.status = req.body?.last_error ? "degraded" : "online";
    next.capabilities = normalizeCapabilities(req.body?.capabilities);
    next.gpu_count = Number.isFinite(Number(req.body?.gpu_count)) ? Number(req.body.gpu_count) : null;
    next.agent_version = req.body?.agent_version === undefined ? null : String(req.body.agent_version);
    next.last_error = req.body?.last_error ? String(req.body.last_error).slice(0, 512) : null;
    next.metadata = typeof req.body?.metadata === "object" && req.body.metadata ? req.body.metadata : {};
    if (!existing) document.validation_agents.push(next);
    writeDoc(store, document);
    return res.status(existing ? 200 : 201).set("Cache-Control", "no-store").json({ agent: publicAgent(next), agent_id: next.id, heartbeat_interval_seconds: heartbeatIntervalSeconds, poll_interval_seconds: pollIntervalSeconds, server_time: nowIso() });
  });

  app.post("/api/v1/agents/heartbeat", (req, res) => {
    if (!requireAgent(req, res)) return;
    const document = ensureDoc(store);
    const agent = (document.validation_agents as AgentRecord[]).find((item) => item.id === String(req.body?.agent_id ?? ""));
    if (!agent) return err(res, 404, "Agent not found.");
    agent.last_heartbeat_at = nowIso();
    agent.capabilities = normalizeCapabilities(req.body?.capabilities);
    agent.gpu_count = Number.isFinite(Number(req.body?.gpu_count)) ? Number(req.body.gpu_count) : agent.gpu_count;
    agent.agent_version = req.body?.agent_version === undefined ? agent.agent_version : String(req.body.agent_version);
    agent.last_error = req.body?.last_error ? String(req.body.last_error).slice(0, 512) : null;
    agent.status = agent.last_error || req.body?.status === "degraded" ? "degraded" : "online";
    writeDoc(store, document);
    return res.set("Cache-Control", "no-store").json({ agent: publicAgent(agent), server_time: nowIso() });
  });

  app.get("/api/v1/agents", (_req, res) => {
    const document = ensureDoc(store);
    maintainJobs(document);
    writeDoc(store, document);
    return res.set("Cache-Control", "no-store").json({ agents: (document.validation_agents as AgentRecord[]).map(publicAgent), offline_threshold_seconds: offlineThresholdSeconds() });
  });
  app.get("/api/v1/agents/:agentId", (req, res) => {
    const document = ensureDoc(store);
    maintainJobs(document);
    writeDoc(store, document);
    const agent = (document.validation_agents as AgentRecord[]).find((item) => item.id === req.params.agentId);
    if (!agent) return err(res, 404, "Agent not found.");
    return res.set("Cache-Control", "no-store").json({ agent: publicAgent(agent), offline_threshold_seconds: offlineThresholdSeconds() });
  });

  app.post("/api/v1/validations", (req, res) => {
    const profile = String(req.body?.profile ?? "") as ValidationProfile;
    if (![HARDWARE_DISCOVERY_PROFILE, NCCL_SMOKE_PROFILE].includes(profile)) return err(res, 400, "Unsupported validation profile.");
    const document = ensureDoc(store);
    maintainJobs(document);
    const agent = (document.validation_agents as AgentRecord[]).find((item) => item.id === String(req.body?.agent_id ?? ""));
    if (!agent) return err(res, 404, "Agent not found.");
    if (deriveStatus(agent) !== "online") return err(res, 400, "Agent must be online to create validation.");
    const commands = profile === NCCL_SMOKE_PROFILE ? ncclSmokeCommandTypes : hardwareDiscoveryCommandTypes;
    if (profile === HARDWARE_DISCOVERY_PROFILE) {
      const missing = commands.find((command) => !hasCapability(agent, command));
      if (missing) return err(res, 400, `Unsupported command for agent capability: ${missing}.`);
    } else {
      const cap = capability(agent, "nccl_all_reduce_smoke");
      if (!cap?.available || Number(cap.details?.visible_gpu_count ?? agent.gpu_count ?? 0) < 2) return err(res, 400, "NCCL smoke test unavailable: all_reduce_perf and at least two visible GPUs are required.");
    }
    const validation: ValidationRecord = { id: id("val"), schema_version: AGENT_API_SCHEMA_VERSION, profile, agent_id: agent.id, state: "queued", created_at: nowIso(), completed_at: null, error: null, job_ids: [] };
    const jobs = commands.map((commandType): ValidationJobRecord => {
      const command = commandType === "nccl_all_reduce_smoke" ? ncclCommandForAgent(agent) : commandDefinitions[commandType];
      const job: ValidationJobRecord = { id: id("vjob"), schema_version: AGENT_API_SCHEMA_VERSION, validation_id: validation.id, agent_id: agent.id, profile, state: "queued", command_type: commandType, command, timeout_seconds: command.timeout_seconds, created_at: validation.created_at, claimed_at: null, started_at: null, completed_at: null, error: null };
      validation.job_ids.push(job.id);
      return job;
    });
    document.validations.push(validation);
    document.validation_jobs.push(...jobs);
    writeDoc(store, document);
    return res.status(201).set("Cache-Control", "no-store").json({ validation, jobs });
  });

  app.get("/api/v1/validations", (req, res) => {
    const document = ensureDoc(store);
    maintainJobs(document);
    writeDoc(store, document);
    const profile = String(req.query.profile ?? "");
    const validations = (document.validations as ValidationRecord[])
      .filter((validation) => !profile || validation.profile === profile)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .map((validation) => ({
        validation,
        jobs: (document.validation_jobs as ValidationJobRecord[]).filter((job) => job.validation_id === validation.id),
        results: (document.validation_results as ValidationResultRecord[]).filter((result) => result.validation_id === validation.id),
      }));
    return res.set("Cache-Control", "no-store").json({ validations });
  });

  app.get("/api/v1/validations/:validationId", (req, res) => {
    const document = ensureDoc(store);
    maintainJobs(document);
    writeDoc(store, document);
    const validation = (document.validations as ValidationRecord[]).find((item) => item.id === req.params.validationId);
    if (!validation) return err(res, 404, "Validation not found.");
    return res.set("Cache-Control", "no-store").json({ validation, jobs: (document.validation_jobs as ValidationJobRecord[]).filter((job) => job.validation_id === validation.id), results: (document.validation_results as ValidationResultRecord[]).filter((result) => result.validation_id === validation.id) });
  });

  app.get("/api/v1/agents/:agentId/jobs/next", (req, res) => {
    if (!requireAgent(req, res)) return;
    const document = ensureDoc(store);
    maintainJobs(document);
    const job = (document.validation_jobs as ValidationJobRecord[]).find((item) => item.agent_id === req.params.agentId && item.state === "queued");
    writeDoc(store, document);
    return res.set("Cache-Control", "no-store").json({ job: job ?? null, server_time: nowIso() });
  });

  app.post("/api/v1/agents/:agentId/jobs/:jobId/claim", (req, res) => {
    if (!requireAgent(req, res)) return;
    const document = ensureDoc(store);
    maintainJobs(document);
    const job = (document.validation_jobs as ValidationJobRecord[]).find((item) => item.id === req.params.jobId);
    if (!job || job.agent_id !== req.params.agentId) return err(res, 404, "Validation job not found for agent.");
    if (job.state !== "queued") return err(res, 409, "Validation job is not claimable.");
    job.state = "claimed";
    job.claimed_at = nowIso();
    deriveValidationState(document, (document.validations as ValidationRecord[]).find((item) => item.id === job.validation_id)!);
    writeDoc(store, document);
    return res.set("Cache-Control", "no-store").json({ job });
  });

  app.post("/api/v1/agents/:agentId/jobs/:jobId/running", (req, res) => {
    if (!requireAgent(req, res)) return;
    const document = ensureDoc(store);
    maintainJobs(document);
    const job = (document.validation_jobs as ValidationJobRecord[]).find((item) => item.id === req.params.jobId && item.agent_id === req.params.agentId);
    if (!job) return err(res, 404, "Validation job not found for agent.");
    if (job.state !== "claimed" && job.state !== "running") return err(res, 409, "Validation job cannot enter running state.");
    job.state = "running";
    job.started_at ??= nowIso();
    deriveValidationState(document, (document.validations as ValidationRecord[]).find((item) => item.id === job.validation_id)!);
    writeDoc(store, document);
    return res.set("Cache-Control", "no-store").json({ job });
  });

  app.post("/api/v1/jobs/:jobId/results", (req, res) => {
    if (!requireAgent(req, res)) return;
    const document = ensureDoc(store);
    maintainJobs(document);
    const job = (document.validation_jobs as ValidationJobRecord[]).find((item) => item.id === req.params.jobId);
    if (!job) return err(res, 404, "Validation job not found.");
    if (job.agent_id !== String(req.body?.agent_id ?? "")) return err(res, 403, "Result submitted by wrong agent.");
    const state = String(req.body?.state ?? "") as ValidationResultState;
    if (!["completed", "failed", "unavailable", "timed_out"].includes(state)) return err(res, 400, "Unsupported result state.");
    const stdout = truncate(req.body?.stdout, job.command.max_stdout_bytes);
    const stderr = truncate(req.body?.stderr, job.command.max_stderr_bytes);
    const structured = typeof req.body?.structured_result === "object" && req.body.structured_result ? req.body.structured_result : {};
    const completedAt = req.body?.completed_at ? String(req.body.completed_at) : nowIso();
    const startedAt = req.body?.started_at ? String(req.body.started_at) : job.started_at;
    const fingerprint = resultHash({ state, stdout: stdout.value, stderr: stderr.value, structured_result: structured, exit_code: req.body?.exit_code ?? null });
    const duplicate = (document.validation_results as ValidationResultRecord[]).find((result) => result.job_id === job.id && result.agent_id === job.agent_id && result.result_hash === fingerprint);
    if (duplicate) return res.set("Cache-Control", "no-store").json({ result: duplicate, duplicate: true });
    if (!["claimed", "running"].includes(job.state)) return err(res, 409, "Validation job is not accepting results.");
    if ((document.validation_results as ValidationResultRecord[]).some((result) => result.job_id === job.id)) return err(res, 409, "Validation job already has a different result.");
    const result: ValidationResultRecord = { id: id("vres"), schema_version: AGENT_API_SCHEMA_VERSION, job_id: job.id, validation_id: job.validation_id, agent_id: job.agent_id, state, exit_code: req.body?.exit_code === undefined || req.body?.exit_code === null ? null : Number(req.body.exit_code), started_at: startedAt, completed_at: completedAt, duration_ms: startedAt ? Math.max(0, new Date(completedAt).getTime() - new Date(startedAt).getTime()) : null, structured_result: structured, stdout: stdout.value, stderr: stderr.value, output_truncated: stdout.truncated || stderr.truncated || req.body?.output_truncated === true, command_evidence: { command_type: job.command_type, argv: job.command.argv, started_at: startedAt, completed_at: completedAt, exit_code: req.body?.exit_code === undefined || req.body?.exit_code === null ? null : Number(req.body.exit_code), stdout_sha256: stdout.value ? crypto.createHash("sha256").update(stdout.value).digest("hex") : null, stderr_sha256: stderr.value ? crypto.createHash("sha256").update(stderr.value).digest("hex") : null, output_truncated: stdout.truncated || stderr.truncated || req.body?.output_truncated === true }, result_hash: fingerprint };
    document.validation_results.push(result);
    job.state = state === "completed" ? "completed" : state === "timed_out" ? "timed_out" : "failed";
    job.completed_at = completedAt;
    job.error = state === "completed" ? null : (stderr.value || String((structured as any)?.error ?? `${state} result reported.`)).slice(0, 512);
    deriveValidationState(document, (document.validations as ValidationRecord[]).find((item) => item.id === job.validation_id)!);
    writeDoc(store, document);
    return res.set("Cache-Control", "no-store").json({ result, duplicate: false });
  });
}
