"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useResilientFetch } from "@/hooks/useResilientFetch";
import StatusBadge from "@/components/dashboard/StatusBadge";

interface Squeeze {
  gexBillions: number;
  gexPrevBillions: number;
  gexMa5Billions: number;
  dixPct: number;
  date: string;
}

interface ScanRow {
  ticker: string;
  spot: number;
  totalNetGexBillions: number;
  gammaFlip: number;
  callWall: number;
  putWall: number;
  maxPain: number;
  volTrigger: number;
  pcr: number;
  nearCallWall: boolean;
  nearPutWall: boolean;
  nearGammaFlip: boolean;
}

const INDEX_TICKERS = ["SPX", "NDX"] as const;
const SNAPSHOT_KEY = "bex-gexscan-last-good";

type ScanPayload = {
  squeeze: Squeeze | null;
  rows: ScanRow[];
  errors: Array<{ ticker: string; message: string }>;
};

export default function GexScanTab() {
  const [days, setDays] = useState(60);
  const [rangePct, setRangePct] = useState(15);
  const [loading, setLoading] = useState(false);
  const [squeeze, setSqueeze] = useState<Squeeze | null>(null);
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [errors, setErrors] = useState<Array<{ ticker: string; message: string }>>(
    []
  );
  const requestTickers = useMemo(
    () => [...INDEX_TICKERS],
    []
  );

  const resilient = useResilientFetch<ScanPayload>({
    snapshotKey: SNAPSHOT_KEY,
    isDegraded: (d) =>
      d.errors.length > 0 ||
      (requestTickers.length > 0 && d.rows.length < requestTickers.length),
  });

  const run = async () => {
    setLoading(true);
    setErrors([]);
    toast.loading("Running GEX scan...", { id: "gexscan-run" });
    const result = await resilient.run(async () => {
      const q = new URLSearchParams({
        tickers: requestTickers.join(","),
        days: String(days),
        rangePct: String(rangePct),
      });
      const res = await fetch(`/api/gex-scan?${q}`);
      if (!res.ok) throw new Error(`Scan failed (${res.status})`);
      const data = await res.json();
      return {
        squeeze: data.squeeze ?? null,
        rows: data.rows ?? [],
        errors: data.errors ?? [],
      } as ScanPayload;
    });
    if (result.data) {
      setSqueeze(result.data.squeeze);
      setRows(result.data.rows);
      setErrors(result.data.errors);
    }
    if (result.status === "stale") {
      toast.warning("Scan request failed — using last snapshot", {
        id: "gexscan-run",
      });
    } else if (result.status === "degraded") {
      toast.success("GEX scan completed in degraded mode", { id: "gexscan-run" });
    } else if (result.status === "live") {
      toast.success("GEX scan completed", { id: "gexscan-run" });
    } else {
      setRows([]);
      setSqueeze(null);
      setErrors([{ ticker: "-", message: resilient.error ?? "Request failed" }]);
      toast.error("Scan request failed", { id: "gexscan-run" });
    }
    setLoading(false);
  };

  return (
    <div className="p-4 max-w-6xl mx-auto text-[11px] font-mono text-[#e5e5e5] space-y-4">
      <div>
        <h1 className="text-sm font-semibold tracking-wide text-white">
          GEX market scan
        </h1>
        <p className="text-[#737373] mt-1">
          Dual-index gamma scan + SqueezeMetrics DIX (ported from legacy
          Streamlit flow). Uses Yahoo chains and the same GEX engine as
          Exposures.
        </p>
        <div className="mt-2">
          <StatusBadge
            status={resilient.status}
            updatedAt={resilient.updatedAt}
            onRetry={() => void run()}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border border-[#1f1f1f] rounded-md p-3 bg-[#0a0a0a]">
        <div className="md:col-span-2 flex flex-col gap-2">
          <span className="text-[#737373]">Active index set</span>
          <div className="flex items-center gap-2">
            {INDEX_TICKERS.map((ticker) => (
              <span
                key={ticker}
                className="rounded border border-white/[0.08] bg-[#111] px-2.5 py-1 text-[10px] text-white"
              >
                {ticker}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[#737373]">Max DTE (days)</span>
            <input
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(Number(e.target.value) || 60)}
              className="bg-black border border-[#262626] rounded px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[#737373]">Strike band (% of spot)</span>
            <input
              type="number"
              min={5}
              max={50}
              value={rangePct}
              onChange={(e) => setRangePct(Number(e.target.value) || 15)}
              className="bg-black border border-[#262626] rounded px-2 py-1"
            />
          </label>
        </div>
        <div className="md:col-span-3 flex justify-end">
          <button
            type="button"
            onClick={run}
            disabled={loading}
            className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-black font-semibold text-xs"
          >
            {loading ? "Scanning…" : "Run scan"}
          </button>
        </div>
      </div>

      {squeeze && (
        <div className="border border-[#1f1f1f] rounded-md p-3 bg-[#0a0a0a]">
          <h2 className="text-xs font-semibold text-white mb-2">
            Index context (SqueezeMetrics)
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>
              <div className="text-[#737373]">Index GEX (B)</div>
              <div
                className={
                  squeeze.gexBillions >= 0 ? "text-emerald-400" : "text-red-400"
                }
              >
                {squeeze.gexBillions.toFixed(2)}
              </div>
              <div className="text-[#525252]">
                Δ {(squeeze.gexBillions - squeeze.gexPrevBillions).toFixed(2)} B
              </div>
            </div>
            <div>
              <div className="text-[#737373]">GEX 5d avg (B)</div>
              <div>{squeeze.gexMa5Billions.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[#737373]">DIX</div>
              <div>{squeeze.dixPct.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-[#737373]">As of</div>
              <div className="text-[#a3a3a3]">{squeeze.date || "—"}</div>
            </div>
          </div>
          <p className="text-[#525252] mt-2">
            {squeeze.gexBillions > 0
              ? "Positive broad GEX — often associated with calmer tape (not advice)."
              : "Negative broad GEX — often associated with higher vol regimes (not advice)."}
          </p>
        </div>
      )}

      {errors.length > 0 && (
        <div className="text-amber-500/90 text-[11px]">
          {errors.map((e) => (
            <div key={e.ticker + e.message}>
              {e.ticker}: {e.message}
            </div>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <div className="border border-[#1f1f1f] rounded-md overflow-hidden">
          <div className="px-3 py-2 bg-[#111] text-xs text-white font-semibold">
            SPX/NDX summary
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[10px]">
              <thead>
                <tr className="bg-[#0a0a0a] text-[#737373]">
                  <th className="p-2">Ticker</th>
                  <th className="p-2">Spot</th>
                  <th className="p-2">Net GEX (B)</th>
                  <th className="p-2">P/C</th>
                  <th className="p-2">G-flip</th>
                  <th className="p-2">Call wall</th>
                  <th className="p-2">Put wall</th>
                  <th className="p-2">Max pain</th>
                  <th className="p-2">Proximity</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.ticker}
                    className="border-t border-[#1a1a1a] hover:bg-[#111]"
                  >
                    <td className="p-2 text-white">{r.ticker}</td>
                    <td className="p-2">${r.spot.toFixed(2)}</td>
                    <td
                      className={
                        r.totalNetGexBillions >= 0
                          ? "p-2 text-emerald-400"
                          : "p-2 text-red-400"
                      }
                    >
                      {r.totalNetGexBillions.toFixed(3)}
                    </td>
                    <td className="p-2">{r.pcr.toFixed(2)}</td>
                    <td className="p-2">${r.gammaFlip.toFixed(2)}</td>
                    <td className="p-2 text-emerald-400/90">
                      ${r.callWall.toFixed(2)}
                    </td>
                    <td className="p-2 text-red-400/90">
                      ${r.putWall.toFixed(2)}
                    </td>
                    <td className="p-2">${r.maxPain.toFixed(2)}</td>
                    <td className="p-2 text-[#a3a3a3]">
                      {[
                        r.nearCallWall ? "call wall" : null,
                        r.nearPutWall ? "put wall" : null,
                        r.nearGammaFlip ? "G-flip" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-[#525252] text-[10px] leading-relaxed">
        Google Sheets export from the original Streamlit script is not wired
        here; add a server route with a service account if you need cloud
        persistence. Educational use only — not financial advice.
      </p>
    </div>
  );
}
