import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";

import { createPortalServerApp } from "../server";
import { createPasswordHash } from "../src/server/auth";

async function withServer(fn: (baseUrl: string) => Promise<void>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gpu-validator-routing-test-"));
  const previous = { ...process.env };
  process.env.NODE_ENV = "production";
  process.env.AI_FACTORY_AUTH_REQUIRED = "true";
  process.env.AI_FACTORY_SESSION_SECRET = "0123456789abcdef0123456789abcdef";
  process.env.AI_FACTORY_REVIEWER_USERNAME = "reviewer";
  process.env.AI_FACTORY_REVIEWER_PASSWORD_HASH = createPasswordHash("deadline-password");
  process.env.AI_VALIDATOR_ENGAGEMENT_STORE = path.join(dir, "store.json");
  const app = await createPortalServerApp({ mountFrontend: true });
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    const address = server.address() as AddressInfo;
    await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    process.env = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function request(baseUrl: string, pathName: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${pathName}`, { redirect: "manual", ...init });
  return { response, text: await response.text() };
}

test("production routing redirects root, serves login directly, and protects portal and APIs", async () => {
  await withServer(async (baseUrl) => {
    const root = await request(baseUrl, "/");
    assert.equal(root.response.status, 302);
    assert.equal(root.response.headers.get("location"), "/login");

    const login = await request(baseUrl, "/login");
    assert.equal(login.response.status, 200);
    assert.match(login.text, /GPU Validator|root|script/);

    const portal = await request(baseUrl, "/portal");
    assert.equal(portal.response.status, 302);
    assert.match(portal.response.headers.get("location") ?? "", /^\/login/);

    const api = await request(baseUrl, "/api/v1/agents");
    assert.equal(api.response.status, 401);
    assert.match(api.text, /Authentication required/);

    const badAgent = await request(baseUrl, "/api/v1/agents/register", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer wrong" }, body: JSON.stringify({ name: "bad", hostname: "bad" }) });
    assert.equal(badAgent.response.status, 401);
  });
});

test("production login authenticates and direct /portal loads after session cookie", async () => {
  await withServer(async (baseUrl) => {
    const login = await request(baseUrl, "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "reviewer", password: "deadline-password" }) });
    assert.equal(login.response.status, 200, login.text);
    const cookie = login.response.headers.get("set-cookie") ?? "";
    assert.match(cookie, /ai_factory_session=/);

    const portal = await request(baseUrl, "/portal", { headers: { Cookie: cookie } });
    assert.equal(portal.response.status, 200);
    assert.match(portal.text, /GPU Validator|root|script/);
  });
});
