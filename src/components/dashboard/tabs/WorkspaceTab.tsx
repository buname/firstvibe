"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { GripVertical, Maximize2, RotateCcw, Save, Sparkles, Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { useViewStateStore } from "@/stores/useViewStateStore";
import type { GEXByStrike, KeyLevels, OptionContract } from "@/lib/gex-engine";
import HeatmapView from "@/components/dashboard/heatmap/HeatmapView";
import {
  type PresetId,
  type WorkspaceSectionId,
  useWorkspaceLayoutStore,
} from "@/stores/useWorkspaceLayoutStore";

interface WorkspaceTabProps {
  symbol: string;
  spotPrice: number;
  changePct: number;
  flowRatio: number;
  netFlow: number;
  atmIvPct: number;
  totalNetGex: number;
  keyLevels: KeyLevels;
  gexByStrike: GEXByStrike[];
  chain: OptionContract[];
  lastUpdate: Date;
  live: boolean;
}

type WorkspaceMetricsSnapshot = WorkspaceTabProps;

function isTypingElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}

function asMoney(value: number): string {
  return `$${value.toFixed(2)}`;
}

function asCompact(value: number): string {
  return Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function SectionShell({
  id,
  title,
  children,
  editingMode,
  activeId,
  overId,
  reducedMotion,
}: {
  id: WorkspaceSectionId;
  title: string;
  children: ReactNode;
  editingMode: boolean;
  activeId: WorkspaceSectionId | null;
  overId: WorkspaceSectionId | null;
  reducedMotion: boolean;
}) {
  const toggleFullscreen = useViewStateStore((s) => s.toggleFullscreen);

  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    transform,
    isDragging,
  } = useDraggable({
    id,
    disabled: !editingMode,
  });
  const { setNodeRef: setDroppableRef } = useDroppable({ id });

  const setNodeRef = (node: HTMLElement | null) => {
    setDraggableRef(node);
    setDroppableRef(node);
  };

  const style: CSSProperties = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : {};

  return (
    <motion.section
      layout
      transition={
        reducedMotion
          ? { duration: 0 }
          : { type: "spring", stiffness: 260, damping: 28, mass: 0.5 }
      }
      ref={setNodeRef}
      style={style}
      className={cn(
        "group/shell rounded-lg border border-[#1d1d1d] bg-[#090909] panel-sheen transition-all",
        editingMode && "border-dashed border-[#2f2f2f]",
        isDragging && "opacity-55 ring-1 ring-[#00ff88]/45",
        !isDragging && overId === id && activeId !== id && "ring-1 ring-[#9ca3af]/35"
      )}
    >
      <header className="flex items-center justify-between border-b border-[#171717] px-3 py-2">
        <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#7a7a7a]">
          {title}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => toggleFullscreen(`workspace-${id}`)}
            className="rounded border border-[#2a2a2a] bg-[#101010] p-1 text-[#9ca3af] opacity-0 transition-all group-hover/shell:opacity-100 hover:border-[#444] hover:text-[#e5e7eb]"
            aria-label={`Expand ${title} to fullscreen`}
          >
            <Maximize2 className="h-3 w-3" />
          </button>
          <button
            type="button"
            className={cn(
              "flex items-center gap-1 rounded px-2 py-1 text-[9px] font-mono transition-colors",
              editingMode
                ? "cursor-grab border border-[#2a2a2a] bg-[#121212] text-[#9ca3af] hover:text-[#d4d4d8]"
                : "cursor-not-allowed border border-[#1a1a1a] text-[#4a4a4a]"
            )}
            aria-label={`Drag ${title} section`}
            {...attributes}
            {...listeners}
            disabled={!editingMode}
          >
            <GripVertical className="h-3.5 w-3.5" />
            ::
          </button>
        </div>
      </header>
      <div className="p-3">{children}</div>
    </motion.section>
  );
}

export default function WorkspaceTab(props: WorkspaceTabProps) {
  const reducedMotion = useReducedMotion();
  const metricSnapshot = useMemo<WorkspaceMetricsSnapshot>(() => props, [props]);

  const [activeId, setActiveId] = useState<WorkspaceSectionId | null>(null);
  const [overId, setOverId] = useState<WorkspaceSectionId | null>(null);
  const [frozenSnapshot, setFrozenSnapshot] = useState<WorkspaceMetricsSnapshot | null>(null);
  const {
    hydrated,
    order,
    activePreset,
    editingMode,
    pinnedLevels,
    hydrate,
    setOrder,
    loadPreset,
    saveCurrentToPreset,
    resetLayout,
    toggleEditingMode,
    togglePinnedLevel,
  } = useWorkspaceLayoutStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const toggleEditingWithFreeze = useCallback(() => {
    setFrozenSnapshot((prev) => (editingMode ? null : prev ?? metricSnapshot));
    toggleEditingMode();
  }, [editingMode, metricSnapshot, toggleEditingMode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || isTypingElement(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === "1") {
        e.preventDefault();
        loadPreset("A");
      } else if (k === "2") {
        e.preventDefault();
        loadPreset("B");
      } else if (k === "3") {
        e.preventDefault();
        loadPreset("C");
      } else if (k === "s") {
        e.preventDefault();
        saveCurrentToPreset(activePreset);
      } else if (k === "r") {
        e.preventDefault();
        resetLayout();
      } else if (k === "e") {
        e.preventDefault();
        toggleEditingWithFreeze();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    activePreset,
    loadPreset,
    resetLayout,
    saveCurrentToPreset,
    toggleEditingWithFreeze,
  ]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const displaySnapshot = editingMode ? frozenSnapshot ?? metricSnapshot : metricSnapshot;
  const {
    symbol,
    spotPrice,
    changePct,
    flowRatio,
    netFlow,
    atmIvPct,
    totalNetGex,
    keyLevels,
    gexByStrike,
    chain,
    lastUpdate,
    live,
  } = displaySnapshot;

  const sortedByAbsoluteGex = useMemo(
    () =>
      [...gexByStrike]
        .sort((a, b) => Math.abs(b.netGEX) - Math.abs(a.netGEX))
        .slice(0, 3),
    [gexByStrike]
  );
  const expectedMove = (spotPrice * (atmIvPct / 100)) / Math.sqrt(252);
  const rvProxy = Math.abs(changePct) * 0.9;
  const ivRvSpread = atmIvPct - rvProxy;
  const gammaRegime = totalNetGex >= 0 ? "LONG GAMMA" : "SHORT GAMMA";
  const keyLevelRows = [
    {
      id: "gammaFlip",
      label: "Gamma Flip",
      value: keyLevels.gammaFlip,
      tone: "text-violet-300",
      tip: "Regime transition level where net gamma changes sign.",
    },
    {
      id: "callWall",
      label: "Call Wall",
      value: keyLevels.callWall,
      tone: "text-emerald-300",
      tip: "Upside resistance from concentrated call gamma.",
    },
    {
      id: "putWall",
      label: "Put Wall",
      value: keyLevels.putWall,
      tone: "text-rose-300",
      tip: "Downside support/pressure from concentrated put gamma.",
    },
    {
      id: "maxPain",
      label: "Max Pain",
      value: keyLevels.maxPain,
      tone: "text-amber-300",
      tip: "Option payout equilibrium into expiry.",
    },
    {
      id: "volTrigger",
      label: "Vol Trigger",
      value: keyLevels.volTrigger,
      tone: "text-fuchsia-300",
      tip: "Spot level likely to increase realized intraday vol.",
    },
    {
      id: "spot",
      label: "Spot",
      value: keyLevels.spotPrice,
      tone: "text-cyan-300",
      tip: "Current underlying spot used for gamma calculations.",
    },
  ] as const;

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    setOverId(null);
    const active = event.active.id as WorkspaceSectionId;
    const over = event.over?.id as WorkspaceSectionId | undefined;
    if (!over || active === over) return;
    const from = order.indexOf(active);
    const to = order.indexOf(over);
    if (from < 0 || to < 0) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setOrder(next);
  };

  const sections: Record<WorkspaceSectionId, ReactNode> = {
    "core-snapshot": (
      <div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
        <div className="rounded border border-[#1b1b1b] bg-[#0e0e0e] p-2">
          <div className="text-[9px] uppercase tracking-wider text-[#666]">Gamma regime</div>
          <div
            className={cn(
              "mt-2 text-xl font-bold",
              totalNetGex >= 0 ? "text-emerald-400" : "text-rose-400"
            )}
          >
            {gammaRegime}
          </div>
          <div className="mt-1 text-[10px] text-[#808080]">
            Net GEX {totalNetGex >= 0 ? "+" : ""}
            {asCompact(totalNetGex)}
          </div>
        </div>
        <div className="rounded border border-[#1b1b1b] bg-[#0e0e0e] p-2">
          <div className="text-[9px] uppercase tracking-wider text-[#666]">Key levels</div>
          <div className="mt-2 grid grid-cols-2 gap-1">
            {keyLevelRows.map((row) => (
              <div
                key={row.id}
                className="rounded border border-[#1f1f1f] bg-[#121212] px-2 py-1"
                title={row.tip}
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="text-[8px] text-[#666]">{row.label}</div>
                  <button
                    type="button"
                    onClick={() => togglePinnedLevel(row.id)}
                    aria-label={`Pin ${row.label}`}
                    aria-pressed={pinnedLevels.includes(row.id)}
                    className="text-[#666] transition-colors hover:text-amber-300"
                  >
                    <Star
                      className={cn(
                        "h-3 w-3",
                        pinnedLevels.includes(row.id) &&
                          "fill-amber-300 text-amber-300"
                      )}
                    />
                  </button>
                </div>
                <div className={cn("text-[11px] font-semibold", row.tone)}>
                  {asMoney(Number(row.value))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded border border-[#1b1b1b] bg-[#0e0e0e] p-2">
          <div className="text-[9px] uppercase tracking-wider text-[#666]">Exposure & flow</div>
          <div className="mt-2 space-y-2 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-[#7a7a7a]">Flow ratio</span>
              <span
                className={cn(
                  "rounded border px-1.5 py-0.5 text-[10px]",
                  flowRatio >= 1
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border-rose-500/30 bg-rose-500/10 text-rose-300"
                )}
              >
                {flowRatio.toFixed(2)}x
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#7a7a7a]">Net flow</span>
              <span
                className={cn(
                  "rounded border px-1.5 py-0.5 text-[10px]",
                  netFlow >= 0
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border-rose-500/30 bg-rose-500/10 text-rose-300"
                )}
              >
                {asCompact(netFlow)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#7a7a7a]">IV / RV spread</span>
              <span className={ivRvSpread >= 0 ? "text-amber-300" : "text-sky-300"}>
                {ivRvSpread.toFixed(2)}%
              </span>
            </div>
            <div className="rounded border border-[#1f1f1f] bg-[#121212] px-2 py-1 text-[10px] text-[#7f7f7f]">
              ATM IV {atmIvPct.toFixed(2)}% · RV proxy {rvProxy.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>
    ),
    overview: (
      <div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
        <div className="rounded border border-[#1c1c1c] bg-[#101010] p-3">
          <div className="text-[9px] uppercase tracking-wider text-[#666]">Expected move</div>
          <div className="mt-2 text-2xl font-bold text-[#f5f5f5]">
            ±{expectedMove.toFixed(2)}
          </div>
          <div className="text-[10px] text-[#737373]">1D proxy from ATM IV</div>
        </div>
        <div className="rounded border border-[#1c1c1c] bg-[#101010] p-3">
          <div className="text-[9px] uppercase tracking-wider text-[#666]">Daily range</div>
          <div className="mt-2 text-[11px] text-[#9ca3af]">
            <div className="flex justify-between">
              <span>Projected High</span>
              <span className="text-emerald-300">{asMoney(spotPrice + expectedMove)}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span>Projected Low</span>
              <span className="text-rose-300">{asMoney(spotPrice - expectedMove)}</span>
            </div>
          </div>
        </div>
        <div className="rounded border border-[#1c1c1c] bg-[#101010] p-3">
          <div className="text-[9px] uppercase tracking-wider text-[#666]">Quick links</div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[9px]">
            {["Open Exposures", "Open Flow", "Open Heatmap", "Open Terminal"].map((x) => (
              <button
                key={x}
                type="button"
                className="rounded border border-[#2a2a2a] bg-[#151515] px-2 py-1 text-[#9ca3af] transition-colors hover:text-[#e2e8f0]"
                aria-label={x}
              >
                {x}
              </button>
            ))}
          </div>
        </div>
      </div>
    ),
    structure: (
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        <div className="rounded border border-[#1c1c1c] bg-[#101010] p-3">
          <div className="text-[9px] uppercase tracking-wider text-[#666]">Structure concentration</div>
          <div className="mt-2 space-y-1.5">
            {sortedByAbsoluteGex.map((row) => (
              <div
                key={row.strike}
                className="flex items-center justify-between rounded border border-[#222] bg-[#121212] px-2 py-1"
              >
                <span className="text-[10px] text-[#8b8b8b]">Strike {row.strike.toFixed(0)}</span>
                <span className={row.netGEX >= 0 ? "text-emerald-300" : "text-rose-300"}>
                  {asCompact(row.netGEX)}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded border border-[#1c1c1c] bg-[#101010] p-3">
          <div className="text-[9px] uppercase tracking-wider text-[#666]">Tape context</div>
          <div className="mt-2 space-y-1 text-[11px] text-[#9ca3af]">
            <div className="flex items-center justify-between">
              <span>Spot</span>
              <span className="text-[#d4d4d8]">{asMoney(spotPrice)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Change %</span>
              <span className={changePct >= 0 ? "text-emerald-300" : "text-rose-300"}>
                {changePct.toFixed(2)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Last update</span>
              <span className="text-[#a3a3a3]">
                {lastUpdate.toLocaleTimeString("en-US", { hour12: false })}
              </span>
            </div>
            <div className="mt-1 rounded border border-[#202020] bg-[#121212] px-2 py-1 text-[10px]">
              Feed mode:{" "}
              <span className="text-emerald-300">LIVE</span>
            </div>
          </div>
        </div>
      </div>
    ),
    "heatmap-dual": (
      <div className="rounded border border-[#1c1c1c] bg-[#0b0b0b] p-1">
        <HeatmapView
          primarySymbol={symbol}
          primarySpotPrice={spotPrice}
          primaryChain={chain}
          live={live}
          className="p-0"
        />
      </div>
    ),
  };

  if (!hydrated) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-2 p-3 font-mono">
        <div className="h-10 animate-pulse rounded border border-[#1d1d1d] bg-[#090909]" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-36 animate-pulse rounded border border-[#1d1d1d] bg-[#0b0b0b]"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-3 font-mono">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-[#1d1d1d] bg-[#070707] px-3 py-2">
        <div className="flex items-center gap-2 text-[10px] text-[#9ca3af]">
          <Sparkles className="h-3.5 w-3.5 text-[#e5e7eb]" />
          Workspace Layout
          <span className="text-[#4b5563]">ALT+1/2/3 preset · ALT+E edit mode</span>
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
                  ? "border-[#9ca3af]/60 bg-[#1f1f1f] text-white"
                  : "border-[#2a2a2a] bg-[#111] text-[#7a7a7a] hover:text-[#cbd5e1]"
              )}
            >
              {preset}
            </button>
          ))}
          <button
            type="button"
            onClick={() => saveCurrentToPreset(activePreset)}
            className="rounded border border-[#2a2a2a] bg-[#101010] px-2 py-1 text-[10px] text-[#94a3b8] hover:text-[#e2e8f0]"
          >
            <span className="inline-flex items-center gap-1">
              <Save className="h-3 w-3" />
              Save
            </span>
          </button>
          <button
            type="button"
            onClick={resetLayout}
            className="rounded border border-[#2a2a2a] bg-[#101010] px-2 py-1 text-[10px] text-[#fca5a5] hover:text-[#fecaca]"
          >
            <span className="inline-flex items-center gap-1">
              <RotateCcw className="h-3 w-3" />
              Reset
            </span>
          </button>
          <button
            type="button"
            onClick={toggleEditingWithFreeze}
            aria-pressed={editingMode}
            className={cn(
              "rounded border px-2 py-1 text-[10px]",
              editingMode
                ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                : "border-[#2a2a2a] bg-[#111] text-[#9ca3af]"
            )}
          >
            {editingMode ? "Edit: ON" : "Edit: OFF"}
          </button>
        </div>
      </div>

      <div
        aria-live="polite"
        className={cn(
          "rounded border px-2 py-1 text-[10px]",
          editingMode
            ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
            : "border-[#1d1d1d] bg-[#080808] text-[#6b7280]"
        )}
      >
        {editingMode
          ? "Editing mode active: layout guides on, live values paused."
          : "Live updates active. Press Alt+E to enter layout editing mode."}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(e) => setActiveId(e.active.id as WorkspaceSectionId)}
        onDragOver={(e) => setOverId((e.over?.id as WorkspaceSectionId | undefined) ?? null)}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          setOverId(null);
        }}
      >
        <div className="grid grid-cols-1 gap-2">
          {order.map((id) => (
            <SectionShell
              key={id}
              id={id}
              editingMode={editingMode}
              activeId={activeId}
              overId={overId}
              reducedMotion={!!reducedMotion}
              title={
                id === "core-snapshot"
                  ? "Core Snapshot"
                  : id === "overview"
                    ? "Overview"
                    : id === "structure"
                      ? "Structure"
                      : "Heatmap Dual"
              }
            >
              {sections[id]}
            </SectionShell>
          ))}
        </div>
      </DndContext>

      <WorkspaceSectionPortal sections={sections} />
    </div>
  );
}

function WorkspaceSectionPortal({
  sections,
}: {
  sections: Record<WorkspaceSectionId, ReactNode>;
}) {
  const { activeFullscreenComponentId, clearFullscreen } = useViewStateStore();

  const sectionTitles: Record<WorkspaceSectionId, string> = {
    "core-snapshot": "Core Snapshot",
    overview: "Overview",
    structure: "Structure",
    "heatmap-dual": "Heatmap Dual",
  };

  const activeSectionId = activeFullscreenComponentId?.startsWith("workspace-")
    ? (activeFullscreenComponentId.replace("workspace-", "") as WorkspaceSectionId)
    : null;

  const isActive = activeSectionId !== null && activeSectionId in sections;

  useEffect(() => {
    if (!isActive) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isActive]);

  if (!isActive || !activeSectionId) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="ws-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        onClick={clearFullscreen}
      >
        <motion.div
          key={`ws-panel-${activeSectionId}`}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          className="relative flex flex-col rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] panel-sheen shadow-2xl shadow-black/60"
          style={{ width: "95vw", height: "95vh" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-[#1a1a1a] px-4 py-2.5 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#7a7a7a]">
                {sectionTitles[activeSectionId]}
              </span>
              <span className="rounded bg-[#1a1a1a] px-1.5 py-0.5 font-mono text-[8px] text-[#555] uppercase tracking-wider">
                Focus mode
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9px] text-[#444]">
                ESC to exit
              </span>
              <button
                type="button"
                onClick={clearFullscreen}
                className="rounded border border-[#2a2a2a] bg-[#121212] p-1.5 text-[#9ca3af] transition-colors hover:border-[#444] hover:text-[#e5e7eb]"
                aria-label="Exit fullscreen"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="relative flex-1 min-h-0">
            <div className="absolute inset-0 flex flex-col p-4 [&>div]:flex-1 [&>div]:min-h-0">
              {sections[activeSectionId]}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
