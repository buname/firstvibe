"use client";

import { useCallback, useEffect, useState } from "react";
import type { RefObject } from "react";

export function useElementFullscreen(targetRef: RefObject<HTMLElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(document.fullscreenElement === targetRef.current);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [targetRef]);

  const toggleFullscreen = useCallback(async () => {
    const node = targetRef.current;
    if (!node) return;
    if (document.fullscreenElement === node) {
      await document.exitFullscreen();
      return;
    }
    await node.requestFullscreen();
  }, [targetRef]);

  return { isFullscreen, toggleFullscreen };
}
