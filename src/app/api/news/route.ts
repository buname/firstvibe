import { NextResponse } from "next/server";
import { guessSentiment, parseRssItems } from "@/lib/rss-headlines";

export const dynamic = "force-dynamic";

const RSS_URLS = [
  "https://feeds.finance.yahoo.com/rss/2.0/headline?s=SPY&region=US&lang=en-US",
  "https://feeds.finance.yahoo.com/rss/2.0/headline?s=QQQ&region=US&lang=en-US",
];

export type Headline = {
  id: string;
  title: string;
  source: string;
  time: string;
  sentiment: "bullish" | "bearish" | "neutral";
  /** Article URL when RSS provides &lt;link&gt; / https guid */
  url?: string;
};

export async function GET() {
  const merged: Headline[] = [];
  const seen = new Set<string>();

  const pushUnique = (h: Headline) => {
    const k = h.title.toLowerCase().slice(0, 120);
    if (seen.has(k)) return;
    seen.add(k);
    merged.push(h);
  };

  try {
    const url =
      "https://query1.finance.yahoo.com/v1/finance/trending/US?count=10";
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120" },
      cache: "no-store",
    });
    if (res.ok) {
      const json = await res.json();
      const trendingQuotes: string[] =
        json.finance?.result?.[0]?.quotes?.map(
          (q: { symbol: string }) => q.symbol
        ) || [];
      if (trendingQuotes.length > 0) {
        pushUnique({
          id: "trending-board",
          title: `Trending tickers: ${trendingQuotes.slice(0, 8).join(", ")}`,
          source: "Yahoo Finance",
          time: nowTime(),
          sentiment: "neutral",
        });
      }
    }
  } catch {
    /* ignore */
  }

  for (const rssUrl of RSS_URLS) {
    try {
      const symbolTag =
        rssUrl.match(/[?&]s=([A-Z]+)/i)?.[1]?.toUpperCase() ?? "GEN";
      const r = await fetch(rssUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120" },
        cache: "no-store",
      });
      if (!r.ok) continue;
      const xml = await r.text();
      const items = parseRssItems(xml, 12);
      for (let i = 0; i < items.length; i++) {
        const { title, link } = items[i];
        pushUnique({
          id: `rss-${symbolTag}-${i}`,
          title,
          source: "Yahoo Finance RSS",
          time: nowTime(),
          sentiment: guessSentiment(title),
          ...(link ? { url: link } : {}),
        });
      }
    } catch {
      continue;
    }
  }

  const staticList = getStaticHeadlines();
  for (const h of staticList) pushUnique(h);

  return NextResponse.json({
    headlines: merged.slice(0, 24),
  });
}

function nowTime(): string {
  return new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStaticHeadlines(): Headline[] {
  const now = new Date();
  const raw: Omit<Headline, "time">[] = [
    { id: "n1", title: "Fed signals potential rate cut path in upcoming meetings", source: "Reuters", sentiment: "bullish" },
    { id: "n2", title: "NVIDIA earnings beat estimates, data center revenue surges", source: "CNBC", sentiment: "bullish" },
    { id: "n3", title: "Tech sector faces renewed regulatory scrutiny in EU", source: "Bloomberg", sentiment: "bearish" },
    { id: "n4", title: "S&P 500 options volume hits record as VIX climbs", source: "MarketWatch", sentiment: "neutral" },
    { id: "n5", title: "Apple announces major buyback program", source: "WSJ", sentiment: "bullish" },
    { id: "n6", title: "NASDAQ-100 rebalancing expected to shift billions in assets", source: "Barron's", sentiment: "neutral" },
    { id: "n7", title: "Treasury yields drop as inflation data comes in cooler", source: "Reuters", sentiment: "bullish" },
    { id: "n8", title: "AMD secures major AI chip contract with cloud provider", source: "The Verge", sentiment: "bullish" },
    { id: "n9", title: "Tesla recall affects vehicles over autopilot concerns", source: "AP News", sentiment: "bearish" },
    { id: "n10", title: "Amazon Web Services announces new AI infrastructure investment", source: "TechCrunch", sentiment: "bullish" },
    { id: "n11", title: "Market volatility expected ahead of FOMC meeting", source: "Bloomberg", sentiment: "neutral" },
    { id: "n12", title: "Meta Reality Labs posts quarterly loss amid VR investments", source: "CNBC", sentiment: "bearish" },
  ];
  return raw.map(
    (h, i) =>
      ({
        ...h,
        time: new Date(now.getTime() - i * 1800000).toLocaleTimeString(
          "en-US",
          {
            hour: "2-digit",
            minute: "2-digit",
          }
        ),
      }) satisfies Headline
  );
}
