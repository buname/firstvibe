"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { OptionContract } from "@/lib/gex-engine";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface Props {
  chain: OptionContract[];
  spotPrice: number;
}

/** Try bands in order until we get enough data; never mutates gex-engine. */
function buildSurface(
  chain: OptionContract[],
  spotPrice: number,
  mountMs: number
): {
  x: number[];
  y: string[];
  z: number[][];
  band: number;
  empty: boolean;
  hint: string;
} {
  const BANDS = [0.06, 0.10, 0.14];

  for (const band of BANDS) {
    const filtered = chain.filter(
      (c) =>
        c.type === "call" &&
        spotPrice > 0 &&
        Math.abs(c.strike - spotPrice) / spotPrice < band
    );

    const expSet = [...new Set(filtered.map((c) => c.expiry))].sort();
    const strikeArr = [...new Set(filtered.map((c) => c.strike))].sort(
      (a, b) => a - b
    );

    if (expSet.length < 2 || strikeArr.length < 3) continue;

    const everyN = Math.max(1, Math.floor(strikeArr.length / 30));
    const displayStrikes = strikeArr.filter((_, i) => i % everyN === 0);

    const dataMap = new Map<string, number>();
    for (const c of filtered) {
      const gex = c.oi * c.gamma * 100 * spotPrice * spotPrice * 0.01;
      dataMap.set(`${c.strike}|${c.expiry}`, gex / 1e6);
    }

    const z: number[][] = expSet.map((exp) =>
      displayStrikes.map((s) => dataMap.get(`${s}|${exp}`) ?? 0)
    );

    // DTE labels — use mountMs so we never call Date.now() in render
    const y = expSet.map((e) => {
      const days = Math.max(
        0,
        Math.round(
          (new Date(`${e}T12:00:00Z`).getTime() - mountMs) / 86_400_000
        )
      );
      return `${days}d`;
    });

    return { x: displayStrikes, y, z, band, empty: false, hint: "" };
  }

  return {
    x: [],
    y: [],
    z: [],
    band: 0,
    empty: true,
    hint:
      spotPrice <= 0
        ? "Spot price unavailable — surface cannot render."
        : "Not enough call strikes in any band (±6 / ±10 / ±14%). Check data source.",
  };
}

const COLORSCALE: [number, string][] = [
  [0,    "#ff4444"],
  [0.15, "#cc1133"],
  [0.30, "#440011"],
  [0.45, "#1a0308"],
  [0.50, "#0a0a0a"],
  [0.55, "#001a0a"],
  [0.70, "#006633"],
  [0.85, "#00cc77"],
  [1,    "#00ff88"],
];

export default function SurfaceTab({ chain, spotPrice }: Props) {
  // Mount anchor — no Date.now() in render; advance base each minute via tick.
  const [mountMs] = useState(() => Date.now());
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  const clockBase = mountMs + tick * 60_000;

  const { x, y, z, band, empty, hint } = useMemo(
    () => buildSurface(chain, spotPrice, clockBase),
    [chain, spotPrice, clockBase]
  );

  return (
    <div className="h-full flex flex-col p-3 gap-2">
      {/* Header */}
      <div className="shrink-0 flex items-start justify-between">
        <div>
          <h2 className="text-sm font-mono font-bold tracking-wider text-[#e8e8e8]">
            3D Gamma Surface
          </h2>
          <p className="text-[10px] font-mono text-[#444] mt-0.5 tracking-wider">
            call GEX · strike × DTE · $M
            {!empty && band > 0.06 && (
              <span className="ml-2 text-[#f5a623]">
                ±{Math.round(band * 100)}% band
              </span>
            )}
          </p>
        </div>
        {/* Mini legend */}
        <div className="flex items-center gap-3 text-[9px] font-mono text-[#444]">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm bg-[#00ff88]" />
            high GEX
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm bg-[#ff4444]" />
            low / neg
          </span>
        </div>
      </div>

      {/* Chart or empty state */}
      <div className="flex-1 min-h-[320px] rounded border border-[#1a1a1a] overflow-hidden">
        {empty ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-6">
            <div className="text-[10px] font-mono text-[#444]">{hint}</div>
            <div className="text-[9px] font-mono text-[#2a2a2a]">
              Try switching symbol or waiting for data refresh.
            </div>
          </div>
        ) : (
          <Plot
            data={[
              {
                type: "surface",
                x,
                y,
                z,
                colorscale: COLORSCALE,
                showscale: true,
                colorbar: {
                  title: { text: "GEX $M", font: { color: "#555", size: 9 } },
                  tickfont: { color: "#555", size: 9 },
                  bgcolor: "transparent",
                  bordercolor: "#1a1a1a",
                  thickness: 10,
                  len: 0.7,
                },
                contours: {
                  z: {
                    show: true,
                    usecolormap: true,
                    highlightcolor: "#ffffff",
                    project: { z: true },
                  },
                },
                hovertemplate:
                  "Strike: %{x}<br>DTE: %{y}<br>GEX: %{z:.2f}M$<extra></extra>",
              } as Plotly.Data,
            ]}
            layout={{
              autosize: true,
              paper_bgcolor: "#0d0d0d",
              plot_bgcolor: "#0d0d0d",
              font: { color: "#555", family: "monospace", size: 9 },
              scene: {
                xaxis: {
                  title: { text: "Strike", font: { size: 9 } },
                  gridcolor: "#1e1e1e",
                  zerolinecolor: "#1e1e1e",
                  color: "#555",
                  backgroundcolor: "#0d0d0d",
                },
                yaxis: {
                  title: { text: "DTE", font: { size: 9 } },
                  gridcolor: "#1e1e1e",
                  zerolinecolor: "#1e1e1e",
                  color: "#555",
                  backgroundcolor: "#0d0d0d",
                },
                zaxis: {
                  title: { text: "GEX $M", font: { size: 9 } },
                  gridcolor: "#1e1e1e",
                  zerolinecolor: "#1e1e1e",
                  color: "#555",
                  backgroundcolor: "#0d0d0d",
                },
                bgcolor: "#0d0d0d",
                camera: { eye: { x: 1.5, y: -1.5, z: 0.8 } },
              },
              margin: { l: 0, r: 0, t: 0, b: 0 },
            }}
            config={{
              displayModeBar: false,
            }}
            useResizeHandler
            style={{ width: "100%", height: "100%" }}
          />
        )}
      </div>

      <div className="shrink-0 text-[9px] font-mono text-[#2a2a2a]">
        Call side only · dealer long gamma = positive GEX · GEX formula: γ × OI × 100 × S² × 0.01
      </div>
    </div>
  );
}
