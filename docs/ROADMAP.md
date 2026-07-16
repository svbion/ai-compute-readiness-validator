# Engineering Roadmap 🗺️

This document outlines the next logical iteration phases for expanding the **AI Compute Readiness Validator** into a full-scale cluster management product.

---

## 📅 Phase 1: Cluster-Wide Agentless Remote Scans (SSH)

Currently, live execution runs locally (`validate` queries localhost). The next phase introduces agentless multi-node orchestration:
*   **Asynchronous SSH Execution**: Utilize Python's `paramiko` or native SSH multiplexers to execute non-interactive commands in parallel across a list of target host IPs.
*   **Encrypted Key Management**: Secure password-less SSH key authentication integrating local hardware keys or HashiCorp Vault.
*   **Inventory Auto-Discovery**: Query Slurm (`sinfo`) or Kubernetes (`kubectl get nodes`) dynamically from a master bastion node, auto-populating the target inventory IPs.

---

## 📈 Phase 2: Active Benchmark Triggers

Ingesting historical log files is useful, but the ultimate validator initiates live stress tests under load:
*   **NCCL AllReduce Execution**: Remotely trigger an MPI-backed NCCL AllReduce test using GPUDirect RDMA to verify inter-node interconnect fabric performance under peak pressure.
*   **Active I/O Storage Test (fio)**: Trigger direct block storage evaluations on NVMe mounts and Lustre file systems to chart read/write degradation curves.
*   **GPUDirect Storage (GDS)**: Specifically validate the bypassing of host CPU memory space during storage-to-GPU memory transfers.

---

## 📊 Phase 3: Prometheus & Grafana Integrations

Integrate continuous validation checks into standard enterprise monitoring dashboards:
*   **Prometheus Metric Exporter**: Expose overall score and category statuses as standard Prometheus gauge metrics at `/metrics`.
*   **Grafana Dashboard Templates**: Pre-packaged visualization configurations showing readiness scores over time, node health grids, and active remediation action alerts.
*   **Alertmanager Integrations**: Route critical hardware failures (e.g., SRAM double-bit ECC errors) instantly to Slack, PagerDuty, or Webhook endpoints.
