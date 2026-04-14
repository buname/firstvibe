import { subBusinessDays } from "date-fns";
import type { Timeframe } from "@/lib/chart-data";

export interface TimeframeRange {
  start: Date;
  end: Date;
}

function marketOpenNow(now: Date): Date {
  const open = new Date(now);
  open.setHours(9, 30, 0, 0);
  return open;
}

export function getTimeframeRange(timeframe: Timeframe): TimeframeRange {
  const end = new Date();

  switch (timeframe) {
    case "1D":
      return { start: marketOpenNow(end), end };
    case "5D":
      return { start: subBusinessDays(end, 5), end };
    case "1M":
      return { start: subBusinessDays(end, 21), end };
    case "3M":
      return { start: subBusinessDays(end, 63), end };
    case "6M":
      return { start: subBusinessDays(end, 126), end };
    case "1Y":
      return { start: subBusinessDays(end, 252), end };
    case "ALL":
      return { start: subBusinessDays(end, 252 * 4), end };
    default:
      return { start: subBusinessDays(end, 63), end };
  }
}

export function timeframeToBarConfig(
  timeframe: Timeframe
): { count: number; intervalMs: number } {
  switch (timeframe) {
    case "1D":
      return { count: 390, intervalMs: 60 * 1000 };
    case "5D":
      return { count: 780, intervalMs: 5 * 60 * 1000 };
    case "1M":
      return { count: 720, intervalMs: 60 * 60 * 1000 };
    case "3M":
      return { count: 1080, intervalMs: 2 * 60 * 60 * 1000 };
    case "6M":
      return { count: 1440, intervalMs: 3 * 60 * 60 * 1000 };
    case "1Y":
      return { count: 1825, intervalMs: 6 * 60 * 60 * 1000 };
    case "ALL":
      return { count: 2500, intervalMs: 12 * 60 * 60 * 1000 };
    default:
      return { count: 1080, intervalMs: 2 * 60 * 60 * 1000 };
  }
}
