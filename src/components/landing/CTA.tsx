"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

export default function CTA() {
  return (
    <section className="px-4 py-20">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4 text-[#f0f0f0]">
          Ready to trade with an edge?
        </h2>
        <p className="text-[#999] mb-8 text-sm">
          Open the dashboard and start reading dealer positioning in seconds.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded bg-[#f0f0f0] hover:bg-white text-[#080808] font-mono font-bold text-sm transition-all glow-green tracking-wider"
        >
          Get Access <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
}
