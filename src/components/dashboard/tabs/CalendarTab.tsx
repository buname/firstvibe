"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { OptionContract } from "@/lib/gex-engine";
import GlobeRiskPreview from "@/components/dashboard/GlobeRiskPreview";
import { getMacroEventsUpcoming } from "@/lib/macro-calendar";
import { toast } from "sonner";
import { useResilientFetch } from "@/hooks/useResilientFetch";
import StatusBadge from "@/components/dashboard/StatusBadge";

interface Props {
  chain: OptionContract[];
}

type Headline = {
  id: string;
  title: string;
  source: string;
  time: string;
  sentiment: "bullish" | "bearish" | "neutral";
  url?: string;
};

type NewsFilter =
  | "ALL"
  | "CONFLICT"
  | "TENSION"
  | "SANCTIONS"
  | "WARS"
  | "CRISES";

const NEWS_SNAPSHOT_KEY = "bex-calendar-news-last-good";

type NewsPayload = {
  headlines: Headline[];
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dteDays(from: Date, to: Date): number {
  return Math.ceil(
    (startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000
  );
}

function fixNextFriday(from: Date): Date {
  const d = startOfDay(from);
  const dow = d.getDay(); // 5 = Fri
  let add = (5 - dow + 7) % 7;
  if (dow === 5) add = 0;
  const out = new Date(d);
  out.setDate(d.getDate() + add);
  return startOfDay(out);
}

function thirdFriday(year: number, month0: number): Date {
  for (let day = 15; day <= 21; day++) {
    const t = new Date(year, month0, day);
    if (t.getDay() === 5) return startOfDay(t);
  }
  return startOfDay(new Date(year, month0, 15));
}

function isThirdFriday(d: Date): boolean {
  const dom = d.getDate();
  return d.getDay() === 5 && dom >= 15 && dom <= 21;
}

function isQuarterlyMonth(m: number): boolean {
  return m === 2 || m === 5 || m === 8 || m === 11;
}

function opexBadge(d: Date): "QOPEX" | "MOPEX" | "WOPEX" {
  if (isThirdFriday(d) && isQuarterlyMonth(d.getMonth())) return "QOPEX";
  if (isThirdFriday(d)) return "MOPEX";
  return "WOPEX";
}

function nextThirdFridayOnOrAfter(from: Date): Date {
  const s = startOfDay(from);
  let y = s.getFullYear();
  let m = s.getMonth();
  for (let i = 0; i < 16; i++) {
    const tf = thirdFriday(y, m);
    if (tf.getTime() >= s.getTime()) return tf;
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  return thirdFriday(y, m);
}

function nextQuarterlyOpexOnOrAfter(from: Date): Date {
  const s = startOfDay(from);
  const months = [2, 5, 8, 11];
  let best: Date | null = null;
  for (let addY = 0; addY <= 2; addY++) {
    const y = from.getFullYear() + addY;
    for (const mo of months) {
      const d = thirdFriday(y, mo);
      if (d.getTime() >= s.getTime()) {
        if (!best || d.getTime() < best.getTime()) best = d;
      }
    }
  }
  return best ?? thirdFriday(from.getFullYear(), 11);
}

function nextEightFridays(from: Date): Date[] {
  let cur = fixNextFriday(from);
  const out: Date[] = [];
  for (let i = 0; i < 8; i++) {
    out.push(new Date(cur));
    cur = new Date(cur);
    cur.setDate(cur.getDate() + 7);
    cur = startOfDay(cur);
  }
  return out;
}

function headlineTags(title: string): NewsFilter[] {
  const t = title.toLowerCase();
  const out = new Set<NewsFilter>();
  if (/war|invasion|offensive|ceasefire|troops|nato attack/i.test(t))
    out.add("WARS");
  if (/sanction|embargo|blacklist|asset freeze/i.test(t))
    out.add("SANCTIONS");
  if (/crisis|default|bank run|contagion|meltdown|crash\b/i.test(t))
    out.add("CRISES");
  if (/conflict|clashes|strikes?\s+(?!price)|protest|riot|unrest/i.test(t))
    out.add("CONFLICT");
  if (/tension|standoff|escalat|brink|hostile/i.test(t)) out.add("TENSION");
  if (out.size === 0) out.add("ALL");
  return [...out];
}

function headlineRegion(title: string): string {
  const t = title.toLowerCase();
  if (
    /china|japan|taiwan|hong kong|asia|korea|india|nikkei|yuan/i.test(t)
  )
    return "APAC";
  if (/europe|ecb|eu\b|germany|france|ukraine|uk\b|brexit/i.test(t))
    return "EU";
  if (/opec|israel|iran|saudi|gaza|middle east|mena|oil minister/i.test(t))
    return "MENA";
  if (/u\.s|us\b|fed|america|nasdaq|white house|congress/i.test(t))
    return "AMERICAS";
  return "GLOBAL";
}

function openSearchUrl(title: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(title)}`;
}

function headlineHref(h: Headline): string {
  if (h.url && /^https?:\/\//i.test(h.url)) return h.url;
  return openSearchUrl(h.title);
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function CalendarTab({ chain }: Props) {
  const now = useMemo(() => new Date(), []);
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [newsFilter, setNewsFilter] = useState<NewsFilter>("ALL");
  const resilientNews = useResilientFetch<NewsPayload>({
    snapshotKey: NEWS_SNAPSHOT_KEY,
    isDegraded: (d) => d.headlines.length < 4,
  });
  const [calMonth, setCalMonth] = useState(() => ({
    y: now.getFullYear(),
    m: now.getMonth(),
  }));

  const loadNews = useCallback(async () => {
    const result = await resilientNews.run(async () => {
      const res = await fetch("/api/news", { cache: "no-store" });
      if (!res.ok) throw new Error(`News failed (${res.status})`);
      const j = (await res.json()) as { headlines?: Headline[] };
      return { headlines: j.headlines ?? [] };
    });
    if (result.data) {
      setHeadlines(result.data.headlines);
    }
    if (result.status === "stale") {
      toast.warning("News feed stale — showing last snapshot");
    }
  }, [resilientNews]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadNews();
    }, 0);
    return () => window.clearTimeout(t);
  }, [loadNews]);

  const nextWeekly = useMemo(() => fixNextFriday(now), [now]);
  const nextMonthly = useMemo(() => nextThirdFridayOnOrAfter(now), [now]);
  const nextQuarterly = useMemo(() => nextQuarterlyOpexOnOrAfter(now), [now]);

  const countdowns = useMemo(
    () => [
      { label: "NEXT OPEX", sub: "Weekly", target: nextWeekly },
      { label: "MONTHLY OPEX", sub: "3rd Fri", target: nextMonthly },
      { label: "QUARTERLY OPEX", sub: "Mar/Jun/Sep/Dec", target: nextQuarterly },
    ],
    [nextWeekly, nextMonthly, nextQuarterly]
  );

  const opexRows = useMemo(() => nextEightFridays(now), [now]);

  const macroUpcoming = useMemo(
    () => getMacroEventsUpcoming(now, 12, 20),
    [now]
  );

  const { weeks, dim } = useMemo(() => {
    const { y, m } = calMonth;
    const dimLocal = new Date(y, m + 1, 0).getDate();
    const sd = new Date(y, m, 1).getDay();
    const w: (number | null)[][] = [];
    let week: (number | null)[] = Array(sd).fill(null);
    for (let d = 1; d <= dimLocal; d++) {
      week.push(d);
      if (week.length === 7) {
        w.push(week);
        week = [];
      }
    }
    if (week.length) {
      while (week.length < 7) week.push(null);
      w.push(week);
    }
    return { weeks: w, dim: dimLocal };
  }, [calMonth]);

  const opexDaysInMonth = useMemo(() => {
    const { y, m } = calMonth;
    const set = new Set<number>();
    for (let d = 1; d <= dim; d++) {
      const dt = new Date(y, m, d);
      if (dt.getDay() === 5) set.add(d);
    }
    return set;
  }, [calMonth, dim]);

  const thirdFridaysInMonth = useMemo(() => {
    const { y, m } = calMonth;
    const tf = thirdFriday(y, m);
    return new Set([tf.getDate()]);
  }, [calMonth]);

  const filteredHeadlines = useMemo(() => {
    if (newsFilter === "ALL") return headlines;
    return headlines.filter((h) => {
      const tags = headlineTags(h.title);
      return tags.includes(newsFilter) || tags.includes("ALL");
    });
  }, [headlines, newsFilter]);

  const monthTitle = new Date(calMonth.y, calMonth.m).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  const tagColors: Record<string, string> = {
    FOMC: "#f5a623",
    CPI: "#06b6d4",
    NFP: "#a78bfa",
    PCE: "#00ff88",
  };

  return (
    <div className="h-full flex flex-col overflow-hidden p-2 gap-2 text-[10px] font-mono">
      <h2 className="text-xs font-bold tracking-wider text-[#e5e5e5] shrink-0 px-0.5">
        CALENDAR
      </h2>

      {/* Countdown row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 shrink-0">
        {countdowns.map((c) => {
          const days = Math.max(0, dteDays(now, c.target));
          return (
            <div
              key={c.label}
              className="rounded border border-[#1e1e1e] bg-[#0a0a0a] px-3 py-2.5"
            >
              <div className="text-[8px] text-[#525252] tracking-widest">
                {c.label}
              </div>
              <div className="text-[9px] text-[#444] mb-1">{c.sub}</div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-2xl font-bold text-[#f0f0f0] tabular-nums">
                  {days}
                </span>
                <span className="text-[9px] text-[#737373] text-right">
                  days
                  <br />
                  {fmtShort(c.target)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Middle: OPEX schedule | Macro + mini calendar */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-2">
        {/* Left: OPEX schedule */}
        <div className="min-h-0 flex flex-col rounded border border-[#1e1e1e] bg-[#080808] overflow-hidden">
          <div className="px-2 py-1.5 border-b border-[#1a1a1a] text-[9px] font-bold tracking-widest text-[#555] uppercase shrink-0 flex items-center justify-between gap-2">
            <span>OPEX schedule · next 8 weeks</span>
            <span className="text-[8px] font-normal text-[#3f3f3f] normal-case">
              chain {chain.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {opexRows.map((d) => {
              const badge = opexBadge(d);
              const dte = dteDays(now, d);
              const bg =
                badge === "QOPEX"
                  ? "bg-violet-500/15 text-violet-300 border-violet-500/30"
                  : badge === "MOPEX"
                    ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                    : "bg-[#1a1a1a] text-[#888] border-[#333]";
              return (
                <div
                  key={d.toISOString()}
                  className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-[#141414] hover:bg-[#0f0f0f]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`shrink-0 text-[7px] font-bold px-1 py-0.5 rounded border ${bg}`}
                    >
                      {badge}
                    </span>
                    <span className="text-[#a3a3a3] truncate">
                      {fmtShort(d)}
                    </span>
                  </div>
                  <span className="text-[#00ff88]/90 tabular-nums shrink-0">
                    DTE {dte}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Macro list + mini calendar */}
        <div className="min-h-0 flex flex-col gap-2">
          <div className="flex-1 min-h-[120px] flex flex-col rounded border border-[#1e1e1e] bg-[#080808] overflow-hidden">
            <div className="px-2 py-1.5 border-b border-[#1a1a1a] text-[9px] font-bold tracking-widest text-[#555] uppercase shrink-0 leading-tight">
              Macro calendar
              <span className="block font-normal normal-case text-[#3f3f3f] tracking-normal mt-0.5">
                NFP/CPI auto rows are estimates; verify against official release
                calendars.
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
              {macroUpcoming.length === 0 ? (
                <div className="text-[#525252] px-2 py-3">No upcoming rows</div>
              ) : (
                macroUpcoming.map((e) => (
                  <div
                    key={`${e.date}-${e.tag}`}
                    className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-[#111]"
                  >
                    <span
                      className="text-[7px] font-bold px-1 py-0.5 rounded border border-[#2a2a2a] shrink-0"
                      style={{ color: tagColors[e.tag] ?? "#888" }}
                    >
                      {e.tag}
                    </span>
                    <span className="text-[#737373] tabular-nums shrink-0">
                      {e.date}
                    </span>
                    <span className="text-[#a3a3a3] truncate">{e.title}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded border border-[#1e1e1e] bg-[#080808] p-2 shrink-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-bold text-[#555] tracking-widest uppercase">
                OPEX days
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setCalMonth((c) => {
                      let { y, m } = c;
                      m--;
                      if (m < 0) {
                        m = 11;
                        y--;
                      }
                      return { y, m };
                    })
                  }
                  className="px-1.5 py-0.5 rounded bg-[#161616] border border-[#2a2a2a] text-[#888] hover:text-[#f0f0f0] text-[9px]"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCalMonth((c) => {
                      let { y, m } = c;
                      m++;
                      if (m > 11) {
                        m = 0;
                        y++;
                      }
                      return { y, m };
                    })
                  }
                  className="px-1.5 py-0.5 rounded bg-[#161616] border border-[#2a2a2a] text-[#888] hover:text-[#f0f0f0] text-[9px]"
                >
                  ›
                </button>
              </div>
            </div>
            <div className="text-center text-[10px] text-[#888] mb-1">
              {monthTitle}
            </div>
            <div className="grid grid-cols-7 gap-px text-[7px] text-[#555] text-center mb-0.5">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <div key={i}>{d}</div>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-px">
                {week.map((day, di) => {
                  if (day == null)
                    return <div key={di} className="h-6" />;
                  const isOpexFri = opexDaysInMonth.has(day);
                  const isThird = thirdFridaysInMonth.has(day);
                  const isToday =
                    day === now.getDate() &&
                    calMonth.m === now.getMonth() &&
                    calMonth.y === now.getFullYear();
                  return (
                    <div
                      key={di}
                      className={`h-6 flex items-center justify-center rounded text-[9px] border ${
                        isToday
                          ? "border-[#00ff88]/60 bg-[#00ff8812] text-[#00ff88]"
                          : isThird
                            ? "border-[#f5a623]/50 bg-[#f5a62318] text-[#f5a623]"
                            : isOpexFri
                              ? "border-[#444] bg-[#1a1208] text-[#b45309]"
                              : "border-transparent bg-[#0d0d0d] text-[#666]"
                      }`}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>
            ))}
            <div className="flex gap-3 mt-1.5 text-[7px] text-[#525252] justify-center">
              <span>
                <span className="text-[#f5a623]">■</span> 3rd Fri
              </span>
              <span>
                <span className="text-[#b45309]">■</span> Fri
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: Globe + World news */}
      <div className="shrink-0 flex flex-col gap-2 max-h-[48vh] min-h-0 overflow-y-auto">
        <div className="text-[9px] font-bold tracking-widest text-[#555] uppercase px-0.5">
          World news
        </div>
        <StatusBadge
          status={resilientNews.status}
          updatedAt={resilientNews.updatedAt}
          onRetry={() => void loadNews()}
        />
        <div className="flex flex-wrap gap-1 pb-1">
          {(
            [
              "ALL",
              "CONFLICT",
              "TENSION",
              "SANCTIONS",
              "WARS",
              "CRISES",
            ] as const
          ).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setNewsFilter(f)}
              className={`px-2 py-0.5 rounded text-[8px] font-bold tracking-wide border transition-colors ${
                newsFilter === f
                  ? "border-[#00ff88]/50 bg-[#00ff8814] text-[#00ff88]"
                  : "border-[#2a2a2a] bg-[#111] text-[#666] hover:text-[#a3a3a3]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {filteredHeadlines.length === 0 ? (
            <div className="text-[#525252] py-2">No headlines match filter.</div>
          ) : (
            filteredHeadlines.map((h) => {
              const tags = headlineTags(h.title).filter((t) => t !== "ALL");
              const primary = tags[0] ?? "MACRO";
              const region = headlineRegion(h.title);
              const border =
                h.sentiment === "bullish"
                  ? "border-l-emerald-500"
                  : h.sentiment === "bearish"
                    ? "border-l-rose-500"
                    : "border-l-amber-500/80";
              return (
                <div
                  key={h.id}
                  className={`flex gap-2 pl-2 py-1.5 rounded-r border border-[#1a1a1a] border-l-2 bg-[#0a0a0a] ${border}`}
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-[#1a1a1a] text-[#06b6d4]">
                        {primary}
                      </span>
                      <span className="text-[7px] text-[#525252]">{region}</span>
                      <span className="text-[7px] text-[#3f3f3f]">{h.time}</span>
                    </div>
                    <div className="text-[10px] text-[#d4d4d4] leading-snug">
                      {h.title}
                    </div>
                    <div className="text-[8px] text-[#525252] line-clamp-2">
                      {h.source} · sentiment {h.sentiment}
                    </div>
                  </div>
                  <a
                    href={headlineHref(h)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 self-center text-[8px] font-bold text-[#06b6d4] hover:text-[#22d3ee] underline decoration-[#333]"
                  >
                    {h.url ? "SOURCE ↗" : "OPEN SOURCE ↗"}
                  </a>
                </div>
              );
            })
          )}
        </div>

        <GlobeRiskPreview />
      </div>
    </div>
  );
}
