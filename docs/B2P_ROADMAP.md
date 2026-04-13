# BEX → Opacity-style (B2P) roadmap

Incremental parity with the reference dashboard. **Constraint:** small diffs, no stack churn, **no new npm packages** unless you explicitly approve (Sonner, Framer Motion, Zustand, globe.gl, Tesseract, etc. stay **out of scope** until then).

## Gap matrix (high level)

| Area | Target (your spec) | In repo today | Next steps (no new deps) |
|------|---------------------|---------------|---------------------------|
| Heatmap | Multi-expiry, ladder, spot line, intensity | Plotly 2D + ladder, expiry pills, spot line | ~~Strike window around ATM~~, ~~bar intensity + labels~~; optional: heatmap style toggle |
| Flow | Bubble by premium, Vol/OI, table, filters | Recharts scatter + ZAxis | ~~Spot ref line, Vol/OI threshold, expiry filter, sortable table~~ |
| Compare | Multi-ticker, mini GEX, confluence | Pool + cards + refresh | Harden Yahoo empty-chain UX; “insufficient chain” copy ~~done~~ |
| Journal | DnD, OCR, grading, filters | Tabs incl. equity / MAE-MFE / gallery, CSV export | OCR/DnD needs **Tesseract or API** → package approval |
| Settings | Toasts, sounds, Discord, themes | Refresh interval, strike spacing UI, clear data | ~~Native Notification level alerts~~; Sonner/sounds → **approval** |
| Real-time | WebSockets | Polling `useMarketData` | SSE/WS = larger change; keep polling + `lastUpdate` |
| UI polish | Framer, skeletons everywhere | Tailwind + selective spinners | Motion = **approval**; skeletons per-tab incremental |
| Globe | 3D risk | `GlobeRiskPreview` (preview) | Real coords / news feed = data + likely new deps |

## Phases vs. reality

1. **Audit** — Use this doc + `AGENTS.md` + tab folders under `src/components/dashboard/tabs/`.
2. **Heatmap** — Wired to `data.heatmap` / `spotPrice`; do not change `gex-engine` math without a documented reason.
3. **Flow** — Uses `unusualFlow` from the same pipeline as today.
4. **Journal** — Prefer extending `JournalTab`; persistence is `localStorage` unless you add a backend.
5. **Alerts** — `useLevelCrossAlerts` + Settings toggles + **Notification API** (no toast library).
6. **Compare** — Keep pool `SPY, QQQ, IWM, AAPL`; improve fetch resilience and UX, not silent pool expansion.
7. **Polish** — Error boundary on dashboard tab body; keyboard shortcuts / offline cache as follow-ups.

## Contracts (do not break)

- `useMarketData`: **`displaySpot`** (index quote for NDX/SPX) vs **`spotPrice`** (ETF chain math). Level-cross alerts intentionally use **`spotPrice`** so they match GEX levels.
- `gex-engine` formulas are canonical unless you sign off on a math change.

## Approved dependency candidates (when you say yes)

- **Toasts:** `sonner` or `react-toastify`
- **Motion:** `framer-motion`
- **State:** `zustand` / `jotai` for alerts + settings if localStorage hooks get unwieldy
- **Journal OCR:** `tesseract.js` (heavy) vs hosted Vision API
- **Realtime:** SSE first, then WS, with Yahoo rate limits in mind

## Dependency decision (current)

- We are **not** adding any new npm package right now.
- Rule: stabilize current flows/data paths first; add dependencies only when a concrete blocker cannot be solved with the existing stack.

## Phase execution protocol (approved)

- Continue the existing 7-phase roadmap incrementally (no restart / no broad refactor).
- Confirm build health after each major step (`npx tsc --noEmit`, targeted lint).
- Stop after each phase and wait for explicit user confirmation before moving to next phase.

## Package approval update

User-approved for relevant phases:

- `sonner`
- `tesseract.js`
- `react-dnd`
- `react-dnd-html5-backend`
- `framer-motion`

Install timing (per plan): during Phase 2/3 setup window before feature integrations that need them.

## Resilience extension approval

Approved to extend degrade + snapshot resilience pattern to:

- `GexScan` flow
- `Calendar/News` flow

Implementation rules:

- Reuse retry + backoff pattern already used in Compare / market data.
- Prefer stale snapshot fallback over hard failure.
- Keep visual status indicators consistent (`LIVE` / `DEGRADED` / `STALE` semantics).

## Current phase status

- ✅ Phase 1: audit + architecture continuity check complete.
- ✅ Phase 2: package install + global setup complete (`Toaster`, `AnimatePresence`, Journal `DndProvider`).
- ✅ Phase 3: sonner-connected alerts + resilience extension to `GexScan` and `Calendar/News`.
- ✅ Phase 4: Journal drag-and-drop OCR autofill (lazy `tesseract.js`) integrated.
- ✅ Phase 5: advanced settings + alerts expanded (pinned levels, sound, heatmap style, export).
- ✅ Phase 6: Compare strengthened (refresh-all state, add-ticker from allowed universe, grid/readability improvements).
- ✅ Phase 7: UI polish pass complete (framer-motion tab transitions + dashboard skeleton loading).

## Post-phase hardening status

- ✅ Phase 8 checks: required packages and root integrations already present and verified.
- ✅ Phase 9: shared resilient fetch + unified status badge applied to `GexScan` and `Calendar/News`.
- ✅ Phase 10: lightweight hardening pass + risk checklist documented in `docs/PHASE10_HARDENING.md`.
