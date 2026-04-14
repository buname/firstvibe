"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { WIDGET_REGISTRY, SECTION_META, type SectionId } from "@/registry/widgetRegistry";
import { useWidgetLayoutStore } from "@/stores/useWidgetLayoutStore";

interface AddWidgetModalProps {
  sectionId: SectionId | null;
  onClose: () => void;
}

export default function AddWidgetModal({ sectionId, onClose }: AddWidgetModalProps) {
  const { sections, addWidget } = useWidgetLayoutStore();
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!sectionId) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [sectionId, onClose]);

  const currentWidgets = sectionId ? (sections[sectionId] ?? []) : [];

  const available = useMemo(() => {
    if (!sectionId) return [];
    return WIDGET_REGISTRY.filter((w) => {
      if (!w.allowedSections.includes(sectionId)) return false;
      if (currentWidgets.includes(w.id)) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          w.title.toLowerCase().includes(q) ||
          w.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [sectionId, currentWidgets, search]);

  if (!sectionId) return null;

  const meta = SECTION_META[sectionId];

  return (
    <AnimatePresence>
      <motion.div
        key="add-widget-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          key="add-widget-panel"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
          className="w-full max-w-md rounded-lg border border-white/[0.08] bg-[#0a0a0a] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <div>
              <div className="font-mono text-[11px] font-bold uppercase tracking-widest text-neutral-400">
                Add Widget
              </div>
              <div className="mt-0.5 text-[10px] text-neutral-600">
                to {meta.title}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-white/[0.08] p-1.5 text-neutral-500 transition-colors hover:text-neutral-300"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="border-b border-white/[0.06] px-4 py-2">
            <div className="flex items-center gap-2 rounded border border-white/[0.08] bg-black/40 px-2 py-1.5">
              <Search className="h-3 w-3 text-neutral-600" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search widgets..."
                className="flex-1 bg-transparent text-[11px] text-neutral-300 placeholder-neutral-600 outline-none"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-[340px] overflow-y-auto p-2">
            {available.length === 0 ? (
              <div className="py-8 text-center text-[10px] text-neutral-600">
                {search
                  ? "No matching widgets found"
                  : "All available widgets are already added"}
              </div>
            ) : (
              <div className="space-y-1">
                {available.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => {
                      addWidget(sectionId, w.id);
                      onClose();
                    }}
                    className="flex w-full items-center gap-3 rounded-md border border-transparent px-3 py-2.5 text-left transition-colors hover:border-white/[0.08] hover:bg-white/[0.03]"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-white/[0.04]">
                      <Plus className="h-3.5 w-3.5 text-neutral-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium text-neutral-300">
                        {w.title}
                      </div>
                      <div className="mt-0.5 text-[9px] text-neutral-600 truncate">
                        {w.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
