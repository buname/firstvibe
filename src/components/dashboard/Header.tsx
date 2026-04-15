"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { ChevronDown, RefreshCw, Clock, Unlink } from "lucide-react";
import { TickerSymbol } from "@/lib/constants";
import TopLeftLogo from "@/components/ui/TopLeftLogo";

interface NewsItem {
  id: string;
  title: string;
  source: string;
  time: string;
  sentiment: "bullish" | "bearish" | "neutral";
  url?: string;
}

interface Props {
  symbol: TickerSymbol;
  onSymbolChange: (s: TickerSymbol) => void;
  spotPrice: number;
  change: number;
  changePct: number;
  lastUpdate: Date | null;
  onRefresh: () => void;
  collapsed: boolean;
  /** Kept for API compatibility; sidebar menu owns collapse. */
  onToggleSidebar: () => void;
  live?: boolean;
  isMarketOpen?: boolean;
  expiries: string[];
  selectedExpiry: string | null;
  onExpiryChange: (exp: string | null) => void;
  news: NewsItem[];
  refreshMs: number;
}

interface MarketQuote {
  symbol: "NDX" | "SPX";
  sourceSymbol: string;
  price: number;
  change: number;
  changePercent: number;
  formattedPrice: string;
  formattedChange: string;
  formattedChangePercent: string;
  lastUpdated: string;
  offline?: boolean;
  fallback?: boolean;
  error?: string;
}

const HEADER_TICKERS: Array<{ symbol: "NDX" | "SPX"; name: string }> = [
  { symbol: "NDX", name: "Nasdaq 100" },
  { symbol: "SPX", name: "S&P 500" },
];

export default function Header({
  symbol,
  onSymbolChange,
  spotPrice,
  change,
  changePct,
  lastUpdate,
  onRefresh,
  collapsed: _collapsed,
  onToggleSidebar: _onToggleSidebar,
  live,
  isMarketOpen,
  expiries,
  selectedExpiry,
  onExpiryChange,
  news,
  refreshMs,
}: Props) {
  void _collapsed;
  void _onToggleSidebar;

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [time, setTime] = useState("");
  const [etDate, setEtDate] = useState("");
  /** Wall clock for age display (updated every second, no Date.now in render). */
  const [clockMs, setClockMs] = useState(() => Date.now());
  const [marketQuote, setMarketQuote] = useState<MarketQuote | null>(null);
  const [syncState, setSyncState] = useState<"idle" | "fetching" | "live">(
    "idle"
  );
  const retryTimeoutRef = useRef<number | null>(null);

  const headerSymbol = symbol === "NDX" ? "NDX" : "SPX";

  const fetchMarketQuote = useCallback(async (): Promise<boolean> => {
    setSyncState((current) => (current === "live" ? "live" : "fetching"));
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 5_000);
    const fallbackQuote: MarketQuote = {
      symbol: headerSymbol,
      sourceSymbol: headerSymbol,
      price: spotPrice > 0 ? spotPrice : 0,
      change,
      changePercent: changePct,
      formattedPrice: new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(spotPrice > 0 ? spotPrice : 0),
      formattedChange: `${change >= 0 ? "+" : ""}${change.toFixed(2)}`,
      formattedChangePercent: `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`,
      lastUpdated: new Date().toISOString(),
      offline: true,
      fallback: true,
      error: "Using fallback snapshot",
    };
    try {
      const response = await fetch(`/api/market-data?symbol=${headerSymbol}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        setMarketQuote((current) => current ?? fallbackQuote);
        setSyncState("live");
        return false;
      }
      const payload = (await response.json()) as MarketQuote;
      if (!payload || typeof payload.price !== "number") {
        setMarketQuote((current) => current ?? fallbackQuote);
        setSyncState("live");
        return false;
      }
      setMarketQuote(payload);
      setSyncState("live");
      return true;
    } catch {
      setMarketQuote((current) => current ?? fallbackQuote);
      setSyncState("live");
      return false;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, [headerSymbol, spotPrice, change, changePct]);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClockMs(now.getTime());
      setTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "America/New_York",
        })
      );
      setEtDate(
        now.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          timeZone: "America/New_York",
        })
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    let mounted = true;
    let inFlight = false;

    const clearRetry = () => {
      if (retryTimeoutRef.current !== null) {
        window.clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };

    const runFetch = async () => {
      if (!mounted || inFlight) return;
      inFlight = true;
      const connected = await fetchMarketQuote();
      inFlight = false;
      if (!mounted) return;
      if (connected) {
        clearRetry();
      } else if (retryTimeoutRef.current === null) {
        retryTimeoutRef.current = window.setTimeout(() => {
          retryTimeoutRef.current = null;
          void runFetch();
        }, 3_000);
      }
    };

    void runFetch();
    const id = window.setInterval(() => {
      void runFetch();
    }, 10_000);

    return () => {
      mounted = false;
      window.clearInterval(id);
      clearRetry();
    };
  }, [fetchMarketQuote]);

  const effectiveSpot = marketQuote?.price ?? spotPrice;
  const effectiveChange = marketQuote?.change ?? change;
  const effectiveChangePct = marketQuote?.changePercent ?? changePct;
  const formattedSpot =
    marketQuote?.formattedPrice ??
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(effectiveSpot);
  const formattedChange =
    marketQuote?.formattedChange ??
    `${effectiveChange >= 0 ? "+" : ""}${effectiveChange.toFixed(2)}`;
  const formattedChangePct =
    marketQuote?.formattedChangePercent ??
    `${effectiveChangePct >= 0 ? "+" : ""}${effectiveChangePct.toFixed(2)}%`;
  const quoteLastUpdate = marketQuote?.lastUpdated
    ? new Date(marketQuote.lastUpdated)
    : lastUpdate;
  const isPositive = effectiveChange >= 0;
  const displayExpiries = expiries.slice(0, 4);

  const ageSec =
    quoteLastUpdate != null
      ? Math.max(
          0,
          Math.floor((clockMs - quoteLastUpdate.getTime()) / 1000)
        )
      : null;

  function formatExpShort(iso: string): string {
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return iso.slice(5);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  }

  const handleUnlink = () => {
    localStorage.removeItem("bex-access-key");
    window.location.href = "/";
  };

  const statusLabel =
    syncState === "idle"
      ? "Idle"
      : syncState === "fetching"
        ? "Fetching"
        : "Live";

  return (
    <div className="shrink-0">
      <header className="panel-sheen flex h-12 items-center gap-2 border-b border-white/[0.04] bg-[#050506] px-2 sm:gap-3 sm:px-3">
        <div className="mr-2 flex shrink-0 items-center">
          <TopLeftLogo />
        </div>

        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0d0d0f] border border-white/[0.06] hover:border-white/[0.1] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.03)] transition-all"
          >
            <span className="font-mono font-bold text-sm text-[#e4e4e7]">
              {headerSymbol}
            </span>
            <ChevronDown className="w-3 h-3 text-[#666]" />
          </button>

          {open && (
            <div className="absolute top-full left-0 mt-1 w-44 overflow-hidden rounded border border-white/[0.08] bg-[#0d0d0f] shadow-2xl z-50">
              {HEADER_TICKERS.map((t) => (
                <button
                  key={t.symbol}
                  onClick={() => {
                    onSymbolChange(t.symbol);
                    setOpen(false);
                  }}
                  className={`w-full px-3 py-2 flex items-center justify-between text-xs hover:bg-[#161616] transition-colors ${
                    t.symbol === headerSymbol
                      ? "bg-[#151518] text-[#16a34a]"
                      : "text-[#a1a1aa]"
                  }`}
                >
                  <span className="font-mono font-medium">{t.symbol}</span>
                  <span className="text-[10px] text-[#6b7280]">{t.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-base font-bold text-[#e4e4e7] tabular-nums tracking-tight">
            {effectiveSpot > 0 ? formattedSpot : "—"}
          </span>
          <span
            className={`font-mono text-xs font-medium tabular-nums ${
              isPositive ? "text-[#16a34a]" : "text-[#dc2626]"
            }`}
          >
            {formattedChange} ({formattedChangePct})
          </span>
          {syncState !== "live" ? (
            <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold text-white">
              {statusLabel}
            </span>
          ) : null}
        </div>

        {displayExpiries.length > 0 && (
          <>
            <span className="hidden text-[10px] text-neutral-700 select-none sm:inline">
              |
            </span>
            <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
              <span className="mr-0.5 hidden text-[9px] font-medium uppercase tracking-[0.12em] text-neutral-600 sm:inline">
                Exp
              </span>
              <button
                type="button"
                onClick={() => onExpiryChange(null)}
                title="All expirations in chain"
                className={`rounded border px-1.5 py-0.5 font-mono text-[10px] transition-colors sm:px-2 ${
                  selectedExpiry === null
                    ? "border-neutral-500 bg-neutral-800 text-white"
                    : "border-white/[0.08] bg-transparent text-neutral-500 hover:border-neutral-600 hover:text-neutral-300"
                }`}
              >
                All
              </button>
              {[0, 1, 2, 3].map((idx) => {
                const exp = displayExpiries[idx];
                const n = String(idx + 1);
                if (!exp) {
                  return (
                    <button
                      key={n}
                      type="button"
                      disabled
                      title="No expiry"
                      className="min-w-[1.75rem] cursor-not-allowed rounded border border-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-neutral-700 sm:px-2"
                    >
                      {n}
                    </button>
                  );
                }
                const active = selectedExpiry === exp;
                return (
                  <button
                    type="button"
                    key={exp}
                    title={exp}
                    onClick={() => onExpiryChange(exp)}
                    className={`min-w-[1.75rem] rounded border px-1.5 py-0.5 font-mono text-[10px] transition-colors sm:px-2 ${
                      active
                        ? "border-neutral-500 bg-neutral-800 text-white"
                        : "border-white/[0.08] bg-transparent text-neutral-500 hover:border-neutral-600 hover:text-neutral-300"
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
              <span className="ml-0.5 hidden text-[9px] text-neutral-600 lg:inline">
                {selectedExpiry
                  ? formatExpShort(selectedExpiry)
                  : "All exps"}
              </span>
            </div>
          </>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <Link
            href="/dashboard"
            className="hidden text-[10px] font-medium text-neutral-500 transition-colors hover:text-neutral-300 sm:inline"
          >
            Home
          </Link>
          <div className="hidden h-4 w-px bg-white/[0.08] sm:block" aria-hidden />

          <div className="flex items-center gap-1.5 font-mono text-[10px] tabular-nums text-neutral-500">
            <Clock className="w-3 h-3 shrink-0 opacity-70" />
            <span>
              {time}{" "}
              <span className="text-neutral-600">ET</span>
              {etDate ? (
                <span className="text-neutral-600"> · {etDate}</span>
              ) : null}
            </span>
          </div>

          <div className="hidden h-4 w-px bg-white/[0.08] sm:block" aria-hidden />

          <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-wide">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                syncState === "live" ? "bg-emerald-400" : "bg-white/70"
              } ${syncState === "fetching" ? "animate-pulse" : ""}`}
            />
            <span className="hidden text-white sm:inline">
              {statusLabel}
            </span>
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                live
                  ? isMarketOpen
                    ? "bg-[#4ade80] animate-pulse"
                    : "bg-[#a3e635]"
                  : "bg-[#f59e0b]"
              }`}
            />
            <span className="text-white">
              LIVE
              {ageSec != null ? (
                <span className="text-[#737373]"> · {ageSec}s</span>
              ) : null}
              <span className="text-[#525252]">
                {" "}
                · {refreshMs / 1000}s
              </span>
            </span>
            <span className="text-[#525252] hidden md:inline">
              · {isMarketOpen ? "MARKET OPEN" : "MARKET CLOSED"}
            </span>
          </div>

          <button
            onClick={onRefresh}
            className="p-1 rounded hover:bg-[#161616] text-[#666] hover:text-[#f0f0f0] transition-colors"
            title="Refresh data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleUnlink}
            className="p-1 rounded hover:bg-[#161616] text-[#666] hover:text-[#ff4444] transition-colors"
            title="Unlink & logout"
          >
            <Unlink className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <div className="panel-sheen flex h-7 min-w-0 items-center overflow-hidden border-b border-white/[0.06] bg-black">
        <span className="shrink-0 border-r border-white/[0.08] px-3 py-1 text-[9px] font-medium uppercase tracking-[0.16em] text-neutral-600">
          Market news
        </span>
        {news.length > 0 ? (
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="animate-news-scroll flex gap-10 whitespace-nowrap pl-3 pr-8">
              {[...news, ...news].map((item, i) => {
                const href =
                  item.url && /^https?:\/\//i.test(item.url)
                    ? item.url
                    : `https://www.google.com/search?q=${encodeURIComponent(item.title)}`;
                const impactHigh =
                  item.sentiment === "bullish" ||
                  item.sentiment === "bearish";
                return (
                  <a
                    key={`${item.id}-${i}`}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pointer-events-auto inline-flex shrink-0 items-baseline gap-1.5 text-[10px] hover:opacity-90"
                  >
                    <span
                      className={`rounded px-1 py-px text-[8px] font-bold uppercase tracking-wide ${
                        impactHigh
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-neutral-700/40 text-neutral-500"
                      }`}
                    >
                      {impactHigh ? "High" : "Med"}
                    </span>
                    <span
                      className={
                        item.sentiment === "bullish"
                          ? "text-emerald-400"
                          : item.sentiment === "bearish"
                            ? "text-red-400"
                            : "text-neutral-600"
                      }
                    >
                      {item.sentiment === "bullish"
                        ? "▲"
                        : item.sentiment === "bearish"
                          ? "▼"
                          : "●"}
                    </span>
                    <span className="text-neutral-400 underline decoration-white/10 underline-offset-2">
                      {item.title}
                    </span>
                    <span className="text-neutral-600 no-underline">
                      · {item.source}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="truncate px-4 text-[10px] text-neutral-600">
            Waiting for headlines…
          </div>
        )}
      </div>
    </div>
  );
}
