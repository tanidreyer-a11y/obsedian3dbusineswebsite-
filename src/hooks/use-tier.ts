import { useEffect, useState } from "react";

/**
 * These five strings are duplicated verbatim in src/styles.css.
 * Any edit must be made in both places.
 */
export const FALLBACK_QUERIES = [
  "(max-width: 720px)",
  "(orientation: portrait) and (max-width: 1024px)",
  "(orientation: portrait) and (pointer: coarse)",
  "(orientation: landscape) and (pointer: coarse) and (max-height: 560px)",
  "(prefers-reduced-motion: reduce)",
] as const;

export const REDUCED_MOTION_QUERY = FALLBACK_QUERIES[4];

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
  const matches = FALLBACK_QUERIES.map((q) => window.matchMedia(q).matches);
  // reduced motion is judged on its own, never mixed with capability
  if (matches[4]) return "static";
  if (matches.slice(0, 4).some(Boolean)) return "static";
  return hasWebgl2() ? "full" : "flat";
}

export function useTier(): Tier {
  const [tier, setTier] = useState<Tier>("pending");

  useEffect(() => {
    const evaluate = () => setTier(decide());
    evaluate();
    const lists = FALLBACK_QUERIES.map((q) => window.matchMedia(q));
    lists.forEach((l) => l.addEventListener("change", evaluate));
    window.addEventListener("resize", evaluate);
    window.addEventListener("orientationchange", evaluate);
    return () => {
      lists.forEach((l) => l.removeEventListener("change", evaluate));
      window.removeEventListener("resize", evaluate);
      window.removeEventListener("orientationchange", evaluate);
    };
  }, []);

  return tier;
}
