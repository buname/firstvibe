"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface NewsItem {
  id: string;
  title: string;
  source: string;
  time: string;
  sentiment: "bullish" | "bearish" | "neutral";
}

interface Props {
  news: NewsItem[];
}

export default function NewsTab({ news }: Props) {
  return (
    <div className="h-full flex flex-col p-3">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-mono font-bold tracking-wider text-[#f0f0f0]">
          MARKET NEWS
        </h2>
        <span className="text-[10px] text-[#666] font-mono">
          {news.length} headlines
        </span>
      </div>

      <div className="flex-1 overflow-auto space-y-1.5 min-h-0">
        {news.map((item) => (
          <div
            key={item.id}
            className="p-3 rounded bg-[#111] border border-[#222] hover:border-[#333] transition-colors"
          >
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5">
                {item.sentiment === "bullish" ? (
                  <TrendingUp className="w-3.5 h-3.5 text-[#00ff88]" />
                ) : item.sentiment === "bearish" ? (
                  <TrendingDown className="w-3.5 h-3.5 text-[#ff4444]" />
                ) : (
                  <Minus className="w-3.5 h-3.5 text-[#666]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#f0f0f0] leading-snug">
                  {item.title}
                </p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-[10px] text-[#666]">{item.source}</span>
                  <span className="text-[10px] text-[#666] font-mono">
                    {item.time}
                  </span>
                  <span
                    className={`text-[8px] px-1 py-0.5 rounded font-mono font-bold ${
                      item.sentiment === "bullish"
                        ? "bg-[#00ff8815] text-[#00ff88]"
                        : item.sentiment === "bearish"
                        ? "bg-[#ff444415] text-[#ff4444]"
                        : "bg-[#161616] text-[#666]"
                    }`}
                  >
                    {item.sentiment.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
