import * as THREE from "three";

/**
 * Original stylised 3D bee for Bee Creative: a gold/black striped abdomen built from separate
 * segments with small gaps (echoing the striped mark in the logo), glossy head with big eyes,
 * curled antennae, iridescent flapping wings, legs and a stinger.
 * Body axis runs along +x (head at +x). Each top-level part can be scattered and reassembled.
 */
export function buildBee() {
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xffd21f, metalness: 0.35, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.1, sheen: 0.6, sheenColor: new THREE.Color(0xfff2a8) });
  const black = new THREE.MeshPhysicalMaterial({ color: 0x0d0c0a, metalness: 0.2, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.15 });
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0x050505, metalness: 0.1, roughness: 0.05, clearcoat: 1 });
  const wingMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, transparent: true, opacity: 0.32, roughness: 0.1, metalness: 0, iridescence: 1, iridescenceIOR: 1.6,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const veinMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 });

  const group = new THREE.Group();
  const parts: THREE.Object3D[] = [];

  // Abdomen: a teardrop profile sliced into alternating stripes (lathe around the x axis).
  const radius = (x: number) => {
    // x from -1.9 (stinger end) to 0.15 (waist)
    const t = (x + 1.9) / 2.05;
    return Math.max(0.02, Math.sin(Math.PI * Math.pow(t, 0.8)) * 0.92 * (0.55 + 0.45 * t));
  };
  const bands = [-1.9, -1.45, -1.02, -0.6, -0.2, 0.15];
  for (let b = 0; b < bands.length - 1; b++) {
    const x0 = bands[b] + (b ? 0.025 : 0), x1 = bands[b + 1] - 0.025;
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 16; i++) {
      const x = x0 + ((x1 - x0) * i) / 16;
      pts.push(new THREE.Vector2(radius(x), x));
    }
    const geo = new THREE.LatheGeometry(pts, 64);
    geo.rotateZ(-Math.PI / 2); // lathe axis y → body axis x
    const seg = new THREE.Mesh(geo, b % 2 ? black : gold);
    group.add(seg);
    parts.push(seg);
  }
  // Stinger
  const stinger = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.4, 16), black);
  stinger.rotation.z = Math.PI / 2;
  stinger.position.x = -2.05;
  group.add(stinger);
  parts.push(stinger);

  // Thorax (fuzzy-looking gold with dark collar)
  const thorax = new THREE.Group();
  const thoraxBall = new THREE.Mesh(new THREE.SphereGeometry(0.62, 48, 32), gold);
  thoraxBall.scale.set(1.05, 0.95, 0.95);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.09, 16, 48), black);
  collar.rotation.y = Math.PI / 2;
  collar.position.x = 0.48;
  thorax.add(thoraxBall, collar);
  thorax.position.x = 0.72;
  group.add(thorax);
  parts.push(thorax);

  // Head with eyes, a little smile-free face and curled antennae
  const head = new THREE.Group();
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.46, 48, 32), black);
  head.add(skull);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 24), eyeMat);
    eye.scale.set(0.8, 1.25, 0.7);
    eye.position.set(0.24, 0.08, side * 0.32);
    eye.rotation.y = side * -0.5;
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    glint.position.set(0.31, 0.2, side * 0.36);
    const ant = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.2, 0.35, side * 0.15),
      new THREE.Vector3(0.45, 0.85, side * 0.32),
      new THREE.Vector3(0.85, 1.05, side * 0.42),
      new THREE.Vector3(1.0, 0.92, side * 0.45),
    ]);
    const antenna = new THREE.Mesh(new THREE.TubeGeometry(ant, 32, 0.028, 8), black);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), gold);
    tip.position.copy(ant.getPoint(1));
    head.add(eye, glint, antenna, tip);
  }
  head.position.x = 1.62;
  group.add(head);
  parts.push(head);

  // Wings: two pairs on hinges over the thorax; flap in tick().
  const wingShape = (len: number, wid: number) => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(len * 0.25, wid * 1.1, len * 0.9, wid * 1.05, len, wid * 0.25);
    s.bezierCurveTo(len * 1.02, -wid * 0.2, len * 0.6, -wid * 0.45, 0, 0);
    return s;
  };
  const wings: { pivot: THREE.Group; side: number; phase: number }[] = [];
  const makeWing = (side: number, len: number, wid: number, back: number, phase: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(0.7 - back, 0.5, side * 0.12);
    const shape = wingShape(len, wid);
    const g = new THREE.ShapeGeometry(shape, 24);
    // Wing lies in the x-z plane, pointing out sideways and slightly back.
    const wing = new THREE.Mesh(g, wingMat);
    wing.rotation.x = side * -Math.PI / 2;
    wing.rotation.y = side * 0.35;
    const vein = new THREE.Line(new THREE.BufferGeometry().setFromPoints(shape.getPoints(40).map((p) => new THREE.Vector3(p.x, p.y, 0))), veinMat);
    vein.rotation.copy(wing.rotation);
    pivot.add(wing, vein);
    pivot.rotation.y = side * -0.6 + Math.PI / 2 * 0; // sweep back
    group.add(pivot);
    parts.push(pivot);
    wings.push({ pivot, side, phase });
  };
  makeWing(1, 1.7, 0.62, 0, 0);
  makeWing(-1, 1.7, 0.62, 0, 0);
  makeWing(1, 1.15, 0.42, 0.35, 0.4);
  makeWing(-1, 1.15, 0.42, 0.35, 0.4);

  // Legs: three pairs of bent tubes under the thorax.
  const legs = new THREE.Group();
  [-0.25, 0.1, 0.45].forEach((x, i) => {
    for (const side of [-1, 1]) {
      const c = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x, -0.35, side * 0.25),
        new THREE.Vector3(x + 0.05, -0.7, side * 0.55),
        new THREE.Vector3(x - 0.15 + i * 0.05, -1.05, side * 0.6),
      ]);
      legs.add(new THREE.Mesh(new THREE.TubeGeometry(c, 16, 0.04, 6), black));
    }
  });
  legs.position.x = 0.72;
  group.add(legs);
  parts.push(legs);

  // Centre the bee on the origin.
  group.position.x = 0;
  parts.forEach((p) => (p.position.x -= 0.1));

  const tick = (t: number) => {
    for (const w of wings) {
      const flap = Math.sin(t * 38 + w.phase * Math.PI);
      w.pivot.rotation.x = w.side * (0.25 + flap * 0.65);
    }
  };
  return { group, parts, tick };
}
