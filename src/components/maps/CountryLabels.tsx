"use client";

import { Html } from "@react-three/drei";
import { geoCentroid } from "d3-geo";
import { memo, useMemo } from "react";
import { feature } from "topojson-client";
import { Vector3 } from "three";
import type { GlobeLodLevel } from "@/hooks/useZoomLevel";
import { isPointFacingCamera, latLngToVector3 } from "@/utils/geoProjection";
import countries110m from "../../../countries-110m.json";

type FeatureRecord = {
  properties?: Record<string, unknown>;
  geometry?: unknown;
};

type CountryLabel = {
  name: string;
  lat: number;
  lng: number;
};

type TopologyRecord = {
  type: "Topology";
  objects: Record<string, unknown>;
};

const MAJOR_COUNTRIES = new Set([
  "United States of America",
  "Canada",
  "Mexico",
  "Brazil",
  "Argentina",
  "United Kingdom",
  "France",
  "Germany",
  "Spain",
  "Italy",
  "Russia",
  "Turkey",
  "Saudi Arabia",
  "Iran",
  "India",
  "China",
  "Japan",
  "South Korea",
  "Australia",
  "South Africa",
]);

function CountryLabelsBase({
  radius,
  lod,
  cameraPosition,
}: {
  radius: number;
  lod: GlobeLodLevel;
  cameraPosition: Vector3;
}) {
  const labels = useMemo(() => {
    const topology = countries110m as TopologyRecord;
    const countriesObj = topology.objects?.countries;
    if (!countriesObj) return [];
    const fc = feature(topology as never, countriesObj as never) as {
      features?: FeatureRecord[];
    };
    const next: CountryLabel[] = [];
    for (const item of fc.features ?? []) {
      const name = String(
        item.properties?.name ??
          item.properties?.ADMIN ??
          item.properties?.NAME ??
          ""
      ).trim();
      if (!name) continue;
      const centroid = geoCentroid(item as never);
      const lng = centroid[0];
      const lat = centroid[1];
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      next.push({ name, lat, lng });
    }
    return next;
  }, []);

  const visible = useMemo(() => {
    if (lod === "far") return [];
    const base =
      lod === "mid"
        ? labels.filter((l) => MAJOR_COUNTRIES.has(l.name))
        : labels;
    return base
      .map((l) => {
        const p = latLngToVector3(l.lat, l.lng, radius + 0.2);
        return { ...l, position: p };
      })
      .filter((l) => isPointFacingCamera(l.position, cameraPosition, 0.16));
  }, [cameraPosition, labels, lod, radius]);

  return (
    <>
      {visible.map((label) => (
        <Html
          key={label.name}
          center
          distanceFactor={12}
          position={[label.position.x, label.position.y, label.position.z]}
        >
          <div className="pointer-events-none rounded border border-white/15 bg-black/45 px-1.5 py-0.5 text-[9px] text-white/75 backdrop-blur-sm">
            {label.name}
          </div>
        </Html>
      ))}
    </>
  );
}

const CountryLabels = memo(CountryLabelsBase);
CountryLabels.displayName = "CountryLabels";

export default CountryLabels;
