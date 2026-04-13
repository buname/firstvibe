"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import type { GEXByStrike } from "@/lib/gex-engine";

interface Props {
  gexByStrike: GEXByStrike[];
  spotPrice: number;
}

export default function ReplayTab({ gexByStrike, spotPrice }: Props) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const totalSteps = 78;

  const frames = useMemo(() => {
    const base = gexByStrike.filter(
      (r) => Math.abs(r.strike - spotPrice) / spotPrice < 0.06
    );

    return Array.from({ length: totalSteps }, (_, i) => {
      const factor = 0.3 + (i / totalSteps) * 0.7;
      const noise = 1 + Math.sin(i * 0.3) * 0.15;
      return base.map((r) => ({
        strike: r.strike,
        net: Math.round((r.netGEX * factor * noise) / 1e6),
      }));
    });
  }, [gexByStrike, spotPrice]);

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setStep((s) => {
          if (s >= totalSteps - 1) {
            setPlaying(false);
            return s;
          }
          return s + 1;
        });
      }, 400);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing]);

  const togglePlay = useCallback(() => setPlaying((p) => !p), []);

  const timeLabel = useMemo(() => {
    const totalMins = 390;
    const minsIntoDay = Math.round((step / totalSteps) * totalMins);
    const h = 9 + Math.floor((minsIntoDay + 30) / 60);
    const m = (minsIntoDay + 30) % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")} ET`;
  }, [step]);

  return (
    <div className="h-full flex flex-col p-3">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-mono font-bold tracking-wider text-[#f0f0f0]">
          INTRADAY REPLAY
        </h2>
        <span className="font-mono text-xs text-[#00ff88]">{timeLabel}</span>
      </div>

      <div className="flex-1 min-h-0 rounded bg-[#111] border border-[#222] p-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={frames[step] || []}
            margin={{ top: 10, right: 20, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
            <XAxis
              dataKey="strike"
              tick={{ fill: "#666", fontSize: 9, fontFamily: "monospace" }}
              axisLine={{ stroke: "#222" }}
              interval={Math.floor((frames[0]?.length || 10) / 12)}
            />
            <YAxis
              tick={{ fill: "#666", fontSize: 9, fontFamily: "monospace" }}
              axisLine={{ stroke: "#222" }}
              tickFormatter={(v: number) => `${v}M`}
            />
            <ReferenceLine
              x={Math.round(spotPrice)}
              stroke="#f0f0f0"
              strokeDasharray="4 4"
            />
            <Bar
              dataKey="net"
              fill="#00ff88"
              opacity={0.6}
              radius={[2, 2, 2, 2]}
              activeBar={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-4 mt-3 justify-center">
        <button
          onClick={() => setStep(0)}
          className="p-1.5 rounded hover:bg-[#161616] text-[#666] hover:text-[#f0f0f0] transition-colors"
        >
          <SkipBack className="w-4 h-4" />
        </button>
        <button
          onClick={togglePlay}
          className="p-2.5 rounded bg-[#161616] border border-[#333] text-[#00ff88] hover:bg-[#222] transition-colors"
        >
          {playing ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
        </button>
        <button
          onClick={() => setStep(Math.min(totalSteps - 1, step + 1))}
          className="p-1.5 rounded hover:bg-[#161616] text-[#666] hover:text-[#f0f0f0] transition-colors"
        >
          <SkipForward className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-2">
        <input
          type="range"
          min={0}
          max={totalSteps - 1}
          value={step}
          onChange={(e) => setStep(Number(e.target.value))}
          className="w-full h-1 accent-[#00ff88] cursor-pointer"
        />
        <div className="flex justify-between text-[9px] text-[#666] font-mono mt-1">
          <span>09:30 ET</span>
          <span>12:00 ET</span>
          <span>16:00 ET</span>
        </div>
      </div>
    </div>
  );
}
