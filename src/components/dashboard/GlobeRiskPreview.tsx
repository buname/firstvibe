"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Headline = {
  id: string;
  title: string;
  source: string;
  sentiment: "bullish" | "bearish" | "neutral";
  url?: string;
};

type MarkerDef = {
  id: string;
  label: string;
  left: string;
  top: string;
};

const MARKERS: MarkerDef[] = [
  { id: "ny", label: "Americas", left: "22%", top: "38%" },
  { id: "eu", label: "Europe", left: "48%", top: "32%" },
  { id: "me", label: "MENA", left: "54%", top: "48%" },
  { id: "ap", label: "Asia", left: "72%", top: "42%" },
];

/** Keyword buckets → crude regional tilt from live headlines */
const REGION_PATTERNS: Record<string, RegExp[]> = {
  ny: [
    /\bus\b|u\.s\.|america|nasdaq|s\s*&\s*p|fed\b|treasury|white house|sec\b|nvidia|apple|microsoft|meta\b|amazon|tesla\b/i,
  ],
  eu: [
    /europe|ecb|eu\b|germany|france|ukraine|brexit|euro|boe\b|london|stoxx/i,
  ],
  me: [/opec|oil price|middle east|israel|iran|saudi|gaza|qatar|uae\b|mena/i],
  ap: [
    /china|japan|asia|taiwan|hong kong|nikkei|yuan|korea|india\b|shanghai|beijing/i,
  ],
};

function regionTone(
  headlines: Headline[],
  id: string
): "on" | "off" | "mixed" {
  const pats = REGION_PATTERNS[id];
  if (!pats?.length) return "mixed";
  let bull = 0;
  let bear = 0;
  for (const h of headlines) {
    if (!pats.some((re) => re.test(h.title))) continue;
    if (h.sentiment === "bullish") bull++;
    else if (h.sentiment === "bearish") bear++;
  }
  const n = bull + bear;
  if (n === 0) return "mixed";
  if (bull >= bear + 1) return "on";
  if (bear >= bull + 1) return "off";
  return "mixed";
}

function pulseClass(tone: "on" | "off" | "mixed"): string {
  if (tone === "on") return "bg-emerald-500/85 shadow-emerald-500/40";
  if (tone === "off") return "bg-rose-500/80 shadow-rose-500/35";
  return "bg-amber-400/75 shadow-amber-500/30";
}

async function fetchHeadlines(): Promise<Headline[]> {
  const res = await fetch("/api/news", { cache: "no-store" });
  if (!res.ok) return [];
  const j = (await res.json()) as { headlines?: Headline[] };
  return j.headlines ?? [];
}

export default function GlobeRiskPreview() {
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const hs = await fetchHeadlines();
      setHeadlines(hs);
      setUpdatedAt(new Date());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load();
      if (cancelled) return;
    })();
    const t = setInterval(() => {
      void load();
    }, 90_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [load]);

  const lines = useMemo(() => {
    const pick = headlines
      .filter((h) => h.title.length > 12)
      .slice(0, 5)
      .map((h) => h.title);
    return pick.length ? pick : fallbackLines();
  }, [headlines]);

  const toneById = useMemo(() => {
    const m: Record<string, "on" | "off" | "mixed"> = {};
    for (const x of MARKERS) m[x.id] = regionTone(headlines, x.id);
    return m;
  }, [headlines]);

  const timeStr =
    updatedAt?.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }) ?? "—";

  return (
    <div className="mt-8 max-w-3xl mx-auto border border-[#1f1f1f] rounded-lg bg-[#050508] overflow-hidden">
      <div className="px-3 py-2 border-b border-[#1a1a1a] flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-mono font-bold tracking-wider text-[#e5e5e5]">
          GLOBAL RISK MAP
        </h3>
        <div className="flex items-center gap-2 text-[9px] font-mono text-[#525252] uppercase shrink-0">
          {error && (
            <span className="text-rose-400/90 normal-case">Feed error</span>
          )}
          <span className="text-emerald-500/80 tabular-nums">LIVE</span>
          <span className="text-[#525252] normal-case">{timeStr}</span>
        </div>
      </div>

      <div className="relative h-52 bg-gradient-to-b from-[#0a0a12] via-[#050508] to-black overflow-hidden">
        {/* Stylized globe grid */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.14]"
          viewBox="0 0 400 200"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden
        >
          <defs>
            <radialGradient id="ggr" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="rgba(56,189,248,0.25)" />
              <stop offset="55%" stopColor="rgba(5,5,8,0)" />
            </radialGradient>
          </defs>
          <ellipse cx="200" cy="100" rx="118" ry="58" fill="url(#ggr)" />
          <ellipse
            cx="200"
            cy="100"
            rx="118"
            ry="58"
            fill="none"
            stroke="rgba(148,163,184,0.35)"
            strokeWidth="0.6"
          />
          {[0, 1, 2, 3, 4].map((i) => (
            <ellipse
              key={i}
              cx="200"
              cy="100"
              rx={24 + i * 22}
              ry={12 + i * 10}
              fill="none"
              stroke="rgba(71,85,105,0.35)"
              strokeWidth="0.4"
            />
          ))}
          {[72, 144, 216, 288].map((x) => (
            <line
              key={x}
              x1={x}
              y1="30"
              x2={x - 40}
              y2="170"
              stroke="rgba(51,65,85,0.25)"
              strokeWidth="0.5"
            />
          ))}
        </svg>

        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-44 h-44 rounded-full opacity-90 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 35% 30%, rgba(120,200,255,0.12), transparent 55%), radial-gradient(circle at 70% 60%, rgba(0,255,136,0.06), transparent 50%), linear-gradient(145deg, #111822, #050508 60%)",
            boxShadow:
              "inset 0 0 40px rgba(0,0,0,0.85), 0 0 60px rgba(34,211,238,0.05)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.1] pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, transparent, transparent 13px, rgba(255,255,255,0.04) 13px, rgba(255,255,255,0.04) 14px)",
          }}
        />

        {MARKERS.map((m) => {
          const tone = toneById[m.id] ?? "mixed";
          return (
            <div
              key={m.id}
              className="absolute group cursor-default z-[1]"
              style={{ left: m.left, top: m.top }}
            >
              <span
                className={`block w-2 h-2 rounded-full animate-pulse shadow-lg ${pulseClass(
                  tone
                )}`}
              />
              <div className="absolute left-1/2 -translate-x-1/2 mt-1 hidden group-hover:block z-10 px-2 py-1 rounded bg-black/95 border border-[#333] text-[9px] font-mono text-[#a3a3a3] whitespace-nowrap max-w-[220px]">
                <span className="text-[#737373]">{m.label}</span>
                <span className="block text-[8px] text-[#525252] mt-0.5">
                  {tone === "on"
                    ? "Headlines skew risk-on"
                    : tone === "off"
                      ? "Headlines skew risk-off"
                      : "Mixed / no regional match"}
                </span>
              </div>
            </div>
          );
        })}

        <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-mono text-[#525252]">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/70" /> On
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500/70" /> Off
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400/70" /> Mixed
          </span>
        </div>
      </div>

      <div className="px-3 py-2 border-t border-[#1a1a1a] space-y-1.5 max-h-28 overflow-y-auto">
        <div className="text-[9px] text-[#525252] font-mono uppercase tracking-wider mb-1">
          Headlines · /api/news (live)
        </div>
        {lines.map((t, i) => (
          <p
            key={i}
            className="text-[10px] font-mono text-[#737373] leading-snug border-l border-[#262626] pl-2"
          >
            {t}
          </p>
        ))}
      </div>
    </div>
  );
}

function fallbackLines(): string[] {
  return [
    "No headlines yet — check network or wait for the next RSS pull.",
    "Markets still parse macro tape; regional dots use keyword + sentiment heuristics.",
  ];
}
