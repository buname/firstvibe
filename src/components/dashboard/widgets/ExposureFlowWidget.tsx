"use client";

import { useWidgetData } from "./WidgetDataContext";

function fmtBillions(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${(n / 1e9).toFixed(3)}B`;
}

export default function ExposureFlowWidget() {
  const { spotPrice, totalNetGex, atmIvPct, flowRatio, netFlow } = useWidgetData();

  const em = spotPrice > 0 && atmIvPct > 0 ? spotPrice * (atmIvPct / 100) * Math.sqrt(1 / 365) : 0;
  const emPct = spotPrice > 0 ? (em / spotPrice) * 100 : 0;
  const volAboveTrig = spotPrice > 0;
  const flowLabel = flowRatio > 0.55 ? "BULLISH" : flowRatio < 0.45 ? "BEARISH" : "NEUTRAL";

  return (
    <div className="h-full">
      <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-neutral-500">
        Exposure &amp; flow
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5 font-sans text-[10px]">
        <div className="rounded border border-white/[0.06] bg-black/50 px-2 py-1.5">
          <div className="text-neutral-600">Net GEX</div>
          <div className={`mt-0.5 font-semibold tabular-nums ${totalNetGex >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {fmtBillions(totalNetGex)}
          </div>
        </div>
        <div className="rounded border border-white/[0.06] bg-black/50 px-2 py-1.5">
          <div className="text-neutral-600">ATM IV</div>
          <div className="mt-0.5 font-semibold tabular-nums text-amber-400/95">{atmIvPct.toFixed(1)}%</div>
        </div>
        <div className="rounded border border-white/[0.06] bg-black/50 px-2 py-1.5">
          <div className="text-neutral-600">Flow ratio</div>
          <div className={`mt-0.5 font-semibold tabular-nums ${flowRatio >= 0.5 ? "text-emerald-400/90" : "text-red-400/90"}`}>
            {flowRatio.toFixed(3)}
          </div>
          <div className="text-[9px] text-neutral-600">{flowLabel}</div>
        </div>
        <div className="rounded border border-white/[0.06] bg-black/50 px-2 py-1.5">
          <div className="text-neutral-600">Net flow</div>
          <div className={`mt-0.5 font-semibold tabular-nums ${netFlow >= 0 ? "text-emerald-400/85" : "text-red-400/85"}`}>
            {(netFlow / 1e6).toFixed(2)}M
          </div>
        </div>
        <div className="rounded border border-white/[0.06] bg-black/50 px-2 py-1.5">
          <div className="text-neutral-600">Exp move 1D</div>
          <div className="mt-0.5 font-semibold tabular-nums text-neutral-200">
            ±${em.toFixed(2)} ({emPct.toFixed(2)}%)
          </div>
        </div>
        <div className="rounded border border-white/[0.06] bg-black/50 px-2 py-1.5">
          <div className="text-neutral-600">Vol regime</div>
          <div className="mt-0.5 font-semibold text-emerald-400/85">Active</div>
        </div>
      </div>
    </div>
  );
}
