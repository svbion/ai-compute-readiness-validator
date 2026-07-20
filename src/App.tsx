import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Cpu,
  ExternalLink,
  FileJson,
  FileText,
  Gauge,
  Layers,
  Lock,
  LogOut,
  Mail,
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
  type Engagement,
  type EngagementNode,
  type EvidenceRecordSummary,
  type UploadTokenSummary,
} from "./portal/engagements";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(
    queryReason === "expired-session" ? "Your session expired. Sign in again to continue." : null,
  );
  const [locked, setLocked] = useState(false);

  const submitLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setLocked(false);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
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
        setMessage("Invalid email or password.");
      }
    } catch {
      setMessage("Authentication service is unavailable. Try again after the portal is healthy.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030610] text-slate-100 selection:bg-emerald-500/25 selection:text-emerald-200">
      <div className="absolute inset-0 opacity-70" aria-hidden="true">
        <div className="login-grid absolute inset-0" />
        <div className="absolute left-1/2 top-0 h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-[-10rem] right-[-8rem] h-[30rem] w-[30rem] rounded-full bg-cyan-500/8 blur-3xl" />
        <div className="signal-path signal-path-a" />
        <div className="signal-path signal-path-b" />
      </div>

      <section className="relative z-10 mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-6 py-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.22em] text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(118,185,0,0.8)]" />
            Invite-only reviewer access
          </div>

          <div className="space-y-5">
            <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-500">AI Factory Readiness Portal</div>
            <h1 className="max-w-4xl text-4xl font-display font-bold tracking-tight text-slate-50 md:text-6xl">
              GPU Validator
            </h1>
            <p className="max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
              Private access to GPU infrastructure readiness, validation evidence, and customer-acceptance workflows.
            </p>
          </div>

          <div className="grid max-w-2xl grid-cols-2 gap-2 sm:grid-cols-4">
            {["Linux", "GPU Compute", "InfiniBand / RDMA", "Slurm", "Kubernetes", "Storage", "Customer Acceptance"].map((item) => (
              <span key={item} className="rounded-2xl border border-slate-800 bg-slate-950/45 px-3 py-2 text-xs text-slate-300 backdrop-blur">
                {item}
              </span>
            ))}
          </div>

          <div className="max-w-2xl rounded-3xl border border-slate-800 bg-slate-950/45 p-5 text-sm leading-7 text-slate-400 backdrop-blur">
            <p className="text-slate-300">Built by Sabion P. Frazier</p>
            <p className="mt-2">
              This project is an independent portfolio project and is not affiliated with, sponsored by, or endorsed by NVIDIA.
            </p>
          </div>
        </div>

        <div className="cyber-panel rounded-[2rem] border border-slate-800/80 bg-slate-950/75 p-6 shadow-2xl md:p-8">
          <div className="mb-7 flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-500">Secure entry</div>
              <h2 className="mt-3 text-2xl font-display font-semibold text-slate-50">Reviewer sign in</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">Use an issued reviewer invitation when authentication is enabled.</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3">
              <Lock className="h-5 w-5 text-emerald-300" />
            </div>
          </div>

          <form onSubmit={submitLogin} className="space-y-5">
            <div>
              <label htmlFor="reviewer-email" className="mb-2 block text-sm font-medium text-slate-200">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="reviewer-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 py-3 pl-10 pr-3 text-slate-100 outline-none transition focus:border-emerald-500/60 focus:ring-4 focus:ring-emerald-500/10"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reviewer-password" className="mb-2 block text-sm font-medium text-slate-200">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="reviewer-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 py-3 pl-10 pr-12 text-slate-100 outline-none transition focus:border-emerald-500/60 focus:ring-4 focus:ring-emerald-500/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 rounded-xl p-2 -translate-y-1/2 text-slate-400 transition hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4 text-xs leading-6 text-slate-400">
              Invitation required. Access is private, session-based, and does not store credentials in browser local storage.
            </div>

            {message && (
              <div role="alert" aria-live="polite" className={`rounded-2xl border p-4 text-sm ${locked ? "border-amber-500/30 bg-amber-500/10 text-amber-100" : "border-red-500/30 bg-red-500/10 text-red-100"}`}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400 focus:outline-none focus:ring-4 focus:ring-emerald-500/25 disabled:cursor-not-allowed disabled:bg-emerald-700"
            >
              {loading && <RefreshCw className="h-4 w-4 animate-spin" />}
              {loading ? "Checking reviewer access" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-xs leading-6 text-slate-500">
            Privacy-oriented demo portal: no analytics, no public registration, no social login, and no vendor endorsement claim.
          </p>
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

function EngagementShell({ children }: { children: React.ReactNode }) {
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    window.location.assign("/login");
  };
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans antialiased selection:bg-emerald-500/25 selection:text-emerald-200">
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <a href="/portal/engagements" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10">
              <Activity className="h-5 w-5 text-emerald-300" />
            </span>
            <span>
              <span className="block font-display text-xl font-semibold text-slate-50">GPU Validator</span>
              <span className="block text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500">Validation engagements</span>
            </span>
          </a>
          <nav aria-label="Portal navigation" className="flex flex-wrap items-center gap-2 text-sm">
            <a href="/portal" className="rounded-full px-3 py-2 text-slate-300 hover:bg-slate-900 hover:text-emerald-300">Classic portal</a>
            <a href="/portal/engagements" className="rounded-full px-3 py-2 text-slate-300 hover:bg-slate-900 hover:text-emerald-300">Engagements</a>
            <a href="/portal/engagements/new" className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 font-semibold text-slate-950 hover:bg-emerald-400">
              <Plus className="h-4 w-4" /> New engagement
            </a>
            <button onClick={logout} className="rounded-full border border-slate-800 px-3 py-2 text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300">Logout</button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
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
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([]);
  const [uploadTokens, setUploadTokens] = useState<Record<string, UploadTokenSummary[]>>({});
  const [createdToken, setCreatedToken] = useState<(UploadTokenSummary & { token: string; upload_url: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refreshEngagement = () => {
    Promise.all([
      fetch(`/api/v1/engagements/${encodeURIComponent(engagementId)}`).then((res) => res.ok ? res.json() : Promise.reject(new Error("Engagement not found."))),
      fetch(`/api/v1/engagements/${encodeURIComponent(engagementId)}/nodes`).then((res) => res.ok ? res.json() : Promise.reject(new Error("Nodes not found."))),
      fetch(`/api/v1/engagements/${encodeURIComponent(engagementId)}/evidence`).then((res) => res.ok ? res.json() : { evidence_records: [] }),
      fetch(`/api/v1/engagements/${encodeURIComponent(engagementId)}/activity`).then((res) => res.ok ? res.json() : { activity_entries: [] }),
    ]).then(([engagementPayload, nodesPayload, evidencePayload, activityPayload]) => {
      setEngagement(engagementPayload.engagement);
      const nextNodes = Array.isArray(nodesPayload.nodes) ? nodesPayload.nodes : [];
      setNodes(nextNodes);
      setEvidenceRecords(Array.isArray(evidencePayload.evidence_records) ? evidencePayload.evidence_records : []);
      setActivityEntries(Array.isArray(activityPayload.activity_entries) ? activityPayload.activity_entries : []);
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
    ["Expected nodes", engagement.expected_node_count], ["Received nodes", engagement.received_node_count], ["Ready nodes", engagement.ready_node_count], ["Nodes requiring remediation", engagement.remediation_node_count], ["Readiness score", engagement.readiness_score === null ? "Not evaluated" : `${engagement.readiness_score}%`], ["Acceptance decision", formatEngagementLabel(engagement.acceptance_status)],
  ];
  return (
    <EngagementShell>
      <section className="mb-8 rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-6">
        {engagement.simulated && <div className="mb-4 inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-mono uppercase tracking-wider text-amber-300">SIMULATED DEMO — not real hardware evidence</div>}
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
          <Panel title="Findings"><EmptyState text="No evidence evaluated." /></Panel>
          <Panel title="Benchmarks"><div className="grid gap-3 md:grid-cols-3">{["NCCL", "HPL", "Inference"].map((name) => <div key={name} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4"><div className="font-semibold text-slate-100">{name}</div><div className="mt-2 text-xs font-mono uppercase tracking-wider text-amber-300">Awaiting Evidence</div></div>)}</div></Panel>
        </div>
        <div className="space-y-6">
          <Panel title="Evidence">{evidenceRecords.length ? <div className="space-y-3">{evidenceRecords.map((record) => <div key={record.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300"><div className="flex flex-wrap items-center justify-between gap-2"><div className="font-semibold text-slate-50">{record.id}</div><EngagementStatusPill value={record.ingestion_status} /></div><div className="mt-3 grid gap-2 text-xs md:grid-cols-2"><div>Node: {nodes.find((node) => node.id === record.node_id)?.display_name ?? record.node_id}</div><div>Collector: {record.collector_version}</div><div>Profile: {formatEngagementLabel(record.collector_profile)}</div><div>Collected: {formatDate(record.collected_at)}</div><div>Uploaded: {formatDate(record.uploaded_at)}</div><div>Sanitized: {record.sanitized ? "yes" : "no"}</div><div>Simulated: {record.simulated ? "yes" : "no"}</div><div>Commands: {record.collected_count}/{record.command_count} collected, {record.missing_count} missing, {record.failed_count} failed, {record.skipped_count} skipped</div><div className="md:col-span-2">Bundle checksum: <span className="font-mono">{record.bundle_sha256}</span></div>{record.validation_warnings.length > 0 && <div className="md:col-span-2">Warnings: {record.validation_warnings.join("; ")}</div>}</div></div>)}</div> : <EmptyState text="No bundles uploaded." />}</Panel>
          <Panel title="Acceptance Report"><EmptyState text="Available after validation." /></Panel>
          <Panel title="Activity">{activityEntries.length ? <div className="space-y-2 text-sm text-slate-300">{activityEntries.map((entry) => <div key={entry.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3"><div>{entry.message}</div><div className="mt-1 text-xs text-slate-500">{formatDate(entry.created_at)} • {formatEngagementLabel(entry.type)}</div></div>)}</div> : <div className="text-sm text-slate-300">Engagement created: {formatDate(engagement.created_at)}</div>}</Panel>
        </div>
      </section>
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

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    window.location.assign("/login");
  };

  if (window.location.pathname === "/login") {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans antialiased selection:bg-emerald-500/25 selection:text-emerald-200">
      <header className="border-b border-slate-800/80 bg-slate-950/85 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col gap-5">
          <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5">
            <div className="space-y-3 max-w-3xl">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-emerald-500/12 border border-emerald-500/25 flex items-center justify-center shadow-[0_0_25px_rgba(118,185,0,0.08)]">
                  <Activity className="h-6 w-6 text-emerald-400" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-slate-50">
                      GPU Validator
                    </h1>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/25 text-emerald-300">
                      AI Factory Readiness Portal
                    </span>
                    {simulated && (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider bg-slate-900 border border-slate-700 text-slate-300">
                        Simulated scenario
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm md:text-base text-slate-300 leading-relaxed">
                    AI Compute Infrastructure Validation and Customer Acceptance.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {scopeBadges.map((item) => (
                  <span
                    key={item}
                    className="px-3 py-1.5 rounded-full text-[11px] font-mono uppercase tracking-wider bg-slate-900/80 border border-slate-800 text-slate-300"
                  >
                    {item}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap gap-3 text-sm text-slate-400">
                <span>Target profiles: DGX-class systems • HGX-based systems • OEM GPU platforms</span>
                <button
                  type="button"
                  onClick={logout}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-800 px-3 py-1 text-xs text-slate-300 transition hover:border-emerald-500/40 hover:text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Logout
                </button>
              </div>
            </div>

            <div className="xl:min-w-[360px] space-y-3">
              <div className="cyber-panel rounded-2xl border border-slate-800/80 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">Scenario controls</div>
                    <div className="mt-1 text-sm text-slate-300">Current scenario: {scenarioMetadata[selectedScenario].label}</div>
                  </div>
                  <div className="flex gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-1">
                    {(["healthy", "degraded"] as const).map((scenario) => {
                      const active = scenario === selectedScenario;
                      return (
                        <button
                          key={scenario}
                          onClick={() => selectSimulatedScenario(scenario)}
                          disabled={loading}
                          className={`px-3.5 py-2 rounded-lg text-xs font-mono uppercase tracking-wider transition cursor-pointer ${
                            active
                              ? scenario === "healthy"
                                ? "bg-emerald-500/12 border border-emerald-500/25 text-emerald-300"
                                : "bg-red-500/12 border border-red-500/25 text-red-300"
                              : "text-slate-400 border border-transparent hover:text-slate-200"
                          }`}
                        >
                          {scenarioMetadata[scenario].shortLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-3 grid gap-3">
                  <div className="text-xs text-slate-400 leading-relaxed">
                    {scenarioMetadata[selectedScenario].description}
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/55 px-3 py-2 text-xs leading-relaxed text-slate-400">
                    Reviewer portal is read-only. Scenario artifacts are generated by administrator-side CLI workflows, not from the public reviewer surface.
                  </div>
                </div>
              </div>

              <div className="cyber-panel rounded-2xl border border-slate-800/80 p-3.5">
                <label htmlFor="evidence-source" className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">
                  Evidence source
                </label>
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
                  className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-emerald-500/60 focus:ring-4 focus:ring-emerald-500/10"
                >
                  {evidenceSources.map((source) => (
                    <option key={source.id} value={source.id}>{source.label}</option>
                  ))}
                </select>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  {selectedSource.description ?? "Only valid live artifacts are listed; simulated scenarios remain available for demonstration."}
                </p>
              </div>

              <div className="text-[11px] text-slate-500 leading-relaxed">
                Simulated sources are deterministic interview demonstrations. Live and imported choices appear only when valid live artifacts exist and must not be treated as DGX/HGX proof without supporting identity evidence.
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <div className="flex max-w-md rounded-xl border border-slate-800 bg-slate-950/50 p-1">
          <button
            onClick={() => setActiveTab("diagnostics")}
            className={`flex-1 rounded-lg px-4 py-2.5 text-xs font-display font-semibold uppercase tracking-[0.18em] transition cursor-pointer ${
              activeTab === "diagnostics" ? "bg-slate-900 text-slate-100 border border-slate-700" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Diagnostics
          </button>
          <button
            onClick={() => setActiveTab("benchmarks")}
            className={`flex-1 rounded-lg px-4 py-2.5 text-xs font-display font-semibold uppercase tracking-[0.18em] transition cursor-pointer ${
              activeTab === "benchmarks" ? "bg-slate-900 text-slate-100 border border-slate-700" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Benchmark readiness
          </button>
        </div>

        {loading && (
          <section className="cyber-panel rounded-2xl border border-slate-800/80 p-6 flex items-center gap-3">
            <RefreshCw className="h-5 w-5 animate-spin text-emerald-400" />
            <div>
              <div className="text-sm font-semibold text-slate-100">{loadingMessage}</div>
              <div className="text-xs text-slate-400 mt-1">Refreshing portal state from the existing validation API.</div>
            </div>
          </section>
        )}

        {error && (
          <section className="cyber-panel rounded-2xl border border-red-500/30 bg-red-500/5 p-6 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-red-200">Controlled error state</div>
              <div className="text-sm text-red-100/80 mt-1">{error}</div>
            </div>
          </section>
        )}

        {!loading && !cluster && !error && (
          <section className="cyber-panel rounded-2xl border border-slate-800/80 p-10 text-center">
            <Sparkles className="h-8 w-8 text-slate-500 mx-auto mb-3" />
            <div className="text-sm font-semibold text-slate-100">No validation evidence loaded.</div>
            <div className="text-xs text-slate-400 mt-2">Choose a scenario or run the current one to populate the portal.</div>
          </section>
        )}

        {cluster && (
          <section className="cyber-panel rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
            {sourceContext.importedEvidenceBanner && (
              <div role="status" className="mb-5 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 text-sm font-semibold leading-relaxed text-amber-100">
                {sourceContext.importedEvidenceBanner}
              </div>
            )}
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-emerald-300">Source context</div>
                <h2 className="mt-2 text-xl font-display font-semibold text-slate-50">{sourceContext.evidenceSource}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
                  Evidence source: {sourceContext.evidenceSource} • Selected validation profile: {sourceContext.selectedValidationProfile} • Detected environment: {sourceContext.detectedEnvironment}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1.5 text-xs font-mono uppercase tracking-wider ${sourceContext.sourceConfidence === "Demo only" ? "border border-slate-700 bg-slate-900 text-slate-300" : "border border-emerald-500/25 bg-emerald-500/12 text-emerald-300"}`}>
                {sourceContext.sourceConfidence}
              </span>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Evidence source", value: sourceContext.evidenceSource },
                { label: "Selected validation profile", value: sourceContext.selectedValidationProfile },
                { label: "Collection timestamp", value: sourceContext.collectionTimestamp },
                { label: "Hardware identity status", value: sourceContext.hardwareIdentityStatus },
                { label: "Sanitization status", value: sourceContext.sanitizationStatus },
                { label: "Source confidence", value: sourceContext.sourceConfidence },
                { label: "Detected environment", value: sourceContext.detectedEnvironment },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-800 bg-slate-950/35 p-4">
                  <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">{item.label}</div>
                  <div className="mt-2 text-sm leading-relaxed text-slate-200">{item.value}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/35 p-4">
              <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">Limitations</div>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-300">
                {sourceContext.limitations.map((limitation) => (
                  <li key={limitation}>{limitation}</li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {cluster && activeTab === "diagnostics" && (
          <>
            <section className="grid gap-4 lg:grid-cols-[1.2fr_1.2fr_0.8fr_0.8fr]">
              <div className="cyber-panel rounded-2xl border border-slate-800/80 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">Overall Readiness Score</div>
                    <div className="mt-3 flex items-end gap-2">
                      <span className="text-4xl font-display font-bold text-slate-50">{cluster.overall_score.toFixed(2)}%</span>
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                      Aggregate infrastructure health across Linux, GPU, fabric, scheduler, orchestration, and storage evidence.
                    </div>
                  </div>
                  <Gauge className="h-10 w-10 text-emerald-400 shrink-0" />
                </div>
              </div>

              <div className="cyber-panel rounded-2xl border border-slate-800/80 p-5 bg-red-500/4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">Customer Acceptance Status</div>
                    <div className={`mt-3 inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${pillClassesForStatus(acceptanceGate.acceptanceStatus)}`}>
                      {acceptanceGate.acceptanceStatus}
                    </div>
                    <div className="mt-3 text-xs text-slate-400 max-w-md">
                      {acceptanceGate.explanatoryText}
                    </div>
                  </div>
                  {acceptanceGate.handoffApproved ? (
                    <ShieldCheck className="h-10 w-10 text-emerald-400 shrink-0" />
                  ) : (
                    <ShieldAlert className="h-10 w-10 text-red-400 shrink-0" />
                  )}
                </div>
              </div>

              <div className="cyber-panel rounded-2xl border border-slate-800/80 p-5">
                <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">Active findings</div>
                <div className="mt-3 flex items-end gap-3">
                  <span className="text-4xl font-display font-bold text-slate-50">{criticalCount}</span>
                  <span className="text-xs text-slate-400 mb-1">critical</span>
                </div>
                <div className="mt-2 text-xs text-slate-400">Warnings: {warningCount} • Recommendations: {cluster.recommendations.length}</div>
              </div>

              <div className="cyber-panel rounded-2xl border border-slate-800/80 p-5">
                <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">Validation profile</div>
                <div className="mt-3 text-sm font-semibold text-slate-100">{validationProfile.title}</div>
                <div className="mt-2 text-xs text-slate-400">{validationProfile.mode}</div>
              </div>
            </section>

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
                    <FileText className="h-5 w-5 text-emerald-400" />
                    <h2 className="text-lg font-display font-semibold text-slate-50">Report Access</h2>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: "View standalone HTML report", href: reportLinks.html, icon: FileText },
                      { label: "View Markdown report", href: reportLinks.markdown, icon: FileText },
                      { label: "View JSON evidence", href: reportLinks.json, icon: FileJson },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <a
                          key={item.label}
                          href={item.href}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/30 p-4 text-sm text-slate-200 transition hover:border-emerald-500/35 hover:text-emerald-300"
                        >
                          <span className="flex items-center gap-3">
                            <Icon className="h-4 w-4" />
                            {item.label}
                          </span>
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      );
                    })}
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
      </main>

      <footer className="mt-16 border-t border-slate-900 bg-slate-950">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col lg:flex-row justify-between gap-3 text-xs text-slate-500">
          <div>GPU Validator • AI Factory Readiness Portal • Customer-acceptance evidence for GPU-accelerated infrastructure</div>
          <div>This project is an independent portfolio project and is not affiliated with, sponsored by, or endorsed by NVIDIA.</div>
        </div>
      </footer>
    </div>
  );
}

const contactEmail = import.meta.env.VITE_GPU_VALIDATOR_CONTACT_EMAIL || "access@gpuvalidator.com";
const earlyAccessMailto = `mailto:${contactEmail}?subject=${encodeURIComponent("GPU Validator early access")}&body=${encodeURIComponent("Hello GPU Validator team,\n\nI would like to request early access.\n\nOrganization:\nGPU platform profile:\nValidation timeline:\n\nPlease do not include passwords, tokens, or private evidence in this email.\n")}`;

const validationDomains = [
  "GPU health",
  "InfiniBand / RDMA",
  "Linux",
  "Slurm",
  "Kubernetes",
  "storage",
  "benchmark readiness",
];

const platformProfiles = [
  "GPU workstation",
  "single GPU node",
  "DGX-class",
  "HGX-based",
  "OEM GPU platform",
  "Slurm GPU cluster",
  "Kubernetes GPU cluster",
  "AI Factory",
];

function PublicNav() {
  const links = [
    { href: "/docs", label: "Docs" },
    { href: "/security", label: "Security" },
    { href: "/request-access", label: "Request Early Access" },
    { href: "/login", label: "Reviewer Login" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/70 bg-[#030610]/85 backdrop-blur-xl">
      <nav aria-label="Public navigation" className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between">
        <a href="/" className="flex items-center gap-3 text-slate-50">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10 shadow-[0_0_30px_rgba(118,185,0,0.08)]">
            <Activity className="h-5 w-5 text-emerald-300" />
          </span>
          <span>
            <span className="block font-display text-lg font-semibold tracking-tight">GPU Validator</span>
            <span className="block text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500">Customer acceptance</span>
          </span>
        </a>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {links.map((link) => (
            <a key={link.href} href={link.href} className={`rounded-full px-4 py-2 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${link.href === "/request-access" ? "bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400" : "text-slate-300 hover:bg-slate-900 hover:text-slate-50"}`}>
              {link.label}
            </a>
          ))}
        </div>
      </nav>
    </header>
  );
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#030610] text-slate-100 selection:bg-emerald-500/25 selection:text-emerald-200">
      <div className="fixed inset-0 -z-10" aria-hidden="true">
        <div className="login-grid absolute inset-0 opacity-70" />
        <div className="absolute left-1/2 top-[-20rem] h-[42rem] w-[42rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-[-18rem] right-[-12rem] h-[36rem] w-[36rem] rounded-full bg-cyan-500/8 blur-3xl" />
      </div>
      <PublicNav />
      {children}
      <footer className="border-t border-slate-900 bg-slate-950/80">
        <div className="mx-auto grid max-w-7xl gap-6 px-6 py-10 text-sm text-slate-400 md:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="font-display text-lg font-semibold text-slate-100">GPU Validator</div>
            <p className="mt-2 max-w-2xl leading-7">AI Compute Infrastructure Validation and Customer Acceptance for GPU platforms, fabric, schedulers, storage, Kubernetes, and operational readiness.</p>
          </div>
          <div className="space-y-2 md:text-right">
            <p>This project is independent and is not affiliated with, sponsored by, or endorsed by NVIDIA.</p>
            <p>Public demo content uses simulated evidence unless real evidence is explicitly imported and labeled.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      <div className="mb-8 max-w-3xl">
        <div className="text-[11px] font-mono uppercase tracking-[0.24em] text-emerald-300">{eyebrow}</div>
        <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function LandingPage() {
  return (
    <PublicShell>
      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-10 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.22em] text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(118,185,0,0.8)]" />
              Live at gpuvalidator.com
            </div>
            <div className="space-y-5">
              <p className="text-sm font-mono uppercase tracking-[0.28em] text-slate-500">GPU Validator</p>
              <h1 className="max-w-5xl font-display text-5xl font-bold tracking-tight text-slate-50 md:text-7xl">
                AI Compute Infrastructure Validation and Customer Acceptance
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-slate-300 md:text-xl">
                Validate GPU platforms, fabric, schedulers, storage, Kubernetes, and operational readiness before customer acceptance.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a href="/request-access" className="rounded-2xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400 focus:outline-none focus:ring-4 focus:ring-emerald-500/25">Request Early Access</a>
              <a href="/login" className="rounded-2xl border border-slate-700 px-5 py-3 font-semibold text-slate-100 transition hover:border-emerald-500/40 hover:text-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-500/15">Reviewer Login</a>
            </div>
          </div>
          <div className="cyber-panel rounded-[2rem] p-6 md:p-8">
            <div className="grid gap-4">
              <div className="rounded-3xl border border-emerald-500/25 bg-emerald-500/10 p-5">
                <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-emerald-300">Healthy example</div>
                <div className="mt-3 font-display text-5xl font-bold text-slate-50">100 READY</div>
                <p className="mt-3 text-sm leading-6 text-slate-300">All validation domains pass; acceptance report is ready for customer handoff.</p>
              </div>
              <div className="rounded-3xl border border-amber-500/25 bg-amber-500/10 p-5">
                <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-amber-300">Degraded example</div>
                <div className="mt-3 font-display text-4xl font-bold text-slate-50">97.01 REMEDIATION REQUIRED</div>
                <p className="mt-3 text-sm leading-6 text-slate-300">High aggregate score, but blocking GPU/fabric findings prevent acceptance until remediated.</p>
              </div>
              <p className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-xs leading-6 text-slate-400">
                Simulated evidence is used in the public demonstration unless real evidence is imported and clearly labeled with provenance and sanitization status.
              </p>
            </div>
          </div>
        </section>

        <Section eyebrow="Acceptance risk" title="Customer handoff should not depend on screenshots and tribal knowledge.">
          <div className="grid gap-4 md:grid-cols-3">
            {["GPU platforms arrive healthy, but acceptance fails when fabric, scheduler, or storage evidence is incomplete.", "Operators need a read-only way to prove readiness without exposing credentials or mutation controls.", "Customers need a concise acceptance report that separates warnings from release-blocking findings."].map((text) => (
              <div key={text} className="cyber-panel cyber-panel-hover rounded-3xl p-5 text-sm leading-7 text-slate-300">{text}</div>
            ))}
          </div>
        </Section>

        <Section eyebrow="Validation domains" title="A practical acceptance surface for the full AI compute stack.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {validationDomains.map((domain) => (
              <div key={domain} className="rounded-2xl border border-slate-800 bg-slate-950/55 p-4 text-slate-200">
                <CheckCircle2 className="mb-3 h-5 w-5 text-emerald-300" />
                {domain}
              </div>
            ))}
          </div>
        </Section>

        <Section eyebrow="Workflow" title="Collect evidence, validate it, and produce an acceptance report.">
          <div className="grid gap-4 md:grid-cols-5">
            {["collect or import evidence", "validate", "score", "identify blocking findings", "produce acceptance report"].map((step, index) => (
              <div key={step} className="cyber-panel rounded-3xl p-5">
                <div className="text-[11px] font-mono text-emerald-300">0{index + 1}</div>
                <div className="mt-3 text-sm font-semibold text-slate-100">{step}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section eyebrow="Evidence model" title="Provenance and read-only operation are part of the product boundary.">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="cyber-panel rounded-3xl p-6">
              <h3 className="font-display text-xl font-semibold text-slate-50">Evidence provenance</h3>
              <p className="mt-3 leading-7 text-slate-300">Every result is labeled as simulated, live, or imported live evidence with source confidence, collection timestamp, hardware identity status, sanitization status, and limitations.</p>
            </div>
            <div className="cyber-panel rounded-3xl p-6">
              <h3 className="font-display text-xl font-semibold text-slate-50">Read-only operating model</h3>
              <p className="mt-3 leading-7 text-slate-300">The reviewer portal visualizes evidence and reports. It does not expose scenario execution, evidence import, package installation, privileged commands, or credential material.</p>
            </div>
          </div>
        </Section>

        <Section eyebrow="Profiles" title="Supported platform profiles for acceptance-oriented validation.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {platformProfiles.map((profile) => (
              <div key={profile} className="rounded-2xl border border-slate-800 bg-slate-950/55 px-4 py-3 text-sm text-slate-200">{profile}</div>
            ))}
          </div>
        </Section>

        <Section eyebrow="Architecture overview" title="Small operational footprint, clear trust boundary.">
          <div className="cyber-panel rounded-[2rem] p-6 md:p-8">
            <div className="grid gap-4 md:grid-cols-4">
              {["Evidence collectors / imports", "Validation engine", "Read-only API", "Authenticated portal + reports"].map((item) => (
                <div key={item} className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-200">{item}</div>
              ))}
            </div>
            <p className="mt-5 text-sm leading-7 text-slate-400">Current production deployment uses a Vite/React frontend, Express backend, systemd service, Caddy HTTPS proxy, local artifacts, and invite-only reviewer authentication.</p>
          </div>
        </Section>

        <section className="mx-auto max-w-7xl px-6 py-16">
          <div className="rounded-[2rem] border border-emerald-500/25 bg-emerald-500/10 p-8 md:p-10">
            <h2 className="font-display text-3xl font-semibold text-slate-50">Validate before customer acceptance.</h2>
            <p className="mt-3 max-w-3xl leading-7 text-slate-300">GPU Validator is available for early evaluation with simulated demo evidence and controlled live/imported evidence workflows.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="/request-access" className="rounded-2xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400">Request Early Access</a>
              <a href="/docs" className="rounded-2xl border border-slate-700 px-5 py-3 font-semibold text-slate-100 transition hover:border-emerald-500/40 hover:text-emerald-300">Read product overview</a>
            </div>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}

function DocsPage() {
  return (
    <PublicShell>
      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="text-[11px] font-mono uppercase tracking-[0.24em] text-emerald-300">Documentation</div>
        <h1 className="mt-3 font-display text-4xl font-semibold text-slate-50">Product overview</h1>
        <div className="mt-8 space-y-6 text-slate-300">
          <p className="leading-8">GPU Validator helps infrastructure teams collect or import evidence, validate GPU compute readiness, score customer acceptance, identify blocking findings, and produce acceptance reports.</p>
          <p className="leading-8">The current public product supports deterministic simulated healthy and degraded examples, authenticated review, protected report routes, and a read-only reviewer portal. Real evidence must be explicitly imported or collected under approved operating rules before it is treated as live validation evidence.</p>
          <div className="grid gap-4 md:grid-cols-2">
            {validationDomains.map((domain) => <div key={domain} className="cyber-panel rounded-2xl p-4">{domain}</div>)}
          </div>
        </div>
      </main>
    </PublicShell>
  );
}

function SecurityPage() {
  return (
    <PublicShell>
      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="text-[11px] font-mono uppercase tracking-[0.24em] text-emerald-300">Security</div>
        <h1 className="mt-3 font-display text-4xl font-semibold text-slate-50">Security and evidence handling</h1>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {["Read-only operating model: the reviewer portal cannot run scans, import evidence, install packages, or mutate infrastructure.", "Protected reports and APIs require reviewer authentication and are not exposed through public product pages.", "Secrets, password hashes, session tokens, and private evidence must never be committed, pasted into chat, or sent through early-access email.", "Public demonstration data is simulated unless a result is clearly labeled as live or imported live evidence."].map((item) => (
            <div key={item} className="cyber-panel rounded-3xl p-5 leading-7 text-slate-300">{item}</div>
          ))}
        </div>
      </main>
    </PublicShell>
  );
}

function RequestAccessPage() {
  return (
    <PublicShell>
      <main className="mx-auto max-w-4xl px-6 py-16">
        <div className="rounded-[2rem] border border-emerald-500/25 bg-emerald-500/10 p-8 md:p-10">
          <div className="text-[11px] font-mono uppercase tracking-[0.24em] text-emerald-300">Early access</div>
          <h1 className="mt-3 font-display text-4xl font-semibold text-slate-50">Request early access</h1>
          <p className="mt-4 leading-8 text-slate-300">Share your organization, GPU platform profile, and target validation timeline. Do not include passwords, API keys, private logs, or raw customer evidence in the request.</p>
          <a href={earlyAccessMailto} className="mt-8 inline-flex rounded-2xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400">Email access request</a>
        </div>
      </main>
    </PublicShell>
  );
}

export default function App() {
  const pathName = window.location.pathname;
  if (pathName === "/login") return <LoginPage />;
  if (pathName === "/portal/engagements") return <EngagementListPage />;
  if (pathName === "/portal/engagements/new") return <NewEngagementPage />;
  if (pathName.startsWith("/portal/engagements/")) {
    return <EngagementDetailPage engagementId={decodeURIComponent(pathName.replace("/portal/engagements/", ""))} />;
  }
  if (pathName === "/portal") return <PortalApp />;
  if (pathName === "/docs") return <DocsPage />;
  if (pathName === "/security") return <SecurityPage />;
  if (pathName === "/request-access") return <RequestAccessPage />;
  return <LandingPage />;
}
