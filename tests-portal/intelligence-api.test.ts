import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";
import type { AddressInfo } from "node:net";

import { createPortalServerApp } from "../server";
import { parseAcceptedEvidence, deriveClusterComparison, deriveFindings, deriveReadiness } from "../src/server/intelligence";

const authHeader = { "x-ai-factory-test-auth": "test-bypass-token" };

function checksum(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function tarHeader(name: string, size: number): Buffer {
  const header = Buffer.alloc(512, 0);
  header.write(name, 0, 100, "utf8");
  header.write("0000600\0", 100, 8, "ascii");
  header.write("0000000\0", 108, 8, "ascii");
  header.write("0000000\0", 116, 8, "ascii");
  header.write(size.toString(8).padStart(11, "0") + "\0", 124, 12, "ascii");
  header.write("00000000000\0", 136, 12, "ascii");
  header.fill(0x20, 148, 156);
  header.write("0", 156, 1, "ascii");
  header.write("ustar\0", 257, 6, "ascii");
  header.write("00", 263, 2, "ascii");
  const sum = header.reduce((total, byte) => total + byte, 0);
  header.write(sum.toString(8).padStart(6, "0") + "\0 ", 148, 8, "ascii");
  return header;
}

function tarGz(files: Record<string, Buffer>): Buffer {
  const chunks: Buffer[] = [];
  for (const name of Object.keys(files).sort()) {
    const data = files[name];
    chunks.push(tarHeader(name, data.length), data, Buffer.alloc((512 - (data.length % 512)) % 512, 0));
  }
  chunks.push(Buffer.alloc(1024, 0));
  return zlib.gzipSync(Buffer.concat(chunks));
}

function demoBundle(nodeName: "node01" | "node02", overrides: { driver?: string; cuda?: string; collectionId?: string } = {}) {
  const nodeId = `node_demo_${nodeName}`;
  const driver = overrides.driver ?? "580.124.01";
  const cuda = overrides.cuda ?? "12.9";
  const collectedAt = "2026-01-01T00:00:00.000Z";
  const files: Record<string, Buffer> = {
    "linux/uname.txt": Buffer.from(`Linux ${nodeName} 6.8.0-fixture x86_64 GNU/Linux\n`),
    "linux/os-release.txt": Buffer.from('NAME="Ubuntu"\nVERSION="24.04.2 LTS (Noble Numbat)"\nVERSION_ID="24.04"\nPRETTY_NAME="Ubuntu 24.04.2 LTS"\n'),
    "linux/lscpu.txt": Buffer.from("Model name: Intel(R) Xeon(R) Platinum 8480C\nSocket(s): 2\nCore(s) per socket: 56\n"),
    "linux/lsmem.txt": Buffer.from("Total online memory: 1T\n"),
    "linux/systemctl-failed.txt": Buffer.from("0 loaded units listed.\n"),
    "gpu/nvidia-smi.txt": Buffer.from(`NVIDIA-SMI ${driver} Driver Version: ${driver} CUDA Version: ${cuda}\n|   0  NVIDIA H100 80GB HBM3       On |\n|   1  NVIDIA H100 80GB HBM3       On |\n|   2  NVIDIA H100 80GB HBM3       On |\n|   3  NVIDIA H100 80GB HBM3       On |\n|   4  NVIDIA H100 80GB HBM3       On |\n|   5  NVIDIA H100 80GB HBM3       On |\n|   6  NVIDIA H100 80GB HBM3       On |\n|   7  NVIDIA H100 80GB HBM3       On |\n`),
    "gpu/nvidia-smi-query.txt": Buffer.from(`Driver Version                            : ${driver}\nCUDA Version                              : ${cuda}\nAttached GPUs                             : 8\nProduct Name                              : NVIDIA H100 80GB HBM3\nFB Memory Usage\n    Total                                 : 81559 MiB\n`),
    "gpu/topology.txt": Buffer.from("GPU0 GPU1 GPU2 GPU3 GPU4 GPU5 GPU6 GPU7 mlx5_0\nGPU0 X NV18 NV18 NV18 NV18 NV18 NV18 NV18 PIX\n"),
    "gpu/nvlink-status.txt": Buffer.from("GPU 0: NVIDIA H100 80GB HBM3\n Link 0: 26.562 GB/s\n Link 1: 26.562 GB/s\n"),
    "gpu/dcgm-discovery.txt": Buffer.from("8 GPUs found.\n+ GPU 0: NVIDIA H100 80GB HBM3\n"),
  };
  const commands = Object.keys(files).map((file) => {
    const commandByFile: Record<string, { id: string; argv: string[]; category: string }> = {
      "linux/uname.txt": { id: "uname", argv: ["uname", "-a"], category: "linux" },
      "linux/os-release.txt": { id: "os-release", argv: ["cat", "/etc/os-release"], category: "linux" },
      "linux/lscpu.txt": { id: "lscpu", argv: ["lscpu"], category: "linux" },
      "linux/lsmem.txt": { id: "lsmem", argv: ["lsmem"], category: "linux" },
      "linux/systemctl-failed.txt": { id: "systemctl-failed", argv: ["systemctl", "--failed"], category: "linux" },
      "gpu/nvidia-smi.txt": { id: "nvidia-smi", argv: ["nvidia-smi"], category: "gpu" },
      "gpu/nvidia-smi-query.txt": { id: "nvidia-smi-query", argv: ["nvidia-smi", "-q"], category: "gpu" },
      "gpu/topology.txt": { id: "nvidia-smi-topo", argv: ["nvidia-smi", "topo", "-m"], category: "gpu" },
      "gpu/nvlink-status.txt": { id: "nvidia-smi-nvlink-status", argv: ["nvidia-smi", "nvlink", "--status"], category: "gpu" },
      "gpu/dcgm-discovery.txt": { id: "dcgmi-discovery", argv: ["dcgmi", "discovery", "-l"], category: "gpu" },
    };
    const command = commandByFile[file];
    return { command_id: command.id, category: command.category, argv: command.argv, duration_ms: 0, exit_code: 0, status: "collected", stdout_file: file, stderr_file: null, error_summary: null, hostname: `HOST-${nodeName.slice(-2)}`, collector_version: "ai-validator 0.1.0", finished_at: collectedAt };
  });
  const manifestObject = {
    schema_version: "1.0.0",
    collector_version: "ai-validator 0.1.0",
    profile: "dgx-class",
    collection_mode: "fixture",
    collection_id: overrides.collectionId ?? `demo-${nodeName}`,
    engagement_id: "eng_demo_nvis_h100_two_node",
    node_id: nodeId,
    started_at: collectedAt,
    finished_at: collectedAt,
    source_hostname: `HOST-${nodeName.slice(-2)}`,
    sanitized: true,
    simulated: true,
    command_count: commands.length,
    collected_count: commands.length,
    missing_count: 0,
    failed_count: 0,
    skipped_count: 0,
    categories: ["gpu", "linux"],
    checksum_algorithm: "sha256",
    files: Object.entries(files).map(([file, data]) => ({ path: file, category: file.split("/")[0], command_id: commands.find((cmd) => cmd.stdout_file === file)!.command_id, bytes: data.length, sha256: checksum(data) })),
    warnings: ["Simulated fixture evidence for local ingestion demonstration only."],
  };
  const metadata = Buffer.from(JSON.stringify(commands, null, 2));
  const manifest = Buffer.from(JSON.stringify(manifestObject, null, 2));
  const allFiles = { ...files, "metadata/commands.json": metadata, "manifest.json": manifest };
  const checksums = Buffer.from(Object.entries(allFiles).sort(([a], [b]) => a.localeCompare(b)).map(([file, data]) => `${checksum(data)}  ${file}`).join("\n") + "\n");
  return tarGz({ ...allFiles, "checksums.sha256": checksums });
}

async function withServer(fn: (baseUrl: string, storePath: string, evidenceDir: string) => Promise<void>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gpu-validator-intelligence-api-test-"));
  const storePath = path.join(dir, "store.json");
  const evidenceDir = path.join(dir, "evidence");
  const previous = { ...process.env };
  process.env.NODE_ENV = "production";
  process.env.AI_FACTORY_AUTH_REQUIRED = "true";
  process.env.AI_FACTORY_SESSION_SECRET = "0123456789abcdef0123456789abcdef";
  process.env.AI_FACTORY_REVIEWER_EMAIL = "reviewer@example.invalid";
  process.env.AI_FACTORY_REVIEWER_PASSWORD_HASH = "scrypt$abc$def";
  process.env.AI_FACTORY_AUTH_TEST_BYPASS_TOKEN = "test-bypass-token";
  process.env.AI_VALIDATOR_ENGAGEMENT_STORE = storePath;
  process.env.AI_VALIDATOR_EVIDENCE_STORAGE_DIR = evidenceDir;
  const app = await createPortalServerApp({ mountFrontend: false });
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  const address = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${address.port}`, storePath, evidenceDir);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    process.env = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function jsonRequest(baseUrl: string, method: string, url: string, body?: unknown, authed = true) {
  const response = await fetch(`${baseUrl}${url}`, {
    method,
    headers: { "Content-Type": "application/json", ...(authed ? authHeader : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function uploadNode(baseUrl: string, nodeId: string, bundle: Buffer) {
  const token = await jsonRequest(baseUrl, "POST", `/api/v1/engagements/eng_demo_nvis_h100_two_node/nodes/${nodeId}/upload-tokens`);
  const upload = await fetch(`${baseUrl}/api/v1/evidence/uploads`, { method: "POST", headers: { Authorization: `Bearer ${token.payload.token}`, "Content-Type": "application/octet-stream" }, body: bundle });
  assert.equal(upload.status, 201, JSON.stringify(await upload.json().catch(() => ({}))));
}

test("parser extracts Linux and NVIDIA facts with provenance and warnings for malformed input", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gpu-validator-parse-test-"));
  try {
    fs.mkdirSync(path.join(tmp, "linux"), { recursive: true });
    fs.mkdirSync(path.join(tmp, "gpu"), { recursive: true });
    fs.mkdirSync(path.join(tmp, "metadata"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "linux", "os-release.txt"), 'PRETTY_NAME="Ubuntu 24.04.2 LTS"\nVERSION_ID="24.04"\n');
    fs.writeFileSync(path.join(tmp, "linux", "uname.txt"), "Linux host 6.8.0-fixture x86_64 GNU/Linux\n");
    fs.writeFileSync(path.join(tmp, "linux", "lscpu.txt"), "Model name: AMD EPYC 9654\nSocket(s): 2\nCore(s) per socket: 96\n");
    fs.writeFileSync(path.join(tmp, "linux", "lsmem.txt"), "Total online memory: 1T\n");
    fs.writeFileSync(path.join(tmp, "linux", "systemctl-failed.txt"), "UNIT LOAD ACTIVE SUB DESCRIPTION\nbad.service loaded failed failed Bad\n");
    fs.writeFileSync(path.join(tmp, "gpu", "nvidia-smi.txt"), "NVIDIA-SMI 580.124 Driver Version: 580.124 CUDA Version: 12.9\n| 0 NVIDIA H100 80GB HBM3 On |\n");
    fs.writeFileSync(path.join(tmp, "gpu", "nvidia-smi-query.txt"), "Product Name : NVIDIA H100 80GB HBM3\nFB Memory Usage\n    Total : 81559 MiB\n");
    fs.writeFileSync(path.join(tmp, "metadata", "commands.json"), JSON.stringify([{ command_id: "nvidia-smi", status: "collected", stdout_file: "gpu/nvidia-smi.txt", argv: ["nvidia-smi"] }, { command_id: "missing", status: "missing" }]));
    const files = ["linux/os-release.txt", "linux/uname.txt", "linux/lscpu.txt", "linux/lsmem.txt", "linux/systemctl-failed.txt", "gpu/nvidia-smi.txt", "gpu/nvidia-smi-query.txt"];
    const manifest = { finished_at: "2026-01-01T00:00:00.000Z", source_hostname: "HOST", profile: "dgx-class", sanitized: true, simulated: true, command_count: 2, collected_count: 1, missing_count: 1, failed_count: 0, files: files.map((file) => ({ path: file, command_id: file.includes("nvidia") ? "nvidia-smi" : file.split(/[/.]/)[1], sha256: checksum(fs.readFileSync(path.join(tmp, file))) })) };
    fs.writeFileSync(path.join(tmp, "manifest.json"), JSON.stringify(manifest));
    const facts = parseAcceptedEvidence({ id: "evd_test", node_id: "node1", collector_profile: "dgx-class", collected_at: "2026-01-01T00:00:00.000Z", sanitized: true, simulated: true, command_count: 2, collected_count: 1, missing_count: 1, failed_count: 0, source_hostname_display: "HOST" } as any, tmp);
    assert.equal(facts.operating_system.value, "Ubuntu 24.04.2 LTS");
    assert.equal(facts.kernel_version.value, "6.8.0-fixture");
    assert.equal(facts.gpu_model.value, "NVIDIA H100 80GB HBM3");
    assert.equal(facts.gpu_count.value, 1);
    assert.equal(facts.failed_systemd_units.value?.length, 1);
    assert.equal(facts.driver_version.provenance?.source_file, "gpu/nvidia-smi.txt");
    assert.equal(facts.command_missing_count.value, 1);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("comparison consensus handles mismatch, all-null values, and ties", () => {
  const base: any = { evidence_id: { value: "e" }, simulated: { value: true }, node_id: { value: "n" }, gpu_model: { value: null }, gpu_count: { value: null }, total_memory_bytes: { value: null }, driver_version: { value: null }, cuda_version: { value: null }, kernel_version: { value: null }, operating_system_version: { value: null }, ofed_version: { value: null }, fabric_type: { value: null }, nvlink_status: { value: null } };
  const comparison = deriveClusterComparison("eng", [{ ...base, node_id: { value: "n1" }, driver_version: { value: "A" } }, { ...base, node_id: { value: "n2" }, driver_version: { value: "B" } }], [] as any);
  assert.equal(comparison.fields.driver_version.consensus_value, null);
  assert.equal(comparison.warnings.some((warning) => warning.includes("tie")), true);
  assert.equal(comparison.fields.gpu_model.consensus_value, null);
  assert.equal(comparison.rows[0].fields.gpu_model.matches_consensus, true);
});

test("findings and readiness cover mismatches, stale/simulated evidence, and blocking overrides", () => {
  const facts: any[] = [
    { node_id: { value: "node01" }, evidence_id: { value: "ev1" }, gpu_model: { value: "H100" }, gpu_count: { value: 8 }, driver_version: { value: "580" }, cuda_version: { value: "12.9" }, kernel_version: { value: "6.8" }, operating_system_version: { value: "24.04" }, ofed_version: { value: "24.10" }, fabric_type: { value: "InfiniBand" }, nvlink_status: { value: "healthy" }, dcgm_available: { value: true }, failed_systemd_units: { value: [] }, command_failed_count: { value: 0 }, command_missing_count: { value: 0 }, simulated: { value: true }, collected_at: { value: "2020-01-01T00:00:00.000Z" } },
    { node_id: { value: "node02" }, evidence_id: { value: "ev2" }, gpu_model: { value: "H100" }, gpu_count: { value: 8 }, driver_version: { value: "575" }, cuda_version: { value: "12.9" }, kernel_version: { value: "6.8" }, operating_system_version: { value: "24.04" }, ofed_version: { value: "24.10" }, fabric_type: { value: "InfiniBand" }, nvlink_status: { value: "healthy" }, dcgm_available: { value: true }, failed_systemd_units: { value: [] }, command_failed_count: { value: 0 }, command_missing_count: { value: 0 }, simulated: { value: true }, collected_at: { value: "2020-01-01T00:00:00.000Z" } },
  ];
  const comparison = deriveClusterComparison("eng", facts, [] as any);
  const findings = deriveFindings({ id: "eng", platform_profile: "hgx-h100", expected_node_count: 2, received_node_count: 2 } as any, facts, comparison, new Date("2026-01-01T00:00:00Z"));
  assert.equal(findings.some((finding) => finding.rule_id === "driver-version-mismatch" && finding.blocking), true);
  assert.equal(findings.some((finding) => finding.rule_id === "simulated-evidence" && !finding.blocking), true);
  assert.equal(findings.some((finding) => finding.rule_id === "stale-evidence" && finding.blocking), true);
  const readiness = deriveReadiness({ id: "eng", expected_node_count: 2, received_node_count: 2 } as any, facts, findings);
  assert.equal(readiness.acceptance_status, "remediation_required");
  assert.equal(readiness.simulated_demo_warning, "DEMONSTRATION ONLY — NOT VALID FOR CUSTOMER ACCEPTANCE");
  assert.equal(readiness.nodes.length, 2);
  assert.equal(readiness.nodes[0].breakdown.benchmarks.status, "not_evaluated");
});

test("intelligence APIs evaluate accepted evidence, update derived fields, scope provenance, and reject unauthenticated access", async () => {
  await withServer(async (baseUrl, storePath) => {
    await jsonRequest(baseUrl, "POST", "/api/v1/engagement-fixtures/nvis-interview-demo");
    await uploadNode(baseUrl, "node_demo_node01", demoBundle("node01", { driver: "580.124.01", cuda: "12.9" }));
    await uploadNode(baseUrl, "node_demo_node02", demoBundle("node02", { driver: "575.99.01", cuda: "12.9" }));
    const comparison = await jsonRequest(baseUrl, "GET", "/api/v1/engagements/eng_demo_nvis_h100_two_node/comparison");
    assert.equal(comparison.response.status, 200);
    assert.equal(comparison.payload.comparison.rows.length, 2);
    assert.equal(comparison.payload.comparison.rows.some((row: any) => row.fields.driver_version.matches_consensus === false), true);
    const findings = await jsonRequest(baseUrl, "GET", "/api/v1/engagements/eng_demo_nvis_h100_two_node/findings");
    assert.equal(findings.response.status, 200);
    assert.equal(findings.payload.findings.some((finding: any) => finding.rule_id === "driver-version-mismatch" && finding.evidence_references.length > 0), true);
    const readiness = await jsonRequest(baseUrl, "GET", "/api/v1/engagements/eng_demo_nvis_h100_two_node/readiness");
    assert.equal(readiness.response.status, 200);
    assert.equal(readiness.payload.readiness.acceptance_status, "remediation_required");
    const store = JSON.parse(fs.readFileSync(storePath, "utf8"));
    assert.equal(store.engagements[0].received_node_count, 2);
    assert.equal(store.engagements[0].ready_node_count, 1);
    assert.equal(store.engagements[0].remediation_node_count, 1);
    assert.equal(store.engagements[0].acceptance_status, "remediation_required");
    const evidenceId = store.evidence_records[0].id;
    const provenance = await jsonRequest(baseUrl, "GET", `/api/v1/engagements/eng_demo_nvis_h100_two_node/evidence/${evidenceId}/provenance`);
    assert.equal(provenance.response.status, 200);
    assert.equal(provenance.payload.provenance.some((item: any) => item.source_file === "gpu/nvidia-smi.txt"), true);
    assert.equal(JSON.stringify(provenance.payload).includes("storage_key"), false);
    const cross = await jsonRequest(baseUrl, "GET", `/api/v1/engagements/eng_other/evidence/${evidenceId}/provenance`);
    assert.equal(cross.response.status, 404);
    const unauth = await jsonRequest(baseUrl, "GET", "/api/v1/engagements/eng_demo_nvis_h100_two_node/comparison", undefined, false);
    assert.equal(unauth.response.status, 401);
    const overwrite = await jsonRequest(baseUrl, "PATCH", "/api/v1/engagements/eng_demo_nvis_h100_two_node", { readiness_score: 100 });
    assert.equal(overwrite.response.status, 400);
  });
});
