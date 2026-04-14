"use client";

import { useCallback, useState } from "react";
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
import { motion, AnimatePresence } from "framer-motion";
import { GripVertical, Plus, X, Activity, BarChart2, TrendingUp, Layers } from "lucide-react";
import { cn } from "@/lib/cn";
import { WIDGET_MAP, SECTION_META, type SectionId } from "@/registry/widgetRegistry";
import { useWidgetLayoutStore } from "@/stores/useWidgetLayoutStore";
import { WIDGET_COMPONENTS } from "@/components/dashboard/widgets";

const SECTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Activity,
  BarChart2,
  TrendingUp,
  Layers,
};

function SortableWidget({
  widgetId,
  sectionId,
  editMode,
}: {
  widgetId: string;
  sectionId: SectionId;
  editMode: boolean;
}) {
  const removeWidget = useWidgetLayoutStore((s) => s.removeWidget);
  const def = WIDGET_MAP.get(widgetId);
  const Component = WIDGET_COMPONENTS[widgetId];

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widgetId, disabled: !editMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (!Component) {
    return (
      <div className="rounded border border-white/[0.06] bg-[#0a0a0a] p-3 text-[10px] text-neutral-600">
        Unknown widget: {widgetId}
      </div>
    );
  }

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "group/widget relative rounded-md border border-white/[0.08] bg-[#0a0a0a] p-3 transition-all",
        editMode && "border-dashed border-white/[0.12] hover:border-white/[0.2]",
        isDragging && "z-50 opacity-70 shadow-lg shadow-black/40 ring-1 ring-emerald-500/30"
      )}
    >
      {editMode && (
        <div className="absolute -top-0 right-0 z-10 flex items-center gap-0.5 rounded-bl rounded-tr-md bg-[#0e0e0e] px-1 py-0.5 opacity-0 transition-opacity group-hover/widget:opacity-100">
          <button
            type="button"
            className="cursor-grab rounded p-0.5 text-neutral-500 hover:text-neutral-300"
            aria-label={`Drag ${def?.title ?? widgetId}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => removeWidget(sectionId, widgetId)}
            className="rounded p-0.5 text-neutral-500 hover:text-red-400"
            aria-label={`Remove ${def?.title ?? widgetId}`}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      <Component />
    </motion.div>
  );
}

interface SortableWidgetSectionProps {
  sectionId: SectionId;
  onOpenAddModal: (sectionId: SectionId) => void;
}

export default function SortableWidgetSection({
  sectionId,
  onOpenAddModal,
}: SortableWidgetSectionProps) {
  const { sections, editMode, reorderWidgets } = useWidgetLayoutStore();
  const widgetIds = sections[sectionId] ?? [];
  const meta = SECTION_META[sectionId];
  const SectionIcon = SECTION_ICONS[meta.icon] ?? Activity;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = widgetIds.indexOf(active.id as string);
      const newIndex = widgetIds.indexOf(over.id as string);
      if (oldIndex < 0 || newIndex < 0) return;
      reorderWidgets(sectionId, arrayMove(widgetIds, oldIndex, newIndex));
    },
    [widgetIds, sectionId, reorderWidgets]
  );

  return (
    <section className="rounded-lg border border-white/[0.06] bg-[#070707] panel-sheen">
      <header className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
        <div className="flex items-center gap-2">
          <SectionIcon className="h-3.5 w-3.5 text-neutral-500" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-neutral-500">
            {meta.title}
          </span>
          <span className="rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[8px] text-neutral-600">
            {widgetIds.length}
          </span>
        </div>
        {editMode && (
          <button
            type="button"
            onClick={() => onOpenAddModal(sectionId)}
            className="flex items-center gap-1 rounded border border-white/[0.08] bg-white/[0.03] px-2 py-1 font-mono text-[9px] text-neutral-500 transition-colors hover:border-white/[0.15] hover:text-neutral-300"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        )}
      </header>

      <div className="p-3">
        {widgetIds.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded border border-dashed border-white/[0.08] py-8 text-center">
            <div className="text-[10px] text-neutral-600">No widgets added</div>
            {editMode && (
              <button
                type="button"
                onClick={() => onOpenAddModal(sectionId)}
                className="mt-2 flex items-center gap-1 rounded border border-white/[0.08] px-2 py-1 text-[9px] text-neutral-500 transition-colors hover:text-neutral-300"
              >
                <Plus className="h-3 w-3" /> Add widget
              </button>
            )}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={widgetIds}
              strategy={verticalListSortingStrategy}
            >
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
                <AnimatePresence mode="popLayout">
                  {widgetIds.map((wid) => (
                    <SortableWidget
                      key={wid}
                      widgetId={wid}
                      sectionId={sectionId}
                      editMode={editMode}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </section>
  );
}
