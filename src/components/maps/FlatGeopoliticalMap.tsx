"use client";

import * as d3 from "d3";
import { useEffect, useMemo, useState } from "react";
import type { RiskArc, RiskMarker } from "@/data/geopoliticalRisk";
import type { MapTheme } from "@/stores/useGeopoliticalMapStore";

type GeoJson = d3.GeoPermissibleObjects;

type Props = {
  width: number;
  height: number;
  theme: MapTheme;
  markers: RiskMarker[];
  markerFill: (m: RiskMarker) => string;
  markerRadius: (m: RiskMarker) => number;
  markerStroke?: (m: RiskMarker) => string | undefined;
  markerHollow?: (m: RiskMarker) => boolean;
  arcs: { arc: RiskArc; start: RiskMarker; end: RiskMarker }[];
  arcStroke: (a: RiskArc) => string;
  arcDash: (a: RiskArc) => string | undefined;
  onMarkerClick?: (id: string) => void;
  selectedMarkerId: string | null;
};

const GEO_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson";

export default function FlatGeopoliticalMap({
  width,
  height,
  theme,
  markers,
  markerFill,
  markerRadius,
  markerStroke,
  markerHollow,
  arcs,
  arcStroke,
  arcDash,
  onMarkerClick,
  selectedMarkerId,
}: Props) {
  const [world, setWorld] = useState<GeoJson | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(GEO_URL)
      .then((r) => r.json())
      .then((j: GeoJson) => {
        if (!cancelled) setWorld(j);
      })
      .catch(() => {
        if (!cancelled) setWorld(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { path, projection } = useMemo(() => {
    if (!world || width < 8 || height < 8) return { path: null as d3.GeoPath | null, projection: null };
    const projection = d3.geoMercator().fitExtent(
      [
        [2, 2],
        [width - 2, height - 2],
      ],
      world
    );
    const path = d3.geoPath(projection);
    return { path, projection };
  }, [world, width, height]);

  const isEnhanced = theme === "enhanced";
  const landFill = isEnhanced ? "#0c1929" : "#0d0d0f";
  const landStroke = isEnhanced ? "rgba(56, 189, 248, 0.22)" : "rgba(255,255,255,0.12)";
  const bg = isEnhanced ? "#020617" : "#050506";

  const projectedMarkers = useMemo(() => {
    if (!projection) return [];
    return markers
      .map((m) => {
        const p = projection([m.lng, m.lat]);
        if (!p) return null;
        return { ...m, x: p[0], y: p[1] };
      })
      .filter(Boolean) as (RiskMarker & { x: number; y: number })[];
  }, [markers, projection]);

  const projectedArcs = useMemo(() => {
    if (!projection) return [];
    return arcs
      .map(({ arc, start, end }) => {
        const a = projection([start.lng, start.lat]);
        const b = projection([end.lng, end.lat]);
        if (!a || !b) return null;
        return { arc, x1: a[0], y1: a[1], x2: b[0], y2: b[1] };
      })
      .filter(Boolean) as {
      arc: RiskArc;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }[];
  }, [arcs, projection]);

  if (width < 8 || height < 8) {
    return <div className="h-full w-full" style={{ background: bg }} />;
  }

  return (
    <svg width={width} height={height} className="block touch-none" style={{ background: bg }}>
      {path && world ? (
        <path
          d={path(world) ?? ""}
          fill={landFill}
          stroke={landStroke}
            strokeWidth={isEnhanced ? 0.6 : 0.45}
          vectorEffect="non-scaling-stroke"
        />
      ) : (
        <rect width={width} height={height} fill={bg} />
      )}
      <g className="arcs">
        {projectedArcs.map(({ arc, x1, y1, x2, y2 }) => (
          <line
            key={arc.id}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={arcStroke(arc)}
            strokeWidth={isEnhanced ? 1.1 : 0.75}
            strokeOpacity={isEnhanced ? 0.55 : 0.22}
            strokeDasharray={arcDash(arc)}
            fill="none"
          />
        ))}
      </g>
      <g className="markers">
        {projectedMarkers.map((m) => {
          const r = markerRadius(m);
          const sel = selectedMarkerId === m.id;
          const stroke = markerStroke?.(m);
          const hollow = markerHollow?.(m) ?? false;
          return (
            <g
              key={m.id}
              transform={`translate(${m.x},${m.y})`}
              className="cursor-pointer"
              onClick={() => onMarkerClick?.(m.id)}
            >
              {hollow ? (
                <circle
                  r={r}
                  fill="none"
                  stroke={stroke ?? "rgba(255,255,255,0.5)"}
                  strokeWidth={1.2}
                  opacity={sel ? 1 : 0.85}
                />
              ) : (
                <circle
                  r={r}
                  fill={markerFill(m)}
                  stroke={sel ? "#fff" : stroke ?? "rgba(255,255,255,0.15)"}
                  strokeWidth={sel ? 2 : 0.6}
                  opacity={0.95}
                  style={{
                    filter: isEnhanced ? "drop-shadow(0 0 6px rgba(255,255,255,0.35))" : undefined,
                  }}
                />
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
