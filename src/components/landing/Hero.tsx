"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative flex flex-col items-center justify-center text-center px-4 pt-32 pb-20">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,255,136,0.04)_0%,transparent_70%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />

      <div className="relative z-10 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded border border-[#222] bg-[#111] text-[10px] text-[#666] font-mono tracking-wider mb-8 animate-fade-in">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
          LIVE OPTIONS ANALYTICS
        </div>

        <h1
          className="text-5xl md:text-7xl font-bold tracking-tight mb-6 text-[#f0f0f0] animate-slide-up"
          style={{ animationDelay: "0.1s" }}
        >
          A clearer view into{" "}
          <em className="gradient-text not-italic">the market.</em>
        </h1>

        <p
          className="text-lg md:text-xl text-[#999] max-w-2xl mx-auto mb-10 animate-slide-up"
          style={{ animationDelay: "0.2s" }}
        >
          Dealer exposure, positioning, and unusual flow — everything the
          options market is telling you, without the noise.
        </p>

        <div
          className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up"
          style={{ animationDelay: "0.3s" }}
        >
          <Link
            href="/dashboard"
            className="px-8 py-3.5 rounded bg-[#f0f0f0] hover:bg-white text-[#080808] font-mono font-bold text-sm flex items-center gap-2 transition-all glow-green tracking-wider"
          >
            Open Dashboard <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#features"
            className="px-8 py-3.5 rounded border border-[#333] text-[#999] hover:text-[#f0f0f0] hover:border-[#666] transition-all font-mono text-sm tracking-wider"
          >
            Learn more
          </a>
        </div>
      </div>
    </section>
  );
}
