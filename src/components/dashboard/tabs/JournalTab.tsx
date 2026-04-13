"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDrop } from "react-dnd";
import { NativeTypes } from "react-dnd-html5-backend";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ScatterChart,
  Scatter,
} from "recharts";
import { Plus, Trash2, Download, Eraser } from "lucide-react";
import { toast } from "sonner";
import {
  loadGallerySlotsFromIdb,
  migrateGalleryFromLocalStorage,
  saveGallerySlotsToIdb,
} from "@/lib/journal-gallery-idb";

const STORAGE_KEY = "bex-journal-trades-v2";
const LEGACY_JOURNAL_KEY = "bex-journal";
const LEGACY_IMPORT_FLAG = "bex-journal-legacy-imported";
const GALLERY_SLOTS = 8;

function normGallerySlots(next: (string | null)[]): (string | null)[] {
  return Array.from({ length: GALLERY_SLOTS }, (_, i) => next[i] ?? null);
}

type JournalSubTab =
  | "journal"
  | "equity"
  | "mae"
  | "gallery"
  | "calendar";

type LogFilter = "ALL" | "TODAY" | "WEEK" | "MONTH" | "PICK";

interface Trade {
  id: string;
  date: string;
  direction: "long" | "short";
  entryPrice: number;
  stopLoss: number;
  exitPrice: number;
  contracts: number;
  mae: number;
  mfe: number;
  setupGrade: string;
  outcome: "win" | "loss" | "be";
  pnl: number;
  rr: string;
  notes: string;
}

const emptyForm = {
  date: new Date().toISOString().split("T")[0],
  direction: "long" as "long" | "short",
  entryPrice: "",
  stopLoss: "",
  exitPrice: "",
  contracts: "",
  mae: "",
  mfe: "",
  setupGrade: "B",
  outcome: "win" as "win" | "loss" | "be",
  pnl: "",
  rr: "",
  notes: "",
};

function loadTrades(): Trade[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as Trade[];
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function saveTrades(trades: Trade[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
}

interface LegacyJournalEntry {
  id?: string;
  date?: string;
  ticker?: string;
  type?: string;
  tag?: string;
  content?: string;
  pnl?: number;
}

function convertLegacyEntry(row: unknown): Trade | null {
  if (!row || typeof row !== "object") return null;
  const e = row as LegacyJournalEntry;
  if (e.type !== "long" && e.type !== "short" && e.type !== "note") return null;
  const date =
    typeof e.date === "string" && e.date.length >= 8
      ? e.date.slice(0, 10)
      : new Date().toISOString().split("T")[0];
  const direction: "long" | "short" = e.type === "short" ? "short" : "long";
  const pnl = Number(e.pnl) || 0;
  const outcome: "win" | "loss" | "be" =
    pnl > 0 ? "win" : pnl < 0 ? "loss" : "be";
  const noteParts = [
    e.type === "note" ? `[NOTE ${String(e.tag ?? "neutral")}]` : "",
    String(e.ticker ?? "—"),
    String(e.content ?? ""),
  ].filter(Boolean);
  return {
    id: `mig-${String(e.id ?? Date.now())}`,
    date,
    direction,
    entryPrice: 0,
    stopLoss: 0,
    exitPrice: 0,
    contracts: 1,
    mae: 0,
    mfe: 0,
    setupGrade: "B",
    outcome,
    pnl,
    rr: "—",
    notes: noteParts.join(" · ").slice(0, 2000),
  };
}

/** One-time import from pre-v2 journal when v2 store is empty. */
function migrateLegacyIfNeeded(): Trade[] {
  if (typeof window === "undefined") return [];
  if (localStorage.getItem(LEGACY_IMPORT_FLAG)) return [];
  const raw = localStorage.getItem(LEGACY_JOURNAL_KEY);
  if (!raw) {
    localStorage.setItem(LEGACY_IMPORT_FLAG, "1");
    return [];
  }
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) {
      localStorage.setItem(LEGACY_IMPORT_FLAG, "1");
      return [];
    }
    const current = loadTrades();
    if (current.length > 0) {
      localStorage.setItem(LEGACY_IMPORT_FLAG, "1");
      return [];
    }
    const converted: Trade[] = [];
    for (const row of arr) {
      const t = convertLegacyEntry(row);
      if (t) converted.push(t);
    }
    localStorage.setItem(LEGACY_IMPORT_FLAG, "1");
    return converted;
  } catch {
    localStorage.setItem(LEGACY_IMPORT_FLAG, "1");
    return [];
  }
}

function compressImageToDataUrl(file: File): Promise<string | null> {
  if (!file.type.startsWith("image/")) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new window.Image();
    const u = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(u);
      const maxW = 900;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w < 1 || h < 1) {
        resolve(null);
        return;
      }
      if (w > maxW) {
        h = (h * maxW) / w;
        w = maxW;
      }
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w);
      canvas.height = Math.round(h);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      let quality = 0.88;
      let data = canvas.toDataURL("image/jpeg", quality);
      while (data.length > 480_000 && quality > 0.42) {
        quality -= 0.06;
        data = canvas.toDataURL("image/jpeg", quality);
      }
      if (data.length > 550_000) {
        resolve(null);
        return;
      }
      resolve(data);
    };
    img.onerror = () => {
      URL.revokeObjectURL(u);
      resolve(null);
    };
    img.src = u;
  });
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function inFilter(t: Trade, f: LogFilter, pick: string): boolean {
  const td = startOfDay(new Date(t.date + "T12:00:00"));
  const now = new Date();
  if (f === "ALL") return true;
  if (f === "PICK") return t.date === pick;
  if (f === "TODAY") {
    const n = startOfDay(now);
    return td.getTime() === n.getTime();
  }
  if (f === "WEEK") {
    const n = startOfDay(now);
    const diff = (n.getTime() - td.getTime()) / 86_400_000;
    return diff >= 0 && diff < 7;
  }
  if (f === "MONTH") {
    return (
      td.getMonth() === now.getMonth() &&
      td.getFullYear() === now.getFullYear()
    );
  }
  return true;
}

function tradesToCsv(rows: Trade[]): string {
  const h = [
    "DATE",
    "DIR",
    "ENTRY",
    "STOP",
    "EXIT",
    "CTS",
    "MAE",
    "MFE",
    "GRADE",
    "OUTCOME",
    "R:R",
    "P_L",
    "NOTES",
  ];
  const lines = [h.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.date,
        r.direction,
        r.entryPrice,
        r.stopLoss,
        r.exitPrice,
        r.contracts,
        r.mae,
        r.mfe,
        r.setupGrade,
        r.outcome,
        `"${String(r.rr).replace(/"/g, '""')}"`,
        r.pnl,
        `"${String(r.notes).replace(/"/g, '""')}"`,
      ].join(",")
    );
  }
  return lines.join("\n");
}

type OcrExtract = Partial<{
  date: string;
  direction: "long" | "short";
  entryPrice: string;
  stopLoss: string;
  exitPrice: string;
  contracts: string;
}>;

function parseOcrText(raw: string): OcrExtract {
  const txt = raw.replace(/\s+/g, " ").trim();
  const lower = txt.toLowerCase();
  const pick = (re: RegExp): string | null => {
    const m = txt.match(re);
    return m?.[1] ?? null;
  };
  const out: OcrExtract = {};

  const ymd = txt.match(/\b(20\d{2})[./-](\d{1,2})[./-](\d{1,2})\b/);
  const dmy = txt.match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/);
  if (ymd) {
    const y = Number(ymd[1]);
    const m = Number(ymd[2]);
    const d = Number(ymd[3]);
    out.date = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(
      2,
      "0"
    )}`;
  } else if (dmy) {
    const d = Number(dmy[1]);
    const m = Number(dmy[2]);
    const y = Number(dmy[3]);
    out.date = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(
      2,
      "0"
    )}`;
  }

  if (/\b(short|sell|put)\b/i.test(lower)) out.direction = "short";
  else if (/\b(long|buy|call)\b/i.test(lower)) out.direction = "long";

  const price =
    "(\\d{1,5}(?:[.,]\\d{1,4})?)";
  const normNum = (s: string | null) => (s ? s.replace(",", ".") : null);
  out.entryPrice = normNum(
    pick(new RegExp(`(?:entry|fill|avg(?:\\s*price)?)\\s*[:=]?\\s*\\$?${price}`, "i"))
  ) ?? undefined;
  out.stopLoss = normNum(
    pick(new RegExp(`(?:stop(?:\\s*loss)?|\\bsl\\b)\\s*[:=]?\\s*\\$?${price}`, "i"))
  ) ?? undefined;
  out.exitPrice = normNum(
    pick(new RegExp(`(?:exit|close|take\\s*profit|\\btp\\b)\\s*[:=]?\\s*\\$?${price}`, "i"))
  ) ?? undefined;
  out.contracts =
    pick(/(?:contracts?|qty|size)\s*[:=]?\s*(\d{1,5})/i) ?? undefined;

  return out;
}

export default function JournalTab() {
  const [sub, setSub] = useState<JournalSubTab>("journal");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [logFilter, setLogFilter] = useState<LogFilter>("ALL");
  const [pickDate, setPickDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [calMonth, setCalMonth] = useState(() => ({
    y: new Date().getFullYear(),
    m: new Date().getMonth(),
  }));
  const [gallerySlots, setGallerySlots] = useState<(string | null)[]>(() =>
    normGallerySlots([])
  );
  const [galleryErr, setGalleryErr] = useState<string | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const t = window.setTimeout(() => {
      const migrated = migrateLegacyIfNeeded();
      let initial = loadTrades();
      if (migrated.length > 0) {
        initial = [...migrated, ...initial];
        saveTrades(initial);
      }
      if (alive) setTrades(initial);
      void (async () => {
        await migrateGalleryFromLocalStorage();
        const slots = await loadGallerySlotsFromIdb();
        if (alive) setGallerySlots(slots);
      })();
    }, 0);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, []);

  const persist = useCallback((next: Trade[]) => {
    setTrades(next);
    saveTrades(next);
  }, []);

  const persistGallery = useCallback(async (next: (string | null)[]) => {
    const norm = normGallerySlots(next);
    setGallerySlots(norm);
    await saveGallerySlotsToIdb(norm);
  }, []);

  const onGalleryFile = useCallback(
    async (index: number, file: File | null) => {
      setGalleryErr(null);
      if (!file) return;
      const data = await compressImageToDataUrl(file);
      if (!data) {
        setGalleryErr("Image too large or unreadable (try under ~500KB).");
        return;
      }
      const next = [...gallerySlots];
      next[index] = data;
      await persistGallery(next);
    },
    [gallerySlots, persistGallery]
  );

  const onGalleryPaste = useCallback(
    async (blob: Blob) => {
      setGalleryErr(null);
      const idx = gallerySlots.findIndex((x) => !x);
      if (idx < 0) {
        setGalleryErr("All gallery slots are full. Clear a slot first.");
        return;
      }
      const file = new File([blob], `paste-${Date.now()}.png`, {
        type: blob.type || "image/png",
      });
      const data = await compressImageToDataUrl(file);
      if (!data) {
        setGalleryErr("Pasted image is too large or unreadable.");
        return;
      }
      const next = [...gallerySlots];
      next[idx] = data;
      await persistGallery(next);
    },
    [gallerySlots, persistGallery]
  );

  useEffect(() => {
    if (sub !== "gallery") return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const blob = item.getAsFile();
          if (!blob) return;
          e.preventDefault();
          void onGalleryPaste(blob);
          return;
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [sub, onGalleryPaste]);

  const clearGallerySlot = useCallback(
    (index: number) => {
      const next = [...gallerySlots];
      next[index] = null;
      void persistGallery(next);
      setGalleryErr(null);
    },
    [gallerySlots, persistGallery]
  );

  const runOcrAutofill = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast.warning("OCR expects an image file.");
        return;
      }
      setOcrBusy(true);
      toast.loading("Running OCR...", { id: "journal-ocr" });
      try {
        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker("eng");
        const res = await worker.recognize(file);
        await worker.terminate();
        const extracted = parseOcrText(res.data.text || "");
        const hits = Object.keys(extracted).length;
        if (hits === 0) {
          toast.warning("OCR finished, but no form fields were detected.", {
            id: "journal-ocr",
          });
          return;
        }
        setForm((prev) => ({
          ...prev,
          date: extracted.date ?? prev.date,
          direction: extracted.direction ?? prev.direction,
          entryPrice: extracted.entryPrice ?? prev.entryPrice,
          stopLoss: extracted.stopLoss ?? prev.stopLoss,
          exitPrice: extracted.exitPrice ?? prev.exitPrice,
          contracts: extracted.contracts ?? prev.contracts,
          notes:
            prev.notes.trim().length > 0
              ? prev.notes
              : "[OCR] Please verify extracted values before saving.",
        }));
        toast.success(`OCR applied (${hits} fields).`, { id: "journal-ocr" });
      } catch {
        toast.error("OCR failed. Try another screenshot.", { id: "journal-ocr" });
      } finally {
        setOcrBusy(false);
      }
    },
    []
  );

  const [{ isOver }, journalDropRef] = useDrop(
    () => ({
      accept: [NativeTypes.FILE],
      drop: (item: { files?: File[] }) => {
        const f = item.files?.find((x) => x.type.startsWith("image/"));
        if (f) {
          void runOcrAutofill(f);
        }
      },
      collect: (monitor) => ({
        isOver: monitor.isOver(),
      }),
    }),
    [runOcrAutofill]
  );

  const addTrade = () => {
    const entry = Number(form.entryPrice);
    const stop = Number(form.stopLoss);
    const exit = Number(form.exitPrice);
    const cts = Number(form.contracts);
    if (!form.date || !Number.isFinite(entry) || !Number.isFinite(cts)) return;
    const row: Trade = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: form.date,
      direction: form.direction,
      entryPrice: entry,
      stopLoss: Number.isFinite(stop) ? stop : 0,
      exitPrice: Number.isFinite(exit) ? exit : entry,
      contracts: cts,
      mae: Number(form.mae) || 0,
      mfe: Number(form.mfe) || 0,
      setupGrade: form.setupGrade,
      outcome: form.outcome,
      pnl: Number(form.pnl) || 0,
      rr: form.rr.trim() || "—",
      notes: form.notes.trim(),
    };
    persist([row, ...trades]);
    setForm({ ...emptyForm, date: form.date });
  };

  const clearAll = () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Clear all trades from this device?")
    )
      return;
    persist([]);
  };

  const exportCsv = () => {
    const blob = new Blob([tradesToCsv(trades)], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bex-trades-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const filtered = useMemo(
    () =>
      trades
        .filter((t) => inFilter(t, logFilter, pickDate))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [trades, logFilter, pickDate]
  );

  const equitySeries = useMemo(() => {
    const sorted = [...trades].sort(
      (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
    );
    const sums: number[] = [];
    for (let i = 0; i < sorted.length; i++) {
      sums.push((sums[i - 1] ?? 0) + sorted[i].pnl);
    }
    return sorted.map((t, i) => ({
      i: i + 1,
      date: t.date,
      pnl: sums[i] ?? 0,
      trade: t.id,
    }));
  }, [trades]);

  const maePoints = useMemo(
    () =>
      trades.map((t) => ({
        mae: t.mae,
        mfe: t.mfe,
        outcome: t.outcome,
        id: t.id,
      })),
    [trades]
  );

  const scatterFill = (o: string) =>
    o === "win" ? "#4ade80" : o === "loss" ? "#f87171" : "#fbbf24";

  const tradeDays = useMemo(() => {
    const s = new Set<string>();
    for (const t of trades) s.add(t.date);
    return s;
  }, [trades]);

  const { weeks } = useMemo(() => {
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
    return { weeks: w };
  }, [calMonth]);

  const now = new Date();
  const monthTitle = new Date(calMonth.y, calMonth.m).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  const subBtn = (id: JournalSubTab, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setSub(id)}
      className={`px-2 py-1 rounded text-[9px] font-bold tracking-wide border transition-colors shrink-0 ${
        sub === id
          ? "border-[#00ff88]/40 bg-[#00ff8814] text-[#00ff88]"
          : "border-[#262626] bg-[#0a0a0a] text-[#737373] hover:text-[#a3a3a3]"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="h-full flex flex-col overflow-hidden p-2 gap-2 min-h-0">
      <div className="flex flex-wrap items-center gap-1 shrink-0">
        {subBtn("journal", "Trade Journal")}
        {subBtn("equity", "Equity Curve")}
        {subBtn("mae", "MAE / MFE")}
        {subBtn("gallery", "Gallery")}
        {subBtn("calendar", "Calendar")}
      </div>

      {sub === "journal" && (
        <>
          <div className="rounded border border-[#1e1e1e] bg-[#0a0a0a] p-2 space-y-2 shrink-0 overflow-y-auto max-h-[42vh]">
            <div
              ref={(node) => {
                void journalDropRef(node);
              }}
              className={`rounded border border-dashed px-2 py-2 text-[9px] transition-colors ${
                isOver
                  ? "border-[#06b6d4] bg-[#06b6d41a] text-[#67e8f9]"
                  : "border-[#2a2a2a] bg-[#0d0d0d] text-[#666]"
              }`}
            >
              <div>
                Drag & drop screenshot here for OCR autofill (Date/Dir/Entry/Stop/Exit/Contracts)
              </div>
              <div className="mt-0.5 text-[8px] text-[#555]">
                {ocrBusy ? "OCR running..." : "Runs locally via tesseract.js (lazy loaded)."}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 text-[9px]">
              <label className="text-[#525252] col-span-1">
                DATE
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="mt-0.5 w-full bg-black border border-[#2a2a2a] rounded px-1.5 py-1 text-[#e5e5e5]"
                />
              </label>
              <label className="text-[#525252]">
                DIRECTION
                <select
                  value={form.direction}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      direction: e.target.value as "long" | "short",
                    })
                  }
                  className="mt-0.5 w-full bg-black border border-[#2a2a2a] rounded px-1.5 py-1 text-[#e5e5e5]"
                >
                  <option value="long">LONG</option>
                  <option value="short">SHORT</option>
                </select>
              </label>
              <label className="text-[#525252]">
                ENTRY PRICE
                <input
                  value={form.entryPrice}
                  onChange={(e) =>
                    setForm({ ...form, entryPrice: e.target.value })
                  }
                  inputMode="decimal"
                  className="mt-0.5 w-full bg-black border border-[#2a2a2a] rounded px-1.5 py-1 text-[#e5e5e5]"
                />
              </label>
              <label className="text-[#525252]">
                STOP LOSS
                <input
                  value={form.stopLoss}
                  onChange={(e) =>
                    setForm({ ...form, stopLoss: e.target.value })
                  }
                  inputMode="decimal"
                  className="mt-0.5 w-full bg-black border border-[#2a2a2a] rounded px-1.5 py-1 text-[#e5e5e5]"
                />
              </label>
              <label className="text-[#525252]">
                EXIT PRICE
                <input
                  value={form.exitPrice}
                  onChange={(e) =>
                    setForm({ ...form, exitPrice: e.target.value })
                  }
                  inputMode="decimal"
                  className="mt-0.5 w-full bg-black border border-[#2a2a2a] rounded px-1.5 py-1 text-[#e5e5e5]"
                />
              </label>
              <label className="text-[#525252]">
                CONTRACTS
                <input
                  value={form.contracts}
                  onChange={(e) =>
                    setForm({ ...form, contracts: e.target.value })
                  }
                  inputMode="numeric"
                  className="mt-0.5 w-full bg-black border border-[#2a2a2a] rounded px-1.5 py-1 text-[#e5e5e5]"
                />
              </label>
              <label className="text-[#525252]">
                MAE
                <input
                  value={form.mae}
                  onChange={(e) => setForm({ ...form, mae: e.target.value })}
                  inputMode="decimal"
                  className="mt-0.5 w-full bg-black border border-[#2a2a2a] rounded px-1.5 py-1 text-[#e5e5e5]"
                />
              </label>
              <label className="text-[#525252]">
                MFE
                <input
                  value={form.mfe}
                  onChange={(e) => setForm({ ...form, mfe: e.target.value })}
                  inputMode="decimal"
                  className="mt-0.5 w-full bg-black border border-[#2a2a2a] rounded px-1.5 py-1 text-[#e5e5e5]"
                />
              </label>
              <label className="text-[#525252]">
                SETUP GRADE
                <select
                  value={form.setupGrade}
                  onChange={(e) =>
                    setForm({ ...form, setupGrade: e.target.value })
                  }
                  className="mt-0.5 w-full bg-black border border-[#2a2a2a] rounded px-1.5 py-1 text-[#e5e5e5]"
                >
                  {["A+", "A", "B", "C", "D"].map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[#525252]">
                OUTCOME
                <select
                  value={form.outcome}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      outcome: e.target.value as "win" | "loss" | "be",
                    })
                  }
                  className="mt-0.5 w-full bg-black border border-[#2a2a2a] rounded px-1.5 py-1 text-[#e5e5e5]"
                >
                  <option value="win">WIN</option>
                  <option value="loss">LOSS</option>
                  <option value="be">BE</option>
                </select>
              </label>
              <label className="text-[#525252]">
                P&amp;L ($)
                <input
                  value={form.pnl}
                  onChange={(e) => setForm({ ...form, pnl: e.target.value })}
                  inputMode="decimal"
                  className="mt-0.5 w-full bg-black border border-[#2a2a2a] rounded px-1.5 py-1 text-[#e5e5e5]"
                />
              </label>
              <label className="text-[#525252]">
                R:R
                <input
                  value={form.rr}
                  onChange={(e) => setForm({ ...form, rr: e.target.value })}
                  placeholder="2:1"
                  className="mt-0.5 w-full bg-black border border-[#2a2a2a] rounded px-1.5 py-1 text-[#e5e5e5]"
                />
              </label>
            </div>
            <label className="block text-[9px] text-[#525252]">
              NOTES
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="mt-0.5 w-full bg-black border border-[#2a2a2a] rounded px-1.5 py-1 text-[#e5e5e5] resize-none text-[10px]"
              />
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={addTrade}
                className="flex items-center gap-1 px-2 py-1 rounded bg-[#161616] border border-[#333] text-[9px] font-bold text-[#f0f0f0] hover:bg-[#222]"
              >
                <Plus className="w-3 h-3" /> Add Trade
              </button>
              <button
                type="button"
                onClick={exportCsv}
                className="flex items-center gap-1 px-2 py-1 rounded bg-[#161616] border border-[#333] text-[9px] font-bold text-[#a3a3a3] hover:text-[#f0f0f0]"
              >
                <Download className="w-3 h-3" /> Export CSV
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="flex items-center gap-1 px-2 py-1 rounded bg-[#1a0a0a] border border-[#442222] text-[9px] font-bold text-rose-400/90 hover:bg-[#221010]"
              >
                <Eraser className="w-3 h-3" /> Clear All
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 flex flex-col rounded border border-[#1e1e1e] bg-[#080808] overflow-hidden">
            <div className="px-2 py-1 border-b border-[#1a1a1a] flex flex-wrap items-center gap-1 shrink-0">
              <span className="text-[9px] font-bold text-[#555] tracking-widest uppercase mr-1">
                Trade log
              </span>
              {(
                ["ALL", "TODAY", "WEEK", "MONTH", "PICK"] as const
              ).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setLogFilter(f)}
                  className={`px-1.5 py-0.5 rounded text-[8px] font-bold border ${
                    logFilter === f
                      ? "border-[#00ff88]/40 text-[#00ff88] bg-[#00ff8810]"
                      : "border-[#2a2a2a] text-[#666] hover:text-[#999]"
                  }`}
                >
                  {f === "PICK" ? "Pick Date" : f.replace("_", " ")}
                </button>
              ))}
              {logFilter === "PICK" && (
                <input
                  type="date"
                  value={pickDate}
                  onChange={(e) => setPickDate(e.target.value)}
                  className="bg-black border border-[#333] rounded px-1 py-0.5 text-[9px] text-[#ccc]"
                />
              )}
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-[8px] font-mono border-collapse min-w-[720px]">
                <thead className="sticky top-0 bg-[#0d0d0d] z-[1] text-[#525252] uppercase">
                  <tr>
                    {[
                      "DATE",
                      "DIR",
                      "ENTRY",
                      "STOP",
                      "EXIT",
                      "CTS",
                      "MAE",
                      "MFE",
                      "GRADE",
                      "OUT",
                      "R:R",
                      "P&L",
                      "NOTES",
                      "",
                    ].map((c) => (
                      <th key={c} className="px-1 py-1 border-b border-[#222]">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={14}
                        className="px-2 py-6 text-center text-[#525252]"
                      >
                        No trades for this filter.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b border-[#141414] hover:bg-[#0c0c0c]"
                      >
                        <td className="px-1 py-0.5 text-[#a3a3a3]">{t.date}</td>
                        <td
                          className={
                            t.direction === "long"
                              ? "text-emerald-400"
                              : "text-rose-400"
                          }
                        >
                          {t.direction.toUpperCase()}
                        </td>
                        <td className="px-1 text-[#ccc]">{t.entryPrice}</td>
                        <td className="px-1 text-[#888]">{t.stopLoss}</td>
                        <td className="px-1 text-[#ccc]">{t.exitPrice}</td>
                        <td className="px-1">{t.contracts}</td>
                        <td className="px-1 text-rose-300/80">{t.mae}</td>
                        <td className="px-1 text-emerald-300/80">{t.mfe}</td>
                        <td className="px-1 text-amber-400/90">{t.setupGrade}</td>
                        <td className="px-1 uppercase text-[#888]">
                          {t.outcome}
                        </td>
                        <td className="px-1 text-[#737373]">{t.rr}</td>
                        <td
                          className={
                            t.pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                          }
                        >
                          {t.pnl >= 0 ? "+" : ""}
                          {t.pnl}
                        </td>
                        <td className="px-1 max-w-[140px] truncate text-[#666]">
                          {t.notes}
                        </td>
                        <td className="px-0.5">
                          <button
                            type="button"
                            onClick={() =>
                              persist(trades.filter((x) => x.id !== t.id))
                            }
                            className="p-0.5 text-[#444] hover:text-rose-400"
                            aria-label="Delete trade"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {sub === "equity" && (
        <div className="flex-1 min-h-[240px] rounded border border-[#1e1e1e] bg-[#0a0a0a] p-2">
          {equitySeries.length === 0 ? (
            <div className="h-full flex items-center justify-center text-[10px] text-[#525252] font-mono">
              Add trades to see cumulative P&amp;L.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={equitySeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                <XAxis dataKey="i" tick={{ fill: "#525252", fontSize: 9 }} />
                <YAxis tick={{ fill: "#525252", fontSize: 9 }} />
                <Tooltip
                  cursor={false}
                  contentStyle={{
                    background: "#111",
                    border: "1px solid #333",
                    fontSize: 10,
                    fontFamily: "monospace",
                  }}
                  formatter={(v) => [
                    `$${Number(v ?? 0).toFixed(2)}`,
                    "Cum P&L",
                  ]}
                  labelFormatter={(l) => `Trade #${l}`}
                />
                <Line
                  type="monotone"
                  dataKey="pnl"
                  stroke="#00ff88"
                  strokeWidth={1.5}
                  dot={{ r: 2, fill: "#00ff88" }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {sub === "mae" && (
        <div className="flex-1 min-h-[240px] rounded border border-[#1e1e1e] bg-[#0a0a0a] p-2">
          {maePoints.length === 0 ? (
            <div className="h-full flex items-center justify-center text-[10px] text-[#525252] font-mono">
              MAE vs MFE scatter needs trade rows.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                <XAxis
                  type="number"
                  dataKey="mae"
                  name="MAE"
                  tick={{ fill: "#525252", fontSize: 9 }}
                />
                <YAxis
                  type="number"
                  dataKey="mfe"
                  name="MFE"
                  tick={{ fill: "#525252", fontSize: 9 }}
                />
                <Tooltip
                  cursor={false}
                  contentStyle={{
                    background: "#111",
                    border: "1px solid #333",
                    fontSize: 10,
                    fontFamily: "monospace",
                  }}
                />
                <Scatter
                  data={maePoints}
                  shape={(props: {
                    cx?: number;
                    cy?: number;
                    payload?: { outcome: string };
                  }) => {
                    const { cx = 0, cy = 0, payload } = props;
                    const fill = scatterFill(payload?.outcome ?? "be");
                    return <circle cx={cx} cy={cy} r={5} fill={fill} opacity={0.85} />;
                  }}
                />
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {sub === "gallery" && (
        <div className="flex-1 min-h-0 flex flex-col gap-2 p-1">
          <p className="text-[9px] text-[#525252] font-mono px-0.5">
            Local only (JPEG, resized ~900px wide). Stored in{" "}
            <code className="text-[#666]">IndexedDB</code> (this device) — old
            localStorage gallery migrates once automatically.
          </p>
          <div className="rounded border border-[#1f1f1f] bg-[#0c0c0c] px-2 py-1.5 text-[9px] font-mono text-[#7a7a7a]">
            Paste enabled: press <span className="text-[#cfcfcf]">Ctrl/Cmd+V</span>{" "}
            to drop clipboard screenshots into the first empty slot.
          </div>
          {galleryErr && (
            <p className="text-[9px] text-rose-400/90 font-mono px-0.5">
              {galleryErr}
            </p>
          )}
          <div className="flex-1 min-h-0 grid grid-cols-2 sm:grid-cols-4 gap-2 overflow-y-auto">
            {gallerySlots.map((src, i) => (
              <div
                key={i}
                className="relative aspect-video rounded border border-[#2a2a2a] bg-[#080808] overflow-hidden group"
              >
                {src ? (
                  // data URLs from IndexedDB — next/image not a fit here
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={src}
                    alt={`Screenshot ${i + 1}`}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-[8px] text-[#3f3f3f] font-mono text-center px-1">
                    Slot {i + 1}
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 flex gap-0.5 p-1 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity">
                  <label className="flex-1 text-center text-[8px] font-bold text-[#06b6d4] cursor-pointer hover:text-[#22d3ee]">
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        void onGalleryFile(i, f ?? null);
                      }}
                    />
                  </label>
                  {src && (
                    <button
                      type="button"
                      onClick={() => clearGallerySlot(i)}
                      className="flex-1 text-[8px] font-bold text-rose-400/90 hover:text-rose-300"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {sub === "calendar" && (
        <div className="flex-1 min-h-0 flex flex-col rounded border border-[#1e1e1e] bg-[#0a0a0a] p-2 overflow-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-[#666] tracking-widest uppercase">
              Trades on calendar
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
                className="px-1.5 py-0.5 rounded bg-[#161616] border border-[#333] text-[#888] text-[9px]"
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
                className="px-1.5 py-0.5 rounded bg-[#161616] border border-[#333] text-[#888] text-[9px]"
              >
                ›
              </button>
            </div>
          </div>
          <div className="text-center text-[11px] text-[#a3a3a3] mb-1 font-mono">
            {monthTitle}
          </div>
          <div className="grid grid-cols-7 gap-px text-[8px] text-[#555] text-center mb-0.5 font-mono">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-px">
              {week.map((day, di) => {
                if (day == null) return <div key={di} className="h-8" />;
                const iso = `${calMonth.y}-${String(calMonth.m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const has = tradeDays.has(iso);
                const isToday =
                  day === now.getDate() &&
                  calMonth.m === now.getMonth() &&
                  calMonth.y === now.getFullYear();
                return (
                  <div
                    key={di}
                    className={`h-8 flex flex-col items-center justify-center rounded border text-[9px] font-mono ${
                      isToday
                        ? "border-[#00ff88]/50 bg-[#00ff8810] text-[#00ff88]"
                        : has
                          ? "border-[#06b6d4]/40 bg-[#06b6d415] text-[#e5e5e5]"
                          : "border-transparent bg-[#0d0d0d] text-[#555]"
                    }`}
                  >
                    {day}
                    {has && (
                      <span className="text-[6px] text-[#06b6d4]">●</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
