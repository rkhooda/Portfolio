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
  renderer.toneMappingExposure = 1.28;
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
    entr: 1, // entrance dolly multiplier
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
    const D = view.dist * view.entr;
    camera.position.copy(view.target).addScaledVector(camDir, D);
    camera.position.addScaledVector(camRight, view.mx * D * 0.055);
    camera.position.y += view.my * D * 0.034;
    camera.lookAt(view.target);
  }

  /* ---------- lights: sage noir with one warm pool ---------- */
  const hemi = new THREE.HemisphereLight(0x353c31, 0x11130f, 0.9);
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
  const screenGlow = new THREE.PointLight(0xdfe6d0, 13, 5.5, 1.8);
  screenGlow.position.set(0, 2.0, -0.55);
  scene.add(screenGlow);

  const sageWash = new THREE.PointLight(CONFIG.sage, 6, 4.5, 1.8);
  sageWash.position.set(1.35, 1.7, -0.8);
  scene.add(sageWash);

  /* faint room bounce behind the chair so backs aren't pure void */
  const backFill = new THREE.PointLight(0x4a4f45, 4.5, 8, 2);
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
    slab: mat(0x141613, { rough: 0.98 }),
    rug: mat(0x1c211a),
    rugIn: mat(0x232920),
    wood: mat(0x392c1e),
    woodDark: mat(0x271d14),
    body: mat(0x1b1e1b),      // monitor/peripheral plastic
    bodyDeep: mat(0x151715),
    key: mat(0x282c27),
    metal: mat(0x33362f, { rough: 0.55 }),
    cable: mat(0x1d201c, { rough: 0.7 }),
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
    box(6.4, 0.16, 4.6, M.slab, 0.35, -0.08, -0.15, { parent: floorG, cast: false, recv: true });
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
    box(4.4, 0.1, 1.5, M.wood, 0, DESK_Y - 0.05, -0.9, { parent: deskG, recv: true });
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

  /* each screen can be off, showing its boot splash, or running content */
  function splash(g, s) {
    g.fillStyle = "#0b0d0b";
    g.fillRect(0, 0, s.w, s.h);
    const cx = s.w / 2, cy = s.h / 2 - 10;
    g.strokeStyle = "#2c322b";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, cy, 21, 0, 7);
    g.stroke();
    g.fillStyle = INK.sage;
    g.beginPath();
    g.arc(cx, cy, 7 + Math.sin(s.bootT * 9) * 1.5, 0, 7);
    g.fill();
    for (let i = 0; i < 3; i++) {
      g.globalAlpha = (s.bootT * 4 + 2 - i) % 3 < 1 ? 0.9 : 0.25;
      g.fillStyle = INK.muted;
      g.fillRect(cx - 16 + i * 13, cy + 38, 6, 6);
    }
    g.globalAlpha = 1;
  }

  function makeScreen(w, h, every, painter) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const s = {
      ctx, tex, w, h, every, acc: rand(0, every), mode: "on", bootT: 0,
      paint: () => {
        if (s.mode === "off") {
          ctx.fillStyle = "#0a0c0a";
          ctx.fillRect(0, 0, w, h);
        } else if (s.mode === "boot") splash(ctx, s);
        else painter(ctx, s);
        tex.needsUpdate = true;
      },
    };
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
    glowSprite(w * 1.9, h * 1.9, 0.16, 0, 0, 0.16, g);
    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 1.25, 0.62),
      new THREE.MeshBasicMaterial({
        map: softGlow, transparent: true, opacity: 0.14,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false,
      })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0, -(y - DESK_Y) + 0.02, 0.32);
    g.add(pool);
    return g;
  }

  const INK = { bg: "#0e120e", sage: "#a8b58a", cream: "#d9d9cc", muted: "#585e54", dim: "#2c322b", tan: "#c2b28a" };
  const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";

  /* -- left: a podcast playing in the corner, strictly no tutorials -- */
  const pod = { t: 0, shot: 0, shotT: 5, talk: 0, talkT: 2, wave: Array.from({ length: 22 }, () => 0.2) };

  function drawHost(g, x, y, sc, flip, talking, t) {
    const bob = talking ? Math.sin(t * 7.3) * 2.2 : Math.sin(t * 1.1) * 0.9;
    const lean = flip ? -0.06 : 0.06;
    g.save();
    g.translate(x, y + bob * sc * 0.5);
    g.scale(flip ? -sc : sc, sc);
    g.rotate(lean + (talking ? Math.sin(t * 3.1) * 0.02 : 0));
    /* shoulders */
    g.fillStyle = "#26231c";
    g.beginPath();
    g.roundRect(-26, -6, 52, 34, 10);
    g.fill();
    /* head */
    g.fillStyle = "#2d2a21";
    g.beginPath();
    g.arc(0, -22, 15, 0, 7);
    g.fill();
    /* warm rim from the studio light */
    g.strokeStyle = "rgba(240,200,140,0.5)";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(0, -22, 15, -1.9, -0.5);
    g.stroke();
    /* headphones */
    g.strokeStyle = "#171511";
    g.lineWidth = 3.4;
    g.beginPath();
    g.arc(0, -24, 16, Math.PI * 1.05, Math.PI * 1.95);
    g.stroke();
    g.fillStyle = "#a8b58a";
    g.beginPath();
    g.roundRect(-19.5, -28, 7, 12, 3);
    g.fill();
    g.restore();
  }

  function drawMic(g, x, y, sc, flip) {
    g.save();
    g.translate(x, y);
    g.scale(flip ? -sc : sc, sc);
    g.strokeStyle = "#0f0e0b";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(28, -34);
    g.lineTo(10, -16);
    g.stroke();
    g.fillStyle = "#131110";
    g.beginPath();
    g.roundRect(2, -20, 15, 9, 4);
    g.fill();
    g.restore();
  }

  const videoScreen = makeScreen(448, 264, 0.12, (g, s) => {
    pod.t += 0.12;
    pod.shotT -= 0.12;
    pod.talkT -= 0.12;
    if (pod.shotT <= 0) { pod.shot = (pod.shot + 1 + ((Math.random() * 2) | 0)) % 3; pod.shotT = rand(2.6, 6.5); }
    if (pod.talkT <= 0) { pod.talk = 1 - pod.talk; pod.talkT = rand(1.4, 4.2); }

    /* warm dim studio */
    const bgGrad = g.createLinearGradient(0, 0, 0, s.h);
    bgGrad.addColorStop(0, "#191610");
    bgGrad.addColorStop(1, "#0f0d09");
    g.fillStyle = bgGrad;
    g.fillRect(0, 0, s.w, s.h);
    /* back wall: led line + soft lamp pools */
    g.fillStyle = "rgba(168,181,138,0.5)";
    g.fillRect(30, 58, s.w - 60, 2);
    for (const lx of [80, 368]) {
      const pool = g.createRadialGradient(lx, 40, 4, lx, 40, 60);
      pool.addColorStop(0, "rgba(255,205,140,0.16)");
      pool.addColorStop(1, "rgba(255,205,140,0)");
      g.fillStyle = pool;
      g.fillRect(lx - 60, 0, 120, 110);
    }
    g.font = `600 10px ${MONO}`;
    g.fillStyle = "rgba(168,181,138,0.75)";
    g.fillText("ON AIR", 200, 46);

    /* table */
    g.fillStyle = "#1b1712";
    g.beginPath();
    g.moveTo(40, 226); g.lineTo(s.w - 40, 226); g.lineTo(s.w - 12, 258); g.lineTo(12, 258);
    g.closePath();
    g.fill();

    if (pod.shot === 0) {
      drawHost(g, 150, 190, 1.6, false, pod.talk === 0, pod.t);
      drawHost(g, 300, 190, 1.6, true, pod.talk === 1, pod.t);
      drawMic(g, 150, 208, 1.7, false);
      drawMic(g, 300, 208, 1.7, true);
      g.font = `500 9px ${MONO}`;
      g.fillStyle = INK.muted;
      g.fillText("EP.042 — 3AM SESSIONS", 30, 218);
    } else {
      const flip = pod.shot === 2;
      drawHost(g, flip ? 268 : 180, 205, 3.1, flip, pod.talk === (flip ? 1 : 0), pod.t);
      drawMic(g, flip ? 268 : 180, 236, 3.2, flip);
    }

    /* voice waveform, driven by whoever is talking */
    const wy = 244;
    for (let i = 0; i < pod.wave.length; i++) {
      if (Math.random() < 0.55) pod.wave[i] = rand(0.1, 1) * (0.4 + 0.6 * Math.sin(i * 0.7 + pod.t * 4) ** 2);
      const h = 3 + pod.wave[i] * 9;
      g.fillStyle = "rgba(168,181,138,0.6)";
      g.fillRect(178 + i * 4.2, wy - h / 2, 2.6, h);
    }

    /* player chrome: live badge, clock, progress */
    g.fillStyle = "#0a0908";
    g.fillRect(0, 0, s.w, 14);
    g.fillRect(0, s.h - 8, s.w, 8);
    g.fillStyle = "#b6553f";
    g.beginPath();
    g.arc(16, 24, 3.4, 0, 7);
    g.fill();
    g.font = `700 9px ${MONO}`;
    g.fillStyle = INK.cream;
    g.fillText("LIVE", 24, 27);
    const mins = 102 + Math.floor(pod.t / 60), secs = Math.floor(pod.t % 60);
    g.fillStyle = INK.muted;
    g.fillText(`1:${String(mins % 60).padStart(2, "0")}:${String(secs).padStart(2, "0")}`, s.w - 52, 27);
    g.fillStyle = INK.dim;
    g.fillRect(0, s.h - 8, s.w, 2);
    g.fillStyle = INK.sage;
    g.fillRect(0, s.h - 8, s.w * 0.985, 2);
  });

  /* -- center: the editor, typing real code all night -- */
  const K = INK.sage, C = INK.cream, T = INK.tan, MU = INK.muted;
  const CODE = [
    [["const ", K], ["studio", C], [" = ", MU], ["createScene", C], ["(", MU], ["\"night-sage\"", T], [");", MU]],
    [["const ", K], ["cat", C], [" = ", MU], ["studio.spawn", C], ["(", MU], ["\"cat\"", T], [", { ", MU], ["fur", C], [": ", MU], ["\"white\"", T], [" });", MU]],
    [],
    [["function ", K], ["vibe", C], ["(", MU], ["track", C], [") {", MU]],
    [["  const ", K], ["bpm", C], [" = ", MU], ["track.tempo", C], [" ?? ", K], ["82", T], [";", MU]],
    [["  return ", K], ["loop", C], ["(() => {", MU]],
    [["    coffee.sip", C], ["();", MU]],
    [["    code.write", C], ["(", MU], ["bpm", C], [");", MU]],
    [["  });", MU]],
    [["}", MU]],
    [],
    [["studio.on", C], ["(", MU], ["\"3am\"", T], [", () => {", MU]],
    [["  lamp.dim", C], ["(", MU], ["0.6", T], [");", MU]],
    [["  cat.nap", C], ["(", MU], ["desk", C], [");", MU]],
    [["  vibe", C], ["(", MU], ["playlist.next", C], ["());", MU]],
    [["});", MU], ["  ", MU], ["// ship it", MU]],
  ];
  const lineLen = (L) => L.reduce((a, c) => a + c[0].length, 0);
  const ed = { line: 0, ch: 0, hold: 0, tk: 0 };

  const codeScreen = makeScreen(512, 306, 0.09, (g, s) => {
    /* advance the typist */
    ed.tk++;
    if (ed.hold > 0) ed.hold--;
    else if (ed.line >= CODE.length) { ed.line = 0; ed.ch = 0; ed.hold = 6; }
    else if (ed.ch >= lineLen(CODE[ed.line])) { ed.line++; ed.ch = 0; ed.hold = CODE[ed.line - 1].length === 0 ? 0 : 1 + ((Math.random() * 4) | 0); if (ed.line >= CODE.length) ed.hold = 34; }
    else ed.ch += 1 + ((Math.random() * 3) | 0);

    g.fillStyle = "#0d100d";
    g.fillRect(0, 0, s.w, s.h);
    /* window chrome */
    g.fillStyle = "#0a0d0a";
    g.fillRect(0, 0, s.w, 28);
    for (let i = 0; i < 3; i++) {
      g.fillStyle = INK.dim;
      g.beginPath();
      g.arc(16 + i * 15, 14, 4, 0, 7);
      g.fill();
    }
    g.fillStyle = "#131713";
    g.fillRect(70, 0, 96, 28);
    g.fillStyle = "#141814";
    g.fillRect(70, 26, 96, 2);
    g.font = `500 11px ${MONO}`;
    g.fillStyle = INK.cream;
    g.fillText("studio.js", 84, 18);
    g.fillStyle = INK.muted;
    g.fillText("vibe.js", 184, 18);
    /* status bar */
    g.fillStyle = "#0a0d0a";
    g.fillRect(0, s.h - 18, s.w, 18);
    g.font = `500 10px ${MONO}`;
    g.fillStyle = INK.sage;
    g.fillText("● main", 12, s.h - 6);
    g.fillStyle = INK.muted;
    g.fillText(`JS · UTF-8 · Ln ${Math.min(ed.line + 1, CODE.length)}`, s.w - 118, s.h - 6);

    /* code */
    g.font = `500 12px ${MONO}`;
    const upto = Math.min(ed.line, CODE.length - 1);
    for (let i = 0; i <= upto && i < CODE.length; i++) {
      const y = 48 + i * 16;
      g.fillStyle = INK.dim;
      g.fillText(String(i + 1).padStart(2, " "), 10, y);
      let x = 38;
      const full = i < ed.line;
      let left = full ? Infinity : ed.ch;
      for (const [txt, col] of CODE[i]) {
        const part = full ? txt : txt.slice(0, Math.max(0, left));
        left -= txt.length;
        if (!part) break;
        g.fillStyle = col;
        g.fillText(part, x, y);
        x += g.measureText(part).width;
        if (!full && left <= 0) break;
      }
      /* cursor on the active line */
      if (i === ed.line && Math.floor(ed.tk / 4) % 2 === 0) {
        g.fillStyle = INK.sage;
        g.fillRect(x + 1, y - 10, 6, 13);
      }
    }
  });

  /* -- right (portrait): the music player, spinning through the album -- */
  const bars = Array.from({ length: 20 }, () => ({ h: 0.12, t: 0.12 }));
  const player = { t: 0, el: 0 };

  const musicScreen = makeScreen(272, 474, 0.12, (g, s) => {
    const live = document.body.classList.contains("sound-on");
    player.t += 0.12;
    if (live) player.el = (player.el + 0.12) % 245;

    g.fillStyle = "#0d100d";
    g.fillRect(0, 0, s.w, s.h);
    /* header */
    g.fillStyle = INK.sage;
    g.globalAlpha = live ? 0.5 + Math.sin(player.t * 5) * 0.4 : 0.35;
    g.beginPath();
    g.arc(22, 24, 3.6, 0, 7);
    g.fill();
    g.globalAlpha = 1;
    g.font = `600 10px ${MONO}`;
    g.fillStyle = INK.muted;
    g.fillText("N O W   P L A Y I N G", 36, 28);

    /* album art: a slowly turning record */
    const ax = 24, ay = 44, aw = s.w - 48;
    g.fillStyle = "#10130f";
    g.fillRect(ax, ay, aw, aw);
    const cx = ax + aw / 2, cy = ay + aw / 2;
    const spin = live ? player.t * 0.9 : player.t * 0.12;
    g.fillStyle = "#141714";
    g.beginPath();
    g.arc(cx, cy, 92, 0, 7);
    g.fill();
    g.strokeStyle = "#1e231d";
    for (let r = 44; r <= 84; r += 10) {
      g.lineWidth = 1;
      g.beginPath();
      g.arc(cx, cy, r, 0, 7);
      g.stroke();
    }
    /* sheen */
    g.strokeStyle = "rgba(217,217,204,0.08)";
    g.lineWidth = 26;
    g.beginPath();
    g.arc(cx, cy, 64, spin * 0.4, spin * 0.4 + 0.7);
    g.stroke();
    g.fillStyle = INK.sage;
    g.beginPath();
    g.arc(cx, cy, 32, 0, 7);
    g.fill();
    g.fillStyle = "#0d100d";
    g.beginPath();
    g.arc(cx, cy, 4.5, 0, 7);
    g.fill();
    g.fillStyle = "#0e110e";
    g.beginPath();
    g.arc(cx + Math.cos(spin) * 24, cy + Math.sin(spin) * 24, 2.6, 0, 7);
    g.fill();
    if (!live) {
      g.fillStyle = "rgba(10,12,10,0.45)";
      g.fillRect(ax, ay, aw, aw);
      g.fillStyle = INK.cream;
      g.beginPath();
      g.moveTo(cx - 10, cy - 15); g.lineTo(cx + 16, cy); g.lineTo(cx - 10, cy + 15);
      g.closePath();
      g.fill();
    }

    /* track meta */
    g.font = `600 20px ${MONO}`;
    g.fillStyle = INK.cream;
    g.fillText("Night Sage", 24, ay + aw + 34);
    g.font = `500 12px ${MONO}`;
    g.fillStyle = INK.muted;
    g.fillText("Rakshit Hooda — LP · 2026", 24, ay + aw + 54);

    /* progress */
    const py = ay + aw + 76;
    g.fillStyle = INK.dim;
    g.fillRect(24, py, s.w - 48, 3);
    g.fillStyle = INK.sage;
    const pw = (s.w - 48) * (player.el / 245);
    g.fillRect(24, py, pw, 3);
    g.beginPath();
    g.arc(24 + pw, py + 1.5, 4, 0, 7);
    g.fill();
    g.font = `500 10px ${MONO}`;
    g.fillStyle = INK.muted;
    const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
    g.fillText(fmt(player.el), 24, py + 18);
    g.fillText("4:05", s.w - 52, py + 18);

    /* eq — dances when the album is actually on */
    const ey = py + 66, eh = 44;
    const bw = (s.w - 48) / bars.length;
    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      if (Math.random() < (live ? 0.5 : 0.14))
        b.t = rand(0.08, live ? 1 : 0.3) * (0.5 + 0.5 * Math.sin(i * 0.62 + player.t * 2.4) ** 2);
      b.h += (b.t - b.h) * 0.45;
      const bh = 3 + b.h * eh;
      g.fillStyle = INK.sage;
      g.globalAlpha = 0.35 + b.h * 0.55;
      g.fillRect(24 + i * bw, ey - bh, bw - 3, bh);
      g.globalAlpha = 1;
      g.fillStyle = INK.cream;
      g.fillRect(24 + i * bw, ey - bh - 2.5, bw - 3, 2);
    }

    /* up next */
    g.font = `500 10px ${MONO}`;
    g.fillStyle = INK.muted;
    g.fillText("UP NEXT", 24, ey + 26);
    g.fillStyle = INK.cream;
    g.fillText("02 · Selected Work", 24, ey + 42);
    g.fillStyle = INK.muted;
    g.fillText("03 · B-Sides", 24, ey + 58);
  });

  monitor(1.26, 0.74, -1.5, 1.78, -1.3, 0.34, videoScreen);
  monitor(1.44, 0.86, 0, 1.82, -1.34, 0, codeScreen);
  monitor(0.62, 1.08, 1.52, 1.92, -1.3, -0.34, musicScreen);

  systems.push((dt) => {
    for (const s of screens) {
      if (s.mode === "boot") s.bootT += dt;
      s.acc += dt;
      const cadence = s.mode === "boot" ? 0.08 : s.every;
      if (s.acc >= cadence) {
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
  const props = {}; // shared refs for the cat + easter eggs

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

    function spawnNote(px, py, pz) {
      const n = notes.find((n) => !n.active);
      if (!n) return;
      if (px === undefined) {
        headG.getWorldPosition(headWorld);
        px = headWorld.x + rand(-0.12, 0.12);
        py = headWorld.y + 0.28;
        pz = headWorld.z + rand(-0.06, 0.1);
      }
      n.active = true;
      n.s.visible = true;
      n.life = 0;
      n.ttl = rand(1.9, 2.6);
      n.x0 = px;
      n.y0 = py;
      n.z0 = pz;
      n.sway = rand(0.05, 0.1) * (Math.random() < 0.5 ? -1 : 1);
      n.phase = rand(0, 6.28);
      n.speed = rand(0.3, 0.42);
      n.size = rand(0.18, 0.24) * (1 + artist.boost * 0.3);
    }
    props.noteAt = spawnNote;

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
    props.lampG = lampG;
  }

  /* -- coffee mug + steam -- */
  {
    const mugM = mat(0xd6d2c4, { rough: 0.75 });
    cyl(0.055, 0.048, 0.115, 14, mugM, 0.5, DESK_Y + 0.058, -0.66);
    cyl(0.046, 0.046, 0.008, 12, mat(0x191009, { rough: 0.5 }), 0.5, DESK_Y + 0.112, -0.66, { cast: false });
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.01, 6, 12, Math.PI), mugM);
    handle.position.set(0.556, DESK_Y + 0.062, -0.66);
    handle.rotation.z = -Math.PI / 2 + 0.5;
    handle.castShadow = true;
    root.add(handle);

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

  /* boot factor lets the entrance ramp the accent glows from cold */
  const glowBoot = { amp: 1 };

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
      led.material.opacity = b * glowBoot.amp;
      pcGlow.intensity = 1.6 * b * glowBoot.amp;
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
    props.ledGlows = [];
    for (let i = -1; i <= 1; i++) props.ledGlows.push(glowSprite(1.7, 0.5, 0.12, i * 1.3, DESK_Y + 0.1, -1.58));
    const ledWash = new THREE.PointLight(CONFIG.sage, 4, 3.4, 1.9);
    ledWash.position.set(0, 1.55, -1.58);
    scene.add(ledWash);
    props.ledWash = ledWash;
    props.strip = strip;
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
    cyl(0.172, 0.172, 0.008, 32, mat(0x0d0d0d, { rough: 0.35 }), 0, 0, 0, { parent: vinylG, cast: false });
    cyl(0.055, 0.055, 0.012, 16, mat(0x97a47b, { rough: 0.8 }), 0, 0.002, 0, { parent: vinylG, cast: false });
    box(0.05, 0.011, 0.012, mat(0xd9d9cc), 0.1, 0.004, 0, { parent: vinylG, cast: false }); // tick so the spin reads
    /* tonearm */
    cyl(0.028, 0.028, 0.05, 8, M.metal, 0.23, 0.895, 0.17, { parent: tableG });
    limb(0.23, 0.91, 0.17, 0.08, 0.895, 0.02, 0.016, M.metal, tableG);
    props.vinyl = { g: vinylG, speed: 3.49, boost: 0 };
    props.tableG = tableG;
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

  /* ---------- the cat: white, sage-eyed, owns the place ---------- */
  {
    const fur = mat(0xd9d6ca, { rough: 0.9 });        // warm white
    const furShade = mat(0xb7b3a4, { rough: 0.92 });  // soft grey points
    const earIn = mat(0xc59a90, { rough: 0.9 });      // rosy inner ear
    const noseM = mat(0xc08d84, { rough: 0.7 });
    const eyeBase = new THREE.Color(0xb9c795);
    const eyeBright = new THREE.Color(0xc3ec7d);
    const eyeM = new THREE.MeshBasicMaterial({ color: eyeBase.clone(), toneMapped: false, fog: false });

    const catG = new THREE.Group(); // moves + turns; built facing +z
    root.add(catG);
    const bodyG = new THREE.Group(); // pitches + squashes for sit / jump
    bodyG.position.y = 0.19;
    catG.add(bodyG);
    /* contoured body: haunches, barrel, chest */
    box(0.175, 0.165, 0.17, fur, 0, 0.02, -0.1, { parent: bodyG });
    box(0.15, 0.14, 0.24, fur, 0, 0, 0.02, { parent: bodyG });
    box(0.145, 0.135, 0.13, fur, 0, 0.012, 0.13, { parent: bodyG });
    box(0.1, 0.1, 0.09, fur, 0, 0.09, 0.18, { parent: bodyG, rx: -0.5 }); // neck

    const headG = new THREE.Group();
    headG.position.set(0, 0.17, 0.24);
    bodyG.add(headG);
    box(0.145, 0.115, 0.125, fur, 0, 0, 0, { parent: headG });
    box(0.075, 0.05, 0.05, fur, 0, -0.036, 0.072, { parent: headG });     // muzzle
    box(0.021, 0.013, 0.012, noseM, 0, -0.018, 0.098, { parent: headG, cast: false });
    const ears = [];
    for (const sx of [-1, 1]) {
      const earG = new THREE.Group();
      earG.position.set(sx * 0.048, 0.075, -0.005);
      earG.rotation.z = sx * -0.14;
      headG.add(earG);
      const outer = new THREE.Mesh(new THREE.ConeGeometry(0.034, 0.06, 4), furShade);
      outer.castShadow = true;
      earG.add(outer);
      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.04, 4), earIn);
      inner.position.set(0, -0.004, 0.008);
      earG.add(inner);
      ears.push(earG);
    }
    const eyeGeo = new THREE.BoxGeometry(0.024, 0.017, 0.006);
    const pupilGeo = new THREE.BoxGeometry(0.0075, 0.014, 0.004);
    const pupilM = new THREE.MeshBasicMaterial({ color: 0x1a2118, toneMapped: false, fog: false });
    const eyeL = new THREE.Mesh(eyeGeo, eyeM);
    const eyeR = new THREE.Mesh(eyeGeo, eyeM);
    eyeL.position.set(-0.038, 0.008, 0.064);
    eyeR.position.set(0.038, 0.008, 0.064);
    const pupilL = new THREE.Mesh(pupilGeo, pupilM);
    const pupilR = new THREE.Mesh(pupilGeo, pupilM);
    pupilL.position.z = 0.002;
    pupilR.position.z = 0.002;
    eyeL.add(pupilL);
    eyeR.add(pupilR);
    headG.add(eyeL, eyeR);

    /* legs with little paws, diagonal-pair gait */
    const legs = [];
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const hip = new THREE.Group();
      hip.position.set(sx * 0.058, -0.04, sz * 0.125);
      bodyG.add(hip);
      box(0.048, 0.145, 0.052, fur, 0, -0.075, 0, { parent: hip });
      box(0.054, 0.03, 0.075, fur, 0, -0.135, 0.014, { parent: hip });
      legs.push(hip);
    }

    /* tail: four tapering segments, grey at the tip */
    const tail = [];
    let tailParent = bodyG;
    for (let i = 0; i < 4; i++) {
      const seg = new THREE.Group();
      seg.position.set(0, i ? 0.004 : 0.06, i ? -0.095 : -0.17);
      tailParent.add(seg);
      const th = 0.032 - i * 0.004;
      box(th, th, 0.115, i === 3 ? furShade : fur, 0, 0, -0.048, { parent: seg });
      tail.push(seg);
      tailParent = seg;
    }

    /* generous invisible hitbox — clicking a strolling cat should be easy */
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), new THREE.MeshBasicMaterial());
    hit.visible = false; // skipped by the renderer, still caught by the raycaster
    hit.position.y = 0.18;
    catG.add(hit);

    /* soft blob shadow so the cat is grounded even outside lamp reach */
    const blobTex = glowTexture("rgba(0,0,0,0.55)", "rgba(0,0,0,0)");
    const blob = new THREE.Mesh(
      new THREE.CircleGeometry(0.17, 16),
      new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: 0.32, depthWrite: false, fog: false })
    );
    blob.rotation.x = -Math.PI / 2;
    root.add(blob);

    /* ---- behavior ---- */
    const FLOOR = 0.025, DESK_TOP = DESK_Y;
    const cat = {
      state: "enter",
      t: 0,               // time left in the current state
      x: 3.4, z: 1.7, y: FLOOR,
      heading: -2.2,
      speed: 0,
      gait: 0,            // eased walk-cycle weight
      walkPhase: 0,
      target: { x: 1.2, z: 1.1 },
      jump: null,         // {ax,az,ay,bx,bz,by,t,dur,h,phase,pt,hd,want}
      squash: 0,          // eased crouch / landing compression
      stretch: 0,         // eased launch elongation
      lookAmt: 0,         // eased "staring at you" weight
      deskCool: rand(14, 22),
      blink: rand(2, 5),
      blinkT: 0,
      pose: { rx: 0, headRx: 0, legTuck: 0, y: 0 },
      goal: { rx: 0, headRx: 0, legTuck: 0, y: 0 },
    };
    props.cat = cat;
    props.catG = catG;
    props.catHop = () => {
      if (["sit", "wander", "pause", "look"].includes(cat.state) && !cat.jump) {
        cat.jump = {
          ax: cat.x, az: cat.z, ay: cat.y, bx: cat.x, bz: cat.z, by: cat.y,
          t: 0, dur: 0.42, h: 0.3, phase: "crouch", pt: 0.1, hd: 0.25, want: cat.heading,
        };
        cat.state = "hop";
        props.noteAt(cat.x, cat.y + 0.55, cat.z);
      }
    };
    /* click: the cat stops what it's doing and stares right at you */
    props.catLook = () => {
      if (cat.jump) return;
      if (cat.state === "look") { props.catHop(); return; } // pushed your luck
      cat.state = "look";
      cat.t = rand(3.2, 4.6);
    };

    const floorSpot = () => {
      /* somewhere on the open floor, not inside the chair or desk */
      for (let i = 0; i < 12; i++) {
        const x = rand(-2.2, 3.1), z = rand(0.15, 1.75);
        if (Math.hypot(x + 0.1, z - 0.46) < 0.85) continue; // chair bubble
        if (x > 2.1 && z < 0.2) continue;                   // table legs
        return { x, z };
      }
      return { x: 1.6, z: 1.2 };
    };

    const beginJump = (bx, bz, by, dur, h) => {
      cat.jump = {
        ax: cat.x, az: cat.z, ay: cat.y, bx, bz, by, t: 0, dur, h,
        phase: "crouch", pt: 0.17,
        hd: Math.hypot(bx - cat.x, bz - cat.z),
        want: Math.atan2(bx - cat.x, bz - cat.z),
      };
    };

    const setState = (s, t) => { cat.state = s; cat.t = t; };

    /* leave wherever the cat is standing, properly */
    const resumeFrom = () => {
      if (cat.y > 0.6) {
        beginJump(2.15, 0.55, FLOOR, 0.7, 0.35);
        setState("jumpDown", 0);
      } else {
        cat.target = floorSpot();
        setState("wander", 0);
      }
    };

    const wrapA = (a) => ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

    systems.push((dt) => {
      cat.deskCool -= dt;
      cat.t -= dt;

      /* -- state logic -- */
      switch (cat.state) {
        case "enter":
          cat.speed = 0.62;
          if (arrive(dt)) setState("pause", rand(0.6, 1.4));
          break;
        case "wander":
          cat.speed = 0.55;
          if (arrive(dt)) {
            const r = Math.random();
            if (cat.deskCool <= 0 && r < 0.3) {
              cat.target = { x: 2.35, z: 0.35 }; // launch point by the drawers
              setState("toLaunch", 0);
            } else if (r < 0.62) setState("sit", rand(3.5, 7));
            else setState("pause", rand(0.8, 2));
          }
          break;
        case "pause":
        case "sit":
          cat.speed = 0;
          if (cat.t <= 0) resumeFrom();
          break;
        case "look":
          /* freeze and swing around to face whoever clicked */
          cat.speed = 0;
          cat.heading += wrapA(Math.atan2(camera.position.x - cat.x, camera.position.z - cat.z) - cat.heading) * lerpK(5, dt);
          if (cat.t <= 0) {
            if (cat.y > 0.6) setState("loaf", rand(5, 9));
            else resumeFrom();
          }
          break;
        case "toLaunch":
          cat.speed = 0.62;
          if (arrive(dt)) {
            beginJump(1.42, -0.42, DESK_TOP, 0.58, 0.5);
            setState("jumpUp", 0);
          }
          break;
        case "jumpUp":
        case "jumpDown":
        case "hop":
          break; // handled by the jump integrator
        case "deskWalk":
          cat.speed = 0.42;
          if (arrive(dt)) setState("loaf", rand(9, 15));
          break;
        case "loaf":
          cat.speed = 0;
          if (cat.t <= 0) {
            beginJump(2.15, 0.55, FLOOR, 0.7, 0.35);
            setState("jumpDown", 0);
          }
          break;
      }

      /* -- locomotion -- */
      function arrive(dt) {
        const dx = cat.target.x - cat.x, dz = cat.target.z - cat.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.09) return true;
        cat.heading += wrapA(Math.atan2(dx, dz) - cat.heading) * lerpK(6, dt);
        const step = cat.speed * dt;
        cat.x += Math.sin(cat.heading) * step;
        cat.z += Math.cos(cat.heading) * step;
        return false;
      }

      /* -- jump: coil, spring, sail, absorb -- */
      let squashT = 0, stretchT = 0;
      if (cat.jump) {
        const j = cat.jump;
        if (j.phase === "crouch") {
          j.pt -= dt;
          squashT = 1; // wind up low, eyes on the landing spot
          cat.heading += wrapA(j.want - cat.heading) * lerpK(14, dt);
          if (j.pt <= 0) j.phase = "fly";
        } else if (j.phase === "fly") {
          j.t += dt;
          const k = Math.min(1, j.t / j.dur);
          cat.x = j.ax + (j.bx - j.ax) * k;
          cat.z = j.az + (j.bz - j.az) * k;
          cat.y = j.ay + (j.by - j.ay) * k + j.h * 4 * k * (1 - k);
          /* nose follows the flight path */
          const dydk = (j.by - j.ay) + j.h * 4 * (1 - 2 * k);
          bodyG.rotation.x = -Math.atan2(dydk, Math.max(j.hd, 0.25)) * 0.6;
          stretchT = k < 0.4 ? 1 : 0;
          if (k >= 1) {
            j.phase = "land";
            j.pt = 0.16;
            cat.x = j.bx; cat.z = j.bz; cat.y = j.by;
          }
        } else {
          /* land: soak it up through the front legs */
          j.pt -= dt;
          squashT = 1;
          bodyG.rotation.x += (0 - bodyG.rotation.x) * lerpK(14, dt);
          if (j.pt <= 0) {
            cat.jump = null;
            if (cat.state === "jumpUp") { cat.target = { x: 1.05, z: -0.78 }; setState("deskWalk", 0); }
            else if (cat.state === "jumpDown") { cat.deskCool = rand(26, 40); cat.target = floorSpot(); setState("wander", 0); }
            else setState("pause", rand(0.4, 0.9)); // hop landing
          }
        }
      }
      cat.squash += (squashT - cat.squash) * lerpK(cat.jump && cat.jump.phase !== "crouch" ? 22 : 12, dt);
      cat.stretch += (stretchT - cat.stretch) * lerpK(14, dt);

      /* -- pose targets per state -- */
      const sitting = cat.state === "sit";
      const loafing = cat.state === "loaf";
      const looking = cat.state === "look";
      cat.lookAmt += ((looking ? 1 : 0) - cat.lookAmt) * lerpK(5, dt);
      cat.goal.rx = sitting ? -0.52 : loafing ? -0.08 : 0;
      cat.goal.y = loafing ? -0.055 : sitting ? 0.01 : 0;
      cat.goal.legTuck = loafing ? 1 : 0;
      cat.goal.headRx = sitting ? -0.18 : loafing ? -0.05 : looking ? -0.24 : 0.06;
      const P = cat.pose;
      for (const key of ["rx", "y", "legTuck", "headRx"])
        P[key] += (cat.goal[key] - P[key]) * lerpK(5, dt);

      /* -- gait + legs -- */
      const moving = cat.speed > 0 && !cat.jump;
      cat.gait += ((moving ? 1 : 0) - cat.gait) * lerpK(8, dt);
      cat.walkPhase += dt * (cat.speed * 14 + 0.001);
      const lp = [0, Math.PI, Math.PI, 0];
      legs.forEach((leg, i) => {
        let rx;
        if (cat.jump && cat.jump.phase === "fly") {
          const k = cat.jump.t / cat.jump.dur;
          /* rear legs drive then tuck; front legs tuck then reach for the landing */
          rx = i > 1 ? (k < 0.45 ? -0.6 : 0.5) : (k < 0.6 ? 0.55 : -0.55);
        } else if (cat.jump) {
          rx = i > 1 ? 0.55 : -0.2; // coiled under the body
        } else {
          /* walk swing; rear legs fold when sitting, front legs counter the pitch */
          rx = Math.sin(cat.walkPhase + lp[i]) * 0.55 * cat.gait + (i > 1 ? P.rx * 1.7 : -P.rx);
        }
        leg.rotation.x += (rx - leg.rotation.x) * lerpK(16, dt);
        leg.scale.y = 1 - P.legTuck * 0.55 - cat.squash * 0.22;
      });

      catG.position.set(cat.x, cat.y + 0.005, cat.z);
      catG.rotation.y = cat.heading;
      if (!cat.jump) bodyG.rotation.x = P.rx;
      /* squash & stretch breathe through the whole body */
      bodyG.position.y =
        0.19 + P.y + Math.abs(Math.sin(cat.walkPhase)) * 0.02 * cat.gait - cat.squash * 0.05;
      bodyG.scale.set(1 + cat.squash * 0.07, 1 - cat.squash * 0.2, 1 + cat.stretch * 0.11 + cat.squash * 0.05);

      /* -- head: staring at you beats watching the cursor -- */
      const watchful = (sitting || loafing) && finePointer && !reduced;
      if (looking || watchful) {
        const cursorBias = looking ? 0 : view.mx * 0.7;
        let dA = wrapA(Math.atan2(camera.position.x - cat.x, camera.position.z - cat.z) - cat.heading + cursorBias);
        headG.rotation.y += (Math.max(-1, Math.min(1, dA)) - headG.rotation.y) * lerpK(looking ? 7 : 4, dt);
        const tilt = looking ? P.headRx : P.headRx + view.my * 0.25;
        headG.rotation.x += (tilt - headG.rotation.x) * lerpK(looking ? 7 : 4, dt);
      } else {
        headG.rotation.y += (0 - headG.rotation.y) * lerpK(4, dt);
        headG.rotation.x += (P.headRx - headG.rotation.x) * lerpK(4, dt);
      }
      /* ears perk forward under attention */
      for (const e of ears) e.rotation.x += (cat.lookAmt * -0.28 - e.rotation.x) * lerpK(8, dt);

      /* -- tail: swish always; alert flicks while staring -- */
      const swish = looking ? 1.7 : loafing ? 0.55 : sitting ? 1.15 : 0.8;
      tail[0].rotation.x = 0.85 + (sitting ? 0.5 : loafing ? 0.7 : 0) + cat.lookAmt * 0.35 - cat.gait * 0.25;
      tail.forEach((seg, i) => {
        seg.rotation.y = Math.sin(clock * (1.6 + i * 0.35) * swish + i * 0.9) * (0.28 + i * 0.2) * (1 - cat.lookAmt * 0.45);
      });

      /* -- eyes: blink normally, go wide and bright when staring -- */
      cat.blink -= dt;
      if (cat.blink <= 0) { cat.blink = rand(2.5, 6); cat.blinkT = looking ? 0 : 0.12; }
      cat.blinkT = Math.max(0, cat.blinkT - dt);
      const lid = cat.blinkT > 0 ? 0.12 : 1;
      const wide = 1 + cat.lookAmt * 0.45;
      eyeL.scale.set(wide, lid * wide, 1);
      eyeR.scale.set(wide, lid * wide, 1);
      eyeM.color.copy(eyeBase).lerp(eyeBright, cat.lookAmt);
      /* slit pupils blow wide open when locked on */
      pupilL.scale.x = pupilR.scale.x = 1 + cat.lookAmt * 1.7;

      /* -- blob shadow -- */
      const overDesk = cat.y > 0.6;
      const ground = overDesk ? DESK_TOP + 0.006 : FLOOR + 0.006;
      const lift = Math.max(0, cat.y - ground);
      blob.position.set(cat.x, ground, cat.z);
      blob.material.opacity = Math.max(0.08, 0.3 - lift * 0.35);
      const bs = 1 + lift * 0.4;
      blob.scale.set(bs, bs, 1);
    });
  }

  /* ---------- easter eggs: the room answers clicks ---------- */
  const lampBase = new THREE.Color(0xffe2b4);
  function applyLamp(v) {
    props.lampV = v;
    lampLight.intensity = 26 * v;
    if (props.lamp) {
      props.lamp.bulb.material.color.copy(lampBase).multiplyScalar(0.12 + 0.88 * v);
      props.lamp.halo.material.opacity = 0.35 * v;
    }
  }

  /* a shared flicker: old bulbs and crt screens wake up the same way */
  function flickOn(apply) {
    const p = { v: 0 };
    return gsap.to(p, {
      keyframes: [
        { v: 0.85, duration: 0.06 }, { v: 0.15, duration: 0.05 },
        { v: 1, duration: 0.07 }, { v: 0.35, duration: 0.06 }, { v: 1, duration: 0.1 },
      ],
      onUpdate: () => apply(p.v),
    });
  }

  if (CONFIG.easterEggs && !reduced) {
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2(9, 9);
    let overCanvas = false;
    let hovered = null;
    const eggs = [
      { obj: props.lampG, id: "lamp" },
      { obj: props.catG, id: "cat" },
      { obj: props.tableG, id: "vinyl" },
    ].filter((e) => e.obj);

    const toNdc = (e) => {
      const r = cvs.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };

    const pick = () => {
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(eggs.map((e) => e.obj), true)[0];
      if (!hit) return null;
      for (let o = hit.object; o; o = o.parent) {
        const e = eggs.find((e) => e.obj === o);
        if (e) return e.id;
      }
      return null;
    };

    cvs.addEventListener("pointermove", (e) => { toNdc(e); overCanvas = true; }, { passive: true });
    cvs.addEventListener("pointerleave", () => { overCanvas = false; });

    if (finePointer) {
      systems.push(() => {
        const id = overCanvas ? pick() : null;
        if (id !== hovered) {
          hovered = id;
          document.body.classList.toggle("cursor-hover", !!id);
          cvs.style.cursor = id ? "pointer" : "";
        }
      });
    }

    cvs.addEventListener("click", (e) => {
      toNdc(e);
      const id = pick();
      if (id === "lamp") {
        props.lamp.on = !props.lamp.on;
        if (props.lamp.on) flickOn(applyLamp);
        else {
          const p = { v: props.lampV ?? 1 };
          gsap.to(p, { v: 0, duration: 0.16, onUpdate: () => applyLamp(p.v) });
        }
      } else if (id === "cat") {
        props.catLook();
      } else if (id === "vinyl") {
        props.vinyl.boost = 9;
        props.noteAt(2.45, 1.4, -0.8);
      }
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

  /* ---------- reveal: the room rises, then the rig boots ---------- */
  function reveal() {
    started = true;
    if (reduced) {
      /* one honest frame, no motion — cat posed on the rug */
      if (props.cat) {
        props.cat.x = 1.35;
        props.cat.z = 1.05;
        props.cat.heading = 0.6;
        props.cat.state = "sit";
        props.cat.pose.rx = -0.52;
      }
      cvs.style.opacity = 1;
      for (const s of screens) s.paint();
      update(0);
      renderer.render(scene, camera);
      return;
    }

    /* start cold: lamp off, screens dead, accent glows down */
    applyLamp(0);
    glowBoot.amp = 0;
    screenGlow.intensity = 0;
    sageWash.intensity = 0;
    if (props.ledWash) props.ledWash.intensity = 0;
    if (props.strip) props.strip.scale.x = 0.001;
    if (props.ledGlows) for (const s of props.ledGlows) s.material.opacity = 0;
    for (const s of screens) { s.mode = "off"; s.paint(); }
    for (const m of screenMats) m.color.setScalar(0.35); // dead-panel grey once lit
    root.position.y = -0.5;
    view.entr = 1.14;

    gsap.ticker.add(tick);

    const tl = gsap.timeline();
    tl.to(cvs, { opacity: 1, duration: 0.7, ease: "power2.out" }, 0);
    tl.to(root.position, { y: 0, duration: 1.15, ease: "power3.out" }, 0.05);
    tl.to(view, { entr: 1, duration: 2.0, ease: "power3.out" }, 0);
    /* the lamp wakes first — someone's clearly home */
    tl.add(flickOn(applyLamp), 0.5);
    /* monitors power on left to right: flash, splash, then content */
    screens.forEach((s, i) => {
      const at = 1.0 + i * 0.35;
      tl.call(() => { s.mode = "boot"; s.bootT = 0; s.paint(); }, null, at);
      tl.add(flickOn((v) => screenMats[i].color.setScalar(v)), at);
      tl.call(() => { s.mode = "on"; s.paint(); }, null, at + 0.85);
    });
    tl.to(screenGlow, { intensity: 13, duration: 0.5 }, 1.35);
    tl.to(sageWash, { intensity: 6, duration: 0.6 }, 1.7);
    /* led strip sweeps on from the center */
    if (props.strip) tl.to(props.strip.scale, { x: 1, duration: 0.55, ease: "power2.out" }, 2.1);
    if (props.ledGlows) props.ledGlows.forEach((s, i) => tl.to(s.material, { opacity: 0.12, duration: 0.4 }, 2.15 + i * 0.08));
    if (props.ledWash) tl.to(props.ledWash, { intensity: 4, duration: 0.6 }, 2.2);
    tl.to(glowBoot, { amp: 1, duration: 0.6 }, 2.3);
    /* and the first note drifts up */
    tl.call(() => props.noteAt && props.noteAt(), null, 3.0);
  }

  if (window.__rhHeroIn) reveal();
  else document.addEventListener("rh:hero-in", reveal, { once: true });
}
