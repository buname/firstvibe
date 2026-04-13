"use client";

import { useState, useEffect } from "react";
import { TICKERS } from "@/lib/constants";

interface TickerPrice {
  symbol: string;
  price: number | null;
}

export default function TickerBanner() {
  const [prices, setPrices] = useState<TickerPrice[]>(
    TICKERS.map((t) => ({ symbol: t.symbol, price: null }))
  );

  useEffect(() => {
    const fetchPrices = async () => {
      const updated = await Promise.all(
        TICKERS.map(async (t) => {
          try {
            const res = await fetch(`/api/quote?symbol=${t.symbol}`);
            if (!res.ok) return { symbol: t.symbol, price: null };
            const data = await res.json();
            return {
              symbol: t.symbol,
              price: data.spotPrice || null,
            };
          } catch {
            return { symbol: t.symbol, price: null };
          }
        })
      );
      setPrices(updated);
    };

    fetchPrices();
    const id = setInterval(fetchPrices, 60_000);
    return () => clearInterval(id);
  }, []);

  const items = [...prices, ...prices];

  return (
    <div className="w-full overflow-hidden border-y border-[#222] bg-[#0a0a0a] py-2.5">
      <div className="animate-ticker flex whitespace-nowrap gap-8">
        {items.map((t, i) => (
          <span
            key={`${t.symbol}-${i}`}
            className="text-xs font-mono text-[#666] hover:text-[#f0f0f0] transition-colors cursor-default flex items-center gap-1.5"
          >
            <span className="font-bold text-[#999]">{t.symbol}</span>
            {t.price && (
              <span className="text-[#666]">
                ${t.price.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
