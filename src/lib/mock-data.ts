import { OptionContract } from "./gex-engine";

function gaussianRandom(mean: number, stdev: number): number {
  const u = 1 - Math.random();
  const v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stdev + mean;
}

function bsGamma(S: number, K: number, T: number, sigma: number): number {
  if (T <= 0 || sigma <= 0) return 0;
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
  if (T <= 0 || sigma <= 0) return type === "call" ? 1 : -1;
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
  x = Math.abs(x);
  const t = 1.0 / (1.0 + p * x);
  const y =
    1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

const SPOT_PRICES: Record<string, number> = {
  NDX: 18250,
  SPX: 5320,
  QQQ: 445,
  SPY: 532,
  AAPL: 192,
  NVDA: 875,
  TSLA: 178,
  AMZN: 186,
  MSFT: 420,
  META: 505,
  GOOG: 176,
  GOOGL: 176,
  AMD: 158,
  IWM: 198,
};

export function getSpotPrice(symbol: string): number {
  const base = SPOT_PRICES[symbol] || 100;
  return base + (Math.random() - 0.5) * base * 0.002;
}

export function generateOptionsChain(
  symbol: string,
  spotPrice?: number
): OptionContract[] {
  const spot = spotPrice || getSpotPrice(symbol);
  const chain: OptionContract[] = [];

  const expiries = generateExpiries();

  const strikeStep = spot > 1000 ? 50 : spot > 100 ? 5 : 1;
  const strikeRange = spot > 1000 ? 20 : 25;

  const baseStrike = Math.round(spot / strikeStep) * strikeStep;
  const strikes: number[] = [];
  for (let i = -strikeRange; i <= strikeRange; i++) {
    strikes.push(baseStrike + i * strikeStep);
  }

  for (const expiry of expiries) {
    const daysToExpiry = Math.max(
      1,
      (new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    const T = daysToExpiry / 365;

    for (const strike of strikes) {
      const moneyness = Math.abs(strike - spot) / spot;
      const baseIV = 0.2 + moneyness * 0.5 + (strike < spot ? 0.05 : 0);
      const iv = baseIV + (Math.random() - 0.5) * 0.03;
      const gamma = bsGamma(spot, strike, T, iv);

      const nearATM = moneyness < 0.05;
      const oiMultiplier = nearATM ? 3 : 1;
      const expiryMultiplier = daysToExpiry < 7 ? 2.5 : daysToExpiry < 30 ? 1.5 : 1;

      for (const type of ["call", "put"] as const) {
        const oi = Math.max(
          0,
          Math.round(
            gaussianRandom(5000 * oiMultiplier * expiryMultiplier, 2000)
          )
        );
        const vol = Math.max(
          0,
          Math.round(gaussianRandom(oi * 0.3, oi * 0.15))
        );
        const delta = bsDelta(spot, strike, T, iv, type);
        const mid = Math.max(
          0.01,
          Math.abs(delta) * (spot - strike) * 0.5 + iv * spot * Math.sqrt(T) * 0.1
        );

        chain.push({
          strike,
          expiry,
          type,
          oi,
          volume: vol,
          gamma,
          delta,
          iv,
          bid: Math.max(0.01, mid - 0.05),
          ask: mid + 0.05,
          lastPrice: mid,
        });
      }
    }
  }

  return chain;
}

function generateExpiries(): string[] {
  const expiries: string[] = [];
  const now = new Date();

  for (let i = 0; i < 8; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7) + i * 7);
    if (d > now) {
      expiries.push(d.toISOString().split("T")[0]);
    }
  }

  for (let m = 1; m <= 3; m++) {
    const d = new Date(now.getFullYear(), now.getMonth() + m, 20);
    while (d.getDay() !== 5) d.setDate(d.getDate() - 1);
    expiries.push(d.toISOString().split("T")[0]);
  }

  return [...new Set(expiries)].sort();
}

export function generateMarketNews(): Array<{
  id: string;
  title: string;
  source: string;
  time: string;
  sentiment: "bullish" | "bearish" | "neutral";
}> {
  const headlines = [
    { title: "Fed signals potential rate cut in September meeting minutes", sentiment: "bullish" as const, source: "Reuters" },
    { title: "NVIDIA earnings beat estimates, data center revenue surges 150%", sentiment: "bullish" as const, source: "CNBC" },
    { title: "Tech sector faces renewed regulatory scrutiny in EU", sentiment: "bearish" as const, source: "Bloomberg" },
    { title: "S&P 500 options volume hits record as VIX climbs above 18", sentiment: "neutral" as const, source: "MarketWatch" },
    { title: "Apple announces $110B buyback program, largest in history", sentiment: "bullish" as const, source: "WSJ" },
    { title: "NASDAQ-100 rebalancing expected to shift $20B in assets", sentiment: "neutral" as const, source: "Barron's" },
    { title: "Treasury yields drop as inflation data comes in cooler", sentiment: "bullish" as const, source: "Reuters" },
    { title: "AMD secures major AI chip contract with Microsoft Azure", sentiment: "bullish" as const, source: "The Verge" },
    { title: "Tesla recall affects 500K vehicles over autopilot concerns", sentiment: "bearish" as const, source: "AP News" },
    { title: "Amazon Web Services announces new AI infrastructure investment", sentiment: "bullish" as const, source: "TechCrunch" },
    { title: "Market volatility expected ahead of FOMC meeting", sentiment: "neutral" as const, source: "Bloomberg" },
    { title: "Meta's Reality Labs posts $4.6B quarterly loss", sentiment: "bearish" as const, source: "CNBC" },
  ];

  const now = new Date();
  return headlines.map((h, i) => ({
    id: `news-${i}`,
    ...h,
    time: new Date(now.getTime() - i * 1800000).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));
}
