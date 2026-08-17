import { AlertTriangle, ArrowRight, CheckCircle2, ShieldAlert } from "lucide-react";
import { HudPanel, HudPanelHeader } from "../../hud";
import type { HudPanelState } from "../../hud";
import "./CriticalConditionsPanel.css";

export const SUPPORTED_CRITICAL_CONDITION_SEVERITIES = [
  "critical",
  "warning",
  "informational",
  "unknown",
] as const;

export type CriticalConditionSeverity =
  (typeof SUPPORTED_CRITICAL_CONDITION_SEVERITIES)[number];

export type CriticalConditionEvidenceState =
  | "available"
  | "partial"
  | "unavailable";

export interface CriticalConditionRecord {
  id: string;
  title: string;
  severity: CriticalConditionSeverity;
  affectedScope?: string | null;
  subsystem?: string | null;
  evidenceState: CriticalConditionEvidenceState;
  evidenceSummary: string;
  recommendation?: string | null;
  stateLabel?: string | null;
  onSelect?: () => void;
}

export interface CriticalConditionsPanelProps {
  conditions: CriticalConditionRecord[];
  panelStatus: Extract<
    HudPanelState,
    "default" | "healthy" | "warning" | "critical" | "informational"
  >;
  activeCount: number;
  affectedScopeCount?: number;
  nominalContext: string;
  titleId?: string;
  className?: string;
  maxVisible?: number;
}

const evidenceStateLabels: Record<CriticalConditionEvidenceState, string> = {
  available: "EVIDENCE AVAILABLE",
  partial: "EVIDENCE PARTIAL",
  unavailable: "EVIDENCE UNAVAILABLE",
};

const severityLabels: Record<CriticalConditionSeverity, string> = {
  critical: "CRITICAL",
  warning: "WARNING",
  informational: "INFORMATIONAL",
  unknown: "UNKNOWN",
};

const severityOrder: Record<CriticalConditionSeverity, number> = {
  critical: 4,
  warning: 3,
  informational: 2,
  unknown: 1,
};

export function CriticalConditionsPanel({
  conditions,
  panelStatus,
  activeCount,
  affectedScopeCount = 0,
  nominalContext,
  titleId = "jarvis-critical-title",
  className,
  maxVisible = 3,
}: CriticalConditionsPanelProps) {
  const rankedConditions = [...conditions].sort(
    (left, right) => severityOrder[right.severity] - severityOrder[left.severity]
  );
  const visibleConditions = rankedConditions.slice(0, maxVisible);
  const overflowCount = Math.max(rankedConditions.length - visibleConditions.length, 0);

  return (
    <HudPanel
      className={[
        "jarvis-shell-panel",
        "jarvis-shell-panel--critical",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      labelledBy={titleId}
      status={panelStatus}
    >
      <div
        className="critical-conditions-panel"
        data-testid="CriticalConditionsPanel"
      >
        <HudPanelHeader
          eyebrow="CRITICAL CONDITIONS"
          icon={<ShieldAlert />}
          metadata={
            affectedScopeCount > 0
              ? `${affectedScopeCount} AFFECTED SCOPE${
                  affectedScopeCount === 1 ? "" : "S"
                }`
              : "NO ACTIVE SCOPE"
          }
          status={activeCount > 0 ? `${activeCount} ACTIVE` : "NOMINAL"}
          title="Critical Conditions"
          titleId={titleId}
        />

        {visibleConditions.length > 0 ? (
          <div className="critical-conditions-panel__stack" role="list">
            {visibleConditions.map((condition, index) => {
              const ItemTag = condition.onSelect ? "button" : "article";
              const recommendation =
                condition.recommendation?.trim() ||
                "Recommendation unavailable in current findings.";
              const stateLabel = condition.stateLabel?.trim() || "UNKNOWN";

              return (
                <ItemTag
                  key={condition.id}
                  type={condition.onSelect ? "button" : undefined}
                  className={[
                    "critical-conditions-panel__item",
                    `critical-conditions-panel__item--${condition.severity}`,
                    `critical-conditions-panel__item--evidence-${condition.evidenceState}`,
                  ].join(" ")}
                  onClick={condition.onSelect}
                  role="listitem"
                >
                  <span
                    className="critical-conditions-panel__severity-rail"
                    aria-hidden="true"
                  />

                  <div className="critical-conditions-panel__frame">
                    <div className="critical-conditions-panel__topline">
                      <span className="critical-conditions-panel__index">
                        C-{String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="critical-conditions-panel__severity">
                        {severityLabels[condition.severity]}
                      </span>
                    </div>

                    <div className="critical-conditions-panel__heading-row">
                      <h4>{condition.title}</h4>
                      <AlertTriangle
                        className="critical-conditions-panel__alert-icon"
                        aria-hidden="true"
                      />
                    </div>

                    <div className="critical-conditions-panel__scope-grid">
                      <div>
                        <span>Affected scope</span>
                        <strong>
                          {condition.affectedScope?.trim() || "UNKNOWN SCOPE"}
                        </strong>
                      </div>
                      <div>
                        <span>Subsystem</span>
                        <strong>
                          {condition.subsystem?.trim() || "UNKNOWN SUBSYSTEM"}
                        </strong>
                      </div>
                      <div>
                        <span>Severity</span>
                        <strong>{severityLabels[condition.severity]}</strong>
                      </div>
                      <div>
                        <span>State</span>
                        <strong>{stateLabel}</strong>
                      </div>
                    </div>

                    <div className="critical-conditions-panel__divider" aria-hidden="true" />

                    <div className="critical-conditions-panel__evidence-block">
                      <div className="critical-conditions-panel__signal-line">
                        <span>Evidence</span>
                        <strong>{evidenceStateLabels[condition.evidenceState]}</strong>
                      </div>
                      <p>{condition.evidenceSummary}</p>
                    </div>

                    <div className="critical-conditions-panel__action-line">
                      <div>
                        <span>Recommendation</span>
                        <p>{recommendation}</p>
                      </div>
                      {condition.onSelect ? (
                        <span
                          className="critical-conditions-panel__inspect"
                          aria-hidden="true"
                        >
                          Investigate
                          <ArrowRight />
                        </span>
                      ) : null}
                    </div>
                  </div>
                </ItemTag>
              );
            })}

            {overflowCount > 0 ? (
              <div className="critical-conditions-panel__overflow" role="note">
                +{overflowCount} additional active condition
                {overflowCount === 1 ? "" : "s"} remain in the current queue.
              </div>
            ) : null}
          </div>
        ) : (
          <div className="critical-conditions-panel__nominal" role="status">
            <CheckCircle2 aria-hidden="true" />
            <div>
              <strong>NO CRITICAL CONDITIONS</strong>
              <p>{nominalContext}</p>
            </div>
          </div>
        )}
      </div>
    </HudPanel>
  );
}
