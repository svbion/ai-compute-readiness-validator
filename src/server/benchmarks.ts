import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import express from "express";
import type { EngagementStore } from "./engagements";

export const BENCHMARK_SCHEMA_VERSION = "1.0.0";
export const BENCHMARK_PARSER_VERSION = "1.0.0";
export const BENCHMARK_FINDINGS_RULE_VERSION = "1.0.0";

export const benchmarkTypes = ["nccl", "hpl", "triton_perf_analyzer", "genai_perf"] as const;
export const benchmarkStatuses = ["imported", "parsed", "accepted", "rejected", "superseded"] as const;
export type BenchmarkType = typeof benchmarkTypes[number];
export type BenchmarkStatus = typeof benchmarkStatuses[number];

export interface BenchmarkProvenance {
  input_file: string;
  parser_version: string;
  source_lines: number[];
  parser: string;
  simulated: boolean;
}

export interface BenchmarkRun {
  id: string;
  schema_version: string;
  engagement_id: string;
  node_id: string | null;
  benchmark_type: BenchmarkType;
  benchmark_version: string | null;
  tool_version: string | null;
  collected_at: string;
  uploaded_at: string;
  status: BenchmarkStatus;
  simulated: boolean;
  input_file: string;
  sha256: string;
  warnings: string[];
  metrics: Record<string, unknown>;
  raw_storage_id: string;
  provenance: BenchmarkProvenance;
}

export interface BenchmarkThresholds {
  nccl_min_average_bus_bandwidth?: number;
  nccl_min_bus_bandwidth?: number;
  hpl_min_tflops?: number;
  inference_max_average_latency?: number;
  inference_max_p95?: number;
  inference_max_p99?: number;
  max_age_days?: number;
}

export interface BenchmarkFinding {
  id: string;
  rule_id: string;
  rule_version: string;
  engagement_id: string;
  node_id: string | null;
  benchmark_run_id: string | null;
  category: "benchmarks";
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  impact: string;
  recommendation: string;
  blocking: boolean;
  evidence_references: BenchmarkProvenance[];
  created_at: string;
  simulated: boolean;
}

function stripAnsi(text: string): string {
  return text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "");
}

function sha256Buffer(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function numberOrNull(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function isoFromMaybe(value: string | undefined): string {
  if (value) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

function lineProv(inputFile: string, parser: string, lines: number[], simulated: boolean): BenchmarkProvenance {
  return { input_file: inputFile, parser_version: BENCHMARK_PARSER_VERSION, source_lines: lines, parser, simulated };
}

function detectNcclOp(text: string): string | null {
  const match = text.match(/\b(all_reduce_perf|all_gather_perf|reduce_scatter_perf|broadcast_perf)\b/i);
  return match?.[1] ?? null;
}

export function parseNcclText(text: string, inputFile = "uploaded benchmark"): Pick<BenchmarkRun, "benchmark_type" | "benchmark_version" | "tool_version" | "collected_at" | "warnings" | "metrics" | "provenance"> {
  const clean = stripAnsi(text);
  const lines = clean.split(/\r?\n/);
  const warnings: string[] = [];
  const dataRows: Array<{ line: number; size: number; time: number | null; algbw: number | null; busbw: number | null; wrong: number | null }> = [];
  const resultLineNumbers: number[] = [];
  for (const [index, raw] of lines.entries()) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || /^=+$/.test(line) || /^-+$/.test(line)) continue;
    if (/\bINFO\b/i.test(line) && !/^\d/.test(line)) continue;
    const parts = line.split(/\s+/);
    if (!/^\d+$/.test(parts[0] ?? "") || !/^\d+$/.test(parts[1] ?? "") || !/^(char|half|float|double|int|uint|int64|uint64)$/i.test(parts[2] ?? "")) continue;
    const numeric = parts.map((part) => numberOrNull(part)).filter((item): item is number => item !== null);
    if (numeric.length < 5) continue;
    const wrong = numeric[numeric.length - 1];
    const busbw = numeric[numeric.length - 2];
    const algbw = numeric[numeric.length - 3];
    const time = numeric[numeric.length - 4];
    dataRows.push({ line: index + 1, size: numeric[0], time, algbw, busbw, wrong });
    resultLineNumbers.push(index + 1);
  }
  if (!dataRows.length) warnings.push("No NCCL data rows were parsed.");
  const busValues = dataRows.map((row) => row.busbw).filter((value): value is number => value !== null);
  const algValues = dataRows.map((row) => row.algbw).filter((value): value is number => value !== null);
  const wrong = dataRows.reduce((sum, row) => sum + (row.wrong ?? 0), 0);
  const metrics: Record<string, unknown> = {
    benchmark: detectNcclOp(clean) ?? "nccl_tests",
    message_size: dataRows.at(-1)?.size ?? null,
    algorithm_bandwidth: algValues.length ? Math.max(...algValues) : null,
    bus_bandwidth: busValues.length ? Math.max(...busValues) : null,
    average_bus_bandwidth: busValues.length ? busValues.reduce((sum, value) => sum + value, 0) / busValues.length : null,
    average_algorithm_bandwidth: algValues.length ? algValues.reduce((sum, value) => sum + value, 0) / algValues.length : null,
    time: dataRows.at(-1)?.time ?? null,
    errors: wrong,
    wrong_result_count: wrong,
    gpu_count: numberOrNull(clean.match(/\b(?:nranks|nRanks|ranks)\s*[:=]?\s*(\d+)/i)?.[1]) ?? numberOrNull(clean.match(/\b(\d+)\s+GPU(?:s)?\b/i)?.[1]),
    node_count: numberOrNull(clean.match(/\b(?:nodes|nnodes)\s*[:=]?\s*(\d+)/i)?.[1]),
    cuda_version: clean.match(/CUDA(?: Version)?\s*[:=]?\s*([0-9][\w.\-]+)/i)?.[1] ?? null,
    nccl_version: clean.match(/NCCL(?: version)?\s*[:=]?\s*([0-9][\w.\-]+)/i)?.[1] ?? null,
    transport: clean.match(/\b(NVLink|NVL|InfiniBand|IB|RoCE|TCP|Socket)\b/i)?.[1] ?? null,
  };
  return { benchmark_type: "nccl", benchmark_version: metrics.nccl_version as string | null, tool_version: metrics.nccl_version as string | null, collected_at: isoFromMaybe(clean.match(/(?:collected_at|date)\s*[:=]\s*(.+)/i)?.[1]), warnings, metrics, provenance: lineProv(inputFile, "nccl", resultLineNumbers, false) };
}

export function parseHplText(text: string, inputFile = "uploaded benchmark"): Pick<BenchmarkRun, "benchmark_type" | "benchmark_version" | "tool_version" | "collected_at" | "warnings" | "metrics" | "provenance"> {
  const clean = stripAnsi(text);
  const lines = clean.split(/\r?\n/);
  const warnings: string[] = [];
  let best: { line: number; n: number; nb: number; p: number; q: number; time: number; gflops: number } | null = null;
  for (const [index, raw] of lines.entries()) {
    const line = raw.trim();
    const match = line.match(/^\S+\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([0-9.eE+\-]+)\s+([0-9.eE+\-]+)/);
    if (!match) continue;
    const row = { line: index + 1, n: Number(match[1]), nb: Number(match[2]), p: Number(match[3]), q: Number(match[4]), time: Number(match[5]), gflops: Number(match[6]) };
    if (Number.isFinite(row.gflops) && (!best || row.gflops > best.gflops)) best = row;
  }
  const residualFailed = /FAILED/i.test(clean) || /residual[^\n]*(?:fail|failed)/i.test(clean);
  const residualPassed = !residualFailed && (/PASSED/i.test(clean) || /residual[^\n]*(?:pass|passed)/i.test(clean));
  if (!best) warnings.push("No HPL performance row was parsed.");
  if (!residualPassed && !residualFailed) warnings.push("No explicit HPL residual pass/fail result was found.");
  const gflopsFallback = numberOrNull(clean.match(/([0-9.eE+\-]+)\s*G(?:FLOP\/s|FLOPS|Flops)/i)?.[1]);
  const gflops = best?.gflops ?? gflopsFallback;
  const metrics: Record<string, unknown> = {
    problem_size: best?.n ?? null,
    block_size: best?.nb ?? null,
    P: best?.p ?? null,
    Q: best?.q ?? null,
    runtime: best?.time ?? null,
    performance_gflops: gflops ?? null,
    performance_tflops: gflops === null || gflops === undefined ? null : gflops / 1000,
    residual_pass: residualPassed ? true : residualFailed ? false : null,
    gpu_count: numberOrNull(clean.match(/\b(\d+)\s+GPU(?:s)?\b/i)?.[1]),
    node_count: numberOrNull(clean.match(/\b(?:nodes|nnodes)\s*[:=]?\s*(\d+)/i)?.[1]),
  };
  return { benchmark_type: "hpl", benchmark_version: null, tool_version: clean.match(/HPL(?: version)?\s*[:=]?\s*([0-9][\w.\-]+)/i)?.[1] ?? null, collected_at: isoFromMaybe(clean.match(/(?:collected_at|date)\s*[:=]\s*(.+)/i)?.[1]), warnings, metrics, provenance: lineProv(inputFile, "hpl", best ? [best.line] : [], false) };
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = stripAnsi(text).split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2 || !lines[0].includes(",")) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => Object.fromEntries(line.split(",").map((value, index) => [headers[index], value.trim()])));
}

function findMetric(text: string, labels: string[]): number | null {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = text.match(new RegExp(`${escaped}[^0-9\n\r+-]*([0-9][0-9,.eE+\-]*)`, "i"));
    const value = numberOrNull(match?.[1]);
    if (value !== null) return value;
  }
  return null;
}

export function parseInferenceText(text: string, type: "triton_perf_analyzer" | "genai_perf", inputFile = "uploaded benchmark"): Pick<BenchmarkRun, "benchmark_type" | "benchmark_version" | "tool_version" | "collected_at" | "warnings" | "metrics" | "provenance"> {
  const clean = stripAnsi(text);
  const warnings: string[] = [];
  const rows = parseCsv(clean);
  const first = rows[0] ?? {};
  const csvMetric = (names: string[]) => {
    for (const name of names) {
      const key = Object.keys(first).find((candidate) => candidate.includes(name));
      const value = numberOrNull(key ? first[key] : undefined);
      if (value !== null) return value;
    }
    return null;
  };
  const metrics: Record<string, unknown> = {
    throughput: csvMetric(["throughput", "infer/sec", "inferences/second"]) ?? findMetric(clean, ["Throughput", "Inferences/Second"]),
    average_latency: csvMetric(["avg latency", "average latency", "latency avg"]) ?? findMetric(clean, ["Avg latency", "Average latency", "Request latency"]),
    p95: csvMetric(["p95", "95"]) ?? findMetric(clean, ["p95", "95th percentile"]),
    p99: csvMetric(["p99", "99"]) ?? findMetric(clean, ["p99", "99th percentile"]),
    queue_time: csvMetric(["queue"]) ?? findMetric(clean, ["Queue", "queue time"]),
    compute_time: csvMetric(["compute"]) ?? findMetric(clean, ["Compute", "compute time"]),
    requests: csvMetric(["request count", "requests"]) ?? findMetric(clean, ["Requests", "request count"]),
    tokens_per_second: csvMetric(["tokens/sec", "tokens per second", "output token throughput"]) ?? findMetric(clean, ["tokens/sec", "tokens per second", "Output token throughput"]),
    time_to_first_token: csvMetric(["time to first token", "ttft"]) ?? findMetric(clean, ["time to first token", "TTFT"]),
    inter_token_latency: csvMetric(["inter token", "itl"]) ?? findMetric(clean, ["inter token latency", "ITL"]),
  };
  if (!Object.values(metrics).some((value) => value !== null)) warnings.push("No inference benchmark metrics were parsed.");
  return { benchmark_type: type, benchmark_version: null, tool_version: clean.match(/(?:perf_analyzer|genai-perf)\s*(?:version)?\s*[:=]?\s*([0-9][\w.\-]+)/i)?.[1] ?? null, collected_at: isoFromMaybe(clean.match(/(?:collected_at|date)\s*[:=]\s*(.+)/i)?.[1]), warnings, metrics, provenance: lineProv(inputFile, type, Object.values(metrics).some((value) => value !== null) ? [1] : [], false) };
}

export function parseBenchmarkText(type: BenchmarkType, text: string, inputFile = "uploaded benchmark") {
  if (type === "nccl") return parseNcclText(text, inputFile);
  if (type === "hpl") return parseHplText(text, inputFile);
  if (type === "triton_perf_analyzer" || type === "genai_perf") return parseInferenceText(text, type, inputFile);
  throw new Error(`Unsupported benchmark type: ${type}`);
}

export function thresholdsFromEnv(env = process.env): BenchmarkThresholds {
  const read = (name: string) => {
    const value = Number(env[name]);
    return Number.isFinite(value) ? value : undefined;
  };
  return {
    nccl_min_average_bus_bandwidth: read("AI_VALIDATOR_NCCL_MIN_AVERAGE_BUS_BANDWIDTH"),
    nccl_min_bus_bandwidth: read("AI_VALIDATOR_NCCL_MIN_BUS_BANDWIDTH"),
    hpl_min_tflops: read("AI_VALIDATOR_HPL_MIN_TFLOPS"),
    inference_max_average_latency: read("AI_VALIDATOR_INFERENCE_MAX_AVERAGE_LATENCY"),
    inference_max_p95: read("AI_VALIDATOR_INFERENCE_MAX_P95"),
    inference_max_p99: read("AI_VALIDATOR_INFERENCE_MAX_P99"),
    max_age_days: read("AI_VALIDATOR_BENCHMARK_MAX_AGE_DAYS"),
  };
}

function finding(input: Omit<BenchmarkFinding, "id" | "rule_version" | "created_at" | "category">): BenchmarkFinding {
  const id = crypto.createHash("sha256").update(JSON.stringify([input.rule_id, input.engagement_id, input.node_id, input.benchmark_run_id])).digest("hex").slice(0, 16);
  return { ...input, id: `bfnd_${id}`, rule_version: BENCHMARK_FINDINGS_RULE_VERSION, created_at: new Date().toISOString(), category: "benchmarks" };
}

export function deriveBenchmarkFindings(engagementId: string, expectedNodeIds: string[], runs: BenchmarkRun[], thresholds: BenchmarkThresholds = thresholdsFromEnv()): BenchmarkFinding[] {
  const findings: BenchmarkFinding[] = [];
  const accepted = runs.filter((run) => run.status === "accepted" || run.status === "parsed");
  const hasType = (type: BenchmarkType) => accepted.some((run) => run.benchmark_type === type);
  for (const type of ["nccl", "hpl"] as BenchmarkType[]) {
    if (!hasType(type)) findings.push(finding({ rule_id: "benchmark-missing", engagement_id: engagementId, node_id: null, benchmark_run_id: null, severity: "info", title: `${type.toUpperCase()} benchmark missing`, description: `${type.toUpperCase()} benchmark evidence has not been imported.`, impact: "Benchmark category is not evaluated until evidence is imported.", recommendation: "Import existing benchmark output when it is available.", blocking: false, evidence_references: [], simulated: false }));
  }
  if (!accepted.some((run) => run.benchmark_type === "triton_perf_analyzer" || run.benchmark_type === "genai_perf")) findings.push(finding({ rule_id: "benchmark-missing", engagement_id: engagementId, node_id: null, benchmark_run_id: null, severity: "info", title: "Inference benchmark missing", description: "Triton Performance Analyzer or GenAI-Perf evidence has not been imported.", impact: "Inference benchmark category is not evaluated until evidence is imported.", recommendation: "Import existing inference benchmark output when it is available.", blocking: false, evidence_references: [], simulated: false }));
  for (const nodeId of expectedNodeIds) {
    if (!accepted.some((run) => run.node_id === nodeId)) findings.push(finding({ rule_id: "benchmark-missing-node", engagement_id: engagementId, node_id: nodeId, benchmark_run_id: null, severity: "info", title: "Benchmark missing for node", description: `No benchmark evidence has been imported for ${nodeId}.`, impact: "Per-node benchmark acceptance is not evaluated for this node.", recommendation: "Import existing node-scoped benchmark output when applicable.", blocking: false, evidence_references: [], simulated: false }));
  }
  for (const run of accepted) {
    const metric = (name: string) => typeof run.metrics[name] === "number" ? run.metrics[name] as number : null;
    if (run.simulated) findings.push(finding({ rule_id: "benchmark-simulated", engagement_id: engagementId, node_id: run.node_id, benchmark_run_id: run.id, severity: "info", title: "Simulated benchmark evidence", description: "Benchmark evidence is marked simulated and is demonstration-only.", impact: "Simulated benchmark output is not valid for customer acceptance.", recommendation: "Replace with customer-approved real benchmark output before acceptance.", blocking: false, evidence_references: [run.provenance], simulated: true }));
    if (run.status === "rejected") findings.push(finding({ rule_id: "benchmark-rejected", engagement_id: engagementId, node_id: run.node_id, benchmark_run_id: run.id, severity: "high", title: "Benchmark rejected", description: "Benchmark evidence could not be parsed or accepted.", impact: "Benchmark category cannot be evaluated from this file.", recommendation: "Review the input format and parser warnings.", blocking: true, evidence_references: [run.provenance], simulated: run.simulated }));
    if (thresholds.max_age_days && Date.now() - Date.parse(run.collected_at) > thresholds.max_age_days * 86400_000) findings.push(finding({ rule_id: "benchmark-outdated", engagement_id: engagementId, node_id: run.node_id, benchmark_run_id: run.id, severity: "medium", title: "Benchmark outdated", description: `Benchmark is older than ${thresholds.max_age_days} days.`, impact: "Benchmark evidence may not represent current performance.", recommendation: "Import newer benchmark output when available.", blocking: false, evidence_references: [run.provenance], simulated: run.simulated }));
    if (run.benchmark_type === "nccl") {
      if (metric("wrong_result_count") && metric("wrong_result_count")! > 0) findings.push(finding({ rule_id: "nccl-wrong-results", engagement_id: engagementId, node_id: run.node_id, benchmark_run_id: run.id, severity: "critical", title: "NCCL wrong results reported", description: "NCCL Tests reported non-zero wrong results/errors.", impact: "Collective communication correctness is not acceptable.", recommendation: "Investigate GPU fabric, driver, CUDA, and NCCL configuration before acceptance.", blocking: true, evidence_references: [run.provenance], simulated: run.simulated }));
      if (thresholds.nccl_min_average_bus_bandwidth !== undefined && (metric("average_bus_bandwidth") ?? 0) < thresholds.nccl_min_average_bus_bandwidth) findings.push(finding({ rule_id: "nccl-bandwidth-below-threshold", engagement_id: engagementId, node_id: run.node_id, benchmark_run_id: run.id, severity: "high", title: "NCCL bandwidth below threshold", description: `Average NCCL bus bandwidth is below configured threshold ${thresholds.nccl_min_average_bus_bandwidth}.`, impact: "GPU fabric performance may not meet the configured acceptance target.", recommendation: "Review benchmark parameters, transport, topology, and fabric health.", blocking: true, evidence_references: [run.provenance], simulated: run.simulated }));
    }
    if (run.benchmark_type === "hpl") {
      if (run.metrics.residual_pass === false) findings.push(finding({ rule_id: "hpl-residual-failed", engagement_id: engagementId, node_id: run.node_id, benchmark_run_id: run.id, severity: "critical", title: "HPL residual failed", description: "NVIDIA HPL output indicates FAILED residual validation.", impact: "HPL correctness is not acceptable.", recommendation: "Investigate numerical stability, GPU health, and HPL configuration before acceptance.", blocking: true, evidence_references: [run.provenance], simulated: run.simulated }));
      if (thresholds.hpl_min_tflops !== undefined && (metric("performance_tflops") ?? 0) < thresholds.hpl_min_tflops) findings.push(finding({ rule_id: "hpl-performance-below-threshold", engagement_id: engagementId, node_id: run.node_id, benchmark_run_id: run.id, severity: "high", title: "HPL performance below threshold", description: `HPL TFLOPS is below configured threshold ${thresholds.hpl_min_tflops}.`, impact: "Compute performance may not meet the configured acceptance target.", recommendation: "Review HPL problem size, GPU clocks, thermals, and topology.", blocking: true, evidence_references: [run.provenance], simulated: run.simulated }));
    }
    if (run.benchmark_type === "triton_perf_analyzer" || run.benchmark_type === "genai_perf") {
      const avg = metric("average_latency");
      const p95 = metric("p95");
      const p99 = metric("p99");
      if (thresholds.inference_max_average_latency !== undefined && avg !== null && avg > thresholds.inference_max_average_latency) findings.push(finding({ rule_id: "inference-latency-exceeds-threshold", engagement_id: engagementId, node_id: run.node_id, benchmark_run_id: run.id, severity: "high", title: "Inference latency exceeds threshold", description: `Average latency exceeds configured threshold ${thresholds.inference_max_average_latency}.`, impact: "Inference service may not satisfy configured acceptance targets.", recommendation: "Review model, concurrency, batching, compute, and serving configuration.", blocking: true, evidence_references: [run.provenance], simulated: run.simulated }));
      if (thresholds.inference_max_p95 !== undefined && p95 !== null && p95 > thresholds.inference_max_p95) findings.push(finding({ rule_id: "inference-p95-exceeds-threshold", engagement_id: engagementId, node_id: run.node_id, benchmark_run_id: run.id, severity: "medium", title: "Inference p95 latency exceeds threshold", description: `p95 latency exceeds configured threshold ${thresholds.inference_max_p95}.`, impact: "Tail latency may not satisfy configured acceptance targets.", recommendation: "Review serving saturation and queueing.", blocking: false, evidence_references: [run.provenance], simulated: run.simulated }));
      if (thresholds.inference_max_p99 !== undefined && p99 !== null && p99 > thresholds.inference_max_p99) findings.push(finding({ rule_id: "inference-p99-exceeds-threshold", engagement_id: engagementId, node_id: run.node_id, benchmark_run_id: run.id, severity: "medium", title: "Inference p99 latency exceeds threshold", description: `p99 latency exceeds configured threshold ${thresholds.inference_max_p99}.`, impact: "Tail latency may not satisfy configured acceptance targets.", recommendation: "Review serving saturation and queueing.", blocking: false, evidence_references: [run.provenance], simulated: run.simulated }));
    }
  }
  return findings;
}

function benchmarkStorageRoot(): string {
  return process.env.AI_VALIDATOR_BENCHMARK_STORAGE_DIR ?? path.join(process.cwd(), "artifacts", "benchmarks");
}

function errorResponse(res: express.Response, status: number, message: string) {
  return res.status(status).set("Cache-Control", "no-store").json({ error: message, error_id: `err_${crypto.randomBytes(8).toString("hex")}` });
}

function normalizeType(value: unknown): BenchmarkType {
  const raw = String(value ?? "").trim().toLowerCase().replace(/-/g, "_");
  const mapped = raw === "triton" || raw === "perf_analyzer" ? "triton_perf_analyzer" : raw === "genai" || raw === "genai_perf" ? "genai_perf" : raw;
  if (!benchmarkTypes.includes(mapped as BenchmarkType)) throw new Error("Unsupported benchmark type.");
  return mapped as BenchmarkType;
}

export function registerBenchmarkRoutes(app: express.Express, store: EngagementStore) {
  app.get("/api/v1/engagements/:engagementId/benchmarks", (req, res) => {
    if (!store.getEngagement(req.params.engagementId)) return errorResponse(res, 404, "Engagement not found.");
    const runs = (store as any).listBenchmarks(req.params.engagementId) as BenchmarkRun[];
    const nodes = store.getNodes(req.params.engagementId);
    return res.set("Cache-Control", "no-store").json({ benchmarks: runs, findings: deriveBenchmarkFindings(req.params.engagementId, nodes.map((node) => node.id), runs) });
  });

  app.post("/api/v1/benchmarks/upload", express.raw({ type: ["text/*", "application/octet-stream", "application/json", "application/csv"], limit: "25mb" }), (req, res) => {
    const auth = req.get("authorization") ?? "";
    if (req.query.token || !auth.startsWith("Bearer ")) return errorResponse(res, 401, "Upload authentication failed.");
    const token = store.findActiveUploadToken(auth.slice("Bearer ".length).trim());
    if (!token) return errorResponse(res, 401, "Upload authentication failed.");
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) return errorResponse(res, 400, "Benchmark upload is required.");
    try {
      const type = normalizeType(req.query.type ?? req.get("x-benchmark-type"));
      const originalName = String(req.query.filename ?? req.get("x-benchmark-filename") ?? `${type}.txt`).replace(/[<>"'`\n\r\t]/g, "").slice(0, 120);
      const sha256 = sha256Buffer(req.body);
      const text = req.body.toString("utf8");
      const parsed = parseBenchmarkText(type, text, originalName);
      const now = new Date().toISOString();
      const collectionId = `bmk_${sha256.slice(0, 16)}`;
      const finalDir = path.join(benchmarkStorageRoot(), token.engagement_id, token.node_id, collectionId);
      fs.mkdirSync(finalDir, { recursive: true });
      fs.writeFileSync(path.join(finalDir, "input.txt"), req.body, { mode: 0o600 });
      const run: Omit<BenchmarkRun, "id" | "schema_version" | "status"> = { engagement_id: token.engagement_id, node_id: token.node_id, benchmark_type: type, benchmark_version: parsed.benchmark_version, tool_version: parsed.tool_version, collected_at: parsed.collected_at, uploaded_at: now, simulated: req.query.simulated === "true" || req.get("x-benchmark-simulated") === "true", input_file: originalName, sha256, warnings: parsed.warnings, metrics: parsed.metrics, raw_storage_id: collectionId, provenance: { ...parsed.provenance, simulated: req.query.simulated === "true" || req.get("x-benchmark-simulated") === "true" } };
      const accepted = (store as any).acceptBenchmarkRun(run) as BenchmarkRun;
      return res.status(201).set("Cache-Control", "no-store").json({ benchmark: accepted });
    } catch (error) {
      return errorResponse(res, 400, error instanceof Error ? error.message : "Benchmark upload rejected.");
    }
  });
}

export function writeLocalBenchmarkImport(type: BenchmarkType, inputPath: string, options: { engagementId?: string; nodeId?: string; outputDir?: string; simulated?: boolean } = {}): BenchmarkRun {
  const body = fs.readFileSync(inputPath);
  const parsed = parseBenchmarkText(type, body.toString("utf8"), path.basename(inputPath));
  const sha256 = sha256Buffer(body);
  const now = new Date().toISOString();
  const outputDir = options.outputDir ?? path.join(process.cwd(), "artifacts", "benchmark-imports");
  fs.mkdirSync(outputDir, { recursive: true });
  const run: BenchmarkRun = { id: `bmk_${crypto.randomUUID()}`, schema_version: BENCHMARK_SCHEMA_VERSION, engagement_id: options.engagementId ?? "local-import", node_id: options.nodeId ?? null, benchmark_type: type, benchmark_version: parsed.benchmark_version, tool_version: parsed.tool_version, collected_at: parsed.collected_at, uploaded_at: now, status: parsed.warnings.some((w) => w.startsWith("No ")) ? "rejected" : "accepted", simulated: options.simulated === true, input_file: inputPath, sha256, warnings: parsed.warnings, metrics: parsed.metrics, raw_storage_id: sha256.slice(0, 16), provenance: { ...parsed.provenance, simulated: options.simulated === true } };
  fs.writeFileSync(path.join(outputDir, `${run.raw_storage_id}.json`), `${JSON.stringify(run, null, 2)}${os.EOL}`, { mode: 0o600 });
  return run;
}
