import { NextRequest, NextResponse } from "next/server";
import { fetchYahooFullChain } from "@/lib/yahoo-options";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol") || "QQQ";

  try {
    const result = await fetchYahooFullChain(symbol, {
      mode: "nearest",
      maxExpirations: 6,
    });

    if (!result || result.chain.length === 0) {
      return NextResponse.json(
        { error: "Options data unavailable from all endpoints", fallback: true },
        { status: 200 }
      );
    }

    return NextResponse.json({
      symbol: result.symbol,
      spotPrice: result.spotPrice,
      expirations: result.expirations,
      chain: result.chain,
      totalContracts: result.chain.length,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg, fallback: true }, { status: 200 });
  }
}
