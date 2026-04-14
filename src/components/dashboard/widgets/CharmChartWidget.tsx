"use client";

import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { computeVannaCharm } from "@/lib/vanna-charm";
import { useWidgetData } from "./WidgetDataContext";

function strikeLabel(strike: number) {
  return `$${strike % 1 === 0 ? strike.toFixed(0) : strike.toFixed(1)}`;
}

export default function CharmChartWidget() {
  const { chain, spotPrice } = useWidgetData();

  const vcAll = useMemo(() => computeVannaCharm(chain, spotPrice), [chain, spotPrice]);

  const charmRows = useMemo(() => {
    if (vcAll.length === 0 || spotPrice <= 0) return [];
    const sorted = [...vcAll].sort(
      (a, b) => Math.abs(a.strike - spotPrice) - Math.abs(b.strike - spotPrice)
    );
    return sorted
      .slice(0, 14)
      .sort((a, b) => a.strike - b.strike)
      .map((r) => ({ k: strikeLabel(r.strike), strike: r.strike, v: r.charm }));
  }, [vcAll, spotPrice]);

  const spotKey = useMemo(() => {
    if (charmRows.length === 0) return null;
    return charmRows.reduce((a, b) =>
      Math.abs(a.strike - spotPrice) < Math.abs(b.strike - spotPrice) ? a : b
    ).k;
  }, [charmRows, spotPrice]);

  if (charmRows.length === 0) {
    return <div className="p-2 text-[10px] text-neutral-600">No chain data</div>;
  }

  return (
    <div className="flex h-full min-h-[180px] flex-col">
      <div className="shrink-0 px-1 pb-1 text-[9px] font-medium uppercase tracking-[0.14em] text-neutral-500">
        Charm by strike
      </div>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={charmRows} margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" horizontal={false} />
            <XAxis type="number" stroke="#2a2a2a" tick={{ fill: "#525252", fontSize: 9 }} />
            <YAxis
              type="category" dataKey="k" width={48} stroke="#2a2a2a"
              tick={(props) => {
                const x = Number(props.x ?? 0);
                const y = Number(props.y ?? 0);
                const value = String((props.payload as { value?: unknown })?.value ?? "");
                return (
                <text x={x} y={y} dy={3} textAnchor="end" fontSize={9}
                  fill={spotKey === value ? "#fafafa" : "#737373"}
                  fontWeight={spotKey === value ? 600 : 400}>
                  {value}
                </text>
                );
              }}
            />
            <ReferenceLine x={0} stroke="#333" />
            <Bar dataKey="v" barSize={9} radius={[0, 3, 3, 0]} isAnimationActive={false}>
              {charmRows.map((e, i) => (
                <Cell key={i} fill={e.v >= 0 ? "#ec4899" : "#6366f1"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
