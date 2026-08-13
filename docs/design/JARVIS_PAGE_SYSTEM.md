# JARVIS Page System

Version: 1.0
Status: Approved design-specification target
Scope: Shared authenticated shell, page layouts, desktop/mobile adaptations, and page-specific centerpiece definitions
Related references:
- docs/design/JARVIS_VISUAL_SYSTEM.md
- docs/design/JARVIS_COMPONENT_SPEC.md
- docs/design/JARVIS_MOTION_VFX_SPEC.md
- docs/design/AI_FACTORY_V1.md
- docs/design/references/GPUVALIDATOR_JARVIS_REFERENCE.png

## 1. Purpose

This document defines how the JARVIS visual system applies across the authenticated GPUValidator product experience.

The shared page system must preserve:
- Mission Control clarity
- AI Factory spatial investigation
- evidence-first reasoning
- technically accurate topology semantics
- readable dense operations UI
- reduced-motion and mobile fallbacks

## 2. Shared authenticated shell

### 2.1 Shell structure
Every authenticated page uses:
- HudShell
- HudTopBar
- HudNavigationRail
- optional page-local header controls inside content region
- main content canvas
- HudBottomRail on large desktop

### 2.2 Top command bar
Left:
- GPUValidator logo
- AI Infrastructure Mission Control

Center:
- current time
- AI FACTORY OPERATIONS EXPERIENCE on Mission Control, or page-specific canonical banner on future pages
- subtle animated waveform or telemetry ruler

Right:
- Environment
- Theme
- System state
- User profile

Geometry:
- height: 72 px
- left identity zone: about 26% of usable width
- center banner zone: about 40% of usable width
- right control zone: about 34% of usable width

Behavior:
- shell remains persistent during route changes
- page body changes beneath it

### 2.3 Left navigation rail
Desktop item order:
1. Mission Control
2. AI Factory
3. Topology
4. Benchmarks
5. Evidence
6. Alerts
7. Investigations
8. Copilot
9. Settings

Behavior:
- icon + label per item
- active page framed in cyan
- hover brightens border and icon
- focus shows visible ring
- alerts or counts may appear as semantic badges

Geometry:
- width: 88 px
- nav item height target: 56-64 px
- vertical gap between items: 10-12 px

### 2.4 Bottom system rail
Always-visible on large desktop displays.

Required modules:
- System Status
- Threat/Risk Level
- Data Freshness
- Agent/Collector State
- Uptime

Geometry:
- height: 82 px
- segmented faceted modules
- central anchor/core object allowed as shell signature

## 3. Shared layout rules

### 3.1 Desktop content grid
- content inset from shell chrome: 16 px
- standard gap: 16 px
- content uses a 12-column logical grid inside the main canvas
- left rail excluded from page grid measurements

Recommended 12-column mapping on desktop:
- left page column group: cols 1-3
- center page column group: cols 4-8
- right page column group: cols 9-12

### 3.2 Page panel heights
Mission Control target row proportions:
- Row A: 37%
- Row B: 25%
- Row C: 29%
- Remaining height used for gutters and overlap anchor treatment

### 3.3 Standard page behaviors
- primary page centerpiece should dominate the upper-middle field
- evidence access should never be more than one click away
- inspector or supporting panels should surround, not replace, the primary visualization
- alert, trust, and freshness labels remain visible within page context

## 4. Mission Control page

This page is the closest match to the supplied reference and serves as the shared shell benchmark.

### 4.1 Mission Control layout
Left upper:
- AI Factory Health

Center upper:
- AI Factory Topology hologram

Right upper:
- Critical Conditions

Left middle:
- Current Activity

Center middle:
- Validation Pipeline

Right middle:
- Prioritized KPIs

Left lower:
- System Telemetry

Center lower:
- Live Fabric Map

Right lower:
- AI Copilot Assistant

### 4.2 Desktop proportions
- AI Factory Health width: 24-26% of content width
- AI Factory Topology width: 40-43% of content width
- Critical Conditions width: 25-27% of content width
- Current Activity width: 20-22% of content width
- Validation Pipeline width: 39-42% of content width
- Prioritized KPIs width: 25-27% of content width
- System Telemetry width: 24-26% of content width
- Live Fabric Map width: 36-39% of content width
- AI Copilot Assistant width: 31-33% of content width

### 4.3 Visual emphasis
- Topology hologram is the visual centerpiece.
- AI Factory Health and Critical Conditions are the key supporting anchors.
- Validation Pipeline and Live Fabric Map carry operational flow through the middle and lower center.

## 5. AI Factory page

### 5.1 Signature experience
A large spatial AI Factory hologram becomes the page centerpiece.

Show hierarchy:
- Site
- Room
- Row
- Rack
- Node

Zoom progression:
- Factory
- Room
- Row
- Rack
- Node
- GPU

### 5.2 Layout model
Desktop recommended arrangement:
- top-left: scope breadcrumb + trust/freshness summary
- center: large hologram canvas, 52-60% of page width
- left inspector stack: health, jobs, validation, benchmark
- right inspector stack: GPU utilization, temperature, ECC, power, NVLink, InfiniBand, storage, risk
- bottom drawer or lower strip: evidence and timeline

### 5.3 Overlays
Required overlay families:
- Health
- Jobs
- GPU utilization
- Temperature
- ECC
- Power
- NVLink
- InfiniBand
- Storage
- Validation
- Benchmark
- Risk

Rules:
- overlay labels always visible
- logical vs physical view must be explicit
- do not imply exact physical geometry without evidence support

## 6. Topology page

### 6.1 Signature experience
Interactive technical topology hologram or graph workspace.

Must accurately distinguish:
- GPU
- NVLink
- NVSwitch
- PCIe
- CPU/NUMA
- NIC
- InfiniBand
- Ethernet
- Storage

### 6.2 Modes
- Logical
- Physical when evidence supports it
- NCCL
- NVLink
- Network
- Storage

### 6.3 Layout model
- center: topology canvas, 58-64% width
- left: object filters, overlay modes, trust labels
- right: inspector, edge detail, evidence links, command snippets
- bottom or lower right: timeline or trace history

### 6.4 Trace behavior
Tracing should visually illuminate actual represented paths.
Paths must state whether they are:
- logical
- physical
- inferred
- historical
- evidence-backed

## 7. Benchmarks page

### 7.1 Signature experience
Performance intelligence hologram and technical analysis surface.

Include:
- NCCL
- HPL
- MLPerf reference
- P2P
- Bandwidth
- Latency
- Regression history

### 7.2 Visual model
Use:
- radial comparison
- performance curves
- baseline overlays
- regression markers
- GPU comparison
- fabric comparison

Rules:
- no decorative charts
- every chart must answer a specific operational question
- baseline/reference sources must be labeled

### 7.3 Layout model
- centerpiece visualization: 45-55% width
- left rail panels: suite selector, scope, trust labels, run metadata
- right panels: key regressions, top metrics, affected scope, recommendations/evidence
- lower region: curves, comparisons, history tables

## 8. Evidence page

### 8.1 Signature experience
Evidence Provenance Graph.

Represent chain:
- Validation
- Evidence
- Source
- Finding
- Recommendation

Include evidence classes:
- logs
- commands
- benchmark artifacts
- topology
- checksums
- timestamps
- classification/trust labels

### 8.2 Layout model
- center: provenance graph
- left: filters and source classes
- right: selected evidence record, parsed values, checksum, citations, recommendation links
- bottom drawer: raw excerpts and command evidence

### 8.3 Rules
- provenance must be more visually important than decorative effects
- trust labels remain visible on nodes and records

## 9. Alerts page

### 9.1 Signature experience
Operational Risk Matrix.

Show:
- severity
- affected scope
- duration
- trend
- evidence
- confidence
- recommended action

### 9.2 Layout model
- center: risk matrix or severity/scope matrix
- left: alert queues and filters
- right: selected alert detail, affected infrastructure, evidence, recommendation
- lower region: trend history and related investigations

### 9.3 Visual rule
Critical conditions receive red edge illumination only where semantically appropriate.

## 10. Investigations page

### 10.1 Signature experience
Root Cause Investigation Graph.

Example traversal:
NCCL regression
-> DGX03
-> NIC 2
-> InfiniBand link
-> 200 Gb/s negotiated
-> expected 400 Gb/s
-> supporting mlxlink evidence
-> recommended remediation

### 10.2 Layout model
- center: root-cause graph
- left: investigation list and scope filters
- right: current investigation narrative, evidence, confidence, recommendation, risk, approval
- bottom: timeline and command evidence

### 10.3 Rules
- this page is one of the product's signature experiences
- graph edges should express causal/investigative sequence, not decorative linkage

## 11. Copilot page

### 11.1 Signature experience
Evidence-first AI reasoning environment.

It is not generic chat.

Question example:
- Why did NCCL bandwidth drop?

Response must visually connect:
- Observation
- Evidence
- Topology
- Benchmark
- Inference
- Confidence
- Recommendation
- Risk
- Approval

### 11.2 Layout model
- left: current question, scoped context, selected systems
- center: structured reasoning chain and linked evidence
- right: supporting topology/benchmark references and restrained holographic AI visualization
- lower region: approval or next-action area when applicable

### 11.3 Visual rule
Use a restrained holographic AI visualization as a secondary element only.

## 12. Settings page

### 12.1 Experience goal
Preserve the JARVIS shell but reduce VFX significantly.

### 12.2 Required sections
- General
- Organization
- Authentication
- Users
- Roles
- Notifications
- Integrations
- Data Retention
- Storage
- API Keys
- Agents
- Licensing
- Billing
- Appearance
- Audit Logs

### 12.3 Layout model
- left: settings section navigation
- center/right: dense readable forms, tables, and audit panels
- VFX reduced to shell framing, subtle borders, and focus states only

## 13. Mobile experience

Do not attempt to reproduce the full desktop HUD.

### 13.1 Mobile model
Mobile becomes a mission feed.

Order:
1. Current Health
2. Critical Conditions
3. Current Activity
4. Selected Infrastructure
5. Primary Action
6. Compact Visualization
7. Evidence

### 13.2 Navigation model
- left navigation becomes bottom navigation or drawer
- bottom system rail becomes compact status drawer

### 13.3 Visualization simplification
- holograms simplify to 2D technical visualizations
- inspector and evidence views become stacked cards/drawers
- glow intensity reduced significantly
- remove decorative shell complexity that harms readability

## 14. Accessibility strategy

All pages must provide:
- semantic headings and landmarks
- keyboard operation
- visible focus
- screen-reader descriptions for diagrams and topology objects
- non-color state indicators
- reduced motion
- high contrast rendering
- static hologram fallback
- no flashing or excessive rapid animation

## 15. Technical accuracy strategy across pages

Visual systems must preserve distinctions among:
- NVLink
- NVSwitch
- PCIe
- NIC
- InfiniBand
- Ethernet
- RDMA
- NCCL
- Slurm
- Kubernetes
- Storage
- GPU health
- Benchmark performance

Rules:
- demo and reference data remain labeled
- do not fabricate live telemetry
- logical, physical, historical, and inferred views must be labeled
- topology or graph drama cannot imply unsupported reality

## 16. Cross-page screenshot-comparison guidance

Future implementation should be measurable against the reference using:
- top bar height: 72 px
- left nav width: 88 px
- bottom rail height: 82 px
- 16 px major grid gaps
- 12 px dense sub-gaps
- 14 px primary chamfer cuts
- panel headers near 34 px
- strong upper-center visualization emphasis
- cyan edge-lighting hierarchy
- selective semantic red/amber/green/purple overlays

## 17. Status

This document defines the shared page system and per-page experience targets for the future JARVIS redesign. It is documentation only and does not implement application code.