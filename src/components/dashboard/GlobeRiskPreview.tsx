"use client";

import dynamic from "next/dynamic";
import type { GeopoliticalRiskMapProps } from "@/components/maps/GeopoliticalRiskMap";

export type GlobeRiskPreviewProps = GeopoliticalRiskMapProps;

const GeopoliticalRiskMap = dynamic(
  () => import("@/components/maps/GeopoliticalRiskMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[500px] items-center justify-center rounded-xl border border-white/10 bg-[#0a0a0a] text-xs text-white/70">
        Loading geopolitical map...
      </div>
    ),
  }
);

/** Calendar / dashboard entry: interactive geopolitical risk map (globe + flat, themes, filters). */
export default function GlobeRiskPreview(props: GlobeRiskPreviewProps) {
  return <GeopoliticalRiskMap {...props} />;
}
