export function formatCompactNumber(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${abs.toFixed(abs >= 100 ? 0 : 1)}`;
}

export function formatCompactSigned(value: number): string {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatCompactNumber(value)}`;
}
