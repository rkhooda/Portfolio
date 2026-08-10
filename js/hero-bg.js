/* ------------------------------------------------------------------
   hero-bg.js — "torchlight": the hero hides a topographic map drawn
   from noise, and the cursor is the only light in the room. Move and
   the contours surface inside a soft falloff, leaving a trail that
   takes a few seconds to go dark again. Click to send a pulse.

   Contours are marching-squares iso-lines, rendered once per resize
   into an offscreen canvas. Every frame then costs two full-size
   blits and a handful of sprite draws:

     · the light map is built from ONE pre-rendered radial sprite —
       no per-frame gradient objects — at half resolution, since it is
       all soft falloff and nothing about it survives a sharp edge;
     · its opaque floor doubles as the ambient whisper of the map, so
       the unlit contours come free instead of a second full blit;
     · nothing reads layout during scroll: the hero's document offset
       is measured on resize and pointer coords are resolved in-frame.

   The field dissolves into the work section rather than stopping dead
   at the hero's edge — a CSS mask softens the border, and a scrubbed
   ScrollTrigger fades the draw out entirely by the time the gallery
   is on screen (which also parks the loop).
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
    grid: 12,         // px between samples — smaller is smoother and slower
    torch: 285,       // px radius of the light
    trail: 2.6,       // seconds a revealed spot takes to fade out
    whisper: 0.05,    // how much of the map survives outside the light
    motes: 46,
    maxTrail: 56,
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
  const lamp = document.createElement("canvas");  // this frame's light, half-res
  const lctx = lamp.getContext("2d");

  function glow(rgb, size, peak, mid) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, `rgba(${rgb},${peak})`);
    grad.addColorStop(0.4, `rgba(${rgb},${mid})`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return c;
  }
  const dot = glow(CONFIG.sage, 40, 0.9, 0.22);
  const core = glow(CONFIG.warm, 320, 0.9, 0.22);
  /* the one light sprite every torch and trail point is stamped from */
  const light = glow("255,255,255", 160, 1, 0.45);

  let W = 0, H = 0, dpr = 1, ldpr = 1, motes = [];
  let heroTop = 0, heroLeft = 0;
  const rnd = (a, b) => a + Math.random() * (b - a);

  /* ---------- the map: iso-lines through a noise terrain ----------
     No closures or arrays in the cell loop — at 16 levels over a few
     thousand cells that allocation was the whole cost of a resize. */
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
          const a = f[j * cols + i], b = f[j * cols + i + 1];
          const c = f[(j + 1) * cols + i + 1], d = f[(j + 1) * cols + i];
          const k = (a > iso ? 8 : 0) | (b > iso ? 4 : 0) | (c > iso ? 2 : 0) | (d > iso ? 1 : 0);
          if (k === 0 || k === 15) continue;

          const x = i * step, y = j * step;
          switch (k) {
            case 1: case 14:  // left → bottom
              mctx.moveTo(x, y + step * ((iso - a) / (d - a)));
              mctx.lineTo(x + step * ((iso - d) / (c - d)), y + step);
              break;
            case 2: case 13:  // bottom → right
              mctx.moveTo(x + step * ((iso - d) / (c - d)), y + step);
              mctx.lineTo(x + step, y + step * ((iso - b) / (c - b)));
              break;
            case 3: case 12:  // left → right
              mctx.moveTo(x, y + step * ((iso - a) / (d - a)));
              mctx.lineTo(x + step, y + step * ((iso - b) / (c - b)));
              break;
            case 4: case 11:  // top → right
              mctx.moveTo(x + step * ((iso - a) / (b - a)), y);
              mctx.lineTo(x + step, y + step * ((iso - b) / (c - b)));
              break;
            case 6: case 9:   // top → bottom
              mctx.moveTo(x + step * ((iso - a) / (b - a)), y);
              mctx.lineTo(x + step * ((iso - d) / (c - d)), y + step);
              break;
            case 7: case 8:   // top → left
              mctx.moveTo(x + step * ((iso - a) / (b - a)), y);
              mctx.lineTo(x, y + step * ((iso - a) / (d - a)));
              break;
            case 5:           // saddle
              mctx.moveTo(x + step * ((iso - a) / (b - a)), y);
              mctx.lineTo(x, y + step * ((iso - a) / (d - a)));
              mctx.moveTo(x + step * ((iso - d) / (c - d)), y + step);
              mctx.lineTo(x + step, y + step * ((iso - b) / (c - b)));
              break;
            case 10:          // the other saddle
              mctx.moveTo(x + step * ((iso - a) / (b - a)), y);
              mctx.lineTo(x + step, y + step * ((iso - b) / (c - b)));
              mctx.moveTo(x, y + step * ((iso - a) / (d - a)));
              mctx.lineTo(x + step * ((iso - d) / (c - d)), y + step);
              break;
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
    /* measured once here so the frame loop never touches layout */
    heroTop = rect.top + scrollY;
    heroLeft = rect.left;
    dpr = Math.min(devicePixelRatio || 1, 1.6);
    ldpr = Math.max(0.5, dpr * 0.5);

    cvs.width = map.width = Math.round(W * dpr);
    cvs.height = map.height = Math.round(H * dpr);
    lamp.width = Math.round(W * ldpr);
    lamp.height = Math.round(H * ldpr);
    cvs.style.width = W + "px";
    cvs.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lctx.setTransform(ldpr, 0, 0, ldpr, 0, 0);

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
  const ptr = { x: -999, y: -999, tx: -999, ty: -999, cx: 0, cy: 0, speed: 0, seen: 0, has: false };
  const trail = [];
  const pulses = [];

  addEventListener("pointermove", (e) => {
    ptr.cx = e.clientX;
    ptr.cy = e.clientY;
    ptr.has = true;
    ptr.seen = performance.now();
  }, { passive: true });

  hero.addEventListener("pointerdown", (e) => {
    pulses.push({ x: e.clientX - heroLeft, y: e.clientY + scrollY - heroTop, r: 10, life: 1 });
    if (pulses.length > 4) pulses.shift();
  }, { passive: true });

  function wander(t) {
    ptr.tx = W * (0.5 + 0.34 * Math.sin(t * 0.19) * Math.cos(t * 0.11));
    ptr.ty = H * (0.5 + 0.26 * Math.sin(t * 0.15 + 0.9));
  }

  /* ---------- the hand-off into the work section ---------- */
  let dim = 1;   // 1 in the hero, 0 once the work section owns the screen
  if (!reduced && window.gsap && window.ScrollTrigger) {
    const work = document.getElementById("work");
    if (work) {
      const read = (st) => (dim = 1 - st.progress);
      ScrollTrigger.create({
        trigger: work, start: "top 88%", end: "top 38%",
        onUpdate: read, onRefresh: read,
      });
    }
  }

  /* ---------- frame ---------- */
  let level = 0, cleared = false;

  /* dt drives motion and is clamped so a stall can't fling anything;
     raw is the real elapsed time and drives decay, so a long frame or a
     throttled tab can't leave the whole map revealed on the way back */
  function frame(t, dt, raw) {
    /* faded out under the work section: clear once, then do nothing */
    if (dim <= 0.004) {
      if (!cleared) { ctx.clearRect(0, 0, W, H); cleared = true; }
      return;
    }
    cleared = false;

    const beat = window.Player && window.Player.level ? window.Player.level() : 0;
    level += (beat - level) * 0.08;

    /* one scroll read per frame, none per event */
    const sy = scrollY;
    if (coarse || !ptr.has || t * 1000 - ptr.seen > 2600) {
      wander(t);
    } else {
      ptr.tx = ptr.cx - heroLeft;
      ptr.ty = ptr.cy + sy - heroTop;
    }

    const px = ptr.x, py = ptr.y;
    ptr.x += (ptr.tx - ptr.x) * 0.16;
    ptr.y += (ptr.ty - ptr.y) * 0.16;
    const moved = Math.hypot(ptr.x - px, ptr.y - py);
    ptr.speed += (Math.min(40, moved) - ptr.speed) * 0.12;

    /* the trail is what makes the light feel like it has memory */
    if (moved > 5 || !trail.length) trail.push({ x: ptr.x, y: ptr.y, life: 1 });
    for (let i = trail.length - 1; i >= 0; i--) {
      trail[i].life -= raw / CONFIG.trail;
      if (trail[i].life <= 0) trail.splice(i, 1);
    }
    if (trail.length > CONFIG.maxTrail) trail.splice(0, trail.length - CONFIG.maxTrail);

    /* ---- the light map: sprite stamps, half res, opaque floor ---- */
    lctx.globalCompositeOperation = "source-over";
    lctx.fillStyle = `rgba(255,255,255,${CONFIG.whisper + level * 0.03})`;
    lctx.fillRect(0, 0, W, H);
    lctx.globalCompositeOperation = "lighter";

    for (const p of trail) {
      const r = 92 * p.life + 26;
      lctx.globalAlpha = p.life * 0.5;
      lctx.drawImage(light, p.x - r, p.y - r, r * 2, r * 2);
    }

    const R = CONFIG.torch * (1 + level * 0.22 + Math.sin(t * 0.7) * 0.04) + ptr.speed * 1.6;
    lctx.globalAlpha = 1;
    lctx.drawImage(light, ptr.x - R, ptr.y - R, R * 2, R * 2);

    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      p.r += dt * 620;
      p.life -= raw * 0.85;
      if (p.life <= 0) { pulses.splice(i, 1); continue; }
      lctx.strokeStyle = `rgba(255,255,255,${(p.life * 0.55).toFixed(3)})`;
      lctx.lineWidth = 46 * p.life + 8;
      lctx.beginPath();
      lctx.arc(p.x, p.y, p.r, 0, 6.2832);
      lctx.stroke();
    }
    lctx.globalAlpha = 1;

    /* ---- composite: the map, cut to the light ---- */
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = dim;
    ctx.drawImage(map, 0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(lamp, 0, 0, W, H);

    /* ---- warm core + dust that catches the light ---- */
    ctx.globalCompositeOperation = "lighter";
    const cs = R * 0.85;
    ctx.globalAlpha = (0.21 + level * 0.1) * dim;
    ctx.drawImage(core, ptr.x - cs, ptr.y - cs, cs * 2, cs * 2);

    for (const m of motes) {
      m.x += m.vx * dt; m.y += m.vy * dt;
      if (m.y < -20) { m.y = H + 20; m.x = rnd(0, W); }
      if (m.x < -20) m.x = W + 20; else if (m.x > W + 20) m.x = -20;
      const near = 1 - Math.min(1, Math.hypot(m.x - ptr.x, m.y - ptr.y) / (R * 1.4));
      const s = m.r * (3.4 + near * 3);
      ctx.globalAlpha = m.a * (0.22 + near * 0.78) * (0.8 + level * 0.4) * dim;
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
    const raw = (now - last) / 1000;
    last = now;
    frame((now - t0) / 1000, Math.min(0.05, raw), Math.min(0.4, raw));
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
      build();
      if (reduced) still();
    }, 180);
  }, { passive: true });

  /* reduced motion: a single lit frame, no loop, no trail */
  function still() {
    ptr.x = ptr.tx = W * 0.32;
    ptr.y = ptr.ty = H * 0.55;
    trail.length = 0;
    frame(0, 0.016, 0.016);
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

  /* fade in with the rest of the hero, once the loader lifts */
  const reveal = () => cvs.classList.add("in");
  if (window.__rhHeroIn) reveal();
  else document.addEventListener("rh:hero-in", reveal, { once: true });
})();
