# GPUValidator Redesign Current State

Date: 2026-07-20
Branch: `hermes-mvp`
Baseline commit: `f11922a docs: establish GPUValidator visual system and redesign workflow`

## Audit-before-modifying summary

This audit was completed before Phase 1 code changes. The existing application is a production-oriented interview/demo portal with real authentication, file-backed persistence, evidence ingestion, benchmark imports, runner APIs, reports, deployment scripts, and test coverage. The redesign must preserve those workflows and improve the visual shell incrementally.

## Application framework

- Frontend: Vite + React 19 SPA.
- Server: Express in `server.ts`, bundled with esbuild for production.
- Python CLI/backend tools: Typer package under `src/ai_validator`.
- Package manager: npm with `package-lock.json`; Python dev install uses `.venv` and `pip install -e ".[dev]"`.

## Routing

Routing is currently manual in `src/App.tsx` via `window.location.pathname`:

- `/login`
- `/portal`
- `/portal/engagements`
- `/portal/engagements/new`
- `/portal/engagements/:id`
- `/portal/library`
- `/portal/library/:slug`
- `/portal/admin/users`
- `/portal/admin/users/new`
- `/portal/admin/users/:id`
- `/portal/admin/demo`
- `/portal/admin/system`

Unauthenticated public routes currently redirect to `/login` by product decision.

## Component structure

Current UI is concentrated in `src/App.tsx`. Existing page-level functions:

- `LoginPage`
- `EngagementShell`
- `EngagementListPage`
- `NewEngagementPage`
- `EngagementDetailPage`
- `OperationsLibraryPage`
- `AdminUsersPage`
- `AdminNewUserPage`
- `AdminUserDetailPage`
- `AdminDemoPage`
- `AdminSystemPage`
- `PortalApp`
- `NotFoundPage`

Reusable primitives are minimal and inline:

- `Panel`
- `EmptyState`
- `EngagementStatusPill`
- helper functions such as `formatDate`

Technical debt: shell, panels, buttons, inputs, tables, badges, dialogs, filters, and page headers are repeated as Tailwind strings inside page functions.

## Styling system and design tokens

- Tailwind CSS v4 is imported from `src/index.css`.
- Existing custom variables use `--nv-*`.
- New GPUValidator tokens exist in `src/styles/tokens.css` and typed tokens in `src/lib/design-tokens.ts`.
- Phase 1 should begin adoption with shared shell/primitives, but avoid a risky all-at-once rewrite of every Tailwind class.

## Current theme

The current theme already broadly matches the references: near-black backgrounds, slate panels, green accent, and Space Grotesk/Inter/JetBrains Mono. Gaps are mostly consistency and structure, not color direction.

## Current application shell

There are two shell patterns:

1. `EngagementShell` for engagements, operations library, and admin pages: horizontal header with nav links.
2. `PortalApp` has its own separate header, scenario controls, evidence selector, main content, and footer.

Reference images require one authenticated application shell with persistent left sidebar and topbar. This is the first high-impact redesign target.

## Existing backend/API integrations

Current authenticated APIs include:

- Auth/session/login/logout routes in `server.ts` and `src/server/auth.ts`.
- Results and reports: `/api/results`, `/api/evidence-sources`, `/reports/:scenario/:format`.
- Engagements: `/api/v1/engagements*`.
- Evidence upload/provenance/activity: `/api/v1/engagements/:id/evidence*`, upload-token routes.
- Benchmark import and definitions: `/api/v1/benchmarks/upload`, `/api/v1/benchmark-definitions`.
- Benchmark execution-plane scaffolding: runner tokens, runner registration, heartbeats, claims, job status/logs/complete/fail, job approval/cancel.
- Intelligence: comparison, findings, readiness, provenance.
- User administration: `/api/v1/admin/users*`.

These are real behavior and must not be replaced by static visuals.

## Authentication, roles, and permissions

- Login uses normalized username and password.
- Session is cookie-backed; current e2e tests validate redirects, invalid credentials, lockout, logout, and protected APIs.
- User roles include administrator, reviewer, and temporary reviewer.
- Admin APIs enforce administrator access and protect last-administrator behavior/session revocation.
- Login-only public experience is intentional in the current product state.

## Live data sources

- Simulated healthy/degraded scenarios from checked-in sample data or generated artifacts.
- File-backed engagement/evidence/benchmark/runner/user stores.
- Live/imported evidence appears only when valid artifacts exist.
- No production telemetry service, Prometheus, Grafana, Datadog, or database integration is currently present.

## Existing tables and charts

Existing tables:

- Engagement list.
- Node comparison.
- Findings.
- Evidence records.
- Benchmark summaries.
- User administration table.
- Operations-library command blocks.

Existing chart/topology-like components:

- SVG login topology visual.
- Portal score/gauge-like sections and health summaries.
- Fabric/GPU/scheduler summaries from `src/portal/assessment.ts`.
- Infrastructure topology section in `PortalApp`.
- Benchmark metric previews.

No dedicated reusable chart-card/topology/rack/heatmap component exists yet.

## Tests and build commands

- `npm run lint`
- `npm run build`
- `npm run test:portal`
- `npm run test:e2e`
- `npm run test:deploy`
- `pytest`
- `npm run design:screenshot`
- `npm run design:compare`

## Deployment constraints

- Production build uses Vite and esbuild.
- Express server serves built frontend and APIs.
- Deployment scripts are secret-safe and `.env.production` must not be sourced as shell code.
- Do not introduce new services, databases, telemetry, cloud dependencies, or required credentials during visual redesign.
- Do not commit generated `dist/`, `node_modules`, temporary screenshots, logs, or secrets.

## Reference coverage

Reference manifest contains 18 entries:

- Canonical app shell/dashboard: `design/references/application/dashboard.png`.
- Application pages: GPU inventory, clusters, cluster detail, validation center, active validation, validation results, benchmark center, NCCL configuration, NCCL results, monitoring, alerts, reports, AI Copilot, settings.
- Authentication: `design/references/authentication/login.png`.
- Marketing/public: `design/references/brand/marketing-homepage.png`.
- Archive: current RC1 login screenshot.

Missing reference coverage:

- No separate generated public features/pricing/docs/company images besides brand/marketing homepage.
- No generated administration-specific users/roles/API-keys/billing images.

## Current pages versus missing pages

Implemented or partial:

- Login: implemented.
- Dashboard/classic portal: implemented at `/portal`, partial visual match.
- Engagements/clusters: implemented at `/portal/engagements`, partial visual match.
- Cluster detail/inventory/validation/results/benchmarks: implemented inside engagement detail and classic portal, not as separate route modules.
- Reports: existing safe report routes and report links, no dedicated report-center route.
- Operations library/integrations reference: implemented.
- Admin users/demo/system: implemented.

Missing or future:

- Standalone `/dashboard`, `/inventory/gpus`, `/clusters`, `/validation`, `/benchmarks`, `/monitoring`, `/alerts`, `/reports`, `/copilot`, `/settings` route modules.
- Public homepage/features/pricing/docs/company pages under current login-only posture.
- SSO, forgot password, invite acceptance, billing/licensing, API key management, real monitoring integrations.

## Reusable components needed

Phase 1 should introduce shared primitives without rewriting business logic:

- `AppShell` / sidebar / topbar.
- Page container and page header.
- Card/panel classes or components.
- Button/input/select/tabs classes.
- Status/severity badge styles.
- Table/filter wrappers.
- Empty/error/loading/skeleton styles.
- Modal/drawer/approval-dialog styles.

## High-risk changes

- Changing auth form IDs/labels or login redirect behavior will break e2e tests.
- Removing existing text such as `Scenario controls`, `Evidence source`, `Private access to GPU infrastructure readiness`, or report links can break tests.
- Creating new route aliases before backend behavior is clear can create false product surfaces.
- Replacing engagement/detail data with generated metrics would undermine product correctness.
- Shell refactor can accidentally remove logout/accessibility/navigation paths.

## Implementation sequence

1. Phase 1 foundation: shared CSS primitives and one authenticated shell used by current authenticated pages.
2. Phase 2 dashboard: redesign `/portal` within the shared shell while preserving scenario/evidence behavior.
3. Phase 3+ route modules only after mapping existing real data and backend capability.
4. Authentication and public marketing pages later, because current login behavior is already intentionally strict.

## Phase 1 acceptance target

- Single authenticated shell pattern for `/portal`, engagement, library, admin, and 404 pages.
- Sidebar/topbar visually aligned with dashboard reference.
- Existing routes remain reachable.
- Tests pass.
- Screenshot smoke works.


## Phase 2 dashboard audit and implementation notes

Completed after commit `9aa93d1 feat(ui): establish GPUValidator application shell` and before the Phase 2 dashboard commit.

### Existing dashboard sections before Phase 2

- Compact Phase 1 page header with scenario controls and evidence-source selector.
- Source context panel with provenance, hardware identity, sanitization, confidence, and limitations.
- Diagnostics tab with readiness score, acceptance status, active findings, category cards, topology, selected-node details, GPU health, InfiniBand/RDMA health, scheduler/orchestration, handoff summary, report access, and interview walkthrough.
- Benchmark tab with supported ingestion families, demonstrated sample benchmark payloads, and future orchestration caveats.

### API-backed and scenario-dependent values used

- `/api/evidence-sources` controls available evidence source options.
- `/api/results?scenario=healthy` and `/api/results?scenario=degraded` provide active `Cluster` payloads.
- `deriveDashboardOverview` now centralizes KPI aggregates: readiness score, total/pass/warning/fail checks, evidence coverage, benchmark count, node count, acceptance status, and category scores.
- Existing acceptance-gate, GPU-health, fabric-health, scheduler, source-context, artifact-link, validation-profile, and benchmark-catalog helpers remain the source of truth.

### Generated-reference values intentionally not copied

The canonical dashboard image shows live operational metrics such as utilization, temperature, power draw, active benchmark jobs, and production cluster counts. The current backend does not expose live telemetry, Prometheus/DCGM streaming, job queues, temperature, or power APIs for `/portal`; Phase 2 therefore maps the composition to truthful validation-domain metrics instead of fabricating those values.

### Phase 2 visual differences from reference

- Composition now matches the reference more closely: compact header, KPI row, main chart/status row, diagnostics table, benchmark summary, acceptance card, evidence/report card, and quick actions.
- Lower detailed diagnostics remain available below the dashboard so existing workflows and tests are preserved.
- `/portal` remains a validation/readiness dashboard, not a live monitoring page.

### Remaining dashboard gaps

- No live utilization/temperature/power telemetry is available yet.
- No active benchmark-job queue is available on `/portal`; benchmark execution-plane APIs exist under engagement workflows and remain future page work.
- Global search remains visual-only from Phase 1.
- Full extraction into separate component files can happen after another page validates the reusable patterns.


## Phase 3 GPU inventory audit and implementation notes

Completed after commit `20a3618 feat(dashboard): redesign infrastructure overview` and before Phase 3 UI implementation.

### Inventory data model findings

- No first-class per-GPU backend object exists. Current APIs expose engagement nodes, accepted evidence records, comparison rows, diagnostic findings, readiness summaries, runner capabilities, and simulated cluster validation payloads.
- Engagement node payloads provide node-level `gpu_model`, `gpu_count`, `driver_version`, `cuda_version`, collection status, validation status, readiness score, and accepted evidence IDs when evidence has been parsed.
- Accepted evidence provenance exposes source command/file/timestamp/checksum for parsed node-level fields through comparison/provenance data. It does not expose per-GPU UUID, serial number, firmware, PCI address, temperatures, power draw, utilization, fan speed, memory usage, ECC counters, PCIe throughput, or NVLink throughput to the frontend inventory route.
- Scenario cluster payloads include validation checks and command evidence summaries for GPU count, driver/CUDA, ECC validation, NVLink validation, DCGM presence/health, and benchmark samples. They remain simulated unless explicitly imported live evidence says otherwise.
- First implementation is read-only. CSV export is generated client-side from currently filtered inventory rows and intentionally excludes storage paths, bundle checksums, raw evidence bodies, and secret-like fields.

### Phase 3 implementation notes

- `/portal/inventory/gpus` uses the existing Phase 1 shell and sidebar.
- Inventory is scoped to all visible engagements and nodes. When no engagement-level GPU rows can be derived, the page falls back to the existing healthy validation scenario and labels it as simulated, not real hardware evidence.
- One inventory row is derived per reported GPU count. Per-GPU unavailable fields are rendered as `Not collected` rather than fabricated.
- Hardware health is not inferred from absent telemetry. The page separates validation status, evidence completeness, and hardware-health unknown/failed/warning derived only from accepted findings or validation failure states.
- Detail drawer sections preserve evidence provenance where comparison cells provide source command/file metadata.


## Deadline sprint pivot — root login and RunPod audit

- Latest completed visual phase: Phase 3 GPU Inventory (`/portal/inventory/gpus`).
- Nonessential visual redesign work is paused until after the July 21, 2026 2:00 PM America/New_York deadline.
- Public root `/` now redirects deterministically to `/login`; the public URL no longer serves a landing or marketing page.
- Authenticated `/login` continues to redirect safely to `/portal`, and unauthenticated protected routes continue to redirect to `/login` or return `401` for API/report requests.
- Direct navigation to `/login` remains supported in production because the Express server serves the SPA fallback after static assets and auth middleware.
- RunPod backend/agent architecture audit is documented in `docs/RUNPOD_MVP_ARCHITECTURE.md`.
- Next implementation step: agent API scaffold and persistence models for outbound-polling RunPod validation jobs.
