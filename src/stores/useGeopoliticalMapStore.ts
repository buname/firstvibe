"use client";

import { create } from "zustand";
import type { RiskMarkerType } from "@/data/geopoliticalRisk";

export type MapTheme = "minimal" | "enhanced";
export type MapViewMode = "globe" | "flat";
export type PrimaryFilter = "ALL" | "CONFLICT" | "TENSION" | "SANCTIONS" | "HUBS";

type HiddenMap = Partial<Record<RiskMarkerType, boolean>>;

export type GeopoliticalMapState = {
  theme: MapTheme;
  viewMode: MapViewMode;
  primaryFilter: PrimaryFilter;
  /** When true, kind is hidden from the map (legend toggle). */
  hiddenKinds: HiddenMap;
  showArcs: boolean;
  autoRotate: boolean;
  selectedMarkerId: string | null;
  setTheme: (t: MapTheme) => void;
  setViewMode: (v: MapViewMode) => void;
  setPrimaryFilter: (f: PrimaryFilter) => void;
  toggleKindHidden: (kind: RiskMarkerType) => void;
  setShowArcs: (v: boolean) => void;
  setAutoRotate: (v: boolean) => void;
  setSelectedMarkerId: (id: string | null) => void;
  resetLegendVisibility: () => void;
};

export const useGeopoliticalMapStore = create<GeopoliticalMapState>((set) => ({
  theme: "minimal",
  viewMode: "globe",
  primaryFilter: "ALL",
  hiddenKinds: {},
  showArcs: true,
  /** Minimal theme targets calmer UX; user can re-enable spin. */
  autoRotate: false,
  selectedMarkerId: null,

  setTheme: (theme) => set({ theme }),
  setViewMode: (viewMode) => set({ viewMode }),
  setPrimaryFilter: (primaryFilter) => set({ primaryFilter }),
  toggleKindHidden: (kind) =>
    set((s) => ({
      hiddenKinds: { ...s.hiddenKinds, [kind]: !s.hiddenKinds[kind] },
    })),
  setShowArcs: (showArcs) => set({ showArcs }),
  setAutoRotate: (autoRotate) => set({ autoRotate }),
  setSelectedMarkerId: (selectedMarkerId) => set({ selectedMarkerId }),
  resetLegendVisibility: () => set({ hiddenKinds: {} }),
}));
