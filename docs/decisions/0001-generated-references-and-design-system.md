# Decision 0001: Generated references and design-system authority

Date: 2026-07-20

## Decision
Generated reference images are visual guidance, not executable product requirements. The permanent design-system document (`docs/DESIGN_SYSTEM.md`) and centralized tokens (`src/styles/tokens.css`, `src/lib/design-tokens.ts`) control reusable styling. The canonical application shell reference controls navigation and page framing for authenticated pages.

## Consequences
- Real product behavior takes priority over inaccurate generated-image text.
- Accessibility and operational usability take priority over pixel-level imitation.
- Page implementation agents must compare against references but fix code only when changes preserve existing functionality.
- Public marketing imagery does not override the current login-only production posture.
