import "./HudBottomRail.css";

export type HudSystemTone = "healthy" | "warning" | "critical" | "informational" | "unknown";

export interface HudBottomRailProps {
  systemStateLabel: string;
  systemStateTone?: HudSystemTone;
  dataFreshnessLabel: string;
  dataClassificationLabel: string;
  riskLabel: string;
  riskTone?: HudSystemTone;
  collectorLabel: string;
  sessionLabel: string;
  scopeLabel?: string;
}

interface HudBottomRailCell {
  id: string;
  label: string;
  value: string;
  meta?: string;
  tone: HudSystemTone;
  priority?: "high" | "medium" | "low";
  testId: string;
}

function inferDataTone(value: string, classification: string): HudSystemTone {
  const combined = `${value} ${classification}`.toUpperCase();

  if (combined.includes("LIVE")) {
    return "healthy";
  }

  if (combined.includes("UNKNOWN") || combined.includes("UNAVAILABLE")) {
    return "unknown";
  }

  return "informational";
}

function inferCollectorTone(value: string): HudSystemTone {
  const normalized = value.toUpperCase();

  if (normalized.includes("UNKNOWN") || normalized.includes("UNAVAILABLE")) {
    return "unknown";
  }

  if (normalized.includes("SYNC") || normalized.includes("REGISTERED")) {
    return "informational";
  }

  return "unknown";
}

function inferSessionTone(value: string): HudSystemTone {
  return value.toUpperCase().includes("LIMITED") ? "warning" : "informational";
}

export function HudBottomRail({
  systemStateLabel,
  systemStateTone = "unknown",
  dataFreshnessLabel,
  dataClassificationLabel,
  riskLabel,
  riskTone = "unknown",
  collectorLabel,
  sessionLabel,
  scopeLabel = "GLOBAL / UNKNOWN",
}: HudBottomRailProps) {
  const mobileStateLabel = systemStateTone === "healthy"
    ? "OK"
    : systemStateTone === "warning"
      ? "WARNING"
      : systemStateTone === "critical"
        ? "ALERT"
        : "UNKNOWN";

  const cells: HudBottomRailCell[] = [
    {
      id: "system",
      label: "SYSTEM",
      value: systemStateLabel,
      tone: systemStateTone,
      priority: "high",
      testId: "HudBottomRail-system",
    },
    {
      id: "data",
      label: "DATA",
      value: dataFreshnessLabel,
      meta: dataClassificationLabel,
      tone: inferDataTone(dataFreshnessLabel, dataClassificationLabel),
      priority: "high",
      testId: "HudBottomRail-data",
    },
    {
      id: "risk",
      label: "RISK",
      value: riskLabel,
      tone: riskTone,
      priority: "high",
      testId: "HudBottomRail-risk",
    },
    {
      id: "collectors",
      label: "COLLECTOR / AGENT",
      value: collectorLabel,
      tone: inferCollectorTone(collectorLabel),
      priority: "low",
      testId: "HudBottomRail-collectors",
    },
    {
      id: "session",
      label: "SESSION",
      value: sessionLabel,
      tone: inferSessionTone(sessionLabel),
      priority: "high",
      testId: "HudBottomRail-session",
    },
    {
      id: "scope",
      label: "SCOPE",
      value: scopeLabel,
      tone: "informational",
      priority: "medium",
      testId: "HudBottomRail-scope",
    },
  ];

  return (
    <section
      aria-label="Global system status bus"
      className="hud-bottom-rail"
      data-testid="HudBottomRail"
      role="status"
    >
      <div className="hud-bottom-rail__desktop" aria-hidden="false">
        <div className="hud-bottom-rail__frame">
          <div className="hud-bottom-rail__anchor" aria-hidden="true">
            <span className="hud-bottom-rail__anchor-core" />
            <span className="hud-bottom-rail__anchor-wing hud-bottom-rail__anchor-wing--left" />
            <span className="hud-bottom-rail__anchor-wing hud-bottom-rail__anchor-wing--right" />
          </div>

          <ol className="hud-bottom-rail__cells">
            {cells.map((cell, index) => (
              <li
                key={cell.id}
                aria-label={`${cell.label}: ${cell.value}${cell.meta ? `. ${cell.meta}` : ""}`}
                className="hud-bottom-rail__cell"
                data-cell={cell.id}
                data-priority={cell.priority || "medium"}
                data-testid={cell.testId}
                data-tone={cell.tone}
              >
                <div className="hud-bottom-rail__cell-header">
                  <span className="hud-bottom-rail__cell-node" aria-hidden="true" />
                  <span className="hud-bottom-rail__cell-label">{cell.label}</span>
                  <span className="hud-bottom-rail__cell-index" aria-hidden="true">
                    {(index + 1).toString().padStart(2, "0")}
                  </span>
                </div>
                <div className="hud-bottom-rail__cell-body">
                  <span className="hud-bottom-rail__cell-value">{cell.value}</span>
                  {cell.meta ? <span className="hud-bottom-rail__cell-meta">{cell.meta}</span> : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="hud-bottom-rail__mobile" data-testid="HudBottomRail-mobile">
        <span className="hud-bottom-rail__mobile-node" aria-hidden="true" />
        <span className="hud-bottom-rail__mobile-label">SYSTEM:</span>
        <span className="hud-bottom-rail__mobile-value">{mobileStateLabel}</span>
        <span className="hud-bottom-rail__mobile-separator" aria-hidden="true">•</span>
        <span className="hud-bottom-rail__mobile-meta">{dataClassificationLabel}</span>
      </div>
    </section>
  );
}
