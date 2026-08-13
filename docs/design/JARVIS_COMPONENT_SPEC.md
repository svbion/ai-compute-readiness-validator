# JARVIS Component Specification

Version: 1.0
Status: Approved design-specification target
Scope: Reusable authenticated HUD component system
Related references:
- docs/design/JARVIS_VISUAL_SYSTEM.md
- docs/design/JARVIS_MOTION_VFX_SPEC.md
- docs/design/JARVIS_PAGE_SYSTEM.md
- docs/design/references/GPUVALIDATOR_JARVIS_REFERENCE.png

## 1. Purpose

This document defines the reusable component system for the JARVIS-authenticated experience. Components must preserve:
- technical readability
- evidence-first workflows
- accessibility
- dense enterprise information display
- technically accurate infrastructure semantics
- restrained glow and motion discipline

All components below are specification targets only. This document does not implement UI code.

## 2. Shared component conventions

Every JARVIS component should declare or support:
- purpose
- geometry tokens
- semantic states
- responsive behavior
- accessibility contract
- motion hooks
- required data shape
- trust/classification labeling

Common rules:
- Use HUD chamfer geometry from JARVIS_VISUAL_SYSTEM.
- Expose visible focus state.
- Support reduced-motion mode.
- Distinguish live, historical, reference, demo, fixture, synthetic, partial, unknown, unavailable, and blocked states when applicable.
- Never hide critical content behind hover only.

## 3. Core shell components

### 3.1 HudShell
Purpose:
- Global authenticated application frame.

Geometry:
- fills viewport
- includes outer HUD frame
- top command bar: 72 px
- left navigation rail: 88 px desktop
- bottom system rail: 82 px desktop
- main content inset: 16 px

States:
- default
- loading shell
- degraded system state
- reduced-motion
- compact desktop
- tablet
- mobile mission feed

Responsive behavior:
- desktop: full chrome
- tablet: bottom rail may compress to segmented status strip
- mobile: left rail becomes drawer or bottom navigation; bottom rail becomes collapsible status drawer

Accessibility:
- landmarks for top bar, primary nav, main content, system status
- skip links
- readable tab order

Motion hooks:
- page transition entry
- shell highlight on route change
- system state pulse once on severity escalation

Data requirements:
- environment
- theme
- current user
- global system/trust state
- data freshness

### 3.2 HudTopBar
Purpose:
- Show product identity, context banner, time, environment, theme, system state, and user controls.

Geometry:
- height: 72 px
- composed of faceted plates
- left identity cluster, center banner, right control cluster

States:
- default
- route-highlighted
- stale-data warning
- critical global state

Responsive behavior:
- compress metadata first, then hide non-essential decorative waveform on smaller widths

Accessibility:
- time must have accessible label and timezone when available
- environment, theme, system state, and user menu keyboard operable

Motion hooks:
- waveform idle motion
- route banner transition

Data requirements:
- product label
- current route/page label
- current time
- environment label
- theme label
- global system state
- user profile summary

### 3.3 HudNavigationRail
Purpose:
- Primary authenticated navigation.

Geometry:
- width: 88 px
- stacked icon + label items
- top medallion area
- bottom auxiliary status orb optional

States:
- default
- hover
- focus
- active
- disabled
- alert-attached

Responsive behavior:
- desktop: left rail
- tablet: narrow icon-first rail or drawer
- mobile: bottom navigation or drawer

Accessibility:
- semantic nav list
- active page indication
- text labels always available to assistive tech

Motion hooks:
- active edge illumination
- hover brighten
- alert-affordance pulse once

Data requirements:
- route id
- icon token
- label
- active state
- alert count or severity optional

### 3.4 HudBottomRail
Purpose:
- Persistent global status strip.

Geometry:
- height: 82 px
- faceted segmented modules
- central reactor-like anchor or core badge allowed on large desktop

States:
- default
- healthy
- warning
- critical
- stale
- reduced

Responsive behavior:
- desktop: full rail visible
- tablet: abbreviated metrics
- mobile: compact status drawer

Accessibility:
- each metric announced with label and current value
- not focus-trapping

Motion hooks:
- freshness pulse on updates
- one-shot severity escalation

Data requirements:
- system status
- threat/risk level
- data freshness
- agent/collector state
- uptime

## 4. Structural content components

### 4.1 HudPanel
Purpose:
- Base instrumentation container for authenticated pages.

Geometry:
- chamfered polygon shell
- border: 1 px
- padding: 16 px standard, 12 px dense
- header height: 34 px
- footer strip: 28-32 px optional

States:
- default
- focused
- selected
- healthy
- warning
- critical
- loading
- empty
- partial
- blocked
- unknown

Responsive behavior:
- preserve header hierarchy and inset content regions at all breakpoints

Accessibility:
- semantic heading association
- optional description region
- labeled action footer

Motion hooks:
- enter reveal
- focus edge brighten
- status settle transition

Data requirements:
- title
- optional subtitle
- optional status
- optional classification/trust label
- body content
- optional actions/footer

### 4.2 HudPanelHeader
Purpose:
- Standardized panel title row with status and classification affordances.

Geometry:
- 34 px height
- title left
- metadata/status right
- separator line below

States:
- default
- active
- warning
- critical
- compact

Responsive behavior:
- right-side metadata stacks beneath title on narrow widths

Accessibility:
- heading role or semantic mapping required

Motion hooks:
- subtle title fade/slide on panel load

Data requirements:
- title
- optional status text
- optional classification/trust text
- optional actions

### 4.3 HudMetric
Purpose:
- Show one primary value plus label, trend, comparison, or status.

Geometry:
- one dominant value block
- optional sublabel and delta line

States:
- default
- positive
- negative
- stable
- unknown
- unavailable

Responsive behavior:
- stack label/value on narrow widths

Accessibility:
- accessible sentence form required

Motion hooks:
- numeric flip or fade only for meaningful updates

Data requirements:
- label
- value
- unit optional
- delta optional
- time range optional
- classification

### 4.4 HudGauge
Purpose:
- Circular or arc-based health/value instrumentation.

Geometry:
- preferred sizes: 160, 192, 224 px
- multi-ring arc system
- central value area

States:
- healthy
- warning
- critical
- unknown
- unavailable
- active scan optional

Responsive behavior:
- downshift to smaller ring or bar version on mobile

Accessibility:
- text summary required outside the graphic

Motion hooks:
- progress sweep
- settle animation
- validation sweep optional

Data requirements:
- label
- value
- min/max
- unit
- status
- timestamp/freshness

### 4.5 HudStatusBadge
Purpose:
- Compact state indicator with non-color signal.

Geometry:
- clipped pill
- 20-24 px height
- optional dot/icon at start

States:
- healthy
- warning
- critical
- unknown
- blocked
- stale
- live
- reference
- historical

Responsive behavior:
- icon + short text retained even in compact mode

Accessibility:
- must include text, not dot only

Motion hooks:
- one-shot pulse on state change only

Data requirements:
- label
- semantic state
- optional icon

### 4.6 HudAlertCard
Purpose:
- High-priority operational condition summary.

Geometry:
- inset red-black well
- severity icon left
- title and affected scope block
- value/trend block right or below
- sparkline band optional

States:
- warning
- critical
- acknowledged
- muted
- resolved

Responsive behavior:
- stack metadata under title at smaller widths

Accessibility:
- severity, scope, duration, and recommendation availability announced

Motion hooks:
- one-shot escalation pulse
- resolve fade to neutral

Data requirements:
- severity
- title
- affected scope
- primary evidence metric
- duration
- trend
- evidence link
- recommended action summary optional

### 4.7 HudActivityFeed
Purpose:
- Chronological operational feed.

Geometry:
- vertical dense list
- timestamp column or prefix
- event title
- subsystem line
- right-edge affordance

States:
- live
- paused
- filtered
- empty

Responsive behavior:
- preserve event ordering and readable time stamps on narrow widths

Accessibility:
- event list semantics
- timestamps machine-readable

Motion hooks:
- new event enter
- live badge update

Data requirements:
- timestamp
- category
- title
- affected scope
- severity optional
- evidence availability
- classification

### 4.8 HudMiniChart
Purpose:
- Compact trend display for KPIs and side metrics.

Geometry:
- 48-96 px tall
- sparkline or mini area chart
- optional baseline band

States:
- positive
- negative
- stable
- warning
- critical
- unknown

Responsive behavior:
- collapses to text summary on very small widths

Accessibility:
- text summary required

Motion hooks:
- draw-on update optional, very short

Data requirements:
- series
- unit
- time range
- baseline optional
- classification

### 4.9 HudTelemetryGauge
Purpose:
- Subsystem telemetry cluster combining gauge, sub-metrics, and trend wells.

Geometry:
- left major gauge
- right stacked metric wells
- optional tabbed subsystem selector

States:
- default
- active subsystem
- warning
- critical
- unknown

Responsive behavior:
- tabs become segmented scroll or dropdown on smaller widths

Accessibility:
- active tab, subsystem label, and summaries required

Motion hooks:
- tab transition
- gauge update settle

Data requirements:
- subsystem id
- value groups
- trends
- units
- freshness
- classification

## 5. Spatial and topology components

### 5.1 HudTopologyCanvas
Purpose:
- Primary technical visualization surface for factory, topology, evidence graph, investigation graph, and benchmark fabric views.

Geometry:
- fills assigned panel body
- supports overlay controls and inspector linkages
- allows centered visualization with surrounding labels

States:
- logical
- physical
- NCCL
- NVLink
- network
- storage
- benchmark
- evidence
- empty
- partial
- unknown

Responsive behavior:
- desktop: full canvas
- tablet: reduced side callouts
- mobile: simplified 2D technical diagram or summarized focus card

Accessibility:
- alternate textual topology summary
- keyboard selection model
- accessible names for objects and edges

Motion hooks:
- initialization
- trace highlight
- node selection focus
- dim-non-selected state

Data requirements:
- node/object set
- typed relationships
- overlay mode
- status per object
- trust labels
- evidence references

### 5.2 HudHologram
Purpose:
- Specialized centerpiece projection inside topology-oriented canvases.

Geometry:
- projected radial base
- optional vertical beam
- layered ring system
- floating object set
- world-space callouts

States:
- default
- selected target
- warning scope
- critical scope
- validation overlay
- NCCL overlay
- reduced-motion static

Responsive behavior:
- simplify rings, particles, and parallax progressively on smaller breakpoints

Accessibility:
- summarized active scope and selected objects required

Motion hooks:
- initialization beam
- ring rotation
- selection bloom
- sweep overlays

Data requirements:
- spatial objects
- labels/callouts
- selected object
- overlay modes
- state mapping

### 5.3 HudCallout
Purpose:
- Floating labeled annotation for hologram or topology object.

Geometry:
- small glass box with pointer line
- single or dual-line text

States:
- default
- selected
- healthy
- warning
- critical
- muted

Responsive behavior:
- collapse or dock into inspector list when space is limited

Accessibility:
- callout content must exist in DOM order or inspector list

Motion hooks:
- fade/slide in
- pointer line illuminate on focus

Data requirements:
- label
- value/state
- anchor target
- semantic state

### 5.4 HudPipeline
Purpose:
- Ordered validation/benchmark workflow display.

Geometry:
- horizontal desktop flow
- staged nodes with connectors
- progress rail below optional

States:
- pending
- active
- successful
- warning
- failed
- blocked
- unknown

Responsive behavior:
- stack vertically or paginate on narrow widths

Accessibility:
- ordered list semantics and text summaries of stage state

Motion hooks:
- active stage sweep
- completion settle

Data requirements:
- stages[] with label, icon, status, percent, summary
- overall progress
- last run time optional

### 5.5 HudEvidenceLink
Purpose:
- Evidence-first affordance connecting conclusion to provenance.

Geometry:
- compact clipped button/chip with icon + label

States:
- available
- partial
- blocked
- unavailable

Responsive behavior:
- may expand to full-width action row on mobile

Accessibility:
- source type and availability announced

Motion hooks:
- focus brighten only

Data requirements:
- evidence id
- source type
- timestamp
- classification
- availability status

### 5.6 HudCommand
Purpose:
- Render commands, paths, checksums, and technical snippets.

Geometry:
- inset code well
- monospace text
- optional copy and evidence actions

States:
- default
- warning-risk
- blocked
- sanitized

Responsive behavior:
- wrap or horizontal scroll without clipping controls

Accessibility:
- copy action keyboard accessible
- code block labeled with purpose

Motion hooks:
- none beyond focus states

Data requirements:
- content
- language/type
- risk level optional
- provenance metadata optional

## 6. Investigation and assistant components

### 6.1 HudCopilotPanel
Purpose:
- Evidence-first AI reasoning environment, not generic chat.

Geometry:
- question prompt area
- structured reasoning sections
- supporting holographic AI secondary graphic optional
- action footer

States:
- idle
- reasoning
- cited-response
- insufficient-evidence
- approval-needed

Responsive behavior:
- structured sections stack vertically on smaller widths

Accessibility:
- output grouped as Observation, Evidence, Inference, Confidence, Recommendation, Risk, Approval

Motion hooks:
- reasoning step reveal
- evidence-link highlight

Data requirements:
- user question
- observation
- evidence[]
- inference
- confidence
- recommendation
- risk
- approval state

### 6.2 HudInspector
Purpose:
- Contextual detail panel for selected object.

Geometry:
- right-side or surrounding panel group
- list of typed facts and links

States:
- none selected
- object selected
- loading evidence
- partial
- blocked

Responsive behavior:
- can become bottom drawer on tablet/mobile

Accessibility:
- selection changes announced politely

Motion hooks:
- slide/fade on selection change

Data requirements:
- object identity
- status summary
- typed facts
- evidence links
- related alerts/actions

### 6.3 HudTimeline
Purpose:
- Show investigation chronology.

Geometry:
- vertical timeline or horizontal segmented band depending on page
- time marker + content cluster

States:
- observation
- inference
- validation
- benchmark
- evidence-captured
- recommendation
- approval
- action
- state-change

Responsive behavior:
- preserve chronological readability and filtering

Accessibility:
- ordered event list with machine-readable times

Motion hooks:
- progressive reveal on load optional

Data requirements:
- event type
- timestamp
- source
- affected scope
- classification
- evidence link
- confidence optional

## 7. Overlay and transient components

### 7.1 HudModal
Purpose:
- Focused decision, evidence drilldown, or approval interaction.

Geometry:
- centered elevated panel
- max width bands: 480, 720, 960 px
- strong shell border and dim backdrop

States:
- default
- approval-critical
- evidence-detail
- form

Responsive behavior:
- full-height drawer on small screens when necessary

Accessibility:
- focus trap
- escape close when safe
- labelled title and description

Motion hooks:
- elevated enter/exit

Data requirements:
- title
- purpose
- content
- actions
- risk summary optional

### 7.2 HudDrawer
Purpose:
- Bottom or side contextual expansion for evidence, status, settings, or inspector details.

Geometry:
- bottom drawer preferred for evidence/timeline
- side drawer acceptable for filters/secondary navigation

States:
- collapsed
- peek
- expanded
- pinned

Responsive behavior:
- mobile drawer becomes primary overflow container

Accessibility:
- keyboard operable resize states where practical
- labeled regions

Motion hooks:
- slide open/close
- pin state transition

Data requirements:
- title
- content sections
- current state

### 7.3 HudTooltip
Purpose:
- Brief contextual explanation only.

Geometry:
- small glass callout with max width 240 px

States:
- default
- warning
- critical

Responsive behavior:
- on touch/mobile, convert to click/focus popover

Accessibility:
- focus reachable and dismissible
- never sole source of critical info

Motion hooks:
- fast fade/translate

Data requirements:
- short label or explanation

## 8. Page-specific component assemblies

Mission Control primary assembly:
- HudShell
- HudTopBar
- HudNavigationRail
- HudBottomRail
- HudPanel x 9
- HudGauge
- HudActivityFeed
- HudPipeline
- HudTelemetryGauge
- HudTopologyCanvas + HudHologram
- HudCopilotPanel

AI Factory primary assembly:
- HudShell
- HudTopologyCanvas
- HudHologram
- HudInspector x multiple
- HudCallout
- HudTimeline
- HudEvidenceLink
- HudDrawer

Topology primary assembly:
- HudTopologyCanvas
- overlay mode controls
- HudInspector
- HudEvidenceLink
- HudCommand

Benchmarks primary assembly:
- HudTopologyCanvas or performance canvas
- HudMetric
- HudMiniChart
- radial benchmark comparison widgets
- baseline/reference badges

Evidence primary assembly:
- provenance graph canvas
- evidence list/table
- HudCommand
- trust labels
- drawer/modal evidence detail

Alerts primary assembly:
- risk matrix canvas
- HudAlertCard list
- inspector and evidence drawer

Investigations primary assembly:
- root-cause graph canvas
- HudTimeline
- HudInspector
- evidence actions
- recommendation and approval sections

Copilot primary assembly:
- structured reasoning surface
- linked evidence panels
- topology and benchmark references
- restrained AI secondary hologram

Settings primary assembly:
- dense HudPanel layout
- tables/forms/drawers
- reduced VFX mode

## 9. Data contract principles across all components

Each component that represents infrastructure state should accept or expose:
- id
- title/label
- semantic state
- classification/trust label
- freshness timestamp or status
- evidence availability
- affected scope
- optional recommendation/risk metadata

Infrastructure models must preserve distinctions among:
- GPU
- NVLink
- NVSwitch
- PCIe
- CPU/NUMA
- NIC
- InfiniBand
- Ethernet
- Storage
- NCCL
- Slurm
- Kubernetes

## 10. Accessibility baseline for every component

Every JARVIS component must:
- be keyboard operable where interactive
- show visible focus
- provide non-color state indicators
- expose semantic labels/roles
- support reduced motion
- avoid critical hover-only content
- support high contrast dark rendering
- keep body text readable

## 11. Status

This document defines the reusable component contract for the JARVIS redesign. It is documentation only and does not modify application code.