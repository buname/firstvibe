# Phase 10 Hardening Notes

## What was hardened now

1. **Shared resilience logic**
   - Added `src/hooks/useResilientFetch.ts` for retry + exponential backoff + snapshot fallback.
   - Added console logs for retries/snapshot hits for quick debug.
2. **Unified status UI**
   - Added `src/components/dashboard/StatusBadge.tsx` with consistent states:
     - `LIVE` (green)
     - `DEGRADED` (yellow)
     - `STALE SNAPSHOT` (orange)
     - `ERROR` (red)
   - Includes optional retry action.
3. **Applied to critical flows**
   - `GexScanTab`: now uses shared resilient fetch + status badge + manual retry.
   - `CalendarTab` (News feed): now uses shared resilient fetch + status badge + manual retry.

## Top 3 UX bugs fixed

1. **Inconsistent resilience UI language across pages**  
   Fixed by reusing one `StatusBadge`.
2. **No explicit manual retry in stale/error states for GexScan/News**  
   Added retry button via status badge.
3. **Duplicated custom retry/cache logic diverging over time**  
   Replaced with a shared resilient hook to prevent behavior drift.

## Performance profiling notes

- **Heavy render zones**
  - `CalendarTab`: multiple `useMemo` blocks + large headline list rendering.
  - `JournalTab`: large table + OCR flow state transitions.
  - `CompareTab`: multiple charts/cards with frequent refresh.
- **Current mitigations**
  - memoized derivations (`useMemo`) already used on major list/chart transforms.
  - transitions and loading kept lightweight (`framer-motion` short durations).
  - OCR is lazy-loaded (`import("tesseract.js")`) to avoid startup cost.
- **Next optimization candidates**
  - virtualize long tables (`Journal` trade log) if row count grows.
  - memoize chart subcomponents in `Compare` if refresh frequency increases.
  - debounce user inputs on scan/filter text areas.

## Remaining risk checklist

- **API rate limits**: Yahoo endpoints can still throttle; stale snapshots mitigate UX but not data freshness.
- **Fallback confidence**: stale snapshots can mask prolonged outages; keep visible stale badge.
- **Mobile responsiveness**: dense tables/charts still need targeted mobile QA.
- **OCR accuracy edge cases**: broker screenshot layouts vary; extraction remains best-effort.
- **Notification permissions**: browser-level permission denials reduce alert channels.
