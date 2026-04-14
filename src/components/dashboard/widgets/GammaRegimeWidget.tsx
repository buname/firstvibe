"use client";

import { useWidgetData } from "./WidgetDataContext";

function fmtBillions(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${(n / 1e9).toFixed(3)}B`;
}

function pctFromSpot(spot: number, level: number): string {
  if (spot <= 0 || level <= 0) return "—";
  const p = ((level - spot) / spot) * 100;
  return `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`;
}

export default function GammaRegimeWidget() {
  const {
    symbol, displaySpot, spotPrice, keyLevels,
    totalNetGex, change, changePct,
  } = useWidgetData();

  const dealerLong = totalNetGex > 0;
  const flipPct = pctFromSpot(spotPrice, keyLevels.gammaFlip);
  const volTrigPct = pctFromSpot(spotPrice, keyLevels.volTrigger);

  const narrative = dealerLong
    ? `${symbol} is trading in a long gamma environment — dealers dampen realized vol. Moves mean-revert.`
    : `${symbol} is in a short gamma regime — dealers exacerbate directional moves. Respect vol trigger.`;

  return (
    <div className="h-full">
      <div className="text-[9px] font-medium uppercase tracking-[0.16em] text-neutral-500">
        Gamma regime
      </div>
      <div className="mt-1 font-sans text-2xl font-semibold tabular-nums tracking-tight text-white">
        ${displaySpot.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <div className={`mt-0.5 font-sans text-xs tabular-nums ${change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
        {change >= 0 ? "+" : ""}{change.toFixed(2)} ({change >= 0 ? "+" : ""}{changePct.toFixed(2)}%)
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${dealerLong ? "bg-emerald-400" : "bg-red-400"}`} />
        <span className={`text-xs font-semibold ${dealerLong ? "text-emerald-400" : "text-red-400"}`}>
          {dealerLong ? "LONG GAMMA" : "SHORT GAMMA"}
        </span>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">{narrative}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-3 font-sans text-[10px] tabular-nums text-neutral-500">
        <div>
          <div className="text-neutral-600">Gamma flip</div>
          <div className="text-neutral-200">${keyLevels.gammaFlip.toFixed(2)}</div>
          <div className="text-amber-400/90">{flipPct}</div>
        </div>
        <div>
          <div className="text-neutral-600">Vol trigger</div>
          <div className="text-neutral-200">${keyLevels.volTrigger.toFixed(2)}</div>
          <div className="text-violet-300/90">{volTrigPct}</div>
        </div>
      </div>
    </div>
  );
}
