"use client";

import { useWidgetData } from "./WidgetDataContext";

export default function KeyLevelsWidget() {
  const { keyLevels, spotPrice } = useWidgetData();

  const spotDistFlipPct =
    spotPrice > 0 && keyLevels.gammaFlip > 0
      ? (Math.abs(spotPrice - keyLevels.gammaFlip) / spotPrice) * 100
      : 0;

  const rows = [
    ["CALL WALL", keyLevels.callWall, "text-emerald-400/95"],
    ["PUT WALL", keyLevels.putWall, "text-red-400/95"],
    ["MAX PAIN", keyLevels.maxPain, "text-amber-400/95"],
    ["GAMMA FLIP", keyLevels.gammaFlip, "text-neutral-400"],
    ["VOL TRIG", keyLevels.volTrigger, "text-violet-400/95"],
  ] as const;

  return (
    <div className="h-full">
      <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-neutral-500">
        Key levels
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5 font-sans text-[10px]">
        {rows.map(([label, val, col]) => (
          <div key={String(label)} className="rounded border border-white/[0.06] bg-black/50 px-2 py-1.5">
            <div className="text-neutral-600">{label}</div>
            <div className={`mt-0.5 font-semibold tabular-nums ${col}`}>
              ${Number(val).toFixed(2)}
            </div>
          </div>
        ))}
        <div className="col-span-2 rounded border border-white/[0.06] bg-black/50 px-2 py-1.5">
          <div className="text-neutral-600">Spot dist. to flip</div>
          <div className="mt-0.5 font-semibold tabular-nums text-neutral-300">
            {spotDistFlipPct.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
}
