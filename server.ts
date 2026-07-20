import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import {
  buildAuthConfig,
  createSessionId,
  signSessionId,
  timingSafeVerifyPassword,
  verifySignedSessionId,
} from "./src/server/auth";
import { EngagementStore, registerEngagementRoutes } from "./src/server/engagements";
import { registerEvidenceRoutes } from "./src/server/evidence";
import { registerIntelligenceRoutes } from "./src/server/intelligence";
import { registerBenchmarkRoutes } from "./src/server/benchmarks";
import { registerExecutionRoutes } from "./src/server/execution";
import { registerUserRoutes, UserStore, type PublicUser } from "./src/server/users";

const repoRoot = process.cwd();
const artifactsDir = path.join(repoRoot, "artifacts");
const sampleDataDir = path.join(repoRoot, "sample-data");
const sessionCookieName = "ai_factory_session";

type SessionRecord = {
  email: string | null;
  username: string;
  role: "administrator" | "reviewer" | "temporary_reviewer";
  displayName: string;
  userId: string;
  sessionVersion: number;
  createdAt: number;
  lastSeenAt: number;
};

const sessions = new Map<string, SessionRecord>();
const loginAttempts = new Map<string, { count: number; lockedUntil: number; windowStartedAt: number }>();

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").map((cookie) => {
      const [name, ...valueParts] = cookie.trim().split("=");
      return [decodeURIComponent(name), decodeURIComponent(valueParts.join("="))];
    }).filter(([name]) => Boolean(name)),
  );
}

function buildCookie(name: string, value: string, options: { maxAge?: number; secure: boolean }): string {
  const parts = [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

function wantsHtml(req: express.Request): boolean {
  return req.method === "GET" && (req.accepts(["html", "json"]) === "html" || !req.path.startsWith("/api/"));
}

function isPublicRoute(pathname: string): boolean {
  return ["/login", "/robots.txt", "/sitemap.xml", "/favicon.ico"].includes(pathname)
    || pathname.startsWith("/assets/");
}

function isUploadTokenRoute(pathname: string): boolean {
  return pathname === "/api/v1/evidence/uploads" || pathname === "/api/v1/benchmarks/upload";
}

function isRunnerRoute(pathname: string): boolean {
  return pathname.startsWith("/api/v1/runners/");
}

function firstExistingPath(candidates: string[]): string | null {
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function getScenarioResultsPath(scenario?: string): string | null {
  if (scenario === "healthy" || scenario === "degraded") {
    return firstExistingPath([
      path.join(artifactsDir, `${scenario}-results.json`),
      path.join(sampleDataDir, `${scenario}-cluster.json`),
    ]);
  }

  return firstExistingPath([
    path.join(artifactsDir, "latest-results.json"),
    path.join(sampleDataDir, "healthy-cluster.json"),
  ]);
}

function readJsonMetadata(filePath: string | null): Record<string, any> | null {
  if (!filePath) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return parsed?.metadata && typeof parsed.metadata === "object" ? parsed.metadata : null;
  } catch {
    return null;
  }
}

function isValidLiveResults(filePath: string | null, imported: boolean): boolean {
  const metadata = readJsonMetadata(filePath);
  if (!metadata || metadata.simulated !== false) return false;
  if (imported) return metadata.imported === true || metadata.validation_source === "Imported Live Evidence";
  return metadata.validation_source !== "Imported Live Evidence";
}

function getLatestLiveResultsPath(): string | null {
  const candidates = [
    path.join(artifactsDir, "live", "latest-results.json"),
    path.join(artifactsDir, "latest-live-results.json"),
    path.join(artifactsDir, "latest-results.json"),
  ];
  return candidates.find((candidate) => isValidLiveResults(candidate, false)) ?? null;
}

function getImportedLiveResultsPath(): string | null {
  const root = path.join(artifactsDir, "imported-live");
  if (!fs.existsSync(root)) return null;
  const candidates = fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name, "latest-results.json"))
    .filter((candidate) => isValidLiveResults(candidate, true));
  return candidates.sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)[0] ?? null;
}

function getResultsPathForRequest(query: express.Request["query"]): string | null {
  const source = String(query.source ?? "");
  if (source === "latest-live") return getLatestLiveResultsPath();
  if (source === "imported-live") return getImportedLiveResultsPath();
  return getScenarioResultsPath(query.scenario as string | undefined);
}

function getReportArtifactPath(scenario: string, format: string): { filePath: string | null; contentType: string } {
  const safeScenario = ["healthy", "degraded", "latest"].includes(scenario) ? scenario : "latest";
  const formatMap: Record<string, { suffix: string; contentType: string }> = {
    json: { suffix: "results.json", contentType: "application/json; charset=utf-8" },
    html: { suffix: "report.html", contentType: "text/html; charset=utf-8" },
    markdown: { suffix: "report.md", contentType: "text/markdown; charset=utf-8" },
  };

  const artifact = formatMap[format];
  if (!artifact) {
    return { filePath: null, contentType: "text/plain; charset=utf-8" };
  }

  return {
    filePath: firstExistingPath([path.join(artifactsDir, `${safeScenario}-${artifact.suffix}`)]),
    contentType: artifact.contentType,
  };
}

export async function createPortalServerApp(options: { mountFrontend?: boolean } = {}) {
  const app = express();
  const authConfig = buildAuthConfig(process.env);
  const mountFrontend = options.mountFrontend ?? true;
  const engagementStore = new EngagementStore();
  const userStore = new UserStore();

  app.use(express.json());

  app.get("/healthz", (req, res) => {
    return res.json({ ok: true, service: "ai-factory-validator" });
  });

  app.get("/api/auth/config", (req, res) => {
    return res.json({ authRequired: authConfig.required });
  });

  const getSession = (req: express.Request): SessionRecord | null => {
    if (!authConfig.required) {
      return { email: null, username: "local-development", role: "administrator", displayName: "Local Development", userId: "local-development", sessionVersion: 1, createdAt: Date.now(), lastSeenAt: Date.now() };
    }
    if (!authConfig.sessionSecret) return null;

    if (authConfig.testBypassToken && req.get("x-ai-factory-test-auth") === authConfig.testBypassToken) {
      return { email: null, username: "deployment-test-admin", role: "administrator", displayName: "Deployment Test Admin", userId: "deployment-test-admin", sessionVersion: 1, createdAt: Date.now(), lastSeenAt: Date.now() };
    }

    const cookies = parseCookies(req.headers.cookie);
    const sessionId = verifySignedSessionId(cookies[sessionCookieName], authConfig.sessionSecret);
    if (!sessionId) return null;

    const session = sessions.get(sessionId);
    if (!session) return null;

    const now = Date.now();
    if (now - session.lastSeenAt > authConfig.sessionTtlSeconds * 1000) {
      sessions.delete(sessionId);
      return null;
    }

    if (userStore.hasUsers()) {
      const user = userStore.getUser(session.userId);
      if (!user || user.status !== "active" || user.session_version !== session.sessionVersion) {
        sessions.delete(sessionId);
        return null;
      }
    }

    session.lastSeenAt = now;
    sessions.set(sessionId, session);
    return session;
  };

  const attachSessionUser = (req: express.Request, session: SessionRecord) => {
    (req as any).authUser = {
      id: session.userId,
      username: session.username,
      display_name: session.displayName,
      email: session.email,
      role: session.role,
      status: "active",
      session_version: session.sessionVersion,
    } satisfies Partial<PublicUser>;
  };

  app.get("/api/auth/session", (req, res) => {
    const session = getSession(req);
    if (!session) {
      return res.status(401).json({ error: "Authentication required", reason: "expired-session" });
    }
    return res.json({ authenticated: true, user: { id: session.userId, username: session.username, display_name: session.displayName, email: session.email, role: session.role } });
  });

  app.post("/api/auth/login", (req, res) => {
    if (!authConfig.required) {
      return res.json({ authenticated: true, localDevelopment: true });
    }

    const username = String(req.body?.username ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    const attemptKey = `${req.ip}:${username}`;
    const now = Date.now();
    const attempt = loginAttempts.get(attemptKey) ?? { count: 0, lockedUntil: 0, windowStartedAt: now };

    if (attempt.lockedUntil > now) {
      return res.status(423).json({ error: "Account temporarily locked", reason: "account-locked" });
    }

    if (now - attempt.windowStartedAt > 15 * 60 * 1000) {
      attempt.count = 0;
      attempt.windowStartedAt = now;
      attempt.lockedUntil = 0;
    }

    if (userStore.hasUsers()) {
      const auth = userStore.authenticate(username, password);
      if (!auth.ok) {
        attempt.count += 1;
        if (attempt.count >= 5) attempt.lockedUntil = now + 15 * 60 * 1000;
        loginAttempts.set(attemptKey, attempt);
        const failedReason = (auth as { ok: false; reason: "invalid" | "disabled" | "expired" | "locked" }).reason;
        const reason = failedReason === "locked" ? "account-locked" : failedReason === "disabled" ? "account-disabled" : failedReason === "expired" ? "account-expired" : "invalid-credentials";
        return res.status(reason === "account-locked" ? 423 : 401).json({ error: "Invalid username or password", reason });
      }

      loginAttempts.delete(attemptKey);
      const sessionId = createSessionId();
      sessions.set(sessionId, { email: auth.user.email, username: auth.user.username, role: auth.user.role, displayName: auth.user.display_name, userId: auth.user.id, sessionVersion: auth.session_version, createdAt: now, lastSeenAt: now });
      res.setHeader("Set-Cookie", buildCookie(sessionCookieName, signSessionId(sessionId, authConfig.sessionSecret), {
        maxAge: authConfig.sessionTtlSeconds,
        secure: authConfig.cookieSecure,
      }));
      return res.json({ authenticated: true, user: { id: auth.user.id, username: auth.user.username, display_name: auth.user.display_name, email: auth.user.email, role: auth.user.role } });
    }

    const validUsername = username === authConfig.reviewerUsername;
    const validPassword = Boolean(authConfig.passwordHash && timingSafeVerifyPassword(password, authConfig.passwordHash));

    if (!validUsername || !validPassword || !authConfig.sessionSecret) {
      attempt.count += 1;
      if (attempt.count >= 5) {
        attempt.lockedUntil = now + 15 * 60 * 1000;
      }
      loginAttempts.set(attemptKey, attempt);
      return res.status(401).json({ error: "Invalid username or password", reason: "invalid-credentials" });
    }

    loginAttempts.delete(attemptKey);
    const sessionId = createSessionId();
    sessions.set(sessionId, { email: null, username, role: "reviewer", displayName: "Reviewer", userId: "env-reviewer", sessionVersion: 1, createdAt: now, lastSeenAt: now });
    res.setHeader("Set-Cookie", buildCookie(sessionCookieName, signSessionId(sessionId, authConfig.sessionSecret), {
      maxAge: authConfig.sessionTtlSeconds,
      secure: authConfig.cookieSecure,
    }));
    return res.json({ authenticated: true, user: { id: "env-reviewer", username, display_name: "Reviewer", email: null, role: "reviewer" } });
  });

  app.post("/api/auth/logout", (req, res) => {
    if (authConfig.sessionSecret) {
      const cookies = parseCookies(req.headers.cookie);
      const sessionId = verifySignedSessionId(cookies[sessionCookieName], authConfig.sessionSecret);
      if (sessionId) sessions.delete(sessionId);
    }
    res.setHeader("Set-Cookie", buildCookie(sessionCookieName, "", { maxAge: 0, secure: authConfig.cookieSecure }));
    return res.json({ authenticated: false });
  });

  app.use((req, res, next) => {
    if (!authConfig.required) return next();

    const session = getSession(req);
    if (session) {
      if (wantsHtml(req) && (req.path === "/" || req.path === "/login")) {
        return res.redirect(302, "/portal");
      }
      attachSessionUser(req, session);
      return next();
    }

    if (req.path === "/login" || isPublicRoute(req.path)) return next();
    if (isUploadTokenRoute(req.path)) return next();
    if (isRunnerRoute(req.path)) return next();

    if (req.path.startsWith("/api/") || req.path.startsWith("/reports/")) {
      return res.status(401).json({ error: "Authentication required", reason: "expired-session" });
    }

    if (wantsHtml(req)) {
      return res.redirect(302, "/login");
    }

    return res.status(401).json({ error: "Authentication required", reason: "expired-session" });
  });

  registerEngagementRoutes(app, engagementStore);
  registerUserRoutes(app, userStore);
  registerEvidenceRoutes(app, engagementStore);
  registerBenchmarkRoutes(app, engagementStore);
  registerExecutionRoutes(app, engagementStore);
  registerIntelligenceRoutes(app, engagementStore);

  // 1. API: Get validation results by scenario or live source
  app.get("/api/results", (req, res) => {
    const filePath = getResultsPathForRequest(req.query);

    if (!filePath) {
      return res.status(404).json({ error: "Validation results not found. Please trigger a scan." });
    }

    try {
      const fileData = fs.readFileSync(filePath, "utf-8");
      return res.json(JSON.parse(fileData));
    } catch (err: any) {
      return res.status(500).json({ error: `Failed to load results: ${err.message}` });
    }
  });

  app.get("/api/evidence-sources", (req, res) => {
    const latestLivePath = getLatestLiveResultsPath();
    const importedLivePath = getImportedLiveResultsPath();
    return res.json({
      sources: [
        {
          id: "simulated-healthy",
          label: "Simulated Healthy",
          kind: "simulated",
          endpoint: "/api/results?scenario=healthy",
          available: true,
          description: "Deterministic healthy demonstration scenario.",
        },
        {
          id: "simulated-degraded",
          label: "Simulated Degraded",
          kind: "simulated",
          endpoint: "/api/results?scenario=degraded",
          available: true,
          description: "Deterministic degraded demonstration scenario.",
        },
        ...(latestLivePath ? [{
          id: "latest-live",
          label: "Latest Live Evidence",
          kind: "latest-live",
          endpoint: "/api/results?source=latest-live",
          available: true,
          description: "Latest valid live validation artifact from this deployment.",
        }] : []),
        ...(importedLivePath ? [{
          id: "imported-live",
          label: "Imported Live Evidence",
          kind: "imported-live",
          endpoint: "/api/results?source=imported-live",
          available: true,
          description: "Most recent sanitized imported live evidence bundle.",
        }] : []),
      ],
    });
  });

  app.get("/reports/:scenario/:format", (req, res) => {
    const scenario = req.params.scenario;
    const format = req.params.format;
    const { filePath, contentType } = getReportArtifactPath(scenario, format);

    if (!filePath) {
      return res.status(404).json({ error: "Requested report artifact was not found." });
    }

    return res.type(contentType).sendFile(filePath);
  });

  // 1b. API: Get historical health scores for a specific node
  app.get("/api/node-history/:nodeName", (req, res) => {
    const nodeName = req.params.nodeName.toLowerCase();
    const scenario = req.query.scenario as string || "degraded";

    // Define deterministic historical score patterns for consistent presentation
    let scores = [95, 95, 95, 95, 95];

    if (scenario === "healthy") {
      switch (nodeName) {
        case "dgx01":
          scores = [92, 94, 93, 96, 98];
          break;
        case "dgx02":
          scores = [91, 93, 95, 94, 97];
          break;
        case "dgx03":
          scores = [93, 95, 96, 97, 99];
          break;
        case "dgx04":
          scores = [90, 92, 94, 95, 96];
          break;
        default:
          // Deterministic generation for other node names
          const hash = nodeName.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
          scores = [88 + (hash % 5), 90 + (hash % 6), 92 + (hash % 4), 94 + (hash % 5), 96 + (hash % 3)];
          break;
      }
    } else {
      // Degraded scenario
      switch (nodeName) {
        case "dgx01":
          scores = [94, 92, 88, 85, 78];
          break;
        case "dgx02":
          scores = [95, 96, 95, 94, 95];
          break;
        case "dgx03":
          scores = [92, 85, 84, 82, 80];
          break;
        case "dgx04":
          scores = [88, 80, 72, 65, 52];
          break;
        default:
          // Deterministic generation for other node names with slight variance/degradation
          const hash = nodeName.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
          scores = [90 + (hash % 5), 85 + (hash % 7), 80 + (hash % 4), 74 + (hash % 6), 68 + (hash % 5)];
          break;
      }
    }

    // Build the 5 historical records
    const timestamps = [
      "12h Ago",
      "9h Ago",
      "6h Ago",
      "3h Ago",
      "Active"
    ];

    const history = scores.map((score, index) => ({
      run: `Run ${index + 1}`,
      score: score,
      timestamp: timestamps[index]
    }));

    return res.json({
      node: req.params.nodeName,
      scenario: scenario,
      history: history
    });
  });

  // 2. API: Explicitly reject reviewer-side execution; imports/runs are admin CLI workflows.
  app.post("/api/run-scenario", (req, res) => {
    return res.status(405).json({
      error: "Reviewer portal is read-only. Generate or import evidence with administrator-side CLI tools.",
    });
  });

  // 3. Mount Vite middleware for SPA and dev mode assets
  if (!mountFrontend) {
    return app;
  }

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  return app;
}

async function startServer() {
  const app = await createPortalServerApp();
  const PORT = Number.parseInt(process.env.PORT ?? "3000", 10);
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Full-stack diagnostic portal listening at http://0.0.0.0:${PORT}`);
  });
}

const entryPoint = process.argv[1] ? ["server.ts", "server.cjs"].includes(path.basename(process.argv[1])) : false;
if (entryPoint) {
  startServer().catch((err) => {
    console.error("Failed to boot full-stack portal:", err);
  });
}
