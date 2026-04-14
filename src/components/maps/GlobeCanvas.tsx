"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { createStars, drawStars, type Star } from "@/components/maps/StarsBackground";
import type { GlobePalette, HoveredRisk, RiskPoint } from "@/components/maps/types";
import countriesTopology from "../../../countries-110m.json";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";

interface GlobeCanvasProps {
  points: RiskPoint[];
  palette?: Partial<GlobePalette>;
  onHoverChange: (hovered: HoveredRisk | null) => void;
  onZoomChange?: (zoom: number) => void;
}

export interface GlobeCanvasHandle {
  zoomBy: (delta: number) => void;
  resetView: () => void;
}

type ProjectedPoint = {
  point: RiskPoint;
  x: number;
  y: number;
  z: number;
};

type LonLat = [number, number];

type CountryGeometry = {
  name: string;
  polygons: LonLat[][][];
  centroid: LonLat;
  areaHint: number;
};

type LabelPlacement = {
  x: number;
  y: number;
  text: string;
};

type CountryProperties = {
  name?: string;
};

const TOPOLOGY_DATA = countriesTopology as unknown as Topology<{
  countries: GeometryCollection<CountryProperties>;
}>;

const DEFAULT_PALETTE: GlobePalette = {
  background: "#0a0a0a",
  star: "#ffffff",
  shellLight: "#2c2c2c",
  shellMid: "#131313",
  shellDark: "#050505",
  landFill: "rgba(30, 30, 30, 0.5)",
  landStroke: "rgba(255, 255, 255, 0.15)",
  gridStroke: "rgba(230, 230, 230, 0.16)",
  point: "#ffffff",
};

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function supportsCanvasColor(value: string): boolean {
  if (typeof window === "undefined" || typeof CSS === "undefined" || !CSS.supports) return true;
  return CSS.supports("color", value);
}

function withSafeColor(value: string, fallback: string): string {
  return supportsCanvasColor(value) ? value : fallback;
}

function isLonLat(value: unknown): value is LonLat {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1])
  );
}

function averageCentroid(points: LonLat[]): LonLat {
  if (points.length === 0) return [0, 0];
  let lonSum = 0;
  let latSum = 0;
  for (let i = 0; i < points.length; i++) {
    lonSum += points[i][0];
    latSum += points[i][1];
  }
  return [lonSum / points.length, latSum / points.length];
}

function buildCountryGeometries(): CountryGeometry[] {
  const countries = feature(TOPOLOGY_DATA, TOPOLOGY_DATA.objects.countries);
  if (!countries || countries.type !== "FeatureCollection") return [];

  return countries.features
    .map((country) => {
      const geometry = country.geometry;
      if (!geometry) return null;
      const name = country.properties?.name?.trim() || "Unknown";

      const polygons: LonLat[][][] = [];
      if (geometry.type === "Polygon") {
        const rings = geometry.coordinates
          .map((ring) => ring.filter(isLonLat))
          .filter((ring) => ring.length >= 3);
        if (rings.length > 0) polygons.push(rings);
      } else if (geometry.type === "MultiPolygon") {
        for (let i = 0; i < geometry.coordinates.length; i++) {
          const polygonRings = geometry.coordinates[i]
            .map((ring) => ring.filter(isLonLat))
            .filter((ring) => ring.length >= 3);
          if (polygonRings.length > 0) polygons.push(polygonRings);
        }
      }

      if (polygons.length === 0) return null;
      const centroidSource = polygons[0][0];
      const centroid = averageCentroid(centroidSource);
      return {
        name,
        polygons,
        centroid,
        areaHint: centroidSource.length,
      } satisfies CountryGeometry;
    })
    .filter((row): row is CountryGeometry => row !== null);
}

const COUNTRY_GEOMETRIES: CountryGeometry[] = buildCountryGeometries();
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 4;
const DEFAULT_ZOOM = 1.12;
const DEFAULT_ROTATION = { yaw: -0.08, pitch: 0.14 };

const GlobeCanvas = forwardRef<GlobeCanvasHandle, GlobeCanvasProps>(function GlobeCanvas(
  { points, palette, onHoverChange, onZoomChange },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const projectedRef = useRef<ProjectedPoint[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999, inside: false });
  const rotationRef = useRef({ ...DEFAULT_ROTATION });
  const zoomRef = useRef(DEFAULT_ZOOM);
  const targetZoomRef = useRef(DEFAULT_ZOOM);
  const panRef = useRef({ x: 0, y: 0 });
  const autoRotateResumeAtRef = useRef(0);
  const touchPointsRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartRef = useRef({
    distance: 0,
    zoom: DEFAULT_ZOOM,
    panX: 0,
    panY: 0,
    midX: 0,
    midY: 0,
    active: false,
  });
  const dragStartRef = useRef({
    x: 0,
    y: 0,
    yaw: 0,
    pitch: 0,
    panX: 0,
    panY: 0,
  });
  const lastHoverRef = useRef<HoveredRisk | null>(null);

  const parsedPoints = useMemo(
    () =>
      points
        .map((point) => ({
          point,
          lat: Number(point.lat),
          lon: Number(point.lon),
        }))
        .filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lon)),
    [points]
  );

  const resolvedPalette = useMemo<GlobePalette>(() => {
    const merged = { ...DEFAULT_PALETTE, ...(palette ?? {}) };
    return {
      background: withSafeColor(merged.background, DEFAULT_PALETTE.background),
      star: withSafeColor(merged.star, DEFAULT_PALETTE.star),
      shellLight: withSafeColor(merged.shellLight, DEFAULT_PALETTE.shellLight),
      shellMid: withSafeColor(merged.shellMid, DEFAULT_PALETTE.shellMid),
      shellDark: withSafeColor(merged.shellDark, DEFAULT_PALETTE.shellDark),
      landFill: withSafeColor(merged.landFill, DEFAULT_PALETTE.landFill),
      landStroke: withSafeColor(merged.landStroke, DEFAULT_PALETTE.landStroke),
      gridStroke: withSafeColor(merged.gridStroke, DEFAULT_PALETTE.gridStroke),
      point: withSafeColor(merged.point, DEFAULT_PALETTE.point),
    };
  }, [palette]);

  useImperativeHandle(ref, () => ({
    zoomBy: (delta: number) => {
      const next = clamp(targetZoomRef.current + delta, MIN_ZOOM, MAX_ZOOM);
      targetZoomRef.current = next;
    },
    resetView: () => {
      targetZoomRef.current = DEFAULT_ZOOM;
      zoomRef.current = DEFAULT_ZOOM;
      panRef.current = { x: 0, y: 0 };
      rotationRef.current = { ...DEFAULT_ROTATION };
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    if (!container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId = 0;
    let width = 0;
    let height = 0;
    let centerX = 0;
    let centerY = 0;
    let radius = 0;
    let stars: Star[] = [];
    let frameTick = 0;
    let zoomRafNotified = DEFAULT_ZOOM;
    let resizeTimer: number | null = null;

    const resize = () => {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      width = container.clientWidth;
      height = container.clientHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      centerX = width * 0.5;
      centerY = height * 0.5;
      radius = Math.min(width, height) * 0.35;
      stars = createStars(width, height);
    };

    const scheduleResize = () => {
      if (resizeTimer) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resize();
      }, 100);
    };

    const project = (latDeg: number, lonDeg: number) => {
      const lat = toRadians(latDeg);
      const lon = toRadians(lonDeg);
      const yaw = rotationRef.current.yaw;
      const pitch = rotationRef.current.pitch;

      const cosLat = Math.cos(lat);
      const sx = cosLat * Math.sin(lon);
      const sy = Math.sin(lat);
      const sz = cosLat * Math.cos(lon);

      const cosYaw = Math.cos(yaw);
      const sinYaw = Math.sin(yaw);
      const xYaw = sx * cosYaw - sz * sinYaw;
      const zYaw = sx * sinYaw + sz * cosYaw;

      const cosPitch = Math.cos(pitch);
      const sinPitch = Math.sin(pitch);
      const yPitch = sy * cosPitch - zYaw * sinPitch;
      const zPitch = sy * sinPitch + zYaw * cosPitch;

      return {
        x: centerX + panRef.current.x + xYaw * radius * zoomRef.current,
        y: centerY + panRef.current.y - yPitch * radius * zoomRef.current,
        z: zPitch,
      };
    };

    const findHoveredPoint = (): HoveredRisk | null => {
      if (!mouseRef.current.inside) return null;
      let best: HoveredRisk | null = null;
      let bestDistance = 8;

      for (const point of projectedRef.current) {
        if (point.z <= 0) continue;
        const dx = point.x - mouseRef.current.x;
        const dy = point.y - mouseRef.current.y;
        const distance = Math.hypot(dx, dy);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = { point: point.point, x: point.x, y: point.y };
        }
      }
      return best;
    };

    const draw = () => {
      const now = performance.now();
      if (!isDragging && now >= autoRotateResumeAtRef.current) {
        rotationRef.current.yaw += 0.0005;
      }
      zoomRef.current += (targetZoomRef.current - zoomRef.current) * 0.14;
      if (Math.abs(zoomRef.current - zoomRafNotified) > 0.001) {
        zoomRafNotified = zoomRef.current;
        onZoomChange?.(zoomRef.current);
      }

      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = resolvedPalette.background;
      ctx.fillRect(0, 0, width, height);

      frameTick += 1;
      drawStars(ctx, stars, frameTick, resolvedPalette.star);

      const globeCenterX = centerX + panRef.current.x;
      const globeCenterY = centerY + panRef.current.y;
      const globeRadius = radius * zoomRef.current;
      const shellGradient = ctx.createRadialGradient(
        globeCenterX - globeRadius * 0.22,
        globeCenterY - globeRadius * 0.26,
        globeRadius * 0.12,
        globeCenterX,
        globeCenterY,
        globeRadius
      );
      shellGradient.addColorStop(0, resolvedPalette.shellLight);
      shellGradient.addColorStop(0.5, resolvedPalette.shellMid);
      shellGradient.addColorStop(1, resolvedPalette.shellDark);
      ctx.fillStyle = shellGradient;
      ctx.beginPath();
      ctx.arc(globeCenterX, globeCenterY, globeRadius, 0, Math.PI * 2);
      ctx.fill();

      const labelPlacements: LabelPlacement[] = [];
      ctx.save();
      ctx.beginPath();
      ctx.arc(globeCenterX, globeCenterY, globeRadius, 0, Math.PI * 2);
      ctx.clip();

      ctx.font = "9px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (let i = 0; i < COUNTRY_GEOMETRIES.length; i++) {
        const country = COUNTRY_GEOMETRIES[i];
        const centroidProjected = project(country.centroid[1], country.centroid[0]);

        let madePath = false;
        ctx.beginPath();
        for (let p = 0; p < country.polygons.length; p++) {
          const polygon = country.polygons[p];
          for (let r = 0; r < polygon.length; r++) {
            const ring = polygon[r];
            if (ring.length < 3) continue;
            for (let c = 0; c < ring.length; c++) {
              const coord = ring[c];
              const projected = project(coord[1], coord[0]);
              if (c === 0) {
                ctx.moveTo(projected.x, projected.y);
              } else {
                ctx.lineTo(projected.x, projected.y);
              }
            }
            ctx.closePath();
            madePath = true;
          }
        }
        if (!madePath) continue;

        ctx.fillStyle = resolvedPalette.landFill;
        ctx.globalAlpha = 1;
        ctx.fill();

        ctx.strokeStyle = resolvedPalette.landStroke;
        ctx.lineWidth = 0.5;
        ctx.stroke();

        const labelMinArea = zoomRef.current >= 1.9 ? 10 : zoomRef.current >= 1.6 ? 22 : 40;
        const distanceFromCenter = Math.hypot(
          centroidProjected.x - globeCenterX,
          centroidProjected.y - globeCenterY
        );
        if (
          zoomRef.current >= 1.5 &&
          country.areaHint > labelMinArea &&
          centroidProjected.z > 0.2 &&
          distanceFromCenter <= globeRadius * 0.85
        ) {
          labelPlacements.push({
            x: centroidProjected.x,
            y: centroidProjected.y,
            text: country.name,
          });
        }
      }
      ctx.restore();

      ctx.strokeStyle = resolvedPalette.gridStroke;
      ctx.lineWidth = 1 / clamp(zoomRef.current, 0.8, 3.5);
      ctx.beginPath();
      ctx.arc(globeCenterX, globeCenterY, globeRadius, 0, Math.PI * 2);
      ctx.stroke();

      projectedRef.current = [];
      for (let i = 0; i < parsedPoints.length; i++) {
        const row = parsedPoints[i];
        const projected = project(row.lat, row.lon);
        projectedRef.current.push({
          point: row.point,
          x: projected.x,
          y: projected.y,
          z: projected.z,
        });
      }

      const hoveredPoint = findHoveredPoint();
      for (let i = 0; i < projectedRef.current.length; i++) {
        const projected = projectedRef.current[i];
        if (projected.z <= 0) continue;
        const breath = 0.72 + 0.28 * Math.sin(frameTick * 0.032 + i * 0.55);
        ctx.save();
        ctx.shadowBlur = 10 + breath * 7;
        ctx.shadowColor = resolvedPalette.point;
        ctx.fillStyle = resolvedPalette.point;
        ctx.globalAlpha = 0.48 + breath * 0.42;
        ctx.beginPath();
        ctx.arc(projected.x, projected.y, 2.2 + breath * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (hoveredPoint) {
        ctx.save();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(hoveredPoint.x, hoveredPoint.y, 6, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.62)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }

      if (zoomRef.current >= 1.5) {
        ctx.save();
        ctx.font = "9px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        for (let i = 0; i < labelPlacements.length; i++) {
          const item = labelPlacements[i];
          ctx.fillText(item.text, item.x, item.y);
        }
        ctx.restore();
      }

      ctx.globalCompositeOperation = "source-over";
      const previous = lastHoverRef.current;
      const isSame = previous && hoveredPoint && previous.point.label === hoveredPoint.point.label;

      if (!isSame) {
        lastHoverRef.current = hoveredPoint;
        onHoverChange(hoveredPoint);
      }

      if (canvas && !isDragging) canvas.style.cursor = "grab";

      rafId = window.requestAnimationFrame(draw);
    };

    resize();
    draw();

    const resizeObserver = new ResizeObserver(() => {
      scheduleResize();
    });
    resizeObserver.observe(container);
    window.addEventListener("resize", scheduleResize);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleResize);
      if (resizeTimer) window.clearTimeout(resizeTimer);
      window.cancelAnimationFrame(rafId);
      lastHoverRef.current = null;
      if (canvas) canvas.style.cursor = "default";
      onHoverChange(null);
    };
  }, [isDragging, onHoverChange, onZoomChange, parsedPoints, resolvedPalette]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onPointerDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      setIsDragging(true);
      autoRotateResumeAtRef.current = performance.now() + 2000;
      if (e.pointerType === "touch") {
        touchPointsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (touchPointsRef.current.size === 2) {
          const touchPoints = Array.from(touchPointsRef.current.values());
          const first = touchPoints[0];
          const second = touchPoints[1];
          pinchStartRef.current = {
            distance: Math.hypot(second.x - first.x, second.y - first.y),
            zoom: targetZoomRef.current,
            panX: panRef.current.x,
            panY: panRef.current.y,
            midX: (first.x + second.x) * 0.5,
            midY: (first.y + second.y) * 0.5,
            active: true,
          };
        }
      }
      canvas.style.cursor = "grabbing";
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        yaw: rotationRef.current.yaw,
        pitch: rotationRef.current.pitch,
        panX: panRef.current.x,
        panY: panRef.current.y,
      };
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        inside: true,
      };
      if (e.pointerType === "touch") {
        if (touchPointsRef.current.has(e.pointerId)) {
          touchPointsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }
        if (touchPointsRef.current.size === 2 && pinchStartRef.current.active) {
          autoRotateResumeAtRef.current = performance.now() + 2000;
          const touchPoints = Array.from(touchPointsRef.current.values());
          const first = touchPoints[0];
          const second = touchPoints[1];
          const currentDistance = Math.hypot(second.x - first.x, second.y - first.y);
          if (pinchStartRef.current.distance > 0) {
            const zoomFactor = currentDistance / pinchStartRef.current.distance;
            targetZoomRef.current = clamp(
              pinchStartRef.current.zoom * zoomFactor,
              MIN_ZOOM,
              MAX_ZOOM
            );
          }
          const midX = (first.x + second.x) * 0.5;
          const midY = (first.y + second.y) * 0.5;
          panRef.current.x = pinchStartRef.current.panX + (midX - pinchStartRef.current.midX);
          panRef.current.y = pinchStartRef.current.panY + (midY - pinchStartRef.current.midY);
          return;
        }
      }
      if (!isDragging) return;
      autoRotateResumeAtRef.current = performance.now() + 2000;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      rotationRef.current.yaw = dragStartRef.current.yaw - dx * 0.0062;
      rotationRef.current.pitch = clamp(dragStartRef.current.pitch + dy * 0.0038, -1.2, 1.2);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
      if (e.pointerType === "touch") {
        touchPointsRef.current.delete(e.pointerId);
        if (touchPointsRef.current.size < 2) {
          pinchStartRef.current.active = false;
        }
        if (touchPointsRef.current.size === 1) {
          const remaining = Array.from(touchPointsRef.current.values())[0];
          dragStartRef.current = {
            x: remaining.x,
            y: remaining.y,
            yaw: rotationRef.current.yaw,
            pitch: rotationRef.current.pitch,
            panX: panRef.current.x,
            panY: panRef.current.y,
          };
          setIsDragging(true);
          return;
        }
      }
      autoRotateResumeAtRef.current = performance.now() + 2000;
      setIsDragging(false);
    };

    const onPointerLeave = () => {
      mouseRef.current.inside = false;
      touchPointsRef.current.clear();
      pinchStartRef.current.active = false;
      setIsDragging(false);
      lastHoverRef.current = null;
      onHoverChange(null);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.0012;
      const zoomFactor = 1 + delta;
      const next = clamp(targetZoomRef.current * zoomFactor, MIN_ZOOM, MAX_ZOOM);
      targetZoomRef.current = next;
      autoRotateResumeAtRef.current = performance.now() + 2000;
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", onContextMenu);

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", onContextMenu);
    };
  }, [isDragging, onHoverChange]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />;
});

export default GlobeCanvas;
