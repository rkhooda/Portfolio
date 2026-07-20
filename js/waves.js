/* ------------------------------------------------------------------
   waves.js — ambient background: slow contour-like sage lines that
   drift with time and bow away from the cursor. Sits behind all
   content (z-index -1), pointer-events none, barely-there alpha.
   Static single draw under prefers-reduced-motion.
   ------------------------------------------------------------------ */

(() => {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = document.createElement("canvas");
  canvas.id = "waves";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);
  const ctx = canvas.getContext("2d");

  let W, H, lines = [];
  const mouse = { x: -9999, y: -9999, sx: -9999, sy: -9999 };
  const STEP = 14;   // px between sampled points down each line
  const R = 190;     // cursor influence radius
  const PUSH = 70;   // max px a point is pushed away

  function build() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth;
    H = innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.max(4, Math.round(W / 260));
    lines = Array.from({ length: n }, (_, i) => ({
      x: (W / n) * (i + 0.5) + Math.sin(i * 7.3) * (W / n) * 0.3,
      a1: 50 + 45 * Math.abs(Math.sin(i * 3.7)), // slow big bend
      a2: 24 + 20 * Math.abs(Math.sin(i * 5.1)), // faster small ripple
      f1: 0.0026 + 0.0009 * Math.sin(i * 2.3),
      f2: 0.0009 + 0.0004 * Math.cos(i * 1.7),
      p1: i * 2.1,
      p2: i * 4.4,
      s1: 0.2 + 0.08 * Math.abs(Math.sin(i)),
      s2: 0.11,
      alpha: 0.05 + 0.05 * Math.abs(Math.sin(i * 9.7)),
    }));
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    mouse.sx += (mouse.x - mouse.sx) * 0.08; // smoothed cursor = fluid bow
    mouse.sy += (mouse.y - mouse.sy) * 0.08;
    for (const l of lines) {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(168, 181, 138, ${l.alpha})`;
      for (let y = -20; y <= H + 20; y += STEP) {
        let x = l.x
          + l.a1 * Math.sin(y * l.f1 + t * l.s1 + l.p1)
          + l.a2 * Math.sin(y * l.f2 - t * l.s2 + l.p2);
        const dx = x - mouse.sx, dy = y - mouse.sy;
        const d2 = dx * dx + dy * dy;
        if (d2 < R * R) {
          const d = Math.sqrt(d2) || 1;
          x += (dx / d) * (1 - d / R) ** 2 * PUSH;
        }
        y === -20 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
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
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }, { passive: true });
  document.documentElement.addEventListener("mouseleave", () => {
    mouse.x = -9999;
    mouse.y = -9999;
  });
  (function loop(ms) {
    requestAnimationFrame(loop);
    draw((ms || 0) / 1000);
  })(0);
})();
