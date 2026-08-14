import { useEffect, useMemo, useState } from "react";
import { Moon, Sun } from "lucide-react";
import "./HudTopBar.css";

export type HudTopBarTone = "healthy" | "warning" | "critical" | "unknown";

export interface HudTopBarProps {
  environmentLabel: string;
  systemStateLabel: string;
  systemStateTone?: HudTopBarTone;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  userLabel: string;
  userMeta?: string;
  scopeLabel?: string;
}

function formatClock(date: Date) {
  return new Intl.DateTimeFormat([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function formatAccessibleTime(date: Date) {
  return new Intl.DateTimeFormat([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function HudTopBar({
  environmentLabel,
  systemStateLabel,
  systemStateTone = "unknown",
  isDarkMode,
  onToggleTheme,
  userLabel,
  userMeta = "Authenticated reviewer",
  scopeLabel = "GLOBAL / UNKNOWN",
}: HudTopBarProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "Local time", []);
  const visibleTime = useMemo(() => formatClock(now), [now]);
  const accessibleTime = useMemo(() => formatAccessibleTime(now), [now]);
  const themeLabel = isDarkMode ? "JARVIS" : "DAYLIGHT";
  const compactStateLabel = systemStateTone === "healthy"
    ? "OK"
    : systemStateTone === "warning"
      ? "WARN"
      : systemStateTone === "critical"
        ? "ALERT"
        : "UNKNOWN";

  return (
    <header className="hud-top-bar" data-testid="HudTopBar">
      <div className="hud-top-bar__shell">
        <div className="hud-top-bar__plate hud-top-bar__plate--identity">
          <div className="hud-top-bar__identity-mark" aria-hidden="true">
            <svg viewBox="0 0 48 48" className="hud-top-bar__mark-svg" focusable="false">
              <defs>
                <linearGradient id="hud-top-bar-mark-gradient" x1="0%" x2="100%" y1="0%" y2="100%">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
                  <stop offset="50%" stopColor="currentColor" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0.3" />
                </linearGradient>
              </defs>
              <polygon points="24,3 38,11 44,24 38,37 24,45 10,37 4,24 10,11" fill="none" stroke="url(#hud-top-bar-mark-gradient)" strokeWidth="1.5" />
              <path d="M17 24.5h8.75l4.5-8.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
              <path d="M17 24.5l6.75 10.5h7.75" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
              <circle cx="17" cy="24.5" r="2.2" fill="currentColor" />
              <circle cx="30.25" cy="16.25" r="2" fill="currentColor" />
              <circle cx="31.5" cy="35" r="2" fill="currentColor" />
            </svg>
          </div>

          <div className="hud-top-bar__identity-copy">
            <span className="hud-top-bar__product">GPUValidator</span>
            <span className="hud-top-bar__descriptor">AI INFRASTRUCTURE MISSION CONTROL</span>
          </div>
        </div>

        <div className="hud-top-bar__plate hud-top-bar__plate--context">
          <div className="hud-top-bar__clock-cluster">
            <span className="hud-top-bar__label">JARVIS TIME</span>
            <time
              className="hud-top-bar__clock"
              dateTime={now.toISOString()}
              aria-label={`${accessibleTime} ${timeZone}`}
              aria-live="off"
            >
              {visibleTime}
            </time>
          </div>

          <div className="hud-top-bar__context-copy">
            <span className="hud-top-bar__banner">AI FACTORY OPERATIONS EXPERIENCE</span>
            <span className="hud-top-bar__scope">{scopeLabel}</span>
          </div>

          <div className="hud-top-bar__waveform" aria-hidden="true">
            <svg viewBox="0 0 280 44" preserveAspectRatio="none" focusable="false">
              <defs>
                <linearGradient id="hud-top-bar-wave-gradient" x1="0%" x2="100%" y1="0%" y2="0%">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
                  <stop offset="22%" stopColor="currentColor" stopOpacity="0.65" />
                  <stop offset="50%" stopColor="currentColor" stopOpacity="1" />
                  <stop offset="78%" stopColor="currentColor" stopOpacity="0.65" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path className="hud-top-bar__waveform-line hud-top-bar__waveform-line--primary" d="M0 21.5 L20 21.5 L30 20 L40 22.5 L52 20.5 L62 22 L74 21 L86 22.5 L98 20.5 L112 22 L126 21.5 L138 19 L150 10 L160 23 L172 20 L184 22.5 L196 20.5 L208 22 L220 21 L232 22.5 L244 20.5 L256 22 L268 21.5 L280 21.5" />
              <path className="hud-top-bar__waveform-line hud-top-bar__waveform-line--secondary" d="M0 21.5 L12 21.5 L18 21 L24 22 L30 21.5 L36 23 L42 20.5 L48 22 L54 21 L60 22.5 L66 20.5 L72 21.5 L78 22.5 L84 20.5 L90 21.5 L96 23 L102 20.5 L108 21.5 L114 22.5 L120 21 L126 22.5 L132 20.5 L138 21.5 L144 22.5 L150 21 L156 19 L162 23 L168 20.5 L174 22.5 L180 21 L186 22.5 L192 20.5 L198 21.5 L204 22.5 L210 20.5 L216 21.5 L222 22.5 L228 20.5 L234 21.5 L240 23 L246 20.5 L252 21.5 L258 22.5 L264 21 L270 21.5 L280 21.5" />
            </svg>
          </div>
        </div>

        <div className="hud-top-bar__plate hud-top-bar__plate--controls">
          <div className="hud-top-bar__control-block">
            <span className="hud-top-bar__label">ENVIRONMENT</span>
            <span className="hud-top-bar__value hud-top-bar__value--environment">{environmentLabel}</span>
          </div>

          <button
            type="button"
            className="hud-top-bar__theme-toggle"
            onClick={onToggleTheme}
            aria-label={isDarkMode ? "Activate light theme" : "Activate dark theme"}
            title={isDarkMode ? "Activate light theme" : "Activate dark theme"}
          >
            <span className="hud-top-bar__theme-ring" aria-hidden="true">
              {isDarkMode ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
            </span>
            <span className="hud-top-bar__theme-copy">
              <span className="hud-top-bar__label">THEME</span>
              <span className="hud-top-bar__value">{themeLabel}</span>
            </span>
          </button>

          <div className="hud-top-bar__control-block" data-state-tone={systemStateTone}>
            <span className="hud-top-bar__label">SYSTEM STATE</span>
            <span className="hud-top-bar__state-pill">
              <span className="hud-top-bar__state-pill-full">{systemStateLabel}</span>
              <span className="hud-top-bar__state-pill-compact">{compactStateLabel}</span>
            </span>
          </div>

          <div className="hud-top-bar__user-chip">
            <span className="hud-top-bar__user-avatar" aria-hidden="true">
              {userLabel.slice(0, 1).toUpperCase()}
            </span>
            <span className="hud-top-bar__user-copy">
              <span className="hud-top-bar__value">{userLabel}</span>
              <span className="hud-top-bar__user-meta">{userMeta}</span>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
