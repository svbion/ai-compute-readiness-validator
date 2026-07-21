# GPUValidator Design Reference Library

This directory contains generated visual references, design manifests, implementation screenshots, comparison outputs, prompts, and audits for the GPUValidator redesign.

## Structure
```text
design/
├── references/
│   ├── brand/
│   ├── public/
│   ├── authentication/
│   ├── application/
│   ├── administration/
│   └── archive/
├── implementation-screenshots/
│   ├── baseline/
│   ├── current/
│   ├── comparisons/
│   └── live/              # optional uncommitted/strictly reviewed live captures
├── audits/
├── prompts/
└── manifests/
```

## Canonical references
- Application shell: `design/references/application/dashboard.png`
- Marketing/public direction: `design/references/brand/marketing-homepage.png`
- Authentication: `design/references/authentication/login.png`

No separate generated public homepage export was discovered under a public reference directory; the brand/marketing image is therefore the canonical public homepage direction for this pass.

## Inventory and routes
- Image inventory: `design/manifests/reference-images.json`
- Route architecture: `design/manifests/routes.json`

Each image manifest entry includes source, normalized file path, dimensions, category, route, canonical status, duplicate notes, and implementation notes.

## Naming rules
Use lowercase kebab-case filenames. Prefer page IDs from `routes.json`: `dashboard.png`, `gpu-inventory.png`, `validation-center.png`. Archive old/current implementation screenshots under `references/archive/` or `implementation-screenshots/`, not beside canonical references.

## Screenshot workflow
Recommended viewport: 1536 x 1024. Supported viewports: 1536 x 1024, 1440 x 900, 1280 x 800.

Commands:
```bash
npm run design:screenshot -- --route=/login --name=login
npm run design:screenshot -- --route=/portal --name=dashboard
npm run design:screenshot:all
npm run design:compare -- --reference=design/references/authentication/login.png --current=design/implementation-screenshots/current/login-1536x1024.png
```

The screenshot script builds the app, starts the production server with deterministic reviewer credentials, logs in when needed, disables nonessential motion, waits for fonts/charts, and writes PNGs to `design/implementation-screenshots/current/`.

## Page implementation order
1. Design tokens and global styles
2. Application shell, sidebar, topbar
3. Shared page header, cards, status/health, chart containers, tables
4. Dashboard
5. GPU inventory
6. Clusters and cluster detail
7. Validation center, active validation, validation results
8. Benchmark center, NCCL configuration, NCCL results
9. Monitoring, alerts, reports, AI Copilot, settings
10. Login
11. Public homepage, pricing, documentation

## Design drift reporting
Use `design/prompts/audit-design-drift.md`. Report drift with file path, component/page, token violation, screenshot evidence if available, severity, and proposed code change. Favor code fixes over written-only feedback.

## Phase status
- Phase 1 foundation and authenticated shell: see `docs/REDESIGN_CHANGELOG.md`.
- Phase 2 `/portal` dashboard redesign: see `docs/REDESIGN_CHANGELOG.md`.
- Phase 3 `/portal/inventory/gpus` GPU inventory redesign: read-only derived inventory from engagement/node/evidence/comparison data with simulated scenario fallback labeling; see `docs/REDESIGN_CHANGELOG.md`.
- Current-state audit before code changes: see `docs/REDESIGN_CURRENT_STATE.md`.


## RunPod Step 5 screenshots

Deterministic fixture screenshots for the live-agent integration are committed under `design/implementation-screenshots/current/`:

- `runpod-agent-online.png`
- `runpod-hardware-validation.png`
- `runpod-gpu-inventory.png`
- `runpod-agent-offline.png`

These use fixture API responses and are not proof of live RunPod hardware. If live screenshots are captured later, store them under `design/implementation-screenshots/live/` and review/remove sensitive UUIDs, hostnames, IPs, tokens, URLs, and account identifiers before committing.


Step 6 validation-result screenshot:

- `design/implementation-screenshots/current/runpod-validation-results.png`

This is fixture-backed. Live validation screenshots, if captured later, must go under `design/implementation-screenshots/live/` after reviewing UUIDs, hostnames, IPs, URLs, and credentials.
