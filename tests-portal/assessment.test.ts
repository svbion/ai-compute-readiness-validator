import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildArtifactLinks,
  buildSourceContext,
  deriveAcceptanceGate,
  deriveFabricHealth,
  deriveGpuHealth,
  type EvidenceSourceOption,
  type Cluster,
} from "../src/portal/assessment";

function loadScenario(name: "healthy" | "degraded"): Cluster {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), `artifacts/${name}-results.json`), "utf8"),
  ) as Cluster;
}

test("acceptance gate blocks degraded scenario even with a high readiness score", () => {
  const degraded = loadScenario("degraded");
  const gate = deriveAcceptanceGate(degraded);

  assert.equal(degraded.overall_score, 97.01);
  assert.equal(degraded.classification, "Remediation required");
  assert.equal(gate.acceptanceStatus, "Remediation required");
  assert.equal(gate.handoffDecision, "Handoff blocked");
  assert.equal(gate.handoffApproved, false);
  assert.equal(gate.criticalFindings, 2);
  assert.equal(gate.highSeverityFindings, 1);
  assert.equal(gate.unresolvedRecommendations, 4);
  assert.match(gate.blockedReason, /GPU ECC condition/i);
});

test("acceptance gate approves the healthy scenario", () => {
  const healthy = loadScenario("healthy");
  const gate = deriveAcceptanceGate(healthy);

  assert.equal(healthy.classification, "Ready");
  assert.equal(gate.acceptanceStatus, "Approved for handoff");
  assert.equal(gate.handoffDecision, "Approved for handoff");
  assert.equal(gate.handoffApproved, true);
  assert.equal(gate.criticalFindings, 0);
  assert.equal(gate.unresolvedRecommendations, 0);
});

test("GPU and fabric summaries derive from scenario evidence", () => {
  const degraded = loadScenario("degraded");
  const gpuHealth = deriveGpuHealth(degraded);
  const fabricHealth = deriveFabricHealth(degraded);

  assert.equal(gpuHealth.discoveredGpuCount, 32);
  assert.equal(gpuHealth.healthyGpuCount, 31);
  assert.equal(gpuHealth.criticalGpuCount, 1);
  assert.equal(gpuHealth.warningGpuCount, 0);
  assert.equal(gpuHealth.highlightedGpu, "dgx04 / GPU 5");
  assert.match(gpuHealth.eccCondition, /uncorrectable ECC errors detected/i);

  assert.equal(fabricHealth.degradedPorts, 1);
  assert.equal(fabricHealth.affectedNode, "dgx03");
  assert.equal(fabricHealth.expectedLink, "400 Gb/s (4x)");
  assert.equal(fabricHealth.negotiatedLink, "200 Gb/s (2x)");
});

test("report links stay on safe server routes", () => {
  assert.deepEqual(buildArtifactLinks("healthy"), {
    html: "/reports/healthy/html",
    markdown: "/reports/healthy/markdown",
    json: "/reports/healthy/json",
  });

  assert.deepEqual(buildArtifactLinks("degraded"), {
    html: "/reports/degraded/html",
    markdown: "/reports/degraded/markdown",
    json: "/reports/degraded/json",
  });
});

test("derivation helpers tolerate missing optional fields", () => {
  const sparseCluster = {
    name: "demo",
    overall_score: 88,
    classification: "Ready",
    nodes: [],
    recommendations: [],
    benchmark_results: [],
    timestamp: new Date().toISOString(),
    metadata: {},
  } as Cluster;

  const gate = deriveAcceptanceGate(sparseCluster);
  const gpuHealth = deriveGpuHealth(sparseCluster);

  assert.equal(gate.acceptanceStatus, "Approved for handoff");
  assert.equal(gpuHealth.discoveredGpuCount, 0);
});

test("source context labels simulated and live evidence provenance", () => {
  const healthy = loadScenario("healthy");
  const simulatedSource: EvidenceSourceOption = {
    id: "simulated-healthy",
    label: "Simulated Healthy",
    kind: "simulated",
    endpoint: "/api/results?scenario=healthy",
    available: true,
  };
  const simulatedContext = buildSourceContext(healthy, simulatedSource);

  assert.equal(simulatedContext.evidenceSource, "Simulated Healthy");
  assert.equal(simulatedContext.hardwareIdentityStatus, "Simulated hardware identity");
  assert.equal(simulatedContext.sanitizationStatus, "Not required for simulated evidence");
  assert.equal(simulatedContext.sourceConfidence, "Demo only");
  assert.match(simulatedContext.limitations.join(" "), /not real hardware/i);

  const liveCluster: Cluster = {
    ...healthy,
    timestamp: "2026-07-17T12:34:56Z",
    metadata: {
      ...healthy.metadata,
      execution_mode: "Live Validation",
      validation_source: "Imported Live Evidence",
      selected_profile: "dgx-class",
      collection_timestamp: "2026-07-17T12:34:56Z",
      detected_environment: "DGX Cloud Lepton candidate",
      hardware_identity_status: "Provider-reported H100 NVL instance; DMI unavailable",
      sanitization_status: "Sanitized with redaction manifest",
      source_confidence: "Medium - provider identity with sanitized command output",
      limitations: ["No SSH host-level access; workload shell only."],
      simulated: false,
    },
  };
  const importedSource: EvidenceSourceOption = {
    id: "imported-live",
    label: "Imported Live Evidence",
    kind: "imported-live",
    endpoint: "/api/results?source=imported-live",
    available: true,
  };
  const liveContext = buildSourceContext(liveCluster, importedSource);

  assert.equal(liveContext.evidenceSource, "Imported Live Evidence");
  assert.equal(liveContext.selectedValidationProfile, "dgx-class");
  assert.equal(liveContext.detectedEnvironment, "DGX Cloud Lepton candidate");
  assert.equal(liveContext.collectionTimestamp, "2026-07-17T12:34:56Z");
  assert.equal(liveContext.hardwareIdentityStatus, "Provider-reported H100 NVL instance; DMI unavailable");
  assert.equal(liveContext.sanitizationStatus, "Sanitized with redaction manifest");
  assert.equal(liveContext.sourceConfidence, "Medium - provider identity with sanitized command output");
  assert.deepEqual(liveContext.limitations, ["No SSH host-level access; workload shell only."]);
});
