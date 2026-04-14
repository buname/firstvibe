import type { ComponentType } from "react";

export type SectionId = "core-snapshot" | "overview" | "greeks" | "structure";

export interface WidgetDefinition {
  id: string;
  title: string;
  description: string;
  allowedSections: SectionId[];
  defaultSection: SectionId;
  colSpan: 1 | 2 | 3;
}

export const SECTION_META: Record<SectionId, { title: string; icon: string }> = {
  "core-snapshot": { title: "Core Snapshot", icon: "Activity" },
  overview: { title: "Overview", icon: "BarChart2" },
  greeks: { title: "Greeks", icon: "TrendingUp" },
  structure: { title: "Structure", icon: "Layers" },
};

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  {
    id: "gamma-regime",
    title: "Gamma Regime",
    description: "Dealer gamma positioning, price, and regime narrative.",
    allowedSections: ["core-snapshot", "overview", "structure"],
    defaultSection: "core-snapshot",
    colSpan: 1,
  },
  {
    id: "key-levels",
    title: "Key Levels",
    description: "Call wall, put wall, max pain, gamma flip, vol trigger.",
    allowedSections: ["core-snapshot", "overview", "structure"],
    defaultSection: "core-snapshot",
    colSpan: 1,
  },
  {
    id: "exposure-flow",
    title: "Exposure & Flow",
    description: "Net GEX, ATM IV, flow ratio, expected move, vol regime.",
    allowedSections: ["core-snapshot", "overview", "structure"],
    defaultSection: "core-snapshot",
    colSpan: 1,
  },
  {
    id: "expected-move",
    title: "Expected Move",
    description: "1-day expected move from ATM implied volatility.",
    allowedSections: ["overview", "core-snapshot", "structure"],
    defaultSection: "overview",
    colSpan: 1,
  },
  {
    id: "daily-range",
    title: "Daily Range",
    description: "Projected high/low based on expected move.",
    allowedSections: ["overview", "core-snapshot", "structure"],
    defaultSection: "overview",
    colSpan: 1,
  },
  {
    id: "tape-context",
    title: "Tape Context",
    description: "Spot price, change %, last update, feed mode.",
    allowedSections: ["overview", "core-snapshot", "structure"],
    defaultSection: "overview",
    colSpan: 1,
  },
  {
    id: "vanna-chart",
    title: "Vanna by Strike",
    description: "Horizontal bar chart of vanna exposure per strike.",
    allowedSections: ["greeks", "core-snapshot", "overview", "structure"],
    defaultSection: "greeks",
    colSpan: 1,
  },
  {
    id: "charm-chart",
    title: "Charm by Strike",
    description: "Horizontal bar chart of charm (time decay) per strike.",
    allowedSections: ["greeks", "core-snapshot", "overview", "structure"],
    defaultSection: "greeks",
    colSpan: 1,
  },
  {
    id: "structure-concentration",
    title: "Structure Concentration",
    description: "Top GEX strikes by absolute net exposure.",
    allowedSections: ["structure", "core-snapshot", "overview"],
    defaultSection: "structure",
    colSpan: 1,
  },
  {
    id: "iv-rv-spread",
    title: "IV / RV Spread",
    description: "Implied vs realized volatility spread indicator.",
    allowedSections: ["overview", "core-snapshot", "structure"],
    defaultSection: "structure",
    colSpan: 1,
  },
];

export const WIDGET_MAP = new Map(
  WIDGET_REGISTRY.map((w) => [w.id, w])
);

export type DefaultLayout = Record<SectionId, string[]>;

export const DEFAULT_SECTION_WIDGETS: DefaultLayout = {
  "core-snapshot": ["gamma-regime", "key-levels", "exposure-flow"],
  overview: ["expected-move", "daily-range", "tape-context"],
  greeks: ["vanna-chart", "charm-chart"],
  structure: ["structure-concentration", "iv-rv-spread"],
};

export const SECTION_ORDER: SectionId[] = [
  "core-snapshot",
  "overview",
  "greeks",
  "structure",
];
