"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import Lenis from "lenis";
import { sound } from "./sound";
import { heroScene, rockScene, motionScene, lineWordmark } from "./scenes";

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);

// All copy below is original placeholder text for a fictional studio.
const BRAND = "ARCLINE";

function Mark({ className = "" }) {
  return (
    <svg viewBox="0 0 30 24" className={className} fill="currentColor" aria-hidden>
      <path d="M3 22 9 6h4L7 22zM10 22l7-19h4l-7 19zM17 22l7-21h4l-7 21z" />
    </svg>
  );
}

function Plus({ className = "" }) {
  return <span className={`absolute text-xl leading-none font-light ${className}`}>+</span>;
}

/* ───────────────────────── Header + menu ───────────────────────── */
function Header() {
  const muted = useSyncExternalStore(sound.subscribe, sound.isMuted, () => true);
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!menu.current) return;
    gsap.to(menu.current, { clipPath: open ? "inset(0 0 0% 0)" : "inset(0 0 100% 0)", duration: 0.8, ease: "expo.inOut" });
    if (open) gsap.from(menu.current.querySelectorAll("li"), { yPercent: 110, stagger: 0.06, duration: 0.8, ease: "expo.out", delay: 0.3 });
  }, [open]);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-5 py-6 text-white mix-blend-difference md:px-9 md:py-9">
        <a href="#" className="flex items-center gap-1.5 text-[22px] font-semibold tracking-tight">
          <Mark className="h-5 w-6" /> {BRAND}<sup className="text-[9px]">®</sup>
        </a>
        <nav className="flex items-center gap-2">
          <button data-beep onClick={sound.toggle} aria-label="Toggle sound" className="grid h-8 w-8 place-items-center rounded-full bg-white/10">
            {muted ? "🔇" : "🔊"}
          </button>
          <a data-beep href="#contact" className="pill bg-white text-black">Let&apos;s talk</a>
          <button data-beep onClick={() => setOpen(!open)} className="pill border border-white">
            {open ? "Close ✕" : "Menu ="}
          </button>
        </nav>
      </header>
      <div ref={menu} data-lenis-prevent style={{ clipPath: "inset(0 0 100% 0)" }} className="fixed inset-0 z-40 flex items-end bg-[#111] p-9 pb-16">
        <ul className="display text-[clamp(48px,9vw,140px)] text-bone">
          {["Work", "Studio", "Services", "Journal", "Contact"].map((l) => (
            <li key={l} className="overflow-hidden">
              <a data-beep href="#" onClick={() => setOpen(false)} className="block hover:text-[#ff5a1f]">{l}</a>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

/* ───────────────────────── Hero (banner + about + marquee over one sticky WebGL canvas) ───────────────────────── */
function Hero() {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useGSAP(() => {
    const scene = heroScene(canvas.current!, (i) => sound.beep(520 + i * 140), sound.blast);
    ScrollTrigger.create({ trigger: root.current, start: "top top", end: "bottom bottom", onUpdate: (s) => scene.setScroll(s.progress) });

    // Headline: blurred letters settle in, then blur again on hover.
    const h1 = new SplitText(".hero-h1", { type: "chars,lines" });
    gsap.from(h1.chars, { opacity: 0, filter: "blur(14px)", yPercent: 30, stagger: 0.035, duration: 1.2, ease: "expo.out", delay: 0.3 });
    h1.chars.forEach((c) =>
      c.addEventListener("mouseenter", () => gsap.fromTo(c, { filter: "blur(6px)" }, { filter: "blur(0px)", duration: 0.9 })),
    );
    gsap.from(".hero-fade", { opacity: 0, y: 20, stagger: 0.1, duration: 1, delay: 1 });

    // About: words light up as you scroll through them.
    const about = new SplitText(".about-p", { type: "words" });
    gsap.fromTo(about.words, { opacity: 0.15 }, {
      opacity: 1, stagger: 0.05, ease: "none",
      scrollTrigger: { trigger: ".about-p", start: "top 75%", end: "bottom 40%", scrub: true },
    });
    // The glyph recedes behind the About copy, then returns for the marquee.
    gsap.timeline({ scrollTrigger: { trigger: ".about-p", start: "top bottom", end: () => `+=${innerHeight * 2}`, scrub: true } })
      .to(canvas.current, { opacity: 0.12, ease: "none" })
      .to(canvas.current, { opacity: 1, ease: "none" });
    gsap.from(".about-rule", { scaleX: 0, transformOrigin: "left", duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: ".about-rule", start: "top 85%" } });

    // Marquee: pinned while the words travel left.
    gsap.to(".marquee-track", {
      xPercent: -55, ease: "none",
      scrollTrigger: { trigger: ".marquee", start: "top top", end: "+=180%", pin: true, scrub: 1 },
    });
    return () => scene.dispose();
  }, { scope: root });

  return (
    <div ref={root} className="relative bg-ink">
      <div className="absolute inset-0">
        <canvas ref={canvas} className="sticky top-0 block h-dvh w-full cursor-crosshair" />
      </div>

      <section className="pointer-events-none relative flex min-h-dvh flex-col px-5 pt-28 pb-12 md:px-9 lg:pt-32">
        <h1 className="hero-h1 display pointer-events-auto text-[clamp(52px,7.4vw,118px)] text-[#d8d8d8]">
          Built to be<br />remembered.
        </h1>
        <div className="hero-fade pointer-events-auto mt-10 flex flex-wrap gap-5 text-bone">
          <a data-beep href="#contact" className="cta">Start a project</a>
          <a data-beep href="#contact" className="cta">Book an intro call</a>
        </div>
        <div className="mt-auto flex items-end justify-between gap-6">
          <span className="hero-fade grid h-5 w-5 place-items-center rounded-full border border-white/40 text-[10px]">↓</span>
          <p className="hero-fade hidden text-center text-[13px] leading-snug uppercase md:block">
            Press &amp; hold to <span className="text-[#ff5a1f]">✸</span> shatter<br />
            Sweep <span className="text-[#ff5a1f]">⚡</span> across the orbits
          </p>
          <div className="hero-fade w-60 text-[15px] leading-tight">
            <div className="mb-4 grid grid-cols-[90px_1fr] border border-white/15 text-[11px] uppercase">
              <div className="border-r border-white/15 p-3 text-center">◎<br />Since 2015</div>
              <div className="p-3">Ten years of shipping digital products.</div>
            </div>
            Brands, sites and products built to stay useful long after launch.
          </div>
        </div>
      </section>

      <section className="relative flex min-h-dvh flex-col justify-center px-5 py-24 md:px-9">
        <span className="absolute top-24 left-5 text-sm uppercase md:left-9">Studio</span>
        <p className="about-p display mx-auto max-w-[1180px] text-[clamp(34px,5.2vw,80px)] text-[#d8d8d8]">
          <span className="inline-block w-[0.9em] md:w-[1.8em]" />Arcline is a small senior studio shaping brands, websites and products for teams that sweat the details.
        </p>
        <div className="about-rule relative mx-auto mt-20 h-px w-full max-w-[1180px] bg-white/15"><Plus className="-top-3 right-1/4" /></div>
        <div className="mx-auto mt-20 grid w-full max-w-[1180px] gap-10 md:grid-cols-2">
          <p className="text-sm uppercase leading-tight">Fewer features.<br />Better decisions.<br />Nothing ornamental.</p>
          <div className="md:justify-self-end md:max-w-sm">
            <p className="text-lg leading-snug">We pair strategy with hands-on craft so every screen earns its place and every interaction feels obvious.</p>
            <a data-beep href="#" className="cta mt-14">Our approach</a>
          </div>
        </div>
      </section>

      <section className="marquee relative flex h-dvh flex-col justify-center overflow-hidden">
        <p className="absolute top-32 left-5 text-sm uppercase leading-tight md:left-[10%]">Sharp ideas.<br />Careful hands.</p>
        <div className="marquee-track display flex items-center gap-16 whitespace-nowrap pl-[5vw] text-[clamp(70px,10vw,150px)] text-[#d8d8d8]">
          {["CRAFT", "CLARITY", "MOMENTUM", "PRECISION", "RESTRAINT"].map((w) => (
            <span key={w} className="flex items-center gap-16"><span className="text-5xl font-thin opacity-60">+</span>{w}</span>
          ))}
        </div>
        <p className="absolute bottom-24 w-full text-center text-sm uppercase">✦ Sketch to ship.</p>
      </section>
    </div>
  );
}

/* ───────────────────────── Key facts ───────────────────────── */
function Counter({ to, suffix = "+", className = "" }: { to: number; suffix?: string; className?: string }) {
  const el = useRef<HTMLSpanElement>(null);
  useGSAP(() => {
    const o = { v: 0 };
    gsap.to(o, {
      v: to, duration: 2, ease: "power3.out",
      scrollTrigger: { trigger: el.current, start: "top 85%" },
      onUpdate: () => {
        el.current!.textContent = to >= 1000 ? `${(o.v / 1000).toFixed(1)}K` : `${Math.round(o.v)}`;
      },
    });
  });
  return <span className={className}><span ref={el}>0</span><sup className="text-[0.45em]">{suffix}</sup></span>;
}

function KeyFacts() {
  const root = useRef<HTMLElement>(null);
  useGSAP(() => {
    gsap.from(".fact", { y: 80, opacity: 0, stagger: 0.12, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: ".fact", start: "top 85%" } });
  }, { scope: root });
  return (
    <section ref={root} className="relative z-10 bg-[linear-gradient(0deg,#fff_0%,#d2d2d2_100%)] px-5 pt-24 pb-40 text-[#2a2a2a] md:px-9">
      <h2 className="display text-center text-[clamp(48px,6vw,88px)]">By the numbers</h2>
      <p className="mx-auto mt-4 max-w-[14rem] text-center text-[15px]">A quick look at the work so far.</p>
      <div className="mx-auto mt-16 grid max-w-[1110px] gap-5 md:grid-cols-3">
        <div className="fact relative h-[440px] overflow-hidden rounded-md bg-[#3a3a3e] p-9 text-white">
          <div className="blob absolute top-16 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full opacity-70" />
          <p className="relative text-sm uppercase">Recognitions</p>
          <div className="absolute inset-x-9 bottom-9 flex items-end justify-between">
            <p className="max-w-40 text-[15px] leading-tight">Featured across leading design showcases.</p>
            <Counter to={40} className="display text-5xl" />
          </div>
        </div>
        <div className="fact relative flex h-[440px] flex-col items-center justify-between rounded-md bg-[#e8e5e2] p-9">
          <p className="text-sm uppercase">Projects shipped</p>
          <div className="grid h-44 w-44 place-items-center rounded-full bg-white">
            <Counter to={900} className="display text-5xl" />
          </div>
          <p className="max-w-[13rem] text-center text-[15px] leading-tight">Most clients come back for round two.</p>
        </div>
        <div className="fact relative h-[440px] overflow-hidden rounded-md bg-[#2b2d30] p-9 text-white">
          <p className="text-right text-sm uppercase">The team</p>
          <div className="mt-8 h-56 overflow-hidden rounded-sm bg-[repeating-linear-gradient(90deg,#3a3d42_0_14px,#2b2d30_14px_28px)]">
            <div className="h-full w-full bg-[radial-gradient(circle_at_50%_40%,#c9b79c_0_18%,transparent_19%),radial-gradient(ellipse_at_50%_95%,#1c1d20_0_40%,transparent_41%)]" />
          </div>
          <div className="absolute inset-x-9 bottom-9 flex items-end justify-between">
            <p className="text-[15px] leading-tight text-white/70">Many skills.<br />One bar.</p>
            <Counter to={18} className="display text-5xl" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Logos + selected work ───────────────────────── */
const PROJECTS = [
  { name: "Northwind Ledger", desc: "Finance workspace for fast-moving teams.", bg: "linear-gradient(160deg,#cfd8e0,#7f8fa0 55%,#b55a2b)", tag: "Money, minus the noise." },
  { name: "Kiln Ceramics", desc: "Commerce and identity for a pottery collective.", bg: "linear-gradient(200deg,#efe3d3,#c9764a)", tag: "Fired by hand." },
  { name: "Meridian Health", desc: "Patient app with calm, legible flows.", bg: "linear-gradient(170deg,#dfeee8,#4f8f7a)", tag: "Care, in plain words." },
  { name: "Octavo Audio", desc: "Launch site for a modular speaker line.", bg: "linear-gradient(140deg,#111,#3b3b3b 60%,#ff5a1f)", tag: "Hear the room." },
];

function Work() {
  const root = useRef<HTMLElement>(null);
  useGSAP(() => {
    gsap.utils.toArray<HTMLElement>(".proj").forEach((p) =>
      gsap.from(p, { y: 120, opacity: 0, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: p, start: "top 90%" } }),
    );
    const h = new SplitText(".work-h", { type: "chars" });
    gsap.from(h.chars, { filter: "blur(10px)", opacity: 0, stagger: 0.03, scrollTrigger: { trigger: ".work-h", start: "top 80%" } });
  }, { scope: root });
  return (
    <section ref={root} className="relative bg-[linear-gradient(180deg,#fff,#ececec)] text-[#2a2a2a]">
      <div className="flex flex-wrap justify-center gap-x-12 gap-y-4 border-b border-black/10 py-6 text-2xl text-[#555]">
        <span className="font-bold tracking-tight">northwind</span>
        <span className="font-mono">KILN</span>
        <span className="italic">Meridian</span>
        <span className="font-black tracking-widest">OCTAVO</span>
        <span className="display">pallas&amp;co</span>
      </div>
      <div className="relative mx-auto grid max-w-[1440px] md:grid-cols-2">
        <div className="absolute top-0 bottom-0 left-1/2 hidden w-px bg-black/10 md:block"><Plus className="-top-3 -left-[5px]" /></div>
        <div className="px-5 py-24 md:sticky md:top-0 md:flex md:h-dvh md:flex-col md:items-center md:justify-center">
          <h2 className="work-h display text-[clamp(48px,5.6vw,84px)]">Recent work<br />&amp; experiments</h2>
          <a data-beep href="#" className="cta mt-14">See all work</a>
        </div>
        <div className="flex flex-col gap-28 px-5 py-24 md:px-16">
          {PROJECTS.map((p) => (
            <article key={p.name} className="proj">
              <div className="relative grid aspect-[3/2] place-items-center overflow-hidden rounded-md" style={{ background: p.bg }}>
                <p className="display px-8 text-center text-[clamp(32px,4vw,64px)] text-white mix-blend-overlay">{p.tag}</p>
              </div>
              <h3 className="mt-6 text-3xl tracking-tight">{p.name}</h3>
              <div className="mt-2 flex items-end justify-between gap-6">
                <p className="max-w-xs text-[15px] leading-snug text-black/70">{p.desc}</p>
                <a data-beep href="#" className="cta min-w-0">View case</a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Services (pinned: words → letters orbit a rock → service cards) ───────────────────────── */
const SERVICES = ["STRATEGY", "INTERFACE", "ENGINEERING", "IDENTITY"];
const CARDS = [
  ["Interface Design", "Product flows that feel inevitable, from first tap to fifth year."],
  ["Identity", "Visual systems that stay recognisable at every size and speed."],
  ["Web Engineering", "Fast, accessible builds that editors enjoy using."],
  ["AI Products", "Useful assistants with honest UX around what models can't do."],
];

function Services() {
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  useGSAP(() => {
    const rock = rockScene(canvas.current!);
    const split = new SplitText(".svc-word", { type: "chars" });
    const tl = gsap.timeline({
      defaults: { ease: "power2.inOut" },
      scrollTrigger: {
        trigger: root.current, start: "top top", end: "+=650%", pin: true, scrub: 1,
        onUpdate: (s) => rock.setProgress(gsap.utils.clamp(0, 1, (s.progress - 0.28) / 0.72)),
      },
    });
    tl.from(".svc-word", { xPercent: 60, opacity: 0, stagger: 0.15, duration: 1 })
      .to(".svc-panel", { xPercent: -100, duration: 1 }, 0.4)
      .to(".svc-dark", { opacity: 1, duration: 0.8 }, 1.6)
      .to(".svc-ui", { color: "#e8e8e8", duration: 0.8 }, 1.6)
      .to(".svc-canvas", { opacity: 1, duration: 0.8 }, 1.8)
      // Letters break away and orbit the rock in 3D.
      .to(split.chars, {
        x: () => gsap.utils.random(-520, 520), y: () => gsap.utils.random(-300, 300), z: () => gsap.utils.random(-300, 400),
        rotationX: () => gsap.utils.random(-180, 180), rotationY: () => gsap.utils.random(-180, 180),
        color: "#f2f2f2", fontSize: "80px", stagger: { each: 0.01, from: "random" }, duration: 1.6,
      }, 1.9)
      .to(split.chars, { opacity: 0, scale: 0.2, z: -600, stagger: { each: 0.006, from: "random" }, duration: 0.8 }, 3.7)
      .from(".svc-card-a", { y: 120, opacity: 0, stagger: 0.2, duration: 0.8 }, 4.2)
      .to(".svc-card-a", { y: -120, opacity: 0, duration: 0.7 }, 5.6)
      .from(".svc-card-b", { y: 120, opacity: 0, stagger: 0.2, duration: 0.8 }, 6)
      .to({}, { duration: 0.6 });
    return () => rock.dispose();
  }, { scope: root });

  return (
    <section ref={root} className="relative h-dvh overflow-hidden bg-white text-[#2a2a2a]">
      <div className="svc-dark absolute inset-0 bg-[#060709] opacity-0" />
      <canvas ref={canvas} className="svc-canvas absolute inset-0 h-full w-full opacity-0" />
      <div className="svc-ui absolute inset-0 [perspective:900px]">
        <p className="absolute top-28 w-full text-center text-sm uppercase">What we do</p>
        <div className="display absolute inset-0 flex flex-col items-center justify-center text-[clamp(56px,9vw,132px)] leading-[0.86] [transform-style:preserve-3d]">
          {SERVICES.map((w) => <div key={w} className="svc-word [transform-style:preserve-3d]">{w}</div>)}
        </div>
        {[0, 1].map((g) => (
          <div key={g} className="pointer-events-none absolute inset-0 hidden md:block">
            {CARDS.slice(g * 2, g * 2 + 2).map(([t, d], i) => (
              <div key={t} className={`svc-card-${g ? "b" : "a"} absolute w-[38%] rounded-sm bg-white/[0.04] p-10 backdrop-blur-md ${i ? "right-12 bottom-[20%]" : "top-[24%] left-16"}`}>
                <h3 className="text-3xl leading-tight tracking-tight">{t}</h3>
                <p className="mt-24 max-w-xs text-[15px] leading-snug opacity-80">{d}</p>
              </div>
            ))}
          </div>
        ))}
        <div className="absolute inset-x-5 bottom-14 flex items-center justify-between md:inset-x-9">
          <span />
          <p className="text-sm uppercase">✦ Many disciplines. One standard.</p>
          <a data-beep href="#" className="cta pointer-events-auto">All services</a>
        </div>
      </div>
      <div className="svc-panel absolute inset-y-0 left-0 z-10 flex w-[45%] translate-x-0 flex-col items-center justify-center bg-[linear-gradient(180deg,#fafafa,#cfcfcf)] px-10 text-center">
        <p className="display max-w-md text-[clamp(24px,2.4vw,34px)] tracking-[-0.03em]">Browse the full archive of brands, sites and products we&apos;ve shipped.</p>
        <a data-beep href="#" className="cta mt-12">See all work</a>
      </div>
    </section>
  );
}

/* ───────────────────────── Testimonials ───────────────────────── */
const QUOTES = [
  ["Northwind", "They turned a sprawling brief into a product our customers actually understand. Calm, sharp and fast.", "Jordan Reyes", "Head of Product · Canada"],
  ["Kiln", "Every detail felt considered. Our sales doubled after the relaunch and the site still feels fresh.", "Ama Boateng", "Founder · Ghana"],
  ["Meridian", "The rare team that asks better questions than you do — and then ships on time.", "Lena Varga", "COO · Hungary"],
  ["Octavo", "Launch day went flawlessly. The motion work made the product feel twice as premium.", "Kenji Morita", "CMO · Japan"],
  ["Pallas&Co", "A long-term partner, not a vendor. Five years in, still our first call.", "Sofia Marin", "Director · Spain"],
];

function Testimonials() {
  const [i, setI] = useState(0);
  const quote = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const s = new SplitText(quote.current!.querySelector("p")!, { type: "lines", mask: "lines" });
    gsap.from(s.lines, { yPercent: 100, stagger: 0.08, duration: 0.9, ease: "expo.out" });
    return () => s.revert();
  }, [i]);
  const go = (d: number) => {
    sound.beep(660);
    setI((i + d + QUOTES.length) % QUOTES.length);
  };
  const [, text, who, role] = QUOTES[i];
  return (
    <section className="relative bg-[linear-gradient(0deg,#c3c3c3,#f2f2f2)] px-5 py-36 text-[#2a2a2a] md:px-9">
      <div className="mx-auto grid max-w-[1140px] gap-16 md:grid-cols-2">
        <div className="flex flex-col justify-between gap-16">
          <ul className="space-y-2 text-sm uppercase">
            {QUOTES.map(([c], k) => (
              <li key={c}>
                <button onClick={() => setI(k)} className={k === i ? "text-black" : "text-black/35 hover:text-black/70"}>{c}{k === i && "  →"}</button>
              </li>
            ))}
          </ul>
          <div className="flex">
            <button data-beep onClick={() => go(-1)} className="h-[72px] w-[72px] border border-black/15">←</button>
            <button data-beep onClick={() => go(1)} className="h-[72px] w-[72px] border border-l-0 border-black/15">→</button>
          </div>
        </div>
        <div ref={quote} key={i}>
          <p className="display text-[clamp(26px,2.5vw,36px)] leading-[1.1] tracking-[-0.03em]">{text}</p>
          <div className="mt-14 flex items-center gap-5">
            <div className="grid h-[72px] w-[72px] place-items-center rounded-sm bg-[#2a2a2a] text-lg text-white">{who.split(" ").map((w) => w[0]).join("")}</div>
            <div><p className="text-lg">{who}</p><p className="text-black/50">{role}</p></div>
          </div>
          <a data-beep href="#contact" className="cta mt-20">Work with us</a>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Design in motion (pinned: helix strip → 3×2 grid → dark stripes) ───────────────────────── */
function Motion() {
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const caption = useRef<HTMLParagraphElement>(null);
  useGSAP(() => {
    const ribbonVh = innerWidth < 768 ? 3 : 5;
    const totalVh = ribbonVh + 1.5;
    const share = ribbonVh / totalVh;
    const scene = motionScene(canvas.current!, root.current!, share);

    // Five dark bands rise from the bottom (bottom band first) to hand over to the footer.
    const bands = gsap.utils.toArray<HTMLElement>(".mo-band", root.current);
    const stripes = gsap.timeline({ paused: true, defaults: { ease: "none" } });
    bands.forEach((b, n) => stripes.to(b, { scaleY: 1, duration: 0.3 }, (0.3 * (bands.length - 1 - n)) / (bands.length - 1)));
    stripes.to({}, { duration: 0.1 });

    ScrollTrigger.create({
      trigger: root.current, start: "top top", end: () => `+=${innerHeight * totalVh}`,
      pin: true, anticipatePin: 1, invalidateOnRefresh: true,
      onUpdate: (s) => {
        const H = scene.setProgress(s.progress);
        caption.current!.style.opacity = String(Math.max(0, 1 - 4 * H));
        stripes.progress(gsap.utils.clamp(0, 1, (s.progress - share) / (1 - share)));
      },
    });

    // The two words cross the screen in opposite directions.
    gsap.timeline({
      scrollTrigger: { trigger: root.current, start: "top center", end: () => `+=${innerHeight * totalVh * share * 0.62 + innerHeight / 2}`, scrub: 0.6, invalidateOnRefresh: true },
    })
      .to(".mo-top", { x: "100vw", ease: "none" }, 0)
      .to(".mo-bottom", { x: "-100vw", ease: "none" }, 0);

    // Blur-in reveals.
    [".mo-top", ".mo-bottom"].forEach((sel) => {
      const sp = new SplitText(sel, { type: "chars" });
      gsap.from(sp.chars, { opacity: 0, filter: "blur(10px)", stagger: 0.05, duration: 0.8, scrollTrigger: { trigger: root.current, start: "top 70%" } });
    });
    const cap = new SplitText(caption.current!, { type: "words" });
    gsap.from(cap.words, { opacity: 0, filter: "blur(8px)", stagger: 0.05, duration: 0.8, scrollTrigger: { trigger: root.current, start: "top 60%" } });
    gsap.from(".mo-foot", { opacity: 0, y: 30, duration: 1, scrollTrigger: { trigger: root.current, start: "top bottom" } });
    return () => scene.dispose();
  }, { scope: root });

  return (
    <section ref={root} className="relative z-10 h-dvh overflow-hidden bg-[#c3c3c3] px-5 pt-24 pb-20 text-[#2f2f2f] md:px-9 lg:py-20">
      <canvas ref={canvas} className="pointer-events-none absolute inset-0 z-[1] h-full w-full" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 w-full -translate-x-1/2 -translate-y-1/2 select-none whitespace-nowrap">
        <div className="flex w-full flex-col">
          <h2 className="mo-top display relative self-start -translate-x-full text-[clamp(80px,11.5vw,180px)] leading-[0.8] uppercase">Design in</h2>
          <p ref={caption} className="relative mx-auto my-3 text-center text-sm uppercase leading-tight">Ideas explored in<br />small daily studies.</p>
          <h2 className="mo-bottom display relative self-end translate-x-full text-[clamp(80px,11.5vw,180px)] leading-[0.8] uppercase">Motion</h2>
        </div>
      </div>
      <div className="mo-foot relative z-[5] flex h-full w-full flex-col items-center justify-end gap-10 md:flex-row md:items-end md:justify-between">
        <p className="text-center text-[16px] leading-snug md:text-left">Sketches, prototypes and interface<br />experiments, shared as we<br />make them.</p>
        <a data-beep href="#" className="cta">See the archive</a>
      </div>
      <div className="pointer-events-none absolute inset-0 z-30 flex flex-col">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="mo-band flex-1 origin-bottom scale-y-0 bg-[#040508]" style={{ marginTop: i ? -1 : 0 }} />
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── Footer ───────────────────────── */
function Footer() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [time, setTime] = useState("");
  useEffect(() => {
    const t = () => setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }));
    t();
    const id = setInterval(t, 10_000);
    const dispose = lineWordmark(canvas.current!, BRAND, (row) => sound.beep(300 + (row % 12) * 60, 0.05, 0.03));
    return () => { clearInterval(id); dispose(); };
  }, []);
  return (
    <footer id="contact" className="relative z-20 -mt-[100dvh] flex min-h-dvh flex-col overflow-hidden bg-[#040508] px-5 pt-28 pb-6 text-[#e5e5e5] md:px-9">
      <div className="smoke pointer-events-none absolute -inset-20 opacity-80" />
      <div className="relative flex justify-between text-sm uppercase">
        <p>Let&apos;s make something that lasts.</p>
        <p className="text-white/50">Local → {time}</p>
      </div>
      <div className="relative mt-6 grid gap-12 md:grid-cols-[1fr_auto]">
        <h2 className="display text-[clamp(48px,6.4vw,100px)]">Have an idea worth<br />building?</h2>
        <div className="flex flex-col gap-6 md:pt-14">
          <a data-beep href="#" className="cta">Start a project</a>
          <a data-beep href="#" className="cta">Book an intro call</a>
        </div>
      </div>
      <div className="relative mt-16 grid gap-10 text-[15px] md:grid-cols-[1fr_auto_auto] md:gap-24">
        <div className="space-y-12 uppercase text-sm">
          <p className="text-white/50">©{BRAND}® 2026</p>
          <p>Sound on ♪ sweep the lines.</p>
        </div>
        <div>
          <p className="mb-5 text-sm uppercase text-white/50">New business</p>
          <p><span className="text-white/40">E.</span> hello@arcline.example</p>
          <p><span className="text-white/40">P.</span> +00 000 000 000</p>
        </div>
        <div>
          <p className="mb-5 text-sm uppercase text-white/50">Social</p>
          <div className="grid grid-cols-2 gap-x-14 gap-y-1"><a href="#">LinkedIn</a><a href="#">Behance</a><a href="#">Dribbble</a><a href="#">Instagram</a></div>
        </div>
      </div>
      <canvas ref={canvas} className="relative mt-auto block h-[38vh] w-full cursor-crosshair" />
    </footer>
  );
}

/* ───────────────────────── Page ───────────────────────── */
export default function Home() {
  useEffect(() => {
    history.scrollRestoration = "manual";
    const lenis = new Lenis({ lerp: 0.09 });
    (window as unknown as { lenis: Lenis }).lenis = lenis; // handy for debugging / screenshot scripts
    lenis.on("scroll", ScrollTrigger.update);
    const raf = (t: number) => lenis.raf(t * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    // Hover blip on anything marked data-beep.
    const over = (e: MouseEvent) => (e.target as HTMLElement).closest?.("[data-beep]") && sound.beep(1200, 0.04, 0.02);
    document.addEventListener("mouseover", over);
    document.fonts.ready.then(() => ScrollTrigger.refresh());
    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
      document.removeEventListener("mouseover", over);
    };
  }, []);

  return (
    <>
      <Header />
      <main>
        <Hero />
        <KeyFacts />
        <Work />
        <Services />
        <Testimonials />
        <Motion />
      </main>
      <Footer />
    </>
  );
}
