"use client";

import type { KeyLevels } from "@/lib/gex-engine";

interface Props {
  keyLevels: KeyLevels;
  atmIvPct: number;
}

// Expected move using 1-week (5 trading days) window
function expectedMove(spot: number, atmIvPct: number) {
  const move = (atmIvPct / 100) * Math.sqrt(5 / 252) * spot;
  return { high: spot + move, low: spot - move };
}

function pctDiff(val: number, spot: number) {
  const d = ((val - spot) / spot) * 100;
  return `${d >= 0 ? "+" : ""}${d.toFixed(1)}%`;
}

export default function LevelsTab({ keyLevels, atmIvPct }: Props) {
  const spot = keyLevels.spotPrice;
  const { high: expHigh, low: expLow } = expectedMove(spot, atmIvPct);

  const cards = [
    {
      label: "CALL WALL",
      value: keyLevels.callWall,
      color: "#00e87a",
      sub: "Resistance",
      dist: pctDiff(keyLevels.callWall, spot),
    },
    {
      label: "PUT WALL",
      value: keyLevels.putWall,
      color: "#ff4455",
      sub: "Support",
      dist: pctDiff(keyLevels.putWall, spot),
    },
    {
      label: "ZERO GAMMA",
      value: keyLevels.gammaFlip,
      color: "#f5a623",
      sub: "Dealer Flip",
      dist: pctDiff(keyLevels.gammaFlip, spot),
    },
    {
      label: "MAX PAIN",
      value: keyLevels.maxPain,
      color: "#4a9fff",
      sub: "Option pain",
      dist: pctDiff(keyLevels.maxPain, spot),
    },
    {
      label: "VOL TRIGGER",
      value: keyLevels.volTrigger,
      color: "#06b6d4",
      sub: "Vol trigger",
      dist: pctDiff(keyLevels.volTrigger, spot),
    },
    {
      label: "EXPECTED HIGH",
      value: expHigh,
      color: "#00e87a",
      sub: "Spot + 1-wk σ",
      dist: pctDiff(expHigh, spot),
    },
    {
      label: "EXPECTED LOW",
      value: expLow,
      color: "#ff4455",
      sub: "Spot − 1-wk σ",
      dist: pctDiff(expLow, spot),
    },
    {
      label: "ATM IV",
      value: null as number | null,
      ivPct: atmIvPct,
      color: "#8b5cf6",
      sub: "Implied vol",
      dist: "",
    },
  ];

  // ── Price ruler ────────────────────────────────────────────────────────────
  const rulerLevels = [
    { key: "G.FLIP",    val: keyLevels.gammaFlip,  color: "#f5a623" },
    { key: "PUT WALL",  val: keyLevels.putWall,    color: "#ff4455" },
    { key: "MAX PAIN",  val: keyLevels.maxPain,    color: "#4a9fff" },
    { key: "CALL WALL", val: keyLevels.callWall,   color: "#00e87a" },
    { key: "VOL TRIG",  val: keyLevels.volTrigger, color: "#06b6d4" },
    { key: "SPOT",      val: spot,                 color: "#ffffff" },
  ];

  const allVals = rulerLevels.map((r) => r.val);
  const rulerMin = Math.min(...allVals) * 0.999;
  const rulerMax = Math.max(...allVals) * 1.001;
  const rulerRange = rulerMax - rulerMin;

  function pct(v: number) {
    return ((v - rulerMin) / rulerRange) * 100;
  }

  return (
    <div className="h-full flex flex-col p-3 gap-3 overflow-auto">
      {/* Header */}
      <div className="shrink-0">
        <h2 className="text-sm font-mono font-bold tracking-wider text-[#e8e8e8]">
          Daily Levels
        </h2>
        <p className="text-[10px] font-mono text-[#444] mt-0.5 tracking-wider">
          SPY · key gamma levels &amp; expected move
        </p>
      </div>

      {/* 4×2 card grid */}
      <div className="grid grid-cols-4 gap-2 shrink-0">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded border border-[#1c1c1c] p-3 flex flex-col gap-1"
            style={{ background: "linear-gradient(135deg,#131313,#0d0d0d)" }}
          >
            <div className="text-[8px] font-mono tracking-[0.15em] text-[#555] uppercase">
              {c.label}
            </div>
            <div
              className="text-xl font-mono font-bold leading-none"
              style={{ color: c.color }}
            >
              {c.value !== null
                ? `$${c.value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
                : `${c.ivPct!.toFixed(1)}%`}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[9px] font-mono text-[#4a4a4a]">
                {c.sub}
              </span>
              {c.dist && (
                <span
                  className="text-[9px] font-mono font-semibold"
                  style={{
                    color: c.dist.startsWith("+")
                      ? "#00e87a"
                      : c.dist.startsWith("-")
                      ? "#ff4455"
                      : "#888",
                  }}
                >
                  · {c.dist}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Price Ruler */}
      <div
        className="shrink-0 rounded border border-[#1c1c1c] p-3"
        style={{ background: "linear-gradient(135deg,#0f0f0f,#0b0b0b)" }}
      >
        <div className="text-[8px] font-mono tracking-[0.18em] text-[#444] uppercase mb-4">
          Price Ruler — Key Levels vs Spot
        </div>

        <div className="relative h-16 mx-4">
          {/* Baseline */}
          <div
            className="absolute top-1/2 left-0 right-0 h-px bg-[#222]"
            style={{ transform: "translateY(-50%)" }}
          />

          {/* Level markers */}
          {rulerLevels.map((r) => {
            const left = pct(r.val);
            const isSpot = r.key === "SPOT";
            return (
              <div
                key={r.key}
                className="absolute flex flex-col items-center"
                style={{
                  left: `${left}%`,
                  top: 0,
                  bottom: 0,
                  transform: "translateX(-50%)",
                }}
              >
                {/* Label above */}
                <div
                  className="text-[7px] font-mono font-bold text-center whitespace-nowrap mb-1"
                  style={{ color: r.color }}
                >
                  {r.key}
                </div>
                {/* Tick on the line */}
                <div
                  className="absolute"
                  style={{ top: "50%", transform: "translateY(-50%)" }}
                >
                  <div
                    className={`${isSpot ? "w-2.5 h-2.5 rounded-full" : "w-1.5 h-1.5 rounded-full"}`}
                    style={{
                      background: r.color,
                      boxShadow: isSpot
                        ? `0 0 6px ${r.color}`
                        : `0 0 3px ${r.color}60`,
                    }}
                  />
                </div>
                {/* Value below */}
                <div className="mt-auto">
                  <div
                    className="text-[7px] font-mono font-bold whitespace-nowrap"
                    style={{ color: r.color }}
                  >
                    ${r.val.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </div>
                  <div
                    className="text-[6px] font-mono text-center"
                    style={{
                      color:
                        r.val > spot
                          ? "#00e87a"
                          : r.val < spot
                          ? "#ff4455"
                          : "#888",
                    }}
                  >
                    {pctDiff(r.val, spot)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Note */}
      <div className="text-[9px] font-mono text-[#333] shrink-0">
        NOTE — Levels from current OI snapshot. Not real-time signals.
      </div>
    </div>
  );
}
