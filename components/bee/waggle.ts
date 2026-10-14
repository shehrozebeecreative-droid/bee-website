import * as THREE from "three";
import gsap from "gsap";
import { run } from "../scenes";

/**
 * "Waggle dance" gallery: image cards fly a figure-eight with a wiggling straight run through the
 * middle (how honeybees point the hive to good flowers), leaving a honey trail, then settle into
 * two staggered rows. `setProgress(p)` takes 0..1 of the pin; returns how far the final layout is (0..1).
 */
export function waggleScene(canvas: HTMLCanvasElement, hoverArea: HTMLElement, share: number, images: string[]) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  camera.position.set(0, 0, 26);

  // Flight path: enter low-left, loop left, waggle run through the centre, loop right, leave top-right.
  const curve = new THREE.CatmullRomCurve3(
    [
      [-24, -12, 3], [-13, -4, 0], [-8, 3, -2], [-12, 6, -6], [-16, 2, -7], [-12, -2, -4],
      [-6, 0, -1], [-3, 0.9, 0], [0, -0.9, 0.6], [3, 0.9, 0], [6, 0, -1],
      [12, -2, -4], [16, 2, -7], [12, 6, -6], [8, 9, -3], [16, 13, -3], [28, 18, -4],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false, "centripetal",
  );
  const PATH = curve.getLength();
  const LEN = 4.2, HEIGHT = 3, PITCH = 4.6, COLS = 60;
  const COUNT = images.length;
  const TRAIN = (COUNT - 1) * PITCH + LEN;

  const loader = new THREE.TextureLoader();
  const vert = `varying vec2 vUv; uniform float uWave; uniform float uTime;
    void main(){ vUv = uv; vec3 p = position; p.z += uWave * sin(uv.x * 3. - uTime * 2.) * .6;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); }`;
  const frag = `uniform sampler2D map; uniform vec2 uSize; uniform vec2 uCrop; uniform float uRadius; varying vec2 vUv;
    void main(){
      vec2 q = abs((vUv - .5) * uSize) - uSize * .5 + uRadius;
      float d = min(max(q.x, q.y), 0.) + length(max(q, 0.)) - uRadius;
      float a = 1. - smoothstep(-.5, .5, d);
      if (a <= 0.) discard;
      vec2 uv = .5 + (vUv - .5) * uCrop;
      gl_FragColor = vec4(texture2D(map, uv).rgb, a);
    }`;
  // Textures are queued and only downloaded when the gallery is near (see loadTextures).
  const queue: (() => void)[] = [];
  let texturesLoaded = false;
  const material = (src: string, aspect: number) => {
    const u = {
      map: { value: null as THREE.Texture | null }, uSize: { value: new THREE.Vector2(400, 300) },
      uCrop: { value: new THREE.Vector2(1, 1) }, uRadius: { value: 14 }, uWave: { value: 0 }, uTime: { value: 0 },
    };
    queue.push(() => {
      u.map.value = loader.load(src, (t) => {
        const img = t.image as HTMLImageElement, r = aspect / (img.width / img.height);
        u.uCrop.value.set(r < 1 ? r : 1, r < 1 ? 1 : 1 / r); // "cover" crop
      });
      u.map.value.colorSpace = THREE.SRGBColorSpace;
    });
    return new THREE.ShaderMaterial({ uniforms: u, vertexShader: vert, fragmentShader: frag, transparent: true, side: THREE.DoubleSide });
  };

  // Flying strip cards: geometry re-laid along the curve each frame.
  const flyers = images.map((src) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, COLS, 1), material(src, LEN / HEIGHT));
    m.frustumCulled = false;
    m.userData.hover = 1;
    (m.material as THREE.ShaderMaterial).uniforms.uSize.value.set(LEN * 40, HEIGHT * 40);
    scene.add(m);
    return m;
  });
  const Z = new THREE.Vector3(0, 0, 1), P = new THREE.Vector3(), T = new THREE.Vector3(), S = new THREE.Vector3();
  const lay = (m: THREE.Mesh, start: number, k: number) => {
    const a = m.geometry.attributes.position;
    const len = LEN * k, h = HEIGHT * k, s0 = start + (LEN - len) / 2;
    for (let c = 0; c <= COLS; c++) {
      const u = THREE.MathUtils.clamp((s0 + (c / COLS) * len) / PATH, 0, 1);
      curve.getPointAt(u, P);
      curve.getTangentAt(u, T);
      S.crossVectors(Z, T).normalize().applyAxisAngle(T, 0.35 * Math.sin(u * Math.PI * 5)); // gentle banking
      for (let r = 0; r < 2; r++) {
        const o = (r === 0 ? 0.5 : -0.5) * h;
        a.setXYZ(r * (COLS + 1) + c, P.x + S.x * o, P.y + S.y * o, P.z + S.z * o);
      }
    }
    a.needsUpdate = true;
  };

  // Honey trail dots behind the lead card.
  const TRAIL = 700;
  const trailGeo = new THREE.BufferGeometry().setFromPoints(curve.getSpacedPoints(TRAIL));
  trailGeo.setDrawRange(0, 0);
  const trailMat = new THREE.PointsMaterial({ color: 0xfee12c, size: 0.12, transparent: true, opacity: 0.85, depthWrite: false });
  const trail = new THREE.Points(trailGeo, trailMat);
  trail.renderOrder = -1; // drawn first, so the cards always sit on top of it
  scene.add(trail);

  // Final layout: two staggered rows (3 over 4).
  const settled = images.slice(0, 7).map((src) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 24, 12), material(src, 1.25));
    m.visible = false;
    m.frustumCulled = false;
    m.userData.wave = 1;
    scene.add(m);
    return m;
  });
  const view = () => {
    const hh = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    return { hh, hw: hh * camera.aspect };
  };
  const slots = () => {
    const { hh, hw } = view(), narrow = innerWidth < 768;
    const gap = narrow ? 0.4 : 0.8;
    const w = Math.min(((hw * 2 * 0.86) - 3 * gap) / 4, ((hh * 2 * 0.62) - gap) / 2 * 1.25);
    const h = w / 1.25;
    const rows = [3, 4];
    const out: { x: number; y: number; w: number; h: number }[] = [];
    rows.forEach((n, r) => {
      for (let i = 0; i < n; i++) out.push({ x: (i - (n - 1) / 2) * (w + gap), y: (r ? -1 : 1) * (h + gap) / 2, w, h });
    });
    return out;
  };

  // Hover: grow the flyer under the pointer.
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  let pointerIn = false;
  const move = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    pointerIn = true;
  };
  const leave = () => (pointerIn = false);
  hoverArea.addEventListener("pointermove", move);
  hoverArea.addEventListener("pointerleave", leave);

  const settleStart = 0.62; // fraction of the ribbon share where cards start settling
  const settle = (p: number) => gsap.utils.clamp(0, 1, (Math.min(1, p / share) - settleStart) / (1 - settleStart));
  let target = 0, smooth = 0, last = 0;

  const dispose = run(canvas, scene, camera, (t) => {
    const dt = Math.min(0.05, t - last || 1 / 60);
    last = t;
    camera.position.z = innerWidth < 768 ? 40 : 26;
    smooth += (target - smooth) * (1 - Math.pow(0.002, dt));
    const g = Math.min(1, smooth / share);
    const fly = Math.min(1, g / (settleStart + 0.18)); // flight finishes a little after settling begins

    const lead = fly * (PATH + TRAIN) - TRAIN + 2;
    let hovered: THREE.Object3D | null = null;
    if (pointerIn) {
      ray.setFromCamera(mouse, camera);
      hovered = ray.intersectObjects(flyers.filter((f) => f.visible), false)[0]?.object ?? null;
    }
    flyers.forEach((m, i) => {
      const s = lead + PITCH * i;
      m.visible = fly < 1 && s > -LEN && s < PATH;
      m.userData.hover += ((m === hovered ? 1.15 : 1) - m.userData.hover) * (1 - Math.pow(0.001, dt));
      if (m.visible) lay(m, s, m.userData.hover);
    });
    const head = gsap.utils.clamp(0, 1, (lead + TRAIN) / PATH);
    trailGeo.setDrawRange(0, Math.round(head * TRAIL));

    const H = settle(smooth);
    trailMat.opacity = 0.85 * (1 - gsap.utils.clamp(0, 1, H * 1.6)); // trail fades as the cards land
    const sl = slots();
    const { hh } = view();
    settled.forEach((m, i) => {
      const k = gsap.utils.clamp(0, 1, (H - 0.07 * i) / 0.45);
      const u = (m.material as THREE.ShaderMaterial).uniforms;
      m.visible = k > 0;
      if (!m.visible) return;
      const e = 1 - Math.pow(1 - k, 3), s = sl[i];
      // Each card swoops in from below along a short arc, like landing on a flower.
      const fromX = s.x * 2.2, fromY = -hh - s.h;
      m.position.set(fromX + (s.x - fromX) * e, fromY + (s.y - fromY) * e + Math.sin(e * Math.PI) * 2, (1 - e) * 4);
      m.rotation.z = (1 - e) * (i % 2 ? 0.5 : -0.5);
      m.scale.set(s.w, s.h, 1);
      u.uSize.value.set(s.w * 40, s.h * 40);
      m.userData.wave = k < 1 ? Math.min(1, m.userData.wave + 2 * dt) : Math.max(0, m.userData.wave - 0.8 * dt);
      u.uWave.value = m.userData.wave;
      u.uTime.value += dt;
    });
  });

  return {
    /** Download the gallery images (call when the section is approaching). */
    loadTextures() {
      if (texturesLoaded) return;
      texturesLoaded = true;
      queue.forEach((load) => load());
    },
    setProgress(p: number) {
      target = p;
      return settle(p);
    },
    dispose() {
      hoverArea.removeEventListener("pointermove", move);
      hoverArea.removeEventListener("pointerleave", leave);
      dispose();
    },
  };
}
