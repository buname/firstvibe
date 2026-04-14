"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type Time,
} from "lightweight-charts";
import {
  Activity,
  BarChart2,
  Camera,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  TrendingUp,
} from "lucide-react";
import type { TickerSymbol } from "@/lib/constants";
import type { OHLCVBar, ChartType, Timeframe } from "@/lib/chart-data";
import { generateOHLCV } from "@/lib/chart-data";
import type { KeyLevels } from "@/lib/gex-engine";
import { CHART_TICKERS, resolveChartTicker } from "@/registry/tickers";
import {
  useChartStudioStore,
  type LevelVisibility,
} from "@/stores/useChartStudioStore";
import { getTimeframeRange } from "@/utils/timeframe";

type DrawTool = "none" | "trendline" | "hline" | "vline" | "crossline";

interface ChartStudioProps {
  symbol: string;
  keyLevels: KeyLevels;
  spotPrice: number;
  className?: string;
  onSymbolChange?: (next: TickerSymbol) => void;
}

interface LevelDef {
  key: keyof LevelVisibility;
  label: string;
  shortLabel: string;
  color: string;
  getValue: (kl: KeyLevels) => number;
}

interface TooltipData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  changePct: number;
}

const TIMEFRAMES: Timeframe[] = ["1D", "5D", "1M", "3M", "6M", "1Y", "ALL"];
const DRAW_COLORS = ["#e4e4e7", "#16a34a", "#dc2626", "#ea580c", "#2563eb"];

const LEVEL_DEFS: LevelDef[] = [
  { key: "callWall", label: "Call Wall", shortLabel: "CW", color: "#16a34a", getValue: (kl) => kl.callWall },
  { key: "putWall", label: "Put Wall", shortLabel: "PW", color: "#dc2626", getValue: (kl) => kl.putWall },
  { key: "gammaFlip", label: "Gamma Flip", shortLabel: "GF", color: "#9333ea", getValue: (kl) => kl.gammaFlip },
  { key: "maxPain", label: "Max Pain", shortLabel: "MP", color: "#ea580c", getValue: (kl) => kl.maxPain },
  { key: "volTrigger", label: "Vol Trigger", shortLabel: "VT", color: "#2563eb", getValue: (kl) => kl.volTrigger },
  { key: "spot", label: "Spot", shortLabel: "SP", color: "#f8fafc", getValue: (kl) => kl.spotPrice },
];

function LevelLegend({
  keyLevels,
  visibility,
  onToggle,
  onScrollTo,
}: {
  keyLevels: KeyLevels;
  visibility: LevelVisibility;
  onToggle: (key: keyof LevelVisibility) => void;
  onScrollTo: () => void;
}) {
  const spot = keyLevels.spotPrice;
  return (
    <div className="w-[175px] shrink-0 overflow-y-auto border-l border-[#1c1c1c] bg-[#0a0a0a]">
      <div className="border-b border-[#1c1c1c] px-2.5 py-2 text-[8px] font-mono uppercase tracking-[0.18em] text-[#444]">
        Key Levels
      </div>
      {LEVEL_DEFS.map((def) => {
        const value = def.getValue(keyLevels);
        const dist = ((value - spot) / spot) * 100;
        return (
          <div key={def.key} className="flex cursor-pointer items-center gap-1.5 px-2.5 py-1.5 transition-colors hover:bg-[#111]" onClick={onScrollTo}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggle(def.key);
              }}
              className="text-[#555] hover:text-[#888]"
            >
              {visibility[def.key] ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
            </button>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: def.color }} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[9px] font-mono" style={{ color: visibility[def.key] ? def.color : "#444" }}>
                {def.label}
              </div>
              <div className="text-[8px] font-mono text-[#666]">
                ${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}{" "}
                {def.key !== "spot" && (
                  <span style={{ color: dist >= 0 ? "#16a34a" : "#dc2626" }}>
                    ({dist >= 0 ? "+" : ""}
                    {dist.toFixed(2)}%)
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ChartStudio({
  symbol,
  keyLevels,
  spotPrice,
  className = "",
  onSymbolChange,
}: ChartStudioProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mainSeriesRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const levelPriceLinesRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drawPriceLinesRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drawSeriesRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const previewTrendSeriesRef = useRef<any>(null);
  const previewFrameRef = useRef<number | null>(null);
  const pendingPreviewRef = useRef<{ time: Time; price: number } | null>(null);
  const trendStartRef = useRef<{ time: Time; price: number } | null>(null);
  const lastSyncedSymbolRef = useRef<string | null>(null);
  const prevChartTypeRef = useRef<ChartType>("candlestick");
  const prevTimeframeRef = useRef<Timeframe>("3M");
  const prevTickerRef = useRef("SPY");

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [activeDrawTool, setActiveDrawTool] = useState<DrawTool>("none");
  const [drawColor, setDrawColor] = useState("#22c55e");
  const [linesMenuOpen, setLinesMenuOpen] = useState(false);

  const selectedTicker = useChartStudioStore((state) => state.selectedTicker);
  const timeframe = useChartStudioStore((state) => state.timeframe);
  const chartType = useChartStudioStore((state) => state.chartType);
  const levelVisibility = useChartStudioStore((state) => state.levelVisibility);
  const setSelectedTicker = useChartStudioStore(
    (state) => state.setSelectedTicker
  );
  const setTimeframe = useChartStudioStore((state) => state.setTimeframe);
  const setChartType = useChartStudioStore((state) => state.setChartType);
  const toggleLevel = useChartStudioStore((state) => state.toggleLevel);

  useEffect(() => {
    if (lastSyncedSymbolRef.current === symbol) return;
    const mapped = CHART_TICKERS.find((t) => t.dashboardSymbol === symbol);
    if (!mapped) return;
    lastSyncedSymbolRef.current = symbol;
    if (mapped.symbol !== selectedTicker) {
      setSelectedTicker(mapped.symbol);
    }
  }, [selectedTicker, setSelectedTicker, symbol]);

  useEffect(() => {
    // Debug trace for ticker propagation check.
    console.log("[ChartStudio] selectedTicker changed:", selectedTicker);
  }, [selectedTicker]);

  useEffect(() => {
    const key = "bex-chart-studio";
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        state?: { selectedTicker?: string; activeTicker?: string };
      };
      const persistedTicker =
        parsed.state?.selectedTicker ?? parsed.state?.activeTicker;
      if (!persistedTicker) return;
      const valid = CHART_TICKERS.some((t) => t.symbol === persistedTicker);
      if (!valid) {
        localStorage.removeItem(key);
      }
    } catch {
      localStorage.removeItem(key);
    }
  }, []);

  const tickerMeta = useMemo(() => resolveChartTicker(selectedTicker), [selectedTicker]);
  const effectiveSpot = tickerMeta.dashboardSymbol === symbol ? spotPrice : tickerMeta.referencePrice;
  const baseBars = useMemo(
    () => generateOHLCV(tickerMeta.referencePrice, timeframe, selectedTicker),
    [selectedTicker, timeframe, tickerMeta.referencePrice]
  );
  const bars = useMemo<OHLCVBar[]>(() => {
    if (baseBars.length === 0) return baseBars;
    const next = [...baseBars];
    const last = { ...next[next.length - 1] };
    last.close = +effectiveSpot.toFixed(2);
    last.high = Math.max(last.high, last.close);
    last.low = Math.min(last.low, last.close);
    next[next.length - 1] = last;
    return next;
  }, [baseBars, effectiveSpot]);

  const clearDrawings = useCallback(() => {
    const safeRemoveSeries = (series: unknown) => {
      if (!series) return;
      try {
        chartRef.current?.removeSeries(series as never);
      } catch {
        // ignore stale series handles during rapid hover/unmount
      }
    };

    if (mainSeriesRef.current) {
      drawPriceLinesRef.current.forEach((line) => mainSeriesRef.current.removePriceLine(line));
    }
    drawPriceLinesRef.current = [];
    drawSeriesRef.current.forEach((s) => safeRemoveSeries(s));
    drawSeriesRef.current = [];
    if (previewTrendSeriesRef.current) {
      safeRemoveSeries(previewTrendSeriesRef.current);
      previewTrendSeriesRef.current = null;
    }
    if (previewFrameRef.current != null) {
      cancelAnimationFrame(previewFrameRef.current);
      previewFrameRef.current = null;
    }
    pendingPreviewRef.current = null;
    trendStartRef.current = null;
  }, []);

  const applyMainSeries = useCallback(
    (preserveRange: boolean) => {
      const chart = chartRef.current;
      if (!chart || bars.length === 0) return;
      const previousRange = chart.timeScale().getVisibleRange();

      if (mainSeriesRef.current) chart.removeSeries(mainSeriesRef.current);
      clearDrawings();
      levelPriceLinesRef.current = [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let series: any;
      if (chartType === "candlestick") {
        series = chart.addSeries(CandlestickSeries, {
          upColor: "#16a34a",
          downColor: "#dc2626",
          borderUpColor: "#16a34a",
          borderDownColor: "#dc2626",
          wickUpColor: "rgba(22,163,74,0.58)",
          wickDownColor: "rgba(220,38,38,0.58)",
        });
        series.setData(bars);
      } else if (chartType === "line") {
        series = chart.addSeries(LineSeries, { color: "#16a34a", lineWidth: 2 });
        series.setData(bars.map((b) => ({ time: b.time, value: b.close })));
      } else {
        series = chart.addSeries(AreaSeries, {
          lineColor: "#16a34a",
          lineWidth: 2,
          topColor: "rgba(22,163,74,0.15)",
          bottomColor: "rgba(22,163,74,0.015)",
        });
        series.setData(bars.map((b) => ({ time: b.time, value: b.close })));
      }
      mainSeriesRef.current = series;

      chart.applyOptions({
        timeScale: {
          timeVisible: timeframe === "1D" || timeframe === "5D",
          barSpacing: timeframe === "1D" ? 4 : timeframe === "5D" ? 3 : 2.5,
        },
      });

      if (preserveRange && previousRange) {
        chart.timeScale().setVisibleRange(previousRange);
      } else {
        const range = getTimeframeRange(timeframe);
        chart.timeScale().setVisibleRange({
          from: Math.floor(range.start.getTime() / 1000) as Time,
          to: Math.floor(range.end.getTime() / 1000) as Time,
        });
      }
    },
    [bars, chartType, clearDrawings, timeframe]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#666",
        fontFamily: "var(--font-geist-mono), monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.05)" },
        horzLines: { color: "rgba(255,255,255,0.05)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#333", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#1f2937" },
        horzLine: { color: "#333", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#1f2937" },
      },
      rightPriceScale: { borderColor: "#1c1c1c", scaleMargins: { top: 0.05, bottom: 0.05 } },
      timeScale: { borderColor: "#1c1c1c", rightOffset: 3, fixLeftEdge: false, lockVisibleTimeRangeOnResize: false },
      handleScroll: true,
      handleScale: true,
    });
    chartRef.current = chart;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) chart.applyOptions({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      mainSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chartTypeChanged = prevChartTypeRef.current !== chartType;
    const timeframeChanged = prevTimeframeRef.current !== timeframe;
    const tickerChanged = prevTickerRef.current !== selectedTicker;
    applyMainSeries(chartTypeChanged && !timeframeChanged && !tickerChanged);
    prevChartTypeRef.current = chartType;
    prevTimeframeRef.current = timeframe;
    prevTickerRef.current = selectedTicker;
  }, [selectedTicker, applyMainSeries, chartType, timeframe]);

  useEffect(() => {
    if (!mainSeriesRef.current) return;
    levelPriceLinesRef.current.forEach((line) => mainSeriesRef.current.removePriceLine(line));
    levelPriceLinesRef.current = [];
    LEVEL_DEFS.forEach((def) => {
      if (!levelVisibility[def.key]) return;
      const line = mainSeriesRef.current.createPriceLine({
        price: def.getValue(keyLevels),
        color: def.color,
        lineWidth: def.key === "spot" ? 2 : 1,
        lineStyle: def.key === "spot" ? LineStyle.Solid : LineStyle.Dashed,
        axisLabelVisible: true,
        title: def.shortLabel,
      });
      levelPriceLinesRef.current.push(line);
    });
  }, [keyLevels, levelVisibility]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const crosshairHandler = (param: any) => {
      if (!mainSeriesRef.current) return setTooltipData(null);

      if (activeDrawTool === "trendline" && trendStartRef.current && param.time) {
        if (!previewTrendSeriesRef.current) {
          previewTrendSeriesRef.current = chart.addSeries(LineSeries, {
            color: drawColor,
            lineWidth: 2,
            lineStyle: LineStyle.Dashed,
            lastValueVisible: false,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
            pointMarkersVisible: true,
          });
        }
        const previewPrice = mainSeriesRef.current.coordinateToPrice(param.point?.y ?? 0);
        if (previewPrice != null) {
          pendingPreviewRef.current = {
            time: param.time as Time,
            price: previewPrice,
          };
          if (previewFrameRef.current == null) {
            previewFrameRef.current = requestAnimationFrame(() => {
              previewFrameRef.current = null;
              if (
                !previewTrendSeriesRef.current ||
                !trendStartRef.current ||
                !pendingPreviewRef.current
              ) {
                return;
              }
              const p0 = {
                time: trendStartRef.current.time,
                value: trendStartRef.current.price,
              };
              const p1 = {
                time: pendingPreviewRef.current.time,
                value: pendingPreviewRef.current.price,
              };
              const ordered =
                Number(p0.time) <= Number(p1.time) ? [p0, p1] : [p1, p0];
              previewTrendSeriesRef.current.setData([ordered[0], ordered[1]]);
            });
          }
        }
      } else if (previewTrendSeriesRef.current) {
        try {
          chart.removeSeries(previewTrendSeriesRef.current);
        } catch {
          // ignore stale series handles
        }
        previewTrendSeriesRef.current = null;
        if (previewFrameRef.current != null) {
          cancelAnimationFrame(previewFrameRef.current);
          previewFrameRef.current = null;
        }
        pendingPreviewRef.current = null;
      }

      // Skip tooltip churn while drawing preview to keep interactions soft.
      if (activeDrawTool === "trendline" && trendStartRef.current) return;
      if (!param.time || !param.seriesData) return setTooltipData(null);
      const row = param.seriesData.get(mainSeriesRef.current);
      if (!row) return;
      const d = new Date(Number(param.time) * 1000);
      if ("open" in row) {
        setTooltipData({
          time: d.toLocaleString(),
          open: row.open,
          high: row.high,
          low: row.low,
          close: row.close,
          changePct: ((row.close - row.open) / row.open) * 100,
        });
      } else {
        setTooltipData({
          time: d.toLocaleString(),
          open: row.value,
          high: row.value,
          low: row.value,
          close: row.value,
          changePct: 0,
        });
      }
    };
    chart.subscribeCrosshairMove(crosshairHandler);
    return () => {
      chart.unsubscribeCrosshairMove(crosshairHandler);
      if (previewTrendSeriesRef.current) {
        try {
          chart.removeSeries(previewTrendSeriesRef.current);
        } catch {
          // ignore stale series handles
        }
        previewTrendSeriesRef.current = null;
      }
      if (previewFrameRef.current != null) {
        cancelAnimationFrame(previewFrameRef.current);
        previewFrameRef.current = null;
      }
      pendingPreviewRef.current = null;
    };
  }, [activeDrawTool, chartType, drawColor, timeframe]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !mainSeriesRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clickHandler = (param: any) => {
      if (!param.point || !param.time || activeDrawTool === "none") return;
      const price = mainSeriesRef.current.coordinateToPrice(param.point.y);
      if (price == null) return;
      const t = param.time as Time;

      if (activeDrawTool === "hline") {
        const line = mainSeriesRef.current.createPriceLine({
          price,
          color: drawColor,
          lineStyle: LineStyle.Solid,
          lineWidth: 1,
          axisLabelVisible: true,
          title: "HL",
        });
        drawPriceLinesRef.current.push(line);
        return;
      }

      const min = Math.min(...bars.map((b) => b.low));
      const max = Math.max(...bars.map((b) => b.high));

      if (activeDrawTool === "vline") {
        const v = chart.addSeries(LineSeries, {
          color: drawColor,
          lineWidth: 1,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
          pointMarkersVisible: false,
        });
        v.setData([
          { time: (Number(t) - 1) as Time, value: min * 0.99 },
          { time: (Number(t) + 1) as Time, value: max * 1.01 },
        ]);
        drawSeriesRef.current.push(v);
        return;
      }

      if (activeDrawTool === "crossline") {
        const h = mainSeriesRef.current.createPriceLine({
          price,
          color: drawColor,
          lineStyle: LineStyle.Dotted,
          lineWidth: 1,
          axisLabelVisible: true,
          title: "CR",
        });
        drawPriceLinesRef.current.push(h);
        const v = chart.addSeries(LineSeries, {
          color: drawColor,
          lineWidth: 1,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
          pointMarkersVisible: false,
        });
        v.setData([
          { time: (Number(t) - 1) as Time, value: min * 0.99 },
          { time: (Number(t) + 1) as Time, value: max * 1.01 },
        ]);
        drawSeriesRef.current.push(v);
        return;
      }

      if (activeDrawTool === "trendline") {
        if (!trendStartRef.current) {
          trendStartRef.current = { time: t, price };
          return;
        }
        if (previewTrendSeriesRef.current) {
          try {
            chart.removeSeries(previewTrendSeriesRef.current);
          } catch {
            // ignore stale series handles
          }
          previewTrendSeriesRef.current = null;
        }
        const start = trendStartRef.current;
        const trend = chart.addSeries(LineSeries, {
          color: drawColor,
          lineWidth: 2,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
          pointMarkersVisible: true,
        });
        const p0 = { time: start.time, value: start.price };
        const p1 = { time: t, value: price };
        const ordered =
          Number(p0.time) <= Number(p1.time) ? [p0, p1] : [p1, p0];
        trend.setData([ordered[0], ordered[1]]);
        drawSeriesRef.current.push(trend);
        trendStartRef.current = null;
        // One-shot behavior: after second click, exit trendline mode.
        setActiveDrawTool("none");
        setLinesMenuOpen(false);
      }
    };

    chart.subscribeClick(clickHandler);
    return () => chart.unsubscribeClick(clickHandler);
  }, [activeDrawTool, bars, drawColor]);

  const handleTickerPick = useCallback(
    (value: string) => {
      const found = CHART_TICKERS.find((t) => t.symbol === value);
      if (!found) {
        setSwitchError("Ticker bulunamadi, tekrar dene.");
        return;
      }
      setSwitchError(null);
      setIsTransitioning(true);
      setSelectedTicker(found.symbol);
      if (found.dashboardSymbol && onSymbolChange) onSymbolChange(found.dashboardSymbol);
      setTimeout(() => setIsTransitioning(false), 160);
    },
    [onSymbolChange, setSelectedTicker]
  );

  const handleTimeframeChange = useCallback(
    (value: Timeframe) => {
      setIsTransitioning(true);
      setTimeframe(value);
      setTimeout(() => setIsTransitioning(false), 120);
    },
    [setTimeframe]
  );

  const handleScreenshot = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const canvas = chart.takeScreenshot();
    const link = document.createElement("a");
    link.download = `${selectedTicker}-${timeframe}.png`;
    link.href = canvas.toDataURL();
    link.click();
  }, [selectedTicker, timeframe]);

  const wrapperClass = isFullscreen
    ? "fixed inset-0 z-50 flex flex-col bg-black"
    : `flex min-h-[520px] flex-col overflow-hidden rounded border border-[#1c1c1c] ${className}`;

  return (
    <div className={wrapperClass}>
      <div className="flex flex-wrap items-center gap-2 border-b border-[#1c1c1c] bg-[#0a0a0a] px-3 py-2">
        <select
          value={selectedTicker}
          onChange={(e) => handleTickerPick(e.target.value)}
          className="h-7 min-w-[180px] rounded border border-[#1c1c1c] bg-[#0e0e0e] px-2 text-[10px] font-mono text-[#ddd] outline-none"
        >
          {CHART_TICKERS.map((ticker) => (
            <option key={ticker.symbol} value={ticker.symbol}>
              {ticker.symbol} · {ticker.name}
            </option>
          ))}
        </select>
        <div className="rounded border border-[#1c1c1c] bg-[#0e0e0e]">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => handleTimeframeChange(tf)}
              className={`px-2.5 py-1 text-[10px] font-mono transition-colors ${
                timeframe === tf ? "bg-[#1f2937] text-[#e5e7eb]" : "text-[#555] hover:bg-[#151515] hover:text-[#999]"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
        <div className="overflow-hidden rounded border border-[#1c1c1c] bg-[#0e0e0e]">
          <button onClick={() => setChartType("candlestick")} className={`p-1.5 ${chartType === "candlestick" ? "bg-[#1f2937] text-white" : "text-[#555] hover:text-[#999]"}`} title="Candlestick"><BarChart2 className="h-3 w-3" /></button>
          <button onClick={() => setChartType("line")} className={`p-1.5 ${chartType === "line" ? "bg-[#1f2937] text-white" : "text-[#555] hover:text-[#999]"}`} title="Line"><TrendingUp className="h-3 w-3" /></button>
          <button onClick={() => setChartType("area")} className={`p-1.5 ${chartType === "area" ? "bg-[#1f2937] text-white" : "text-[#555] hover:text-[#999]"}`} title="Area"><Activity className="h-3 w-3" /></button>
        </div>
        <div className="relative">
          <button
            onClick={() => setLinesMenuOpen((v) => !v)}
            className={`rounded border border-[#1c1c1c] bg-[#0e0e0e] p-1.5 ${linesMenuOpen ? "text-white" : "text-[#666] hover:text-[#9ca3af]"}`}
            title="Lines tools"
          >
            <Pencil className="h-3 w-3" />
          </button>
          {linesMenuOpen && (
            <div className="absolute left-0 top-8 z-30 w-44 rounded-lg border border-[#2a2a2a] bg-[#111] p-2 shadow-2xl">
              <div className="mb-2 text-[8px] font-mono uppercase tracking-[0.16em] text-[#666]">Lines</div>
              {[
                { id: "trendline", label: "Trendline" },
                { id: "hline", label: "Horizontal line" },
                { id: "vline", label: "Vertical line" },
                { id: "crossline", label: "Cross line" },
              ].map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => {
                    setActiveDrawTool(tool.id as DrawTool);
                    setLinesMenuOpen(false);
                  }}
                  className={`mb-1 w-full rounded px-2 py-1 text-left text-[11px] ${
                    activeDrawTool === tool.id ? "bg-[#1f2937] text-white" : "text-[#bbb] hover:bg-[#181818]"
                  }`}
                >
                  {tool.label}
                </button>
              ))}
              <div className="my-2 h-px bg-[#222]" />
              <div className="mb-1 text-[8px] font-mono text-[#666]">Color</div>
              <div className="flex gap-1.5">
                {DRAW_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setDrawColor(c)}
                    className={`h-4 w-4 rounded-full border ${drawColor === c ? "border-white" : "border-transparent"}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        <button onClick={() => setActiveDrawTool("none")} className="rounded border border-[#1c1c1c] bg-[#0e0e0e] p-1.5 text-[#666] hover:text-[#9ca3af]" title="Disable tool"><Plus className="h-3 w-3" /></button>
        <button onClick={clearDrawings} className="rounded border border-[#1c1c1c] bg-[#0e0e0e] p-1.5 text-[#666] hover:text-[#9ca3af]" title="Clear drawings"><Trash2 className="h-3 w-3" /></button>
        <div className="flex-1" />
        <button onClick={handleScreenshot} className="rounded border border-[#1c1c1c] bg-[#0e0e0e] p-1.5 text-[#666] hover:text-[#9ca3af]" title="Export snapshot"><Camera className="h-3 w-3" /></button>
        <button onClick={() => chartRef.current?.timeScale().fitContent()} className="rounded border border-[#1c1c1c] bg-[#0e0e0e] p-1.5 text-[#666] hover:text-[#9ca3af]" title="Reset view"><RotateCcw className="h-3 w-3" /></button>
        <button onClick={() => setIsFullscreen((x) => !x)} className="rounded border border-[#1c1c1c] bg-[#0e0e0e] p-1.5 text-[#666] hover:text-[#9ca3af]" title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
          {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1 bg-[#080808]">
          {isTransitioning && (
            <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded border border-white/10 bg-black/60 px-2 py-1 text-[10px] font-mono text-[#a1a1aa]">
              Loading {selectedTicker}...
            </div>
          )}
          {switchError && (
            <div className="absolute right-2 top-2 z-20 rounded border border-red-900/50 bg-black/70 px-2 py-1 text-[10px] font-mono text-[#ef4444]">
              {switchError}
              <button
                type="button"
                onClick={() => handleTickerPick(selectedTicker)}
                className="ml-2 text-[#c4c4c7] hover:text-white"
              >
                Retry
              </button>
            </div>
          )}
          {tooltipData && (
            <div className="pointer-events-none absolute left-1 top-1 z-20 rounded bg-black/55 px-2 py-1 text-[9px] font-mono text-[#cfd5db]">
              {tooltipData.time} · O {tooltipData.open.toFixed(2)} H {tooltipData.high.toFixed(2)} L {tooltipData.low.toFixed(2)} C {tooltipData.close.toFixed(2)}{" "}
              <span style={{ color: tooltipData.changePct >= 0 ? "#16a34a" : "#dc2626" }}>
                {tooltipData.changePct >= 0 ? "+" : ""}
                {tooltipData.changePct.toFixed(2)}%
              </span>
            </div>
          )}
          <div ref={containerRef} className={`absolute inset-0 transition-opacity duration-150 ${isTransitioning ? "opacity-45" : "opacity-100"}`} />
        </div>
        <LevelLegend
          keyLevels={keyLevels}
          visibility={levelVisibility}
          onToggle={toggleLevel}
          onScrollTo={() => chartRef.current?.priceScale("right").applyOptions({ autoScale: true })}
        />
      </div>
    </div>
  );
}
