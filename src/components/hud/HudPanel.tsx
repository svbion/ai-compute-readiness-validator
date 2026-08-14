import type { ElementType, KeyboardEventHandler, MouseEventHandler, ReactNode } from "react";
import "./HudPanel.css";
import type { HudPanelState } from "./types";

export interface HudPanelProps {
  as?: ElementType;
  children?: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  status?: HudPanelState;
  active?: boolean;
  selected?: boolean;
  dense?: boolean;
  labelledBy?: string;
  className?: string;
  id?: string;
  role?: string;
  tabIndex?: number;
  onClick?: MouseEventHandler<HTMLElement>;
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
  ariaLabel?: string;
}

export function HudPanel({
  as,
  children,
  header,
  footer,
  status = "default",
  active = false,
  selected = false,
  dense = false,
  labelledBy,
  className,
  id,
  role,
  onClick,
  onKeyDown,
  tabIndex,
  ariaLabel,
}: HudPanelProps) {
  const Component = (as || "section") as ElementType;
  const resolvedState: HudPanelState = selected ? "selected" : active ? "active" : status;
  const isDisabled = resolvedState === "disabled";

  return (
    <Component
      className={[
        "hud-panel",
        !isDisabled && (onClick || onKeyDown || tabIndex !== undefined) ? "hud-panel--interactive" : "",
        dense ? "hud-panel--dense" : "",
        className,
      ].filter(Boolean).join(" ")}
      id={id}
      role={role}
      data-hud-state={resolvedState}
      aria-labelledby={labelledBy}
      aria-label={ariaLabel}
      aria-disabled={isDisabled || undefined}
      onClick={onClick}
      onKeyDown={onKeyDown}
      tabIndex={tabIndex}
    >
      <div className="hud-panel__surface">
        {header}
        <div className="hud-panel__body">{children}</div>
        {footer ? <div className="hud-panel__footer">{footer}</div> : null}
      </div>
    </Component>
  );
}

export type { HudPanelState } from "./types";
