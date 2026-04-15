import type { OptionContract } from "@/lib/gex-engine";

export const YAHOO_OPTIONS_SYMBOL_MAP: Record<string, string> = {
  NDX: "QQQ",
  SPX: "SPY",
};

interface YahooOption {
  strike: number;
  expiration: number;
  openInterest: number;
  volume: number;
  impliedVolatility: number;
  lastPrice: number;
  bid: number;
  ask: number;
}

const ENDPOINTS = [
  (sym: string) => `https://query2.finance.yahoo.com/v7/finance/options/${sym}`,
  (sym: string) => `https://query1.finance.yahoo.com/v7/finance/options/${sym}`,
  (sym: string) => `https://query1.finance.yahoo.com/v6/finance/options/${sym}`,
];

export async function fetchYahooOptionChainRaw(
  symbol: string,
  date?: number
): Promise<unknown> {
  const dateParam = date ? `?date=${date}` : "";
  for (const buildUrl of ENDPOINTS) {
    try {
      const url = buildUrl(encodeURIComponent(symbol)) + dateParam;
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json",
          "Accept-Language": "en-US,en;q=0.9",
        },
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        const result = json.optionChain?.result?.[0];
        if (result) return result;
      }
    } catch {
      continue;
    }
  }
  return null;
}

export interface YahooChainResult {
  symbol: string;
  yahooSymbol: string;
  spotPrice: number;
  expirations: string[];
  chain: OptionContract[];
}

export type YahooChainMode = "nearest" | "withinDays";

/**
 * Yahoo option chains: either first N listed expirations (dashboard) or expirations within maxDays (scan).
 */
export async function fetchYahooFullChain(
  ticker: string,
  opts: {
    mode?: YahooChainMode;
    maxDays?: number;
    maxExpirations?: number;
  } = {}
): Promise<YahooChainResult | null> {
  const mode = opts.mode ?? "withinDays";
  const maxDays = opts.maxDays ?? 60;
  const maxExpirations = opts.maxExpirations ?? 14;
  const upper = ticker.trim().toUpperCase();
  const yahooSymbol = YAHOO_OPTIONS_SYMBOL_MAP[upper] || upper;

  const optionChain = (await fetchYahooOptionChainRaw(
    yahooSymbol
  )) as Record<string, unknown> | null;
  if (!optionChain) return null;

  const spotPrice = Number(
    (optionChain as { quote?: { regularMarketPrice?: number } }).quote
      ?.regularMarketPrice ?? 0
  );
  const expirations: number[] =
    (optionChain as { expirationDates?: number[] }).expirationDates || [];
  const now = Date.now();
  const datesToFetch: number[] =
    mode === "nearest"
      ? expirations.slice(0, maxExpirations)
      : expirations
          .filter((ts) => {
            const d = (ts * 1000 - now) / 86_400_000;
            return d >= 0 && d <= maxDays;
          })
          .slice(0, maxExpirations);

  const allContracts: OptionContract[] = [];
  const firstFetchedExpiries: number[] = [];

  // Seed with the first payload's contracts. This avoids empty chains when
  // follow-up per-expiry fetches fail intermittently.
  const firstOpts = (optionChain as { options?: { calls?: YahooOption[]; puts?: YahooOption[] }[] })
    .options?.[0];
  if (firstOpts && spotPrice > 0) {
    processOptions(firstOpts.calls || [], "call", spotPrice, allContracts);
    processOptions(firstOpts.puts || [], "put", spotPrice, allContracts);
    if (expirations.length > 0) firstFetchedExpiries.push(expirations[0]);
  }
  if (datesToFetch.length === 0) {
    return {
      symbol: upper,
      yahooSymbol,
      spotPrice,
      expirations: expirations.length
        ? [new Date(expirations[0] * 1000).toISOString().split("T")[0]]
        : [],
      chain: allContracts,
    };
  }

  const fetchOne = async (expTs: number) => {
    const result = (await fetchYahooOptionChainRaw(
      yahooSymbol,
      expTs
    )) as Record<string, unknown> | null;
    if (!result) return;
    const first = (result as { options?: { calls?: YahooOption[]; puts?: YahooOption[] }[] })
      .options?.[0];
    if (!first) return;
    processOptions(first.calls || [], "call", spotPrice, allContracts);
    processOptions(first.puts || [], "put", spotPrice, allContracts);
  };

  const queue = datesToFetch.filter((ts) => !firstFetchedExpiries.includes(ts));
  await Promise.all(queue.map((ts) => fetchOne(ts)));

  return {
    symbol: upper,
    yahooSymbol,
    spotPrice,
    expirations: datesToFetch.map((e) =>
      new Date(e * 1000).toISOString().split("T")[0]
    ),
    chain: allContracts,
  };
}

function processOptions(
  options: YahooOption[],
  type: "call" | "put",
  spotPrice: number,
  contracts: OptionContract[]
) {
  if (!options) return;
  for (const opt of options) {
    const strike = opt.strike;
    const expiry = new Date(opt.expiration * 1000).toISOString().split("T")[0];
    const daysToExpiry = Math.max(
      1,
      (opt.expiration * 1000 - Date.now()) / (1000 * 60 * 60 * 24)
    );
    const T = daysToExpiry / 365;
    const iv = opt.impliedVolatility || 0.25;
    const gamma = bsGamma(spotPrice, strike, T, iv);
    const delta = bsDelta(spotPrice, strike, T, iv, type);
    contracts.push({
      strike,
      expiry,
      type,
      oi: opt.openInterest || 0,
      volume: opt.volume || 0,
      gamma,
      delta,
      iv,
      bid: opt.bid || 0,
      ask: opt.ask || 0,
      lastPrice: opt.lastPrice || 0,
    });
  }
}

function bsGamma(S: number, K: number, T: number, sigma: number): number {
  if (T <= 0 || sigma <= 0 || S <= 0) return 0;
  const d1 =
    (Math.log(S / K) + (0.05 + (sigma * sigma) / 2) * T) /
    (sigma * Math.sqrt(T));
  const nd1 = Math.exp((-d1 * d1) / 2) / Math.sqrt(2 * Math.PI);
  return nd1 / (S * sigma * Math.sqrt(T));
}

function bsDelta(
  S: number,
  K: number,
  T: number,
  sigma: number,
  type: "call" | "put"
): number {
  if (T <= 0 || sigma <= 0 || S <= 0) return type === "call" ? 1 : -1;
  const d1 =
    (Math.log(S / K) + (0.05 + (sigma * sigma) / 2) * T) /
    (sigma * Math.sqrt(T));
  const cdf = 0.5 * (1 + erf(d1 / Math.sqrt(2)));
  return type === "call" ? cdf : cdf - 1;
}

function erf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const abs = Math.abs(x);
  const t = 1.0 / (1.0 + p * abs);
  const y =
    1.0 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-abs * abs);
  return sign * y;
}
