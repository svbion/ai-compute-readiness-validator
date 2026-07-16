# Demonstration Scenarios 🎭

Since high-performance NVIDIA compute clusters and InfiniBand switches are not accessible in standard sandboxed development environments, the **AI Compute Readiness Validator** features a robust demonstration mode.

The demo builds realistic multi-node structures that perfectly test the CLI layout, the scoring weights, the html templates, and the remediation action plans.

---

## 🟢 Scenario 1: `healthy`

The `healthy` scenario represents a fully prepared, enterprise-ready cluster named `nvis-interview-demo` containing 4 active DGX nodes (`dgx01`, `dgx02`, `dgx03`, `dgx04`).

### Expected Profile Outcomes:
*   **Overall Score**: $100.0\%$
*   **Classification**: `Ready`
*   **Failed Checks**: $0$
*   **Action Items**: Zero remediation items.
*   **Status Indicators**: All nodes show green `PASS` states.

---

## 🟡 Scenario 2: `degraded`

The `degraded` scenario tests the diagnostic engine's capability to isolate cascading physical and logical faults across a 4-node topology.

### Expected Profile Outcomes:
*   **Overall Score**: $97.0\%$
*   **Classification**: `Remediation required` (Forced by Critical Overrides)
*   **Action Items / Recommendations**: $4$ active items.

### Isolated Fault Injectors:

| Node Name | Subsystem | Injected Fault | Expected Recommendation |
| :--- | :--- | :--- | :--- |
| **dgx03** | `network` | InfiniBand Port 1 speed degraded (2x width instead of 4x width, 200Gb/s negotiated). | `The InfiniBand port is operating below the expected link rate. Verify cable health, switch port configuration, firmware compatibility, negotiated link width, and port speed.` |
| **dgx04** | `gpu` (CRITICAL) | GPU 5 reported 12 uncorrectable Double-Bit SRAM hardware ECC errors. | `Drain the node from production scheduling, preserve NVIDIA and kernel diagnostic evidence, run DCGM diagnostics, confirm whether the ECC condition is repeatable, and escalate for hardware support if the error persists.` |
| **dgx04** | `slurm` (CRITICAL) | Scheduler node state reported as `DRAINED` due to GPU 5 hardware fault. | `Inspect slurmd log files for registration errors. Resume the node into scheduling: 'scontrol update nodename=dgx04 state=resume reason=restored'.` |
| **dgx04** | `kubernetes` | NVIDIA Device Plugin pod is in CrashLoopBackOff (3/4 pods available). | `Inspect GPU Operator resource pod logs: 'kubectl logs -n gpu-operator-resources -l app=nvidia-device-plugin-daemonset'.` |

### Triggering Demo Mode via CLI
```bash
# Generate the healthy cluster files
ai-validator demo --scenario healthy --output-dir sample-data/

# Generate the degraded cluster files
ai-validator demo --scenario degraded --output-dir sample-data/
```
These command executions will compile reports directly into your working directory!
