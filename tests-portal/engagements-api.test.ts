import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";

import { createPortalServerApp } from "../server";
import { EngagementStore } from "../src/server/engagements";

const authHeader = { "x-ai-factory-test-auth": "test-bypass-token" };

async function withServer(fn: (baseUrl: string, storePath: string) => Promise<void>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gpu-validator-api-test-"));
  const storePath = path.join(dir, "store.json");
  const previous = { ...process.env };
  process.env.NODE_ENV = "production";
  process.env.AI_FACTORY_AUTH_REQUIRED = "true";
  process.env.AI_FACTORY_SESSION_SECRET = "0123456789abcdef0123456789abcdef";
  process.env.AI_FACTORY_REVIEWER_USERNAME = "reviewer";
  process.env.AI_FACTORY_REVIEWER_PASSWORD_HASH = "scrypt$abc$def";
  process.env.AI_FACTORY_AUTH_TEST_BYPASS_TOKEN = "test-bypass-token";
  process.env.AI_VALIDATOR_ENGAGEMENT_STORE = storePath;
  const app = await createPortalServerApp({ mountFrontend: false });
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  const address = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${address.port}`, storePath);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    process.env = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function request(baseUrl: string, method: string, url: string, body?: unknown, authed = true) {
  const response = await fetch(`${baseUrl}${url}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(authed ? authHeader : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

const validCreate = {
  name: "Two-Node H100 Cluster Acceptance",
  customer_name: "NVIS Interview Demo",
  platform_profile: "hgx-h100",
  expected_node_count: 2,
  collection_deadline: "2030-01-01T00:00:00Z",
  tags: ["h100", "acceptance"],
};

test("create, list, read, and update engagement APIs", async () => {
  await withServer(async (baseUrl) => {
    const created = await request(baseUrl, "POST", "/api/v1/engagements", validCreate);
    assert.equal(created.response.status, 201);
    assert.match(created.payload.engagement.id, /^eng_/);
    assert.equal(created.payload.engagement.received_node_count, 0);

    const listed = await request(baseUrl, "GET", "/api/v1/engagements");
    assert.equal(listed.response.status, 200);
    assert.equal(listed.payload.engagements.length, 1);

    const read = await request(baseUrl, "GET", `/api/v1/engagements/${created.payload.engagement.id}`);
    assert.equal(read.response.status, 200);
    assert.equal(read.payload.engagement.customer_name, "NVIS Interview Demo");

    const updated = await request(baseUrl, "PATCH", `/api/v1/engagements/${created.payload.engagement.id}`, {
      description: "Updated scope",
      status: "collecting",
      expected_node_count: 3,
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.payload.engagement.description, "Updated scope");
    assert.equal(updated.payload.engagement.status, "collecting");
    assert.equal(updated.payload.engagement.expected_node_count, 3);
  });
});

test("engagement validation rejects invalid requests and calculated counter overwrite", async () => {
  await withServer(async (baseUrl) => {
    assert.equal((await request(baseUrl, "POST", "/api/v1/engagements", { ...validCreate, expected_node_count: 0 })).response.status, 400);
    assert.equal((await request(baseUrl, "POST", "/api/v1/engagements", { ...validCreate, platform_profile: "nonsense" })).response.status, 400);
    const created = await request(baseUrl, "POST", "/api/v1/engagements", validCreate);
    assert.equal((await request(baseUrl, "PATCH", `/api/v1/engagements/${created.payload.engagement.id}`, { status: "complete" })).response.status, 400);
    assert.equal((await request(baseUrl, "PATCH", `/api/v1/engagements/${created.payload.engagement.id}`, { received_node_count: 99 })).response.status, 400);
  });
});

test("engagement APIs reject unauthenticated access", async () => {
  await withServer(async (baseUrl) => {
    const result = await request(baseUrl, "GET", "/api/v1/engagements", undefined, false);
    assert.equal(result.response.status, 401);
  });
});

test("derived node counts, persistence round trip, missing file, and fixture idempotency", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gpu-validator-store-test-"));
  try {
    const storePath = path.join(dir, "store.json");
    const store = new EngagementStore({ filePath: storePath, idGenerator: () => "fixed", clock: () => new Date("2030-01-01T00:00:00Z") });
    assert.deepEqual(store.listEngagements(), []);
    const engagement = store.createEngagement(validCreate);
    const document = store.read();
    document.nodes.push(
      { id: "node1", engagement_id: engagement.id, display_name: "node01", source_hostname: null, node_fingerprint: null, platform_profile: "hgx-h100", gpu_model: null, gpu_count: null, driver_version: null, cuda_version: null, kernel_version: null, operating_system: null, ofed_version: null, fabric_type: null, collection_status: "validated", validation_status: "ready", readiness_score: 100, last_collection_at: null, simulated: false, findings_count: 0, critical_findings_count: 0, high_findings_count: 0 },
      { id: "node2", engagement_id: engagement.id, display_name: "node02", source_hostname: null, node_fingerprint: null, platform_profile: "hgx-h100", gpu_model: null, gpu_count: null, driver_version: null, cuda_version: null, kernel_version: null, operating_system: null, ofed_version: null, fabric_type: null, collection_status: "validated", validation_status: "remediation_required", readiness_score: 72, last_collection_at: null, simulated: false, findings_count: 2, critical_findings_count: 1, high_findings_count: 1 },
    );
    store.write(document);
    const reloaded = new EngagementStore({ filePath: storePath }).getEngagement(engagement.id)!;
    assert.equal(reloaded.received_node_count, 2);
    assert.equal(reloaded.ready_node_count, 1);
    assert.equal(reloaded.remediation_node_count, 1);
    assert.equal(reloaded.readiness_score, 86);

    const firstFixture = store.loadDemoFixture();
    const secondFixture = store.loadDemoFixture();
    assert.equal(firstFixture.id, secondFixture.id);
    assert.equal(store.getNodes(firstFixture.id).length, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
