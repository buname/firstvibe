"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, RotateCcw, Save, Pencil, PencilOff } from "lucide-react";
import { cn } from "@/lib/cn";
import type { GEXByStrike, KeyLevels, OptionContract } from "@/lib/gex-engine";
import { type SectionId } from "@/registry/widgetRegistry";
import {
  useWidgetLayoutStore,
  type PresetId,
} from "@/stores/useWidgetLayoutStore";
import { WidgetDataProvider, type WidgetData } from "@/components/dashboard/widgets/WidgetDataContext";
import SortableWidgetSection from "@/components/dashboard/SortableWidgetSection";
import AddWidgetModal from "@/components/dashboard/AddWidgetModal";

interface Props {
  symbol: string;
  displaySpot: number;
  spotPrice: number;
  keyLevels: KeyLevels;
  flowRatio: number;
  netFlow: number;
  totalNetGex: number;
  atmIvPct: number;
  change: number;
  changePct: number;
  live: boolean;
  chain: OptionContract[];
  lastUpdate: Date | null;
  gexByStrike: GEXByStrike[];
}

function fmtBillions(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${(n / 1e9).toFixed(3)}B`;
}

function DraggableSection({
  sectionId,
  editMode,
  onOpenAddModal,
}: {
  sectionId: SectionId;
  editMode: boolean;
  onOpenAddModal: (id: SectionId) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sectionId, disabled: !editMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative transition-shadow",
        isDragging && "z-50 opacity-80 shadow-lg shadow-black/50 ring-1 ring-emerald-500/30 rounded-lg"
      )}
    >
      {editMode && (
        <button
          type="button"
          className="absolute -left-1 top-2.5 z-10 cursor-grab rounded border border-white/[0.08] bg-[#0e0e0e] p-1 text-neutral-600 transition-colors hover:text-neutral-300"
          aria-label={`Drag ${sectionId} section`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}
      <SortableWidgetSection
        sectionId={sectionId}
        onOpenAddModal={onOpenAddModal}
      />
    </div>
  );
}

export default function TerminalTab(props: Props) {
  const {
    symbol, displaySpot, spotPrice, keyLevels,
    flowRatio, netFlow, totalNetGex, atmIvPct,
    change, changePct, live, chain, lastUpdate, gexByStrike,
  } = props;

  const {
    editMode,
    activePreset,
    sectionOrder,
    toggleEditMode,
    loadPreset,
    saveCurrentToPreset,
    resetLayout,
    reorderSections,
  } = useWidgetLayoutStore();

  const [addModalSection, setAddModalSection] = useState<SectionId | null>(null);

  const sectionSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleSectionDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = sectionOrder.indexOf(active.id as SectionId);
      const newIndex = sectionOrder.indexOf(over.id as SectionId);
      if (oldIndex < 0 || newIndex < 0) return;
      reorderSections(arrayMove(sectionOrder, oldIndex, newIndex));
    },
    [sectionOrder, reorderSections]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable) return;
      }
      const k = e.key.toLowerCase();
      if (k === "e") {
        e.preventDefault();
        toggleEditMode();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleEditMode]);

  const handleOpenAddModal = useCallback((sectionId: SectionId) => {
    setAddModalSection(sectionId);
  }, []);

  const widgetData: WidgetData = {
    symbol, displaySpot, spotPrice, keyLevels,
    flowRatio, netFlow, totalNetGex, atmIvPct,
    change, changePct, live, chain, lastUpdate, gexByStrike,
  };

  const activityLine =
    lastUpdate &&
    `[${lastUpdate.toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    })}] DATA ${live ? "LIVE" : "DEMO"} — ${symbol} @ ${displaySpot.toFixed(2)} · NET GEX ${fmtBillions(totalNetGex)}`;

  return (
    <WidgetDataProvider value={widgetData}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 md:p-4">
        {/* Header bar */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded border border-white/[0.06] bg-[#070707] px-3 py-2">
          <div className="flex items-center gap-2 text-[10px] text-neutral-400">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em]">
              Terminal
            </h2>
            <span className="text-neutral-600">
              {live ? "LIVE" : "DEMO"} · ALT+E edit
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {(["A", "B", "C"] as PresetId[]).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => loadPreset(preset)}
                className={cn(
                  "rounded border px-2 py-1 text-[10px] font-semibold transition-colors",
                  activePreset === preset
                    ? "border-neutral-500/60 bg-[#1f1f1f] text-white"
                    : "border-white/[0.08] bg-[#111] text-neutral-600 hover:text-neutral-300"
                )}
              >
                {preset}
              </button>
            ))}
            <button
              type="button"
              onClick={() => saveCurrentToPreset(activePreset)}
              className="rounded border border-white/[0.08] bg-[#101010] px-2 py-1 text-[10px] text-neutral-500 hover:text-neutral-200"
            >
              <span className="inline-flex items-center gap-1">
                <Save className="h-3 w-3" /> Save
              </span>
            </button>
            <button
              type="button"
              onClick={resetLayout}
              className="rounded border border-white/[0.08] bg-[#101010] px-2 py-1 text-[10px] text-red-400/80 hover:text-red-300"
            >
              <span className="inline-flex items-center gap-1">
                <RotateCcw className="h-3 w-3" /> Reset
              </span>
            </button>
            <button
              type="button"
              onClick={toggleEditMode}
              aria-pressed={editMode}
              className={cn(
                "rounded border px-2 py-1 text-[10px] transition-colors",
                editMode
                  ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                  : "border-white/[0.08] bg-[#111] text-neutral-500"
              )}
            >
              <span className="inline-flex items-center gap-1">
                {editMode ? <PencilOff className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
                {editMode ? "Edit: ON" : "Edit: OFF"}
              </span>
            </button>
          </div>
        </div>

        {/* Status bar */}
        <div
          aria-live="polite"
          className={cn(
            "shrink-0 rounded border px-2 py-1 text-[10px]",
            editMode
              ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
              : "border-white/[0.06] bg-[#070707] text-neutral-600"
          )}
        >
          {editMode
            ? "Editing mode — drag widgets to reorder, add or remove as needed."
            : "Live updates active. Press Alt+E to customize layout."}
        </div>

        {/* Sections — sortable at section level */}
        <DndContext
          sensors={sectionSensors}
          collisionDetection={closestCenter}
          onDragEnd={handleSectionDragEnd}
        >
          <SortableContext
            items={sectionOrder}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid grid-cols-1 gap-3">
              {sectionOrder.map((sectionId) => (
                <DraggableSection
                  key={sectionId}
                  sectionId={sectionId}
                  editMode={editMode}
                  onOpenAddModal={handleOpenAddModal}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Activity line */}
        {activityLine && (
          <div className="shrink-0 rounded border border-white/[0.06] bg-black/60 px-2 py-1.5 font-mono text-[10px] text-neutral-500">
            {activityLine}
          </div>
        )}
      </div>

      {/* Add Widget Modal */}
      {addModalSection && (
        <AddWidgetModal
          sectionId={addModalSection}
          onClose={() => setAddModalSection(null)}
        />
      )}
    </WidgetDataProvider>
  );
}
