"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  TickerSymbol,
  DEFAULT_REFRESH_MS,
  MARKET_OPEN_HOUR,
  MARKET_OPEN_MIN,
  MARKET_CLOSE_HOUR,
  MARKET_CLOSE_MIN,
} from "@/lib/constants";
import {
  OptionContract,
  GEXByStrike,
  KeyLevels,
  HeatmapCell,
  FlowEntry,
  computeGEXByStrike,
  computeKeyLevels,
  computeHeatmap,
  detectUnusualFlow,
  computeFlowRatio,
} from "@/lib/gex-engine";
import {
  getSpotPrice,
  generateOptionsChain,
  generateMarketNews,
} from "@/lib/mock-data";

function computeAtmIvPct(chain: OptionContract[], spot: number): number {
  const near = chain.filter(
    (c) => spot > 0 && Math.abs(c.strike - spot) / spot < 0.02
  );
  if (near.length === 0) return 0;
  const avg = near.reduce((s, c) => s + c.iv, 0) / near.length;
  return avg * 100;
}

function sumNetGex(gex: GEXByStrike[]): number {
  return gex.reduce((s, r) => s + r.netGEX, 0);
}

export interface MarketData {
  symbol: TickerSymbol;
  /** Spot aligned to current dual-index options chain for analytics. */
  spotPrice: number;
  /** Header/footer display price from selected dual-index quote. */
  displaySpot: number;
  prevClose: number;
  change: number;
  changePct: number;
  chain: OptionContract[];
  gexByStrike: GEXByStrike[];
  keyLevels: KeyLevels;
  heatmap: HeatmapCell[];
  unusualFlow: FlowEntry[];
  flowRatio: number;
  netFlow: number;
  totalNetGex: number;
  atmIvPct: number;
  atmIvDecimal: number;
  daysToExpiry: number;
  expectedMove: number;
  projectedHigh: number;
  projectedLow: number;
  estimatedLevels: boolean;
  optionsDataSource: "INDEX_OPTIONS" | "ETF_PROXY" | "MOCK";
  optionsSourceNote: string | null;
  /** CBOE VIX index (Yahoo ^VIX) when live quote succeeds; null if unavailable. */
  vix: number | null;
  vixChangePct: number | null;
  expiries: string[];
  selectedExpiry: string | null;
  news: Array<{
    id: string;
    title: string;
    source: string;
    time: string;
    sentiment: "bullish" | "bearish" | "neutral";
    url?: string;
  }>;
  lastUpdate: Date;
  loading: boolean;
  live: boolean;
  isMarketOpen: boolean;
}

function checkMarketOpen(): boolean {
  const now = new Date();
  const et = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const day = et.getDay();
  if (day === 0 || day === 6) return false;
  const mins = et.getHours() * 60 + et.getMinutes();
  const open = MARKET_OPEN_HOUR * 60 + MARKET_OPEN_MIN;
  const close = MARKET_CLOSE_HOUR * 60 + MARKET_CLOSE_MIN;
  return mins >= open && mins < close;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function nextMonthlyDte(expiries: string[] | undefined): number {
  if (!expiries || expiries.length === 0) return 30;
  const now = new Date();
  const dayMs = 86_400_000;
  for (const iso of expiries) {
    const d = new Date(`${iso}T12:00:00Z`);
    if (Number.isNaN(d.getTime())) continue;
    const day = d.getUTCDay();
    const date = d.getUTCDate();
    const isMonthly = day === 5 && date >= 15 && date <= 21;
    if (!isMonthly) continue;
    const dte = Math.ceil((d.getTime() - now.getTime()) / dayMs);
    if (dte > 0) return dte;
  }
  return 30;
}

function computeExpectedMove(
  spot: number,
  atmIvPct: number,
  daysToExpiry: number
): { expectedMove: number; projectedHigh: number; projectedLow: number; atmIvDecimal: number } {
  const atmIvDecimal = Math.max(0, atmIvPct / 100);
  const dte = Math.max(1, daysToExpiry);
  let expectedMove = spot * atmIvDecimal * Math.sqrt(dte / 365);
  const maxMove = spot * 0.05;
  if (atmIvPct <= 40 && expectedMove > maxMove) {
    expectedMove = maxMove;
  }
  return {
    expectedMove,
    projectedHigh: spot + expectedMove,
    projectedLow: spot - expectedMove,
    atmIvDecimal,
  };
}

function scaleChainToSpot(
  chain: OptionContract[],
  sourceSpot: number,
  targetSpot: number
): OptionContract[] {
  if (!sourceSpot || !targetSpot) return chain;
  const ratio = targetSpot / sourceSpot;
  if (!Number.isFinite(ratio) || ratio <= 0) return chain;
  if (Math.abs(ratio - 1) < 0.02) return chain;
  return chain.map((c) => ({
    ...c,
    strike: c.strike * ratio,
    bid: c.bid * ratio,
    ask: c.ask * ratio,
    lastPrice: c.lastPrice * ratio,
  }));
}

export function useMarketData(
  symbol: TickerSymbol,
  refreshMs: number = DEFAULT_REFRESH_MS
) {
  const [data, setData] = useState<MarketData | null>(null);
  const [selectedExpiry, setSelectedExpiry] = useState<string | null>(null);
  const prevCloseRef = useRef<number>(0);
  const mountedRef = useRef(true);
  const lastGoodRef = useRef<MarketData | null>(null);

  const fallbackToMock = useCallback(() => {
    const displaySpot = getSpotPrice(symbol);
    if (prevCloseRef.current === 0) {
      prevCloseRef.current = displaySpot * (1 - (Math.random() - 0.5) * 0.01);
    }

    const chain = generateOptionsChain(symbol, displaySpot);
    const expiries = [...new Set(chain.map((c) => c.expiry))].sort();

    const filteredChain = selectedExpiry
      ? chain.filter((c) => c.expiry === selectedExpiry)
      : chain;

    const gexByStrike = computeGEXByStrike(filteredChain, displaySpot);
    const rawLevels = computeKeyLevels(gexByStrike, displaySpot);
    const estimatedLevels = gexByStrike.length === 0;
    const keyLevels = estimatedLevels
      ? {
          ...rawLevels,
          callWall: displaySpot * 1.008,
          putWall: displaySpot * 0.992,
          maxPain: displaySpot,
        }
      : rawLevels;
    const heatmap = computeHeatmap(chain, displaySpot);
    const unusualFlow = detectUnusualFlow(chain);
    const { ratio: flowRatio, netFlow } = computeFlowRatio(chain);
    const totalNetGex = sumNetGex(gexByStrike);
    const atmIvPct = computeAtmIvPct(chain, displaySpot);
    const daysToExpiry = nextMonthlyDte(expiries);
    const { expectedMove, projectedHigh, projectedLow, atmIvDecimal } =
      computeExpectedMove(displaySpot, atmIvPct, daysToExpiry);
    const news = generateMarketNews();
    const vixDemo =
      18.8 + (symbol.codePointAt(0) ?? 65) * 0.012 + (symbol.length % 7) * 0.08;
    const vixChangeDemo = -0.35 + (symbol.length % 5) * 0.12;

    const change = displaySpot - prevCloseRef.current;
    const changePct = (change / prevCloseRef.current) * 100;

    if (!mountedRef.current) return;

    setData({
      symbol,
      spotPrice: displaySpot,
      displaySpot,
      prevClose: prevCloseRef.current,
      change,
      changePct,
      chain,
      gexByStrike,
      keyLevels,
      heatmap,
      unusualFlow,
      flowRatio,
      netFlow,
      totalNetGex,
      atmIvPct,
      atmIvDecimal,
      daysToExpiry,
      expectedMove,
      projectedHigh,
      projectedLow,
      estimatedLevels,
      optionsDataSource: "MOCK",
      optionsSourceNote: "Synthetic fallback chain in use.",
      vix: vixDemo,
      vixChangePct: vixChangeDemo,
      expiries,
      selectedExpiry,
      news,
      lastUpdate: new Date(),
      loading: false,
      live: false,
      isMarketOpen: checkMarketOpen(),
    });
  }, [symbol, selectedExpiry]);

  const fetchLiveData = useCallback(async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const [quoteRes, vixRes, optionsRes, newsRes] = await Promise.all([
          fetch(`/api/quote?symbol=${symbol}`, { cache: "no-store" }),
          fetch(`/api/quote?symbol=VIX`, { cache: "no-store" }),
          fetch(`/api/options?symbol=${symbol}`, { cache: "no-store" }),
          fetch(`/api/news`, { cache: "no-store" }),
        ]);

        if (!quoteRes.ok || !optionsRes.ok) throw new Error("API failed");

        const quote = await quoteRes.json();
        const vixQuote = vixRes.ok ? await vixRes.json() : { fallback: true };
        const options = await optionsRes.json();
        const newsData = await newsRes.json().catch(() => ({ headlines: [] }));

        if (quote.fallback && options.fallback) {
          throw new Error("Both APIs failed");
        }

        const quoteSpot = Number(quote.spotPrice) || 0;
        const underlyingSpot = Number(options.spotPrice) || 0;
        const chainRaw: OptionContract[] = options.chain || [];
        const expiries: string[] = options.expirations || [];
        const optionsDataSource: "INDEX_OPTIONS" | "ETF_PROXY" =
          options.dataSource === "INDEX_OPTIONS" ? "INDEX_OPTIONS" : "ETF_PROXY";
        const optionsSourceNote =
          typeof options.note === "string" ? options.note : null;

        const analyticsSpot = quoteSpot || underlyingSpot;
        const chain = scaleChainToSpot(chainRaw, underlyingSpot, analyticsSpot);
        const spotPrice = analyticsSpot;
        if (!spotPrice || chain.length === 0) throw new Error("Insufficient data");

        const displaySpot = analyticsSpot;

        const filteredChain = selectedExpiry
          ? chain.filter((c) => c.expiry === selectedExpiry)
          : chain;

        const gexByStrike = computeGEXByStrike(filteredChain, spotPrice);
        const rawLevels = computeKeyLevels(gexByStrike, spotPrice);
        const estimatedLevels = gexByStrike.length === 0;
        const keyLevels = estimatedLevels
          ? {
              ...rawLevels,
              callWall: spotPrice * 1.008,
              putWall: spotPrice * 0.992,
              maxPain: spotPrice,
            }
          : rawLevels;
        const heatmap = computeHeatmap(chain, spotPrice);
        const unusualFlow = detectUnusualFlow(chain);
        const { ratio: flowRatio, netFlow } = computeFlowRatio(chain);
        const totalNetGex = sumNetGex(gexByStrike);
        const atmIvPct = computeAtmIvPct(chain, spotPrice);
        const daysToExpiry = nextMonthlyDte(expiries);
        const { expectedMove, projectedHigh, projectedLow, atmIvDecimal } =
          computeExpectedMove(spotPrice, atmIvPct, daysToExpiry);

        const vixOk =
          vixQuote &&
          !vixQuote.fallback &&
          typeof vixQuote.spotPrice === "number" &&
          Number.isFinite(vixQuote.spotPrice);
        const vix = vixOk ? Number(vixQuote.spotPrice) : null;
        const vixChangePct =
          vixOk && typeof vixQuote.changePct === "number"
            ? Number(vixQuote.changePct)
            : null;

        if (!mountedRef.current) return;

        const next: MarketData = {
          symbol,
          spotPrice,
          displaySpot,
          prevClose: quote.prevClose || spotPrice * 0.998,
          change: quote.change ?? 0,
          changePct: quote.changePct ?? 0,
          chain,
          gexByStrike,
          keyLevels,
          heatmap,
          unusualFlow,
          flowRatio,
          netFlow,
          totalNetGex,
          atmIvPct,
          atmIvDecimal,
          daysToExpiry,
          expectedMove,
          projectedHigh,
          projectedLow,
          estimatedLevels,
          optionsDataSource,
          optionsSourceNote,
          vix,
          vixChangePct,
          expiries,
          selectedExpiry,
          news: newsData.headlines || generateMarketNews(),
          lastUpdate: new Date(),
          loading: false,
          live: true,
          isMarketOpen: checkMarketOpen(),
        };
        lastGoodRef.current = next;
        setData(next);
        return;
      } catch {
        if (attempt < 2) {
          await sleep(350 * 2 ** attempt);
          continue;
        }
      }
    }

    // If we've shown live data before, prefer stale snapshot over mock.
    if (lastGoodRef.current && mountedRef.current) {
      setData({
        ...lastGoodRef.current,
        symbol,
        selectedExpiry,
        live: false,
        lastUpdate: new Date(),
      });
      return;
    }
    fallbackToMock();
  }, [symbol, selectedExpiry, fallbackToMock]);

  const refresh = useCallback(() => {
    fetchLiveData();
  }, [fetchLiveData]);

  useEffect(() => {
    mountedRef.current = true;
    prevCloseRef.current = 0;
    lastGoodRef.current = null;
    setSelectedExpiry(null);
    fetchLiveData();
    const interval = setInterval(fetchLiveData, refreshMs);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchLiveData, refreshMs]);

  return { data, refresh, selectedExpiry, setSelectedExpiry };
}
