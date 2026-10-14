type Opts = {
  /** dot colour at rest and when stirred (rgb) */
  base?: [number, number, number];
  glow?: [number, number, number];
  /** dot spacing in CSS px (defaults to ~1/220 of the canvas width) */
  step?: number;
};

/**
 * Any filled shape drawn as an even field of dots. Near the pointer the dots scatter outwards on
 * springs and glow (like bees disturbed off a comb), then drift back.
 */
export function dotShape(canvas: HTMLCanvasElement, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, onStir: () => void, opts: Opts = {}) {
  const g = canvas.getContext("2d")!;
  const base = opts.base ?? [70, 66, 52], hot = opts.glow ?? [254, 225, 44];
  type Dot = { x: number; y: number; ox: number; oy: number; vx: number; vy: number; glow: number };
  let dots: Dot[] = [], dpr = 1;
  const ptr = { x: -1e4, y: -1e4, active: false };
  let lastStir = 0;

  const build = () => {
    dpr = Math.min(devicePixelRatio, 2);
    const w = (canvas.width = canvas.clientWidth * dpr), h = (canvas.height = canvas.clientHeight * dpr);
    if (!w || !h) return;
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const o = off.getContext("2d")!;
    o.fillStyle = "#fff";
    draw(o, w, h);
    const px = o.getImageData(0, 0, w, h).data;
    const step = opts.step ? opts.step * dpr : Math.max(6, Math.round(w / 220));
    dots = [];
    for (let y = step / 2; y < h; y += step)
      for (let x = (Math.round(y / step) % 2) * (step / 2); x < w; x += step)
        if (px[((y | 0) * w + (x | 0)) * 4 + 3] > 128) dots.push({ x, y, ox: x, oy: y, vx: 0, vy: 0, glow: 0 });
  };

  let raf = 0;
  const frame = () => {
    raf = requestAnimationFrame(frame);
    g.clearRect(0, 0, canvas.width, canvas.height);
    const R = 110 * dpr, rad = Math.max(1.6, (opts.step ? opts.step * dpr : canvas.width / 220) * 0.28);
    for (const d of dots) {
      const dx = d.x - ptr.x, dy = d.y - ptr.y, dist = Math.hypot(dx, dy);
      if (ptr.active && dist < R) {
        const f = (1 - dist / R) * 2.4 * dpr;
        d.vx += (dx / (dist || 1)) * f;
        d.vy += (dy / (dist || 1)) * f;
        d.glow = Math.min(1, d.glow + 0.2);
      }
      d.vx += (d.ox - d.x) * 0.06; // spring home
      d.vy += (d.oy - d.y) * 0.06;
      d.vx *= 0.82;
      d.vy *= 0.82;
      d.x += d.vx;
      d.y += d.vy;
      d.glow *= 0.96;
      const c = (i: number) => Math.round(base[i] + (hot[i] - base[i]) * d.glow);
      g.fillStyle = `rgb(${c(0)},${c(1)},${c(2)})`;
      g.beginPath();
      g.arc(d.x, d.y, rad * (1 + d.glow * 0.8), 0, Math.PI * 2);
      g.fill();
    }
  };
  const move = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    ptr.x = (e.clientX - r.left) * dpr;
    ptr.y = (e.clientY - r.top) * dpr;
    ptr.active = true;
    const now = performance.now();
    if (now - lastStir > 140 && dots.some((d) => Math.hypot(d.ox - ptr.x, d.oy - ptr.y) < 30 * dpr)) {
      lastStir = now;
      onStir();
    }
  };
  const leave = () => (ptr.active = false);
  const ro = new ResizeObserver(build);
  ro.observe(canvas);
  document.fonts.ready.then(build);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerleave", leave);
  frame();
  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    canvas.removeEventListener("pointermove", move);
    canvas.removeEventListener("pointerleave", leave);
  };
}

/** Footer wordmark: text drawn as dots. */
export function dotWordmark(canvas: HTMLCanvasElement, text: string, onStir: () => void) {
  return dotShape(canvas, (o, w, h) => {
    const fam = getComputedStyle(document.documentElement).getPropertyValue("--font-syne").trim() || "Arial, sans-serif";
    const font = (s: number) => `800 ${s}px ${fam}`;
    let size = h * 0.95;
    o.font = font(size);
    size *= Math.min(1, (w * 0.98) / o.measureText(text).width);
    o.font = font(size);
    o.textAlign = "center";
    o.textBaseline = "middle";
    o.fillText(text, w / 2, h / 2);
  }, onStir);
}
