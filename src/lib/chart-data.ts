import { UTCTimestamp } from "lightweight-charts";
import { timeframeToBarConfig } from "@/utils/timeframe";

export interface OHLCVBar {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Timeframe = "1D" | "5D" | "1M" | "3M" | "6M" | "1Y" | "ALL";
export type ChartType = "candlestick" | "line" | "area";

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function generateOHLCV(
  spot: number,
  timeframe: Timeframe,
  symbol: string
): OHLCVBar[] {
  const { count, intervalMs } = timeframeToBarConfig(timeframe);
  const bars: OHLCVBar[] = [];
  const rand = seededRandom(symbol.length * 1000 + count);

  const now = Date.now();
  let startTime = now - count * intervalMs;
  let price = spot * (0.92 + rand() * 0.08);

  const dailyVolatility = spot > 1000 ? 0.004 : spot > 100 ? 0.0065 : 0.01;
  const barVolatility =
    intervalMs < 86400000
      ? dailyVolatility * Math.sqrt(intervalMs / 86400000)
      : dailyVolatility;

  for (let i = 0; i < count; i++) {
    const drift = (spot - price) * 0.0012;
    const move = (rand() - 0.495) * barVolatility * price + drift;
    const open = price;
    const close = open + move;

    const wickUp = rand() * barVolatility * price * 0.6;
    const wickDown = rand() * barVolatility * price * 0.6;
    const high = Math.max(open, close) + wickUp;
    const low = Math.min(open, close) - wickDown;

    const baseVol = 5_000_000 + rand() * 15_000_000;
    const volSpike = rand() > 0.92 ? 2 + rand() * 3 : 1;
    const volume = Math.round(baseVol * volSpike);

    const ts = Math.floor(startTime / 1000) as UTCTimestamp;

    bars.push({
      time: ts,
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume,
    });

    price = close;
    startTime += intervalMs;
  }

  if (bars.length > 0) {
    bars[bars.length - 1].close = +spot.toFixed(2);
  }

  return bars;
}

export function formatVolume(vol: number): string {
  if (vol >= 1e9) return `${(vol / 1e9).toFixed(1)}B`;
  if (vol >= 1e6) return `${(vol / 1e6).toFixed(1)}M`;
  if (vol >= 1e3) return `${(vol / 1e3).toFixed(0)}K`;
  return vol.toString();
}
