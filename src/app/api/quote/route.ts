import { NextRequest, NextResponse } from "next/server";
import { validateApiOrigin, withApiCors } from "@/lib/api-security";

export const dynamic = "force-dynamic";

const SYMBOL_MAP: Record<string, string> = {
  VIX: "^VIX",
  NDX: "^NDX",
  SPX: "^GSPC",
  QQQ: "QQQ",
  SPY: "SPY",
  AAPL: "AAPL",
  NVDA: "NVDA",
  TSLA: "TSLA",
  AMZN: "AMZN",
  MSFT: "MSFT",
  META: "META",
  GOOG: "GOOG",
  GOOGL: "GOOGL",
  AMD: "AMD",
  IWM: "IWM",
};

const CHART_ENDPOINTS = [
  (sym: string) =>
    `https://query2.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=2d`,
  (sym: string) =>
    `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=2d`,
];

export async function GET(req: NextRequest) {
  const originCheck = validateApiOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const symbol = req.nextUrl.searchParams.get("symbol") || "QQQ";
  const yahooSymbol = SYMBOL_MAP[symbol] || symbol;

  for (const buildUrl of CHART_ENDPOINTS) {
    try {
      const url = buildUrl(encodeURIComponent(yahooSymbol));
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (!res.ok) continue;

      const json = await res.json();
      const result = json.chart?.result?.[0];
      if (!result) continue;

      const meta = result.meta;
      const spotPrice = meta.regularMarketPrice;
      const prevClose = meta.chartPreviousClose || meta.previousClose;
      const change = spotPrice - prevClose;
      const changePct = (change / prevClose) * 100;

      return withApiCors(
        NextResponse.json({
          symbol,
          spotPrice,
          prevClose,
          change,
          changePct,
          marketState: meta.marketState,
          exchangeName: meta.exchangeName,
          currency: meta.currency,
        }),
        originCheck.origin
      );
    } catch {
      continue;
    }
  }

  return withApiCors(
    NextResponse.json(
      { error: "All endpoints failed", fallback: true },
      { status: 200 }
    ),
    originCheck.origin
  );
}
