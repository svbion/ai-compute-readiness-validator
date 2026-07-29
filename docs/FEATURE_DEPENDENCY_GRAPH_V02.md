# GPUValidator Feature Dependency Graph V02

```mermaid
flowchart TD
  DataModel[Platform data model] --> RBAC[Org/RBAC]
  DataModel --> Audit[Audit events]
  DataModel --> Inventory[Inventory]
  RBAC --> API[API authorization]
  Inventory --> Validation[Validation runs]
  Inventory --> Topology[Topology graph]
  Validation --> Reports[Reports]
  Validation --> Alerts[Alerts]
  BenchPkg[Benchmark package ingestion] --> BenchHistory[Benchmark history]
  BenchHistory --> Compare[Compatibility comparison]
  Compare --> Regression[Regression findings]
  Regression --> Alerts
  Regression --> Copilot[Evidence-grounded Copilot]
  Validation --> Copilot
  Topology --> Copilot
  Copilot --> Remediation[Remediation plans]
  Remediation --> Approval[Approval requests]
  Approval --> Audit
  BenchPkg --> Academy[Academy guided labs]
```

Critical path: data model -> RBAC/audit -> inventory/benchmark persistence -> validation/comparison/regression -> UI/Copilot/reports/remediation/Academy.


Status legend: IMPLEMENTED = present in this worktree; PARTIAL = scaffolded or fixture/demo mode; PLANNED = designed but not live; BLOCKED = requires hardware, credentials, or approval.

Public/private evidence boundary: GPU Benchmark Lab remains the public benchmark source. GPUValidator stores compact fixtures, references, checksums, citations, and generated operational records. Private raw artifacts, secrets, GPU UUIDs, internal IPs, and hostnames must be redacted or kept out of product-facing responses.
