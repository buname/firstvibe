"use client";

import dynamic from "next/dynamic";
import type { KeyLevels } from "@/lib/gex-engine";
import type { TickerSymbol } from "@/lib/constants";

const ChartStudio = dynamic(
  () => import("@/components/dashboard/ChartStudio"),
  { ssr: false }
);

interface Props {
  keyLevels: KeyLevels;
  atmIvPct: number;
  atmIvDecimal: number;
  daysToExpiry: number;
  expectedMove: number;
  projectedHigh: number;
  projectedLow: number;
  estimatedLevels: boolean;
  optionsDataSource: "INDEX_OPTIONS" | "ETF_PROXY" | "MOCK";
  optionsSourceNote: string | null;
  symbol: string;
  spotPrice: number;
  onSymbolChange?: (next: TickerSymbol) => void;
}

function pctDiff(val: number, spot: number) {
  const d = ((val - spot) / spot) * 100;
  return `${d >= 0 ? "+" : ""}${d.toFixed(1)}%`;
}

export default function LevelsTab({
  keyLevels,
  atmIvPct,
  atmIvDecimal,
  daysToExpiry,
  expectedMove,
  projectedHigh,
  projectedLow,
  estimatedLevels,
  optionsDataSource,
  optionsSourceNote,
  symbol,
  spotPrice,
  onSymbolChange,
}: Props) {
  const spot = keyLevels.spotPrice;

  const cards = [
    {
      label: "CALL WALL",
      value: keyLevels.callWall,
      color: "#00e87a",
      sub: "Resistance",
      dist: pctDiff(keyLevels.callWall, spot),
    },
    {
      label: "PUT WALL",
      value: keyLevels.putWall,
      color: "#ff4455",
      sub: "Support",
      dist: pctDiff(keyLevels.putWall, spot),
    },
    {
      label: "ZERO GAMMA",
      value: keyLevels.gammaFlip,
      color: "#f5a623",
      sub: "Dealer Flip",
      dist: pctDiff(keyLevels.gammaFlip, spot),
    },
    {
      label: "MAX PAIN",
      value: keyLevels.maxPain,
      color: "#4a9fff",
      sub: "Option pain",
      dist: pctDiff(keyLevels.maxPain, spot),
    },
    {
      label: "VOL TRIGGER",
      value: keyLevels.volTrigger,
      color: "#06b6d4",
      sub: "Vol trigger",
      dist: pctDiff(keyLevels.volTrigger, spot),
    },
    {
      label: "EXPECTED HIGH",
      value: projectedHigh,
      color: "#00e87a",
      sub: "Spot + σ(dte)",
      dist: pctDiff(projectedHigh, spot),
    },
    {
      label: "EXPECTED LOW",
      value: projectedLow,
      color: "#ff4455",
      sub: "Spot − σ(dte)",
      dist: pctDiff(projectedLow, spot),
    },
    {
      label: "ATM IV",
      value: null as number | null,
      ivPct: atmIvPct,
      color: "#8b5cf6",
      sub: "Implied vol",
      dist: "",
    },
  ];

  return (
    <div className="h-full flex flex-col p-3 gap-3 overflow-auto">
      {/* Header */}
      <div className="shrink-0">
        <h2 className="text-sm font-mono font-bold tracking-wider text-[#e8e8e8]">
          Daily Levels
        </h2>
        <p className="text-[10px] font-mono text-[#444] mt-0.5 tracking-wider">
          {symbol} · key gamma levels &amp; expected move
        </p>
        <p className="text-[9px] font-mono text-[#666] mt-1 tracking-wide">
          Spot {spot.toFixed(2)} · IV {(atmIvDecimal * 100).toFixed(1)}% · DTE{" "}
          {daysToExpiry} · Move ±{expectedMove.toFixed(2)}
          {estimatedLevels ? " · ESTIMATED LEVELS" : " · OI-DERIVED LEVELS"}
          {optionsDataSource === "ETF_PROXY" ? " · ETF PROXY" : ""}
        </p>
        {optionsDataSource === "ETF_PROXY" && optionsSourceNote ? (
          <p className="text-[9px] font-mono text-amber-400/80 mt-1 tracking-wide">
            {optionsSourceNote}
          </p>
        ) : null}
      </div>

      {/* 4×2 card grid */}
      <div className="grid grid-cols-4 gap-2 shrink-0">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded border border-[#1c1c1c] p-3 flex flex-col gap-1"
            style={{ background: "linear-gradient(135deg,#131313,#0d0d0d)" }}
          >
            <div className="text-[8px] font-mono tracking-[0.15em] text-[#555] uppercase">
              {c.label}
            </div>
            <div
              className="text-xl font-mono font-bold leading-none"
              style={{ color: c.color }}
            >
              {c.value !== null
                ? `$${c.value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
                : `${c.ivPct!.toFixed(1)}%`}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[9px] font-mono text-[#4a4a4a]">
                {c.sub}
              </span>
              {c.dist && (
                <span
                  className="text-[9px] font-mono font-semibold"
                  style={{
                    color: c.dist.startsWith("+")
                      ? "#00e87a"
                      : c.dist.startsWith("-")
                      ? "#ff4455"
                      : "#888",
                  }}
                >
                  · {c.dist}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Chart Studio */}
      <ChartStudio
        symbol={symbol}
        keyLevels={keyLevels}
        spotPrice={spotPrice}
        className="flex-1"
        onSymbolChange={onSymbolChange}
      />

      {/* Note */}
      <div className="text-[9px] font-mono text-[#333] shrink-0">
        NOTE — Expected Move = Spot × IV × sqrt(DTE/365), clamped to 5% when IV ≤ 40%.
      </div>
    </div>
  );
}
