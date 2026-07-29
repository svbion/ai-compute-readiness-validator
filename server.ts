import express from "express";
import path from "path";
import fs from "fs";
import { execFile } from "child_process";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const platformStorePath = path.join(process.cwd(), "artifacts", "platform-v02-store.json");

  app.use(express.json());

  type PlatformStore = Record<string, any[]>;
  const emptyPlatformStore = (): PlatformStore => ({
    organizations: [], users: [], roles: [], permissions: [], clusters: [], racks: [], nodes: [], gpus: [], nics: [],
    fabric_links: [], storage_targets: [], schedulers: [], kubernetes_clusters: [], agents: [], agent_heartbeats: [], agent_executions: [],
    validation_definitions: [], validation_runs: [], validation_steps: [], validation_findings: [], benchmark_packages: [], benchmark_runs: [],
    benchmark_results: [], benchmark_metrics: [], benchmark_comparisons: [], regression_findings: [], alerts: [], incidents: [], investigations: [],
    conversations: [], conversation_messages: [], evidence_references: [], reports: [], remediation_plans: [], approval_requests: [], audit_events: [],
    academy_courses: [], academy_lessons: [], academy_labs: [], academy_progress: [], saved_investigations: []
  });
  const stableId = (prefix: string, seed: string) => `${prefix}_${Buffer.from(seed).toString("base64url").slice(0, 18)}`;
  const now = () => new Date().toISOString();
  const writePlatformStore = (store: PlatformStore) => {
    fs.mkdirSync(path.dirname(platformStorePath), { recursive: true });
    fs.writeFileSync(platformStorePath, JSON.stringify(store, null, 2) + "\n", "utf-8");
  };
  const readPlatformStore = (): PlatformStore => {
    if (!fs.existsSync(platformStorePath)) {
      const orgId = stableId("org", "demo");
      const clusterId = stableId("cluster", "fixture-h200-cluster");
      const nodeId = stableId("node", "node-a");
      const gpu0 = stableId("gpu", "node-a-0");
      const gpu1 = stableId("gpu", "node-a-1");
      const store = emptyPlatformStore();
      store.organizations.push({ id: orgId, name: "GPUValidator Demo Org", status: "active", created_at: now(), updated_at: now() });
      store.roles.push({ id: stableId("role", "admin"), organization_id: orgId, name: "Administrator", permissions: ["*"] });
      store.roles.push({ id: stableId("role", "viewer"), organization_id: orgId, name: "Viewer", permissions: ["cluster:read", "academy:read"] });
      store.users.push({ id: stableId("user", "admin"), organization_id: orgId, email: "admin@example.test", role_ids: [stableId("role", "admin")] });
      store.clusters.push({ id: clusterId, organization_id: orgId, name: "fixture-h200-cluster", status: "partial-data", environment: "fixture" });
      store.racks.push({ id: stableId("rack", "rack-a"), organization_id: orgId, cluster_id: clusterId, name: "rack-a" });
      store.nodes.push({ id: nodeId, organization_id: orgId, cluster_id: clusterId, hostname: "node-a", operating_system: "unknown", kernel: "unknown", status: "partial-data" });
      store.gpus.push({ id: gpu0, organization_id: orgId, node_id: nodeId, index: 0, model: "NVIDIA H200", memory_gb: 141, nvlink_status: "observed" });
      store.gpus.push({ id: gpu1, organization_id: orgId, node_id: nodeId, index: 1, model: "NVIDIA H200", memory_gb: 141, nvlink_status: "observed" });
      store.nics.push({ id: stableId("nic", "mlx5_0"), organization_id: orgId, node_id: nodeId, name: "mlx5_0", kind: "InfiniBand", link_state: "unknown" });
      store.fabric_links.push({ id: stableId("fabric", "gpu0-gpu1"), organization_id: orgId, source_resource_id: gpu0, target_resource_id: gpu1, fabric_type: "NVLink", source_type: "observed", status: "unknown" });
      store.validation_definitions.push({ id: stableId("vdef", "gpu-node-baseline"), organization_id: orgId, category: "GPU hardware", profile: "GPU node baseline", expected_result: "GPU inventory is available" });
      store.academy_courses.push({ id: stableId("course", "nccl"), organization_id: orgId, title: "AI Infrastructure Academy: NCCL Troubleshooting" });
      store.academy_lessons.push({ id: stableId("lesson", "nccl-fundamentals"), organization_id: orgId, course_id: stableId("course", "nccl"), title: "NCCL all-reduce troubleshooting fundamentals" });
      store.academy_labs.push({ id: stableId("lab", "all-reduce-drop"), organization_id: orgId, course_id: stableId("course", "nccl"), title: "Why did NCCL all-reduce bandwidth drop?", fixture_refs: ["gpu-benchmark-lab:h200-public"] });
      store.audit_events.push({ id: stableId("audit", `seed-${now()}`), organization_id: orgId, action: "platform.seed_demo_fixture", object_type: "organization", object_id: orgId, created_at: now() });
      writePlatformStore(store);
      return store;
    }
    return { ...emptyPlatformStore(), ...JSON.parse(fs.readFileSync(platformStorePath, "utf-8")) };
  };
  const platformResponse = (surface: string, payload: Record<string, any> = {}) => {
    const store = readPlatformStore();
    return { surface, mode: process.env.GPUVALIDATOR_DEMO_MODE === "false" ? "live" : "demo", generated_at: now(), states: { loading: false, empty: Object.values(store).every((items) => items.length === 0), error: null, permission: "allowed", partial_data: true }, counts: Object.fromEntries(Object.entries(store).map(([key, value]) => [key, value.length])), ...payload };
  };

  // 1. API: Get latest report results
  app.get("/api/results", (req, res) => {
    const scenario = req.query.scenario as string;
    let filePath = path.join(process.cwd(), "artifacts", "latest-results.json");

    if (scenario === "healthy") {
      filePath = path.join(process.cwd(), "sample-data", "healthy-cluster.json");
    } else if (scenario === "degraded") {
      filePath = path.join(process.cwd(), "sample-data", "degraded-cluster.json");
    }

    if (!fs.existsSync(filePath)) {
      // Fallback: If no run was executed yet, send the healthy demo as default
      const defaultDemo = path.join(process.cwd(), "sample-data", "healthy-cluster.json");
      if (fs.existsSync(defaultDemo)) {
        filePath = defaultDemo;
      } else {
        return res.status(404).json({ error: "Validation results not found. Please trigger a scan." });
      }
    }

    try {
      const fileData = fs.readFileSync(filePath, "utf-8");
      return res.json(JSON.parse(fileData));
    } catch (err: any) {
      return res.status(500).json({ error: `Failed to load results: ${err.message}` });
    }
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

  app.get("/api/platform/summary", (_req, res) => {
    const store = readPlatformStore();
    return res.json(platformResponse("dashboard", { store_path: "artifacts/platform-v02-store.json", organizations: store.organizations, clusters: store.clusters, alerts: store.alerts.slice(-10), audit_events: store.audit_events.slice(-10) }));
  });

  app.get("/api/platform/inventory", (_req, res) => {
    const store = readPlatformStore();
    return res.json(platformResponse("inventory", { clusters: store.clusters, racks: store.racks, nodes: store.nodes, gpus: store.gpus, nics: store.nics, fabric_links: store.fabric_links, storage_targets: store.storage_targets, schedulers: store.schedulers, kubernetes_clusters: store.kubernetes_clusters }));
  });

  app.get("/api/platform/clusters", (_req, res) => res.json(platformResponse("cluster-management", { clusters: readPlatformStore().clusters })));

  app.get("/api/platform/clusters/:id", (req, res) => {
    const store = readPlatformStore();
    const cluster = store.clusters.find((item) => item.id === req.params.id);
    if (!cluster) return res.status(404).json({ error: "cluster not found" });
    return res.json(platformResponse("cluster-detail", { cluster, nodes: store.nodes.filter((node) => node.cluster_id === cluster.id) }));
  });

  app.get("/api/platform/validation", (_req, res) => {
    const store = readPlatformStore();
    return res.json(platformResponse("validation-center", { definitions: store.validation_definitions, runs: store.validation_runs, findings: store.validation_findings }));
  });

  app.get("/api/platform/benchmarks", (_req, res) => {
    const store = readPlatformStore();
    return res.json(platformResponse("benchmark-center", { packages: store.benchmark_packages, runs: store.benchmark_runs, metrics: store.benchmark_metrics, comparisons: store.benchmark_comparisons, regressions: store.regression_findings }));
  });

  app.get("/api/platform/topology/:clusterId", (req, res) => {
    const store = readPlatformStore();
    const nodeIds = new Set(store.nodes.filter((node) => node.cluster_id === req.params.clusterId).map((node) => node.id));
    const gpuIds = new Set(store.gpus.filter((gpu) => nodeIds.has(gpu.node_id)).map((gpu) => gpu.id));
    return res.json(platformResponse("topology", { nodes: [...store.nodes.filter((node) => nodeIds.has(node.id)), ...store.gpus.filter((gpu) => gpuIds.has(gpu.id)), ...store.nics.filter((nic) => nodeIds.has(nic.node_id))], edges: store.fabric_links.filter((edge) => gpuIds.has(edge.source_resource_id) || gpuIds.has(edge.target_resource_id)), warning: "Logical topology is not represented as guaranteed physical cabling." }));
  });

  app.get("/api/platform/monitoring", (_req, res) => res.json(platformResponse("live-monitoring", { heartbeats: readPlatformStore().agent_heartbeats, alerts: readPlatformStore().alerts })));
  app.get("/api/platform/alerts", (_req, res) => res.json(platformResponse("alerts", { alerts: readPlatformStore().alerts })));
  app.get("/api/platform/reports", (_req, res) => res.json(platformResponse("reports", { reports: readPlatformStore().reports })));
  app.get("/api/platform/academy", (_req, res) => {
    const store = readPlatformStore();
    return res.json(platformResponse("academy", { courses: store.academy_courses, lessons: store.academy_lessons, labs: store.academy_labs, progress: store.academy_progress }));
  });
  app.get("/api/platform/settings", (_req, res) => res.json(platformResponse("settings", { roles: readPlatformStore().roles, permissions: readPlatformStore().permissions, integrations: ["Slurm", "Kubernetes", "Prometheus", "Grafana", "DCGM", "Slack", "Teams", "PagerDuty", "S3", "SMTP"].map((name) => ({ name, status: "not configured" })) })));

  app.post("/api/platform/copilot", (req, res) => res.json(platformResponse("ai-copilot", { answer: { summary: "Evidence-grounded investigation requires persisted runs, findings, and citations. Current demo response cites supplied context only.", confidence: req.body?.context_ids?.length ? "medium" : "low", evidence_citations: req.body?.context_ids || [], approval_requirement: "required for high-risk remediation" } })));

  app.post("/api/platform/remediation-plans", (req, res) => {
    const store = readPlatformStore();
    const orgId = store.organizations[0]?.id || stableId("org", "demo");
    const plan = { id: stableId("rem", `${req.body?.action || "action"}-${now()}`), organization_id: orgId, action: req.body?.action || "Investigate", target: req.body?.target || "unknown", risk: req.body?.risk || "medium", state: "REVIEW_REQUIRED", created_at: now(), updated_at: now() };
    store.remediation_plans.push(plan);
    store.audit_events.push({ id: stableId("audit", `rem-${now()}`), organization_id: orgId, action: "remediation.plan.create", object_type: "remediation_plan", object_id: plan.id, created_at: now() });
    writePlatformStore(store);
    return res.status(201).json(platformResponse("remediation", { plan }));
  });

  // 2. API: Trigger a diagnostic scan or demo run
  app.post("/api/run-scenario", (req, res) => {
    const scenario = req.body.scenario || "degraded";

    // Run the Python executable in the container securely
    // In live mode, we would call ['ai-validator', 'validate'] or similar
    // Since we want to let users test healthy/degraded live in the UI, we run demo scenario.
    const pythonExecutable = "/.venv/bin/python";
    const args = ["-m", "ai_validator.cli", "demo", "--scenario", scenario];
    
    execFile(pythonExecutable, args, (error, stdout, stderr) => {
      if (error) {
        console.error(`CLI Execution error: ${error.message}`);
        return res.status(500).json({ error: `Failed to execute validation CLI: ${error.message}`, details: stderr });
      }

      // Read back the latest results file
      const latestPath = path.join(process.cwd(), "artifacts", "latest-results.json");
      if (!fs.existsSync(latestPath)) {
        return res.status(500).json({ error: "CLI completed, but results JSON was not written." });
      }

      try {
        const fileData = fs.readFileSync(latestPath, "utf-8");
        return res.json(JSON.parse(fileData));
      } catch (err: any) {
        return res.status(500).json({ error: `Failed to parse results: ${err.message}` });
      }
    });
  });

  // 3. Mount Vite middleware for SPA and dev mode assets
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Full-stack diagnostic portal listening at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to boot full-stack portal:", err);
});
