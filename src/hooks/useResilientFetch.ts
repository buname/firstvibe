"use client";

import { useCallback, useRef, useState } from "react";

export type ResilientStatus = "idle" | "loading" | "live" | "degraded" | "stale" | "error";

type Snapshot<T> = {
  data: T;
  updatedAt: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function useResilientFetch<T>(opts: {
  snapshotKey: string;
  maxAttempts?: number;
  isDegraded?: (data: T) => boolean;
}) {
  const { snapshotKey, maxAttempts = 3, isDegraded } = opts;
  const [status, setStatus] = useState<ResilientStatus>("idle");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<Snapshot<T> | null>(null);

  const run = useCallback(
    async (fetcher: () => Promise<T>): Promise<{ data: T | null; status: ResilientStatus }> => {
      setStatus("loading");
      setError(null);

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          if (attempt > 0) {
            console.info(`[resilient-fetch] retry ${attempt} for ${snapshotKey}`);
          }
          const data = await fetcher();
          const degraded = isDegraded?.(data) ?? false;
          const now = Date.now();
          setUpdatedAt(now);
          setStatus(degraded ? "degraded" : "live");

          const snap: Snapshot<T> = { data, updatedAt: now };
          cacheRef.current = snap;
          localStorage.setItem(snapshotKey, JSON.stringify(snap));
          return { data, status: degraded ? "degraded" : "live" };
        } catch (e) {
          if (attempt < maxAttempts - 1) {
            await sleep(350 * 2 ** attempt);
            continue;
          }
          setError(e instanceof Error ? e.message : "Request failed");
        }
      }

      const fallback =
        cacheRef.current ??
        (() => {
          try {
            const raw = localStorage.getItem(snapshotKey);
            if (!raw) return null;
            const parsed = JSON.parse(raw) as Snapshot<T>;
            console.info(`[resilient-fetch] snapshot hit ${snapshotKey}`);
            return parsed;
          } catch {
            return null;
          }
        })();

      if (fallback) {
        setUpdatedAt(fallback.updatedAt);
        setStatus("stale");
        return { data: fallback.data, status: "stale" };
      }

      setStatus("error");
      return { data: null, status: "error" };
    },
    [isDegraded, maxAttempts, snapshotKey]
  );

  return { run, status, updatedAt, error };
}
