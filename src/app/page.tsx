import Link from "next/link";
import StarField from "@/components/ui/StarField";

export default function Home() {
  return (
    <main className="relative isolate min-h-screen w-full overflow-hidden bg-black text-white">
      <StarField />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 pb-24 text-center sm:pb-28">
        <h1 className="welcome-cinematic-title text-5xl font-extralight uppercase tracking-[0.2em] text-[#ffffff] antialiased sm:text-6xl md:text-7xl">
          Welcome to BexData
        </h1>

        <Link
          href="/dashboard"
          prefetch={false}
          className="welcome-cinematic-cta mt-10 inline-flex items-center justify-center rounded-md border border-white/20 bg-transparent px-8 py-3 text-xs font-light uppercase tracking-[0.2em] text-white transition-all hover:scale-[1.02] hover:bg-white hover:text-black"
        >
          Open Dashboard
        </Link>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-5 z-20 px-4 sm:bottom-6">
        <p className="mx-auto max-w-4xl text-center text-[10px] font-light uppercase tracking-[0.14em] text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)] sm:text-[11px]">
          <span className="font-semibold">Risk Warning:</span> Trading involves substantial risk of loss. This platform is for educational and informational use only and is not financial advice.
        </p>
      </div>
    </main>
  );
}
