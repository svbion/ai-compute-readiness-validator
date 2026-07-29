# GPUValidator Design System

Version: 1.0
Status: Canonical UI and Interaction Standard
Owner: Sabion P. Frazier

## Design Intent

GPUValidator should feel like:

- AI infrastructure Mission Control
- enterprise operations software
- scientific instrumentation
- high-end technical tooling
- evidence-driven decision support

GPUValidator should not feel like:

- a generic React dashboard
- a consumer application
- a video game
- a decorative cyberpunk concept
- a collection of unrelated screens

The interface should communicate operational seriousness. Visual style exists to increase understanding, confidence, and ability to act.

## Visual Principles

GPUValidator UI should be:

- technical
- restrained
- confident
- high-information
- readable
- purposeful
- consistent
- accessible

Visual novelty must never reduce technical accuracy or evidence clarity.

## Existing Visual Language

Preserve the current product language:

- black and graphite surfaces
- restrained green accent
- red, amber, blue, and purple only when semantically meaningful
- monospaced labels for technical metadata
- strong headings for hierarchy
- subtle borders
- controlled glow
- rounded enterprise panels
- dense but readable layouts

Do not copy NVIDIA logos, trademarks, or branded visual assets. GPUValidator may refer to supported technologies accurately, but it must not imitate vendor brand systems or imply affiliation.

## Canonical Product Terms

UI language should consistently use Mission Control, AI Factory, Topology Explorer, Validation Workspace, Benchmark Intelligence, Investigation Workspace, Evidence Explorer, AI Copilot, and Approval Workflow. Do not rename these concepts screen-by-screen unless a future canonical product update explicitly changes the terminology.

## Color Semantics

- Green: healthy, pass, available, validated.
- Amber/yellow: warning, validation running, benchmark activity.
- Red: failure, degraded, critical risk.
- Blue: discovery, inventory, informational network activity.
- Purple: NCCL collective, AI-assisted inference, or correlated analysis when explicitly labeled.
- Gray: neutral, unavailable, inactive, unknown.

Color must never be the only signal. Pair color with text, iconography, shape, pattern, label, accessible name, or state description.

## Typography

- Use display or strong sans-serif typography for primary titles.
- Use readable sans-serif typography for body copy.
- Use monospace for commands, telemetry, IDs, labels, paths, and values.
- Use uppercase tracking only for concise technical labels.
- Do not use long body paragraphs in all caps.
- Do not use tiny unreadable metadata.
- Prioritize scanability over decorative type treatment.

## Layout Hierarchy

Every major page should prioritize:

1. current state
2. health or risk
3. affected scope
4. evidence
5. recommendation
6. next action

Mission Control should prioritize:

1. overall infrastructure health
2. active critical conditions
3. current jobs and validation activity
4. cluster and GPU availability
5. recent benchmarks
6. investigations
7. supporting telemetry

## Component Standards

### KPI Cards

KPI cards should show one primary value, its unit, state, comparison or threshold when relevant, and the data classification: demo, fixture, synthetic, reference, historical, or live. Avoid ambiguous decorative numbers.

### Health Indicators

Health indicators must communicate state, severity, scope, and reason. Do not show pass/fail without evidence or explanation.

### Tables

Tables should be dense but readable, support keyboard navigation, preserve alignment for numeric values, expose row state in text, and avoid hiding critical status behind hover-only UI.

### Charts

Charts should answer a specific operational question, display units and time range, and distinguish reference, historical, and live data.

### Topology Diagrams

Topology diagrams must prioritize technical accuracy, labels, traceability, and clear separation between internal node fabric and external cluster fabric.

### Timelines

Timelines should show what changed, when it changed, what evidence was captured, and whether the item is observation, inference, recommendation, approval, or action.

### Evidence Drawers

Evidence drawers should provide one-click access to command evidence, parsed values, raw excerpts, checksums, citations, timestamps, and provenance. Sensitive values must remain sanitized.

### Modals

Modals should be used for focused decisions, approvals, or contextual evidence. Avoid using modals as a substitute for page hierarchy.

### Command Snippets

Command snippets must use monospace, preserve arguments, show risk or safety context when relevant, and avoid exposing secrets or internal identifiers.

### Alerts

Alerts should state severity, affected scope, likely reason, evidence link, recommended next step, and whether action requires approval.

### Remediation Actions

Remediation actions must distinguish recommendation from execution. Infrastructure-changing actions require explicit approval and must describe risk.

### Approval Dialogs

Approval dialogs must summarize action, affected infrastructure, risk, evidence, reversibility, and audit implications. Destructive approval cannot be hidden behind a generic confirmation.

### Empty States

Empty states should explain whether data is unavailable, not yet collected, blocked, filtered out, or unsupported. Never imply live data exists when it does not.

### Loading States

Loading states should describe the operation in progress and preserve layout stability. If progress is unknown, say so.

### Error States

Error states should identify what failed, what is affected, whether data may be incomplete, and what evidence or retry path is available.

## Animation Philosophy

Animation exists to explain state, flow, or progress.

Approved uses:

- validation progression
- topology discovery
- NVLink or network path tracing
- NCCL collective flow
- benchmark progress
- health transitions
- node heartbeat
- live telemetry updates
- focus and hover feedback

Prohibited uses:

- random particles
- decorative floating dots
- unexplained glowing paths
- fake traffic
- fake topology
- constant motion with no informational value
- motion that obscures labels
- motion that continues under reduced-motion preferences

All animation must:

- be subtle
- be deterministic
- follow visible paths
- have a useful static state
- respect prefers-reduced-motion
- avoid excessive GPU or CPU use

## Topology Visualization Standards

Always distinguish:

- GPU
- NVLink
- NVSwitch
- PCIe
- CPU and NUMA
- NIC
- InfiniBand
- Ethernet
- storage fabric
- external cluster network

Required rules:

- do not place InfiniBand between GPUs
- do not connect GPUs directly to an external network unless the specific architecture and adapter relationship is explicitly explained
- do not represent NVSwitch as an external cluster switch
- label logical diagrams as logical
- label reference or demo data
- never imply exact cabling without source data
- separate internal node fabric from external cluster fabric
- clearly distinguish health, traffic, and validation overlays

## Charts and Telemetry

Charts should:

- answer a specific operational question
- display units
- show time range
- show thresholds where relevant
- distinguish reference, historical, and live data
- avoid unnecessary legends
- avoid decorative chart types
- use sparklines where compact trends are sufficient
- provide accessible text summaries

## Interaction Principles

- Evidence should be one click away.
- Affected infrastructure should be visually traceable.
- Alerts should link to topology, logs, benchmarks, and investigations.
- Dangerous actions require confirmation and approval.
- Keyboard navigation must be supported.
- Hover-only information must also be available through focus or click.
- Controls must visibly communicate state.
- Unknown, unavailable, blocked, and partial states must be explicit.
- Filters, selected scope, and time ranges must remain visible.

## Accessibility

GPUValidator must support:

- keyboard navigation
- visible focus states
- semantic headings
- screen-reader labels
- high contrast
- reduced motion
- text alternatives
- no information conveyed by color alone
- readable minimum sizing

Accessibility is part of operational reliability. If an engineer cannot perceive, navigate, or trust a control, the interface is not complete.

## Design Review Checklist

Future UI stories must pass this checklist:

- Does the page answer current state, health or risk, affected scope, evidence, recommendation, and next action?
- Is evidence one click away from every major conclusion?
- Are demo, fixture, synthetic, reference, historical, and live data labeled distinctly?
- Are colors used semantically and paired with non-color signals?
- Are typography, spacing, panels, borders, and glow consistent with the existing visual language?
- Are topology diagrams technically accurate and explicitly labeled when logical or reference-based?
- Are charts unit-labeled, time-scoped, and purposeful?
- Are dangerous actions approval-gated with visible risk?
- Does the experience support keyboard navigation, focus states, screen-reader labels, contrast, and reduced motion?
- Does the UI avoid fake traffic, fake topology, fabricated telemetry, and unsupported live-state implications?
