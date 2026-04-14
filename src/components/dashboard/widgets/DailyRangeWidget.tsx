"use client";

import { useWidgetData } from "./WidgetDataContext";

export default function DailyRangeWidget() {
  const { spotPrice, atmIvPct } = useWidgetData();

  const em = spotPrice > 0 && atmIvPct > 0
    ? spotPrice * (atmIvPct / 100) * Math.sqrt(1 / 365)
    : 0;

  return (
    <div className="h-full">
      <div className="text-[9px] uppercase tracking-wider text-neutral-500">Daily range</div>
      <div className="mt-2 space-y-1.5 text-[11px] text-neutral-400">
        <div className="flex justify-between">
          <span>Projected High</span>
          <span className="font-semibold text-emerald-300">${(spotPrice + em).toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Projected Low</span>
          <span className="font-semibold text-rose-300">${(spotPrice - em).toFixed(2)}</span>
        </div>
        <div className="flex justify-between border-t border-white/[0.06] pt-1.5">
          <span>Spot</span>
          <span className="font-semibold text-neutral-200">${spotPrice.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
