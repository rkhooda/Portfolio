/* ------------------------------------------------------------------
   sleeve.js — the outro's right-hand panel.

   The waveform band reads the same AnalyserNode the mini-player already
   owns. Sound is off by default, though, so a band driven only by real
   audio would be a flat line for almost everyone who ever sees it — the
   muted state draws a slow synthetic drift instead, and clicking it is
   a second way into the ambient loop.
   ------------------------------------------------------------------ */

(() => {
  const canvas = document.getElementById("waveCanvas");
  const contact = document.getElementById("contact");
  if (!canvas || !contact) return;

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = canvas.getContext("2d");
  const label = document.getElementById("waveLabel");
  const ACCENT = "#a8b58a";

  let w = 0, h = 0, raf = 0, near = false, t = 0, amp = 0, said = "";

  /* the canvas is laid out by CSS and only then given its pixel buffer,
     so it stays crisp on a retina screen without hard-coding a size */
  function size() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = r.width;
    h = r.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }

  /* two sines at odd ratios: close enough to a signal to read as one,
     far enough from a loop that it never visibly repeats */
  const idle = (p) => Math.sin(p * 6.1 + t) * 0.5 + Math.sin(p * 13.7 - t * 0.7) * 0.28;

  const N = 150; // samples across the band — more is invisible at this size

  function draw() {
    const data = window.Player && Player.wave ? Player.wave() : null;
    /* one number crossfades the two sources, so turning the sound on eases
       the line into the music instead of cutting to it */
    amp += ((data ? 1 : 0) - amp) * 0.05;
    t += 0.018;

    ctx.clearRect(0, 0, w, h);

    const mid = h / 2;
    ctx.strokeStyle = "rgba(234,234,226,0.07)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(w, mid);
    ctx.stroke();

    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const p = i / N;
      const live = data ? (data[((p * (data.length - 1)) | 0)] - 128) / 128 : 0;
      /* the envelope pins both ends to the centre line, so the trace sits
         inside the panel instead of being sliced off by it */
      const env = Math.sin(p * Math.PI);
      const y = mid - (live * amp + idle(p) * (1 - amp) * 0.34) * env * h * 0.42;
      i ? ctx.lineTo(p * w, y) : ctx.moveTo(p * w, y);
    }
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 1.4;
    ctx.shadowColor = "rgba(168,181,138,0.5)";
    ctx.shadowBlur = 10 * (0.3 + amp * 0.7);
    ctx.stroke();
    ctx.shadowBlur = 0;

    const next = data ? "SIGNAL — LIVE" : "SIGNAL — MUTED · TAP TO PLAY";
    if (next !== said) label.textContent = (said = next);
  }

  function tick() {
    raf = 0;
    draw();
    if (near) raf = requestAnimationFrame(tick);
  }

  /* the loop only runs while the outro is actually on screen — reading the
     work section shouldn't cost a waveform's worth of frames */
  new IntersectionObserver((es) => {
    near = es[0].isIntersecting;
    if (!near) {
      cancelAnimationFrame(raf);
      raf = 0;
      return;
    }
    if (!size()) return;
    if (reduced) draw();          // one frame, no loop
    else if (!raf) raf = requestAnimationFrame(tick);
  }, { rootMargin: "20% 0px" }).observe(contact);

  addEventListener("resize", () => {
    if (size() && !raf) draw();
  });

  /* the band is a second door to the same switch — no new audio path */
  document.getElementById("waveBtn").addEventListener("click", () =>
    document.getElementById("soundToggle").click()
  );
})();
