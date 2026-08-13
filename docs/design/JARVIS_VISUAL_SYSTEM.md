# JARVIS Visual System

Version: 1.0
Status: Approved design-specification target
Scope: Authenticated application visual language only
Reference: docs/design/references/GPUVALIDATOR_JARVIS_REFERENCE.png
Viewport reference: 1536 x 1024 desktop capture

## 1. Purpose

This document translates the authoritative JARVIS reference image into reproducible UI rules for GPUValidator's authenticated product experience.

The target experience is:
- AI infrastructure Mission Control
- scientific instrumentation
- transparent HUD surfaces
- premium cyberdeck geometry
- cinematic but disciplined VFX
- dense enterprise operations tooling
- evidence-driven infrastructure analysis

The target is not:
- a game UI
- a fake hacker interface
- decorative cyberpunk noise
- fabricated telemetry
- technically inaccurate infrastructure graphics

The visual system must preserve the canonical GPUValidator product principles from:
- docs/VISION_2027.md
- docs/DESIGN_SYSTEM.md
- docs/ENGINEERING_PRINCIPLES.md
- docs/design/AI_FACTORY_V1.md

## 2. Reference analysis summary

Reference analyzed: docs/design/references/GPUVALIDATOR_JARVIS_REFERENCE.png
Reference size: 1536 x 1024

Observed composition rules from the reference:
- Full-screen black/blue-black command center shell.
- One continuous outer HUD frame wraps the entire viewport.
- Thin cyan perimeter line with brighter nodes at major corners and center anchors.
- Fixed top command bar, left navigation rail, and bottom system rail.
- Main content arranged on a disciplined three-column grid around one dominant holographic centerpiece.
- Panel corners are not rounded cards; they are clipped/chamfered instrumentation modules.
- Cyan is the primary structural accent; green, amber, red, and purple appear only when semantically required.
- Transparent panels sit over a deep-space technical field with grids, faint stars, radial glows, and scanlines.
- Glow hierarchy is selective. The hologram and active states glow hardest; ordinary panels remain mostly edge-lit.
- Typography uses clean, condensed, operational sans for headings and labels, with monospace/timecode styling for technical values.
- Thin separators, internal frame lines, and micro-notches create a precision-instrument look.

## 3. Canonical desktop shell geometry

The following values are derived from the reference and are the primary screenshot-comparison target for the future implementation.

### 3.1 Primary viewport target
- Reference viewport: 1536 x 1024
- Safe implementation target: 1440-1600 px wide desktop
- Minimum full HUD desktop target: 1280 px wide
- Preferred screenshot baseline: 1536 x 1024

### 3.2 Outer shell regions
- Top command bar height: 72 px
- Left navigation rail width: 88 px
- Bottom system rail height: 82 px
- Outer frame inset from viewport edge: 12 px
- Main content padding from shell frame: 16 px
- Standard inter-panel gap: 16 px
- Compact internal gap: 12 px
- Micro gap: 8 px
- Primary spacing unit: 4 px

### 3.3 Main Mission Control region percentages
Within the area between the top bar and bottom rail:
- Left content column: 26%
- Center content column: 46%
- Right content column: 28%
- Row 1 height: 37%
- Row 2 height: 25%
- Row 3 height: 29%
- Remaining 9%: gutters, shell breathing room, and center-bottom reactor overlap

### 3.4 Shared shell percentages by viewport
Measured against the 1536 x 1024 reference:
- Top command bar: about 7.0% of viewport height
- Left navigation rail: about 5.7% of viewport width
- Bottom system rail: about 8.0% of viewport height
- Main operational canvas: about 85% of viewport width and 77% of viewport height after shell chrome

## 4. Background system

The background is a layered deep-space operations field, not a flat black fill.

### 4.1 Background palette
- --bg-space-0: #05090F
- --bg-space-1: #07111A
- --bg-space-2: #0A1624
- --bg-space-3: #0E2233
- --bg-space-vignette: rgba(0, 0, 0, 0.56)
- --bg-radial-cyan: rgba(0, 224, 255, 0.10)
- --bg-radial-blue: rgba(38, 112, 255, 0.08)

### 4.2 Required background layers
Apply all layers in this order:
1. Base blue-black radial gradient.
2. Subtle technical grid.
3. Radial illumination centered behind key hologram or primary page centerpiece.
4. Sparse stars/data points at very low density.
5. Very subtle scanlines.
6. Edge vignette.

### 4.3 Background behavior rules
- Grid opacity: 0.05 to 0.10 maximum.
- Star/data point density: fewer than 20 visible points per full-screen desktop view unless the particles encode real activity.
- Scanline opacity: 0.03 to 0.06.
- Vignette must darken corners by 12-18% to focus attention inward.
- Ambient radial light should be strongest behind the page centerpiece and never compete with panel text.

### 4.4 CSS token candidates
- --hud-bg-base: radial-gradient(circle at 50% 28%, #0E2233 0%, #07111A 32%, #05090F 72%, #030507 100%)
- --hud-grid-color: rgba(60, 170, 255, 0.08)
- --hud-scanline-color: rgba(120, 220, 255, 0.05)
- --hud-vignette: inset 0 0 180px rgba(0,0,0,0.58)

## 5. Surface tokens

All surfaces are translucent technical layers. None should become opaque consumer-style cards.

- --hud-surface-primary: rgba(6, 18, 30, 0.84)
- --hud-surface-secondary: rgba(8, 22, 36, 0.74)
- --hud-surface-elevated: rgba(10, 28, 44, 0.90)
- --hud-surface-glass: rgba(18, 48, 72, 0.18)
- --hud-surface-inset: rgba(3, 11, 19, 0.88)

Surface rules:
- Primary surface = standard instrumentation panel background.
- Secondary surface = nested sub-panels and secondary modules.
- Elevated surface = top bar plates, selected containers, modal shells.
- Glass surface = hologram overlays, floating callouts, transparent chips.
- Inset surface = wells for charts, gauges, and command areas.

## 6. Border system

### 6.1 Color tokens
- --hud-border: rgba(44, 190, 255, 0.34)
- --hud-border-active: rgba(35, 222, 255, 0.92)
- --hud-border-critical: rgba(255, 76, 92, 0.92)
- --hud-border-warning: rgba(255, 186, 56, 0.92)
- --hud-border-success: rgba(100, 255, 140, 0.80)
- --hud-border-muted: rgba(95, 142, 176, 0.24)

### 6.2 Structural border rules
- Default panel border width: 1 px
- Active edge accent width: 2 px
- Critical edge accent width: 2 px
- Hairline internal separators: 1 px with 25-35% opacity
- Outer shell frame line: 1 px plus selective bloom nodes

### 6.3 Border behavior
- Ordinary panels use --hud-border only.
- Active navigation and selected controls add top or side active-edge illumination.
- Critical panels use red border emphasis only on the affected panel, not the whole screen.
- Warning panels use amber edge emphasis plus text/icon signal.

## 7. Accent and semantic color system

All colors below are exact target tokens for the redesign.

### 7.1 Primary and secondary accents
- --accent-cyan-500: #13D8FF
- --accent-cyan-400: #48E8FF
- --accent-cyan-300: #8CF2FF
- --accent-blue-600: #116BFF
- --accent-blue-500: #2492FF
- --accent-blue-400: #58B7FF

### 7.2 State colors
- --state-healthy: #63F57B
- --state-healthy-dim: #29C95B
- --state-warning: #FFC247
- --state-warning-dim: #FF9F1A
- --state-critical: #FF5A66
- --state-critical-dim: #E33544
- --state-analysis: #A56CFF
- --state-validation: #FFE14A
- --state-unknown: #7E96A8
- --state-info: #58B7FF

### 7.3 HSL reference
- Primary cyan: hsl(190 100% 54%)
- Deep blue: hsl(216 100% 53%)
- Healthy green: hsl(127 88% 67%)
- Warning amber: hsl(41 100% 64%)
- Critical red: hsl(356 100% 67%)
- Analysis purple: hsl(264 100% 71%)
- Validation yellow: hsl(53 100% 64%)
- Unknown blue-gray: hsl(208 16% 58%)

### 7.4 Semantic rules
- Cyan = shell structure, active navigation, hologram frame energy, selected focus.
- Deep blue = secondary structural glow, network context, secondary emphasis.
- Green = healthy, online, operational, resolved, passing trends.
- Amber = warning, validation in progress, attention needed.
- Red = critical, degraded, escalating risk, failing conditions.
- Purple = NCCL, collective path tracing, correlated analysis, AI reasoning support.
- Yellow = validation scope sweep, benchmark execution attention, pending verification.
- Blue-gray = unknown, unavailable, inactive, unlabeled, not-yet-collected.

## 8. Glow system

Glow is scarce and hierarchical.

### 8.1 Tokens
- --glow-xs: 0 0 6px rgba(19, 216, 255, 0.18)
- --glow-sm: 0 0 12px rgba(19, 216, 255, 0.24)
- --glow-md: 0 0 18px rgba(19, 216, 255, 0.34), 0 0 36px rgba(19, 216, 255, 0.12)
- --glow-lg: 0 0 26px rgba(19, 216, 255, 0.44), 0 0 52px rgba(19, 216, 255, 0.18)
- --glow-hologram: 0 0 32px rgba(19, 216, 255, 0.48), 0 0 72px rgba(35, 146, 255, 0.20), 0 0 120px rgba(19, 216, 255, 0.10)

### 8.2 Glow hierarchy
1. Holographic centerpiece
2. Critical operational state
3. Active navigation
4. Selected component or topology path
5. Normal panel

### 8.3 Glow rules
- Never apply large glow to every panel simultaneously.
- Standard panels use either no glow or --glow-xs only on focused edges.
- Active nav items may use --glow-sm.
- Critical alert cards may use red-tinted md glow once on enter, then settle.
- Holograms may use --glow-hologram on key rings, beams, and major selected objects.
- Glow must be applied to edges, rings, or active paths; not to large text blocks.

## 9. Panel geometry

Panels should resemble precision instrumentation modules.

### 9.1 Geometry tokens
- Panel border width: 1 px
- Panel corner radius baseline: 8 px visual rounding maximum
- Primary chamfer cut: 14 px x 14 px at top-left and bottom-right by default
- Secondary chamfer cut: 10 px x 10 px for nested modules
- Internal padding, standard: 16 px
- Internal padding, dense: 12 px
- Header height: 34 px
- Footer/action strip height: 28-32 px
- Title baseline offset from panel top: 12 px
- Separator offset below title area: 34 px

### 9.2 Geometry character
Observed reference panels use:
- clipped polygon silhouettes rather than pure rectangles
- short horizontal shoulders near corners
- edge notches for status nodes
- subtle internal top highlight line
- slanted or cut footer brackets on some panels

### 9.3 Reusable SVG/CSS strategy
Recommended implementation strategy:
- Use SVG or clip-path polygon for outer silhouette.
- Keep one reusable chamfer pattern for shell, panels, buttons, and tabs.
- Draw three layers:
  1. background fill
  2. border stroke
  3. top-edge active light strip or corner emitter
- Add an inner inset line at 1 px to create depth.
- Avoid hand-drawing unique polygon shapes per panel; define two or three standard silhouettes only.

Example polygon proportions for standard panel:
- top-left chamfer starts 14 px from left edge and ends 14 px from top edge
- top-right corner mostly square with 6 px micro-cut optional
- bottom-right chamfer 14 px
- bottom-left mostly square with 6 px micro-cut optional

## 10. Separator and framing system

- Standard separator: 1 px line, rgba(72, 180, 255, 0.16)
- Section separator: 1 px line plus 12 px cyan highlight at one end
- Panel header underline: 1 px cyan-blue line at 28-35% opacity
- Rail dividers: 1 px vertical line with occasional glow nodes
- Data-row separators: 1 px line at 8-12% opacity only

HUD details to preserve:
- micro ticks in headers
- small corner nodes
- truncated bracket corners
- tiny labeled status nubs on tabs and chips

## 11. Typography system

Readability has priority over futuristic styling.

### 11.1 Font roles
- Display / page titles: condensed technical sans, semi-bold to bold
- Operational UI copy: readable sans
- Labels, telemetry, commands, IDs: monospace or monospaced numeric figures
- Long body text: plain readable sans, never decorative sci-fi font

### 11.2 Type scale
- Display: 28 px / 32 px, 700, tracking 0.02em
- Page title: 20 px / 24 px, 700, tracking 0.06em, uppercase optional when short
- Panel title: 14 px / 18 px, 700, tracking 0.05em, uppercase
- Operational value: 40-48 px / 1.0, 600-700
- Telemetry value: 24-30 px / 1.1, 600
- Body: 14 px / 20 px, 400-500
- Technical label: 11-12 px / 16 px, 500, uppercase, tracking 0.10em
- Metadata: 10-11 px / 14 px, 500
- Status: 11-12 px / 14 px, 600, uppercase
- Command/code: 12-13 px / 18 px, monospace

### 11.3 Typographic color rules
- Primary title text: #E7F7FF
- Standard body: #CBE7F7
- Secondary body: #92B6CB
- Metadata: #6F95AD
- Cyan emphasis: #54E4FF
- Healthy emphasis: #63F57B
- Warning emphasis: #FFC247
- Critical emphasis: #FF7682

### 11.4 Hierarchy rules observed in reference
- Panel headings are compact and uppercase.
- Primary values are oversized and centered within gauges or metric rows.
- Supporting metadata uses tiny uppercase mono labels.
- Important state words such as OPERATIONAL, WARNING, LIVE, ONLINE are color-coded and isolated for quick scan.

## 12. Buttons, badges, and interactive controls

### 12.1 Button geometry
- Height: 28-34 px
- Horizontal padding: 12-16 px
- Shape: chamfered capsule or clipped rectangle
- Border: 1 px cyan-blue line
- Fill: transparent or low-opacity cyan glass
- Text: 11-12 px uppercase technical label

### 12.2 Button states
- Default: subdued outline, no large glow
- Hover: increased border brightness plus inner cyan wash
- Focus: clear 2 px focus ring outside silhouette
- Active: stronger cyan fill, top-edge light strip
- Destructive: red outline only when action truly destructive

### 12.3 Badge patterns
- Status badges are small clipped pills with dot + text.
- Live/online badges use green dot + dark green glass fill.
- Warning badges use amber border and text.
- Critical badges use red border, icon, and optional subtle pulse on first appearance.

## 13. Chart and instrumentation motifs

### 13.1 Circular instrumentation
Reference traits:
- Thick multi-ring gauges.
- Outer ring glows cyan.
- Secondary ring may carry green or amber progress segment.
- Inner disc is dark and clean for large percentage value.
- Gauge tick marks are fine, radial, and low contrast.
- Circular instrumentation should feel like scientific hardware, not a game shield.

### 13.2 Microcharts
- Sparklines appear in small inset wells.
- Stroke width: 1.5-2 px
- Glow: minimal
- Fill: none or very faint gradient fill below 10% opacity
- Use only where trend over time matters.
- Always pair with label and unit or state description.

### 13.3 Bar metrics
Observed KPI rows use:
- left label
- large percentage/value mid-right
- horizontal progress bar or baseline rail
- tiny sparkline at far right

### 13.4 Pipeline visualization
- Pipeline nodes are circular or rounded technical capsules.
- Each stage has icon, title, and numeric completion.
- Stages connect through thin directional lines.
- Active validation stage may use yellow/amber emphasis.

## 14. Alert treatments

Critical conditions in the reference use a distinct visual language.

Rules:
- Alert panel background shifts to deeper red-black inset.
- Border emphasis turns red only on that module.
- Alert icon is triangle or hazard symbol, left aligned.
- Severity pill at panel top-right shows count or active state.
- Trend sparkline uses red trace with minor noise.
- Numeric failure values use bold red accent.
- Alert card interior should remain readable, not fully flooded red.

One-shot motion rule:
- On alert enter or severity escalation, affected edge may pulse once over 700 ms, then settle to static critical illumination.

## 15. Iconography

- Stroke-based line icons
- 1.5-2 px stroke
- Simple geometric symbols
- Cyan default, semantic override only when needed
- Avoid playful filled icons or skeuomorphic illustrations
- Navigation icons should be vertically centered in 24 x 24 boxes inside 48-56 px touch/click zones

## 16. Hologram system

The centerpiece hologram is the emotional and structural anchor of the page.

### 16.1 Hologram structure observed in reference
- Circular projected platform occupies the center upper region.
- Nested radial rings and orbit arcs form a projection base.
- Vertical cyan light beam rises from the center.
- Semi-transparent isometric rack/node objects float above the platform.
- Selected object changes to amber, making the selection unmistakable.
- Floating glass callouts label surrounding subsystems.
- Fine world-space dots and rings create spatial depth.

### 16.2 Hologram rules
- Treat hologram as a data model with overlays, not as decorative 3D art.
- Default hologram color: cyan/blue.
- Selected or warning target: amber.
- Critical overlay path: red only when representing critical state.
- Purple reserved for NCCL or analysis overlays.
- Label callouts must remain planar and readable.
- 3D illusion must not hide labels or imply unsupported physical fidelity.

## 17. VFX layers visible in the reference

Visible VFX stack to preserve:
1. background radial glow
2. shell edge bloom
3. panel edge bloom
4. hologram base rings
5. hologram vertical beam
6. low-opacity scanlines
7. tiny waveform activity in top bar
8. rare point lights and corner emitters
9. selected-object highlight bloom
10. subtle world-map or grid emboss for network/fabric views

## 18. Shared authenticated shell definition

### 18.1 Top command bar
Left region:
- GPUValidator logo mark
- GPUValidator wordmark
- subtitle: AI Infrastructure Mission Control

Center region:
- current time
- page banner: AI Factory Operations Experience
- subtle animated waveform or telemetry ruler

Right region:
- Environment
- Theme
- System state
- User profile chip

Top bar rules:
- Height: 72 px
- Three faceted plates, not one flat strip
- Center plate is widest and visually anchored
- Use cyan edge nodes at major plate junctions

### 18.2 Left navigation rail
Required items:
- Mission Control
- AI Factory
- Topology
- Benchmarks
- Evidence
- Alerts
- Investigations
- Copilot
- Settings

Rules:
- Width: 88 px
- Top icon medallion present above primary nav list
- Each item has icon above label in stacked form
- Active item uses stronger cyan frame and filled glow background
- Hover increases edge brightness
- Focus uses visible outer focus ring
- Bottom of rail may contain auxiliary sensor/orb or status node

### 18.3 Bottom system rail
Required regions:
- System Status
- Threat/Risk Level
- Data Freshness
- Agent/Collector State or equivalent live state indicator
- Uptime

Rules:
- Height: 82 px
- Divided into clipped segments with a central reactor-like anchor object
- Status words use semantic color
- Rail remains visible on large desktop displays

## 19. Mission Control layout target

Closest visual match to the reference:
- Left upper: AI Factory Health
- Center upper: AI Factory Topology hologram
- Right upper: Critical Conditions
- Left middle: Current Activity
- Center middle: Validation Pipeline
- Right middle: Prioritized KPIs
- Left lower: System Telemetry
- Center lower: Live Fabric Map
- Right lower: AI Copilot Assistant

Panel sizing targets on 1536 x 1024 viewport:
- AI Factory Health: ~374 x 242 px
- Topology hologram: ~592 x 304 px
- Critical Conditions: ~372 x 293 px
- Current Activity: ~300 x 253 px
- Validation Pipeline: ~580 x 215 px
- Prioritized KPIs: ~373 x 228 px
- System Telemetry: ~364 x 234 px
- Live Fabric Map: ~531 x 271 px
- AI Copilot Assistant: ~458 x 270 px

These are approximation targets for future screenshot matching, not hard-coded implementation values.

## 20. Technical accuracy constraints

Visual drama never overrides infrastructure correctness.

The visual system must preserve distinctions among:
- GPU
- NVLink
- NVSwitch
- PCIe
- CPU/NUMA
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
- Do not use glowing lines as fake data flow.
- Do not imply live telemetry when data is absent.
- Do not render exact rack, cable, or topology geometry without evidence support.
- Demo/reference data must remain labeled.

## 21. Accessibility implications for the visual language

- Every state shown by color must also show text, icon, label, or pattern.
- Focus rings must remain visible over dark transparent panels.
- Long body content must not use the condensed display face.
- Scanlines and bloom must never reduce text contrast below accessible thresholds.
- Hologram content needs text alternatives and static snapshots.
- Motion and pulsing must have reduced-motion equivalents.
- No flashing, rapid red pulses, or perpetual attention-seeking animation.

## 22. Implementation-ready token summary

```text
Geometry
--shell-topbar-h: 72px
--shell-nav-w: 88px
--shell-bottomrail-h: 82px
--hud-gap: 16px
--hud-gap-compact: 12px
--hud-pad: 16px
--hud-pad-dense: 12px
--hud-border-width: 1px
--hud-active-edge-width: 2px
--hud-radius: 8px
--hud-chamfer: 14px
--hud-chamfer-sm: 10px
--hud-header-h: 34px
--hud-footer-h: 30px

Surfaces
--hud-surface-primary: rgba(6, 18, 30, 0.84)
--hud-surface-secondary: rgba(8, 22, 36, 0.74)
--hud-surface-elevated: rgba(10, 28, 44, 0.90)
--hud-surface-glass: rgba(18, 48, 72, 0.18)
--hud-surface-inset: rgba(3, 11, 19, 0.88)

Borders
--hud-border: rgba(44, 190, 255, 0.34)
--hud-border-active: rgba(35, 222, 255, 0.92)
--hud-border-critical: rgba(255, 76, 92, 0.92)
--hud-border-warning: rgba(255, 186, 56, 0.92)

Accents
--accent-cyan-500: #13D8FF
--accent-blue-600: #116BFF
--state-healthy: #63F57B
--state-warning: #FFC247
--state-critical: #FF5A66
--state-analysis: #A56CFF
--state-validation: #FFE14A
--state-unknown: #7E96A8

Glow
--glow-xs: 0 0 6px rgba(19, 216, 255, 0.18)
--glow-sm: 0 0 12px rgba(19, 216, 255, 0.24)
--glow-md: 0 0 18px rgba(19, 216, 255, 0.34), 0 0 36px rgba(19, 216, 255, 0.12)
--glow-lg: 0 0 26px rgba(19, 216, 255, 0.44), 0 0 52px rgba(19, 216, 255, 0.18)
--glow-hologram: 0 0 32px rgba(19, 216, 255, 0.48), 0 0 72px rgba(35, 146, 255, 0.20), 0 0 120px rgba(19, 216, 255, 0.10)
```

## 23. Status

This document defines the approved visual token and geometry target for the future JARVIS-authenticated application redesign. It does not implement application code.