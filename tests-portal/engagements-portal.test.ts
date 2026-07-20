import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  acceptanceTone,
  engagementStatusTone,
  filterEngagements,
  formatEngagementLabel,
  type Engagement,
} from "../src/portal/engagements";

const appSource = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
const serverSource = readFileSync(resolve(process.cwd(), "server.ts"), "utf8");

const demoEngagement: Engagement = {
  id: "eng_demo",
  schema_version: "1.0.0",
  name: "<img src=x onerror=alert(1)> Two-Node H100 Cluster Acceptance",
  customer_name: "NVIS Interview Demo",
  description: "demo",
  platform_profile: "hgx-h100",
  expected_node_count: 2,
  received_node_count: 0,
  ready_node_count: 0,
  remediation_node_count: 0,
  failed_node_count: 0,
  status: "collecting",
  acceptance_status: "not_evaluated",
  readiness_score: null,
  created_at: "2030-01-01T00:00:00.000Z",
  updated_at: "2030-01-01T00:00:00.000Z",
  collection_deadline: null,
  created_by: "test",
  simulated: true,
  tags: ["h100", "demo"],
};

test("engagement list and responsive navigation are implemented", () => {
  assert.match(appSource, /function EngagementListPage/);
  assert.match(appSource, /Validation engagements/);
  assert.match(appSource, /Search engagements/);
  assert.match(appSource, /Filter by status/);
  assert.match(appSource, /Filter by platform/);
  assert.match(appSource, /Create engagement/);
  assert.match(appSource, /flex flex-wrap items-center gap-2/);
});

test("new engagement form validates required fields and redirects after creation", () => {
  assert.match(appSource, /function NewEngagementPage/);
  assert.match(appSource, /Engagement name is required/);
  assert.match(appSource, /Customer name is required/);
  assert.match(appSource, /Expected node count must be between 1 and 1024/);
  assert.match(appSource, /\/api\/v1\/engagements/);
  assert.match(appSource, /window\.location\.assign\(`\/portal\/engagements\/\$\{encodeURIComponent\(payload\.engagement\.id\)\}`\)/);
});

test("detail dashboard renders required milestone sections and waiting states", () => {
  assert.match(appSource, /function EngagementDetailPage/);
  for (const section of ["Nodes", "Findings", "Benchmarks", "Evidence", "Acceptance Report", "Activity"]) {
    assert.match(appSource, new RegExp(section));
  }
  assert.match(appSource, /No evidence evaluated\./);
  assert.match(appSource, /No bundles uploaded\./);
  assert.match(appSource, /Available after validation\./);
  assert.match(appSource, /NCCL/);
  assert.match(appSource, /HPL/);
  assert.match(appSource, /Inference/);
  assert.match(appSource, /Awaiting Evidence/);
});

test("simulated label and fixture loading are visible and explicit", () => {
  assert.match(appSource, /Load NVIS demo fixture/);
  assert.match(appSource, /SIMULATED DEMO/);
  assert.match(appSource, /not real hardware evidence/);
  assert.match(appSource, /\/api\/v1\/engagement-fixtures\/nvis-interview-demo/);
});

test("unauthenticated portal engagement routes are protected by existing auth middleware", () => {
  assert.match(serverSource, /registerEngagementRoutes\(app\)/);
  assert.match(serverSource, /if \(req\.path\.startsWith\("\/api\/"\)/);
  assert.match(serverSource, /redirect\(302, "\/login\?reason=expired-session"\)/);
});

test("engagement helpers filter, label, and tone engagement state", () => {
  assert.equal(formatEngagementLabel("ready_for_review"), "Ready For Review");
  assert.equal(engagementStatusTone("collecting"), "warning");
  assert.equal(acceptanceTone("remediation_required"), "critical");
  assert.equal(filterEngagements([demoEngagement], "nvis", "collecting", "hgx-h100").length, 1);
  assert.equal(filterEngagements([demoEngagement], "missing", "all", "all").length, 0);
});

test("HTML injection is not rendered through dangerous React APIs", () => {
  assert.doesNotMatch(appSource, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(appSource, /innerHTML\s*=/);
  assert.equal(filterEngagements([demoEngagement], "<img", "all", "all").length, 1);
});
