"use client";

import { useWidgetData } from "./WidgetDataContext";

export default function ExpectedMoveWidget() {
  const { spotPrice, atmIvPct } = useWidgetData();

  const em = spotPrice > 0 && atmIvPct > 0
    ? spotPrice * (atmIvPct / 100) * Math.sqrt(1 / 365)
    : 0;

  return (
    <div className="h-full">
      <div className="text-[9px] uppercase tracking-wider text-neutral-500">Expected move</div>
      <div className="mt-2 text-2xl font-bold text-[#f5f5f5]">±{em.toFixed(2)}</div>
      <div className="text-[10px] text-neutral-500">1D proxy from ATM IV ({atmIvPct.toFixed(1)}%)</div>
    </div>
  );
}
