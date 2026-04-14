"use client";

import {
  BarChart3,
  Grid3X3,
  Table,
  Box,
  Play,
  Calendar,
  BookOpen,
  Terminal,
  Settings,
  Radar,
  Package,
  Menu,
  Gauge,
  CalendarRange,
  Network,
  SplitSquareVertical,
} from "lucide-react";
import { DASHBOARD_TABS, type TabId } from "@/lib/constants";

const ICON_MAP: Record<
  string,
  React.ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  BarChart3,
  Grid3X3,
  Table,
  Box,
  Play,
  Calendar,
  BookOpen,
  Terminal,
  Settings,
  Radar,
  Package,
  Menu,
  Gauge,
  CalendarRange,
  Network,
  SplitSquareVertical,
};

/** Opacity-style groups; BEX-only tabs last. */
const SIDEBAR_GROUPS: TabId[][] = [
  ["terminal", "exposures", "bias"],
  ["heatmap", "levels", "strikes"],
  ["flow", "calendar"],
  ["compare", "replay"],
  ["journal", "settings"],
  ["gexscan", "surface", "legacy"],
];

const TAB_BY_ID = Object.fromEntries(
  DASHBOARD_TABS.map((t) => [t.id, t])
) as Record<TabId, (typeof DASHBOARD_TABS)[number]>;

const NAV_FADE_STEPS = Math.max(1, SIDEBAR_GROUPS.flat().length - 1);

interface Props {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  collapsed: boolean;
  onToggleSidebar: () => void;
}

export default function Sidebar({
  activeTab,
  onTabChange,
  collapsed,
  onToggleSidebar,
}: Props) {
  return (
    <aside
      className={`h-full bg-[#060607] border-r border-white/[0.04] flex flex-col transition-all duration-200 panel-sheen ${
        collapsed ? "w-12" : "w-[200px]"
      }`}
    >
      <div className="shrink-0 flex items-center px-1.5 pt-2 pb-1">
        <button
          type="button"
          onClick={onToggleSidebar}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-white/[0.05] hover:text-neutral-300"
        >
          <Menu className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>

      <nav className="relative flex-1 min-h-0 overflow-y-auto px-1.5 pb-2">
        {SIDEBAR_GROUPS.map((group, groupIndex) => {
          const indexOffset = SIDEBAR_GROUPS
            .slice(0, groupIndex)
            .reduce((s, g) => s + g.length, 0);
          return (
            <div key={groupIndex}>
              {groupIndex > 0 && (
                <div
                  className={`mx-1.5 h-px bg-white/[0.05] ${collapsed ? "my-1.5" : "my-2"}`}
                  aria-hidden
                />
              )}
              <div className="space-y-0.5">
                {group.map((id, idxInGroup) => {
                  const tab = TAB_BY_ID[id];
                  if (!tab) return null;
                  const Icon = ICON_MAP[tab.icon];
                  const active = activeTab === tab.id;
                  const globalIndex = indexOffset + idxInGroup;
                  const fade =
                    active || collapsed
                      ? 1
                      : Math.max(
                          0.78,
                          1 - (globalIndex / NAV_FADE_STEPS) * 0.18
                        );

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => onTabChange(tab.id)}
                      title={tab.label}
                      style={{ opacity: fade }}
                      className={`flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-xs transition-colors ${
                        active
                          ? "bg-gradient-to-r from-[#1a1a1d] to-[#151518] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] font-medium text-[#e4e4e7]"
                          : "font-normal text-neutral-600 hover:bg-white/[0.04] hover:text-neutral-400"
                      } ${collapsed ? "justify-center px-0" : ""}`}
                    >
                      {Icon && (
                        <Icon
                          className={`h-3.5 w-3.5 shrink-0 ${active ? "text-[#e4e4e7]" : "text-neutral-600"}`}
                          strokeWidth={active ? 2 : 1.75}
                        />
                      )}
                      {!collapsed && (
                        <span className="truncate tracking-tight">{tab.label}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {/* Opacity-style vignette at bottom of nav (scroll still works) */}
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-black via-black/40 to-transparent"
          aria-hidden
        />
      </nav>

      <div className="shrink-0 border-t border-white/[0.06] p-2">
        <div className="flex items-center gap-1.5 px-0.5">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500/90" />
          {!collapsed && (
            <span className="text-[10px] font-medium tracking-wide text-neutral-600">
              ONLINE
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}
