import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Timeframe, ChartType } from "@/lib/chart-data";
import { resolveChartTicker } from "@/registry/tickers";

export interface LevelVisibility {
  gammaFlip: boolean;
  volTrigger: boolean;
  spot: boolean;
  maxPain: boolean;
  callWall: boolean;
  putWall: boolean;
}

interface ChartStudioState {
  selectedTicker: string;
  /** Backward-compatible alias. */
  activeTicker: string;
  timeframe: Timeframe;
  chartType: ChartType;
  showVolume: boolean;
  volumePanelHeight: "compact" | "normal" | "tall";
  levelVisibility: LevelVisibility;
  setSelectedTicker: (ticker: string) => void;
  /** Backward-compatible alias. */
  setActiveTicker: (ticker: string) => void;
  setTimeframe: (tf: Timeframe) => void;
  setChartType: (ct: ChartType) => void;
  toggleVolume: () => void;
  cycleVolumePanelHeight: () => void;
  toggleLevel: (key: keyof LevelVisibility) => void;
  setAllLevelsVisible: (visible: boolean) => void;
}

export const useChartStudioStore = create<ChartStudioState>()(
  persist(
    (set) => ({
      selectedTicker: "SPX",
      activeTicker: "SPX",
      timeframe: "3M",
      chartType: "candlestick",
      showVolume: true,
      volumePanelHeight: "normal",
      levelVisibility: {
        gammaFlip: true,
        volTrigger: true,
        spot: true,
        maxPain: true,
        callWall: true,
        putWall: true,
      },
      setSelectedTicker: (ticker) =>
        set((state) => {
          const resolved = resolveChartTicker(ticker);
          if (
            state.selectedTicker === resolved.symbol &&
            state.activeTicker === resolved.symbol &&
            state.timeframe === resolved.defaultTimeframe
          ) {
            return state;
          }
          return {
            selectedTicker: resolved.symbol,
            activeTicker: resolved.symbol,
            timeframe: resolved.defaultTimeframe,
          };
        }),
      setActiveTicker: (ticker) =>
        set((state) => {
          const resolved = resolveChartTicker(ticker);
          if (
            state.selectedTicker === resolved.symbol &&
            state.activeTicker === resolved.symbol &&
            state.timeframe === resolved.defaultTimeframe
          ) {
            return state;
          }
          return {
            selectedTicker: resolved.symbol,
            activeTicker: resolved.symbol,
            timeframe: resolved.defaultTimeframe,
          };
        }),
      setTimeframe: (tf) => set({ timeframe: tf }),
      setChartType: (ct) => set({ chartType: ct }),
      toggleVolume: () => set((s) => ({ showVolume: !s.showVolume })),
      cycleVolumePanelHeight: () =>
        set((s) => ({
          volumePanelHeight:
            s.volumePanelHeight === "compact"
              ? "normal"
              : s.volumePanelHeight === "normal"
                ? "tall"
                : "compact",
        })),
      toggleLevel: (key) =>
        set((s) => ({
          levelVisibility: {
            ...s.levelVisibility,
            [key]: !s.levelVisibility[key],
          },
        })),
      setAllLevelsVisible: (visible) =>
        set({
          levelVisibility: {
            gammaFlip: visible,
            volTrigger: visible,
            spot: visible,
            maxPain: visible,
            callWall: visible,
            putWall: visible,
          },
        }),
    }),
    {
      name: "bex-chart-studio",
      version: 2,
      migrate: (persisted) => {
        const state = (persisted ?? {}) as Partial<ChartStudioState> & {
          activeTicker?: string;
        };
        const rawTicker = state.selectedTicker ?? state.activeTicker ?? "SPX";
        const resolved = resolveChartTicker(rawTicker);
        return {
          ...state,
          selectedTicker: resolved.symbol,
          activeTicker: resolved.symbol,
        } as ChartStudioState;
      },
    }
  )
);
