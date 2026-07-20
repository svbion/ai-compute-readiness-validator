import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";
import type { AddressInfo } from "node:net";

import { createPortalServerApp } from "../server";
import { EngagementStore, hashUploadToken, timingSafeTokenHashEqual } from "../src/server/engagements";

const authHeader = { "x-ai-factory-test-auth": "test-bypass-token" };

async function withServer(fn: (baseUrl: string, storePath: string, evidenceDir: string) => Promise<void>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gpu-validator-evidence-api-test-"));
  const storePath = path.join(dir, "store.json");
  const evidenceDir = path.join(dir, "evidence");
  const previous = { ...process.env };
  process.env.NODE_ENV = "production";
  process.env.AI_FACTORY_AUTH_REQUIRED = "true";
  process.env.AI_FACTORY_SESSION_SECRET = "0123456789abcdef0123456789abcdef";
  process.env.AI_FACTORY_REVIEWER_USERNAME = "reviewer";
  process.env.AI_FACTORY_REVIEWER_PASSWORD_HASH = "scrypt$abc$def";
  process.env.AI_FACTORY_AUTH_TEST_BYPASS_TOKEN = "test-bypass-token";
  process.env.AI_VALIDATOR_ENGAGEMENT_STORE = storePath;
  process.env.AI_VALIDATOR_EVIDENCE_STORAGE_DIR = evidenceDir;
  process.env.AI_VALIDATOR_EVIDENCE_MAX_COMPRESSED_BYTES = String(5 * 1024 * 1024);
  process.env.AI_VALIDATOR_EVIDENCE_MAX_EXPANDED_BYTES = String(20 * 1024 * 1024);
  process.env.AI_VALIDATOR_EVIDENCE_MAX_FILE_BYTES = String(2 * 1024 * 1024);
  process.env.AI_VALIDATOR_EVIDENCE_MAX_FILE_COUNT = "50";
  const app = await createPortalServerApp({ mountFrontend: false });
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  const address = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${address.port}`, storePath, evidenceDir);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    process.env = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function jsonRequest(baseUrl: string, method: string, url: string, body?: unknown, authed = true) {
  const response = await fetch(`${baseUrl}${url}`, {
    method,
    headers: { "Content-Type": "application/json", ...(authed ? authHeader : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

function checksum(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function tarHeader(name: string, size: number, type = "0"): Buffer {
  const header = Buffer.alloc(512, 0);
  header.write(name, 0, 100, "utf8");
  header.write("0000600\0", 100, 8, "ascii");
  header.write("0000000\0", 108, 8, "ascii");
  header.write("0000000\0", 116, 8, "ascii");
  header.write(size.toString(8).padStart(11, "0") + "\0", 124, 12, "ascii");
  header.write("00000000000\0", 136, 12, "ascii");
  header.fill(0x20, 148, 156);
  header.write(type, 156, 1, "ascii");
  header.write("ustar\0", 257, 6, "ascii");
  header.write("00", 263, 2, "ascii");
  const sum = header.reduce((total, byte) => total + byte, 0);
  header.write(sum.toString(8).padStart(6, "0") + "\0 ", 148, 8, "ascii");
  return header;
}

function tarGz(files: Record<string, Buffer>, types: Record<string, string> = {}): Buffer {
  const chunks: Buffer[] = [];
  for (const name of Object.keys(files).sort()) {
    const data = files[name];
    chunks.push(tarHeader(name, data.length, types[name] ?? "0"), data, Buffer.alloc((512 - (data.length % 512)) % 512, 0));
  }
  chunks.push(Buffer.alloc(1024, 0));
  return zlib.gzipSync(Buffer.concat(chunks));
}

function validBundle(nodeId = "node_demo_node01", collectionId = "collection-001") {
  const linux = Buffer.from("Linux HOST-001 fixture\n");
  const gpu = Buffer.from("NVIDIA H100 simulated fixture\n");
  const commands = Buffer.from(JSON.stringify([
    { command_id: "uname", category: "linux", argv: ["uname", "-a"], duration_ms: 0, exit_code: 0, status: "collected", stdout_file: "linux/uname.txt", stderr_file: null, error_summary: null, hostname: "HOST-001", collector_version: "ai-validator 0.1.0" },
    { command_id: "nvidia-smi", category: "gpu", argv: ["nvidia-smi"], duration_ms: 0, exit_code: 0, status: "collected", stdout_file: "gpu/nvidia-smi.txt", stderr_file: null, error_summary: null, hostname: "HOST-001", collector_version: "ai-validator 0.1.0" },
  ], null, 2));
  const manifestObject = {
    schema_version: "1.0.0",
    collector_version: "ai-validator 0.1.0",
    profile: "dgx-class",
    collection_mode: "fixture",
    collection_id: collectionId,
    engagement_id: "eng_demo_nvis_h100_two_node",
    node_id: nodeId,
    started_at: "2026-01-01T00:00:00.000Z",
    finished_at: "2026-01-01T00:00:00.000Z",
    source_hostname: "HOST-001",
    sanitized: true,
    simulated: true,
    command_count: 2,
    collected_count: 2,
    missing_count: 0,
    failed_count: 0,
    skipped_count: 0,
    categories: ["gpu", "linux"],
    checksum_algorithm: "sha256",
    files: [
      { path: "linux/uname.txt", category: "linux", command_id: "uname", bytes: linux.length, sha256: checksum(linux) },
      { path: "gpu/nvidia-smi.txt", category: "gpu", command_id: "nvidia-smi", bytes: gpu.length, sha256: checksum(gpu) },
    ],
    warnings: ["fixture"],
  };
  const manifest = Buffer.from(JSON.stringify(manifestObject, null, 2));
  const files = { "gpu/nvidia-smi.txt": gpu, "linux/uname.txt": linux, "manifest.json": manifest, "metadata/commands.json": commands };
  const checksums = Buffer.from(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)).map(([name, data]) => `${checksum(data)}  ${name}`).join("\n") + "\n");
  return tarGz({ ...files, "checksums.sha256": checksums });
}

test("upload token creation returns plaintext once and persists only a hash", async () => {
  await withServer(async (baseUrl, storePath) => {
    await jsonRequest(baseUrl, "POST", "/api/v1/engagement-fixtures/nvis-interview-demo");
    const created = await jsonRequest(baseUrl, "POST", "/api/v1/engagements/eng_demo_nvis_h100_two_node/nodes/node_demo_node01/upload-tokens");
    assert.equal(created.response.status, 201);
    assert.match(created.payload.token, /^gvu_/);
    assert.equal(created.payload.token_hash, undefined);
    const listed = await jsonRequest(baseUrl, "GET", "/api/v1/engagements/eng_demo_nvis_h100_two_node/nodes/node_demo_node01/upload-tokens");
    assert.equal(listed.response.status, 200);
    assert.equal(listed.payload.upload_tokens[0].token, undefined);
    assert.equal(listed.payload.upload_tokens[0].token_hash, undefined);
    const persisted = JSON.parse(fs.readFileSync(storePath, "utf8"));
    assert.equal(persisted.upload_tokens[0].token, undefined);
    assert.notEqual(persisted.upload_tokens[0].token_hash, created.payload.token);
    assert.equal(timingSafeTokenHashEqual(persisted.upload_tokens[0].token_hash, hashUploadToken(created.payload.token)), true);
  });
});

test("admin upload-token endpoints require reviewer authentication and support revocation", async () => {
  await withServer(async (baseUrl) => {
    await jsonRequest(baseUrl, "POST", "/api/v1/engagement-fixtures/nvis-interview-demo");
    const unauth = await jsonRequest(baseUrl, "POST", "/api/v1/engagements/eng_demo_nvis_h100_two_node/nodes/node_demo_node01/upload-tokens", {}, false);
    assert.equal(unauth.response.status, 401);
    const created = await jsonRequest(baseUrl, "POST", "/api/v1/engagements/eng_demo_nvis_h100_two_node/nodes/node_demo_node01/upload-tokens");
    const revoked = await jsonRequest(baseUrl, "POST", `/api/v1/engagements/eng_demo_nvis_h100_two_node/nodes/node_demo_node01/upload-tokens/${created.payload.id}/revoke`);
    assert.equal(revoked.response.status, 200);
    assert.equal(revoked.payload.upload_token.status, "revoked");
    const upload = await fetch(`${baseUrl}/api/v1/evidence/uploads`, { method: "POST", headers: { Authorization: `Bearer ${created.payload.token}`, "Content-Type": "application/octet-stream" }, body: validBundle() });
    assert.equal(upload.status, 401);
  });
});

test("valid archive is accepted, persisted, marks token used, and updates derived counts", async () => {
  await withServer(async (baseUrl, storePath, evidenceDir) => {
    await jsonRequest(baseUrl, "POST", "/api/v1/engagement-fixtures/nvis-interview-demo");
    const created = await jsonRequest(baseUrl, "POST", "/api/v1/engagements/eng_demo_nvis_h100_two_node/nodes/node_demo_node01/upload-tokens");
    const upload = await fetch(`${baseUrl}/api/v1/evidence/uploads`, { method: "POST", headers: { Authorization: `Bearer ${created.payload.token}`, "Content-Type": "application/octet-stream" }, body: validBundle() });
    const payload = await upload.json();
    assert.equal(upload.status, 201, JSON.stringify(payload));
    assert.match(payload.evidence.id, /^evd_/);
    assert.equal(payload.evidence.storage_key, undefined);
    assert.equal(fs.existsSync(path.join(evidenceDir, "eng_demo_nvis_h100_two_node", "node_demo_node01", "collection-001", "original-bundle.tar.gz")), true);
    const store = JSON.parse(fs.readFileSync(storePath, "utf8"));
    assert.equal(store.upload_tokens[0].status, "used");
    assert.equal(store.engagements[0].received_node_count, 1);
    assert.equal(store.nodes.find((node: any) => node.id === "node_demo_node01").collection_status, "received");
  });
});

test("upload endpoint rejects missing, query string, wrong-node, malformed, and unsafe archives", async () => {
  await withServer(async (baseUrl) => {
    await jsonRequest(baseUrl, "POST", "/api/v1/engagement-fixtures/nvis-interview-demo");
    const missing = await fetch(`${baseUrl}/api/v1/evidence/uploads`, { method: "POST", body: validBundle() });
    assert.equal(missing.status, 401);
    const query = await fetch(`${baseUrl}/api/v1/evidence/uploads?token=abc`, { method: "POST", body: validBundle() });
    assert.equal(query.status, 401);
    const created = await jsonRequest(baseUrl, "POST", "/api/v1/engagements/eng_demo_nvis_h100_two_node/nodes/node_demo_node01/upload-tokens");
    const wrongNode = await fetch(`${baseUrl}/api/v1/evidence/uploads`, { method: "POST", headers: { Authorization: `Bearer ${created.payload.token}`, "Content-Type": "application/octet-stream" }, body: validBundle("node_demo_node02") });
    assert.equal(wrongNode.status, 400);
    const malformed = await fetch(`${baseUrl}/api/v1/evidence/uploads`, { method: "POST", headers: { Authorization: `Bearer ${created.payload.token}`, "Content-Type": "application/octet-stream" }, body: Buffer.from("not gzip") });
    assert.equal(malformed.status, 400);
    const unsafe = await fetch(`${baseUrl}/api/v1/evidence/uploads`, { method: "POST", headers: { Authorization: `Bearer ${created.payload.token}`, "Content-Type": "application/octet-stream" }, body: tarGz({ "../evil": Buffer.from("x") }) });
    assert.equal(unsafe.status, 400);
  });
});

test("duplicate bundle with a new token is rejected and previous evidence can be superseded", async () => {
  await withServer(async (baseUrl) => {
    await jsonRequest(baseUrl, "POST", "/api/v1/engagement-fixtures/nvis-interview-demo");
    const t1 = await jsonRequest(baseUrl, "POST", "/api/v1/engagements/eng_demo_nvis_h100_two_node/nodes/node_demo_node01/upload-tokens");
    assert.equal((await fetch(`${baseUrl}/api/v1/evidence/uploads`, { method: "POST", headers: { Authorization: `Bearer ${t1.payload.token}`, "Content-Type": "application/octet-stream" }, body: validBundle() })).status, 201);
    const t2 = await jsonRequest(baseUrl, "POST", "/api/v1/engagements/eng_demo_nvis_h100_two_node/nodes/node_demo_node01/upload-tokens");
    assert.equal((await fetch(`${baseUrl}/api/v1/evidence/uploads`, { method: "POST", headers: { Authorization: `Bearer ${t2.payload.token}`, "Content-Type": "application/octet-stream" }, body: validBundle() })).status, 409);
    const t3 = await jsonRequest(baseUrl, "POST", "/api/v1/engagements/eng_demo_nvis_h100_two_node/nodes/node_demo_node01/upload-tokens");
    assert.equal((await fetch(`${baseUrl}/api/v1/evidence/uploads`, { method: "POST", headers: { Authorization: `Bearer ${t3.payload.token}`, "Content-Type": "application/octet-stream" }, body: validBundle("node_demo_node01", "collection-002") })).status, 201);
    const evidence = await jsonRequest(baseUrl, "GET", "/api/v1/engagements/eng_demo_nvis_h100_two_node/evidence");
    assert.equal(evidence.payload.evidence_records.length, 2);
    assert.equal(evidence.payload.evidence_records.some((record: any) => record.ingestion_status === "superseded"), true);
  });
});

test("expired, used, and oversized uploads are rejected without marking a fresh token used", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gpu-validator-token-store-test-"));
  try {
    const store = new EngagementStore({ filePath: path.join(dir, "store.json"), clock: () => new Date("2030-01-01T00:00:00Z") });
    const engagement = store.loadDemoFixture();
    const token = store.createUploadToken(engagement.id, "node_demo_node01", { expiresInSeconds: 60 }).plaintext;
    const later = new EngagementStore({ filePath: path.join(dir, "store.json"), clock: () => new Date("2030-01-01T00:02:00Z") });
    assert.equal(later.findActiveUploadToken(token), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  await withServer(async (baseUrl, storePath) => {
    await jsonRequest(baseUrl, "POST", "/api/v1/engagement-fixtures/nvis-interview-demo");
    const created = await jsonRequest(baseUrl, "POST", "/api/v1/engagements/eng_demo_nvis_h100_two_node/nodes/node_demo_node01/upload-tokens", { maximum_upload_bytes: 10 });
    const upload = await fetch(`${baseUrl}/api/v1/evidence/uploads`, { method: "POST", headers: { Authorization: `Bearer ${created.payload.token}`, "Content-Type": "application/octet-stream" }, body: validBundle() });
    assert.equal(upload.status, 413);
    const store = JSON.parse(fs.readFileSync(storePath, "utf8"));
    assert.equal(store.upload_tokens[0].status, "active");
  });
});
