import {
  Activity,
  Cpu,
  Database,
  FileText,
  HardDrive,
  Layers,
  Network,
  Pin,
  RefreshCw,
  Server,
  ShieldAlert,
} from "lucide-react";
import type { CSSProperties } from "react";
import { HudPanel, HudPanelHeader } from "../hud";
import {
  CriticalConditionsPanel,
  type CriticalConditionEvidenceState,
  type CriticalConditionSeverity,
} from "./critical";
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
  onOpenTopology: () => void;
  benchmarkCount: number;
};

const severityRank: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function toPercent(value: number | undefined, fallback = 100) {
  return Math.max(0, Math.min(100, Math.round(value ?? fallback)));
}

function categoryAverage(cluster: Cluster, category: string, fallback = 100) {
  return toPercent(cluster.metadata.category_averages?.[category], fallback);
}

function mapConditionSeverity(check: ValidationCheck): CriticalConditionSeverity {
  if (check.status === "fail" || check.severity === "critical" || check.severity === "high") {
    return "critical";
  }

  if (check.status === "warning" || check.severity === "medium") {
    return "warning";
  }

  if (check.severity === "low") {
    return "informational";
  }

  return "unknown";
}

function formatEvidenceEntry(entry: unknown): string | null {
  if (typeof entry === "string") {
    const trimmed = entry.trim();
    return trimmed || null;
  }

  if (typeof entry === "number" || typeof entry === "boolean") {
    return String(entry);
  }

  if (entry && typeof entry === "object") {
    for (const key of ["summary", "message", "detail", "label", "title", "value", "path"]) {
      const value = (entry as Record<string, unknown>)[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
      if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
      }
    }

    const serialized = JSON.stringify(entry);
    return serialized && serialized !== "{}" ? serialized : null;
  }

  return null;
}

function summarizeEvidence(check: ValidationCheck, partialData: boolean) {
  const formattedEvidence = check.evidence
    .map((entry) => formatEvidenceEntry(entry))
    .filter((entry): entry is string => Boolean(entry));

  if (formattedEvidence.length > 0) {
    return formattedEvidence.slice(0, 2).join(" • ");
  }

  if (check.summary.trim()) {
    return partialData
      ? `${check.summary} Structured evidence is partial in the current dataset.`
      : `${check.summary} Structured evidence is not attached to this finding.`;
  }

  return partialData
    ? "Structured evidence is partial in the current dataset."
    : "Structured evidence is unavailable for this finding.";
}

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
  onOpenTopology,
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
  const partialData = Boolean(platformSummary?.states.partial_data);

  const failCount = allChecks.filter((check) => check.status === "fail").length;
  const warningCount = allChecks.filter((check) => check.status === "warning").length;
  const activeJobs = loading ? 1 : 0;
  const openInvestigations = criticalConditions.length;
  const activeNodes = cluster.nodes.filter((node) => node.status !== "fail" && node.status !== "unavailable").length;
  const totalGpus = platformSummary?.counts.gpus ?? cluster.nodes.length * 8;
  const selectedNode = cluster.nodes.find((node) => node.name === selectedNodeName);
  const selectedNodeStatus = selectedNode?.status ?? "unknown";
  const latestBenchmark = cluster.benchmark_results?.[0];
  const affectedNodes = Array.from(new Set(criticalConditions.map((check) => check.node))).filter(Boolean);
  const healthState = failCount > 0 ? "Critical" : warningCount > 0 ? "Degraded" : "Healthy";
  const healthTone = failCount > 0 ? "critical" : warningCount > 0 ? "warning" : "success";
  const dataLabel = platformSummary?.states.partial_data || selectedScenario
    ? "DEMO / FIXTURE DATA"
    : "DATA CLASSIFICATION UNKNOWN";
  const reason = criticalConditions[0]
    ? `${criticalConditions[0].node.toUpperCase()} ${criticalConditions[0].category.toUpperCase()}: ${criticalConditions[0].summary}`
    : "No active critical or warning findings in the selected validation scenario.";
  const nextAction = criticalConditions[0]?.recommendation || "Continue evidence review, preserve current validation baseline, and monitor benchmark drift.";
  const primaryCluster = cluster.name.toUpperCase();
  const representativeAlert = criticalConditions[0] || null;
  const selectedNodeBookmarked = bookmarkedNodes.includes(selectedNodeName);
  const criticalPanelConditions = criticalConditions.map((check) => ({
    id: `${check.node}-${check.id}`,
    title: check.title,
    severity: mapConditionSeverity(check),
    affectedScope: check.node.toUpperCase(),
    subsystem: check.category.toUpperCase(),
    evidenceState: (check.evidence.length > 0
      ? "available"
      : partialData
        ? "partial"
        : "unavailable") as CriticalConditionEvidenceState,
    evidenceSummary: summarizeEvidence(check, partialData),
    recommendation: check.recommendation || "Recommendation unavailable in current findings.",
    stateLabel: check.status.toUpperCase(),
    onSelect: () => onSelectCheck(check),
  }));
  const criticalNominalContext = partialData
    ? `No warning or fail findings are present for the selected scope. Current dataset remains marked ${dataLabel}.`
    : `No warning or fail findings are present for ${selectedNodeName.toUpperCase()}. Latest validation ${new Date(cluster.timestamp).toLocaleString()}.`;

  const gpuAverage = categoryAverage(cluster, "gpu");
  const networkAverage = categoryAverage(cluster, "network");
  const storageAverage = categoryAverage(cluster, "storage");
  const linuxAverage = categoryAverage(cluster, "linux");
  const slurmAverage = categoryAverage(cluster, "slurm");
  const kubernetesAverage = categoryAverage(cluster, "kubernetes");
  const controlPlaneAverage = Math.round((slurmAverage + kubernetesAverage) / 2);

  const prioritizedKpis = [
    {
      label: "Compute capacity",
      value: `${toPercent((activeNodes / Math.max(cluster.nodes.length, 1)) * 100)}%`,
      detail: `${activeNodes}/${cluster.nodes.length} nodes online`,
      progress: toPercent((activeNodes / Math.max(cluster.nodes.length, 1)) * 100),
      tone: activeNodes === cluster.nodes.length ? "success" : "warning",
    },
    {
      label: "GPU readiness",
      value: `${gpuAverage}%`,
      detail: `${totalGpus} GPU inventory`,
      progress: gpuAverage,
      tone: gpuAverage >= 95 ? "success" : gpuAverage >= 80 ? "warning" : "critical",
    },
    {
      label: "Fabric health",
      value: `${networkAverage}%`,
      detail: failCount > 0 ? `${failCount} fail / ${warningCount} warning` : "No active fabric blockers",
      progress: networkAverage,
      tone: networkAverage >= 95 ? "success" : networkAverage >= 80 ? "warning" : "critical",
    },
    {
      label: "Storage health",
      value: `${storageAverage}%`,
      detail: latestBenchmark ? latestBenchmark.benchmark_type.toUpperCase() : "No benchmark artifact ingested",
      progress: storageAverage,
      tone: storageAverage >= 95 ? "success" : storageAverage >= 80 ? "warning" : "critical",
    },
    {
      label: "System stability",
      value: `${controlPlaneAverage}%`,
      detail: `${linuxAverage}% linux • ${controlPlaneAverage}% control plane`,
      progress: controlPlaneAverage,
      tone: controlPlaneAverage >= 95 ? "success" : controlPlaneAverage >= 80 ? "warning" : "critical",
    },
  ];

  const activityItems = [
    {
      icon: <Activity className="h-4 w-4" />,
      label: "Latest validation",
      value: loading ? "Scenario scan actively collecting evidence" : `${cluster.classification} • ${Math.round(cluster.overall_score)}% health`,
    },
    {
      icon: <FileText className="h-4 w-4" />,
      label: "Latest benchmark",
      value: latestBenchmark ? `${latestBenchmark.benchmark_type.toUpperCase()} • ${latestBenchmark.status.toUpperCase()}` : "No benchmark artifact ingested",
    },
    {
      icon: <Network className="h-4 w-4" />,
      label: "Selected scope",
      value: `${selectedNodeName.toUpperCase()} • ${selectedNodeStatus.toUpperCase()}`,
    },
  ];

  const telemetryMetrics = [
    {
      label: "Platform mode",
      value: platformSummary?.mode === "live" ? "LIVE" : "DEMO",
      meta: dataLabel,
      icon: <Database className="h-4 w-4" />,
    },
    {
      label: "Collectors",
      value: `${platformSummary?.counts.agents ?? platformSummary?.counts.collectors ?? 0}`,
      meta: platformSummary?.states.loading ? "SYNCING" : "REGISTERED",
      icon: <Server className="h-4 w-4" />,
    },
    {
      label: "Persisted clusters",
      value: `${platformSummary?.clusters.length ?? 0}`,
      meta: primaryCluster,
      icon: <Layers className="h-4 w-4" />,
    },
    {
      label: "Benchmark artifacts",
      value: `${benchmarkCount}`,
      meta: latestBenchmark ? latestBenchmark.status.toUpperCase() : "UNAVAILABLE",
      icon: <FileText className="h-4 w-4" />,
    },
  ];

  const centerStats = [
    { label: "Selected node", value: selectedNodeName.toUpperCase(), tone: selectedNodeStatus },
    { label: "Affected scope", value: affectedNodes.length ? affectedNodes.map((node) => node.toUpperCase()).join(", ") : "NONE", tone: failCount ? "fail" : warningCount ? "warning" : "pass" },
    { label: "Current validation", value: loading ? "RUNNING" : "READY FOR REVIEW", tone: loading ? "warning" : "pass" },
    { label: "Benchmark evidence", value: latestBenchmark ? latestBenchmark.benchmark_type.toUpperCase() : "PENDING", tone: latestBenchmark ? latestBenchmark.status : "unknown" },
  ];

  return (
    <section className="mission-control-v3" aria-labelledby="mission-control-title" data-testid="JarvisMissionControlShell">
      <div className="mission-control-v3__frame" data-testid="PrimaryOperationsWorkspace">
        <header className="mission-control-v3__header">
          <div className="mission-control-v3__title-block">
            <p className="mission-control-v3__eyebrow">Mission Control V3</p>
            <h2 id="mission-control-title">Current AI Factory Health</h2>
            <p>
              {platformSummaryError || "Primary operations workspace for authenticated GPUValidator review. Live state is not implied when fixture data is selected."}
            </p>
          </div>

          <div className="mission-control-v3__scope" aria-label="Selected scope and data classification">
            <span>{primaryCluster}</span>
            <span>{selectedScenario.toUpperCase()} SCENARIO</span>
            <span>{dataLabel}</span>
          </div>
        </header>

        <div className="mission-control-v3__workspace-frame" aria-hidden="true">
          <span className="mission-control-v3__frame-node mission-control-v3__frame-node--top-left" />
          <span className="mission-control-v3__frame-node mission-control-v3__frame-node--top-right" />
          <span className="mission-control-v3__frame-node mission-control-v3__frame-node--bottom-left" />
          <span className="mission-control-v3__frame-node mission-control-v3__frame-node--bottom-right" />
        </div>

        <div className="mission-control-v3__grid" data-testid="JarvisMissionControlGrid">
          <HudPanel
            className="jarvis-shell-panel jarvis-shell-panel--health"
            header={
              <HudPanelHeader
                eyebrow="Operational baseline"
                icon={<ShieldAlert />}
                metadata={primaryCluster}
                status={healthState.toUpperCase()}
                title="AI Factory Health"
                titleId="jarvis-health-title"
              />
            }
            labelledBy="jarvis-health-title"
            status={healthTone === "success" ? "healthy" : healthTone === "warning" ? "warning" : "critical"}
          >
            <div className="jarvis-health-panel" aria-label={`AI Factory Health ${healthState}, score ${Math.round(cluster.overall_score)} percent. ${reason}`}>
              <div className="jarvis-health-panel__ring" style={{ "--health-score": Math.round(cluster.overall_score) } as CSSProperties} aria-hidden="true">
                <div className="jarvis-health-panel__ring-core">
                  <strong>{Math.round(cluster.overall_score)}%</strong>
                  <span>Health score</span>
                </div>
              </div>

              <div className="jarvis-health-panel__summary">
                <p className="jarvis-health-panel__reason">{reason}</p>
                <dl className="jarvis-health-panel__facts">
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
                <div className="jarvis-health-panel__actions">
                  <button type="button" onClick={onTriggerScan} disabled={loading} className="jarvis-action jarvis-action--primary">
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    {loading ? "Validation running" : "Run validation scan"}
                  </button>
                  <button type="button" onClick={onOpenExport} className="jarvis-action jarvis-action--secondary">
                    <FileText className="h-4 w-4" />
                    Evidence report
                  </button>
                </div>
              </div>
            </div>
          </HudPanel>

          <CriticalConditionsPanel
            activeCount={failCount + warningCount}
            affectedScopeCount={affectedNodes.length}
            conditions={criticalPanelConditions}
            maxVisible={3}
            nominalContext={criticalNominalContext}
            panelStatus={failCount > 0 ? "critical" : warningCount > 0 ? "warning" : "healthy"}
            titleId="jarvis-critical-title"
          />

          <HudPanel
            className="jarvis-shell-panel jarvis-shell-panel--activity"
            header={
              <HudPanelHeader
                eyebrow="Operations stream"
                icon={<Activity />}
                metadata={selectedNodeName.toUpperCase()}
                status={loading ? "LIVE" : "READY"}
                title="Current Activity"
                titleId="jarvis-activity-title"
              />
            }
            labelledBy="jarvis-activity-title"
          >
            <div className="jarvis-activity-list">
              {activityItems.map((item) => (
                <div key={item.label} className="jarvis-activity-list__item">
                  <span className="jarvis-activity-list__icon">{item.icon}</span>
                  <div>
                    <strong>{item.label}</strong>
                    <span>{item.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </HudPanel>

          <HudPanel
            className="jarvis-shell-panel jarvis-shell-panel--centerpiece"
            header={
              <HudPanelHeader
                eyebrow="Centerpiece region"
                icon={<Network />}
                metadata={representativeAlert ? `${representativeAlert.node.toUpperCase()} • ${representativeAlert.category.toUpperCase()}` : primaryCluster}
                status="PLANNED VISUALIZATION"
                title="AI Factory Spatial View"
                titleId="jarvis-centerpiece-title"
              />
            }
            labelledBy="jarvis-centerpiece-title"
          >
            <div className="jarvis-centerpiece" data-testid="JarvisCenterpieceRegion">
              <div className="jarvis-centerpiece__projection" aria-hidden="true">
                <div className="jarvis-centerpiece__beam" />
                <div className="jarvis-centerpiece__ring jarvis-centerpiece__ring--outer" />
                <div className="jarvis-centerpiece__ring jarvis-centerpiece__ring--middle" />
                <div className="jarvis-centerpiece__ring jarvis-centerpiece__ring--inner" />
                <div className="jarvis-centerpiece__core">
                  <span>AI FACTORY</span>
                  <strong>{selectedNodeName.toUpperCase()}</strong>
                </div>
                <div className="jarvis-centerpiece__callout jarvis-centerpiece__callout--left-top">
                  <span>GPU READINESS</span>
                  <strong>{gpuAverage}%</strong>
                </div>
                <div className="jarvis-centerpiece__callout jarvis-centerpiece__callout--left-bottom">
                  <span>FABRIC HEALTH</span>
                  <strong>{networkAverage}%</strong>
                </div>
                <div className="jarvis-centerpiece__callout jarvis-centerpiece__callout--right-top">
                  <span>BENCHMARKS</span>
                  <strong>{benchmarkCount}</strong>
                </div>
                <div className="jarvis-centerpiece__callout jarvis-centerpiece__callout--right-bottom">
                  <span>ACTIVE ALERTS</span>
                  <strong>{failCount + warningCount}</strong>
                </div>
              </div>

              <div className="jarvis-centerpiece__copy">
                <p className="jarvis-centerpiece__label">AI FACTORY SPATIAL VIEW</p>
                <h3>PLANNED VISUALIZATION</h3>
                <p>
                  JARVIS-006 reserves the approved centerpiece silhouette using truthful Mission Control context while the full hologram implementation remains deferred to JARVIS-008.
                </p>
                <div className="jarvis-centerpiece__stats">
                  {centerStats.map((stat) => (
                    <div key={stat.label} className={`jarvis-centerpiece__stat jarvis-centerpiece__stat--${stat.tone}`}>
                      <span>{stat.label}</span>
                      <strong>{stat.value}</strong>
                    </div>
                  ))}
                </div>
                <div className="jarvis-centerpiece__actions">
                  <button type="button" onClick={onOpenTopology} className="jarvis-action jarvis-action--secondary">
                    <Network className="h-4 w-4" />
                    View topology map
                  </button>
                  <button type="button" onClick={() => onToggleBookmark(selectedNodeName)} className="jarvis-action jarvis-action--ghost">
                    <Pin className="h-4 w-4" />
                    {selectedNodeBookmarked ? `Pinned ${selectedNodeName.toUpperCase()}` : `Pin ${selectedNodeName.toUpperCase()}`}
                  </button>
                </div>
              </div>
            </div>
          </HudPanel>

          <div className="jarvis-shell-panel jarvis-shell-panel--validation">
            <ValidationFlowVisualization />
          </div>

          <HudPanel
            className="jarvis-shell-panel jarvis-shell-panel--kpis"
            header={
              <HudPanelHeader
                eyebrow="Decision metrics"
                icon={<Cpu />}
                metadata={latestBenchmark ? latestBenchmark.benchmark_type.toUpperCase() : "NO BENCHMARK"}
                status="PRIORITIZED"
                title="Prioritized KPIs"
                titleId="jarvis-kpis-title"
              />
            }
            labelledBy="jarvis-kpis-title"
          >
            <div className="jarvis-kpi-list">
              {prioritizedKpis.map((kpi) => (
                <div key={kpi.label} className={`jarvis-kpi-list__item jarvis-kpi-list__item--${kpi.tone}`}>
                  <div className="jarvis-kpi-list__row">
                    <span>{kpi.label}</span>
                    <strong>{kpi.value}</strong>
                  </div>
                  <div className="jarvis-kpi-list__bar" aria-hidden="true">
                    <div className="jarvis-kpi-list__fill" style={{ width: `${kpi.progress}%` }} />
                  </div>
                  <small>{kpi.detail}</small>
                </div>
              ))}
            </div>
          </HudPanel>

          <HudPanel
            className="jarvis-shell-panel jarvis-shell-panel--telemetry"
            header={
              <HudPanelHeader
                eyebrow="System telemetry"
                icon={<HardDrive />}
                metadata={platformSummary?.surface.toUpperCase() || "PLATFORM SUMMARY"}
                status={platformSummary?.states.loading ? "SYNCING" : "READY"}
                title="System Telemetry"
                titleId="jarvis-telemetry-title"
              />
            }
            labelledBy="jarvis-telemetry-title"
          >
            <div className="jarvis-telemetry-grid">
              {telemetryMetrics.map((metric) => (
                <div key={metric.label} className="jarvis-telemetry-grid__item">
                  <span className="jarvis-telemetry-grid__icon">{metric.icon}</span>
                  <div>
                    <span>{metric.label}</span>
                    <strong>{metric.value}</strong>
                    <small>{metric.meta}</small>
                  </div>
                </div>
              ))}
            </div>
          </HudPanel>

          <HudPanel
            className="jarvis-shell-panel jarvis-shell-panel--evidence"
            header={
              <HudPanelHeader
                eyebrow="Evidence / fabric summary"
                icon={<Database />}
                metadata={selectedNode?.ip_address || "LOCAL HOST"}
                status={representativeAlert ? representativeAlert.status.toUpperCase() : "NOMINAL"}
                title="Evidence / Fabric Summary"
                titleId="jarvis-evidence-title"
              />
            }
            labelledBy="jarvis-evidence-title"
          >
            <div className="jarvis-evidence-panel">
              <div className="jarvis-evidence-panel__narrative">
                <p>
                  {representativeAlert
                    ? `Primary evidence focus: ${representativeAlert.title} on ${representativeAlert.node.toUpperCase()}.`
                    : "Primary evidence focus: no active blocking findings in the selected scope."}
                </p>
                <p>
                  Existing topology drill-in remains available for logical fabric review. Lower detailed diagnostics remain below this primary operations workspace.
                </p>
              </div>
              <div className="jarvis-evidence-panel__facts">
                <div>
                  <span>Selected node</span>
                  <strong>{selectedNodeName.toUpperCase()}</strong>
                </div>
                <div>
                  <span>Benchmark evidence</span>
                  <strong>{latestBenchmark ? latestBenchmark.benchmark_type.toUpperCase() : "NONE"}</strong>
                </div>
                <div>
                  <span>Topology boundary</span>
                  <strong>NVLINK → NIC → FABRIC</strong>
                </div>
              </div>
              <div className="jarvis-evidence-panel__actions">
                <button type="button" onClick={onOpenTopology} className="jarvis-action jarvis-action--secondary">
                  <Network className="h-4 w-4" />
                  Topology map
                </button>
                <button type="button" onClick={onOpenExport} className="jarvis-action jarvis-action--secondary">
                  <FileText className="h-4 w-4" />
                  Export evidence
                </button>
              </div>
            </div>
          </HudPanel>
        </div>
      </div>
    </section>
  );
}
