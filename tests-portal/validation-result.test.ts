import test from "node:test";
import assert from "node:assert/strict";

import {
  deriveHardwareDiscoveryValidationView,
  type AgentRecord,
  type ValidationDetail,
} from "../src/portal/agents";

const agent: AgentRecord = {
  id: "agt_live",
  schema_version: "1.0.0",
  name: "runpod-4gpu-01",
  hostname: "runpod-node-01",
  status: "online",
  capabilities: [],
  gpu_count: 4,
  agent_version: "0.1.0",
  registered_at: "2026-07-20T14:59:00.000Z",
  last_heartbeat_at: "2026-07-20T15:00:00.000Z",
  last_error: null,
  metadata: {},
};

function result(command_type: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `res_${command_type}`,
    schema_version: "1.0.0",
    job_id: `job_${command_type}`,
    validation_id: "val_live",
    agent_id: "agt_live",
    state: "completed",
    exit_code: 0,
    started_at: "2026-07-20T15:00:00.000Z",
    completed_at: "2026-07-20T15:00:01.000Z",
    duration_ms: 1000,
    structured_result: {},
    stdout: "ok",
    stderr: "",
    output_truncated: false,
    command_evidence: { command_type, argv: ["cmd"], started_at: "2026-07-20T15:00:00.000Z", completed_at: "2026-07-20T15:00:01.000Z", exit_code: 0, stdout_sha256: "sha", stderr_sha256: null, output_truncated: false },
    result_hash: `hash_${command_type}`,
    ...overrides,
  };
}

function detail(overrides: Partial<ValidationDetail["validation"]> = {}, resultOverrides: Record<string, Record<string, unknown>> = {}): ValidationDetail {
  const validation = { id: "val_live", schema_version: "1.0.0", profile: "hardware-discovery" as const, agent_id: "agt_live", state: "completed" as const, created_at: "2026-07-20T15:00:00.000Z", completed_at: "2026-07-20T15:00:06.000Z", error: null, job_ids: ["j1", "j2", "j3", "j4", "j5", "j6"], ...overrides };
  return {
    validation,
    jobs: [],
    results: [
      result("nvidia_smi_list", { structured_result: { gpus: [0, 1, 2, 3].map((index) => ({ index, model: "NVIDIA A100-SXM4-40GB", uuid: `GPU-live-${index}` })) }, stdout: "GPU 0: NVIDIA A100-SXM4-40GB (UUID: GPU-live-0)", ...(resultOverrides.nvidia_smi_list ?? {}) }),
      result("nvidia_smi_inventory", { structured_result: { gpus: [0, 1, 2, 3].map((index) => ({ index, name: "NVIDIA A100-SXM4-40GB", uuid: `GPU-live-${index}`, memory_total: "40536 MiB", driver_version: "535.104.05", pci_bus_id: `00000000:${41 + index}1:00.0` })) }, stdout: "0,NVIDIA A100-SXM4-40GB,GPU-live-0,40536,535.104.05,00000000:41:00.0", ...(resultOverrides.nvidia_smi_inventory ?? {}) }),
      result("nvidia_smi_topology", { structured_result: { topology: [["GPU0", "X", "NV4"]] }, stdout: "GPU0 GPU1\nGPU0 X NV4", ...(resultOverrides.nvidia_smi_topology ?? {}) }),
      result("driver_version", { structured_result: { driver_version: "535.104.05" }, stdout: "535.104.05", ...(resultOverrides.driver_version ?? {}) }),
      result("cuda_version", { state: "unavailable", exit_code: null, structured_result: { available: false }, stdout: "", stderr: "nvcc unavailable", ...(resultOverrides.cuda_version ?? {}) }),
      result("pytorch_gpu_count", { state: "unavailable", exit_code: null, structured_result: { available: false }, stdout: "", stderr: "torch unavailable", ...(resultOverrides.pytorch_gpu_count ?? {}) }),
    ] as ValidationDetail["results"],
  };
}

test("completed hardware-discovery validation view summarizes GPU evidence without failing for unavailable CUDA or PyTorch", () => {
  const view = deriveHardwareDiscoveryValidationView(detail(), [agent]);
  assert.equal(view.validationId, "val_live");
  assert.equal(view.profile, "hardware-discovery");
  assert.equal(view.agentName, "runpod-4gpu-01");
  assert.equal(view.node, "runpod-node-01");
  assert.equal(view.gpuCount, 4);
  assert.equal(view.failedChecks, 0);
  assert.equal(view.unavailableChecks, 2);
  assert.ok(view.warnings >= 2);
  assert.equal(view.commands.length, 6);
  assert.equal(view.commands.find((command) => command.commandType === "nvidia_smi_inventory")?.parsedSummary, "4 GPU inventory rows, 4 UUIDs, 4 PCI bus IDs");
  assert.equal(view.rules.find((rule) => rule.id === "cuda-state-collected")?.status, "unavailable");
  assert.equal(view.rules.find((rule) => rule.id === "pytorch-count-matches")?.status, "unavailable");
});

test("validation rules fail malformed inventory, timed-out topology, and truncated output explicitly", () => {
  const view = deriveHardwareDiscoveryValidationView(detail({}, {
    nvidia_smi_inventory: { structured_result: { gpus: [{ index: 0, name: "NVIDIA A100", uuid: null, pci_bus_id: null }] }, stdout: "malformed", output_truncated: true },
    nvidia_smi_topology: { state: "timed_out", exit_code: null, duration_ms: 20_000, stderr: "timed out", structured_result: {} },
  }), [agent]);
  assert.equal(view.commands.find((command) => command.commandType === "nvidia_smi_inventory")?.truncated, true);
  assert.equal(view.commands.find((command) => command.commandType === "nvidia_smi_topology")?.status, "timed_out");
  assert.equal(view.rules.find((rule) => rule.id === "inventory-count-matches")?.status, "failed");
  assert.equal(view.rules.find((rule) => rule.id === "stable-uuids-collected")?.status, "failed");
  assert.equal(view.rules.find((rule) => rule.id === "topology-collected")?.status, "failed");
  assert.ok(view.failedChecks >= 3);
});

test("validation view preserves failed and partial states", () => {
  const failed = deriveHardwareDiscoveryValidationView(detail({ state: "failed", error: "nvidia-smi failed" }, { nvidia_smi_list: { state: "failed", exit_code: 1, stderr: "nvidia-smi failed" } }), [agent]);
  assert.equal(failed.overallState, "failed");
  assert.ok(failed.failedChecks > 0);

  const partial = deriveHardwareDiscoveryValidationView(detail({ state: "completed" }, { cuda_version: { state: "unavailable" }, pytorch_gpu_count: { state: "unavailable" } }), [agent]);
  assert.equal(partial.partial, true);
});
