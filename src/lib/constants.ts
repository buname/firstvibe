export const TICKERS = [
  { symbol: "SPX", name: "S&P 500 Index", type: "index" },
  { symbol: "NDX", name: "NASDAQ-100 Index", type: "index" },
] as const;

export type TickerSymbol = (typeof TICKERS)[number]["symbol"];

/** Tab registry (ids + labels + icons). Sidebar render order is Opacity-style groups in `Sidebar.tsx`. */
export const DASHBOARD_TABS = [
  { id: "terminal", label: "Terminal", icon: "Terminal" },
  { id: "gexscan", label: "GEX Scan", icon: "Radar" },
  { id: "exposures", label: "Exposures", icon: "BarChart3" },
  { id: "bias", label: "Bias", icon: "Gauge" },
  { id: "heatmap", label: "Heatmap", icon: "Grid3X3" },
  { id: "levels", label: "Daily Levels", icon: "CalendarRange" },
  { id: "strikes", label: "Strike Table", icon: "Table" },
  { id: "flow", label: "Unusual Flow", icon: "Network" },
  { id: "calendar", label: "Calendar", icon: "Calendar" },
  { id: "compare", label: "Compare", icon: "SplitSquareVertical" },
  { id: "replay", label: "Replay", icon: "Play" },
  { id: "journal", label: "Journal", icon: "BookOpen" },
  { id: "surface", label: "3D Surface", icon: "Box" },
  { id: "legacy", label: "Legacy JS", icon: "Package" },
  { id: "settings", label: "Settings", icon: "Settings" },
] as const;

export type TabId = (typeof DASHBOARD_TABS)[number]["id"];

export const ACCESS_KEY = "BEX-2024-LIVE";

export const DEFAULT_REFRESH_MS = 10_000;

/** Cash index tickers whose options chain is fetched from this ETF on Yahoo. */
export const INDEX_OPTIONS_UNDERLYING: Partial<
  Record<TickerSymbol, Extract<TickerSymbol, "SPX">>
> = {
  NDX: "SPX",
};

export function isIndexSymbol(s: TickerSymbol): boolean {
  return s === "NDX" || s === "SPX";
}

export const MARKET_OPEN_HOUR = 9;
export const MARKET_OPEN_MIN = 30;
export const MARKET_CLOSE_HOUR = 16;
export const MARKET_CLOSE_MIN = 0;
