export const gvColors = {
  canvas: "#030610",
  elevated: "#07111d",
  panel: "#08111c",
  card: "#0b1522",
  cardMuted: "#0f1b2a",
  borderDefault: "rgba(41, 55, 75, 0.74)",
  borderStrong: "rgba(76, 93, 116, 0.9)",
  accent: "#76b900",
  accentHover: "#8ae300",
  textPrimary: "#f8fafc",
  textSecondary: "#cbd5e1",
  textMuted: "#94a3b8",
  success: "#76b900",
  info: "#22d3ee",
  warning: "#f59e0b",
  high: "#fb7185",
  critical: "#ef4444",
  purple: "#a78bfa",
} as const;

export const gvChartPalette = {
  semantic: {
    healthy: gvColors.success,
    warning: gvColors.warning,
    high: gvColors.high,
    critical: gvColors.critical,
    info: gvColors.info,
    neutral: "#64748b",
  },
  categorical: [gvColors.accent, gvColors.info, gvColors.purple, gvColors.warning, gvColors.high, "#38bdf8"],
  heatmap: ["#111827", "#1f3b18", "#3f6212", gvColors.accent, gvColors.warning, gvColors.critical],
} as const;

export type GvSeverity = "info" | "low" | "medium" | "high" | "critical";
export type GvHealthState = "healthy" | "degraded" | "warning" | "critical" | "unknown";
export type GvTopologyState = "online" | "degraded" | "isolated" | "offline" | "unknown";

export const gvSeverityColors: Record<GvSeverity, string> = {
  info: gvColors.info,
  low: gvColors.success,
  medium: gvColors.warning,
  high: gvColors.high,
  critical: gvColors.critical,
};

export const gvHealthScoreBands = [
  { id: "critical", min: 0, max: 69, color: gvColors.critical, label: "Critical" },
  { id: "warning", min: 70, max: 84, color: gvColors.warning, label: "Needs attention" },
  { id: "degraded", min: 85, max: 94, color: gvColors.high, label: "Degraded" },
  { id: "healthy", min: 95, max: 100, color: gvColors.success, label: "Healthy" },
] as const;

export const gvTopologyStateColors: Record<GvTopologyState, string> = {
  online: gvColors.success,
  degraded: gvColors.warning,
  isolated: gvColors.high,
  offline: gvColors.critical,
  unknown: "#64748b",
};

export const gvDimensions = {
  maxContentWidth: 1536,
  sidebarWidth: 248,
  sidebarCollapsedWidth: 76,
  topbarHeight: 64,
  pagePaddingX: 24,
  pagePaddingY: 28,
  gridGap: 20,
  cardPadding: 20,
  drawerWidth: 420,
  modalWidth: 680,
  screenshotViewports: [
    { width: 1536, height: 1024, name: "desktop" },
    { width: 1440, height: 900, name: "laptop" },
    { width: 1280, height: 800, name: "compact" },
  ],
} as const;

export const gvMotion = {
  fast: 120,
  default: 180,
  slow: 260,
  easeStandard: "cubic-bezier(0.16, 1, 0.3, 1)",
} as const;

export const gvStatusTone = {
  approved: gvColors.success,
  ready: gvColors.success,
  running: gvColors.info,
  queued: gvColors.info,
  warning: gvColors.warning,
  remediationRequired: gvColors.warning,
  failed: gvColors.critical,
  blocked: gvColors.critical,
  simulated: gvColors.warning,
} as const;
