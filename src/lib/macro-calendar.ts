/**
 * US-style macro placeholders (not official Fed/BLS calendar).
 * Merges a small hand-tuned anchor list with generated NFP / CPI / FOMC-style rows.
 */

export type MacroEventRow = { date: string; tag: string; title: string };

const ANCHOR: MacroEventRow[] = [
  { date: "2026-04-29", tag: "FOMC", title: "FOMC (approx.)" },
  { date: "2026-06-17", tag: "FOMC", title: "FOMC (approx.)" },
  { date: "2026-07-29", tag: "FOMC", title: "FOMC (approx.)" },
  { date: "2026-09-16", tag: "FOMC", title: "FOMC (approx.)" },
  { date: "2026-10-28", tag: "FOMC", title: "FOMC (approx.)" },
  { date: "2026-12-09", tag: "FOMC", title: "FOMC (approx.)" },
];

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function toIsoLocal(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** First Friday of month (common NFP release day). */
function firstFriday(year: number, month0: number): Date {
  for (let day = 1; day <= 7; day++) {
    const t = new Date(year, month0, day);
    if (t.getDay() === 5) return startOfDay(t);
  }
  return startOfDay(new Date(year, month0, 1));
}

/** Second Tuesday of month (CPI often mid-month Tue). */
function secondTuesday(year: number, month0: number): Date {
  for (let day = 8; day <= 14; day++) {
    const t = new Date(year, month0, day);
    if (t.getDay() === 2) return startOfDay(t);
  }
  return startOfDay(new Date(year, month0, 10));
}

/** Last Wednesday of month — rough FOMC-style placeholder for some months. */
function lastWednesday(year: number, month0: number): Date | null {
  const fomcMonths = new Set([0, 2, 4, 5, 6, 8, 10]);
  if (!fomcMonths.has(month0)) return null;
  const last = new Date(year, month0 + 1, 0);
  const diff = (last.getDay() - 3 + 7) % 7;
  last.setDate(last.getDate() - diff);
  return startOfDay(last);
}

function generatedRows(from: Date, horizonMonths: number): MacroEventRow[] {
  const out: MacroEventRow[] = [];
  const start = startOfDay(from);
  let y = start.getFullYear();
  let m = start.getMonth();
  for (let i = 0; i < horizonMonths; i++) {
    const nfp = firstFriday(y, m);
    if (nfp.getTime() >= start.getTime()) {
      out.push({
        date: toIsoLocal(nfp),
        tag: "NFP",
        title: "Nonfarm payrolls (1st Fri · est.)",
      });
    }
    const cpi = secondTuesday(y, m);
    if (cpi.getTime() >= start.getTime()) {
      out.push({
        date: toIsoLocal(cpi),
        tag: "CPI",
        title: "CPI m/m (2nd Tue · est.)",
      });
    }
    const fomc = lastWednesday(y, m);
    if (fomc && fomc.getTime() >= start.getTime()) {
      out.push({
        date: toIsoLocal(fomc),
        tag: "FOMC",
        title: "FOMC-style Wed (last Wed · est.)",
      });
    }
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  return out;
}

/**
 * Upcoming macro rows from `from` (inclusive calendar day), deduped, sorted.
 */
export function getMacroEventsUpcoming(
  from: Date = new Date(),
  limit = 14,
  horizonMonths = 18
): MacroEventRow[] {
  const start = startOfDay(from).getTime();
  const map = new Map<string, MacroEventRow>();

  const push = (r: MacroEventRow) => {
    const t = new Date(`${r.date}T12:00:00`).getTime();
    if (t < start) return;
    const k = `${r.date}|${r.tag}`;
    if (!map.has(k)) map.set(k, r);
  };

  for (const r of ANCHOR) push(r);
  for (const r of generatedRows(from, horizonMonths)) push(r);

  return [...map.values()]
    .sort((a, b) => a.date.localeCompare(b.date) || a.tag.localeCompare(b.tag))
    .slice(0, limit);
}
