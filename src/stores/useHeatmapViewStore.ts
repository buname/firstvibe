"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type GreekType = "gamma" | "vanna" | "charm" | "delta";
export type HeatmapViewMode = "single" | "dual";
type DualIndexTicker = "SPX" | "NDX";

interface HeatmapViewState {
  leftTicker: DualIndexTicker;
  rightTicker: DualIndexTicker;
  greek: GreekType;
  viewMode: HeatmapViewMode;
  expirySlots: 1 | 2 | 3 | 4;
  compactMode: boolean;
  setLeftTicker: (ticker: string) => void;
  setRightTicker: (ticker: string) => void;
  setGreek: (greek: GreekType) => void;
  setViewMode: (mode: HeatmapViewMode) => void;
  setExpirySlots: (slots: 1 | 2 | 3 | 4) => void;
  toggleCompactMode: () => void;
}

export const useHeatmapViewStore = create<HeatmapViewState>()(
  persist(
    (set) => ({
      leftTicker: "SPX",
      rightTicker: "NDX",
      greek: "gamma",
      viewMode: "dual",
      expirySlots: 2,
      compactMode: true,
      setLeftTicker: (leftTicker) =>
        set({ leftTicker: leftTicker === "NDX" ? "NDX" : "SPX" }),
      setRightTicker: (rightTicker) =>
        set({ rightTicker: rightTicker === "SPX" ? "SPX" : "NDX" }),
      setGreek: (greek) => set({ greek }),
      setViewMode: (viewMode) => set({ viewMode }),
      setExpirySlots: (expirySlots) => set({ expirySlots }),
      toggleCompactMode: () => set((s) => ({ compactMode: !s.compactMode })),
    }),
    { name: "bex-heatmap-view-state" }
  )
);
