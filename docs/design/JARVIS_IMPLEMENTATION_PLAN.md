# JARVIS Implementation Plan

Version: 1.0
Status: Approved implementation planning document
Scope: Sequenced documentation-only plan for future implementation stories
Related references:
- docs/design/JARVIS_VISUAL_SYSTEM.md
- docs/design/JARVIS_COMPONENT_SPEC.md
- docs/design/JARVIS_MOTION_VFX_SPEC.md
- docs/design/JARVIS_PAGE_SYSTEM.md
- docs/design/references/GPUVALIDATOR_JARVIS_REFERENCE.png

## 1. Purpose

This document breaks the JARVIS redesign into independently reviewable future implementation stories. It does not authorize a single giant redesign commit.

Planning rules:
- implement in small reviewable stories
- preserve existing routes unless a later story explicitly changes them
- validate visual changes against the reference incrementally
- keep technical accuracy and evidence-first semantics intact
- do not imply live telemetry when unavailable

## 2. Delivery strategy

Implementation should proceed in four stages:
1. Shell and token foundation
2. Mission Control parity against the reference
3. Shared platformization and page migrations
4. Motion, accessibility, and performance hardening

## 3. Story sequence

### JARVIS-001 Design tokens and background system
Objective:
- Introduce HUD token primitives, semantic colors, shell spacing, background layers, and glow rules.

Scope:
- design tokens only
- background layers only
- no page rewrites yet

Acceptance:
- tokens match JARVIS_VISUAL_SYSTEM
- background system supports grid, radial light, sparse data points, scanlines, vignette
- reduced-motion and high-contrast token hooks defined

Validation:
- token snapshot review
- visual shell smoke review
- lint/build/tests relevant to touched files

### JARVIS-002 HUD panel geometry
Objective:
- Create reusable chamfered HudPanel and panel header primitives.

Scope:
- panel geometry
- border system
- header/footer treatment
- reusable SVG/CSS clipping strategy

Acceptance:
- panels visually match reference corner and border language
- active/warning/critical edge treatments available
- accessible heading relationships retained

### JARVIS-003 Top command bar
Objective:
- Implement shared top command bar.

Scope:
- product identity
- time/badge center banner
- environment/theme/system/user controls

Acceptance:
- 72 px top bar
- faceted plate geometry
- center telemetry waveform subtle and optional
- keyboard-accessible controls

### JARVIS-004 Navigation rail
Objective:
- Implement left navigation rail.

Scope:
- iconography
- labels
- active/hover/focus states
- alert badges

Acceptance:
- 88 px rail
- nine required destinations
- active state matches cyan illuminated style
- keyboard navigation preserved

### JARVIS-005 Bottom system rail
Objective:
- Implement persistent desktop system rail.

Scope:
- segmented status modules
- system status, threat/risk, data freshness, agent/collector state, uptime

Acceptance:
- 82 px rail
- compact readable modules
- semantic status colors and labels

### JARVIS-006 Mission Control layout shell
Objective:
- Build the full 3x3 Mission Control page layout with placeholder content.

Scope:
- spatial arrangement only
- no advanced panel internals yet

Acceptance:
- panel positions and widths align with reference geometry
- topology region visually dominates center upper area
- lower center fabric region and lower right copilot region established

### JARVIS-007 AI Factory Health instrumentation
Objective:
- Implement health instrumentation cluster.

Scope:
- circular health gauge
- summary stats
- trend microchart
- trust/freshness labeling

Acceptance:
- gauge language matches reference
- semantic state handling supports healthy/warning/critical/unknown

### JARVIS-008 AI Factory hologram
Objective:
- Implement the Mission Control topology hologram centerpiece.

Scope:
- projected base
- floating infrastructure objects
- surrounding callouts
- selected/warning object state

Acceptance:
- hologram is the page centerpiece
- logical vs physical labeling available
- selected object highlighting matches amber focus language

### JARVIS-009 Critical Conditions
Objective:
- Implement red-alert panel language.

Scope:
- critical conditions list/cards
- trend sparkline
- severity pills
- evidence affordances

Acceptance:
- red edge illumination confined to alert surfaces
- duration, scope, trend, and evidence summary visible

### JARVIS-010 Activity + KPI modules
Objective:
- Implement Current Activity and Prioritized KPIs modules.

Scope:
- activity feed
- KPI rows with sparklines/bars

Acceptance:
- dense readable operational scanning
- trend visuals are purposeful, not decorative

### JARVIS-011 Validation Pipeline
Objective:
- Implement pipeline stage visualization.

Scope:
- stage nodes
- connectors
- overall progress
- validation status treatment

Acceptance:
- stage progression readable and accessible
- yellow validation semantics retained

### JARVIS-012 System Telemetry
Objective:
- Implement subsystem telemetry module.

Scope:
- telemetry tabs
- major gauge
- secondary metric wells
- trend microcharts

Acceptance:
- tabbed subsystem model works
- values and units readable at dense scale

### JARVIS-013 Fabric Map
Objective:
- Implement live fabric/logical fabric map module.

Scope:
- site/fabric nodes
- link paths
- mode toggle
- throughput and alert summaries

Acceptance:
- paths are typed and labeled
- map supports logical vs physical distinction

### JARVIS-014 Copilot module
Objective:
- Implement the Mission Control AI Copilot panel.

Scope:
- evidence-first answer structure
- supporting secondary holographic AI visual
- investigation CTA

Acceptance:
- not generic chat
- sections clearly distinguish observation, evidence, inference, recommendation, and risk

### JARVIS-015 Responsive/mobile shell
Objective:
- Adapt the shell and Mission Control into the mobile mission feed model.

Scope:
- bottom navigation or drawer
- compact status drawer
- simplified cards and diagrams

Acceptance:
- mobile order follows JARVIS_PAGE_SYSTEM
- no attempt to compress the full desktop HUD unchanged

### JARVIS-016 Motion/VFX integration
Objective:
- Add approved motion layers.

Scope:
- panel/page motion
- hologram init
- topology/path tracing
- validation sweeps
- alert escalation

Acceptance:
- motion follows JARVIS_MOTION_VFX_SPEC
- reduced-motion fallback complete

### JARVIS-017 Accessibility/reduced motion
Objective:
- certify accessibility behaviors.

Scope:
- keyboard flows
- focus visibility
- non-color states
- diagram descriptions
- reduced motion

Acceptance:
- key authenticated flows remain operable without pointer and without motion dependence

### JARVIS-018 Performance optimization
Objective:
- harden the experience for performance.

Scope:
- pause off-screen animation
- limit simultaneous glow/blur
- lazy-load heavy visualizations
- profile costly traces/holograms

Acceptance:
- desktop 60 FPS target reasonably met for ordinary interaction
- mobile reductions implemented

## 4. Page-specific migration stories

After the Mission Control baseline is stable, migrate the remaining product pages.

### JARVIS-AF-001 AI Factory shell migration
- establish page scaffold with large hologram canvas and inspector arrangement

### JARVIS-AF-002 AI Factory zoom progression
- Factory -> Room -> Row -> Rack -> Node -> GPU progression and breadcrumb model

### JARVIS-AF-003 AI Factory overlays
- Health, Jobs, GPU utilization, Temperature, ECC, Power, NVLink, InfiniBand, Storage, Validation, Benchmark, Risk

### JARVIS-TP-001 Topology page shell migration
- establish typed topology workspace

### JARVIS-TP-002 Topology overlay modes
- Logical, Physical, NCCL, NVLink, Network, Storage

### JARVIS-TP-003 Topology trace interactions
- evidence-backed path illumination and inspector linking

### JARVIS-BM-001 Benchmarks page shell migration
- establish performance intelligence layout

### JARVIS-BM-002 Benchmark comparative visualizations
- radial comparison, curves, baseline overlays, regression markers, GPU/fabric comparison

### JARVIS-EV-001 Evidence page shell migration
- establish provenance graph layout and evidence detail regions

### JARVIS-EV-002 Evidence provenance interactions
- Validation -> Evidence -> Source -> Finding -> Recommendation linkage behaviors

### JARVIS-AL-001 Alerts page shell migration
- establish operational risk matrix and alert queue layout

### JARVIS-AL-002 Alert investigation linking
- connect alert records to affected scope, evidence, and recommendations

### JARVIS-IN-001 Investigations page shell migration
- establish root-cause graph layout and supporting panels

### JARVIS-IN-002 Investigation traversal behaviors
- symptom -> scope -> evidence -> recommendation chain visualization

### JARVIS-CP-001 Copilot page shell migration
- establish evidence-first reasoning workspace

### JARVIS-CP-002 Copilot structured reasoning views
- observation/evidence/topology/benchmark/inference/confidence/recommendation/risk/approval layout

### JARVIS-ST-001 Settings page shell migration
- establish reduced-VFX dense settings shell

### JARVIS-ST-002 Settings dense information patterns
- tables, forms, drawers, audit panels, and compact status surfaces

## 5. Reference fidelity checkpoints

At the end of each shell-facing story, validate against the reference for:
- top bar height
- left rail width
- bottom rail height
- panel chamfer language
- cyan edge-light hierarchy
- panel spacing rhythm
- center-hologram dominance
- red alert confinement
- typography hierarchy
- background grid/scanline subtlety

Future implementation should support screenshot comparison at 1536 x 1024.

## 6. Data and technical-accuracy guardrails

Every future implementation story must preserve:
- technical distinction among GPU, NVLink, NVSwitch, PCIe, CPU/NUMA, NIC, InfiniBand, Ethernet, Storage, NCCL, Slurm, and Kubernetes
- trust labels for demo, fixture, synthetic, reference, historical, live, partial, unknown, unavailable, blocked, and stale states
- evidence proximity to conclusions
- no fabricated live telemetry
- no unsupported exact physical topology claims

## 7. Validation strategy for future implementation stories

Minimum validation per story:
- focused visual review against spec
- lint/build/tests relevant to changed code
- reduced-motion check for touched motion surfaces
- keyboard/focus check for touched interactive surfaces
- screenshot capture at desktop target when page layout or shell changed

Broader validation milestones:
- after JARVIS-006 Mission Control shell
- after JARVIS-014 Copilot module
- after JARVIS-015 mobile shell
- after JARVIS-018 performance optimization
- after each page shell migration completes

## 8. Story count summary

Core implementation stories: 18
Page-specific migration stories: 16
Total planned implementation stories: 34

## 9. Recommended first implementation story

Recommended first implementation story:
JARVIS-001 Design tokens and background system

Reason:
- it creates the visual primitives every later story depends on
- it is highly reviewable in isolation
- it establishes token discipline before component proliferation
- it allows early screenshot-comparison progress without forcing page rewrites
- it minimizes risk relative to jumping straight into the flagship hologram implementation

## 10. Suggested follow-on order after the first story

Recommended next sequence:
1. JARVIS-001
2. JARVIS-002
3. JARVIS-003
4. JARVIS-004
5. JARVIS-005
6. JARVIS-006
7. JARVIS-007
8. JARVIS-008
9. JARVIS-009
10. JARVIS-010
11. JARVIS-011
12. JARVIS-012
13. JARVIS-013
14. JARVIS-014
15. JARVIS-015
16. JARVIS-016
17. JARVIS-017
18. JARVIS-018
19. page-specific migrations

## 11. Status

This document defines the approved future implementation breakdown for the JARVIS redesign. It is planning documentation only and does not modify application code.