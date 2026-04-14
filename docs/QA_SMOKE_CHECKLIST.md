# QA Smoke Checklist

## 1) Desktop General Flow

- Run `npm run dev` and verify dashboard loads.
- Confirm header actions work: symbol switch, refresh, LIVE/DEMO, expiry pills.
- Verify sidebar tab navigation works without runtime errors.
- Open each major tab once: Terminal, Heatmap, Flow, Compare, Calendar, Journal, Settings.
- Confirm no console crashes.

## 2) Mobile / Responsive (DevTools)

- Test iPhone SE, iPhone 14, and iPad viewports.
- Verify sidebar/content does not overlap.
- Verify Compare cards collapse cleanly on narrow widths.
- Verify Calendar news filters are tap-friendly.
- Verify Journal form + log remain usable (horizontal overflow acceptable, unreadable clipping is not).

## 3) Stale Data Scenario

Goal: verify snapshot fallback.

1. Run GexScan once successfully (creates snapshot).
2. Switch browser network to `Offline`.
3. Run GexScan again.
4. Expected:
   - Status shows `STALE SNAPSHOT`
   - Retry button is visible
   - Previous results remain visible
   - Warning toast appears
5. Restore network and press Retry; status should recover to `LIVE`.

## 4) Degraded Mode Scenario

Goal: verify partial-data resilience.

- GexScan:
  1. Use many tickers and restrictive params.
  2. Expected: `DEGRADED` state with partial rows/errors, no crash.

- Calendar/News:
  1. Set network to `Slow 3G` or simulate flaky connectivity.
  2. Expected: `DEGRADED` or `STALE SNAPSHOT` status, page stays functional.

## 5) Journal OCR Smoke

1. Open Journal tab.
2. Drag/drop a trade screenshot into OCR drop zone.
3. Expected:
   - OCR progress feedback (toast/text)
   - Autofill attempts for date/direction/entry/stop/exit/contracts
4. Test a poor screenshot (blurry/rotated):
   - Expected graceful warning/error
   - No crash
5. Manually adjust fields and save trade; row should appear in trade log.

## 6) Alert / Toast Smoke

- In Settings, test:
  - master alerts toggle
  - gamma/call/put toggles
  - sound toggle
  - pinned levels save
- Expected:
  - Settings persist in localStorage
  - level-cross toasts appear
  - native browser notifications appear if permission granted
  - cooldown prevents spam repeats

## 7) Compare Resilience

- Press `Refresh All`:
  - loading state updates
  - timestamp updates
- Verify failure on one ticker does not blank all cards.
- Verify stale fallback appears where snapshot exists.
- Verify add/remove extra ticker chips behave correctly.

## 8) Final Regression Gate

- `npx tsc --noEmit` clean.
- Targeted lint clean on changed files.
- `npm run build` succeeds.
- End-to-end sanity: dashboard open, compare refresh, calendar/news status, journal OCR all tested once.

---

## Quick Test Log Template

- Device/Viewport:
- Step:
- Expected:
- Actual:
- Result: Pass/Fail
- Notes/Screenshot:
