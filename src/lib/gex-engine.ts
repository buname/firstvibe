export interface OptionContract {
  strike: number;
  expiry: string;
  type: "call" | "put";
  oi: number;
  volume: number;
  gamma: number;
  delta: number;
  iv: number;
  bid: number;
  ask: number;
  lastPrice: number;
}

export interface GEXByStrike {
  strike: number;
  callGEX: number;
  putGEX: number;
  netGEX: number;
  callOI: number;
  putOI: number;
  callVol: number;
  putVol: number;
  callIV: number;
  putIV: number;
  callDelta: number;
  putDelta: number;
}

export interface KeyLevels {
  gammaFlip: number;
  callWall: number;
  putWall: number;
  maxPain: number;
  volTrigger: number;
  spotPrice: number;
}

export interface HeatmapCell {
  strike: number;
  expiry: string;
  value: number;
}

export interface FlowEntry {
  strike: number;
  expiry: string;
  type: "call" | "put";
  volume: number;
  oi: number;
  ratio: number;
  premium: number;
  iv: number;
  side: "bullish" | "bearish" | "neutral";
}

const RISK_FREE_RATE = 0.043;
const OI_MINIMUM = 100;
const IV_CAP = 1.5;
const STRIKE_RANGE_PCT = 0.08;

/**
 * GEX formula (Perfiliev / SpotGamma / Barchart standard):
 *   GEX = Gamma * OI * 100 * Spot^2 * 0.01
 * Calls: +GEX (dealers long calls = long gamma = stabilising)
 * Puts:  -GEX (dealers short puts = short gamma = destabilising)
 */
export function computeGEXByStrike(
  chain: OptionContract[],
  spotPrice: number
): GEXByStrike[] {
  const byStrike = new Map<
    number,
    {
      callGEX: number;
      putGEX: number;
      callOI: number;
      putOI: number;
      callVol: number;
      putVol: number;
      callIV: number;
      putIV: number;
      callDelta: number;
      putDelta: number;
      callCount: number;
      putCount: number;
    }
  >();

  for (const opt of chain) {
    if (opt.oi < OI_MINIMUM) continue;
    if (opt.iv > IV_CAP || opt.iv <= 0.005) continue;

    const distPct = Math.abs(opt.strike - spotPrice) / spotPrice;
    if (distPct > STRIKE_RANGE_PCT) continue;

    const gex = opt.gamma * opt.oi * 100 * spotPrice * spotPrice * 0.01;

    const existing = byStrike.get(opt.strike) || {
      callGEX: 0, putGEX: 0,
      callOI: 0, putOI: 0,
      callVol: 0, putVol: 0,
      callIV: 0, putIV: 0,
      callDelta: 0, putDelta: 0,
      callCount: 0, putCount: 0,
    };

    if (opt.type === "call") {
      existing.callGEX += gex;
      existing.callOI += opt.oi;
      existing.callVol += opt.volume;
      existing.callIV += opt.iv;
      existing.callDelta += opt.delta;
      existing.callCount++;
    } else {
      existing.putGEX -= gex;
      existing.putOI += opt.oi;
      existing.putVol += opt.volume;
      existing.putIV += opt.iv;
      existing.putDelta += opt.delta;
      existing.putCount++;
    }
    byStrike.set(opt.strike, existing);
  }

  return Array.from(byStrike.entries())
    .map(([strike, d]) => ({
      strike,
      callGEX: d.callGEX,
      putGEX: d.putGEX,
      netGEX: d.callGEX + d.putGEX,
      callOI: d.callOI,
      putOI: d.putOI,
      callVol: d.callVol,
      putVol: d.putVol,
      callIV: d.callCount > 0 ? d.callIV / d.callCount : 0,
      putIV: d.putCount > 0 ? d.putIV / d.putCount : 0,
      callDelta: d.callCount > 0 ? d.callDelta / d.callCount : 0,
      putDelta: d.putCount > 0 ? d.putDelta / d.putCount : 0,
    }))
    .sort((a, b) => a.strike - b.strike);
}

/**
 * Key levels using cumulative GEX sign-flip detection
 * (ported from Python app.py compute_key_levels)
 */
export function computeKeyLevels(
  gexByStrike: GEXByStrike[],
  spotPrice: number
): KeyLevels {
  if (gexByStrike.length === 0) {
    return {
      gammaFlip: spotPrice,
      callWall: spotPrice,
      putWall: spotPrice,
      maxPain: spotPrice,
      volTrigger: spotPrice,
      spotPrice,
    };
  }

  const sorted = [...gexByStrike].sort((a, b) => a.strike - b.strike);
  const cumGex: number[] = [];
  let cumSum = 0;
  for (const row of sorted) {
    cumSum += row.netGEX;
    cumGex.push(cumSum);
  }

  let gammaFlip = spotPrice * 0.99;
  for (let i = 0; i < cumGex.length - 1; i++) {
    if (cumGex[i] * cumGex[i + 1] < 0) {
      gammaFlip = sorted[i + 1].strike;
      break;
    }
  }

  let maxCallGEX = 0;
  let callWall = spotPrice;
  let maxPutGEX = 0;
  let putWall = spotPrice;

  for (const row of sorted) {
    if (row.callGEX > maxCallGEX) {
      maxCallGEX = row.callGEX;
      callWall = row.strike;
    }
    if (Math.abs(row.putGEX) > maxPutGEX) {
      maxPutGEX = Math.abs(row.putGEX);
      putWall = row.strike;
    }
  }

  const maxPain = computeMaxPain(sorted);

  let maxVolGex = 0;
  let volTrigger = gammaFlip * 1.005;
  for (const row of sorted) {
    const absVolGex = Math.abs(row.callVol) + Math.abs(row.putVol);
    if (absVolGex > maxVolGex) {
      maxVolGex = absVolGex;
      volTrigger = row.strike;
    }
  }

  return { gammaFlip, callWall, putWall, maxPain, volTrigger, spotPrice };
}

function computeMaxPain(gexByStrike: GEXByStrike[]): number {
  if (gexByStrike.length === 0) return 0;

  let minPain = Infinity;
  let maxPainStrike = gexByStrike[0].strike;

  for (const target of gexByStrike) {
    let totalPain = 0;
    for (const row of gexByStrike) {
      if (row.strike < target.strike) {
        totalPain += (target.strike - row.strike) * row.callOI * 100;
      }
      if (row.strike > target.strike) {
        totalPain += (row.strike - target.strike) * row.putOI * 100;
      }
    }
    if (totalPain < minPain) {
      minPain = totalPain;
      maxPainStrike = target.strike;
    }
  }
  return maxPainStrike;
}

export function computeHeatmap(
  chain: OptionContract[],
  spotPrice: number
): HeatmapCell[] {
  const cells: HeatmapCell[] = [];
  const grouped = new Map<string, number>();

  for (const opt of chain) {
    if (opt.oi < OI_MINIMUM) continue;
    const distPct = Math.abs(opt.strike - spotPrice) / spotPrice;
    if (distPct > 0.08) continue;

    const key = `${opt.strike}|${opt.expiry}`;
    const gex = opt.gamma * opt.oi * 100 * spotPrice * spotPrice * 0.01;
    const signedGex = opt.type === "call" ? gex : -gex;
    grouped.set(key, (grouped.get(key) || 0) + signedGex);
  }

  for (const [key, value] of grouped) {
    const [strikeStr, expiry] = key.split("|");
    cells.push({ strike: Number(strikeStr), expiry, value });
  }

  return cells;
}

export function detectUnusualFlow(
  chain: OptionContract[],
  minRatio = 0.3
): FlowEntry[] {
  return chain
    .filter((opt) => opt.oi > 0 && opt.volume / opt.oi > minRatio)
    .map((opt) => ({
      strike: opt.strike,
      expiry: opt.expiry,
      type: opt.type,
      volume: opt.volume,
      oi: opt.oi,
      ratio: opt.volume / opt.oi,
      premium: opt.volume * opt.lastPrice * 100,
      iv: opt.iv,
      side:
        opt.type === "call"
          ? ("bullish" as const)
          : ("bearish" as const),
    }))
    .sort((a, b) => b.premium - a.premium)
    .slice(0, 50);
}

export function computeFlowRatio(chain: OptionContract[]): {
  ratio: number;
  netFlow: number;
} {
  let bullishDV = 0;
  let bearishDV = 0;

  for (const opt of chain) {
    if (opt.volume <= 0) continue;
    const mid = Math.max(0.01, (opt.bid + opt.ask) / 2);
    const spread = Math.max(0, opt.ask - opt.bid);
    const aggr =
      spread > 0.001
        ? Math.min(1, Math.max(0, (opt.lastPrice - opt.bid) / spread))
        : 0.5;
    const dv = mid * 100 * opt.volume;

    if (opt.type === "call") {
      bullishDV += dv * aggr;
      bearishDV += dv * (1 - aggr);
    } else {
      bearishDV += dv * aggr;
      bullishDV += dv * (1 - aggr);
    }
  }

  const total = bullishDV + bearishDV;
  return {
    ratio: total > 0 ? bullishDV / total : 0.5,
    netFlow: bullishDV - bearishDV,
  };
}
