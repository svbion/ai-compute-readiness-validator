# GPUValidator Redesign Implementation Plan

Purpose: prepare a page-by-page redesign without breaking current authentication, APIs, file-backed persistence, evidence ingestion, benchmark imports, runner scaffolding, or report access.

## Guardrails
- Preserve existing behavior; visual redesign is not feature development.
- Do not replace real integrations with mock data where APIs already exist.
- Use typed fixtures only for pages with no backend contract yet.
- Keep generated-image text subordinate to product docs and implemented behavior.
- Maintain login-only public access unless a separate product decision changes it.
- Run lint/build and relevant tests after each phase.

## Phase plan

### 1. Design tokens
Scope: adopt `src/styles/tokens.css` and `src/lib/design-tokens.ts` as styling vocabulary.
Inputs: reference images, `docs/DESIGN_SYSTEM.md`.
Expected files: token files, global style imports.
Acceptance: build/lint pass; no behavior changes.
Risks: Tailwind v4 theme interactions.
Screenshots: login and `/portal` before/after.
Tests: `npm run lint`, `npm run build`.

### 2. Global styles and typography
Scope: normalize body, fonts, focus, scrollbars, reduced motion.
Files: `src/index.css`, possible `src/styles/global.css`.
Acceptance: existing portal still renders and fonts load.
Risks: existing Tailwind class assumptions.

### 3. Application shell
Scope: reusable sidebar, topbar, page container, right rail.
Files: new `src/components/shell/*` or equivalent.
Acceptance: `/portal`, engagements, library, admin pages share shell without route loss.
Risks: manual router and auth redirects.

### 4. Sidebar
Scope: canonical navigation, active states, collapsed behavior.
Acceptance: no duplicated per-page sidebars; keyboard accessible.
Screenshots: dashboard, inventory, validation center.

### 5. Top navigation
Scope: search/context selector, user menu, status cluster, alerts entry.
Risks: exposing secrets or private server state; keep status summaries safe.

### 6. Shared page header
Scope: eyebrow/title/description/action pattern.
Acceptance: all redesigned pages use same component.

### 7. Shared card system
Scope: card, panel, KPI card, alert card, command card.
Risks: over-generalizing before pages are migrated.

### 8. Shared status and health components
Scope: badges, severity, readiness score, acceptance gate.
Acceptance: critical remains visually distinct; semantic colors consistent.

### 9. Shared chart containers
Scope: chart shell, legends, empty states, accessible summaries.
Risks: D3 layout changes; no brittle animation tests.

### 10. Shared table system
Scope: dense technical tables, filters, row hover, provenance actions.
Risks: responsive overflow and keyboard navigation.

### 11. Dashboard
Scope: redesign `/portal` using `dashboard.png` while preserving scenario controls and evidence-source behavior.
Acceptance: existing e2e scenario tests pass; screenshot captured.

### 12. GPU Inventory
Scope: lift existing node/evidence facts into inventory page when route exists.
Inputs: `gpu-inventory.png`, engagement APIs.
Risks: duplicating engagement detail data flows.

### 13. Clusters and Cluster Detail
Scope: cluster list/detail composition from engagement/readiness APIs.
Acceptance: no fake live hardware claims.

### 14. Validation Center, Active Validation, Results
Scope: validation workflows, status lists, results dashboards.
Risks: active-run pages must respect read-only/approval gates.

### 15. Benchmark Center, NCCL Configuration, NCCL Results
Scope: benchmark import/readiness and controlled execution-plane surfaces.
Risks: execution approval cannot look like ordinary navigation; no interactive shell.

### 16. Monitoring, Alerts, Reports, AI Copilot, Settings
Scope: later application pages. Use fixtures only where no backend exists and clearly mark as non-live.

### 17. Login
Scope: align existing login with canonical generated login while preserving username/password session auth.
Acceptance: e2e login tests pass; no public registration/social login added.

### 18. Public Homepage, Pricing, Documentation
Scope: marketing redesign only after product decision to re-enable public pages.
Risks: current login-only production posture.

## Validation gates for every page
- `npm run lint`
- `npm run build`
- Relevant `npm run test:portal` or `npm run test:e2e -- --grep ...`
- `npm run design:screenshot -- --route=<route> --name=<page-id>`
- Compare against reference using `npm run design:compare -- --reference=<reference> --current=<current>`
- Manual accessibility review using `design/prompts/review-accessibility.md`

## Functionality that must not be replaced with mock data
- Authentication/session behavior.
- Evidence source discovery.
- Scenario results and reports.
- Engagement CRUD.
- Evidence upload tokens and provenance.
- Benchmark imports and benchmark job approval state.
- Runner registration/heartbeat/job APIs.
- User administration and audit history.
