"use client";

import { useEffect, useMemo, useState } from "react";
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
  | "strikePct"
  | "type"
  | "strike"
  | "expiry"
  | "volume"
  | "oi"
  | "ratio"
  | "mid"
  | "premium"
  | "iv";

type SideFilter = "all" | "call" | "put";
type ExpiryBucket = "ALL" | "WEEKLY" | "MONTHLY" | "QUARTERLY";

interface EnrichedFlow extends FlowEntry {
  strikePct: number;
  expiryShort: string;
  expiryBucket: ExpiryBucket;
  mid: number;
  premiumPerContract: number;
}

const FLOW_PREFS_KEY = "bex-flow-prefs";

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${Math.round(value)}`;
}

function formatPremium(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${Math.round(value)}`;
}

function bucketExpiry(iso: string): ExpiryBucket {
  const now = new Date();
  const d = new Date(`${iso}T12:00:00`);
  const diffDays = Math.max(
    0,
    Math.ceil((d.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
  );
  if (diffDays <= 9) return "WEEKLY";
  if (diffDays <= 40) return "MONTHLY";
  return "QUARTERLY";
}

function BubbleShape(props: {
  cx?: number;
  cy?: number;
  fill?: string;
  payload?: { strike: number };
  size?: number;
}) {
  const cx = props.cx ?? 0;
  const cy = props.cy ?? 0;
  const size = props.size ?? 60;
  const r = Math.max(7, Math.min(28, Math.sqrt(size)));
  const label = props.payload?.strike ? `$${Math.round(props.payload.strike)}` : "";

  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={props.fill} fillOpacity={0.64} stroke="rgba(0,0,0,0.45)" />
      {r >= 12 && (
        <text
          x={cx}
          y={cy + 3}
          textAnchor="middle"
          fontSize={9}
          fontFamily="monospace"
          fill="#e4e4e7"
        >
          {label}
        </text>
      )}
    </g>
  );
}

export default function FlowTab({ flow, spotPrice }: Props) {
  const [ratioMin, setRatioMin] = useState(0.3);
  const [expiryFilter, setExpiryFilter] = useState<ExpiryBucket>("ALL");
  const [sideFilter, setSideFilter] = useState<SideFilter>("all");
  const [strikeSearch, setStrikeSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("ratio");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FLOW_PREFS_KEY);
      if (!raw) return;
      const v = JSON.parse(raw) as {
        ratioMin?: number;
        expiryFilter?: ExpiryBucket;
        sideFilter?: SideFilter;
      };
      if (typeof v.ratioMin === "number") setRatioMin(v.ratioMin);
      if (v.expiryFilter) setExpiryFilter(v.expiryFilter);
      if (v.sideFilter) setSideFilter(v.sideFilter);
    } catch {
      // ignore bad prefs
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      FLOW_PREFS_KEY,
      JSON.stringify({ ratioMin, expiryFilter, sideFilter })
    );
  }, [ratioMin, expiryFilter, sideFilter]);

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const rows = useMemo<EnrichedFlow[]>(() => {
    return flow.map((f) => {
      const strikePct =
        spotPrice > 0 ? ((f.strike - spotPrice) / spotPrice) * 100 : 0;
      const expiryDate = new Date(`${f.expiry}T12:00:00`);
      const expiryShort = Number.isNaN(expiryDate.getTime())
        ? f.expiry
        : `${String(expiryDate.getMonth() + 1).padStart(2, "0")}-${String(
            expiryDate.getDate()
          ).padStart(2, "0")}`;
      const premiumPerContract = f.volume > 0 ? f.premium / f.volume : 0;
      const mid = premiumPerContract / 100;
      return {
        ...f,
        strikePct,
        expiryShort,
        expiryBucket: bucketExpiry(f.expiry),
        premiumPerContract,
        mid,
      };
    });
  }, [flow, spotPrice]);

  const filtered = useMemo(() => {
    const search = strikeSearch.trim();
    return rows.filter((f) => {
      if (f.ratio < ratioMin) return false;
      if (expiryFilter !== "ALL" && f.expiryBucket !== expiryFilter) return false;
      if (sideFilter !== "all" && f.type !== sideFilter) return false;
      if (search.length > 0 && !String(f.strike).includes(search)) return false;
      return true;
    });
  }, [rows, ratioMin, expiryFilter, sideFilter, strikeSearch]);

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
      setSortDir(
        key === "strike" ||
          key === "expiry" ||
          key === "type" ||
          key === "strikePct"
          ? "asc"
          : "desc"
      );
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

  const chartRows = useMemo(() => sortedTable.slice(0, 100), [sortedTable]);
  const callData = chartRows
    .filter((f) => f.type === "call")
    .map((f) => ({
      x: f.strike,
      y: f.ratio,
      z: Math.min(Math.max(f.premium / 30000, 20), 720),
      key: `${f.strike}-${f.expiry}-${f.type}`,
      ...f,
    }));

  const putData = chartRows
    .filter((f) => f.type === "put")
    .map((f) => ({
      x: f.strike,
      y: f.ratio,
      z: Math.min(Math.max(f.premium / 30000, 20), 720),
      key: `${f.strike}-${f.expiry}-${f.type}`,
      ...f,
    }));

  const xDomain = useMemo((): [number, number] => {
    if (spotPrice > 0) {
      return [spotPrice * 0.92, spotPrice * 1.08];
    }
    const strikes = chartRows.map((f) => f.strike);
    if (strikes.length === 0) return [0, 1];
    const mn = Math.min(...strikes);
    const mx = Math.max(...strikes);
    const pad = (mx - mn) * 0.05 || 1;
    return [mn - pad, mx + pad];
  }, [spotPrice, chartRows]);

  const yDomain = useMemo((): [number, number] => {
    const maxRatio = Math.max(1, ...chartRows.map((f) => f.ratio));
    return [0, Math.ceil(maxRatio * 10) / 10];
  }, [chartRows]);

  const lastUpdateEt = clock.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/New_York",
  });

  return (
    <div className="h-full flex flex-col p-3">
      <div className="mb-3 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-mono font-bold tracking-wider text-[#e4e4e7]">
              UNUSUAL FLOW
            </h2>
            <p className="text-[10px] font-mono text-[#666] mt-0.5">
              High Vol/OI options prints with premium concentration
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded border border-white/10 bg-[#0f0f12] px-2 py-1 text-[10px] font-mono">
              <span className="inline-flex items-center gap-1 text-[#22c55e]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
                LIVE
              </span>
              <span className="ml-2 text-[#71717a]">ET {lastUpdateEt}</span>
            </div>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-mono">
          <span className="text-[#555]">Vol/OI</span>
          {[0.2, 0.3, 0.5, 1].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRatioMin(n)}
              className={`rounded border px-2 py-0.5 transition-colors ${
                ratioMin === n
                  ? "border-[#3a3a3f] bg-[#1a1a1f] text-[#e4e4e7]"
                  : "border-white/[0.06] text-[#666] hover:text-[#999]"
              }`}
            >
              {n}x
            </button>
          ))}

          <span className="mx-1 text-[#333]">|</span>
          <span className="text-[#555]">Expiry</span>
          <select
            value={expiryFilter}
            onChange={(e) => setExpiryFilter(e.target.value as ExpiryBucket)}
            className="rounded border border-white/[0.06] bg-[#0a0a0d] px-2 py-0.5 text-[10px] text-[#a3a3a3] outline-none"
          >
            <option value="ALL">All</option>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
          </select>

          <span className="mx-1 text-[#333]">|</span>
          <div className="inline-flex rounded border border-white/[0.06] overflow-hidden">
            {[
              { id: "all", label: "All" },
              { id: "call", label: "Calls" },
              { id: "put", label: "Puts" },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSideFilter(opt.id as SideFilter)}
                className={`px-2 py-0.5 ${
                  sideFilter === opt.id
                    ? "bg-[#1a1a1f] text-[#e4e4e7]"
                    : "text-[#666] hover:text-[#999]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <span className="mx-1 text-[#333]">|</span>
          <input
            value={strikeSearch}
            onChange={(e) => setStrikeSearch(e.target.value)}
            placeholder="Search strike"
            className="w-24 rounded border border-white/[0.06] bg-[#0a0a0d] px-2 py-0.5 text-[10px] text-[#d4d4d8] outline-none"
          />
          <button
            type="button"
            onClick={() => {
              setRatioMin(0.3);
              setExpiryFilter("ALL");
              setSideFilter("all");
              setStrikeSearch("");
            }}
            className="rounded border border-white/[0.06] px-2 py-0.5 text-[#777] hover:text-[#bbb]"
          >
            Reset Filters
          </button>

          <div className="ml-auto inline-flex items-center gap-3">
            <button className="inline-flex items-center gap-1 text-[#16a34a]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#16a34a]" />
              Call
            </button>
            <button className="inline-flex items-center gap-1 text-[#dc2626]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#dc2626]" />
              Put
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-[240px] min-h-0 rounded bg-[#0d0d0f] border border-white/[0.06] p-2">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 18, right: 24, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              type="number"
              dataKey="x"
              name="Strike"
              tick={{ fill: "#71717a", fontSize: 10, fontFamily: "monospace" }}
              axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
              domain={xDomain}
              allowDataOverflow
              tickFormatter={(v) => `$${Math.round(v)}`}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Vol/OI"
              tick={{ fill: "#71717a", fontSize: 10, fontFamily: "monospace" }}
              axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
              domain={yDomain}
              tickFormatter={(v) => `${Number(v).toFixed(1)}x`}
              label={{
                value: "Vol / OI",
                angle: -90,
                position: "insideLeft",
                fill: "#71717a",
                fontSize: 10,
              }}
            />
            <ZAxis type="number" dataKey="z" range={[36, 760]} />
            {spotPrice > 0 && (
              <ReferenceLine
                x={spotPrice}
                stroke="#d4d4d8"
                strokeDasharray="4 4"
                strokeOpacity={0.6}
                label={{
                  value: "Spot",
                  position: "insideTopRight",
                  fill: "#a1a1aa",
                  fontSize: 10,
                }}
              />
            )}
            <Tooltip
              cursor={false}
              wrapperStyle={{ outline: "none" }}
              content={({ payload }) => {
                if (!payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-[#0f0f12] border border-white/[0.08] rounded p-2 text-[10px] font-mono shadow-xl">
                    <div className="text-[#e4e4e7] font-bold mb-1">
                      {d.strike} {d.type.toUpperCase()} {d.expiry}
                    </div>
                    <div className="text-[#a1a1aa]">
                      Vol: {d.volume.toLocaleString()} · OI:{" "}
                      {d.oi.toLocaleString()}
                    </div>
                    <div className="text-[#a1a1aa]">
                      Vol/OI: {d.ratio.toFixed(2)}x · IV:{" "}
                      {(d.iv * 100).toFixed(1)}%
                    </div>
                    <div className="text-[#a1a1aa]">
                      Premium: {formatPremium(d.premium)}
                    </div>
                  </div>
                );
              }}
            />
            <Scatter
              name="Calls"
              data={callData}
              fill="#16a34a"
              shape={<BubbleShape />}
              onClick={(d) => setSelectedKey((d as unknown as { key: string }).key)}
            />
            <Scatter
              name="Puts"
              data={putData}
              fill="#dc2626"
              shape={<BubbleShape />}
              onClick={(d) => setSelectedKey((d as unknown as { key: string }).key)}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 max-h-[280px] overflow-auto rounded border border-white/[0.06]">
        <table className="w-full text-[11px] font-mono">
          <thead className="sticky top-0 bg-[#09090b]">
            <tr className="text-[#71717a] uppercase text-[9px] tracking-[0.08em]">
              {th("strike", "Strike")}
              {th("strikePct", "%", "right")}
              {th("type", "Type")}
              {th("expiry", "Expiry")}
              {th("volume", "Vol", "right")}
              {th("oi", "OI", "right")}
              {th("ratio", "Vol/OI", "right")}
              {th("mid", "Mid", "right")}
              {th("premium", "Premium", "right")}
              {th("iv", "IV", "right")}
            </tr>
          </thead>
          <tbody>
            {sortedTable.slice(0, 120).map((f, i) => {
              const rowKey = `${f.strike}-${f.expiry}-${f.type}`;
              const isSelected = selectedKey === rowKey;
              return (
              <tr
                key={`${rowKey}-${i}`}
                className={`border-t border-white/[0.05] hover:bg-[#141418] ${isSelected ? "bg-[#181820]" : ""}`}
              >
                <td className="px-2 py-3 text-[#e4e4e7]">{f.strike}</td>
                <td
                  className={`px-2 py-3 text-right ${
                    f.strikePct >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"
                  }`}
                >
                  {f.strikePct >= 0 ? "+" : ""}
                  {f.strikePct.toFixed(1)}%
                </td>
                <td className="px-2 py-3">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                      f.type === "call"
                        ? "bg-[#16a34a1c] text-[#16a34a] border-[#16a34a50]"
                        : "bg-[#dc26261c] text-[#dc2626] border-[#dc262650]"
                    }`}
                  >
                    {f.type.toUpperCase()}
                  </span>
                </td>
                <td className="px-2 py-3 text-[#a1a1aa]">{f.expiryShort}</td>
                <td className="px-2 py-3 text-[#a1a1aa] text-right">
                  {formatCompact(f.volume)}
                </td>
                <td className="px-2 py-3 text-[#a1a1aa] text-right">
                  {formatCompact(f.oi)}
                </td>
                <td
                  className={`px-2 py-3 text-right ${
                    f.ratio >= 10 ? "text-[#ea580c]" : "text-[#d4d4d8]"
                  }`}
                >
                  {f.ratio.toFixed(2)}x
                </td>
                <td className="px-2 py-3 text-[#a1a1aa] text-right">
                  ${f.mid.toFixed(2)}
                </td>
                <td className="px-2 py-3 text-[#a1a1aa] text-right">
                  {formatPremium(f.premium)}
                </td>
                <td className="px-2 py-3 text-[#a1a1aa] text-right">
                  {(f.iv * 100).toFixed(1)}%
                </td>
              </tr>
            );
            })}
            {sortedTable.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-[#666] text-[11px]">
                  No unusual flow matches current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
