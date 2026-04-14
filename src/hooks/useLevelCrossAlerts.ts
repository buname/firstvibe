"use client";

import { useEffect, useRef } from "react";
import type { KeyLevels } from "@/lib/gex-engine";
import { readAlertPrefs } from "@/lib/bex-alert-settings";
import { toast } from "sonner";

const COOLDOWN_MS = 60_000;

function crossed(prev: number, cur: number, level: number): boolean {
  if (!Number.isFinite(level) || level <= 0) return false;
  return (prev < level && cur >= level) || (prev > level && cur <= level);
}

function maybeNotify(
  title: string,
  body: string,
  lastFired: Record<string, number>,
  key: string,
  withSound: boolean
) {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (lastFired[key] && now - lastFired[key] < COOLDOWN_MS) return;
  lastFired[key] = now;
  toast.info(title, {
    description: body,
    duration: 6000,
  });
  if (withSound) {
    try {
      const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 940;
        gain.gain.value = 0.02;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      }
    } catch {
      /* ignore */
    }
  }
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, tag: key, silent: false });
  } catch {
    /* ignore */
  }
}

/**
 * Fires native browser notifications when spot crosses configured key levels.
 * Uses chain math spot (`spotPrice`), not index display quote.
 */
export function useLevelCrossAlerts(opts: {
  symbol: string;
  spotPrice: number;
  keyLevels: KeyLevels | null;
  /** Bumps when live data refreshes so prefs re-read from localStorage */
  refreshToken: string | number | null;
}) {
  const prevSpot = useRef<number | null>(null);
  const lastFired = useRef<Record<string, number>>({});

  useEffect(() => {
    const spot = opts.spotPrice;
    const levels = opts.keyLevels;
    const prefs = readAlertPrefs();

    if (!prefs.master || spot <= 0 || !levels) {
      prevSpot.current = spot;
      return;
    }

    const prev = prevSpot.current;
    prevSpot.current = spot;

    if (prev === null || prev <= 0) {
      return;
    }

    const sym = opts.symbol;
    const lf = lastFired.current;

    if (prefs.gammaFlip && crossed(prev, spot, levels.gammaFlip)) {
      maybeNotify(
        `${sym} · Gamma flip`,
        `Spot crossed γ-flip ${levels.gammaFlip.toFixed(2)}`,
        lf,
        "gamma-flip",
        prefs.sound
      );
    }
    if (prefs.callWall && crossed(prev, spot, levels.callWall)) {
      maybeNotify(
        `${sym} · Call wall`,
        `Spot crossed call wall ${levels.callWall.toFixed(2)}`,
        lf,
        "call-wall",
        prefs.sound
      );
    }
    if (prefs.putWall && crossed(prev, spot, levels.putWall)) {
      maybeNotify(
        `${sym} · Put wall`,
        `Spot crossed put wall ${levels.putWall.toFixed(2)}`,
        lf,
        "put-wall",
        prefs.sound
      );
    }
    for (const lvl of prefs.pinnedLevels) {
      if (crossed(prev, spot, lvl)) {
        maybeNotify(
          `${sym} · Pinned level`,
          `Spot crossed pinned level ${lvl.toFixed(2)}`,
          lf,
          `pinned-${lvl.toFixed(2)}`,
          prefs.sound
        );
      }
    }
  }, [opts.symbol, opts.spotPrice, opts.keyLevels, opts.refreshToken]);
}
