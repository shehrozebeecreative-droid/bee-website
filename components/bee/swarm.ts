import * as THREE from "three";
import gsap from "gsap";

/**
 * "The Swarm": one full-screen cloud of honey particles that morphs between formations as you
 * scroll. Particles flee the pointer, burst when you press and hold, and buzz gently at rest.
 * One formation can be a spinning globe with a Karachi beacon and flight arcs to the world.
 *
 * setMorph(f): f is a float index into the formation list — 2.4 means 40% of the way from form 2 to 3.
 */
export type GlobeSpec = { index: number; center: THREE.Vector3; radius: number; home: [number, number]; targets: [number, number][] };

export function createSwarm(canvas: HTMLCanvasElement, forms: Float32Array[], count: number, globe?: GlobeSpec, heroPivot?: THREE.Vector3, heroTail?: THREE.Vector3) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0, 14);

  const geo = new THREE.BufferGeometry();
  const from = new Float32Array(count * 3), to = new Float32Array(count * 3);
  const rnd = new Float32Array(count * 4), size = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const v = new THREE.Vector3().randomDirection();
    rnd.set([v.x, v.y, v.z, Math.random()], i * 4);
    size[i] = Math.random() < 0.06 ? 2.2 : 0.7 + Math.random() * 0.8;
  }
  from.set(forms[0]);
  to.set(forms[Math.min(1, forms.length - 1)]);
  geo.setAttribute("position", new THREE.BufferAttribute(from, 3));
  geo.setAttribute("aFrom", new THREE.BufferAttribute(from, 3));
  geo.setAttribute("aTo", new THREE.BufferAttribute(to, 3));
  geo.setAttribute("aRand", new THREE.BufferAttribute(rnd, 4));
  geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));

  const uniforms = {
    uMix: { value: 0 }, uTime: { value: 0 }, uMouse: { value: new THREE.Vector3(99, 99, 0) },
    uBurst: { value: 0 }, uPixel: { value: renderer.getPixelRatio() }, uOpacity: { value: 1 },
    uColor: { value: new THREE.Color(0xfee12c) },
    uSpin: { value: 0 }, uTilt: { value: 0 }, uClean: { value: 0 }, uSpinCenter: { value: globe?.center.clone() ?? new THREE.Vector3() },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec3 aFrom; attribute vec3 aTo; attribute vec4 aRand; attribute float aSize;
      uniform float uMix, uTime, uBurst, uPixel, uSpin, uTilt, uClean; uniform vec3 uMouse, uSpinCenter;
      varying float vGlow; varying float vSeed; varying float vBack; varying float vClean;
      void main(){
        vClean = uClean;
        float d = aRand.w;
        float m = smoothstep(d * .45, d * .45 + .55, uMix);
        vec3 p = mix(aFrom, aTo, m);
        // globe spin (uSpin is already weighted by how "globe" the current formation is)
        vec3 q = p - uSpinCenter; float c = cos(uSpin), s = sin(uSpin);
        vec3 r = vec3(q.x * c + q.z * s, q.y, -q.x * s + q.z * c);
        float ct = cos(uTilt), st = sin(uTilt);
        r = vec3(r.x, r.y * ct - r.z * st, r.y * st + r.z * ct);       // axial tilt
        p = uSpinCenter + r;
        vBack = uSpin != 0. ? smoothstep(.2, -.6, r.z) : 0.;
        p += aRand.xyz * sin(m * 3.14159) * 1.6;                       // swoop between formations
        p += .03 * (1. - uClean) * vec3(sin(uTime * 7. + d * 60.), cos(uTime * 6. + d * 47.), sin(uTime * 5. + d * 31.)); // buzz (calm on the globe)
        vec2 dm = p.xy - uMouse.xy;
        float f = smoothstep(0.6, 0., length(dm));                    // small hover radius
        p.xy += normalize(dm + 1e-4) * f * 0.35;                       // flee the pointer, gently
        p.z += f * 0.3;
        p += aRand.xyz * uBurst * (3. + d * 7.);                        // press & hold burst
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = mix(aSize, .8, uClean) * uPixel * (40. / -mv.z); // uniform dots on the globe
        vGlow = f + uBurst * .5; vSeed = d;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity;
      varying float vGlow; varying float vSeed; varying float vBack; varying float vClean;
      void main(){
        float r = length(gl_PointCoord - .5);
        float a = smoothstep(.5, .0, r);
        vec3 c = mix(uColor, vec3(1.), clamp(vGlow * .7 + step(.965, vSeed) * .6 * (1. - vClean), 0., 1.));
        gl_FragColor = vec4(c, a * uOpacity * mix(.6 + .4 * vSeed, .85, vClean) * (1. - vBack * .75));
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  /* ── Globe overlay: graticule, atmosphere, Karachi beacon and sequential flights.
     tilt (x) wraps spin (y), matching the shader: p = Rx(tilt) · Ry(spin) · q */
  const overlay = new THREE.Group(), tiltG = new THREE.Group(), spinG = new THREE.Group();
  const overlayMats: { m: THREE.Material & { opacity: number }; base: number }[] = [];
  type Flight = { pts: THREE.Vector3[]; line: THREE.Line; head: THREE.Mesh; ring: THREE.Mesh };
  const flights: Flight[] = [];
  let beacon: THREE.Mesh | null = null, ring: THREE.Mesh | null = null, occluder: THREE.Mesh | null = null;
  if (globe) {
    overlay.position.copy(globe.center);
    overlay.add(tiltG);
    tiltG.add(spinG);
    scene.add(overlay);
    const R = globe.radius;
    const ll = (lat: number, lon: number, r = R) => {
      const phi = THREE.MathUtils.degToRad(90 - lat), th = THREE.MathUtils.degToRad(lon + 180);
      return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
    };
    const add = <T extends THREE.Material & { opacity: number }>(m: T, base: number) => (overlayMats.push({ m, base }), m);
    const honey = (base: number) => add(new THREE.LineBasicMaterial({ color: 0xfee12c, transparent: true, depthWrite: false }), base);

    // Hides the far side of arcs, graticule and particles behind the planet.
    occluder = new THREE.Mesh(new THREE.SphereGeometry(R * 0.97, 48, 32), new THREE.MeshBasicMaterial({ colorWrite: false }));
    occluder.renderOrder = -1;
    spinG.add(occluder);

    // Planet body: dark sphere with a glowing honey rim.
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(R * 0.985, 64, 48),
      add(new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { opacity: { value: 0 } },
        vertexShader: `varying vec3 vN; varying vec3 vV;
          void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `uniform float opacity; varying vec3 vN; varying vec3 vV;
          void main(){ float f = pow(1. - max(dot(vN, vV), 0.), 2.6);
            gl_FragColor = vec4(mix(vec3(.03,.028,.018), vec3(1.,.88,.17), f * .55), (.9 + f * .1) * opacity); }`,
      }) as unknown as THREE.Material & { opacity: number }, 1),
    );
    body.renderOrder = -2;
    spinG.add(body);

    // Faint latitude / longitude lines.
    for (let lat = -60; lat <= 60; lat += 30) {
      const pts = Array.from({ length: 97 }, (_, i) => ll(lat, -180 + (i * 360) / 96, R * 1.003));
      spinG.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), honey(lat === 0 ? 0.16 : 0.08)));
    }
    for (let lon = -180; lon < 180; lon += 30) {
      const pts = Array.from({ length: 65 }, (_, i) => ll(-90 + (i * 180) / 64, lon, R * 1.003));
      spinG.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), honey(0.08)));
    }

    // Soft atmosphere glow.
    const hc = document.createElement("canvas");
    hc.width = hc.height = 256;
    const hg = hc.getContext("2d")!;
    const grd = hg.createRadialGradient(128, 128, 60, 128, 128, 128);
    grd.addColorStop(0, "rgba(254,225,44,0)");
    grd.addColorStop(0.62, "rgba(254,225,44,0.22)");
    grd.addColorStop(1, "rgba(254,225,44,0)");
    hg.fillStyle = grd;
    hg.fillRect(0, 0, 256, 256);
    const halo = new THREE.Sprite(add(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(hc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), 0.9));
    halo.scale.setScalar(R * 2.9);


    // Karachi beacon: white core, pulsing ring, short beam.
    const home = ll(globe.home[0], globe.home[1], R * 1.01);
    beacon = new THREE.Mesh(new THREE.SphereGeometry(R * 0.022, 16, 12), add(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }), 1));
    beacon.position.copy(home);
    ring = new THREE.Mesh(new THREE.RingGeometry(R * 0.04, R * 0.046, 48), add(new THREE.MeshBasicMaterial({ color: 0xfee12c, transparent: true, side: THREE.DoubleSide, depthWrite: false }), 1));
    ring.position.copy(home);
    ring.lookAt(home.clone().multiplyScalar(2));
    spinG.add(beacon, ring, new THREE.Line(new THREE.BufferGeometry().setFromPoints([home, home.clone().multiplyScalar(1.3)]), honey(0.9)));
    // "KARACHI" label floating beside the beacon.
    const lc = document.createElement("canvas");
    lc.width = 512;
    lc.height = 96;
    const lg = lc.getContext("2d")!;
    lg.font = "600 44px ui-monospace, Consolas, monospace";
    lg.fillStyle = "#fee12c";
    lg.textBaseline = "middle";
    lg.fillText("KARACHI", 8, 48);
    const label = new THREE.Sprite(add(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(lc), transparent: true, depthWrite: false }), 1));
    label.scale.set(R * 0.5, R * 0.094, 1);
    label.center.set(-0.1, 0.5); // anchor the label's left edge just right of the beacon
    label.position.copy(home.clone().multiplyScalar(1.02));
    spinG.add(label);

    // One flight per destination: the line draws itself, a dot rides the tip, the city pulses on arrival.
    const fromDir = home.clone().normalize();
    for (const [lat, lon] of globe.targets) {
      const toDir = ll(lat, lon, 1).normalize(), ang = fromDir.angleTo(toDir), pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 64; i++) {
        const t = i / 64;
        const v = fromDir.clone().multiplyScalar(Math.sin((1 - t) * ang)).addScaledVector(toDir, Math.sin(t * ang)).divideScalar(Math.sin(ang));
        pts.push(v.multiplyScalar(R * (1.01 + Math.sin(Math.PI * t) * (0.1 + ang * 0.14))));
      }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xfee12c, transparent: true, depthWrite: false }));
      const head = new THREE.Mesh(new THREE.SphereGeometry(R * 0.022, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
      const dest = new THREE.Mesh(new THREE.RingGeometry(R * 0.03, R * 0.042, 32), new THREE.MeshBasicMaterial({ color: 0xfee12c, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      dest.position.copy(pts[pts.length - 1]);
      dest.lookAt(dest.position.clone().multiplyScalar(2));
      spinG.add(line, head, dest);
      flights.push({ pts, line, head, ring: dest });
    }
    overlay.visible = false;
  }

  // Pointer → world point on z=0 plane.
  let hasPointer = false;
  const ndc = new THREE.Vector2(0, 0), ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const aim = new THREE.Vector3(99, 99, 0);
  const move = (e: PointerEvent) => {
    hasPointer = true;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  };
  addEventListener("pointermove", move);

  let cur = -1, globeAmt = 0, lastF = 0, globeScroll = 0.5;
  const setMorph = (f: number) => {
    const max = forms.length - 1;
    f = THREE.MathUtils.clamp(f, 0, max);
    lastF = f;
    const i = Math.min(Math.floor(f), max - 1);
    if (i !== cur) {
      cur = i;
      from.set(forms[i]);
      to.set(forms[i + 1]);
      geo.attributes.aFrom.needsUpdate = true;
      geo.attributes.aTo.needsUpdate = true;
    }
    uniforms.uMix.value = f - i;
    if (globe) globeAmt = THREE.MathUtils.clamp(1 - Math.abs(f - globe.index) * 1.4, 0, 1);
  };
  setMorph(0);

  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  addEventListener("resize", resize);
  resize();

  const t0 = performance.now();
  let raf = 0, last = 0, cleared = false, trailFadeStart = -1, landT = 0;
  let heading: number | null = null; // smoothed body angle during the intro flight
  const follow = new THREE.Vector2();
  // Intro flight: the bee enters tiny from the top-left corner, loops along a path and grows into place.
  const INTRO = 4.0, TRAIL_FADE = 1.6, TRAIL_PTS = 420;
  let introStart = -1, introCurve: THREE.CatmullRomCurve3 | null = null;
  // Dotted honey trail the bee leaves behind on its way in.
  const trailMat = new THREE.PointsMaterial({ color: 0xfee12c, size: 0.055, transparent: true, opacity: 0, depthWrite: false });
  const trail = new THREE.Points(new THREE.BufferGeometry(), trailMat);
  trail.frustumCulled = false;
  trail.visible = false;
  scene.add(trail);
  // Flight path: a soft rise along the top, one long sweeping dive, a glide under the bee, then up into
  // the stinger. Built from cubic curves whose handles line up at every joint, so it has no kinks.
  const buildIntroCurve = () => {
    const hh = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z, hw = hh * camera.aspect;
    const P = (heroTail ?? heroPivot!).clone();
    const V = (x: number, y: number) => new THREE.Vector3(x * hw, y * hh, 0);
    const px = P.x / hw, py = P.y / hh, floor = py - 0.1;
    // Base route: soft rise → one long sweeping dive that flattens into a glide → a wide turn up into the tail.
    const S = V(-1.08, 0.56), M1 = V(-0.46, 0.66), M3 = V(px - 0.24, floor - 0.02);
    const path = new THREE.CurvePath<THREE.Vector3>();
    path.add(new THREE.CubicBezierCurve3(S, V(-0.86, 0.5), V(-0.66, 0.68), M1));
    path.add(new THREE.CubicBezierCurve3(M1, V(-0.2, 0.65), V(px - 0.62, floor - 0.02), M3));
    path.add(new THREE.CubicBezierCurve3(M3, V(px - 0.08, floor - 0.02), V(px, py - 0.16), P));
    // Wave-like flight: a gentle sine weave across the route that fades in at the start and out
    // before the landing, so the final rise into the stinger stays clean.
    const base = path.getSpacedPoints(600), A = hh * 0.055, waves = 3.5;
    const pts = base.map((p, k) => {
      const s = k / 600;
      const t = base[Math.min(600, k + 1)].clone().sub(base[Math.max(0, k - 1)]).normalize();
      const env = THREE.MathUtils.smoothstep(s, 0, 0.1) * (1 - THREE.MathUtils.smoothstep(s, 0.62, 0.86));
      return p.clone().add(new THREE.Vector3(-t.y, t.x, 0).multiplyScalar(A * Math.sin(s * Math.PI * 2 * waves) * env));
    });
    return new THREE.CatmullRomCurve3(pts, false, "centripetal");
  };

  const frame = () => {
    raf = requestAnimationFrame(frame);
    if (uniforms.uOpacity.value <= 0.001) {
      if (!cleared) renderer.clear(); // hidden: wipe the last frame once, then idle
      cleared = true;
      return;
    }
    cleared = false;
    const t = (performance.now() - t0) / 1000, dt = Math.min(0.05, t - last);
    last = t;
    uniforms.uTime.value = t;
    ray.setFromCamera(ndc, camera);
    if (hasPointer && ray.ray.intersectPlane(plane, aim)) uniforms.uMouse.value.lerp(aim, 0.18);
    // In the hero the bee follows the pointer: it drifts towards it and tilts in 3D around its own centre.
    const heroAmt = heroPivot ? THREE.MathUtils.clamp(1 - lastF, 0, 1) : 0;
    // (the hero bee no longer follows the mouse — only a gentle hover)
    const idle = Math.sin(t * 0.15) * 0.18 * (1 - globeAmt) * (1 - heroAmt); // slow drift only — no mouse steering
    points.rotation.y = idle + follow.x * 0.55 * heroAmt;
    points.rotation.x = Math.cos(t * 0.11) * 0.06 * (1 - globeAmt) * (1 - heroAmt) - follow.y * 0.4 * heroAmt;
    points.rotation.z = -follow.x * 0.08 * heroAmt;
    if (heroPivot) {
      // keep the rotation centred on the bee, then add the drift (plus a gentle hover)
      const p = heroPivot.clone().multiplyScalar(heroAmt);
      points.position.copy(p).sub(p.clone().applyEuler(points.rotation));
      points.position.x += follow.x * 0.9 * heroAmt;
      // resting hover starts at zero from the landing moment and eases in — no jump when the intro ends
      const since = Math.max(0, t - landT);
      points.position.y += (follow.y * 0.6 + Math.sin(since * 1.3) * 0.08 * Math.min(1, since / 1.5)) * heroAmt;
    }
    if (introStart >= 0 && heroPivot && introCurve) {
      const u = Math.min(1, (t - introStart) / INTRO);
      const e = -(Math.cos(Math.PI * u) - 1) / 2; // gentle sine ease in-out along the path
      trail.visible = true;
      trailMat.opacity = 0.85 * uniforms.uOpacity.value;
      trail.geometry.setDrawRange(0, Math.round(e * TRAIL_PTS));
      const p = introCurve.getPointAt(e), tan = introCurve.getTangentAt(Math.min(e, 0.999));
      const s = 0.08 + 0.92 * Math.pow(e, 6); // stays small while flying, grows as it lands
      points.scale.setScalar(s);
      // body axis (tail→head is local +y) points along the flight; eases upright for the landing
      // head-first along the path, easing upright just as it lands
      const upright = THREE.MathUtils.smoothstep(e, 0.72, 1);
      // steer by the path's direction over a short window (ignores the small weave), then ease
      // the body towards it so turns are gradual rather than snapping every frame
      const ahead = introCurve.getPointAt(Math.min(1, e + 0.035)), behind = introCurve.getPointAt(Math.max(0, e - 0.035));
      const target = Math.atan2(-(ahead.x - behind.x), ahead.y - behind.y);
      if (heading === null) heading = target;
      else heading += Math.atan2(Math.sin(target - heading), Math.cos(target - heading)) * (1 - Math.exp(-dt * 5));
      const theta = heading * (1 - upright);
      points.rotation.set(0, 0, theta);
      // the stinger sits exactly on the path point, so the trail flows out of the tail
      const T = (heroTail ?? heroPivot).clone().multiplyScalar(s).applyAxisAngle(new THREE.Vector3(0, 0, 1), theta);
      points.position.copy(p).sub(T);
      if (u >= 1) {
        introStart = -1;
        points.scale.setScalar(1);
        trailFadeStart = t;
        landT = t;
      }
    } else if (trailFadeStart >= 0) {
      // after landing, the trail fades away
      const k = Math.min(1, (t - trailFadeStart) / TRAIL_FADE);
      trailMat.opacity = 0.85 * (1 - k) * uniforms.uOpacity.value;
      if (k >= 1) {
        trail.visible = false;
        trailFadeStart = -1;
      }
    }

    // Globe: spin and tilt while it is the active formation; the overlay fades with it.
    if (globe) {
      // ≈3.4 rad brings Karachi (67°E) round to face us; scroll turns it ±0.6 rad, plus a slow rock.
      uniforms.uSpin.value = (3.4 + (globeScroll - 0.5) * 1.2 + Math.sin(t * 0.18) * 0.12) * globeAmt;
      uniforms.uTilt.value = 0.38 * globeAmt;
      uniforms.uClean.value = globeAmt;
      overlay.visible = globeAmt > 0.02;
      spinG.rotation.y = uniforms.uSpin.value;
      tiltG.rotation.x = uniforms.uTilt.value;
      if (occluder) occluder.visible = globeAmt > 0.9;
      const show = Math.max(0, globeAmt - 0.5) * 2 * uniforms.uOpacity.value;
      overlayMats.forEach(({ m, base }) => {
        m.opacity = base * show;
        const u = (m as unknown as { uniforms?: { opacity: { value: number } } }).uniforms;
        if (u?.opacity) u.opacity.value = base * show;
      });
      const pulse = (t * 0.7) % 1;
      ring?.scale.setScalar(1 + pulse * 1.6);
      if (ring) (ring.material as THREE.MeshBasicMaterial).opacity = (1 - pulse) * show;
      beacon?.scale.setScalar(1 + Math.sin(t * 4) * 0.15);
      // Flights launch one after another; the three most recent are on screen.
      const s = t / 1.25, N = flights.length;
      flights.forEach((f, k) => {
        const age = (((s - k) % N) + N) % N;
        const on = age < 3;
        f.line.visible = f.head.visible = f.ring.visible = on;
        if (!on) return;
        const draw = Math.min(1, age / 1.1), fade = age < 2 ? 1 : 1 - (age - 2);
        f.line.geometry.setDrawRange(0, Math.max(2, Math.round(draw * f.pts.length)));
        (f.line.material as THREE.LineBasicMaterial).opacity = 0.75 * fade * show;
        const idx = draw * (f.pts.length - 1), lo = Math.floor(idx);
        f.head.position.copy(f.pts[lo]).lerp(f.pts[Math.min(lo + 1, f.pts.length - 1)], idx - lo);
        (f.head.material as THREE.MeshBasicMaterial).opacity = (draw < 1 ? 1 : 0) * show;
        const land = THREE.MathUtils.clamp((age - 1.1) / 0.9, 0, 1);
        f.ring.scale.setScalar(1 + land * 2.5);
        (f.ring.material as THREE.MeshBasicMaterial).opacity = (land > 0 && land < 1 ? 1 - land : 0) * show;
      });
    }
    renderer.render(scene, camera);
  };
  frame();

  return {
    setMorph,
    /** Re-read the formation arrays (after a shape has been rebuilt in place). */
    refresh(f: number) {
      cur = -1;
      setMorph(f);
    },
    setOpacity: (o: number) => void (uniforms.uOpacity.value = o),
    /** Play the hero intro flight (call once on load). */
    intro() {
      if (!heroPivot) return;
      introCurve = buildIntroCurve();
      trail.geometry.setFromPoints(introCurve.getSpacedPoints(TRAIL_PTS));
      trail.geometry.setDrawRange(0, 0);
      introStart = (performance.now() - t0) / 1000;
      heading = null;
    },
    /** 0..1 progress through the globe's section — steers its rotation. */
    setGlobeScroll: (p: number) => void (globeScroll = p),
    burst: (on: boolean) => gsap.to(uniforms.uBurst, { value: on ? 1 : 0, duration: on ? 0.9 : 1.6, ease: on ? "expo.out" : "elastic.out(1,0.5)" }),
    dispose() {
      cancelAnimationFrame(raf);
      removeEventListener("pointermove", move);
      removeEventListener("resize", resize);
      renderer.dispose();
    },
  };
}

/* ───────────────────────── Formation builders (all return count×3 floats) ───────────────────────── */

export type Place = { x?: number; y?: number; width: number; depth?: number };

/** Canvas fonts can't use CSS variables, so resolve next/font's generated family name. */
export const syneFamily = () =>
  (typeof document !== "undefined" && getComputedStyle(document.documentElement).getPropertyValue("--font-syne").trim()) || "Arial, sans-serif";

/** Rasterise a drawing, crop to what was drawn, and scatter `count` particles over it (centred on place.x/y). */
function sample(count: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, place: Place, W = 520, H = 520) {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = g.strokeStyle = "#fff";
  draw(g, W, H);
  const px = g.getImageData(0, 0, W, H).data;
  const hits: number[] = [];
  let x0 = W, x1 = 0, y0 = H, y1 = 0;
  for (let i = 0; i < W * H; i++) {
    if (px[i * 4 + 3] <= 120) continue;
    hits.push(i);
    const x = i % W, y = (i / W) | 0;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  const out = new Float32Array(count * 3);
  const s = place.width / Math.max(1, x1 - x0), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, depth = place.depth ?? 0.3;
  for (let i = 0; i < count; i++) {
    const k = hits[(Math.random() * hits.length) | 0] ?? 0;
    const x = (k % W) + Math.random(), y = ((k / W) | 0) + Math.random();
    out[i * 3] = (place.x ?? 0) + (x - cx) * s;
    out[i * 3 + 1] = (place.y ?? 0) - (y - cy) * s;
    out[i * 3 + 2] = (Math.random() + Math.random() - 1) * depth;
  }
  const toWorld = (px: number, py: number): [number, number] => [(place.x ?? 0) + (px - cx) * s, (place.y ?? 0) - (py - cy) * s];
  return Object.assign(out, { toWorld });
}

/** The full Bee Creative mark: the looping "b" wrapped around the striped bee (paths from the logo SVG). */
export function formLogo(count: number, svgText: string, place: Place): Float32Array & { tail: [number, number] } {
  const yellow = [...svgText.matchAll(/class="cls-2" d="([^"]*)"/g)].map((m) => m[1]);
  const bLetter = [...svgText.matchAll(/class="cls-1" d="([^"]*)"/g)].map((m) => m[1])[0];
  const arr = sample(count, (g) => {
    g.translate(10, 10);
    g.scale(1.75, 1.75); // mark spans ~0–230 × 0–275 in SVG units
    if (bLetter) g.fill(new Path2D(bLetter));
    yellow.forEach((d) => g.fill(new Path2D(d)));
  }, { depth: 0.12, ...place }); // shallow depth keeps the mark crisp while the swarm sways
  // stinger tip in the SVG is (142.85, 271.71); same translate/scale as the drawing above
  return Object.assign(arr, { tail: arr.toWorld(10 + 1.75 * 142.85, 10 + 1.75 * 271.71) });
}

/** Large particle text (numbers), kept shallow so it reads crisp. */
export function formText(count: number, text: string, place: Place) {
  return sample(count, (g, w, h) => {
    g.font = `800 ${h * 0.62}px ${syneFamily()}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, w / 2, h / 2);
  }, { depth: 0.1, ...place }, 1000, 360);
}

/** Outline icons — particles gather on strokes, which reads crisper than fills. */
export function formIcon(count: number, kind: "shopify" | "code" | "pen" | "chart" | "plane", place: Place) {
  return sample(count, (g, w, h) => {
    g.lineWidth = w * 0.032;
    g.lineJoin = g.lineCap = "round";
    const L = (pts: number[][], close = false) => {
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x * w, y * h) : g.moveTo(x * w, y * h)));
      if (close) g.closePath();
      g.stroke();
    };
    if (kind === "shopify") {
      // Shopping bag with an "S" — the Shopify-store idea.
      L([[0.2, 0.3], [0.8, 0.3], [0.84, 0.9], [0.16, 0.9]], true);
      g.beginPath(); g.arc(w * 0.5, h * 0.3, w * 0.14, Math.PI, 0); g.stroke();
      g.font = `800 ${h * 0.42}px ${syneFamily()}`;
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("S", w * 0.5, h * 0.63);
    } else if (kind === "code") {
      g.beginPath(); g.roundRect(w * 0.05, h * 0.16, w * 0.9, h * 0.68, w * 0.05); g.stroke();
      L([[0.05, 0.3], [0.95, 0.3]]);
      [0.12, 0.18, 0.24].forEach((x) => { g.beginPath(); g.arc(x * w, h * 0.23, w * 0.016, 0, 7); g.fill(); });
      g.lineWidth = w * 0.04;
      L([[0.36, 0.44], [0.25, 0.57], [0.36, 0.7]]);
      L([[0.64, 0.44], [0.75, 0.57], [0.64, 0.7]]);
      L([[0.55, 0.42], [0.45, 0.72]]);
    } else if (kind === "pen") {
      // Vector pen nib — branding & identity work.
      L([[0.38, 0.1], [0.62, 0.1], [0.62, 0.24], [0.38, 0.24]], true);
      L([[0.36, 0.3], [0.64, 0.3], [0.78, 0.55], [0.5, 0.95], [0.22, 0.55]], true);
      g.beginPath(); g.arc(w * 0.5, h * 0.56, w * 0.05, 0, 7); g.stroke();
      L([[0.5, 0.61], [0.5, 0.95]]);
    } else if (kind === "chart") {
      [[0.12, 0.64], [0.32, 0.52], [0.52, 0.4], [0.72, 0.26]].forEach(([x, y]) => { g.beginPath(); g.roundRect(x * w, y * h, 0.12 * w, (0.88 - y) * h, 0.015 * w); g.stroke(); });
      L([[0.08, 0.48], [0.4, 0.28], [0.56, 0.34], [0.88, 0.08]]);
      L([[0.76, 0.08], [0.88, 0.08], [0.88, 0.2]]);
    } else {
      // Paper plane with a dotted trail.
      L([[0.14, 0.48], [0.92, 0.12], [0.62, 0.84], [0.46, 0.6]], true);
      L([[0.46, 0.6], [0.92, 0.12]]);
      L([[0.46, 0.6], [0.44, 0.78], [0.54, 0.68]]);
      for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(w * (0.12 - k * 0.025), h * (0.62 + k * 0.08), w * 0.014, 0, 7); g.fill(); }
    }
  }, place);
}

/** Gauge dial: most particles on the filled arc, the rest on a thin track ring and tick marks. */
export function formGauge(count: number, frac: number, place: { x?: number; y?: number; r: number }) {
  const out = new Float32Array(count * 3), R = place.r, cx = place.x ?? 0, cy = place.y ?? 0;
  for (let i = 0; i < count; i++) {
    const roll = Math.random();
    let a: number, r: number;
    if (roll < 0.72) {
      a = Math.PI / 2 - Math.random() * frac * Math.PI * 2; // clockwise from 12 o'clock
      r = R + (Math.random() - 0.5) * R * 0.14;
    } else if (roll < 0.9) {
      a = Math.random() * Math.PI * 2;
      r = R * 0.82 + (Math.random() - 0.5) * R * 0.02;
    } else {
      a = Math.PI / 2 - Math.floor(Math.random() * 60) * ((Math.PI * 2) / 60);
      r = R * (1.14 + Math.random() * 0.07);
    }
    out.set([cx + Math.cos(a) * r, cy + Math.sin(a) * r, (Math.random() - 0.5) * 0.25], i * 3);
  }
  return out;
}

export function formNebula(count: number, spread = [11, 6, 5]) {
  const out = new Float32Array(count * 3);
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  for (let i = 0; i < count; i++) out.set([gauss() * spread[0], gauss() * spread[1], gauss() * spread[2]], i * 3);
  return out;
}

/** Earth as a dotted world map: evenly spaced (Fibonacci) dots on land only. */
export function formEarth(count: number, landMask: ImageData, place: { x?: number; y?: number; r: number }) {
  const { width: W, height: H, data } = landMask;
  const isLand = (lat: number, lon: number) => {
    const x = Math.min(W - 1, Math.floor(((lon + 180) / 360) * W)), y = Math.min(H - 1, Math.floor(((90 - lat) / 180) * H));
    return data[(y * W + x) * 4 + 3] > 100;
  };
  // ~29% of the sphere is land: sample enough lattice points that land alone fills `count`.
  const total = Math.round(count / 0.27), golden = Math.PI * (3 - Math.sqrt(5));
  const land: number[] = [];
  for (let i = 0; i < total; i++) {
    const y = 1 - (i / (total - 1)) * 2, rr = Math.sqrt(1 - y * y), th = golden * i;
    const lat = THREE.MathUtils.radToDeg(Math.asin(y));
    let lon = THREE.MathUtils.radToDeg(Math.atan2(Math.sin(th), Math.cos(th)));
    if (lon < -180) lon += 360;
    if (isLand(lat, lon)) land.push(lat, lon);
  }
  const out = new Float32Array(count * 3), n = land.length / 2;
  for (let i = 0; i < count; i++) {
    const k = i < n ? i : (Math.random() * n) | 0; // extra particles double up on land dots
    const lat = land[k * 2], lon = land[k * 2 + 1];
    const phi = THREE.MathUtils.degToRad(90 - lat), th = THREE.MathUtils.degToRad(lon + 180), r = place.r;
    out.set([(place.x ?? 0) - r * Math.sin(phi) * Math.cos(th), (place.y ?? 0) + r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th)], i * 3);
  }
  return out;
}

export function formWave(count: number) {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * 30, z = (Math.random() - 0.5) * 10;
    out.set([x, -3.2 + Math.sin(x * 0.35) * 0.9 + Math.cos(z * 0.6 + x * 0.2) * 0.5, z - 2], i * 3);
  }
  return out;
}

/** A grid of small marks — "every dot is a store", "every star is a review". */
export function formGrid(count: number, kind: "dots" | "stars", cols: number, rows: number, place: Place) {
  return sample(count, (g, w, h) => {
    const cw = w / cols, ch = cw;
    const oy = (h - ch * rows) / 2;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const x = cw * (c + 0.5), y = oy + ch * (r + 0.5);
        g.beginPath();
        if (kind === "dots") g.arc(x, y, cw * 0.26, 0, Math.PI * 2);
        else
          for (let k = 0; k < 10; k++) {
            const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? cw * 0.17 : cw * 0.4;
            g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
          }
        g.fill();
      }
  }, { depth: 0.1, ...place });
}
