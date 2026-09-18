/**
 * Ties a <video>'s currentTime to a 0-1 progress value from scroll.
 * Fetches as a Blob (so a host without Range support can't clamp seeks to
 * zero), lerps the displayed time so fast scroll doesn't spam seeks, and
 * gates every seek so a new one never fires while one is still in flight.
 *
 * The Blob fetch blocks on the whole file, which is fine on a fast link but
 * can take well over a minute on real mobile cellular. Two independent
 * escape hatches abandon it for native progressive streaming instead (only
 * safe because this host actually honors Range requests — confirmed via
 * curl before relying on it): a throughput sample ~600ms in projects total
 * download time and bails past an ~8s projection, and a 20s hard watchdog
 * catches anything the sample missed (a slow *start* rather than a slow
 * steady rate, a response with no content-length, etc).
 */
export type ScrollScrub = {
  setProgress: (p: number) => void;
  destroy: () => void;
};

const THROUGHPUT_SAMPLE_MS = 600;
const SLOW_PROJECTED_TOTAL_S = 8;
const WATCHDOG_MS = 20000;

export function createScrollScrub(
  video: HTMLVideoElement,
  src: string,
  onLoadProgress?: (fraction: number) => void,
  onReady?: () => void,
): ScrollScrub {
  let target = 0;
  let shown = 0;
  let lastTick = 0;
  let rafId = 0;
  let seekBusy = false;
  let pendingTime: number | null = null;
  let duration = 0;
  let destroyed = false;
  let objectUrl: string | null = null;
  let useBlob = true;
  let watchdog = 0;

  const requestSeek = (t: number) => {
    if (!duration) return;
    if (seekBusy) {
      pendingTime = t;
      return;
    }
    seekBusy = true;
    video.currentTime = t;
  };

  const onSeeked = () => {
    seekBusy = false;
    if (pendingTime !== null) {
      const t = pendingTime;
      pendingTime = null;
      requestSeek(t);
    }
  };
  const onError = () => {
    seekBusy = false;
    pendingTime = null;
  };

  video.addEventListener("seeked", onSeeked);
  video.addEventListener("error", onError);

  const tick = (now: number) => {
    if (destroyed) return;
    const dt = Math.min(100, now - (lastTick || now));
    lastTick = now;
    const k = 0.18;
    shown += (target - shown) * (1 - Math.pow(1 - k, dt / 16.667));
    if (Math.abs(target - shown) < 0.0008) {
      shown = target;
    } else {
      rafId = requestAnimationFrame(tick);
    }
    // Seeking to exactly `duration` can land past the last decodable frame and paint nothing.
    if (duration) requestSeek(Math.min(shown * duration, duration - 0.05));
  };

  const kick = () => {
    lastTick = 0;
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
  };

  const wireNativeListeners = () => {
    video.addEventListener(
      "loadedmetadata",
      () => {
        duration = video.duration || 0;
        requestSeek(target * duration);
      },
      { once: true },
    );
    // loadeddata is the real "a frame exists to paint" signal — metadata alone
    // (duration/dimensions) doesn't guarantee that yet, and byte-download progress
    // is even further removed from it.
    video.addEventListener("loadeddata", () => onReady?.(), { once: true });
  };

  // Abandon the Blob attempt and let the browser stream + Range-seek the file
  // directly. Safe only because Range support was confirmed on this host first.
  const fallBackToNative = () => {
    if (destroyed || !useBlob) return;
    useBlob = false;
    clearTimeout(watchdog);
    // Byte-progress no longer means anything once we're streaming — the load
    // screen would otherwise sit frozen at whatever fraction we'd reached.
    onLoadProgress?.(1);
    video.preload = "auto";
    video.src = src;
    wireNativeListeners();
  };

  watchdog = window.setTimeout(fallBackToNative, WATCHDOG_MS);

  const fetchStart = performance.now();
  let sampled = false;

  fetch(src)
    .then(async (r) => {
      const total = Number(r.headers.get("content-length")) || 0;
      if (!total || !r.body) {
        fallBackToNative();
        return null;
      }
      const reader = r.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      for (;;) {
        if (!useBlob) {
          await reader.cancel().catch(() => {});
          return null;
        }
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        onLoadProgress?.(Math.min(1, received / total));

        if (!sampled && performance.now() - fetchStart >= THROUGHPUT_SAMPLE_MS) {
          sampled = true;
          const elapsedS = (performance.now() - fetchStart) / 1000;
          const projectedTotalS = total / (received / elapsedS);
          if (projectedTotalS > SLOW_PROJECTED_TOTAL_S) {
            await reader.cancel().catch(() => {});
            fallBackToNative();
            return null;
          }
        }
      }
      return new Blob(chunks as BlobPart[]);
    })
    .then((blob) => {
      if (!blob || destroyed || !useBlob) return;
      clearTimeout(watchdog);
      objectUrl = URL.createObjectURL(blob);
      video.src = objectUrl;
      wireNativeListeners();
    })
    .catch(() => fallBackToNative());

  return {
    setProgress(p: number) {
      target = p < 0 ? 0 : p > 1 ? 1 : p;
      kick();
    },
    destroy() {
      destroyed = true;
      clearTimeout(watchdog);
      cancelAnimationFrame(rafId);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    },
  };
}
