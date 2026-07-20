# GPUValidator Redesign Changelog

## Phase 1 — Foundation and authenticated shell

Date: 2026-07-20
Status: implemented and validated.

### Routes redesigned

- `/portal` now renders inside the shared authenticated shell.
- `/portal/engagements` and `/portal/engagements/*` continue to use the shell through `EngagementShell`.
- `/portal/library` and `/portal/library/*` continue to use the shell through `EngagementShell`.
- `/portal/admin/users`, `/portal/admin/demo`, and `/portal/admin/system` continue to use the shell through `EngagementShell`.
- `/login` is intentionally unchanged in this phase except for inherited global tokens/styles.

### Components added

- `AppLogo` in `src/App.tsx`.
- Shared shell navigation metadata in `src/App.tsx`.
- Tokenized CSS primitives in `src/index.css`:
  - `gv-app-shell`
  - `gv-sidebar`
  - `gv-topbar`
  - `gv-content`
  - `gv-page-header`
  - `gv-card`
  - `gv-select`
  - `gv-badge`
  - `gv-button-secondary`

### Components refactored

- `EngagementShell` was redesigned from a horizontal header shell into the canonical sidebar/topbar shell.
- `PortalApp` now uses `EngagementShell` instead of maintaining a separate header/footer shell.

### Components removed

- No components were deleted. The previous duplicate `/portal` header/footer pattern was removed from `PortalApp` markup.

### Behavior preserved

- Login/session/logout behavior.
- Scenario controls and evidence source selection.
- Existing `/portal` diagnostics and benchmark tabs.
- Engagement, library, admin, and system-health routes.
- Existing backend/API integrations and real data fetching.
- Existing read-only reviewer posture.

### Behavior changed

- Authenticated routes now share a left sidebar and topbar visual frame.
- `/portal` page header was compacted into a reusable page-header pattern inside the shell.
- Shell navigation links point only to currently reachable routes; future intended product sections are represented only where they can route safely to existing behavior.

### Screenshots captured

- `design/implementation-screenshots/current/phase1-dashboard-1536x1024.png`
- `design/implementation-screenshots/current/phase1-dashboard-1440x900.png`
- `design/implementation-screenshots/current/phase1-dashboard-1280x800.png`
- `design/implementation-screenshots/comparisons/phase1-dashboard-vs-reference.png`

Comparison note: the Phase 1 screenshot is a shell/foundation comparison against `design/references/application/dashboard.png`, not a completed dashboard-page redesign. Dashboard content drift is expected until Phase 2.

### Tests run

- `npm run lint`
- `npm run build`
- `npm run test:portal`
- `npm run test:e2e`
- `npm run test:deploy`
- `pytest`
- `npm run design:screenshot -- --route=/portal --name=phase1-dashboard --viewport=1536x1024`
- `npm run design:screenshot -- --route=/portal --name=phase1-dashboard --viewport=1440x900`
- `npm run design:screenshot -- --route=/portal --name=phase1-dashboard --viewport=1280x800`
- `npm run design:compare -- --reference=design/references/application/dashboard.png --current=design/implementation-screenshots/current/phase1-dashboard-1536x1024.png --output=design/implementation-screenshots/comparisons/phase1-dashboard-vs-reference.png --threshold=1`

Validation results: lint passed, production build passed, portal tests passed 56/56, Playwright e2e passed 18 with 2 expected mobile-only skips, deployment shell tests passed, Python tests passed 44/44, screenshot capture passed at all three required desktop/laptop viewports, and screenshot comparison artifact was generated.

### Known gaps

- Standalone route modules such as `/inventory/gpus`, `/clusters`, `/validation`, `/benchmarks`, `/monitoring`, `/alerts`, `/reports`, `/copilot`, and `/settings` are not implemented in Phase 1.
- Shell global search is visual-only; real global search backend/route behavior is not implemented yet.
- Sidebar is desktop/laptop-first; mobile keeps topbar access and existing responsive content but does not yet include a collapsible mobile drawer.
- Many page-level cards/tables still contain Tailwind literals; full primitive migration is incremental.

### Next phase

Phase 2 should redesign the main `/portal` dashboard content against `design/references/application/dashboard.png`, preserving scenario controls, evidence-source selection, report links, and existing acceptance-gate behavior.

## Phase 2 — Dashboard redesign

Date: 2026-07-20
Status: implemented and validated.

### Routes redesigned

- `/portal` dashboard content only. No Phase 3+ pages were started.

### Components added

- `DashboardKpiCard`
- `StatusProgressRow`
- `ReadinessGauge`
- `DashboardChartCard`
- `deriveDashboardOverview` helper in `src/portal/assessment.ts`

### Components refactored

- `PortalApp` dashboard content was reorganized into a production dashboard hierarchy inside the Phase 1 shell.
- Scenario controls and evidence-source selector remain in the compact page header.
- Existing detailed diagnostics and benchmark tabs remain available below the dashboard summary.

### Behavior preserved

- Healthy/degraded scenario switching.
- Evidence-source switching and provenance display.
- Acceptance-gate logic and report links.
- Diagnostics detail expansion, selected-node logic, GPU/fabric/scheduler summaries.
- Benchmark readiness tab and existing benchmark payload display.
- Authentication and protected route behavior.

### Data mappings

- KPI validation score uses `cluster.overall_score`.
- Pass/warning/fail/unavailable counts derive from `getAllChecks(cluster)`.
- Evidence coverage counts validation checks with attached command evidence.
- Node and GPU scope use existing cluster nodes and `deriveGpuHealth`.
- Category chart uses `cluster.metadata.category_averages`.
- Acceptance panel uses `deriveAcceptanceGate`.
- Benchmark summary uses `cluster.benchmark_results` and `buildBenchmarkCatalog`.
- Report activity uses `buildSourceContext` and `buildArtifactLinks`.

### Generated-reference elements intentionally omitted

- Live GPU utilization, temperature, power consumption, real active benchmark jobs, uptime, and production cluster totals were not copied because the current `/portal` backend does not expose those telemetry/job APIs.
- The dashboard uses validation-domain metrics instead of fabricated operational telemetry.

### Screenshots captured

- `design/implementation-screenshots/current/phase2-dashboard-1536x1024.png`
- `design/implementation-screenshots/current/phase2-dashboard-1440x900.png`
- `design/implementation-screenshots/current/phase2-dashboard-1280x800.png`
- `design/implementation-screenshots/comparisons/phase2-dashboard-vs-reference.png`

Visual comparison note: `changed_ratio=0.198496` against the generated reference. The top-level dashboard structure now aligns with the reference more closely, but the ratio is not lower than Phase 1 because the implementation intentionally uses truthful validation/readiness content rather than copying unavailable telemetry widgets such as live utilization, temperature, power, and active job queues.

### Tests run

- Added targeted `deriveDashboardOverview` tests in `tests-portal/assessment.test.ts`.
- `npm run lint`
- `npm run build`
- `npm run test:portal`
- `npm run test:e2e`
- `npm run test:deploy`
- `pytest`
- `npm run design:screenshot -- --route=/portal --name=phase2-dashboard --viewport=1536x1024`
- `npm run design:screenshot -- --route=/portal --name=phase2-dashboard --viewport=1440x900`
- `npm run design:screenshot -- --route=/portal --name=phase2-dashboard --viewport=1280x800`
- `npm run design:compare -- --reference=design/references/application/dashboard.png --current=design/implementation-screenshots/current/phase2-dashboard-1536x1024.png --output=design/implementation-screenshots/comparisons/phase2-dashboard-vs-reference.png --threshold=1`

Validation results: lint passed, production build passed, portal tests passed 58/58, Playwright e2e passed 18 with 2 expected mobile-only skips, deployment shell tests passed, Python tests passed 44/44, screenshot capture passed at all three required viewports, and comparison artifact was generated.

### Known gaps

- Global search remains visual-only.
- Live telemetry cards require future backend integrations.
- Standalone inventory, clusters, validation, benchmark, monitoring, alerts, reports, Copilot, settings, auth, and public marketing pages remain future phases.

### Next phase

Phase 3 should redesign GPU inventory workflows only after mapping existing engagement/node/GPU evidence into a truthful inventory page or route.
