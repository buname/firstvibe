export type RiskType = "conflict" | "tension" | "sanction" | "hub";

export interface RiskPoint {
  lat: string;
  lon: string;
  type: RiskType;
  label: string;
  body: string;
  severity?: number;
  region?: string;
  sourceName?: string;
  sourceUrl?: string;
  publishedAt?: string;
}

export interface HoveredRisk {
  point: RiskPoint;
  x: number;
  y: number;
}

export interface GlobalRisk {
  score: number;
  label: "STABLE" | "WATCH" | "ELEVATED";
}

export interface GlobePalette {
  background: string;
  star: string;
  shellLight: string;
  shellMid: string;
  shellDark: string;
  landFill: string;
  landStroke: string;
  gridStroke: string;
  point: string;
}
