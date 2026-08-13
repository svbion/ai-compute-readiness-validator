# JARVIS Motion and VFX Specification

Version: 1.0
Status: Approved design-specification target
Scope: Motion, hologram, animation, interaction feedback, and performance-aware VFX rules
Related references:
- docs/design/JARVIS_VISUAL_SYSTEM.md
- docs/design/JARVIS_COMPONENT_SPEC.md
- docs/design/JARVIS_PAGE_SYSTEM.md
- docs/design/references/GPUVALIDATOR_JARVIS_REFERENCE.png

## 1. Purpose

JARVIS motion and VFX must communicate state, flow, scope, and evidence relationships. Motion exists to clarify infrastructure meaning, not to decorate the interface.

Permitted emotional qualities:
- precise
- restrained
- cinematic
- scientific
- enterprise-operational

Prohibited motion qualities:
- playful
- chaotic
- game-like
- fake traffic simulation
- random particle spectacle
- continuous non-informational pulsing

## 2. Rendering approach guidance

Future implementation may combine:
- SVG for rings, icons, flows, gauges, callout lines, and graph overlays
- CSS transforms and opacity for panel and shell motion
- Canvas or WebGL only for justified complex topology or hologram layers

Default preference order:
1. CSS transforms/opacity
2. SVG animation
3. canvas
4. WebGL only when simpler layers cannot achieve the required density or performance

Reason:
- CSS/SVG are easier to keep accessible, deterministic, and inspectable.
- WebGL should not become the default implementation path for every glow or chart.

## 3. Motion principles

1. Motion must explain state.
2. Motion must follow actual visible paths.
3. Motion must settle quickly into a readable static state.
4. Reduced-motion mode must preserve utility.
5. No page should require constant animation to feel complete.
6. One-shot emphasis beats perpetual pulsing.
7. Critical motion must be rare enough to retain meaning.

## 4. Timing system

### 4.1 Duration tokens
- --motion-instant: 90ms
- --motion-fast: 140ms
- --motion-ui: 180ms
- --motion-emphasis: 240ms
- --motion-panel: 320ms
- --motion-page: 420ms
- --motion-trace: 560ms
- --motion-hologram-init: 900ms
- --motion-investigation: 1200ms

### 4.2 Easing tokens
- --ease-standard: cubic-bezier(0.22, 1, 0.36, 1)
- --ease-decelerate: cubic-bezier(0.16, 1, 0.3, 1)
- --ease-accelerate: cubic-bezier(0.55, 0, 0.9, 0.45)
- --ease-emphasis: cubic-bezier(0.2, 0.9, 0.2, 1)
- --ease-linear-soft: linear

### 4.3 Delay tokens
- --stagger-xs: 30ms
- --stagger-sm: 50ms
- --stagger-md: 70ms

## 5. Hologram system

The hologram is the signature VFX layer of the redesign. It must look projected, layered, and technical.

### 5.1 Hologram layers
1. Projection base: radial rings, floor grid, range ticks.
2. Core light: faint center emission or reactor node.
3. Vertical projection beam: cyan column or sliced beam.
4. Object layer: rack/node/device wireframes or volumetric silhouettes.
5. Overlay lines: callout leaders, selected paths, subsystem halos.
6. Atmospherics: minimal bloom, sparse depth particles only when encoding activity.

### 5.2 Hologram color rules
- Default structure: cyan + deep blue
- Healthy overlay: green accents only on relevant objects
- Warning overlay: amber object edge and indicator labels
- Critical overlay: red path or perimeter emphasis only on affected scope
- NCCL / collective path: purple
- Validation sweep: yellow

### 5.3 Hologram effect inventory
Allowed effects:
- transparent wireframes
- projected grid
- vertical light projection
- rotating reference rings
- subtle depth/parallax
- edge bloom
- data callouts
- scan sweeps
- typed path tracing

Disallowed effects:
- volumetric smoke
- lens flare bursts
- random lightning or energy arcs
- fake background traffic
- exaggerated rotation that impairs label reading
- perpetual orbiting elements without informational purpose

### 5.4 Hologram movement limits
- Ring rotation speed: max 4 degrees/sec for idle rings
- Secondary ring counter-rotation: max 2 degrees/sec
- Vertical beam pulse cycle: 3.5-5.5 sec, opacity-only drift
- Parallax offset: max 8 px on large desktop, 0 px in reduced motion
- Particle count: keep under 24 simultaneously visible particles in the main hologram area unless those particles represent real events

## 6. Animation specifications by interaction

### 6.1 Panel entrance
Purpose:
- Establish hierarchy without theatrical motion.

Spec:
- duration: 320ms
- easing: --ease-standard
- properties: opacity 0 -> 1, translateY(10px) -> 0, optional border-brightness settle
- stagger: 30-50ms across peer panels

Reduced motion:
- opacity fade only, 120ms

### 6.2 Page transition
Purpose:
- Preserve shell continuity while signaling page change.

Spec:
- keep top bar, nav rail, bottom rail persistent
- crossfade/slide only page body region
- duration: 420ms
- easing: --ease-standard
- outgoing: opacity 1 -> 0, translateX(-8px) or translateY(8px)
- incoming: opacity 0 -> 1, translateX(8px) or translateY(8px)

Reduced motion:
- opacity crossfade only, 160ms

### 6.3 Hologram initialization
Purpose:
- Establish the page centerpiece.

Spec:
- total duration: 900ms
- step 1: base rings fade in and scale from 0.96 to 1.00 over 220ms
- step 2: vertical beam rises over 260ms
- step 3: object silhouettes materialize from low-opacity wireframe over 320ms
- step 4: callouts fade in over 180ms

Reduced motion:
- static hologram appears with 160ms opacity fade, no beam rise or ring motion

### 6.4 Node selection
Purpose:
- Clarify selected scope.

Spec:
- selected object bloom: 180ms
- surrounding topology dim: 180ms
- optional camera center/pan: 240ms max
- callout emphasis: 140ms

Reduced motion:
- no camera motion; selected state changes through border, color, and inspector update only

### 6.5 Topology tracing
Purpose:
- Show evidence-backed path through represented infrastructure.

Spec:
- duration: 560ms for short path, up to 900ms for multi-hop path
- easing: linear-soft
- path stroke draw-on + glow head
- tail settles into persistent lit path at 45-60% intensity

Special semantics:
- NVLink path: cyan-blue with typed label
- NCCL path: purple and explicitly labeled collective path
- Validation traversal: yellow directional sweep
- Critical fault path: red but only for affected scope

Reduced motion:
- path appears statically with brief opacity fade; no travel head

### 6.6 Validation progression
Purpose:
- Show work moving through the pipeline.

Spec:
- stage activation: 180ms ring or icon brighten
- connector sweep: 240ms
- active stage accent: validation yellow
- completed stages settle to green or cyan based on semantic meaning

Reduced motion:
- direct stage state change without moving sweeps

### 6.7 Benchmark execution
Purpose:
- Indicate benchmark stages or comparative overlays.

Spec:
- progress sweep across benchmark modules: 240ms
- curve draw-in: 320ms when chart first mounts
- regression marker reveal: 180ms pulse-once then static

Reduced motion:
- show final curves and markers immediately with opacity fade only

### 6.8 Alert escalation
Purpose:
- Draw attention without constant alarm behavior.

Spec:
- one-shot outer edge pulse: 700ms total
- red edge brighten then decay to persistent critical border
- optional sparkline flash-in: 180ms
- no infinite pulsing for stable critical alerts

Reduced motion:
- no pulse; static red edge + icon + text only

### 6.9 Evidence linking
Purpose:
- Show connection between finding and source.

Spec:
- evidence chip highlight: 140ms
- link line or row highlight: 180ms
- drawer expansion: 240ms

Reduced motion:
- static highlight and open state only

### 6.10 Copilot reasoning
Purpose:
- Reveal structured reasoning steps.

Spec:
- sequence: Observation -> Evidence -> Inference -> Confidence -> Recommendation -> Risk -> Approval
- each block reveal: 120-180ms with 40ms stagger
- optional supporting AI graphic remains subdued and secondary

Reduced motion:
- render all sections immediately with only minor fade

### 6.11 Hover
Purpose:
- Provide precision feedback.

Spec:
- duration: 140ms
- properties: border brighten, background tint lift, icon glow gain
- no object drift or floating lift larger than 2 px

### 6.12 Focus
Purpose:
- Accessible clarity for keyboard users.

Spec:
- duration: 90ms
- properties: outer 2 px visible ring plus slight edge brighten
- focus ring color should remain readable over cyan borders

### 6.13 Button activation
Purpose:
- Confirm successful action.

Spec:
- duration: 180ms
- press-in scale: max 0.98
- fill intensification + edge flash
- return to settled active/inactive state

## 7. Microinteraction catalog

### 7.1 Hover node
- edge illuminates
- label/callout sharpens
- inspector preview available
- no large movement

### 7.2 Select node
- camera centers or object recenters
- surrounding topology dims
- inspector updates
- selection ring settles into persistent highlight

### 7.3 Alert event
- affected infrastructure pulses red once
- alert card edge brightens
- related path or scope marker may illuminate

### 7.4 Validation event
- yellow sweep traverses represented scope or pipeline stage path
- final state settles to success, warning, or critical

### 7.5 NCCL investigation
- purple collective path illumination traces the actual represented route class
- label must state collective or benchmark context

### 7.6 Healthy resolve
- green state resolves without constant pulsing
- use brief brighten and settle only

### 7.7 Evidence open
- edge highlight transfers from conclusion block to evidence block or drawer
- keeps provenance visually close to conclusion

## 8. Background effect system

### 8.1 Technical grid
- low-opacity line grid at 32-48 px spacing
- optional secondary subgrid at 8 px spacing below 3% opacity

### 8.2 Moving scan
- very subtle vertical or horizontal scan band
- cycle 8-14 seconds minimum
- opacity under 5%
- must pause in reduced-motion mode

### 8.3 Radar/range markings
- rings, ticks, and azimuth-like guides are acceptable in topology/fabric contexts
- use when they communicate spatial scope, not as random decoration

### 8.4 Ambient cyan light
- slow opacity breathing or static radial illumination
- cycle 4-7 seconds if animated
- amplitude very low

### 8.5 Data particles
- allowed only when tied to activity, path tracing, or selection anchors
- random particle noise prohibited

## 9. Page-by-page VFX guidance

### 9.1 Mission Control
- strongest centerpiece hologram
- restrained panel motion
- occasional waveform activity in top bar
- validation and alert sweeps only when state changes

### 9.2 AI Factory
- signature spatial hologram
- zoom progression transitions between Factory -> Room -> Row -> Rack -> Node -> GPU
- inspector panels respond to selection state

### 9.3 Topology
- path tracing is primary motion language
- typed overlay modes switch with fast crossfade
- no decorative 3D if 2D graph is more accurate

### 9.4 Benchmarks
- performance curves and radial comparisons animate only on first reveal or filter change
- baseline overlays remain static and precise

### 9.5 Evidence
- provenance graph emphasizes link reveals between Validation -> Evidence -> Source -> Finding -> Recommendation
- evidence should feel inspectable, not magical

### 9.6 Alerts
- critical conditions receive red edge illumination
- risk matrix may highlight affected quadrants once on update

### 9.7 Investigations
- root-cause graph can illuminate traversal chain step by step
- strongest use of evidence-link motion after AI Factory

### 9.8 Copilot
- structured reasoning reveal
- restrained holographic AI secondary figure only
- no chat-bubble theatrics

### 9.9 Settings
- lowest VFX intensity in the authenticated product
- preserve shell identity but reduce motion to focus, drawer, and status transitions

## 10. Reduced-motion specification

When prefers-reduced-motion is enabled:
- disable idle ring rotation
- disable scan sweeps
- disable parallax
- disable traveling particle effects
- disable camera pans and zooms where possible
- replace traces with static illuminated paths
- replace stage sweeps with direct state changes
- preserve focus visibility and status clarity

Static equivalents required for:
- hologram initialization
- topology tracing
- validation progression
- benchmark progression
- alert escalation
- copilot reasoning flow

## 11. Performance budget

Target:
- 60 FPS on supported desktop hardware for ordinary interaction

Rules:
- animate transform and opacity before layout-affecting properties
- avoid layout thrashing
- limit backdrop blur to a small set of elevated panels only
- keep simultaneous strongly glowing elements under 8 on a typical page
- lazy-load complex visualizations
- pause off-screen animations
- debounce high-frequency data redraws
- cap particle counts aggressively
- avoid full-screen repaint effects when a local overlay will do
- use requestAnimationFrame or compositor-friendly animation paths when implemented

Suggested budgets:
- panel entry animation: CSS only
- mini charts: SVG preferred
- main hologram idle loop: 1-3 animated layers maximum if SVG/CSS; additional complexity only with performance justification
- blur radius: generally <= 16 px for elevated glass, <= 8 px for nested surfaces

## 12. Mobile and small-screen VFX reduction

Mobile does not reproduce the full desktop HUD.

Mobile rules:
- convert holograms to simplified 2D technical visualizations
- remove idle ring rotation
- reduce glow intensity by 40-60%
- remove non-essential beam and scan effects
- use mission-feed transitions instead of large spatial camera motion
- prioritize legibility, selection state, and evidence access

## 13. Accessibility and safety constraints

- no flashing above safe thresholds
- no rapid red blinking
- no critical meaning conveyed only by animation
- all animated charts/graphs need accessible text summaries
- screen-reader users must receive state changes through text, not motion alone

## 14. Implementation recommendation

Implement VFX in this order:
1. Focus/hover/selection states
2. Panel and page transitions
3. Pipeline progression
4. Evidence-link transitions
5. Typed topology tracing
6. Hologram initialization and idle motion
7. Optional advanced spatial effects only after performance validation

## 15. Status

This document defines the approved motion and VFX rules for the future JARVIS redesign. It is documentation only and does not implement application code.