"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import type { GEXByStrike, KeyLevels, OptionContract } from "@/lib/gex-engine";
import { computeVannaCharm } from "@/lib/vanna-charm";
import ExpandablePanel from "@/components/dashboard/ExpandablePanel";
import { formatCompactSigned } from "@/lib/number-format";

interface Props {
  gexByStrike: GEXByStrike[];
  keyLevels: KeyLevels;
  spotPrice: number;
  chain: OptionContract[];
}

// ── Shared tooltip style ─────────────────────────────────────────────────────
const TT: React.CSSProperties = {
  background: "#111",
  border: "1px solid #222",
  borderRadius: 4,
  fontSize: 10,
  fontFamily: "monospace",
  color: "#f0f0f0",
};

const TT_WRAP: React.CSSProperties = {
  outline: "none",
  backgroundColor: "transparent",
};

// ── Arrows badge helper ──────────────────────────────────────────────────────
function arrows(val: number, max: number, up: string, down: string) {
  const pct = Math.abs(val) / (max || 1);
  const n = pct > 0.66 ? 3 : pct > 0.33 ? 2 : 1;
  const ch = val >= 0 ? up : down;
  return ch.repeat(n);
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[8px] font-mono font-bold tracking-[0.18em] text-[#444] uppercase px-1 pt-1 pb-0.5 border-b border-[#1a1a1a]">
      {children}
    </div>
  );
}

// ── Wall row ──────────────────────────────────────────────────────────────────
function WallRow({
  label,
  badge,
  magnitude,
  strike,
  color,
}: {
  label: string;
  badge: string;
  magnitude: string;
  strike: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between px-1.5 py-[3px] hover:bg-[#111] rounded-sm transition-colors">
      <div className="flex items-center gap-1 min-w-0">
        <span
          className="text-[7px] font-bold leading-none shrink-0"
          style={{ color }}
        >
          {badge}
        </span>
        <div className="min-w-0">
          <div className="text-[8px] font-mono text-[#888] leading-none truncate">
            {label}
          </div>
          <div className="text-[7px] font-mono text-[#555] leading-none">
            {magnitude}
          </div>
        </div>
      </div>
      <div
        className="text-[9px] font-mono font-bold shrink-0 ml-1"
        style={{ color }}
      >
        ${strike.toFixed(2)}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ExposuresTab({
  gexByStrike,
  keyLevels,
  spotPrice,
  chain,
}: Props) {
  // ── GEX chart data ──────────────────────────────────────────────────────
  const gexData = gexByStrike
    .filter((r) => Math.abs(r.strike - spotPrice) / spotPrice < 0.08)
    .map((r) => ({
      strike: r.strike,
      callGEX: Math.round(r.callGEX / 1e6),
      putGEX: Math.round(r.putGEX / 1e6),
    }))
    .reverse(); // highest strike at top

  // nearest strike in chart to snap reference lines
  function nearestStrike(price: number) {
    if (!gexData.length) return price;
    return gexData.reduce((best, d) =>
      Math.abs(d.strike - price) < Math.abs(best.strike - price) ? d : best
    ).strike;
  }

  // ── Vanna / Charm ───────────────────────────────────────────────────────
  const vcData = computeVannaCharm(chain, spotPrice);
  const netVanna = vcData.reduce((s, r) => s + r.vanna, 0);
  const netCharm = vcData.reduce((s, r) => s + r.charm, 0);

  // ── Major Walls computation ─────────────────────────────────────────────
  const sorted = [...gexByStrike].sort((a, b) => b.callGEX - a.callGEX);
  const topCallWalls = sorted.slice(0, 5);
  const topPutWalls = [...gexByStrike]
    .sort((a, b) => a.putGEX - b.putGEX)
    .slice(0, 5);

  const maxCallGEX = Math.max(...topCallWalls.map((r) => r.callGEX));
  const maxPutGEX = Math.max(...topPutWalls.map((r) => Math.abs(r.putGEX)));

  const topVanna = [...vcData]
    .sort((a, b) => Math.abs(b.vanna) - Math.abs(a.vanna))
    .slice(0, 5);
  const maxVanna = Math.max(...topVanna.map((r) => Math.abs(r.vanna)));

  const topCharm = [...vcData]
    .sort((a, b) => Math.abs(b.charm) - Math.abs(a.charm))
    .slice(0, 5);
  const maxCharm = Math.max(...topCharm.map((r) => Math.abs(r.charm)));

  // Dense levels: strikes appearing in ≥2 wall lists
  const allWallStrikes = [
    ...topCallWalls.map((r) => r.strike),
    ...topPutWalls.map((r) => r.strike),
    ...topVanna.map((r) => r.strike),
    ...topCharm.map((r) => r.strike),
  ];
  const countMap = new Map<number, number>();
  for (const s of allWallStrikes)
    countMap.set(s, (countMap.get(s) ?? 0) + 1);
  const denseLevels = [...countMap.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // reference-line levels for GEX chart
  const refLevels = [
    { key: "Spot",     val: nearestStrike(spotPrice),       color: "#f0f0f0", dash: "4 4" },
    { key: "Vol Trig", val: nearestStrike(keyLevels.volTrigger), color: "#06b6d4", dash: "3 3" },
    { key: "G-Flip",   val: nearestStrike(keyLevels.gammaFlip),  color: "#f5a623", dash: "3 3" },
    { key: "Call Wall",val: nearestStrike(keyLevels.callWall),   color: "#00ff88", dash: "3 3" },
    { key: "Put Wall", val: nearestStrike(keyLevels.putWall),    color: "#ff4444", dash: "3 3" },
  ];

  return (
    <div className="h-full flex overflow-hidden p-2 gap-2 bg-black">
      {/* ── Left: charts ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-2 min-w-0 min-h-0">
        {/* Tab subtitle */}
        <div className="flex items-center text-[9px] font-mono text-[#444] flex-shrink-0 tracking-wider">
          <span>
            {chain[0]?.expiry?.slice(0, 10) ?? "—"} · gamma, vanna, charm by
            strike
          </span>
        </div>

        {/* GEX horizontal bar chart */}
        <ExpandablePanel
          id="exposures-gex"
          title="Gamma Exposure by Strike"
          className="flex-[3] min-h-0 bg-[#0d0d0d] border border-[#1e1e1e] rounded p-2 flex flex-col"
          headerClassName="mb-1 flex-shrink-0"
        >
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={gexData}
                margin={{ top: 4, right: 64, left: 44, bottom: 4 }}
                barCategoryGap="30%"
              >
                <XAxis
                  type="number"
                  tickFormatter={(v: number) =>
                    `${v >= 0 ? "+" : ""}${v}M`
                  }
                  tick={{ fill: "#444", fontSize: 8, fontFamily: "monospace" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="strike"
                  tick={{ fill: "#555", fontSize: 8, fontFamily: "monospace" }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  cursor={false}
                  wrapperStyle={TT_WRAP}
                  contentStyle={TT}
                  formatter={(v, name) => [
                    `${Number(v ?? 0)}M`,
                    name === "callGEX" ? "Call GEX" : "Put GEX",
                  ]}
                  labelFormatter={(l) => `Strike $${l}`}
                />
                {refLevels.map((rl) => (
                  <ReferenceLine
                    key={rl.key}
                    y={rl.val}
                    stroke={rl.color}
                    strokeDasharray={rl.dash}
                    strokeWidth={1}
                    label={{
                      value: `${rl.key} $${rl.val}`,
                      fill: rl.color,
                      fontSize: 8,
                      fontFamily: "monospace",
                      position: "right",
                    }}
                  />
                ))}
                <ReferenceLine x={0} stroke="#2a2a2a" strokeWidth={1} />
                <Bar
                  dataKey="callGEX"
                  radius={[0, 2, 2, 0]}
                  activeBar={false}
                >
                  {gexData.map((_, i) => (
                    <Cell key={i} fill="#00ff88" fillOpacity={0.75} />
                  ))}
                </Bar>
                <Bar
                  dataKey="putGEX"
                  radius={[2, 0, 0, 2]}
                  activeBar={false}
                >
                  {gexData.map((_, i) => (
                    <Cell key={i} fill="#ff4444" fillOpacity={0.75} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ExpandablePanel>

        {/* Vanna + Charm charts */}
        <div className="flex-[2] flex gap-2 min-h-0">
          {/* Vanna */}
          <ExpandablePanel
            id="exposures-vanna"
            title="Vanna by Strike"
            className="flex-1 min-h-0 min-w-0 bg-[#0d0d0d] border border-[#1e1e1e] rounded p-2 flex flex-col"
            headerClassName="mb-1 flex-shrink-0"
            headerExtra={
              <div className="flex items-center gap-1.5 ml-auto">
                <div className="text-right">
                  <div className="text-[8px] font-mono text-[#444]">NET</div>
                  <div
                    className="text-[11px] font-mono font-bold"
                    style={{
                      color: netVanna >= 0 ? "#f97316" : "#fb923c",
                    }}
                  >
                    {netVanna >= 0 ? "+" : ""}
                    {netVanna.toFixed(1)}
                  </div>
                </div>
                <span className="text-[7px] font-mono font-bold px-1 py-0.5 rounded bg-[#1a1a1a] text-[#06b6d4]">
                  IV SPIKE
                </span>
              </div>
            }
          >
            <div className="text-[8px] font-mono text-[#383838] -mt-0.5 mb-1">
              IV Sensitivity
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={[...vcData].reverse()}
                  margin={{ top: 2, right: 4, left: 40, bottom: 2 }}
                  barCategoryGap="30%"
                >
                  <XAxis
                    type="number"
                    tick={{ fill: "#444", fontSize: 7, fontFamily: "monospace" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => v.toFixed(0)}
                  />
                  <YAxis
                    type="category"
                    dataKey="strike"
                    tick={{ fill: "#555", fontSize: 7, fontFamily: "monospace" }}
                    axisLine={false}
                    tickLine={false}
                    width={38}
                  />
                  <Tooltip
                    cursor={false}
                    wrapperStyle={TT_WRAP}
                    contentStyle={TT}
                    formatter={(v) => [
                      `${Number(v ?? 0).toFixed(2)}`,
                      "Vanna",
                    ]}
                    labelFormatter={(l) => `Strike $${l}`}
                  />
                  <ReferenceLine
                    y={nearestStrike(spotPrice)}
                    stroke="#f0f0f0"
                    strokeDasharray="3 3"
                    strokeWidth={1}
                    label={{
                      value: `$${spotPrice.toFixed(0)}`,
                      fill: "#f0f0f0",
                      fontSize: 7,
                      fontFamily: "monospace",
                      position: "right",
                    }}
                  />
                  <ReferenceLine x={0} stroke="#2a2a2a" strokeWidth={1} />
                  <Bar
                    dataKey="vanna"
                    radius={[0, 2, 2, 0]}
                    activeBar={false}
                  >
                    {vcData.map((r, i) => (
                      <Cell
                        key={i}
                        fill={r.vanna >= 0 ? "#f97316" : "#818cf8"}
                        fillOpacity={0.8}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ExpandablePanel>

          {/* Charm */}
          <ExpandablePanel
            id="exposures-charm"
            title="Charm by Strike"
            className="flex-1 min-h-0 min-w-0 bg-[#0d0d0d] border border-[#1e1e1e] rounded p-2 flex flex-col"
            headerClassName="mb-1 flex-shrink-0"
            headerExtra={
              <div className="flex items-center gap-1.5 ml-auto">
                <div className="text-right">
                  <div className="text-[8px] font-mono text-[#444]">NET</div>
                  <div
                    className="text-[11px] font-mono font-bold"
                    style={{
                      color: netCharm >= 0 ? "#00ff88" : "#ff4444",
                    }}
                  >
                    {netCharm >= 0 ? "+" : ""}
                    {netCharm.toFixed(1)}
                  </div>
                </div>
                <span
                  className="text-[7px] font-mono font-bold px-1 py-0.5 rounded bg-[#1a1a1a]"
                  style={{ color: netCharm >= 0 ? "#00ff88" : "#ff4444" }}
                >
                  DELTA {netCharm >= 0 ? "↑" : "↓"}
                </span>
              </div>
            }
          >
            <div className="text-[8px] font-mono text-[#383838] -mt-0.5 mb-1">
              Time Decay
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={[...vcData].reverse()}
                  margin={{ top: 2, right: 4, left: 40, bottom: 2 }}
                  barCategoryGap="30%"
                >
                  <XAxis
                    type="number"
                    tick={{ fill: "#444", fontSize: 7, fontFamily: "monospace" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => v.toFixed(1)}
                  />
                  <YAxis
                    type="category"
                    dataKey="strike"
                    tick={{ fill: "#555", fontSize: 7, fontFamily: "monospace" }}
                    axisLine={false}
                    tickLine={false}
                    width={38}
                  />
                  <Tooltip
                    cursor={false}
                    wrapperStyle={TT_WRAP}
                    contentStyle={TT}
                    formatter={(v) => [
                      `${Number(v ?? 0).toFixed(2)}`,
                      "Charm",
                    ]}
                    labelFormatter={(l) => `Strike $${l}`}
                  />
                  <ReferenceLine
                    y={nearestStrike(spotPrice)}
                    stroke="#f0f0f0"
                    strokeDasharray="3 3"
                    strokeWidth={1}
                    label={{
                      value: `$${spotPrice.toFixed(0)}`,
                      fill: "#f0f0f0",
                      fontSize: 7,
                      fontFamily: "monospace",
                      position: "right",
                    }}
                  />
                  <ReferenceLine x={0} stroke="#2a2a2a" strokeWidth={1} />
                  <Bar
                    dataKey="charm"
                    radius={[0, 2, 2, 0]}
                    activeBar={false}
                  >
                    {vcData.map((r, i) => (
                      <Cell
                        key={i}
                        fill={r.charm >= 0 ? "#ec4899" : "#6366f1"}
                        fillOpacity={0.8}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ExpandablePanel>
        </div>
      </div>

      {/* ── Right: Major Walls ─────────────────────────────────────────────── */}
      <div className="w-52 flex-shrink-0 bg-[#0d0d0d] border border-[#1e1e1e] rounded flex flex-col overflow-hidden">
        <div className="px-2 pt-2 pb-1 flex-shrink-0">
          <div className="text-[9px] font-mono font-bold tracking-widest text-[#555] uppercase">
            Major Walls
          </div>
        </div>
        <div className="flex-1 overflow-y-auto space-y-0">
          {/* GAMMA */}
          <SectionLabel>Gamma</SectionLabel>
          {topCallWalls.map((r) => (
            <WallRow
              key={`cg-${r.strike}`}
              label="Call Wall"
              badge={`${arrows(r.callGEX, maxCallGEX, "▲", "▼")} ${formatCompactSigned(r.callGEX)}`}
              magnitude={formatCompactSigned(r.callGEX)}
              strike={r.strike}
              color="#00ff88"
            />
          ))}
          {topPutWalls.map((r) => (
            <WallRow
              key={`pg-${r.strike}`}
              label="Put Wall"
              badge={`${arrows(r.putGEX, maxPutGEX, "▲", "▼")} ${formatCompactSigned(r.putGEX)}`}
              magnitude={formatCompactSigned(r.putGEX)}
              strike={r.strike}
              color="#ff4444"
            />
          ))}

          {/* VANNA */}
          <SectionLabel>Vanna</SectionLabel>
          {topVanna.map((r) => (
            <WallRow
              key={`v-${r.strike}`}
              label={r.vanna >= 0 ? "Vanna Long" : "Vanna Short"}
              badge={`${arrows(r.vanna, maxVanna, "▲▲▲", "▼▼▼").slice(0, 3)} ${formatCompactSigned(r.vanna)}`}
              magnitude={formatCompactSigned(r.vanna)}
              strike={r.strike}
              color={r.vanna >= 0 ? "#f97316" : "#818cf8"}
            />
          ))}

          {/* CHARM */}
          <SectionLabel>Charm</SectionLabel>
          {topCharm.map((r) => (
            <WallRow
              key={`c-${r.strike}`}
              label={r.charm >= 0 ? "Charm Long" : "Charm Short"}
              badge={`${arrows(r.charm, maxCharm, "▲▲▲", "▼▼▼").slice(0, 3)} ${formatCompactSigned(r.charm)}`}
              magnitude={formatCompactSigned(r.charm)}
              strike={r.strike}
              color={r.charm >= 0 ? "#ec4899" : "#6366f1"}
            />
          ))}

          {/* DENSE LEVELS */}
          {denseLevels.length > 0 && (
            <>
              <SectionLabel>Dense Levels</SectionLabel>
              {denseLevels.map(([strike, count]) => (
                <WallRow
                  key={`dl-${strike}`}
                  label={`Confluence ${count}×`}
                  badge={`${count} walls`}
                  magnitude={`${count} walls`}
                  strike={strike}
                  color={
                    count >= 4
                      ? "#00ff88"
                      : count === 3
                      ? "#f5a623"
                      : "#888"
                  }
                />
              ))}
            </>
          )}

          {/* Footer legend */}
          <div className="px-2 py-2 text-[7px] font-mono text-[#333] leading-relaxed border-t border-[#1a1a1a] mt-1">
            <span className="text-[#f97316]">Vanna</span>: IV changes drive IV
            flows.{" "}
            <span className="text-[#ec4899]">Charm</span>: δ changes from time
            decay.
          </div>
        </div>
      </div>
    </div>
  );
}
