"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { Maximize2, Minimize2 } from "lucide-react";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { OptionContract } from "@/lib/gex-engine";
import { useElementFullscreen } from "@/hooks/useElementFullscreen";
import { useHeatmapViewStore, type GreekType } from "@/stores/useHeatmapViewStore";

type HeatmapDataset = {
  symbol: string;
  spotPrice: number;
  chain: OptionContract[];
  loading?: boolean;
  error?: string | null;
};

type GreekCell = {
  strike: number;
  expiry: string;
  value: number;
};

interface HeatmapViewProps {
  primarySymbol: string;
  primarySpotPrice: number;
  primaryChain: OptionContract[];
  live?: boolean;
  className?: string;
}

function shortExp(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso.slice(5);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function mixColor(c1: string, c2: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(c1);
  const [r2, g2, b2] = hexToRgb(c2);
  return `rgb(${lerp(r1, r2, t)}, ${lerp(g1, g2, t)}, ${lerp(b1, b2, t)})`;
}

function textClassForRgbString(color: string): string {
  const m = color.match(/\d+/g);
  if (!m || m.length < 3) return "text-[#d4d4d8]";
  const r = Number(m[0]);
  const g = Number(m[1]);
  const b = Number(m[2]);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.56 ? "text-[#0a0a0a]" : "text-[#f5f5f5]";
}

function formatCellNumber(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(0);
}

function daysToExpiry(iso: string): number {
  const now = Date.now();
  const t = new Date(`${iso}T12:00:00Z`).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.round((t - now) / 86_400_000));
}

function greekValueForContract(opt: OptionContract, spotPrice: number, greek: GreekType): number {
  const sign = opt.type === "call" ? 1 : -1;
  const dte = Math.max(1, daysToExpiry(opt.expiry));
  if (greek === "gamma") {
    const gex = opt.gamma * opt.oi * 100 * spotPrice * spotPrice * 0.01;
    return sign * gex;
  }
  if (greek === "delta") {
    return (opt.delta || 0) * opt.oi * 100 * spotPrice;
  }
  if (greek === "vanna") {
    return sign * opt.gamma * (opt.iv * 100 - 20) * opt.oi * 100 * spotPrice * 0.02;
  }
  // charm proxy
  return sign * -opt.delta * opt.oi * 100 * (1 / dte) * spotPrice * 0.3;
}

function buildCells(
  chain: OptionContract[],
  spotPrice: number,
  greek: GreekType,
  expirySlots: 1 | 2 | 3 | 4
): { cells: GreekCell[]; expiries: string[]; strikes: number[] } {
  const expiries = [...new Set(chain.map((c) => c.expiry))].sort().slice(0, expirySlots);
  const expirySet = new Set(expiries);
  const grouped = new Map<string, number>();
  for (const opt of chain) {
    if (!expirySet.has(opt.expiry)) continue;
    if (opt.oi <= 0) continue;
    const key = `${opt.strike}|${opt.expiry}`;
    const val = greekValueForContract(opt, spotPrice, greek);
    grouped.set(key, (grouped.get(key) ?? 0) + val);
  }
  const cells: GreekCell[] = [];
  for (const [key, value] of grouped) {
    const [strike, expiry] = key.split("|");
    cells.push({ strike: Number(strike), expiry, value });
  }
  const strikes = [...new Set(cells.map((c) => c.strike))].sort((a, b) => b - a);
  return { cells, expiries, strikes };
}

function HeatmapPanel({
  title,
  dataset,
  greek,
  expirySlots,
  compactMode,
}: {
  title: string;
  dataset: HeatmapDataset | null;
  greek: GreekType;
  expirySlots: 1 | 2 | 3 | 4;
  compactMode: boolean;
}) {
  const panelRef = useRef<HTMLElement | null>(null);
  const { isFullscreen, toggleFullscreen } = useElementFullscreen(panelRef);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { cells, expiries, strikes } = useMemo(() => {
    if (!dataset) return { cells: [], expiries: [], strikes: [] };
    return buildCells(dataset.chain, dataset.spotPrice, greek, expirySlots);
  }, [dataset, greek, expirySlots]);

  const valueMap = useMemo(
    () => new Map(cells.map((c) => [`${c.strike}|${c.expiry}`, c.value])),
    [cells]
  );
  const [min, max] = useMemo(() => {
    if (cells.length === 0) return [0, 0];
    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    for (const c of cells) {
      if (c.value < lo) lo = c.value;
      if (c.value > hi) hi = c.value;
    }
    return [lo, hi];
  }, [cells]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: strikes.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => (compactMode ? 26 : 34),
    overscan: 10,
  });

  const templateCols = `92px repeat(${Math.max(1, expiries.length)}, minmax(92px, 1fr))`;

  function backgroundForValue(v: number): string {
    if (max === min) return "rgb(24, 24, 27)";
    const t = Math.max(0, Math.min(1, (v - min) / (max - min)));
    if (t <= 0.5) {
      return mixColor("#05070a", "#42b9bb", t / 0.5);
    }
    if (t <= 0.78) {
      return mixColor("#42b9bb", "#8cd17d", (t - 0.5) / 0.28);
    }
    return mixColor("#8cd17d", "#ff6b4a", (t - 0.78) / 0.22);
  }

  return (
    <section
      ref={panelRef}
      className={cn(
        "flex flex-col min-h-0 rounded border border-[#1b1b1b] bg-[#090909] panel-sheen",
        isFullscreen && "h-screen"
      )}
    >
      <header className="flex items-center justify-between border-b border-[#171717] px-2 py-1.5 flex-shrink-0">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#7a7a7a]">
            {title}
          </div>
          <div className="font-mono text-[10px] text-[#5a5a5a]">
            Spot {dataset?.spotPrice?.toFixed(2) ?? "—"}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void toggleFullscreen()}
          className="rounded border border-[#2a2a2a] bg-[#101010] p-1 text-[#9ca3af] hover:text-[#e5e7eb]"
          aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
      </header>

      <div className={cn("flex min-h-0", isFullscreen && "flex-1")}>
        <div ref={scrollRef} className={cn("min-h-0 flex-1 overflow-auto", isFullscreen ? "h-full" : "h-[420px]")}>
          <div
            className="sticky top-0 z-20 grid border-b border-[#181818] bg-[#0d0d0d]"
            style={{ gridTemplateColumns: templateCols }}
          >
            <div className="sticky left-0 z-30 border-r border-[#181818] bg-[#0d0d0d] px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-[#6a6a6a]">
              Strike
            </div>
            {expiries.map((exp) => (
              <div
                key={exp}
                className="px-1 py-1 text-center font-mono text-[9px] text-[#7c7c7c]"
              >
                {shortExp(exp)}
              </div>
            ))}
          </div>

          <div
            className="relative"
            style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
          >
            {rowVirtualizer.getVirtualItems().map((vr) => {
              const strike = strikes[vr.index];
              return (
                <div
                  key={strike}
                  className="absolute left-0 top-0 grid w-full border-b border-[#111]"
                  style={{
                    transform: `translateY(${vr.start}px)`,
                    height: `${vr.size}px`,
                    gridTemplateColumns: templateCols,
                  }}
                >
                  <div className="sticky left-0 z-10 border-r border-[#181818] bg-[#0d0d0d] px-2 py-1 font-mono text-[10px] text-[#a1a1aa]">
                    {strike.toFixed(0)}
                  </div>
                  {expiries.map((exp) => {
                    const value = valueMap.get(`${strike}|${exp}`) ?? 0;
                    const bg = backgroundForValue(value);
                    return (
                      <div
                        key={`${strike}|${exp}`}
                        title={`${dataset?.symbol ?? "—"} ${greek.toUpperCase()} | ${shortExp(
                          exp
                        )} | ${strike.toFixed(0)} | ${value.toLocaleString()}`}
                        className={cn(
                          "px-1 py-1 text-right font-mono text-[9px] leading-none",
                          textClassForRgbString(bg)
                        )}
                        style={{ backgroundColor: bg }}
                      >
                        {formatCellNumber(value)}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <aside className={cn("flex w-12 flex-col items-center justify-between border-l border-[#171717] px-1 py-2", isFullscreen ? "h-full" : "h-[420px]")}>
          <div className="h-full w-2 rounded bg-gradient-to-b from-[#ff6b4a] via-[#8cd17d] via-[50%] to-[#05070a]" />
          <div className="font-mono text-[8px] text-[#8a8a8a]">{formatCellNumber(max)}</div>
          <div className="font-mono text-[8px] text-[#626262]">0</div>
          <div className="font-mono text-[8px] text-[#8a8a8a]">{formatCellNumber(min)}</div>
        </aside>
      </div>

      {dataset?.error ? (
        <div className="border-t border-[#171717] px-2 py-1 font-mono text-[9px] text-rose-300">
          {dataset.error}
        </div>
      ) : null}
    </section>
  );
}

export default function HeatmapView({
  primarySymbol,
  primarySpotPrice,
  primaryChain,
  live = false,
  className,
}: HeatmapViewProps) {
  const {
    leftTicker,
    rightTicker,
    greek,
    viewMode,
    expirySlots,
    compactMode,
    setLeftTicker,
    setRightTicker,
    setGreek,
    setViewMode,
    setExpirySlots,
    toggleCompactMode,
  } = useHeatmapViewStore();
  const [cache, setCache] = useState<Record<string, HeatmapDataset>>(() => ({
    [primarySymbol]: {
      symbol: primarySymbol,
      spotPrice: primarySpotPrice,
      chain: primaryChain,
      loading: false,
      error: null,
    },
  }));

  const tickerPool = useMemo(() => ["SPX", "NDX"], []);

  const normalizedPrimary = primarySymbol === "NDX" ? "NDX" : "SPX";

  useEffect(() => {
    startTransition(() => {
      setCache((prev) => ({
        ...prev,
        [normalizedPrimary]: {
          symbol: normalizedPrimary,
          spotPrice: primarySpotPrice,
          chain: primaryChain,
          loading: false,
          error: null,
        },
      }));
    });
  }, [normalizedPrimary, primarySpotPrice, primaryChain]);

  useEffect(() => {
    if (!tickerPool.includes(leftTicker)) setLeftTicker(normalizedPrimary);
    if (!tickerPool.includes(rightTicker)) {
      setRightTicker(normalizedPrimary === "SPX" ? "NDX" : "SPX");
    }
  }, [
    leftTicker,
    rightTicker,
    tickerPool,
    normalizedPrimary,
    setLeftTicker,
    setRightTicker,
  ]);

  useEffect(() => {
    const needed = new Set<string>([leftTicker]);
    if (viewMode === "dual") needed.add(rightTicker);
    const symbolsToLoad = [...needed].filter((sym) => !cache[sym]?.chain?.length);
    if (symbolsToLoad.length === 0) return;
    let cancelled = false;
    for (const sym of symbolsToLoad) {
      startTransition(() => {
        setCache((prev) => ({
          ...prev,
          [sym]: {
            symbol: sym,
            spotPrice: prev[sym]?.spotPrice ?? 0,
            chain: prev[sym]?.chain ?? [],
            loading: true,
            error: null,
          },
        }));
      });
      void fetch(`/api/options?symbol=${sym}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => {
          if (cancelled) return;
          const chain = Array.isArray(j?.chain) ? (j.chain as OptionContract[]) : [];
          const spotPrice = Number(j?.spotPrice) || 0;
          setCache((prev) => ({
            ...prev,
            [sym]: {
              symbol: sym,
              spotPrice,
              chain,
              loading: false,
              error: chain.length ? null : "Insufficient chain for selected ticker",
            },
          }));
        })
        .catch(() => {
          if (cancelled) return;
          setCache((prev) => ({
            ...prev,
            [sym]: {
              symbol: sym,
              spotPrice: prev[sym]?.spotPrice ?? 0,
              chain: prev[sym]?.chain ?? [],
              loading: false,
              error: "Failed to fetch options chain",
            },
          }));
        });
    }
    return () => {
      cancelled = true;
    };
  }, [leftTicker, rightTicker, viewMode, cache]);

  const leftDataset = cache[leftTicker] ?? null;
  const rightDataset = cache[rightTicker] ?? null;

  return (
    <div className={cn("flex h-full min-h-0 flex-col gap-2 p-2", className)}>
      <div className="rounded border border-[#1b1b1b] bg-[#070707] px-2 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-mono text-sm font-semibold text-[#ececec]">Gamma Heatmap</div>
          <div className="flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[9px] text-emerald-300">
            <span className={cn("h-1.5 w-1.5 rounded-full bg-emerald-300", live && "animate-pulse")} />
            LIVE
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            {tickerPool.map((t) => (
              <button
                key={`left-${t}`}
                type="button"
                onClick={() => setLeftTicker(t)}
                className={cn(
                  "rounded border px-2 py-1 font-mono text-[9px]",
                  leftTicker === t
                    ? "border-[#8b8b8b] bg-[#1b1b1b] text-white"
                    : "border-[#2a2a2a] bg-[#101010] text-[#7a7a7a]"
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="ml-2 flex items-center gap-1">
            {(["gamma", "vanna", "charm", "delta"] as GreekType[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGreek(g)}
                className={cn(
                  "rounded border px-2 py-1 font-mono text-[9px] uppercase",
                  greek === g
                    ? "border-[#8b8b8b] bg-[#1b1b1b] text-white"
                    : "border-[#2a2a2a] bg-[#101010] text-[#7a7a7a]"
                )}
              >
                {g}
              </button>
            ))}
          </div>

          <div className="ml-2 flex items-center gap-1">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={`exp-${n}`}
                type="button"
                onClick={() => setExpirySlots(n as 1 | 2 | 3 | 4)}
                className={cn(
                  "rounded border px-2 py-1 font-mono text-[9px]",
                  expirySlots === n
                    ? "border-[#8b8b8b] bg-[#1b1b1b] text-white"
                    : "border-[#2a2a2a] bg-[#101010] text-[#7a7a7a]"
                )}
              >
                {n}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setViewMode("single")}
              className={cn(
                "rounded border px-2 py-1 font-mono text-[9px]",
                viewMode === "single"
                  ? "border-[#8b8b8b] bg-[#1b1b1b] text-white"
                  : "border-[#2a2a2a] bg-[#101010] text-[#7a7a7a]"
              )}
            >
              Single
            </button>
            <button
              type="button"
              onClick={() => setViewMode("dual")}
              className={cn(
                "rounded border px-2 py-1 font-mono text-[9px]",
                viewMode === "dual"
                  ? "border-[#8b8b8b] bg-[#1b1b1b] text-white"
                  : "border-[#2a2a2a] bg-[#101010] text-[#7a7a7a]"
              )}
            >
              Dual
            </button>
            <button
              type="button"
              onClick={toggleCompactMode}
              className="rounded border border-[#2a2a2a] bg-[#101010] px-2 py-1 font-mono text-[9px] text-[#9ca3af]"
            >
              {compactMode ? "Compact" : "Comfort"}
            </button>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "grid min-h-0 flex-1 gap-2",
          viewMode === "dual" ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1"
        )}
      >
        <HeatmapPanel
          title={leftTicker}
          dataset={leftDataset}
          greek={greek}
          expirySlots={expirySlots}
          compactMode={compactMode}
        />
        {viewMode === "dual" && (
          <div className="flex min-h-0 flex-col gap-2">
            <div className="flex items-center gap-1 rounded border border-[#1d1d1d] bg-[#0b0b0b] px-2 py-1">
              {tickerPool.map((t) => (
                <button
                  key={`right-${t}`}
                  type="button"
                  onClick={() => setRightTicker(t)}
                  className={cn(
                    "rounded border px-2 py-1 font-mono text-[9px]",
                    rightTicker === t
                      ? "border-[#8b8b8b] bg-[#1b1b1b] text-white"
                      : "border-[#2a2a2a] bg-[#101010] text-[#7a7a7a]"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <HeatmapPanel
              title={rightTicker}
              dataset={rightDataset}
              greek={greek}
              expirySlots={expirySlots}
              compactMode={compactMode}
            />
          </div>
        )}
      </div>
    </div>
  );
}
