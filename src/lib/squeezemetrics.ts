const DIX_CSV_URL = "https://squeezemetrics.com/monitor/static/DIX.csv";

export interface SqueezeMetricsSnapshot {
  gexBillions: number;
  gexPrevBillions: number;
  gexMa5Billions: number;
  dixPct: number;
  date: string;
}

function parseNumber(v: string | undefined): number {
  if (v == null || v === "") return NaN;
  const n = Number(String(v).trim().replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Fetches SqueezeMetrics DIX monitor CSV (same source as legacy Streamlit app.py).
 */
export async function fetchSqueezeMetricsSnapshot(): Promise<SqueezeMetricsSnapshot | null> {
  try {
    const res = await fetch(DIX_CSV_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; BEX/1.0; +https://example.local)",
        Accept: "text/csv,*/*",
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const text = (await res.text()).replace(/^\uFEFF/, "");
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return null;

    const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
    const idx = (name: string) => header.indexOf(name);

    const iDate = idx("date");
    let iGex = idx("gex");
    let iDix = idx("dix");
    if (iGex < 0) iGex = header.findIndex((h) => h.includes("gex"));
    if (iDix < 0) iDix = header.findIndex((h) => h.includes("dix"));
    if (iGex < 0) return null;

    const rows: Record<string, string>[] = [];
    for (let r = 1; r < lines.length; r++) {
      const cols = lines[r].split(",");
      if (cols.length < header.length) continue;
      const row: Record<string, string> = {};
      header.forEach((h, j) => {
        row[h] = cols[j]?.trim() ?? "";
      });
      rows.push(row);
    }
    if (rows.length < 2) return null;

    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];

    const gexRaw = parseNumber(last[header[iGex]] ?? last["gex"]);
    const gexPrevRaw = parseNumber(prev[header[iGex]] ?? prev["gex"]);
    if (!Number.isFinite(gexRaw) || !Number.isFinite(gexPrevRaw)) return null;

    const gexBillions = gexRaw / 1e9;
    const gexPrevBillions = gexPrevRaw / 1e9;

    const tail = rows.slice(-5);
    const gexVals = tail
      .map((row) => parseNumber(row[header[iGex]] ?? row["gex"]))
      .filter((n) => Number.isFinite(n));
    const gexMa5 =
      gexVals.length > 0
        ? gexVals.reduce((a, b) => a + b, 0) / gexVals.length / 1e9
        : gexBillions;

    let dixPct = 0;
    if (iDix >= 0) {
      const d = parseNumber(last[header[iDix]] ?? last["dix"]);
      if (Number.isFinite(d)) dixPct = d <= 1 ? d * 100 : d;
    }

    const date =
      iDate >= 0
        ? last[header[iDate]] ?? ""
        : last[header[0]] ?? "";

    return {
      gexBillions,
      gexPrevBillions,
      gexMa5Billions: gexMa5,
      dixPct,
      date,
    };
  } catch {
    return null;
  }
}
