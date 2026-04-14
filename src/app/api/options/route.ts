import { NextRequest, NextResponse } from "next/server";
import { fetchYahooFullChain } from "@/lib/yahoo-options";
import { validateApiOrigin, withApiCors } from "@/lib/api-security";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const originCheck = validateApiOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const symbol = req.nextUrl.searchParams.get("symbol") || "QQQ";

  try {
    const result = await fetchYahooFullChain(symbol, {
      mode: "nearest",
      maxExpirations: 6,
    });

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
        symbol: result.symbol,
        spotPrice: result.spotPrice,
        expirations: result.expirations,
        chain: result.chain,
        totalContracts: result.chain.length,
      }),
      originCheck.origin
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return withApiCors(
      NextResponse.json({ error: msg, fallback: true }, { status: 200 }),
      originCheck.origin
    );
  }
}
