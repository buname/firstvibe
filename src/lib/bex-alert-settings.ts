/** localStorage keys for browser level-cross alerts (Settings + dashboard hook). */
export const BEX_ALERT_LS = {
  master: "bex-level-alert-master",
  gammaFlip: "bex-level-alert-gamma-flip",
  callWall: "bex-level-alert-call-wall",
  putWall: "bex-level-alert-put-wall",
  sound: "bex-level-alert-sound",
  pinned: "bex-level-alert-pinned-levels",
} as const;

export const BEX_UI_LS = {
  heatmapStyle: "bex-heatmap-style",
} as const;

export type AlertPrefs = {
  master: boolean;
  gammaFlip: boolean;
  callWall: boolean;
  putWall: boolean;
  sound: boolean;
  pinnedLevels: number[];
};

export type HeatmapStyle = "detailed" | "simple";

export function readHeatmapStyle(): HeatmapStyle {
  if (typeof window === "undefined") return "detailed";
  const v = localStorage.getItem(BEX_UI_LS.heatmapStyle);
  return v === "simple" ? "simple" : "detailed";
}

function parsePinnedLevels(raw: string | null): number[] {
  if (!raw) return [];
  const vals = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return [...new Set(vals)].sort((a, b) => a - b).slice(0, 12);
}

export function readAlertPrefs(): AlertPrefs {
  if (typeof window === "undefined") {
    return {
      master: false,
      gammaFlip: true,
      callWall: true,
      putWall: true,
      sound: false,
      pinnedLevels: [],
    };
  }
  const get = (key: string, defaultOn: boolean) => {
    const v = localStorage.getItem(key);
    if (v === null) return defaultOn;
    return v === "1";
  };
  return {
    master: localStorage.getItem(BEX_ALERT_LS.master) === "1",
    gammaFlip: get(BEX_ALERT_LS.gammaFlip, true),
    callWall: get(BEX_ALERT_LS.callWall, true),
    putWall: get(BEX_ALERT_LS.putWall, true),
    sound: get(BEX_ALERT_LS.sound, false),
    pinnedLevels: parsePinnedLevels(localStorage.getItem(BEX_ALERT_LS.pinned)),
  };
}
