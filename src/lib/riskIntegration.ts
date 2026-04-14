import type { GlobePalette, RiskPoint, RiskType } from "@/components/maps/types";

type LegacyRiskItem = {
  lat?: number | string;
  lon?: number | string;
  type?: string;
  label?: string;
  body?: string;
  severity?: number | string;
  region?: string;
  sourceUrl?: string;
  sourceName?: string;
  publishedAt?: string;
};

type LegacyGlobeColors = {
  bg?: string;
  star?: string;
  sphereLight?: string;
  sphereMid?: string;
  sphereDark?: string;
  landFill?: string;
  landStroke?: string;
  coast?: string;
  grid?: string;
  conflict?: string;
  tension?: string;
  sanction?: string;
  hub?: string;
};

declare global {
  interface Window {
    WN_ITEMS?: unknown;
    globeColors?: unknown;
  }
}

const TYPE_MAP: Record<string, RiskType | null> = {
  conflict: "conflict",
  tension: "tension",
  sanction: "sanction",
  sanctions: "sanction",
  hub: "hub",
  hubs: "hub",
  webcam: "hub",
  webcams: "hub",
};

function normalizeRiskType(value: unknown): RiskType | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return TYPE_MAP[normalized] ?? null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readCssVar(name: string): string | undefined {
  try {
    if (typeof window === "undefined" || typeof document === "undefined") return undefined;
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || undefined;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeLegacyGlobeColors(): LegacyGlobeColors | undefined {
  try {
    if (typeof window === "undefined") return undefined;
    const raw = window.globeColors;
    return isRecord(raw) ? (raw as LegacyGlobeColors) : undefined;
  } catch {
    return undefined;
  }
}

export function readLegacyRiskPoints(): RiskPoint[] {
  if (typeof window === "undefined") return [];
  const rawItems = window.WN_ITEMS;
  if (!Array.isArray(rawItems)) return [];

  const seen = new Set<string>();
  const points: RiskPoint[] = [];

  for (let i = 0; i < rawItems.length; i++) {
    const row = rawItems[i];
    if (!row || typeof row !== "object") continue;
    const item = row as LegacyRiskItem;
    const lat = toFiniteNumber(item.lat);
    const lon = toFiniteNumber(item.lon);
    const type = normalizeRiskType(item.type);
    const label = typeof item.label === "string" ? item.label.trim() : "";
    const body = typeof item.body === "string" ? item.body.trim() : "";
    if (lat === null || lon === null || !type || !label || !body) continue;

    const key = `${label.toLowerCase()}|${lat.toFixed(4)}|${lon.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const severityNum = toFiniteNumber(item.severity);
    points.push({
      lat: lat.toString(),
      lon: lon.toString(),
      type,
      label,
      body,
      severity: severityNum === null ? undefined : Math.max(0, Math.min(10, severityNum)),
      region: typeof item.region === "string" ? item.region : undefined,
      sourceName: typeof item.sourceName === "string" ? item.sourceName : undefined,
      sourceUrl: typeof item.sourceUrl === "string" ? item.sourceUrl : undefined,
      publishedAt: typeof item.publishedAt === "string" ? item.publishedAt : undefined,
    });
  }

  return points;
}

export function readLegacyGlobePalette(): Partial<GlobePalette> {
  const legacy = safeLegacyGlobeColors();

  const fromWindow = {
    background: toColor(legacy?.bg),
    star: toColor(legacy?.star),
    shellLight: toColor(legacy?.sphereLight),
    shellMid: toColor(legacy?.sphereMid),
    shellDark: toColor(legacy?.sphereDark),
    landFill: toColor(legacy?.landFill),
    landStroke: toColor(legacy?.landStroke ?? legacy?.coast),
    gridStroke: toColor(legacy?.grid),
    point: toColor(legacy?.conflict ?? legacy?.tension ?? legacy?.sanction ?? legacy?.hub),
  };

  const fromCss = {
    background: readCssVar("--globe-bg"),
    star: readCssVar("--globe-star"),
    shellLight: readCssVar("--globe-sphere-light"),
    shellMid: readCssVar("--globe-sphere-mid"),
    shellDark: readCssVar("--globe-sphere-dark"),
    landFill: readCssVar("--globe-land-fill"),
    landStroke: readCssVar("--globe-land-stroke"),
    gridStroke: readCssVar("--globe-grid"),
    point: readCssVar("--globe-point"),
  };

  return {
    background: fromCss.background ?? fromWindow.background,
    star: fromCss.star ?? fromWindow.star,
    shellLight: fromCss.shellLight ?? fromWindow.shellLight,
    shellMid: fromCss.shellMid ?? fromWindow.shellMid,
    shellDark: fromCss.shellDark ?? fromWindow.shellDark,
    landFill: fromCss.landFill ?? fromWindow.landFill,
    landStroke: fromCss.landStroke ?? fromWindow.landStroke,
    gridStroke: fromCss.gridStroke ?? fromWindow.gridStroke,
    point: fromCss.point ?? fromWindow.point,
  };
}

export {};
