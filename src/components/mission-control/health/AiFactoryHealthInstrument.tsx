import "./AiFactoryHealthInstrument.css";
import { FileText, RefreshCw } from "lucide-react";

export type AiFactoryHealthInstrumentState = "healthy" | "warning" | "critical" | "unknown" | "scanning";

type AiFactoryHealthInstrumentSummaryRow = {
  label: string;
  value: string;
  tone?: "healthy" | "warning" | "critical" | "unknown" | "neutral";
};

export interface AiFactoryHealthInstrumentProps {
  score: number;
  classification: string;
  state: AiFactoryHealthInstrumentState;
  reason: string;
  affectedScope: string;
  evidenceLabel: string;
  validationLabel: string;
  nextAction: string;
  currentStateText: string;
  dataLabel: string;
  loading: boolean;
  onOpenExport: () => void;
  onTriggerScan: () => void;
  summaryRows: AiFactoryHealthInstrumentSummaryRow[];
}

const STATE_LABELS: Record<AiFactoryHealthInstrumentState, string> = {
  healthy: "Healthy",
  warning: "Warning",
  critical: "Critical",
  unknown: "Unknown",
  scanning: "Scanning",
};

const STATE_STRAPLINES: Record<AiFactoryHealthInstrumentState, string> = {
  healthy: "Operational readiness remains within accepted validation tolerance.",
  warning: "Readiness is degraded and requires targeted follow-up review.",
  critical: "Blocking findings are active and operational readiness is compromised.",
  unknown: "Readiness cannot be classified from the currently available evidence.",
  scanning: "Validation is actively collecting evidence for updated readiness classification.",
};

const orbitLabels = [
  { key: "north", label: "EVIDENCE", value: "TRACE" },
  { key: "east", label: "SCOPE", value: "AFFECTED" },
  { key: "south", label: "ACTION", value: "NEXT" },
  { key: "west", label: "STATE", value: "LIVE" },
] as const;

export function AiFactoryHealthInstrument({
  score,
  classification,
  state,
  reason,
  affectedScope,
  evidenceLabel,
  validationLabel,
  nextAction,
  currentStateText,
  dataLabel,
  loading,
  onOpenExport,
  onTriggerScan,
  summaryRows,
}: AiFactoryHealthInstrumentProps) {
  const normalizedScore = Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0;
  const circumference = 2 * Math.PI * 74;
  const progressOffset = circumference * (1 - normalizedScore / 100);
  const classificationLabel = classification?.trim() ? classification : STATE_LABELS[state];
  const readinessLabel = STATE_LABELS[state];
  const accessibleSummary = [
    `AI Factory Health ${readinessLabel}`,
    `health score ${normalizedScore} percent`,
    `classification ${classificationLabel}`,
    `reason ${reason}`,
    `affected scope ${affectedScope}`,
    `evidence ${evidenceLabel}`,
    `current state ${currentStateText}`,
    `next action ${nextAction}`,
  ].join(". ");

  return (
    <section
      className="ai-factory-health-instrument"
      data-health-state={state}
      data-testid="AiFactoryHealthInstrument"
      aria-labelledby="ai-factory-health-score"
      aria-describedby="ai-factory-health-summary"
    >
      <div className="ai-factory-health-instrument__headerband">
        <div>
          <p className="ai-factory-health-instrument__kicker">AI FACTORY HEALTH</p>
          <strong className="ai-factory-health-instrument__banner">{STATE_STRAPLINES[state]}</strong>
        </div>
        <div className="ai-factory-health-instrument__classification-cluster">
          <span className="ai-factory-health-instrument__classification-label">Readiness classification</span>
          <strong
            className="ai-factory-health-instrument__classification-value"
            data-testid="AiFactoryHealthInstrument-classification"
          >
            {classificationLabel}
          </strong>
          <span className="ai-factory-health-instrument__data-label">{dataLabel}</span>
        </div>
      </div>

      <div className="ai-factory-health-instrument__layout">
        <div className="ai-factory-health-instrument__figure-column">
          <div className="ai-factory-health-instrument__figure-shell">
            <div className="ai-factory-health-instrument__summary-rail" aria-label="Status summary">
              <span className="ai-factory-health-instrument__summary-heading">Status summary</span>
              {summaryRows.map((row) => (
                <div key={row.label} className="ai-factory-health-instrument__summary-row" data-tone={row.tone ?? "neutral"}>
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>

            <div
              className="ai-factory-health-instrument__figure"
              role="img"
              aria-label={accessibleSummary}
            >
              <svg className="ai-factory-health-instrument__svg" viewBox="0 0 280 280" aria-hidden="true">
                <defs>
                  <linearGradient id="ai-factory-health-instrument-progress" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--ai-health-semantic-soft)" />
                    <stop offset="100%" stopColor="var(--ai-health-semantic-strong)" />
                  </linearGradient>
                  <linearGradient id="ai-factory-health-instrument-structural" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="rgba(72, 232, 255, 0.92)" />
                    <stop offset="100%" stopColor="rgba(17, 107, 255, 0.72)" />
                  </linearGradient>
                </defs>

                <circle className="ai-factory-health-instrument__grid-ring" cx="140" cy="140" r="112" />
                <circle className="ai-factory-health-instrument__grid-ring ai-factory-health-instrument__grid-ring--middle" cx="140" cy="140" r="94" />
                <circle className="ai-factory-health-instrument__grid-ring ai-factory-health-instrument__grid-ring--inner" cx="140" cy="140" r="62" />

                {Array.from({ length: 48 }).map((_, index) => {
                  const angle = index * 7.5;
                  const isMajor = index % 6 === 0;
                  return (
                    <line
                      key={`tick-${angle}`}
                      className={`ai-factory-health-instrument__tick ${isMajor ? "ai-factory-health-instrument__tick--major" : ""}`}
                      x1="140"
                      y1={isMajor ? "20" : "30"}
                      x2="140"
                      y2={isMajor ? "34" : "38"}
                      transform={`rotate(${angle} 140 140)`}
                    />
                  );
                })}

                {Array.from({ length: 12 }).map((_, index) => {
                  const dashLength = circumference / 18;
                  const gapLength = circumference / 40;
                  return (
                    <circle
                      key={`segment-${index}`}
                      className="ai-factory-health-instrument__segment-band"
                      cx="140"
                      cy="140"
                      r="74"
                      pathLength={100}
                      strokeDasharray={`${dashLength} ${gapLength}`}
                      strokeDashoffset={index * (circumference / 12)}
                      transform="rotate(-90 140 140)"
                    />
                  );
                })}

                <path
                  className="ai-factory-health-instrument__structural-arc"
                  d="M 49 140 A 91 91 0 0 1 231 140"
                />
                <path
                  className="ai-factory-health-instrument__structural-arc ai-factory-health-instrument__structural-arc--lower"
                  d="M 73 188 A 74 74 0 0 0 207 188"
                />

                <circle className="ai-factory-health-instrument__score-track" cx="140" cy="140" r="74" />
                <circle
                  className="ai-factory-health-instrument__score-progress"
                  cx="140"
                  cy="140"
                  r="74"
                  pathLength={circumference}
                  strokeDasharray={circumference}
                  strokeDashoffset={progressOffset}
                  transform="rotate(-90 140 140)"
                />

                <circle className="ai-factory-health-instrument__core-shell" cx="140" cy="140" r="48" />
                <polygon className="ai-factory-health-instrument__center-geometry" points="140,84 167,97 181,140 167,183 140,196 113,183 99,140 113,97" />
                <circle className="ai-factory-health-instrument__center-node" cx="140" cy="140" r="6" />
                <path className="ai-factory-health-instrument__calibration-sweep" d="M 140 44 A 96 96 0 0 1 236 140" />
              </svg>

              <div className="ai-factory-health-instrument__center">
                <span className="ai-factory-health-instrument__center-label">Health score</span>
                <strong id="ai-factory-health-score" data-testid="AiFactoryHealthInstrument-score">
                  {normalizedScore}%
                </strong>
                <span className="ai-factory-health-instrument__center-state">{readinessLabel}</span>
                <span className="ai-factory-health-instrument__center-classification">{classificationLabel}</span>
              </div>

              {orbitLabels.map((orbit) => (
                <div
                  key={orbit.key}
                  className={`ai-factory-health-instrument__orbit-label ai-factory-health-instrument__orbit-label--${orbit.key}`}
                >
                  <span>{orbit.label}</span>
                  <strong>{orbit.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="ai-factory-health-instrument__callouts">
          <article className="ai-factory-health-instrument__callout ai-factory-health-instrument__callout--reason">
            <span className="ai-factory-health-instrument__callout-label">Reason</span>
            <strong data-testid="AiFactoryHealthInstrument-reason">{reason}</strong>
          </article>
          <article className="ai-factory-health-instrument__callout ai-factory-health-instrument__callout--scope">
            <span className="ai-factory-health-instrument__callout-label">Affected scope</span>
            <strong data-testid="AiFactoryHealthInstrument-affected-scope">{affectedScope}</strong>
          </article>
          <article className="ai-factory-health-instrument__callout">
            <span className="ai-factory-health-instrument__callout-label">Evidence confidence</span>
            <strong>{evidenceLabel}</strong>
            <small>{validationLabel}</small>
          </article>
          <article className="ai-factory-health-instrument__callout">
            <span className="ai-factory-health-instrument__callout-label">Current state</span>
            <strong>{currentStateText}</strong>
            <small>{readinessLabel} state remains visible independent of color.</small>
          </article>
          <article className="ai-factory-health-instrument__callout ai-factory-health-instrument__callout--action">
            <span className="ai-factory-health-instrument__callout-label">Recommended next action</span>
            <strong>{nextAction}</strong>
          </article>
        </div>
      </div>

      <div className="ai-factory-health-instrument__actions">
        <button type="button" onClick={onTriggerScan} disabled={loading} className="ai-factory-health-instrument__action ai-factory-health-instrument__action--primary">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Validation running" : "Run validation scan"}
        </button>
        <button type="button" onClick={onOpenExport} className="ai-factory-health-instrument__action ai-factory-health-instrument__action--secondary">
          <FileText className="h-4 w-4" />
          Evidence report
        </button>
      </div>

      <p id="ai-factory-health-summary" className="ai-factory-health-instrument__summary-copy">
        {accessibleSummary}
      </p>
    </section>
  );
}
