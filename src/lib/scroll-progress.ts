// Single number crossing the DOM -> 3D boundary, exactly like a Spline variable.
export const heroProgress = { value: 0 };

export function setHeroProgress(next: number) {
  const clamped = next < 0 ? 0 : next > 1 ? 1 : next;
  // write only on change
  if (Math.abs(clamped - heroProgress.value) > 0.0005) {
    heroProgress.value = clamped;
    return true;
  }
  return false;
}

export const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/** normalised sub-range of the hero timeline */
export function beat(p: number, from: number, to: number) {
  return clamp01((p - from) / (to - from));
}

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * Piecewise-linear lookup: given ordered [progress, value] anchors, interpolates
 * between them. Two anchors sharing a value produce a flat "hold" between them —
 * used to freeze a scrubbed video's time while a caption band is on screen.
 */
export function piecewise(p: number, anchors: readonly (readonly [number, number])[]): number {
  if (p <= anchors[0]![0]) return anchors[0]![1];
  for (let i = 0; i < anchors.length - 1; i++) {
    const [p0, v0] = anchors[i]!;
    const [p1, v1] = anchors[i + 1]!;
    if (p <= p1) {
      if (p1 === p0) return v1;
      return v0 + ((p - p0) / (p1 - p0)) * (v1 - v0);
    }
  }
  return anchors[anchors.length - 1]![1];
}

/** Fade in over the first `ease` fraction of [start,end], hold, fade out over the last `ease` fraction. */
export function bandOpacity(p: number, start: number, end: number, ease = 0.18): number {
  const span = end - start;
  const inEnd = start + span * ease;
  const outStart = end - span * ease;
  if (p < start || p > end) return 0;
  if (p < inEnd) return beat(p, start, inEnd);
  if (p > outStart) return 1 - beat(p, outStart, end);
  return 1;
}
