/* ------------------------------------------------------------------
   hero-bg.js — "torchlight": the hero hides a topographic map drawn
   from noise, and the cursor is the only light in the room. Move and
   the contours surface inside a soft falloff, leaving a trail that
   takes a few seconds to go dark again. Click to send a pulse.

   Contours are marching-squares iso-lines, rendered once per resize
   into an offscreen canvas; every frame just masks that bitmap with a
   light map (destination-in), so the per-frame cost is two blits.
   ------------------------------------------------------------------ */

(() => {
  const cvs = document.getElementById("heroBg");
  const hero = cvs && cvs.parentElement;
  if (!cvs || !hero) return;
  const ctx = cvs.getContext("2d");
  if (!ctx) return;

  const CONFIG = {
    sage: "168,181,138",
    warm: "255,201,138",
    levels: 16,       // iso-lines in the map
    grid: 10,         // px between samples — smaller is smoother and slower
    torch: 285,       // px radius of the light
    trail: 2.6,       // seconds a revealed spot takes to fade out
    motes: 46,
  };

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = !matchMedia("(pointer: fine)").matches;

  /* ---------- value noise + fbm for the terrain ---------- */
  const perm = new Uint8Array(512);
  {
    let s = 90210;
    for (let i = 0; i < 256; i++) perm[i] = i;
    for (let i = 255; i > 0; i--) {
      s = (s * 1664525 + 1013904223) >>> 0;
      const j = s % (i + 1);
      const t = perm[i]; perm[i] = perm[j]; perm[j] = t;
    }
    perm.set(perm.subarray(0, 256), 256);
  }
  const fade = (t) => t * t * (3 - 2 * t);
  const grid = (x, y) => perm[(perm[x & 255] + (y & 255)) & 255] * 0.00392156;

  function noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const u = fade(x - xi), v = fade(y - yi);
    const a = grid(xi, yi), b = grid(xi + 1, yi);
    const c = grid(xi, yi + 1), d = grid(xi + 1, yi + 1);
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  }
  function fbm(x, y) {
    let v = 0, amp = 0.5, f = 0.0026;
    for (let o = 0; o < 4; o++) { v += noise(x * f, y * f) * amp; amp *= 0.5; f *= 2.13; }
    return v;
  }

  /* ---------- layers ---------- */
  const map = document.createElement("canvas");   // the hidden contours
  const mctx = map.getContext("2d");
  const lamp = document.createElement("canvas");  // this frame's light
  const lctx = lamp.getContext("2d");

  function glow(rgb, size) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, `rgba(${rgb},0.9)`);
    grad.addColorStop(0.4, `rgba(${rgb},0.22)`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return c;
  }
  const dot = glow(CONFIG.sage, 40);
  const core = glow(CONFIG.warm, 320);

  let W = 0, H = 0, dpr = 1, motes = [];
  const rnd = (a, b) => a + Math.random() * (b - a);

  /* ---------- the map: iso-lines through a noise terrain ---------- */
  function drawMap() {
    const step = CONFIG.grid;
    const cols = Math.ceil(W / step) + 1;
    const rows = Math.ceil(H / step) + 1;
    const f = new Float32Array(cols * rows);
    let lo = Infinity, hi = -Infinity;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const v = fbm(i * step, j * step);
        f[j * cols + i] = v;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }

    mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mctx.clearRect(0, 0, W, H);
    mctx.lineJoin = "round";

    for (let L = 0; L < CONFIG.levels; L++) {
      const iso = lo + ((L + 0.5) / CONFIG.levels) * (hi - lo);
      const index = L % 4 === 0;          // every 4th line is an index contour
      mctx.strokeStyle = `rgba(${CONFIG.sage},${index ? 0.95 : 0.52})`;
      mctx.lineWidth = index ? 1.35 : 0.8;
      mctx.beginPath();

      for (let j = 0; j < rows - 1; j++) {
        for (let i = 0; i < cols - 1; i++) {
          const x = i * step, y = j * step;
          const a = f[j * cols + i], b = f[j * cols + i + 1];
          const c = f[(j + 1) * cols + i + 1], d = f[(j + 1) * cols + i];
          const k = (a > iso ? 8 : 0) | (b > iso ? 4 : 0) | (c > iso ? 2 : 0) | (d > iso ? 1 : 0);
          if (k === 0 || k === 15) continue;

          const top = () => [x + step * ((iso - a) / (b - a)), y];
          const right = () => [x + step, y + step * ((iso - b) / (c - b))];
          const bottom = () => [x + step * ((iso - d) / (c - d)), y + step];
          const left = () => [x, y + step * ((iso - a) / (d - a))];
          const seg = (p, q) => { mctx.moveTo(p[0], p[1]); mctx.lineTo(q[0], q[1]); };

          switch (k) {
            case 1: case 14: seg(left(), bottom()); break;
            case 2: case 13: seg(bottom(), right()); break;
            case 3: case 12: seg(left(), right()); break;
            case 4: case 11: seg(top(), right()); break;
            case 6: case 9: seg(top(), bottom()); break;
            case 7: case 8: seg(top(), left()); break;
            case 5: seg(top(), left()); seg(bottom(), right()); break;
            case 10: seg(top(), right()); seg(left(), bottom()); break;
          }
        }
      }
      mctx.stroke();
    }
  }

  function build() {
    const rect = hero.getBoundingClientRect();
    W = Math.max(1, Math.round(rect.width));
    H = Math.max(1, Math.round(rect.height));
    dpr = Math.min(devicePixelRatio || 1, 1.6);
    for (const c of [cvs, map, lamp]) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    cvs.style.width = W + "px";
    cvs.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    motes = [];
    for (let i = 0; i < CONFIG.motes; i++) {
      motes.push({
        x: rnd(0, W), y: rnd(0, H),
        vx: rnd(-6, 6), vy: rnd(-14, -3),
        r: rnd(0.8, 2.2), a: rnd(0.2, 0.6),
      });
    }
    drawMap();
  }

  /* ---------- pointer, trail, pulses ---------- */
  const ptr = { x: -999, y: -999, tx: -999, ty: -999, speed: 0, seen: 0, held: false };
  let rect = hero.getBoundingClientRect();
  const trail = [];
  const pulses = [];

  addEventListener("pointermove", (e) => {
    ptr.tx = e.clientX - rect.left;
    ptr.ty = e.clientY - rect.top;
    ptr.seen = performance.now();
  }, { passive: true });

  hero.addEventListener("pointerdown", (e) => {
    pulses.push({ x: e.clientX - rect.left, y: e.clientY - rect.top, r: 10, life: 1 });
  }, { passive: true });

  function wander(t) {
    ptr.tx = W * (0.5 + 0.34 * Math.sin(t * 0.19) * Math.cos(t * 0.11));
    ptr.ty = H * (0.5 + 0.26 * Math.sin(t * 0.15 + 0.9));
  }

  /* ---------- frame ---------- */
  let level = 0;

  function frame(t, dt) {
    const beat = window.Player && window.Player.level ? window.Player.level() : 0;
    level += (beat - level) * 0.08;

    const px = ptr.x, py = ptr.y;
    if (coarse || t * 1000 - ptr.seen > 2600) wander(t);
    ptr.x += (ptr.tx - ptr.x) * 0.16;
    ptr.y += (ptr.ty - ptr.y) * 0.16;
    const moved = Math.hypot(ptr.x - px, ptr.y - py);
    ptr.speed += (Math.min(40, moved) - ptr.speed) * 0.12;

    /* the trail is what makes the light feel like it has memory */
    if (moved > 5 || !trail.length) trail.push({ x: ptr.x, y: ptr.y, life: 1 });
    for (let i = trail.length - 1; i >= 0; i--) {
      trail[i].life -= dt / CONFIG.trail;
      if (trail[i].life <= 0) trail.splice(i, 1);
    }
    if (trail.length > 90) trail.splice(0, trail.length - 90);

    /* ---- the light map ---- */
    lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lctx.clearRect(0, 0, W, H);
    lctx.globalCompositeOperation = "lighter";

    for (const p of trail) {
      const r = 92 * p.life + 26;
      const g = lctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, `rgba(255,255,255,${(p.life * 0.5).toFixed(3)})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      lctx.fillStyle = g;
      lctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    }

    const R = CONFIG.torch * (1 + level * 0.22 + Math.sin(t * 0.7) * 0.04) + ptr.speed * 1.6;
    const tg = lctx.createRadialGradient(ptr.x, ptr.y, 0, ptr.x, ptr.y, R);
    tg.addColorStop(0, "rgba(255,255,255,1)");
    tg.addColorStop(0.45, "rgba(255,255,255,0.5)");
    tg.addColorStop(1, "rgba(255,255,255,0)");
    lctx.fillStyle = tg;
    lctx.fillRect(ptr.x - R, ptr.y - R, R * 2, R * 2);

    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      p.r += dt * 620;
      p.life -= dt * 0.85;
      if (p.life <= 0) { pulses.splice(i, 1); continue; }
      lctx.strokeStyle = `rgba(255,255,255,${(p.life * 0.55).toFixed(3)})`;
      lctx.lineWidth = 46 * p.life + 8;
      lctx.beginPath();
      lctx.arc(p.x, p.y, p.r, 0, 6.2832);
      lctx.stroke();
    }
    lctx.globalCompositeOperation = "source-over";

    /* ---- composite: map, cut to the light, plus a whisper everywhere ---- */
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(map, 0, 0, W, H);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(lamp, 0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";

    /* so the hero is never a black rectangle before you touch it */
    ctx.globalAlpha = 0.04 + level * 0.03;
    ctx.drawImage(map, 0, 0, W, H);
    ctx.globalAlpha = 1;

    /* ---- warm core + dust that catches the light ---- */
    ctx.globalCompositeOperation = "lighter";
    const cs = R * 0.85;
    ctx.globalAlpha = 0.21 + level * 0.1;
    ctx.drawImage(core, ptr.x - cs, ptr.y - cs, cs * 2, cs * 2);

    for (const m of motes) {
      m.x += m.vx * dt; m.y += m.vy * dt;
      if (m.y < -20) { m.y = H + 20; m.x = rnd(0, W); }
      if (m.x < -20) m.x = W + 20; else if (m.x > W + 20) m.x = -20;
      const near = 1 - Math.min(1, Math.hypot(m.x - ptr.x, m.y - ptr.y) / (R * 1.4));
      const s = m.r * (3.4 + near * 3);
      ctx.globalAlpha = m.a * (0.22 + near * 0.78) * (0.8 + level * 0.4);
      ctx.drawImage(dot, m.x - s, m.y - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  /* ---------- loop ---------- */
  let raf = 0, last = 0, t0 = 0, visible = true, resizeTimer = 0;

  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (!t0) { t0 = now; last = now; }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    frame((now - t0) / 1000, dt);
  }
  function play() {
    if (raf || reduced || !visible) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }
  function pause() { cancelAnimationFrame(raf); raf = 0; }

  build();
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {   // the map is expensive; only redraw once you settle
      rect = hero.getBoundingClientRect();
      build();
      if (reduced) still();
    }, 180);
  }, { passive: true });
  addEventListener("scroll", () => { rect = hero.getBoundingClientRect(); }, { passive: true });

  /* reduced motion: a single lit frame, no loop, no trail */
  function still() {
    ptr.x = ptr.tx = W * 0.32;
    ptr.y = ptr.ty = H * 0.55;
    trail.length = 0;
    frame(0, 0.016);
  }

  if (reduced) {
    still();
  } else {
    new IntersectionObserver((es) => {
      visible = es[0].isIntersecting;
      visible ? play() : pause();
    }, { threshold: 0 }).observe(hero);
    document.addEventListener("visibilitychange", () => (document.hidden ? pause() : play()));
    play();
  }

  const reveal = () => cvs.classList.add("in");
  if (window.__rhHeroIn) reveal();
  else document.addEventListener("rh:hero-in", reveal, { once: true });
})();
