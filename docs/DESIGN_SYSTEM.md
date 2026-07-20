# GPUValidator Design System

Status: canonical for the redesign preparation phase. Generated reference images are guidance; this document and `src/styles/tokens.css` control reusable styling.

## 1. Design principles
- Authenticated pages are operational tools first: dense technical data is acceptable, but hierarchy must stay clear.
- Public pages may be more cinematic, with dramatic GPU/datacenter imagery and larger marketing typography.
- Neon green is an accent, not a page background.
- Avoid glowing every component. Glow is for primary CTAs, selected navigation, active topology nodes, and high-value health indicators.
- Critical severity must remain visually distinct from normal validation failures and from the green brand accent.
- AI-generated recommendations must show evidence, confidence, and approval requirements.
- Destructive or remediation actions must not look like ordinary navigation.
- Real product behavior and accessibility take priority over inaccurate generated-image text or pixel-level imitation.

## 2. Brand identity
Use `GPU Validator` in UI headings and `GPUValidator` only where a compact product wordmark is needed. The mark is a small geometric GPU/fabric symbol paired with a bright green wordmark on dark backgrounds. Do not imply NVIDIA affiliation; NVIDIA green is a visual compatibility cue only.

Logo treatment:
- Dark background: compact green icon plus white/green wordmark.
- Light background: not currently represented; use the dark mark inside a dark chip until a light mark is approved.
- Favicon/compact mark: green topology/GPU glyph in a near-black square or circle.

## 3. Color tokens
Source of truth: `src/styles/tokens.css` and typed mirror `src/lib/design-tokens.ts`.

Core colors:
- Canvas: `--gv-bg-canvas` `#030610`
- Elevated: `--gv-bg-elevated` `#07111d`
- Panel: `--gv-bg-panel` `#08111c`
- Card: `--gv-bg-card` `#0b1522`
- Muted card: `--gv-bg-card-muted` `#0f1b2a`
- Border: `--gv-border-default`
- Strong border: `--gv-border-strong`
- Accent: `--gv-accent` `#76b900`
- Accent hover: `--gv-accent-hover` `#8ae300`
- Text primary/secondary/muted/faint: `#f8fafc`, `#cbd5e1`, `#94a3b8`, `#64748b`
- Success/info/warning/high/critical: green, cyan, amber, rose, red.

Chart rules:
- Health and success: green.
- Informational throughput/fabric: cyan.
- Warnings and simulated/demo labels: amber.
- High severity: rose.
- Critical blockers/destructive actions: red.
- Purple is reserved for secondary assistant/automation or special workflow accents, not normal health.

Heatmaps progress from graphite to dark green to NVIDIA green; warning and critical overlays override the scale.

## 4. Typography
Existing fonts match the references and remain preferred:
- Sans/body: Inter.
- Display/headings: Space Grotesk.
- Mono/data labels: JetBrains Mono.

Scale:
- Display/marketing: 56-64 px, 700, tight tracking.
- Page title: 32-40 px, 600-700.
- Section heading: 20-24 px, 600.
- Card heading: 15-18 px, 600.
- Metric: 28-44 px, 600-700, tabular where possible.
- Body: 14-16 px, 400-500, line-height 1.55-1.75.
- Supporting text: 12-14 px.
- Table text: 12-13 px, dense but readable.
- Labels: 10-11 px mono uppercase, tracking 0.16-0.24em.

## 5. Spacing
Use the token scale in `tokens.css`. Standard page padding is 24 px horizontal and 28 px vertical. Grid gap is 20 px. Card padding is 20 px. Dense tables may use 10-12 px cell padding but must keep line height readable.

## 6. Layout
Canonical viewport is 1536 x 1024. Application pages use a left sidebar, top utility bar, main content, and optional right insight rail. Max content width is 1536 px. Laptop behavior at 1440 x 900 should preserve the sidebar and reduce right-rail density. At 1280 x 800, secondary rails may collapse below content.

## 7. Sidebar
Width: 248 px expanded, 76 px collapsed. Active item uses green text, subtle green background, and a left accent line/pill. The sidebar is persistent in authenticated pages and must not be reimplemented page-by-page.

## 8. Top navigation
Height: 64 px. Contains search/context, environment selector, status indicators, alerts, user menu. Keep the topbar visually quiet; do not compete with page KPIs.

## 9. Page headers
Headers include eyebrow label, title, concise description, and primary actions. Dangerous actions live in an approval area or secondary menu, never in the same visual treatment as navigation.

## 10. Cards and KPI cards
Cards use dark slate surfaces, subtle borders, 20 px padding, and restrained shadows. KPI cards include label, value, delta/status, and optional sparkline. Use green only for healthy/positive states; do not color every KPI green.

## 11. Buttons
Primary: green fill, dark text, medium radius. Secondary: transparent/dark with slate border. Destructive: red border/fill and explicit wording. Approval-required actions use amber or red treatment plus confirmation context.

## 12. Inputs, selects, tabs, badges
Inputs and selects use dark backgrounds, slate border, visible green focus ring, and labels. Tabs use an active panel/underline state, not heavy glow. Badges are mono uppercase for system state and normal case for content labels.

## 13. Health and severity indicators
Health indicators: healthy, warning, degraded, critical, unknown. Severity indicators: info, low, medium, high, critical. Critical must always be red and must be visible without relying on glow alone.

## 14. Tables and filters
Tables can be dense. Maintain sticky header where useful, row hover, right-aligned numeric columns, and visible sort/filter affordances. Do not hide evidence provenance; technical confidence depends on traceability.

## 15. Drawers, modals, toasts, alerts
Drawers: 420 px default, from right. Modals: 680 px default. Both require focus trap, escape close, and visible titles. Toasts are for ephemeral non-critical feedback; blockers need inline alerts near the affected workflow.

## 16. Charts, gauges, heatmaps
Charts use tokenized palettes and semantic assignments. Gauges should include number, label, threshold context, and accessible text alternative. Heatmaps must include legend and avoid rainbow scales.

## 17. GPU topology, racks, infrastructure maps
Topology diagrams use green active nodes, cyan fabric paths, amber degraded paths, red failed nodes. Rack visualizations prioritize slot/node readability over decorative realism. Infrastructure maps should show evidence freshness and uncertainty.

## 18. Command snippets and log viewers
Use monospace, dark terminal background, copy button, safety badge, and line wrapping. Mutating commands require warning badges. Logs must support search/filter and should preserve timestamps without exposing secrets.

## 19. Loading, empty, and error states
Loading: skeletons or quiet spinners; avoid full-page flashy animation. Empty states explain what data is missing and how to get it. Error states show cause, recovery action, and whether existing data remains trustworthy.

## 20. Approval workflows
Any remediation, runner execution, benchmark job approval, token creation, user disablement, or credential reset requires explicit action language, audit trail context, and visual separation from browsing.

## 21. Accessibility
All controls need labels, visible focus, keyboard paths, reduced-motion support, and sufficient contrast. Charts require text summaries. Tables need semantic headers. Modals/drawers require focus management.

## 22. Responsive behavior
1536 x 1024 is the design baseline. 1440 x 900 and 1280 x 800 are required screenshot targets. Mobile support is functional rather than pixel-perfect during the first redesign wave.

## 23. Animation
Motion is subtle: 120-260 ms transitions. Disable nonessential animation under `prefers-reduced-motion`. Avoid constant scanlines or moving backgrounds in authenticated data pages.

## 24. Anti-patterns
- Neon green page backgrounds.
- Rainbow charts without semantic meaning.
- Cyberpunk glow on every surface.
- Duplicated sidebar/topbar per page.
- Mock data replacing existing APIs.
- Copying nonsensical generated text.
- Critical and warning states that look like brand decoration.
- Public marketing drama inside dense operations workflows.

## 25. Reference-image priority rules
1. Preserve real behavior and data contracts.
2. Follow this design-system document and tokens.
3. Use canonical references: dashboard for application shell, login for auth, marketing-homepage for public pages.
4. Use page-specific references for composition.
5. Treat generated labels/content as placeholders unless validated against product docs.
