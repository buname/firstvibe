import { NextRequest, NextResponse } from "next/server";
import { fetchYahooFullChain } from "@/lib/yahoo-options";
import { validateApiOrigin, withApiCors } from "@/lib/api-security";
import { OptionContract } from "@/lib/gex-engine";

export const dynamic = "force-dynamic";

type IndexSymbol = "NDX" | "SPX";

type PolygonOptionSnapshot = {
  details?: {
    expiration_date?: string;
    strike_price?: number;
    contract_type?: "call" | "put" | string;
  };
  open_interest?: number;
  implied_volatility?: number;
  greeks?: {
    delta?: number;
    gamma?: number;
  };
  day?: {
    close?: number;
    volume?: number;
  };
  last_quote?: {
    bid?: number;
    ask?: number;
  };
};

const INDEX_OPTIONS_CANDIDATES: Record<IndexSymbol, string[]> = {
  SPX: ["SPX", "I:SPX"],
  NDX: ["NDX", "I:NDX"],
};

const ETF_PROXY_SYMBOL: Record<IndexSymbol, "SPY" | "QQQ"> = {
  SPX: "SPY",
  NDX: "QQQ",
};

async function fetchPolygonIndexSpot(
  symbol: IndexSymbol,
  token: string
): Promise<{ spotPrice: number; sourceSymbol: string }> {
  for (const candidate of INDEX_OPTIONS_CANDIDATES[symbol]) {
    const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(
      candidate
    )}/prev?adjusted=true&apiKey=${encodeURIComponent(token)}`;
    const response = await fetch(url, { next: { revalidate: 10 } });
    if (!response.ok) continue;
    const json = (await response.json()) as { results?: Array<{ c?: number }> };
    const close = json.results?.[0]?.c;
    if (typeof close === "number" && Number.isFinite(close) && close > 0) {
      return { spotPrice: close, sourceSymbol: candidate };
    }
  }
  throw new Error(`No valid Polygon index spot price for ${symbol}`);
}

function normalizePolygonChain(
  snapshots: PolygonOptionSnapshot[],
  spotPrice: number
): OptionContract[] {
  if (!Array.isArray(snapshots) || snapshots.length === 0) return [];

  const chain: OptionContract[] = [];
  const minStrike = spotPrice * 0.8;
  const maxStrike = spotPrice * 1.2;

  for (const item of snapshots) {
    const typeRaw = item.details?.contract_type;
    const type = typeRaw === "call" || typeRaw === "put" ? typeRaw : null;
    const expiry = item.details?.expiration_date;
    const strike = item.details?.strike_price;
    if (!type || !expiry || typeof strike !== "number" || !Number.isFinite(strike)) {
      continue;
    }
    if (strike < minStrike || strike > maxStrike) continue;

    const gamma = Number(item.greeks?.gamma ?? 0);
    const delta = Number(item.greeks?.delta ?? 0);
    const iv = Number(item.implied_volatility ?? 0);
    const oi = Number(item.open_interest ?? 0);
    const volume = Number(item.day?.volume ?? 0);
    const bid = Number(item.last_quote?.bid ?? 0);
    const ask = Number(item.last_quote?.ask ?? 0);
    const lastPrice = Number(item.day?.close ?? 0);

    chain.push({
      strike,
      expiry,
      type,
      oi: Number.isFinite(oi) ? Math.max(0, oi) : 0,
      volume: Number.isFinite(volume) ? Math.max(0, volume) : 0,
      gamma: Number.isFinite(gamma) ? gamma : 0,
      delta: Number.isFinite(delta) ? delta : 0,
      iv: Number.isFinite(iv) ? iv : 0,
      bid: Number.isFinite(bid) ? Math.max(0, bid) : 0,
      ask: Number.isFinite(ask) ? Math.max(0, ask) : 0,
      lastPrice: Number.isFinite(lastPrice) ? Math.max(0, lastPrice) : 0,
    });
  }

  return chain;
}

async function fetchPolygonIndexOptions(
  symbol: IndexSymbol,
  token: string
): Promise<{
  symbol: IndexSymbol;
  spotPrice: number;
  sourceSymbol: string;
  expirations: string[];
  chain: OptionContract[];
  dataSource: "INDEX_OPTIONS";
}> {
  const { spotPrice, sourceSymbol } = await fetchPolygonIndexSpot(symbol, token);
  const url = `https://api.polygon.io/v3/snapshot/options/${encodeURIComponent(
    symbol
  )}?apiKey=${encodeURIComponent(token)}&limit=250`;
  const response = await fetch(url, { next: { revalidate: 10 } });
  if (!response.ok) {
    throw new Error(`Polygon snapshot failed: ${response.status}`);
  }
  const json = (await response.json()) as {
    results?: PolygonOptionSnapshot[];
  };
  const chain = normalizePolygonChain(json.results ?? [], spotPrice);
  if (chain.length === 0) {
    throw new Error(`Polygon returned empty ${symbol} index options chain`);
  }
  const expirations = [...new Set(chain.map((c) => c.expiry))].sort();
  return {
    symbol,
    spotPrice,
    sourceSymbol,
    expirations,
    chain,
    dataSource: "INDEX_OPTIONS",
  };
}

export async function GET(req: NextRequest) {
  const originCheck = validateApiOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const symbolParam = req.nextUrl.searchParams.get("symbol")?.toUpperCase();
  const symbol: IndexSymbol = symbolParam === "NDX" ? "NDX" : "SPX";
  const token =
    process.env.POLYGON_API_KEY ?? process.env.NEXT_PUBLIC_POLYGON_API_KEY;

  try {
    if (token) {
      const polygonResult = await fetchPolygonIndexOptions(symbol, token);
      return withApiCors(
        NextResponse.json({
          ...polygonResult,
          totalContracts: polygonResult.chain.length,
          fallback: false,
        }),
        originCheck.origin
      );
    }

    throw new Error("Missing Polygon API key");
  } catch {
    const optionsSymbol = ETF_PROXY_SYMBOL[symbol];
    const result = await fetchYahooFullChain(optionsSymbol, {
      mode: "nearest",
      maxExpirations: 6,
    }).catch(() => null);

    if (!result || result.chain.length === 0) {
      return withApiCors(
        NextResponse.json(
          { error: "Options data unavailable from all endpoints", fallback: true },
          { status: 200 }
        ),
        originCheck.origin
      );
    }
    return withApiCors(
      NextResponse.json({
        symbol,
        spotPrice: result.spotPrice,
        sourceSymbol: optionsSymbol,
        expirations: result.expirations,
        chain: result.chain,
        totalContracts: result.chain.length,
        dataSource: "ETF_PROXY",
        fallback: true,
        note: `Using ${optionsSymbol} options as fallback proxy for ${symbol} index options.`,
      }),
      originCheck.origin
    );
  }
}
