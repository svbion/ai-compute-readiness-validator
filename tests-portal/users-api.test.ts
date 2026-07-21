import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";

import { createPortalServerApp } from "../server";
import { INITIAL_PLATFORM_ADMIN, UserStore } from "../src/server/users";

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
  process.env.GPUVALIDATOR_INITIAL_ADMIN_PASSWORD = "StrongBootstrap-123!";
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
    const login = await jsonRequest(baseUrl, "POST", "/api/auth/login", { username: created.payload.user.username, password: created.payload.temporary_password }, false);
    assert.equal(login.response.status, 200, JSON.stringify(login.payload));
    assert.equal(login.payload.user.role, "temporary_reviewer");
    const store = JSON.parse(fs.readFileSync(userStorePath, "utf8"));
    const user = store.users.find((item: any) => item.id === created.payload.user.id);
    user.expires_at = "2000-01-01T00:00:00.000Z";
    fs.writeFileSync(userStorePath, `${JSON.stringify(store, null, 2)}\n`);
    const expired = await jsonRequest(baseUrl, "POST", "/api/auth/login", { username: created.payload.user.username, password: created.payload.temporary_password }, false);
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
    const login = await jsonRequest(baseUrl, "POST", "/api/auth/login", { username: "reviewer2", password: reviewer.payload.temporary_password }, false);
    assert.equal(login.response.status, 200);
    const revoke = await jsonRequest(baseUrl, "POST", `/api/v1/admin/users/${reviewer.payload.user.id}/revoke-sessions`);
    assert.equal(revoke.response.status, 200);
    const sessionAfterRevoke = await jsonRequest(baseUrl, "GET", "/api/auth/session", undefined, false, login.cookie);
    assert.equal(sessionAfterRevoke.response.status, 401);
  });
});

test("login authenticates only by normalized username and ignores email metadata", async () => {
  await withServer(async (baseUrl) => {
    const reviewer = await jsonRequest(baseUrl, "POST", "/api/v1/admin/users", {
      username: "Reviewer.Mixed",
      display_name: "Reviewer Mixed",
      email: "reviewer.mixed@example.invalid",
      role: "reviewer",
    });
    assert.equal(reviewer.response.status, 201, JSON.stringify(reviewer.payload));

    const usernameLogin = await jsonRequest(baseUrl, "POST", "/api/auth/login", { username: "  REVIEWER.MIXED  ", password: reviewer.payload.temporary_password }, false);
    assert.equal(usernameLogin.response.status, 200, JSON.stringify(usernameLogin.payload));
    assert.equal(usernameLogin.payload.user.username, "reviewer.mixed");

    const emailLogin = await jsonRequest(baseUrl, "POST", "/api/auth/login", { email: "reviewer.mixed@example.invalid", password: reviewer.payload.temporary_password }, false);
    assert.equal(emailLogin.response.status, 401);
    assert.equal(emailLogin.payload.reason, "invalid-credentials");
  });
});

test("sfrazier administrator login creates a session for protected admin routes", async () => {
  await withServer(async (baseUrl, userStorePath) => {
    const store = new UserStore({ filePath: userStorePath });
    store.bootstrapAdmin({ username: " sfrazier ", display_name: "Sabion Frazier", password: "StrongBootstrap-123!", recovery: true });

    const login = await jsonRequest(baseUrl, "POST", "/api/auth/login", { username: " SFRAZIER ", password: "StrongBootstrap-123!" }, false);
    assert.equal(login.response.status, 200, JSON.stringify(login.payload));
    assert.equal(login.payload.user.username, "sfrazier");
    assert.equal(login.payload.user.role, "administrator");
    assert.ok(login.cookie.includes("ai_factory_session="));

    const admin = await jsonRequest(baseUrl, "GET", "/api/v1/admin/users", undefined, false, login.cookie);
    assert.equal(admin.response.status, 200, JSON.stringify(admin.payload));
    assert.equal(admin.payload.users.some((user: any) => user.username === "sfrazier"), true);
  });
});

test("disabled, expired, and locked users cannot authenticate", async () => {
  await withServer(async (baseUrl, userStorePath) => {
    const disabled = await jsonRequest(baseUrl, "POST", "/api/v1/admin/users", { username: "disabled-user", display_name: "Disabled User", role: "reviewer", password: "DisabledUser-123!" });
    const expired = await jsonRequest(baseUrl, "POST", "/api/v1/admin/users", { username: "expired-user", display_name: "Expired User", role: "reviewer", password: "ExpiredUser-123!", expires_at: "2000-01-01T00:00:00.000Z" });
    const locked = await jsonRequest(baseUrl, "POST", "/api/v1/admin/users", { username: "locked-user", display_name: "Locked User", role: "reviewer", password: "LockedUser-123!" });
    await jsonRequest(baseUrl, "POST", `/api/v1/admin/users/${disabled.payload.user.id}/disable`);
    const data = JSON.parse(fs.readFileSync(userStorePath, "utf8"));
    const lockedRecord = data.users.find((user: any) => user.id === locked.payload.user.id);
    lockedRecord.status = "locked";
    lockedRecord.locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    fs.writeFileSync(userStorePath, `${JSON.stringify(data, null, 2)}\n`);

    const disabledLogin = await jsonRequest(baseUrl, "POST", "/api/auth/login", { username: "disabled-user", password: "DisabledUser-123!" }, false);
    assert.equal(disabledLogin.response.status, 401);
    assert.equal(disabledLogin.payload.reason, "account-disabled");
    const expiredLogin = await jsonRequest(baseUrl, "POST", "/api/auth/login", { username: "expired-user", password: "ExpiredUser-123!" }, false);
    assert.equal(expiredLogin.response.status, 401);
    assert.equal(expiredLogin.payload.reason, "account-expired");
    const lockedLogin = await jsonRequest(baseUrl, "POST", "/api/auth/login", { username: "locked-user", password: "LockedUser-123!" }, false);
    assert.equal(lockedLogin.response.status, 423);
    assert.equal(lockedLogin.payload.reason, "account-locked");
    const wrongPassword = await jsonRequest(baseUrl, "POST", "/api/auth/login", { username: expired.payload.user.username, password: "WrongPassword-123!" }, false);
    assert.equal(wrongPassword.response.status, 401);
    assert.equal(wrongPassword.payload.reason, "invalid-credentials");
  });
});

test("public UI is login-only and login redirects authenticated sessions to portal", async () => {
  await withServer(async (baseUrl) => {
    const root = await fetch(`${baseUrl}/`, { redirect: "manual", headers: { Accept: "text/html" } });
    assert.equal(root.status, 302);
    assert.equal(root.headers.get("location"), "/login");
    const docs = await fetch(`${baseUrl}/docs`, { redirect: "manual", headers: { Accept: "text/html" } });
    assert.equal(docs.status, 302);
    assert.equal(docs.headers.get("location"), "/login");
    const portal = await fetch(`${baseUrl}/portal/admin/users`, { redirect: "manual", headers: { Accept: "text/html" } });
    assert.equal(portal.status, 302);
    assert.equal(portal.headers.get("location"), "/login");

    const login = await jsonRequest(baseUrl, "POST", "/api/auth/login", { username: INITIAL_PLATFORM_ADMIN.username, password: "StrongBootstrap-123!" }, false);
    assert.equal(login.response.status, 200, JSON.stringify(login.payload));
    const authedLogin = await fetch(`${baseUrl}/login`, { redirect: "manual", headers: { Accept: "text/html", Cookie: login.cookie } });
    assert.equal(authedLogin.status, 302);
    assert.equal(authedLogin.headers.get("location"), "/portal");
    const authedRoot = await fetch(`${baseUrl}/`, { redirect: "manual", headers: { Accept: "text/html", Cookie: login.cookie } });
    assert.equal(authedRoot.status, 302);
    assert.equal(authedRoot.headers.get("location"), "/login");
  });
});
