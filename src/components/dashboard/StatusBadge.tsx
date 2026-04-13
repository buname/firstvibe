"use client";

import type { ResilientStatus } from "@/hooks/useResilientFetch";

export default function StatusBadge({
  status,
  updatedAt,
  onRetry,
}: {
  status: ResilientStatus;
  updatedAt?: number | null;
  onRetry?: () => void;
}) {
  const text =
    status === "live"
      ? "LIVE"
      : status === "degraded"
        ? "DEGRADED"
        : status === "stale"
          ? "STALE SNAPSHOT"
          : status === "loading"
            ? "LOADING"
            : status === "error"
              ? "ERROR"
              : "IDLE";
  const tone =
    status === "live"
      ? "border-emerald-500/40 text-emerald-400"
      : status === "degraded"
        ? "border-amber-500/40 text-amber-400"
        : status === "stale"
          ? "border-orange-500/40 text-orange-400"
          : status === "error"
            ? "border-rose-500/40 text-rose-400"
            : "border-[#333] text-[#777]";

  return (
    <div className="flex items-center gap-2 text-[9px] font-mono">
      <span className={`rounded border px-1.5 py-0.5 ${tone}`}>
        {text}
      </span>
      {updatedAt ? (
        <span className="text-[#666]">{new Date(updatedAt).toLocaleTimeString()}</span>
      ) : null}
      {(status === "stale" || status === "error") && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded border border-[#333] px-1.5 py-0.5 text-[#999] hover:text-white"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
