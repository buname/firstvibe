"use client";

/**
 * Embeds the legacy client from /public/legacy/ (iframe).
 * index.html loads Chart.js, Hammer, chartjs-plugin-zoom from /legacy/npm/, then app.min.js.
 */
export default function LegacyBundleTab() {
  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-8rem)] bg-black">
      <div className="shrink-0 px-3 py-2 border-b border-[#1a1a1a] text-[11px] text-text-muted font-mono">
        Legacy bundle (iframe) — served from{" "}
        <span className="text-accent-green/90">/legacy/index.html</span>
      </div>
      <iframe
        title="Legacy options bundle"
        src="/legacy/index.html"
        className="flex-1 w-full min-h-0 border-0 bg-black"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  );
}
