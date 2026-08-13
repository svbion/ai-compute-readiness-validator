# AI Factory V1 Design Specification

Version: 1.0
Status: Approved Design Specification Recreated
Scope: Documentation-only future UI specification

## 1. Purpose

AI Factory V1 defines the flagship spatial infrastructure experience for GPUValidator.

The experience turns AI infrastructure operations into an evidence-grounded investigation workspace where an engineer can move from an operational symptom to the affected physical or logical scope, inspect relevant topology, validate the finding against benchmark and command evidence, and understand the recommended next step.

The defining AI Factory interaction is investigation through spatial infrastructure:

Alert
→ Site
→ Rack
→ Node
→ GPU / NIC / Fabric
→ failed validation or benchmark
→ logs/evidence
→ recommendation

AI Factory V1 is not a decorative 3D scene, a generic dashboard, or a fabricated digital twin. It is a disciplined Mission Control workspace for understanding infrastructure state, risk, evidence, and actionability across:

Organization
→ Site
→ Room
→ Row
→ Rack
→ Node
→ GPU
→ NVSwitch
→ NIC
→ InfiniBand
→ Storage
→ Benchmark
→ Evidence

The specification describes the future product experience. It does not add routes, APIs, backend behavior, frontend implementation, tests, or package changes.

## 2. Design Principles

1. Evidence is always close to the conclusion.
   Every health state, topology claim, benchmark result, and recommendation must be traceable to evidence or explicitly labeled as unavailable, unknown, partial, planned, fixture, demo, reference, historical, synthetic, or live.

2. Spatial context explains operational scope.
   Engineers should understand where a finding lives: organization, site, room, row, rack, node, device, fabric, benchmark, and evidence.

3. Technical accuracy is more important than visual novelty.
   AI Factory must clearly distinguish NVLink, NVSwitch, PCIe, NIC, InfiniBand, Ethernet, storage, NCCL, Slurm, and Kubernetes. It must not imply exact physical topology without supporting evidence.

4. Internal node fabric and external cluster fabric remain separate.
   GPU-to-GPU relationships, NVLink, NVSwitch, PCIe, CPU/NUMA locality, NICs, InfiniBand, Ethernet, and storage paths must be visually and semantically distinct.

5. Unknown states are first-class states.
   Missing discovery data, incomplete benchmark packages, unsupported hardware, filtered views, blocked evidence, and stale telemetry must be clearly represented rather than hidden.

6. Investigation is the primary workflow.
   Navigation, overlays, timelines, evidence drawers, and recommendations should support the movement from alert to affected infrastructure to cause hypothesis to evidence-backed recommendation.

7. Automation preserves human control.
   Recommendations may be shown, but remediation remains distinct from execution. Infrastructure-changing actions require explicit approval and must describe risk, affected scope, reversibility, and audit implications.

8. Accessibility is operational reliability.
   Keyboard navigation, visible focus, screen-reader labels, high contrast, reduced motion, and non-color state signals are required for the workspace to be complete.

## 3. Primary Workspace Layout

AI Factory V1 uses a four-region Mission Control layout.

### 3.1 Global Context Bar

The top bar identifies the current operational scope and trust context:

- Organization
- Site
- Room
- Row
- Rack
- selected Node or device
- selected time range
- data classification label
- collection freshness
- active filters
- investigation status

The context bar must make it impossible to confuse demo, fixture, synthetic, reference, historical, or live data.

### 3.2 Spatial Infrastructure Canvas

The central workspace is a spatial infrastructure canvas. It shows the selected scope as nested infrastructure:

- organization map or portfolio summary
- site card or site floor selection
- room plane
- row group
- rack elevation or rack tile
- node slot
- internal node topology when a node is selected
- device and fabric relationships when evidence supports them

The canvas may be rendered as 2D, pseudo-3D, or layered panels, but labels and technical relationships must remain readable. Visual depth must not imply physical certainty unless the source data supports it.

### 3.3 Investigation Rail

The right rail contains the active investigation:

- alert summary
- affected scope
- observation
- inference, if available
- confidence
- validation or benchmark status
- related evidence
- recommended next step
- approval requirement, if any
- unresolved unknowns

The rail should support step-by-step traversal from alert to evidence without requiring the engineer to leave the spatial canvas.

### 3.4 Evidence and Timeline Drawer

The bottom drawer provides timeline and evidence review:

- command evidence
- parsed values
- raw excerpts
- checksums
- benchmark package provenance
- timestamps
- citations
- report artifacts
- observation / inference / recommendation / approval / action classification

The drawer can be collapsed, expanded, or pinned. Evidence must remain one click away from major conclusions.

## 4. Navigation Model

Navigation follows the infrastructure hierarchy while preserving investigation context.

### 4.1 Hierarchical Drill Path

The canonical drill path is:

Organization → Site → Room → Row → Rack → Node → Device / Fabric → Benchmark → Evidence

At every level, the UI should show:

- current scope
- parent scope
- child scopes
- health or risk summary
- active alerts
- evidence availability
- data classification
- freshness

### 4.2 Breadcrumbs

Breadcrumbs must be persistent and keyboard accessible. Breadcrumb labels should include state when useful, for example:

Organization: Acme AI Ops / Site: SJC-01 / Room: Hall A / Row: R4 / Rack: R4-12 / Node: node-048 / GPU: GPU 5

Breadcrumbs should not expose sensitive internal identifiers unless the source data is permitted for display.

### 4.3 Scope-Preserving Links

Alerts, benchmarks, evidence records, and recommendations should deep-link into the spatial scope that they affect. Following an alert should select the relevant site, rack, node, device, fabric path, benchmark, and evidence where available.

### 4.4 Cross-Scope Comparison

Future views may compare scopes, such as rack-to-rack, node-to-node, GPU-to-GPU, benchmark run-to-run, or historical-to-current. Comparisons must label baseline source, time range, and classification.

## 5. Interaction Model

### 5.1 Selection

Selecting an infrastructure object updates the context bar, investigation rail, overlays, and evidence drawer. Selection targets include:

- organization
- site
- room
- row
- rack
- node
- GPU
- NVSwitch
- NIC
- InfiniBand port or fabric object when known
- Ethernet interface or network object when known
- storage volume, mount, namespace, or filesystem when known
- benchmark run
- evidence record

### 5.2 Hover and Focus

Hover may preview labels and state, but all hover content must also be available through keyboard focus or click. Hover-only evidence, status, or recommendations are prohibited.

### 5.3 Filtering

Filters may include severity, subsystem, scheduler, benchmark type, data classification, evidence availability, freshness, and affected scope. Active filters must remain visible and removable.

### 5.4 Trace Actions

Trace actions show paths or relationships using evidence-backed overlays:

- alert to affected rack
- rack to affected node
- node to GPU, NIC, storage, or fabric
- GPU to NVLink / NVSwitch relationship when known
- GPU to PCIe root / CPU / NUMA relationship when known
- NIC to InfiniBand or Ethernet fabric when known
- benchmark to affected devices or fabric
- evidence to parsed conclusion

Trace actions must label whether the trace is physical, logical, inferred, reference, historical, or unknown.

### 5.5 Evidence Drawer Open

Every major conclusion must include an evidence affordance. Opening evidence should show source type, command or package origin, timestamp, classification, parsed values, raw excerpt, checksum where available, and sanitization status.

## 6. Visual Model

AI Factory V1 uses GPUValidator's canonical visual language:

- black and graphite surfaces
- restrained green accent
- red, amber/yellow, blue, purple, and gray only with semantic meaning
- monospaced labels for IDs, commands, telemetry, paths, and values
- strong headings
- subtle borders
- controlled glow
- rounded enterprise panels
- dense but readable layouts

### 6.1 Semantic Color Use

- Green: healthy, pass, available, validated.
- Amber/yellow: warning, validation running, benchmark activity.
- Red: failure, degraded, critical risk.
- Blue: discovery, inventory, informational network activity.
- Purple: NCCL collective, AI-assisted inference, or correlated analysis when explicitly labeled.
- Gray: neutral, unavailable, inactive, unknown.

Color must never be the only signal. Pair color with text, iconography, shape, pattern, accessible label, or state description.

### 6.2 Spatial Encoding

Spatial encoding should communicate hierarchy and affected scope, not decorative realism. Rack and node placement may be logical if exact physical placement is unavailable. Logical layouts must be labeled as logical.

### 6.3 Density

The workspace may be dense because the audience is technical, but it must preserve readable labels, keyboard focus, and clear hierarchy. Critical status cannot be hidden behind tiny badges or decorative effects.

## 7. Node Model

A node is the primary unit of detailed investigation. Node detail should show only relationships supported by discovery, benchmark, scheduler, or evidence records.

### 7.1 Node Identity

A node may include:

- node name or sanitized identifier
- site / room / row / rack / slot
- role or pool
- scheduler state from Slurm, Kubernetes, or other supported scheduler data
- collection freshness
- data classification
- evidence links

Scheduler state must distinguish Slurm and Kubernetes. Slurm node state, partitions, reservations, and job context must not be merged with Kubernetes node, pod, taint, label, or resource state.

### 7.2 Node Health Summary

Node health should summarize:

- GPU health
- ECC / XID / thermal / power indicators when available
- PCIe status when available
- NIC health when available
- InfiniBand or Ethernet status when available
- storage health or mount status when available
- benchmark status
- scheduler availability
- evidence freshness

A node can be partially known. Missing subsystem evidence must be labeled, not treated as passing.

### 7.3 Internal Node Topology

Internal node topology may show:

- CPUs and NUMA domains when known
- PCIe root complexes, switches, and links when known
- GPUs
- NVLink relationships between GPUs when known
- NVSwitch devices when known
- NICs and their PCIe locality when known
- storage devices and controllers when known

Rules:

- Do not place InfiniBand between GPUs.
- Do not represent NVSwitch as an external cluster switch.
- Do not show direct GPU-to-external-network links unless the specific architecture and adapter relationship is explicitly evidenced and explained.
- Do not imply exact PCIe, NUMA, NVLink, or NVSwitch topology without source data.
- Label reference, logical, inferred, and unknown topology distinctly.

## 8. GPU Model

GPU objects are first-class investigation targets.

### 8.1 GPU Identity

A GPU may include:

- index
- UUID or sanitized identifier
- model
- memory size
- driver-visible state
- MIG state when available
- PCI bus identifier when available
- NUMA or CPU affinity when available
- health state
- benchmark participation
- evidence links

### 8.2 GPU Health

GPU health may include:

- ECC counters and error class
- XID events
- temperature and thermal throttling
- power draw and power limit
- clocks and throttling reasons
- memory utilization
- retired pages when available
- DCGM diagnostic results when available
- validation result and timestamp

Absence of a metric means unknown or unavailable, not healthy.

### 8.3 GPU Connectivity

GPU connectivity must distinguish:

- NVLink: high-speed GPU interconnect links, usually within a node or system architecture.
- NVSwitch: switching fabric that connects GPUs in supported systems; not an external cluster switch.
- PCIe: host/device bus topology and locality.
- NIC relationship: PCIe locality or GPUDirect RDMA relevance when evidenced.
- InfiniBand: external cluster fabric through NIC/HCA devices.
- Ethernet: external or management/data network through NIC devices.
- storage relationship: local NVMe, filesystem, object store, or storage fabric when evidenced.

The UI must not collapse these into a generic "network" line.

## 9. Topology Model

Topology is presented as evidence-backed relationships. AI Factory V1 supports multiple topology layers rather than one universal diagram.

### 9.1 Topology Layers

Required layers:

- Physical or inventory hierarchy: organization, site, room, row, rack, node.
- Internal node topology: CPU, NUMA, PCIe, GPU, NVLink, NVSwitch, NIC, storage devices.
- External cluster fabric: InfiniBand, Ethernet, storage fabric, management network when known.
- Scheduler topology: Slurm partitions, reservations, node states, Kubernetes nodes, pods, labels, taints, namespaces, and resource views when available.
- Benchmark topology: NCCL, HPL, fio, OSU MPI, or other benchmark scope mapped to nodes, GPUs, NICs, storage, or fabric where supported by evidence.
- Evidence topology: source artifacts, commands, logs, parsed values, checksums, citations, and reports.

### 9.2 Relationship Types

Relationships must be typed:

- contains
- located in
- installed in
- attached via PCIe
- connected via NVLink
- connected via NVSwitch fabric
- attached to NIC
- participates in InfiniBand fabric
- participates in Ethernet network
- mounted from or attached to storage
- scheduled by Slurm
- scheduled or orchestrated by Kubernetes
- measured by benchmark
- supported by evidence
- inferred from evidence
- unknown

### 9.3 Topology Evidence Requirements

Topology views must show the confidence and source of each relationship where practical. Exact physical cabling, rack placement, fabric membership, link width, link speed, and benchmark interpretation require evidence.

When source data is insufficient, the UI should prefer labels such as:

- Logical layout
- Reference topology
- Inferred from inventory
- Historical evidence
- Partial discovery
- Unknown link
- Evidence unavailable

## 10. Overlays

Overlays are temporary views layered onto the spatial canvas. They must be purposeful, labeled, and evidence-aware.

### 10.1 Health Overlay

Shows pass, warning, fail, unknown, unavailable, partial, blocked, and stale states across selected infrastructure. It must include severity, affected scope, reason, and evidence link.

### 10.2 Benchmark Overlay

Shows benchmark status and measured scope. It may include NCCL, HPL, fio, OSU MPI, or other validated benchmark sources. It must display units, time range, baseline if used, and classification.

NCCL overlays must not be treated as generic network traffic. NCCL collective performance depends on GPU, NVLink/NVSwitch where applicable, PCIe locality, NICs, InfiniBand or Ethernet fabric, software stack, process placement, and benchmark configuration.

### 10.3 Fabric Overlay

Shows external fabric relationships such as InfiniBand, Ethernet, or storage network when known. InfiniBand must be shown through NIC/HCA relationships and external fabric membership, not as GPU-to-GPU lines.

### 10.4 PCIe / Locality Overlay

Shows PCIe and CPU/NUMA locality when known. It should support investigation of GPU-to-NIC locality, storage controllers, PCIe link width/speed issues, and topology-sensitive benchmarks.

### 10.5 Scheduler Overlay

Shows Slurm and Kubernetes state distinctly.

Slurm overlay may include node state, partitions, reservations, jobs, and drain reasons when available.

Kubernetes overlay may include node readiness, pods, taints, labels, allocatable resources, and namespaces when available.

The UI must not merge Slurm job state with Kubernetes pod state.

### 10.6 Evidence Overlay

Shows where evidence exists, where evidence is missing, where data is stale, and where sensitive values were sanitized. Evidence availability is not the same as health.

## 11. Timeline Design

The AI Factory timeline explains what changed, when it changed, what evidence was captured, and what conclusion or recommendation followed.

### 11.1 Timeline Item Types

Timeline items must be classified as:

- observation
- inference
- validation
- benchmark
- evidence captured
- recommendation
- approval requested
- approval granted or denied
- action executed
- state changed
- report generated

### 11.2 Timeline Content

Each item should include:

- timestamp or time range
- source
- affected scope
- data classification
- confidence, if applicable
- evidence link
- actor or system source when available
- before / after values when available
- unknowns or caveats

### 11.3 Time Travel

Future timeline controls may let engineers inspect historical state. Historical views must clearly label that they are not current live state and must show the selected time range.

## 12. Investigation Flow

The canonical investigation flow is:

1. Alert appears in Mission Control.
2. Engineer opens the alert in AI Factory.
3. AI Factory selects the affected Site.
4. The spatial canvas highlights affected Rack or inferred rack scope.
5. Engineer drills into the Node.
6. Node model highlights affected GPU, NIC, storage, scheduler state, or fabric relationship.
7. Relevant overlay is enabled: health, benchmark, fabric, PCIe/locality, scheduler, or evidence.
8. Failed validation or benchmark is selected.
9. Evidence drawer opens with command output, logs, parsed values, benchmark package records, checksums, citations, and provenance.
10. Investigation rail distinguishes observation, inference, confidence, recommendation, and approval requirement.
11. Engineer reviews recommendation and risk.
12. Any remediation remains approval-gated and outside the spatial inspection itself.

Example:

- Alert: NCCL all-reduce regression on rack R4-12.
- Site: SJC-01 selected.
- Rack: R4-12 highlighted as affected scope.
- Node: node-048 selected.
- Device: GPU 5 and mlx5_1 NIC locality inspected.
- Fabric: InfiniBand port speed evidence reviewed.
- Benchmark: NCCL run compared to historical baseline.
- Evidence: sanitized command output and benchmark package opened.
- Recommendation: verify cable health, switch port configuration, firmware compatibility, negotiated link width, and process placement before approving operational change.

This example is illustrative. Exact topology, identifiers, and root cause must come from evidence in a real investigation.

## 13. Motion Model

Motion exists only to explain state, flow, focus, or progress.

Approved motion:

- topology discovery progression
- validation progression
- NVLink or network path tracing when evidence-backed
- NCCL collective flow when explicitly labeled
- benchmark progress
- health transitions
- node heartbeat
- live telemetry updates when live data exists
- focus and hover feedback

Prohibited motion:

- random particles
- decorative floating dots
- unexplained glowing paths
- fake traffic
- fake topology
- constant motion with no informational value
- motion that obscures labels
- motion that ignores reduced-motion preference

Reduced-motion mode must provide static equivalents for all animated state.

## 14. Accessibility Requirements

AI Factory V1 must support:

- keyboard navigation across breadcrumbs, canvas objects, overlays, rail items, drawer tabs, and evidence records
- visible focus states
- semantic headings and landmarks
- screen-reader names for infrastructure objects and health states
- high contrast across graphite surfaces
- non-color indicators for all states
- readable labels and minimum text sizing
- reduced motion
- accessible table alternatives for dense topology and benchmark views
- text summaries for charts and diagrams
- focus-preserving drawer and modal behavior
- no critical information available only on hover

Canvas objects should expose accessible names such as:

"Rack R4-12, warning, 2 nodes affected, benchmark evidence available, logical placement."

## 15. Data Classification and Trust Labels

Every major data surface must show trust labels.

Required classifications:

- Demo: demonstration data created for product scenarios.
- Fixture: deterministic local test or sample data.
- Synthetic: generated data not collected from real infrastructure.
- Reference: vendor, architecture, or product reference information, not current environment evidence.
- Historical: previously collected environment data for a stated time range.
- Live: current or near-current collected environment data with freshness timestamp.
- Partial: incomplete data where some required evidence is missing.
- Unknown: state cannot be determined from available evidence.
- Blocked: collection or validation was prevented by permissions, policy, access, or unsupported environment.

Trust labels must appear in KPI cards, topology panels, benchmark summaries, evidence drawers, timelines, and recommendations. Live state must never be implied when unavailable.

## 16. Empty, Unknown, and Partial States

AI Factory V1 must distinguish empty, unknown, partial, unavailable, unsupported, blocked, stale, and filtered states.

### 16.1 Empty

No objects match the current scope or filter. The UI should explain the active scope and filters and provide a safe reset path.

### 16.2 Unknown

The object exists, but the state cannot be determined from available evidence. Unknown is not pass.

### 16.3 Partial

Some evidence exists, but one or more required sources are missing. Partial conclusions must show what is known and what is missing.

### 16.4 Unavailable

The source is expected but not currently available. The UI should identify whether this is due to collector status, ingestion status, stale data, unsupported feature, or access limitation.

### 16.5 Blocked

Collection or validation was prevented by permissions, policy, access, command restriction, expired session, or safety boundary. Blocked states must not recommend bypassing controls.

### 16.6 Stale

Data exists but is older than the selected freshness threshold. Stale data may support historical review but must not be presented as current live state.

### 16.7 Filtered

Data exists but is hidden by active filters. The UI should show filter count and provide a clear reset path.

## 17. Future Implementation Epics

These epics describe future implementation areas. They are not implemented by this specification.

1. Spatial hierarchy data contract
   Define a source-grounded model for organization, site, room, row, rack, node, device, fabric, benchmark, and evidence relationships.

2. AI Factory shell
   Create the context bar, spatial canvas, investigation rail, and evidence/timeline drawer using existing product visual standards.

3. Spatial navigation and breadcrumbs
   Implement scope selection, drilldown, deep links, and keyboard navigation.

4. Node detail and internal topology
   Implement node-focused views for GPU, CPU/NUMA, PCIe, NVLink, NVSwitch, NIC, storage, scheduler, benchmark, and evidence relationships.

5. GPU detail and health model
   Implement GPU identity, health, connectivity, benchmark participation, and evidence review.

6. Topology overlays
   Implement health, benchmark, fabric, PCIe/locality, scheduler, and evidence overlays with explicit trust labels.

7. Timeline and evidence integration
   Connect investigation timeline items to evidence records, parsed values, raw excerpts, checksums, citations, and reports.

8. Investigation workflow
   Implement alert-to-recommendation traversal across spatial infrastructure and evidence.

9. Accessibility and reduced-motion certification
   Validate keyboard, focus, screen-reader, high contrast, non-color status, reduced motion, and chart/diagram alternatives.

10. Trust labeling and unknown-state framework
    Ensure demo, fixture, synthetic, reference, historical, live, partial, unknown, blocked, unavailable, stale, and filtered states are visible and consistent.

## 18. Recommended Implementation Order

1. Documentation acceptance of AI Factory V1 design specification.
2. Data inventory audit for existing organization, site, room, row, rack, node, device, benchmark, and evidence fields.
3. Non-mutating UI contract draft for spatial hierarchy, topology relationships, trust labels, and evidence references.
4. Static AI Factory shell using fixture or reference data with explicit labels.
5. Breadcrumb and scope navigation.
6. Evidence drawer and timeline foundation.
7. Node model panel.
8. GPU model panel.
9. Topology layer rendering with strict relationship typing.
10. Health and evidence overlays.
11. Benchmark and fabric overlays.
12. Scheduler overlays with distinct Slurm and Kubernetes semantics.
13. Investigation rail and alert deep linking.
14. Accessibility pass and reduced-motion pass.
15. Technical accuracy review with infrastructure SMEs.
16. Live or historical data integration only after source provenance and freshness are available.

## 19. Acceptance Checklist for Future UI Stories

Future AI Factory UI stories must pass this checklist:

- Does the story preserve the approved hierarchy: Organization → Site → Room → Row → Rack → Node → GPU → NVSwitch → NIC → InfiniBand → Storage → Benchmark → Evidence?
- Does the experience support the canonical investigation flow from alert to site, rack, node, GPU/NIC/fabric, failed validation or benchmark, logs/evidence, and recommendation?
- Are NVLink, NVSwitch, PCIe, NIC, InfiniBand, Ethernet, storage, NCCL, Slurm, and Kubernetes technically distinct?
- Does the UI avoid placing InfiniBand between GPUs?
- Does the UI avoid representing NVSwitch as an external cluster switch?
- Does the UI avoid implying exact physical topology, cabling, rack placement, PCIe locality, NVLink relationships, or fabric membership without evidence?
- Are logical, reference, inferred, historical, partial, unknown, and live views labeled?
- Is evidence one click away from every major conclusion?
- Are health, benchmark, fabric, PCIe/locality, scheduler, and evidence overlays labeled and purposeful?
- Do timeline items distinguish observation, inference, validation, benchmark, evidence, recommendation, approval, action, and state change?
- Are demo, fixture, synthetic, reference, historical, live, partial, unknown, unavailable, blocked, stale, and filtered states explicit?
- Are recommendations separate from remediation execution?
- Are infrastructure-changing actions approval-gated with visible risk and affected scope?
- Does motion explain state or flow rather than decorate the screen?
- Does the experience support keyboard navigation, visible focus, screen-reader labels, high contrast, non-color status signals, reduced motion, and text alternatives?
- Does the story avoid fake traffic, fake topology, fabricated telemetry, unsupported live-state implications, and vendor-affiliation implications?
- Does the diff stay within the approved story scope?

## 20. Explicit Out of Scope

The following are explicitly out of scope for this documentation-only specification:

- application code
- frontend modifications
- backend modifications
- tests
- routes
- APIs
- package changes
- database migrations
- generated benchmark data
- collector changes
- agent behavior changes
- live infrastructure integration
- remediation execution
- new dependencies
- commits
- pushes

This specification also does not claim that AI Factory V1 is implemented. It defines the approved future design target for the flagship spatial infrastructure investigation experience.
