import { useEffect, useState } from "react";

/**
 * Only reduced-motion forces the static fallback now — the journey is pure video
 * + GSAP, no WebGL, so screen size and pointer type aren't a real capability signal
 * for it. Small-screen/coarse-pointer used to force static too (RoomBrain never
 * touched a phone), which is what "static" is still named for.
 */
export const FALLBACK_QUERIES = ["(prefers-reduced-motion: reduce)"] as const;

export const REDUCED_MOTION_QUERY = FALLBACK_QUERIES[0];

export type Tier = "full" | "flat" | "static" | "pending";

function hasWebgl2() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2"));
  } catch {
    return false;
  }
}

function decide(): Tier {
  if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return "static";
  return hasWebgl2() ? "full" : "flat";
}

export function useTier(): Tier {
  const [tier, setTier] = useState<Tier>("pending");

  useEffect(() => {
    const evaluate = () => setTier(decide());
    evaluate();
    const list = window.matchMedia(REDUCED_MOTION_QUERY);
    list.addEventListener("change", evaluate);
    return () => list.removeEventListener("change", evaluate);
  }, []);

  return tier;
}
