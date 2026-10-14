import * as THREE from "three";
import gsap from "gsap";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

type Tick = (t: number) => void;

// Shared renderer + resize + offscreen pause. Returns a dispose function.
export function run(canvas: HTMLCanvasElement, scene: THREE.Scene, camera: THREE.PerspectiveCamera, tick: Tick) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();
  let visible = true;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
  io.observe(canvas);

  const timer = new THREE.Timer();
  let raf = 0;
  const frame = () => {
    raf = requestAnimationFrame(frame);
    if (!visible) return;
    timer.update();
    tick(timer.getElapsed());
    renderer.render(scene, camera);
  };
  frame();
  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    pmrem.dispose();
    renderer.dispose();
  };
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/* ───────────── Hero: glossy three-bar glyph, orbit lines, stars, hold-to-shatter ───────────── */
type HeroOpts = {
  build?: (mat: THREE.Material) => { group?: THREE.Object3D; parts: THREE.Object3D[]; tick?: (t: number) => void };
  accent?: number;
  offset?: [number, number];
};

export function heroScene(canvas: HTMLCanvasElement, onLine: (i: number) => void, onBlast: () => void, opts: HeroOpts = {}) {
  const accent = opts.accent ?? 0xff5a1f;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x0e0f12, metalness: 0.85, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12,
    envMapIntensity: 0.9,
  });
  const glyph = new THREE.Group();
  const built = opts.build?.(mat);
  const parts: THREE.Object3D[] = built ? built.parts : [];
  // Default mark: three slanted bars of rising height on a base slab — an original mark.
  if (!opts.build) [[-0.75, 1.4], [0, 2.0], [0.75, 2.6]].forEach(([x, h]) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(0.42, h, 0.5, 4, 0.06), mat);
    m.position.set(x, h / 2 - 1.1, 0);
    m.rotation.z = -0.32;
    parts.push(m);
  });
  if (!opts.build) {
    const base = new THREE.Mesh(new RoundedBoxGeometry(2.4, 0.32, 0.6, 4, 0.06), mat);
    base.position.set(0.05, -1.35, 0);
    parts.push(base);
  }
  parts.forEach((p) => (p.userData.home = { pos: p.position.clone(), rot: p.rotation.clone() }));
  if (built?.group) glyph.add(built.group);
  else parts.forEach((p) => glyph.add(p));
  glyph.rotation.set(0.15, -0.5, 0);
  scene.add(glyph);

  const rim = new THREE.PointLight(accent, 25, 8);
  rim.position.set(0.4, 0.2, -1.4);
  scene.add(rim, new THREE.AmbientLight(0xffffff, 0.15));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(-3, 4, 5);
  scene.add(key);

  // Orbit lines (hover to light them up).
  const lines = new THREE.Group();
  const lineMats: THREE.LineBasicMaterial[] = [];
  for (let i = 0; i < 6; i++) {
    const r = rand(5, 11);
    const pts = new THREE.EllipseCurve(0, 0, r, r * rand(0.35, 0.6)).getPoints(160).map((p) => new THREE.Vector3(p.x, p.y, 0));
    const m = new THREE.LineBasicMaterial({ color: 0x2c2c2c, transparent: true, opacity: 0.8 });
    const l = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), m);
    l.rotation.set(rand(-1.2, 1.2), rand(-0.6, 0.6), rand(-0.8, 0.8));
    l.userData.i = i;
    lineMats.push(m);
    lines.add(l);
  }
  scene.add(lines);

  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(Array.from({ length: 1500 }, () => rand(-25, 25)), 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x777777, size: 0.03 })));

  // Sparks for the shatter.
  const N = 400;
  const sparkPos = new Float32Array(N * 3);
  const sparkVel = Array.from({ length: N }, () => new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(2, 7)));
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
  const sparkMat = new THREE.PointsMaterial({ color: accent, size: 0.05, transparent: true, opacity: 0 });
  scene.add(new THREE.Points(sparkGeo, sparkMat));
  let sparkT = -1;

  // Pointer: parallax, line hover, press-and-hold to shatter.
  const mouse = new THREE.Vector2();
  const ray = new THREE.Raycaster();
  ray.params.Line = { threshold: 0.12 };
  let lastLine = -1, holdTimer = 0, blasted = false;
  const move = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(lines.children)[0];
    const i = hit ? (hit.object.userData.i as number) : -1;
    if (i >= 0 && i !== lastLine) {
      const m = lineMats[i];
      m.color.set(accent);
      gsap.to(m.color, { r: 0.17, g: 0.17, b: 0.17, duration: 1.2, delay: 0.2 });
      onLine(i);
    }
    lastLine = i;
  };
  const shatter = () => {
    blasted = true;
    onBlast();
    sparkT = 0;
    sparkPos.fill(0);
    parts.forEach((p) => {
      gsap.to(p.position, { x: rand(-4, 4), y: rand(-3, 3), z: rand(-3, 3), duration: 1.1, ease: "expo.out" });
      gsap.to(p.rotation, { x: rand(-3, 3), y: rand(-3, 3), z: rand(-3, 3), duration: 1.1, ease: "expo.out" });
    });
  };
  const down = () => (holdTimer = window.setTimeout(shatter, 450));
  const up = () => {
    clearTimeout(holdTimer);
    if (!blasted) return;
    blasted = false;
    parts.forEach((p) => {
      const { pos, rot } = p.userData.home;
      gsap.to(p.position, { x: pos.x, y: pos.y, z: pos.z, duration: 1.4, ease: "elastic.out(1,0.6)" });
      gsap.to(p.rotation, { x: rot.x, y: rot.y, z: rot.z, duration: 1.4, ease: "elastic.out(1,0.6)" });
    });
  };
  window.addEventListener("pointermove", move);
  canvas.addEventListener("pointerdown", down);
  window.addEventListener("pointerup", up);

  let scroll = 0;
  const dispose = run(canvas, scene, camera, (t) => {
    camera.position.x += (mouse.x * 0.5 - camera.position.x) * 0.05;
    camera.position.y += (mouse.y * 0.3 - camera.position.y) * 0.05;
    camera.lookAt(0, 0, 0);
    lines.rotation.z = t * 0.02;
    // Scroll turns the glyph; fading is done on the canvas element by ScrollTrigger.
    const [ox, oy] = innerWidth < 768 ? [0, 0.6] : opts.offset ?? [0, 0];
    glyph.rotation.y = -0.5 + scroll * Math.PI * (built ? 1.2 : 2.2) + Math.sin(t * 0.4) * 0.05;
    glyph.position.set(ox + (built ? Math.sin(t * 0.7) * 0.12 : 0), oy + Math.sin(t * (built ? 1.6 : 0.8)) * (built ? 0.14 : 0.05), 0);
    built?.tick?.(t);
    if (sparkT >= 0) {
      sparkT += 0.016;
      for (let i = 0; i < N; i++) {
        sparkPos[i * 3] = sparkVel[i].x * sparkT;
        sparkPos[i * 3 + 1] = sparkVel[i].y * sparkT - 2 * sparkT * sparkT;
        sparkPos[i * 3 + 2] = sparkVel[i].z * sparkT;
      }
      sparkGeo.attributes.position.needsUpdate = true;
      sparkMat.opacity = Math.max(0, 1 - sparkT);
      if (sparkT > 1) sparkT = -1;
    }
  });
  return {
    setScroll: (p: number) => (scroll = p),
    dispose() {
      window.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      dispose();
    },
  };
}

/* ───────────── Services: procedural rock slab over shader smoke ───────────── */
function noise3(x: number, y: number, z: number) {
  // Cheap value-ish noise from summed sines; good enough for rock displacement.
  return (
    Math.sin(x * 1.7 + Math.sin(y * 2.3)) * Math.cos(y * 1.9 + Math.sin(z * 1.3)) * 0.5 +
    Math.sin(x * 5.1 + z * 3.7) * Math.sin(y * 4.3) * 0.25 +
    Math.sin(x * 13.0 + y * 11.0 + z * 7.0) * 0.12
  );
}

function noiseTexture(size = 512) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const img = g.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const x = i % size, y = (i / size) | 0;
    const v = 128 + noise3(x / 18, y / 18, 0) * 60 + rand(-40, 40);
    img.data.set([v, v, v, 255], i * 4);
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const smokeShader = {
  uniforms: { uTime: { value: 0 }, uAmount: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `
    varying vec2 vUv; uniform float uTime; uniform float uAmount;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
    float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
      return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
    float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<6;i++){ v+=a*n(p); p*=2.; a*=.5; } return v; }
    void main(){
      vec2 p = vUv*vec2(3.,1.6);
      float q = fbm(p + vec2(uTime*.03, 0.));
      float s = fbm(p + q*1.8 - vec2(0., uTime*.02));
      vec3 col = mix(vec3(.02,.025,.035), vec3(.42,.43,.46), smoothstep(.35,.95,s));
      gl_FragColor = vec4(col, uAmount);
    }`,
};

/** Pass `object` to swap the procedural rock for any centrepiece (e.g. the 3D bee). */
export function rockScene(canvas: HTMLCanvasElement, opts: { object?: () => THREE.Object3D; tick?: (t: number) => void } = {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.z = 7;

  const smokeMat = new THREE.ShaderMaterial({ ...smokeShader, transparent: true, depthWrite: false });
  const smoke = new THREE.Mesh(new THREE.PlaneGeometry(34, 18), smokeMat);
  smoke.position.z = -6;
  scene.add(smoke);

  const geo = new THREE.BoxGeometry(2.6, 2.6, 0.8, 90, 90, 24);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < (opts.object ? 0 : pos.count); i++) {
    v.fromBufferAttribute(pos, i);
    const d = noise3(v.x * 1.3, v.y * 1.3, v.z * 1.3) * 0.12;
    v.multiplyScalar(1 + d * 0.35).addScalar(d * 0.04);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  let rock: THREE.Object3D;
  if (opts.object) rock = opts.object();
  else {
    const tex = noiseTexture();
    rock = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x8a8a8e, roughness: 1, bumpMap: tex, bumpScale: 3, map: tex }));
  }
  scene.add(rock);
  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(-4, 5, 4);
  scene.add(key, new THREE.AmbientLight(0xffffff, 0.25));

  let p = 0;
  const dispose = run(canvas, scene, camera, (t) => {
    smokeMat.uniforms.uTime.value = t;
    opts.tick?.(t);
    smokeMat.uniforms.uAmount.value = Math.min(1, p * 5);
    const s = gsap.utils.clamp(0, 1, (p - 0.1) * 4);
    rock.scale.setScalar(0.3 + s * 0.7);
    rock.rotation.set(0.5 * (1 - p) + Math.sin(t * 0.3) * 0.04, -0.6 * (1 - p) + p * 0.4, -0.35 * (1 - p));
  });
  return { setProgress: (x: number) => (p = x), dispose };
}

/* ───────────── Motion: cards ride a 3D helix, then settle into a 3×2 grid ───────────── */
const PALETTES = [
  ["#f2efe9", "#1b1b1b"], ["#d9548b", "#fff1f6"], ["#ffffff", "#ff4d1f"], ["#3b2a20", "#f5e9dc"],
  ["#e9eef2", "#111"], ["#141414", "#e6e6e6"], ["#c9d6c3", "#1d2a1a"], ["#f6d04d", "#1a1a1a"],
];
const WORDS = ["FIELD", "VOL.07", "NOIR", "kinetic", "Atlas", "2027", "Studio", "ORBIT", "Mono", "PULSE", "grain", "ECHO"];

function posterTexture(i: number) {
  const c = document.createElement("canvas");
  c.width = 640;
  c.height = 440;
  const g = c.getContext("2d")!;
  const [bg, fg] = PALETTES[i % PALETTES.length];
  g.fillStyle = bg;
  g.fillRect(0, 0, 640, 440);
  g.fillStyle = fg;
  g.globalAlpha = 0.18;
  for (let k = 0; k < 6; k++) {
    g.beginPath();
    g.arc(rand(0, 640), rand(0, 440), rand(30, 160), 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  g.font = `600 ${i % 3 ? 96 : 120}px "Inter Tight", Arial, sans-serif`;
  g.fillText(WORDS[i % WORDS.length], 36, 380);
  g.font = `500 18px monospace`;
  g.fillText(`STUDY ${String(i + 1).padStart(2, "0")} — DAILY PRACTICE`, 36, 52);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const roundedFrag = `
  uniform sampler2D map; uniform vec2 uSize; uniform float uRadius; varying vec2 vUv;
  void main(){
    vec2 q = abs((vUv - .5) * uSize) - uSize * .5 + uRadius;
    float d = min(max(q.x, q.y), 0.) + length(max(q, 0.)) - uRadius;
    float a = 1. - smoothstep(-.5, .5, d);
    if (a <= 0.) discard;
    gl_FragColor = vec4(texture2D(map, vUv).rgb, a);
  }`;
const waveVert = `
  uniform float uWave; uniform float uTime; uniform float uAmp; varying vec2 vUv;
  void main(){
    vUv = uv;
    vec3 p = position;
    p.z += uWave * sin(uv.x * 2.8 + (1. - uv.y) * 1.4 - uTime * 2.) * uAmp;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
  }`;

/**
 * progress p (0..1) covers the whole pin. The first `ribbonShare` of it drives the helix + grid,
 * the rest is left for the dark stripes handled in the DOM. Returns grid progress (0..1).
 */
export function motionScene(canvas: HTMLCanvasElement, hoverArea: HTMLElement, ribbonShare: number, images?: string[], lineColor = 0x9e9e9e) {
  const loader = new THREE.TextureLoader();
  const tex = (i: number) => {
    if (!images?.length) return posterTexture(i);
    const t = loader.load(images[i % images.length]);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const scene = new THREE.Scene();
  const narrow = () => innerWidth < 768;
  const mid = () => innerWidth >= 768 && innerWidth < 1200;
  const fov = () => (narrow() ? 58 : mid() ? 54 : 52);
  const camZ = () => (narrow() ? 28 : mid() ? 24 : 22);
  const camera = new THREE.PerspectiveCamera(fov(), 1, 0.1, 500);

  // Helix: two turns around Y, rising 28 units, with a soft dip half-way.
  const RAD = 12, TURNS = 2, LIFT = 28 / (Math.PI * 2 * TURNS), DIP = Math.PI * 2;
  const ARC = Math.hypot(RAD, LIFT); // arc length per radian
  const PATH = Math.PI * 2 * TURNS * ARC;
  const LEN = 5.8, PITCH = 6.2, HEIGHT = LEN * 0.7, COUNT = 9, COLS = 116;
  const TRAIN = (COUNT - 1) * PITCH + LEN;
  const pos = new THREE.Vector3(), tan = new THREE.Vector3(), side = new THREE.Vector3(), radial = new THREE.Vector3();
  const frameAt = (th: number) => {
    const d = (th - DIP) / 2, dip = 2.5 * Math.exp(-d * d);
    pos.set(RAD * Math.cos(th), -16 + th * LIFT - dip, RAD * Math.sin(th));
    tan.set(-RAD * Math.sin(th), LIFT + dip * d, RAD * Math.cos(th)).normalize();
    radial.set(Math.cos(th), 0, Math.sin(th));
    side.crossVectors(tan, radial).normalize();
    side.y += 0.6; // lean the strip so it reads as a ribbon, not a fence
    side.normalize();
  };

  // Two rail lines along the strip edges, drawn as travelling segments.
  const RAIL_PTS = 600, TAIL = 86;
  const railGeo = (sign: number) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= RAIL_PTS; i++) {
      frameAt((i / RAIL_PTS) * Math.PI * 2 * TURNS);
      pts.push(pos.clone().addScaledVector(side, sign * (HEIGHT * 0.5 + 0.35)));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  };
  const railMat = new THREE.LineBasicMaterial({ color: lineColor });
  const rails = [new THREE.Line(railGeo(1), railMat), new THREE.Line(railGeo(-1), railMat)];
  rails.forEach((l) => { l.frustumCulled = false; l.geometry.setDrawRange(0, 0); scene.add(l); });

  // Ribbon cards: each is a strip of COLS columns re-laid along the helix every frame.
  // Seen from outside (near side) and inside (far side) the strip reads left-to-right either way, so no flip.
  const flipFrag = `uniform sampler2D map; varying vec2 vUv;
    void main(){ gl_FragColor = texture2D(map, vUv); }`;
  const plainVert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
  const cards = Array.from({ length: COUNT }, (_, i) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1, COLS, 1),
      new THREE.ShaderMaterial({ uniforms: { map: { value: tex(i) } }, vertexShader: plainVert, fragmentShader: flipFrag, side: THREE.DoubleSide }),
    );
    m.frustumCulled = false;
    m.userData.hover = 1;
    scene.add(m);
    return m;
  });
  const layCard = (m: THREE.Mesh, start: number, scale: number) => {
    const a = m.geometry.attributes.position;
    const len = LEN * scale, h = HEIGHT * scale, s0 = start + LEN / 2 - len / 2;
    for (let c = 0; c <= COLS; c++) {
      frameAt((s0 + (c / COLS) * len) / ARC);
      for (let r = 0; r < 2; r++) {
        const o = (r === 0 ? 0.5 : -0.5) * h;
        a.setXYZ(r * (COLS + 1) + c, pos.x + side.x * o, pos.y + side.y * o, pos.z + side.z * o);
      }
    }
    a.needsUpdate = true;
  };

  // Grid: six rounded cards that fly in from the edges and ripple flat.
  const gridCols = () => (narrow() ? 2 : 3);
  const gridRows = () => (narrow() ? 3 : 2);
  const gapX = () => (narrow() ? 0.18 : mid() ? 0.28 : innerWidth >= 1440 ? 0.5 : 0.38);
  const gapY = () => (narrow() ? 0.22 : mid() ? 0.36 : innerWidth >= 1440 ? 0.7 : 0.55);
  const ASPECT = 0.7;
  const view = () => {
    const hh = Math.tan(((camera.fov * Math.PI) / 180) / 2) * camera.position.z;
    return { hh, hw: hh * camera.aspect };
  };
  const cardW = () => {
    const { hh, hw } = view();
    const fill = innerWidth >= 1440 ? 0.78 : 0.8;
    return Math.min((2 * hw * fill - (gridCols() - 1) * gapX()) / gridCols(), (2 * hh * fill - (gridRows() - 1) * gapY()) / gridRows() / ASPECT, 9.2);
  };
  const grid = Array.from({ length: 6 }, (_, i) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1, 24, 14),
      new THREE.ShaderMaterial({
        uniforms: { map: { value: tex(i + 3) }, uSize: { value: new THREE.Vector2() }, uRadius: { value: 8 }, uWave: { value: 1 }, uTime: { value: 0 }, uAmp: { value: 0.6 } },
        vertexShader: waveVert, fragmentShader: roundedFrag, transparent: true, side: THREE.DoubleSide,
      }),
    );
    m.frustumCulled = false;
    m.visible = false;
    m.userData.wave = 1;
    scene.add(m);
    return m;
  });
  const splitLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: lineColor }));
  splitLine.frustumCulled = false;
  scene.add(splitLine);
  const layoutGrid = () => {
    const w = cardW(), h = w * ASPECT;
    const pxPerUnit = innerHeight / (2 * view().hh);
    grid.forEach((m) => {
      m.scale.set(w, h, 1);
      (m.material as THREE.ShaderMaterial).uniforms.uSize.value.set(w * pxPerUnit, h * pxPerUnit);
      (m.material as THREE.ShaderMaterial).uniforms.uAmp.value = w * 0.12;
    });
    const { hw } = view();
    const inset = narrow() ? 0 : hw * (80 / innerWidth);
    const pts = [];
    for (let i = 0; i <= 200; i++) pts.push(new THREE.Vector3(-hw + inset + (i / 200) * 2 * (hw - inset), 0, 0));
    splitLine.geometry.setFromPoints(pts);
    splitLine.geometry.setDrawRange(0, 0);
  };
  const slot = (i: number) => {
    const w = cardW(), h = w * ASPECT, cols = gridCols(), rows = gridRows();
    const c = i % cols, r = Math.floor(i / cols);
    return {
      x: -(cols * w + (cols - 1) * gapX()) / 2 + w / 2 + c * (w + gapX()),
      y: (rows * h + (rows - 1) * gapY()) / 2 - h / 2 - r * (h + gapY()),
    };
  };

  // Pointer hover grows a ribbon card slightly.
  const ray = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let pointerIn = false;
  const move = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    pointerIn = true;
  };
  const leave = () => (pointerIn = false);
  hoverArea.addEventListener("pointermove", move);
  hoverArea.addEventListener("pointerleave", leave);

  // Grid starts once the head of the train has passed half the helix.
  const gridStart = ((0.5 * PATH + TRAIN + 10) / (PATH + TRAIN)) * (400 / 600);
  let target = 0, smooth = 0, last = 0, lastW = 0;
  const gridProgress = (p: number) => {
    const g = Math.min(1, p / ribbonShare);
    return gsap.utils.clamp(0, 1, (g - gridStart) / (1 - gridStart));
  };

  const dispose = run(canvas, scene, camera, (t) => {
    const dt = Math.min(0.05, t - last || 1 / 60);
    last = t;
    if (innerWidth !== lastW) {
      lastW = innerWidth;
      camera.fov = fov();
      camera.position.set(0, 0, camZ());
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      layoutGrid();
    }
    smooth += (target - smooth) * (1 - Math.pow(0.001, dt));
    const g = Math.min(1, smooth / ribbonShare);
    const P = Math.min(1, g / (400 / 600)); // ribbon travel finishes at 2/3 of its share

    // Rails: travelling segments.
    const head = P * (RAIL_PTS + TAIL);
    rails.forEach((l) => {
      const from = Math.max(0, Math.floor(head) - TAIL);
      l.geometry.setDrawRange(from, Math.max(0, Math.min(Math.floor(head), RAIL_PTS) - from + 1));
    });

    // Cards along the helix, with hover growth.
    let hovered: THREE.Object3D | null = null;
    if (pointerIn) {
      ray.setFromCamera(mouse, camera);
      hovered = ray.intersectObjects([...cards, ...grid].filter((c) => c.visible), false)[0]?.object ?? null;
    }
    const lead = P * (PATH + TRAIN) - TRAIN + 25;
    cards.forEach((m, i) => {
      const s = lead + PITCH * i;
      m.visible = P < 1 && s > 0 && s < PATH;
      m.userData.hover += ((m === hovered ? 1.12 : 1) - m.userData.hover) * (1 - Math.pow(0.001, dt));
      if (m.visible) layCard(m, Math.min(s, PATH - 0.001), m.userData.hover);
    });

    // Grid fly-in + ripple + split line.
    const H = gridProgress(smooth);
    const { hh, hw } = view();
    const w = cardW(), h = w * ASPECT, cols = gridCols();
    grid.forEach((m, i) => {
      const k = gsap.utils.clamp(0, 1, (H - 0.08 * i) / 0.4);
      const u = m.material as THREE.ShaderMaterial;
      if (k <= 0 && !m.userData.wave) return void (m.visible = false);
      m.visible = k > 0;
      const e = 1 - Math.pow(1 - k, 3);
      const to = slot(i), c = i % cols;
      const fromY = i < cols ? hh + 2 * h : -hh - 2 * h;
      const fromX = c === 0 ? -hw - 2 * w : c === cols - 1 ? hw + 2 * w : to.x;
      m.position.set(fromX + (to.x - fromX) * e, fromY + (to.y - fromY) * e, 0);
      // ripple while flying in; once settled, hovering a card ripples it again
      const want = k < 1 ? 1 : m === hovered ? 0.7 : 0;
      m.userData.wave += (want - m.userData.wave) * (1 - Math.pow(0.02, dt));
      u.uniforms.uWave.value = m.userData.wave;
      u.uniforms.uTime.value += 1.08 * dt;
    });
    const lineK = 1 - Math.pow(1 - gsap.utils.clamp(0, 1, (H - 0.2) / 0.8), 2.5);
    splitLine.geometry.setDrawRange(0, Math.round(201 * lineK));
  });

  return {
    setProgress(p: number) {
      target = p;
      return gridProgress(p);
    },
    dispose() {
      hoverArea.removeEventListener("pointermove", move);
      hoverArea.removeEventListener("pointerleave", leave);
      dispose();
    },
  };
}

/* ───────────── Footer: wordmark drawn as hover-reactive horizontal lines (2D canvas) ───────────── */
export function lineWordmark(
  canvas: HTMLCanvasElement,
  text: string,
  onRow: (row: number) => void,
  opts: { base?: [number, number, number]; glow?: [number, number, number]; font?: string } = {},
) {
  const base = opts.base ?? [115, 115, 115], hot = opts.glow ?? [255, 255, 255];
  const font = opts.font ?? `"Inter Tight", Arial, sans-serif`;
  const g = canvas.getContext("2d")!;
  type Seg = { x0: number; x1: number; y: number; row: number; off: number; glow: number };
  let segs: Seg[] = [];
  let dpr = 1;
  const pointer = { x: -1e4, y: -1e4 };
  let lastRow = -1;

  const build = () => {
    dpr = Math.min(devicePixelRatio, 2);
    const w = canvas.clientWidth * dpr, h = canvas.clientHeight * dpr;
    canvas.width = w;
    canvas.height = h;
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const o = off.getContext("2d")!;
    let size = h * 1.05;
    o.font = `700 ${size}px ${font}`;
    size *= Math.min(1, (w * 0.98) / o.measureText(text).width);
    o.font = `700 ${size}px ${font}`;
    o.textBaseline = "middle";
    o.textAlign = "center";
    o.fillText(text, w / 2, h / 2);
    const px = o.getImageData(0, 0, w, h).data;
    const gap = 10 * dpr;
    segs = [];
    for (let y = gap / 2, row = 0; y < h; y += gap, row++) {
      let run = -1;
      for (let x = 0; x <= w; x++) {
        const on = x < w && px[((y | 0) * w + x) * 4 + 3] > 128;
        if (on && run < 0) run = x;
        if (!on && run >= 0) {
          segs.push({ x0: run, x1: x, y, row, off: 0, glow: 0 });
          run = -1;
        }
      }
    }
  };

  let raf = 0;
  const draw = () => {
    raf = requestAnimationFrame(draw);
    g.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of segs) {
      const near = Math.abs(pointer.y - s.y) < 14 * dpr && pointer.x > s.x0 - 40 && pointer.x < s.x1 + 40;
      s.off += ((near ? (pointer.y > s.y ? -6 : 6) * dpr : 0) - s.off) * 0.15;
      s.glow += ((near ? 1 : 0) - s.glow) * 0.1;
      const mix = (i: number) => Math.round(base[i] + (hot[i] - base[i]) * s.glow);
      g.strokeStyle = `rgb(${mix(0)},${mix(1)},${mix(2)})`;
      g.lineWidth = dpr;
      g.beginPath();
      g.moveTo(s.x0, s.y + s.off);
      g.lineTo(s.x1, s.y + s.off);
      g.stroke();
    }
  };
  const move = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = (e.clientX - r.left) * dpr;
    pointer.y = (e.clientY - r.top) * dpr;
    const row = Math.round(pointer.y / (10 * dpr));
    if (row !== lastRow && segs.some((s) => s.row === row && pointer.x > s.x0 && pointer.x < s.x1)) onRow(row);
    lastRow = row;
  };
  const leave = () => (pointer.x = pointer.y = -1e4);
  const ro = new ResizeObserver(build);
  ro.observe(canvas);
  document.fonts.ready.then(build);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerleave", leave);
  draw();
  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    canvas.removeEventListener("pointermove", move);
    canvas.removeEventListener("pointerleave", leave);
  };
}
