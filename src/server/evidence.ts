import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import zlib from "zlib";
import { TextDecoder } from "util";
import express from "express";
import { EngagementStore } from "./engagements";

const SUPPORTED_MANIFEST_SCHEMA = "1.0.0";
const SUPPORTED_PROFILES = new Set(["linux-host", "gpu-workstation", "single-gpu-node", "dgx-class"]);
const TAR_BLOCK = 512;

type TarEntry = {
  path: string;
  type: string;
  data: Buffer;
  size: number;
};

type ValidationLimits = {
  maxCompressedBytes: number;
  maxExpandedBytes: number;
  maxFileCount: number;
  maxFileBytes: number;
};

type ValidationResult = {
  collectionId: string;
  manifest: Record<string, any>;
  commands: any[];
  bundleSha256: string;
  manifestSha256: string;
  warnings: string[];
  extractedDir: string;
};

function envNumber(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function evidenceLimits(): ValidationLimits {
  return {
    maxCompressedBytes: envNumber("AI_VALIDATOR_EVIDENCE_MAX_COMPRESSED_BYTES", 50 * 1024 * 1024),
    maxExpandedBytes: envNumber("AI_VALIDATOR_EVIDENCE_MAX_EXPANDED_BYTES", 250 * 1024 * 1024),
    maxFileCount: envNumber("AI_VALIDATOR_EVIDENCE_MAX_FILE_COUNT", 500),
    maxFileBytes: envNumber("AI_VALIDATOR_EVIDENCE_MAX_FILE_BYTES", 25 * 1024 * 1024),
  };
}

function evidenceStorageRoot(): string {
  return process.env.AI_VALIDATOR_EVIDENCE_STORAGE_DIR ?? path.join(process.cwd(), "artifacts", "evidence");
}

function sha256Buffer(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function sha256File(filePath: string): string {
  const digest = crypto.createHash("sha256");
  const handle = fs.openSync(filePath, "r");
  const chunk = Buffer.allocUnsafe(1024 * 1024);
  try {
    for (;;) {
      const read = fs.readSync(handle, chunk, 0, chunk.length, null);
      if (read === 0) break;
      digest.update(chunk.subarray(0, read));
    }
  } finally {
    fs.closeSync(handle);
  }
  return digest.digest("hex");
}

function parseOctal(buffer: Buffer): number {
  const raw = buffer.toString("ascii").replace(/\0.*$/, "").trim();
  if (!raw) return 0;
  if (!/^[0-7]+$/.test(raw)) throw new Error("Malformed tar header size.");
  return Number.parseInt(raw, 8);
}

function tarName(header: Buffer): string {
  const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
  const prefix = header.subarray(345, 500).toString("utf8").replace(/\0.*$/, "");
  return prefix ? `${prefix}/${name}` : name;
}

function isZeroBlock(buffer: Buffer): boolean {
  return buffer.every((byte) => byte === 0);
}

function stripCommonRoot(entries: TarEntry[]): TarEntry[] {
  const firstSegments = entries.map((entry) => entry.path.split("/")[0]).filter(Boolean);
  if (!firstSegments.length || !firstSegments.every((segment) => segment === firstSegments[0])) return entries;
  const root = `${firstSegments[0]}/`;
  if (!entries.some((entry) => entry.path.startsWith(root))) return entries;
  return entries.map((entry) => ({ ...entry, path: entry.path.startsWith(root) ? entry.path.slice(root.length) : entry.path })).filter((entry) => entry.path);
}

function safeRelativePath(value: string): string {
  const normalized = value.replace(/\\/g, "/").replace(/^\.\//, "");
  if (!normalized || normalized.startsWith("/") || normalized.includes("../") || normalized === ".." || normalized.startsWith("../")) throw new Error(`Unsafe archive path: ${value}`);
  if (path.posix.normalize(normalized) !== normalized) throw new Error(`Unsafe archive path: ${value}`);
  return normalized;
}

function parseTar(buffer: Buffer, limits: ValidationLimits): TarEntry[] {
  const entries: TarEntry[] = [];
  let offset = 0;
  let expanded = 0;
  while (offset + TAR_BLOCK <= buffer.length) {
    const header = buffer.subarray(offset, offset + TAR_BLOCK);
    offset += TAR_BLOCK;
    if (isZeroBlock(header)) break;
    const name = safeRelativePath(tarName(header));
    const type = header.subarray(156, 157).toString("ascii") || "0";
    const size = parseOctal(header.subarray(124, 136));
    if (["1", "2", "3", "4", "5", "6", "7"].includes(type)) throw new Error(`Unsupported archive entry type for ${name}.`);
    if (!(type === "0" || type === "\0" || type === "")) throw new Error(`Unsupported archive entry type for ${name}.`);
    if (size > limits.maxFileBytes) throw new Error(`Archive entry exceeds individual file limit: ${name}.`);
    if (offset + size > buffer.length) throw new Error("Malformed tar archive: entry exceeds archive length.");
    const data = buffer.subarray(offset, offset + size);
    expanded += size;
    if (expanded > limits.maxExpandedBytes) throw new Error("Expanded archive size exceeds configured limit.");
    entries.push({ path: name, type, size, data });
    if (entries.length > limits.maxFileCount) throw new Error("Archive file count exceeds configured limit.");
    offset += Math.ceil(size / TAR_BLOCK) * TAR_BLOCK;
  }
  return stripCommonRoot(entries);
}

function writeExtracted(entries: TarEntry[], root: string): void {
  for (const entry of entries) {
    const target = path.join(root, entry.path);
    const resolved = path.resolve(target);
    if (!resolved.startsWith(path.resolve(root) + path.sep)) throw new Error(`Unsafe extraction target: ${entry.path}`);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, entry.data, { mode: 0o600 });
  }
}

function parseJsonObject(entry: TarEntry, label: string): Record<string, any> {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(entry.data);
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    return parsed;
  } catch (error) {
    throw new Error(`Malformed UTF-8 JSON in ${label}.`);
  }
}

function parseChecksums(entry: TarEntry): Map<string, string> {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(entry.data);
  const checksums = new Map<string, string>();
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    const match = line.match(/^([a-fA-F0-9]{64})\s+\*?(.+)$/);
    if (!match) throw new Error(`Malformed checksum line ${index + 1}.`);
    const rel = safeRelativePath(match[2].trim());
    if (rel === "checksums.sha256") throw new Error("checksums.sha256 must not reference itself.");
    if (checksums.has(rel)) throw new Error(`Duplicate checksum path: ${rel}`);
    checksums.set(rel, match[1].toLowerCase());
  }
  return checksums;
}

function validateTimestamp(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} timestamp is required.`);
  const time = Date.parse(value);
  if (!Number.isFinite(time) || time < Date.parse("2000-01-01T00:00:00Z") || time > Date.now() + 24 * 60 * 60 * 1000) throw new Error(`${label} timestamp is invalid.`);
  return new Date(time).toISOString();
}

function validateCounts(manifest: Record<string, any>, commands: any[]): void {
  for (const field of ["command_count", "collected_count", "missing_count", "failed_count", "skipped_count"]) {
    if (!Number.isInteger(manifest[field]) || manifest[field] < 0 || manifest[field] > 100000) throw new Error(`Malformed manifest count: ${field}.`);
  }
  if (manifest.command_count !== commands.length) throw new Error("Manifest command_count does not match command metadata.");
}

function rejectNestedArchive(pathname: string): void {
  if (/\.(zip|tar|tgz|tar\.gz|tar\.bz2|tar\.xz|gz)$/i.test(pathname)) throw new Error(`Nested archive content is not accepted: ${pathname}`);
}

export function validateEvidenceArchive(archivePath: string, token: { engagement_id: string; node_id: string }, limits = evidenceLimits()): ValidationResult {
  const stats = fs.statSync(archivePath);
  if (!stats.isFile() || stats.size <= 0) throw new Error("Archive upload is required.");
  if (stats.size > limits.maxCompressedBytes) throw new Error("Compressed archive exceeds configured limit.");
  const bundleSha256 = sha256File(archivePath);
  let tarBuffer: Buffer;
  try {
    tarBuffer = zlib.gunzipSync(fs.readFileSync(archivePath), { maxOutputLength: limits.maxExpandedBytes });
  } catch {
    throw new Error("Malformed gzip archive.");
  }
  const entries = parseTar(tarBuffer, limits);
  if (!entries.length) throw new Error("Archive is empty.");
  const paths = new Set<string>();
  for (const entry of entries) {
    rejectNestedArchive(entry.path);
    if (paths.has(entry.path)) throw new Error(`Duplicate archive path: ${entry.path}`);
    paths.add(entry.path);
  }
  const manifestEntries = entries.filter((entry) => entry.path === "manifest.json");
  const checksumEntries = entries.filter((entry) => entry.path === "checksums.sha256");
  const commandEntries = entries.filter((entry) => entry.path === "metadata/commands.json");
  if (manifestEntries.length !== 1) throw new Error("manifest.json must exist exactly once.");
  if (checksumEntries.length !== 1) throw new Error("checksums.sha256 must exist exactly once.");
  if (commandEntries.length !== 1) throw new Error("metadata/commands.json is required.");

  const manifest = parseJsonObject(manifestEntries[0], "manifest.json");
  const commandsJson = parseJsonObject({ ...commandEntries[0], data: Buffer.from(`{"commands":${commandEntries[0].data.toString("utf8")}}`) }, "metadata/commands.json");
  const commands = Array.isArray(commandsJson.commands) ? commandsJson.commands : [];
  if (manifest.schema_version !== SUPPORTED_MANIFEST_SCHEMA) throw new Error("Unsupported manifest schema_version.");
  if (typeof manifest.profile !== "string" || !SUPPORTED_PROFILES.has(manifest.profile)) throw new Error("Unsupported collector profile.");
  if (manifest.checksum_algorithm !== "sha256") throw new Error("Unsupported checksum algorithm.");
  if (manifest.collection_mode === "fixture" && manifest.simulated !== true) throw new Error("Fixture evidence must be labeled simulated: true.");
  if (manifest.simulated === false && manifest.collection_mode === "fixture") throw new Error("Fixture metadata cannot claim simulated=false.");
  if (manifest.engagement_id && manifest.engagement_id !== token.engagement_id) throw new Error("Evidence identity does not match upload token scope.");
  if (manifest.node_id && manifest.node_id !== token.node_id) throw new Error("Evidence identity does not match upload token scope.");
  const collectedAt = validateTimestamp(manifest.finished_at ?? manifest.collected_at, "collected_at");
  validateTimestamp(manifest.started_at ?? collectedAt, "started_at");
  validateCounts(manifest, commands);
  if (!Array.isArray(manifest.files)) throw new Error("manifest files must be an array.");

  const entryByPath = new Map(entries.map((entry) => [entry.path, entry]));
  const checksums = parseChecksums(checksumEntries[0]);
  for (const [rel, expected] of checksums.entries()) {
    const entry = entryByPath.get(rel);
    if (!entry) throw new Error(`Checksum references missing path: ${rel}`);
    if (sha256Buffer(entry.data) !== expected) throw new Error(`Checksum mismatch for ${rel}.`);
  }
  for (const entry of entries) {
    if (entry.path === "checksums.sha256") continue;
    if (!checksums.has(entry.path)) throw new Error(`Missing checksum for ${entry.path}.`);
  }
  for (const file of manifest.files) {
    if (!file || typeof file !== "object") throw new Error("Malformed manifest file entry.");
    const rel = safeRelativePath(String(file.path ?? ""));
    const entry = entryByPath.get(rel);
    if (!entry) throw new Error(`Declared evidence file is missing: ${rel}`);
    if (typeof file.sha256 === "string" && file.sha256.toLowerCase() !== sha256Buffer(entry.data)) throw new Error(`Manifest checksum mismatch for ${rel}.`);
    if (Number(file.bytes) !== entry.size) throw new Error(`Manifest byte count mismatch for ${rel}.`);
  }

  const extractedDir = fs.mkdtempSync(path.join(os.tmpdir(), "gpu-validator-evidence-extract-"));
  writeExtracted(entries, extractedDir);
  return {
    collectionId: String(manifest.collection_id ?? sha256Buffer(manifestEntries[0].data).slice(0, 24)),
    manifest,
    commands,
    bundleSha256,
    manifestSha256: sha256Buffer(manifestEntries[0].data),
    warnings: Array.isArray(manifest.warnings) ? manifest.warnings.map((warning) => String(warning)).slice(0, 50) : [],
    extractedDir,
  };
}

function sanitizeDisplay(value: unknown): string {
  return String(value ?? "unknown").replace(/[<>"'`\n\r\t]/g, "").slice(0, 120) || "unknown";
}

function uploadUrl(req: express.Request): string {
  const configured = process.env.AI_VALIDATOR_PUBLIC_BASE_URL;
  if (configured) return `${configured.replace(/\/$/, "")}/api/v1/evidence/uploads`;
  const proto = req.get("x-forwarded-proto") ?? req.protocol;
  return `${proto}://${req.get("host")}/api/v1/evidence/uploads`;
}

function errorResponse(res: express.Response, status: number, message: string) {
  return res.status(status).set("Cache-Control", "no-store").json({ error: message, error_id: `err_${crypto.randomBytes(8).toString("hex")}` });
}

export function registerEvidenceRoutes(app: express.Express, store: EngagementStore) {
  app.post("/api/v1/engagements/:engagementId/nodes/:nodeId/upload-tokens", (req, res) => {
    try {
      const created = store.createUploadToken(req.params.engagementId, req.params.nodeId, {
        createdBy: req.get("x-reviewer-email") ?? undefined,
        expiresInSeconds: req.body?.expires_in_seconds,
        maximumUploadBytes: req.body?.maximum_upload_bytes,
      });
      return res.status(201).set("Cache-Control", "no-store").json({ ...created.token, upload_url: uploadUrl(req), token: created.plaintext });
    } catch (error) {
      return errorResponse(res, error instanceof Error && error.message.includes("not found") ? 404 : 400, error instanceof Error ? error.message : "Invalid upload token request.");
    }
  });

  app.get("/api/v1/engagements/:engagementId/nodes/:nodeId/upload-tokens", (req, res) => {
    try {
      return res.set("Cache-Control", "no-store").json({ upload_tokens: store.listUploadTokens(req.params.engagementId, req.params.nodeId) });
    } catch (error) {
      return errorResponse(res, error instanceof Error && error.message.includes("not found") ? 404 : 400, error instanceof Error ? error.message : "Invalid upload token request.");
    }
  });

  app.post("/api/v1/engagements/:engagementId/nodes/:nodeId/upload-tokens/:tokenId/revoke", (req, res) => {
    try {
      return res.set("Cache-Control", "no-store").json({ upload_token: store.revokeUploadToken(req.params.engagementId, req.params.nodeId, req.params.tokenId, req.get("x-reviewer-email") ?? undefined) });
    } catch (error) {
      return errorResponse(res, error instanceof Error && error.message.includes("not found") ? 404 : 400, error instanceof Error ? error.message : "Invalid upload token revoke request.");
    }
  });

  app.get("/api/v1/engagements/:engagementId/evidence", (req, res) => {
    if (!store.getEngagement(req.params.engagementId)) return errorResponse(res, 404, "Engagement not found.");
    return res.set("Cache-Control", "no-store").json({ evidence_records: store.listEvidence(req.params.engagementId) });
  });

  app.get("/api/v1/engagements/:engagementId/activity", (req, res) => {
    if (!store.getEngagement(req.params.engagementId)) return errorResponse(res, 404, "Engagement not found.");
    return res.set("Cache-Control", "no-store").json({ activity_entries: store.listActivity(req.params.engagementId) });
  });

  app.post(
    "/api/v1/evidence/uploads",
    express.raw({ type: ["application/octet-stream", "application/gzip", "application/x-gzip"], limit: evidenceLimits().maxCompressedBytes }),
    (req, res) => {
      const auth = req.get("authorization") ?? "";
      if (req.query.token || !auth.startsWith("Bearer ")) return errorResponse(res, 401, "Upload authentication failed.");
      const plaintext = auth.slice("Bearer ".length).trim();
      if (!plaintext) return errorResponse(res, 401, "Upload authentication failed.");
      const token = store.findActiveUploadToken(plaintext);
      if (!token) return errorResponse(res, 401, "Upload authentication failed.");
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) return errorResponse(res, 400, "Archive upload is required.");
      if (req.body.length > token.maximum_upload_bytes) return errorResponse(res, 413, "Compressed archive exceeds token limit.");

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gpu-validator-upload-"));
      const tmpArchive = path.join(tmpDir, "bundle.tar.gz");
      let extractedDir: string | null = null;
      try {
        fs.writeFileSync(tmpArchive, req.body, { mode: 0o600 });
        const validation = validateEvidenceArchive(tmpArchive, token, { ...evidenceLimits(), maxCompressedBytes: Math.min(evidenceLimits().maxCompressedBytes, token.maximum_upload_bytes) });
        extractedDir = validation.extractedDir;
        const duplicate = store.findDuplicateEvidence(token.engagement_id, token.node_id, validation.collectionId, validation.bundleSha256);
        if (duplicate) {
          store.recordDuplicateEvidenceRejected(token.engagement_id, token.node_id, duplicate.id, validation.collectionId);
          return errorResponse(res, 409, "Duplicate evidence bundle was already accepted.");
        }
        const now = new Date().toISOString();
        const finalDir = path.join(evidenceStorageRoot(), token.engagement_id, token.node_id, validation.collectionId);
        if (fs.existsSync(finalDir)) throw new Error("Evidence storage location already exists.");
        fs.mkdirSync(path.dirname(finalDir), { recursive: true });
        fs.renameSync(extractedDir, finalDir);
        extractedDir = null;
        fs.copyFileSync(tmpArchive, path.join(finalDir, "original-bundle.tar.gz"));
        fs.writeFileSync(path.join(finalDir, "ingestion.json"), `${JSON.stringify({ uploaded_at: now, upload_token_id: token.id, bundle_sha256: validation.bundleSha256, manifest_sha256: validation.manifestSha256 }, null, 2)}\n`, { mode: 0o600 });
        const accepted = store.markTokenUsedAndAcceptEvidence(token.id, {
          engagement_id: token.engagement_id,
          node_id: token.node_id,
          collection_id: validation.collectionId,
          collector_version: String(validation.manifest.collector_version ?? "unknown"),
          collector_profile: String(validation.manifest.profile),
          manifest_schema_version: String(validation.manifest.schema_version),
          uploaded_at: now,
          collected_at: validateTimestamp(validation.manifest.finished_at ?? validation.manifest.collected_at, "collected_at"),
          sanitized: validation.manifest.sanitized === true,
          simulated: validation.manifest.simulated === true || validation.manifest.collection_mode === "fixture",
          command_count: Number(validation.manifest.command_count),
          collected_count: Number(validation.manifest.collected_count),
          missing_count: Number(validation.manifest.missing_count),
          failed_count: Number(validation.manifest.failed_count),
          skipped_count: Number(validation.manifest.skipped_count),
          bundle_sha256: validation.bundleSha256,
          manifest_sha256: validation.manifestSha256,
          storage_key: path.relative(evidenceStorageRoot(), finalDir).split(path.sep).join("/"),
          upload_token_id: token.id,
          validation_warnings: validation.warnings,
          source_hostname_display: sanitizeDisplay(validation.manifest.source_hostname),
        });
        if (accepted.duplicate) return errorResponse(res, 409, "Duplicate evidence bundle was already accepted.");
        return res.status(201).set("Cache-Control", "no-store").json({ evidence: accepted.record, collection_id: accepted.record.collection_id });
      } catch (error) {
        return errorResponse(res, error instanceof Error && error.message.includes("exceeds") ? 413 : 400, error instanceof Error ? error.message : "Evidence upload rejected.");
      } finally {
        if (extractedDir) fs.rmSync(extractedDir, { recursive: true, force: true });
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    },
  );
}
