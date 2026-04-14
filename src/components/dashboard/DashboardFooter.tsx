"use client";

import type { KeyLevels } from "@/lib/gex-engine";

interface Props {
  symbol: string;
  spotPrice: number;
  netGexBillions: number;
  atmIvPct: number;
  keyLevels: KeyLevels;
  flowRatio: number;
}

function fmtBillions(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${(n / 1e9).toFixed(2)}B`;
}

export default function DashboardFooter({
  symbol,
  spotPrice,
  netGexBillions,
  atmIvPct,
  keyLevels,
  flowRatio,
}: Props) {
  const items: { label: string; value: string; tone: "green" | "red" | "orange" | "white" }[] = [
    {
      label: "NET GEX",
      value: fmtBillions(netGexBillions),
      tone: netGexBillions >= 0 ? "green" : "red",
    },
    { label: "ATM IV", value: `${atmIvPct.toFixed(1)}%`, tone: "orange" },
    {
      label: "G-FLIP",
      value: `$${keyLevels.gammaFlip.toFixed(2)}`,
      tone: "white",
    },
    {
      label: "CALL WALL",
      value: `$${keyLevels.callWall.toFixed(2)}`,
      tone: "green",
    },
    {
      label: "PUT WALL",
      value: `$${keyLevels.putWall.toFixed(2)}`,
      tone: "red",
    },
    {
      label: "MAX PAIN",
      value: `$${keyLevels.maxPain.toFixed(2)}`,
      tone: "white",
    },
    {
      label: "VOL TRIG",
      value: `$${keyLevels.volTrigger.toFixed(2)}`,
      tone: "orange",
    },
    {
      label: "FLOW RATIO",
      value: flowRatio.toFixed(3),
      tone: flowRatio >= 0.5 ? "green" : "red",
    },
  ];

  const toneClass = {
    green: "text-[#4ade80]",
    red: "text-[#f87171]",
    orange: "text-[#fb923c]",
    white: "text-[#e5e5e5]",
  };

  return (
    <footer className="panel-sheen flex h-9 min-h-9 shrink-0 items-stretch gap-0 overflow-x-auto border-t border-white/[0.06] bg-black px-1 shadow-[0_-10px_28px_rgba(0,0,0,0.55)]">
      <div className="flex items-center gap-2 px-2.5 border-r border-[#1f1f1f] shrink-0">
        <span className="font-mono text-[10px] font-bold text-white tracking-tight">
          {symbol}
        </span>
        <span className="font-mono text-[10px] text-[#a3a3a3] tabular-nums">
          $
          {spotPrice.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      </div>
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-1.5 px-2.5 border-r border-[#1f1f1f] last:border-r-0 shrink-0 hover:bg-white/[0.02] transition-colors"
        >
          <span className="font-mono text-[9px] text-[#525252] tracking-[0.08em] uppercase">
            {item.label}
          </span>
          <span
            className={`font-mono text-[10px] font-semibold tabular-nums ${toneClass[item.tone]}`}
          >
            {item.value}
          </span>
        </div>
      ))}
    </footer>
  );
}
