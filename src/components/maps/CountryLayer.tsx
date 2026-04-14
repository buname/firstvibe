"use client";

import { Line } from "@react-three/drei";
import { memo, useMemo } from "react";
import { feature } from "topojson-client";
import type { GlobeLodLevel } from "@/hooks/useZoomLevel";
import { latLngToVector3 } from "@/utils/geoProjection";
import countries110m from "../../../countries-110m.json";

type Coordinates = number[][] | number[][][];
type GeometryType = "Polygon" | "MultiPolygon";

type GeometryRecord = {
  type: GeometryType;
  coordinates: Coordinates;
};

type FeatureRecord = {
  geometry?: GeometryRecord | null;
};

type TopologyRecord = {
  type: "Topology";
  objects: Record<string, unknown>;
};

function simplifyRing(ring: number[][], step: number): number[][] {
  if (ring.length <= 8 || step <= 1) return ring;
  const out: number[][] = [];
  for (let i = 0; i < ring.length; i += step) out.push(ring[i]);
  if (out.length === 0 || out[out.length - 1] !== ring[ring.length - 1]) {
    out.push(ring[ring.length - 1]);
  }
  return out;
}

function ringToSpherePoints(
  ring: number[][],
  radius: number,
  step: number
): [number, number, number][] {
  return simplifyRing(ring, step)
    .map((coord) => {
      const lng = coord[0];
      const lat = coord[1];
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const v = latLngToVector3(lat, lng, radius);
      return [v.x, v.y, v.z] as [number, number, number];
    })
    .filter((p): p is [number, number, number] => p != null);
}

function extractRings(features: FeatureRecord[]): number[][][] {
  const rings: number[][][] = [];
  for (const f of features) {
    const geom = f.geometry;
    if (!geom) continue;
    if (geom.type === "Polygon") {
      const poly = geom.coordinates as unknown as number[][][];
      for (const ring of poly) rings.push(ring);
      continue;
    }
    if (geom.type === "MultiPolygon") {
      const multi = geom.coordinates as unknown as number[][][][];
      for (const poly of multi) {
        for (const ring of poly) rings.push(ring);
      }
    }
  }
  return rings;
}

function CountryLayerBase({ radius, lod }: { radius: number; lod: GlobeLodLevel }) {
  const rings = useMemo(() => {
    const topology = countries110m as TopologyRecord;
    const countriesObj = topology.objects?.countries;
    if (!countriesObj) return [];
    const fc = feature(topology as never, countriesObj as never) as {
      features?: FeatureRecord[];
    };
    return extractRings(fc.features ?? []);
  }, []);

  const step = lod === "near" ? 1 : lod === "mid" ? 2 : 4;
  const opacity = lod === "near" ? 0.55 : lod === "mid" ? 0.44 : 0.34;

  const projected = useMemo(
    () =>
      rings
        .map((ring) => ringToSpherePoints(ring, radius + 0.03, step))
        .filter((line) => line.length >= 2),
    [radius, rings, step]
  );

  return (
    <group>
      {projected.map((line, i) => (
        <Line
          key={i}
          points={line}
          color="#404040"
          lineWidth={0.5}
          transparent
          opacity={opacity}
        />
      ))}
    </group>
  );
}

const CountryLayer = memo(CountryLayerBase);
CountryLayer.displayName = "CountryLayer";

export default CountryLayer;
