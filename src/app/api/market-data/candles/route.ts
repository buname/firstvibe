import { NextRequest, NextResponse } from "next/server";
import { validateApiOrigin, withApiCors } from "@/lib/api-security";

export const revalidate = 60;

type ApiSymbol = "SPX" | "NDX";
type Timeframe = "1D" | "5D" | "1M" | "3M" | "6M" | "1Y" | "ALL";

const POLYGON_BASE_URL = "https://api.polygon.io/v2/aggs/ticker";
const SYMBOL_MAP: Record<ApiSymbol, string[]> = {
  SPX: ["I:SPX", "SPX", "SPY"],
  NDX: ["I:NDX", "NDX"],
};

function fallbackSpot(symbol: ApiSymbol): number {
  return symbol === "NDX" ? 25850 : 5320;
}

function generateFallbackBars(
  symbol: ApiSymbol,
  timeframe: Timeframe
): Array<{
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}> {
  const { lookbackDays } = timeframeToRange(timeframe);
  const count = Math.min(
    220,
    Math.max(
      40,
      timeframe === "1D" ? 80 : timeframe === "5D" ? 120 : lookbackDays
    )
  );
  const intervalMs =
    timeframe === "1D"
      ? 15 * 60_000
      : timeframe === "5D"
        ? 60 * 60_000
        : 24 * 60 * 60_000;
  const now = Date.now();
  let base = fallbackSpot(symbol);
  return Array.from({ length: count }).map((_, i) => {
    const drift = (Math.sin(i / 9) + Math.cos(i / 13)) * (base * 0.0018);
    const open = base;
    const close = base + drift;
    const high = Math.max(open, close) + Math.abs(drift) * 0.4;
    const low = Math.min(open, close) - Math.abs(drift) * 0.4;
    base = close;
    return {
      time: Math.floor((now - (count - i) * intervalMs) / 1000),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Math.round(200000 + Math.abs(drift) * 10000),
    };
  });
}

function timeframeToRange(timeframe: Timeframe): { multiplier: number; timespan: string; lookbackDays: number } {
  switch (timeframe) {
    case "1D":
      return { multiplier: 5, timespan: "minute", lookbackDays: 2 };
    case "5D":
      return { multiplier: 30, timespan: "minute", lookbackDays: 7 };
    case "1M":
      return { multiplier: 1, timespan: "hour", lookbackDays: 40 };
    case "3M":
      return { multiplier: 1, timespan: "day", lookbackDays: 120 };
    case "6M":
      return { multiplier: 1, timespan: "day", lookbackDays: 220 };
    case "1Y":
      return { multiplier: 1, timespan: "day", lookbackDays: 380 };
    case "ALL":
      return { multiplier: 1, timespan: "week", lookbackDays: 1800 };
    default:
      return { multiplier: 1, timespan: "day", lookbackDays: 120 };
  }
}

function buildDateRange(lookbackDays: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - lookbackDays);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

async function fetchPolygonCandles(
  apiSymbol: string,
  timeframe: Timeframe,
  apiKey: string
): Promise<unknown> {
  const { multiplier, timespan, lookbackDays } = timeframeToRange(timeframe);
  const { from, to } = buildDateRange(lookbackDays);
  const url = `${POLYGON_BASE_URL}/${encodeURIComponent(
    apiSymbol
  )}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=asc&limit=5000&apiKey=${encodeURIComponent(
    apiKey
  )}`;

  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`Polygon candles failed (${res.status})`);
  return res.json();
}

export async function GET(req: NextRequest) {
  const originCheck = validateApiOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const symbolParam = req.nextUrl.searchParams.get("symbol")?.toUpperCase();
  const symbol: ApiSymbol = symbolParam === "NDX" ? "NDX" : "SPX";
  const tfParam = req.nextUrl.searchParams.get("timeframe") as Timeframe | null;
  const timeframe: Timeframe =
    tfParam && ["1D", "5D", "1M", "3M", "6M", "1Y", "ALL"].includes(tfParam)
      ? tfParam
      : "3M";

  const apiKey =
    process.env.POLYGON_API_KEY ?? process.env.NEXT_PUBLIC_POLYGON_API_KEY;
  if (!apiKey) {
    const fallbackBars = generateFallbackBars(symbol, timeframe);
    return withApiCors(
      NextResponse.json(
        {
          symbol,
          timeframe,
          bars: fallbackBars,
          fallback: true,
          error:
            "Missing POLYGON_API_KEY (or NEXT_PUBLIC_POLYGON_API_KEY).",
        },
        { status: 200 }
      ),
      originCheck.origin
    );
  }

  for (const candidate of SYMBOL_MAP[symbol]) {
    try {
      const payload = (await fetchPolygonCandles(
        candidate,
        timeframe,
        apiKey
      )) as { results?: Array<{ t: number; o: number; h: number; l: number; c: number; v?: number }> };
      const rows = Array.isArray(payload.results) ? payload.results : [];
      if (rows.length === 0) continue;
      const bars = rows.map((r) => ({
        time: Math.floor(r.t / 1000),
        open: r.o,
        high: r.h,
        low: r.l,
        close: r.c,
        volume: r.v ?? 0,
      }));

      return withApiCors(
        NextResponse.json({
          symbol,
          sourceSymbol: candidate,
          timeframe,
          bars,
          fallback: false,
        }),
        originCheck.origin
      );
    } catch {
      continue;
    }
  }

  const fallbackBars = generateFallbackBars(symbol, timeframe);
  return withApiCors(
    NextResponse.json(
      {
        symbol,
        timeframe,
        bars: fallbackBars,
        fallback: true,
        error:
          "Polygon candles unavailable for this symbol/timeframe (Data Limited).",
      },
      { status: 200 }
    ),
    originCheck.origin
  );
}
