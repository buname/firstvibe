"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { HeatmapCell } from "@/lib/gex-engine";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface Props {
  symbol: string;
  heatmap: HeatmapCell[];
  spotPrice: number;
}

function shortExp(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso.slice(5);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function HeatmapTab({ symbol, heatmap, spotPrice }: Props) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const expTabs = useMemo(() => {
    return [...new Set(heatmap.map((h) => h.expiry))].sort().slice(0, 10);
  }, [heatmap]);

  /**
   * null = show nearest-expiry ladder by default (first sorted expiry).
   * "ALL" or an ISO = explicit user choice.
   */
  const [userOverride, setUserOverride] = useState<"ALL" | string | null>(null);
  const tab = userOverride ?? expTabs[0] ?? "ALL";

  // ── Data ──────────────────────────────────────────────────────────────────
  const { plotData, plotLayout, emptyHint } = useMemo(() => {
    const source = tab === "ALL" ? heatmap : heatmap.filter((c) => c.expiry === tab);
    const band = (pct: number) =>
      source.filter(
        (c) =>
          spotPrice > 0 &&
          Math.abs(c.strike - spotPrice) / spotPrice < pct
      );
    // Match gex-engine computeHeatmap (8%); widen fallback so ladder never dies on mock/real gaps
    let filtered = band(0.085);
    if (filtered.length === 0) filtered = band(0.15);
    if (filtered.length === 0) filtered = [...source];

    if (tab === "ALL") {
      // 2-D heatmap (strike × expiry) for ALL
      const expSet = [...new Set(filtered.map((c) => c.expiry))].sort();
      const strikeSet = [...new Set(filtered.map((c) => c.strike))].sort(
        (a, b) => a - b
      );
      const everyN = Math.max(1, Math.floor(strikeSet.length / 40));
      const displayStrikes = strikeSet.filter((_, i) => i % everyN === 0);
      const grid = new Map(filtered.map((c) => [`${c.strike}|${c.expiry}`, c.value]));

      if (expSet.length === 0 || displayStrikes.length === 0) {
        return {
          plotData: [],
          plotLayout: {
            paper_bgcolor: "#0d0d0d",
            plot_bgcolor: "#0d0d0d",
            margin: { l: 16, r: 16, t: 16, b: 16 },
          },
          emptyHint:
            "No heat cells for ALL in this band — pick a single expiry tab.",
        };
      }

      const atmIdx = displayStrikes.reduce(
        (best, s, i) =>
          Math.abs(s - spotPrice) < Math.abs(displayStrikes[best] - spotPrice)
            ? i
            : best,
        0
      );

      return {
        plotData: [
          {
            type: "heatmap" as const,
            x: expSet.map(shortExp),
            y: displayStrikes,
            z: displayStrikes.map((s) =>
              expSet.map((e) => grid.get(`${s}|${e}`) ?? 0)
            ),
            colorscale: [
              [0, "#ff4444"],
              [0.2, "#cc1133"],
              [0.4, "#440011"],
              [0.5, "#0a0a0a"],
              [0.6, "#004422"],
              [0.8, "#00cc66"],
              [1, "#00ff88"],
            ] as [number, string][],
            zmid: 0,
            /** Thin gutters so cells read as tiles, not one solid slab */
            xgap: 2,
            ygap: 2,
            showscale: true,
            colorbar: {
              title: { text: "GEX $", font: { color: "#555", size: 8 } },
              tickfont: { color: "#555", size: 8 },
              bgcolor: "transparent",
              bordercolor: "#1a1a1a",
              thickness: 10,
            },
            hovertemplate: "Expiry: %{x}<br>Strike: %{y}<br>GEX: %{z:,.0f}<extra></extra>",
          },
        ],
        plotLayout: {
          autosize: true,
          paper_bgcolor: "#0d0d0d",
          plot_bgcolor: "#0d0d0d",
          font: { color: "#555", family: "monospace", size: 9 },
          xaxis: {
            title: { text: "Expiry", font: { size: 9 } },
            gridcolor: "#171717",
            color: "#555",
          },
          yaxis: {
            title: { text: "Strike", font: { size: 9 } },
            gridcolor: "#171717",
            color: "#555",
            constrain: "domain" as const,
          },
          margin: { l: 56, r: 64, t: 8, b: 36 },
          shapes: displayStrikes.length > 0
            ? [
                {
                  type: "line" as const,
                  x0: -0.5,
                  x1: expSet.length - 0.5,
                  y0: displayStrikes[atmIdx],
                  y1: displayStrikes[atmIdx],
                  line: { color: "#ffffff", width: 1, dash: "dash" as const },
                },
              ]
            : [],
        },
        emptyHint: null,
      };
    }

    // ── Ladder view for single expiry ─────────────────────────────────────
    const strikesFull = [...new Set(filtered.map((c) => c.strike))].sort(
      (a, b) => b - a
    ); // descending so top strike at top
    if (strikesFull.length === 0) {
      return {
        plotData: [],
        plotLayout: {
          paper_bgcolor: "#0d0d0d",
          plot_bgcolor: "#0d0d0d",
          margin: { l: 16, r: 16, t: 16, b: 16 },
        },
        emptyHint: "No strikes in band for this expiry.",
      };
    }

    /** Keep ladder vertically dense (Opacity-style): window around ATM, not entire chain. */
    const MAX_LADDER_ROWS = 34;
    let si = 0;
    let bestD = Infinity;
    for (let i = 0; i < strikesFull.length; i++) {
      const d = Math.abs(strikesFull[i] - spotPrice);
      if (d < bestD) {
        bestD = d;
        si = i;
      }
    }
    const half = Math.floor(MAX_LADDER_ROWS / 2);
    let lo = Math.max(0, si - half);
    const hi = Math.min(strikesFull.length, lo + MAX_LADDER_ROWS);
    if (hi - lo < MAX_LADDER_ROWS) {
      lo = Math.max(0, hi - MAX_LADDER_ROWS);
    }
    const strikes = strikesFull.slice(lo, hi);

    const gexMap = new Map(filtered.map((c) => [c.strike, c.value]));
    const values = strikes.map((s) => gexMap.get(s) ?? 0);
    const callVals = values.map((v) => (v > 0 ? v / 1e6 : 0));
    const putVals = values.map((v) => (v < 0 ? v / 1e6 : 0));

    const atmStrike = strikes.reduce((best, s) =>
      Math.abs(s - spotPrice) < Math.abs(best - spotPrice) ? s : best,
      strikes[0] ?? spotPrice
    );

    const maxAbsM = Math.max(
      1e-3,
      ...callVals.map(Math.abs),
      ...putVals.map(Math.abs)
    );

    const putColors = putVals.map((v) => {
      if (v >= 0) return "rgba(0,0,0,0)";
      const t = Math.min(1, Math.abs(v) / maxAbsM);
      const a = 0.38 + t * 0.52;
      return `rgba(255,68,68,${a})`;
    });
    const callColors = callVals.map((v) => {
      if (v <= 0) return "rgba(0,0,0,0)";
      const t = Math.min(1, Math.abs(v) / maxAbsM);
      const a = 0.38 + t * 0.52;
      return `rgba(0,255,136,${a})`;
    });

    const putText = putVals.map((v) =>
      v < -0.02 ? `${v.toFixed(1)}M` : ""
    );
    const callText = callVals.map((v) =>
      v > 0.02 ? `${v.toFixed(1)}M` : ""
    );

    return {
      plotData: [
        {
          type: "bar" as const,
          name: "PUT GEX",
          orientation: "h" as const,
          x: putVals,
          y: strikes.map(String),
          text: putText,
          textposition: "outside" as const,
          textfont: { color: "#888", size: 8, family: "monospace" },
          marker: { color: putColors },
          hovertemplate: "Strike %{y}<br>Put GEX: %{x:.1f}M<extra></extra>",
        },
        {
          type: "bar" as const,
          name: "CALL GEX",
          orientation: "h" as const,
          x: callVals,
          y: strikes.map(String),
          text: callText,
          textposition: "outside" as const,
          textfont: { color: "#888", size: 8, family: "monospace" },
          marker: { color: callColors },
          hovertemplate: "Strike %{y}<br>Call GEX: %{x:.1f}M<extra></extra>",
        },
      ],
      plotLayout: {
        autosize: true,
        paper_bgcolor: "#0d0d0d",
        plot_bgcolor: "#0d0d0d",
        barmode: "overlay" as const,
        bargap: 0.25,
        font: { color: "#555", family: "monospace", size: 9 },
        xaxis: {
          title: { text: "GEX ($M)", font: { size: 9 } },
          range: [-maxAbsM * 1.15, maxAbsM * 1.15],
          gridcolor: "#171717",
          color: "#555",
          zeroline: true,
          zerolinecolor: "#2a2a2a",
          zerolinewidth: 1,
        },
        yaxis: {
          type: "category" as const,
          gridcolor: "#171717",
          color: "#555",
          tickfont: { size: 8 },
        },
        margin: { l: 52, r: 56, t: 8, b: 32 },
        showlegend: false,
        shapes: [
          {
            type: "line" as const,
            x0: -1e9,
            x1: 1e9,
            y0: String(atmStrike),
            y1: String(atmStrike),
            line: { color: "#ffffff", width: 1, dash: "dot" as const },
          },
        ],
        annotations: [
          {
            x: 0,
            y: String(atmStrike),
            xanchor: "left" as const,
            yanchor: "middle" as const,
            text: `  SPOT $${spotPrice.toFixed(0)}`,
            showarrow: false,
            font: { color: "#f0f0f0", size: 8, family: "monospace" },
          },
        ],
      },
      emptyHint: null,
    };
  }, [heatmap, tab, spotPrice]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-2 p-3">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-sm font-mono font-bold tracking-wider text-[#e8e8e8]">
            Heatmap
          </h2>
          <p className="mt-0.5 font-mono text-[10px] text-[#444]">
            {symbol} · GEX heatmap by strike &amp; expiration
          </p>
          <p className="mt-0.5 max-w-md font-mono text-[9px] leading-snug text-[#555]">
            {tab === "ALL"
              ? "ALL = 2D matrix (square cells = one strike × one expiry)."
              : "Single expiry = ladder bars (put left / call right)."}
          </p>
        </div>
        <div className="flex items-center gap-3 text-[9px] font-mono text-[#444]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-[#00ff88] inline-block" />
            green=call
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-[#ff4444] inline-block" />
            red=put
          </span>
        </div>
      </div>

      {/* Expiry pills */}
      <div className="flex items-center gap-1 shrink-0 flex-wrap">
        <div className="text-[8px] font-mono text-[#333] tracking-wider mr-1 uppercase">
          Expiration Date
        </div>
        <button
          type="button"
          onClick={() => setUserOverride("ALL")}
          className={`rounded border px-2.5 py-1 font-mono text-[9px] transition-colors ${
            userOverride === "ALL"
              ? "border-[#333] bg-[#1e1e1e] text-white"
              : "border-[#1a1a1a] text-[#555] hover:text-[#999]"
          }`}
        >
          ALL
        </button>
        {expTabs.map((iso) => (
          <button
            key={iso}
            type="button"
            onClick={() => setUserOverride(iso)}
            className={`rounded border px-2.5 py-1 font-mono text-[9px] transition-colors ${
              tab === iso
                ? "border-[#333] bg-[#1e1e1e] text-white"
                : "border-[#1a1a1a] text-[#555] hover:text-[#999]"
            }`}
          >
            <div className="font-semibold">{shortExp(iso)}</div>
            <div className="text-[7px] text-[#444]">
              {Math.max(
                0,
                Math.round(
                  (new Date(`${iso}T12:00:00Z`).getTime() - nowMs) /
                    86_400_000
                )
              )}
              d
            </div>
          </button>
        ))}
      </div>

      {/* Chart — min height so Plotly always gets layout pixels inside flex parents */}
      <div className="min-h-[320px] flex-1 overflow-hidden rounded border border-[#1a1a1a] sm:min-h-[380px] lg:min-h-0">
        {heatmap.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6 text-center font-mono text-[11px] text-neutral-600">
            No heatmap cells — check options chain / spot.
          </div>
        ) : emptyHint ? (
          <div className="flex h-full min-h-[240px] items-center justify-center px-6 text-center font-mono text-[11px] leading-relaxed text-neutral-500">
            {emptyHint}
          </div>
        ) : (
          <Plot
            data={plotData as Plotly.Data[]}
            layout={plotLayout as Partial<Plotly.Layout>}
            config={{ displayModeBar: false, responsive: true }}
            useResizeHandler
            style={{ width: "100%", height: "100%", minHeight: 300 }}
          />
        )}
      </div>
    </div>
  );
}
