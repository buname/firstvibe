import Link from "next/link";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import CTA from "@/components/landing/CTA";
import TickerBanner from "@/components/TickerBanner";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#080808]">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#080808]/90 backdrop-blur-xl border-b border-[#222]">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#f0f0f0] tracking-[3px] font-mono">
              BEX
            </span>
            <span className="text-[10px] text-[#666] font-mono tracking-wider">
              options analytics
            </span>
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="#features"
              className="text-xs text-[#666] hover:text-[#f0f0f0] transition-colors hidden sm:block font-mono tracking-wider"
            >
              Features
            </Link>
            <Link
              href="/dashboard"
              className="text-xs px-4 py-2 rounded bg-[#161616] border border-[#333] text-[#f0f0f0] hover:bg-[#222] transition-colors font-mono tracking-wider"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <Hero />
      <TickerBanner />
      <Features />
      <CTA />

      <footer className="border-t border-[#222] py-8 text-center text-[#666] text-xs font-mono">
        <span className="font-bold text-[#999]">BEX</span>{" "}
        options analytics
      </footer>
    </main>
  );
}
