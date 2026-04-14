"use client";

import { type ReactNode, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Maximize2, X } from "lucide-react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { useViewStateStore } from "@/stores/useViewStateStore";

interface ExpandablePanelProps {
  id: string;
  title?: string;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  /** Extra elements rendered in the header bar next to the toggle button */
  headerExtra?: ReactNode;
}

function FullscreenPortal({
  id,
  title,
  children,
  onClose,
}: {
  id: string;
  title?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return createPortal(
    <AnimatePresence>
      <motion.div
        key={`overlay-${id}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          key={`panel-${id}`}
          layoutId={`expandable-${id}`}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          className="relative flex flex-col overflow-hidden rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] panel-sheen shadow-2xl shadow-black/60"
          style={{ width: "95vw", height: "95vh" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Fullscreen header */}
          <div className="flex items-center justify-between border-b border-[#1a1a1a] px-4 py-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              {title && (
                <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#7a7a7a]">
                  {title}
                </span>
              )}
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
                onClick={onClose}
                className="rounded border border-[#2a2a2a] bg-[#121212] p-1.5 text-[#9ca3af] transition-colors hover:border-[#444] hover:text-[#e5e7eb]"
                aria-label="Exit fullscreen"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Fullscreen content — absolute fill so ResponsiveContainer gets a concrete height */}
          <div className="relative flex-1 min-h-0">
            <div className="absolute inset-0 flex flex-col p-3 [&>div]:flex-1 [&>div]:min-h-0">
              {children}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

export default function ExpandablePanel({
  id,
  title,
  children,
  className,
  headerClassName,
  headerExtra,
}: ExpandablePanelProps) {
  const { activeFullscreenComponentId, toggleFullscreen, clearFullscreen } =
    useViewStateStore();

  const isActive = activeFullscreenComponentId === id;

  useEffect(() => {
    if (!isActive) return;
    const lockBody = () => {
      document.body.style.overflow = "hidden";
    };
    const unlockBody = () => {
      document.body.style.overflow = "";
    };
    lockBody();
    return unlockBody;
  }, [isActive]);

  return (
    <>
      {/* Inline (normal) view */}
      <motion.div
        layoutId={`expandable-${id}`}
        className={cn("group relative", className)}
        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      >
        {/* Header bar */}
        <div
          className={cn(
            "flex items-center justify-between",
            headerClassName
          )}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {title && (
              <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#555]">
                {title}
              </span>
            )}
            {headerExtra}
          </div>
          <button
            type="button"
            onClick={() => toggleFullscreen(id)}
            className="rounded border border-[#2a2a2a] bg-[#101010] p-1 text-[#9ca3af] opacity-0 transition-all group-hover:opacity-100 hover:border-[#444] hover:text-[#e5e7eb]"
            aria-label="Expand to fullscreen"
          >
            <Maximize2 className="h-3 w-3" />
          </button>
        </div>

        {/* Content */}
        {children}
      </motion.div>

      {/* Fullscreen portal */}
      {isActive && (
        <FullscreenPortal
          id={id}
          title={title}
          onClose={clearFullscreen}
        >
          {children}
        </FullscreenPortal>
      )}
    </>
  );
}
