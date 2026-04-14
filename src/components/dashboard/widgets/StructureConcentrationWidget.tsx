"use client";

import { useMemo } from "react";
import { useWidgetData } from "./WidgetDataContext";

function asCompact(value: number): string {
  return Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value);
}

export default function StructureConcentrationWidget() {
  const { gexByStrike } = useWidgetData();

  const topStrikes = useMemo(
    () => [...gexByStrike].sort((a, b) => Math.abs(b.netGEX) - Math.abs(a.netGEX)).slice(0, 5),
    [gexByStrike]
  );

  return (
    <div className="h-full">
      <div className="text-[9px] uppercase tracking-wider text-neutral-500">Structure concentration</div>
      <div className="mt-2 space-y-1.5">
        {topStrikes.length === 0 && (
          <div className="text-[10px] text-neutral-600">No data</div>
        )}
        {topStrikes.map((row) => (
          <div
            key={row.strike}
            className="flex items-center justify-between rounded border border-white/[0.06] bg-black/40 px-2 py-1.5"
          >
            <span className="text-[10px] text-neutral-400">Strike {row.strike.toFixed(0)}</span>
            <span className={`text-[10px] font-semibold ${row.netGEX >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
              {asCompact(row.netGEX)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
