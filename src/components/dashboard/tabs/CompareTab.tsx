"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import type { TickerSymbol } from "@/lib/constants";
import {
  computeGEXByStrike,
  computeKeyLevels,
  type KeyLevels,
  type OptionContract,
} from "@/lib/gex-engine";
import { isIndexSymbol } from "@/lib/constants";

function orderedSymbols(
  primary: TickerSymbol
): TickerSymbol[] {
  const normalized: TickerSymbol = primary === "NDX" ? "NDX" : "SPX";
  const other: TickerSymbol = normalized === "SPX" ? "NDX" : "SPX";
  return [normalized, other];
}

function computeAtmIvPct(chain: OptionContract[], spot: number): number {
  const near = chain.filter(
    (c) => spot > 0 && Math.abs(c.strike - spot) / spot < 0.02
  );
  if (near.length === 0) return 0;
  const avg = near.reduce((s, c) => s + c.iv, 0) / near.length;
  return avg * 100;
}

function confluence(
  spot: number,
  levels: KeyLevels,
  totalNetGex: number
): { score: number; label: string } {
  let s = 50;
  if (totalNetGex > 0) s += 12;
  else s -= 10;
  const dCall = levels.callWall > 0 ? Math.abs(spot - levels.callWall) / spot : 1;
  const dPut = levels.putWall > 0 ? Math.abs(spot - levels.putWall) / spot : 1;
  if (dCall < 0.015) s -= 10;
  if (dPut < 0.015) s += 8;
  const dFlip =
    levels.gammaFlip > 0 ? Math.abs(spot - levels.gammaFlip) / spot : 1;
  if (dFlip < 0.025) s += 6;
  s = Math.round(Math.max(0, Math.min(100, s)));
  let label = "NEUTRAL";
  if (s >= 65) label = "BULL";
  else if (s >= 56) label = "LEAN BULL";
  else if (s <= 35) label = "BEAR";
  else if (s <= 44) label = "LEAN BEAR";
  return { score: s, label };
}

interface CardState {
  symbol: TickerSymbol;
  loading: boolean;
  error: string | null | undefined;
  stale: boolean;
  degraded: boolean;
  note: string | null;
  live: boolean;
  spot: number;
  displaySpot: number;
  totalNetGex: number;
  atmIvPct: number;
  levels: KeyLevels | null;
  gexChart: { k: string; netM: number }[];
}

interface Props {
  primarySymbol: TickerSymbol;
  /** Switch header symbol and open Terminal tab. */
  onOpenInTerminal?: (s: TickerSymbol) => void;
}

type SymbolData = Omit<CardState, "symbol" | "loading" | "error">;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function loadSymbol(
  sym: TickerSymbol
): Promise<SymbolData> {
  let lastError = "Quote and options unavailable";

  for (let attempt = 0; attempt < 3; attempt++) {
    const [quoteRes, optionsRes] = await Promise.all([
      fetch(`/api/quote?symbol=${sym}`, { cache: "no-store" }),
      fetch(`/api/options?symbol=${sym}`, { cache: "no-store" }),
    ]);
    const quote = await quoteRes.json();
    const options = await optionsRes.json();

    const quoteBad = !quoteRes.ok || quote.fallback;
    const optionsBad = !optionsRes.ok || options.fallback;
    if (quoteBad && optionsBad) {
      lastError = "Quote and options unavailable";
      if (attempt < 2) {
        await sleep(350 * 2 ** attempt);
        continue;
      }
      break;
    }

    const chain: OptionContract[] = options.chain || [];
    const spotMath = Number(options.spotPrice) || Number(quote.spotPrice) || 0;
    const indexView = isIndexSymbol(sym);
    const quoteSpot = Number(quote.spotPrice) || 0;
    const displaySpot = indexView && quoteSpot > 0 ? quoteSpot : spotMath;

    if (!spotMath || chain.length === 0) {
      lastError = "Insufficient chain";
      if (attempt < 2) {
        await sleep(350 * 2 ** attempt);
        continue;
      }
      break;
    }

    const gexByStrike = computeGEXByStrike(chain, spotMath);
    const levels = computeKeyLevels(gexByStrike, spotMath);
    const totalNetGex = gexByStrike.reduce((a, r) => a + r.netGEX, 0);
    const atmIvPct = computeAtmIvPct(chain, spotMath);

    let selected = gexByStrike
      .filter((r) => Math.abs(r.strike - spotMath) / spotMath <= 0.055)
      .sort(
        (a, b) =>
          Math.abs(a.strike - spotMath) - Math.abs(b.strike - spotMath)
      )
      .slice(0, 14);
    let usedWideBand = false;
    if (selected.length < 6) {
      usedWideBand = true;
      selected = [...gexByStrike]
        .sort(
          (a, b) =>
            Math.abs(a.strike - spotMath) - Math.abs(b.strike - spotMath)
        )
        .slice(0, 14);
    }

    const gexChart = selected
      .sort((a, b) => a.strike - b.strike)
      .map((r) => ({
        k: `$${Number(r.strike.toFixed(r.strike >= 200 ? 0 : 1))}`,
        netM: r.netGEX / 1e6,
      }));

    const degraded = chain.length < 60 || usedWideBand || quoteBad || optionsBad;
    const live = !quoteBad && !optionsBad && !degraded;
    const noteParts: string[] = [];
    if (chain.length < 60) noteParts.push(`Partial chain (${chain.length})`);
    if (usedWideBand) noteParts.push("Wide strike band");
    if (quoteBad || optionsBad) noteParts.push("One data source fallback");

    return {
      stale: false,
      degraded,
      note: noteParts.length > 0 ? noteParts.join(" · ") : null,
      live,
      spot: spotMath,
      displaySpot,
      totalNetGex,
      atmIvPct,
      levels,
      gexChart,
    };
  }

  throw new Error(lastError);
}

export default function CompareTab({
  primarySymbol,
  onOpenInTerminal,
}: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshMs, setLastRefreshMs] = useState<number | null>(null);
  const symbols = useMemo(() => orderedSymbols(primarySymbol), [primarySymbol]);

  const lastGoodRef = useRef<Partial<Record<TickerSymbol, SymbolData>>>({});

  const [cards, setCards] = useState<CardState[]>(() =>
    symbols.map((s) => ({
      symbol: s,
      loading: true,
      error: null,
      stale: false,
      degraded: false,
      note: null,
      live: false,
      spot: 0,
      displaySpot: 0,
      totalNetGex: 0,
      atmIvPct: 0,
      levels: null,
      gexChart: [],
    }))
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setCards(
      symbols.map((s) => ({
        symbol: s,
        loading: true,
        error: null,
        stale: false,
        degraded: false,
        note: null,
        live: false,
        spot: 0,
        displaySpot: 0,
        totalNetGex: 0,
        atmIvPct: 0,
        levels: null,
        gexChart: [],
      }))
    );

    try {
      const results = await Promise.all(
        symbols.map(async (sym) => {
          try {
            const data = await loadSymbol(sym);
            lastGoodRef.current[sym] = data;
            return {
              symbol: sym,
              loading: false,
              error: null,
              ...data,
            } as CardState;
          } catch (e) {
            const msg = e instanceof Error ? e.message : "Error";
            const snapshot = lastGoodRef.current[sym];
            if (snapshot) {
              return {
                symbol: sym,
                loading: false,
                error: null,
                ...snapshot,
                stale: true,
                live: false,
                note: `Using last good snapshot · ${msg}`,
              } as CardState;
            }
            return {
              symbol: sym,
              loading: false,
              error: msg,
              stale: false,
              degraded: false,
              note: null,
              live: false,
              spot: 0,
              displaySpot: 0,
              totalNetGex: 0,
              atmIvPct: 0,
              levels: null,
              gexChart: [],
            } as CardState;
          }
        })
      );
      setCards(results);
      setLastRefreshMs(Date.now());
    } finally {
      setRefreshing(false);
    }
  }, [symbols]);

  useEffect(() => {
    startTransition(() => {
      void refresh();
    });
  }, [refresh]);

  return (
    <div className="h-full flex flex-col p-3 min-h-0 overflow-auto">
      <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
        <div>
          <h2 className="text-sm font-mono font-bold tracking-wider text-[#f0f0f0]">
            DUAL INDEX COMPARISON
          </h2>
          <p className="text-[10px] text-[#525252] font-mono mt-0.5">
            SPX vs NDX side-by-side metrics and GEX profile
          </p>
          <p className="text-[9px] text-[#444] font-mono mt-0.5">
            {refreshing ? "Refreshing…" : "Refresh ready"}
            {lastRefreshMs
              ? ` · ${new Date(lastRefreshMs).toLocaleTimeString()}`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="text-[10px] font-mono px-2 py-1 rounded border border-[#333] text-[#a3a3a3] hover:bg-[#161616] hover:text-white disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh All"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 flex-1 min-h-[320px]">
        {cards.map((c) => (
          <div
            key={c.symbol}
            className="flex flex-col rounded border border-[#1f1f1f] bg-[#080808] overflow-hidden min-h-[300px]"
          >
            <div className="px-2.5 py-2 border-b border-[#1a1a1a] flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-white">
                    {c.symbol}
                  </span>
                  {!c.loading && !c.error && (
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                        c.totalNetGex >= 0
                          ? "border-emerald-800/60 text-emerald-400 bg-emerald-950/30"
                          : "border-red-900/50 text-red-400 bg-red-950/20"
                      }`}
                    >
                      {c.totalNetGex >= 0 ? "LONG Γ" : "SHORT Γ"}
                    </span>
                  )}
                  {!c.loading && !c.error && c.stale && (
                    <span className="text-[9px] text-amber-400/90 font-mono">
                      STALE
                    </span>
                  )}
                  {!c.loading && !c.error && !c.stale && c.degraded && (
                    <span className="text-[9px] text-[#888] font-mono">
                      DEGRADED
                    </span>
                  )}
                  {c.live && (
                    <span className="text-[9px] text-[#525252] font-mono">
                      LIVE
                    </span>
                  )}
                </div>
                <div className="font-mono text-xs text-[#d4d4d4] mt-0.5 tabular-nums">
                  {c.loading
                    ? "—"
                    : c.error
                      ? "—"
                      : `$${c.displaySpot.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`}
                </div>
                {!c.loading && !c.error && c.note && (
                  <div className="mt-0.5 font-mono text-[9px] text-[#686868]">
                    {c.note}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-[120px] px-1 py-1">
              {c.loading ? (
                <div className="h-full flex items-center justify-center text-[10px] text-[#525252] font-mono">
                  Loading…
                </div>
              ) : c.error ? (
                <div className="h-full flex items-center justify-center text-[10px] text-red-400/90 font-mono px-2 text-center">
                  {c.error === "Insufficient chain"
                    ? "Insufficient Yahoo options chain for this symbol — try Refresh or later."
                    : c.error}
                </div>
              ) : c.gexChart.length === 0 ? (
                <div className="h-full flex items-center justify-center text-[10px] text-[#525252] font-mono">
                  No strikes in band
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={c.gexChart}
                    margin={{ top: 4, right: 6, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#151515"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      stroke="#2a2a2a"
                      tick={{ fill: "#525252", fontSize: 8, fontFamily: "monospace" }}
                      tickFormatter={(v: number) => `${v}M`}
                    />
                    <YAxis
                      type="category"
                      dataKey="k"
                      width={40}
                      stroke="#2a2a2a"
                      tick={{ fill: "#737373", fontSize: 8, fontFamily: "monospace" }}
                    />
                    <ReferenceLine x={0} stroke="#333" />
                    <Bar
                      dataKey="netM"
                      barSize={7}
                      radius={[0, 2, 2, 0]}
                      activeBar={false}
                    >
                      {c.gexChart.map((e, i) => (
                        <Cell
                          key={i}
                          fill={e.netM >= 0 ? "#4ade80" : "#f87171"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {!c.loading && !c.error && c.levels && (
              <>
                <div className="px-2.5 py-2 border-t border-[#1a1a1a] space-y-2">
                  {(() => {
                    const { score, label } = confluence(
                      c.spot,
                      c.levels,
                      c.totalNetGex
                    );
                    return (
                      <div>
                        <div className="flex justify-between text-[10px] font-mono text-[#737373] mb-1">
                          <span>CONFLUENCE</span>
                          <span className="text-[#e5e5e5]">
                            {score}/100 ·{" "}
                            <span
                              className={
                                score >= 56
                                  ? "text-emerald-400"
                                  : score <= 44
                                    ? "text-red-400"
                                    : "text-[#a3a3a3]"
                              }
                            >
                              {label}
                            </span>
                          </span>
                        </div>
                        <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              score >= 56
                                ? "bg-emerald-500"
                                : score <= 44
                                  ? "bg-red-500"
                                  : "bg-[#737373]"
                            }`}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] font-mono">
                    <span className="text-[#525252]">NET GEX</span>
                    <span
                      className={
                        c.totalNetGex >= 0 ? "text-emerald-400" : "text-red-400"
                      }
                    >
                      {c.totalNetGex >= 0 ? "+" : ""}
                      {(c.totalNetGex / 1e9).toFixed(2)}B
                    </span>
                    <span className="text-[#525252]">ATM IV</span>
                    <span className="text-amber-400/90">
                      {c.atmIvPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="space-y-0.5 text-[9px] font-mono leading-relaxed">
                    <div className="flex justify-between gap-2">
                      <span className="text-amber-500/90">G-FLIP</span>
                      <span className="text-[#d4d4d4] tabular-nums">
                        ${c.levels.gammaFlip.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-emerald-400/90">CALL WALL</span>
                      <span className="text-[#d4d4d4] tabular-nums">
                        ${c.levels.callWall.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-red-400/90">PUT WALL</span>
                      <span className="text-[#d4d4d4] tabular-nums">
                        ${c.levels.putWall.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-[#a3a3a3]">VOL TRIG</span>
                      <span className="text-[#d4d4d4] tabular-nums">
                        ${c.levels.volTrigger.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-auto px-2.5 py-1.5 border-t border-[#1a1a1a]">
                  <button
                    type="button"
                    onClick={() => onOpenInTerminal?.(c.symbol)}
                    className="text-[10px] font-mono text-[#737373] hover:text-[#00ff88] w-full text-left"
                  >
                    Open in Terminal →
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
