import type { RiskPoint } from "@/components/maps/types";
import { RISK_MARKERS } from "@/data/geopoliticalRisk";
import { readLegacyRiskPoints } from "@/lib/riskIntegration";

export const mockRiskPoints: RiskPoint[] = [
  {
    lat: "32.4",
    lon: "53.7",
    type: "conflict",
    label: "US-Iran Escalation Risk",
    body: "Direct confrontation risk remains elevated with regional spillover concerns.",
  },
  {
    lat: "14.0",
    lon: "42.5",
    type: "conflict",
    label: "Red Sea Shipping Corridor",
    body: "Shipping disruptions increase pressure on freight routes and insurance pricing.",
  },
  {
    lat: "48.5",
    lon: "31.2",
    type: "conflict",
    label: "Ukraine Frontline Activity",
    body: "Persistent military operations continue to affect energy and food supply chains.",
  },
  {
    lat: "23.7",
    lon: "120.9",
    type: "tension",
    label: "Taiwan Strait Tensions",
    body: "Cross-strait activity keeps semiconductor and shipping markets sensitive.",
  },
  {
    lat: "-0.2",
    lon: "103.8",
    type: "tension",
    label: "South China Sea Maritime Dispute",
    body: "Ongoing maritime friction around a core global trade corridor.",
  },
  {
    lat: "29.0",
    lon: "77.0",
    type: "tension",
    label: "India-Pakistan Border Heat",
    body: "Periodic cross-border incidents keep regional risk premium elevated.",
  },
  {
    lat: "35.6",
    lon: "103.8",
    type: "sanction",
    label: "US-China Export Controls",
    body: "Technology and dual-use restrictions continue to pressure global supply chains.",
  },
  {
    lat: "55.8",
    lon: "37.6",
    type: "sanction",
    label: "Russia Financial Restrictions",
    body: "Extended sanctions continue to distort commodity and payment networks.",
  },
  {
    lat: "40.7",
    lon: "-74.0",
    type: "hub",
    label: "New York Financial Hub",
    body: "Major liquidity hub with high global transmission impact.",
  },
  {
    lat: "1.3",
    lon: "103.8",
    type: "hub",
    label: "Singapore Maritime Hub",
    body: "Key transshipment and shipping finance node for Asia-Pacific flows.",
  },
];

function mapMarkerType(type: string): RiskPoint["type"] {
  if (type === "conflict") return "conflict";
  if (type === "tension") return "tension";
  if (type === "sanctions") return "sanction";
  return "hub";
}

const markerRiskPoints: RiskPoint[] = RISK_MARKERS.map((marker) => ({
  lat: marker.lat.toString(),
  lon: marker.lng.toString(),
  type: mapMarkerType(marker.type),
  label: `${marker.name}${marker.country ? `, ${marker.country}` : ""}`,
  body: marker.description,
  severity: marker.severity,
  region: marker.country,
}));

const fallbackRiskPoints = markerRiskPoints.length > 0 ? markerRiskPoints : mockRiskPoints;

export async function fetchRiskData(): Promise<RiskPoint[]> {
  return new Promise((resolve) => {
    window.setTimeout(() => {
      const legacy = readLegacyRiskPoints();
      resolve(legacy.length > 0 ? legacy : fallbackRiskPoints);
    }, 500);
  });
}
