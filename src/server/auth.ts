import crypto from "crypto";

export interface AuthEnvironment {
  NODE_ENV?: string;
  AI_FACTORY_AUTH_REQUIRED?: string;
  AI_FACTORY_SESSION_SECRET?: string;
  AI_FACTORY_REVIEWER_USERNAME?: string;
  AI_FACTORY_REVIEWER_PASSWORD_HASH?: string;
  AI_FACTORY_SESSION_TTL_SECONDS?: string;
  AI_FACTORY_COOKIE_SECURE?: string;
  AI_FACTORY_AUTH_TEST_BYPASS_TOKEN?: string;
}

export interface AuthConfig {
  required: boolean;
  reviewerUsername: string | null;
  passwordHash: string | null;
  sessionSecret: string | null;
  sessionTtlSeconds: number;
  cookieSecure: boolean;
  testBypassToken: string | null;
}

const HASH_PREFIX = "scrypt";

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function shouldRequireAuth(env: AuthEnvironment): boolean {
  return parseBoolean(env.AI_FACTORY_AUTH_REQUIRED, env.NODE_ENV === "production");
}

export function createPasswordHash(password: string, salt: string = crypto.randomBytes(16).toString("hex")): string {
  if (!password || password.length < 12) {
    throw new Error("Reviewer password must be at least 12 characters.");
  }

  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${HASH_PREFIX}$${salt}$${derivedKey}`;
}

export function timingSafeVerifyPassword(password: string, passwordHash: string): boolean {
  const parts = passwordHash.split("$");
  if (parts.length !== 3 || parts[0] !== HASH_PREFIX) return false;

  const [, salt, expectedHex] = parts;
  const actual = Buffer.from(crypto.scryptSync(password, salt, 64).toString("hex"), "hex");
  const expected = Buffer.from(expectedHex, "hex");

  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function buildAuthConfig(env: AuthEnvironment): AuthConfig {
  const required = shouldRequireAuth(env);
  const reviewerUsername = env.AI_FACTORY_REVIEWER_USERNAME?.trim().toLowerCase() || null;
  const passwordHash = env.AI_FACTORY_REVIEWER_PASSWORD_HASH?.trim() || null;
  const sessionSecret = env.AI_FACTORY_SESSION_SECRET?.trim() || null;

  if (required) {
    const missing = [
      !sessionSecret ? "AI_FACTORY_SESSION_SECRET" : null,
    ].filter(Boolean);

    if (missing.length > 0) {
      throw new Error(`Authentication is required, but missing ${missing.join(", ")}.`);
    }
  }

  return {
    required,
    reviewerUsername,
    passwordHash,
    sessionSecret,
    sessionTtlSeconds: parsePositiveInteger(env.AI_FACTORY_SESSION_TTL_SECONDS, 60 * 60),
    cookieSecure: parseBoolean(env.AI_FACTORY_COOKIE_SECURE, env.NODE_ENV === "production"),
    testBypassToken: env.AI_FACTORY_AUTH_TEST_BYPASS_TOKEN?.trim() || null,
  };
}

export function signSessionId(sessionId: string, secret: string): string {
  const signature = crypto.createHmac("sha256", secret).update(sessionId).digest("base64url");
  return `${sessionId}.${signature}`;
}

export function verifySignedSessionId(signedValue: string | undefined, secret: string): string | null {
  if (!signedValue) return null;
  const [sessionId, signature] = signedValue.split(".");
  if (!sessionId || !signature) return null;

  const expected = signSessionId(sessionId, secret).split(".")[1];
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return null;

  return crypto.timingSafeEqual(actualBuffer, expectedBuffer) ? sessionId : null;
}

export function createSessionId(): string {
  return crypto.randomBytes(32).toString("base64url");
}
