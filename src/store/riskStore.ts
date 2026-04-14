import { create } from "zustand";
import type { RiskPoint } from "@/components/maps/types";

export type RiskFilter = "all" | "conflict" | "tension" | "sanction" | "hub";

interface RiskStoreState {
  points: RiskPoint[];
  query: string;
  filter: RiskFilter;
  loading: boolean;
  setPoints: (points: RiskPoint[]) => void;
  setQuery: (query: string) => void;
  setFilter: (filter: RiskFilter) => void;
  setLoading: (loading: boolean) => void;
}

export const useRiskStore = create<RiskStoreState>((set) => ({
  points: [],
  query: "",
  filter: "all",
  loading: true,
  setPoints: (points) => set({ points }),
  setQuery: (query) => set({ query }),
  setFilter: (filter) => set({ filter }),
  setLoading: (loading) => set({ loading }),
}));
