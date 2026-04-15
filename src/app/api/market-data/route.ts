import { NextRequest, NextResponse } from "next/server";
import { validateApiOrigin, withApiCors } from "@/lib/api-security";

export const revalidate = 60;

type MarketDataPayload = {
  symbol: "NDX" | "SPX";
  sourceSymbol: string;
  price: number;
  change: number;
  changePercent: number;
  formattedPrice: string;
  formattedChange: string;
  formattedChangePercent: string;
  lastUpdated: string;
  offline?: boolean;
  fallback?: boolean;
  error?: string;
};

const POLYGON_BASE_URL = "https://api.polygon.io/v2/aggs/ticker";
const SYMBOL_CANDIDATES = {
  NDX: ["I:NDX", "NDX"],
  SPX: ["I:SPX", "SPX", "SPY"],
} as const;

const NUMBER_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function withSign(value: number): string {
  if (value > 0) return `+${NUMBER_FORMATTER.format(value)}`;
  return NUMBER_FORMATTER.format(value);
}

const MOCK_DATA: Record<"NDX" | "SPX", Omit<MarketDataPayload, "symbol" | "sourceSymbol" | "lastUpdated">> = {
  NDX: {
    price: 25854.05,
    change: -4.65,
    changePercent: -0.02,
    formattedPrice: NUMBER_FORMATTER.format(25854.05),
    formattedChange: withSign(-4.65),
    formattedChangePercent: `${withSign(-0.02)}%`,
    offline: true,
    fallback: true,
  },
  SPX: {
    price: 5320.02,
    change: -4.4,
    changePercent: -0.08,
    formattedPrice: NUMBER_FORMATTER.format(5320.02),
    formattedChange: withSign(-4.4),
    formattedChangePercent: `${withSign(-0.08)}%`,
    offline: true,
    fallback: true,
  },
};

function normalizeBars(
  bars: unknown,
  fallback: MarketDataPayload,
  sourceSymbol: string
): MarketDataPayload {
  const data = bars as { results?: Array<{ c?: number }> };
  const series = Array.isArray(data.results) ? data.results : [];
  const lastClose = series.at(-1)?.c;
  const prevClose = series.at(-2)?.c;
  const change =
    typeof lastClose === "number" && typeof prevClose === "number"
      ? lastClose - prevClose
      : undefined;
  const changePercent =
    typeof change === "number" && typeof prevClose === "number" && prevClose !== 0
      ? (change / prevClose) * 100
      : undefined;

  if (
    typeof lastClose !== "number" ||
    !Number.isFinite(lastClose) ||
    lastClose <= 0 ||
    typeof change !== "number" ||
    !Number.isFinite(change) ||
    typeof changePercent !== "number" ||
    !Number.isFinite(changePercent)
  ) {
    return fallback;
  }

  return {
    symbol: fallback.symbol,
    sourceSymbol,
    price: lastClose,
    change,
    changePercent,
    formattedPrice: NUMBER_FORMATTER.format(lastClose),
    formattedChange: withSign(change),
    formattedChangePercent: `${withSign(changePercent)}%`,
    lastUpdated: new Date().toISOString(),
    offline: false,
    fallback: false,
  };
}

async function fetchBars(symbol: string, token: string): Promise<unknown> {
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - 7);
  const fromIso = from.toISOString().slice(0, 10);
  const toIso = to.toISOString().slice(0, 10);
  const url = `${POLYGON_BASE_URL}/${encodeURIComponent(
    symbol
  )}/range/1/day/${fromIso}/${toIso}?adjusted=true&sort=asc&limit=10&apiKey=${encodeURIComponent(
    token
  )}`;
  const response = await fetch(url, {
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    throw new Error(`Polygon request failed for ${symbol} with status ${response.status}`);
  }

  return response.json();
}

async function fetchFirstValidQuote(
  symbol: "NDX" | "SPX",
  token: string
): Promise<{ quote: unknown; sourceSymbol: string }> {
  const candidates = SYMBOL_CANDIDATES[symbol];
  for (const candidate of candidates) {
    try {
      const quote = await fetchBars(candidate, token);
      const data = quote as { results?: Array<{ c?: number }> };
      const lastClose = data.results?.at(-1)?.c;
      if (
        typeof lastClose === "number" &&
        Number.isFinite(lastClose) &&
        lastClose > 0
      ) {
        return { quote, sourceSymbol: candidate };
      }
    } catch {
      continue;
    }
  }
  throw new Error(`No valid Polygon quote for ${symbol}`);
}

export async function GET(req: NextRequest) {
  const originCheck = validateApiOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const symbolParam = req.nextUrl.searchParams.get("symbol")?.toUpperCase();
  const symbol: "NDX" | "SPX" = symbolParam === "NDX" ? "NDX" : "SPX";

  const fallbackPayload: MarketDataPayload = {
    symbol,
    sourceSymbol: SYMBOL_CANDIDATES[symbol][0],
    ...MOCK_DATA[symbol],
    lastUpdated: new Date().toISOString(),
  };

  const token =
    process.env.POLYGON_API_KEY ?? process.env.NEXT_PUBLIC_POLYGON_API_KEY;
  if (!token) {
    return withApiCors(
      NextResponse.json(
        {
          ...fallbackPayload,
          error:
            "Missing POLYGON_API_KEY (or NEXT_PUBLIC_POLYGON_API_KEY) environment variable.",
        },
        { status: 200 }
      ),
      originCheck.origin
    );
  }

  try {
    const { quote, sourceSymbol } = await fetchFirstValidQuote(symbol, token);
    const payload = normalizeBars(quote, fallbackPayload, sourceSymbol);

    return withApiCors(NextResponse.json(payload), originCheck.origin);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch market data";
    return withApiCors(
      NextResponse.json(
        { ...fallbackPayload, error: `Polygon request failed: ${message}` },
        { status: 200 }
      ),
      originCheck.origin
    );
  }
}
