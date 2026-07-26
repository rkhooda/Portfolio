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
  const hemi = new THREE.HemisphereLight(0x2a2f26, CONFIG.bg, 0.55);
  scene.add(hemi);

  /* the desk lamp owns the scene's only real shadows */
  const lampLight = new THREE.SpotLight(CONFIG.warm, 40, 9, 0.72, 0.85, 1.6);
  lampLight.position.set(-1.75, 2.3, -1.0);
  lampLight.target.position.set(-0.7, 1.15, -0.55);
  lampLight.castShadow = true;
  lampLight.shadow.mapSize.set(1024, 1024);
  lampLight.shadow.camera.near = 0.4;
  lampLight.shadow.camera.far = 9;
  lampLight.shadow.bias = -0.002;
  scene.add(lampLight, lampLight.target);

  /* monitor spill: warm off-white front glow + a sage wash */
  const screenGlow = new THREE.PointLight(0xdfe6d0, 6, 5.5, 1.8);
  screenGlow.position.set(0, 2.0, -0.55);
  scene.add(screenGlow);

  const sageWash = new THREE.PointLight(CONFIG.sage, 3, 4.5, 1.8);
  sageWash.position.set(1.35, 1.7, -0.8);
  scene.add(sageWash);

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
