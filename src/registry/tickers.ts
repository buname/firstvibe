import type { TickerSymbol } from "@/lib/constants";
import type { Timeframe } from "@/lib/chart-data";

export interface ChartTicker {
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
  defaultTimeframe: Timeframe;
  /**
   * Maps chart/parity symbols to dashboard-supported symbols.
   * Example: chart aliases resolve into SPX or NDX views.
   */
  dashboardSymbol?: TickerSymbol;
  referencePrice: number;
}

export const CHART_TICKERS: ChartTicker[] = [
  {
    symbol: "SPX",
    name: "S&P 500 Index",
    exchange: "INDEX",
    sector: "Index",
    defaultTimeframe: "3M",
    dashboardSymbol: "SPX",
    referencePrice: 5400,
  },
  {
    symbol: "NDX",
    name: "NASDAQ-100 Index",
    exchange: "INDEX",
    sector: "Index",
    defaultTimeframe: "1M",
    dashboardSymbol: "NDX",
    referencePrice: 18800,
  },
];

export const CHART_TICKERS_BY_SYMBOL = new Map(
  CHART_TICKERS.map((ticker) => [ticker.symbol, ticker])
);

export function resolveChartTicker(symbol: string): ChartTicker {
  return (
    CHART_TICKERS_BY_SYMBOL.get(symbol) ??
    CHART_TICKERS_BY_SYMBOL.get("SPX")!
  );
}
