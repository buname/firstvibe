"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type GreekType = "gamma" | "vanna" | "charm" | "delta";
export type HeatmapViewMode = "single" | "dual";

interface HeatmapViewState {
  leftTicker: string;
  rightTicker: string;
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
      leftTicker: "SPY",
      rightTicker: "QQQ",
      greek: "gamma",
      viewMode: "dual",
      expirySlots: 2,
      compactMode: true,
      setLeftTicker: (leftTicker) => set({ leftTicker }),
      setRightTicker: (rightTicker) => set({ rightTicker }),
      setGreek: (greek) => set({ greek }),
      setViewMode: (viewMode) => set({ viewMode }),
      setExpirySlots: (expirySlots) => set({ expirySlots }),
      toggleCompactMode: () => set((s) => ({ compactMode: !s.compactMode })),
    }),
    { name: "bex-heatmap-view-state" }
  )
);
