import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildArtifactLinks,
  deriveAcceptanceGate,
  deriveFabricHealth,
  deriveGpuHealth,
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
