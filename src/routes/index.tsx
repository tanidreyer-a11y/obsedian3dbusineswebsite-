import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useRef } from "react";

import { useTier } from "@/hooks/use-tier";
import { ensureGsap, prefersReducedMotion } from "@/lib/motion";
import RoomBrain from "@/components/RoomBrain";
import brainDust from "@/assets/brain-cutout.png";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "OBSIDIAN — 3D Animated Websites for Businesses" },
      {
        name: "description",
        content:
          "OBSIDIAN is a studio building high-end 3D animated websites. Digital precision that builds reputation.",
      },
      { property: "og:title", content: "OBSIDIAN — 3D Animated Websites for Businesses" },
      {
        property: "og:description",
        content: "High-end 3D animated websites. Digital precision that builds reputation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ObsidianPage,
});

const capabilities = [
  {
    index: "01",
    name: "Motion-first design",
    note: "Every site starts as a storyboard, not a wireframe — the scroll is the interface.",
  },
  {
    index: "02",
    name: "Engineering for scroll",
    note: "Scroll-scrubbed video, live 3D, and the seek-gating and encode work that keep it smooth.",
  },
  {
    index: "03",
    name: "Brand systems built to hold",
    note: "One palette, one type trio, one motion language — carried through every screen, not just the hero.",
  },
] as const;

/** Reveal that toggles on intersection in both directions. */
function useBidirectionalReveal() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!nodes.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const on = entry.isIntersecting;
          const el = entry.target as HTMLElement;
          if ((el.dataset["on"] === "1") !== on) {
            el.dataset["on"] = on ? "1" : "0";
          }
        });
      },
      { rootMargin: "-12% 0px -12% 0px" },
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);
}

/**
 * Cover transition: Capabilities pins in place for one viewport of scroll while
 * Contact — sitting fixed just below the viewport — slides up over it. Capabilities
 * never moves or fades; it just gets covered. One engine (GSAP) owns this, and
 * nothing else on the page drives scroll-linked transforms over the same range.
 */
function useStackedCover(
  capRef: React.RefObject<HTMLElement | null>,
  nextRef: React.RefObject<HTMLElement | null>,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled || prefersReducedMotion() || !capRef.current || !nextRef.current) return;
    const { gsap, ScrollTrigger } = ensureGsap();
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: capRef.current,
        start: "top top",
        end: "+=100%",
        pin: true,
      });

      gsap.fromTo(
        nextRef.current,
        { yPercent: 100 },
        {
          yPercent: 0,
          ease: "none",
          scrollTrigger: {
            trigger: capRef.current,
            start: "top top",
            end: "+=100%",
            scrub: true,
          },
        },
      );
    });
    return () => ctx.revert();
  }, [capRef, nextRef, enabled]);
}

/** Non-interactive fallback for reduced-motion / small or coarse-pointer devices — the resting frame, no scrub. */
function StaticHero() {
  return (
    <div className="hero-static">
      <div className="room-static-media">
        <img src={brainDust} alt="A satin-grey brain form suspended in a burst of violet dust" />
      </div>
    </div>
  );
}

function ObsidianPage() {
  const tier = useTier();
  const cinematic = tier === "full" || tier === "flat";
  const capRef = useRef<HTMLElement>(null);
  const contactRef = useRef<HTMLElement>(null);

  useBidirectionalReveal();
  useStackedCover(capRef, contactRef, cinematic);

  return (
    <main className="wisp" data-tier={tier}>
      <header className="bar">
        <a href="#top" className="mark" aria-label="OBSIDIAN, home">
          OBSIDIAN
        </a>
        <span className="bar-label">3D animated websites</span>
        <a className="bar-cta" href="mailto:studio@obsidian.dev">
          Start a project <ArrowUpRight size={14} />
        </a>
      </header>

      <div id="top">{cinematic ? <RoomBrain /> : <StaticHero />}</div>

      <div className="below">
        <section className="capabilities" id="capabilities" ref={capRef}>
          <div className="row-head">
            <p className="mono-label">What we build</p>
            <span className="mono-label">Index</span>
          </div>
          <ul className="capability-index">
            {capabilities.map((item) => (
              <li key={item.index} data-reveal>
                <span className="mono-label cap-num">{item.index}</span>
                <h3>{item.name}</h3>
                <p>{item.note}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="contact" id="contact" ref={contactRef}>
          <h2 data-reveal className="masked">
            <span>Let your brand</span>
            <span>come alive.</span>
          </h2>
          <a className="cta" href="mailto:studio@obsidian.dev">
            Start a project
            <ArrowUpRight size={20} />
          </a>
          <footer>
            <span className="mark">OBSIDIAN</span>
            <span className="mono-label">Digital precision that builds reputation.</span>
          </footer>
        </section>
      </div>
    </main>
  );
}
