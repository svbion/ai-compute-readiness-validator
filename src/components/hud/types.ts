export const HUD_PANEL_STATES = [
  "default",
  "active",
  "selected",
  "healthy",
  "warning",
  "critical",
  "informational",
  "disabled",
] as const;

export type HudPanelState = (typeof HUD_PANEL_STATES)[number];
