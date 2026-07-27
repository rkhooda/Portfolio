/* ------------------------------------------------------------------
   desk-scene.js — the hero diorama: a low-poly studio at 3am, built
   entirely from three.js primitives in the night-sage palette.
   Vanilla ES module (vendored three core, no addons); talks to the
   page via the rh:hero-in event and the body.sound-on class.
   ------------------------------------------------------------------ */
import * as THREE from "three";

const CONFIG = {
  bg: 0x0a0b0a,
  sage: 0xa8b58a,
  cream: 0xeaeae2,
  warm: 0xffc98a, // the one warm note: the desk lamp
  vinyl: true,
  dust: true,
  led: true,
  easterEggs: true,
};

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(pointer: fine)").matches;
const wideMQ = matchMedia("(min-width: 1024px)");

const cvs = document.getElementById("deskScene");
const holder = cvs && cvs.parentElement;
const gsap = window.gsap;

if (cvs && gsap) {
  if (wideMQ.matches) boot();
  else wideMQ.addEventListener("change", (e) => e.matches && boot(), { once: true });
}

function boot() {
  try {
    init();
  } catch (err) {
    /* no webgl, no drama — the hero simply stays as it was */
    console.warn("desk scene unavailable:", err);
    cvs.remove();
  }
}

function init() {
  /* ---------- renderer / scene / camera ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas: cvs, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(CONFIG.bg, 12, 22);

  const root = new THREE.Group();
  scene.add(root);

  /* long lens + far camera: compresses the diorama toward the cozy
     near-isometric look; distance is derived from the canvas aspect
     so the whole desk always fits the frame */
  const DEG = Math.PI / 180;
  const view = {
    target: new THREE.Vector3(0.35, 1.02, -0.5),
    azimuth: 25 * DEG,
    elevation: 27 * DEG,
    halfWidth: 3.2,
    dist: 15,
    mx: 0, my: 0, // eased pointer offset
    tx: 0, ty: 0, // raw pointer target
  };
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 60);
  const camDir = new THREE.Vector3(
    Math.sin(view.azimuth) * Math.cos(view.elevation),
    Math.sin(view.elevation),
    Math.cos(view.azimuth) * Math.cos(view.elevation)
  );
  const camRight = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize();

  function frame() {
    const w = holder.clientWidth, h = holder.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const halfTan = Math.tan((camera.fov / 2) * DEG);
    view.dist = Math.min(24, view.halfWidth / (halfTan * Math.max(camera.aspect, 0.5)));
    scene.fog.near = view.dist - 2.5;
    scene.fog.far = view.dist + 9;
    camera.updateProjectionMatrix();
  }

  function placeCamera() {
    camera.position.copy(view.target).addScaledVector(camDir, view.dist);
    camera.position.addScaledVector(camRight, view.mx * view.dist * 0.055);
    camera.position.y += view.my * view.dist * 0.034;
    camera.lookAt(view.target);
  }

  /* ---------- lights: sage noir with one warm pool ---------- */
  const hemi = new THREE.HemisphereLight(0x2a2f26, CONFIG.bg, 0.65);
  scene.add(hemi);

  /* the desk lamp owns the scene's only real shadows */
  const lampLight = new THREE.SpotLight(CONFIG.warm, 26, 9, 0.72, 0.85, 1.6);
  lampLight.position.set(-1.75, 2.3, -1.0);
  lampLight.target.position.set(-0.7, 1.15, -0.55);
  lampLight.castShadow = true;
  lampLight.shadow.mapSize.set(1024, 1024);
  lampLight.shadow.camera.near = 0.4;
  lampLight.shadow.camera.far = 9;
  lampLight.shadow.bias = -0.002;
  scene.add(lampLight, lampLight.target);

  /* monitor spill: warm off-white front glow + a sage wash */
  const screenGlow = new THREE.PointLight(0xdfe6d0, 10, 5.5, 1.8);
  screenGlow.position.set(0, 2.0, -0.55);
  scene.add(screenGlow);

  const sageWash = new THREE.PointLight(CONFIG.sage, 5, 4.5, 1.8);
  sageWash.position.set(1.35, 1.7, -0.8);
  scene.add(sageWash);

  /* ---------- tiny toolkit ---------- */
  const rand = (a, b) => a + Math.random() * (b - a);
  const systems = []; // per-frame updaters, all dt-driven so pausing is free

  const mat = (hex, o = {}) =>
    new THREE.MeshStandardMaterial({
      color: hex, roughness: o.rough ?? 0.92, metalness: 0, flatShading: true, ...o.extra,
    });

  const M = {
    slab: mat(0x101210, { rough: 0.98 }),
    rug: mat(0x161a15),
    rugIn: mat(0x1b201a),
    wood: mat(0x2b2119),
    woodDark: mat(0x1e1712),
    body: mat(0x171a17),      // monitor/peripheral plastic
    bodyDeep: mat(0x121412),
    key: mat(0x232623),
    metal: mat(0x2c2f2c, { rough: 0.55 }),
    cable: mat(0x191c19, { rough: 0.7 }),
  };

  function box(w, h, d, m, x, y, z, o = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    if (o.ry) mesh.rotation.y = o.ry;
    if (o.rx) mesh.rotation.x = o.rx;
    if (o.rz) mesh.rotation.z = o.rz;
    mesh.castShadow = o.cast ?? true;
    mesh.receiveShadow = o.recv ?? false;
    (o.parent || root).add(mesh);
    return mesh;
  }

  function cyl(rt, rb, h, seg, m, x, y, z, o = {}) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
    mesh.position.set(x, y, z);
    if (o.rx) mesh.rotation.x = o.rx;
    if (o.rz) mesh.rotation.z = o.rz;
    mesh.castShadow = o.cast ?? true;
    mesh.receiveShadow = o.recv ?? false;
    (o.parent || root).add(mesh);
    return mesh;
  }

  /* soft radial gradient, reused for every fake-bloom sprite */
  function glowTexture(inner, outer) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, inner);
    grad.addColorStop(1, outer);
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  const softGlow = glowTexture("rgba(216,226,190,0.85)", "rgba(216,226,190,0)");

  function glowSprite(scaleX, scaleY, opacity, x, y, z, parent = root) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: softGlow, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false,
    }));
    s.scale.set(scaleX, scaleY, 1);
    s.position.set(x, y, z);
    parent.add(s);
    return s;
  }

  /* ---------- floor + rug ---------- */
  const floorG = new THREE.Group();
  root.add(floorG);
  {
    const slab = box(6.4, 0.16, 4.6, M.slab, 0.35, -0.08, -0.15, { parent: floorG, cast: false, recv: true });
    slab.receiveShadow = true;
    const rug = cyl(1.85, 1.85, 0.02, 26, M.rug, 0.2, 0.011, 0.4, { parent: floorG, cast: false, recv: true });
    rug.scale.z = 0.72;
    const rugIn = cyl(1.45, 1.45, 0.021, 26, M.rugIn, 0.2, 0.012, 0.4, { parent: floorG, cast: false, recv: true });
    rugIn.scale.z = 0.7;
  }

  /* ---------- desk: top slab, panel leg, drawer unit ---------- */
  const deskG = new THREE.Group();
  root.add(deskG);
  const DESK_Y = 1.2; // work surface height
  {
    const top = box(4.4, 0.1, 1.5, M.wood, 0, DESK_Y - 0.05, -0.9, { parent: deskG, recv: true });
    top.receiveShadow = true;
    box(0.1, 1.15, 1.3, M.woodDark, -2.08, 0.575, -0.9, { parent: deskG });
    /* drawer unit doubles as the right leg */
    box(0.62, 1.1, 1.32, M.woodDark, 1.78, 0.55, -0.9, { parent: deskG });
    for (let i = 0; i < 3; i++) {
      box(0.52, 0.27, 0.03, M.wood, 1.78, 0.24 + i * 0.33, -0.225, { parent: deskG, cast: false });
      box(0.16, 0.025, 0.02, M.metal, 1.78, 0.33 + i * 0.33, -0.205, { parent: deskG, cast: false });
    }
  }

  /* ---------- monitors with living screens ---------- */
  const screens = []; // {paint, tex, every, acc}
  const screenMats = []; // for the boot flicker later

  function makeScreen(w, h, every, painter) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const s = { ctx, tex, w, h, every, acc: rand(0, every), paint: () => { painter(ctx, s); tex.needsUpdate = true; } };
    s.paint();
    screens.push(s);
    return s;
  }

  function monitor(w, h, x, y, z, ry, screen) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = ry;
    root.add(g);
    box(w + 0.07, h + 0.07, 0.055, M.body, 0, 0, 0, { parent: g });
    box(w * 0.55, h * 0.55, 0.05, M.bodyDeep, 0, 0, -0.045, { parent: g });
    const smat = new THREE.MeshBasicMaterial({ map: screen.tex, toneMapped: false, fog: false });
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(w, h), smat);
    sm.position.z = 0.03;
    g.add(sm);
    screenMats.push(smat);
    /* stand */
    const neckH = y - DESK_Y - h / 2 + 0.06;
    box(0.07, neckH + 0.05, 0.05, M.body, 0, -(h / 2) - neckH / 2 + 0.02, -0.06, { parent: g });
    box(0.4, 0.022, 0.24, M.body, 0, -(y - DESK_Y) + 0.011, -0.05, { parent: g });
    /* halo + light pool the screen throws on the desk */
    glowSprite(w * 1.9, h * 1.9, 0.13, 0, 0, 0.16, g);
    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 1.25, 0.62),
      new THREE.MeshBasicMaterial({
        map: softGlow, transparent: true, opacity: 0.1,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false,
      })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0, -(y - DESK_Y) + 0.02, 0.32);
    g.add(pool);
    return g;
  }

  /* screen painters — abstract, glyph-free where possible, so nothing
     depends on webfonts being ready */
  const INK = { bg: "#0e120e", sage: "#a8b58a", cream: "#d9d9cc", muted: "#585e54", dim: "#2c322b", tan: "#c2b28a" };

  /* left: an editor endlessly scrolling code nobody will review */
  const codeLines = [];
  const newCodeLine = () => {
    const kinds = ["kw", "plain", "plain", "call", "comment", "blank"];
    const kind = kinds[(Math.random() * kinds.length) | 0];
    const chunks = [];
    if (kind !== "blank") {
      const n = kind === "comment" ? 1 : 1 + ((Math.random() * 3) | 0);
      for (let i = 0; i < n; i++) {
        chunks.push({
          w: rand(18, kind === "comment" ? 150 : 64),
          c: kind === "comment" ? INK.muted : i === 0 && kind === "kw" ? INK.sage : Math.random() < 0.22 ? INK.tan : INK.cream,
        });
      }
    }
    return { ind: (Math.random() * 4) | 0, chunks };
  };
  for (let i = 0; i < 14; i++) codeLines.push(newCodeLine());

  const codeScreen = makeScreen(384, 224, 0.62, (g, s) => {
    g.fillStyle = INK.bg;
    g.fillRect(0, 0, s.w, s.h);
    codeLines.shift();
    codeLines.push(newCodeLine());
    for (let i = 0; i < codeLines.length; i++) {
      const L = codeLines[i], y = 14 + i * 15;
      g.fillStyle = INK.dim;
      g.fillRect(8, y, 10, 3); // line number ghost
      let x = 30 + L.ind * 16;
      for (const ch of L.chunks) {
        g.fillStyle = ch.c;
        g.globalAlpha = 0.88;
        g.fillRect(x, y - 3, ch.w, 7);
        g.globalAlpha = 1;
        x += ch.w + 9;
      }
    }
    /* cursor */
    if (Math.random() < 0.8) {
      g.fillStyle = INK.sage;
      const L = codeLines[codeLines.length - 1];
      g.fillRect(30 + L.ind * 16 + L.chunks.reduce((a, c) => a + c.w + 9, 0), 14 + 13 * 15 - 4, 6, 9);
    }
  });

  /* center: the visualizer — it dances harder when the album is on */
  const bars = Array.from({ length: 26 }, () => ({ h: rand(0.08, 0.3), t: rand(0.08, 0.3) }));
  let vizPhase = 0;
  const vizScreen = makeScreen(384, 224, 0.1, (g, s) => {
    const live = document.body.classList.contains("sound-on");
    vizPhase += 0.55;
    g.fillStyle = "#0d100d";
    g.fillRect(0, 0, s.w, s.h);
    /* progress hairline */
    g.fillStyle = INK.dim;
    g.fillRect(18, 18, s.w - 36, 2);
    g.fillStyle = INK.sage;
    const p = (vizPhase * 2.2) % (s.w - 36);
    g.fillRect(18, 18, p, 2);
    g.beginPath();
    g.arc(18 + p, 19, 3.4, 0, 7);
    g.fill();
    const bw = (s.w - 36) / bars.length;
    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      if (Math.random() < (live ? 0.5 : 0.18))
        b.t = rand(0.06, live ? 1 : 0.42) * (0.55 + 0.45 * Math.sin(i * 0.6 + vizPhase * 0.35) ** 2);
      b.h += (b.t - b.h) * 0.45;
      const bh = b.h * (s.h - 74);
      const x = 18 + i * bw;
      g.fillStyle = INK.sage;
      g.globalAlpha = 0.32 + b.h * 0.6;
      g.fillRect(x, s.h - 34 - bh, bw - 3, bh);
      g.globalAlpha = 1;
      g.fillStyle = INK.cream;
      g.fillRect(x, s.h - 36 - bh, bw - 3, 2.5);
    }
    g.globalAlpha = 1;
  });

  /* right (portrait): a terminal quietly narrating the night shift */
  const TERM_SCRIPT = [
    ["❯ npm run life", INK.cream],
    ["building dreams…", INK.muted],
    ["✓ compiled clean", INK.sage],
    ["❯ git push origin main", INK.cream],
    ["deploy: ▓▓▓▓▓░░░", INK.muted],
    ["✓ shipped", INK.sage],
    ["❯ brew coffee --again", INK.cream],
    ["warn: mug empty", INK.tan],
    ["refill queued", INK.muted],
    ["❯ play night-sage.wav", INK.cream],
    ["♪ looping forever", INK.sage],
    ["vibe check: passed", INK.muted],
    ["❯ fix bug #148", INK.cream],
    ["introduced bug #149", INK.tan],
    ["worth it", INK.muted],
  ];
  let termAt = 0;
  const termScreen = makeScreen(256, 432, 1.35, (g, s) => {
    g.fillStyle = "#0d100e";
    g.fillRect(0, 0, s.w, s.h);
    g.fillStyle = INK.dim;
    g.fillRect(0, 0, s.w, 26);
    g.fillStyle = INK.sage;
    g.beginPath();
    g.arc(16, 13, 4, 0, 7);
    g.fill();
    g.font = "600 15px ui-monospace, Menlo, monospace";
    termAt++;
    const SHOW = 19;
    for (let i = 0; i < SHOW; i++) {
      const idx = termAt - SHOW + 1 + i;
      if (idx < 0) continue;
      const [txt, col] = TERM_SCRIPT[idx % TERM_SCRIPT.length];
      g.fillStyle = col;
      g.fillText(txt, 14, 52 + i * 20);
    }
    g.fillStyle = INK.sage;
    g.fillRect(14, 52 + (SHOW - 1) * 20 + 6, 9, 4);
  });

  monitor(1.26, 0.74, -1.5, 1.78, -1.3, 0.34, codeScreen);
  monitor(1.44, 0.86, 0, 1.82, -1.34, 0, vizScreen);
  monitor(0.62, 1.08, 1.52, 1.92, -1.3, -0.34, termScreen);

  systems.push((dt) => {
    for (const s of screens) {
      s.acc += dt;
      if (s.acc >= s.every) {
        s.acc = 0;
        s.paint();
      }
    }
  });

  /* ---------- keyboard, mouse, cables ---------- */
  {
    box(0.92, 0.035, 0.32, M.body, -0.1, DESK_Y + 0.0175, -0.42, { parent: deskG });
    const cols = 14, rows = 4;
    const keyGeo = new THREE.BoxGeometry(0.05, 0.02, 0.05);
    const keys = new THREE.InstancedMesh(keyGeo, M.key.clone(), cols * rows + 1);
    const dummy = new THREE.Object3D();
    const cKey = new THREE.Color();
    let k = 0;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        dummy.position.set(-0.1 - 0.404 + c * 0.062 + rand(-0.001, 0.001), DESK_Y + 0.043, -0.52 + r * 0.062);
        dummy.updateMatrix();
        keys.setMatrixAt(k, dummy.matrix);
        keys.setColorAt(k, cKey.setHex(Math.random() < 0.06 ? CONFIG.sage : Math.random() < 0.5 ? 0x262a25 : 0x20241f));
        k++;
      }
    /* spacebar */
    dummy.position.set(-0.1, DESK_Y + 0.043, -0.335);
    dummy.scale.set(5.4, 1, 1);
    dummy.updateMatrix();
    keys.setMatrixAt(k, dummy.matrix);
    keys.setColorAt(k, cKey.setHex(0x20241f));
    keys.instanceMatrix.needsUpdate = true;
    keys.instanceColor.needsUpdate = true;
    keys.castShadow = true;
    root.add(keys);

    box(0.4, 0.008, 0.3, M.bodyDeep, 0.72, DESK_Y + 0.004, -0.42, { parent: deskG, cast: false, recv: true });
    const mouse = box(0.075, 0.032, 0.12, M.key, 0.72, DESK_Y + 0.024, -0.42, { parent: deskG });
    mouse.rotation.y = -0.25;

    /* a couple of honest cables slipping off the back edge */
    const cable = (pts) => {
      const t = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, 0.012, 5),
        M.cable
      );
      t.castShadow = true;
      root.add(t);
    };
    cable([
      new THREE.Vector3(-0.4, DESK_Y - 0.02, -1.55),
      new THREE.Vector3(-0.5, 0.6, -1.62),
      new THREE.Vector3(-0.75, 0.02, -1.45),
    ]);
    cable([
      new THREE.Vector3(0.5, DESK_Y - 0.02, -1.58),
      new THREE.Vector3(0.62, 0.5, -1.6),
      new THREE.Vector3(1.0, 0.02, -1.4),
    ]);
  }

  /* ---------- pointer: parallax target + idle drift ---------- */
  let clock = 0;
  let lastPointer = -10;
  let idleAmt = 1; // starts idle until the mouse shows up

  if (finePointer && !reduced) {
    addEventListener("pointermove", (e) => {
      view.tx = (e.clientX / innerWidth) * 2 - 1;
      view.ty = (e.clientY / innerHeight) * 2 - 1;
      lastPointer = clock;
    }, { passive: true });
  }

  /* ---------- master update ---------- */
  const lerpK = (rate, dt) => 1 - Math.exp(-rate * dt);

  function update(dt) {
    clock += dt;
    for (const fn of systems) fn(dt);

    /* nobody driving? let the camera breathe on its own */
    const idle = clock - lastPointer > 3.5 ? 1 : 0;
    idleAmt += (idle - idleAmt) * lerpK(1.2, dt);
    const dx = Math.sin(clock * 0.13) * 0.5 * idleAmt + view.tx * (1 - idleAmt);
    const dy = Math.cos(clock * 0.09) * 0.35 * idleAmt + view.ty * (1 - idleAmt);
    view.mx += (dx - view.mx) * lerpK(3.2, dt);
    view.my += (-dy - view.my) * lerpK(3.2, dt);
    placeCamera();
  }

  /* ---------- render loop: one ticker, paused when unseen ---------- */
  let inView = true;
  let started = false;

  new IntersectionObserver(([e]) => (inView = e.isIntersecting), { rootMargin: "60px" }).observe(holder);

  function tick(_t, deltaMS) {
    if (!started || !inView || document.hidden) return;
    update(Math.min(deltaMS, 50) / 1000);
    renderer.render(scene, camera);
  }

  new ResizeObserver(() => { frame(); if (reduced && started) renderer.render(scene, camera); }).observe(holder);
  frame();
  placeCamera();

  /* ---------- reveal: wait for the hero entrance ---------- */
  function reveal() {
    started = true;
    if (reduced) {
      /* one honest frame, no motion */
      cvs.style.opacity = 1;
      for (const s of screens) s.paint();
      update(0);
      renderer.render(scene, camera);
      return;
    }
    gsap.to(cvs, { opacity: 1, duration: 0.9, ease: "power2.out" });
    gsap.ticker.add(tick);
  }

  if (window.__rhHeroIn) reveal();
  else document.addEventListener("rh:hero-in", reveal, { once: true });
}
