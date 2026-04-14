import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080808] px-6">
      <section className="w-full max-w-xl rounded-xl border border-white/10 bg-[#101010] p-8 text-center shadow-2xl">
        <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#7f7f7f]">
          Deployment Status
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-[#f0f0f0] sm:text-3xl">
          Geopolitical Risk Map is Live
        </h1>
        <p className="mt-3 text-sm text-[#9a9a9a]">
          The application is running successfully in production.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center justify-center rounded-md border border-[#2d2d2d] bg-[#1a1a1a] px-5 py-2.5 text-sm font-medium text-[#f0f0f0] transition-colors hover:bg-[#242424]"
        >
          Open Dashboard
        </Link>
      </section>
    </main>
  );
}
