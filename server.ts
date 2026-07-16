import express from "express";
import path from "path";
import fs from "fs";
import { execFile } from "child_process";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
