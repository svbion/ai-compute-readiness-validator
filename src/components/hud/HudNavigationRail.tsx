import { Bot, Boxes, Crosshair, Gauge, Menu, Network, ScanSearch, ScrollText, Settings, TriangleAlert, type LucideIcon } from "lucide-react";
import type { MouseEvent } from "react";
import "./HudNavigationRail.css";

export const HUD_NAVIGATION_RAIL_ITEM_IDS = [
  "mission-control",
  "ai-factory",
  "topology",
  "benchmarks",
  "evidence",
  "alerts",
  "investigations",
  "copilot",
  "settings",
] as const;

export type HudNavigationRailItemId = (typeof HUD_NAVIGATION_RAIL_ITEM_IDS)[number];
export type HudNavigationRailAvailability = "available" | "planned";
export type HudNavigationRailIndicatorTone = "default" | "warning" | "critical";

export interface HudNavigationRailItem {
  id: HudNavigationRailItemId;
  label: string;
  shortLabel: string;
  availability: HudNavigationRailAvailability;
  count?: number;
  countTone?: HudNavigationRailIndicatorTone;
}

export interface HudNavigationRailProps {
  items: HudNavigationRailItem[];
  activeItemId: HudNavigationRailItemId;
  className?: string;
  mobileLabel?: string;
  onSelect?: (item: HudNavigationRailItem) => void;
}

const ITEM_ICONS: Record<HudNavigationRailItemId, LucideIcon> = {
  "mission-control": Crosshair,
  "ai-factory": Boxes,
  topology: Network,
  benchmarks: Gauge,
  evidence: ScrollText,
  alerts: TriangleAlert,
  investigations: ScanSearch,
  copilot: Bot,
  settings: Settings,
};

function describeItem(item: HudNavigationRailItem, active: boolean) {
  const parts = [item.label];

  if (active) {
    parts.push("current page");
  }

  if (item.availability === "planned") {
    parts.push("planned destination");
  } else {
    parts.push("available destination");
  }

  if (typeof item.count === "number") {
    parts.push(`${item.count} items`);
  }

  return parts.join(", ");
}

export function HudNavigationRail({
  items,
  activeItemId,
  className,
  mobileLabel = "Navigation",
  onSelect,
}: HudNavigationRailProps) {
  const settingsItem = items.find((item) => item.id === "settings");
  const primaryItems = items.filter((item) => item.id !== "settings");

  const renderItem = (item: HudNavigationRailItem) => {
    const Icon = ITEM_ICONS[item.id];
    const active = item.id === activeItemId;
    const state = active ? "active" : item.availability;

    const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
      if (item.availability === "planned") {
        event.preventDefault();
        return;
      }

      onSelect?.(item);
    };

    return (
      <li key={item.id} className="hud-navigation-rail__item-shell">
        <button
          type="button"
          className="hud-navigation-rail__item"
          data-state={state}
          data-count-tone={item.countTone || "default"}
          data-nav-id={item.id}
          aria-current={active ? "page" : undefined}
          aria-label={describeItem(item, active)}
          onClick={handleClick}
        >
          <span className="hud-navigation-rail__item-edge" aria-hidden="true" />
          <span className="hud-navigation-rail__item-icon-frame" aria-hidden="true">
            <Icon size={18} strokeWidth={1.8} />
          </span>
          <span className="hud-navigation-rail__item-copy">
            <span className="hud-navigation-rail__item-label hud-navigation-rail__item-label--full">{item.label}</span>
            <span className="hud-navigation-rail__item-label hud-navigation-rail__item-label--short">{item.shortLabel}</span>
            {item.availability === "planned" ? (
              <span className="hud-navigation-rail__item-meta">
                <span className="hud-navigation-rail__item-meta-dot" aria-hidden="true" />
                <span>Planned</span>
              </span>
            ) : null}
          </span>
          {typeof item.count === "number" ? (
            <span className="hud-navigation-rail__item-indicator" aria-hidden="true">{item.count}</span>
          ) : null}
          <span className="hud-navigation-rail__item-terminal" aria-hidden="true">//</span>
        </button>
      </li>
    );
  };

  return (
    <>
      <button
        type="button"
        className="hud-navigation-rail-mobile-trigger"
        aria-label={`${mobileLabel}, planned drawer placeholder`}
      >
        <span className="hud-navigation-rail-mobile-trigger__icon" aria-hidden="true">
          <Menu size={16} strokeWidth={1.9} />
        </span>
        <span className="hud-navigation-rail-mobile-trigger__label">{mobileLabel}</span>
        <span className="hud-navigation-rail-mobile-trigger__meta">PLANNED</span>
      </button>

      <nav
        aria-label="Primary"
        className={["hud-navigation-rail", className].filter(Boolean).join(" ")}
        data-testid="HudNavigationRail"
      >
        <div className="hud-navigation-rail__shell">
          <div className="hud-navigation-rail__medallion-block" aria-hidden="true">
            <div className="hud-navigation-rail__medallion-ring">
              <Crosshair size={24} strokeWidth={1.45} />
            </div>
            <span className="hud-navigation-rail__medallion-label">NAV</span>
          </div>

          <div className="hud-navigation-rail__spine" aria-hidden="true">
            <span className="hud-navigation-rail__spine-node hud-navigation-rail__spine-node--top" />
            <span className="hud-navigation-rail__spine-node hud-navigation-rail__spine-node--mid" />
            <span className="hud-navigation-rail__spine-node hud-navigation-rail__spine-node--bottom" />
          </div>

          <ul className="hud-navigation-rail__list">
            {primaryItems.map(renderItem)}
          </ul>

          <div className="hud-navigation-rail__footer-slot">
            {settingsItem ? (
              <ul className="hud-navigation-rail__list hud-navigation-rail__list--secondary">
                {renderItem(settingsItem)}
              </ul>
            ) : null}

            <div className="hud-navigation-rail__status-orb" aria-hidden="true">
              <span className="hud-navigation-rail__status-orb-core" />
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
