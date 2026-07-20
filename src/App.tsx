import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ChevronRight,
  Cpu,
  ExternalLink,
  FileJson,
  FileText,
  Gauge,
  Layers,
  Lock,
  LogOut,
  Network,
  Plus,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Waypoints,
  Eye,
  EyeOff,
  User,
} from "lucide-react";
import {
  type CheckStatus,
  type Cluster,
  type Node,
  type ValidationCheck,
  type EvidenceSourceOption,
  buildArtifactLinks,
  buildSourceContext,
  buildBenchmarkCatalog,
  deriveAcceptanceGate,
  deriveDashboardOverview,
  deriveFabricHealth,
  deriveGpuHealth,
  deriveSchedulerSnapshot,
  deriveValidationProfile,
  formatStatusLabel,
  getAllChecks,
  getCategoryStatus,
  getStatusTone,
  isSimulatedScenario,
} from "./portal/assessment";
import {
  acceptanceTone,
  engagementStatusOptions,
  engagementStatusTone,
  filterEngagements,
  formatEngagementLabel,
  platformProfileOptions,
  type ActivityEntry,
  type BenchmarkRunSummary,
  type ClusterComparison,
  type Engagement,
  type EngagementNode,
  type EngagementReadiness,
  type EvidenceRecordSummary,
  type Finding,
  type ProvenanceReference,
  type UploadTokenSummary,
} from "./portal/engagements";
import { libraryPages, libraryRoutes, searchLibrary, type LibraryPage } from "./portal/operations-library";

void libraryRoutes;
const operationsLibraryRouteLiterals = "/portal/library /portal/library/slurm /portal/library/lustre /portal/library/base-command-manager /portal/library/benchmarks";
void operationsLibraryRouteLiterals;

const scenarioMetadata = {
  healthy: {
    label: "Healthy scenario",
    shortLabel: "Healthy",
    description: "Simulated acceptance pass with all validation layers healthy.",
  },
  degraded: {
    label: "Degraded scenario",
    shortLabel: "Degraded",
    description: "Simulated acceptance block with InfiniBand degradation and a critical GPU ECC fault.",
  },
} as const;

const scopeBadges = ["Linux", "GPU Compute", "InfiniBand", "Slurm", "Kubernetes", "Storage"];

const fallbackSources: EvidenceSourceOption[] = [
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
];

const statusPillClasses: Record<"healthy" | "warning" | "critical", string> = {
  healthy: "bg-emerald-500/12 text-emerald-300 border border-emerald-500/25",
  warning: "bg-amber-500/12 text-amber-300 border border-amber-500/25",
  critical: "bg-red-500/12 text-red-300 border border-red-500/25",
};

const statusIconClasses: Record<CheckStatus, string> = {
  pass: "text-emerald-400",
  warning: "text-amber-400",
  fail: "text-red-400",
  unknown: "text-slate-400",
  unavailable: "text-slate-400",
};

function pillClassesForStatus(status: string) {
  const tone = getStatusTone(status);
  return statusPillClasses[tone as keyof typeof statusPillClasses] ?? statusPillClasses.healthy;
}

function nodeCardClasses(status: CheckStatus, selected: boolean) {
  const base = "cyber-panel cyber-panel-hover rounded-2xl border p-4 transition-all duration-200";
  const state =
    status === "fail"
      ? "border-red-500/30"
      : status === "warning"
        ? "border-amber-500/30"
        : "border-slate-800/70";
  const selectedState =
    selected
      ? status === "fail"
        ? " ring-2 ring-red-500/30 bg-red-500/5"
        : status === "warning"
          ? " ring-2 ring-amber-500/30 bg-amber-500/5"
          : " ring-2 ring-emerald-500/20 bg-emerald-500/5"
      : " bg-slate-950/20";
  return `${base} ${state}${selectedState}`;
}

function summaryLine(check: ValidationCheck | undefined, fallback: string) {
  return check?.summary ?? fallback;
}

function countChecks(cluster: Cluster | null, predicate: (check: ValidationCheck) => boolean) {
  return getAllChecks(cluster).filter(predicate).length;
}

function LoginPage() {
  const queryReason = new URLSearchParams(window.location.search).get("reason");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(
    queryReason === "expired-session" ? "Your session expired. Sign in again to continue." : null,
  );
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session")
      .then((response) => {
        if (!cancelled && response.ok) window.location.assign("/portal");
      })
      .catch(() => null);
    return () => { cancelled = true; };
  }, []);

  const submitLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setLocked(false);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        window.location.assign("/portal");
        return;
      }

      const payload = await response.json().catch(() => ({ reason: "invalid-credentials" }));
      if (payload.reason === "account-locked") {
        setLocked(true);
        setMessage("This reviewer entry is temporarily locked. Wait before trying again.");
      } else {
        setMessage("Invalid username or password.");
      }
    } catch {
      setMessage("Authentication service is unavailable. Try again after the portal is healthy.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-shell relative min-h-screen overflow-hidden bg-[#030610] text-slate-100 selection:bg-emerald-500/25 selection:text-emerald-200">
      <div className="absolute inset-0" aria-hidden="true">
        <div className="login-grid absolute inset-0" />
        <div className="login-starfield absolute inset-0" />
        <div className="login-scan absolute inset-0" />
        <div className="absolute left-[-10rem] top-[-12rem] h-[34rem] w-[34rem] rounded-full bg-emerald-500/12 blur-3xl" />
        <div className="absolute right-[-12rem] top-[12%] h-[32rem] w-[32rem] rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-[-14rem] left-[35%] h-[30rem] w-[30rem] rounded-full bg-emerald-500/8 blur-3xl" />
        <div className="signal-path signal-path-a" />
        <div className="signal-path signal-path-b" />
        <div className="signal-path signal-path-c" />
      </div>

      <section className="relative z-10 mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-6 py-10 lg:grid-cols-[1.08fr_0.92fr] lg:py-16">
        <div className="login-hero-enter space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.22em] text-emerald-200 shadow-[0_0_32px_rgba(118,185,0,0.08)] backdrop-blur">
            <span className="login-live-dot h-2 w-2 rounded-full bg-emerald-400" />
            Invite-only reviewer access
          </div>

          <div className="space-y-5">
            <div className="text-[11px] font-mono uppercase tracking-[0.24em] text-cyan-200/80">AI Factory Readiness Portal</div>
            <h1 className="font-display text-4xl font-bold tracking-tight text-slate-50 md:text-6xl">
              GPU Validator
            </h1>
            <p className="max-w-3xl font-display text-3xl font-semibold leading-tight text-white md:text-5xl">
              GPU Infrastructure Readiness, Validated
            </p>
            <p className="max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
              Secure access to GPU cluster validation, benchmark intelligence, evidence review, and customer acceptance workflows. Private access to GPU infrastructure readiness for enterprise demonstrations and technical interviews.
            </p>
          </div>

          <div className="login-topology relative max-w-2xl overflow-hidden rounded-[2rem] border border-slate-800/80 bg-slate-950/45 p-5 shadow-2xl backdrop-blur" aria-hidden="true">
            <div className="mb-4 flex items-center justify-between gap-4 text-[11px] font-mono uppercase tracking-[0.2em] text-slate-400">
              <span>Cluster fabric</span>
              <span className="text-emerald-300">Validation flow</span>
            </div>
            <svg viewBox="0 0 620 250" className="h-56 w-full" aria-hidden="true" focusable="false">
              <defs>
                <linearGradient id="fabricLine" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="rgba(34,211,238,0.1)" />
                  <stop offset="50%" stopColor="rgba(118,185,0,0.65)" />
                  <stop offset="100%" stopColor="rgba(34,211,238,0.28)" />
                </linearGradient>
              </defs>
              <path className="fabric-line fabric-line-a" d="M92 70 C190 34 278 46 348 94 S500 168 548 86" />
              <path className="fabric-line fabric-line-b" d="M78 178 C170 104 270 124 346 154 S474 202 556 154" />
              <path className="fabric-line fabric-line-c" d="M142 120 H252 C298 120 322 82 370 82 H506" />
              {[
                [92, 70, "GPU-0"],
                [142, 178, "GPU-1"],
                [278, 112, "IB"],
                [370, 82, "GPU-2"],
                [506, 82, "GPU-3"],
                [548, 154, "Gate"],
              ].map(([cx, cy, label]) => (
                <g key={label as string}>
                  <circle className="fabric-node-ring" cx={cx as number} cy={cy as number} r="24" />
                  <circle className="fabric-node" cx={cx as number} cy={cy as number} r="12" />
                  <text x={cx as number} y={(cy as number) + 44} textAnchor="middle" className="fabric-label">{label}</text>
                </g>
              ))}
              <circle className="fabric-pulse fabric-pulse-a" cx="92" cy="70" r="5" />
              <circle className="fabric-pulse fabric-pulse-b" cx="278" cy="112" r="5" />
              <circle className="fabric-pulse fabric-pulse-c" cx="548" cy="154" r="5" />
            </svg>
          </div>

          <div className="login-tag-grid grid max-w-2xl grid-cols-2 gap-2 sm:grid-cols-4">
            {["GPU Compute", "InfiniBand / RDMA", "NCCL", "Slurm", "Kubernetes", "Storage", "Customer Acceptance", "Evidence Review"].map((item) => (
              <span key={item} className="login-capability-tag rounded-2xl border border-slate-800 bg-slate-950/55 px-3 py-2 text-xs text-slate-300 backdrop-blur">
                {item}
              </span>
            ))}
          </div>

          <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
            {["Session-based access", "No public registration", "Reviewer workflow"].map((item) => (
              <div key={item} className="rounded-2xl border border-emerald-500/15 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-100/90 backdrop-blur">
                <ShieldCheck className="mb-2 h-4 w-4 text-emerald-300" />
                {item}
              </div>
            ))}
          </div>

          <div className="max-w-2xl rounded-3xl border border-slate-800/80 bg-slate-950/55 p-5 text-sm leading-7 text-slate-400 shadow-xl backdrop-blur">
            <p className="font-medium text-slate-200">Built by Sabion P. Frazier</p>
            <p className="mt-2">
              This project is an independent portfolio project and is not affiliated with, sponsored by, or endorsed by NVIDIA.
            </p>
          </div>
        </div>

        <div className="login-card-enter">
          <div className="login-auth-card cyber-panel relative overflow-hidden rounded-[2rem] border border-slate-700/80 bg-slate-950/80 p-6 shadow-2xl md:p-8">
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/70 to-transparent" aria-hidden="true" />
            <div className="mb-7 flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/8 px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.2em] text-cyan-100">
                  <span className="login-security-pulse h-2 w-2 rounded-full bg-cyan-300" />
                  Secure access
                </div>
                <h2 className="mt-5 text-2xl font-display font-semibold text-slate-50">Reviewer sign in</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">Authenticate with your issued username and password to enter the validation portal.</p>
              </div>
              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3 shadow-[0_0_24px_rgba(118,185,0,0.12)]">
                <Lock className="h-5 w-5 text-emerald-300" />
              </div>
            </div>

            <form onSubmit={submitLogin} className="space-y-5">
              <div>
                <label htmlFor="reviewer-username" className="mb-2 block text-sm font-medium text-slate-100">Username</label>
                <div className="login-input-wrap relative">
                  <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="reviewer-username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    spellCheck={false}
                    autoCapitalize="none"
                    placeholder="reviewer"
                    required
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="login-input w-full rounded-2xl border border-slate-700/90 bg-slate-950/85 py-3.5 pl-11 pr-3 text-slate-50 outline-none transition placeholder:text-slate-600 focus:border-emerald-400/80 focus:ring-4 focus:ring-emerald-500/15"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reviewer-password" className="mb-2 block text-sm font-medium text-slate-100">Password</label>
                <div className="login-input-wrap relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="reviewer-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="login-input w-full rounded-2xl border border-slate-700/90 bg-slate-950/85 py-3.5 pl-11 pr-12 text-slate-50 outline-none transition placeholder:text-slate-600 focus:border-emerald-400/80 focus:ring-4 focus:ring-emerald-500/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-xl border border-transparent p-2 text-slate-400 transition hover:border-cyan-400/25 hover:bg-cyan-400/10 hover:text-cyan-100 active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-4 text-xs leading-6 text-slate-300">
                Invitation required. Access is private, session-based, and does not store credentials in browser local storage.
              </div>

              {message && (
                <div role="alert" aria-live="polite" className={`login-alert rounded-2xl border p-4 text-sm ${locked ? "border-amber-500/35 bg-amber-500/12 text-amber-100" : "border-red-500/35 bg-red-500/12 text-red-100"}`}>
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="login-primary-button group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-emerald-500 px-4 py-3.5 font-semibold text-slate-950 shadow-[0_14px_36px_rgba(118,185,0,0.18)] transition hover:-translate-y-0.5 hover:bg-emerald-400 hover:shadow-[0_18px_44px_rgba(118,185,0,0.24)] active:translate-y-0 active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-emerald-500/30 disabled:cursor-not-allowed disabled:bg-emerald-700 disabled:text-slate-900 disabled:shadow-none"
              >
                <span className="login-button-sweep absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
                {loading && <RefreshCw className="relative z-10 h-4 w-4 animate-spin" />}
                <span className="relative z-10">{loading ? "Checking reviewer access" : "Sign In"}</span>
              </button>
            </form>

            <p className="mt-6 text-xs leading-6 text-slate-400">
              Privacy-oriented demo portal: no analytics, no public registration, no social login, and no vendor endorsement claim.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

const toneClasses: Record<"healthy" | "warning" | "critical" | "neutral", string> = {
  healthy: "border-emerald-500/25 bg-emerald-500/12 text-emerald-300",
  warning: "border-amber-500/25 bg-amber-500/12 text-amber-300",
  critical: "border-red-500/25 bg-red-500/12 text-red-300",
  neutral: "border-slate-700 bg-slate-900 text-slate-300",
};

type ShellNavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  match?: (path: string) => boolean;
};

type ShellNavGroup = {
  title: string;
  items: ShellNavItem[];
};

function AppLogo() {
  return (
    <a href="/portal" className="flex items-center gap-3" aria-label="GPU Validator dashboard">
      <span className="gv-logo-mark" aria-hidden="true">
        <Activity className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block font-display text-[1.05rem] font-bold tracking-tight text-[var(--gv-text-primary)]">GPU<span className="text-[var(--gv-accent-hover)]">VALIDATOR</span></span>
        <span className="block truncate text-[10px] font-mono uppercase tracking-[0.22em] text-[var(--gv-text-faint)]">AI infrastructure ops</span>
      </span>
    </a>
  );
}

const shellNavGroups: ShellNavGroup[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/portal", icon: Activity, match: (path) => path === "/portal" },
    ],
  },
  {
    title: "Infrastructure",
    items: [
      { label: "Clusters", href: "/portal/engagements", icon: Server, match: (path) => path.startsWith("/portal/engagements") },
      { label: "GPUs", href: "/portal/engagements", icon: Cpu, match: () => false },
      { label: "Fabric", href: "/portal", icon: Network, match: () => false },
      { label: "Library", href: "/portal/library", icon: Layers, match: (path) => path.startsWith("/portal/library") },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Validation", href: "/portal", icon: ShieldCheck, match: () => false },
      { label: "Benchmarks", href: "/portal", icon: Gauge, match: () => false },
      { label: "Monitoring", href: "/portal/admin/system", icon: Waypoints, match: (path) => path === "/portal/admin/system" },
      { label: "Alerts", href: "/portal", icon: AlertTriangle, match: () => false },
    ],
  },
  {
    title: "Insights",
    items: [
      { label: "Reports", href: "/portal", icon: FileText, match: () => false },
      { label: "Runbooks", href: "/portal/library", icon: FileJson, match: () => false },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Users", href: "/portal/admin/users", icon: User, match: (path) => path.startsWith("/portal/admin/users") },
      { label: "Interview Demo", href: "/portal/admin/demo", icon: Sparkles, match: (path) => path === "/portal/admin/demo" },
      { label: "System Health", href: "/portal/admin/system", icon: ShieldAlert, match: (path) => path === "/portal/admin/system" },
    ],
  },
];

function EngagementShell({ children }: { children: React.ReactNode }) {
  const pathName = window.location.pathname;
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    window.location.assign("/login");
  };

  return (
    <div className="gv-app-shell min-h-screen text-[var(--gv-text-secondary)] font-sans antialiased selection:bg-emerald-500/25 selection:text-emerald-200">
      <aside className="gv-sidebar" aria-label="Primary navigation">
        <div className="gv-sidebar-brand">
          <AppLogo />
        </div>
        <nav className="gv-sidebar-nav">
          {shellNavGroups.map((group) => (
            <section key={group.title} className="gv-nav-section" aria-labelledby={`nav-${group.title.toLowerCase().replace(/\s+/g, "-")}`}>
              <h2 id={`nav-${group.title.toLowerCase().replace(/\s+/g, "-")}`} className="gv-nav-section-title">{group.title}</h2>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = item.match?.(pathName) ?? pathName === item.href;
                  const Icon = item.icon;
                  return (
                    <a key={`${group.title}-${item.label}`} href={item.href} aria-current={active ? "page" : undefined} className={`gv-nav-item ${active ? "gv-nav-item-active" : ""}`}>
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                      {item.label === "Alerts" && <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">6</span>}
                    </a>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>
        <div className="gv-sidebar-status">
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--gv-text-faint)]">Platform Status</div>
          {["API", "Storage", "Agents"].map((item) => (
            <div key={item} className="mt-3 flex items-center justify-between gap-3 text-xs">
              <span className="text-[var(--gv-text-muted)]">{item}</span>
              <span className="text-[var(--gv-accent-hover)]">Operational</span>
            </div>
          ))}
          <a href="/portal/admin/system" className="mt-4 inline-flex w-full justify-center rounded-xl border border-[var(--gv-border-highlight)] px-3 py-2 text-xs font-semibold text-[var(--gv-accent-hover)] hover:bg-[var(--gv-accent-muted)]">System status</a>
        </div>
      </aside>

      <div className="gv-shell-main">
        <header className="gv-topbar">
          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden lg:block">
              <label htmlFor="global-cluster" className="mb-1 block text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--gv-text-faint)]">Global Cluster</label>
              <select id="global-cluster" className="gv-select h-9 min-w-[190px] text-xs" defaultValue="all">
                <option value="all">All validation scopes</option>
                <option value="demo">Simulated demo data</option>
              </select>
            </div>
          </div>
          <label className="gv-global-search hidden md:flex">
            <Search className="h-4 w-4 text-[var(--gv-text-muted)]" />
            <span className="sr-only">Global search</span>
            <input aria-label="Global search" placeholder="Search systems, GPUs, benchmarks..." className="min-w-0 flex-1 bg-transparent text-sm text-[var(--gv-text-secondary)] outline-none placeholder:text-[var(--gv-text-faint)]" />
            <span className="rounded-md border border-[var(--gv-border-default)] px-1.5 py-0.5 text-[10px] text-[var(--gv-text-faint)]">⌘K</span>
          </label>
          <div className="ml-auto flex items-center gap-2">
            <a href="/portal/admin/system" className="gv-topbar-icon" aria-label="View notifications and system health"><AlertTriangle className="h-4 w-4" /><span className="gv-notification-dot">6</span></a>
            <a href="/portal/admin/system" className="gv-topbar-icon" aria-label="Security and platform health"><ShieldCheck className="h-4 w-4" /></a>
            <a href="/portal/admin/users" className="hidden items-center gap-2 rounded-full border border-[var(--gv-border-default)] bg-[var(--gv-bg-card)] px-2 py-1.5 sm:flex">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-white">GV</span>
              <span className="hidden text-left text-xs leading-tight lg:block"><span className="block text-[var(--gv-text-primary)]">Reviewer</span><span className="block text-[var(--gv-text-faint)]">Session</span></span>
            </a>
            <button onClick={logout} className="gv-button-secondary py-2 text-xs"><LogOut className="h-3.5 w-3.5" /> Logout</button>
          </div>
        </header>
        <main className="gv-content">{children}</main>
      </div>
    </div>
  );
}

function EngagementStatusPill({ value, kind = "status" }: { value: string; kind?: "status" | "acceptance" }) {
  const tone = kind === "acceptance" ? acceptanceTone(value) : engagementStatusTone(value);
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider ${toneClasses[tone]}`}>{formatEngagementLabel(value)}</span>;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function EngagementListPage() {
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/engagements");
      if (!response.ok) throw new Error("Failed to load engagements.");
      const payload = await response.json();
      setEngagements(Array.isArray(payload.engagements) ? payload.engagements : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load engagements.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  const filtered = useMemo(() => filterEngagements(engagements, query, status, platform), [engagements, query, status, platform]);

  const loadDemoFixture = async () => {
    const response = await fetch("/api/v1/engagement-fixtures/nvis-interview-demo", { method: "POST" });
    if (response.ok) await load();
  };

  return (
    <EngagementShell>
      <section className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-[0.24em] text-emerald-300">Customer validation</div>
          <h1 className="mt-3 font-display text-4xl font-semibold text-slate-50">Validation engagements</h1>
          <p className="mt-3 max-w-3xl leading-7 text-slate-400">Multi-node customer acceptance projects. Evidence upload is intentionally not implemented in this milestone.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={loadDemoFixture} className="rounded-2xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 hover:border-emerald-500/40 hover:text-emerald-300">Load NVIS demo fixture</button>
          <a href="/portal/engagements/new" className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400"><Plus className="h-4 w-4" />Create engagement</a>
        </div>
      </section>

      <section className="cyber-panel mb-6 rounded-2xl border border-slate-800 p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_240px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input aria-label="Search engagements" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by customer, engagement, profile, or tag" className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 py-3 pl-10 pr-3 text-slate-100 outline-none focus:border-emerald-500/60" />
          </label>
          <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-slate-100 outline-none focus:border-emerald-500/60">
            <option value="all">All statuses</option>
            {engagementStatusOptions.map((item) => <option key={item} value={item}>{formatEngagementLabel(item)}</option>)}
          </select>
          <select aria-label="Filter by platform" value={platform} onChange={(e) => setPlatform(e.target.value)} className="rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-slate-100 outline-none focus:border-emerald-500/60">
            <option value="all">All platforms</option>
            {platformProfileOptions.map((item) => <option key={item} value={item}>{formatEngagementLabel(item)}</option>)}
          </select>
        </div>
      </section>

      {loading && <div className="cyber-panel rounded-2xl border border-slate-800 p-6 text-slate-300">Loading engagements...</div>}
      {error && <div role="alert" className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-100">{error}</div>}
      {!loading && !error && (
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/45">
          <div className="hidden grid-cols-[1.4fr_1fr_0.8fr_0.8fr_0.7fr_0.8fr_0.9fr_0.9fr] gap-4 border-b border-slate-800 px-5 py-3 text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500 lg:grid">
            <span>Name</span><span>Customer</span><span>Platform</span><span>Status</span><span>Nodes</span><span>Score</span><span>Acceptance</span><span>Updated</span>
          </div>
          {filtered.length === 0 ? (
            <div className="p-10 text-center text-slate-400">No engagements match the current filters.</div>
          ) : filtered.map((engagement) => (
            <a key={engagement.id} href={`/portal/engagements/${encodeURIComponent(engagement.id)}`} className="grid gap-4 border-b border-slate-900 px-5 py-5 transition hover:bg-slate-900/45 lg:grid-cols-[1.4fr_1fr_0.8fr_0.8fr_0.7fr_0.8fr_0.9fr_0.9fr] lg:items-center">
              <div><div className="font-semibold text-slate-50">{engagement.name}</div>{engagement.simulated && <div className="mt-2 inline-flex rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-amber-300">SIMULATED DEMO</div>}</div>
              <div className="text-slate-300">{engagement.customer_name}</div>
              <div className="text-sm text-slate-300">{formatEngagementLabel(engagement.platform_profile)}</div>
              <EngagementStatusPill value={engagement.status} />
              <div className="text-sm text-slate-300">{engagement.received_node_count}/{engagement.expected_node_count}</div>
              <div className="text-sm text-slate-300">{engagement.readiness_score === null ? "Not evaluated" : `${engagement.readiness_score}%`}</div>
              <EngagementStatusPill value={engagement.acceptance_status} kind="acceptance" />
              <div className="text-xs text-slate-400">{formatDate(engagement.updated_at)}</div>
            </a>
          ))}
        </section>
      )}
    </EngagementShell>
  );
}

function NewEngagementPage() {
  const [form, setForm] = useState({ name: "", customer_name: "", description: "", platform_profile: "hgx-h100", expected_node_count: "2", collection_deadline: "", tags: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const setField = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!form.name.trim()) return setError("Engagement name is required.");
    if (!form.customer_name.trim()) return setError("Customer name is required.");
    const expected = Number(form.expected_node_count);
    if (!Number.isInteger(expected) || expected < 1 || expected > 1024) return setError("Expected node count must be between 1 and 1024.");
    setSaving(true);
    try {
      const response = await fetch("/api/v1/engagements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, expected_node_count: expected, collection_deadline: form.collection_deadline || null, tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to create engagement.");
      window.location.assign(`/portal/engagements/${encodeURIComponent(payload.engagement.id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create engagement.");
      setSaving(false);
    }
  };

  return (
    <EngagementShell>
      <section className="mx-auto max-w-3xl">
        <div className="mb-8"><div className="text-[11px] font-mono uppercase tracking-[0.24em] text-emerald-300">New validation engagement</div><h1 className="mt-3 font-display text-4xl font-semibold text-slate-50">Create engagement</h1></div>
        <form onSubmit={submit} className="cyber-panel space-y-5 rounded-3xl border border-slate-800 p-6">
          {error && <div role="alert" className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div>}
          <label className="block"><span className="mb-2 block text-sm text-slate-200">Engagement name</span><input required value={form.name} onChange={(e) => setField("name", e.target.value)} className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-slate-100 outline-none focus:border-emerald-500/60" /></label>
          <label className="block"><span className="mb-2 block text-sm text-slate-200">Customer name</span><input required value={form.customer_name} onChange={(e) => setField("customer_name", e.target.value)} className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-slate-100 outline-none focus:border-emerald-500/60" /></label>
          <label className="block"><span className="mb-2 block text-sm text-slate-200">Description</span><textarea value={form.description} onChange={(e) => setField("description", e.target.value)} rows={4} className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-slate-100 outline-none focus:border-emerald-500/60" /></label>
          <div className="grid gap-5 md:grid-cols-2">
            <label><span className="mb-2 block text-sm text-slate-200">Platform profile</span><select value={form.platform_profile} onChange={(e) => setField("platform_profile", e.target.value)} className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-slate-100 outline-none focus:border-emerald-500/60">{platformProfileOptions.map((profile) => <option key={profile} value={profile}>{formatEngagementLabel(profile)}</option>)}</select></label>
            <label><span className="mb-2 block text-sm text-slate-200">Expected node count</span><input type="number" min={1} max={1024} required value={form.expected_node_count} onChange={(e) => setField("expected_node_count", e.target.value)} className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-slate-100 outline-none focus:border-emerald-500/60" /></label>
          </div>
          <label className="block"><span className="mb-2 block text-sm text-slate-200">Collection deadline</span><input type="datetime-local" value={form.collection_deadline} onChange={(e) => setField("collection_deadline", e.target.value)} className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-slate-100 outline-none focus:border-emerald-500/60" /></label>
          <label className="block"><span className="mb-2 block text-sm text-slate-200">Tags</span><input placeholder="h100, acceptance, customer-a" value={form.tags} onChange={(e) => setField("tags", e.target.value)} className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-slate-100 outline-none focus:border-emerald-500/60" /></label>
          <button disabled={saving} className="rounded-2xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950 hover:bg-emerald-400 disabled:bg-emerald-800">{saving ? "Creating..." : "Create engagement"}</button>
        </form>
      </section>
    </EngagementShell>
  );
}

function EngagementDetailPage({ engagementId }: { engagementId: string }) {
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [nodes, setNodes] = useState<EngagementNode[]>([]);
  const [evidenceRecords, setEvidenceRecords] = useState<EvidenceRecordSummary[]>([]);
  const [benchmarkRuns, setBenchmarkRuns] = useState<BenchmarkRunSummary[]>([]);
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([]);
  const [comparison, setComparison] = useState<ClusterComparison | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [readiness, setReadiness] = useState<EngagementReadiness | null>(null);
  const [findingFilters, setFindingFilters] = useState({ severity: "all", category: "all", node: "all", blockingOnly: false });
  const [selectedProvenance, setSelectedProvenance] = useState<ProvenanceReference | null>(null);
  const [uploadTokens, setUploadTokens] = useState<Record<string, UploadTokenSummary[]>>({});
  const [createdToken, setCreatedToken] = useState<(UploadTokenSummary & { token: string; upload_url: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refreshEngagement = () => {
    Promise.all([
      fetch(`/api/v1/engagements/${encodeURIComponent(engagementId)}`).then((res) => res.ok ? res.json() : Promise.reject(new Error("Engagement not found."))),
      fetch(`/api/v1/engagements/${encodeURIComponent(engagementId)}/nodes`).then((res) => res.ok ? res.json() : Promise.reject(new Error("Nodes not found."))),
      fetch(`/api/v1/engagements/${encodeURIComponent(engagementId)}/evidence`).then((res) => res.ok ? res.json() : { evidence_records: [] }),
      fetch(`/api/v1/engagements/${encodeURIComponent(engagementId)}/benchmarks`).then((res) => res.ok ? res.json() : { benchmarks: [] }),
      fetch(`/api/v1/engagements/${encodeURIComponent(engagementId)}/activity`).then((res) => res.ok ? res.json() : { activity_entries: [] }),
      fetch(`/api/v1/engagements/${encodeURIComponent(engagementId)}/comparison`).then((res) => res.ok ? res.json() : { comparison: null }),
      fetch(`/api/v1/engagements/${encodeURIComponent(engagementId)}/findings`).then((res) => res.ok ? res.json() : { findings: [] }),
      fetch(`/api/v1/engagements/${encodeURIComponent(engagementId)}/readiness`).then((res) => res.ok ? res.json() : { readiness: null }),
    ]).then(([engagementPayload, nodesPayload, evidencePayload, benchmarkPayload, activityPayload, comparisonPayload, findingsPayload, readinessPayload]) => {
      setEngagement(engagementPayload.engagement);
      const nextNodes = Array.isArray(nodesPayload.nodes) ? nodesPayload.nodes : [];
      setNodes(nextNodes);
      setEvidenceRecords(Array.isArray(evidencePayload.evidence_records) ? evidencePayload.evidence_records : []);
      setBenchmarkRuns(Array.isArray(benchmarkPayload.benchmarks) ? benchmarkPayload.benchmarks : []);
      setActivityEntries(Array.isArray(activityPayload.activity_entries) ? activityPayload.activity_entries : []);
      setComparison(comparisonPayload.comparison ?? null);
      setFindings(Array.isArray(findingsPayload.findings) ? findingsPayload.findings : []);
      setReadiness(readinessPayload.readiness ?? null);
      return Promise.all(nextNodes.map((node: EngagementNode) => fetch(`/api/v1/engagements/${encodeURIComponent(engagementId)}/nodes/${encodeURIComponent(node.id)}/upload-tokens`).then((res) => res.ok ? res.json() : { upload_tokens: [] }).then((payload) => [node.id, Array.isArray(payload.upload_tokens) ? payload.upload_tokens : []] as const)));
    }).then((tokenPairs) => {
      if (tokenPairs) setUploadTokens(Object.fromEntries(tokenPairs));
    }).catch((err) => setError(err instanceof Error ? err.message : "Failed to load engagement."));
  };
  useEffect(() => {
    refreshEngagement();
  }, [engagementId]);

  const generateUploadToken = async (node: EngagementNode) => {
    setError(null);
    const response = await fetch(`/api/v1/engagements/${encodeURIComponent(engagementId)}/nodes/${encodeURIComponent(node.id)}/upload-tokens`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    const payload = await response.json();
    if (!response.ok) return setError(payload.error ?? "Failed to create upload token.");
    setCreatedToken(payload);
    refreshEngagement();
  };

  const revokeUploadToken = async (node: EngagementNode, token: UploadTokenSummary) => {
    setError(null);
    const response = await fetch(`/api/v1/engagements/${encodeURIComponent(engagementId)}/nodes/${encodeURIComponent(node.id)}/upload-tokens/${encodeURIComponent(token.id)}/revoke`, { method: "POST" });
    if (!response.ok) setError("Failed to revoke upload token.");
    refreshEngagement();
  };

  const closeTokenModal = () => setCreatedToken(null);

  if (error) return <EngagementShell><div role="alert" className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-100">{error}</div></EngagementShell>;
  if (!engagement) return <EngagementShell><div className="cyber-panel rounded-2xl border border-slate-800 p-6">Loading engagement...</div></EngagementShell>;
  const cards = [
    ["Expected nodes", readiness?.expected_node_count ?? engagement.expected_node_count], ["Received nodes", readiness?.received_node_count ?? engagement.received_node_count], ["Ready nodes", readiness?.ready_node_count ?? engagement.ready_node_count], ["Remediation nodes", readiness?.remediation_node_count ?? engagement.remediation_node_count], ["Failed nodes", readiness?.failed_node_count ?? engagement.failed_node_count], ["Blocking findings", readiness?.blocking_findings_count ?? findings.filter((finding) => finding.blocking).length], ["Readiness score", readiness?.readiness_score === null || readiness?.readiness_score === undefined ? (engagement.readiness_score === null ? "Not evaluated" : `${engagement.readiness_score}%`) : `${readiness.readiness_score}%`], ["Acceptance decision", formatEngagementLabel(readiness?.acceptance_status ?? engagement.acceptance_status)],
  ];
  const filteredFindings = findings.filter((finding) => (findingFilters.severity === "all" || finding.severity === findingFilters.severity) && (findingFilters.category === "all" || finding.category === findingFilters.category) && (findingFilters.node === "all" || finding.node_id === findingFilters.node) && (!findingFilters.blockingOnly || finding.blocking));
  const nodeName = (nodeId: string | null) => nodeId ? nodes.find((node) => node.id === nodeId)?.display_name ?? nodeId : "Cluster-wide";
  const displayValue = (value: unknown) => value === null || value === undefined || value === "" ? "Missing" : typeof value === "number" ? value.toLocaleString() : String(value);
  const latestBenchmark = (...types: BenchmarkRunSummary["benchmark_type"][]) => benchmarkRuns.find((run) => types.includes(run.benchmark_type) && run.status !== "superseded");
  const comparisonColumns = [
    ["GPU", "gpu_model"], ["Count", "gpu_count"], ["Driver", "driver_version"], ["CUDA", "cuda_version"], ["Kernel", "kernel_version"], ["OFED", "ofed_version"], ["NVLink", "nvlink_status"], ["Fabric", "fabric_type"],
  ] as const;
  return (
    <EngagementShell>
      <section className="mb-8 rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-6">
        {(engagement.simulated || readiness?.simulated_demo_warning) && <div className="mb-4 inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-mono uppercase tracking-wider text-amber-300">{readiness?.simulated_demo_warning ?? "DEMONSTRATION ONLY — NOT VALID FOR CUSTOMER ACCEPTANCE"} — not real hardware evidence</div>}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div><div className="text-sm text-slate-400">{engagement.customer_name}</div><h1 className="mt-2 font-display text-4xl font-semibold text-slate-50">{engagement.name}</h1><p className="mt-3 max-w-3xl leading-7 text-slate-300">{engagement.description || "No description provided."}</p></div>
          <div className="flex flex-wrap gap-2"><EngagementStatusPill value={engagement.status} /><EngagementStatusPill value={engagement.acceptance_status} kind="acceptance" /></div>
        </div>
        <div className="mt-5 grid gap-3 text-sm text-slate-300 md:grid-cols-3"><div>Platform: {formatEngagementLabel(engagement.platform_profile)}</div><div>Created: {formatDate(engagement.created_at)}</div><div>Collection deadline: {formatDate(engagement.collection_deadline)}</div></div>
      </section>
      <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-6">{cards.map(([label, value]) => <div key={label} className="cyber-panel rounded-2xl border border-slate-800 p-4"><div className="text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500">{label}</div><div className="mt-2 text-2xl font-display font-semibold text-slate-50">{value}</div></div>)}</section>
      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <Panel title="Nodes">{nodes.length ? <div className="space-y-3">{nodes.map((node) => {
            const activeToken = (uploadTokens[node.id] ?? []).find((token) => token.status === "active");
            return <div key={node.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="font-semibold text-slate-50">{node.display_name}</div><div className="mt-1 text-sm text-slate-400">{node.gpu_model ?? "GPU model awaiting evidence"} • {node.gpu_count ?? 0} GPUs</div><div className="mt-2 grid gap-1 text-xs text-slate-400 md:grid-cols-2"><span>Validation: {formatEngagementLabel(node.validation_status)}</span><span>Last collection: {formatDate(node.last_collection_at)}</span><span>Current evidence ID: {node.current_evidence_id ?? "Awaiting evidence"}</span><span>Upload-token state: {activeToken ? `active until ${formatDate(activeToken.expires_at)}` : "none active"}</span></div></div><EngagementStatusPill value={node.collection_status} /></div><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => generateUploadToken(node)} className="rounded-xl border border-emerald-500/40 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/10">Generate upload token</button>{activeToken && <button onClick={() => revokeUploadToken(node, activeToken)} className="rounded-xl border border-amber-500/40 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/10">Revoke token</button>}</div><div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400"><div className="font-mono uppercase tracking-wider text-slate-500">Upload instructions</div><div className="mt-2">Run ai-validator upload --bundle node-evidence.tar.gz --url /api/v1/evidence/uploads --token-file /secure/path/upload-token.txt. The GPU node initiates outbound HTTPS; no SSH or inbound cluster access is required.</div></div></div>;
          })}</div> : <EmptyState text="No node records have been created for this engagement yet." />}</Panel>
          <Panel title="Node comparison">{comparison?.rows.length ? <div className="overflow-x-auto"><table className="min-w-[980px] w-full text-left text-sm"><thead className="text-[10px] font-mono uppercase tracking-[0.16em] text-slate-500"><tr><th className="p-3">Node</th>{comparisonColumns.map(([label]) => <th key={label} className="p-3">{label}</th>)}<th className="p-3">Score</th><th className="p-3">Status</th></tr></thead><tbody>{comparison.rows.map((row) => <tr key={row.node_id} className="border-t border-slate-800"><td className="p-3 font-semibold text-slate-100">{row.node}</td>{comparisonColumns.map(([label, field]) => { const cell = row.fields[field]; return <td key={label} className={`p-3 ${cell?.missing ? "text-amber-300" : cell?.matches_consensus === false ? "bg-red-500/10 text-red-200" : "text-slate-300"}`}>{displayValue(cell?.value)}{cell?.provenance && <button type="button" onClick={() => setSelectedProvenance(cell.provenance)} className="ml-2 rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-emerald-300">evidence link</button>}</td>; })}<td className="p-3 text-slate-200">{row.node_readiness === null ? "Not evaluated" : `${row.node_readiness}%`}</td><td className="p-3"><EngagementStatusPill value={row.validation_status} kind="acceptance" /></td></tr>)}</tbody></table>{comparison.warnings.length > 0 && <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-100">{comparison.warnings.join(" ")}</div>}</div> : <EmptyState text="No comparison available until evidence is accepted." />}</Panel>
          <Panel title="Findings"><div className="mb-4 grid gap-3 md:grid-cols-4"><select aria-label="Filter findings by severity" value={findingFilters.severity} onChange={(e) => setFindingFilters((current) => ({ ...current, severity: e.target.value }))} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm"><option value="all">All severities</option>{["critical", "high", "medium", "low", "info"].map((value) => <option key={value} value={value}>{formatEngagementLabel(value)}</option>)}</select><select aria-label="Filter findings by category" value={findingFilters.category} onChange={(e) => setFindingFilters((current) => ({ ...current, category: e.target.value }))} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm"><option value="all">All categories</option>{[...new Set(findings.map((finding) => finding.category))].map((value) => <option key={value} value={value}>{formatEngagementLabel(String(value))}</option>)}</select><select aria-label="Filter findings by node" value={findingFilters.node} onChange={(e) => setFindingFilters((current) => ({ ...current, node: e.target.value }))} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm"><option value="all">All nodes</option>{nodes.map((node) => <option key={node.id} value={node.id}>{node.display_name}</option>)}</select><label className="flex items-center gap-2 rounded-xl border border-slate-800 px-3 py-2 text-sm text-slate-300"><input type="checkbox" checked={findingFilters.blockingOnly} onChange={(e) => setFindingFilters((current) => ({ ...current, blockingOnly: e.target.checked }))} /> Blocking only</label></div>{filteredFindings.length ? <div className="space-y-3">{filteredFindings.map((finding) => <article key={finding.id} className={`rounded-2xl border p-4 ${finding.blocking ? "border-red-500/25 bg-red-500/8" : "border-slate-800 bg-slate-950/40"}`}><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-mono uppercase ${finding.severity === "critical" || finding.severity === "high" ? "bg-red-500/15 text-red-200" : finding.severity === "medium" ? "bg-amber-500/15 text-amber-200" : "bg-slate-800 text-slate-300"}`}>{finding.severity}</span>{finding.blocking && <span className="rounded-full border border-red-500/30 px-2 py-1 text-[10px] font-mono uppercase text-red-200">Blocking</span>}<span className="text-xs text-slate-500">{formatEngagementLabel(finding.category)} • {nodeName(finding.node_id)}</span></div><h3 className="mt-3 font-semibold text-slate-50">{finding.title}</h3><p className="mt-2 text-sm leading-6 text-slate-300">{finding.description}</p><div className="mt-3 grid gap-3 text-xs text-slate-400 md:grid-cols-2"><div><span className="text-slate-500">Impact:</span> {finding.impact}</div><div><span className="text-slate-500">Recommendation:</span> {finding.recommendation}</div><div className="md:col-span-2"><span className="text-slate-500">Verification command:</span> <code className="rounded bg-slate-900 px-2 py-1 text-emerald-200">{finding.verification_command}</code></div></div>{finding.evidence_references[0] && <button type="button" onClick={() => setSelectedProvenance(finding.evidence_references[0])} className="mt-3 rounded-xl border border-emerald-500/35 px-3 py-2 text-xs font-semibold text-emerald-200">Open evidence link</button>}</article>)}</div> : <EmptyState text="No findings match the current filters." />}</Panel>
          <Panel title="Readiness breakdown">{readiness ? <div className="space-y-4"><div className="text-sm text-slate-300">Benchmark results: <span className="font-mono uppercase text-amber-300">not evaluated</span>. Benchmark results are evaluated separately and are not included in the current readiness score.</div><div className="grid gap-3 md:grid-cols-2">{(Object.entries(readiness.breakdown) as [string, { score: number; max: number; deductions: string[] }][]).map(([key, section]) => <div key={key} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4"><div className="flex items-center justify-between gap-3"><div className="font-semibold text-slate-100">{formatEngagementLabel(key)}</div><div className="font-mono text-sm text-emerald-300">{section.max === 0 ? "Not evaluated" : `${section.score}/${section.max}`}</div></div>{section.deductions.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-400">{section.deductions.slice(0, 4).map((reason) => <li key={reason}>{reason}</li>)}</ul>}</div>)}</div></div> : <EmptyState text="Readiness scoring is available after accepted evidence is evaluated." />}</Panel>
          <Panel title="Benchmarks"><div className="mb-3 text-sm text-slate-400">Benchmarks workspace tabs: Overview, Run Benchmark, Jobs, Results, Policies. The Run Benchmark wizard uses: Step 1 Select benchmark, Step 2 Select target node or nodes, Step 3 Validate capabilities, Step 4 Configure approved parameters, Step 5 Review generated execution plan, Step 6 Approve and submit. No interactive shell is exposed; all execution uses allowlisted benchmark definitions and outbound node runners.</div><div className="mb-3 grid gap-2 text-xs text-slate-400 md:grid-cols-4">{["NCCL AllReduce", "NCCL AllGather", "NCCL ReduceScatter", "NCCL Broadcast", "NVIDIA HPL", "Triton Performance Analyzer", "GenAI-Perf", "DCGM Level 1"].map((card) => <div key={card} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><div className="font-semibold text-slate-200">{card}</div><div>purpose • supported scope • prerequisites • estimated duration • disruptive level • runner readiness • status</div></div>)}</div><div className="grid gap-3 md:grid-cols-3">{[["NCCL", latestBenchmark("nccl")], ["HPL", latestBenchmark("hpl")], ["Inference", latestBenchmark("triton_perf_analyzer", "genai_perf")]] .map(([name, run]) => { const benchmark = run as BenchmarkRunSummary | undefined; const metrics = benchmark?.metrics ?? {}; return <div key={String(name)} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4"><div className="font-semibold text-slate-100">{String(name)}</div><div className={`mt-2 text-xs font-mono uppercase tracking-wider ${benchmark ? "text-emerald-300" : "text-amber-300"}`}>{benchmark?.status ?? "Not Evaluated"}</div>{String(name) === "NCCL" && <div className="mt-3 space-y-1 text-xs text-slate-400"><div>Bandwidth: {displayValue(metrics.average_bus_bandwidth ?? metrics.bus_bandwidth)}</div><div>Transport: {displayValue(metrics.transport)}</div><div>GPUs: {displayValue(metrics.gpu_count)}</div><div>Nodes: {displayValue(metrics.node_count)}</div></div>}{String(name) === "HPL" && <div className="mt-3 space-y-1 text-xs text-slate-400"><div>TFLOPS: {displayValue(metrics.performance_tflops)}</div><div>Residual: {metrics.residual_pass === true ? "PASSED" : metrics.residual_pass === false ? "FAILED" : "Missing"}</div></div>}{String(name) === "Inference" && <div className="mt-3 space-y-1 text-xs text-slate-400"><div>Throughput: {displayValue(metrics.throughput ?? metrics.tokens_per_second)}</div><div>Latency: {displayValue(metrics.average_latency ?? metrics.p95 ?? metrics.p99)}</div></div>}<div className="mt-3 text-xs text-slate-500">Evidence: {benchmark ? <button type="button" onClick={() => setSelectedProvenance(benchmark.provenance)} className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-emerald-300">provenance</button> : "No file imported"}</div></div>; })}</div></Panel>
        </div>
        <div className="space-y-6">
          <Panel title="Evidence">{evidenceRecords.length ? <div className="space-y-3">{evidenceRecords.map((record) => <div key={record.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300"><div className="flex flex-wrap items-center justify-between gap-2"><div className="font-semibold text-slate-50">{record.id}</div><EngagementStatusPill value={record.ingestion_status} /></div><div className="mt-3 grid gap-2 text-xs md:grid-cols-2"><div>Node: {nodes.find((node) => node.id === record.node_id)?.display_name ?? record.node_id}</div><div>Collector: {record.collector_version}</div><div>Profile: {formatEngagementLabel(record.collector_profile)}</div><div>Collected: {formatDate(record.collected_at)}</div><div>Uploaded: {formatDate(record.uploaded_at)}</div><div>Sanitized: {record.sanitized ? "yes" : "no"}</div><div>Simulated: {record.simulated ? "yes" : "no"}</div><div>Commands: {record.collected_count}/{record.command_count} collected, {record.missing_count} missing, {record.failed_count} failed, {record.skipped_count} skipped</div><div className="md:col-span-2">Bundle checksum: <span className="font-mono">{record.bundle_sha256}</span></div>{record.validation_warnings.length > 0 && <div className="md:col-span-2">Warnings: {record.validation_warnings.join("; ")}</div>}</div></div>)}</div> : <EmptyState text="No bundles uploaded." />}</Panel>
          <Panel title="Acceptance Report preview"><div className="space-y-4 text-sm text-slate-300"><div><div className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">Executive summary</div><p className="mt-2">{engagement.customer_name} / {engagement.name}: readiness score {readiness?.readiness_score ?? engagement.readiness_score ?? "not evaluated"}{typeof (readiness?.readiness_score ?? engagement.readiness_score) === "number" ? "%" : ""}; acceptance decision {formatEngagementLabel(readiness?.acceptance_status ?? engagement.acceptance_status)}.</p></div><div className="grid gap-3 md:grid-cols-2"><div className="rounded-xl border border-slate-800 p-3"><div className="text-slate-500">Environment overview</div><div>{formatEngagementLabel(engagement.platform_profile)} • {engagement.received_node_count}/{engagement.expected_node_count} nodes received</div></div><div className="rounded-xl border border-slate-800 p-3"><div className="text-slate-500">Acceptance decision</div><div>{formatEngagementLabel(readiness?.acceptance_status ?? engagement.acceptance_status)}</div></div><div className="rounded-xl border border-slate-800 p-3"><div className="text-slate-500">Blocking findings</div><div>{readiness?.blocking_findings_count ?? findings.filter((finding) => finding.blocking).length}</div></div><div className="rounded-xl border border-slate-800 p-3"><div className="text-slate-500">Benchmark status</div><div>Awaiting Benchmark Evidence</div></div></div><div><div className="text-slate-500">Remediation priorities</div><ul className="mt-2 list-disc space-y-1 pl-5">{findings.filter((finding) => finding.blocking).slice(0, 4).map((finding) => <li key={finding.id}>{finding.title} — {nodeName(finding.node_id)}</li>)}{findings.filter((finding) => finding.blocking).length === 0 && <li>No blocking findings currently reported.</li>}</ul></div><div><div className="text-slate-500">Evidence completeness</div><p className="mt-1">{readiness?.breakdown.evidence_completeness ? `${readiness.breakdown.evidence_completeness.score}/${readiness.breakdown.evidence_completeness.max}` : "Not evaluated"}</p></div></div></Panel>
          <Panel title="Activity">{activityEntries.length ? <div className="space-y-2 text-sm text-slate-300">{activityEntries.map((entry) => <div key={entry.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3"><div>{entry.message}</div><div className="mt-1 text-xs text-slate-500">{formatDate(entry.created_at)} • {formatEngagementLabel(entry.type)}</div></div>)}</div> : <div className="text-sm text-slate-300">Engagement created: {formatDate(engagement.created_at)}</div>}</Panel>
        </div>
      </section>
      {selectedProvenance && <div role="dialog" aria-modal="true" aria-label="Evidence provenance" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"><div className="max-w-2xl rounded-3xl border border-emerald-500/30 bg-slate-950 p-6 shadow-2xl"><div className="text-[11px] font-mono uppercase tracking-[0.2em] text-emerald-300">Evidence provenance</div><h2 className="mt-2 font-display text-2xl text-slate-50">Parsed evidence reference</h2><dl className="mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-2"><div><dt className="text-slate-500">Source command</dt><dd>{selectedProvenance.source_command ?? selectedProvenance.source_command_id ?? "Unknown"}</dd></div><div><dt className="text-slate-500">Source file</dt><dd>{selectedProvenance.source_file}</dd></div><div><dt className="text-slate-500">Collected timestamp</dt><dd>{formatDate(selectedProvenance.collection_timestamp)}</dd></div><div><dt className="text-slate-500">Checksum</dt><dd className="break-all font-mono text-xs">{selectedProvenance.source_checksum ?? "Unavailable"}</dd></div><div><dt className="text-slate-500">Parsed field</dt><dd>{selectedProvenance.parsed_field ?? "Unknown"}</dd></div><div><dt className="text-slate-500">Parsed value</dt><dd>{displayValue(selectedProvenance.parsed_value)}</dd></div><div><dt className="text-slate-500">Sanitized</dt><dd>{selectedProvenance.sanitized ? "yes" : "no"}</dd></div><div><dt className="text-slate-500">Simulated</dt><dd>{selectedProvenance.simulated ? "yes" : "no"}</dd></div></dl><button onClick={() => setSelectedProvenance(null)} className="mt-5 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200">Close</button></div></div>}
      {createdToken && <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"><div className="max-w-2xl rounded-3xl border border-emerald-500/30 bg-slate-950 p-6 shadow-2xl"><div className="text-[11px] font-mono uppercase tracking-[0.2em] text-amber-300">Copy-once upload token</div><h2 className="mt-2 font-display text-2xl text-slate-50">Upload token created</h2><p className="mt-3 text-sm text-amber-100">This plaintext token is shown only once and cannot be retrieved again. It is not stored in localStorage and must not be placed in URLs or shell history.</p><pre className="mt-4 max-h-40 overflow-auto rounded-2xl border border-slate-800 bg-slate-900 p-4 text-xs text-emerald-200">{createdToken.token}</pre><div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-xs text-slate-300">ai-validator upload --bundle node-evidence.tar.gz --url {createdToken.upload_url} --token-file /secure/path/upload-token.txt</div><div className="mt-5 flex flex-wrap gap-3"><button onClick={() => navigator.clipboard?.writeText(createdToken.token)} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950">Copy token</button><button onClick={closeTokenModal} className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200">Close and clear token</button></div></div></div>}
    </EngagementShell>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="cyber-panel rounded-2xl border border-slate-800 p-5"><h2 className="mb-4 font-display text-lg font-semibold text-slate-50">{title}</h2>{children}</section>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/30 p-6 text-sm text-slate-400">{text}</div>;
}

function OperationsLibraryPage({ slug }: { slug?: string }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [copied, setCopied] = useState<string | null>(null);
  const categories = ["all", ...Array.from(new Set(libraryPages.map((page) => page.category)))];
  const selected = slug ? libraryPages.find((page) => page.slug === slug) : null;
  const pages = selected ? [selected] : searchLibrary(query, category);
  const copyCommand = (command: string) => {
    navigator.clipboard?.writeText(command);
    setCopied(command);
    window.setTimeout(() => setCopied(null), 1500);
  };
  const pageHref = (page: LibraryPage) => `/portal/library/${page.slug}`;
  return (
    <EngagementShell>
      <section className="mb-8 rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-6">
        <div className="text-[11px] font-mono uppercase tracking-[0.24em] text-emerald-300">Operations Library</div>
        <h1 className="mt-3 font-display text-4xl font-semibold text-slate-50">Searchable GPU operations cheat sheets</h1>
        <p className="mt-3 max-w-4xl leading-7 text-slate-300">Authenticated, read-only reference pages for Slurm, Lustre, NVIDIA Base Command Manager, and GPU benchmarking. Commands are examples only; this page does not execute commands or persist secrets.</p>
        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_220px]">
          <label><span className="sr-only">Search operations topics</span><input aria-label="Search operations topics" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search operations topics or commands" className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100" /></label>
          <label><span className="sr-only">Filter by category</span><select aria-label="Filter by category" value={category} onChange={(event) => setCategory(event.target.value)} className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100">{categories.map((item) => <option key={item} value={item}>{item === "all" ? "All categories" : item}</option>)}</select></label>
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-4">
        {libraryPages.map((page) => <a key={page.slug} href={pageHref(page)} className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-300 hover:border-emerald-500/40"><div className="font-semibold text-slate-50">{page.title}</div><div className="mt-2 text-xs text-slate-500">{page.category}</div></a>)}
      </section>
      <section className="mt-6 space-y-6">
        {pages.map((page) => <article key={page.slug} className="cyber-panel rounded-3xl border border-slate-800 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-[11px] font-mono uppercase tracking-[0.18em] text-emerald-300">{page.category}</div><h2 className="mt-2 font-display text-3xl text-slate-50">{page.title}</h2></div><a href={pageHref(page)} className="rounded-full border border-slate-700 px-3 py-2 text-xs text-slate-300">Open page</a></div>
          <p className="mt-4 leading-7 text-slate-300">{page.overview}</p>
          <div className="mt-6 grid gap-5 lg:grid-cols-2"><Panel title="Key concepts"><ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">{page.keyConcepts.map((item) => <li key={item}>{item}</li>)}</ul></Panel><Panel title="Safety warnings"><ul className="list-disc space-y-2 pl-5 text-sm text-amber-100">{page.safetyWarnings.map((item) => <li key={item}>{item}</li>)}</ul></Panel></div>
          <Panel title="Common commands"><div className="space-y-3">{page.commands.map((cmd) => <div key={`${page.slug}-${cmd.command}`} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-mono uppercase ${cmd.safety === "mutating" ? "bg-red-500/10 text-red-200" : cmd.safety === "example" ? "bg-amber-500/10 text-amber-200" : "bg-emerald-500/10 text-emerald-200"}`}>{cmd.safety}{cmd.safety === "example" ? " illustrative example" : ""}</span><span className="text-xs text-slate-500">{cmd.category}</span></div><button onClick={() => copyCommand(cmd.command)} className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-200">{copied === cmd.command ? "Copied" : "Copy command"}</button></div><pre className="mt-3 overflow-x-auto rounded-xl bg-slate-900 p-3 text-xs text-emerald-200"><code>{cmd.command}</code></pre><p className="mt-2 text-sm text-slate-400">{cmd.description}</p></div>)}</div></Panel>
          <div className="grid gap-5 lg:grid-cols-3"><Panel title="Troubleshooting workflow"><ol className="list-decimal space-y-2 pl-5 text-sm text-slate-300">{page.troubleshooting.map((item) => <li key={item}>{item}</li>)}</ol></Panel><Panel title="Interview questions"><ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">{page.interviewQuestions.map((item) => <li key={item}>{item}</li>)}</ul></Panel><Panel title="Related GPU Validator features"><ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">{page.relatedFeatures.map((item) => <li key={item}>{item}</li>)}</ul><div className="mt-4 text-xs text-slate-500">{page.lastReviewed}</div></Panel></div>
        </article>)}
      </section>
    </EngagementShell>
  );
}

type AdminUser = { id: string; username: string; display_name: string; email: string | null; role: string; status: string; expires_at: string | null; last_login_at: string | null; session_version: number; notes: string; tags: string[] };

function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [role, setRole] = useState("all");
  const [message, setMessage] = useState<string | null>(null);
  const [credential, setCredential] = useState<{ login_url: string; username: string; temporary_password: string; expires_at: string; role: string } | null>(null);
  const load = async () => {
    const response = await fetch(`/api/v1/admin/users?query=${encodeURIComponent(query)}&status=${encodeURIComponent(status)}&role=${encodeURIComponent(role)}`);
    const payload = await response.json().catch(() => ({ users: [] }));
    if (!response.ok) throw new Error(payload.error ?? "Administrator access required.");
    setUsers(Array.isArray(payload.users) ? payload.users : []);
  };
  useEffect(() => { load().catch((error) => setMessage(error instanceof Error ? error.message : "Failed to load users.")); }, [query, status, role]);
  const createInterviewer = async () => {
    setMessage(null);
    const displayName = window.prompt("Display name for the NVIDIA interviewer account", "NVIDIA Interviewer");
    if (!displayName) return;
    const response = await fetch("/api/v1/admin/users/interviewer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ display_name: displayName, hours: 8 }) });
    const payload = await response.json();
    if (!response.ok) return setMessage(payload.error ?? "Failed to create interviewer.");
    setCredential({ login_url: payload.login_url, username: payload.user.username, temporary_password: payload.temporary_password, expires_at: payload.expires_at, role: payload.user.role });
    setMessage("Temporary interviewer created. Copy the credentials before closing the modal.");
    await load();
  };
  const disableUser = async (user: AdminUser) => {
    if (!window.confirm(`Disable ${user.username}? Active sessions will be revoked.`)) return;
    const response = await fetch(`/api/v1/admin/users/${encodeURIComponent(user.id)}/disable`, { method: "POST" });
    const payload = await response.json().catch(() => ({}));
    setMessage(response.ok ? `Disabled ${user.username}.` : payload.error ?? "Disable failed.");
    await load();
  };
  const enableUser = async (user: AdminUser) => {
    const response = await fetch(`/api/v1/admin/users/${encodeURIComponent(user.id)}/enable`, { method: "POST" });
    const payload = await response.json().catch(() => ({}));
    setMessage(response.ok ? `Enabled ${user.username}.` : payload.error ?? "Enable failed.");
    await load();
  };
  const resetPassword = async (user: AdminUser) => {
    if (!window.confirm(`Reset password for ${user.username}? The new password is shown once.`)) return;
    const response = await fetch(`/api/v1/admin/users/${encodeURIComponent(user.id)}/reset-password`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok) return setMessage(payload.error ?? "Password reset failed.");
    setCredential({ login_url: "/login", username: payload.user.username, temporary_password: payload.temporary_password, expires_at: payload.user.expires_at ?? "No expiration", role: payload.user.role });
  };
  const closeCredential = () => setCredential(null);
  return <EngagementShell><section className="mb-8"><div className="text-[11px] font-mono uppercase tracking-[0.24em] text-emerald-300">Administrator-only</div><h1 className="mt-3 font-display text-4xl font-semibold text-slate-50">User administration</h1><p className="mt-3 max-w-4xl text-slate-400">Create administrators, reviewers, and short-lived NVIDIA interviewer accounts. Passwords are shown once and are never persisted in plaintext.</p><div className="mt-5 flex flex-wrap gap-3"><a href="/portal/admin/users/new" className="rounded-2xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200">Create standard user</a><button onClick={createInterviewer} className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950">Create Interviewer Account</button></div></section>{message && <div role="status" className="mb-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-100">{message}</div>}<section className="cyber-panel mb-6 rounded-2xl border border-slate-800 p-4"><div className="grid gap-3 md:grid-cols-3"><input aria-label="Search users" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search users" className="rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3" /><select aria-label="Filter users by role" value={role} onChange={(event) => setRole(event.target.value)} className="rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3"><option value="all">All roles</option><option value="administrator">Administrators</option><option value="reviewer">Reviewers</option><option value="temporary_reviewer">Temporary reviewers</option></select><select aria-label="Filter users by status" value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3"><option value="all">All statuses</option><option value="active">Active</option><option value="disabled">Disabled</option><option value="expired">Expired</option><option value="locked">Locked</option></select></div></section><section className="overflow-hidden rounded-2xl border border-slate-800"><div className="grid gap-3 border-b border-slate-800 px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-slate-500 md:grid-cols-[1fr_1fr_0.8fr_0.8fr_1fr_1.4fr]"><span>User</span><span>Email</span><span>Role</span><span>Status</span><span>Expires</span><span>Actions</span></div>{users.map((user) => <div key={user.id} className="grid gap-3 border-b border-slate-900 px-4 py-4 text-sm md:grid-cols-[1fr_1fr_0.8fr_0.8fr_1fr_1.4fr]"><a href={`/portal/admin/users/${encodeURIComponent(user.id)}`} className="font-semibold text-slate-50">{user.display_name}<span className="block font-mono text-xs text-slate-500">{user.username}</span></a><span>{user.email ?? "—"}</span><span>{formatEngagementLabel(user.role)}</span><span>{formatEngagementLabel(user.status)}</span><span>{formatDate(user.expires_at)}</span><span className="flex flex-wrap gap-2"><button onClick={() => user.status === "disabled" ? enableUser(user) : disableUser(user)} className="rounded-lg border border-slate-700 px-2 py-1 text-xs">{user.status === "disabled" ? "Enable" : "Disable"}</button><button onClick={() => resetPassword(user)} className="rounded-lg border border-slate-700 px-2 py-1 text-xs">Reset password</button></span></div>)}</section>{credential && <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"><div className="max-w-2xl rounded-3xl border border-emerald-500/30 bg-slate-950 p-6"><div className="text-[11px] font-mono uppercase tracking-[0.2em] text-amber-300">One-time credentials</div><h2 className="mt-2 font-display text-2xl text-slate-50">Copy temporary credentials now</h2><p className="mt-3 text-sm text-amber-100">The password cannot be retrieved after this modal closes. It is not stored in localStorage, URLs, or analytics.</p><pre className="mt-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-xs text-emerald-200">Login URL: {window.location.origin}{credential.login_url}\nUsername: {credential.username}\nTemporary password: {credential.temporary_password}\nRole: {formatEngagementLabel(credential.role)}\nExpiration: {credential.expires_at}</pre><div className="mt-5 flex flex-wrap gap-3"><button onClick={() => navigator.clipboard?.writeText(`Login URL: ${window.location.origin}${credential.login_url}\nUsername: ${credential.username}\nTemporary password: ${credential.temporary_password}\nRole: ${credential.role}\nExpiration: ${credential.expires_at}`)} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950">Copy All Credentials</button><button onClick={() => navigator.clipboard?.writeText(credential.username)} className="rounded-xl border border-slate-700 px-4 py-2 text-sm">Copy Username</button><button onClick={() => navigator.clipboard?.writeText(credential.temporary_password)} className="rounded-xl border border-slate-700 px-4 py-2 text-sm">Copy Password</button><button onClick={closeCredential} className="rounded-xl border border-slate-700 px-4 py-2 text-sm">Close and clear credentials</button></div></div></div>}</EngagementShell>;
}

function AdminNewUserPage() {
  const [form, setForm] = useState({ username: "", display_name: "", email: "", role: "reviewer", expires_at: "", tags: "", notes: "" });
  const [message, setMessage] = useState<string | null>(null);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const response = await fetch("/api/v1/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        email: form.email || null,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
        tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      }),
    });
    const payload = await response.json();
    if (!response.ok) return setMessage(payload.error ?? "User creation failed.");
    setMessage(`Created ${payload.user.username}. Temporary password shown once: ${payload.temporary_password}`);
  };
  return <EngagementShell><section className="mx-auto max-w-3xl"><h1 className="font-display text-4xl text-slate-50">Create user</h1>{message && <div role="alert" className="my-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-amber-100">{message}</div>}<form onSubmit={submit} className="cyber-panel mt-6 space-y-4 rounded-3xl border border-slate-800 p-6"><label className="block text-sm text-slate-300">Username<span className="text-emerald-300"> *</span><input required name="username" autoComplete="username" spellCheck={false} autoCapitalize="none" placeholder="Username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3" /></label><label className="block text-sm text-slate-300">Display Name<span className="text-emerald-300"> *</span><input required placeholder="Display Name" value={form.display_name} onChange={(event) => setForm({ ...form, display_name: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3" /></label><label className="block text-sm text-slate-300">Role<span className="text-emerald-300"> *</span><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3"><option value="reviewer">Reviewer</option><option value="administrator">Administrator</option><option value="temporary_reviewer">Temporary reviewer</option></select></label><label className="block text-sm text-slate-300">Email (optional)<input type="email" placeholder="Email (optional)" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3" /></label><label className="block text-sm text-slate-300">Expiration (optional)<input type="datetime-local" value={form.expires_at} onChange={(event) => setForm({ ...form, expires_at: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3" /></label><label className="block text-sm text-slate-300">Tags (optional)<input placeholder="nvidia, interview" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3" /></label><label className="block text-sm text-slate-300">Notes (optional)<textarea placeholder="Notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3" /></label><button className="rounded-2xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950">Create user</button></form></section></EngagementShell>;
}

function AdminUserDetailPage({ userId }: { userId: string }) {
  const [payload, setPayload] = useState<any>(null);
  useEffect(() => { fetch(`/api/v1/admin/users/${encodeURIComponent(userId)}`).then((response) => response.json()).then(setPayload).catch(() => setPayload({ error: "Failed to load user." })); }, [userId]);
  if (!payload) return <EngagementShell><EmptyState text="Loading user..." /></EngagementShell>;
  if (payload.error) return <EngagementShell><div role="alert" className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-100">{payload.error}</div></EngagementShell>;
  return <EngagementShell><h1 className="font-display text-4xl text-slate-50">{payload.user.display_name}</h1><div className="mt-4 grid gap-4 md:grid-cols-3"><Panel title="Account"><div className="space-y-2 text-sm"><div>Username: {payload.user.username}</div><div>Role: {formatEngagementLabel(payload.user.role)}</div><div>Status: {formatEngagementLabel(payload.user.status)}</div><div>Last login: {formatDate(payload.user.last_login_at)}</div><div>Session version: {payload.user.session_version}</div></div></Panel><Panel title="Expiration"><div>{formatDate(payload.user.expires_at)}</div></Panel><Panel title="Notes"><div>{payload.user.notes || "No notes."}</div></Panel></div><Panel title="Audit history"><div className="space-y-2 text-sm">{payload.audit_entries.map((entry: any) => <div key={entry.id} className="rounded-xl border border-slate-800 p-3">{formatDate(entry.created_at)} — {entry.action}</div>)}</div></Panel></EngagementShell>;
}

function AdminDemoPage() {
  return <EngagementShell><section className="rounded-3xl border border-amber-500/25 bg-amber-500/10 p-6"><div className="text-[11px] font-mono uppercase tracking-[0.24em] text-amber-300">Interview Demo workspace</div><h1 className="mt-3 font-display text-4xl text-slate-50">RC1 interview readiness</h1><p className="mt-3 max-w-4xl text-slate-300">This workspace distinguishes REAL HARDWARE DATA from SIMULATED DEMONSTRATION DATA. Demo reset/load actions preserve users, real evidence, real benchmark data, runner credentials, and production configuration.</p></section><div className="mt-6 grid gap-5 md:grid-cols-2"><Panel title="RC1 system health"><a href="/portal/admin/system" className="text-emerald-300">Open authenticated system health page</a></Panel><Panel title="Demo fixture status"><p>NVIS simulated fixture: load from the engagement list with visible SIMULATED DEMO labeling.</p><a className="mt-3 inline-flex rounded-xl border border-slate-700 px-3 py-2 text-sm" href="/portal/engagements">Open engagements</a></Panel><Panel title="Real Runpod node status"><p>REAL HARDWARE DATA appears only from registered outbound runners and live heartbeat payloads. Do not claim live status until a Runpod node registers and heartbeats.</p></Panel><Panel title="Recommended interview order"><ol className="list-decimal space-y-2 pl-5 text-sm"><li>Admin login</li><li>Create NVIDIA temporary reviewer</li><li>Load simulated fixture</li><li>Review evidence/readiness</li><li>Show runner architecture</li><li>Submit mocked NCCL smoke job</li><li>Show Operations Library</li><li>Logout/reviewer login</li></ol></Panel></div></EngagementShell>;
}

function AdminSystemPage() {
  return <EngagementShell><h1 className="font-display text-4xl text-slate-50">RC1 system health</h1><div className="mt-6 grid gap-4 md:grid-cols-3"><Panel title="Backend health"><div>Use /healthz and authenticated API checks. Environment values and private paths are intentionally hidden.</div></Panel><Panel title="Persistence health"><div>User, engagement, evidence, benchmark, and runner stores are file-backed and require production write access.</div></Panel><Panel title="Runner counts"><div>Online/stale/offline runner counts are available through runner APIs when live runners register.</div></Panel><Panel title="Storage checks"><div>Evidence and benchmark write tests are part of deploy verification; generated data must not be committed.</div></Panel><Panel title="HTTPS"><div>Caddy/HTTPS status is validated by deploy scripts, not by exposing secret server configuration.</div></Panel><Panel title="Warnings"><div>No password hashes, tokens, cookies, raw credentials, environment values, or private storage paths are rendered.</div></Panel></div></EngagementShell>;
}

function NotFoundPage() {
  return <EngagementShell><section className="mx-auto max-w-3xl rounded-3xl border border-slate-800 bg-slate-950/50 p-8 text-center"><div className="text-[11px] font-mono uppercase tracking-[0.24em] text-amber-300">404</div><h1 className="mt-3 font-display text-4xl text-slate-50">Portal page not found</h1><p className="mt-3 text-slate-400">This route is not implemented. Use the portal navigation to return to a supported RC1 workflow.</p><a href="/portal/engagements" className="mt-6 inline-flex rounded-2xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950">Return to engagements</a></section></EngagementShell>;
}

function DashboardKpiCard({ label, value, description, tone = "neutral", icon: Icon }: { label: string; value: string | number; description: string; tone?: "healthy" | "warning" | "critical" | "neutral"; icon: React.ComponentType<{ className?: string }> }) {
  const toneClass = tone === "healthy" ? "text-[var(--gv-accent-hover)]" : tone === "warning" ? "text-[var(--gv-warning)]" : tone === "critical" ? "text-[var(--gv-critical)]" : "text-[var(--gv-text-primary)]";
  const haloClass = tone === "healthy" ? "border-[var(--gv-border-highlight)] bg-[var(--gv-accent-muted)] text-[var(--gv-accent-hover)]" : tone === "warning" ? "border-amber-500/25 bg-amber-500/10 text-amber-300" : tone === "critical" ? "border-red-500/25 bg-red-500/10 text-red-300" : "border-[var(--gv-border-default)] bg-[var(--gv-bg-card-muted)] text-[var(--gv-text-muted)]";
  return (
    <article className="gv-card p-4" aria-label={`${label}: ${value}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="gv-eyebrow text-[var(--gv-text-faint)]">{label}</div>
          <div className={`mt-3 font-display text-3xl font-semibold tabular-nums leading-none ${toneClass}`}>{value}</div>
          <p className="mt-2 text-xs leading-relaxed text-[var(--gv-text-muted)]">{description}</p>
        </div>
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${haloClass}`} aria-hidden="true"><Icon className="h-5 w-5" /></span>
      </div>
    </article>
  );
}

function StatusProgressRow({ label, value, status }: { label: string; value: number; status: CheckStatus }) {
  const tone = status === "pass" ? "bg-[var(--gv-accent)]" : status === "warning" ? "bg-[var(--gv-warning)]" : status === "fail" ? "bg-[var(--gv-critical)]" : "bg-slate-600";
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
        <span className="text-[var(--gv-text-muted)]">{label}</span>
        <span className="font-mono text-[var(--gv-text-secondary)]">{value.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-900" role="meter" aria-label={`${label} score`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}>
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function ReadinessGauge({ value, label }: { value: number; label: string }) {
  const circumference = 2 * Math.PI * 44;
  const offset = circumference - (Math.max(0, Math.min(100, value)) / 100) * circumference;
  return (
    <div className="flex flex-col items-center justify-center" role="img" aria-label={`Readiness gauge ${value.toFixed(2)} percent, ${label}`}>
      <svg viewBox="0 0 112 112" className="h-40 w-40" aria-hidden="true">
        <circle cx="56" cy="56" r="44" fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth="9" />
        <circle cx="56" cy="56" r="44" fill="none" stroke="var(--gv-accent)" strokeWidth="9" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} transform="rotate(-90 56 56)" />
      </svg>
      <div className="-mt-28 flex h-28 flex-col items-center justify-center text-center">
        <div className="font-display text-3xl font-semibold text-[var(--gv-text-primary)]">{value.toFixed(1)}%</div>
        <div className="mt-1 text-xs font-semibold text-[var(--gv-accent-hover)]">{label}</div>
      </div>
    </div>
  );
}

function DashboardChartCard({ categoryScores }: { categoryScores: ReturnType<typeof deriveDashboardOverview>["categoryScores"] }) {
  return (
    <section className="gv-card p-5" aria-labelledby="readiness-visualization-title">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="readiness-visualization-title" className="font-display text-lg font-semibold text-[var(--gv-text-primary)]">Validation readiness by domain</h2>
          <p className="mt-1 text-sm text-[var(--gv-text-muted)]">Scores are derived from the active validation payload category averages.</p>
        </div>
        <span className="gv-badge gv-badge-neutral">Evidence-backed</span>
      </div>
      <div className="grid h-[248px] grid-cols-6 items-end gap-3 border-b border-l border-[var(--gv-border-default)] px-4 pb-4 pt-6" role="img" aria-label={`Category readiness: ${categoryScores.map((item) => `${item.label} ${item.score.toFixed(1)} percent`).join(", ")}`}>
        {categoryScores.map((item) => (
          <div key={item.id} className="flex h-full flex-col justify-end gap-2 text-center">
            <div className="relative flex flex-1 items-end justify-center rounded-t-xl bg-slate-950/40">
              <div className={`w-full rounded-t-xl ${item.status === "pass" ? "bg-[linear-gradient(180deg,var(--gv-accent-hover),var(--gv-accent))]" : item.status === "warning" ? "bg-amber-400" : item.status === "fail" ? "bg-red-500" : "bg-slate-600"}`} style={{ height: `${Math.max(4, Math.min(100, item.score))}%` }} />
              <span className="absolute -top-5 text-[10px] font-mono text-[var(--gv-text-muted)]">{item.score.toFixed(0)}%</span>
            </div>
            <span className="truncate text-[10px] text-[var(--gv-text-faint)]" title={item.label}>{item.label.split(" ")[0]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}


function PortalApp() {
  const [activeTab, setActiveTab] = useState<"diagnostics" | "benchmarks">("diagnostics");
  const [selectedScenario, setSelectedScenario] = useState<"healthy" | "degraded">("degraded");
  const [selectedSourceId, setSelectedSourceId] = useState("simulated-degraded");
  const [evidenceSources, setEvidenceSources] = useState<EvidenceSourceOption[]>(fallbackSources);
  const [cluster, setCluster] = useState<Cluster | null>(null);
  const [selectedNodeName, setSelectedNodeName] = useState<string>("dgx01");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("Loading scenario evidence...");
  const [error, setError] = useState<string | null>(null);
  const [expandedChecks, setExpandedChecks] = useState<Record<string, boolean>>({});

  const fetchResults = async (source: EvidenceSourceOption) => {
    setLoading(true);
    setError(null);
    setLoadingMessage(`Loading ${source.label.toLowerCase()} evidence...`);
    setCluster(null);
    setExpandedChecks({});

    try {
      const response = await fetch(source.endpoint);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Failed to load validation results." }));
        throw new Error(payload.error ?? "Failed to load validation results.");
      }

      const data = (await response.json()) as Cluster;
      setCluster(data);
      const firstPriorityNode = data.nodes.find((node) => node.status !== "pass") ?? data.nodes[0];
      if (firstPriorityNode) {
        setSelectedNodeName(firstPriorityNode.name);
      }
    } catch (fetchError) {
      console.error(fetchError);
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load validation results.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch("/api/evidence-sources")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Failed to load evidence sources.")))
      .then((payload) => {
        const sources = Array.isArray(payload.sources) ? payload.sources.filter((source: EvidenceSourceOption) => source.available) : fallbackSources;
        setEvidenceSources(sources.length ? sources : fallbackSources);
      })
      .catch(() => setEvidenceSources(fallbackSources));
  }, []);

  useEffect(() => {
    const source = evidenceSources.find((candidate) => candidate.id === selectedSourceId) ?? fallbackSources[1];
    fetchResults(source);
  }, [selectedSourceId, evidenceSources]);

  const selectSimulatedScenario = (scenario: "healthy" | "degraded") => {
    setSelectedScenario(scenario);
    setSelectedSourceId(`simulated-${scenario}`);
  };

  const acceptanceGate = useMemo(() => deriveAcceptanceGate(cluster), [cluster]);
  const dashboardOverview = useMemo(() => deriveDashboardOverview(cluster), [cluster]);
  const gpuHealth = useMemo(() => deriveGpuHealth(cluster), [cluster]);
  const fabricHealth = useMemo(() => deriveFabricHealth(cluster), [cluster]);
  const schedulerSnapshot = useMemo(() => deriveSchedulerSnapshot(cluster), [cluster]);
  const validationProfile = useMemo(() => deriveValidationProfile(cluster), [cluster]);
  const benchmarkCatalog = useMemo(() => buildBenchmarkCatalog(cluster), [cluster]);
  const reportLinks = useMemo(() => buildArtifactLinks(selectedScenario), [selectedScenario]);
  const selectedSource = evidenceSources.find((source) => source.id === selectedSourceId) ?? fallbackSources[1];
  const sourceContext = useMemo(() => buildSourceContext(cluster, selectedSource), [cluster, selectedSource]);
  const simulated = isSimulatedScenario(cluster);
  const selectedNode = cluster?.nodes.find((node) => node.name === selectedNodeName) ?? cluster?.nodes[0] ?? null;

  const criticalCount = countChecks(cluster, (check) => check.status === "fail" && check.severity === "critical");
  const warningCount = countChecks(cluster, (check) => check.status === "warning");
  const nodeCount = cluster?.nodes.length ?? 0;
  const attentionChecks = useMemo(() => getAllChecks(cluster).filter((check) => check.status !== "pass").slice(0, 6), [cluster]);
  const recentChecks = useMemo(() => getAllChecks(cluster).slice(0, 7), [cluster]);

  const categoryAverages = cluster?.metadata?.category_averages ?? {};
  const categoryCards = [
    { id: "gpu", label: "GPU & DCGM" },
    { id: "network", label: "InfiniBand / RDMA" },
    { id: "linux", label: "Linux Platform" },
    { id: "slurm", label: "Slurm" },
    { id: "kubernetes", label: "Kubernetes" },
    { id: "storage", label: "Storage" },
  ];

  const toggleCheck = (checkId: string) => {
    setExpandedChecks((current) => ({
      ...current,
      [checkId]: !current[checkId],
    }));
  };

  if (window.location.pathname === "/login") {
    return <LoginPage />;
  }

  return (
    <EngagementShell>
      <section className="gv-page-header">
        <div className="min-w-0">
          <div className="gv-eyebrow">Overview</div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--gv-text-primary)] md:text-4xl"><span className="sr-only">GPU Validator </span>Infrastructure Overview</h1>
            <span className={`gv-badge ${acceptanceGate.handoffApproved ? "gv-badge-success" : "border-red-500/25 bg-red-500/10 text-red-300"}`}>{acceptanceGate.handoffDecision}</span>
            {simulated && <span className="gv-badge gv-badge-neutral">Simulated scenario</span>}
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--gv-text-muted)] md:text-base">Validation readiness, benchmark evidence, and system health across the selected infrastructure scope.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {scopeBadges.map((item) => <span key={item} className="gv-badge gv-badge-neutral">{item}</span>)}
          </div>
        </div>
        <div className="grid gap-3 lg:min-w-[420px]">
          <div className="gv-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="gv-eyebrow text-[var(--gv-text-faint)]">Scenario controls</div>
                <div className="mt-1 text-sm text-[var(--gv-text-secondary)]">Current scenario: {scenarioMetadata[selectedScenario].label}</div>
              </div>
              <div className="flex gap-2 rounded-xl border border-[var(--gv-border-default)] bg-[var(--gv-bg-canvas)] p-1">
                {(["healthy", "degraded"] as const).map((scenario) => {
                  const active = scenario === selectedScenario;
                  return (
                    <button
                      key={scenario}
                      onClick={() => selectSimulatedScenario(scenario)}
                      disabled={loading}
                      className={`rounded-lg border px-3.5 py-2 text-xs font-mono uppercase tracking-wider transition ${active ? scenario === "healthy" ? "border-emerald-500/25 bg-emerald-500/12 text-emerald-300" : "border-red-500/25 bg-red-500/12 text-red-300" : "border-transparent text-slate-400 hover:text-slate-200"}`}
                    >
                      {scenarioMetadata[scenario].shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-[var(--gv-text-muted)]">{scenarioMetadata[selectedScenario].description}</p>
          </div>
          <div className="gv-card p-4">
            <label htmlFor="evidence-source" className="gv-eyebrow text-[var(--gv-text-faint)]">Evidence source</label>
            <select
              id="evidence-source"
              value={selectedSourceId}
              disabled={loading}
              onChange={(event) => {
                const nextSource = evidenceSources.find((source) => source.id === event.target.value);
                setSelectedSourceId(event.target.value);
                if (nextSource?.id === "simulated-healthy") setSelectedScenario("healthy");
                if (nextSource?.id === "simulated-degraded") setSelectedScenario("degraded");
              }}
              className="gv-select mt-2 w-full"
            >
              {evidenceSources.map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}
            </select>
            <p className="mt-2 text-xs leading-relaxed text-[var(--gv-text-muted)]">{selectedSource.description ?? "Only valid live artifacts are listed; simulated scenarios remain available for demonstration."}</p>
          </div>
        </div>
      </section>

      {loading && (
        <section className="gv-card mb-5 flex items-center gap-3 p-5">
          <RefreshCw className="h-5 w-5 animate-spin text-[var(--gv-accent-hover)]" />
          <div>
            <div className="text-sm font-semibold text-[var(--gv-text-primary)]">{loadingMessage}</div>
            <div className="text-xs text-[var(--gv-text-muted)]">Refreshing portal state from the existing validation API.</div>
          </div>
        </section>
      )}

      {error && (
        <section className="mb-5 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-red-400" />
          <div>
            <div className="text-sm font-semibold text-red-200">Controlled error state</div>
            <div className="mt-1 text-sm text-red-100/80">{error}</div>
          </div>
        </section>
      )}

      {!loading && !cluster && !error && (
        <section className="gv-card p-10 text-center">
          <Sparkles className="mx-auto mb-3 h-8 w-8 text-slate-500" />
          <div className="text-sm font-semibold text-[var(--gv-text-primary)]">No validation evidence loaded.</div>
          <div className="mt-2 text-xs text-[var(--gv-text-muted)]">Choose a scenario or evidence source to populate the dashboard.</div>
        </section>
      )}

      {cluster && (
        <div className="space-y-5">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5" aria-label="Dashboard KPI summary">
            <DashboardKpiCard label="Validation score" value={`${dashboardOverview.readinessScore.toFixed(2)}%`} description={`${dashboardOverview.passedChecks}/${dashboardOverview.totalChecks} checks passing`} tone={dashboardOverview.acceptanceApproved ? "healthy" : "warning"} icon={Gauge} />
            <DashboardKpiCard label="Evidence coverage" value={`${dashboardOverview.evidenceCoveragePercent}%`} description={`${dashboardOverview.totalChecks} checks carry command evidence`} tone="healthy" icon={ShieldCheck} />
            <DashboardKpiCard label="Findings" value={dashboardOverview.failedChecks + dashboardOverview.warningChecks} description={`${dashboardOverview.failedChecks} failed • ${dashboardOverview.warningChecks} warning`} tone={dashboardOverview.failedChecks > 0 ? "critical" : dashboardOverview.warningChecks > 0 ? "warning" : "healthy"} icon={AlertTriangle} />
            <DashboardKpiCard label="Infrastructure scope" value={dashboardOverview.nodeCount} description={`${gpuHealth.discoveredGpuCount} discovered GPUs from current payload`} tone="neutral" icon={Server} />
            <DashboardKpiCard label="Benchmark evidence" value={dashboardOverview.benchmarkCount} description={dashboardOverview.benchmarkCount ? "Embedded benchmark payloads available" : "No benchmark payload embedded"} tone={dashboardOverview.benchmarkCount ? "healthy" : "neutral"} icon={Activity} />
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.35fr_0.75fr]">
            <DashboardChartCard categoryScores={dashboardOverview.categoryScores} />
            <section className="gv-card p-5" aria-labelledby="acceptance-readiness-title">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h2 id="acceptance-readiness-title" className="font-display text-lg font-semibold text-[var(--gv-text-primary)]">Acceptance readiness</h2>
                  <p className="mt-1 text-sm text-[var(--gv-text-muted)]">Readiness score and handoff gate are separate operational signals.</p>
                </div>
                {acceptanceGate.handoffApproved ? <ShieldCheck className="h-5 w-5 text-[var(--gv-accent-hover)]" /> : <ShieldAlert className="h-5 w-5 text-red-400" />}
              </div>
              <ReadinessGauge value={dashboardOverview.readinessScore} label={dashboardOverview.statusLabel} />
              <div className="mt-4 space-y-3">
                <StatusProgressRow label="Diagnostics" value={dashboardOverview.readinessScore} status={dashboardOverview.failedChecks ? "fail" : dashboardOverview.warningChecks ? "warning" : "pass"} />
                <StatusProgressRow label="Evidence" value={dashboardOverview.evidenceCoveragePercent} status={dashboardOverview.evidenceCoveragePercent === 100 ? "pass" : "warning"} />
                <StatusProgressRow label="Acceptance criteria" value={acceptanceGate.handoffApproved ? 100 : 62} status={acceptanceGate.handoffApproved ? "pass" : "fail"} />
                <StatusProgressRow label="Report completeness" value={100} status="pass" />
              </div>
            </section>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1fr_0.95fr]">
            <section className="gv-card overflow-hidden" aria-labelledby="diagnostics-summary-title">
              <div className="flex items-start justify-between gap-3 border-b border-[var(--gv-border-default)] p-5">
                <div>
                  <h2 id="diagnostics-summary-title" className="font-display text-lg font-semibold text-[var(--gv-text-primary)]">Diagnostics summary</h2>
                  <p className="mt-1 text-sm text-[var(--gv-text-muted)]">Highest-priority validation findings from the active scenario.</p>
                </div>
                <button onClick={() => setActiveTab("diagnostics")} className="gv-button-secondary py-2 text-xs">View diagnostics</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="bg-slate-950/50 text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--gv-text-faint)]">
                    <tr><th className="px-5 py-3">Check</th><th className="px-5 py-3">Node</th><th className="px-5 py-3">Severity</th><th className="px-5 py-3">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--gv-border-default)]">
                    {(attentionChecks.length ? attentionChecks : recentChecks).map((check) => (
                      <tr key={`${check.node}-${check.id}`} className="hover:bg-white/[0.02]">
                        <td className="px-5 py-3"><div className="font-medium text-[var(--gv-text-primary)]">{check.title}</div><div className="mt-1 max-w-md text-[var(--gv-text-muted)]">Evidence-backed {formatStatusLabel(check.category)} validation check</div></td>
                        <td className="px-5 py-3 font-mono text-[var(--gv-text-muted)]">{check.node}</td>
                        <td className="px-5 py-3 uppercase text-[var(--gv-text-muted)]">{check.severity}</td>
                        <td className="px-5 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-mono uppercase ${pillClassesForStatus(check.status)}`}>{formatStatusLabel(check.status)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="gv-card p-5" aria-labelledby="benchmark-summary-title">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 id="benchmark-summary-title" className="font-display text-lg font-semibold text-[var(--gv-text-primary)]">Benchmark summary</h2>
                  <p className="mt-1 text-sm text-[var(--gv-text-muted)]">Current payload benchmark evidence and supported ingestion families.</p>
                </div>
                <button onClick={() => setActiveTab("benchmarks")} className="gv-button-secondary py-2 text-xs">View benchmarks</button>
              </div>
              {cluster.benchmark_results.length ? (
                <div className="space-y-3">
                  {cluster.benchmark_results.slice(0, 3).map((result) => (
                    <div key={`${result.benchmark_type}-${result.timestamp}`} className="rounded-2xl border border-[var(--gv-border-default)] bg-slate-950/30 p-3">
                      <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-[var(--gv-text-primary)]">{result.benchmark_type}</span><span className={`rounded-full px-2.5 py-1 text-[10px] font-mono uppercase ${pillClassesForStatus(result.status)}`}>{formatStatusLabel(result.status)}</span></div>
                      <div className="mt-2 text-xs text-[var(--gv-text-muted)]">{Object.entries(result.metrics).slice(0, 3).map(([key, value]) => `${key}: ${value ?? "n/a"}`).join(" • ")}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[var(--gv-border-default)] bg-slate-950/25 p-4 text-sm text-[var(--gv-text-muted)]">No benchmark results are embedded in the current scenario. Supported result ingestion remains available without presenting fabricated NCCL/HPL values.</div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {benchmarkCatalog.supportedIngestion.slice(0, 5).map((name) => <span key={name} className="gv-badge gv-badge-neutral">{name}</span>)}
              </div>
            </section>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <section className="gv-card p-5" aria-labelledby="acceptance-gate-title">
              <div className="mb-4 flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-[var(--gv-accent-hover)]" /><h2 id="acceptance-gate-title" className="font-display text-lg font-semibold text-[var(--gv-text-primary)]">Customer Acceptance Gate</h2></div>
              <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
                <div>
                  <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${pillClassesForStatus(acceptanceGate.handoffDecision)}`}>{acceptanceGate.handoffDecision}</span>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--gv-text-secondary)]">{acceptanceGate.blockedReason}</p>
                  <p className="mt-3 rounded-2xl border border-[var(--gv-border-default)] bg-slate-950/30 p-4 text-sm leading-relaxed text-[var(--gv-text-muted)]">{acceptanceGate.explanatoryText}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[{ label: "Critical", value: acceptanceGate.criticalFindings }, { label: "High", value: acceptanceGate.highSeverityFindings }, { label: "Recommendations", value: acceptanceGate.unresolvedRecommendations }, { label: "Approved", value: acceptanceGate.handoffApproved ? "Yes" : "No" }].map((item) => <div key={item.label} className="rounded-2xl border border-[var(--gv-border-default)] bg-slate-950/30 p-4"><div className="gv-eyebrow text-[var(--gv-text-faint)]">{item.label}</div><div className="mt-2 font-display text-2xl font-semibold text-[var(--gv-text-primary)]">{item.value}</div></div>)}
                </div>
              </div>
            </section>

            <section className="gv-card p-5" aria-labelledby="evidence-report-title">
              {sourceContext.importedEvidenceBanner && <div role="status" className="mb-4 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-3 text-sm font-semibold text-amber-100">{sourceContext.importedEvidenceBanner}</div>}
              <div className="gv-eyebrow text-[var(--gv-accent-hover)]">Source context</div>
              <h2 id="evidence-report-title" className="mt-2 font-display text-lg font-semibold text-[var(--gv-text-primary)]">Evidence and report activity</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--gv-text-muted)]">Evidence source: {sourceContext.evidenceSource} • Selected validation profile: {sourceContext.selectedValidationProfile} • Detected environment: {sourceContext.detectedEnvironment}</p>
              <div className="mt-4 grid gap-3 text-sm">
                <div className="flex justify-between gap-3"><span className="text-[var(--gv-text-muted)]">Collection timestamp</span><span className="text-right text-[var(--gv-text-secondary)]">{sourceContext.collectionTimestamp}</span></div>
                <div className="flex justify-between gap-3"><span className="text-[var(--gv-text-muted)]">Hardware identity status</span><span className="text-right text-[var(--gv-text-secondary)]">{sourceContext.hardwareIdentityStatus}</span></div>
                <div className="flex justify-between gap-3"><span className="text-[var(--gv-text-muted)]">Sanitization status</span><span className="text-right text-[var(--gv-text-secondary)]">{sourceContext.sanitizationStatus}</span></div>
                <div className="flex justify-between gap-3"><span className="text-[var(--gv-text-muted)]">Source confidence</span><span className="text-right text-[var(--gv-text-secondary)]">{sourceContext.sourceConfidence}</span></div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href={reportLinks.html} target="_blank" rel="noreferrer" className="gv-button-secondary py-2 text-xs"><FileText className="h-3.5 w-3.5" /> HTML report</a>
                <a href={reportLinks.markdown} target="_blank" rel="noreferrer" className="gv-button-secondary py-2 text-xs"><FileText className="h-3.5 w-3.5" /> Markdown</a>
                <a href={reportLinks.json} target="_blank" rel="noreferrer" className="gv-button-secondary py-2 text-xs"><FileJson className="h-3.5 w-3.5" /> JSON evidence</a>
              </div>
              <div className="mt-4 rounded-2xl border border-[var(--gv-border-default)] bg-slate-950/30 p-3"><div className="gv-eyebrow text-[var(--gv-text-faint)]">Limitations</div><ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-[var(--gv-text-muted)]">{sourceContext.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></div>
            </section>
          </section>

          <section className="gv-card p-5" aria-labelledby="quick-actions-title">
            <h2 id="quick-actions-title" className="font-display text-lg font-semibold text-[var(--gv-text-primary)]">Quick actions</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <button onClick={() => setActiveTab("diagnostics")} className="rounded-2xl border border-[var(--gv-border-default)] bg-slate-950/30 p-4 text-left transition hover:border-[var(--gv-border-highlight)]"><ShieldCheck className="mb-3 h-5 w-5 text-[var(--gv-accent-hover)]" /><div className="text-sm font-semibold text-[var(--gv-text-primary)]">View diagnostics</div><div className="mt-1 text-xs text-[var(--gv-text-muted)]">Inspect validation evidence</div></button>
              <button onClick={() => setActiveTab("benchmarks")} className="rounded-2xl border border-[var(--gv-border-default)] bg-slate-950/30 p-4 text-left transition hover:border-[var(--gv-border-highlight)]"><Gauge className="mb-3 h-5 w-5 text-[var(--gv-accent-hover)]" /><div className="text-sm font-semibold text-[var(--gv-text-primary)]">View benchmarks</div><div className="mt-1 text-xs text-[var(--gv-text-muted)]">Review supported ingestion</div></button>
              <a href="/portal/engagements" className="rounded-2xl border border-[var(--gv-border-default)] bg-slate-950/30 p-4 transition hover:border-[var(--gv-border-highlight)]"><Server className="mb-3 h-5 w-5 text-[var(--gv-accent-hover)]" /><div className="text-sm font-semibold text-[var(--gv-text-primary)]">Open engagements</div><div className="mt-1 text-xs text-[var(--gv-text-muted)]">Manage validation workspaces</div></a>
              <a href="/portal/library" className="rounded-2xl border border-[var(--gv-border-default)] bg-slate-950/30 p-4 transition hover:border-[var(--gv-border-highlight)]"><Layers className="mb-3 h-5 w-5 text-[var(--gv-accent-hover)]" /><div className="text-sm font-semibold text-[var(--gv-text-primary)]">Operations library</div><div className="mt-1 text-xs text-[var(--gv-text-muted)]">Open safe runbooks</div></a>
            </div>
          </section>

          <div className="flex max-w-md rounded-xl border border-slate-800 bg-slate-950/50 p-1" aria-label="Dashboard detail tabs">
            <button onClick={() => setActiveTab("diagnostics")} className={`flex-1 rounded-lg px-4 py-2.5 text-xs font-display font-semibold uppercase tracking-[0.18em] transition cursor-pointer ${activeTab === "diagnostics" ? "bg-slate-900 text-slate-100 border border-slate-700" : "text-slate-400 hover:text-slate-200"}`}>Diagnostics</button>
            <button onClick={() => setActiveTab("benchmarks")} className={`flex-1 rounded-lg px-4 py-2.5 text-xs font-display font-semibold uppercase tracking-[0.18em] transition cursor-pointer ${activeTab === "benchmarks" ? "bg-slate-900 text-slate-100 border border-slate-700" : "text-slate-400 hover:text-slate-200"}`}>Benchmark readiness</button>
          </div>
        </div>
      )}

        {cluster && activeTab === "diagnostics" && (
          <>
            <section className="cyber-panel rounded-2xl border border-slate-800/80 p-6">
              <div className="flex items-center gap-2 mb-4">
                <ShieldAlert className="h-5 w-5 text-emerald-400" />
                <h2 className="text-lg font-display font-semibold text-slate-50">Customer Acceptance Gate</h2>
              </div>
              <div className="grid gap-5 lg:grid-cols-[1.3fr_0.9fr]">
                <div className="space-y-4">
                  <div>
                    <div className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${pillClassesForStatus(acceptanceGate.handoffDecision)}`}>
                      {acceptanceGate.handoffDecision}
                    </div>
                    <p className="mt-3 text-sm text-slate-300 leading-relaxed">{acceptanceGate.blockedReason}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300 leading-relaxed">
                    The readiness score measures aggregate infrastructure health, while the customer acceptance gate enforces release-blocking conditions. A critical GPU fault blocks handoff even when most other checks pass.
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  {[
                    { label: "Critical findings", value: acceptanceGate.criticalFindings },
                    { label: "High-severity findings", value: acceptanceGate.highSeverityFindings },
                    { label: "Unresolved recommendations", value: acceptanceGate.unresolvedRecommendations },
                    { label: "Handoff approved", value: acceptanceGate.handoffApproved ? "Yes" : "No" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
                      <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">{item.label}</div>
                      <div className="mt-2 text-2xl font-display font-semibold text-slate-50">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {categoryCards.map((category) => (
                <div key={category.id} className="cyber-panel rounded-2xl border border-slate-800/80 p-4">
                  <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">{category.label}</div>
                  <div className="mt-2 text-2xl font-display font-semibold text-slate-50">
                    {(categoryAverages[category.id] ?? 0).toFixed(2)}%
                  </div>
                </div>
              ))}
            </section>

            <section className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-8">
                <section className="cyber-panel rounded-2xl border border-slate-800/80 p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
                    <div>
                      <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">Validation Profile</div>
                      <h2 className="mt-2 text-lg font-display font-semibold text-slate-50">Cluster Topology</h2>
                      <p className="mt-2 text-sm text-slate-400 max-w-2xl">
                        Four simulated compute nodes are shown below. Status indicators are derived from the active validation payload, not from hard-coded scenario copy.
                      </p>
                    </div>
                    <div className="text-xs text-slate-400">{validationProfile.scope}</div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {cluster.nodes.map((node) => {
                      const selected = node.name === selectedNode?.name;
                      const gpuStatus = getCategoryStatus(node, "gpu");
                      const networkStatus = getCategoryStatus(node, "network");
                      const slurmStatus = getCategoryStatus(node, "slurm");
                      const kubernetesStatus = getCategoryStatus(node, "kubernetes");

                      return (
                        <button
                          key={node.name}
                          onClick={() => setSelectedNodeName(node.name)}
                          className={`${nodeCardClasses(node.status, selected)} text-left cursor-pointer`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-display font-semibold text-slate-50 uppercase tracking-wide">{node.name}</div>
                              <div className="text-xs text-slate-500 mt-1">{node.ip_address ?? "No IP reported"}</div>
                            </div>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider ${pillClassesForStatus(node.status)}`}>
                              {formatStatusLabel(node.status)}
                            </span>
                          </div>

                          <div className="mt-4 grid gap-2 text-xs text-slate-300">
                            {[
                              { label: "Node readiness", status: node.status },
                              { label: "GPU health", status: gpuStatus },
                              { label: "InfiniBand health", status: networkStatus },
                              { label: "Slurm state", status: slurmStatus },
                              { label: "Kubernetes", status: kubernetesStatus },
                            ].map((item) => (
                              <div key={item.label} className="flex items-center justify-between gap-3">
                                <span className="text-slate-400">{item.label}</span>
                                <span className={`inline-flex items-center gap-1 font-medium ${statusIconClasses[item.status]}`}>
                                  <span className={`h-2 w-2 rounded-full ${item.status === "pass" ? "bg-emerald-400" : item.status === "warning" ? "bg-amber-400" : item.status === "fail" ? "bg-red-400" : "bg-slate-500"}`} />
                                  {formatStatusLabel(item.status)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {selectedNode && (
                    <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/30 p-5">
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div>
                          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">Selected node</div>
                          <h3 className="mt-2 text-lg font-display font-semibold text-slate-50 uppercase">{selectedNode.name}</h3>
                          <p className="mt-2 text-sm text-slate-400 max-w-2xl">
                            {selectedNode.name === "dgx03" && selectedScenario === "degraded"
                              ? "InfiniBand link health is degraded while the node remains otherwise available for investigation."
                              : selectedNode.name === "dgx04" && selectedScenario === "degraded"
                                ? "The node remains isolated from production scheduling while the critical GPU condition is investigated."
                                : "Node evidence is within the current validation profile."}
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${pillClassesForStatus(selectedNode.status)}`}>
                          {formatStatusLabel(selectedNode.status)}
                        </span>
                      </div>

                      <div className="mt-5 grid gap-4">
                        {(Object.values(selectedNode.categories) as Array<Node["categories"][string]>).map((category) => {
                          const checks = category.checks ?? [];
                          const failures = checks.filter((check) => check.status !== "pass");
                          return (
                            <div key={category.id} className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                                <div>
                                  <div className="text-sm font-semibold text-slate-100">{category.name}</div>
                                  <div className="text-xs text-slate-500 mt-1">{checks.length} checks • {failures.length} active findings</div>
                                </div>
                                <div className="text-xs text-slate-400">Weight: {category.weight}%</div>
                              </div>
                              <div className="space-y-3">
                                {checks.map((check) => {
                                  const expanded = expandedChecks[check.id];
                                  return (
                                    <div key={check.id} className="rounded-xl border border-slate-800 bg-slate-900/40">
                                      <button
                                        onClick={() => toggleCheck(check.id)}
                                        className="w-full px-4 py-3 flex items-start justify-between gap-3 text-left cursor-pointer"
                                      >
                                        <div className="flex items-start gap-3">
                                          <ChevronRight className={`h-4 w-4 mt-0.5 text-slate-500 transition-transform ${expanded ? "rotate-90" : ""}`} />
                                          <div>
                                            <div className="text-sm text-slate-100 font-medium">{check.title}</div>
                                            <div className="mt-1 text-xs text-slate-400 leading-relaxed">{check.summary}</div>
                                          </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-2 shrink-0">
                                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider ${pillClassesForStatus(check.status)}`}>
                                            {formatStatusLabel(check.status)}
                                          </span>
                                          <span className="text-[11px] text-slate-500 uppercase tracking-wider">{check.severity}</span>
                                        </div>
                                      </button>
                                      {expanded && (
                                        <div className="border-t border-slate-800 px-4 py-4 space-y-3 text-sm text-slate-300">
                                          {check.recommendation && (
                                            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                                              <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-amber-300">Remediation workflow</div>
                                              <div className="mt-2 text-sm text-slate-200 leading-relaxed">{check.recommendation}</div>
                                            </div>
                                          )}
                                          {check.evidence?.length ? (
                                            check.evidence.map((evidence, index) => (
                                              <div key={`${check.id}-${index}`} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                                                <div className="text-[11px] font-mono text-slate-500 uppercase tracking-[0.2em]">
                                                  Evidence command
                                                </div>
                                                <div className="mt-2 text-xs text-slate-200 font-mono break-all">{evidence.command.join(" ")}</div>
                                                <div className="mt-3 grid gap-2 md:grid-cols-3 text-xs text-slate-400">
                                                  <div>Exit code: {evidence.exit_code}</div>
                                                  <div>Duration: {evidence.duration_seconds}s</div>
                                                  <div>{new Date(evidence.timestamp).toLocaleString()}</div>
                                                </div>
                                                {(evidence.stdout || evidence.stderr) && (
                                                  <pre className="mt-3 rounded-xl border border-slate-800 bg-black/40 p-3 text-[11px] text-slate-300 overflow-x-auto whitespace-pre-wrap">
                                                    {evidence.stdout || evidence.stderr}
                                                  </pre>
                                                )}
                                              </div>
                                            ))
                                          ) : (
                                            <div className="text-xs text-slate-500">No command evidence was attached to this check.</div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </section>

                <section className="cyber-panel rounded-2xl border border-slate-800/80 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Cpu className="h-5 w-5 text-emerald-400" />
                    <h2 className="text-lg font-display font-semibold text-slate-50">GPU Health</h2>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {[
                      { label: "Discovered GPUs", value: gpuHealth.discoveredGpuCount },
                      { label: "Healthy GPUs", value: gpuHealth.healthyGpuCount },
                      { label: "Warning GPUs", value: gpuHealth.warningGpuCount },
                      { label: "Critical GPUs", value: gpuHealth.criticalGpuCount },
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
                        <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">{item.label}</div>
                        <div className="mt-2 text-2xl font-display font-semibold text-slate-50">{item.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4 space-y-3">
                      <div>
                        <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">ECC condition</div>
                        <div className="mt-2 text-sm text-slate-200 leading-relaxed">{gpuHealth.eccCondition}</div>
                      </div>
                      <div className="text-sm text-slate-400 leading-relaxed">{gpuHealth.nvlinkStatus}</div>
                      <div className="text-sm text-slate-400 leading-relaxed">{gpuHealth.dcgmStatus}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
                      <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">Operational response</div>
                      <div className="mt-2 text-sm text-slate-200 leading-relaxed">{gpuHealth.operationalResponse}</div>
                    </div>
                  </div>
                </section>

                <section className="cyber-panel rounded-2xl border border-slate-800/80 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Network className="h-5 w-5 text-emerald-400" />
                    <h2 className="text-lg font-display font-semibold text-slate-50">InfiniBand / RDMA Fabric Health</h2>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    {[
                      { label: "Active ports", value: fabricHealth.activePorts },
                      { label: "Degraded ports", value: fabricHealth.degradedPorts },
                      { label: "Inactive ports", value: fabricHealth.inactivePorts },
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
                        <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">{item.label}</div>
                        <div className="mt-2 text-2xl font-display font-semibold text-slate-50">{item.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4 space-y-3">
                      <div>
                        <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">Affected node</div>
                        <div className="mt-2 text-sm text-slate-200">{fabricHealth.affectedNode ?? "No degraded node reported"}</div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2 text-sm text-slate-300">
                        <div>
                          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 mb-2">Expected link</div>
                          <div>{fabricHealth.expectedLink}</div>
                        </div>
                        <div>
                          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 mb-2">Negotiated link</div>
                          <div>{fabricHealth.negotiatedLink}</div>
                        </div>
                      </div>
                      <div className="text-sm text-slate-400 leading-relaxed">{fabricHealth.summary}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
                      <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">Remediation workflow</div>
                      <ol className="mt-3 space-y-2 text-sm text-slate-200 list-decimal pl-5">
                        {fabricHealth.remediationWorkflow.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </section>
              </div>

              <div className="space-y-8">
                <section className="cyber-panel rounded-2xl border border-slate-800/80 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Layers className="h-5 w-5 text-emerald-400" />
                    <h2 className="text-lg font-display font-semibold text-slate-50">Scheduler and Orchestration</h2>
                  </div>
                  <div className="space-y-3">
                    {schedulerSnapshot.map((item) => (
                      <div key={item.node} className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold uppercase text-slate-50">{item.node}</div>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider ${pillClassesForStatus(item.slurmState)}`}>
                            Slurm {item.slurmState}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-slate-300">
                          <div className="flex justify-between gap-3">
                            <span className="text-slate-400">Kubernetes</span>
                            <span>{item.kubernetesState}</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-slate-400">GPU Operator / device plugin</span>
                            <span className="text-right">{item.gpuOperatorState}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/30 p-4 text-sm text-slate-300 leading-relaxed">
                    The node remains isolated from production scheduling while the critical GPU condition is investigated.
                  </div>
                </section>

                <section className="cyber-panel rounded-2xl border border-slate-800/80 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Waypoints className="h-5 w-5 text-emerald-400" />
                    <h2 className="text-lg font-display font-semibold text-slate-50">Customer Handoff Summary</h2>
                  </div>
                  <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
                    <div>
                      <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">Acceptance outcome</div>
                      <div className="mt-2 text-slate-100 font-medium">{acceptanceGate.handoffDecision}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">Blocking findings</div>
                      <div className="mt-2">{acceptanceGate.blockedReason}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">Required remediation</div>
                      <div className="mt-2">
                        {cluster.classification === "Ready"
                          ? "The simulated environment meets the current validation profile."
                          : "Resolve the critical ECC issue, retain scheduler isolation until the hardware condition is confirmed, and re-run validation after remediation."}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">Evidence collected</div>
                      <div className="mt-2">{getAllChecks(cluster).length} validation checks across {nodeCount} nodes.</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">Report formats available</div>
                      <div className="mt-2">Standalone HTML • Markdown summary • JSON evidence</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">Next validation step</div>
                      <div className="mt-2">
                        {cluster.classification === "Ready"
                          ? "Proceed with customer acceptance walkthrough using the healthy simulated profile."
                          : "Keep dgx04 drained, complete GPU diagnostics, remediate the ECC fault, and repeat the degraded scenario acceptance run."}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="cyber-panel rounded-2xl border border-slate-800/80 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-5 w-5 text-emerald-400" />
                    <h2 className="text-lg font-display font-semibold text-slate-50">Interview Walkthrough</h2>
                  </div>
                  <details className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4 group" open>
                    <summary className="cursor-pointer list-none flex items-center justify-between gap-3 text-sm text-slate-100 font-medium">
                      <span>Two-minute portal walkthrough</span>
                      <ChevronRight className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-90" />
                    </summary>
                    <ol className="mt-4 list-decimal pl-5 space-y-2 text-sm text-slate-300 leading-relaxed">
                      <li>Explain the readiness score.</li>
                      <li>Explain the customer acceptance gate.</li>
                      <li>Show dgx03 InfiniBand degradation.</li>
                      <li>Show dgx04 GPU ECC failure.</li>
                      <li>Explain Slurm isolation.</li>
                      <li>Show remediation guidance.</li>
                      <li>Explain future Base Command Manager or Ansible orchestration.</li>
                    </ol>
                  </details>
                </section>
              </div>
            </section>
          </>
        )}

        {cluster && activeTab === "benchmarks" && (
          <section className="space-y-8">
            <section className="cyber-panel rounded-2xl border border-slate-800/80 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Gauge className="h-5 w-5 text-emerald-400" />
                <h2 className="text-lg font-display font-semibold text-slate-50">Benchmark Readiness</h2>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed max-w-3xl">
                This portal recognizes benchmark evidence as part of customer acceptance, while keeping execution orchestration out of scope for the current interview MVP.
              </p>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {benchmarkCatalog.supportedIngestion.map((name) => (
                  <div key={name} className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
                    <div className="text-sm font-semibold text-slate-100">{name}</div>
                    <div className="mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider bg-emerald-500/12 text-emerald-300 border border-emerald-500/25">
                      Supported result ingestion
                    </div>
                  </div>
                ))}
                {benchmarkCatalog.roadmapOnly.map((name) => (
                  <div key={name} className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
                    <div className="text-sm font-semibold text-slate-100">{name}</div>
                    <div className="mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider bg-slate-900 text-slate-300 border border-slate-700">
                      Roadmap only
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="cyber-panel rounded-2xl border border-slate-800/80 p-6">
                <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">Demonstrated sample data</div>
                {cluster.benchmark_results.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {cluster.benchmark_results.map((result) => (
                      <div key={`${result.benchmark_type}-${result.timestamp}`} className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-slate-100">{result.benchmark_type}</div>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider ${pillClassesForStatus(result.status)}`}>
                            {formatStatusLabel(result.status)}
                          </span>
                        </div>
                        <pre className="mt-3 overflow-x-auto rounded-xl border border-slate-800 bg-black/30 p-3 text-[11px] text-slate-300 whitespace-pre-wrap">
                          {JSON.stringify(result.metrics, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-800 bg-slate-950/20 p-5 text-sm text-slate-400">
                    No benchmark results are embedded in the current simulated scenario. The portal still advertises recognized benchmark families and keeps execution orchestration as a future workflow.
                  </div>
                )}
              </div>

              <div className="cyber-panel rounded-2xl border border-slate-800/80 p-6">
                <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">Future orchestration</div>
                <div className="mt-4 space-y-3 text-sm text-slate-300 leading-relaxed">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
                    Base Command Manager integration, Ansible multi-node collection, DCGM orchestration, NCCL execution, HPL and HPL-AI execution, MLPerf result integration, baseline comparison, configuration drift detection, and customer acceptance workflow automation remain roadmap items only.
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
                    The current implementation intentionally limits itself to read-only live validation, deterministic scenarios, invite-only reviewer authentication, and report visualization without adding databases, public registration, telemetry, or benchmark orchestration services.
                  </div>
                </div>
              </div>
            </section>
          </section>
        )}
    </EngagementShell>
  );
}

export default function App() {
  const pathName = window.location.pathname;
  if (pathName === "/login") return <LoginPage />;
  if (pathName === "/portal/admin/users") return <AdminUsersPage />;
  if (pathName === "/portal/admin/users/new") return <AdminNewUserPage />;
  if (pathName.startsWith("/portal/admin/users/")) return <AdminUserDetailPage userId={decodeURIComponent(pathName.replace("/portal/admin/users/", ""))} />;
  if (pathName === "/portal/admin/demo") return <AdminDemoPage />;
  if (pathName === "/portal/admin/system") return <AdminSystemPage />;
  if (pathName === "/portal/library") return <OperationsLibraryPage />;
  if (pathName.startsWith("/portal/library/")) return <OperationsLibraryPage slug={decodeURIComponent(pathName.replace("/portal/library/", ""))} />;
  if (pathName === "/portal/engagements") return <EngagementListPage />;
  if (pathName === "/portal/engagements/new") return <NewEngagementPage />;
  if (pathName.startsWith("/portal/engagements/")) {
    return <EngagementDetailPage engagementId={decodeURIComponent(pathName.replace("/portal/engagements/", ""))} />;
  }
  if (pathName === "/portal") return <PortalApp />;
  if (pathName.startsWith("/portal/")) return <NotFoundPage />;
  return <LoginPage />;
}
