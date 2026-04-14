"use client";

import { useEffect, useMemo, useState } from "react";

function isBlockedShortcut(event: KeyboardEvent): boolean {
  const key = event.key.toLowerCase();
  if (event.key === "F12") return true;
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && (key === "i" || key === "j")) {
    return true;
  }
  if ((event.ctrlKey || event.metaKey) && key === "u") return true;
  return false;
}

export default function SecurityDeterrence() {
  const reason = useMemo(() => {
    if (typeof window === "undefined") return null;
    if (window.self !== window.top) return "This app is blocked inside iframes.";
    const widthGap = Math.abs(window.outerWidth - window.innerWidth);
    const heightGap = Math.abs(window.outerHeight - window.innerHeight);
    if (widthGap > 160 || heightGap > 160) {
      return "Devtools-like window size detected.";
    }
    return null;
  }, []);
  const [shortcutTriggered, setShortcutTriggered] = useState(false);

  useEffect(() => {
    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isBlockedShortcut(event)) return;
      event.preventDefault();
      event.stopPropagation();
      setShortcutTriggered(true);
    };

    document.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("keydown", onKeyDown, { capture: true });

    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("keydown", onKeyDown, { capture: true });
    };
  }, []);

  if (!shortcutTriggered && !reason) return null;

  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-[100] max-w-xs rounded border border-amber-400/40 bg-[#130f04]/95 p-3 text-[11px] text-amber-200 shadow-xl">
      <p className="font-semibold">Protection Notice</p>
      <p className="mt-1 text-amber-100/80">
        {reason ?? "Inspection shortcuts are disabled as a deterrent only. Sensitive logic remains on the server."}
      </p>
    </div>
  );
}
