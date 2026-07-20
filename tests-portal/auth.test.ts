import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAuthConfig,
  createPasswordHash,
  timingSafeVerifyPassword,
  shouldRequireAuth,
  type AuthEnvironment,
} from "../src/server/auth";

const baseEnv: AuthEnvironment = {
  NODE_ENV: "production",
  AI_FACTORY_AUTH_REQUIRED: undefined,
  AI_FACTORY_SESSION_SECRET: "0123456789abcdef0123456789abcdef",
  AI_FACTORY_REVIEWER_USERNAME: "NVIDIA-Reviewer",
  AI_FACTORY_REVIEWER_PASSWORD_HASH: createPasswordHash("correct horse battery staple"),
};

test("production requires authentication by default", () => {
  assert.equal(shouldRequireAuth({ NODE_ENV: "production" }), true);
});

test("development can explicitly require authentication", () => {
  assert.equal(shouldRequireAuth({ NODE_ENV: "development", AI_FACTORY_AUTH_REQUIRED: "true" }), true);
  assert.equal(shouldRequireAuth({ NODE_ENV: "development" }), false);
});

test("auth config rejects required auth without credentials and session secret", () => {
  assert.throws(
    () => buildAuthConfig({ NODE_ENV: "production" }),
    /AI_FACTORY_SESSION_SECRET|AI_FACTORY_REVIEWER_USERNAME|AI_FACTORY_REVIEWER_PASSWORD_HASH/,
  );
});

test("auth config accepts normalized reviewer username credential only", () => {
  const config = buildAuthConfig(baseEnv);

  assert.equal(config.required, true);
  assert.equal(config.reviewerUsername, "nvidia-reviewer");
  assert.equal(config.passwordHash.includes("correct horse"), false);
});

test("scrypt password hashes verify correct input and reject wrong input", () => {
  const passwordHash = createPasswordHash("reviewer test password");

  assert.equal(timingSafeVerifyPassword("reviewer test password", passwordHash), true);
  assert.equal(timingSafeVerifyPassword("wrong password", passwordHash), false);
});
