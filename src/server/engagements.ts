import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import type express from "express";

export const ENGAGEMENT_SCHEMA_VERSION = "1.0.0";

export const platformProfiles = [
  "linux-cluster",
  "gpu-workstation",
  "single-gpu-node",
  "dgx-a100",
  "dgx-h100",
  "dgx-b200",
  "hgx-a100",
  "hgx-h100",
  "hgx-b200",
  "generic-nvlink-cluster",
] as const;

export const engagementStatuses = ["draft", "collecting", "processing", "ready_for_review", "complete", "archived"] as const;
export const acceptanceStatuses = ["not_evaluated", "ready", "ready_with_observations", "remediation_required", "failed"] as const;
export const collectionStatuses = ["awaiting_evidence", "received", "validating", "validated", "rejected", "superseded"] as const;
export const validationStatuses = ["not_evaluated", "ready", "observations", "remediation_required", "failed"] as const;

export type PlatformProfile = typeof platformProfiles[number];
export type EngagementStatus = typeof engagementStatuses[number];
export type AcceptanceStatus = typeof acceptanceStatuses[number];
export type CollectionStatus = typeof collectionStatuses[number];
export type ValidationStatus = typeof validationStatuses[number];

export interface EngagementNode {
  id: string;
  engagement_id: string;
  display_name: string;
  source_hostname: string | null;
  node_fingerprint: string | null;
  platform_profile: PlatformProfile;
  gpu_model: string | null;
  gpu_count: number | null;
  driver_version: string | null;
  cuda_version: string | null;
  kernel_version: string | null;
  operating_system: string | null;
  ofed_version: string | null;
  fabric_type: string | null;
  collection_status: CollectionStatus;
  validation_status: ValidationStatus;
  readiness_score: number | null;
  last_collection_at: string | null;
  simulated: boolean;
  findings_count: number;
  critical_findings_count: number;
  high_findings_count: number;
}

export interface Engagement {
  id: string;
  schema_version: string;
  name: string;
  customer_name: string;
  description: string;
  platform_profile: PlatformProfile;
  expected_node_count: number;
  received_node_count: number;
  ready_node_count: number;
  remediation_node_count: number;
  failed_node_count: number;
  status: EngagementStatus;
  acceptance_status: AcceptanceStatus;
  readiness_score: number | null;
  created_at: string;
  updated_at: string;
  collection_deadline: string | null;
  created_by: string;
  simulated: boolean;
  tags: string[];
}

interface StoreDocument {
  schema_version: string;
  engagements: Engagement[];
  nodes: EngagementNode[];
}

export interface EngagementStoreOptions {
  filePath?: string;
  createdByFallback?: string;
  clock?: () => Date;
  idGenerator?: () => string;
}

const validTransitions: Record<EngagementStatus, EngagementStatus[]> = {
  draft: ["collecting", "archived"],
  collecting: ["processing", "archived"],
  processing: ["ready_for_review", "archived"],
  ready_for_review: ["complete", "archived"],
  complete: ["archived"],
  archived: [],
};

function nowIso(clock: () => Date): string {
  return clock().toISOString();
}

function isOneOf<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === "string" && values.includes(value as T[number]);
}

function sanitizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))].slice(0, 12);
}

function parseDeadline(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new Error("collection_deadline must be an ISO timestamp or empty.");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("collection_deadline cannot be invalid.");
  return date.toISOString();
}

function defaultStorePath(): string {
  return path.join(process.cwd(), "artifacts", "engagements", "store.json");
}

function deriveCounts(engagement: Engagement, nodes: EngagementNode[]): Engagement {
  const engagementNodes = nodes.filter((node) => node.engagement_id === engagement.id && node.collection_status !== "superseded");
  const received = engagementNodes.filter((node) => node.collection_status !== "awaiting_evidence").length;
  const ready = engagementNodes.filter((node) => node.validation_status === "ready").length;
  const remediation = engagementNodes.filter((node) => node.validation_status === "remediation_required" || node.validation_status === "observations").length;
  const failed = engagementNodes.filter((node) => node.validation_status === "failed" || node.collection_status === "rejected").length;
  const scored = engagementNodes.map((node) => node.readiness_score).filter((score): score is number => typeof score === "number");
  return {
    ...engagement,
    received_node_count: received,
    ready_node_count: ready,
    remediation_node_count: remediation,
    failed_node_count: failed,
    readiness_score: scored.length ? Math.round((scored.reduce((sum, score) => sum + score, 0) / scored.length) * 100) / 100 : null,
  };
}

function validateDocument(document: StoreDocument): StoreDocument {
  const engagements = Array.isArray(document.engagements) ? document.engagements : [];
  const nodes = Array.isArray(document.nodes) ? document.nodes : [];
  return {
    schema_version: ENGAGEMENT_SCHEMA_VERSION,
    engagements: engagements.map((engagement) => deriveCounts({ ...engagement, schema_version: engagement.schema_version ?? ENGAGEMENT_SCHEMA_VERSION }, nodes)),
    nodes,
  };
}

export class EngagementStore {
  private filePath: string;
  private createdByFallback: string;
  private clock: () => Date;
  private idGenerator: () => string;

  constructor(options: EngagementStoreOptions = {}) {
    this.filePath = options.filePath ?? process.env.AI_VALIDATOR_ENGAGEMENT_STORE ?? defaultStorePath();
    this.createdByFallback = options.createdByFallback ?? "reviewer";
    this.clock = options.clock ?? (() => new Date());
    this.idGenerator = options.idGenerator ?? (() => crypto.randomUUID());
  }

  get pathForTests(): string {
    return this.filePath;
  }

  read(): StoreDocument {
    if (!fs.existsSync(this.filePath)) {
      return { schema_version: ENGAGEMENT_SCHEMA_VERSION, engagements: [], nodes: [] };
    }
    const parsed = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
    if (parsed.schema_version && parsed.schema_version !== ENGAGEMENT_SCHEMA_VERSION) {
      throw new Error(`Unsupported engagement store schema_version ${parsed.schema_version}`);
    }
    return validateDocument({ schema_version: ENGAGEMENT_SCHEMA_VERSION, engagements: parsed.engagements ?? [], nodes: parsed.nodes ?? [] });
  }

  write(document: StoreDocument): void {
    const validated = validateDocument(document);
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = path.join(dir, `.${path.basename(this.filePath)}.${process.pid}.${Date.now()}.tmp`);
    fs.writeFileSync(tmp, `${JSON.stringify(validated, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    fs.renameSync(tmp, this.filePath);
  }

  listEngagements(): Engagement[] {
    return this.read().engagements.sort((left, right) => right.updated_at.localeCompare(left.updated_at));
  }

  getEngagement(id: string): Engagement | null {
    return this.read().engagements.find((engagement) => engagement.id === id) ?? null;
  }

  getNodes(engagementId: string): EngagementNode[] {
    return this.read().nodes.filter((node) => node.engagement_id === engagementId);
  }

  createEngagement(input: Record<string, unknown>, createdBy?: string): Engagement {
    const name = String(input.name ?? "").trim();
    const customerName = String(input.customer_name ?? "").trim();
    if (!name) throw new Error("name is required.");
    if (!customerName) throw new Error("customer_name is required.");
    if (!isOneOf(platformProfiles, input.platform_profile)) throw new Error("Unsupported platform_profile.");
    const expected = Number(input.expected_node_count);
    if (!Number.isInteger(expected) || expected < 1 || expected > 1024) throw new Error("expected_node_count must be between 1 and 1024.");

    const now = nowIso(this.clock);
    const engagement: Engagement = {
      id: `eng_${this.idGenerator()}`,
      schema_version: ENGAGEMENT_SCHEMA_VERSION,
      name,
      customer_name: customerName,
      description: String(input.description ?? "").trim(),
      platform_profile: input.platform_profile,
      expected_node_count: expected,
      received_node_count: 0,
      ready_node_count: 0,
      remediation_node_count: 0,
      failed_node_count: 0,
      status: isOneOf(engagementStatuses, input.status) ? input.status : "draft",
      acceptance_status: "not_evaluated",
      readiness_score: null,
      created_at: now,
      updated_at: now,
      collection_deadline: parseDeadline(input.collection_deadline),
      created_by: createdBy ?? this.createdByFallback,
      simulated: input.simulated === true,
      tags: sanitizeTags(input.tags),
    };
    if (!["draft", "collecting"].includes(engagement.status)) throw new Error("Initial status must be draft or collecting.");

    const document = this.read();
    document.engagements.push(engagement);
    this.write(document);
    return engagement;
  }

  updateEngagement(id: string, patch: Record<string, unknown>): Engagement {
    const blocked = ["id", "received_node_count", "ready_node_count", "remediation_node_count", "failed_node_count", "readiness_score", "acceptance_status", "created_at", "created_by"];
    if (blocked.some((field) => Object.prototype.hasOwnProperty.call(patch, field))) {
      throw new Error("Calculated or server-owned engagement fields cannot be overwritten by clients.");
    }
    const document = this.read();
    const index = document.engagements.findIndex((engagement) => engagement.id === id);
    if (index < 0) throw new Error("Engagement not found.");
    const current = document.engagements[index];
    let next: Engagement = { ...current };

    if (patch.name !== undefined) {
      const name = String(patch.name).trim();
      if (!name) throw new Error("name is required.");
      next.name = name;
    }
    if (patch.customer_name !== undefined) {
      const customerName = String(patch.customer_name).trim();
      if (!customerName) throw new Error("customer_name is required.");
      next.customer_name = customerName;
    }
    if (patch.description !== undefined) next.description = String(patch.description ?? "").trim();
    if (patch.platform_profile !== undefined) {
      if (!isOneOf(platformProfiles, patch.platform_profile)) throw new Error("Unsupported platform_profile.");
      next.platform_profile = patch.platform_profile;
    }
    if (patch.expected_node_count !== undefined) {
      const expected = Number(patch.expected_node_count);
      if (!Number.isInteger(expected) || expected < 1 || expected > 1024) throw new Error("expected_node_count must be between 1 and 1024.");
      next.expected_node_count = expected;
    }
    if (patch.collection_deadline !== undefined) next.collection_deadline = parseDeadline(patch.collection_deadline);
    if (patch.tags !== undefined) next.tags = sanitizeTags(patch.tags);
    if (patch.status !== undefined) {
      if (!isOneOf(engagementStatuses, patch.status)) throw new Error("Unsupported engagement status.");
      if (!validTransitions[current.status].includes(patch.status)) throw new Error(`Invalid status transition: ${current.status} -> ${patch.status}.`);
      next.status = patch.status;
    }
    next.updated_at = nowIso(this.clock);
    next = deriveCounts(next, document.nodes);
    document.engagements[index] = next;
    this.write(document);
    return next;
  }

  archiveEngagement(id: string): Engagement {
    return this.updateEngagement(id, { status: "archived" });
  }

  loadDemoFixture(): Engagement {
    const document = this.read();
    const existing = document.engagements.find((engagement) => engagement.id === "eng_demo_nvis_h100_two_node");
    if (existing) {
      const existingNodeIds = new Set(document.nodes.filter((node) => node.engagement_id === existing.id).map((node) => node.id));
      const missingNodes = buildDemoNodes(existing.id).filter((node) => !existingNodeIds.has(node.id));
      if (missingNodes.length > 0) {
        document.nodes.push(...missingNodes);
        this.write(document);
      }
      return deriveCounts(existing, document.nodes);
    }
    const now = nowIso(this.clock);
    const engagement: Engagement = {
      id: "eng_demo_nvis_h100_two_node",
      schema_version: ENGAGEMENT_SCHEMA_VERSION,
      name: "Two-Node H100 Cluster Acceptance",
      customer_name: "NVIS Interview Demo",
      description: "Simulated multi-node engagement shell for demonstrating evidence collection readiness. Not real hardware evidence.",
      platform_profile: "hgx-h100",
      expected_node_count: 2,
      received_node_count: 0,
      ready_node_count: 0,
      remediation_node_count: 0,
      failed_node_count: 0,
      status: "collecting",
      acceptance_status: "not_evaluated",
      readiness_score: null,
      created_at: now,
      updated_at: now,
      collection_deadline: null,
      created_by: "demo-fixture",
      simulated: true,
      tags: ["simulated-demo", "h100", "multi-node"],
    };
    document.engagements.push(engagement);
    document.nodes.push(...buildDemoNodes(engagement.id));
    this.write(document);
    return engagement;
  }
}

function buildDemoNodes(engagementId: string): EngagementNode[] {
  return ["node01", "node02"].map((name) => ({
    id: `node_demo_${name}`,
    engagement_id: engagementId,
    display_name: name,
    source_hostname: null,
    node_fingerprint: null,
    platform_profile: "hgx-h100",
    gpu_model: "NVIDIA H100 80GB HBM3",
    gpu_count: 8,
    driver_version: null,
    cuda_version: null,
    kernel_version: null,
    operating_system: null,
    ofed_version: null,
    fabric_type: null,
    collection_status: "awaiting_evidence",
    validation_status: "not_evaluated",
    readiness_score: null,
    last_collection_at: null,
    simulated: true,
    findings_count: 0,
    critical_findings_count: 0,
    high_findings_count: 0,
  }));
}

function errorResponse(res: express.Response, status: number, message: string) {
  return res.status(status).json({ error: message });
}

export function registerEngagementRoutes(app: express.Express, store = new EngagementStore()) {
  app.get("/api/v1/engagements", (_req, res) => {
    return res.json({ engagements: store.listEngagements() });
  });

  app.post("/api/v1/engagements", (req, res) => {
    try {
      return res.status(201).json({ engagement: store.createEngagement(req.body ?? {}, req.get("x-reviewer-email") ?? undefined) });
    } catch (error) {
      return errorResponse(res, 400, error instanceof Error ? error.message : "Invalid engagement request.");
    }
  });

  app.get("/api/v1/engagements/:engagementId", (req, res) => {
    const engagement = store.getEngagement(req.params.engagementId);
    if (!engagement) return errorResponse(res, 404, "Engagement not found.");
    return res.json({ engagement });
  });

  app.patch("/api/v1/engagements/:engagementId", (req, res) => {
    try {
      return res.json({ engagement: store.updateEngagement(req.params.engagementId, req.body ?? {}) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid engagement update.";
      return errorResponse(res, message.includes("not found") ? 404 : 400, message);
    }
  });

  app.get("/api/v1/engagements/:engagementId/nodes", (req, res) => {
    if (!store.getEngagement(req.params.engagementId)) return errorResponse(res, 404, "Engagement not found.");
    return res.json({ nodes: store.getNodes(req.params.engagementId) });
  });

  app.post("/api/v1/engagements/:engagementId/archive", (req, res) => {
    try {
      return res.json({ engagement: store.archiveEngagement(req.params.engagementId) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid archive request.";
      return errorResponse(res, message.includes("not found") ? 404 : 400, message);
    }
  });

  app.post("/api/v1/engagement-fixtures/nvis-interview-demo", (_req, res) => {
    return res.status(201).json({ engagement: store.loadDemoFixture() });
  });
}

export function temporaryEngagementStore(): EngagementStore {
  return new EngagementStore({ filePath: path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gpu-validator-engagements-")), "store.json") });
}
