/* ------------------------------------------------------------------
   waves.js — ambient background: a dense web of fine flowing lines
   (silk / flow-field style) drifting with time and swirling away from
   the cursor, with cursor speed feeding the disturbance. Sits behind
   all content (z-index -1), pointer-events none, barely-there alpha.
   Static single draw under prefers-reduced-motion.
   ------------------------------------------------------------------ */

(() => {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = document.createElement("canvas");
  canvas.id = "waves";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);
  const ctx = canvas.getContext("2d");
  const TAU = Math.PI * 2;

  let W, H, lines = [];
  const mouse = { x: -9e3, y: -9e3, sx: -9e3, sy: -9e3, speed: 0 };
  const XSTEP = 24;  // px between sampled points along each line
  const R = 240;     // cursor influence radius
  const PUSH = 34;   // radial shove
  const SWIRL = 26;  // tangential shove — the "circly" part

  /* deterministic per-line randomness so rebuilds look identical */
  const rnd = (i) => {
    const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  function build() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth;
    H = innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const gap = Math.max(24, Math.round(H / 34));
    const n = Math.ceil(H / gap) + 2;
    lines = Array.from({ length: n }, (_, i) => ({
      y: i * gap - gap / 2,
      a1: 8 + 10 * rnd(i + 1),  f1: 0.004 + 0.003 * rnd(i + 2),
      s1: 0.28 + 0.22 * rnd(i + 3), p1: TAU * rnd(i + 4),
      a2: 5 + 8 * rnd(i + 5),   f2: 0.009 + 0.005 * rnd(i + 6),
      s2: 0.16 + 0.18 * rnd(i + 7), p2: TAU * rnd(i + 8),
      a3: 10 + 14 * rnd(i + 9), f3: 0.0012 + 0.0009 * rnd(i + 10),
      p3: TAU * rnd(i + 11),
      alpha: 0.03 + 0.06 * rnd(i + 12) ** 2,
    }));
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    mouse.sx += (mouse.x - mouse.sx) * 0.1;
    mouse.sy += (mouse.y - mouse.sy) * 0.1;
    mouse.speed *= 0.94; // disturbance decays when the cursor rests
    const boost = 1 + Math.min(mouse.speed * 0.03, 1.4);
    for (const l of lines) {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(168, 181, 138, ${l.alpha})`;
      for (let x = -XSTEP; x <= W + XSTEP; x += XSTEP) {
        let y = l.y
          + l.a1 * Math.sin(x * l.f1 + t * l.s1 + l.p1)
          + l.a2 * Math.sin(x * l.f2 - t * l.s2 + l.p2)
          /* shared nested-sine field: neighbours converge and part
             in slow curls instead of waving in lockstep */
          + l.a3 * Math.sin(x * l.f3 + Math.sin(l.y * 0.004 + t * 0.11) * 1.6 + t * 0.07 + l.p3);
        const dx = x - mouse.sx, dy = y - mouse.sy;
        const d2 = dx * dx + dy * dy;
        if (d2 < R * R) {
          const d = Math.sqrt(d2) || 1;
          const g = (1 - d / R) ** 2 * boost;
          y += (dy / d) * g * PUSH   // pushed away from the cursor…
             + (dx / d) * g * SWIRL; // …with a sideways curl around it
        }
        x === -XSTEP ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  build();
  addEventListener("resize", () => {
    build();
    if (reduced) draw(0);
  });

  if (reduced) {
    draw(0);
    return;
  }
  addEventListener("mousemove", (e) => {
    mouse.speed = Math.min(
      mouse.speed + Math.abs(e.movementX) + Math.abs(e.movementY), 90);
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }, { passive: true });
  document.documentElement.addEventListener("mouseleave", () => {
    mouse.x = -9e3;
    mouse.y = -9e3;
  });
  (function loop(ms) {
    requestAnimationFrame(loop);
    draw((ms || 0) / 1000);
  })(0);
})();
