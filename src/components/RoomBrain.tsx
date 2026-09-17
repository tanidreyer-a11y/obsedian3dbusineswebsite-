import { useEffect, useRef, useState } from "react";
import brainDust from "@/assets/brain-cutout.png";
import { ensureGsap, prefersReducedMotion } from "@/lib/motion";
import { beat } from "@/lib/scroll-progress";
import { createScrollScrub, type ScrollScrub } from "@/lib/scroll-scrub";

const VIDEO_START = 0.08;
const VIDEO_IN_DONE = VIDEO_START * 0.6;
const DURATION = 24.9583;
const HOLD_MS = 2600;
const FADE_MS = 450;

type Caption = { at: number; time: number; align: "left" | "right"; kicker: string; head: string; sub: string };

// `at` is the scroll progress that triggers the lock; `time` is the video second held during it.
const CAPTIONS: Caption[] = [
  {
    at: 0.151,
    time: 2.0,
    align: "right",
    kicker: "The idea",
    head: "Every brand starts as an idea nobody's seen yet.",
    sub: "OBSIDIAN gives it a shape worth stopping for.",
  },
  {
    at: 0.301,
    time: 6.2,
    align: "right",
    kicker: "The craft",
    head: "Building it right takes discipline.",
    sub: "We treat every site like a craft, not a template pulled off a shelf.",
  },
  {
    at: 0.437,
    time: 10.0,
    align: "left",
    kicker: "The movement",
    head: "The web moves. Most sites don't.",
    sub: "We build the ones that keep pace with your business, not behind it.",
  },
  {
    at: 0.865,
    time: 22.0,
    align: "left",
    kicker: "The arrival",
    head: "This is what it looks like when a brand finally comes alive.",
    sub: "OBSIDIAN — 3D animated websites for businesses that refuse to be forgettable.",
  },
];

/**
 * The whole hero: rests on the brain image, wordmark behind it. On scroll the
 * wordmark fades and one continuous journey plays full-bleed. At four beats,
 * scroll genuinely locks for a couple seconds — the video holds still, the
 * page can't be scrolled past it — long enough to actually read the line
 * against it, then releases on its own.
 */
export default function RoomBrain() {
  const room = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const wordmark = useRef<HTMLDivElement>(null);
  const poster = useRef<HTMLImageElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const captionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrub = useRef<ScrollScrub | null>(null);
  const ready = useRef(false);
  // Last progress applied by a scroll tick, and the function that applies it — so
  // the load-ready callback below (which can fire seconds after the user stopped
  // scrolling, especially over a slow connection) can re-run the crossfade itself
  // instead of leaving the poster stuck until the next scroll event.
  const lastProgress = useRef(0);
  const applyChromeRef = useRef<(p: number) => void>(() => {});
  const [loadFraction, setLoadFraction] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion() || !room.current || !video.current) return;
    scrub.current = createScrollScrub(
      video.current,
      "/media/journey.mp4",
      (f) => {
        setLoadFraction(f);
        if (f >= 1) setLoaded(true);
      },
      // The real "safe to show the video" signal — a decoded frame exists, not just
      // "all bytes arrived". Firing the crossfade (or a scroll-lock) before this can
      // land on a video element with full opacity and nothing decoded yet: black.
      () => {
        ready.current = true;
        applyChromeRef.current(lastProgress.current);
      },
    );
    return () => scrub.current?.destroy();
  }, []);

  useEffect(() => {
    const el = room.current;
    if (prefersReducedMotion() || !el) return;
    const { gsap, ScrollTrigger } = ensureGsap();

    const applyChrome = (p: number) => {
      const exitRaw = beat(p, 0, VIDEO_START * 0.85);
      if (wordmark.current) {
        wordmark.current.style.opacity = `${1 - exitRaw}`;
        wordmark.current.style.transform = `translate3d(0, ${-exitRaw * 26}%, 0) scale(${1 + exitRaw * 0.08})`;
      }
      // Never fade the poster out ahead of the video actually having a frame to show —
      // otherwise a slow load or a fast scroll lands on a black gap between the two.
      const videoIn = ready.current ? beat(p, VIDEO_IN_DONE, VIDEO_START) : 0;
      if (poster.current) poster.current.style.opacity = `${1 - videoIn}`;
      if (video.current) video.current.style.opacity = `${videoIn}`;
    };
    applyChromeRef.current = applyChrome;

    let locking = false;
    let lastP = 0;
    const fired = new Array(CAPTIONS.length).fill(false);
    const timers: ReturnType<typeof setTimeout>[] = [];

    // iOS Safari can rubber-band past `overflow: hidden` on touch; block the
    // gesture outright while a lock is active instead of relying on it alone.
    const blockTouch = (e: TouchEvent) => {
      if (locking) e.preventDefault();
    };
    document.addEventListener("touchmove", blockTouch, { passive: false });

    const releaseLock = () => {
      document.documentElement.style.removeProperty("overflow");
      locking = false;
    };

    const runLock = (i: number) => {
      const cap = CAPTIONS[i]!;
      locking = true;
      scrub.current?.setProgress(cap.time / DURATION);
      document.documentElement.style.overflow = "hidden";

      const captionEl = captionRefs.current[i];
      // Next frame so the transition actually plays instead of snapping in already-applied.
      timers.push(
        setTimeout(() => {
          captionEl?.classList.add("is-active");
        }, 30),
      );
      timers.push(
        setTimeout(() => {
          captionEl?.classList.remove("is-active");
        }, HOLD_MS - FADE_MS),
      );
      timers.push(setTimeout(releaseLock, HOLD_MS));
    };

    const trigger = ScrollTrigger.create({
      trigger: el,
      start: "top top",
      end: "bottom top",
      onUpdate: (self) => {
        const p = self.progress;
        if (locking) return;
        applyChrome(p);

        const scrubP = beat(p, VIDEO_START, 0.97);
        scrub.current?.setProgress(scrubP);

        for (let i = 0; i < CAPTIONS.length; i++) {
          if (!fired[i] && lastP < CAPTIONS[i]!.at && p >= CAPTIONS[i]!.at) {
            fired[i] = true;
            runLock(i);
            break;
          }
        }
        lastP = p;
        lastProgress.current = p;
      },
    });

    return () => {
      trigger.kill();
      timers.forEach(clearTimeout);
      document.removeEventListener("touchmove", blockTouch);
      document.documentElement.style.removeProperty("overflow");
      gsap.killTweensOf([wordmark.current, poster.current, video.current]);
    };
  }, []);

  return (
    <section className="room room-brain" ref={room} aria-label="Obsidian">
      <div className="room-inner" ref={inner}>
        <div className="brain-wordmark" ref={wordmark} aria-hidden="true">
          OBSIDIAN
        </div>

        <div className="brain-stage">
          <img
            className="brain-poster"
            ref={poster}
            src={brainDust}
            alt="A satin-grey brain form suspended in a burst of violet dust"
          />
          <video
            className="brain-video"
            ref={video}
            muted
            playsInline
            preload="none"
            aria-label="A journey from a bursting cloud of violet dust into a samurai running through a moonlit cherry-blossom night, carrying into daylight"
          />
        </div>

        {!loaded && (
          <div className="journey-load" role="status" aria-live="polite">
            <div className="journey-load-track">
              <div className="journey-load-fill" style={{ transform: `scaleX(${loadFraction})` }} />
            </div>
            <span className="mono-label">Loading the journey — {Math.round(loadFraction * 100)}%</span>
          </div>
        )}

        {CAPTIONS.map((cap, i) => (
          <div
            key={cap.head}
            className="story-caption"
            data-align={cap.align}
            ref={(el) => {
              captionRefs.current[i] = el;
            }}
          >
            <p className="mono-label story-kicker">{cap.kicker}</p>
            <h2>{cap.head}</h2>
            <p className="story-sub">{cap.sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
