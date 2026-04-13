"use client";

import {
  BarChart3,
  Grid3X3,
  Zap,
  Play,
  Layers,
  Box,
} from "lucide-react";

const features = [
  {
    icon: BarChart3,
    symbol: "◈",
    title: "OI Gamma Exposure",
    desc: "Visualise dealer gamma by strike and expiry. Identify call walls, put walls, and the gamma flip level.",
  },
  {
    icon: Grid3X3,
    symbol: "◉",
    title: "GEX Heatmap",
    desc: "Per-expiry heatmap shows which strikes carry the most dealer exposure across every live expiration.",
  },
  {
    icon: Zap,
    symbol: "◎",
    title: "Unusual Flow",
    desc: "Bubble chart of high Vol/OI prints — spot anomalous positioning before price moves.",
  },
  {
    icon: Play,
    symbol: "◇",
    title: "Intraday Replay",
    desc: "Step through the session bar by bar. See how gamma exposure shifted throughout the day.",
  },
  {
    icon: Layers,
    symbol: "◆",
    title: "Daily Key Levels",
    desc: "Gamma flip, vol trigger, call wall, put wall, max pain — with distance from spot.",
  },
  {
    icon: Box,
    symbol: "◐",
    title: "3D Gamma Surface",
    desc: "Interactive Gaussian gamma surface. Each strike ridge plotted independently. Drag to rotate.",
  },
];

export default function Features() {
  return (
    <section id="features" className="px-4 py-20">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-center text-[#666] text-[10px] font-mono mb-12 tracking-[4px]">
          WHAT&apos;S INSIDE
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="group p-5 rounded border border-[#222] bg-[#111] hover:border-[#333] hover:bg-[#161616] transition-all duration-300 animate-slide-up"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <span className="text-xl text-[#00ff88] mb-3 block font-mono">
                {f.symbol}
              </span>
              <h3 className="text-sm font-bold text-[#f0f0f0] mb-1.5 font-mono">
                {f.title}
              </h3>
              <p className="text-xs text-[#999] leading-relaxed">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
