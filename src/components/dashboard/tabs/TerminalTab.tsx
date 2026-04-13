"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import type { KeyLevels, OptionContract } from "@/lib/gex-engine";
import { computeVannaCharm } from "@/lib/vanna-charm";

interface Props {
  symbol: string;
  /** Header / headline price (index cash when NDX/SPX). */
  displaySpot: number;
  /** Spot used for GEX / levels math (ETF for index view). */
  spotPrice: number;
  keyLevels: KeyLevels;
  flowRatio: number;
  netFlow: number;
  totalNetGex: number;
  atmIvPct: number;
  change: number;
  changePct: number;
  live: boolean;
  chain: OptionContract[];
  lastUpdate: Date | null;
}

function fmtBillions(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${(n / 1e9).toFixed(3)}B`;
}

/** Rough 1-day expected move from ATM IV (variance clock, not broker EM). */
function expectedMove1d(spot: number, atmIvPct: number): number {
  if (spot <= 0 || atmIvPct <= 0) return 0;
  return spot * (atmIvPct / 100) * Math.sqrt(1 / 365);
}

function strikeLabel(strike: number) {
  return `$${strike % 1 === 0 ? strike.toFixed(0) : strike.toFixed(1)}`;
}

function pctFromSpot(spot: number, level: number): string {
  if (spot <= 0 || level <= 0) return "—";
  const p = ((level - spot) / spot) * 100;
  const sign = p >= 0 ? "+" : "";
  return `${sign}${p.toFixed(1)}%`;
}

function pickNearStrikeRows<T extends { strike: number }>(
  rows: T[],
  spot: number,
  take: number,
  mapFn: (r: T) => { k: string; strike: number; v: number }
): { k: string; strike: number; v: number }[] {
  if (rows.length === 0 || spot <= 0) return [];
  const sorted = [...rows].sort(
    (a, b) => Math.abs(a.strike - spot) - Math.abs(b.strike - spot)
  );
  const slice = sorted.slice(0, take).sort((a, b) => a.strike - b.strike);
  return slice.map(mapFn);
}

function YTickSpot(
  props: {
    x?: number | string;
    y?: number | string;
    payload?: { value?: string };
    spotKey: string | null;
  }
) {
  const x = Number(props.x ?? 0);
  const y = Number(props.y ?? 0);
  const payload = props.payload;
  const spotKey = props.spotKey;
  const v = String(payload?.value ?? "");
  const hit = Boolean(spotKey && v === spotKey);
  return (
    <text
      x={x}
      y={y}
      dy={3}
      textAnchor="end"
      fill={hit ? "#fafafa" : "#737373"}
      fontSize={9}
      fontFamily="system-ui, sans-serif"
      fontWeight={hit ? 600 : 400}
    >
      {v}
    </text>
  );
}

export default function TerminalTab({
  symbol,
  displaySpot,
  spotPrice,
  keyLevels,
  flowRatio,
  netFlow,
  totalNetGex,
  atmIvPct,
  change,
  changePct,
  live,
  chain,
  lastUpdate,
}: Props) {
  const em = expectedMove1d(spotPrice, atmIvPct);
  const emPct = spotPrice > 0 ? (em / spotPrice) * 100 : 0;
  const dealerLong = totalNetGex > 0;
  const volAboveTrig = spotPrice > keyLevels.volTrigger;
  const flowLabel =
    flowRatio > 0.55 ? "BULLISH" : flowRatio < 0.45 ? "BEARISH" : "NEUTRAL";

  const flipPct = pctFromSpot(spotPrice, keyLevels.gammaFlip);
  const volTrigPct = pctFromSpot(spotPrice, keyLevels.volTrigger);
  const spotDistFlipPct =
    spotPrice > 0 && keyLevels.gammaFlip > 0
      ? (Math.abs(spotPrice - keyLevels.gammaFlip) / spotPrice) * 100
      : 0;

  const narrative = dealerLong
    ? `${symbol} is trading in a long gamma environment — dealers are positioned to dampen realized volatility intraday. Moves tend to mean-revert; watch the call wall as resistance and the put wall as support.`
    : `${symbol} is in a short gamma regime — dealers can exacerbate directional moves. Respect the vol trigger and avoid fading strong trend days without a clear level.`;

  const vcAll = useMemo(
    () => computeVannaCharm(chain, spotPrice),
    [chain, spotPrice]
  );

  const vannaRows = useMemo(() => {
    return pickNearStrikeRows(vcAll, spotPrice, 14, (r) => ({
      k: strikeLabel(r.strike),
      strike: r.strike,
      v: r.vanna,
    }));
  }, [vcAll, spotPrice]);

  const charmRows = useMemo(() => {
    return pickNearStrikeRows(vcAll, spotPrice, 14, (r) => ({
      k: strikeLabel(r.strike),
      strike: r.strike,
      v: r.charm,
    }));
  }, [vcAll, spotPrice]);

  const spotKeyVanna = useMemo(() => {
    if (vannaRows.length === 0) return null;
    const closest = vannaRows.reduce((a, b) =>
      Math.abs(a.strike - spotPrice) < Math.abs(b.strike - spotPrice) ? a : b
    );
    return closest.k;
  }, [vannaRows, spotPrice]);

  const spotKeyCharm = useMemo(() => {
    if (charmRows.length === 0) return null;
    const closest = charmRows.reduce((a, b) =>
      Math.abs(a.strike - spotPrice) < Math.abs(b.strike - spotPrice) ? a : b
    );
    return closest.k;
  }, [charmRows, spotPrice]);

  const activityLine =
    lastUpdate &&
    `[${lastUpdate.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })}] DATA ${live ? "LIVE" : "DEMO"} — ${symbol} @ ${displaySpot.toFixed(2)} · NET GEX ${fmtBillions(totalNetGex)}`;

  const card = "rounded-md border border-white/[0.08] bg-[#0a0a0a]";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 md:p-4">
      <div className="flex shrink-0 items-baseline justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
          Terminal
        </h2>
        <span className="text-[10px] text-neutral-600">
          {live ? "LIVE" : "DEMO / CACHED"}
        </span>
      </div>

      <div className="grid shrink-0 grid-cols-1 gap-2 lg:grid-cols-3">
        {/* Gamma regime — Opacity left card */}
        <div className={`${card} p-3 lg:col-span-1`}>
          <div className="text-[9px] font-medium uppercase tracking-[0.16em] text-neutral-500">
            Gamma regime
          </div>
          <div className="mt-1 font-sans text-3xl font-semibold tabular-nums tracking-tight text-white">
            $
            {displaySpot.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div
            className={`mt-0.5 font-sans text-xs tabular-nums ${
              change >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {change >= 0 ? "+" : ""}
            {change.toFixed(2)} ({change >= 0 ? "+" : ""}
            {changePct.toFixed(2)}%)
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                dealerLong ? "bg-emerald-400" : "bg-red-400"
              }`}
            />
            <span
              className={`text-xs font-semibold ${
                dealerLong ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {dealerLong ? "LONG GAMMA" : "SHORT GAMMA"}
            </span>
          </div>
          <p
            className={`mt-1 text-[11px] font-medium leading-snug ${
              dealerLong ? "text-emerald-400/90" : "text-red-400/90"
            }`}
          >
            {dealerLong
              ? "Buy the dips — dealers long."
              : "Sell the rips — dealers short gamma."}
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">
            {narrative}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-3 font-sans text-[10px] tabular-nums text-neutral-500">
            <div>
              <div className="text-neutral-600">Gamma flip</div>
              <div className="text-neutral-200">
                ${keyLevels.gammaFlip.toFixed(2)}
              </div>
              <div className="text-amber-400/90">{flipPct}</div>
            </div>
            <div>
              <div className="text-neutral-600">Vol trigger</div>
              <div className="text-neutral-200">
                ${keyLevels.volTrigger.toFixed(2)}
              </div>
              <div className="text-violet-300/90">{volTrigPct}</div>
            </div>
          </div>
        </div>

        {/* Key levels — 2×3 */}
        <div className={`${card} p-3 lg:col-span-1`}>
          <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-neutral-500">
            Key levels
          </div>
          <div className="mt-1 text-[9px] text-neutral-600">
            Click pin — alert on cross (UI only)
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5 font-sans text-[10px]">
            {[
              ["CALL WALL", keyLevels.callWall, "text-emerald-400/95"],
              ["PUT WALL", keyLevels.putWall, "text-red-400/95"],
              ["MAX PAIN", keyLevels.maxPain, "text-amber-400/95"],
              ["GAMMA FLIP", keyLevels.gammaFlip, "text-neutral-400"],
              ["VOL TRIG", keyLevels.volTrigger, "text-violet-400/95"],
            ].map(([label, val, col]) => (
              <div
                key={String(label)}
                className="rounded border border-white/[0.06] bg-black/50 px-2 py-1.5"
              >
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

        {/* Exposure & flow */}
        <div className={`${card} p-3 lg:col-span-1`}>
          <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-neutral-500">
            Exposure &amp; flow
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5 font-sans text-[10px]">
            <div className="rounded border border-white/[0.06] bg-black/50 px-2 py-1.5">
              <div className="text-neutral-600">Net GEX</div>
              <div
                className={`mt-0.5 font-semibold tabular-nums ${
                  totalNetGex >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {fmtBillions(totalNetGex)}
              </div>
            </div>
            <div className="rounded border border-white/[0.06] bg-black/50 px-2 py-1.5">
              <div className="text-neutral-600">ATM IV</div>
              <div className="mt-0.5 font-semibold tabular-nums text-amber-400/95">
                {atmIvPct.toFixed(1)}%
              </div>
            </div>
            <div className="rounded border border-white/[0.06] bg-black/50 px-2 py-1.5">
              <div className="text-neutral-600">Flow ratio</div>
              <div
                className={`mt-0.5 font-semibold tabular-nums ${
                  flowRatio >= 0.5 ? "text-emerald-400/90" : "text-red-400/90"
                }`}
              >
                {flowRatio.toFixed(3)}
              </div>
              <div className="text-[9px] text-neutral-600">{flowLabel}</div>
            </div>
            <div className="rounded border border-white/[0.06] bg-black/50 px-2 py-1.5">
              <div className="text-neutral-600">Net flow</div>
              <div
                className={`mt-0.5 font-semibold tabular-nums ${
                  netFlow >= 0 ? "text-emerald-400/85" : "text-red-400/85"
                }`}
              >
                {(netFlow / 1e6).toFixed(2)}M
              </div>
            </div>
            <div className="rounded border border-white/[0.06] bg-black/50 px-2 py-1.5">
              <div className="text-neutral-600">Exp move 1D (est.)</div>
              <div className="mt-0.5 font-semibold tabular-nums text-neutral-200">
                ±${em.toFixed(2)} ({emPct.toFixed(2)}%)
              </div>
            </div>
            <div className="rounded border border-white/[0.06] bg-black/50 px-2 py-1.5">
              <div className="text-neutral-600">Vol regime</div>
              <div
                className={`mt-0.5 font-semibold ${
                  volAboveTrig ? "text-emerald-400/85" : "text-amber-400/90"
                }`}
              >
                {volAboveTrig ? "Above trig" : "Below trig"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Vanna + Charm — Opacity bottom row */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-2">
        <div className={`${card} flex min-h-[220px] flex-col p-2`}>
          <div className="shrink-0 px-1 pb-1 text-[9px] font-medium uppercase tracking-[0.14em] text-neutral-500">
            Vanna by strike
          </div>
          <div className="min-h-0 flex-1">
            {vannaRows.length === 0 ? (
              <div className="p-2 text-[10px] text-neutral-600">No chain data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={vannaRows}
                  margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#1a1a1a"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    stroke="#2a2a2a"
                    tick={{
                      fill: "#525252",
                      fontSize: 9,
                      fontFamily: "system-ui, sans-serif",
                    }}
                  />
                  <YAxis
                    type="category"
                    dataKey="k"
                    width={48}
                    stroke="#2a2a2a"
                    tick={(props) => (
                      <YTickSpot {...props} spotKey={spotKeyVanna} />
                    )}
                  />
                  <ReferenceLine x={0} stroke="#333" />
                  <Bar dataKey="v" barSize={9} radius={[0, 3, 3, 0]} isAnimationActive={false}>
                    {vannaRows.map((e, i) => (
                      <Cell
                        key={i}
                        fill={e.v >= 0 ? "#f97316" : "#818cf8"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className={`${card} flex min-h-[220px] flex-col p-2`}>
          <div className="shrink-0 px-1 pb-1 text-[9px] font-medium uppercase tracking-[0.14em] text-neutral-500">
            Charm by strike
          </div>
          <div className="min-h-0 flex-1">
            {charmRows.length === 0 ? (
              <div className="p-2 text-[10px] text-neutral-600">No chain data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={charmRows}
                  margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#1a1a1a"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    stroke="#2a2a2a"
                    tick={{
                      fill: "#525252",
                      fontSize: 9,
                      fontFamily: "system-ui, sans-serif",
                    }}
                  />
                  <YAxis
                    type="category"
                    dataKey="k"
                    width={48}
                    stroke="#2a2a2a"
                    tick={(props) => (
                      <YTickSpot {...props} spotKey={spotKeyCharm} />
                    )}
                  />
                  <ReferenceLine x={0} stroke="#333" />
                  <Bar dataKey="v" barSize={9} radius={[0, 3, 3, 0]} isAnimationActive={false}>
                    {charmRows.map((e, i) => (
                      <Cell
                        key={i}
                        fill={e.v >= 0 ? "#ec4899" : "#6366f1"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {activityLine && (
        <div className="shrink-0 rounded border border-white/[0.06] bg-black/60 px-2 py-1.5 font-mono text-[10px] text-neutral-500">
          {activityLine}
        </div>
      )}
    </div>
  );
}
