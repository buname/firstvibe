"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_SECTION_WIDGETS,
  SECTION_ORDER,
  WIDGET_MAP,
  type DefaultLayout,
  type SectionId,
} from "@/registry/widgetRegistry";

export type PresetId = "A" | "B" | "C";

interface LayoutSnapshot {
  sections: DefaultLayout;
  sectionOrder: SectionId[];
}

interface WidgetLayoutState {
  sections: DefaultLayout;
  sectionOrder: SectionId[];
  editMode: boolean;
  activePreset: PresetId;
  presets: Record<PresetId, LayoutSnapshot>;

  toggleEditMode: () => void;
  setEditMode: (on: boolean) => void;

  reorderSections: (order: SectionId[]) => void;
  addWidget: (sectionId: SectionId, widgetId: string) => void;
  removeWidget: (sectionId: SectionId, widgetId: string) => void;
  reorderWidgets: (sectionId: SectionId, widgetIds: string[]) => void;
  moveWidget: (
    fromSection: SectionId,
    toSection: SectionId,
    widgetId: string,
    toIndex?: number
  ) => void;

  loadPreset: (id: PresetId) => void;
  saveCurrentToPreset: (id: PresetId) => void;
  resetLayout: () => void;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export const useWidgetLayoutStore = create<WidgetLayoutState>()(
  persist(
    (set, get) => ({
      sections: deepClone(DEFAULT_SECTION_WIDGETS),
      sectionOrder: [...SECTION_ORDER],
      editMode: false,
      activePreset: "A",
      presets: {
        A: { sections: deepClone(DEFAULT_SECTION_WIDGETS), sectionOrder: [...SECTION_ORDER] },
        B: { sections: deepClone(DEFAULT_SECTION_WIDGETS), sectionOrder: [...SECTION_ORDER] },
        C: { sections: deepClone(DEFAULT_SECTION_WIDGETS), sectionOrder: [...SECTION_ORDER] },
      },

      toggleEditMode: () => set((s) => ({ editMode: !s.editMode })),
      setEditMode: (on) => set({ editMode: on }),

      reorderSections: (order) => set({ sectionOrder: order }),

      addWidget: (sectionId, widgetId) => {
        const widget = WIDGET_MAP.get(widgetId);
        if (!widget) return;
        set((s) => {
          const section = [...(s.sections[sectionId] ?? [])];
          if (section.includes(widgetId)) return s;
          section.push(widgetId);
          return { sections: { ...s.sections, [sectionId]: section } };
        });
      },

      removeWidget: (sectionId, widgetId) => {
        set((s) => {
          const section = (s.sections[sectionId] ?? []).filter(
            (id) => id !== widgetId
          );
          return { sections: { ...s.sections, [sectionId]: section } };
        });
      },

      reorderWidgets: (sectionId, widgetIds) => {
        set((s) => ({
          sections: { ...s.sections, [sectionId]: widgetIds },
        }));
      },

      moveWidget: (fromSection, toSection, widgetId, toIndex) => {
        set((s) => {
          const from = (s.sections[fromSection] ?? []).filter(
            (id) => id !== widgetId
          );
          const to = [...(s.sections[toSection] ?? [])];
          if (to.includes(widgetId)) return s;
          if (toIndex !== undefined) {
            to.splice(toIndex, 0, widgetId);
          } else {
            to.push(widgetId);
          }
          return {
            sections: {
              ...s.sections,
              [fromSection]: from,
              [toSection]: to,
            },
          };
        });
      },

      loadPreset: (id) => {
        const preset = get().presets[id];
        if (preset) {
          set({
            activePreset: id,
            sections: deepClone(preset.sections),
            sectionOrder: [...preset.sectionOrder],
          });
        } else {
          set({
            activePreset: id,
            sections: deepClone(DEFAULT_SECTION_WIDGETS),
            sectionOrder: [...SECTION_ORDER],
          });
        }
      },

      saveCurrentToPreset: (id) => {
        set((s) => ({
          activePreset: id,
          presets: {
            ...s.presets,
            [id]: {
              sections: deepClone(s.sections),
              sectionOrder: [...s.sectionOrder],
            },
          },
        }));
      },

      resetLayout: () => {
        set({
          sections: deepClone(DEFAULT_SECTION_WIDGETS),
          sectionOrder: [...SECTION_ORDER],
          activePreset: "A",
        });
      },
    }),
    { name: "bex-widget-layout" }
  )
);
