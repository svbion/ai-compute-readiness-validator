import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import type express from "express";
import { createPasswordHash, timingSafeVerifyPassword } from "./auth";

export const USER_SCHEMA_VERSION = "1.0.0";
export const userRoles = ["administrator", "reviewer", "temporary_reviewer"] as const;
export const userStatuses = ["active", "disabled", "expired", "locked"] as const;
export type UserRole = typeof userRoles[number];
export type UserStatus = typeof userStatuses[number];

export const INITIAL_PLATFORM_ADMIN = {
  display_name: "Michael Echavarria",
  username: "mechavarria",
  role_label: "Platform Administrator",
} as const;

export const platformAdminPermissions = [
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
] as const;

export type PlatformPermission = typeof platformAdminPermissions[number];

export const rolePermissions: Record<UserRole, readonly PlatformPermission[]> = {
  administrator: platformAdminPermissions,
  reviewer: ["reports:manage", "monitoring:manage"],
  temporary_reviewer: ["reports:manage"],
};

export function roleHasPermission(role: UserRole, permission: PlatformPermission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}

export interface UserRecord {
  id: string;
  schema_version: string;
  username: string;
  display_name: string;
  email: string | null;
  role: UserRole;
  password_hash: string;
  status: UserStatus;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  last_login_at: string | null;
  password_changed_at: string;
  expires_at: string | null;
  disabled_at: string | null;
  failed_login_count: number;
  locked_until: string | null;
  must_change_password: boolean;
  session_version: number;
  notes: string;
  tags: string[];
}

export type PublicUser = Omit<UserRecord, "password_hash">;

type AuditEntry = { id: string; created_at: string; actor: string; action: string; user_id: string | null; metadata: Record<string, string | number | boolean | null> };
type UserDocument = { schema_version: string; users: UserRecord[]; audit_entries: AuditEntry[] };

function defaultUserStorePath(): string {
  return path.join(process.cwd(), "artifacts", "users", "store.json");
}

function nowIso(clock: () => Date): string {
  return clock().toISOString();
}

export function normalizeUsername(username: string): string {
  const normalized = username.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,62}$/.test(normalized)) {
    throw new Error("Username must be 3-63 characters using letters, numbers, dot, dash, or underscore.");
  }
  return normalized;
}

export function validatePasswordComplexity(password: string): void {
  if (password.length < 14) throw new Error("Password must be at least 14 characters.");
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    throw new Error("Password must include uppercase, lowercase, number, and symbol characters.");
  }
}

export function generateTemporaryPassword(): string {
  return `Gv-${crypto.randomBytes(18).toString("base64url")}-!9aA`;
}

function safeUser(user: UserRecord): PublicUser {
  const { password_hash: _passwordHash, ...safe } = user;
  return safe;
}

function effectiveStatus(user: UserRecord, clock: () => Date): UserStatus {
  const now = clock().getTime();
  if (user.disabled_at || user.status === "disabled") return "disabled";
  if (user.expires_at && new Date(user.expires_at).getTime() <= now) return "expired";
  if (user.locked_until && new Date(user.locked_until).getTime() > now) return "locked";
  return user.status === "locked" ? "active" : user.status;
}

export class UserStore {
  private filePath: string;
  private clock: () => Date;
  private idGenerator: () => string;

  constructor(options: { filePath?: string; clock?: () => Date; idGenerator?: () => string } = {}) {
    this.filePath = options.filePath ?? process.env.AI_VALIDATOR_USER_STORE ?? defaultUserStorePath();
    this.clock = options.clock ?? (() => new Date());
    this.idGenerator = options.idGenerator ?? (() => crypto.randomUUID());
  }

  get pathForTests(): string {
    return this.filePath;
  }

  read(): UserDocument {
    if (!fs.existsSync(this.filePath)) return { schema_version: USER_SCHEMA_VERSION, users: [], audit_entries: [] };
    const parsed = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
    if (parsed.schema_version && parsed.schema_version !== USER_SCHEMA_VERSION) throw new Error(`Unsupported user store schema_version ${parsed.schema_version}`);
    return { schema_version: USER_SCHEMA_VERSION, users: Array.isArray(parsed.users) ? parsed.users : [], audit_entries: Array.isArray(parsed.audit_entries) ? parsed.audit_entries : [] };
  }

  write(document: UserDocument): void {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.chmodSync(dir, 0o700);
    const tmp = path.join(dir, `.${path.basename(this.filePath)}.${process.pid}.${Date.now()}.tmp`);
    fs.writeFileSync(tmp, `${JSON.stringify({ schema_version: USER_SCHEMA_VERSION, users: document.users, audit_entries: document.audit_entries }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    fs.renameSync(tmp, this.filePath);
    fs.chmodSync(this.filePath, 0o600);
  }

  hasUsers(): boolean {
    return this.read().users.length > 0;
  }

  listUsers(filters: { query?: string; role?: string; status?: string } = {}): PublicUser[] {
    const q = filters.query?.trim().toLowerCase() ?? "";
    return this.read().users
      .map((user) => ({ ...user, status: effectiveStatus(user, this.clock) }))
      .filter((user) => !q || [user.username, user.display_name, user.email ?? "", user.notes, ...user.tags].join(" ").toLowerCase().includes(q))
      .filter((user) => !filters.role || filters.role === "all" || user.role === filters.role)
      .filter((user) => !filters.status || filters.status === "all" || user.status === filters.status)
      .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
      .map(safeUser);
  }

  getUser(userId: string): PublicUser | null {
    const user = this.read().users.find((item) => item.id === userId);
    return user ? safeUser({ ...user, status: effectiveStatus(user, this.clock) }) : null;
  }

  auditEntries(userId?: string): AuditEntry[] {
    return this.read().audit_entries.filter((entry) => !userId || entry.user_id === userId).sort((left, right) => right.created_at.localeCompare(left.created_at));
  }

  bootstrapAdmin(input: { username: string; display_name: string; password: string; actor?: string; recovery?: boolean }): PublicUser {
    validatePasswordComplexity(input.password);
    const document = this.read();
    const activeAdmins = document.users.filter((user) => user.role === "administrator" && effectiveStatus(user, this.clock) === "active");
    if (activeAdmins.length > 0 && !input.recovery) throw new Error("An active administrator already exists; refusing bootstrap without recovery mode.");
    const created = this.createUserInternal(document, { username: input.username, display_name: input.display_name, email: null, role: "administrator", password: input.password, expires_at: null, must_change_password: false, notes: "Initial administrator bootstrap", tags: ["bootstrap"] }, input.actor ?? "bootstrap");
    this.write(document);
    return safeUser(created);
  }

  seedInitialPlatformAdmin(input: { password?: string; passwordSource?: "environment" | "generated"; reporter?: (message: string) => void } = {}): { created: boolean; user: PublicUser; temporary_password?: string } {
    const document = this.read();
    const username = normalizeUsername(INITIAL_PLATFORM_ADMIN.username);
    const existing = document.users.find((user) => user.username === username);
    if (existing) return { created: false, user: safeUser({ ...existing, status: effectiveStatus(existing, this.clock) }) };

    const password = input.password ?? generateTemporaryPassword();
    validatePasswordComplexity(password);
    const created = this.createUserInternal(document, {
      username,
      display_name: INITIAL_PLATFORM_ADMIN.display_name,
      email: null,
      role: "administrator",
      password,
      expires_at: null,
      must_change_password: true,
      notes: `${INITIAL_PLATFORM_ADMIN.role_label} seeded by application bootstrap.`,
      tags: ["bootstrap", "platform-administrator"],
    }, "bootstrap");
    this.write(document);

    if (!input.password && input.reporter) {
      input.reporter(`GPUValidator initial administrator temporary password for ${username}: ${password}`);
      input.reporter("This password is shown once during bootstrap. Store it securely and change it on first login.");
    }

    return { created: true, user: safeUser(created), temporary_password: input.password ? undefined : password };
  }

  createUser(input: { username?: string; display_name: string; email?: string | null; role: UserRole; password?: string; expires_at?: string | null; must_change_password?: boolean; notes?: string; tags?: string[] }, actor: string): { user: PublicUser; temporary_password?: string } {
    const document = this.read();
    if (!userRoles.includes(input.role)) throw new Error("Unsupported role.");
    const temporary = input.password ?? generateTemporaryPassword();
    if (input.password) validatePasswordComplexity(input.password);
    const username = input.username ?? (input.role === "temporary_reviewer" ? `nvidia-reviewer-${crypto.randomBytes(4).toString("hex")}` : "");
    const created = this.createUserInternal(document, { username, display_name: input.display_name, email: input.email ?? null, role: input.role, password: temporary, expires_at: input.expires_at ?? null, must_change_password: input.must_change_password ?? input.role !== "temporary_reviewer", notes: input.notes ?? "", tags: input.tags ?? [] }, actor);
    this.write(document);
    return { user: safeUser(created), temporary_password: input.password ? undefined : temporary };
  }

  authenticate(login: string, password: string): { ok: true; user: PublicUser; session_version: number } | { ok: false; reason: "invalid" | "disabled" | "expired" | "locked" } {
    const document = this.read();
    const normalizedLogin = login.trim().toLowerCase();
    const index = document.users.findIndex((user) => user.username === normalizedLogin);
    const dummyHash = createPasswordHash("DummyPassword-For-Timing-Only-123!", "00000000000000000000000000000000");
    const user = index >= 0 ? document.users[index] : null;
    const hash = user?.password_hash ?? dummyHash;
    const passwordOk = timingSafeVerifyPassword(password, hash);
    if (!user || !passwordOk) {
      if (user) this.recordFailedLogin(document, index);
      this.write(document);
      return { ok: false, reason: "invalid" };
    }
    const status = effectiveStatus(user, this.clock);
    if (status !== "active") return { ok: false, reason: status };
    user.failed_login_count = 0;
    user.locked_until = null;
    user.status = "active";
    user.last_login_at = nowIso(this.clock);
    user.updated_at = user.last_login_at;
    this.addAudit(document, user.username, "user.login", user.id, {});
    this.write(document);
    return { ok: true, user: safeUser(user), session_version: user.session_version };
  }

  disableUser(userId: string, actor: string): PublicUser {
    const document = this.read();
    const user = this.requireMutableUser(document, userId);
    if (user.role === "administrator" && this.activeAdminCount(document, user.id) === 0) throw new Error("Cannot disable the last active administrator.");
    const now = nowIso(this.clock);
    user.status = "disabled";
    user.disabled_at = now;
    user.updated_at = now;
    user.session_version += 1;
    this.addAudit(document, actor, "user.disable", user.id, {});
    this.write(document);
    return safeUser(user);
  }

  enableUser(userId: string, actor: string): PublicUser {
    const document = this.read();
    const user = this.requireMutableUser(document, userId);
    user.status = "active";
    user.disabled_at = null;
    user.locked_until = null;
    user.failed_login_count = 0;
    user.updated_at = nowIso(this.clock);
    this.addAudit(document, actor, "user.enable", user.id, {});
    this.write(document);
    return safeUser(user);
  }

  resetPassword(userId: string, actor: string): { user: PublicUser; temporary_password: string } {
    const document = this.read();
    const user = this.requireMutableUser(document, userId);
    const temporary = generateTemporaryPassword();
    const now = nowIso(this.clock);
    user.password_hash = createPasswordHash(temporary);
    user.password_changed_at = now;
    user.updated_at = now;
    user.session_version += 1;
    user.must_change_password = true;
    this.addAudit(document, actor, "user.reset_password", user.id, {});
    this.write(document);
    return { user: safeUser(user), temporary_password: temporary };
  }

  revokeSessions(userId: string, actor: string): PublicUser {
    const document = this.read();
    const user = this.requireMutableUser(document, userId);
    user.session_version += 1;
    user.updated_at = nowIso(this.clock);
    this.addAudit(document, actor, "user.revoke_sessions", user.id, {});
    this.write(document);
    return safeUser(user);
  }

  private createUserInternal(document: UserDocument, input: { username: string; display_name: string; email: string | null; role: UserRole; password: string; expires_at: string | null; must_change_password: boolean; notes: string; tags: string[] }, actor: string): UserRecord {
    const username = normalizeUsername(input.username);
    const displayName = input.display_name.trim();
    if (!displayName) throw new Error("display_name is required.");
    if (document.users.some((user) => user.username.toLowerCase() === username)) throw new Error("Username is already in use.");
    if (input.email && document.users.some((user) => user.email?.toLowerCase() === input.email?.toLowerCase())) throw new Error("Email is already in use.");
    const now = nowIso(this.clock);
    const user: UserRecord = { id: `usr_${this.idGenerator()}`, schema_version: USER_SCHEMA_VERSION, username, display_name: displayName, email: input.email?.trim().toLowerCase() || null, role: input.role, password_hash: createPasswordHash(input.password), status: "active", created_at: now, created_by: actor, updated_at: now, last_login_at: null, password_changed_at: now, expires_at: input.expires_at, disabled_at: null, failed_login_count: 0, locked_until: null, must_change_password: input.must_change_password, session_version: 1, notes: input.notes.slice(0, 2000), tags: Array.from(new Set(input.tags.map(String).map((tag) => tag.trim()).filter(Boolean))).slice(0, 20) };
    document.users.push(user);
    this.addAudit(document, actor, "user.create", user.id, { role: user.role, expires: user.expires_at ?? null });
    return user;
  }

  private recordFailedLogin(document: UserDocument, index: number): void {
    const user = document.users[index];
    user.failed_login_count += 1;
    if (user.failed_login_count >= 5) {
      user.status = "locked";
      user.locked_until = new Date(this.clock().getTime() + 15 * 60 * 1000).toISOString();
    }
    user.updated_at = nowIso(this.clock);
  }

  private activeAdminCount(document: UserDocument, excludingUserId?: string): number {
    return document.users.filter((user) => user.id !== excludingUserId && user.role === "administrator" && effectiveStatus(user, this.clock) === "active").length;
  }

  private requireMutableUser(document: UserDocument, userId: string): UserRecord {
    const user = document.users.find((item) => item.id === userId);
    if (!user) throw new Error("User not found.");
    return user;
  }

  private addAudit(document: UserDocument, actor: string, action: string, userId: string | null, metadata: Record<string, string | number | boolean | null>): void {
    document.audit_entries.push({ id: `aud_${this.idGenerator()}`, created_at: nowIso(this.clock), actor, action, user_id: userId, metadata });
  }
}

function requireAdmin(req: express.Request, res: express.Response): PublicUser | null {
  const user = (req as any).authUser as PublicUser | undefined;
  if (!user || user.role !== "administrator") {
    res.status(403).json({ error: "Administrator access required" });
    return null;
  }
  return user;
}

function respondError(res: express.Response, error: unknown): express.Response {
  const message = error instanceof Error ? error.message : "User management request failed.";
  return res.status(message.includes("not found") ? 404 : 400).json({ error: message });
}

export function registerUserRoutes(app: express.Express, store = new UserStore()) {
  app.get("/api/v1/admin/users", (req, res) => {
    if (!requireAdmin(req, res)) return;
    return res.json({ users: store.listUsers({ query: String(req.query.query ?? ""), role: String(req.query.role ?? "all"), status: String(req.query.status ?? "all") }) });
  });

  app.post("/api/v1/admin/users", (req, res) => {
    const actor = requireAdmin(req, res);
    if (!actor) return;
    try {
      const result = store.createUser(req.body ?? {}, actor.username);
      return res.status(201).json(result);
    } catch (error) {
      return respondError(res, error);
    }
  });

  app.post("/api/v1/admin/users/interviewer", (req, res) => {
    const actor = requireAdmin(req, res);
    if (!actor) return;
    try {
      const hours = Number(req.body?.hours ?? 8);
      const maxHours = Number(process.env.AI_VALIDATOR_TEMP_USER_MAX_HOURS ?? 24);
      if (!Number.isFinite(hours) || hours <= 0 || hours > maxHours) throw new Error("Expiration must be within the configured maximum.");
      const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      const result = store.createUser({ display_name: String(req.body?.display_name ?? "NVIDIA Reviewer"), email: req.body?.email ?? null, role: "temporary_reviewer", expires_at: expiresAt, must_change_password: false, notes: String(req.body?.notes ?? ""), tags: ["interview", "nvidia"] }, actor.username);
      return res.status(201).json({ ...result, login_url: "/login", expires_at: expiresAt });
    } catch (error) {
      return respondError(res, error);
    }
  });

  app.get("/api/v1/admin/users/:userId", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const user = store.getUser(req.params.userId);
    if (!user) return res.status(404).json({ error: "User not found." });
    return res.json({ user, audit_entries: store.auditEntries(req.params.userId) });
  });

  app.patch("/api/v1/admin/users/:userId", (req, res) => {
    if (!requireAdmin(req, res)) return;
    return res.status(501).json({ error: "Profile editing is intentionally deferred; use disable, enable, reset-password, or revoke-sessions actions." });
  });

  app.post("/api/v1/admin/users/:userId/disable", (req, res) => {
    const actor = requireAdmin(req, res);
    if (!actor) return;
    try { return res.json({ user: store.disableUser(req.params.userId, actor.username) }); } catch (error) { return respondError(res, error); }
  });
  app.post("/api/v1/admin/users/:userId/enable", (req, res) => {
    const actor = requireAdmin(req, res);
    if (!actor) return;
    try { return res.json({ user: store.enableUser(req.params.userId, actor.username) }); } catch (error) { return respondError(res, error); }
  });
  app.post("/api/v1/admin/users/:userId/reset-password", (req, res) => {
    const actor = requireAdmin(req, res);
    if (!actor) return;
    try { return res.json(store.resetPassword(req.params.userId, actor.username)); } catch (error) { return respondError(res, error); }
  });
  app.post("/api/v1/admin/users/:userId/revoke-sessions", (req, res) => {
    const actor = requireAdmin(req, res);
    if (!actor) return;
    try { return res.json({ user: store.revokeSessions(req.params.userId, actor.username) }); } catch (error) { return respondError(res, error); }
  });
}

export function temporaryUserStore(): UserStore {
  return new UserStore({ filePath: path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gpu-validator-users-")), "store.json") });
}
