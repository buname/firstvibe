import { NextRequest, NextResponse } from "next/server";
import { validateApiOrigin, withApiCors } from "@/lib/api-security";

export const dynamic = "force-dynamic";

const INDEX_CANDIDATES: Record<"SPX" | "NDX", string[]> = {
  SPX: ["SPX", "I:SPX", "SPY"],
  NDX: ["NDX", "I:NDX", "QQQ"],
};

const YAHOO_VIX_ENDPOINTS = [
  "https://query2.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=2d",
  "https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=2d",
];

async function fetchPolygonPrev(candidate: string, token: string) {
  const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(
    candidate
  )}/prev?adjusted=true&apiKey=${encodeURIComponent(token)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const json = (await res.json()) as { results?: Array<{ c?: number; o?: number }> };
  const bar = json.results?.[0];
  const close = bar?.c;
  const open = bar?.o;
  if (
    typeof close !== "number" ||
    !Number.isFinite(close) ||
    close <= 0 ||
    typeof open !== "number" ||
    !Number.isFinite(open) ||
    open <= 0
  ) {
    return null;
  }
  const change = close - open;
  const changePct = (change / open) * 100;
  return {
    spotPrice: close,
    prevClose: open,
    change,
    changePct,
  };
}

export async function GET(req: NextRequest) {
  const originCheck = validateApiOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const symbol = req.nextUrl.searchParams.get("symbol")?.toUpperCase() || "SPX";
  const token =
    process.env.POLYGON_API_KEY ?? process.env.NEXT_PUBLIC_POLYGON_API_KEY;

  if (symbol === "SPX" || symbol === "NDX") {
    if (token) {
      for (const candidate of INDEX_CANDIDATES[symbol]) {
        const quote = await fetchPolygonPrev(candidate, token);
        if (!quote) continue;
        return withApiCors(
          NextResponse.json({
            symbol,
            sourceSymbol: candidate,
            ...quote,
          }),
          originCheck.origin
        );
      }
    }

    return withApiCors(
      NextResponse.json(
        {
          error: `Failed to fetch ${symbol} index quote from Polygon.`,
          fallback: true,
        },
        { status: 200 }
      ),
      originCheck.origin
    );
  }

  // Keep VIX on Yahoo as a separate volatility index source.
  if (symbol === "VIX") {
    for (const url of YAHOO_VIX_ENDPOINTS) {
      try {
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
        const spotPrice = Number(meta.regularMarketPrice);
        const prevClose = Number(meta.chartPreviousClose || meta.previousClose);
        if (!Number.isFinite(spotPrice) || !Number.isFinite(prevClose) || prevClose <= 0) {
          continue;
        }
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
      NextResponse.json({ error: "Failed to fetch VIX quote", fallback: true }, { status: 200 }),
      originCheck.origin
    );
  }

  return withApiCors(
    NextResponse.json(
      { error: `Unsupported symbol: ${symbol}`, fallback: true },
      { status: 400 }
    ),
    originCheck.origin
  );
}
