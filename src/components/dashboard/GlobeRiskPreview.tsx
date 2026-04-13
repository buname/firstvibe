"use client";

import dynamic from "next/dynamic";
import { Search, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GlobeMethods } from "react-globe.gl";
import { Color } from "three";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

type RiskKind =
  | "conflict"
  | "tension"
  | "sanctions"
  | "hubs"
  | "webcams";

type FilterKind = "ALL" | "CONFLICT" | "TENSION" | "SANCTIONS" | "HUBS" | "WEBCAMS";

type Headline = {
  id: string;
  title: string;
  source: string;
  sentiment: "bullish" | "bearish" | "neutral";
  url?: string;
};

type RiskPoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kind: RiskKind;
  severity: number;
  note: string;
  headline?: string;
};

type ArcLink = {
  id: string;
  from: string;
  to: string;
  kind: RiskKind;
};

const POINTS: RiskPoint[] = [
  { id: "kyiv", name: "Kyiv", lat: 50.45, lng: 30.52, kind: "conflict", severity: 0.95, note: "Active conflict watch" },
  { id: "gaza", name: "Gaza", lat: 31.45, lng: 34.4, kind: "conflict", severity: 0.92, note: "Escalation risk" },
  { id: "taiwan", name: "Taiwan Strait", lat: 24.0, lng: 121.0, kind: "tension", severity: 0.8, note: "Military/naval tension" },
  { id: "redsea", name: "Red Sea", lat: 18.0, lng: 40.0, kind: "tension", severity: 0.76, note: "Shipping disruption risk" },
  { id: "tehran", name: "Tehran", lat: 35.68, lng: 51.41, kind: "sanctions", severity: 0.7, note: "Sanctions regime" },
  { id: "moscow", name: "Moscow", lat: 55.76, lng: 37.62, kind: "sanctions", severity: 0.68, note: "Trade/sanctions pressure" },
  { id: "nyc", name: "New York", lat: 40.71, lng: -74.0, kind: "hubs", severity: 0.48, note: "Key economic hub" },
  { id: "london", name: "London", lat: 51.51, lng: -0.13, kind: "hubs", severity: 0.5, note: "Key economic hub" },
  { id: "singapore", name: "Singapore", lat: 1.35, lng: 103.82, kind: "hubs", severity: 0.52, note: "Key economic hub" },
  { id: "tokyo", name: "Tokyo", lat: 35.68, lng: 139.69, kind: "webcams", severity: 0.45, note: "Live market camera node" },
  { id: "dubai", name: "Dubai", lat: 25.2, lng: 55.27, kind: "webcams", severity: 0.47, note: "Logistics camera node" },
];

const ARC_LINKS: ArcLink[] = [
  { id: "a1", from: "kyiv", to: "london", kind: "conflict" },
  { id: "a2", from: "gaza", to: "tehran", kind: "tension" },
  { id: "a3", from: "tehran", to: "dubai", kind: "sanctions" },
  { id: "a4", from: "taiwan", to: "tokyo", kind: "tension" },
  { id: "a5", from: "nyc", to: "london", kind: "hubs" },
];

const COLORS: Record<RiskKind, string> = {
  conflict: "#f5f5f5",
  tension: "#d4d4d8",
  sanctions: "#a1a1aa",
  hubs: "#71717a",
  webcams: "#52525b",
};

function inferKind(title: string): RiskKind | null {
  const t = title.toLowerCase();
  if (/war|invasion|strike|missile|troops|offensive/.test(t)) return "conflict";
  if (/tension|standoff|escalat|hostile|shipping|naval/.test(t)) return "tension";
  if (/sanction|embargo|trade curb|tariff/.test(t)) return "sanctions";
  return null;
}

async function fetchHeadlines(): Promise<Headline[]> {
  const res = await fetch("/api/news", { cache: "no-store" });
  if (!res.ok) return [];
  const j = (await res.json()) as { headlines?: Headline[] };
  return j.headlines ?? [];
}

export default function GlobeRiskPreview() {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [filter, setFilter] = useState<FilterKind>("ALL");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const hs = await fetchHeadlines();
    setHeadlines(hs);
    setUpdatedAt(new Date());
  }, []);

  useEffect(() => {
    const init = window.setTimeout(() => {
      void load();
    }, 0);
    const t = setInterval(() => void load(), 90_000);
    return () => {
      window.clearTimeout(init);
      clearInterval(t);
    };
  }, [load]);

  useEffect(() => {
    const ctl = globeRef.current?.controls?.();
    if (!ctl) return;
    ctl.autoRotate = true;
    ctl.autoRotateSpeed = 0.35;
  }, []);

  const tuneGlobeMaterial = useCallback(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const globeWithMaterial = globe as GlobeMethods & {
      globeMaterial?: () => {
        color?: Color;
        emissive?: Color;
        emissiveIntensity?: number;
        shininess?: number;
      };
    };
    const material = globeWithMaterial.globeMaterial?.() as
      | {
          color?: Color;
          emissive?: Color;
          emissiveIntensity?: number;
          shininess?: number;
        }
      | undefined;
    if (!material) return;
    // Keep the globe visible even if remote texture assets fail to load.
    material.color = new Color("#8f8f95");
    material.emissive = new Color("#09090b");
    material.emissiveIntensity = 0.2;
    material.shininess = 0.45;
  }, []);

  useEffect(() => {
    tuneGlobeMaterial();
  }, [tuneGlobeMaterial]);

  const enrichedPoints = useMemo(() => {
    return POINTS.map((p) => {
      const line =
        headlines.find((h) => inferKind(h.title) === p.kind)?.title ??
        headlines.find((h) =>
          h.title.toLowerCase().includes(p.name.toLowerCase().split(" ")[0])
        )?.title;
      return { ...p, headline: line };
    });
  }, [headlines]);

  const visiblePoints = useMemo(() => {
    if (filter === "ALL") return enrichedPoints;
    const k = filter.toLowerCase() as RiskKind;
    return enrichedPoints.filter((p) => p.kind === k);
  }, [filter, enrichedPoints]);

  const arcs = useMemo(() => {
    const byId = new Map(visiblePoints.map((p) => [p.id, p]));
    return ARC_LINKS.flatMap((a) => {
      if (filter !== "ALL" && a.kind !== filter.toLowerCase()) return [];
      const s = byId.get(a.from);
      const t = byId.get(a.to);
      if (!s || !t) return [];
      return [
        {
          id: a.id,
          startLat: s.lat,
          startLng: s.lng,
          endLat: t.lat,
          endLng: t.lng,
          color: COLORS[a.kind],
        },
      ];
    });
  }, [filter, visiblePoints]);

  const riskIndex = useMemo(() => {
    const c = visiblePoints.filter((p) => p.kind === "conflict").length;
    const t = visiblePoints.filter((p) => p.kind === "tension").length;
    const s = visiblePoints.filter((p) => p.kind === "sanctions").length;
    const score = Math.min(9.9, 5.2 + c * 0.65 + t * 0.4 + s * 0.32);
    const label = score >= 7 ? "ELEVATED" : score >= 5.8 ? "WATCH" : "LOW";
    return { score, label };
  }, [visiblePoints]);

  const zoom = (delta: number) => {
    const cur = globeRef.current?.pointOfView();
    if (!cur) return;
    const next = Math.max(0.7, Math.min(3.0, cur.altitude + delta));
    globeRef.current?.pointOfView({ ...cur, altitude: next }, 350);
  };

  const onSearch = () => {
    const target = POINTS.find((p) =>
      p.name.toLowerCase().includes(query.trim().toLowerCase())
    );
    if (!target) return;
    globeRef.current?.pointOfView(
      { lat: target.lat, lng: target.lng, altitude: 1.05 },
      900
    );
  };

  const timeStr =
    updatedAt?.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }) ?? "—";

  return (
    <div className="mt-8 mx-auto w-full max-w-4xl overflow-hidden rounded-lg border border-[#1f1f1f] bg-[#050508]">
      <div className="flex items-center justify-between gap-3 border-b border-[#1a1a1a] px-3 py-2">
        <h3 className="font-mono text-[11px] font-bold tracking-wider text-[#e5e5e5]">
          GLOBAL RISK MAP
        </h3>
        <div className="flex items-center gap-2">
          <div className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-300">
            {riskIndex.score.toFixed(1)} {riskIndex.label}
          </div>
          <span className="font-mono text-[9px] text-[#666]">LIVE {timeStr}</span>
        </div>
      </div>

      <div className="relative h-[360px] bg-[#030308]">
        <Globe
          ref={globeRef}
          width={1200}
          height={720}
          onGlobeReady={tuneGlobeMaterial}
          backgroundColor="#030308"
          globeImageUrl="https://unpkg.com/three-globe/example/img/earth-night.jpg"
          bumpImageUrl="https://unpkg.com/three-globe/example/img/earth-topology.png"
          showAtmosphere
          atmosphereColor="#d4d4d8"
          atmosphereAltitude={0.14}
          showGraticules
          pointsData={visiblePoints}
          pointLat="lat"
          pointLng="lng"
          pointAltitude={(d: object) => ((d as RiskPoint).severity ?? 0.5) * 0.08 + 0.03}
          pointColor={(d: object) => COLORS[(d as RiskPoint).kind]}
          pointRadius={(d: object) => 0.2 + (d as RiskPoint).severity * 0.15}
          pointLabel={(d: object) => {
            const p = d as RiskPoint;
            return `<div style="font-family:monospace;font-size:11px;line-height:1.35">
              <b>${p.name}</b><br/>
              ${p.note}<br/>
              ${p.headline ? `News: ${p.headline}` : "No linked headline"}
            </div>`;
          }}
          arcsData={arcs}
          arcStartLat="startLat"
          arcStartLng="startLng"
          arcEndLat="endLat"
          arcEndLng="endLng"
          arcColor={(d: object) => (d as { color: string }).color}
          arcDashLength={0.4}
          arcDashGap={0.15}
          arcDashAnimateTime={2200}
          arcAltitude={0.16}
        />

        <div className="absolute left-3 top-3 flex items-center gap-1 rounded border border-[#1f1f1f] bg-black/70 px-2 py-1">
          <Search className="h-3 w-3 text-[#666]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSearch();
            }}
            placeholder="Search locations..."
            className="w-40 bg-transparent font-mono text-[10px] text-[#ccc] outline-none placeholder:text-[#555]"
          />
        </div>

        <div className="absolute right-3 top-12 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => zoom(-0.25)}
            className="rounded border border-[#2a2a2a] bg-black/70 p-1 text-[#aaa] hover:text-white"
          >
            <ZoomIn className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => zoom(0.25)}
            className="rounded border border-[#2a2a2a] bg-black/70 p-1 text-[#aaa] hover:text-white"
          >
            <ZoomOut className="h-3 w-3" />
          </button>
        </div>

        <div className="absolute left-3 bottom-3 rounded border border-[#1f1f1f] bg-black/70 px-2 py-1.5 font-mono text-[9px] text-[#777]">
          <div className="mb-1 text-[#999]">Risk legend</div>
          {[
            ["Active Conflict", COLORS.conflict],
            ["High Tension", COLORS.tension],
            ["Sanctions/Trade", COLORS.sanctions],
            ["Key Econ Hub", COLORS.hubs],
          ].map(([label, color]) => (
            <div key={label} className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-[#1a1a1a] px-3 py-2">
        <div className="mb-2 flex flex-wrap gap-1">
          {(["ALL", "CONFLICT", "TENSION", "SANCTIONS", "HUBS", "WEBCAMS"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded border px-2 py-0.5 font-mono text-[8px] tracking-wide ${
                filter === f
                  ? "border-[#00ff88]/50 bg-[#00ff8812] text-[#00ff88]"
                  : "border-[#2a2a2a] bg-[#111] text-[#666] hover:text-[#aaa]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="max-h-24 space-y-1.5 overflow-y-auto">
          {headlines.slice(0, 4).map((h) => (
            <p
              key={h.id}
              className="border-l border-[#262626] pl-2 font-mono text-[10px] leading-snug text-[#737373]"
            >
              {h.title}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
