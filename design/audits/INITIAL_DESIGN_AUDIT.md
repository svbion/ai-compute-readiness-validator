# Initial GPUValidator Design Audit

Date: 2026-07-20
Scope: design references, current React portal, global styles, routes, screenshot readiness. Business logic was not modified.

## Strengths
- Existing app already uses the correct dark GPU-operations direction: near-black canvas, slate panels, white text, green accent.
- Login page has strong cinematic direction and accessible labels.
- Current portal preserves real data contracts and clearly distinguishes simulated evidence.
- Playwright already exists, making screenshot workflow low-risk.

## Critical findings
None introduced by this preparation work.

## High findings
1. Application shell fragmentation: current `/portal`, engagement pages, library, and admin pages use separate header/navigation patterns rather than the canonical sidebar/topbar shell.
2. Route gap: most generated application references map to missing or partial routes; current functionality is concentrated in `/portal` and `/portal/engagements`.
3. Generated reference text must not be copied literally; product behavior and safety language in existing docs are more trustworthy.
4. Approval/remediation workflows need stronger visual separation before benchmark execution or destructive admin actions are visually redesigned.

## Medium findings
1. Token gap: existing CSS uses `--nv-*` and many inline Tailwind color literals; new `--gv-*` tokens are now available but not yet adopted page-by-page.
2. Reusable component gap: cards, panels, status pills, tables, filters, and modals are implemented inline in `src/App.tsx`.
3. Accessibility risks: modals need stronger focus trapping in future componentization; chart/diagram alternatives should be formalized.
4. Screenshot baselines do not yet exist for all routes.

## Low findings
1. Existing RC1 screenshot is useful as archive but is not canonical generated reference.
2. Alerts reference uses a purple accent; use it only for workflow-specific assistant/automation affordances.
3. Public reference coverage is incomplete; only brand/marketing image was discovered for public direction.

## Conflicting or review-needed references
- `marketing-homepage.png` is categorized under brand because no public folder export exists. Review before enabling marketing routes.
- Application pages are visually consistent, but some page text and metrics appear generated and should be treated as placeholders.
- `ai-copilot.png` implies functionality not implemented today; implementation must show evidence and approval requirements if/when built.

## Functionality-over-imitation rules
- Do not remove login-only public behavior to match marketing imagery without a product decision.
- Do not fake live monitoring, AI recommendations, or benchmark results.
- Preserve evidence provenance, simulated-data warnings, and security constraints even if reference layouts omit them.
