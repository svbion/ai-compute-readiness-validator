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
  const gaugeRadius = 58;
  const circumference = 2 * Math.PI * gaugeRadius;
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
    `validation ${validationLabel}`,
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
      <div className="ai-factory-health-instrument__hero">
        <div className="ai-factory-health-instrument__figure-column">
          <div className="ai-factory-health-instrument__figure" role="img" aria-label={accessibleSummary}>
            <svg className="ai-factory-health-instrument__svg" viewBox="0 0 220 220" aria-hidden="true">
              <defs>
                <linearGradient id="ai-factory-health-instrument-progress" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--ai-health-semantic-soft)" />
                  <stop offset="100%" stopColor="var(--ai-health-semantic-strong)" />
                </linearGradient>
                <linearGradient id="ai-factory-health-instrument-structural" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="rgba(72, 232, 255, 0.9)" />
                  <stop offset="100%" stopColor="rgba(17, 107, 255, 0.62)" />
                </linearGradient>
              </defs>

              <circle className="ai-factory-health-instrument__grid-ring" cx="110" cy="110" r="80" />
              <circle className="ai-factory-health-instrument__grid-ring ai-factory-health-instrument__grid-ring--inner" cx="110" cy="110" r="58" />

              {Array.from({ length: 24 }).map((_, index) => {
                const angle = index * 15;
                const isMajor = index % 3 === 0;
                return (
                  <line
                    key={`tick-${angle}`}
                    className={`ai-factory-health-instrument__tick ${isMajor ? "ai-factory-health-instrument__tick--major" : ""}`}
                    x1="110"
                    y1={isMajor ? "18" : "24"}
                    x2="110"
                    y2={isMajor ? "30" : "34"}
                    transform={`rotate(${angle} 110 110)`}
                  />
                );
              })}

              <path className="ai-factory-health-instrument__structural-arc" d="M 43 110 A 67 67 0 0 1 177 110" />
              <path className="ai-factory-health-instrument__structural-arc ai-factory-health-instrument__structural-arc--lower" d="M 62 146 A 50 50 0 0 0 158 146" />
              <path className="ai-factory-health-instrument__calibration-sweep" d="M 110 36 A 74 74 0 0 1 184 110" />

              <circle className="ai-factory-health-instrument__score-track" cx="110" cy="110" r={gaugeRadius} />
              <circle
                className="ai-factory-health-instrument__score-progress"
                cx="110"
                cy="110"
                r={gaugeRadius}
                pathLength={circumference}
                strokeDasharray={circumference}
                strokeDashoffset={progressOffset}
                transform="rotate(-90 110 110)"
              />

              <circle className="ai-factory-health-instrument__core-shell" cx="110" cy="110" r="38" />
              <polygon className="ai-factory-health-instrument__center-geometry" points="110,74 133,86 144,110 133,134 110,146 87,134 76,110 87,86" />
              <circle className="ai-factory-health-instrument__center-node" cx="110" cy="110" r="5" />
            </svg>

            <div className="ai-factory-health-instrument__center">
              <span className="ai-factory-health-instrument__center-label">Health score</span>
              <strong id="ai-factory-health-score" data-testid="AiFactoryHealthInstrument-score">
                {normalizedScore}%
              </strong>
              <span className="ai-factory-health-instrument__center-state">{readinessLabel}</span>
            </div>
          </div>
        </div>

        <div className="ai-factory-health-instrument__status-block">
          <span className="ai-factory-health-instrument__status-kicker">Readiness classification</span>
          <strong
            className="ai-factory-health-instrument__classification-value"
            data-testid="AiFactoryHealthInstrument-classification"
          >
            {classificationLabel}
          </strong>
          <div className="ai-factory-health-instrument__status-row">
            <span className="ai-factory-health-instrument__state-chip">{readinessLabel}</span>
            <span className="ai-factory-health-instrument__data-label">{dataLabel}</span>
          </div>

          <div className="ai-factory-health-instrument__summary-grid" aria-label="Status summary">
            {summaryRows.map((row) => (
              <div key={row.label} className="ai-factory-health-instrument__summary-row" data-tone={row.tone ?? "neutral"}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="ai-factory-health-instrument__primary-grid">
        <article className="ai-factory-health-instrument__detail-card ai-factory-health-instrument__detail-card--reason">
          <span className="ai-factory-health-instrument__detail-label">Reason</span>
          <strong data-testid="AiFactoryHealthInstrument-reason">{reason}</strong>
        </article>

        <article className="ai-factory-health-instrument__detail-card ai-factory-health-instrument__detail-card--scope">
          <span className="ai-factory-health-instrument__detail-label">Affected scope</span>
          <strong data-testid="AiFactoryHealthInstrument-affected-scope">{affectedScope}</strong>
        </article>
      </div>

      <div className="ai-factory-health-instrument__telemetry-strip">
        <article className="ai-factory-health-instrument__telemetry-item">
          <span className="ai-factory-health-instrument__detail-label">Evidence confidence</span>
          <strong>{evidenceLabel}</strong>
          <small>{validationLabel}</small>
        </article>

        <article className="ai-factory-health-instrument__telemetry-item">
          <span className="ai-factory-health-instrument__detail-label">Current state</span>
          <strong>{currentStateText}</strong>
        </article>
      </div>

      <div className="ai-factory-health-instrument__footer-band">
        <article className="ai-factory-health-instrument__next-action">
          <span className="ai-factory-health-instrument__detail-label">Recommended next action</span>
          <strong>{nextAction}</strong>
        </article>

        <div className="ai-factory-health-instrument__actions">
          <button type="button" onClick={onTriggerScan} disabled={loading} className="ai-factory-health-instrument__action ai-factory-health-instrument__action--primary">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Running" : "Run scan"}
          </button>
          <button type="button" onClick={onOpenExport} className="ai-factory-health-instrument__action ai-factory-health-instrument__action--secondary">
            <FileText className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      <p id="ai-factory-health-summary" className="ai-factory-health-instrument__summary-copy">
        {accessibleSummary}
      </p>
    </section>
  );
}