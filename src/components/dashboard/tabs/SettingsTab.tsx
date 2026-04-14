"use client";

import { useState } from "react";
import { Bell, LogOut, Trash2 } from "lucide-react";
import {
  BEX_ALERT_LS,
  BEX_UI_LS,
  readAlertPrefs,
  readHeatmapStyle,
  type HeatmapStyle,
} from "@/lib/bex-alert-settings";
import { toast } from "sonner";

interface Props {
  refreshMs: number;
  onRefreshMsChange: (ms: number) => void;
}

export default function SettingsTab({ refreshMs, onRefreshMsChange }: Props) {
  const [strikeSpacing, setStrikeSpacing] = useState(1);
  const [notifPerm, setNotifPerm] = useState<
    NotificationPermission | "unsupported"
  >(() => {
    if (typeof window === "undefined") return "default";
    if (!("Notification" in window)) return "unsupported";
    return Notification.permission;
  });
  const [alertMaster, setAlertMaster] = useState(
    () => typeof window !== "undefined" && readAlertPrefs().master
  );
  const [alertFlip, setAlertFlip] = useState(
    () => typeof window === "undefined" || readAlertPrefs().gammaFlip
  );
  const [alertCallWall, setAlertCallWall] = useState(
    () => typeof window === "undefined" || readAlertPrefs().callWall
  );
  const [alertPutWall, setAlertPutWall] = useState(
    () => typeof window === "undefined" || readAlertPrefs().putWall
  );
  const [alertSound, setAlertSound] = useState(
    () => typeof window !== "undefined" && readAlertPrefs().sound
  );
  const [pinnedLevelsText, setPinnedLevelsText] = useState(
    () =>
      typeof window !== "undefined"
        ? localStorage.getItem(BEX_ALERT_LS.pinned) ?? ""
        : ""
  );
  const [heatmapStyle, setHeatmapStyle] = useState<HeatmapStyle>(() =>
    typeof window === "undefined" ? "detailed" : readHeatmapStyle()
  );

  const persistAlert = (key: string, val: boolean) => {
    localStorage.setItem(key, val ? "1" : "0");
  };

  const handleLogout = () => {
    localStorage.removeItem("bex-access-key");
    window.location.href = "/";
  };

  const handleClearData = () => {
    localStorage.removeItem("bex-journal");
    localStorage.removeItem(BEX_UI_LS.heatmapStyle);
    Object.values(BEX_ALERT_LS).forEach((k) => localStorage.removeItem(k));
    window.location.reload();
  };

  const exportSettings = () => {
    const payload = {
      refreshMs,
      strikeSpacing,
      heatmapStyle,
      alerts: {
        master: alertMaster,
        gammaFlip: alertFlip,
        callWall: alertCallWall,
        putWall: alertPutWall,
        sound: alertSound,
        pinned: pinnedLevelsText,
      },
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bex-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="h-full p-4">
      <h2 className="text-sm font-mono font-bold tracking-wider text-[#f0f0f0] mb-5">
        SETTINGS
      </h2>

      <div className="max-w-xl space-y-4">
        <div className="p-3 rounded bg-[#111] border border-[#222]">
          <div className="text-[10px] font-mono font-bold text-[#f0f0f0] tracking-wider mb-1">
            REFRESH INTERVAL
          </div>
          <div className="text-[10px] text-[#666] font-mono mb-2">
            How often to fetch new options data
          </div>
          <div className="flex items-center gap-2">
            {[
              { ms: 30_000, label: "30s" },
              { ms: 60_000, label: "60s" },
              { ms: 120_000, label: "120s" },
            ].map((opt) => (
              <button
                key={opt.ms}
                onClick={() => onRefreshMsChange(opt.ms)}
                className={`px-3 py-1 rounded text-[10px] font-mono transition-colors ${
                  refreshMs === opt.ms
                    ? "bg-[#222] text-[#00ff88] border border-[#333]"
                    : "bg-[#0a0a0a] border border-[#222] text-[#666] hover:text-[#999]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 rounded bg-[#111] border border-[#222]">
          <div className="text-[10px] font-mono font-bold text-[#f0f0f0] tracking-wider mb-1">
            STRIKE SPACING
          </div>
          <div className="text-[10px] text-[#666] font-mono mb-2">
            Show every Nth strike centered on ATM
          </div>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 5].map((n) => (
              <button
                key={n}
                onClick={() => setStrikeSpacing(n)}
                className={`px-3 py-1 rounded text-[10px] font-mono transition-colors ${
                  strikeSpacing === n
                    ? "bg-[#222] text-[#00ff88] border border-[#333]"
                    : "bg-[#0a0a0a] border border-[#222] text-[#666] hover:text-[#999]"
                }`}
              >
                {n === 1 ? "All" : `Every ${n}`}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 rounded bg-[#111] border border-[#222]">
          <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-[#f0f0f0] tracking-wider mb-1">
            <Bell className="w-3 h-3 text-[#f5a623]" />
            LEVEL ALERTS
          </div>
          <div className="text-[10px] text-[#666] font-mono mb-3 leading-relaxed">
            Browser notifications when spot (chain math) crosses γ-flip, call
            wall, or put wall. 60s cooldown per alert type. Applies on the next
            data refresh after you change toggles.
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              type="button"
              disabled={notifPerm === "unsupported"}
              onClick={async () => {
                if (!("Notification" in window)) return;
                const r = await Notification.requestPermission();
                setNotifPerm(r);
              }}
              className="rounded border border-[#333] px-2 py-1 text-[10px] font-mono text-[#a3a3a3] hover:bg-[#161616] hover:text-white disabled:opacity-40"
            >
              {notifPerm === "granted"
                ? "Notifications: granted"
                : notifPerm === "denied"
                  ? "Notifications: blocked"
                  : notifPerm === "unsupported"
                    ? "Notifications: unavailable"
                    : "Enable browser notifications"}
            </button>
          </div>
          <label className="flex items-center gap-2 mb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={alertMaster}
              onChange={(e) => {
                const v = e.target.checked;
                setAlertMaster(v);
                persistAlert(BEX_ALERT_LS.master, v);
              }}
              className="accent-[#f5a623]"
            />
            <span className="text-[10px] font-mono text-[#ccc]">
              Master: level cross alerts
            </span>
          </label>
          <div className="ml-5 space-y-1.5 border-l border-[#222] pl-3">
            {[
              {
                label: "Gamma flip",
                checked: alertFlip,
                set: setAlertFlip,
                key: BEX_ALERT_LS.gammaFlip,
              },
              {
                label: "Call wall",
                checked: alertCallWall,
                set: setAlertCallWall,
                key: BEX_ALERT_LS.callWall,
              },
              {
                label: "Put wall",
                checked: alertPutWall,
                set: setAlertPutWall,
                key: BEX_ALERT_LS.putWall,
              },
            ].map((row) => (
              <label
                key={row.key}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={row.checked}
                  disabled={!alertMaster}
                  onChange={(e) => {
                    const v = e.target.checked;
                    row.set(v);
                    persistAlert(row.key, v);
                  }}
                  className="accent-[#00ff88]"
                />
                <span className="text-[10px] font-mono text-[#888]">
                  {row.label}
                </span>
              </label>
            ))}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={alertSound}
                disabled={!alertMaster}
                onChange={(e) => {
                  const v = e.target.checked;
                  setAlertSound(v);
                  persistAlert(BEX_ALERT_LS.sound, v);
                }}
                className="accent-[#06b6d4]"
              />
              <span className="text-[10px] font-mono text-[#888]">
                Alert sound
              </span>
            </label>
          </div>
          <div className="mt-3">
            <div className="text-[10px] text-[#666] font-mono mb-1">
              Pinned levels (comma-separated, ex: 512.5, 520, 527.25)
            </div>
            <div className="flex items-center gap-2">
              <input
                value={pinnedLevelsText}
                onChange={(e) => setPinnedLevelsText(e.target.value)}
                disabled={!alertMaster}
                className="flex-1 rounded border border-[#222] bg-[#0a0a0a] px-2 py-1 text-[10px] font-mono text-[#cfcfcf] disabled:opacity-50"
              />
              <button
                type="button"
                disabled={!alertMaster}
                onClick={() => {
                  const vals = pinnedLevelsText
                    .split(",")
                    .map((s) => Number(s.trim()))
                    .filter((n) => Number.isFinite(n) && n > 0)
                    .slice(0, 12);
                  const csv = vals.join(", ");
                  setPinnedLevelsText(csv);
                  localStorage.setItem(BEX_ALERT_LS.pinned, csv);
                  toast.success(
                    vals.length > 0
                      ? `Saved ${vals.length} pinned levels`
                      : "Pinned levels cleared"
                  );
                }}
                className="rounded border border-[#333] px-2 py-1 text-[10px] font-mono text-[#a3a3a3] hover:bg-[#161616] hover:text-white disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        </div>

        <div className="p-3 rounded bg-[#111] border border-[#222]">
          <div className="text-[10px] font-mono font-bold text-[#f0f0f0] tracking-wider mb-1">
            HEATMAP STYLE
          </div>
          <div className="text-[10px] text-[#666] font-mono mb-2">
            Choose preferred heatmap rendering mode.
          </div>
          <div className="flex items-center gap-2">
            {[
              { id: "detailed", label: "Detailed" },
              { id: "simple", label: "Simple" },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  const next = m.id as HeatmapStyle;
                  setHeatmapStyle(next);
                  localStorage.setItem(BEX_UI_LS.heatmapStyle, next);
                }}
                className={`px-3 py-1 rounded text-[10px] font-mono transition-colors ${
                  heatmapStyle === m.id
                    ? "bg-[#222] text-[#00ff88] border border-[#333]"
                    : "bg-[#0a0a0a] border border-[#222] text-[#666] hover:text-[#999]"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 rounded bg-[#111] border border-[#222]">
          <div className="text-[10px] font-mono font-bold text-[#f0f0f0] tracking-wider mb-1">
            ACCESS KEY
          </div>
          <div className="text-[10px] text-[#666] font-mono mb-2">
            Currently authenticated
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-[#00ff88] bg-[#00ff8815] px-2 py-0.5 rounded">
              ACTIVE
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#ff444415] text-[#ff4444] text-[10px] font-mono hover:bg-[#ff444425] transition-colors"
            >
              <LogOut className="w-3 h-3" /> LOGOUT
            </button>
          </div>
        </div>

        <div className="p-3 rounded bg-[#111] border border-[#222]">
          <div className="text-[10px] font-mono font-bold text-[#f0f0f0] tracking-wider mb-1">
            DATA
          </div>
          <div className="text-[10px] text-[#666] font-mono mb-2">
            Clear local storage (journal, level-alert toggles)
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={exportSettings}
              className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#161616] border border-[#333] text-[#a3a3a3] text-[10px] font-mono hover:text-white transition-colors"
            >
              Export settings
            </button>
            <button
              onClick={handleClearData}
              className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#ff444415] text-[#ff4444] text-[10px] font-mono hover:bg-[#ff444425] transition-colors"
            >
              <Trash2 className="w-3 h-3" /> CLEAR ALL DATA
            </button>
          </div>
        </div>

        <div className="p-3 rounded bg-[#111] border border-[#222]">
          <div className="text-[10px] font-mono font-bold text-[#f0f0f0] tracking-wider mb-1">
            ABOUT
          </div>
          <div className="text-[10px] text-[#666] font-mono space-y-0.5">
            <p>BEX Options Analytics Dashboard v1.0</p>
            <p>GEX = Gamma x OI x 100 x Spot^2 x 0.01</p>
            <p>Dealer gamma model (SpotGamma / Perfiliev)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
