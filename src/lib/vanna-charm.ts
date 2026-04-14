import type { OptionContract } from "@/lib/gex-engine";

const R = 0.043;

function normpdf(x: number) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

export interface VannaCharmRow {
  strike: number;
  /** Scaled $M-style magnitude for charting (same convention as Exposures). */
  vanna: number;
  charm: number;
}

/**
 * Per-strike vanna/charm aggregates from chain OI (Black–Scholes-ish).
 * Used by Exposures and Terminal; does not alter `gex-engine` GEX math.
 */
export function computeVannaCharm(
  chain: OptionContract[],
  spot: number
): VannaCharmRow[] {
  const map = new Map<number, { vanna: number; charm: number }>();

  for (const opt of chain) {
    if (opt.oi < 100) continue;
    if (spot <= 0 || Math.abs(opt.strike - spot) / spot > 0.08) continue;

    const days = Math.max(
      1,
      (new Date(opt.expiry).getTime() - Date.now()) / 86_400_000
    );
    const T = days / 365;
    const sig = Math.max(0.01, Math.min(opt.iv, 1.5));
    const sqrtT = Math.sqrt(T);

    const d1 =
      (Math.log(spot / opt.strike) + (R + (sig * sig) / 2) * T) /
      (sig * sqrtT);
    const d2 = d1 - sig * sqrtT;
    const nd1 = normpdf(d1);

    const scale = opt.oi * 100;
    const vRaw = (-nd1 * d2) / sig;
    const cRaw =
      (-nd1 * (2 * R * T - d2 * sig * sqrtT)) / (2 * T * sig * sqrtT);

    const sign = opt.type === "call" ? 1 : -1;
    const prev = map.get(opt.strike) ?? { vanna: 0, charm: 0 };
    map.set(opt.strike, {
      vanna: prev.vanna + sign * vRaw * scale * spot * 0.001,
      charm: prev.charm + sign * cRaw * scale * 0.01,
    });
  }

  return Array.from(map.entries())
    .map(([strike, d]) => ({ strike, vanna: d.vanna, charm: d.charm }))
    .sort((a, b) => a.strike - b.strike);
}
