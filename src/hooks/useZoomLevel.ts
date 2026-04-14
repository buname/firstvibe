"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef, useState } from "react";

export type GlobeLodLevel = "far" | "mid" | "near";

function resolveLod(distance: number): GlobeLodLevel {
  if (distance > 3.5) return "far";
  if (distance > 2.35) return "mid";
  return "near";
}

export function useZoomLevel() {
  const { camera } = useThree();
  const [distance, setDistance] = useState(() => camera.position.length());
  const [lod, setLod] = useState<GlobeLodLevel>(() =>
    resolveLod(camera.position.length())
  );
  const lastCommitRef = useRef(0);

  useFrame((state) => {
    const now = state.clock.getElapsedTime() * 1000;
    if (now - lastCommitRef.current < 140) return;
    lastCommitRef.current = now;
    const nextDistance = camera.position.length();
    const nextLod = resolveLod(nextDistance);

    setDistance((prev) => (Math.abs(prev - nextDistance) > 0.12 ? nextDistance : prev));
    setLod((prev) => (prev === nextLod ? prev : nextLod));
  });

  return { distance, lod };
}
