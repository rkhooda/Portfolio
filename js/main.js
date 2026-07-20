/* ------------------------------------------------------------------
   main.js — render, loader, smooth scroll, reveals, gallery motion,
   track-change transition, magnetic buttons, console easter egg.
   ------------------------------------------------------------------ */

(() => {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(pointer: fine)").matches;
  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => [...(c || document).querySelectorAll(s)];

  /* ---------- console easter egg ---------- */
  const mono = "font-family:monospace;";
  console.log("%c◉ NOW PLAYING — rakshit hooda · portfolio (night sage mix)", mono + "color:#A8B58A;font-size:12px;padding:6px 0;");
  console.log("%c▂▄▆█▆▄▂  oh hey, a fellow inspector. respect.", mono + "color:#7E827A;");
  console.log("%cthe un-minified truth lives at https://github.com/rkhooda", mono + "color:#EAEAE2;");
  console.log('%c"it works on my machine" — me, lying', mono + "color:#7E827A;font-style:italic;");

  /* ---------- shared render helpers ---------- */
  const catNo = (i) => "RH-" + String(i + 1).padStart(2, "0");

  function coverHTML(p, i) {
    if (p.img) return `<img class="shot" src="${p.img}" alt="" loading="lazy">`;
    return `<span class="ghost" aria-hidden="true">${p.title.trim()[0]}</span>
      <span class="vinyl" aria-hidden="true"><span class="v-label mono">${catNo(i)}</span></span>
      ${p.wip ? '<span class="cov-wip mono">UNRELEASED</span>' : ""}`;
  }

  const rowHTML = (p, i, src, idx) => {
    const tag = p.url ? `a href="${p.url}" target="_blank" rel="noopener"` : 'button type="button"';
    const end = p.url ? "a" : "button";
    return `<li><${tag} class="bside" data-i="${i}" data-src="${src}">
      <span class="b-idx mono">${idx}</span>
      <span class="b-name">${p.title}${p.wip ? ' <em class="mono">UNRELEASED</em>' : ""}</span>
      <span class="b-desc">${p.desc}</span>
      <span class="b-tags mono">${p.tags.join(" · ")}</span>
      <span class="b-dur mono">${p.dur}</span>
      <span class="b-arrow" aria-hidden="true">↗</span>
    </${end}></li>`;
  };

  $("#bsides").innerHTML = window.BSIDES.map((p, i) => rowHTML(p, i, "b", "B" + (i + 1))).join("");
  $("#worklist").innerHTML = window.PROJECTS.map((p, i) => rowHTML(p, i, "p", catNo(i))).join("");

  /* ---------- Work: draggable infinite gallery (phantom-style) ---------- */
  const stage = $("#gstage"), plane = $("#gplane"), workList = $("#worklist");
  const P = window.PROJECTS;

  const cellHTML = (p, i) => `
    <div class="gcell">
      <button type="button" class="gcard" data-i="${i}" aria-label="${p.title} — ${p.desc}">
        <span class="g-top mono"><span>${catNo(i)}</span><span>${p.title.toUpperCase()}</span></span>
        <span class="g-mid"><span class="cover" style="--tint:${p.tint}">${coverHTML(p, i)}</span></span>
        <span class="g-bot mono"><span class="g-chips">${p.tags.map((t) => `<i>${t}</i>`).join("")}</span><span>${p.year}</span></span>
      </button>
    </div>`;

  let cells = [], cellW, cellH, spanX, spanY;
  const cam = { x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0 };
  let grabbing = false, moved = false, downX = 0, downY = 0;

  const stageH = () => stage.clientHeight || Math.min(innerHeight * 0.78, 720);

  function buildGrid() {
    /* three full rows and four columns fill the stage exactly */
    cellH = Math.floor(stageH() / 3);
    cellW = Math.max(Math.round(innerWidth / 4), Math.round(cellH * 1.05));
    /* pool = the 3x3 project pattern repeated enough to cover the stage;
       cells wrap around the pool span, so content never needs to change */
    const cols = Math.ceil((innerWidth / cellW + 2) / 3) * 3;
    const rows = Math.ceil((stageH() / cellH + 2) / 3) * 3;
    spanX = cols * cellW;
    spanY = rows * cellH;
    plane.innerHTML = "";
    cells = [];
    for (let iy = 0; iy < rows; iy++) {
      for (let ix = 0; ix < cols; ix++) {
        const pIdx = (ix % 3) + 3 * (iy % 3);
        plane.insertAdjacentHTML("beforeend", cellHTML(P[pIdx], pIdx));
        const el = plane.lastElementChild;
        el.style.width = cellW + "px";
        el.style.height = cellH + "px";
        cells.push({ el, ix, iy });
      }
    }
    place();
  }

  function place() {
    for (const c of cells) {
      const x = (((c.ix * cellW + cam.x) % spanX) + spanX) % spanX - cellW;
      const y = (((c.iy * cellH + cam.y) % spanY) + spanY) % spanY - cellH;
      c.el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }
  }

  (function galleryTick() {
    requestAnimationFrame(galleryTick);
    if (stage.hidden || !cells.length) return;
    if (!grabbing) {
      cam.tx += cam.vx;
      cam.ty += cam.vy;
      cam.vx *= 0.94;
      cam.vy *= 0.94;
    }
    const k = reduced ? 1 : 0.14;
    const nx = cam.x + (cam.tx - cam.x) * k;
    const ny = cam.y + (cam.ty - cam.y) * k;
    if (Math.abs(nx - cam.x) < 0.01 && Math.abs(ny - cam.y) < 0.01) return;
    cam.x = nx;
    cam.y = ny;
    place();
  })();

  let lastPt = null;
  stage.addEventListener("pointerdown", (e) => {
    grabbing = true;
    moved = false;
    downX = e.clientX;
    downY = e.clientY;
    lastPt = { x: e.clientX, y: e.clientY };
    cam.vx = cam.vy = 0;
    try { stage.setPointerCapture(e.pointerId); } catch (_) {}
    stage.classList.add("grabbing");
    if (!reduced) gsap.to(plane, { scale: 0.96, duration: 0.45, ease: "power3.out" });
  });
  stage.addEventListener("pointermove", (e) => {
    if (!grabbing) return;
    const dx = e.clientX - lastPt.x, dy = e.clientY - lastPt.y;
    lastPt = { x: e.clientX, y: e.clientY };
    cam.tx += dx;
    cam.ty += dy;
    cam.vx = dx;
    cam.vy = dy;
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 8) {
      moved = true;
      stage.classList.add("dragged"); // retires the DRAG TO EXPLORE hint
    }
  });
  const endDrag = () => {
    if (!grabbing) return;
    grabbing = false;
    stage.classList.remove("grabbing");
    if (reduced) cam.vx = cam.vy = 0;
    else gsap.to(plane, { scale: 1, duration: 0.6, ease: "power3.out" });
  };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);

  /* a real click (no drag) plays the track-change transition;
     the moved flag is consumed here so a stale drag never swallows
     a later keyboard activation */
  stage.addEventListener("click", (e) => {
    const wasDrag = moved;
    moved = false;
    const g = e.target.closest(".gcard");
    if (!g) return;
    if (wasDrag) { e.preventDefault(); return; }
    playTransition(P[+g.dataset.i]);
  }, true);

  /* grid <-> list toggle */
  const vg = $("#viewGrid"), vl = $("#viewList");
  function setView(v) {
    const grid = v === "grid";
    stage.hidden = !grid;
    workList.hidden = grid;
    vg.setAttribute("aria-pressed", grid);
    vl.setAttribute("aria-pressed", !grid);
    if (grid) buildGrid();
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  }
  vg.addEventListener("click", () => setView("grid"));
  vl.addEventListener("click", () => setView("list"));
  setView(finePointer ? "grid" : "list");

  let lastW = innerWidth;
  addEventListener("resize", () => {
    if (innerWidth === lastW) return; // ignore mobile url-bar height churn
    lastW = innerWidth;
    if (!stage.hidden) buildGrid();
  });

  /* ---------- gsap / lenis setup ---------- */
  gsap.registerPlugin(ScrollTrigger);
  let lenis = null;
  if (!reduced) {
    lenis = new Lenis({ duration: 1.15 });
    window.lenis = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.on("scroll", ({ scroll, limit }) => Player.onScroll(limit ? scroll / limit : 0));
  } else {
    addEventListener("scroll", () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      Player.onScroll(max ? scrollY / max : 0);
    }, { passive: true });
  }

  /* anchor links glide (nav + logo) */
  $$('a[href^="#"]').forEach((a) =>
    a.addEventListener("click", (e) => {
      const el = $(a.getAttribute("href"));
      if (!el) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(el, { offset: -56, duration: 1.2 });
      else el.scrollIntoView();
    })
  );

  /* ---------- track title per section ---------- */
  window.TRACKS.forEach((t) => {
    ScrollTrigger.create({
      trigger: "#" + t.id,
      start: "top 55%",
      end: "bottom 55%",
      onToggle: (s) => s.isActive && Player.setTrack(t.name),
    });
  });

  /* ---------- split text util ---------- */
  function split(el, mode) {
    const text = el.textContent;
    el.setAttribute("aria-label", text);
    el.textContent = "";
    const parts = [];
    text.split(" ").forEach((w, wi, arr) => {
      const wrap = document.createElement("span");
      wrap.className = "w";
      wrap.setAttribute("aria-hidden", "true");
      if (mode === "chars") {
        [...w].forEach((ch) => {
          const c = document.createElement("span");
          c.className = "ch";
          c.textContent = ch;
          wrap.appendChild(c);
          parts.push(c);
        });
      } else {
        wrap.textContent = w;
        parts.push(wrap);
      }
      el.appendChild(wrap);
      if (wi < arr.length - 1) el.appendChild(document.createTextNode(" "));
    });
    return parts;
  }

  /* ---------- loader + hero entrance ---------- */
  const loader = $("#loader");

  function heroIn(instant) {
    if (reduced || instant) return;
    const chars = $$(".hero-name .line").flatMap((l) => split(l, "chars"));
    gsap.timeline({ defaults: { ease: "power4.out" }, delay: 0.1 })
      /* letters rise out of the mask with a slight tilt that settles */
      .from(chars, {
        yPercent: 118, rotate: 7, transformOrigin: "0% 100%",
        duration: 1.05, stagger: 0.032,
      })
      .from(".hero-kicker", { y: 20, opacity: 0, duration: 0.7, ease: "power3.out" }, "-=0.65")
      .from([".hero-tag", ".hero-roles"], {
        y: 24, opacity: 0, duration: 0.7, ease: "power3.out", stagger: 0.12,
      }, "<0.15")
      .from("#nav > *", {
        y: -18, opacity: 0, duration: 0.6, ease: "power3.out", stagger: 0.08,
      }, "<")
      .from("#player", { yPercent: 100, duration: 0.8, ease: "power3.out" }, "<0.1")
      .from(".hero-cue", { opacity: 0, duration: 0.6, ease: "none" }, "-=0.35");
  }

  if (reduced) {
    loader.remove();
    heroIn(true);
  } else if (sessionStorage.getItem("rh-seen")) {
    loader.remove(); // repeat visit: skip the counter, keep the entrance
    heroIn(false);
  } else {
    sessionStorage.setItem("rh-seen", "1");
    const cnt = $(".l-count"), quip = $(".l-quip");
    let qi = 0;
    quip.textContent = window.QUIPS[0];
    const rot = setInterval(() => (quip.textContent = window.QUIPS[++qi % window.QUIPS.length]), 700);
    const obj = { n: 0 };
    gsap.to(obj, {
      n: 100, duration: 1.7, ease: "power2.inOut",
      onUpdate: () => (cnt.textContent = String(Math.round(obj.n)).padStart(2, "0")),
      onComplete: () => {
        clearInterval(rot);
        gsap.to(loader, { yPercent: -100, duration: 0.7, ease: "power3.inOut", onComplete: () => loader.remove() });
        heroIn(false);
      },
    });
  }

  /* ---------- scroll reveals ---------- */
  if (!reduced) {
    $$(".sec-head").forEach((h) => {
      gsap.from(h.children, {
        y: 28, opacity: 0, duration: 0.8, ease: "power3.out", stagger: 0.08,
        scrollTrigger: { trigger: h, start: "top 82%", once: true },
      });
    });
    gsap.from("#gstage", {
      opacity: 0, y: 44, duration: 0.9, ease: "power3.out",
      scrollTrigger: { trigger: "#work", start: "top 75%", once: true },
    });
    gsap.set("#lab .bside", { x: -24, opacity: 0 });
    ScrollTrigger.batch("#lab .bside", {
      start: "top 90%", once: true,
      onEnter: (b) => gsap.to(b, { x: 0, opacity: 1, duration: 0.7, ease: "power3.out", stagger: 0.07 }),
    });
    $$(".about-grid > *, .contact-sub, .cta-row").forEach((el) => {
      gsap.from(el, {
        y: 32, opacity: 0, duration: 0.8, ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 86%", once: true },
      });
    });
    const talk = $(".contact-title");
    if (talk) {
      const chars = split(talk, "chars");
      gsap.from(chars, {
        yPercent: 112, duration: 0.8, ease: "power4.out", stagger: 0.03,
        scrollTrigger: { trigger: talk, start: "top 85%", once: true },
      });
    }
  }

  /* ---------- "changing tracks" project transition ---------- */
  const overlay = $("#tplay"), tLabel = $("#tLabel"), tName = $("#tName"),
        tDur = $("#tDur"), tLine = $("#tLine");
  let transitioning = false;

  function playTransition(p) {
    if (transitioning) return;
    if (reduced) { // no theatre for reduced motion — just go
      if (p.url) window.open(p.url, "_blank", "noopener");
      return;
    }
    transitioning = true;
    tLabel.textContent = p.wip ? "STILL IN THE STUDIO…" : "NOW PLAYING…";
    tName.textContent = p.title;
    tDur.textContent = p.wip ? "UNRELEASED" : p.dur;
    overlay.classList.add("open");
    gsap.timeline({
      onComplete: () => {
        overlay.classList.remove("open");
        transitioning = false;
        if (p.url) window.open(p.url, "_blank", "noopener");
      },
    })
      .fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out" })
      .fromTo(tName, { y: 42, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, "-=0.1")
      .fromTo([tLabel, tDur], { opacity: 0 }, { opacity: 1, duration: 0.4 }, "<")
      .fromTo(tLine, { scaleX: 0 }, { scaleX: p.wip ? 0.38 : 1, duration: p.wip ? 0.5 : 0.85, ease: "power1.inOut" }, "<")
      .to(overlay, { opacity: 0, duration: 0.35, delay: 0.18 });
  }

  document.addEventListener("click", (e) => {
    const el = e.target.closest(".bside");
    if (!el) return;
    e.preventDefault();
    playTransition((el.dataset.src === "p" ? window.PROJECTS : window.BSIDES)[+el.dataset.i]);
  });

  /* ---------- magnetic buttons ---------- */
  if (finePointer && !reduced) {
    $$(".magnetic").forEach((btn) => {
      const mx = gsap.quickTo(btn, "x", { duration: 0.4, ease: "power3" });
      const my = gsap.quickTo(btn, "y", { duration: 0.4, ease: "power3" });
      btn.addEventListener("mousemove", (e) => {
        const r = btn.getBoundingClientRect();
        mx((e.clientX - r.left - r.width / 2) * 0.25);
        my((e.clientY - r.top - r.height / 2) * 0.25);
      });
      btn.addEventListener("mouseleave", () => { mx(0); my(0); });
    });
  }

  /* ---------- custom cursor: sage dot + lagging ring ---------- */
  if (finePointer && !reduced) {
    const dot = document.createElement("div");
    dot.id = "cDot";
    const ring = document.createElement("div");
    ring.id = "cRing";
    document.body.append(ring, dot);
    document.body.classList.add("custom-cursor");

    const rx = gsap.quickTo(ring, "x", { duration: 0.45, ease: "power3" });
    const ry = gsap.quickTo(ring, "y", { duration: 0.45, ease: "power3" });
    let seen = false;
    addEventListener("mousemove", (e) => {
      if (!seen) {
        seen = true;
        gsap.set([dot, ring], { x: e.clientX, y: e.clientY });
        document.body.classList.add("cursor-seen");
      }
      gsap.set(dot, { x: e.clientX, y: e.clientY });
      rx(e.clientX);
      ry(e.clientY);
    }, { passive: true });

    const HOVERABLE = "a, button, input, .card, .bside";
    document.addEventListener("mouseover", (e) => {
      if (e.target.closest(HOVERABLE)) document.body.classList.add("cursor-hover");
    });
    document.addEventListener("mouseout", (e) => {
      if (e.target.closest(HOVERABLE)) document.body.classList.remove("cursor-hover");
    });
    addEventListener("mousedown", () => document.body.classList.add("cursor-down"));
    addEventListener("mouseup", () => document.body.classList.remove("cursor-down"));
    document.documentElement.addEventListener("mouseleave", () =>
      gsap.to([dot, ring], { opacity: 0, duration: 0.25 }));
    document.documentElement.addEventListener("mouseenter", () =>
      gsap.to([dot, ring], { opacity: 1, duration: 0.25 }));
  }

  /* keep triggers honest once fonts settle */
  document.fonts.ready.then(() => ScrollTrigger.refresh());
})();
