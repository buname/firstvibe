"use client";

import { create } from "zustand";

export type WorkspaceSectionId =
  | "core-snapshot"
  | "overview"
  | "structure"
  | "heatmap-dual";
export type PresetId = "A" | "B" | "C";

const ORDER_KEY = "bex-workspace-order";
const PRESETS_KEY = "bex-workspace-presets";
const ACTIVE_PRESET_KEY = "bex-workspace-active-preset";
const PINNED_LEVELS_KEY = "bex-workspace-pinned-levels";

export const DEFAULT_WORKSPACE_ORDER: WorkspaceSectionId[] = [
  "core-snapshot",
  "overview",
  "structure",
  "heatmap-dual",
];

const DEFAULT_PRESETS: Record<PresetId, WorkspaceSectionId[]> = {
  A: DEFAULT_WORKSPACE_ORDER,
  B: ["overview", "core-snapshot", "heatmap-dual", "structure"],
  C: ["heatmap-dual", "structure", "core-snapshot", "overview"],
};

interface WorkspaceLayoutState {
  hydrated: boolean;
  order: WorkspaceSectionId[];
  activePreset: PresetId;
  editingMode: boolean;
  pinnedLevels: string[];
  presets: Record<PresetId, WorkspaceSectionId[]>;
  hydrate: () => void;
  setOrder: (next: WorkspaceSectionId[]) => void;
  loadPreset: (id: PresetId) => void;
  saveCurrentToPreset: (id: PresetId) => void;
  resetLayout: () => void;
  toggleEditingMode: () => void;
  togglePinnedLevel: (id: string) => void;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export const useWorkspaceLayoutStore = create<WorkspaceLayoutState>((set, get) => ({
  hydrated: false,
  order: DEFAULT_WORKSPACE_ORDER,
  activePreset: "A",
  editingMode: false,
  pinnedLevels: [],
  presets: DEFAULT_PRESETS,

  hydrate: () => {
    if (typeof window === "undefined") return;
    const presets = readJson<Record<PresetId, WorkspaceSectionId[]>>(
      PRESETS_KEY,
      DEFAULT_PRESETS
    );
    const order = readJson<WorkspaceSectionId[]>(ORDER_KEY, presets.A ?? DEFAULT_WORKSPACE_ORDER);
    const activePresetRaw = window.localStorage.getItem(ACTIVE_PRESET_KEY);
    const activePreset: PresetId =
      activePresetRaw === "A" || activePresetRaw === "B" || activePresetRaw === "C"
        ? activePresetRaw
        : "A";
    const pinnedLevels = readJson<string[]>(PINNED_LEVELS_KEY, []);
    set({
      hydrated: true,
      presets,
      order,
      activePreset,
      pinnedLevels,
    });
  },

  setOrder: (next) => {
    writeJson(ORDER_KEY, next);
    set({ order: next });
  },

  loadPreset: (id) => {
    const target = get().presets[id] ?? DEFAULT_WORKSPACE_ORDER;
    writeJson(ORDER_KEY, target);
    if (typeof window !== "undefined") window.localStorage.setItem(ACTIVE_PRESET_KEY, id);
    set({ activePreset: id, order: target });
  },

  saveCurrentToPreset: (id) => {
    const nextPresets = {
      ...get().presets,
      [id]: get().order,
    };
    writeJson(PRESETS_KEY, nextPresets);
    if (typeof window !== "undefined") window.localStorage.setItem(ACTIVE_PRESET_KEY, id);
    set({ presets: nextPresets, activePreset: id });
  },

  resetLayout: () => {
    writeJson(ORDER_KEY, DEFAULT_WORKSPACE_ORDER);
    if (typeof window !== "undefined") window.localStorage.setItem(ACTIVE_PRESET_KEY, "A");
    set({ order: DEFAULT_WORKSPACE_ORDER, activePreset: "A" });
  },

  toggleEditingMode: () => {
    set((s) => ({ editingMode: !s.editingMode }));
  },

  togglePinnedLevel: (id) => {
    const setNow = new Set(get().pinnedLevels);
    if (setNow.has(id)) setNow.delete(id);
    else setNow.add(id);
    const next = [...setNow];
    writeJson(PINNED_LEVELS_KEY, next);
    set({ pinnedLevels: next });
  },
}));
