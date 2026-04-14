#!/usr/bin/env node
/**
 * BEX — Cursor beforeShellExecution guard
 * Reads JSON from stdin, checks for dangerous patterns, writes JSON to stdout.
 * failClosed: false  →  any crash/parse error defaults to "allow".
 */

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  try {
    const input = JSON.parse(raw || "{}");
    const cmd = (input.command || input.cmd || "").toLowerCase();

    // ── Rule A: rm -rf targeting dangerous paths ────────────────────────────
    const rmRfPattern = /rm\s+-[a-z]*r[a-z]*f|rm\s+-[a-z]*f[a-z]*r/i;
    const dangerousTargets =
      /node_modules|\.next|\/tmp|~\/|\.\.\/|^\/[^U]|\/root/;

    if (rmRfPattern.test(cmd) && dangerousTargets.test(cmd)) {
      process.stdout.write(
        JSON.stringify({
          permission: "deny",
          user_message:
            "🛑 BEX guard blocked: rm -rf on a protected path (node_modules, .next, system dirs). Run manually if intentional.",
        })
      );
      return;
    }

    // ── Rule B: force push or hard reset ───────────────────────────────────
    const forcePushPattern = /git\s+push\s+.*--force|git\s+push\s+.*-f\b/i;
    const hardResetPattern = /git\s+reset\s+--hard/i;

    if (forcePushPattern.test(cmd) || hardResetPattern.test(cmd)) {
      process.stdout.write(
        JSON.stringify({
          permission: "ask",
          user_message:
            "⚠️  BEX guard: destructive git operation detected (force-push or hard reset). Confirm before proceeding.",
        })
      );
      return;
    }

    // ── Default: allow ──────────────────────────────────────────────────────
    process.stdout.write(JSON.stringify({ permission: "allow" }));
  } catch {
    // fail open — don't block work on parse errors
    process.stdout.write(JSON.stringify({ permission: "allow" }));
  }
});
