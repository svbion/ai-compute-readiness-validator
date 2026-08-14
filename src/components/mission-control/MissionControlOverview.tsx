import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Award,
  CheckCircle2,
  Cpu,
  Database,
  FileText,
  HardDrive,
  Info,
  Layers,
  Network,
  Pin,
  RefreshCw,
  Server,
  Terminal,
  XCircle,
} from "lucide-react";
import type { CSSProperties } from "react";
import { HudPanel, HudPanelHeader } from "../hud";
import { ValidationFlowVisualization } from "./ValidationFlowVisualization";

type Status = "pass" | "warning" | "fail" | "unknown" | "unavailable";
type Severity = "low" | "medium" | "high" | "critical";

type ValidationCheck = {
  id: string;
  category: string;
  title: string;
  status: Status;
  severity: Severity;
  summary: string;
  evidence: unknown[];
  recommendation?: string;
  node: string;
};

type ValidationCategory = {
  id: string;
  name: string;
  weight: number;
  checks: ValidationCheck[];
  score?: number;
};

type Node = {
  name: string;
  ip_address: string | null;
  status: Status;
  categories: Record<string, ValidationCategory>;
};

type BenchmarkResult = {
  benchmark_type: string;
  file_path: string;
  metrics: Record<string, any>;
  raw_snippet: string;
  status: Status;
  timestamp: string;
};

type Cluster = {
  name: string;
  overall_score: number;
  classification: string;
  nodes: Node[];
  recommendations: string[];
  benchmark_results: BenchmarkResult[];
  timestamp: string;
  metadata: {
    execution_mode?: string;
    active_weights?: Record<string, number>;
    total_active_weight?: number;
    category_averages?: Record<string, number>;
  };
};

type PlatformSummary = {
  surface: string;
  mode: "demo" | "live";
  states: {
    loading: boolean;
    empty: boolean;
    error: string | null;
    permission: "allowed" | "denied";
    partial_data: boolean;
  };
  counts: Record<string, number>;
  clusters: Array<{ id: string; name: string; status: string }>;
};

type MissionControlOverviewProps = {
  cluster: Cluster;
  platformSummary: PlatformSummary | null;
  platformSummaryError: string | null;
  selectedScenario: "healthy" | "degraded";
  selectedNodeName: string;
  loading: boolean;
  bookmarkedNodes: string[];
  onTriggerScan: () => void;
  onSelectCheck: (check: ValidationCheck) => void;
  onToggleBookmark: (nodeName: string) => void;
  onOpenExport: () => void;
  benchmarkCount: number;
};

const severityRank: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const categoryIcon = (category: string) => {
  if (category === "gpu") return <Cpu className="h-4 w-4" />;
  if (category === "network") return <Network className="h-4 w-4" />;
  if (category === "storage") return <HardDrive className="h-4 w-4" />;
  if (category === "slurm") return <Layers className="h-4 w-4" />;
  if (category === "kubernetes") return <Database className="h-4 w-4" />;
  return <Server className="h-4 w-4" />;
};

export function MissionControlOverview({
  cluster,
  platformSummary,
  platformSummaryError,
  selectedScenario,
  selectedNodeName,
  loading,
  bookmarkedNodes,
  onTriggerScan,
  onSelectCheck,
  onToggleBookmark,
  onOpenExport,
  benchmarkCount,
}: MissionControlOverviewProps) {
  const allChecks = cluster.nodes.flatMap((node) =>
    Object.values(node.categories).flatMap((category) =>
      category.checks.map((check) => ({ ...check, node: check.node || node.name }))
    )
  );
  const criticalConditions = allChecks
    .filter((check) => check.status === "fail" || check.status === "warning")
    .sort((a, b) => {
      const statusDelta = Number(b.status === "fail") - Number(a.status === "fail");
      if (statusDelta !== 0) return statusDelta;
      return severityRank[b.severity] - severityRank[a.severity];
    });
  const failCount = allChecks.filter((check) => check.status === "fail").length;
  const warningCount = allChecks.filter((check) => check.status === "warning").length;
  const activeJobs = loading ? 1 : 0;
  const openInvestigations = criticalConditions.length;
  const activeNodes = cluster.nodes.filter((node) => node.status !== "fail" && node.status !== "unavailable").length;
  const totalGpus = platformSummary?.counts.gpus ?? cluster.nodes.length * 8;
  const healthState = failCount > 0 ? "Critical" : warningCount > 0 ? "Degraded" : "Healthy";
  const healthTone = failCount > 0 ? "critical" : warningCount > 0 ? "warning" : "success";
  const affectedNodes = Array.from(new Set(criticalConditions.map((check) => check.node))).filter(Boolean);
  const selectedNode = cluster.nodes.find((node) => node.name === selectedNodeName);
  const selectedNodeStatus = selectedNode?.status ?? "unknown";
  const latestBenchmark = cluster.benchmark_results?.[0];
  const dataLabel = platformSummary?.states.partial_data || selectedScenario ? "DEMO / FIXTURE DATA" : "DATA CLASSIFICATION UNKNOWN";
  const reason = criticalConditions[0]
    ? `${criticalConditions[0].node.toUpperCase()} ${criticalConditions[0].category.toUpperCase()}: ${criticalConditions[0].summary}`
    : "No active critical or warning findings in the selected validation scenario.";
  const nextAction = criticalConditions[0]?.recommendation || "Continue evidence review, preserve current validation baseline, and monitor benchmark drift.";
  const warningCheck = criticalConditions.find((check) => check.status === "warning");
  const criticalCheck = criticalConditions.find((check) => check.status === "fail");
  const representativeAlert = warningCheck || criticalCheck;

  const prioritizedKpis = [
    { label: "Active Alerts", value: failCount + warningCount, detail: `${failCount} fail / ${warningCount} warning`, tone: healthTone, icon: <AlertTriangle className="h-4 w-4" /> },
    { label: "Open Investigations", value: openInvestigations, detail: affectedNodes.length ? affectedNodes.map((node) => node.toUpperCase()).join(", ") : "No affected scope", tone: openInvestigations ? "warning" : "success", icon: <Terminal className="h-4 w-4" /> },
    { label: "Active Jobs", value: activeJobs, detail: loading ? "Validation scan running" : "No mutation in progress", tone: loading ? "info" : "neutral", icon: <Activity className="h-4 w-4" /> },
    { label: "Nodes / GPUs", value: `${activeNodes}/${cluster.nodes.length}`, detail: `${totalGpus} GPU inventory`, tone: activeNodes === cluster.nodes.length ? "success" : "warning", icon: <Server className="h-4 w-4" /> },
  ];

  return (
    <section className="mission-control-v3" aria-labelledby="mission-control-title">
      <div className="mission-control-v3__header">
        <div>
          <p className="mission-control-v3__eyebrow">Mission Control V3</p>
          <h2 id="mission-control-title">Current AI Factory Health</h2>
          <p>
            {platformSummaryError || "Evidence-grounded operational view for selected AI Factory scope. Live state is not implied when fixture data is selected."}
          </p>
        </div>
        <div className="mission-control-v3__scope" aria-label="Selected scope and data classification">
          <span>{cluster.name}</span>
          <span>{selectedScenario.toUpperCase()} SCENARIO</span>
          <span>{dataLabel}</span>
        </div>
      </div>

      <div className="mission-control-v3__grid">
        <article className={`mission-health-hero mission-health-hero--${healthTone}`} aria-label={`AI Factory Health ${healthState}, score ${Math.round(cluster.overall_score)} percent. ${reason}`}>
          <div className="mission-health-hero__content">
            <div className="mission-health-hero__ring" style={{ "--health-score": Math.round(cluster.overall_score) } as CSSProperties} aria-hidden="true">
              <span>{Math.round(cluster.overall_score)}%</span>
            </div>
            <div className="mission-health-hero__summary">
              <div className="mission-health-hero__status-row">
                <span className={`mission-badge mission-badge--${healthTone}`}>{healthState}</span>
                <span className="mission-badge mission-badge--neutral">{cluster.classification}</span>
              </div>
              <h3>AI Factory Health</h3>
              <p className="mission-health-hero__reason">{reason}</p>
              <dl className="mission-health-hero__scope-list">
                <div>
                  <dt>Affected scope</dt>
                  <dd>{affectedNodes.length ? affectedNodes.map((node) => node.toUpperCase()).join(", ") : "None detected"}</dd>
                </div>
                <div>
                  <dt>Evidence</dt>
                  <dd>{criticalConditions[0]?.evidence?.length ? "Command evidence available" : "No critical evidence gap"}</dd>
                </div>
                <div>
                  <dt>Current validation</dt>
                  <dd>{loading ? "Validation scan in progress" : `Latest run ${new Date(cluster.timestamp).toLocaleString()}`}</dd>
                </div>
              </dl>
              <div className="mission-health-hero__next-action">
                <span>Recommended next action</span>
                <p>{nextAction}</p>
              </div>
            </div>
          </div>
          <div className="mission-health-hero__actions">
            <button type="button" onClick={onTriggerScan} disabled={loading} className="mission-action mission-action--primary">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Validation running" : "Run validation scan"}
            </button>
            <button type="button" onClick={onOpenExport} className="mission-action mission-action--secondary">
              <FileText className="h-4 w-4" />
              Evidence report
            </button>
          </div>
        </article>

        <aside className="critical-conditions" aria-labelledby="critical-conditions-title">
          <div className="mission-section-heading">
            <span>Priority queue</span>
            <h3 id="critical-conditions-title">Critical Conditions</h3>
          </div>
          {criticalConditions.length > 0 ? (
            <div className="critical-conditions__list">
              {criticalConditions.slice(0, 4).map((check) => (
                <button key={`${check.node}-${check.id}`} type="button" onClick={() => onSelectCheck(check)} className={`critical-condition critical-condition--${check.status}`}>
                  <span className="critical-condition__icon">{check.status === "fail" ? <XCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}</span>
                  <span className="critical-condition__body">
                    <span className="critical-condition__title">{check.title}</span>
                    <span className="critical-condition__meta">{check.severity.toUpperCase()} • {check.node.toUpperCase()} • {check.category.toUpperCase()}</span>
                    <span className="critical-condition__summary">{check.summary}</span>
                    <span className="critical-condition__evidence">{check.evidence?.length ? "Evidence available" : "Evidence unavailable"} • Inspect details</span>
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              ))}
            </div>
          ) : (
            <div className="critical-conditions__empty">
              <CheckCircle2 className="h-8 w-8" />
              <strong>No active critical conditions</strong>
              <span>Validation findings are nominal for the selected scope.</span>
            </div>
          )}
        </aside>
      </div>

      <div className="mission-control-v3__activity-grid">
        <section className="current-activity" aria-labelledby="current-activity-title">
          <div className="mission-section-heading">
            <span>Operations stream</span>
            <h3 id="current-activity-title">Current Activity</h3>
          </div>
          <div className="current-activity__items">
            <div className="current-activity__item">
              <Activity className="h-4 w-4" />
              <div><strong>Latest validation</strong><span>{loading ? "Scenario scan actively collecting evidence" : `${cluster.classification} • ${Math.round(cluster.overall_score)}% health`}</span></div>
            </div>
            <div className="current-activity__item">
              <Award className="h-4 w-4" />
              <div><strong>Latest benchmark</strong><span>{latestBenchmark ? `${latestBenchmark.benchmark_type.toUpperCase()} • ${latestBenchmark.status}` : "No benchmark artifact ingested"}</span></div>
            </div>
            <div className="current-activity__item">
              <Pin className="h-4 w-4" />
              <div><strong>Selected node</strong><span>{selectedNodeName.toUpperCase()} • {selectedNodeStatus.toUpperCase()}</span></div>
            </div>
          </div>
        </section>

        <section className="prioritized-kpis" aria-labelledby="prioritized-kpis-title">
          <div className="mission-section-heading">
            <span>Decision metrics</span>
            <h3 id="prioritized-kpis-title">Prioritized KPIs</h3>
          </div>
          <div className="prioritized-kpis__grid">
            {prioritizedKpis.map((kpi) => (
              <div key={kpi.label} className={`prioritized-kpi prioritized-kpi--${kpi.tone}`}>
                <div className="prioritized-kpi__icon">{kpi.icon}</div>
                <span>{kpi.label}</span>
                <strong>{kpi.value}</strong>
                <small>{kpi.detail}</small>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="hud-panel-demo" aria-labelledby="hud-panel-demo-title">
        <div className="mission-section-heading">
          <span>JARVIS-002 primitive validation</span>
          <h3 id="hud-panel-demo-title">HUD instrumentation panel geometry</h3>
        </div>

        <div className="hud-panel-demo__grid">
          <HudPanel
            header={
              <HudPanelHeader
                eyebrow="Default module"
                title="Evidence Buffer"
                titleId="hud-panel-default-title"
                icon={<Database />}
                status="Standby"
                metadata="Reference surface"
              />
            }
            labelledBy="hud-panel-default-title"
          >
            <div className="hud-panel__meta-row">
              <span>Buffer depth 04</span>
              <span>Trust label visible</span>
            </div>
            <ul className="hud-panel__list">
              <li>Chamfered frame and segmented rail remain outside the readable content well.</li>
              <li>Dense technical copy wraps without clipping under long metadata conditions.</li>
            </ul>
          </HudPanel>

          <HudPanel
            selected
            header={
              <HudPanelHeader
                eyebrow="Selected focus"
                title="Active Scope Inspector"
                titleId="hud-panel-selected-title"
                icon={<Pin />}
                status="Selected"
                metadata={selectedNodeName.toUpperCase()}
              />
            }
            labelledBy="hud-panel-selected-title"
          >
            <div className="hud-panel__kpi-grid">
              <div className="hud-panel__kpi">
                <span className="hud-panel__kpi-label">Node</span>
                <strong className="hud-panel__kpi-value">{selectedNodeName.toUpperCase()}</strong>
              </div>
              <div className="hud-panel__kpi">
                <span className="hud-panel__kpi-label">Status</span>
                <strong className="hud-panel__kpi-value">{selectedNodeStatus.toUpperCase()}</strong>
              </div>
            </div>
          </HudPanel>

          <HudPanel
            status="healthy"
            header={
              <HudPanelHeader
                eyebrow="Healthy state"
                title="Operational Envelope"
                titleId="hud-panel-healthy-title"
                icon={<CheckCircle2 />}
                status="Healthy"
                metadata={`${activeNodes}/${cluster.nodes.length} nodes online`}
              />
            }
            labelledBy="hud-panel-healthy-title"
          >
            <div className="hud-panel__meta-row">
              <span>Classification</span>
              <strong>{cluster.classification}</strong>
            </div>
            <p>Healthy panels use restrained green terminal accents while preserving the cyan structural panel language.</p>
          </HudPanel>

          <HudPanel
            status="warning"
            header={
              <HudPanelHeader
                eyebrow="Warning state"
                title="Fabric Advisory"
                titleId="hud-panel-warning-title"
                icon={<AlertTriangle />}
                status="Warning"
                metadata={warningCheck ? `${warningCheck.node.toUpperCase()} • ${warningCheck.category.toUpperCase()}` : "Demonstration state"}
              />
            }
            labelledBy="hud-panel-warning-title"
          >
            <p>{warningCheck?.summary || "Amber-localized edge treatment indicates degraded but still readable infrastructure state."}</p>
          </HudPanel>

          <HudPanel
            status="critical"
            header={
              <HudPanelHeader
                eyebrow="Critical state"
                title="Escalation Module"
                titleId="hud-panel-critical-title"
                icon={<XCircle />}
                status="Critical"
                metadata={criticalCheck ? `${criticalCheck.node.toUpperCase()} • ${criticalCheck.category.toUpperCase()}` : "Demonstration state"}
              />
            }
            labelledBy="hud-panel-critical-title"
            footer={<><span>Evidence review required</span><strong>{criticalCheck ? "Inspect finding" : "Static state sample"}</strong></>}
          >
            <p>{criticalCheck?.summary || "Critical surfaces deepen the inset well and confine red emphasis to local edge illumination only."}</p>
          </HudPanel>

          <HudPanel
            active
            header={
              <HudPanelHeader
                eyebrow="Informational / active"
                title="Classification Channel"
                titleId="hud-panel-info-title"
                icon={<Info />}
                status="Active"
                metadata={dataLabel}
              />
            }
            labelledBy="hud-panel-info-title"
            footer={<><span>Surface safety</span><strong>{representativeAlert ? "Mapped to live story content" : "Reference-safe"}</strong></>}
          >
            <p>Active and selected states persist through hover with modest cyan edge intensity, no aggressive pulsing, and explicit text labels.</p>
          </HudPanel>
        </div>
      </section>

      <ValidationFlowVisualization />

      <div className="mission-support-strip" aria-label="Supporting Mission Control context">
        <button type="button" onClick={() => onToggleBookmark(selectedNodeName)} className="mission-support-card">
          <Pin className="h-4 w-4" />
          <span>{bookmarkedNodes.includes(selectedNodeName) ? "Priority node pinned" : "Pin selected node"}</span>
          <strong>{selectedNodeName.toUpperCase()}</strong>
        </button>
        <div className="mission-support-card">
          <Database className="h-4 w-4" />
          <span>Persisted platform clusters</span>
          <strong>{platformSummary?.clusters.length ?? "—"}</strong>
        </div>
        <div className="mission-support-card">
          <Award className="h-4 w-4" />
          <span>Benchmark artifacts</span>
          <strong>{benchmarkCount}</strong>
        </div>
      </div>
    </section>
  );
}
