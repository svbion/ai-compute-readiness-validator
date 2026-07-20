import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";

import { createPortalServerApp } from "../server";
import { UserStore } from "../src/server/users";

const authHeader = { "x-ai-factory-test-auth": "test-bypass-token" };

async function withServer(fn: (baseUrl: string, userStorePath: string) => Promise<void>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gpu-validator-users-api-test-"));
  const previous = { ...process.env };
  process.env.NODE_ENV = "production";
  process.env.AI_FACTORY_AUTH_REQUIRED = "true";
  process.env.AI_FACTORY_SESSION_SECRET = "0123456789abcdef0123456789abcdef";
  process.env.AI_FACTORY_AUTH_TEST_BYPASS_TOKEN = "test-bypass-token";
  process.env.AI_VALIDATOR_ENGAGEMENT_STORE = path.join(dir, "engagements.json");
  process.env.AI_VALIDATOR_USER_STORE = path.join(dir, "users.json");
  const store = new UserStore({ filePath: process.env.AI_VALIDATOR_USER_STORE });
  store.bootstrapAdmin({ username: "admin", display_name: "Admin User", password: "StrongBootstrap-123!" });
  const app = await createPortalServerApp({ mountFrontend: false });
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    const address = server.address() as AddressInfo;
    await fn(`http://127.0.0.1:${address.port}`, process.env.AI_VALIDATOR_USER_STORE);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    process.env = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function jsonRequest(baseUrl: string, method: string, url: string, body?: unknown, authed = true, cookie?: string) {
  const response = await fetch(`${baseUrl}${url}`, { method, headers: { "Content-Type": "application/json", ...(authed ? authHeader : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { response, payload: await response.json().catch(() => ({})), cookie: response.headers.get("set-cookie") ?? "" };
}

test("administrator APIs create users without returning password hashes and enforce admin access", async () => {
  await withServer(async (baseUrl, userStorePath) => {
    const unauthenticated = await jsonRequest(baseUrl, "GET", "/api/v1/admin/users", undefined, false);
    assert.equal(unauthenticated.response.status, 401);
    const createReviewer = await jsonRequest(baseUrl, "POST", "/api/v1/admin/users", { username: "reviewer1", display_name: "Reviewer One", role: "reviewer" });
    assert.equal(createReviewer.response.status, 201, JSON.stringify(createReviewer.payload));
    assert.equal(createReviewer.payload.user.password_hash, undefined);
    assert.equal(typeof createReviewer.payload.temporary_password, "string");
    const listing = await jsonRequest(baseUrl, "GET", "/api/v1/admin/users");
    assert.equal(listing.payload.users.some((user: any) => user.username === "reviewer1"), true);
    assert.equal(JSON.stringify(listing.payload).includes("password_hash"), false);
    const stored = JSON.parse(fs.readFileSync(userStorePath, "utf8"));
    assert.match(stored.users.find((user: any) => user.username === "reviewer1").password_hash, /^scrypt\$/);
    assert.equal(JSON.stringify(stored).includes(createReviewer.payload.temporary_password), false);
  });
});

test("temporary interviewer credentials are shown once and account expiration blocks login", async () => {
  await withServer(async (baseUrl, userStorePath) => {
    const created = await jsonRequest(baseUrl, "POST", "/api/v1/admin/users/interviewer", { display_name: "NVIDIA Interviewer", hours: 2, notes: "RC1 interview" });
    assert.equal(created.response.status, 201, JSON.stringify(created.payload));
    assert.match(created.payload.user.username, /^nvidia-reviewer-/);
    assert.equal(created.payload.user.role, "temporary_reviewer");
    assert.equal(created.payload.user.password_hash, undefined);
    assert.equal(typeof created.payload.temporary_password, "string");
    const login = await jsonRequest(baseUrl, "POST", "/api/auth/login", { email: created.payload.user.username, password: created.payload.temporary_password }, false);
    assert.equal(login.response.status, 200, JSON.stringify(login.payload));
    assert.equal(login.payload.user.role, "temporary_reviewer");
    const store = JSON.parse(fs.readFileSync(userStorePath, "utf8"));
    const user = store.users.find((item: any) => item.id === created.payload.user.id);
    user.expires_at = "2000-01-01T00:00:00.000Z";
    fs.writeFileSync(userStorePath, `${JSON.stringify(store, null, 2)}\n`);
    const expired = await jsonRequest(baseUrl, "POST", "/api/auth/login", { email: created.payload.user.username, password: created.payload.temporary_password }, false);
    assert.equal(expired.response.status, 401);
    assert.equal(expired.payload.reason, "account-expired");
  });
});

test("last administrator protection and session revocation are enforced", async () => {
  await withServer(async (baseUrl) => {
    const users = await jsonRequest(baseUrl, "GET", "/api/v1/admin/users");
    const admin = users.payload.users.find((user: any) => user.role === "administrator");
    const denied = await jsonRequest(baseUrl, "POST", `/api/v1/admin/users/${admin.id}/disable`);
    assert.equal(denied.response.status, 400);
    const reviewer = await jsonRequest(baseUrl, "POST", "/api/v1/admin/users", { username: "reviewer2", display_name: "Reviewer Two", role: "reviewer" });
    const login = await jsonRequest(baseUrl, "POST", "/api/auth/login", { email: "reviewer2", password: reviewer.payload.temporary_password }, false);
    assert.equal(login.response.status, 200);
    const revoke = await jsonRequest(baseUrl, "POST", `/api/v1/admin/users/${reviewer.payload.user.id}/revoke-sessions`);
    assert.equal(revoke.response.status, 200);
    const sessionAfterRevoke = await jsonRequest(baseUrl, "GET", "/api/auth/session", undefined, false, login.cookie);
    assert.equal(sessionAfterRevoke.response.status, 401);
  });
});
