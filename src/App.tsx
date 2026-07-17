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
  RefreshCw,
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
        window.location.assign("/");
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

export default function App() {
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
