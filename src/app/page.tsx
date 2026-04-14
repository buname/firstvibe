import Link from "next/link";
import StarField from "@/components/ui/StarField";

export default function Home() {
  return (
    <main className="relative isolate min-h-screen w-full overflow-hidden bg-black text-white">
      <StarField />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 text-center">
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
    </main>
  );
}
