"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { Draggable } from "gsap/Draggable";
import { useGSAP } from "@gsap/react";
import Lenis from "lenis";
import { feature } from "topojson-client";
import { sound } from "../sound";
import { motionScene } from "../scenes";
import { createSwarm, formEarth, formIcon, formLogo, formNebula, formWave } from "./swarm";
import { dotWordmark } from "./dotmark";

/** Preview flag: /?bee=dots draws the hero bee as a dot field (like the footer) instead of the swarm. */
import { LOGO_SVG } from "./logoData";

gsap.registerPlugin(ScrollTrigger, SplitText, Draggable, useGSAP);

const PHONE = "+92 307 588 0888";
const TEL = "tel:+923075880888";
const WA = "https://wa.me/923075880888";
const SITE = "https://beecreative.pk";

/* Swarm formation indices, in journey order. */
const F = {
  logo: 0, nebula: 1, emblem: 2, shopify: 3, code: 4, pen: 5, chart: 6, emblemEnd: 7,
  g0: 8, g1: 9, g2: 10, g3: 11, wave: 12, earth: 13, scatter: 14, plane: 15,
};

/* ───────────────────────── helpers ───────────────────────── */
function Arrow() {
  return <span className="arr"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 10 10 2M4 2h6v6" /></svg></span>;
}

function Panel({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`hud-panel relative rounded-[18px] border border-white/10 bg-white/[0.035] backdrop-blur-xl ${className}`}>{children}</div>;
}

/** Official Shopify Select Partner badge (white artwork). */
function PartnerBadge({ className = "" }: { className?: string }) {
  return <img loading="lazy" decoding="async" src="/bee/partner.svg" alt="Shopify Select Partner" className={className} />;
}

/** fitWords now, and again once web fonts have loaded (widths change). */
function fitSoon(el: HTMLElement | null, min = 18) {
  fitWords(el, min);
  document.fonts?.ready.then(() => fitWords(el, min));
}

/** Shrink a heading until no single word is wider than its box (words never break mid-way). */
function fitWords(el: HTMLElement | null, min = 18) {
  if (!el) return;
  el.style.fontSize = "";
  let s = parseFloat(getComputedStyle(el).fontSize);
  while (s > min && el.scrollWidth > el.clientWidth + 1) el.style.fontSize = `${(s -= 2)}px`;
}

/** Size a short heading so it sits on exactly one line, as large as the box allows. */
function fitLine(el: HTMLElement | null, max = 140, min = 20) {
  if (!el) return;
  el.style.whiteSpace = "nowrap";
  let s = max;
  el.style.fontSize = `${s}px`;
  while (s > min && el.scrollWidth > el.clientWidth + 1) el.style.fontSize = `${(s -= 2)}px`;
}

const GLYPHS = "!<>-_\\/[]{}—=+*^?#ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const running = new WeakMap<HTMLElement, gsap.core.Tween>();
function scramble(el: HTMLElement) {
  running.get(el)?.kill();
  const final = el.dataset.final ?? (el.dataset.final = el.textContent ?? "");
  const o = { p: 0 };
  running.set(el, gsap.to(o, {
    p: 1, duration: 0.9, ease: "none",
    onUpdate: () => {
      el.textContent = final.split("").map((ch, i) => (ch === " " || i / final.length < o.p ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join("");
    },
    onComplete: () => void (el.textContent = final),
  }));
}

/** World-space x for "right side" content so shapes sit at ~76% of the screen width at any aspect. */
const sideX = () => {
  const halfH = Math.tan(THREE.MathUtils.degToRad(20)) * 14;
  return halfH * (innerWidth / innerHeight) * 0.52;
};

/** Equirectangular land mask from Natural Earth (world-atlas). */
function landMask(landTopo: unknown, W = 720, H = 360) {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  const topo = landTopo as unknown as { objects: { land: unknown } };
  const fc = feature(topo as never, topo.objects.land as never) as unknown as { features: { geometry: { type: string; coordinates: number[][][] | number[][][][] } }[] };
  const polys: number[][][][] = [];
  fc.features.forEach((f) => (f.geometry.type === "Polygon" ? polys.push(f.geometry.coordinates as number[][][]) : polys.push(...(f.geometry.coordinates as number[][][][]))));
  for (const poly of polys) {
    g.beginPath();
    for (const ringPts of poly) {
      let px = 0;
      ringPts.forEach(([lon, lat], i) => {
        const x = ((lon + 180) / 360) * W, y = ((90 - lat) / 180) * H;
        if (i === 0 || Math.abs(x - px) > W / 2) g.moveTo(x, y);
        else g.lineTo(x, y);
        px = x;
      });
    }
    g.fill("evenodd");
  }
  return g.getImageData(0, 0, W, H);
}

/* ───────────────────────── HUD frame ───────────────────────── */
function Hud() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const t = () => setTime(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Karachi" }));
    t();
    const id = setInterval(t, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="pointer-events-none fixed inset-3 z-30 hidden md:block" aria-hidden>
      {["top-0 left-0 border-t border-l", "top-0 right-0 border-t border-r", "bottom-0 left-0 border-b border-l", "bottom-0 right-0 border-b border-r"].map((c) => (
        <span key={c} className={`absolute h-5 w-5 border-[var(--honey)]/60 ${c}`} />
      ))}
      <p className="jet absolute top-1/2 left-1 origin-left -translate-y-1/2 -rotate-90 whitespace-nowrap text-[10px] uppercase tracking-[0.3em] text-white/35">
        Bee Creative · Karachi, PK · {time}
      </p>
      <p className="jet absolute bottom-2 left-8 text-[10px] uppercase tracking-[0.25em] text-white/45"><span className="hud-section text-[var(--honey)]">Home</span></p>
      <p className="jet absolute right-8 bottom-2 text-[10px] uppercase tracking-[0.25em] text-white/45">Scroll <span className="hud-pct text-[var(--honey)]">000</span>%</p>
    </div>
  );
}

/* ───────────────────────── Header (menu exactly centred) ───────────────────────── */
function Header() {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    if (!menu.current) return;
    if (open) {
      gsap.set(menu.current, { display: "flex" });
      gsap.fromTo(menu.current, { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 0.8, ease: "expo.inOut" });
      gsap.from(menu.current.querySelectorAll(".mi"), { yPercent: 120, stagger: 0.06, duration: 0.8, ease: "expo.out", delay: 0.3 });
    } else gsap.to(menu.current, { clipPath: "inset(0 0 100% 0)", duration: 0.6, ease: "expo.inOut", onComplete: () => void gsap.set(menu.current, { display: "none" }) });
  }, [open]);
  const links: [string, string][] = [["Mission", "#mission"], ["Capabilities", "#capabilities"], ["Work", "#work"], ["Trust", "#trust"], ["Launch", "#launch"]];
  const glass = "rounded-full border border-white/10 bg-[#0a0a08]/60 backdrop-blur-xl";
  return (
    <>
      <header className="bee-header fixed inset-x-0 top-0 z-50 flex items-center justify-between px-5 py-5 transition-transform duration-500 md:px-10 md:py-7">
        <a href="#top" aria-label="Bee Creative home" className="relative z-10 block">
          <img src="/bee/logo.svg" alt="Bee Creative" className="h-9 w-auto md:h-10" />
        </a>
        <nav className={`${glass} absolute top-1/2 left-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-1 p-1.5 lg:flex`}>
          {links.map(([l, h]) => (
            <a key={l} data-beep href={h} className="whitespace-nowrap rounded-full px-4 py-2 text-[13px] text-[var(--wax)]/75 transition hover:bg-white/10 hover:text-[var(--wax)]">
              {l}
            </a>
          ))}
        </nav>
        <div className="relative z-10 flex items-center gap-2">
          <a data-beep href="#launch" className="bee-pill pill-honey hidden !py-2.5 !pr-2 sm:inline-flex">Start a project <Arrow /></a>
          <button data-beep onClick={() => setOpen(!open)} className={`${glass} h-11 px-5 text-[13px] lg:hidden`}>{open ? "Close" : "Menu"}</button>
        </div>
      </header>
      <div ref={menu} data-lenis-prevent className="fixed inset-0 z-40 hidden flex-col justify-end bg-[#0a0a08] p-6 pb-14">
        {links.map(([l, h]) => (
          <div key={l} className="overflow-hidden">
            <a href={h} onClick={() => setOpen(false)} className="mi syne block text-[11vw] font-extrabold uppercase leading-[1.05] text-[var(--wax)]">
              {l}
            </a>
          </div>
        ))}
        <a href={TEL} className="jet mt-8 text-sm text-[var(--honey)]">{PHONE}</a>
      </div>
    </>
  );
}

/* ───────────────────────── Hero ───────────────────────── */
/**
 * The site's cursor (pointer devices only). Over the swarm it is a "press & hold" disc whose ring fills as the
 * swarm charges, then it bursts; over links and buttons it opens into a ring; elsewhere it is a small honey dot.
 */
const HOLD = "PRESS & HOLD · PRESS & HOLD · ", RELEASE = "RELEASE · RELEASE · RELEASE · ";
function Cursor() {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!matchMedia("(pointer: fine)").matches) return;
    const root = document.documentElement, c = el.current!;
    const disc = c.querySelector<HTMLElement>(".cur-disc")!, dot = c.querySelector<HTMLElement>(".cur-dot")!;
    const ring = c.querySelector(".cur-ring")!, label = c.querySelector("textPath")!;
    root.classList.add("custom-cursor");
    const x = gsap.quickTo(c, "x", { duration: 0.3, ease: "power3" }), y = gsap.quickTo(c, "y", { duration: 0.3, ease: "power3" });
    let mode = "", px = -1, py = -1, charge: gsap.core.Tween | null = null;
    const setMode = (m: "hold" | "link" | "dot" | "off") => {
      if (m === mode) return;
      mode = m;
      gsap.to(c, { autoAlpha: m === "off" ? 0 : 1, duration: 0.25, overwrite: "auto" });
      gsap.to(disc, { autoAlpha: m === "hold" ? 1 : 0, scale: m === "hold" ? 1 : 0.4, duration: 0.35, ease: "power3.out", overwrite: "auto" });
      gsap.to(dot, { autoAlpha: m === "hold" ? 0 : 1, width: m === "link" ? 44 : 10, height: m === "link" ? 44 : 10,
        backgroundColor: m === "link" ? "rgba(254,225,44,0)" : "rgba(254,225,44,1)", duration: 0.3, ease: "power3.out", overwrite: "auto" });
    };
    const check = () => {
      const t = document.elementFromPoint(px, py);
      if (!t) return setMode("off");
      if (t.closest("a,button,label,select,[role=button]")) return setMode("link");
      if (t.closest("input,textarea")) return setMode("off"); // the I-beam takes over in text fields
      setMode(root.hasAttribute("data-swarm-hidden") ? "dot" : "hold");
    };
    const move = (e: PointerEvent) => { px = e.clientX; py = e.clientY; x(px); y(py); check(); };
    const leave = () => setMode("off");
    const down = () => {
      if (mode !== "hold") return;
      gsap.to(disc, { scale: 0.88, duration: 0.38, ease: "power2.out", overwrite: "auto" });
      charge = gsap.fromTo(ring, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.38, ease: "none", onComplete: () => {
        label.textContent = RELEASE;
        gsap.to(disc, { scale: 1.22, duration: 0.5, ease: "back.out(3)", overwrite: "auto" });
      } });
    };
    const up = () => {
      charge?.kill();
      gsap.to(ring, { strokeDashoffset: 1, duration: 0.3 });
      label.textContent = HOLD;
      if (mode === "hold") gsap.to(disc, { scale: 1, duration: 0.4, ease: "power3.out", overwrite: "auto" });
    };
    addEventListener("pointermove", move);
    addEventListener("pointerdown", down);
    addEventListener("pointerup", up);
    addEventListener("scroll", check, { passive: true });
    document.addEventListener("mouseleave", leave);
    return () => {
      removeEventListener("pointermove", move);
      removeEventListener("pointerdown", down);
      removeEventListener("pointerup", up);
      removeEventListener("scroll", check);
      document.removeEventListener("mouseleave", leave);
      root.classList.remove("custom-cursor");
    };
  }, []);
  return (
    <div ref={el} aria-hidden style={{ visibility: "hidden", opacity: 0 }} className="pointer-events-none fixed top-0 left-0 z-[100] hidden md:block">
      <div className="cur-dot absolute top-0 left-0 h-[10px] w-[10px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-[var(--honey)] bg-[var(--honey)] shadow-[0_0_0_1px_rgba(10,10,8,0.45)]" />
      <div className="cur-disc absolute top-0 left-0 -mt-10 -ml-10 h-20 w-20" style={{ visibility: "hidden", opacity: 0 }}>
        <div className="h-full w-full rounded-full border border-[var(--honey)]/25 bg-[#0a0a08]/60 backdrop-blur-md" />
        <svg viewBox="0 0 100 100" className="absolute inset-0">
          <defs><path id="cur-text-path" d="M50 50 m-35 0 a35 35 0 1 1 70 0 a35 35 0 1 1 -70 0" /></defs>
          {/* the words run round the disc and turn slowly */}
          <g style={{ transformOrigin: "50px 50px", animation: "cur-spin 14s linear infinite" }}>
            <text fill="#fee12c" fontSize="10.5" fontWeight="500" style={{ fontFamily: "var(--font-dm), sans-serif" }}>
              <textPath href="#cur-text-path" textLength="216" lengthAdjust="spacing">{HOLD}</textPath>
            </text>
          </g>
          <circle cx="50" cy="50" r="3.5" fill="#fee12c" />
          <circle className="cur-ring" cx="50" cy="50" r="48.5" fill="none" stroke="#fee12c" strokeWidth="2" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1} transform="rotate(-90 50 50)" />
        </svg>
      </div>
    </div>
  );
}

function Hero() {
  const root = useRef<HTMLElement>(null);
  useGSAP(() => {
    fitWords(root.current!.querySelector(".hero-h1"));
    const h1 = new SplitText(".hero-h1", { type: "lines", mask: "lines" });
    gsap.from(h1.lines, { yPercent: 110, stagger: 0.12, duration: 1.5, ease: "expo.out", delay: 0.3 });
    gsap.from(".hero-in", { opacity: 0, y: 24, stagger: 0.08, duration: 1, ease: "expo.out", delay: 0.8 });
    gsap.utils.toArray<HTMLElement>(".hero-count", root.current).forEach((el) => {
      const o = { v: 0 };
      gsap.to(o, { v: Number(el.dataset.to), duration: 2, delay: 1.1, ease: "power3.out", onUpdate: () => void (el.textContent = String(Math.round(o.v))) });
    });
    gsap.to(".hero-copy", { yPercent: -25, opacity: 0, ease: "none", scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true } });
  }, { scope: root });
  const stats: [number, string, string][] = [[350, "+", "Stores launched"], [100, "%", "Job success"], [40, "+", "5-star reviews"]];
  return (
    <section ref={root} id="top" data-label="Home" className="relative flex min-h-dvh flex-col justify-end px-5 pt-32 pb-10 md:px-10">
      <div className="hero-copy relative md:max-w-[54vw]">
        <h1 className="hero-h1 syne text-[clamp(40px,5.4vw,100px)] font-extrabold uppercase leading-[0.94]">
          Redefining<br /><span className="text-[var(--honey)]">digital</span><br />commerce
        </h1>
        <div className="mt-8 flex flex-wrap items-end gap-x-10 gap-y-6">
          <p className="hero-in max-w-[30rem] text-[16px] leading-relaxed text-[var(--wax)]/70">
            Shopify Select Partner: Crafting High-Performance Stores for Global Brands. Scale Your Vision with Custom Liquid Excellence.
          </p>
          <div className="hero-in flex flex-wrap gap-2">
            <a data-beep href="#launch" className="bee-pill pill-honey !pr-2">Contact us <Arrow /></a>
            <a data-beep href="#work" className="bee-pill pill-ghost !pr-2 text-[var(--wax)]">See the work <Arrow /></a>
          </div>
        </div>
      </div>
      <div className="hero-in relative mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-white/10 bg-white/10 md:grid-cols-4">
        {stats.map(([v, suf, l]) => (
          <div key={l} className="bg-[#0a0a08]/80 px-5 py-4 backdrop-blur">
            <p className="syne text-2xl font-bold"><span className="hero-count" data-to={v}>0</span>{suf}</p>
            <p className="jet mt-1 text-[10px] uppercase tracking-[0.15em] text-white/45">{l}</p>
          </div>
        ))}
        <div className="flex items-center bg-[#0a0a08]/80 px-5 py-3 backdrop-blur">
          <PartnerBadge className="h-11 w-auto" />
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── 01 Mission ───────────────────────── */
function Mission() {
  const root = useRef<HTMLElement>(null);
  useGSAP(() => {
    const words = new SplitText(".ms-p", { type: "words" }).words;
    gsap.fromTo(words, { opacity: 0.12, filter: "blur(6px)" }, { opacity: 1, filter: "blur(0px)", stagger: 0.04, ease: "none", scrollTrigger: { trigger: ".ms-p", start: "top 78%", end: "bottom 45%", scrub: true } });
    gsap.utils.toArray<HTMLElement>(".ms-mark", root.current).forEach((m) =>
      gsap.fromTo(m, { backgroundSize: "0% 100%" }, { backgroundSize: "100% 100%", ease: "none", scrollTrigger: { trigger: m, start: "top 72%", end: "top 48%", scrub: true } }),
    );
  }, { scope: root });
  const mark = "ms-mark bg-[linear-gradient(var(--honey),var(--honey))] bg-no-repeat px-[0.12em] text-[#0a0a08]";
  return (
    <section ref={root} id="mission" data-form={F.nebula} data-label="Mission" className="relative px-5 py-[22vh] md:px-10">
      <p className="ms-p syne max-w-[20ch] text-[clamp(32px,5vw,86px)] font-bold leading-[1.04]">
        We build <span className={mark}>high-performance</span> Shopify stores and brands that don&apos;t just look better — they <span className={mark}>perform</span> better.
      </p>
      <Principles />
    </section>
  );
}

/* ── Mission principles: three live modules ── */
const CODE_LINES: [string, string][][] = [
  [["{% ", "t"], ["for", "k"], [" product ", "t"], ["in", "k"], [" collection.products ", "v"], ["%}", "t"]],
  [["  {% ", "t"], ["render", "k"], [" 'product-card'", "s"], [", product: product ", "v"], ["%}", "t"]],
  [["{% ", "t"], ["endfor", "k"], [" %}", "t"]],
];
const TONE: Record<string, string> = { t: "text-white/45", k: "text-[var(--honey)]", v: "text-[var(--wax)]", s: "text-[#9fd3a8]" };

function Principles() {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const cards = gsap.utils.toArray<HTMLElement>(".pr-card", root.current);
    gsap.from(cards, { y: 90, rotateX: 18, opacity: 0, stagger: 0.14, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: root.current, start: "top 82%" } });
    // Cards lean towards the cursor.
    cards.forEach((c) => {
      const rx = gsap.quickTo(c, "rotateX", { duration: 0.6, ease: "power3" }), ry = gsap.quickTo(c, "rotateY", { duration: 0.6, ease: "power3" });
      c.addEventListener("pointermove", (e) => {
        const r = c.getBoundingClientRect();
        ry(((e.clientX - r.left) / r.width - 0.5) * 10);
        rx(-((e.clientY - r.top) / r.height - 0.5) * 10);
      });
      c.addEventListener("pointerleave", () => { rx(0); ry(0); });
    });
    const live = gsap.timeline({ repeat: -1, repeatDelay: 1.2, paused: true });
    // Code: lines type in, then hold and restart.
    live.fromTo(".pr-code-line", { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 0.9, stagger: 0.75, ease: "steps(28)" }, 0)
      .to(".pr-code-line", { opacity: 0.25, duration: 0.4 }, 4.2);
    // Design: the pen curve draws, handles pop, swatches drop in.
    live.fromTo(".pr-curve", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 2, ease: "power2.inOut" }, 0)
      .fromTo(".pr-handle", { scale: 0, transformOrigin: "50% 50%" }, { scale: 1, stagger: 0.15, duration: 0.5, ease: "back.out(2)" }, 0.6)
      .fromTo(".pr-swatch", { y: -14, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.12, duration: 0.6, ease: "expo.out" }, 1.4);
    // Perform: bars grow, the line climbs, a dot rides it.
    live.fromTo(".pr-bar", { scaleY: 0, transformOrigin: "50% 100%" }, { scaleY: 1, stagger: 0.08, duration: 0.8, ease: "expo.out" }, 0)
;
    // The growth line draws itself and the dot rides its tip — one value drives both.
    const line = root.current!.querySelector<SVGPathElement>(".pr-line"), dot = root.current!.querySelector<SVGCircleElement>(".pr-dot");
    if (line && dot) {
      const len = line.getTotalLength(), draw = { p: 0 };
      line.setAttribute("stroke-dasharray", String(len));
      const paint = () => {
        line.setAttribute("stroke-dashoffset", String(len * (1 - draw.p)));
        const pt = line.getPointAtLength(len * draw.p);
        dot.setAttribute("cx", String(pt.x));
        dot.setAttribute("cy", String(pt.y));
      };
      paint();
      live.fromTo(draw, { p: 0 }, { p: 1, duration: 2.2, ease: "power2.inOut", onUpdate: paint }, 0.3);
    }
    ScrollTrigger.create({ trigger: root.current, start: "top 85%", end: "bottom top", onToggle: (st) => (st.isActive ? live.play() : live.pause()) });
  }, { scope: root });

  const shell = "pr-card group relative flex flex-col overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.03] backdrop-blur-xl transition-colors duration-500 hover:border-[var(--honey)]/60 [transform-style:preserve-3d]";
  const screen = "relative m-3 mb-0 h-[200px] overflow-hidden rounded-[14px] border border-white/5 bg-[#0d0d0a]";
  const items = [
    { n: "01", t: "Clean code", d: "Custom Liquid that stays fast, readable and easy to grow.", tag: "theme.liquid" },
    { n: "02", t: "Stunning design", d: "Interfaces that make your brand impossible to scroll past.", tag: "brand.fig" },
    { n: "03", t: "Built to perform", d: "Every decision measured on conversion and revenue.", tag: "growth.live" },
  ];
  return (
    <div ref={root} className="mt-24 grid gap-5 [perspective:1200px] md:grid-cols-3">
      {items.map((it, i) => (
        <article key={it.n} className={shell}>
          <div className={screen}>
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
              <span className="flex gap-1.5">{[0, 1, 2].map((k) => <i key={k} className="h-2 w-2 rounded-full bg-white/15" />)}</span>
              <span className="jet text-[10px] text-white/40">{it.tag}</span>
            </div>
            {i === 0 && (
              <div className="code-mono space-y-2 px-4 pt-5 text-[12px] leading-relaxed">
                {CODE_LINES.map((line, k) => (
                  <div key={k} className="flex items-center gap-3">
                    <span className="w-4 text-right text-white/20">{k + 1}</span>
                    <span className="pr-code-line whitespace-pre">
                      {line.map(([txt, tone], j) => <span key={j} className={TONE[tone]}>{txt}</span>)}
                      {k === CODE_LINES.length - 1 && <span className="ml-0.5 inline-block h-3.5 w-[7px] translate-y-0.5 animate-pulse bg-[var(--honey)]" />}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {i === 1 && (
              <svg viewBox="0 0 200 150" className="absolute inset-x-0 bottom-0 h-[160px] w-full">
                <defs>
                  <pattern id="prgrid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="rgba(255,255,255,.05)" /></pattern>
                </defs>
                <rect width="200" height="150" fill="url(#prgrid)" />
                <path className="pr-curve" d="M20 120 C 50 20, 120 20, 110 75 S 170 130, 185 40" fill="none" stroke="#fee12c" strokeWidth="2.5" strokeLinecap="round" pathLength={1} strokeDasharray="1" />
                <g stroke="#fee12c" strokeWidth="1" fill="#0d0d0a">
                  <line x1="50" y1="20" x2="20" y2="120" strokeOpacity=".35" /><line x1="170" y1="130" x2="185" y2="40" strokeOpacity=".35" />
                  {[[20, 120], [110, 75], [185, 40], [50, 20], [170, 130]].map(([x, y], k) => <rect key={k} className="pr-handle" x={x - 3.5} y={y - 3.5} width="7" height="7" />)}
                </g>
                {["#fee12c", "#fbf6e3", "#0a0a08"].map((c, k) => <rect key={c} className="pr-swatch" x={14 + k * 22} y="12" width="16" height="16" rx="4" fill={c} stroke="rgba(255,255,255,.25)" />)}
              </svg>
            )}
            {i === 2 && (
              <svg viewBox="0 0 270 100" className="absolute inset-x-4 bottom-4 h-[140px] w-[calc(100%-32px)]">
                {[30, 42, 38, 55, 62, 70, 84].map((hgt, k) => <rect key={k} className="pr-bar" x={12 + k * 37} y={98 - hgt} width="20" height={hgt} rx="3" fill="rgba(254,225,44,.18)" />)}
                <path className="pr-line" d="M10 88 L 54 76 L 95 80 L 135 58 L 176 50 L 216 32 L 258 12" fill="none" stroke="#fee12c" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                <circle className="pr-dot" cx="10" cy="88" r="4.5" fill="#fff" />
              </svg>
            )}
          </div>
          <div className="flex flex-1 flex-col p-7 pt-6">
            <p className="jet text-[11px] text-[var(--honey)]">P/{it.n}</p>
            <h3 className="syne mt-3 text-[28px] font-bold leading-tight">{it.t}</h3>
            <p className="mt-2 text-[var(--wax)]/60">{it.d}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

/* ───────────────────────── 02 Capabilities (pinned) ─────────────────────────
   Words stack huge → letters burst into particles as the swarm condenses into the emblem →
   four service cards lock in around it, the emblem morphing into each card's icon. */
const SERVICES = [
  { t: "Shopify Development", short: "Shopify", d: "Custom themes, migrations and Shopify Plus.", tags: ["Custom Liquid", "Migrations", "Shopify Plus"], href: `${SITE}/shopify-development-services` },
  { t: "Web Design & Development", short: "Web design", d: "Fast, responsive sites built to convert.", tags: ["UI/UX", "Responsive", "Performance"], href: `${SITE}/website-design-and-development` },
  { t: "Graphic Design & Branding", short: "Branding", d: "Logos, identity systems and social assets.", tags: ["Logos", "Identity", "Social"], href: `${SITE}/graphic-design-services` },
  { t: "Digital Marketing & SEO", short: "Marketing", d: "Search, paid & social measured on revenue.", tags: ["SEO", "Paid ads", "Reporting"], href: `${SITE}/digital-marketing-services` },
];
const ICONS = [
  <path key="s" d="M6 12h20l1.5 16h-23zM11 12a5 5 0 0 1 10 0M19.5 17.5c-1-1.2-2.4-1.6-3.6-1.4-1.6.3-2.2 1.9-1 2.8 1.3 1 3.9 1.2 4 3.1.1 1.6-1.9 2.6-3.8 2.1a4 4 0 0 1-2.3-1.6" />,
  <path key="c" d="M3 7h26v18H3zM3 11h26M12 15l-3.5 3.5L12 22M20 15l3.5 3.5L20 22M17.5 14l-3 9" />,
  <path key="p" d="M12.5 3h7v4h-7zM11.5 9h9l3.5 8-8 12-8-12zM16 29V19.5M16 19.5a2 2 0 1 0 0-.01" />,
  <path key="g" d="M5 27V19h4v8zM12 27v-11h4v11zM19 27V13h4v14zM26 27V9h-0M4 15l7-5 4 2 12-8M22 4h5v5" />,
];
const CORNER = ["md:top-[16%] md:left-[4%]", "md:top-[16%] md:right-[4%]", "md:bottom-[13%] md:left-[4%]", "md:bottom-[13%] md:right-[4%]"];

function Capabilities({ onMorph }: { onMorph: (f: number) => void }) {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(-1);
  const activeRef = useRef(-1);
  useGSAP(() => {
    root.current!.querySelectorAll<HTMLElement>(".cap-word").forEach((w) => fitWords(w));
    const chars = new SplitText(".cap-word", { type: "words,chars" }).chars; // words keep their letters together
    // Words float in before the pin.
    gsap.from(".cap-word", { yPercent: 40, opacity: 0, filter: "blur(12px)", stagger: 0.1, duration: 1, ease: "expo.out", scrollTrigger: { trigger: root.current, start: "top 70%" } });
    const burst = gsap.timeline({ paused: true }).to(chars, {
      x: () => gsap.utils.random(-500, 500), y: () => gsap.utils.random(-320, 320), rotation: () => gsap.utils.random(-120, 120),
      scale: () => gsap.utils.random(0.1, 0.5), opacity: 0, filter: "blur(8px)", color: "#fee12c",
      stagger: { each: 0.004, from: "center" }, duration: 1, ease: "power2.in",
    });
    ScrollTrigger.create({
      trigger: root.current, start: "top top", end: "+=520%", pin: true, scrub: true,
      onUpdate: (s) => {
        const p = s.progress;
        burst.progress(gsap.utils.clamp(0, 1, (p - 0.06) / 0.14));
        let f = F.nebula + gsap.utils.clamp(0, 1, (p - 0.08) / 0.16); // nebula → emblem
        let i = -1;
        if (p >= 0.26) {
          const seg = Math.min(3.999, (p - 0.26) / 0.16), k = Math.floor(seg), local = seg - k;
          i = Math.min(3, k);
          // emblem → icon k (first 25% of each segment), hold the icon
          f = F.emblem + k + gsap.utils.clamp(0, 1, local / 0.25);
          if (p > 0.9) f = F.chart + gsap.utils.clamp(0, 1, (p - 0.9) / 0.08); // back to the emblem
        }
        onMorph(f);
        gsap.set(".cap-fill", { scaleX: p });
        if (i !== activeRef.current) {
          activeRef.current = i;
          setActive(i);
        }
      },
    });
  }, { scope: root });
  useGSAP(() => {
    // Shown cards stay up; cards past the current step (e.g. when scrolling back up) are hidden again.
    // Opacity is faded on the glass panel itself: opacity on its parent would switch off the
    // backdrop blur until the fade ends, so the card would look clear first and turn glassy late.
    SERVICES.forEach((_, i) => {
      const on = i <= active, card = `.cap-card-${i}`, panel = `${card} > .hud-panel`;
      const fade = i === active ? 1 : 0.6;
      if (on && i === active) {
        gsap.set(card, { visibility: "visible" });
        gsap.fromTo(card, { y: 30, scale: 0.94 }, { y: 0, scale: 1, duration: 0.7, ease: "expo.out", overwrite: true });
        gsap.fromTo(panel, { opacity: 0 }, { opacity: fade, duration: 0.7, ease: "expo.out", overwrite: true });
      } else {
        if (on) gsap.set(card, { visibility: "visible" });
        gsap.to(card, { y: on ? 0 : 30, scale: on ? 1 : 0.94, duration: 0.4, ease: "power2.out", overwrite: true, onComplete: () => void (on || gsap.set(card, { visibility: "hidden" })) });
        gsap.to(panel, { opacity: on ? fade : 0, duration: 0.4, ease: "power2.out", overwrite: true });
      }
      gsap.to(`.cap-line-${i}`, { strokeDashoffset: on ? 0 : 1, duration: 0.6, ease: "power2.out", overwrite: true });
    });
  }, { scope: root, dependencies: [active] });

  return (
    <section ref={root} id="capabilities" data-label="Capabilities" className="relative h-dvh overflow-hidden">
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-5">
        {SERVICES.map((s) => (
          <div key={s.short} className="cap-word syne w-full max-w-[1100px] text-balance text-center text-[clamp(44px,8.6vw,150px)] font-extrabold uppercase leading-[0.9]">{s.short}</div>
        ))}
      </div>
      <svg className="pointer-events-none absolute inset-0 hidden h-full w-full md:block" viewBox="0 0 100 100" preserveAspectRatio="none">
        {[[30, 28], [70, 28], [30, 72], [70, 72]].map(([x, y], i) => (
          <line key={i} className={`cap-line-${i}`} x1="50" y1="50" x2={x} y2={y} stroke="#fee12c" strokeOpacity={0.5} strokeWidth="1" vectorEffect="non-scaling-stroke" pathLength={1} strokeDasharray="1" strokeDashoffset={1} />
        ))}
      </svg>
      {SERVICES.map((s, i) => (
        <a key={s.t} href={s.href} data-beep
          style={{ visibility: "hidden" }} className={`cap-card-${i} absolute inset-x-5 bottom-24 w-auto md:inset-x-auto md:w-[min(27vw,360px)] ${CORNER[i]} ${i === active ? "" : "max-md:hidden"}`}>
          <Panel className={`p-6 opacity-0 transition-colors duration-500 ${i === active ? "border-[var(--honey)]/70 bg-white/[0.06]" : ""}`}>
            <div className="flex items-start justify-between">
              <svg width="34" height="34" viewBox="0 0 32 32" fill="none" stroke="#fee12c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{ICONS[i]}</svg>
              <span className="jet text-[11px] text-white/45">0{i + 1} / 04</span>
            </div>
            <h3 className="syne mt-5 text-[22px] font-bold leading-tight">{s.t}</h3>
            <p className="mt-2 text-[14px] text-[var(--wax)]/65">{s.d}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {s.tags.map((t) => <span key={t} className="jet rounded-full border border-[var(--honey)]/30 px-2.5 py-1 text-[10px] uppercase text-[var(--honey)]">{t}</span>)}
            </div>
            {i === 0 && <PartnerBadge className="mt-5 h-8 w-auto opacity-90" />}
          </Panel>
        </a>
      ))}
      <div className="absolute inset-x-5 bottom-8 flex items-center justify-between gap-6 md:inset-x-10">
        <p className="jet hidden text-[11px] uppercase tracking-[0.15em] text-white/55 md:block">✦ Four disciplines. One hive.</p>
        <div className="h-px flex-1 bg-white/10 md:mx-6"><div className="cap-fill h-full origin-left scale-x-0 bg-[var(--honey)]" /></div>
        <a data-beep href={`${SITE}/services`} className="bee-pill pill-ghost !py-2.5 !pr-2 text-[var(--wax)]">All services <Arrow /></a>
      </div>
    </section>
  );
}

/* ───────────────────────── 03 Proof (pinned deck) ─────────────────────────
   A 3D stack of four glass cards; scroll flips the front card away to reveal the next.
   Each card proves its stat with real content: work mosaic, success ring, reviewers, partner badge. */
const STATS = [
  { v: 350, s: "+", l: "Stores launched", d: "Shopify stores live for brands across the globe." },
  { v: 100, s: "%", l: "Job success", d: "Every project delivered, every client heard." },
  { v: 40, s: "+", l: "Five-star reviews", d: "Rated five out of five by the founders we build with." },
  { v: 0, s: "", l: "Shopify Select Partner", d: "Recognised in Shopify's partner directory." },
];
const MOSAIC = ["/bee/opt/web-01-p-500.webp", "/bee/opt/ui-01-p-500.webp", "/bee/opt/branding-p-500.webp", "/bee/opt/smm-p-500.webp", "/bee/opt/shopify-service-image-p-500.webp", "/bee/opt/ycm-1080-x-720-image-3.webp"];
const FACES = ["/bee/opt/testimony-image-1.webp", "/bee/opt/avatar.webp", "/bee/opt/user-2.webp", "/bee/opt/user-3.webp", "/bee/opt/user-7.webp"];

function Proof({ onMorph }: { onMorph: (f: number) => void }) {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const [visit, setVisit] = useState(0);
  const activeRef = useRef(0);
  useGSAP(() => {
    fitSoon(root.current!.querySelector(".pf-h"));
    const h = new SplitText(".pf-h", { type: "words" });
    gsap.from(h.words, { yPercent: 60, opacity: 0, stagger: 0.05, duration: 0.9, ease: "expo.out", scrollTrigger: { trigger: root.current, start: "top 70%" } });
    ScrollTrigger.create({
      trigger: root.current, start: "top 55%", end: "bottom top",
      onEnter: () => setVisit((v) => v + 1), onEnterBack: () => setVisit((v) => v + 1),
    });
    const cards = gsap.utils.toArray<HTMLElement>(".pf-card", root.current);
    // Waiting cards fan out to the left, filling the space between the copy and the deck.
    // The fan step is sized to the actual gap so it never reaches the text.
    let fan = 0;
    const measureFan = () => {
      const deck = root.current!.querySelector<HTMLElement>(".pf-deck")!, copy = root.current!.querySelector<HTMLElement>(".pf-copy")!;
      const gap = deck.getBoundingClientRect().left - copy.getBoundingClientRect().right - 32;
      fan = innerWidth < 900 ? 0 : Math.max(0, Math.min(deck.offsetWidth * 0.42, gap / 3));
    };
    const layout = (seg: number) =>
      cards.forEach((c, k) => {
        const d = k - seg; // <0: already flipped away, 0: front, >0: waiting in the fan
        const glide = -seg * fan * 0.5; // the deck drifts left as cards are used, keeping the rest centred in the gap
        if (d < 0) gsap.set(c, { x: glide - d * fan * 0.6, yPercent: d * 120, rotateX: -d * 40, rotateZ: d * 4, scale: 1, filter: "brightness(1)", autoAlpha: Math.max(0, 1 + d * 2.4), zIndex: 10 - k });
        else if (fan) gsap.set(c, { x: glide - d * fan, yPercent: d * 2.5, rotateX: 0, rotateZ: -d * 3.5, scale: 1 - d * 0.07, filter: `brightness(${1 - Math.min(d, 3) * 0.22})`, autoAlpha: d > 3.2 ? 0 : 1, zIndex: 10 - k });
        // narrow screens: no room for a fan, so waiting cards stack behind and peek out above the front one
        else gsap.set(c, { x: 0, yPercent: -d * 7, rotateX: 0, rotateZ: 0, scale: 1 - d * 0.07, filter: `brightness(${1 - Math.min(d, 2) * 0.25})`, autoAlpha: d > 2.4 ? 0 : 1, zIndex: 10 - k });
      });
    measureFan();
    let lastSeg = 0;
    ScrollTrigger.addEventListener("refresh", () => { measureFan(); layout(lastSeg); });
    layout(0);
    ScrollTrigger.create({
      trigger: root.current, start: "top top", end: "+=320%", pin: true, scrub: true,
      onUpdate: (st) => {
        const raw = Math.min(3, st.progress * 3.6);
        const i = Math.min(3, Math.floor(raw)), local = raw - i;
        const seg = i + gsap.utils.clamp(0, 1, (local - 0.55) / 0.45); // hold each card, then flip
        lastSeg = seg;
        layout(seg);
        onMorph(F.g0 + Math.min(3, raw));
        gsap.set(".pf-fill", { scaleY: (k: number) => gsap.utils.clamp(0, 1, st.progress * 4 - k) });
        const front = Math.min(3, Math.round(seg)); // the card actually facing the visitor
        if (front !== activeRef.current) {
          activeRef.current = front;
          setActive(front);
        }
      },
    });
  }, { scope: root });
  useGSAP(() => {
    if (!visit) return; // wait until the visitor actually reaches the section
    const card = root.current!.querySelectorAll<HTMLElement>(".pf-card")[active];
    const num = card?.querySelector<HTMLElement>(".pf-num");
    const to = STATS[active].v;
    if (num && to) {
      const o = { v: 0 };
      const ring = active === 1 ? card.querySelector<SVGCircleElement>(".pf-ring") : null;
      // One tween drives the number and (on the 100% card) the ring, so they always match.
      gsap.to(o, {
        v: to, duration: active === 1 ? 1.8 : 1.4, ease: "power3.out",
        onUpdate: () => {
          num.textContent = String(Math.round(o.v));
          ring?.setAttribute("stroke-dashoffset", String(1 - o.v / 100));
        },
      });
    }
    if (active === 2) gsap.fromTo(".pf-star", { scale: 0, rotate: -40 }, { scale: 1, rotate: 0, stagger: 0.14, duration: 0.6, ease: "back.out(2.5)" });
    if (active === 0) gsap.fromTo(".pf-tile", { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, stagger: 0.06, duration: 0.6, ease: "expo.out" });
  }, { scope: root, dependencies: [active, visit] });

  // Cards are size containers, so numbers scale with the card (cqw), never the screen.
  const glass = "pf-card absolute inset-0 flex flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#13120c] p-7 shadow-[0_40px_80px_-30px_rgba(0,0,0,.9)] [container-type:inline-size]";
  const Big = ({ s, size }: { s: string; size: number }) => (
    <p className="syne whitespace-nowrap font-extrabold leading-none" style={{ fontSize: `${size}cqw` }}><span className="pf-num">0</span><span className="text-[var(--honey)]">{s}</span></p>
  );
  return (
    <section ref={root} id="proof" data-form={F.g0} data-label="Proof" className="relative flex h-dvh items-center gap-10 overflow-hidden px-5 md:px-10 max-md:flex-col max-md:justify-center">
      <div className="pf-copy relative z-20 w-full max-w-[min(560px,40vw)] max-md:max-w-none">
        <h2 className="pf-h syne text-[clamp(24px,2.4vw,42px)] font-extrabold uppercase leading-[1.02] [&>span]:block [&>span]:whitespace-nowrap">
          <span>We make your</span><span>business</span><span className="text-[var(--honey)]">stand out</span>
        </h2>
        <p className="mt-5 max-w-md text-[15px] text-[var(--wax)]/60 max-md:hidden">
          At BeeCreative, we specialize in high-performance Shopify development. We combine clean code with stunning design to ensure your brand doesn&apos;t just look better—it performs better.
        </p>
        <div className="mt-10 grid grid-cols-[2px_1fr] gap-x-5 max-md:hidden">
          <div className="flex flex-col gap-2">
            {STATS.map((x) => <div key={x.l} className="relative flex-1 bg-white/10"><div className="pf-fill absolute inset-0 origin-top scale-y-0 bg-[var(--honey)]" /></div>)}
          </div>
          <ul className="space-y-2">
            {STATS.map((x, i) => (
              <li key={x.l} className={`flex items-center gap-4 py-2 transition-colors duration-500 ${i === active ? "text-[var(--wax)]" : "text-white/30"}`}>
                <span className="jet shrink-0 text-[11px] uppercase tracking-[0.15em]"><span className="mr-2 text-[var(--honey)]">0{i + 1}</span>{x.l}</span>
                <span className="flex-1 border-t border-dashed border-current opacity-40" aria-hidden />
                <span className={`syne shrink-0 text-lg font-bold transition-colors duration-500 ${i === active ? "text-[var(--honey)]" : ""}`}>{x.v ? `${x.v}${x.s}` : "Select"}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="pf-deck relative mx-auto aspect-[4/5] w-[min(440px,78vw,52vh)] [perspective:1400px] md:mr-[6vw]">
        {/* 01 — stores: a mosaic of real work */}
        <div className={glass}>
          <div className="grid flex-1 grid-cols-3 gap-2">
            {MOSAIC.map((src) => <div key={src} className="pf-tile overflow-hidden rounded-[12px] bg-[#1a1913]"><img loading="lazy" decoding="async" src={src} alt="" className="h-full w-full object-cover opacity-80" /></div>)}
          </div>
          <div className="mt-6"><Big s="+" size={20} /><p className="jet mt-2 text-[11px] uppercase tracking-[0.18em] text-[var(--honey)]">{STATS[0].l}</p><p className="mt-1 text-[14px] text-white/55">{STATS[0].d}</p></div>
        </div>
        {/* 02 — success: a ring that closes */}
        <div className={glass}>
          <div className="relative grid flex-1 place-items-center">
            <svg viewBox="0 0 200 200" className="absolute aspect-square h-auto w-[88%] -rotate-90">
              <circle cx="100" cy="100" r="86" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="10" />
              <circle className="pf-ring" cx="100" cy="100" r="86" fill="none" stroke="#fee12c" strokeWidth="10" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1} />
            </svg>
            <Big s="%" size={14} />
          </div>
          <div className="mt-4"><p className="jet text-[11px] uppercase tracking-[0.18em] text-[var(--honey)]">{STATS[1].l}</p><p className="mt-1 text-[14px] text-white/55">{STATS[1].d}</p></div>
        </div>
        {/* 03 — reviews: real faces, stars, a quote */}
        <div className={glass}>
          <div className="flex -space-x-3">
            {FACES.map((f) => <img loading="lazy" decoding="async" key={f} src={f} alt="" className="h-14 w-14 rounded-full border-2 border-[#121109] object-cover" />)}
          </div>
          <div className="mt-6 flex gap-1.5 text-[34px] leading-none text-[var(--honey)]">{[0, 1, 2, 3, 4].map((k) => <span key={k} className="pf-star inline-block">★</span>)}</div>
          <p className="mt-6 flex-1 text-[17px] leading-relaxed text-[var(--wax)]/80">“A game-changer for my Shopify store.”<span className="mt-2 block text-[13px] text-white/45">Founder, Fanoon by TDT</span></p>
          <div><Big s="+" size={22} /><p className="jet mt-2 text-[11px] uppercase tracking-[0.18em] text-[var(--honey)]">{STATS[2].l}</p></div>
        </div>
        {/* 04 — partner: the badge */}
        <div className={`${glass} !bg-[var(--honey)] text-[#0a0a08]`}>
          <div className="grid flex-1 place-items-center">
            <div className="rounded-[20px] bg-[#0a0a08] px-8 py-7"><PartnerBadge className="h-[clamp(70px,9vh,110px)] w-auto" /></div>
          </div>
          <p className="syne text-[clamp(28px,2.4vw,40px)] font-extrabold uppercase leading-none">Select Partner</p>
          <p className="mt-2 text-[14px] text-black/65">{STATS[3].d}</p>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── 04 Work (pinned horizontal mission log) ───────────────────────── */
const PROJECTS = [
  { title: "Young Fashion Mind", tag: "Shopify Website", img: "/bee/opt/web-01-p-1080.webp", href: "https://youngfashionmind.de/" },
  { title: "Art Com Center", tag: "Graphics Design", img: "/bee/opt/ui-01-p-1080.webp", href: "https://artcomcenter.art/" },
  { title: "Makela", tag: "Branding", img: "/bee/opt/branding-p-1080.webp", href: "https://www.instagram.com/makela.pk/" },
  { title: "Aitan Safa Label", tag: "SMM", img: "/bee/opt/smm-p-1080.webp", href: "https://www.instagram.com/aitansafalabel/" },
];
const LOGOS = ["reactistan-logo.png", "rc.png", "gj.png", "image-4-1.png", "shh.png", "c8359051a0db48b5fbf66589ae92caff_dhaag.png", "image-3.png"];

function Work() {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(min-width: 900px)", () => {
      const dist = () => track.current!.scrollWidth - innerWidth;
      const tw = gsap.to(track.current, {
        x: () => -dist(), ease: "none",
        scrollTrigger: { trigger: ".wk-pin", start: "top top", end: () => `+=${dist()}`, pin: true, scrub: 1, invalidateOnRefresh: true, onUpdate: (s) => gsap.set(".wk-prog", { scaleX: s.progress }) },
      });
      gsap.utils.toArray<HTMLElement>(".wk-card", root.current).forEach((card) => {
        gsap.fromTo(card.querySelector("img"), { xPercent: -8, scale: 1.2 }, { xPercent: 8, scale: 1.12, ease: "none", scrollTrigger: { trigger: card, containerAnimation: tw, start: "left right", end: "right left", scrub: true } });
        gsap.fromTo(card, { rotateY: -18, z: -120, opacity: 0.35 }, { rotateY: 0, z: 0, opacity: 1, ease: "none", scrollTrigger: { trigger: card, containerAnimation: tw, start: "left right", end: "left 55%", scrub: true } });
      });
    });
    fitSoon(root.current!.querySelector(".wk-h"));
    const h = new SplitText(".wk-h", { type: "words" });
    gsap.from(h.words, { yPercent: 80, opacity: 0, stagger: 0.06, duration: 0.9, ease: "expo.out", scrollTrigger: { trigger: ".wk-h", start: "top 78%" } });
    gsap.to(".logo-row", { xPercent: -50, duration: 36, ease: "none", repeat: -1 });
    return () => mm.revert();
  }, { scope: root });

  return (
    <section ref={root} id="work" data-form={F.wave} data-label="Work" className="relative">
      <div className="overflow-hidden border-y border-white/10 bg-[#0a0a08]/60 py-6 backdrop-blur">
        <div className="logo-row flex w-max items-center gap-16 pr-16">
          {[...LOGOS, ...LOGOS, ...LOGOS, ...LOGOS].map((f, i) => <img loading="lazy" decoding="async" key={i} src={`/bee/${f}`} alt="" className="h-8 w-auto max-w-[130px] object-contain opacity-50 brightness-0 invert" />)}
        </div>
      </div>
      <div className="wk-pin relative overflow-hidden">
        <div ref={track} className="flex min-h-dvh flex-col gap-12 px-5 py-24 [perspective:1600px] min-[900px]:w-max min-[900px]:flex-row min-[900px]:items-center min-[900px]:gap-[3vw] min-[900px]:px-10 min-[900px]:py-0">
          <div className="shrink-0 min-[900px]:w-[34vw]">
            <h2 className="wk-h syne text-[clamp(40px,4.8vw,88px)] font-extrabold uppercase leading-[0.94] [&>span]:block [&>span]:whitespace-nowrap">
              <span>Impact</span><span>we created</span>
            </h2>
            <p className="mt-8 max-w-[27rem] text-[17px] leading-relaxed text-[var(--wax)]/65">
              Your one-stop agency for Brand Design, UI/UX, and Shopify Excellence. We help ambitious businesses stand out through strategic design and high-performance development.
            </p>
            <a data-beep href={`${SITE}/projects`} className="bee-pill pill-honey mt-10 !pr-2">All projects <Arrow /></a>
          </div>
          {PROJECTS.map((p, i) => (
            <a key={p.title} href={p.href} target="_blank" rel="noreferrer" className="wk-card group relative block shrink-0 min-[900px]:w-[min(40vw,64vh)]">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[24px] border border-white/10 bg-[#111]">
                <img loading="lazy" decoding="async" src={p.img} alt={p.title} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:brightness-110" />
                <div className="absolute inset-x-0 top-0 flex justify-between p-5">
                  <span className="jet rounded-full bg-[#0a0a08]/70 px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[var(--honey)] backdrop-blur">{p.tag}</span>
                  <span className="jet rounded-full bg-[#0a0a08]/70 px-3 py-1.5 text-[10px] text-white/70 backdrop-blur">M-0{i + 1}</span>
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-6 pt-20">
                  <div className="flex items-end justify-between gap-4">
                    <h3 className="syne text-[clamp(22px,2vw,34px)] font-bold leading-tight">{p.title}</h3>
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--honey)] text-[#0a0a08] transition-transform duration-500 group-hover:rotate-45">↗</span>
                  </div>
                </div>
              </div>
            </a>
          ))}
          <div className="hidden w-[4vw] shrink-0 min-[900px]:block" />
        </div>
        <div className="absolute inset-x-10 bottom-8 hidden h-px bg-white/10 min-[900px]:block">
          <div className="wk-prog h-full origin-left scale-x-0 bg-[var(--honey)]" />
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── 05 Trust (spinning Earth, Karachi beacon) ───────────────────────── */
const REVIEWS = [
  { brand: "Fanoon by TDT", img: "/bee/opt/testimony-image-1.webp", quote: "Working with Bee Creative was a game-changer for my Shopify store. They didn’t just build a website; they created a beautiful, cohesive brand experience." },
  { brand: "Rikelle Skincare", img: "/bee/opt/avatar.webp", quote: "Excellent experience with Bee Creative! Syed’s communication was seamless, and he delivered a stunning website that perfectly captured my vision." },
  { brand: "Dhaagni", img: "/bee/opt/user-2.webp", quote: "They perfectly translated our vision into high-quality social media campaigns and a seamless website. Their ability to blend creativity with strategy is impressive." },
  { brand: "Duonamic", img: "/bee/opt/user-3.webp", quote: "They handled every detail—from design tweaks to complex features—with creativity and precision. No challenge was too big." },
  { brand: "Aitan Safa Label", img: "/bee/opt/user-7.webp", quote: "Bee Creative delivered a professional website redesign on schedule and continues to excel with their social media marketing." },
  { brand: "Royal Chrono Store", img: "/bee/opt/avatar.webp", quote: "Bee Creative designed a custom Shopify store that exceeded my expectations! They even provided a super helpful video guide." },
];

function Trust({ onGlobe }: { onGlobe: (p: number) => void }) {
  const root = useRef<HTMLElement>(null);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setI((v) => (v + 1) % REVIEWS.length), 6500);
    return () => clearInterval(id);
  }, [paused]);
  // One fixed card; only its content changes. The old quote rises away, the new one rises in line by line.
  const card = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const resume = useRef(0);
  const [shown, setShown] = useState(0);
  const N = REVIEWS.length;
  const pauseAutoplay = () => {
    setPaused(true);
    clearTimeout(resume.current);
    resume.current = window.setTimeout(() => setPaused(false), 8000);
  };
  // i changed → animate the current content out, then show the new review
  useGSAP(() => {
    if (i === shown) return;
    gsap.to(content.current, {
      y: -18, autoAlpha: 0, filter: "blur(6px)", duration: 0.32, ease: "power2.in", overwrite: true,
      onComplete: () => setShown(i),
    });
  }, { scope: root, dependencies: [i] });
  // new review on screen → its lines rise in from a mask, then the author fades up
  useGSAP(() => {
    gsap.set(content.current, { y: 0, autoAlpha: 1, filter: "blur(0px)" });
    const q = SplitText.create(content.current!.querySelector(".tr-q"), { type: "lines", mask: "lines" });
    gsap.timeline()
      .from(q.lines, { yPercent: 100, duration: 0.7, stagger: 0.07, ease: "expo.out" })
      .from(content.current!.querySelector(".tr-who"), { y: 14, autoAlpha: 0, duration: 0.5, ease: "power3.out" }, 0.18);
    return () => q.revert();
  }, { scope: root, dependencies: [shown] });
  const go = (dir: 1 | -1) => { setI((v) => (v + dir + N) % N); pauseAutoplay(); };
  useGSAP(() => {
    ScrollTrigger.create({ trigger: root.current, start: "top bottom", end: "bottom top", onUpdate: (st) => onGlobe(st.progress) });
    fitSoon(root.current!.querySelector(".tr-h"));
    const h = new SplitText(".tr-h", { type: "words" });
    gsap.from(h.words, { yPercent: 60, opacity: 0, stagger: 0.05, duration: 0.9, ease: "expo.out", scrollTrigger: { trigger: ".tr-h", start: "top 82%" } });
  }, { scope: root });
  return (
    <section ref={root} id="trust" data-form={F.earth} data-label="Trust" className="relative flex min-h-dvh items-center px-5 py-28 md:px-10">
      <div className="w-full max-w-[min(600px,46vw)] max-md:max-w-none">
        <h2 className="tr-h syne text-[clamp(28px,3.2vw,54px)] font-extrabold uppercase leading-[1] [&>span]:block [&>span]:whitespace-nowrap">
          <span>Worldwide trust</span><span>built on</span><span className="text-[var(--honey)]">excellence</span>
        </h2>
        <p className="mt-5 text-[var(--wax)]/60">From our studio in <span className="text-[var(--honey)]">Karachi</span> to founders around the world.</p>
        <div data-reveal className="mt-6 flex items-center gap-4">
          <span className="syne text-5xl font-extrabold text-[var(--honey)]">5.0</span>
          <span className="text-sm leading-tight text-[var(--wax)]/60"><span className="tracking-[0.2em] text-[var(--honey)]">★★★★★</span><br />Trusted by 350+ brands worldwide</span>
          <span className="mx-2 h-10 w-px bg-white/15" />
          <PartnerBadge className="h-10 w-auto" />
        </div>
        <div className="mt-10">
          <div ref={card}>
            <Panel className="!bg-[#161510] p-8 shadow-[0_30px_60px_-30px_rgba(0,0,0,.9)]">
              {/* every quote is laid out invisibly in the same cell, so the card is always as tall as the longest */}
              <div className="grid [&>*]:[grid-area:1/1]">
                {REVIEWS.map((x) => (
                  <div key={x.brand} aria-hidden className="invisible">
                    <p className="text-[clamp(17px,1.4vw,21px)] leading-relaxed">“{x.quote}”</p>
                    <div className="mt-8 h-12" />
                  </div>
                ))}
                <div ref={content}>
                  <p key={`q${shown}`} className="tr-q text-[clamp(17px,1.4vw,21px)] leading-relaxed">“{REVIEWS[shown].quote}”</p>
                  <div className="tr-who mt-8 flex items-center gap-4">
                    <img loading="lazy" decoding="async" draggable={false} src={REVIEWS[shown].img} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-[var(--honey)]/50" />
                    <div><p className="font-semibold">{REVIEWS[shown].brand}</p><p className="jet text-[11px] uppercase text-white/45">Founder · verified review</p></div>
                  </div>
                </div>
              </div>
            </Panel>
          </div>
        </div>
        <div className="mt-6 flex items-center gap-2">
          {REVIEWS.map((x, k) => (
            <button key={x.brand} data-beep onClick={() => { if (k !== i) setI(k); pauseAutoplay(); }} aria-label={`Review from ${x.brand}`}
              className={`relative h-1.5 overflow-hidden rounded-full transition-all duration-500 ${k === i ? "w-10 bg-white/20" : "w-4 bg-white/20 hover:bg-white/40"}`}>
              {/* the active dot fills like a timer until the next autoplay step */}
              {k === i && <span key={`${i}-${paused}`} className={`absolute inset-0 origin-left bg-[var(--honey)] ${paused ? "" : "tr-timer"}`} />}
            </button>
          ))}
          <div className="ml-auto flex gap-2">
            {([-1, 1] as const).map((dir) => (
              <button key={dir} data-beep onClick={() => go(dir)} aria-label={dir < 0 ? "Previous review" : "Next review"}
                className="grid h-11 w-11 place-items-center rounded-full border border-white/15 text-[var(--wax)] transition-colors duration-300 hover:border-[var(--honey)] hover:bg-[var(--honey)] hover:text-[#0a0a08]">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  {dir < 0 ? <path d="M12 7H2M6 3 2 7l4 4" /> : <path d="M2 7h10M8 3l4 4-4 4" />}
                </svg>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── 06 Waggle gallery ───────────────────────── */
const GALLERY = [
  "/bee/opt/web-01-p-1080.webp", "/bee/opt/ui-01-p-1080.webp", "/bee/opt/branding-p-1080.webp", "/bee/opt/smm-p-1080.webp",
  "/bee/opt/ycm-1080-x-720-image-3.webp", "/bee/opt/shopify-service-image.webp", "/bee/opt/custom-theme-development-1.webp",
  "/bee/opt/graphic-design-service-section-image-634-x-528.webp", "/bee/opt/digital-marketing-and-seo-service-image.webp",
];

function Waggle({ onSwarm, onMorph }: { onSwarm: (o: number) => void; onMorph: (f: number) => void }) {
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  useGSAP(() => {
    const flyVh = innerWidth < 768 ? 3 : 5, totalVh = flyVh + 0.6, share = flyVh / totalVh;
    // Photos ride a 3D helix as one continuous ribbon, then settle into a 3×2 grid.
    const scene = motionScene(canvas.current!, root.current!, share, GALLERY, 0xfee12c); // honey-gold rails
    ScrollTrigger.create({
      trigger: root.current, start: "top top", end: () => `+=${innerHeight * totalVh}`, pin: true, anticipatePin: 1, invalidateOnRefresh: true,
      onUpdate: (s) => {
        const settled = scene.setProgress(s.progress);
        gsap.set(".wg-copy", { opacity: 1 - Math.min(1, settled * 3) });
      },
    });
    // As the gallery rises, the globe bursts apart into drifting dust…
    ScrollTrigger.create({ trigger: root.current, start: "top bottom", end: "top 30%", scrub: true, onUpdate: (st) => onMorph(F.earth + st.progress) });
    // …the dust rests (hidden) while the gallery flies, then gathers into the plane as Launch arrives.
    // Hidden range: from the gallery reaching 30% of the screen (0.7vh before its pin) through the pin,
    // until the contact section has just come up past the gallery (0.15vh after the pin).
    ScrollTrigger.create({ trigger: root.current, start: "top 30%", end: () => `+=${innerHeight * (0.7 + totalVh + 0.15)}`, invalidateOnRefresh: true, onToggle: (st) => onSwarm(st.isActive ? 0 : 1) });
    gsap.fromTo(".wg-title", { scale: 2.4, opacity: 0 }, { scale: 1, opacity: 1, ease: "none", scrollTrigger: { trigger: root.current, start: "top bottom", end: () => `+=${innerHeight * (1 + totalVh * share * 0.4)}`, scrub: true } });
    return () => scene.dispose();
  }, { scope: root });
  return (
    <section ref={root} data-label="The hive" className="relative h-dvh overflow-hidden">
      <div className="wg-copy pointer-events-none absolute inset-0 grid place-items-center">
        <h2 className="wg-title syne text-center text-[clamp(56px,10vw,180px)] font-extrabold uppercase leading-[0.86] text-transparent [-webkit-text-stroke:1.5px_rgba(254,225,44,.55)]">Made in<br />the hive</h2>
      </div>
      <canvas ref={canvas} className="pointer-events-none absolute inset-0 z-[1] h-full w-full" />
      <div className="wg-copy pointer-events-none absolute inset-x-5 top-28 z-[2] flex justify-between gap-6 md:inset-x-10">
        <p className="max-w-[17rem] text-right text-[14px] leading-snug text-white/55">A ribbon of recent launches, rebrands and campaigns from our studio.</p>
      </div>
      <div className="absolute inset-x-5 bottom-10 z-[2] flex items-end justify-between gap-6 md:inset-x-10">
        <p className="max-w-xs text-[15px] leading-snug text-white/55">Fresh launches, rebrands and campaigns — straight from our studio in Karachi.</p>
        <a data-beep href="https://www.instagram.com/beecrea8ive/" target="_blank" rel="noreferrer" className="bee-pill pill-ghost !pr-2 text-[var(--wax)]">Instagram <Arrow /></a>
      </div>
    </section>
  );
}

/* ───────────────────────── 07 Launch (contact) ───────────────────────── */
function Launch() {
  const root = useRef<HTMLElement>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [sent, setSent] = useState(false);
  useGSAP(() => {
    root.current!.querySelectorAll<HTMLElement>(".ln-h").forEach((h) => fitLine(h, 120, 28));
    const h = new SplitText(".ln-h", { type: "words" });
    gsap.from(h.words, { yPercent: 80, opacity: 0, stagger: 0.06, duration: 0.9, ease: "expo.out", scrollTrigger: { trigger: ".ln-h", start: "top 80%" } });
    gsap.from(".ln-tile", { y: 40, opacity: 0, stagger: 0.08, duration: 0.9, ease: "expo.out", scrollTrigger: { trigger: ".ln-grid", start: "top 82%" } });
    gsap.from(".ln-form", { y: 50, opacity: 0, duration: 1, ease: "expo.out", scrollTrigger: { trigger: ".ln-grid", start: "top 82%" } });
  }, { scope: root });
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = [
      `Hi Bee Creative! I'm ${f.get("name")}.`,
      picked.length ? `Interested in: ${picked.join(", ")}.` : "",
      `Email: ${f.get("email")}`,
      f.get("phone") ? `Phone: ${f.get("phone")}` : "",
      f.get("details") ? `\n${f.get("details")}` : "",
    ].filter(Boolean).join("\n");
    window.open(`${WA}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    setSent(true);
  };
  const field = "w-full border-b border-white/15 bg-transparent py-4 text-lg outline-none transition-colors placeholder:text-white/35 focus:border-[var(--honey)]";
  const tiles = [
    { k: "WhatsApp", v: "Chat with us", sub: "Fastest way to reach the team", href: WA },
    { k: "Call", v: PHONE, sub: "Talk to a project lead", href: TEL },
    { k: "Visit", v: "Gulistan-e-Johar, Karachi", sub: "B-55, Block 2 · 75290 · View on map", href: "https://maps.app.goo.gl/UavEnSDtEuM5QnkJ7" },
    { k: "Instagram", v: "@beecrea8ive", sub: "Latest launches and behind the scenes", href: "https://www.instagram.com/beecrea8ive/" },
  ];
  return (
    <section ref={root} id="launch" data-form={F.plane} data-label="Launch" className="relative px-5 py-[16vh] md:px-10">
      <div className="max-w-[min(900px,60vw)] max-md:max-w-none">
        <h2 className="ln-h syne text-[clamp(40px,6vw,108px)] font-extrabold uppercase leading-[0.92]">Have an idea?</h2>
        <h2 className="ln-h syne text-[clamp(40px,6vw,108px)] font-extrabold uppercase leading-[0.92] text-[var(--honey)]">Let&apos;s launch it.</h2>
        <p className="mt-6 max-w-lg text-lg text-[var(--wax)]/65">Tell us what you&apos;re building — a new store, a migration, a rebrand or a campaign. We&apos;ll reply with next steps.</p>
      </div>
      <div className="ln-grid mt-[12vh] grid gap-5 lg:grid-cols-[1fr_1.35fr]">
        <div className="grid gap-4 lg:grid-rows-4">
          {tiles.map((t) => (
            <a key={t.k} href={t.href} target={t.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" data-beep className="ln-tile group block h-full">
              <Panel className="flex h-full items-center justify-between gap-6 p-6 transition-colors duration-300 group-hover:border-[var(--honey)]/60">
                <div>
                  <p className="jet text-[10px] uppercase tracking-[0.18em] text-[var(--honey)]">{t.k}</p>
                  <p className="syne mt-2 text-[clamp(20px,1.8vw,28px)] font-bold">{t.v}</p>
                  <p className="mt-1 text-[13px] text-white/45">{t.sub}</p>
                </div>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/15 text-[var(--honey)] transition duration-500 group-hover:rotate-45 group-hover:bg-[var(--honey)] group-hover:text-[#0a0a08]">↗</span>
              </Panel>
            </a>
          ))}
        </div>
        <Panel className="ln-form p-8 md:p-10">
          {sent ? (
            <div>
              <h3 className="syne text-4xl font-extrabold text-[var(--honey)]">Thanks! We&apos;ll be in touch soon.</h3>
              <p className="mt-4 text-white/60">Your message opened in WhatsApp — hit send there and we&apos;ll reply fast.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="grid gap-6">
              <p className="jet text-[11px] uppercase tracking-[0.18em] text-white/45">How can we help you?</p>
              <div className="grid gap-6 md:grid-cols-2">
                <input className={field} name="name" placeholder="Name" required />
                <input className={field} name="email" type="email" placeholder="Email" required />
              </div>
              <div>
                <p className="jet mb-3 text-[11px] uppercase tracking-[0.15em] text-white/45">Any of our services we can help you with?</p>
                <div className="flex flex-wrap gap-2">
                  {["Shopify", "Branding", "Web Design", "Marketing"].map((s) => {
                    const on = picked.includes(s);
                    return (
                      <button type="button" key={s} onClick={() => setPicked(on ? picked.filter((x) => x !== s) : [...picked, s])}
                        className={`jet rounded-full border px-4 py-2 text-[12px] uppercase transition-colors ${on ? "border-[var(--honey)] bg-[var(--honey)] text-[#0a0a08]" : "border-white/20 text-white/75 hover:border-[var(--honey)]"}`}>
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
              <input className={field} name="phone" type="tel" placeholder="Phone" />
              <textarea className={`${field} min-h-24 resize-none`} name="details" placeholder="Any more details?" />
              <button className="bee-pill pill-honey w-fit !pr-2">Send via WhatsApp <Arrow /></button>
            </form>
          )}
        </Panel>
      </div>
    </section>
  );
}

/* ───────────────────────── Footer ───────────────────────── */
function Footer({ onSwarm }: { onSwarm: (o: number) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => dotWordmark(canvas.current!, "BEECREATIVE", () => sound.buzz(0.025)), []);
  useGSAP(() => {
    ScrollTrigger.create({ trigger: ".bee-footer", start: "top 70%", onToggle: (s) => onSwarm(s.isActive ? 0 : 1) });
  });
  return (
    <footer data-label="Contact" className="bee-footer relative border-t border-white/10 bg-[#0a0a08] px-5 pt-20 pb-8 md:px-10">
      <canvas ref={canvas} className="block h-[22vw] max-h-[300px] min-h-[110px] w-full cursor-crosshair" />
      <div className="mt-16 grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1.1fr]">
        <div>
          <img loading="lazy" decoding="async" src="/bee/logo.svg" alt="Bee Creative" className="h-10 w-auto" />
          <p className="mt-6 max-w-xs text-white/60">We don&apos;t just build websites — we create high-converting ecommerce stores that drive revenue.</p>
          <a href="https://www.shopify.com/partners/directory/partner/beecreativepk" target="_blank" rel="noreferrer" className="mt-6 inline-block opacity-90 transition hover:opacity-100">
            <PartnerBadge className="h-12 w-auto" />
          </a>
        </div>
        <FooterCol title="Menu" links={[["Home", "#top"], ["Work", "#work"], ["Services", "#capabilities"], ["About us", `${SITE}/about`], ["Contact", "#launch"]]} />
        <FooterCol title="Services" links={SERVICES.map((s) => [s.t, s.href] as [string, string])} />
        <div>
          <p className="jet mb-5 text-[11px] uppercase tracking-[0.15em] text-[var(--honey)]">Location</p>
          <p className="text-white/70">B-55, Block 2 Gulistan-e-Johar, Karachi, 75290, Pakistan</p>
          <a href="https://maps.app.goo.gl/UavEnSDtEuM5QnkJ7" target="_blank" rel="noreferrer" className="mt-3 inline-block text-[var(--honey)]">View on map ↗</a>
          <div className="mt-6 flex gap-4 text-[14px] text-white/60">
            <a href="https://www.instagram.com/beecrea8ive/" target="_blank" rel="noreferrer" className="hover:text-[var(--honey)]">Instagram</a>
            <a href="https://www.facebook.com/beecrea8ive.pk" target="_blank" rel="noreferrer" className="hover:text-[var(--honey)]">Facebook</a>
            <a href="https://pk.linkedin.com/company/bee-crea8ive" target="_blank" rel="noreferrer" className="hover:text-[var(--honey)]">LinkedIn</a>
          </div>
        </div>
      </div>
      <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6 text-[13px] text-white/40">
        <p>© 2026 BeeCreative. All rights reserved.</p>
        <div className="flex gap-5">
          <a href={`${SITE}/privacy-policy`} className="hover:text-[var(--honey)]">Privacy Policy</a>
          <a href={`${SITE}/terms-conditions`} className="hover:text-[var(--honey)]">Terms of Use</a>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="jet mb-5 text-[11px] uppercase tracking-[0.15em] text-[var(--honey)]">{title}</p>
      <ul className="space-y-2.5">{links.map(([l, h]) => <li key={l}><a href={h} className="text-white/70 transition hover:text-[var(--honey)]">{l}</a></li>)}</ul>
    </div>
  );
}

/* ───────────────────────── Page ───────────────────────── */
type Swarm = ReturnType<typeof createSwarm>;

export default function BeeHome() {
  const swarmCanvas = useRef<HTMLCanvasElement>(null);
  const swarm = useRef<Swarm | null>(null);
  const pendingMorph = useRef(0);
  const morph = (f: number) => {
    pendingMorph.current = f;
    swarm.current?.setMorph(f);
  };
  const hiders = useRef(new Set<string>());
  const swarmVis = useRef({ o: 1 });
  const applyVisibility = () => {
    const target = hiders.current.size ? 0 : 1;
    document.documentElement.toggleAttribute("data-swarm-hidden", !target); // the press-and-hold cursor follows this
    gsap.to(swarmVis.current, { o: target, duration: 0.7, ease: "power2.out", overwrite: true, onUpdate: () => swarm.current?.setOpacity(swarmVis.current.o) });
  };
  const hider = (key: string) => (o: number) => {
    if (o === 0) hiders.current.add(key);
    else hiders.current.delete(key);
    applyVisibility();
  };

  // Smooth scroll, header, HUD, section-entry morphs.
  useEffect(() => {
    history.scrollRestoration = "manual";
    const lenis = new Lenis({ lerp: 0.085 });
    (window as unknown as { lenis: Lenis }).lenis = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    const raf = (t: number) => lenis.raf(t * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    const header = document.querySelector<HTMLElement>(".bee-header")!;
    const pct = document.querySelector<HTMLElement>(".hud-pct");
    const label = document.querySelector<HTMLElement>(".hud-section");
    const sections = [...document.querySelectorAll<HTMLElement>("[data-label]")];
    let current = "";
    lenis.on("scroll", ({ direction, scroll, progress }: Lenis) => {
      header.style.transform = direction === 1 && scroll > 400 ? "translateY(-130%)" : "";
      if (pct) pct.textContent = String(Math.round(progress * 100)).padStart(3, "0");
      let name = sections[0]?.dataset.label ?? "";
      for (const el of sections) if (el.getBoundingClientRect().top < innerHeight * 0.5) name = el.dataset.label!;
      if (label && name !== current) {
        current = name;
        label.dataset.final = name;
        scramble(label);
      }
    });

    const triggers: ScrollTrigger[] = [];
    document.querySelectorAll<HTMLElement>("[data-form]").forEach((el) => {
      const k = Number(el.dataset.form);
      const prev = k === F.g0 ? F.emblemEnd : k === F.earth ? F.wave : k === F.plane ? F.scatter : k - 1;
      // The plane forms while the swarm is hidden (gallery → launch), so it reappears already shaped.
      const [start, end] = k === F.plane ? ["top 85%", "top 40%"] : ["top 85%", "top 25%"]; // plane gathers inside the contact section
      triggers.push(ScrollTrigger.create({ trigger: el, start, end, scrub: true, onUpdate: (st) => morph(prev + (k - prev) * st.progress) }));
    });
    // Rows marked data-reveal: their children rise in one after another.
    // (IntersectionObserver: reveals whenever the row is really on screen, immune to stale scroll positions)
    const revealIO = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      revealIO.unobserve(en.target);
      gsap.fromTo(en.target.children, { y: 26, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.08, duration: 0.8, ease: "expo.out" });
    }), { rootMargin: "0px 0px -8% 0px" });
    document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
      gsap.set(el.children, { opacity: 0, y: 26 });
      revealIO.observe(el);
    });
    // Text reveal everywhere: any paragraph / list item / small heading without its own animation
    // rises out of a line mask as it scrolls in. autoSplit re-splits on resize and after fonts load.
    const animated = "#trust [aria-hidden], .pf-copy ul, .hero-copy, .hero-in, .ms-p, .pr-card, .cap-word, [class*=cap-card-], .pf-card, .tr-q, .tr-who, .wk-card, .ln-form, .ln-tile, .wg-copy, .wg-title, [data-scramble], .bee-header, .hud-section, .hud-pct";
    const splits: SplitText[] = [];
    document.querySelectorAll<HTMLElement>("main p, main li, main h3, main blockquote, main figcaption, footer p, footer li").forEach((el) => {
      if (el.closest(animated) || !el.textContent?.trim() || el.closest("li") !== el && el.tagName === "P" && el.closest("li")) return;
      splits.push(SplitText.create(el, {
        type: "lines", mask: "lines", autoSplit: true,
        onSplit: (self) => gsap.from(self.lines, { yPercent: 105, opacity: 0, stagger: 0.07, duration: 0.9, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 90%", once: true } }),
      }));
    });
    document.querySelectorAll<HTMLElement>("[data-scramble]").forEach((el) =>
      triggers.push(ScrollTrigger.create({ trigger: el, start: "top 90%", once: true, onEnter: () => scramble(el) })),
    );
    document.fonts.ready.then(() => ScrollTrigger.refresh());
    return () => {
      splits.forEach((sp) => sp.revert());
      revealIO.disconnect();
      triggers.forEach((t) => t.kill());
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);

  // The swarm: the hero bee is built first so it shows at once; other shapes are filled in during idle time.
  useEffect(() => {
    let cancelled = false, s: Swarm | null = null;
    let hold = 0;
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("a,button,input,textarea,label")) return;
      hold = window.setTimeout(() => { s?.burst(true); sound.blast(); }, 380);
    };
    const up = () => { clearTimeout(hold); s?.burst(false); };
    const idle = (fn: () => void) =>
      "requestIdleCallback" in window ? requestIdleCallback(fn, { timeout: 400 }) : setTimeout(fn, 16);
    (async () => {
      const svg = LOGO_SVG;
      await Promise.resolve();
      if (cancelled) return;
      const mobile = innerWidth < 768, N = mobile ? 8000 : 18000;
      const sx = mobile ? 0 : sideX();
      const side = mobile ? { x: 0, y: 2.6 } : { x: sx, y: 0.4 };
      const w = mobile ? 3.6 : 4.8;
      const hh = Math.tan(THREE.MathUtils.degToRad(20)) * 14, u = (2 * hh) / innerHeight; // swarm camera: fov 40, z 14; u = world units per px
      // phones: Capabilities icons sit in the upper part of the screen, clear of the service card below
      const centre = { x: 0, y: mobile ? hh * 0.36 : 0.2 }, iw = mobile ? 3 : w;
      // phones: the hero bee fits the empty band between the header and the headline, so text stays clear
      let heroPlace = { ...side, width: 5.6 };
      if (mobile) {
        const probe = formLogo(3000, svg, { x: 0, y: 0, width: 1 });
        let lo = Infinity, hi = -Infinity;
        for (let i = 1; i < probe.length; i += 3) (lo = Math.min(lo, probe[i])), (hi = Math.max(hi, probe[i]));
        const aspect = hi - lo, top = 92, bottom = document.querySelector(".hero-copy")!.getBoundingClientRect().top + scrollY - 20;
        const hPx = Math.max(120, Math.min(bottom - top, innerWidth * 0.5 * aspect));
        heroPlace = { x: 0, y: hh - ((top + bottom) / 2) * u, width: (hPx / aspect) * u };
      }
      const vis = { x: mobile ? 0 : sx * 0.86, y: mobile ? 2.2 : 0.1 };
      const earth = { x: mobile ? 0 : sx * 0.74, y: mobile ? 2.4 : -0.45, r: mobile ? 2.1 : 3.3 }; // centred on the Trust copy

      const hero = formLogo(N, svg, heroPlace);
      const builders: (() => Float32Array | Promise<Float32Array>)[] = [
        () => hero,
        () => formNebula(N),
        () => formLogo(N, svg, { ...centre, width: mobile ? 3 : 4.2 }),
        () => formIcon(N, "shopify", { ...centre, width: iw * 0.85 }),
        () => formIcon(N, "code", { ...centre, width: iw }),
        () => formIcon(N, "pen", { ...centre, width: iw * 0.8 }),
        () => formIcon(N, "chart", { ...centre, width: iw }),
        () => formLogo(N, svg, { ...centre, width: mobile ? 3 : 4.2 }),
        () => formNebula(N, [12, 6, 6]),
        () => formNebula(N, [12, 6, 6]),
        () => formNebula(N, [12, 6, 6]),
        () => formNebula(N, [12, 6, 6]),
        () => formWave(N),
        async () => formEarth(N, landMask((await import("world-atlas/land-110m.json")).default), earth),
        () => formNebula(N, [34, 20, 16]), // the globe bursts outward into this wide dust cloud
        () => formIcon(N, "plane", { ...side, y: mobile ? 2.8 : 2.1, width: w * 0.9 }),
      ];
      // Every slot starts as the hero shape; real shapes replace them one by one.
      const forms: Float32Array[] = builders.map(() => hero);
      s = createSwarm(swarmCanvas.current!, forms, N, {
        index: F.earth, center: new THREE.Vector3(earth.x, earth.y, 0), radius: earth.r, home: [24.86, 67.01],
        targets: [[52.52, 13.4], [51.5, -0.12], [40.71, -74], [43.65, -79.38], [25.2, 55.27], [-33.87, 151.2], [24.71, 46.67], [34.05, -118.24], [1.35, 103.8], [48.86, 2.35]],
      }, new THREE.Vector3(heroPlace.x, heroPlace.y, 0), new THREE.Vector3(hero.tail[0], hero.tail[1], 0));
      swarm.current = s;
      // On a fresh load at the top, the bee flies in from the top-left corner.
      if (scrollY < innerHeight * 0.3 && !matchMedia("(prefers-reduced-motion: reduce)").matches) s.intro();
      swarmVis.current.o = 0;
      s.setOpacity(0);
      applyVisibility(); // fades in — unless the visitor is already in the gallery/footer
      s.setMorph(pendingMorph.current);

      await document.fonts.ready; // the Shopify "S" glyph needs Syne loaded
      let k = 1;
      const next = async () => {
        if (cancelled || k >= builders.length) return;
        forms[k] = await builders[k]();
        k++;
        s?.refresh(pendingMorph.current); // re-read shapes in case the visitor is already past this one
        idle(next);
      };
      idle(next);
    })();
    addEventListener("pointerdown", down);
    addEventListener("pointerup", up);
    return () => {
      cancelled = true;
      removeEventListener("pointerdown", down);
      removeEventListener("pointerup", up);
      s?.dispose();
    };
  }, []);

  return (
    <div className="bee relative">
      <canvas ref={swarmCanvas} className="pointer-events-none fixed inset-0 z-0 h-dvh w-full" aria-hidden />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(60%_50%_at_70%_40%,rgba(254,225,44,.06),transparent_70%)]" />
      <div className="hud-grid pointer-events-none fixed inset-0 z-0 opacity-[0.07]" />
      <Hud />
      <Header />
      <Cursor />
      <main className="relative z-10">
        <Hero />
        <Mission />
        <Capabilities onMorph={morph} />
        <Proof onMorph={morph} />
        <Work />
        <Trust onGlobe={(p) => swarm.current?.setGlobeScroll(p)} />
        <Waggle onSwarm={hider("waggle")} onMorph={morph} />
        <Launch />
      </main>
      <div className="relative z-10"><Footer onSwarm={hider("footer")} /></div>
    </div>
  );
}
