import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";

import { createPortalServerApp } from "../server";
import {
  INITIAL_PLATFORM_ADMIN,
  platformAdminPermissions,
  roleHasPermission,
  UserStore,
} from "../src/server/users";

async function withInitialAdminServer(fn: (baseUrl: string, userStorePath: string, logs: string[]) => Promise<void>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gpu-validator-initial-admin-test-"));
  const previous = { ...process.env };
  const logs: string[] = [];
  const previousInfo = console.info;
  process.env.NODE_ENV = "production";
  process.env.AI_FACTORY_AUTH_REQUIRED = "true";
  process.env.AI_FACTORY_SESSION_SECRET = "0123456789abcdef0123456789abcdef";
  process.env.AI_FACTORY_COOKIE_SECURE = "false";
  process.env.AI_VALIDATOR_ENGAGEMENT_STORE = path.join(dir, "engagements.json");
  process.env.AI_VALIDATOR_USER_STORE = path.join(dir, "users.json");
  process.env.GPUVALIDATOR_INITIAL_ADMIN_PASSWORD = "InitialAdmin-12345!";
  console.info = (...args: unknown[]) => { logs.push(args.map(String).join(" ")); };
  const app = await createPortalServerApp({ mountFrontend: false });
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    const address = server.address() as AddressInfo;
    await fn(`http://127.0.0.1:${address.port}`, process.env.AI_VALIDATOR_USER_STORE, logs);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    console.info = previousInfo;
    process.env = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function jsonRequest(baseUrl: string, method: string, url: string, body?: unknown, cookie?: string) {
  const response = await fetch(`${baseUrl}${url}`, { method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { response, payload: await response.json().catch(() => ({})), cookie: response.headers.get("set-cookie") ?? "" };
}

test("initial platform administrator is seeded from bootstrap environment and can authenticate", async () => {
  await withInitialAdminServer(async (baseUrl, userStorePath, logs) => {
    const document = JSON.parse(fs.readFileSync(userStorePath, "utf8"));
    const admin = document.users.find((user: any) => user.username === INITIAL_PLATFORM_ADMIN.username);
    assert.ok(admin, "expected initial administrator to be stored");
    assert.equal(admin.display_name, "Michael Echavarria");
    assert.equal(admin.role, "administrator");
    assert.equal(admin.must_change_password, true);
    assert.match(admin.password_hash, /^scrypt\$/);
    assert.equal(JSON.stringify(document).includes("InitialAdmin-12345!"), false);
    assert.equal(logs.some((line) => line.includes("InitialAdmin-12345!")), false, "environment-provided bootstrap password must not be printed");

    const login = await jsonRequest(baseUrl, "POST", "/api/auth/login", { username: "mechavarria", password: "InitialAdmin-12345!" });
    assert.equal(login.response.status, 200, JSON.stringify(login.payload));
    assert.equal(login.payload.user.username, "mechavarria");
    assert.equal(login.payload.user.role, "administrator");

    const users = await jsonRequest(baseUrl, "GET", "/api/v1/admin/users", undefined, login.cookie);
    assert.equal(users.response.status, 200, JSON.stringify(users.payload));
    assert.equal(users.payload.users.some((user: any) => user.username === "mechavarria"), true);
  });
});

test("initial platform administrator seeding is idempotent", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gpu-validator-initial-admin-idempotent-"));
  try {
    const store = new UserStore({ filePath: path.join(dir, "users.json") });
    const first = store.seedInitialPlatformAdmin({ password: "InitialAdmin-12345!", passwordSource: "environment" });
    const second = store.seedInitialPlatformAdmin({ password: "DifferentAdmin-12345!", passwordSource: "environment" });
    const document = store.read();
    const admins = document.users.filter((user: any) => user.username === "mechavarria");
    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(admins.length, 1);
    assert.equal(second.user.id, first.user.id);
    assert.equal(JSON.stringify(document).includes("InitialAdmin-12345!"), false);
    assert.equal(JSON.stringify(document).includes("DifferentAdmin-12345!"), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("platform administrator role grants every current application permission", () => {
  assert.deepEqual(platformAdminPermissions, [
    "platform:admin",
    "users:manage",
    "organizations:manage",
    "agents:manage",
    "clusters:manage",
    "validations:manage",
    "benchmarks:manage",
    "reports:manage",
    "monitoring:manage",
    "alerts:manage",
    "settings:manage",
    "audit_logs:read",
    "api_keys:manage",
    "ai_copilot:use",
    "licensing:manage",
    "integrations:manage",
  ]);
  for (const permission of platformAdminPermissions) {
    assert.equal(roleHasPermission("administrator", permission), true, `${permission} should be granted to administrators`);
  }
  assert.equal(roleHasPermission("reviewer", "platform:admin"), false);
});
