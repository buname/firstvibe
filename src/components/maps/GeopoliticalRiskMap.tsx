"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import CanvasErrorBoundary from "@/components/maps/CanvasErrorBoundary";
import GlobeCanvas, { type GlobeCanvasHandle } from "@/components/maps/GlobeCanvas";
import UIOverlay from "@/components/maps/UIOverlay";
import type { GlobePalette, GlobalRisk, HoveredRisk, RiskPoint } from "@/components/maps/types";
import { useRiskStore } from "@/store/riskStore";

export type GeopoliticalRiskMapProps = {
  onClose?: () => void;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export default function GeopoliticalRiskMap({ onClose }: GeopoliticalRiskMapProps = {}) {
  const globeRef = useRef<GlobeCanvasHandle>(null);
  const [hovered, setHovered] = useState<HoveredRisk | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1.12);
  const [palette, setPalette] = useState<Partial<GlobePalette>>({});
  const points = useRiskStore((state) => state.points);
  const query = useRiskStore((state) => state.query);
  const filter = useRiskStore((state) => state.filter);
  const loading = useRiskStore((state) => state.loading);
  const setPoints = useRiskStore((state) => state.setPoints);
  const setQuery = useRiskStore((state) => state.setQuery);
  const setFilter = useRiskStore((state) => state.setFilter);
  const setLoading = useRiskStore((state) => state.setLoading);

  const visiblePoints = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return points.filter((point) => {
      if (filter !== "all" && point.type !== filter) return false;
      if (!needle) return true;
      return point.label.toLowerCase().includes(needle) || point.body.toLowerCase().includes(needle);
    });
  }, [filter, points, query]);

  const globalRisk = useMemo<GlobalRisk>(() => {
    if (visiblePoints.length === 0) return { score: 0, label: "STABLE" };
    const typeWeight: Record<RiskPoint["type"], number> = {
      conflict: 8.4,
      tension: 6.6,
      sanction: 5.8,
      hub: 4.2,
    };
    const average =
      visiblePoints.reduce((acc, point) => {
        const weightedSeverity =
          typeof point.severity === "number" && Number.isFinite(point.severity)
            ? clamp(point.severity, 0, 10)
            : typeWeight[point.type];
        return acc + weightedSeverity;
      }, 0) / visiblePoints.length;
    const score = clamp(average, 0, 9.9);
    const label = score >= 7 ? "ELEVATED" : score >= 5 ? "WATCH" : "STABLE";
    return { score, label };
  }, [visiblePoints]);

  useEffect(() => {
    let active = true;
    setLoading(true);

    void import("@/lib/mockData")
      .then(({ fetchRiskData }) => fetchRiskData())
      .then((data) => {
        if (!active) return;
        setPoints(data);
      })
      .catch(() => {
        if (!active) return;
        setPoints([]);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [setLoading, setPoints]);

  const handleHoverChange = useCallback((value: HoveredRisk | null) => {
    setHovered(value);
  }, []);

  const handleZoomIn = useCallback(() => {
    globeRef.current?.zoomBy(0.25);
  }, []);

  const handleZoomOut = useCallback(() => {
    globeRef.current?.zoomBy(-0.25);
  }, []);

  const handleResetView = useCallback(() => {
    globeRef.current?.resetView();
  }, []);

  const handleFilterChange = useCallback(
    (next: "all" | "conflict" | "tension" | "sanction" | "hub") => {
      setFilter(next);
    },
    [setFilter]
  );

  useEffect(() => {
    const updatePalette = () => {
      void import("@/lib/riskIntegration")
        .then(({ readLegacyGlobePalette }) => {
          setPalette(readLegacyGlobePalette());
        })
        .catch(() => {
          setPalette({});
        });
    };
    updatePalette();
    const observer =
      typeof MutationObserver !== "undefined" ? new MutationObserver(updatePalette) : null;
    observer?.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    });
    window.addEventListener("themechange", updatePalette as EventListener);
    return () => {
      observer?.disconnect();
      window.removeEventListener("themechange", updatePalette as EventListener);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/") {
        const search = document.getElementById("risk-map-search") as HTMLInputElement | null;
        if (search) {
          event.preventDefault();
          search.focus();
        }
      }
      if (event.key === "Escape") {
        handleResetView();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [handleResetView]);

  return (
    <div className="flex items-center justify-center p-4">
      <div className="relative mx-auto h-[500px] w-full max-w-[1400px] overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0a] shadow-2xl md:h-[550px] lg:h-[600px]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="absolute inset-0"
        >
          <CanvasErrorBoundary>
            <GlobeCanvas
              ref={globeRef}
              points={visiblePoints}
              palette={palette}
              onHoverChange={handleHoverChange}
              onZoomChange={setZoomLevel}
            />
          </CanvasErrorBoundary>
        </motion.div>
        <UIOverlay
          query={query}
          onQueryChange={setQuery}
          filter={filter}
          onFilterChange={handleFilterChange}
          globalRisk={globalRisk}
          hovered={hovered}
          loading={loading}
          zoomLevel={zoomLevel}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetView={handleResetView}
          onClose={onClose}
        />
        <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_42%,rgba(0,0,0,0.68)_100%)] shadow-[inset_0_0_90px_rgba(0,0,0,0.55)]" />
      </div>
    </div>
  );
}
