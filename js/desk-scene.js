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

  /* faint room bounce behind the chair so backs aren't pure void */
  const backFill = new THREE.PointLight(0x434840, 3.4, 8, 2);
  backFill.position.set(2.1, 1.8, 2.6);
  scene.add(backFill);

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

  /* ---------- the artist: charcoal hoodie, sage headphones ---------- */
  const artist = { boost: 0, bobPhase: 0 }; // boost eases toward 1 when sound is on

  /* limbs are boxes stretched between two points — reused for arms */
  function limb(ax, ay, az, bx, by, bz, w, m, parent) {
    const from = new THREE.Vector3(ax, ay, az);
    const d = new THREE.Vector3(bx, by, bz).sub(from);
    const len = d.length();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, len, w * 0.92), m);
    mesh.position.copy(from).addScaledVector(d, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  {
    const P = {
      hoodie: mat(0x353a3c, { rough: 0.96 }), // charcoal
      hood: mat(0x2b2f31),
      pants: mat(0x1b1d1f),
      hair: mat(0x161310),
      skin: mat(0x8d7a66),
      phone: mat(0x1d201d, { rough: 0.55 }),
      pad: mat(CONFIG.sage, { rough: 0.7 }),
      chair: mat(0x151716),
    };

    /* chair, low enough that the back stays readable over it */
    const chairG = new THREE.Group();
    chairG.position.set(-0.1, 0, 0.46);
    root.add(chairG);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const leg = box(0.3, 0.035, 0.06, P.chair, Math.sin(a) * 0.16, 0.035, Math.cos(a) * 0.16, { parent: chairG });
      leg.rotation.y = a;
    }
    cyl(0.028, 0.028, 0.5, 8, M.metal, 0, 0.3, 0, { parent: chairG });
    box(0.5, 0.07, 0.48, P.chair, 0, 0.585, 0.02, { parent: chairG });
    box(0.44, 0.52, 0.06, P.chair, 0, 0.9, 0.27, { parent: chairG, rx: -0.08 });

    const person = new THREE.Group();
    person.position.set(-0.1, 0, 0.32);
    root.add(person);

    /* legs disappearing under the desk */
    box(0.15, 0.13, 0.44, P.pants, -0.115, 0.66, -0.1, { parent: person });
    box(0.15, 0.13, 0.44, P.pants, 0.115, 0.66, -0.1, { parent: person });
    box(0.13, 0.4, 0.14, P.pants, -0.115, 0.42, -0.32, { parent: person, rx: 0.12 });
    box(0.13, 0.4, 0.14, P.pants, 0.115, 0.42, -0.32, { parent: person, rx: 0.12 });
    box(0.13, 0.06, 0.24, P.hood, -0.115, 0.03, -0.42, { parent: person });
    box(0.13, 0.06, 0.24, P.hood, 0.115, 0.03, -0.42, { parent: person });

    /* everything above the hips sways together */
    const torsoG = new THREE.Group();
    person.add(torsoG);
    box(0.56, 0.62, 0.34, P.hoodie, 0, 0.95, 0.08, { parent: torsoG });
    box(0.63, 0.2, 0.37, P.hoodie, 0, 1.29, 0.08, { parent: torsoG });
    box(0.4, 0.18, 0.14, P.hood, 0, 1.37, 0.24, { parent: torsoG }); // hood bunched at the neck
    box(0.34, 0.34, 0.05, P.hood, 0, 1.12, 0.26, { parent: torsoG }); // hood hanging down the back

    /* head: bobs to the music, glances between monitors */
    const headG = new THREE.Group();
    headG.position.set(0, 1.52, 0.06);
    torsoG.add(headG);
    box(0.11, 0.14, 0.12, P.skin, 0, -0.04, 0, { parent: headG });
    box(0.27, 0.29, 0.27, P.skin, 0, 0.13, 0, { parent: headG });
    box(0.29, 0.15, 0.29, P.hair, 0, 0.27, 0.012, { parent: headG });
    box(0.29, 0.27, 0.1, P.hair, 0, 0.11, 0.115, { parent: headG });
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.028, 6, 14, Math.PI), P.phone);
    band.position.set(0, 0.15, 0);
    band.castShadow = true;
    headG.add(band);
    cyl(0.075, 0.075, 0.06, 10, P.phone, -0.168, 0.09, 0, { parent: headG, rz: Math.PI / 2 });
    cyl(0.075, 0.075, 0.06, 10, P.phone, 0.168, 0.09, 0, { parent: headG, rz: Math.PI / 2 });
    cyl(0.058, 0.058, 0.02, 10, P.pad, -0.205, 0.09, 0, { parent: headG, rz: Math.PI / 2 });
    cyl(0.058, 0.058, 0.02, 10, P.pad, 0.205, 0.09, 0, { parent: headG, rz: Math.PI / 2 });

    /* arms: elbows tucked, forearms gliding flat onto the keyboard */
    limb(-0.31, 1.26, 0.08, -0.33, 1.08, -0.06, 0.13, P.hoodie, torsoG);
    limb(0.31, 1.26, 0.08, 0.33, 1.08, -0.06, 0.13, P.hoodie, torsoG);
    limb(-0.33, 1.09, -0.08, -0.19, 1.25, -0.6, 0.105, P.hoodie, torsoG);
    limb(0.33, 1.09, -0.08, 0.19, 1.25, -0.6, 0.105, P.hoodie, torsoG);
    const handL = box(0.095, 0.05, 0.13, P.skin, -0.19, 1.27, -0.66, { parent: torsoG });
    const handR = box(0.095, 0.05, 0.13, P.skin, 0.19, 1.27, -0.66, { parent: torsoG });

    /* ---- music notes rising off the headphones ---- */
    function noteTexture(glyph) {
      const c = document.createElement("canvas");
      c.width = c.height = 96;
      const g = c.getContext("2d");
      g.font = "600 58px 'JetBrains Mono', ui-monospace, monospace";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.shadowColor = "rgba(168,181,138,0.95)";
      g.shadowBlur = 16;
      g.fillStyle = "#cfdab2";
      g.fillText(glyph, 48, 52);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }
    const noteTex = [noteTexture("♪"), noteTexture("♫")];
    const notes = [];
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: noteTex[i % 2], transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false,
      }));
      s.visible = false;
      root.add(s);
      notes.push({ s, life: 0, ttl: 1, x0: 0, y0: 0, z0: 0, sway: 0, phase: 0, speed: 0, size: 0.2, active: false });
    }
    let noteTimer = 1.4;
    const headWorld = new THREE.Vector3();

    function spawnNote() {
      const n = notes.find((n) => !n.active);
      if (!n) return;
      headG.getWorldPosition(headWorld);
      n.active = true;
      n.s.visible = true;
      n.life = 0;
      n.ttl = rand(1.9, 2.6);
      n.x0 = headWorld.x + rand(-0.12, 0.12);
      n.y0 = headWorld.y + 0.28;
      n.z0 = headWorld.z + rand(-0.06, 0.1);
      n.sway = rand(0.05, 0.1) * (Math.random() < 0.5 ? -1 : 1);
      n.phase = rand(0, 6.28);
      n.speed = rand(0.3, 0.42);
      n.size = rand(0.18, 0.24) * (1 + artist.boost * 0.3);
    }

    /* ---- behavior: bob, sway, glance, type ---- */
    const typing = { on: true, t: rand(1.2, 2.4) };
    let glance = 0, glanceTarget = 0, glanceT = rand(2.5, 5);

    systems.push((dt) => {
      const live = document.body.classList.contains("sound-on");
      artist.boost += ((live ? 1 : 0) - artist.boost) * lerpK(1.4, dt);
      const B = artist.boost;

      /* head bob — phase accumulator so tempo shifts stay smooth */
      artist.bobPhase += dt * 6.28 * (1.35 + 0.45 * B);
      const bob = Math.sin(artist.bobPhase);
      headG.position.y = 1.52 + bob * (0.008 + 0.016 * B);
      headG.rotation.x = bob * (0.05 + 0.06 * B);
      headG.rotation.z = Math.sin(artist.bobPhase * 0.5) * (0.012 + 0.03 * B);

      /* slow body groove */
      torsoG.rotation.z = Math.sin(clock * 0.55) * 0.018 + Math.sin(artist.bobPhase * 0.5) * 0.012 * B;
      torsoG.rotation.y = Math.sin(clock * 0.31) * 0.014;

      /* glancing between monitors */
      glanceT -= dt;
      if (glanceT <= 0) {
        glanceTarget = [-0.36, 0, 0, 0.3][(Math.random() * 4) | 0];
        glanceT = rand(2.5, 6);
      }
      glance += (glanceTarget - glance) * lerpK(2.2, dt);
      headG.rotation.y = glance;

      /* typing bursts with thinking pauses */
      typing.t -= dt;
      if (typing.t <= 0) {
        typing.on = !typing.on;
        typing.t = typing.on ? rand(1.4, 3) : rand(0.7, 2.2);
      }
      const tAmp = typing.on ? 0.013 : 0;
      handL.position.y = 1.27 + Math.max(0, Math.sin(clock * 13)) * tAmp;
      handR.position.y = 1.27 + Math.max(0, Math.sin(clock * 13 + 2.2)) * tAmp;

      /* notes */
      noteTimer -= dt;
      if (noteTimer <= 0) {
        spawnNote();
        noteTimer = rand(1.1, 1.8) / (1 + B * 1.2);
      }
      for (const n of notes) {
        if (!n.active) continue;
        n.life += dt;
        const k = n.life / n.ttl;
        if (k >= 1) {
          n.active = false;
          n.s.visible = false;
          n.s.material.opacity = 0;
          continue;
        }
        n.s.position.set(
          n.x0 + Math.sin(n.life * 2.1 + n.phase) * n.sway,
          n.y0 + n.life * n.speed,
          n.z0
        );
        const grow = n.size * (0.85 + k * 0.35);
        n.s.scale.set(grow, grow, 1);
        n.s.material.rotation = Math.sin(n.life * 1.6 + n.phase) * 0.22;
        n.s.material.opacity = (k < 0.18 ? k / 0.18 : k > 0.6 ? (1 - k) / 0.4 : 1) * 0.85;
      }
    });
  }

  /* ---------- studio props ---------- */
  const props = {}; // shared refs for the easter eggs later

  /* -- desk lamp: the physical body of the one warm light -- */
  {
    const shade = mat(0x23261f, { rough: 0.6, extra: { side: THREE.DoubleSide } });
    const joint = new THREE.SphereGeometry(0.035, 8, 6);
    const lampG = new THREE.Group();
    root.add(lampG);
    cyl(0.13, 0.15, 0.035, 12, M.metal, -1.98, DESK_Y + 0.018, -0.68, { parent: lampG });
    limb(-1.98, DESK_Y + 0.03, -0.68, -2.08, 1.82, -0.76, 0.045, M.metal, lampG);
    limb(-2.08, 1.82, -0.76, -1.92, 2.18, -0.72, 0.04, M.metal, lampG);
    for (const p of [[-2.08, 1.82, -0.76], [-1.92, 2.18, -0.72]]) {
      const j = new THREE.Mesh(joint, M.metal);
      j.position.set(...p);
      j.castShadow = true;
      lampG.add(j);
    }
    /* shade cone aimed along the spotlight */
    const headPos = new THREE.Vector3(-1.9, 2.16, -0.7);
    const aim = lampLight.target.position.clone().sub(headPos).normalize();
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.12, 0.17, 12, 1, true), shade);
    cone.position.copy(headPos);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), aim.clone().negate());
    cone.castShadow = true;
    lampG.add(cone);
    const bulb = new THREE.Mesh(
      new THREE.CircleGeometry(0.09, 12),
      new THREE.MeshBasicMaterial({ color: 0xffe2b4, toneMapped: false, fog: false })
    );
    bulb.position.copy(headPos).addScaledVector(aim, 0.09);
    bulb.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), aim);
    lampG.add(bulb);
    const warmGlow = glowTexture("rgba(255,216,164,0.9)", "rgba(255,216,164,0)");
    const lampHalo = glowSprite(0.55, 0.55, 0.35, headPos.x + aim.x * 0.12, headPos.y + aim.y * 0.12, headPos.z + aim.z * 0.12, lampG);
    lampHalo.material.map = warmGlow;
    lampLight.position.set(-1.92, 2.2, -0.72);
    props.lamp = { light: lampLight, bulb, halo: lampHalo, on: true };
  }

  /* -- coffee mug + steam -- */
  {
    const mugM = mat(0xd6d2c4, { rough: 0.75 });
    const mug = cyl(0.055, 0.048, 0.115, 14, mugM, 0.5, DESK_Y + 0.058, -0.66);
    cyl(0.046, 0.046, 0.008, 12, mat(0x191009, { rough: 0.5 }), 0.5, DESK_Y + 0.112, -0.66, { cast: false });
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.01, 6, 12, Math.PI), mugM);
    handle.position.set(0.556, DESK_Y + 0.062, -0.66);
    handle.rotation.z = -Math.PI / 2 + 0.5;
    handle.castShadow = true;
    root.add(handle);
    props.mug = mug;

    const wisps = [];
    for (let i = 0; i < 3; i++) {
      const w = glowSprite(0.055, 0.15, 0, 0.5, DESK_Y + 0.16, -0.66);
      wisps.push({ s: w, phase: (i / 3) * 2.4 });
    }
    systems.push((dt) => {
      for (const w of wisps) {
        w.phase += dt;
        const k = (w.phase % 2.4) / 2.4;
        w.s.position.set(
          0.5 + Math.sin(k * 7 + w.phase * 0.4) * 0.028,
          DESK_Y + 0.15 + k * 0.34,
          -0.66
        );
        w.s.material.opacity = Math.sin(k * Math.PI) * 0.3;
        w.s.scale.set(0.05 + k * 0.05, 0.13 + k * 0.08, 1);
      }
    });
  }

  /* -- little sage plant, back-left corner -- */
  {
    const plantG = new THREE.Group();
    plantG.position.set(-2.02, DESK_Y, -1.38);
    root.add(plantG);
    cyl(0.078, 0.06, 0.13, 10, mat(0x47332a, { rough: 0.95 }), 0, 0.065, 0, { parent: plantG });
    cyl(0.07, 0.07, 0.012, 10, mat(0x18130e), 0, 0.128, 0, { parent: plantG, cast: false });
    const greens = [mat(0x6d7d57), mat(0x86976a), mat(0xa8b58a)];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.4;
      const lean = i < 5 ? 0.62 : 0.16; // outer rosette + two upright
      const h = i < 5 ? rand(0.14, 0.19) : rand(0.24, 0.28);
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.035, h, 5), greens[i % 3]);
      leaf.position.set(Math.sin(a) * 0.035, 0.13 + h * 0.42, Math.cos(a) * 0.035);
      leaf.rotation.set(Math.cos(a) * lean, 0, -Math.sin(a) * lean);
      leaf.castShadow = true;
      plantG.add(leaf);
    }
  }

  /* -- pc tower under the desk, breathing sage -- */
  {
    box(0.32, 0.74, 0.6, M.bodyDeep, -1.5, 0.38, -1.15);
    box(0.3, 0.02, 0.58, M.body, -1.5, 0.76, -1.15, { cast: false });
    const led = new THREE.Mesh(
      new THREE.BoxGeometry(0.014, 0.5, 0.014),
      new THREE.MeshBasicMaterial({ color: CONFIG.sage, toneMapped: false, fog: false })
    );
    led.position.set(-1.415, 0.42, -0.848);
    root.add(led);
    glowSprite(0.34, 0.6, 0.22, -1.42, 0.42, -0.82);
    const pcGlow = new THREE.PointLight(CONFIG.sage, 1.6, 2.2, 2);
    pcGlow.position.set(-1.42, 0.45, -0.75);
    scene.add(pcGlow);
    systems.push((dt) => {
      const b = 0.75 + Math.sin(clock * 1.7) * 0.25;
      led.material.opacity = b;
      pcGlow.intensity = 1.6 * b;
    });
    led.material.transparent = true;
  }

  /* -- led strip washing the back of the rig -- */
  if (CONFIG.led) {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(3.9, 0.022, 0.022),
      new THREE.MeshBasicMaterial({ color: 0xb9c79a, toneMapped: false, fog: false })
    );
    strip.position.set(0, DESK_Y + 0.012, -1.615);
    root.add(strip);
    for (let i = -1; i <= 1; i++) glowSprite(1.7, 0.5, 0.12, i * 1.3, DESK_Y + 0.1, -1.58);
    const ledWash = new THREE.PointLight(CONFIG.sage, 4, 3.4, 1.9);
    ledWash.position.set(0, 1.55, -1.58);
    scene.add(ledWash);
  }

  /* -- vinyl corner: side table + turntable, 33 and a third -- */
  if (CONFIG.vinyl) {
    const tableG = new THREE.Group();
    tableG.position.set(2.68, 0, -0.95);
    tableG.rotation.y = 0.12;
    root.add(tableG);
    box(0.82, 0.07, 0.66, M.wood, 0, 0.79, 0, { parent: tableG, recv: true });
    box(0.78, 0.3, 0.6, M.woodDark, 0, 0.6, 0, { parent: tableG });
    for (const [lx, lz] of [[-0.34, -0.24], [0.34, -0.24], [-0.34, 0.24], [0.34, 0.24]])
      box(0.05, 0.46, 0.05, M.woodDark, lx, 0.23, lz, { parent: tableG });
    /* records leaning against the side */
    for (let i = 0; i < 3; i++)
      box(0.015, 0.34, 0.34, [M.bodyDeep, M.body, M.rugIn][i], -0.47 - i * 0.022, 0.19, 0.1, { parent: tableG, rz: 0.12 + i * 0.03 });

    box(0.56, 0.045, 0.44, M.body, 0, 0.85, 0, { parent: tableG });
    cyl(0.185, 0.185, 0.018, 24, mat(0x131513, { rough: 0.5 }), 0, 0.885, 0, { parent: tableG });
    const vinylG = new THREE.Group();
    vinylG.position.set(0, 0.9, 0);
    tableG.add(vinylG);
    const disc = cyl(0.172, 0.172, 0.008, 32, mat(0x0d0d0d, { rough: 0.35 }), 0, 0, 0, { parent: vinylG, cast: false });
    cyl(0.055, 0.055, 0.012, 16, mat(0x97a47b, { rough: 0.8 }), 0, 0.002, 0, { parent: vinylG, cast: false });
    box(0.05, 0.011, 0.012, mat(0xd9d9cc), 0.1, 0.004, 0, { parent: vinylG, cast: false }); // tick so the spin reads
    /* tonearm */
    cyl(0.028, 0.028, 0.05, 8, M.metal, 0.23, 0.895, 0.17, { parent: tableG });
    limb(0.23, 0.91, 0.17, 0.08, 0.895, 0.02, 0.016, M.metal, tableG);
    props.vinyl = { g: vinylG, speed: 3.49, boost: 0 };
    systems.push((dt) => {
      vinylG.rotation.y -= dt * (props.vinyl.speed + props.vinyl.boost);
      props.vinyl.boost = Math.max(0, props.vinyl.boost - dt * 6);
    });
  }

  /* -- dust drifting through the lamp light -- */
  if (CONFIG.dust && !reduced) {
    const N = 42;
    const base = new Float32Array(N * 3);
    const pos = new Float32Array(N * 3);
    const ph = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      base[i * 3] = rand(-2.3, 1.7);
      base[i * 3 + 1] = rand(1.15, 2.65);
      base[i * 3 + 2] = rand(-1.55, 0.5);
      ph[i] = rand(0, 6.28);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const dust = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.02, map: softGlow, color: 0xe6dcbe, transparent: true, opacity: 0.45,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false,
    }));
    root.add(dust);
    systems.push(() => {
      for (let i = 0; i < N; i++) {
        const t = clock * 0.55 + ph[i];
        pos[i * 3] = base[i * 3] + Math.sin(t * 0.5) * 0.07;
        pos[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.34 + 1.7) * 0.06;
        pos[i * 3 + 2] = base[i * 3 + 2] + Math.sin(t * 0.42 + 3.1) * 0.06;
      }
      geo.attributes.position.needsUpdate = true;
    });
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
