import type { ElementType, ReactNode } from "react";
import "./HudPanel.css";

export interface HudPanelHeaderProps {
  children?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  icon?: ReactNode;
  status?: ReactNode;
  metadata?: ReactNode;
  actions?: ReactNode;
  titleId?: string;
  titleAs?: ElementType;
  className?: string;
}

export function HudPanelHeader({
  eyebrow,
  title,
  icon,
  status,
  metadata,
  actions,
  titleId,
  titleAs,
  className,
}: HudPanelHeaderProps) {
  const TitleTag = (titleAs || "h3") as ElementType;

  return (
    <div className={["hud-panel-header", className].filter(Boolean).join(" ")}>
      <div className="hud-panel-header__left">
        {icon ? <span className="hud-panel-header__icon" aria-hidden="true">{icon}</span> : null}
        <div className="hud-panel-header__title-group">
          {eyebrow ? <span className="hud-panel-header__eyebrow">{eyebrow}</span> : null}
          <TitleTag id={titleId} className="hud-panel-header__title">
            {title}
          </TitleTag>
        </div>
      </div>

      {(status || metadata || actions) ? (
        <div className="hud-panel-header__right">
          {status ? <span className="hud-panel-header__status">{status}</span> : null}
          {metadata ? <span className="hud-panel-header__metadata">{metadata}</span> : null}
          {actions ? <div className="hud-panel-header__actions">{actions}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
