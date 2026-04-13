"use client";

import { useMemo, useState } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import type { FlowEntry } from "@/lib/gex-engine";

interface Props {
  flow: FlowEntry[];
  spotPrice: number;
}

type SortKey =
  | "type"
  | "strike"
  | "expiry"
  | "volume"
  | "oi"
  | "ratio"
  | "premium"
  | "iv";

export default function FlowTab({ flow, spotPrice }: Props) {
  const [ratioMin, setRatioMin] = useState(0.3);
  const [expiryFilter, setExpiryFilter] = useState<string>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("ratio");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const expiries = useMemo(() => {
    return [...new Set(flow.map((f) => f.expiry))].sort();
  }, [flow]);

  const filtered = useMemo(() => {
    return flow.filter((f) => {
      if (f.ratio < ratioMin) return false;
      if (expiryFilter !== "ALL" && f.expiry !== expiryFilter) return false;
      return true;
    });
  }, [flow, ratioMin, expiryFilter]);

  const sortedTable = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "type") {
        const c = a.type.localeCompare(b.type);
        return dir * c;
      }
      if (sortKey === "expiry") {
        const c = a.expiry.localeCompare(b.expiry);
        return dir * c;
      }
      const na = a[sortKey] as number;
      const nb = b[sortKey] as number;
      return dir * (na - nb);
    });
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "strike" || key === "expiry" || key === "type" ? "asc" : "desc");
    }
  };

  const th = (key: SortKey, label: string, align: "left" | "right" = "left") => (
    <th className={`px-2 py-1.5 ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className={`font-mono text-[#666] hover:text-[#ccc] ${sortKey === key ? "text-[#f5a623]" : ""}`}
      >
        {label}
        {sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );

  const callData = filtered
    .filter((f) => f.type === "call")
    .map((f) => ({
      x: f.strike,
      y: f.ratio,
      z: Math.min(f.premium / 50000, 400),
      ...f,
    }));

  const putData = filtered
    .filter((f) => f.type === "put")
    .map((f) => ({
      x: f.strike,
      y: f.ratio,
      z: Math.min(f.premium / 50000, 400),
      ...f,
    }));

  const xDomain = useMemo((): [number, number] => {
    if (spotPrice > 0) {
      return [spotPrice * 0.92, spotPrice * 1.08];
    }
    const strikes = filtered.map((f) => f.strike);
    if (strikes.length === 0) return [0, 1];
    const mn = Math.min(...strikes);
    const mx = Math.max(...strikes);
    const pad = (mx - mn) * 0.05 || 1;
    return [mn - pad, mx + pad];
  }, [spotPrice, filtered]);

  return (
    <div className="h-full flex flex-col p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3 shrink-0">
        <h2 className="text-sm font-mono font-bold tracking-wider text-[#f0f0f0]">
          UNUSUAL FLOW
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-[#666]">
          <span className="text-[#444]">Vol/OI ≥</span>
          {[0.2, 0.3, 0.5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRatioMin(n)}
              className={`rounded border px-2 py-0.5 transition-colors ${
                ratioMin === n
                  ? "border-[#333] bg-[#1e1e1e] text-[#f5a623]"
                  : "border-[#1a1a1a] text-[#666] hover:text-[#999]"
              }`}
            >
              {n}x
            </button>
          ))}
          <span className="mx-1 text-[#333]">|</span>
          <span className="text-[#444]">Expiry</span>
          <select
            value={expiryFilter}
            onChange={(e) => setExpiryFilter(e.target.value)}
            className="rounded border border-[#222] bg-[#0a0a0a] px-2 py-0.5 text-[10px] text-[#a3a3a3] outline-none"
          >
            <option value="ALL">All</option>
            {expiries.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 min-h-[220px] min-h-0 rounded bg-[#111] border border-[#222] p-1">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
            <XAxis
              type="number"
              dataKey="x"
              name="Strike"
              tick={{ fill: "#666", fontSize: 10, fontFamily: "monospace" }}
              axisLine={{ stroke: "#222" }}
              domain={xDomain}
              allowDataOverflow
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Vol/OI"
              tick={{ fill: "#666", fontSize: 10, fontFamily: "monospace" }}
              axisLine={{ stroke: "#222" }}
              label={{
                value: "Vol / OI",
                angle: -90,
                position: "insideLeft",
                fill: "#666",
                fontSize: 10,
              }}
            />
            <ZAxis type="number" dataKey="z" range={[40, 400]} />
            {spotPrice > 0 && (
              <ReferenceLine
                x={spotPrice}
                stroke="#ffffff"
                strokeDasharray="4 4"
                strokeOpacity={0.45}
              />
            )}
            <Tooltip
              content={({ payload }) => {
                if (!payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-[#111] border border-[#222] rounded p-2 text-[10px] font-mono shadow-xl">
                    <div className="text-[#f0f0f0] font-bold mb-1">
                      {d.strike} {d.type.toUpperCase()} {d.expiry}
                    </div>
                    <div className="text-[#999]">
                      Vol: {d.volume.toLocaleString()} · OI:{" "}
                      {d.oi.toLocaleString()}
                    </div>
                    <div className="text-[#999]">
                      Vol/OI: {d.ratio.toFixed(2)}x · IV:{" "}
                      {(d.iv * 100).toFixed(1)}%
                    </div>
                    <div className="text-[#999]">
                      Premium: ${(d.premium / 1000).toFixed(0)}K
                    </div>
                  </div>
                );
              }}
            />
            <Scatter
              name="Calls"
              data={callData}
              fill="#00ff88"
              opacity={0.6}
            />
            <Scatter
              name="Puts"
              data={putData}
              fill="#ff4444"
              opacity={0.6}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 max-h-48 overflow-auto rounded border border-[#222]">
        <table className="w-full text-[10px] font-mono">
          <thead className="sticky top-0 bg-[#0a0a0a]">
            <tr className="text-[#666]">
              {th("type", "Type")}
              {th("strike", "Strike")}
              {th("expiry", "Expiry")}
              {th("volume", "Volume", "right")}
              {th("oi", "OI", "right")}
              {th("ratio", "Vol/OI", "right")}
              {th("premium", "Premium", "right")}
              {th("iv", "IV", "right")}
            </tr>
          </thead>
          <tbody>
            {sortedTable.slice(0, 40).map((f, i) => (
              <tr
                key={`${f.strike}-${f.expiry}-${f.type}-${i}`}
                className="border-t border-[#222] hover:bg-[#161616]"
              >
                <td className="px-2 py-1">
                  <span
                    className={`px-1 py-0.5 rounded text-[9px] font-bold ${
                      f.type === "call"
                        ? "bg-[#00ff8815] text-[#00ff88]"
                        : "bg-[#ff444415] text-[#ff4444]"
                    }`}
                  >
                    {f.type.toUpperCase()}
                  </span>
                </td>
                <td className="px-2 py-1 text-[#f0f0f0]">{f.strike}</td>
                <td className="px-2 py-1 text-[#666]">{f.expiry}</td>
                <td className="px-2 py-1 text-[#999] text-right">
                  {f.volume.toLocaleString()}
                </td>
                <td className="px-2 py-1 text-[#999] text-right">
                  {f.oi.toLocaleString()}
                </td>
                <td className="px-2 py-1 text-[#f5a623] text-right">
                  {f.ratio.toFixed(2)}x
                </td>
                <td className="px-2 py-1 text-[#999] text-right">
                  ${(f.premium / 1000).toFixed(0)}K
                </td>
                <td className="px-2 py-1 text-[#999] text-right">
                  {(f.iv * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
