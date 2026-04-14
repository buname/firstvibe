"use client";

import { create } from "zustand";

interface ViewState {
  activeFullscreenComponentId: string | null;
  setFullscreen: (id: string) => void;
  clearFullscreen: () => void;
  toggleFullscreen: (id: string) => void;
}

export const useViewStateStore = create<ViewState>((set, get) => ({
  activeFullscreenComponentId: null,

  setFullscreen: (id) => set({ activeFullscreenComponentId: id }),

  clearFullscreen: () => set({ activeFullscreenComponentId: null }),

  toggleFullscreen: (id) => {
    const current = get().activeFullscreenComponentId;
    set({ activeFullscreenComponentId: current === id ? null : id });
  },
}));
