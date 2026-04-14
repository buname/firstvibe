/** Parse Yahoo Finance-style RSS for <item><title>…</title>. */

function extractTitleFromItemBlock(block: string): string | null {
  const m = block.match(
    /<title(?:\s[^>]*)?>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i
  );
  if (!m) return null;
  const t = m[1]
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();
  if (!t || t.length < 12) return null;
  if (/^yahoo finance$/i.test(t)) return null;
  return t;
}

function extractLinkFromItemBlock(block: string): string | null {
  const href = block.match(
    /<link[^>]+href=["']([^"']+)["'][^>]*\/?>/i
  );
  if (href?.[1]) {
    const u = href[1].trim();
    if (/^https?:\/\//i.test(u)) return u;
  }
  const inner = block.match(
    /<link(?:\s[^>]*)?>(?:<!\[CDATA\[)?\s*([^<\s]+)\s*(?:\]\]>)?<\/link>/i
  );
  if (inner?.[1] && /^https?:\/\//i.test(inner[1].trim()))
    return inner[1].trim();
  const guid = block.match(
    /<guid(?:\s[^>]*)?>(?:<!\[CDATA\[)?\s*([^<\s]+)\s*(?:\]\]>)?<\/guid>/i
  );
  if (guid?.[1] && /^https?:\/\//i.test(guid[1].trim())) return guid[1].trim();
  return null;
}

export function parseRssItemTitles(xml: string, maxItems: number): string[] {
  return parseRssItems(xml, maxItems).map((x) => x.title);
}

export function parseRssItems(
  xml: string,
  maxItems: number
): { title: string; link: string | null }[] {
  const out: { title: string; link: string | null }[] = [];
  const seen = new Set<string>();
  const chunks = xml.split(/<item[\s>]/i);
  for (let i = 1; i < chunks.length && out.length < maxItems; i++) {
    const block = chunks[i];
    const t = extractTitleFromItemBlock(block);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push({ title: t, link: extractLinkFromItemBlock(block) });
  }
  return out;
}

export function guessSentiment(title: string): "bullish" | "bearish" | "neutral" {
  const s = title.toLowerCase();
  const bear =
    /\b(war|crisis|sanction|recession|layoff|hack|fraud|probe|selloff|plunge|crash|tariff|default)\b/i.test(
      s
    );
  const bull =
    /\b(beat|surge|rally|record|cut rates|buyback|upgrade|growth|deal|breakthrough|approval)\b/i.test(
      s
    );
  if (bear && !bull) return "bearish";
  if (bull && !bear) return "bullish";
  return "neutral";
}
