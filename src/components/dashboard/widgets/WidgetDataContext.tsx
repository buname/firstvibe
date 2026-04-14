"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { GEXByStrike, KeyLevels, OptionContract } from "@/lib/gex-engine";

export interface WidgetData {
  symbol: string;
  displaySpot: number;
  spotPrice: number;
  keyLevels: KeyLevels;
  flowRatio: number;
  netFlow: number;
  totalNetGex: number;
  atmIvPct: number;
  change: number;
  changePct: number;
  live: boolean;
  chain: OptionContract[];
  lastUpdate: Date | null;
  gexByStrike: GEXByStrike[];
}

const Ctx = createContext<WidgetData | null>(null);

export function WidgetDataProvider({
  value,
  children,
}: {
  value: WidgetData;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWidgetData(): WidgetData {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWidgetData must be used inside WidgetDataProvider");
  return ctx;
}
