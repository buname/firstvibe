"use client";

import { useMemo, useRef, useState } from "react";
import { Download, Copy, Maximize2, Minimize2 } from "lucide-react";
import type { OptionContract } from "@/lib/gex-engine";
import { useElementFullscreen } from "@/hooks/useElementFullscreen";

// Black-Scholes helpers for Charm
const R = 0.043;
function normpdf(x: number) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}
function charmForStrike(
  opts: OptionContract[],
  spot: number
): number {
  let total = 0;
  for (const opt of opts) {
    if (opt.oi < 50) continue;
    const days = Math.max(
      1,
      (new Date(opt.expiry).getTime() - Date.now()) / 86_400_000
    );
    const T = days / 365;
    const sig = Math.max(0.01, Math.min(opt.iv, 1.5));
    const sqrtT = Math.sqrt(T);
    const d1 =
      (Math.log(spot / opt.strike) + (R + (sig * sig) / 2) * T) /
      (sig * sqrtT);
    const d2 = d1 - sig * sqrtT;
    const nd1 = normpdf(d1);
    const c =
      (-nd1 * (2 * R * T - d2 * sig * sqrtT)) /
      (2 * T * sig * sqrtT);
    const sign = opt.type === "call" ? 1 : -1;
    total += sign * c * opt.oi * 100 * 0.01;
  }
  return total;
}

interface Props {
  chain: OptionContract[];
  spotPrice: number;
}

interface StrikeRow {
  strike: number;
  distPct: number;
  netGEX: number;
  callGEX: number;
  putGEX: number;
  callOI: number;
  putOI: number;
  totalOI: number;
  avgIV: number;
  avgGamma: number;
  charm: number;
}

type SortKey = keyof StrikeRow;

function shortExp(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  if (isNaN(d.getTime())) return iso.slice(5);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function StrikeTableTab({ chain, spotPrice }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { isFullscreen, toggleFullscreen } = useElementFullscreen(rootRef);
  const expiries = useMemo(() => {
    return [...new Set(chain.map((o) => o.expiry))].sort().slice(0, 6);
  }, [chain]);

  const [activeExp, setActiveExp] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("strike");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filtered = useMemo(
    () => (activeExp ? chain.filter((o) => o.expiry === activeExp) : chain),
    [chain, activeExp]
  );

  const rows = useMemo<StrikeRow[]>(() => {
    const byStrike = new Map<
      number,
      {
        callOpts: OptionContract[];
        putOpts: OptionContract[];
        callGEX: number;
        putGEX: number;
        callOI: number;
        putOI: number;
        ivSum: number;
        ivCount: number;
        gammaSum: number;
        gammaCount: number;
      }
    >();

    for (const opt of filtered) {
      if (Math.abs(opt.strike - spotPrice) / spotPrice > 0.08) continue;
      const acc = byStrike.get(opt.strike) ?? {
        callOpts: [],
        putOpts: [],
        callGEX: 0,
        putGEX: 0,
        callOI: 0,
        putOI: 0,
        ivSum: 0,
        ivCount: 0,
        gammaSum: 0,
        gammaCount: 0,
      };
      const gex = opt.gamma * opt.oi * 100 * spotPrice * spotPrice * 0.01;
      if (opt.type === "call") {
        acc.callOpts.push(opt);
        acc.callGEX += gex;
        acc.callOI += opt.oi;
      } else {
        acc.putOpts.push(opt);
        acc.putGEX -= gex;
        acc.putOI += opt.oi;
      }
      if (opt.oi > 0) {
        acc.ivSum += opt.iv * opt.oi;
        acc.ivCount += opt.oi;
        acc.gammaSum += opt.gamma * opt.oi;
        acc.gammaCount += opt.oi;
      }
      byStrike.set(opt.strike, acc);
    }

    return Array.from(byStrike.entries()).map(([strike, d]) => {
      const allOpts = [...d.callOpts, ...d.putOpts];
      return {
        strike,
        distPct: ((strike - spotPrice) / spotPrice) * 100,
        netGEX: d.callGEX + d.putGEX,
        callGEX: d.callGEX,
        putGEX: d.putGEX,
        callOI: d.callOI,
        putOI: d.putOI,
        totalOI: d.callOI + d.putOI,
        avgIV: d.ivCount > 0 ? (d.ivSum / d.ivCount) * 100 : 0,
        avgGamma: d.gammaCount > 0 ? d.gammaSum / d.gammaCount : 0,
        charm: charmForStrike(allOpts, spotPrice),
      };
    });
  }, [filtered, spotPrice]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sortKey] as number;
      const bv = b[sortKey] as number;
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [rows, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  function fmtGex(n: number) {
    const abs = Math.abs(n);
    const s = n >= 0 ? "+" : "";
    if (abs >= 1e6) return `${s}${(n / 1e6).toFixed(0)}K`;
    if (abs >= 1000) return `${s}${(n / 1000).toFixed(0)}`;
    return `${s}${n.toFixed(0)}`;
  }

  function fmtOI(n: number) {
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
    return `${n}`;
  }

  const columns: { key: SortKey; label: string; align: "left" | "right" | "center" }[] = [
    { key: "strike",   label: "STRIKE",    align: "left" },
    { key: "distPct",  label: "DIST %",    align: "right" },
    { key: "netGEX",   label: "NET GEX",   align: "right" },
    { key: "callGEX",  label: "CALL GEX",  align: "right" },
    { key: "putGEX",   label: "PUT GEX",   align: "right" },
    { key: "callOI",   label: "CALL OI",   align: "right" },
    { key: "putOI",    label: "PUT OI",    align: "right" },
    { key: "totalOI",  label: "TOTAL OI",  align: "right" },
    { key: "avgIV",    label: "IV",        align: "right" },
    { key: "avgGamma", label: "GAMMA",     align: "right" },
    { key: "charm",    label: "CHARM",     align: "right" },
  ];

  const atmStrike = rows.reduce(
    (best, r) =>
      Math.abs(r.strike - spotPrice) < Math.abs(best - spotPrice) ? r.strike : best,
    rows[0]?.strike ?? spotPrice
  );

  function copyCSV() {
    const header = columns.map((c) => c.label).join(",");
    const body = sorted
      .map((r) =>
        [
          r.strike, r.distPct.toFixed(2), r.netGEX, r.callGEX, r.putGEX,
          r.callOI, r.putOI, r.totalOI, r.avgIV.toFixed(1), r.avgGamma.toFixed(4), r.charm.toFixed(3),
        ].join(",")
      )
      .join("\n");
    navigator.clipboard.writeText(`${header}\n${body}`).catch(() => {});
  }

  return (
    <div ref={rootRef} className="h-full flex flex-col p-3 gap-2 bg-black">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-sm font-mono font-bold tracking-wider text-[#e8e8e8]">
            Strike Table
          </h2>
          <p className="text-[10px] font-mono text-[#444] mt-0.5">
            SPY · {activeExp ? `1 EXP` : "All Exp"} · options chain by strike
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="flex items-center gap-1 px-2 py-1 rounded border border-[#1e1e1e] text-[#555] hover:text-[#999] text-[9px] font-mono transition-colors"
          >
            {isFullscreen ? (
              <Minimize2 className="w-3 h-3" />
            ) : (
              <Maximize2 className="w-3 h-3" />
            )}
            {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </button>
          <button
            onClick={copyCSV}
            className="flex items-center gap-1 px-2 py-1 rounded border border-[#1e1e1e] text-[#555] hover:text-[#999] text-[9px] font-mono transition-colors"
          >
            <Copy className="w-3 h-3" /> Copy CSV
          </button>
          <button
            className="flex items-center gap-1 px-2 py-1 rounded border border-[#1e1e1e] text-[#555] hover:text-[#999] text-[9px] font-mono transition-colors"
          >
            <Download className="w-3 h-3" /> Download
          </button>
        </div>
      </div>

      {/* Expiry tabs */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => setActiveExp(null)}
          className={`px-2.5 py-1 rounded text-[9px] font-mono border transition-colors ${
            activeExp === null
              ? "bg-[#1e1e1e] text-white border-[#333]"
              : "border-[#1a1a1a] text-[#555] hover:text-[#999]"
          }`}
        >
          All Exp
        </button>
        {expiries.map((exp) => (
          <button
            key={exp}
            onClick={() => setActiveExp(exp)}
            className={`px-2.5 py-1 rounded text-[9px] font-mono border transition-colors ${
              activeExp === exp
                ? "bg-[#1e1e1e] text-white border-[#333]"
                : "border-[#1a1a1a] text-[#555] hover:text-[#999]"
            }`}
          >
            {shortExp(exp)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto min-h-0 rounded border border-[#1a1a1a]">
        <table className="w-full text-[9px] font-mono">
          <thead className="sticky top-0 z-10" style={{ background: "#0a0a0a" }}>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className={`px-2 py-2 font-bold tracking-wider text-[#444] cursor-pointer hover:text-[#888] transition-colors select-none whitespace-nowrap text-${col.align}`}
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span className="ml-0.5 text-[#666]">
                      {sortDir === "asc" ? "▲" : "▼"}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const isATM = r.strike === atmStrike;
              return (
                <tr
                  key={r.strike}
                  className={`border-t border-[#111] hover:bg-[#111] transition-colors ${
                    isATM ? "bg-[#0f0f0f]" : ""
                  }`}
                >
                  {/* STRIKE */}
                  <td className={`px-2 py-1.5 font-bold ${isATM ? "text-[#00e87a]" : "text-[#ddd]"}`}>
                    {r.strike}
                    {isATM && <span className="ml-1 text-[7px] text-[#00e87a]">ATM</span>}
                  </td>
                  {/* DIST% */}
                  <td className={`px-2 py-1.5 text-right ${r.distPct > 0 ? "text-[#00e87a]" : r.distPct < 0 ? "text-[#ff4455]" : "text-[#888]"}`}>
                    {r.distPct >= 0 ? "+" : ""}{r.distPct.toFixed(2)}%
                  </td>
                  {/* NET GEX */}
                  <td className={`px-2 py-1.5 text-right font-semibold ${r.netGEX >= 0 ? "text-[#00e87a]" : "text-[#ff4455]"}`}>
                    {fmtGex(r.netGEX)}
                  </td>
                  {/* CALL GEX */}
                  <td className="px-2 py-1.5 text-right text-[#00e87a]">
                    {fmtGex(r.callGEX)}
                  </td>
                  {/* PUT GEX */}
                  <td className="px-2 py-1.5 text-right text-[#ff4455]">
                    {fmtGex(r.putGEX)}
                  </td>
                  {/* CALL OI */}
                  <td className="px-2 py-1.5 text-right text-[#777]">
                    {fmtOI(r.callOI)}
                  </td>
                  {/* PUT OI */}
                  <td className="px-2 py-1.5 text-right text-[#777]">
                    {fmtOI(r.putOI)}
                  </td>
                  {/* TOTAL OI */}
                  <td className="px-2 py-1.5 text-right text-[#666]">
                    {fmtOI(r.totalOI)}
                  </td>
                  {/* IV */}
                  <td className="px-2 py-1.5 text-right text-[#8b5cf6]">
                    {r.avgIV.toFixed(1)}%
                  </td>
                  {/* GAMMA */}
                  <td className={`px-2 py-1.5 text-right ${r.avgGamma >= 0 ? "text-[#00e87a]" : "text-[#ff4455]"}`}>
                    {r.avgGamma >= 0 ? "+" : ""}{r.avgGamma.toFixed(3)}
                  </td>
                  {/* CHARM */}
                  <td className={`px-2 py-1.5 text-right ${r.charm >= 0 ? "text-[#f97316]" : "text-[#818cf8]"}`}>
                    {r.charm >= 0 ? "+" : ""}{r.charm.toFixed(3)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
