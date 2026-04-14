"use client";

import type { OptionContract } from "@/lib/gex-engine";
import HeatmapView from "@/components/dashboard/heatmap/HeatmapView";

interface Props {
  symbol: string;
  chain: OptionContract[];
  spotPrice: number;
  live?: boolean;
}

export default function HeatmapTab({ symbol, chain, spotPrice, live = false }: Props) {
  return (
    <HeatmapView
      primarySymbol={symbol}
      primarySpotPrice={spotPrice}
      primaryChain={chain}
      live={live}
    />
  );
}
