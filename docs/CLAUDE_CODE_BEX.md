# BEX (random1-main) — Claude Code çalışma talimatı

## Altın kurallar

- **Projeyi sıfırdan yazma, yeni repo / yeşil saha Next iskeleti kurma.** Yalnızca bu repoda, **küçük ve hedefli diff** ile ilerle.
- **Aynı işi hem Cursor hem Claude Code ile paralel “yeniden yazdırma” yok** — tek kaynak bu repo; çakışan büyük refactor’lardan kaçın.
- **Stack’i değiştirmeden önce kullanıcıya sor** (özellikle `package.json`, major sürüm, yeni framework).
- Kök **AGENTS.md / CLAUDE.md** geçerli; Next.js sürümü eğitim verinden farklı olabilir — kırık / şüpheli API için **`node_modules/next/dist/docs/`** içine bak.

## Claude her görevde ne yapmalı?

1. **Önce oku:** ilgili dosyaları ve mevcut desenleri aç; tahminle dosya uydurma.
2. **Kapsamı dar tut:** istenen sekme / API / bileşen dışına taşma; “temizlik” bahanesiyle geniş refactor yapma.
3. **Davranışı koru:** `gex-engine` matematiğini ve `useMarketData` sözleşmesini **keyfi değiştirme**; değişiklik gerekiyorsa gerekçeyi ve etkisini yaz.
4. **Diff disiplini:** mümkünse tek PR mantığında; alakasız format-only değişikliklerden kaçın.
5. **Bitirmeden önce:** `npx tsc --noEmit` ve mümkünse `npm run lint` (veya projede tanımlı eşdeğer).
6. **Kapanış özeti:** hangi dosyalar, neden, risk / not (2–6 madde).

## Claude’un yapmaması gerekenler

- Tüm `src/app` veya tüm dashboard’u tek committe “yeniden düzenleme”.
- `node_modules/`, `.next/`, `code_dump.txt` üzerinde elle düzenleme.
- Kök `app.py`’yi Next akışına karıştırma veya silme (Streamlit mirası).
- NDX/SPX ↔ QQQ/SPY `displaySpot` / `spotPrice` ayrımını bozma.
- Onaysız yeni bağımlılık; “daha iyi kütüphane” ile mevcut Recharts/Plotly’yi değiştirme önerisi tek başına yeterli değil.

## Stack (buna uy; değiştirmeden önce sor)

- Next.js **16** (App Router), React **19**, TypeScript
- Tailwind **4** — `src/app/globals.css` CSS değişkenleri + `@theme inline`
- **Recharts** — bar / compare / terminal mini grafikler
- **Plotly** (`react-plotly.js`) — Heatmap, 3D Surface
- **lucide-react** — ikonlar

## Öncelikli klasörler (nereden başla?)

1. `src/app/dashboard/page.tsx` — sekme yönlendirme, `useMarketData`, `CompareTab` / `TerminalTab` callback’leri.
2. `src/components/dashboard/tabs/` — sekme bileşenleri (Exposures, Heatmap, Compare, Terminal, Bias, Calendar, …).
3. `src/components/dashboard/` — `Header.tsx`, `Sidebar.tsx`, `DashboardFooter.tsx`, `GlobeRiskPreview.tsx`.
4. `src/hooks/useMarketData.ts` — tek sembol veri; `displaySpot` (NDX/SPX endeks) + `spotPrice` (ETF zinciri) ayrımı.
5. `src/lib/gex-engine.ts` — GEX formülü ve seviyeler; **davranışı keyfi değiştirme.**
6. `src/lib/yahoo-options.ts`, `squeezemetrics.ts`, `rss-headlines.ts`, `constants.ts`, `mock-data.ts`.
7. `src/app/api/` — `quote`, `options`, `news`, `gex-scan` Route Handler’lar.

## Bilinen ürün kararları (bozma)

- **NDX / SPX:** Quote endeks, opsiyonlar QQQ/SPY; `displaySpot` vs `spotPrice` ayrımı `useMarketData` ve Compare’da tutarlı kalsın.
- **Compare:** Havuz `SPY, QQQ, IWM, AAPL`; canlı Yahoo + `gex-engine`.
- **Terminal:** Sahte log yok; gerçek metrik + `lastUpdate` ile activity satırı.
- **Bias:** Thesis şablon + metrikler; `live` → LIVE/DEMO rozeti.
- **News:** RSS + trending + statik; parse `rss-headlines.ts`.
- **Heatmap:** Vade pill’leri; “All” veya tek vade.
- **Calendar:** Alt kısımda `GlobeRiskPreview` — görsel önizleme; gerçek lat/lng pipeline yok (bilinçli).

## Dokunma (elle müdahale yok / dikkat)

- `node_modules/`, `.next/`, `code_dump.txt`
- Kök `app.py`
- `package.json` — yeni paket için önce gerekçe ve kullanıcı onayı; mümkünse mevcut stack

## Kalite çubuğu

- Görev sonu: **`npx tsc --noEmit`** (zorunlu), mümkünse **`npm run lint`**.
- Kısa özet: **hangi dosyalar**, **neden** değişti.
- UI görevinde: **`npm run build`** kırılmamalı; `public/` altına `.ts` kaynak kopyalama (Next typecheck tuzağı).

## İleride mantıklı işler (yalnızca onay sonrası)

- Küre için gerçek koordinat + NewsAPI/GDELT.
- Ücretli options veri sağlayıcısı (Polygon vb.).
- `GlobeRiskPreview`’ı ayrı sekme veya tam ekran haritaya taşıma.

## Görev formatı (kullanıcıdan beklenen)

Kullanıcı görev verirken mümkünse şunları yazsın: **hedef ekran veya dosya**, **kabul kriteri** (ör. “Opacity footer gibi tek satır”), **yapılmayacaklar** (ör. “yeni paket yok”). Claude da şüphede **tek soru** ile netleştirsin, varsayımla repo yapısını değiştirmesin.
