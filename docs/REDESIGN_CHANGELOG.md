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
