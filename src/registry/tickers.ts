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
   * Example: NQ charts map to NDX levels, ES maps to SPX.
   */
  dashboardSymbol?: TickerSymbol;
  referencePrice: number;
}

export const CHART_TICKERS: ChartTicker[] = [
  {
    symbol: "SPY",
    name: "SPDR S&P 500 ETF Trust",
    exchange: "NYSE Arca",
    sector: "ETF",
    defaultTimeframe: "3M",
    dashboardSymbol: "SPY",
    referencePrice: 535,
  },
  {
    symbol: "QQQ",
    name: "Invesco QQQ Trust",
    exchange: "NASDAQ",
    sector: "ETF",
    defaultTimeframe: "3M",
    dashboardSymbol: "QQQ",
    referencePrice: 460,
  },
  {
    symbol: "NQ",
    name: "E-mini Nasdaq-100 Futures",
    exchange: "CME",
    sector: "Index Futures",
    defaultTimeframe: "1M",
    dashboardSymbol: "NDX",
    referencePrice: 18800,
  },
  {
    symbol: "ES",
    name: "E-mini S&P 500 Futures",
    exchange: "CME",
    sector: "Index Futures",
    defaultTimeframe: "1M",
    dashboardSymbol: "SPX",
    referencePrice: 5400,
  },
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    exchange: "NASDAQ",
    sector: "Technology",
    defaultTimeframe: "6M",
    dashboardSymbol: "AAPL",
    referencePrice: 205,
  },
  {
    symbol: "TSLA",
    name: "Tesla Inc.",
    exchange: "NASDAQ",
    sector: "Automotive",
    defaultTimeframe: "6M",
    dashboardSymbol: "TSLA",
    referencePrice: 185,
  },
  {
    symbol: "NVDA",
    name: "NVIDIA Corp.",
    exchange: "NASDAQ",
    sector: "Semiconductors",
    defaultTimeframe: "6M",
    dashboardSymbol: "NVDA",
    referencePrice: 980,
  },
  {
    symbol: "MSFT",
    name: "Microsoft Corp.",
    exchange: "NASDAQ",
    sector: "Technology",
    defaultTimeframe: "6M",
    dashboardSymbol: "MSFT",
    referencePrice: 430,
  },
];

export const CHART_TICKERS_BY_SYMBOL = new Map(
  CHART_TICKERS.map((ticker) => [ticker.symbol, ticker])
);

export function resolveChartTicker(symbol: string): ChartTicker {
  return (
    CHART_TICKERS_BY_SYMBOL.get(symbol) ??
    CHART_TICKERS_BY_SYMBOL.get("SPY")!
  );
}
