export type CheckStatus = "pass" | "warning" | "fail" | "unknown" | "unavailable";
export type CheckSeverity = "low" | "medium" | "high" | "critical";

export interface CommandEvidence {
  command: string[];
  exit_code: number;
  duration_seconds: number;
  stdout: string;
  stderr: string;
  timestamp: string;
}

export interface ValidationCheck {
  id: string;
  category: string;
  title: string;
  status: CheckStatus;
  severity: CheckSeverity;
  summary: string;
  evidence: CommandEvidence[];
  recommendation?: string | null;
  node: string;
}

export interface ValidationCategory {
  id: string;
  name: string;
  weight: number;
  checks: ValidationCheck[];
  score?: number;
}

export interface Node {
  name: string;
  ip_address: string | null;
  status: CheckStatus;
  categories: Record<string, ValidationCategory>;
}

export interface BenchmarkResult {
  benchmark_type: string;
  file_path: string;
  metrics: Record<string, number | string | null>;
  raw_snippet: string;
  status: CheckStatus;
  timestamp: string;
}

export interface Cluster {
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
    critical_failure_count?: number;
    validation_source?: string;
    selected_profile?: string;
    collection_timestamp?: string;
    detected_environment?: string;
    hardware_identity_status?: string;
    sanitization_status?: string;
    source_confidence?: string;
    limitations?: string[];
    simulated?: boolean;
    imported?: boolean;
  };
}

export type EvidenceSourceKind = "simulated" | "latest-live" | "imported-live";

export interface EvidenceSourceOption {
  id: "simulated-healthy" | "simulated-degraded" | "latest-live" | "imported-live" | string;
  label: string;
  kind: EvidenceSourceKind;
  endpoint: string;
  available: boolean;
  description?: string;
}

export interface SourceContext {
  evidenceSource: string;
  selectedValidationProfile: string;
  detectedEnvironment: string;
  collectionTimestamp: string;
  hardwareIdentityStatus: string;
  sanitizationStatus: string;
  sourceConfidence: string;
  limitations: string[];
  importedEvidenceBanner?: string;
}

export interface AcceptanceGate {
  acceptanceStatus: string;
  handoffDecision: string;
  handoffApproved: boolean;
  criticalFindings: number;
  highSeverityFindings: number;
  unresolvedRecommendations: number;
  blockedReason: string;
  explanatoryText: string;
}

export interface GpuHealthSummary {
  discoveredGpuCount: number;
  healthyGpuCount: number;
  warningGpuCount: number;
  criticalGpuCount: number;
  eccCondition: string;
  nvlinkStatus: string;
  dcgmStatus: string;
  highlightedGpu: string | null;
  operationalResponse: string;
}

export interface FabricHealthSummary {
  activePorts: number;
  degradedPorts: number;
  inactivePorts: number;
  expectedLink: string;
  negotiatedLink: string;
  affectedNode: string | null;
  remediationWorkflow: string[];
  summary: string;
}

const classificationText = (classification: string) => classification.trim().toLowerCase();

export function getAllChecks(cluster: Cluster | null | undefined): ValidationCheck[] {
  if (!cluster?.nodes) return [];
  return cluster.nodes.flatMap((node) => Object.values(node.categories ?? {}).flatMap((category) => category.checks ?? []));
}

export function getNodeChecks(node: Node | null | undefined): ValidationCheck[] {
  if (!node) return [];
  return Object.values(node.categories ?? {}).flatMap((category) => category.checks ?? []);
}

export function getCheck(node: Node | null | undefined, checkId: string): ValidationCheck | undefined {
  return getNodeChecks(node).find((check) => check.id === checkId);
}

export function getCategoryStatus(node: Node | null | undefined, categoryId: string): CheckStatus {
  const checks = node?.categories?.[categoryId]?.checks ?? [];
  if (checks.some((check) => check.status === "fail")) return "fail";
  if (checks.some((check) => check.status === "warning")) return "warning";
  if (checks.some((check) => check.status === "pass")) return "pass";
  return "unknown";
}

export function formatStatusLabel(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function getStatusTone(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized.includes("remediation") || normalized.includes("fail") || normalized.includes("blocked")) return "critical";
  if (normalized.includes("warning") || normalized.includes("conditional")) return "warning";
  return "healthy";
}

export function isSimulatedScenario(cluster: Cluster | null | undefined): boolean {
  return Boolean(cluster?.metadata?.execution_mode?.toLowerCase().includes("demonstration"));
}

export function buildSourceContext(cluster: Cluster | null | undefined, source: EvidenceSourceOption | null | undefined): SourceContext {
  const metadata = cluster?.metadata ?? {};
  const simulated = source?.kind === "simulated" || metadata.simulated === true || isSimulatedScenario(cluster);
  const sourceLabel = source?.label ?? metadata.validation_source ?? "Unknown evidence source";

  if (simulated) {
    return {
      evidenceSource: sourceLabel,
      selectedValidationProfile: metadata.selected_profile ?? "Simulated AI factory profile",
      detectedEnvironment: "Deterministic interview demonstration data",
      collectionTimestamp: cluster?.timestamp ?? metadata.collection_timestamp ?? "Not collected from live hardware",
      hardwareIdentityStatus: "Simulated hardware identity",
      sanitizationStatus: "Not required for simulated evidence",
      sourceConfidence: "Demo only",
      limitations: [
        "Simulated scenario data is deterministic and not real hardware evidence.",
        "DGX-class labels in demo node names are scenario labels only, not a hardware authenticity claim.",
      ],
    };
  }

  const imported = source?.kind === "imported-live" || metadata.imported === true || metadata.validation_source === "Imported Live Evidence";

  return {
    evidenceSource: metadata.validation_source ?? sourceLabel,
    selectedValidationProfile: metadata.selected_profile ?? "Profile not declared",
    detectedEnvironment: metadata.detected_environment ?? "Live environment not classified",
    collectionTimestamp: metadata.collection_timestamp ?? cluster?.timestamp ?? "Collection timestamp unavailable",
    hardwareIdentityStatus: metadata.hardware_identity_status ?? "Hardware identity not independently confirmed",
    sanitizationStatus: metadata.sanitization_status ?? (metadata.imported ? "Imported evidence; sanitization manifest required" : "Sanitization status not declared"),
    sourceConfidence: metadata.source_confidence ?? "Unknown - review attached evidence and limitations",
    limitations: metadata.limitations?.length ? metadata.limitations : ["No limitations were supplied with this live evidence payload."],
    importedEvidenceBanner: imported
      ? "Imported evidence: review sanitization status, provenance, and limitations before treating this payload as real hardware evidence."
      : undefined,
  };
}

function extractFirstNumber(summary: string, pattern: RegExp): number | null {
  const match = summary.match(pattern);
  return match ? Number.parseInt(match[1], 10) : null;
}

function parseGpuCount(summary: string): number | null {
  return extractFirstNumber(summary, /(\d+)\s+GPUs?/i);
}

function parseGpuIdentifier(summary: string): string | null {
  const match = summary.match(/GPU\s*(\d+)/i);
  return match ? `GPU ${match[1]}` : null;
}

function parseLinkSpeeds(summary: string): { negotiated: number | null; expected: number | null } {
  const matches = [...summary.matchAll(/(\d+)\s*Gb\/s/gi)].map((match) => Number.parseInt(match[1], 10));
  return {
    negotiated: matches[0] ?? null,
    expected: matches[1] ?? (matches[0] ? 400 : null),
  };
}

function parseWidth(summary: string): { negotiated: string | null; expected: string | null } {
  const match = summary.match(/(\d+x)\s+width\s+instead\s+of\s+(\d+x)\s+width/i);
  return {
    negotiated: match?.[1] ?? null,
    expected: match?.[2] ?? null,
  };
}

function parseHealthyPods(summary: string): string | null {
  const match = summary.match(/(\d+\/\d+)\s+healthy\s+pods/i);
  return match?.[1] ?? null;
}

function parseNodeState(summary: string): string | null {
  const match = summary.match(/Node state:\s*([A-Z_]+)/i);
  return match?.[1] ?? null;
}

export function deriveAcceptanceGate(cluster: Cluster | null | undefined): AcceptanceGate {
  const checks = getAllChecks(cluster);
  const criticalFindings = checks.filter((check) => check.status === "fail" && check.severity === "critical");
  const highSeverityFindings = checks.filter((check) => check.status !== "pass" && check.severity === "high");
  const unresolvedRecommendations = cluster?.recommendations?.length ?? 0;
  const normalizedClassification = classificationText(cluster?.classification ?? "");
  const eccFinding = criticalFindings.find((check) => check.id === "gpu.ecc_errors");

  if (criticalFindings.length > 0 || normalizedClassification === "remediation required") {
    return {
      acceptanceStatus: cluster?.classification ?? "Remediation required",
      handoffDecision: "Handoff blocked",
      handoffApproved: false,
      criticalFindings: criticalFindings.length,
      highSeverityFindings: highSeverityFindings.length,
      unresolvedRecommendations,
      blockedReason: eccFinding
        ? `Blocked by a critical GPU ECC condition on ${eccFinding.node} / ${parseGpuIdentifier(eccFinding.summary) ?? "affected GPU"}.`
        : criticalFindings[0]?.summary ?? "Release-blocking critical findings remain unresolved.",
      explanatoryText:
        "The readiness score represents aggregate infrastructure health. Customer acceptance is separately gated by critical findings.",
    };
  }

  if (normalizedClassification === "ready with warnings" || highSeverityFindings.length > 0 || unresolvedRecommendations > 0) {
    return {
      acceptanceStatus: "Conditional handoff",
      handoffDecision: "Conditional handoff",
      handoffApproved: false,
      criticalFindings: 0,
      highSeverityFindings: highSeverityFindings.length,
      unresolvedRecommendations,
      blockedReason: highSeverityFindings[0]?.summary ?? "Non-critical findings should be resolved or explicitly waived before customer handoff.",
      explanatoryText:
        "The readiness score represents aggregate infrastructure health. Customer acceptance is separately gated by critical findings.",
    };
  }

  return {
    acceptanceStatus: "Approved for handoff",
    handoffDecision: "Approved for handoff",
    handoffApproved: true,
    criticalFindings: 0,
    highSeverityFindings: 0,
    unresolvedRecommendations,
    blockedReason: "No release-blocking findings are active in the current validation profile.",
    explanatoryText:
      "The readiness score represents aggregate infrastructure health. Customer acceptance is separately gated by critical findings.",
  };
}

export function deriveGpuHealth(cluster: Cluster | null | undefined): GpuHealthSummary {
  const nodes = cluster?.nodes ?? [];
  let discoveredGpuCount = 0;
  let warningGpuCount = 0;
  let criticalGpuCount = 0;
  let highlightedGpu: string | null = null;
  let eccCondition = "No active ECC faults detected in the current scenario.";

  let nvlinkAvailableNodes = 0;
  let dcgmAvailableNodes = 0;
  let dcgmHealthyNodes = 0;

  for (const node of nodes) {
    const eccCheck = getCheck(node, "gpu.ecc_errors");
    const nvlinkCheck = getCheck(node, "gpu.nvlink");
    const dcgmPresent = getCheck(node, "gpu.dcgm_present");
    const dcgmHealth = getCheck(node, "gpu.dcgm_health");

    const gpuCount = parseGpuCount(eccCheck?.summary ?? "") ?? 8;
    discoveredGpuCount += gpuCount;

    if (eccCheck?.status === "warning") {
      warningGpuCount += 1;
      highlightedGpu = `${node.name} / ${parseGpuIdentifier(eccCheck.summary) ?? "affected GPU"}`;
      eccCondition = `${highlightedGpu}: elevated ECC activity detected.`;
    }

    if (eccCheck?.status === "fail") {
      criticalGpuCount += 1;
      highlightedGpu = `${node.name} / ${parseGpuIdentifier(eccCheck.summary) ?? "affected GPU"}`;
      eccCondition = `${highlightedGpu}: uncorrectable ECC errors detected.`;
    }

    if (nvlinkCheck && nvlinkCheck.status === "pass") nvlinkAvailableNodes += 1;
    if (dcgmPresent && dcgmPresent.status === "pass") dcgmAvailableNodes += 1;
    if (dcgmHealth && dcgmHealth.status === "pass") dcgmHealthyNodes += 1;
  }

  const healthyGpuCount = Math.max(discoveredGpuCount - warningGpuCount - criticalGpuCount, 0);
  const nvlinkStatus = nvlinkAvailableNodes > 0
    ? `NVLink topology reported as available on ${nvlinkAvailableNodes}/${nodes.length || 1} nodes.`
    : "NVLink topology data is not available in the current payload.";
  const dcgmStatus = dcgmAvailableNodes > 0
    ? `DCGM present on ${dcgmAvailableNodes}/${nodes.length || 1} nodes; health checks passed on ${dcgmHealthyNodes}/${nodes.length || 1}.`
    : "DCGM availability is not present in the current payload.";

  return {
    discoveredGpuCount,
    healthyGpuCount,
    warningGpuCount,
    criticalGpuCount,
    eccCondition,
    nvlinkStatus,
    dcgmStatus,
    highlightedGpu,
    operationalResponse:
      "Keep the node drained, preserve diagnostics, run DCGM validation, confirm repeatability, and escalate for hardware support if the fault persists.",
  };
}

export function deriveFabricHealth(cluster: Cluster | null | undefined): FabricHealthSummary {
  const nodes = cluster?.nodes ?? [];
  let activePorts = 0;
  let degradedPorts = 0;
  let inactivePorts = 0;
  let expectedLink = "400 Gb/s";
  let negotiatedLink = "400 Gb/s";
  let affectedNode: string | null = null;
  let summary = "All observed InfiniBand links are operating at the expected rate.";

  for (const node of nodes) {
    const portStateCheck = getCheck(node, "network.ib_port_state");
    const linkSpeedCheck = getCheck(node, "network.ib_link_speed");

    activePorts += extractFirstNumber(portStateCheck?.summary ?? "", /(\d+)\s+detected\s+InfiniBand\s+links?/i) ?? 0;

    if (portStateCheck?.status === "fail") {
      inactivePorts += 1;
    }

    if (linkSpeedCheck?.status !== "pass") {
      degradedPorts += 1;
      affectedNode = node.name;
      const speeds = parseLinkSpeeds(linkSpeedCheck?.summary ?? "");
      const width = parseWidth(linkSpeedCheck?.summary ?? "");
      negotiatedLink = speeds.negotiated ? `${speeds.negotiated} Gb/s${width.negotiated ? ` (${width.negotiated})` : ""}` : negotiatedLink;
      expectedLink = speeds.expected ? `${speeds.expected} Gb/s${width.expected ? ` (${width.expected})` : ""}` : expectedLink;
      summary = `${node.name} has an active InfiniBand link operating below the expected rate.`;
    }
  }

  return {
    activePorts,
    degradedPorts,
    inactivePorts,
    expectedLink,
    negotiatedLink,
    affectedNode,
    summary,
    remediationWorkflow: [
      "Verify cable health.",
      "Verify switch port configuration.",
      "Compare firmware compatibility.",
      "Inspect negotiated width.",
      "Inspect negotiated speed.",
    ],
  };
}

export function deriveSchedulerSnapshot(cluster: Cluster | null | undefined): Array<{
  node: string;
  slurmState: string;
  kubernetesState: string;
  gpuOperatorState: string;
}> {
  return (cluster?.nodes ?? []).map((node) => {
    const slurm = getCheck(node, "slurm.node_state");
    const kubeReady = getCheck(node, "kubernetes.node_ready");
    const gpuOperator = getCheck(node, "kubernetes.gpu_operator");
    const devicePlugin = getCheck(node, "kubernetes.device_plugin");

    return {
      node: node.name,
      slurmState: parseNodeState(slurm?.summary ?? "") ?? (slurm?.status === "pass" ? "IDLE" : formatStatusLabel(slurm?.status ?? "unknown")),
      kubernetesState: kubeReady?.status === "pass" ? "Ready" : kubeReady ? formatStatusLabel(kubeReady.status) : "Not reported",
      gpuOperatorState:
        gpuOperator?.status === "pass"
          ? "Healthy"
          : parseHealthyPods(gpuOperator?.summary ?? "")
            ? `${parseHealthyPods(gpuOperator?.summary ?? "")} healthy pods`
            : devicePlugin?.status === "warning"
              ? "Device plugin warning"
              : gpuOperator
                ? formatStatusLabel(gpuOperator.status)
                : "Not reported",
    };
  });
}

export function buildArtifactLinks(scenario: "healthy" | "degraded") {
  return {
    html: `/reports/${scenario}/html`,
    markdown: `/reports/${scenario}/markdown`,
    json: `/reports/${scenario}/json`,
  };
}

export function deriveValidationProfile(cluster: Cluster | null | undefined) {
  return {
    title: "GPU-Accelerated AI Compute Cluster",
    scope: "Linux • GPU Compute • InfiniBand • Slurm • Kubernetes • Storage",
    targets: [
      "DGX-class deployment",
      "HGX-based deployment",
      "OEM GPU platform",
      "Slurm-managed AI cluster",
      "Kubernetes GPU cluster",
    ],
    mode: cluster?.metadata?.execution_mode ?? "Validation",
  };
}

export function buildBenchmarkCatalog(cluster: Cluster | null | undefined) {
  const demonstrated = cluster?.benchmark_results?.map((item) => item.benchmark_type) ?? [];
  return {
    demonstrated,
    supportedIngestion: ["NCCL Tests", "HPL", "fio", "iperf3", "OSU MPI"],
    roadmapOnly: ["HPL-AI", "HPCG", "MLPerf result ingestion", "Base Command Manager integration", "Ansible multi-node collection"],
  };
}
