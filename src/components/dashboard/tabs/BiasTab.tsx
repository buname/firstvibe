"use client";

import { useMemo } from "react";
import type { KeyLevels } from "@/lib/gex-engine";

interface Props {
  symbol: string;
  spotPrice: number;
  keyLevels: KeyLevels;
  flowRatio: number;
  netFlow: number;
  atmIvPct: number;
  totalNetGex: number;
  live: boolean;
  /** Yahoo ^VIX; null only if live fetch failed for VIX. */
  vix: number | null;
  vixChangePct: number | null;
}

function pctFromSpot(level: number, spot: number): string {
  const p = ((level - spot) / spot) * 100;
  return `${p >= 0 ? "+" : ""}${p.toFixed(2)}%`;
}

function buildThesis(
  symbol: string,
  spot: number,
  levels: KeyLevels,
  longGamma: boolean,
  flowBullish: boolean,
  callPct: number,
  atmIvPct: number,
  totalNetGex: number
): string {
  const dCall =
    levels.callWall > 0 ? Math.abs(spot - levels.callWall) / spot : 1;
  const dPut =
    levels.putWall > 0 ? Math.abs(spot - levels.putWall) / spot : 1;
  const dFlip =
    levels.gammaFlip > 0 ? Math.abs(spot - levels.gammaFlip) / spot : 1;

  const gexSign =
    totalNetGex >= 0
      ? "net positive dealer gamma"
      : "net negative dealer gamma";

  let s = `${symbol} at $${spot.toFixed(2)}: OI snapshot implies ${gexSign} in the filtered strike band. `;

  if (longGamma) {
    s +=
      `Spot sits above the gamma flip (~$${levels.gammaFlip.toFixed(2)}), consistent with a long-gamma regime where dealers often sell rallies and buy dips — realized vol tends to compress unless a level breaks cleanly. `;
  } else {
    s +=
      `Spot is at or below the gamma flip (~$${levels.gammaFlip.toFixed(2)}), where short-gamma hedging can extend trends; size risk for faster moves. `;
  }

  if (dCall < 0.012) {
    s += `Price is tight to the call wall ($${levels.callWall.toFixed(2)}); treat that zone as sticky resistance. `;
  } else if (dPut < 0.012) {
    s += `Price is tight to the put wall ($${levels.putWall.toFixed(2)}); that strike often acts as a magnet for mean-reversion. `;
  }

  if (dFlip < 0.02) {
    s += `You are close to the flip level — regime can shift quickly on a sustained break. `;
  }

  s += flowBullish
    ? `Flow skew is call-heavy (~${callPct}% of modeled premium), which can reinforce upside attempts until the wall is cleared. `
    : `Flow skew is put-heavy; watch whether dips find size at the put wall or break toward max pain ($${levels.maxPain.toFixed(2)}). `;

  s +=
    atmIvPct >= 22
      ? `ATM IV is elevated (${atmIvPct.toFixed(1)}%) — wider 1d ranges are priced.`
      : `ATM IV is ${atmIvPct.toFixed(1)}% — tape may stay relatively tame unless a catalyst hits.`;

  return s.trim();
}

const card =
  "rounded-md border border-white/[0.08] bg-[#0a0a0a]";

export default function BiasTab({
  symbol,
  spotPrice,
  keyLevels,
  flowRatio,
  netFlow,
  atmIvPct,
  totalNetGex,
  live,
  vix,
  vixChangePct,
}: Props) {
  const longGamma = spotPrice > keyLevels.gammaFlip;
  const flowBullish = flowRatio >= 0.5;
  const callPct = Math.round(flowRatio * 100);
  const putPct = 100 - callPct;
  const expMove = spotPrice * (atmIvPct / 100) * Math.sqrt(5 / 365);
  const expMove1d = spotPrice * (atmIvPct / 100) * Math.sqrt(1 / 365);
  const vixLow = vix != null && vix < 20;
  const lowVolTag = vix != null ? vixLow : atmIvPct < 20;

  const thesis = useMemo(
    () =>
      buildThesis(
        symbol,
        spotPrice,
        keyLevels,
        longGamma,
        flowBullish,
        callPct,
        atmIvPct,
        totalNetGex
      ),
    [
      symbol,
      spotPrice,
      keyLevels,
      longGamma,
      flowBullish,
      callPct,
      atmIvPct,
      totalNetGex,
    ]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-black p-3 md:p-4">
      <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-white md:text-xl">
            Daily Bias
          </h1>
          <p className="mt-1 text-[11px] text-neutral-500">
            Market regime · Dealer positioning · Macro context
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              live ? "animate-pulse bg-emerald-500" : "bg-amber-500"
            }`}
          />
          {live ? "LIVE" : "DEMO"}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        {/* Left: stacked regime cards (Opacity-style) */}
        <div className="flex flex-col gap-3 lg:col-span-7">
          <div className={`${card} overflow-hidden`}>
            <div className="grid grid-cols-2 divide-x divide-y divide-white/[0.06]">
              <div className="p-3 md:p-4">
                <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-neutral-500">
                  Gamma regime
                </div>
                <div
                  className={`mt-1 font-mono text-2xl font-bold md:text-3xl ${
                    longGamma ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {longGamma ? "LONG Γ" : "SHORT Γ"}
                </div>
              </div>
              <div className="p-3 md:p-4">
                <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-neutral-500">
                  Flow direction
                </div>
                <div
                  className={`mt-1 font-mono text-2xl font-bold md:text-3xl ${
                    flowBullish ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {flowBullish ? "BULLISH" : "BEARISH"}
                </div>
                <div className="mt-1 text-[10px] text-neutral-500">
                  {callPct}% call · {netFlow >= 0 ? "+" : ""}
                  {(netFlow / 1e6).toFixed(2)}M net
                </div>
              </div>
              <div className="p-3 md:p-4">
                <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-neutral-500">
                  1-day exp move (est.)
                </div>
                <div className="mt-1 font-mono text-xl font-bold text-amber-400 md:text-2xl">
                  ±${expMove1d.toFixed(2)}
                </div>
                <div className="mt-0.5 text-[10px] text-neutral-600">
                  5d ±${expMove.toFixed(2)}
                </div>
              </div>
              <div className="p-3 md:p-4">
                <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-neutral-500">
                  ATM IV
                </div>
                <div className="mt-1 font-mono text-xl font-bold text-white md:text-2xl">
                  {atmIvPct.toFixed(1)}%
                </div>
                <div className="mt-0.5 text-[10px] text-neutral-600">
                  Implied @ spot
                </div>
              </div>
            </div>
          </div>

          <div className={card + " p-3 md:p-4"}>
            <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-neutral-500">
              Vol · regime · bias
            </div>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-2 border-b border-white/[0.06] pb-3">
              <div>
                <div className="text-[9px] uppercase text-neutral-600">VIX</div>
                {vix != null ? (
                  <>
                    <div className="font-mono text-2xl font-semibold tabular-nums text-white md:text-3xl">
                      {vix.toFixed(2)}
                    </div>
                    {vixChangePct != null ? (
                      <div
                        className={`mt-0.5 font-mono text-[10px] tabular-nums ${
                          vixChangePct >= 0 ? "text-red-400" : "text-emerald-400"
                        }`}
                      >
                        {vixChangePct >= 0 ? "+" : ""}
                        {vixChangePct.toFixed(2)}% 1d
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <div className="font-mono text-lg text-neutral-500">—</div>
                    <div className="mt-0.5 text-[10px] text-neutral-600">
                      VIX quote unavailable
                    </div>
                  </>
                )}
              </div>
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                  lowVolTag
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-amber-500/15 text-amber-400"
                }`}
              >
                {lowVolTag ? "Low vol" : "Elevated"}
              </span>
            </div>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between gap-4 border-b border-white/[0.04] pb-2">
                <span className="text-neutral-500">Regime</span>
                <span
                  className={`text-right font-medium ${
                    longGamma ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {longGamma ? "LONG Γ" : "SHORT Γ"}{" "}
                  <span className="text-neutral-500">
                    · {longGamma ? "Dampening" : "Trend risk"}
                  </span>
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-neutral-500">Bias</span>
                <span
                  className={`text-right font-medium ${
                    flowBullish ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {flowBullish ? "BULLISH" : "BEARISH"}{" "}
                  <span className="font-normal text-neutral-500">
                    {callPct}% call flow
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: key levels + thesis (scroll, no fade mask) */}
        <div className="flex flex-col gap-3 lg:col-span-5">
          <div>
            <div className="mb-2 text-[9px] font-medium uppercase tracking-[0.14em] text-neutral-500">
              Key levels
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  label: "Call wall",
                  value: keyLevels.callWall,
                  sub: `${pctFromSpot(keyLevels.callWall, spotPrice)} away`,
                  tone: "green" as const,
                },
                {
                  label: "Put wall",
                  value: keyLevels.putWall,
                  sub: `${pctFromSpot(keyLevels.putWall, spotPrice)} away`,
                  tone: "red" as const,
                },
                {
                  label: "Gamma flip",
                  value: keyLevels.gammaFlip,
                  sub: `${pctFromSpot(keyLevels.gammaFlip, spotPrice)} away`,
                  tone: "white" as const,
                },
                {
                  label: "Max pain",
                  value: keyLevels.maxPain,
                  sub: `${pctFromSpot(keyLevels.maxPain, spotPrice)} away`,
                  tone: "orange" as const,
                },
              ].map((c) => (
                <div
                  key={c.label}
                  className="rounded-md border border-white/[0.08] bg-[#0a0a0a] p-3"
                >
                  <div className="text-[9px] uppercase text-neutral-600">
                    {c.label}
                  </div>
                  <div
                    className={`mt-0.5 font-mono text-lg font-bold tabular-nums ${
                      c.tone === "green"
                        ? "text-emerald-400"
                        : c.tone === "red"
                          ? "text-red-400"
                          : c.tone === "orange"
                            ? "text-amber-400"
                            : "text-white"
                    }`}
                  >
                    ${c.value.toFixed(2)}
                  </div>
                  <div className="mt-0.5 text-[10px] text-neutral-600">
                    {c.sub}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`${card} flex min-h-[140px] flex-1 flex-col overflow-hidden`}>
            <div className="shrink-0 border-b border-white/[0.06] px-3 py-2 text-[9px] font-medium uppercase tracking-[0.14em] text-neutral-500">
              Thesis
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              <p className="text-xs leading-relaxed text-neutral-300">
                {thesis}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom row: Opacity-style context pair */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:col-span-12">
          <div className="rounded-md border border-white/[0.08] border-t-emerald-500/80 bg-[#0a0a0a] p-3 md:p-4">
            <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-emerald-400/90">
              What this means
            </div>
            <p className="mt-2 text-xs leading-relaxed text-neutral-400">
              {longGamma
                ? "Dealers are likely net long gamma near spot — hedging tends to dampen moves and favor mean-reversion around strikes with heavy OI."
                : "Dealers are likely net short gamma — hedging can amplify directional moves; watch vol and the gamma flip level closely."}
            </p>
          </div>
          <div className="rounded-md border border-white/[0.08] border-t-red-400/80 bg-[#0a0a0a] p-3 md:p-4">
            <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-red-400/90">
              Flow context
            </div>
            <p className="mt-2 text-xs leading-relaxed text-neutral-400">
              {flowBullish
                ? `Call-side flow dominates at ${callPct}% of modeled premium. Watch call wall ${keyLevels.callWall.toFixed(0)} as resistance into OPEX.`
                : `Put-side flow dominates at ${putPct}% of modeled premium. Net flow ${netFlow >= 0 ? "+" : ""}${(netFlow / 1e6).toFixed(2)}M — watch put wall ${keyLevels.putWall.toFixed(0)}.`}
            </p>
          </div>
        </div>
      </div>

      <p className="mx-auto mt-6 max-w-2xl text-center text-[10px] leading-relaxed text-neutral-600">
        Generated from current OI/GEX snapshot — not investment advice. VIX is
        end-of-day style via Yahoo chart when live; macro beyond spot/flow not
        wired. For research only.
      </p>
    </div>
  );
}
