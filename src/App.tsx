import React, { useState, useEffect } from "react";
import * as d3 from "d3";
import { 
  Activity, Server, Cpu, Network, Database, HardDrive, 
  AlertTriangle, CheckCircle2, XCircle, Terminal, HelpCircle, 
  ArrowRight, Play, RefreshCw, Layers, FileText, Settings, Award, 
  ArrowUpRight, Info, BookOpen, Sun, Moon, Search, Pin, PinOff
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Types corresponding to our Python schema
interface CommandEvidence {
  command: string[];
  exit_code: number;
  duration_seconds: number;
  stdout: string;
  stderr: string;
  timestamp: string;
}

interface ValidationCheck {
  id: string;
  category: string;
  title: string;
  status: "pass" | "warning" | "fail" | "unknown" | "unavailable";
  severity: "low" | "medium" | "high" | "critical";
  summary: string;
  evidence: CommandEvidence[];
  recommendation?: string;
  node: string;
}

interface ValidationCategory {
  id: string;
  name: string;
  weight: number;
  checks: ValidationCheck[];
  score?: number;
}

interface Node {
  name: string;
  ip_address: string | null;
  status: "pass" | "warning" | "fail" | "unknown" | "unavailable";
  categories: Record<string, ValidationCategory>;
}

interface BenchmarkResult {
  benchmark_type: string;
  file_path: string;
  metrics: Record<string, any>;
  raw_snippet: string;
  status: "pass" | "warning" | "fail" | "unknown" | "unavailable";
  timestamp: string;
}

interface Cluster {
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
}

export default function App() {
  const [activeTab, setActiveTab] = useState<"diagnostics" | "benchmarks">("diagnostics");
  const [selectedScenario, setSelectedScenario] = useState<"healthy" | "degraded">("degraded");
  const [cluster, setCluster] = useState<Cluster | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState<string[]>([]);
  const [selectedNodeName, setSelectedNodeName] = useState<string>("dgx01");
  const [selectedCheck, setSelectedCheck] = useState<ValidationCheck | null>(null);
  const [ingestingBenchmark, setIngestingBenchmark] = useState<string | null>(null);

  // Modal and Interactive Popup Toggles
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showTopologyModal, setShowTopologyModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [comparedNodeNames, setComparedNodeNames] = useState<string[]>([]);
  const [heatmapMode, setHeatmapMode] = useState<"off" | "ecc" | "latency">("off");
  const [nodeSearchQuery, setNodeSearchQuery] = useState("");
  const [nodeStatusFilter, setNodeStatusFilter] = useState<"all" | "pass" | "warning" | "fail">("all");

  // Settings Configuration Weights (Sum to 100%)
  const [customWeights, setCustomWeights] = useState<Record<string, number>>({
    linux: 15,
    gpu: 30,
    network: 20,
    storage: 10,
    slurm: 15,
    kubernetes: 10
  });

  // Settings Configuration Diagnostic Thresholds
  const [customThresholds, setCustomThresholds] = useState({
    maxEccErrors: 5,       // Error count before marking GPU as FAIL
    minBandwidthGbps: 380  // Negotiated link bandwidth threshold
  });

  const [exportFormat, setExportFormat] = useState<"json" | "markdown" | "csv">("json");
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Node Diagnostics History states
  const [nodeHistory, setNodeHistory] = useState<Array<{ run: string; score: number; timestamp: string }>>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Bookmarked / Pinned nodes for prioritized tracking
  const [bookmarkedNodes, setBookmarkedNodes] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("bookmarked_nodes");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("bookmarked_nodes", JSON.stringify(bookmarkedNodes));
    } catch (e) {
      console.error("Failed to save bookmarked nodes to localStorage", e);
    }
  }, [bookmarkedNodes]);

  const toggleBookmark = (nodeName: string) => {
    setBookmarkedNodes(prev => {
      if (prev.includes(nodeName)) {
        return prev.filter(n => n !== nodeName);
      } else {
        return [...prev, nodeName];
      }
    });
  };

  // Dynamic recalculator closing over customWeights and customThresholds states
  const getComputedCluster = (): Cluster | null => {
    if (!cluster) return null;
    
    // Deep clone the nodes list to avoid mutating state directly
    const computedNodes = cluster.nodes.map(node => {
      const updatedCategories = { ...node.categories };
      
      // Dynamic override for physical SRAM ECC errors check on dgx04
      if (node.name === "dgx04" && updatedCategories.gpu) {
        const gpuCategory = updatedCategories.gpu;
        const updatedChecks = gpuCategory.checks.map(check => {
          if (check.id === "gpu.ecc_errors") {
            const errorCount = 12; // simulated physical count
            let status: "pass" | "warning" | "fail" = "fail";
            let summary = check.summary;
            let rec = check.recommendation;
            
            if (errorCount <= customThresholds.maxEccErrors) {
              status = "pass";
              summary = `All 8 GPUs report healthy registers with 12 SRAM ECC errors (Sufficient under custom threshold of ${customThresholds.maxEccErrors}).`;
              rec = undefined;
            } else if (errorCount <= customThresholds.maxEccErrors * 2) {
              status = "warning";
              summary = `GPU 5 reports 12 physical SRAM ECC errors (Exceeds warning threshold of ${customThresholds.maxEccErrors}).`;
              rec = "Run DCGM diagnostic level 2, confirm whether the ECC condition is repeatable, and escalate if count climbs.";
            } else {
              status = "fail";
              summary = `GPU 5 reported 12 uncorrectable physical SRAM ECC errors! (Exceeds critical threshold of ${customThresholds.maxEccErrors * 2}).`;
              rec = "Drain the node from production scheduling, preserve NVIDIA and kernel diagnostic evidence, run DCGM diagnostics, and escalate for hardware support.";
            }
            return { ...check, status, summary, recommendation: rec };
          }
          return check;
        });
        
        const total = updatedChecks.length;
        const passed = updatedChecks.filter(c => c.status === "pass").length;
        const score = total > 0 ? (passed / total) * 100 : 100;

        updatedCategories.gpu = {
          ...gpuCategory,
          checks: updatedChecks,
          score
        };
      }

      // Dynamic override for InfiniBand Negotiated Link speed check on dgx03
      if (node.name === "dgx03" && updatedCategories.network) {
        const netCategory = updatedCategories.network;
        const updatedChecks = netCategory.checks.map(check => {
          if (check.id === "network.ib_link_speed") {
            const negotiatedSpeed = 200; // 200 Gbps reported speed
            let status: "pass" | "warning" | "fail" = "warning";
            let summary = check.summary;
            let rec = check.recommendation;

            if (negotiatedSpeed >= customThresholds.minBandwidthGbps) {
              status = "pass";
              summary = `All Mellanox NDR links running at nominal rate. Speed of 200 Gb/s is compliant with custom threshold of ${customThresholds.minBandwidthGbps} Gb/s.`;
              rec = undefined;
            } else {
              status = "warning";
              summary = `Mellanox NDR port negotiated speed degraded (200 Gb/s instead of expected 400 Gb/s). Below custom limit of ${customThresholds.minBandwidthGbps} Gb/s.`;
              rec = "Verify cable health, switch port configuration, firmware compatibility, and negotiated link width.";
            }
            return { ...check, status, summary, recommendation: rec };
          }
          return check;
        });
        
        const total = updatedChecks.length;
        const passed = updatedChecks.filter(c => c.status === "pass").length;
        const score = total > 0 ? (passed / total) * 100 : 100;

        updatedCategories.network = {
          ...netCategory,
          checks: updatedChecks,
          score
        };
      }
      
      // Recalculate node level overall status
      const allChecks = (Object.values(updatedCategories) as ValidationCategory[]).flatMap(cat => cat.checks);
      const hasFail = allChecks.some(c => c.status === "fail");
      const hasWarning = allChecks.some(c => c.status === "warning");
      const status = hasFail ? "fail" : hasWarning ? "warning" : "pass";

      return {
        ...node,
        status,
        categories: updatedCategories
      };
    });

    // Recompute category averages
    const categoriesList = ["gpu", "network", "linux", "slurm", "storage", "kubernetes"];
    const category_averages: Record<string, number> = {};
    
    categoriesList.forEach(catId => {
      let sumScore = 0;
      computedNodes.forEach(node => {
        const cat = node.categories[catId];
        if (cat) {
          const total = cat.checks.length;
          const passed = cat.checks.filter(c => c.status === "pass").length;
          sumScore += total > 0 ? (passed / total) * 100 : 100;
        } else {
          sumScore += 100;
        }
      });
      category_averages[catId] = sumScore / computedNodes.length;
    });

    // Calculate overall score based on custom weights
    const totalWeight = (Object.values(customWeights) as number[]).reduce((a, b) => a + b, 0);
    let overallScoreSum = 0;
    (Object.entries(customWeights) as [string, number][]).forEach(([catId, w]) => {
      const avg = category_averages[catId] ?? 100;
      overallScoreSum += avg * w;
    });

    const overall_score = totalWeight > 0 ? (overallScoreSum / totalWeight) : 100;
    
    // Overall classification based on checks
    const allChecksAcrossCluster = computedNodes.flatMap(n => 
      (Object.values(n.categories) as ValidationCategory[]).flatMap(cat => cat.checks)
    );
    const totalFail = allChecksAcrossCluster.filter(c => c.status === "fail").length;
    const totalWarning = allChecksAcrossCluster.filter(c => c.status === "warning").length;
    
    let classification = "Ready";
    if (totalFail > 0) {
      classification = "Remediation required";
    } else if (totalWarning > 0) {
      classification = "Ready with warnings";
    }

    // Filter recommendations based on active issues
    const recommendations: string[] = [];
    computedNodes.forEach(node => {
      (Object.values(node.categories) as ValidationCategory[]).forEach(cat => {
        cat.checks.forEach(check => {
          if (check.status !== "pass" && check.recommendation) {
            recommendations.push(`[${node.name.toUpperCase()}] ${check.recommendation}`);
          }
        });
      });
    });

    return {
      ...cluster,
      nodes: computedNodes,
      overall_score,
      classification,
      recommendations,
      metadata: {
        ...cluster.metadata,
        category_averages,
        active_weights: customWeights,
        total_active_weight: totalWeight
      }
    };
  };

  const computedCluster = getComputedCluster();

  const getECCErrorCount = (node: Node): number => {
    if (node.name === "dgx04") return 12; // simulated/static override
    const check = node.categories.gpu?.checks.find(c => c.id === "gpu.ecc_errors");
    if (!check) return 0;
    if (check.status === "pass" && !check.summary.includes("Sufficient under custom threshold")) return 0;
    const match = check.summary.match(/(\d+)\s+(?:SRAM\s+)?ECC\s+errors/i) || check.summary.match(/(\d+)\s+uncorrectable/i) || check.summary.match(/(\d+)/);
    if (match) return parseInt(match[1], 10);
    return check.status === "fail" ? 12 : check.status === "warning" ? 5 : 0;
  };

  const getLinkSpeed = (node: Node): number => {
    if (node.name === "dgx03") return 200; // simulated/static override
    const check = node.categories.network?.checks.find(c => c.id === "network.ib_link_speed");
    if (!check) return 400;
    const match = check.summary.match(/(\d+)\s*Gb\/s/i) || check.summary.match(/(\d+)/);
    if (match) return parseInt(match[1], 10);
    return check.status === "pass" ? 400 : 200;
  };

  const comparedNodes = computedCluster?.nodes.filter(n => comparedNodeNames.includes(n.name)) || [];
  const filteredNodes = computedCluster?.nodes.filter(node => {
    const matchesSearch = node.name.toLowerCase().includes(nodeSearchQuery.toLowerCase()) || 
                          (node.ip_address && node.ip_address.toLowerCase().includes(nodeSearchQuery.toLowerCase()));
    const matchesStatus = nodeStatusFilter === "all" || node.status === nodeStatusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  const sortedFilteredNodes = [...filteredNodes].sort((a, b) => {
    const aBookmarked = bookmarkedNodes.includes(a.name);
    const bBookmarked = bookmarkedNodes.includes(b.name);
    if (aBookmarked && !bBookmarked) return -1;
    if (!aBookmarked && bBookmarked) return 1;
    return 0;
  });

  const generateCSVData = (): string => {
    if (!computedCluster) return "";
    const headers = [
      "Node Name",
      "IP Address",
      "Overall Status",
      "Overall Score (%)",
      "Linux Platform Score (%)",
      "GPU Score (%)",
      "Network Score (%)",
      "Storage Score (%)",
      "Slurm Score (%)",
      "Kubernetes Score (%)"
    ];
    
    const rows = computedCluster.nodes.map(node => {
      const totalWeight = (Object.values(customWeights) as number[]).reduce((a: number, b: number) => a + b, 0);
      let scoreSum = 0;
      Object.entries(node.categories).forEach(([catId, cat]) => {
        const weight = (customWeights[catId] as number) ?? 0;
        const total = cat.checks.length;
        const passed = cat.checks.filter(c => c.status === "pass").length;
        const score = total > 0 ? (passed / total) * 100 : 100;
        scoreSum += score * weight;
      });
      const overallScore = totalWeight > 0 ? Math.round(scoreSum / totalWeight) : 100;

      const getScore = (catId: string) => {
        const cat = node.categories[catId];
        if (!cat) return 100;
        const total = cat.checks.length;
        if (total === 0) return 100;
        const passed = cat.checks.filter(c => c.status === "pass").length;
        return Math.round((passed / total) * 100);
      };

      return [
        node.name.toUpperCase(),
        node.ip_address || "N/A",
        node.status.toUpperCase(),
        `${overallScore}`,
        `${getScore("linux")}`,
        `${getScore("gpu")}`,
        `${getScore("network")}`,
        `${getScore("storage")}`,
        `${getScore("slurm")}`,
        `${getScore("kubernetes")}`
      ];
    });

    return [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(","))
    ].join("\n");
  };
  const categoriesToCompare = [
    { id: "linux", name: "Linux Platform Compatibility" },
    { id: "gpu", name: "NVIDIA GPU & DCGM Subsystem" },
    { id: "network", name: "Mellanox InfiniBand Speed" },
    { id: "storage", name: "NVMe Storage System Performance" },
    { id: "slurm", name: "Slurm Workload Daemon" },
    { id: "kubernetes", name: "Kubernetes Operator Status" }
  ];

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("nvidia-theme");
      return saved !== "light"; // default to true
    }
    return true;
  });

  useEffect(() => {
    localStorage.setItem("nvidia-theme", isDarkMode ? "dark" : "light");
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Fetch results based on selected scenario
  const fetchResults = async (scenario: "healthy" | "degraded") => {
    try {
      const res = await fetch(`/api/results?scenario=${scenario}`);
      if (res.ok) {
        const data = await res.json();
        setCluster(data);
        // Default select the first warning node or first node
        if (data.nodes && data.nodes.length > 0) {
          const troubledNode = data.nodes.find((n: Node) => n.status !== "pass");
          setSelectedNodeName(troubledNode ? troubledNode.name : data.nodes[0].name);
        }
      }
    } catch (err) {
      console.error("Failed to load results", err);
    }
  };

  useEffect(() => {
    fetchResults(selectedScenario);
  }, [selectedScenario]);

  // Fetch historical health scores for selected node
  const fetchNodeHistory = async (nodeName: string, scenario: "healthy" | "degraded") => {
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const res = await fetch(`/api/node-history/${nodeName}?scenario=${scenario}`);
      if (res.ok) {
        const data = await res.json();
        setNodeHistory(data.history || []);
      } else {
        const errData = await res.json();
        setHistoryError(errData.error || "Failed to load node history.");
      }
    } catch (err) {
      console.error("Failed to load node history", err);
      setHistoryError("Network error loading node health history.");
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (selectedNodeName) {
      fetchNodeHistory(selectedNodeName, selectedScenario);
    }
  }, [selectedNodeName, selectedScenario]);

  // Simulate diagnostic scan with interactive logs
  const triggerScan = async () => {
    setLoading(true);
    setLoadingLogs([]);
    setSelectedCheck(null);

    const logLines = [
      "[INFO] AI Compute Readiness Assessment CLI initialized...",
      "[INFO] Discovering node inventory in environment 'nvis-interview-demo'...",
      "[INFO] Node dgx01 (10.110.0.11) online. Querying platform parameters...",
      "[OK]   dgx01: Operating system and enterpise kernel compatibility verified.",
      "[OK]   dgx01: NVIDIA Driver v535.104 with CUDA 12.2 discovered active.",
      "[INFO] Node dgx02 (10.110.0.12) online. Checking PCI topologies...",
      "[OK]   dgx02: All inter-GPU NVLink connections active with maximum bandwidth.",
      "[INFO] Node dgx03 (10.110.0.13) online. Validating interconnect fabric...",
      selectedScenario === "degraded" 
        ? "[WARN] dgx03: network.ib_link_speed - Mellanox NDR port negotiated speed degraded."
        : "[OK]   dgx03: All Mellanox NDR links running at nominal 400 Gb/s rate.",
      "[INFO] Node dgx04 (10.110.0.14) online. Triggering system level checks...",
      selectedScenario === "degraded"
        ? "[FAIL] dgx04: gpu.ecc_errors - GPU 5 reported 12 uncorrectable physical SRAM ECC errors!"
        : "[OK]   dgx04: Hardware ECC registers report zero hardware-level double-bit errors.",
      selectedScenario === "degraded"
        ? "[FAIL] dgx04: slurm.node_state - Compute state reported as DRAINED."
        : "[OK]   dgx04: Slurm integration reports node scheduler as IDLE (healthy).",
      "[INFO] Compiling local cluster scores and executing weighted redistributions...",
      "[INFO] Writing HTML, Markdown, and JSON diagnostic artifacts...",
      "[OK]   Assessment finalized successfully."
    ];

    // Stagger print logs for terminal realism
    for (let i = 0; i < logLines.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 180));
      setLoadingLogs((prev) => [...prev, logLines[i]]);
    }

    try {
      const res = await fetch("/api/run-scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: selectedScenario })
      });
      if (res.ok) {
        const data = await res.json();
        setCluster(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Trigger benchmark ingestion simulator
  const ingestSample = async (type: "nccl" | "hpl" | "fio") => {
    setIngestingBenchmark(type);
    let fileName = "";
    if (type === "nccl") fileName = "sample-data/sample-nccl.log";
    if (type === "hpl") fileName = "sample-data/sample-hpl.log";
    if (type === "fio") fileName = "sample-data/sample-fio.json";

    try {
      const res = await fetch(`/api/run-scenario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: selectedScenario })
      });
      // Ingest benchmark CLI call
      const ingestRes = await fetch(`/api/results?scenario=${selectedScenario}`);
      if (ingestRes.ok) {
        // Mock success with simulated delay
        await new Promise(r => setTimeout(r, 800));
        fetchResults(selectedScenario);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIngestingBenchmark(null);
    }
  };

  const renderHistoryChart = () => {
    if (loadingHistory) {
      return (
        <div className="flex flex-col items-center justify-center h-36 bg-slate-950/40 rounded-xl border border-slate-900 animate-pulse mb-6">
          <RefreshCw className="h-5 w-5 text-emerald-500 animate-spin mb-2" />
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Retrieving Historical Metrics...</span>
        </div>
      );
    }

    if (historyError || nodeHistory.length === 0) {
      return (
        <div className="flex items-center justify-center h-36 bg-slate-950/40 rounded-xl border border-slate-900 p-4 mb-6">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider text-center">
            {historyError || "No historical logs recorded for this node."}
          </span>
        </div>
      );
    }

    // Perform D3 scaling
    const margin = { top: 20, right: 30, bottom: 20, left: 35 };
    const width = 500;
    const height = 130;

    // Define X and Y scales
    const xScale = d3.scalePoint<string>()
      .domain(nodeHistory.map(d => d.timestamp))
      .range([margin.left, width - margin.right]);

    const minScore = Math.min(...nodeHistory.map(d => d.score));
    const yMin = Math.max(0, Math.min(minScore - 10, 40));
    const yMax = 100;

    const yScale = d3.scaleLinear()
      .domain([yMin, yMax])
      .range([height - margin.bottom, margin.top]);

    // Generate path generators
    const linePathGenerator = d3.line<{ run: string; score: number; timestamp: string }>()
      .x(d => xScale(d.timestamp) || 0)
      .y(d => yScale(d.score))
      .curve(d3.curveMonotoneX);

    const areaPathGenerator = d3.area<{ run: string; score: number; timestamp: string }>()
      .x(d => xScale(d.timestamp) || 0)
      .y0(height - margin.bottom)
      .y1(d => yScale(d.score))
      .curve(d3.curveMonotoneX);

    const linePath = linePathGenerator(nodeHistory) || "";
    const areaPath = areaPathGenerator(nodeHistory) || "";

    // Determine color scheme based on the latest score in history
    const latestScore = nodeHistory[nodeHistory.length - 1]?.score || 100;
    const isDegradedTrend = latestScore < 80;
    const isWarningTrend = latestScore >= 80 && latestScore < 95;
    
    const strokeColor = isDegradedTrend 
      ? "#f87171" // red-400
      : isWarningTrend 
        ? "#fbbf24" // amber-400
        : "#34d399"; // emerald-400

    const glowColor = isDegradedTrend 
      ? "rgba(239, 68, 68, 0.4)" 
      : isWarningTrend 
        ? "rgba(245, 158, 11, 0.4)" 
        : "rgba(16, 185, 129, 0.4)";

    const gradientId = `area-grad-${selectedNodeName}`;

    return (
      <div className="bg-slate-950/30 border border-slate-900 rounded-xl p-4.5 mb-6">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">Node Telemetry History</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-mono text-slate-500">LAST 5 RUNS</span>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: strokeColor }} />
              <span className="text-[10px] font-mono font-bold" style={{ color: strokeColor }}>
                CURRENT: {latestScore}%
              </span>
            </div>
          </div>
        </div>

        <div className="w-full overflow-hidden">
          <svg 
            viewBox={`0 0 ${width} ${height}`} 
            className="w-full overflow-visible select-none"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
                <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid lines */}
            {[50, 75, 100].map((scoreValue) => (
              <g key={scoreValue} className="opacity-20">
                <line 
                  x1={margin.left} 
                  y1={yScale(scoreValue)} 
                  x2={width - margin.right} 
                  y2={yScale(scoreValue)} 
                  stroke="#475569" 
                  strokeDasharray="2,3" 
                  strokeWidth="1"
                />
                <text 
                  x={margin.left - 8} 
                  y={yScale(scoreValue) + 3} 
                  fill="#94a3b8" 
                  fontSize="8" 
                  fontFamily="monospace" 
                  textAnchor="end"
                >
                  {scoreValue}
                </text>
              </g>
            ))}

            {/* Area under the line */}
            <path 
              d={areaPath} 
              fill={`url(#${gradientId})`} 
            />

            {/* Connection/Trend Line */}
            <path 
              d={linePath} 
              fill="none" 
              stroke={strokeColor} 
              strokeWidth="2" 
              strokeLinecap="round"
              style={{
                filter: `drop-shadow(0px 0px 4px ${glowColor})`
              }}
            />

            {/* Data Points and Labels */}
            {nodeHistory.map((d, i) => {
              const x = xScale(d.timestamp) || 0;
              const y = yScale(d.score);
              const isLast = i === nodeHistory.length - 1;

              return (
                <g key={d.run} className="group cursor-pointer">
                  {/* Vertical Guide lines on points */}
                  <line 
                    x1={x} 
                    y1={margin.top} 
                    x2={x} 
                    y2={height - margin.bottom} 
                    stroke="#334155" 
                    strokeWidth="1" 
                    className="opacity-15 group-hover:opacity-40 transition-opacity"
                    strokeDasharray="1,2"
                  />

                  {/* Dynamic Score Labels above point */}
                  <text 
                    x={x} 
                    y={y - 7} 
                    fill={isLast ? strokeColor : "#cbd5e1"} 
                    fontSize="8.5" 
                    fontWeight={isLast ? "bold" : "normal"}
                    fontFamily="monospace" 
                    textAnchor="middle"
                  >
                    {d.score}%
                  </text>

                  {/* Outer glow ring for point */}
                  <circle 
                    cx={x} 
                    cy={y} 
                    r="4.5" 
                    fill="transparent" 
                    stroke={strokeColor} 
                    strokeWidth="1.5" 
                    className="opacity-30 group-hover:opacity-75 transition-opacity"
                  />

                  {/* Center Dot */}
                  <circle 
                    cx={x} 
                    cy={y} 
                    r="2.5" 
                    fill={isLast ? strokeColor : "#0f172a"} 
                    stroke={strokeColor} 
                    strokeWidth="1"
                  />

                  {/* X-axis Label */}
                  <text 
                    x={x} 
                    y={height - margin.bottom + 12} 
                    fill="#64748b" 
                    fontSize="7.5" 
                    fontFamily="monospace" 
                    textAnchor="middle"
                  >
                    {d.timestamp}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    );
  };

  const selectedNode = computedCluster?.nodes.find(n => n.name === selectedNodeName);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans antialiased selection:bg-emerald-500/30 selection:text-emerald-300 transition-colors duration-300">
      {/* FUTURISTIC ULTRA-MODERN HEADER */}
      <header className="bg-slate-900/80 backdrop-blur-md sticky top-0 z-40 border-b border-slate-800 py-4 px-6 shadow-xl transition-all duration-300">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/20 rounded-xl blur-md pulse-cyber" />
              <div className="relative bg-gradient-to-br from-emerald-500 to-emerald-600 p-2.5 rounded-xl text-slate-950 shadow-lg border border-emerald-400/30">
                <Activity className="h-6 w-6 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                <h1 className="text-xl font-display font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400">
                  NVIDIA DGX SUPERPOD // READY-CHECK
                </h1>
              </div>
              <p className="text-[10px] text-emerald-500 font-mono tracking-widest uppercase mt-0.5 font-semibold">
                AI COMPUTE INFRASTRUCTURE VALIDATION ENVIRONMENT
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 bg-slate-950/60 rounded-xl p-1 border border-slate-800">
              <button 
                onClick={() => { setSelectedScenario("degraded"); }}
                className={`px-3 py-1.5 text-[11px] font-mono font-medium rounded-lg transition-all duration-300 cursor-pointer ${selectedScenario === "degraded" ? "bg-red-500/10 text-red-400 border border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.1)]" : "text-slate-400 hover:text-slate-200 border border-transparent"}`}
              >
                // DEGRADED_SYS
              </button>
              <button 
                onClick={() => { setSelectedScenario("healthy"); }}
                className={`px-3 py-1.5 text-[11px] font-mono font-medium rounded-lg transition-all duration-300 cursor-pointer ${selectedScenario === "healthy" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 shadow-[0_0_10px_rgba(118,185,0,0.15)]" : "text-slate-400 hover:text-slate-200 border border-transparent"}`}
              >
                // NOMINAL_SYS
              </button>
            </div>

            {/* LIGHT AND DARK THEME SWITCHER */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-900 text-slate-400 hover:text-emerald-500 transition-all duration-300 cursor-pointer flex items-center justify-center"
              title={isDarkMode ? "Activate Light Operations" : "Activate Dark Operations"}
            >
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* HANDBOOK/HELP TRIGGER */}
            <button
              onClick={() => setShowHelpModal(true)}
              className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-900 text-slate-400 hover:text-emerald-500 transition-all duration-300 cursor-pointer flex items-center justify-center"
              title="Infrastructure Handbook & Help"
            >
              <HelpCircle className="h-4 w-4" />
            </button>

            {/* TUNING SETTINGS TRIGGER */}
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-900 text-slate-400 hover:text-emerald-500 transition-all duration-300 cursor-pointer flex items-center justify-center"
              title="Adjust Score Weight & Thresholds"
            >
              <Settings className="h-4 w-4" />
            </button>
 
            <button 
              onClick={triggerScan}
              disabled={loading}
              className="relative group overflow-hidden flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:from-emerald-800/80 disabled:to-emerald-900/80 text-slate-950 font-semibold font-display text-xs px-5 py-2.5 rounded-xl transition-all shadow-lg hover:shadow-emerald-500/20 shadow-emerald-500/10 cursor-pointer border border-emerald-400/30"
            >
              <div className="absolute inset-0 w-full h-full bg-white/20 transform -skew-x-12 -translate-x-full group-hover:animate-shine" />
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="tracking-wide uppercase">{loading ? "Diagnosing..." : "Trigger Scan"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* TERMINAL MODAL POPUP FOR RUNNING SCANNING ANIMATION */}
      <AnimatePresence>
        {loading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#02050c]/85 backdrop-blur-md flex items-center justify-center p-4 z-50"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-[#0b0f19] border border-gray-800/80 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden font-mono text-xs text-gray-300"
            >
              <div className="bg-[#121824] px-4 py-3 flex justify-between items-center border-b border-gray-800/80">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-semibold text-gray-250 text-[11px] tracking-wider uppercase">Active Diagnostic Telemetry Probe</span>
                </div>
                <div className="flex gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#3b4155] border border-slate-700/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#3b4155] border border-slate-700/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 border border-emerald-400/50 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                </div>
              </div>
              <div className="p-5 h-96 overflow-y-auto flex flex-col gap-2 scrollbar-thin bg-black/50 text-[11px]">
                {loadingLogs.map((log, idx) => (
                  <div key={idx} className="whitespace-pre-line leading-relaxed font-mono">
                    {log.includes("[FAIL]") ? (
                      <span className="text-red-400 font-bold bg-red-950/40 px-1.5 py-0.5 rounded border border-red-500/20">{log}</span>
                    ) : log.includes("[WARN]") ? (
                      <span className="text-amber-400 font-bold bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-500/20">{log}</span>
                    ) : log.includes("[OK]") ? (
                      <span className="text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-500/20">{log}</span>
                    ) : (
                      <span className="text-gray-400">{log}</span>
                    )}
                  </div>
                ))}
                <div className="flex items-center gap-1.5 mt-1 border-b border-gray-800/40 pb-3">
                  <span className="w-2 h-4 bg-emerald-400 animate-pulse" />
                  <span className="text-gray-500 italic text-[10px]">Listening to host hardware registers...</span>
                </div>

                {/* Blinking Hardware/Interconnect status blocks */}
                <div className="mt-3 bg-[#02050c] border border-gray-800 rounded-xl p-3.5 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex flex-col gap-1.5 w-full md:w-auto">
                    <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">// ACTIVE INTERCONNECT FABRIC STATUS</span>
                    <div className="flex gap-1.5 flex-wrap">
                      {Array.from({ length: 16 }).map((_, i) => {
                        const active = loadingLogs.length > i * 0.8;
                        const hasProblem = selectedScenario === "degraded" && i === 10;
                        return (
                          <div 
                            key={i} 
                            className={`h-2.5 w-2.5 rounded-sm transition-all duration-300 relative ${
                              active 
                                ? hasProblem 
                                  ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse" 
                                  : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" 
                                : "bg-gray-800"
                            }`}
                          >
                            {active && !hasProblem && (
                              <span className="absolute inset-0 rounded-sm bg-emerald-400 animate-ping opacity-25" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex gap-4 shrink-0 text-right md:text-left">
                    <div>
                      <span className="text-[8px] font-mono text-gray-500 block uppercase tracking-wider">FABRIC LINK</span>
                      <span className={`text-[10px] font-mono font-bold ${selectedScenario === "degraded" ? "text-amber-400" : "text-emerald-400"}`}>
                        {selectedScenario === "degraded" ? "DEGRADED (Mellanox NDR)" : "NOMINAL (NDR 400G)"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[8px] font-mono text-gray-500 block uppercase tracking-wider">RATE</span>
                      <span className="text-[10px] font-mono font-bold text-gray-300">921.6 Gbps</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* TAB CONTROLS */}
        <div className="flex border-b border-slate-800/85 mb-8 p-1 bg-slate-950/40 rounded-xl max-w-md">
          <button 
            onClick={() => setActiveTab("diagnostics")}
            className={`flex-1 px-4 py-2.5 text-center rounded-lg font-display text-[11px] font-bold tracking-wider uppercase transition-all duration-300 cursor-pointer ${activeTab === "diagnostics" ? "bg-slate-800 text-slate-100 border border-slate-700 shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
          >
            Diagnostics & Readiness
          </button>
          <button 
            onClick={() => setActiveTab("benchmarks")}
            className={`flex-1 px-4 py-2.5 text-center rounded-lg font-display text-[11px] font-bold tracking-wider uppercase transition-all duration-300 cursor-pointer ${activeTab === "benchmarks" ? "bg-slate-800 text-slate-100 border border-slate-700 shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
          >
            Benchmarks ({computedCluster?.benchmark_results?.length || 0})
          </button>
        </div>

        {activeTab === "diagnostics" ? (
          <div className="flex flex-col gap-8">
            {/* NEW DIAGNOSTIC SUMMARY CARDS ROW */}
            {computedCluster && (() => {
              const allChecks = computedCluster.nodes.flatMap(n => 
                (Object.values(n.categories) as ValidationCategory[]).flatMap(cat => cat.checks)
              );
              const activeFaultsCount = allChecks.filter(c => c.status === "fail").length;
              const activeNodesCount = computedCluster.nodes.filter(n => n.status !== "fail" && n.status !== "unavailable").length;
              const avgGpuUtilization = Math.round(
                computedCluster.nodes.reduce((acc, node) => {
                  if (node.status === "fail") return acc + 0;
                  if (node.status === "warning") return acc + 78.4;
                  return acc + 95.8;
                }, 0) / computedCluster.nodes.length
              );

              return (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Metric 1: Total Nodes Active */}
                  <div className="cyber-panel rounded-2xl p-5 relative overflow-hidden flex items-center justify-between group hover:border-emerald-500/30 transition-all duration-300">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block font-bold">
                        // TOTAL NODES ACTIVE
                      </span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-display font-bold text-slate-100 tracking-tight">
                          {activeNodesCount}
                        </span>
                        <span className="text-slate-500 text-xs font-mono">/ {computedCluster.nodes.length} ONLINE</span>
                      </div>
                    </div>
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-xl">
                      <Server className="h-5 w-5" />
                    </div>
                  </div>

                  {/* Metric 2: Critical Alerts */}
                  <div className="cyber-panel rounded-2xl p-5 relative overflow-hidden flex items-center justify-between group hover:border-red-500/30 transition-all duration-300">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block font-bold">
                        // CRITICAL ALERTS
                      </span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className={`text-2xl font-display font-bold tracking-tight ${activeFaultsCount > 0 ? "text-red-500" : "text-slate-100"}`}>
                          {activeFaultsCount}
                        </span>
                        <span className="text-slate-500 text-xs font-mono">ACTIVE FAULTS</span>
                      </div>
                    </div>
                    <div className={`p-3 rounded-xl border ${activeFaultsCount > 0 ? "bg-red-500/10 border-red-500/20 text-red-500 animate-pulse" : "bg-slate-800/10 border-slate-800 text-slate-500"}`}>
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                  </div>

                  {/* Metric 3: Avg GPU Utilization */}
                  <div className="cyber-panel rounded-2xl p-5 relative overflow-hidden flex items-center justify-between group hover:border-emerald-500/30 transition-all duration-300">
                    <div className="flex flex-col gap-1.5 w-full mr-4">
                      <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block font-bold">
                        // AVG GPU UTILIZATION
                      </span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-display font-bold text-slate-100 tracking-tight neon-text-emerald">
                          {avgGpuUtilization}%
                        </span>
                        <span className="text-slate-500 text-xs font-mono">CLUSTER CAPACITY</span>
                      </div>
                      {/* Tiny micro progress bar under the utilization metric */}
                      <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden mt-2 border border-slate-800/80">
                        <div 
                          className="h-full bg-emerald-500 transition-all duration-500" 
                          style={{ width: `${avgGpuUtilization}%` }} 
                        />
                      </div>
                    </div>
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-xl shrink-0">
                      <Cpu className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* LEFT / CENTER COLUMN: SCORES & NODE GRID */}
            <div className="lg:col-span-2 flex flex-col gap-8">
              
              {/* READINESS HERO PANEL */}
              {computedCluster && (
                <div className="cyber-panel scanline-effect rounded-2xl p-6 border border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
                  
                  <div className="flex items-center gap-6">
                    {/* Circle Score Gauge with sci-fi design */}
                    <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full border border-slate-800/30" />
                      
                      {/* Animated rotating outer HUD rings */}
                      <div className="absolute inset-[-4px] rounded-full border border-dashed border-emerald-500/15 animate-[spin_40s_linear_infinite] pointer-events-none" />
                      <div className="absolute inset-[-8px] rounded-full border border-dotted border-teal-500/10 animate-[spin_60s_linear_infinite_reverse] pointer-events-none" />
                      
                      <svg className="absolute w-full h-full transform -rotate-90 pointer-events-none" viewBox="0 0 112 112">
                        {/* Background track circle */}
                        <circle cx="56" cy="56" r="46" fill="transparent" stroke="rgba(15, 23, 42, 0.7)" strokeWidth="6" />
                        {/* Interactive dynamic score arc */}
                        <circle 
                          cx="56" 
                          cy="56" 
                          r="46" 
                          fill="transparent" 
                          stroke={computedCluster.classification === "Ready" ? "#10b981" : computedCluster.classification === "Ready with warnings" ? "#f59e0b" : "#ef4444"} 
                          strokeWidth="6" 
                          strokeDasharray={2 * Math.PI * 46}
                          strokeDashoffset={2 * Math.PI * 46 * (1 - computedCluster.overall_score / 100)}
                          strokeLinecap="round"
                          className="transition-all duration-1000 ease-out"
                        />
                      </svg>
                      
                      {/* Absolute center text circle (with smaller size to avoid overlap) */}
                      <div className="absolute w-[80px] h-[80px] bg-slate-950 rounded-full flex flex-col items-center justify-center border border-slate-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] z-10">
                        <span className="font-mono font-bold text-2xl text-slate-100 tracking-tighter neon-text-emerald">
                          {Math.round(computedCluster.overall_score)}%
                        </span>
                        <span className="text-[8px] font-mono text-emerald-400/80 tracking-widest uppercase">Health</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] uppercase font-mono tracking-wider font-bold px-2.5 py-0.5 rounded border ${computedCluster.classification === "Ready" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 neon-glow-emerald" : computedCluster.classification === "Ready with warnings" ? "bg-amber-500/10 text-amber-400 border-amber-500/20 neon-glow-amber" : "bg-red-500/10 text-red-500 border-red-500/20 neon-glow-red"}`}>
                          {computedCluster.classification}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">Classified Level</span>
                      </div>
                      <h2 className="text-lg font-display font-bold text-slate-100 mt-1.5">Infrastructure Readiness Assessment</h2>
                      <p className="text-xs text-slate-400 mt-1 max-w-md leading-relaxed">
                        Evaluated dynamic scoring metric computed proportionally via real-time operating parameters and controller loops.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 w-full md:w-auto border-t md:border-t-0 md:border-l border-slate-800/80 pt-4 md:pt-0 md:pl-8 text-left items-center">
                    <div>
                      <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block font-bold">Scan Execution</span>
                      <p className="font-display font-semibold text-slate-300 text-xs mt-0.5">{computedCluster.metadata.execution_mode || "Live telemetry"}</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block font-bold">Active Inventory</span>
                      <p className="font-display font-semibold text-slate-300 text-xs mt-0.5">{computedCluster.nodes.length} Compute Nodes</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block font-bold">Priority Track</span>
                      <button
                        onClick={() => toggleBookmark(selectedNodeName)}
                        className={`mt-1 flex items-center gap-1.5 font-mono text-[9px] px-3 py-1.5 rounded-lg border transition-all duration-300 cursor-pointer uppercase font-semibold w-full sm:w-auto ${
                          bookmarkedNodes.includes(selectedNodeName)
                            ? "bg-amber-500/15 border-amber-500/30 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.15)] hover:bg-amber-500/25"
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-350 hover:border-slate-700"
                        }`}
                        title={bookmarkedNodes.includes(selectedNodeName) ? "Unpin selected node" : "Pin selected node for prioritized tracking"}
                      >
                        <Pin className={`h-3 w-3 ${bookmarkedNodes.includes(selectedNodeName) ? "text-amber-400 fill-amber-400/20 animate-bounce" : "text-slate-500"}`} />
                        {bookmarkedNodes.includes(selectedNodeName) ? `PINNED (${selectedNodeName.toUpperCase()})` : `PIN ${selectedNodeName.toUpperCase()}`}
                      </button>
                    </div>
                    <div className="col-span-2 lg:col-span-1 border-t lg:border-t-0 pt-3 lg:pt-0">
                      <button
                        onClick={() => setShowExportModal(true)}
                        className="w-full flex items-center justify-center gap-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-slate-300 hover:text-emerald-400 font-mono text-[10px] px-3.5 py-2 rounded-xl transition-all duration-300 shadow-md cursor-pointer uppercase font-semibold"
                      >
                        <FileText className="h-3.5 w-3.5 text-emerald-500" />
                        Export Report
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* CLUSTER NODE GRID */}
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 px-1">
                  <h3 className="text-xs font-mono uppercase tracking-widest font-bold text-slate-500">// Node Inventory & Subsystem Matrix</h3>
                  <div className="flex items-center gap-3">
                    {comparedNodeNames.length > 0 && (
                      <button
                        onClick={() => setShowCompareModal(true)}
                        className="flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/50 text-emerald-400 font-mono text-[10px] px-3 py-1.5 rounded-lg transition-all duration-300 cursor-pointer shadow-sm font-semibold uppercase"
                      >
                        <Activity className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
                        Compare Nodes ({comparedNodeNames.length})
                      </button>
                    )}
                    <button
                      onClick={() => setShowTopologyModal(true)}
                      className="flex items-center gap-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-slate-300 hover:text-emerald-400 font-mono text-[10px] px-3 py-1.5 rounded-lg transition-all duration-300 cursor-pointer shadow-sm font-semibold uppercase"
                    >
                      <Network className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
                      View Topology Map
                    </button>
                    <span className="text-[10px] text-slate-400 font-mono italic hidden md:inline">Select hardware node for metrics</span>
                  </div>
                </div>

                {/* SEARCH & FILTER CONTROLS */}
                <div className="flex flex-col md:flex-row justify-between gap-4 px-4 py-3 bg-slate-900/40 rounded-xl border border-slate-800/60 shadow-lg">
                  {/* Search Input */}
                  <div className="relative flex-1 max-w-md">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-slate-500" />
                    </div>
                    <input
                      type="text"
                      placeholder="Search node name or IP address..."
                      value={nodeSearchQuery}
                      onChange={(e) => setNodeSearchQuery(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/50 hover:border-slate-700/80 rounded-xl pl-10 pr-8 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none transition-all duration-300 shadow-inner"
                    />
                    {nodeSearchQuery && (
                      <button
                        onClick={() => setNodeSearchQuery("")}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 text-xs font-mono cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Status Filters */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mr-1">// Filter status:</span>
                    <button
                      onClick={() => setNodeStatusFilter("all")}
                      className={`px-3 py-1.5 text-[10px] font-mono uppercase rounded-lg font-bold border transition-all duration-300 cursor-pointer ${nodeStatusFilter === "all" ? "bg-slate-800 text-slate-200 border-slate-700 shadow-sm" : "bg-transparent text-slate-500 border-transparent hover:text-slate-300"}`}
                    >
                      All ({computedCluster?.nodes.length || 0})
                    </button>
                    <button
                      onClick={() => setNodeStatusFilter("pass")}
                      className={`px-3 py-1.5 text-[10px] font-mono uppercase rounded-lg font-bold border transition-all duration-300 cursor-pointer flex items-center gap-1.5 ${nodeStatusFilter === "pass" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]" : "bg-transparent text-slate-500 border-transparent hover:text-emerald-500/40 hover:text-emerald-400"}`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      Pass ({computedCluster?.nodes.filter(n => n.status === "pass").length || 0})
                    </button>
                    <button
                      onClick={() => setNodeStatusFilter("warning")}
                      className={`px-3 py-1.5 text-[10px] font-mono uppercase rounded-lg font-bold border transition-all duration-300 cursor-pointer flex items-center gap-1.5 ${nodeStatusFilter === "warning" ? "bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.1)]" : "bg-transparent text-slate-500 border-transparent hover:text-amber-500/40 hover:text-amber-400"}`}
                    >
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      Warning ({computedCluster?.nodes.filter(n => n.status === "warning").length || 0})
                    </button>
                    <button
                      onClick={() => setNodeStatusFilter("fail")}
                      className={`px-3 py-1.5 text-[10px] font-mono uppercase rounded-lg font-bold border transition-all duration-300 cursor-pointer flex items-center gap-1.5 ${nodeStatusFilter === "fail" ? "bg-red-500/10 text-red-400 border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.1)]" : "bg-transparent text-slate-500 border-transparent hover:text-red-500/40 hover:text-red-400"}`}
                    >
                      <XCircle className="h-3.5 w-3.5 text-red-500" />
                      Fail ({computedCluster?.nodes.filter(n => n.status === "fail").length || 0})
                    </button>
                  </div>
                </div>

                {/* VISUAL HEATMAP LAYER CONTROLS */}
                <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-3 px-3 py-2 bg-slate-900/40 rounded-xl border border-slate-800/60">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mr-1">Heatmap Overlay:</span>
                    <button
                      onClick={() => setHeatmapMode("off")}
                      className={`px-3 py-1 text-[10px] font-mono uppercase rounded-lg font-bold border transition-all duration-300 cursor-pointer ${heatmapMode === "off" ? "bg-slate-800 text-slate-200 border-slate-700 shadow-sm" : "bg-transparent text-slate-500 border-transparent hover:text-slate-300"}`}
                    >
                      Off
                    </button>
                    <button
                      onClick={() => setHeatmapMode("ecc")}
                      className={`px-3 py-1 text-[10px] font-mono uppercase rounded-lg font-bold border transition-all duration-300 cursor-pointer flex items-center gap-1.5 ${heatmapMode === "ecc" ? "bg-red-500/15 text-red-400 border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.15)]" : "bg-transparent text-slate-500 border-transparent hover:text-slate-300"}`}
                    >
                      <Cpu className="h-3 w-3" />
                      ECC Errors
                    </button>
                    <button
                      onClick={() => setHeatmapMode("latency")}
                      className={`px-3 py-1 text-[10px] font-mono uppercase rounded-lg font-bold border transition-all duration-300 cursor-pointer flex items-center gap-1.5 ${heatmapMode === "latency" ? "bg-amber-500/15 text-amber-400 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.15)]" : "bg-transparent text-slate-500 border-transparent hover:text-slate-300"}`}
                    >
                      <Network className="h-3 w-3" />
                      Link Speed/Latency
                    </button>
                  </div>
                  
                  {heatmapMode !== "off" && (
                    <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400 bg-slate-950/40 px-3 py-1 rounded-lg border border-slate-800/40">
                      <span className="font-bold uppercase tracking-wider text-[9px] text-slate-500">// Heatmap Legend:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded bg-slate-800 border border-slate-700" />
                        <span>Nominal</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded bg-amber-500/40 border border-amber-500/50 animate-pulse" />
                        <span>Warning</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded bg-red-500/40 border border-red-500/50 animate-pulse" />
                        <span>Critical</span>
                      </div>
                    </div>
                  )}
                </div>

                {filteredNodes.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-slate-800/80 rounded-2xl bg-slate-950/20">
                    <Server className="h-10 w-10 text-slate-600 mx-auto mb-3 animate-pulse" />
                    <p className="text-slate-400 font-mono text-xs">No cluster nodes found matching your criteria.</p>
                    <p className="text-slate-500 font-mono text-[10px] mt-1">Try clearing your filters or changing the search keyword.</p>
                    <button
                      onClick={() => {
                        setNodeSearchQuery("");
                        setNodeStatusFilter("all");
                      }}
                      className="mt-4 bg-slate-900 hover:bg-slate-800 text-slate-300 font-mono text-[10px] uppercase tracking-wider px-4 py-2 rounded-lg border border-slate-800 hover:border-slate-700 transition-all cursor-pointer"
                    >
                      Reset Search & Filters
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {sortedFilteredNodes.map((node) => {
                      const isSelected = selectedNodeName === node.name;
                      const statusColor = node.status === "pass" ? "text-emerald-400" : node.status === "warning" ? "text-amber-400" : "text-red-400";
                      const statusBg = node.status === "pass" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.1)]" : node.status === "warning" ? "bg-amber-500/10 border-amber-500/20 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.1)]" : "bg-red-500/10 border-red-500/20 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.1)]";
                      const selectedRing = isSelected
                        ? node.status === "pass" ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.15)]" : node.status === "warning" ? "border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/5 shadow-[0_0_15px_rgba(245,158,11,0.15)]" : "border-red-500 ring-2 ring-red-500/20 bg-red-500/5 shadow-[0_0_15px_rgba(239,68,68,0.15)]"
                        : "border-slate-800 hover:border-slate-700 hover:bg-slate-900/40";

                      let cardBg = isSelected ? "bg-slate-900/40" : "bg-slate-950/20";
                      let cardBorder = selectedRing;
                      let cardShadow = "";
                      let badgeBg = statusBg;
                      let badgeText: string = node.status;
                      let iconColor = statusColor;
                      let extraLabel = null;

                      if (heatmapMode === "ecc") {
                        const eccErrors = getECCErrorCount(node);
                        if (eccErrors === 0) {
                          cardBg = isSelected ? "bg-slate-900/40" : "bg-slate-950/10";
                          cardBorder = isSelected ? "border-slate-600 ring-2 ring-slate-600/10" : "border-slate-800/60 hover:border-slate-700";
                          badgeBg = "bg-slate-800/40 border-slate-800 text-slate-500";
                          badgeText = "0 ECC ERRORS";
                          iconColor = "text-slate-600";
                        } else if (eccErrors <= customThresholds.maxEccErrors) {
                          cardBg = isSelected ? "bg-emerald-950/40" : "bg-emerald-950/20";
                          cardBorder = isSelected ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-emerald-500/30 hover:border-emerald-500/50";
                          cardShadow = "shadow-[0_0_12px_rgba(16,185,129,0.1)]";
                          badgeBg = "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
                          badgeText = `${eccErrors} ECC (PASS)`;
                          iconColor = "text-emerald-400";
                          extraLabel = "Sufficient (Custom Thresh)";
                        } else if (eccErrors <= customThresholds.maxEccErrors * 2) {
                          cardBg = isSelected ? "bg-amber-950/50" : "bg-amber-950/30";
                          cardBorder = isSelected ? "border-amber-500 ring-2 ring-amber-500/20" : "border-amber-500/40 hover:border-amber-500/60";
                          cardShadow = "shadow-[0_0_15px_rgba(245,158,11,0.15)]";
                          badgeBg = "bg-amber-500/10 border-amber-500/20 text-amber-400";
                          badgeText = `${eccErrors} ECC (WARN)`;
                          iconColor = "text-amber-400 animate-pulse";
                          extraLabel = "Exceeds Warning Thresh";
                        } else {
                          cardBg = isSelected ? "bg-red-950/60" : "bg-red-950/45";
                          cardBorder = isSelected ? "border-red-500 ring-2 ring-red-500/30" : "border-red-500/50 hover:border-red-500/70";
                          cardShadow = "shadow-[0_0_20px_rgba(239,68,68,0.25)]";
                          badgeBg = "bg-red-500/10 border-red-500/20 text-red-400";
                          badgeText = `${eccErrors} ECC (FAIL)`;
                          iconColor = "text-red-400 animate-pulse";
                          extraLabel = "Exceeds Critical Thresh";
                        }
                      } else if (heatmapMode === "latency") {
                        const speed = getLinkSpeed(node);
                        if (speed >= customThresholds.minBandwidthGbps) {
                          cardBg = isSelected ? "bg-slate-900/40" : "bg-slate-950/10";
                          cardBorder = isSelected ? "border-slate-600 ring-2 ring-slate-600/10" : "border-slate-800/60 hover:border-slate-700";
                          badgeBg = "bg-slate-800/40 border-slate-800 text-slate-500";
                          badgeText = `${speed} GB/S (NOMINAL)`;
                          iconColor = "text-slate-600";
                        } else {
                          cardBg = isSelected ? "bg-amber-950/50" : "bg-amber-950/30";
                          cardBorder = isSelected ? "border-amber-500 ring-2 ring-amber-500/20" : "border-amber-500/40 hover:border-amber-500/60";
                          cardShadow = "shadow-[0_0_15px_rgba(245,158,11,0.15)]";
                          badgeBg = "bg-amber-500/10 border-amber-500/20 text-amber-400";
                          badgeText = `${speed} GB/S (DEGRADED)`;
                          iconColor = "text-amber-400 animate-pulse";
                          extraLabel = "Below Bandwidth Thresh";
                        }
                      }

                      return (
                        <div 
                          key={node.name}
                          onClick={() => setSelectedNodeName(node.name)}
                          className={`cyber-panel rounded-2xl p-4.5 cursor-pointer transition-all duration-300 border ${cardBorder} ${cardBg} ${cardShadow}`}
                        >
                          <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-2">
                              <Server className={`h-4.5 w-4.5 ${iconColor}`} />
                              <span className={`h-1.5 w-1.5 rounded-full animate-pulse ${heatmapMode !== "off" ? (badgeText.includes("FAIL") || badgeText.includes("DEGRADED") ? "bg-red-500" : badgeText.includes("WARN") ? "bg-amber-500" : "bg-slate-600") : (node.status === "pass" ? "bg-emerald-500" : node.status === "warning" ? "bg-amber-500" : "bg-red-500")}`} />
                            </div>
                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => toggleBookmark(node.name)}
                                className="text-slate-500 hover:text-amber-400 p-0.5 rounded transition-all cursor-pointer"
                                title={bookmarkedNodes.includes(node.name) ? "Remove priority pin" : "Pin node for prioritized tracking"}
                              >
                                <Pin className={`h-3.5 w-3.5 ${bookmarkedNodes.includes(node.name) ? "text-amber-400 fill-amber-400/25 animate-pulse" : "text-slate-600 hover:text-slate-400"}`} />
                              </button>
                              <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${badgeBg}`}>
                                {badgeText}
                              </span>
                            </div>
                          </div>
                          <h4 className="font-display font-bold text-slate-100 text-sm tracking-wide">{node.name.toUpperCase()}</h4>
                          {extraLabel && (
                            <span className="text-[9px] font-mono font-bold text-slate-400 mt-1 block uppercase tracking-wider">{extraLabel}</span>
                          )}
                          <div className="flex justify-between items-center mt-2.5 pt-2.5 border-t border-slate-800/60">
                            <span className="text-[10px] font-mono text-slate-500 block">{node.ip_address || "LOCAL_HOST"}</span>
                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                id={`compare-${node.name}`}
                                checked={comparedNodeNames.includes(node.name)}
                                onChange={(e) => {
                                  const isChecked = e.target.checked;
                                  setComparedNodeNames(prev => {
                                    let next;
                                    if (isChecked) {
                                      next = prev.includes(node.name) ? prev : [...prev, node.name];
                                    } else {
                                      next = prev.filter(name => name !== node.name);
                                    }
                                    // Open modal automatically when multiple (>= 2) are selected
                                    if (isChecked && next.length >= 2) {
                                      setShowCompareModal(true);
                                    }
                                    return next;
                                  });
                                }}
                                className="h-3.5 w-3.5 rounded border-slate-800 bg-slate-950 text-emerald-500 focus:ring-emerald-500/20 cursor-pointer accent-emerald-500"
                              />
                              <label htmlFor={`compare-${node.name}`} className="text-[9px] font-mono text-slate-400 hover:text-emerald-400 cursor-pointer select-none font-semibold">
                                Compare
                              </label>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* DETAILED CATEGORY CHECKS LIST FOR SELECTED NODE */}
              {selectedNode && (
                <div className="cyber-panel rounded-2xl border border-slate-800/80 p-6 relative overflow-hidden">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-800/80 pb-4 mb-6">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-500 font-semibold">// Node Level Diagnostics</span>
                      <h3 className="text-base font-display font-bold text-slate-100 mt-0.5">
                        Active Subsystems for <span className="text-slate-400 font-mono text-sm">{selectedNode.name.toUpperCase()}</span>
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono bg-slate-950 border border-slate-800/80 text-slate-400 px-3 py-1 rounded-lg tracking-wider">
                      {selectedNode.ip_address || "127.0.0.1 (LOOPBACK)"}
                    </span>
                  </div>

                  {renderHistoryChart()}

                  <div className="flex flex-col gap-8">
                    {(Object.values(selectedNode.categories) as ValidationCategory[]).map((cat) => {
                      if (cat.checks.length === 0) return null;
                      
                      // Calculate local category score
                      const totalChecks = cat.checks.length;
                      const passedChecks = cat.checks.filter(c => c.status === "pass").length;
                      const catScore = totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 100;
                      const catColor = catScore >= 95 ? "bg-emerald-500" : catScore >= 80 ? "bg-amber-500" : "bg-red-500";
                      const catTextColor = catScore >= 95 ? "text-emerald-400" : catScore >= 80 ? "text-amber-400" : "text-red-400";
                      const catGlow = catScore >= 95 ? "shadow-[0_0_8px_rgba(16,185,129,0.3)]" : catScore >= 80 ? "shadow-[0_0_8px_rgba(245,158,11,0.3)]" : "shadow-[0_0_8px_rgba(239,68,68,0.3)]";

                      return (
                        <div key={cat.id} className="border-b border-slate-800/40 last:border-0 pb-6 last:pb-0">
                           {/* Category Subheader */}
                          <div className="flex justify-between items-center mb-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="p-1.5 rounded-lg bg-slate-950 border border-slate-800/80 text-slate-400">
                                {cat.id === "gpu" && <Cpu className="h-4 w-4" />}
                                {cat.id === "network" && <Network className="h-4 w-4" />}
                                {cat.id === "storage" && <HardDrive className="h-4 w-4" />}
                                {cat.id === "slurm" && <Layers className="h-4 w-4" />}
                                {cat.id === "kubernetes" && <Database className="h-4 w-4" />}
                                {cat.id === "linux" && <Server className="h-4 w-4" />}
                              </div>
                              <div>
                                <span className="font-display font-bold text-slate-200 text-sm tracking-wide">{cat.name}</span>
                                <span className="text-[9px] font-mono text-slate-500 ml-2 tracking-wider">W: {cat.weight * 100}%</span>
                              </div>
                            </div>
                            <span className={`text-[11px] font-mono font-bold ${catTextColor}`}>{Math.round(catScore)}% PASS RATE</span>
                          </div>

                          {/* Mini Progress Bar */}
                          <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden mb-4 border border-slate-900">
                            <div className={`h-full ${catColor} ${catGlow} transition-all duration-500`} style={{ width: `${catScore}%` }} />
                          </div>

                          {/* Checks Table / List */}
                          <div className="flex flex-col gap-2.5">
                            {cat.checks.map((check) => {
                              const isCheckSelected = selectedCheck?.id === check.id && selectedCheck?.node === check.node;
                              const checkStatusColor = check.status === "pass" ? "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40" : check.status === "warning" ? "border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40" : "border-red-500/20 bg-red-500/5 hover:border-red-500/40";
                              const selectedStyle = isCheckSelected ? "border-slate-400 bg-slate-900/60 ring-1 ring-slate-400/20" : `border-slate-800/60 bg-slate-950/20 ${checkStatusColor}`;

                              return (
                                <div 
                                  key={check.id}
                                  onClick={() => setSelectedCheck(check)}
                                  className={`flex items-start justify-between p-3.5 rounded-xl border text-xs transition-all duration-300 cursor-pointer ${selectedStyle}`}
                                >
                                  <div className="flex items-start gap-3 max-w-[80%]">
                                    <div className="mt-0.5 shrink-0">
                                      {check.status === "pass" && <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400" />}
                                      {check.status === "warning" && <AlertTriangle className="h-4.5 w-4.5 text-amber-400 animate-pulse" />}
                                      {check.status === "fail" && <XCircle className="h-4.5 w-4.5 text-red-400 animate-pulse" />}
                                    </div>
                                    <div>
                                      <h5 className="font-semibold text-slate-200 tracking-wide">{check.title}</h5>
                                      <p className="text-slate-400 text-[11px] mt-1 leading-relaxed">{check.summary}</p>
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-1.5 text-[10px] font-mono text-slate-500">
                                    <span className="uppercase tracking-widest px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800/80 text-[9px] font-bold">
                                      {check.severity}
                                    </span>
                                    {check.evidence && check.evidence.length > 0 && (
                                      <span className="flex items-center gap-1 text-emerald-400/80 hover:text-emerald-300 font-medium tracking-wider text-[9px]">
                                        LIVE_LOGS <ArrowUpRight className="h-3 w-3" />
                                      </span>
                                    )}
                                  </div>
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
            </div>

            {/* RIGHT SIDEBAR COLUMN: REMEDIATIONS & COMMAND EVIDENCE */}
            <div className="flex flex-col gap-8">
              
              {/* CURRENT SELECTED CHECK COMMAND EVIDENCE VIEW */}
              <AnimatePresence mode="wait">
                {selectedCheck ? (
                  <motion.div 
                    key={selectedCheck.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="bg-slate-900 text-slate-200 rounded-xl border border-slate-800 p-5 shadow-lg overflow-hidden font-mono text-[11px]"
                  >
                    <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
                      <div className="flex items-center gap-2">
                        <Terminal className="h-4 w-4 text-slate-400" />
                        <span className="font-semibold font-display text-slate-200">Terminal Evidence Log</span>
                      </div>
                      <button 
                        onClick={() => setSelectedCheck(null)}
                        className="text-slate-400 hover:text-slate-100 transition-colors cursor-pointer text-xs font-mono font-medium hover:underline"
                      >
                        // CLOSE
                      </button>
                    </div>

                    <div className="flex flex-col gap-4.5 leading-relaxed">
                      <div>
                        <span className="text-slate-500 text-[10px] uppercase tracking-wider font-mono">Check Identifier</span>
                        <p className="text-cyan-400 font-bold tracking-wide mt-0.5">{selectedCheck.id.toUpperCase()}</p>
                      </div>

                      <div>
                        <span className="text-slate-500 text-[10px] uppercase tracking-wider font-mono">Severity Level</span>
                        <p className={`font-bold tracking-wider mt-0.5 text-xs ${selectedCheck.severity === "critical" ? "text-red-400 animate-pulse" : selectedCheck.severity === "high" ? "text-amber-400" : "text-slate-300"}`}>
                          {selectedCheck.severity.toUpperCase()}
                        </p>
                      </div>

                      {selectedCheck.evidence && selectedCheck.evidence.length > 0 ? (
                        selectedCheck.evidence.map((ev, eIdx) => (
                          <div key={eIdx} className="flex flex-col gap-3 mt-1.5">
                            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                              <span className="text-emerald-400 font-mono font-bold">$ {ev.command.join(" ")}</span>
                              <div className="text-slate-500 text-[9px] font-mono mt-1.5 uppercase tracking-wide">
                                Exit Code: {ev.exit_code} | Duration: {ev.duration_seconds.toFixed(3)}s
                              </div>
                            </div>
                            
                            {ev.stdout && (
                              <div className="flex flex-col gap-1.5">
                                <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider">// System stdout:</span>
                                <pre className="bg-slate-950 p-3 rounded-xl text-[10px] overflow-x-auto text-slate-300 max-h-48 border border-slate-800/80 scrollbar-thin">
                                  {ev.stdout}
                                </pre>
                              </div>
                            )}

                            {ev.stderr && (
                              <div className="flex flex-col gap-1.5">
                                <span className="text-red-400 font-mono text-[10px] uppercase tracking-wider">// System stderr:</span>
                                <pre className="bg-red-950/10 p-3 rounded-xl text-[10px] overflow-x-auto text-red-300 max-h-32 border border-red-500/20">
                                  {ev.stderr}
                                </pre>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-slate-500 italic text-[10px] font-mono">// Zero runtime outputs captured for this test vector.</p>
                      )}

                      {selectedCheck.recommendation && (
                        <div className="mt-2 pt-4 border-t border-slate-800/80 text-[11px]">
                          <span className="text-amber-400 font-bold font-display uppercase tracking-wider">// RECOMMENDED MITIGATION</span>
                          <p className="text-slate-300 mt-1.5 leading-relaxed bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/60 font-sans">
                            {selectedCheck.recommendation}
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <div className="cyber-panel rounded-2xl border border-slate-800/80 p-6 text-center text-slate-400 flex flex-col items-center justify-center py-12 border-dashed">
                    <Terminal className="h-10 w-10 text-slate-600 mb-3.5 animate-pulse" />
                    <h4 className="font-display font-bold text-slate-200 text-xs tracking-wider uppercase">// Terminal Diagnostics Analyzer</h4>
                    <p className="text-[11px] text-slate-500 mt-1.5 max-w-[220px] leading-relaxed">
                      Select an active check from the left subsystem listing to fetch real-time physical evidence logs and system recommendations.
                    </p>
                  </div>
                )}
              </AnimatePresence>

              {/* REMEDIATION / REMEDY PLAN LIST */}
              <div className="cyber-panel rounded-2xl border border-slate-800/80 p-5 shadow-lg">
                <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3.5 mb-4">
                  <AlertTriangle className="h-4.5 w-4.5 text-amber-500 animate-pulse" />
                  <h4 className="font-display font-bold text-slate-200 text-xs uppercase tracking-wider">// Remediation Action Plan</h4>
                </div>

                {cluster?.recommendations && cluster.recommendations.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {cluster.recommendations.map((rec, rIdx) => (
                      <div key={rIdx} className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 text-[11px] leading-relaxed">
                        <div className="flex gap-3 text-slate-300">
                          <span className="bg-gradient-to-br from-slate-800 to-slate-900 text-slate-200 font-mono font-bold h-5 w-5 rounded-full flex items-center justify-center shrink-0 border border-slate-700/50 text-[9px]">{rIdx + 1}</span>
                          <p className="text-slate-300 font-sans">{rec}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2.5 neon-glow-emerald rounded-full" />
                    <h5 className="font-display font-bold text-emerald-500 text-xs uppercase tracking-wider">Cluster Status: Ready</h5>
                    <p className="text-[11px] text-slate-500 mt-1">Nominal levels verified. Zero actions needed.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>
        ) : (
          /* BENCHMARKS TAB CONTENT */
          <div className="cyber-panel rounded-2xl border border-slate-800/80 p-6">
            <div className="border-b border-slate-800/80 pb-5 mb-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div>
                <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest font-semibold">// Telemetry parser engine</span>
                <h3 className="text-base font-display font-bold text-slate-100 mt-0.5">Historical Performance Logs</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
                  Parse and ingest log files from communications, computation solvers, and block writing profiles directly into current active readiness audits.
                </p>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <button 
                  onClick={() => ingestSample("nccl")}
                  disabled={ingestingBenchmark !== null}
                  className="bg-slate-950 border border-slate-800 hover:border-slate-700 disabled:border-slate-900 text-slate-300 hover:text-slate-100 font-mono text-[10px] px-3.5 py-2 rounded-xl cursor-pointer transition-all duration-300 shadow-md"
                >
                  {ingestingBenchmark === "nccl" ? "INGESTING..." : "INGEST NCCL LOG"}
                </button>
                <button 
                  onClick={() => ingestSample("hpl")}
                  disabled={ingestingBenchmark !== null}
                  className="bg-slate-950 border border-slate-800 hover:border-slate-700 disabled:border-slate-900 text-slate-300 hover:text-slate-100 font-mono text-[10px] px-3.5 py-2 rounded-xl cursor-pointer transition-all duration-300 shadow-md"
                >
                  {ingestingBenchmark === "hpl" ? "INGESTING..." : "INGEST HPL LOG"}
                </button>
                <button 
                  onClick={() => ingestSample("fio")}
                  disabled={ingestingBenchmark !== null}
                  className="bg-slate-950 border border-slate-800 hover:border-slate-700 disabled:border-slate-900 text-slate-300 hover:text-slate-100 font-mono text-[10px] px-3.5 py-2 rounded-xl cursor-pointer transition-all duration-300 shadow-md"
                >
                  {ingestingBenchmark === "fio" ? "INGESTING..." : "INGEST FIO JSON"}
                </button>
              </div>
            </div>

            {cluster?.benchmark_results && cluster.benchmark_results.length > 0 ? (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {cluster.benchmark_results.map((b, idx) => (
                  <div key={idx} className="border border-slate-800/80 rounded-2xl p-5 bg-slate-950/40 flex flex-col gap-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
                    
                    <div className="flex justify-between items-center border-b border-slate-900 pb-3">
                      <div className="flex items-center gap-2">
                        <Award className="h-4.5 w-4.5 text-emerald-400" />
                        <span className="font-mono font-bold text-slate-200 text-xs tracking-wider uppercase">{b.benchmark_type}</span>
                      </div>
                      <span className={`text-[9px] font-mono font-bold px-2.5 py-0.5 rounded border tracking-wider uppercase ${b.status === "pass" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.1)]" : "bg-amber-500/10 border-amber-500/20 text-amber-400"}`}>
                        {b.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-[10px] font-mono">
                      <div>
                        <span className="text-slate-500 block uppercase tracking-wide text-[8px]">LOG FILE SOURCE</span>
                        <p className="text-slate-300 truncate mt-0.5" title={b.file_path}>{b.file_path}</p>
                      </div>
                      <div>
                        <span className="text-slate-500 block uppercase tracking-wide text-[8px]">PEAK SYSTEM METRIC</span>
                        <div className="mt-0.5 font-bold text-emerald-400 text-xs">
                          {b.metrics.peak_bus_bandwidth_gbs && `${b.metrics.peak_bus_bandwidth_gbs.toFixed(1)} GB/s (Bus)`}
                          {b.metrics.peak_tflops && `${b.metrics.peak_tflops} TFLOPS`}
                          {b.metrics.read_bw_mbs && `${b.metrics.read_bw_mbs} MB/s (Read)`}
                        </div>
                      </div>
                    </div>

                    <div>
                      <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wide block mb-1.5">// PARSED ARTIFACT OBJECT</span>
                      <pre className="bg-slate-950 text-emerald-400/95 p-3 rounded-xl text-[10px] font-mono overflow-x-auto max-h-32 border border-slate-800/85">
                        {JSON.stringify(b.metrics, null, 2)}
                      </pre>
                    </div>

                    <div>
                      <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wide block mb-1.5">// LOG SNIPPET SIGNATURE</span>
                      <pre className="bg-slate-950 text-slate-400 p-3 rounded-xl text-[10px] font-mono overflow-x-auto max-h-40 border border-slate-800/85">
                        {b.raw_snippet}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 text-slate-500 border border-dashed border-slate-800 rounded-2xl bg-slate-950/20">
                <BookOpen className="h-10 w-10 text-slate-700 mx-auto mb-3 animate-pulse" />
                <h4 className="font-display font-bold text-slate-300 text-xs uppercase tracking-wider">// System telemetry databases empty</h4>
                <p className="text-[11px] text-slate-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
                  Ingest system logs from standard benchmarks above to parse peak communications or solver performance.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-slate-950 border-t border-slate-900 mt-24 py-10 text-center text-[10px] text-slate-500 font-mono tracking-wider">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="uppercase">// AI COMPUTE READINESS ASSESSMENT TERMINAL PROTOCOL</p>
          <p className="text-slate-600">CLEAN TELEMETRY AUDIT • DEMO MATRIX INTEGRITY VERIFIED</p>
        </div>
      </footer>

      {/* 1. INTERACTIVE GUIDE HANDBOOK MODAL */}
      <AnimatePresence>
        {showHelpModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 text-left"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden text-slate-200 flex flex-col max-h-[85vh]"
            >
              <div className="flex justify-between items-center px-6 py-4.5 border-b border-slate-800 bg-slate-950/30">
                <div className="flex items-center gap-2.5">
                  <BookOpen className="h-5 w-5 text-emerald-500" />
                  <span className="font-display font-bold tracking-wider text-sm text-slate-100 uppercase">SuperPOD Infrastructure Handbook</span>
                </div>
                <button 
                  onClick={() => setShowHelpModal(false)}
                  className="text-slate-400 hover:text-slate-100 font-mono text-[11px] hover:underline cursor-pointer"
                >
                  // CLOSE
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex flex-col gap-6 scrollbar-thin">
                <div className="flex flex-col gap-2">
                  <h4 className="font-display font-bold text-slate-100 text-xs uppercase tracking-wider">// 1. Linux Operating Parameters</h4>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    High-performance deep learning training requires zero kernel interruptions. OS swap space must be <span className="text-emerald-500 font-semibold font-mono">disabled</span> to eliminate paging latencies. Pre-allocated Hugepages (e.g., 1024 hugepages) are vital for high-memory allocation efficiency during distributed matrix operations.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <h4 className="font-display font-bold text-slate-100 text-xs uppercase tracking-wider">// 2. NVIDIA DCGM & GPU HW registers</h4>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Active DCGM loops monitor real-time temperature, PCIe link efficiency, NVLink connectivity, and SRAM ECC errors. An increase in <span className="text-amber-400 font-semibold font-mono">correctable</span> ECC errors can indicate thermal stress. <span className="text-red-400 font-semibold font-mono">Uncorrectable</span> physical ECC errors indicate direct register corruption, demanding immediate node drain and replacement.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <h4 className="font-display font-bold text-slate-100 text-xs uppercase tracking-wider">// 3. InfiniBand High-Speed Network</h4>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Modern SuperPOD links run Mellanox ConnectX-7 NDR ports negotiated at <span className="text-emerald-500 font-semibold font-mono">400 Gb/s</span> line rate. Under degraded conditions, a physical cable bend, dirty optic, or port configuration mismatch can fallback the connection to <span className="text-amber-500 font-semibold font-mono">200 Gb/s</span>, reducing total multi-node training speed by up to 50%.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <h4 className="font-display font-bold text-slate-100 text-xs uppercase tracking-wider">// 4. Slurm & K8s device plugins</h4>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Sub-microsecond orchestration requires Slurm workloads to be mapped strictly across physical switches. If the <span className="font-mono">slurmd</span> daemon is unresponsive, or the Kubernetes Device Plugin encounters a crash (e.g. `nvidia-device-plugin` CrashLoopBackOff), the resource scheduler will mark the node offline, stalling collective training queues.
                  </p>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 text-center flex justify-end">
                <button 
                  onClick={() => setShowHelpModal(false)}
                  className="bg-slate-800 hover:bg-slate-750 text-slate-200 font-mono text-[10px] uppercase font-bold px-4.5 py-2.5 rounded-xl border border-slate-700 hover:border-slate-600 transition-all cursor-pointer"
                >
                  Acknowledge & Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. CONFIGURATION TUNING SETTINGS MODAL */}
      <AnimatePresence>
        {showSettingsModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 text-left"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden text-slate-200 flex flex-col"
            >
              <div className="flex justify-between items-center px-6 py-4.5 border-b border-slate-800 bg-slate-950/30">
                <div className="flex items-center gap-2.5">
                  <Settings className="h-5 w-5 text-emerald-500" />
                  <span className="font-display font-bold tracking-wider text-sm text-slate-100 uppercase">Assessment Tuning & Rules</span>
                </div>
                <button 
                  onClick={() => setShowSettingsModal(false)}
                  className="text-slate-400 hover:text-slate-100 font-mono text-[11px] hover:underline cursor-pointer"
                >
                  // CLOSE
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex flex-col gap-6 max-h-[65vh] scrollbar-thin">
                <div className="flex flex-col gap-1">
                  <h4 className="font-display font-bold text-slate-100 text-xs uppercase tracking-wider">// Subsystem scoring weights</h4>
                  <p className="text-slate-400 text-[11px] leading-relaxed mb-2">
                    Adjust proportional category impact. Ensure the total adds up to <span className="font-mono text-emerald-400 font-bold">100%</span>.
                  </p>

                  <div className="flex flex-col gap-4 bg-slate-950/50 border border-slate-800/60 rounded-xl p-4">
                    {Object.entries(customWeights).map(([key, value]) => {
                      const labels: Record<string, string> = {
                        linux: "Linux Platform Compatibility",
                        gpu: "NVIDIA GPU & DCGM Subsystem",
                        network: "Mellanox InfiniBand Speed",
                        storage: "NVMe Storage System Performance",
                        slurm: "Slurm Workload Daemon",
                        kubernetes: "Kubernetes Operator Status"
                      };
                      return (
                        <div key={key} className="flex flex-col gap-1.5">
                          <div className="flex justify-between items-center text-[11px] font-mono">
                            <span className="text-slate-300 font-medium">{labels[key] || key}</span>
                            <span className="text-emerald-400 font-bold">{value}%</span>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="60" 
                            value={value} 
                            onChange={(e) => {
                              const newVal = parseInt(e.target.value) || 0;
                              setCustomWeights(prev => ({ ...prev, [key]: newVal }));
                            }}
                            className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                          />
                        </div>
                      );
                    })}

                    <div className="flex justify-between items-center border-t border-slate-800/80 pt-3 mt-1.5 text-xs">
                      <span className="font-mono text-slate-400">Proportional Weight Sum:</span>
                      {(() => {
                        const sum = (Object.values(customWeights) as number[]).reduce((a, b) => a + b, 0);
                        return (
                          <div className="flex items-center gap-2 font-mono">
                            <span className={`font-bold ${sum === 100 ? "text-emerald-400" : "text-amber-400"}`}>{sum}%</span>
                            {sum !== 100 && (
                              <button 
                                onClick={() => {
                                  // Auto-normalize
                                  const sumWeights = (Object.values(customWeights) as number[]).reduce((a, b) => a + b, 0);
                                  if (sumWeights > 0) {
                                    const normalized: Record<string, number> = {};
                                    let runningSum = 0;
                                    const keys = Object.keys(customWeights);
                                    keys.forEach((k, idx) => {
                                      if (idx === keys.length - 1) {
                                        normalized[k] = 100 - runningSum;
                                      } else {
                                        const share = Math.round(((customWeights[k] as number) / sumWeights) * 100);
                                        normalized[k] = share;
                                        runningSum += share;
                                      }
                                    });
                                    setCustomWeights(normalized);
                                  }
                                }}
                                className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] px-2 py-0.5 rounded cursor-pointer uppercase font-bold"
                              >
                                Auto-Balance
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <h4 className="font-display font-bold text-slate-100 text-xs uppercase tracking-wider">// Warning Alert Thresholds</h4>
                  <p className="text-slate-400 text-[11px] leading-relaxed mb-3">
                    Define direct hardware criteria to trigger active warning states or physical node draining recommendation.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5 bg-slate-950/40 border border-slate-800/80 p-3.5 rounded-xl">
                      <div className="flex justify-between items-center text-[11px] font-mono mb-1">
                        <span className="text-slate-300">Max Acceptable ECC errors</span>
                        <span className="text-emerald-400 font-bold">{customThresholds.maxEccErrors}</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="20" 
                        value={customThresholds.maxEccErrors} 
                        onChange={(e) => setCustomThresholds(prev => ({ ...prev, maxEccErrors: parseInt(e.target.value) || 0 }))}
                        className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                      <span className="text-[9px] text-slate-500 font-mono mt-1 leading-relaxed">
                        Uncorrectable physical registers to trigger node block drainage.
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5 bg-slate-950/40 border border-slate-800/80 p-3.5 rounded-xl">
                      <div className="flex justify-between items-center text-[11px] font-mono mb-1">
                        <span className="text-slate-300">Min IB bandwidth (Gbps)</span>
                        <span className="text-emerald-400 font-bold">{customThresholds.minBandwidthGbps}G</span>
                      </div>
                      <input 
                        type="range" 
                        min="100" 
                        max="400" 
                        step="10"
                        value={customThresholds.minBandwidthGbps} 
                        onChange={(e) => setCustomThresholds(prev => ({ ...prev, minBandwidthGbps: parseInt(e.target.value) || 0 }))}
                        className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                      <span className="text-[9px] text-slate-500 font-mono mt-1 leading-relaxed">
                        Mellanox NDR port line speed speed limit for Warning alert trigger.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 flex justify-between items-center">
                <button 
                  onClick={() => {
                    setCustomWeights({ linux: 15, gpu: 30, network: 20, storage: 10, slurm: 15, kubernetes: 10 });
                    setCustomThresholds({ maxEccErrors: 5, minBandwidthGbps: 380 });
                  }}
                  className="text-slate-400 hover:text-slate-200 font-mono text-[10px] uppercase font-bold cursor-pointer"
                >
                  Reset to Defaults
                </button>
                <button 
                  onClick={() => setShowSettingsModal(false)}
                  className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-mono text-[10px] uppercase font-bold px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-500/10 border border-emerald-400/20"
                >
                  Apply & Recalculate
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. PHYSICAL INTERCONNECT FABRIC TOPOLOGY MAP MODAL */}
      <AnimatePresence>
        {showTopologyModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 text-left"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden text-slate-200 flex flex-col"
            >
              <div className="flex justify-between items-center px-6 py-4.5 border-b border-slate-800 bg-slate-950/30">
                <div className="flex items-center gap-2.5">
                  <Layers className="h-5 w-5 text-emerald-500" />
                  <span className="font-display font-bold tracking-wider text-sm text-slate-100 uppercase">SuperPOD Physical Link Fabric Map</span>
                </div>
                <button 
                  onClick={() => setShowTopologyModal(false)}
                  className="text-slate-400 hover:text-slate-100 font-mono text-[11px] hover:underline cursor-pointer"
                >
                  // CLOSE
                </button>
              </div>

              <div className="p-6 overflow-hidden flex flex-col gap-4 text-center">
                <p className="text-slate-400 text-xs leading-relaxed max-w-xl mx-auto">
                  Interactive schematic representing physical InfiniBand NDR routing interconnecting the SuperPOD nodes. 
                  {selectedScenario === "degraded" ? (
                    <span className="text-amber-400 block mt-1 font-mono font-bold">
                      ⚠ INTERCONNECT DEGRADATION FAULT detected on Mellanox fabric connecting [DGX03]!
                    </span>
                  ) : (
                    <span className="text-emerald-400 block mt-1 font-mono font-bold">
                      ✔ All high-speed links running nominal ConnectX-7 NDR bandwidth rates (400 Gb/s).
                    </span>
                  )}
                </p>

                {/* SVG INTERCONNECT MAP */}
                <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800/80 relative flex items-center justify-center min-h-[300px]">
                  <svg className="w-full max-w-xl h-64" viewBox="0 0 500 250">
                    {/* Switch Box Leaf-A */}
                    <g transform="translate(130, 20)">
                      <rect width="110" height="30" rx="4" fill="rgba(30, 41, 59, 0.9)" stroke="#76B900" strokeWidth="1.5" className="shadow" />
                      <text x="55" y="18" fill="#f8fafc" fontSize="8" fontFamily="monospace" textAnchor="middle" fontWeight="bold">IB-SPINE-SWITCH-01</text>
                    </g>
                    {/* Switch Box Leaf-B */}
                    <g transform="translate(260, 20)">
                      <rect width="110" height="30" rx="4" fill="rgba(30, 41, 59, 0.9)" stroke="#76B900" strokeWidth="1.5" className="shadow" />
                      <text x="55" y="18" fill="#f8fafc" fontSize="8" fontFamily="monospace" textAnchor="middle" fontWeight="bold">IB-SPINE-SWITCH-02</text>
                    </g>

                    {/* Nodes (dgx01, dgx02, dgx03, dgx04) */}
                    {[
                      { name: "dgx01", x: 40, status: "pass" },
                      { name: "dgx02", x: 160, status: "pass" },
                      { name: "dgx03", x: 280, status: selectedScenario === "degraded" ? "warning" : "pass" },
                      { name: "dgx04", x: 400, status: "pass" }
                    ].map((n, idx) => {
                      const strokeColor = n.status === "pass" ? "#10b981" : "#f59e0b";
                      const isWarning = n.status === "warning";
                      return (
                        <g key={n.name} transform={`translate(${n.x}, 180)`}>
                          <rect 
                            width="60" 
                            height="40" 
                            rx="5" 
                            fill="rgba(15, 23, 42, 0.9)" 
                            stroke={strokeColor} 
                            strokeWidth={isWarning ? "2" : "1.5"} 
                            className={`shadow transition-all duration-300 ${isWarning ? "animate-pulse" : ""}`}
                          />
                          <text x="30" y="20" fill="#f1f5f9" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle">{n.name.toUpperCase()}</text>
                          <text x="30" y="32" fill={isWarning ? "#f59e0b" : "#64748b"} fontSize="7" fontFamily="monospace" textAnchor="middle">
                            {isWarning ? "DEGRADED" : "ONLINE"}
                          </text>
                        </g>
                      );
                    })}

                    {/* Connections */}
                    {/* Node 1 Connects to Switch 1 */}
                    <path d="M 70 180 L 185 50" fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="4,4" className="animate-[dash_10s_linear_infinite]" />
                    
                    {/* Node 2 Connects to Switch 1 and 2 */}
                    <path d="M 190 180 L 185 50" fill="none" stroke="#10b981" strokeWidth="1.5" />
                    <path d="M 190 180 L 315 50" fill="none" stroke="#10b981" strokeWidth="1.5" />

                    {/* Node 3 Connects to Switch 1 and 2 (dgx03 degraded!) */}
                    {selectedScenario === "degraded" ? (
                      <>
                        <path d="M 310 180 L 185 50" fill="none" stroke="#f59e0b" strokeWidth="2.5" className="animate-[pulse_1.5s_infinite]" />
                        <path d="M 310 180 L 315 50" fill="none" stroke="#10b981" strokeWidth="1.5" />
                        <circle cx="247" cy="115" r="4" fill="#f59e0b" className="animate-ping" />
                      </>
                    ) : (
                      <>
                        <path d="M 310 180 L 185 50" fill="none" stroke="#10b981" strokeWidth="1.5" />
                        <path d="M 310 180 L 315 50" fill="none" stroke="#10b981" strokeWidth="1.5" />
                      </>
                    )}

                    {/* Node 4 Connects to Switch 2 */}
                    <path d="M 430 180 L 315 50" fill="none" stroke="#10b981" strokeWidth="1.5" />
                  </svg>

                  {/* Interconnect indicators */}
                  <div className="absolute bottom-4 left-4 flex gap-4 text-[10px] font-mono">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                      <span className="text-slate-400">Nominal NDR (400 Gb/s)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse" />
                      <span className="text-slate-400">Degraded NDR (200 Gb/s)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 flex justify-end">
                <button 
                  onClick={() => setShowTopologyModal(false)}
                  className="bg-slate-800 hover:bg-slate-750 text-slate-200 font-mono text-[10px] uppercase font-bold px-5 py-2.5 rounded-xl border border-slate-700 hover:border-slate-600 transition-all cursor-pointer"
                >
                  Close Diagram
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. EXPORT AUDIT REPORT DIAGNOSTIC MODAL */}
      <AnimatePresence>
        {showExportModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 text-left"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden text-slate-200 flex flex-col max-h-[85vh]"
            >
              <div className="flex justify-between items-center px-6 py-4.5 border-b border-slate-800 bg-slate-950/30">
                <div className="flex items-center gap-2.5">
                  <FileText className="h-5 w-5 text-emerald-500" />
                  <span className="font-display font-bold tracking-wider text-sm text-slate-100 uppercase">Export Diagnostic Report</span>
                </div>
                <button 
                  onClick={() => { setShowExportModal(false); setCopied(false); }}
                  className="text-slate-400 hover:text-slate-100 font-mono text-[11px] hover:underline cursor-pointer"
                >
                  // CLOSE
                </button>
              </div>

              <div className="flex border-b border-slate-800 bg-slate-950/20 px-6 py-1">
                <button 
                  onClick={() => setExportFormat("json")}
                  className={`px-4 py-3 font-mono text-[11px] font-bold uppercase transition-all border-b-2 cursor-pointer ${exportFormat === "json" ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-200"}`}
                >
                  JSON Payload
                </button>
                <button 
                  onClick={() => setExportFormat("markdown")}
                  className={`px-4 py-3 font-mono text-[11px] font-bold uppercase transition-all border-b-2 cursor-pointer ${exportFormat === "markdown" ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-200"}`}
                >
                  Markdown Summary
                </button>
                <button 
                  onClick={() => setExportFormat("csv")}
                  className={`px-4 py-3 font-mono text-[11px] font-bold uppercase transition-all border-b-2 cursor-pointer ${exportFormat === "csv" ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-200"}`}
                >
                  CSV Dataset
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 max-h-[50vh] bg-slate-950/60 font-mono text-[10px] leading-relaxed select-text scrollbar-thin">
                {exportFormat === "json" ? (
                  <pre className="text-emerald-400 max-w-full overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(computedCluster, null, 2)}
                  </pre>
                ) : exportFormat === "markdown" ? (
                  <div className="text-slate-300 whitespace-pre-wrap max-w-full overflow-x-auto select-text font-mono">
                    {`# NVIDIA SUPERPOD INFRASTRUCTURE READINESS ASSESSMEMT REPORT
Generated At: ${new Date().toISOString()}
Cluster Health Score: ${Math.round(computedCluster?.overall_score || 0)}%
Assessment Level: ${computedCluster?.classification || "UNKNOWN"}

## Active Subsystem Weights Configured
${Object.entries(customWeights).map(([k, v]) => `- ${k.toUpperCase()}: ${v}%`).join("\n")}

## Cluster Node Inventory Breakdown
${computedCluster?.nodes.map(n => `### Node [${n.name.toUpperCase()}]
- IP Address: ${n.ip_address}
- Subsystem Status: ${n.status.toUpperCase()}
- Active Subsystems score:
${Object.entries(n.categories).map(([k, v]) => `  * ${v.name}: ${v.score}%`).join("\n")}
`).join("\n")}

## Critical Recommendations & Remediation Directives
${computedCluster?.recommendations && computedCluster.recommendations.length > 0 
  ? computedCluster.recommendations.map(r => `* ${r}`).join("\n")
  : "* Cluster operations nominal. No critical actions detected."
}`}
                  </div>
                ) : (
                  <pre className="text-amber-400 max-w-full overflow-x-auto whitespace-pre select-text font-mono">
                    {generateCSVData()}
                  </pre>
                )}
              </div>

              <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 flex justify-between items-center">
                <button 
                  onClick={() => {
                    const content = exportFormat === "json" 
                      ? JSON.stringify(computedCluster, null, 2)
                      : exportFormat === "markdown"
                      ? `# NVIDIA SUPERPOD INFRASTRUCTURE READINESS ASSESSMEMT REPORT\nScore: ${Math.round(computedCluster?.overall_score || 0)}%\nClassification: ${computedCluster?.classification}`
                      : generateCSVData();
                    
                    navigator.clipboard.writeText(content).then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    });
                  }}
                  className="bg-slate-800 hover:bg-slate-750 text-slate-200 font-mono text-[10px] uppercase font-bold px-4 py-2.5 rounded-xl border border-slate-700 hover:border-slate-600 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {copied ? "Copied to Clipboard! ✓" : "Copy to Clipboard"}
                </button>

                <button 
                  onClick={() => {
                    setDownloading(true);
                    setTimeout(() => {
                      const content = exportFormat === "json" 
                        ? JSON.stringify(computedCluster, null, 2)
                        : exportFormat === "markdown"
                        ? `# NVIDIA SUPERPOD INFRASTRUCTURE READINESS ASSESSMEMT REPORT\nScore: ${Math.round(computedCluster?.overall_score || 0)}%`
                        : generateCSVData();
                      const ext = exportFormat === "json" ? "json" : exportFormat === "markdown" ? "md" : "csv";
                      const mime = exportFormat === "csv" ? "text/csv" : "text/plain";
                      const blob = new Blob([content], { type: mime });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `nvidia_superpod_readiness_report_${computedCluster?.name || 'cluster'}.${ext}`;
                      a.click();
                      setDownloading(false);
                    }, 600);
                  }}
                  disabled={downloading}
                  className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-800 text-slate-950 font-mono text-[10px] uppercase font-bold px-5 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-emerald-500/10"
                >
                  {downloading ? "Generating File..." : `Download .${exportFormat} file`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* 5. INTERACTIVE NODE DIAGNOSTIC COMPARISON MODAL */}
        {showCompareModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 text-left"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden text-slate-200 flex flex-col max-h-[85vh]"
            >
              <div className="flex justify-between items-center px-6 py-4.5 border-b border-slate-800 bg-slate-950/30">
                <div className="flex items-center gap-2.5">
                  <Activity className="h-5 w-5 text-emerald-500 animate-pulse" />
                  <div>
                    <span className="font-display font-bold tracking-wider text-sm text-slate-100 uppercase block">Node Diagnostic Comparison Matrix</span>
                    <span className="text-[10px] text-slate-500 font-mono">Side-by-side subsystem health and compliance metrics</span>
                  </div>
                </div>
                <button 
                  onClick={() => setShowCompareModal(false)}
                  className="text-slate-400 hover:text-slate-100 font-mono text-[11px] hover:underline cursor-pointer"
                >
                  // CLOSE
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 scrollbar-thin flex flex-col gap-6">
                {comparedNodes.length === 0 ? (
                  <div className="text-center py-12">
                    <Server className="h-12 w-12 text-slate-600 mx-auto mb-4 animate-bounce" />
                    <p className="text-slate-400 font-mono text-xs">No nodes selected for comparison.</p>
                    <p className="text-slate-500 font-mono text-[10px] mt-1">Check at least two nodes in the inventory grid to compare them.</p>
                  </div>
                ) : (
                  <>
                    {/* Responsive Side-by-Side Table */}
                    <div className="overflow-x-auto border border-slate-800/80 rounded-xl bg-slate-950/40">
                      <table className="w-full text-left border-collapse min-w-[600px]">
                        <thead>
                          <tr className="border-b border-slate-800 bg-slate-950/60 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                            <th className="py-4 px-5 font-semibold text-slate-400 border-r border-slate-800/60 w-1/4">Subsystem Parameter</th>
                            {comparedNodes.map(node => {
                              const statusColor = node.status === "pass" ? "text-emerald-400" : node.status === "warning" ? "text-amber-400" : "text-red-400";
                              const statusBg = node.status === "pass" ? "bg-emerald-500/10 border-emerald-500/20" : node.status === "warning" ? "bg-amber-500/10 border-amber-500/20" : "bg-red-500/10 border-red-500/20";
                              return (
                                <th key={node.name} className="py-4 px-5 text-center border-r border-slate-800/60 last:border-r-0">
                                  <div className="flex flex-col items-center gap-1">
                                    <span className="font-display font-bold text-slate-100 text-xs tracking-wider">{node.name.toUpperCase()}</span>
                                    <span className="text-[9px] text-slate-500 lowercase tracking-normal">{node.ip_address || "no IP"}</span>
                                    <span className={`text-[9px] font-bold px-2 py-0.5 mt-1 rounded border uppercase tracking-widest ${statusBg} ${statusColor}`}>
                                      {node.status}
                                    </span>
                                  </div>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                          {/* OVERALL COMPLIANCE SCORE ROW */}
                          <tr className="hover:bg-slate-900/20 bg-emerald-500/5">
                            <td className="py-4 px-5 font-semibold text-slate-300 border-r border-slate-800/60 flex items-center gap-2">
                              <Award className="h-4 w-4 text-emerald-500" />
                              <span>Overall Compliance Score</span>
                            </td>
                            {comparedNodes.map(node => {
                              const totalWeight = (Object.values(customWeights) as number[]).reduce((a, b) => a + b, 0);
                              let scoreSum = 0;
                              Object.entries(node.categories).forEach(([catId, cat]) => {
                                const weight = customWeights[catId] ?? 0;
                                const total = cat.checks.length;
                                const passed = cat.checks.filter(c => c.status === "pass").length;
                                const score = total > 0 ? (passed / total) * 100 : 100;
                                scoreSum += score * weight;
                              });
                              const finalScore = totalWeight > 0 ? scoreSum / totalWeight : 100;
                              const scoreColor = finalScore >= 90 ? "text-emerald-400" : finalScore >= 75 ? "text-amber-400" : "text-red-400";
                              
                              return (
                                <td key={node.name} className="py-4 px-5 text-center border-r border-slate-800/60 last:border-r-0 font-bold text-sm">
                                  <span className={scoreColor}>{Math.round(finalScore)}%</span>
                                </td>
                              );
                            })}
                          </tr>

                          {/* TOTAL CHECKS ROW */}
                          <tr className="hover:bg-slate-900/10">
                            <td className="py-4 px-5 text-slate-300 border-r border-slate-800/60 font-semibold flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-slate-400" />
                              <span>Checks Passed / Total</span>
                            </td>
                            {comparedNodes.map(node => {
                              const allChecks = Object.values(node.categories).flatMap(cat => cat.checks);
                              const total = allChecks.length;
                              const passed = allChecks.filter(c => c.status === "pass").length;
                              return (
                                <td key={node.name} className="py-4 px-5 text-center border-r border-slate-800/60 last:border-r-0 text-slate-300 font-semibold">
                                  {passed} / {total}
                                </td>
                              );
                            })}
                          </tr>

                          {/* CATEGORIES COMPARISON */}
                          {categoriesToCompare.map(catItem => {
                            return (
                              <tr key={catItem.id} className="hover:bg-slate-900/10">
                                <td className="py-4 px-5 text-slate-300 border-r border-slate-800/60 font-semibold flex items-center gap-2">
                                  {catItem.id === "gpu" && <Cpu className="h-4 w-4 text-emerald-500" />}
                                  {catItem.id === "network" && <Network className="h-4 w-4 text-emerald-500" />}
                                  {catItem.id === "storage" && <HardDrive className="h-4 w-4 text-emerald-500" />}
                                  {catItem.id === "slurm" && <Layers className="h-4 w-4 text-emerald-500" />}
                                  {catItem.id === "kubernetes" && <Database className="h-4 w-4 text-emerald-500" />}
                                  {catItem.id === "linux" && <Server className="h-4 w-4 text-emerald-500" />}
                                  <span>{catItem.name}</span>
                                </td>
                                {comparedNodes.map(node => {
                                  const cat = node.categories[catItem.id];
                                  const total = cat?.checks.length ?? 0;
                                  const passed = cat?.checks.filter(c => c.status === "pass").length ?? 0;
                                  const percentage = total > 0 ? Math.round((passed / total) * 100) : 100;
                                  const scoreColor = percentage >= 95 ? "text-emerald-400" : percentage >= 80 ? "text-amber-400" : "text-red-400";
                                  const dotBg = percentage >= 95 ? "bg-emerald-500" : percentage >= 80 ? "bg-amber-500" : "bg-red-500";
                                  
                                  return (
                                    <td key={node.name} className="py-4 px-5 text-center border-r border-slate-800/60 last:border-r-0">
                                      <div className="flex items-center justify-center gap-1.5">
                                        <span className={`h-1.5 w-1.5 rounded-full ${dotBg}`} />
                                        <span className={`font-bold ${scoreColor}`}>{percentage}%</span>
                                        <span className="text-[10px] text-slate-500 font-normal">({passed}/{total})</span>
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* DETAILED ISSUES LOGS SIDE-BY-SIDE */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
                      {comparedNodes.map(node => {
                        const allChecks = Object.values(node.categories).flatMap(cat => cat.checks);
                        const warningOrFailChecks = allChecks.filter(c => c.status !== "pass");
                        return (
                          <div key={node.name} className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-3">
                            <div className="flex justify-between items-center pb-2 border-b border-slate-800/60">
                              <span className="font-display font-bold text-xs text-slate-100">{node.name.toUpperCase()} Issue Logs</span>
                              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${warningOrFailChecks.length > 0 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-400'}`}>
                                {warningOrFailChecks.length} issue(s)
                              </span>
                            </div>

                            <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto scrollbar-thin text-[11px]">
                              {warningOrFailChecks.length === 0 ? (
                                <p className="text-slate-500 italic text-[10px] text-center py-4 font-mono">✔ Subsystem fully operational.</p>
                              ) : (
                                warningOrFailChecks.map(check => {
                                  const isFail = check.status === "fail";
                                  const textClass = isFail ? "text-red-400" : "text-amber-400";
                                  const bgClass = isFail ? "bg-red-500/5 border-red-500/10" : "bg-amber-500/5 border-amber-500/10";
                                  return (
                                    <div key={check.id} className={`p-2.5 rounded border ${bgClass} font-mono flex flex-col gap-1`}>
                                      <div className="flex items-center gap-1.5 justify-between">
                                        <span className={`font-bold uppercase text-[9px] truncate tracking-wider ${textClass}`}>{check.title}</span>
                                        <span className="text-[8px] text-slate-500 uppercase">{check.category}</span>
                                      </div>
                                      <p className="text-slate-400 text-[10px] leading-relaxed">{check.summary}</p>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 flex justify-between items-center">
                <button 
                  onClick={() => {
                    setComparedNodeNames([]);
                    setShowCompareModal(false);
                  }}
                  className="text-slate-400 hover:text-slate-200 font-mono text-[10px] uppercase font-bold cursor-pointer"
                >
                  Clear Selection
                </button>
                <button 
                  onClick={() => setShowCompareModal(false)}
                  className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-mono text-[10px] uppercase font-bold px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-500/10 border border-emerald-400/20"
                >
                  Close Matrix View
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
