/* ------------------------------------------------------------------
   sleeve.js — the outro's right-hand panel: the signal, and the names.

   The waveform band reads the same AnalyserNode the mini-player already
   owns. Sound is off by default, though, so a band driven only by real
   audio would be a flat line for almost everyone who ever sees it — the
   muted state draws a slow synthetic drift instead, and clicking it is
   a second way into the ambient loop.

   Below it, the guestbook. Every string in it was typed by a stranger,
   so every string in it reaches the DOM through textContent.
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
    loadSignatures();
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

  /* ---------------- the guestbook ---------------- */

  const list = document.getElementById("sigs");
  const countEl = document.getElementById("sigCount");
  const modal = document.getElementById("signModal");
  const form = document.getElementById("signForm");
  const nameIn = document.getElementById("sigName");
  const noteIn = document.getElementById("sigNote");
  const msg = document.getElementById("sigMsg");
  const go = document.getElementById("sigGo");
  const signBtn = document.getElementById("signBtn");

  /* "2h", not "2 hours ago" — these sit in a 9px column */
  function shortAgo(ms) {
    const s = (Date.now() - ms) / 1000;
    if (!(s >= 60)) return "now";
    if (s < 3600) return Math.floor(s / 60) + "m";
    if (s < 86400) return Math.floor(s / 3600) + "h";
    return Math.floor(s / 86400) + "d";
  }

  function line(cls, text, tag = "span") {
    const el = document.createElement(tag);
    el.className = cls;
    el.textContent = text; /* someone else's words — textContent, always */
    return el;
  }

  function row(s) {
    const li = document.createElement("li");
    const meta = document.createElement("div");
    meta.className = "sig-meta";
    meta.append(line("sig-who mono", s.n), line("sig-when mono", shortAgo(s.t), "time"));
    li.append(line("sig-note", s.m), meta);
    return li;
  }

  function render(items, count) {
    list.textContent = "";
    if (!items.length) list.append(line("sig-empty mono", "NO SIGNATURES YET — BE THE FIRST", "li"));
    else items.forEach((s) => list.append(row(s)));
    countEl.textContent = count == null ? items.length : count;
  }

  let loaded = false;
  function loadSignatures() {
    if (loaded) return;
    loaded = true;
    fetch("/api/guestbook")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => render(d.items || [], d.count))
      .catch(() => {
        /* no store to reach: say so rather than offering a button that
           can only fail */
        list.textContent = "";
        list.append(line("sig-empty mono", "THE SLEEVE IS OFFLINE RIGHT NOW", "li"));
        signBtn.disabled = true;
      });
  }

  /* ---------------- the sign dialog ---------------- */

  const say = (t) => (msg.textContent = t);
  let lastFocus = null;

  function open() {
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add("modal-open");
    if (window.lenis) lenis.stop();
    say("");
    requestAnimationFrame(() => nameIn.focus());
  }

  function close() {
    if (modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove("modal-open");
    if (window.lenis) lenis.start();
    if (lastFocus) lastFocus.focus();
  }

  signBtn.addEventListener("click", open);
  document.getElementById("sigCancel").addEventListener("click", close);
  document.getElementById("signScrim").addEventListener("click", close);

  /* escape closes it, and tab can't wander out of it while it's open */
  modal.addEventListener("keydown", (e) => {
    if (e.key === "Escape") return close();
    if (e.key !== "Tab") return;
    const f = [...form.querySelectorAll("input:not([tabindex]), button")];
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      name: nameIn.value.trim(),
      note: noteIn.value.trim(),
      website: form.website.value,
    };
    if (!payload.name || !payload.note) return say("a name and a line, please");

    go.disabled = true;
    say("signing…");
    try {
      const r = await fetch("/api/guestbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "couldn't sign right now");

      /* the list is edge-cached for half a minute, so refetching could
         easily come back without this one — put it up locally instead */
      if (d.entry) {
        const empty = list.querySelector(".sig-empty");
        if (empty) empty.remove();
        const li = row(d.entry);
        list.prepend(li);
        countEl.textContent = (parseInt(countEl.textContent, 10) || 0) + 1;
        if (!reduced && window.gsap) gsap.from(li, { opacity: 0, y: -10, duration: 0.45, ease: "power3.out" });
      }
      form.reset();
      close();
    } catch (err) {
      say(String(err.message || err));
    } finally {
      go.disabled = false;
    }
  });
})();
