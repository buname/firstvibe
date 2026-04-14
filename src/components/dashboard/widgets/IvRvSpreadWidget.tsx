"use client";

import { useWidgetData } from "./WidgetDataContext";

export default function IvRvSpreadWidget() {
  const { atmIvPct, changePct } = useWidgetData();

  const rvProxy = Math.abs(changePct) * 0.9;
  const spread = atmIvPct - rvProxy;

  return (
    <div className="h-full">
      <div className="text-[9px] uppercase tracking-wider text-neutral-500">IV / RV Spread</div>
      <div className="mt-2 space-y-1.5 text-[11px] text-neutral-400">
        <div className="flex items-center justify-between">
          <span>ATM IV</span>
          <span className="font-semibold text-amber-300">{atmIvPct.toFixed(2)}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span>RV proxy</span>
          <span className="font-semibold text-sky-300">{rvProxy.toFixed(2)}%</span>
        </div>
        <div className="flex items-center justify-between border-t border-white/[0.06] pt-1.5">
          <span>Spread</span>
          <span className={`font-semibold ${spread >= 0 ? "text-amber-300" : "text-sky-300"}`}>
            {spread >= 0 ? "+" : ""}{spread.toFixed(2)}%
          </span>
        </div>
        <div className="rounded border border-white/[0.06] bg-black/40 px-2 py-1 text-[10px] text-neutral-500">
          {spread > 3 ? "IV elevated vs realized — premium rich" :
           spread < -1 ? "RV above IV — premium cheap" :
           "IV roughly in line with realized"}
        </div>
      </div>
    </div>
  );
}
