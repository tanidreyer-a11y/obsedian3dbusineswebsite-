/**
 * Ties a <video>'s currentTime to a 0-1 progress value from scroll.
 * Fetches as a Blob (so a host without Range support can't clamp seeks to
 * zero), lerps the displayed time so fast scroll doesn't spam seeks, and
 * gates every seek so a new one never fires while one is still in flight.
 */
export type ScrollScrub = {
  setProgress: (p: number) => void;
  destroy: () => void;
};

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

  fetch(src)
    .then(async (r) => {
      const total = Number(r.headers.get("content-length")) || 0;
      if (!total || !r.body) return r.blob();
      const reader = r.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        onLoadProgress?.(Math.min(1, received / total));
      }
      return new Blob(chunks as BlobPart[]);
    })
    .then((blob) => {
      if (destroyed) return;
      objectUrl = URL.createObjectURL(blob);
      video.src = objectUrl;
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
    })
    .catch(() => {});

  return {
    setProgress(p: number) {
      target = p < 0 ? 0 : p > 1 ? 1 : p;
      kick();
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    },
  };
}
