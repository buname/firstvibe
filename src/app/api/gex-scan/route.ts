import { NextRequest, NextResponse } from "next/server";
import { fetchYahooFullChain } from "@/lib/yahoo-options";
import { fetchSqueezeMetricsSnapshot } from "@/lib/squeezemetrics";
import { validateApiOrigin, withApiCors } from "@/lib/api-security";
import {
  computeGEXByStrike,
  computeKeyLevels,
  type OptionContract,
} from "@/lib/gex-engine";

function filterChain(
  chain: OptionContract[],
  spot: number,
  maxDays: number,
  rangePct: number
): OptionContract[] {
  const now = Date.now();
  const range = rangePct / 100;
  return chain.filter((c) => {
    if (spot <= 0) return false;
    const dist = Math.abs(c.strike - spot) / spot;
    if (dist > range) return false;
    const exp = new Date(c.expiry + "T12:00:00Z").getTime();
    const dte = (exp - now) / 86_400_000;
    return dte >= 0 && dte <= maxDays;
  });
}

export async function GET(req: NextRequest) {
  const originCheck = validateApiOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const tickersParam = req.nextUrl.searchParams.get("tickers") || "SPY,QQQ";
  const days = Math.min(
    365,
    Math.max(1, Number(req.nextUrl.searchParams.get("days")) || 60)
  );
  const rangePct = Math.min(
    50,
    Math.max(5, Number(req.nextUrl.searchParams.get("rangePct")) || 15)
  );

  const tickers = tickersParam
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 16);

  const squeeze = await fetchSqueezeMetricsSnapshot();

  const rows: Array<{
    ticker: string;
    spot: number;
    totalNetGexBillions: number;
    gammaFlip: number;
    callWall: number;
    putWall: number;
    maxPain: number;
    volTrigger: number;
    pcr: number;
    nearCallWall: boolean;
    nearPutWall: boolean;
    nearGammaFlip: boolean;
  }> = [];

  const errors: Array<{ ticker: string; message: string }> = [];

  const run = async (ticker: string) => {
    const pack = await fetchYahooFullChain(ticker, {
      mode: "withinDays",
      maxDays: days,
      maxExpirations: 16,
    });
    if (!pack || pack.spotPrice <= 0 || pack.chain.length === 0) {
      errors.push({ ticker, message: "No options data" });
      return;
    }
    const chain = filterChain(pack.chain, pack.spotPrice, days, rangePct);
    if (chain.length === 0) {
      errors.push({ ticker, message: "No contracts in range / DTE window" });
      return;
    }
    const gexByStrike = computeGEXByStrike(chain, pack.spotPrice);
    const levels = computeKeyLevels(gexByStrike, pack.spotPrice);
    const totalNetGex =
      gexByStrike.reduce((s, r) => s + r.netGEX, 0) / 1e9;

    let callOi = 0;
    let putOi = 0;
    for (const c of chain) {
      if (c.type === "call") callOi += c.oi;
      else putOi += c.oi;
    }
    const pcr = callOi > 0 ? putOi / callOi : 0;
    const spot = pack.spotPrice;
    const thr = 0.02;

    rows.push({
      ticker: pack.symbol,
      spot,
      totalNetGexBillions: totalNetGex,
      gammaFlip: levels.gammaFlip,
      callWall: levels.callWall,
      putWall: levels.putWall,
      maxPain: levels.maxPain,
      volTrigger: levels.volTrigger,
      pcr,
      nearCallWall:
        levels.callWall > 0 &&
        Math.abs(spot - levels.callWall) / spot <= thr,
      nearPutWall:
        levels.putWall > 0 &&
        Math.abs(spot - levels.putWall) / spot <= thr,
      nearGammaFlip:
        levels.gammaFlip > 0 &&
        Math.abs(spot - levels.gammaFlip) / spot <= thr,
    });
  };

  for (let i = 0; i < tickers.length; i += 3) {
    const chunk = tickers.slice(i, i + 3);
    await Promise.all(chunk.map((t) => run(t)));
  }

  return withApiCors(
    NextResponse.json({
      squeeze,
      rows,
      errors,
      days,
      rangePct,
    }),
    originCheck.origin
  );
}
