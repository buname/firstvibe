"use client";

import { useWidgetData } from "./WidgetDataContext";

export default function TapeContextWidget() {
  const { spotPrice, changePct, lastUpdate, live } = useWidgetData();

  return (
    <div className="h-full">
      <div className="text-[9px] uppercase tracking-wider text-neutral-500">Tape context</div>
      <div className="mt-2 space-y-1.5 text-[11px] text-neutral-400">
        <div className="flex items-center justify-between">
          <span>Spot</span>
          <span className="font-semibold text-neutral-200">${spotPrice.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Change %</span>
          <span className={`font-semibold ${changePct >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
            {changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Last update</span>
          <span className="text-neutral-500">
            {lastUpdate?.toLocaleTimeString("en-US", { hour12: false }) ?? "—"}
          </span>
        </div>
        <div className="mt-1 rounded border border-white/[0.06] bg-black/40 px-2 py-1 text-[10px]">
          Feed: <span className={live ? "text-emerald-300" : "text-amber-300"}>{live ? "LIVE" : "DEMO"}</span>
        </div>
      </div>
    </div>
  );
}
