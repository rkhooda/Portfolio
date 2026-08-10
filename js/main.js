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

  /* Covers ship as WebP (~60% lighter) wherever the browser takes them and
     fall back to the original JPG/PNG where it doesn't. The decision is made
     once, here, rather than with a <picture>/<source> pair per card — the
     gallery alone renders 54 of them, and the markup stays as it was. */
  const WEBP = (() => {
    try {
      return document.createElement("canvas")
        .toDataURL("image/webp").indexOf("data:image/webp") === 0;
    } catch (_) {
      return false;
    }
  })();
  const cover = (src) => (WEBP ? src.replace(/\.(jpe?g|png)$/i, ".webp") : src);

  function coverHTML(p, i) {
    if (p.img) return `<img class="shot" src="${cover(p.img)}" alt="" loading="lazy" decoding="async" draggable="false">`;
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

  /* the plane is pressed into a dish, not blown into a bubble: the middle
     sits back and the four corners come forward, so cards stretch and grow
     as they travel out to the edges. r2 is capped or the far ring explodes.
     rimX/rimY are where full strength lands — the outermost of five columns
     and the top/bottom of three rows — so both axes bend the same amount. */
  const WARP = {
    depth: 210, tilt: 26, tiltRow: 32, stretch: 0.11, maxGrow: 0.26, hold: 0.75,
    rimX: 0.8, rimY: 2 / 3, maxBend: 1.5, maxR2: 2.4,
  };
  const SLIVER = 110; // strip of the fourth row the bottom fade dissolves
  /* mostly cubic, then rescaled so the rim is already full strength: the
     middle stays near flat and the bend piles up at the edge, where the
     cards both turn away and grow */
  const curve = (a) => a * (0.3 + 0.7 * a * a);
  const KX = curve(WARP.rimX), KY = curve(WARP.rimY);
  const bend = (t, K) => {
    const a = t < 0 ? -t : t;
    const s = Math.min(curve(a) / K, WARP.maxBend);
    return t < 0 ? -s : s;
  };
  /* the perspective origin (must track the CSS) and the dish's own centre,
     which sits above it because the sliver pushes the three rows up */
  let originX = 0, originY = 0, warpCy = 0, warpRy = 1;
  let persp = 1200; // read off the stage so JS and CSS can't drift apart

  /* the whole plane looks around with the cursor, like the desk diorama's
     camera — same viewport-normalised target, same eased follow */
  const look = { tx: 0, ty: 0, x: 0, y: 0 };
  const LOOK_SHIFT = 26, LOOK_TILT = 2.4;
  const canParallax = finePointer && !reduced;

  const stageH = () => stage.clientHeight || Math.min(innerHeight * 0.78, 720);

  function buildGrid() {
    /* five across, and three complete rows plus a sliver of the fourth — the
       sliver is what the bottom fade dissolves, so the third row stays whole
       instead of being chopped off mid-card */
    const w = stage.clientWidth || innerWidth;
    cellW = Math.round(w / (w < 1100 ? 4 : 5));
    cellH = Math.round((stageH() - SLIVER) / 3);
    /* pool = the 3x3 project pattern repeated enough to cover the stage;
       cells wrap around the pool span, so content never needs to change */
    const cols = Math.ceil((innerWidth / cellW + 2) / 3) * 3;
    const rows = Math.ceil((stageH() / cellH + 2) / 3) * 3;
    spanX = cols * cellW;
    spanY = rows * cellH;
    originX = (stage.clientWidth || innerWidth) / 2;
    originY = stageH() / 2;
    warpRy = (cellH * 3) / 2; // the three full rows, not the whole stage
    warpCy = warpRy;
    persp = parseFloat(getComputedStyle(stage).perspective) || 1200;
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
      if (reduced) { c.el.style.transform = `translate3d(${x}px, ${y}px, 0)`; continue; }
      /* -1…1 out to the rim, measured from each card's own centre */
      const mx = x + cellW / 2, my = y + cellH / 2;
      const u = bend((mx - originX) / originX, KX);
      const v = bend((my - warpCy) / warpRy, KY);
      const r2 = Math.min(u * u + v * v, WARP.maxR2);
      const z = WARP.depth * r2;
      /* perspective magnifies anything brought forward. Left alone it fans
         the rim cards apart; fully undone it holds the pitch fixed while the
         cards still grow, which closes the gap instead. `hold` splits the
         difference: pitch and card size expand together, so the gap between
         neighbours stays even from the middle out to the rim. */
      const k = persp / (persp - z);
      const kh = Math.pow(k, WARP.hold);
      const grow = 1 + Math.min(WARP.stretch * r2, WARP.maxGrow);
      c.el.style.transform =
        `translate3d(${(originX + (mx - originX) / kh - cellW / 2).toFixed(1)}px, ` +
        `${(originY + (my - originY) / kh - cellH / 2).toFixed(1)}px, ${z.toFixed(1)}px)` +
        ` rotateY(${(-u * WARP.tilt).toFixed(2)}deg) rotateX(${(v * WARP.tiltRow).toFixed(2)}deg)` +
        ` scale(${(grow / k).toFixed(4)})`;
    }
  }

  /* The loop runs only while there is motion left to resolve and the section
     is near the viewport; wake() starts it again. A permanent rAF here spent
     the hero's frame budget on a gallery nobody was looking at. Every easing
     curve below is untouched — only the empty frames are gone. */
  let galleryRaf = 0, onStage = false;

  /* Deliberately not gated on onStage: an interaction must always be able to
     start the loop, even if the observer below never reports. The idling is
     what buys the frames back — the observer only decides when to promote
     layers and when to pick the loop back up after a scroll. */
  function wake() {
    if (galleryRaf || stage.hidden || !cells.length) return;
    galleryRaf = requestAnimationFrame(galleryTick);
  }

  function galleryTick() {
    galleryRaf = 0;
    if (stage.hidden || !cells.length) return;
    let busy = grabbing;
    if (!grabbing) {
      cam.tx += cam.vx;
      cam.ty += cam.vy;
      cam.vx *= 0.94;
      cam.vy *= 0.94;
      if (Math.abs(cam.vx) > 0.01 || Math.abs(cam.vy) > 0.01) busy = true;
    }
    if (canParallax && (Math.abs(look.tx - look.x) > 0.001 || Math.abs(look.ty - look.y) > 0.001)) {
      look.x += (look.tx - look.x) * 0.07;
      look.y += (look.ty - look.y) * 0.07;
      gsap.set(plane, {
        x: look.x * LOOK_SHIFT, y: look.y * LOOK_SHIFT,
        rotationY: look.x * LOOK_TILT, rotationX: -look.y * LOOK_TILT,
      });
      busy = true;
    }
    const k = reduced ? 1 : 0.14;
    const nx = cam.x + (cam.tx - cam.x) * k;
    const ny = cam.y + (cam.ty - cam.y) * k;
    if (Math.abs(nx - cam.x) >= 0.01 || Math.abs(ny - cam.y) >= 0.01) {
      cam.x = nx;
      cam.y = ny;
      place();
      busy = true;
    }
    if (busy) galleryRaf = requestAnimationFrame(galleryTick);
  }

  /* Releases the cells' 54 compositor layers once the gallery is nowhere
     near the screen — reading the outro shouldn't cost gallery GPU memory.
     Note the section sits directly under the hero, so at the top of the page
     it is already within the margin and already promoted: this buys memory
     further down, not hero frame time. The margin is deliberately generous
     so promotion always lands before the first pixel does, never during. */
  new IntersectionObserver((es) => {
    onStage = es[0].isIntersecting;
    stage.classList.toggle("live", onStage);
    if (onStage) wake();
  }, { rootMargin: "50% 0px" }).observe($("#work"));

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
    wake();
    if (!reduced) gsap.to(plane, { scale: 0.96, duration: 0.45, ease: "power3.out" });
  });
  stage.addEventListener("pointermove", (e) => {
    if (!grabbing) {
      if (canParallax) {
        look.tx = (e.clientX / innerWidth) * 2 - 1;
        look.ty = (e.clientY / innerHeight) * 2 - 1;
        wake();
      }
      return;
    }
    wake();
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
    wake(); // the throw still has to spend its inertia
  };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);
  stage.addEventListener("pointerleave", () => {
    look.tx = look.ty = 0; // the plane settles back to square
    wake();
  });

  /* a real click (no drag) plays the track-change transition;
     the moved flag is consumed here so a stale drag never swallows
     a later keyboard activation */
  stage.addEventListener("click", (e) => {
    const wasDrag = moved;
    moved = false;
    /* setPointerCapture retargets the click to the stage itself, so the card
       has to be re-found under the pointer instead of read off e.target */
    const g = e.target.closest(".gcard") ||
      document.elementFromPoint(e.clientX, e.clientY)?.closest(".gcard");
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
    if (grid) { buildGrid(); wake(); }
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  }
  vg.addEventListener("click", () => setView("grid"));
  vl.addEventListener("click", () => setView("list"));
  setView(finePointer ? "grid" : "list");

  let lastW = innerWidth;
  addEventListener("resize", () => {
    if (innerWidth === lastW) return; // ignore mobile url-bar height churn
    lastW = innerWidth;
    if (!stage.hidden) { buildGrid(); wake(); }
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

  /* ---------- nav: the sliding indicator ----------
     One highlight for the whole menu. It follows the cursor and settles
     back on the current section when the cursor leaves. Position is read
     from live geometry rather than stored, so it stays honest while the
     bar is mid-contraction and the links are still changing width. */
  const navLinks = $$(".nav-links a");
  const linkWrap = $(".nav-links");
  const pill = $(".nav-pill");
  const pillX = gsap.quickTo(pill, "x", { duration: 0.55, ease: "power3.out" });
  const pillW = gsap.quickTo(pill, "width", { duration: 0.55, ease: "power3.out" });
  let activeLink = null;  // the section being read
  let pillOn = null;      // where the indicator currently sits

  function movePill(el, snap) {
    pillOn = el;
    /* display:none under 768px — nothing to measure, nothing to show */
    if (!el || !linkWrap.offsetParent) {
      gsap.to(pill, { opacity: 0, duration: 0.2, overwrite: true });
      return;
    }
    const wrap = linkWrap.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    pill.style.top = r.top - wrap.top + "px";
    pill.style.height = r.height + "px";
    if (snap || reduced) {
      gsap.set(pill, { x: r.left - wrap.left, width: r.width, opacity: 1 });
    } else {
      gsap.to(pill, { opacity: 1, duration: 0.22, overwrite: "auto" });
      pillX(r.left - wrap.left);
      pillW(r.width);
    }
  }

  /* the bar's own contraction retimes every link under it — glue the
     indicator to the layout for the length of that transition */
  let gluedUntil = 0, gluing = false;
  function glue(ms) {
    gluedUntil = performance.now() + ms;
    if (gluing) return;
    gluing = true;
    (function step() {
      movePill(pillOn, true);
      if (performance.now() < gluedUntil) requestAnimationFrame(step);
      else gluing = false;
    })();
  }

  navLinks.forEach((a) => {
    a.addEventListener("mouseenter", () => movePill(a));
    a.addEventListener("focus", () => movePill(a));
  });
  linkWrap.addEventListener("mouseleave", () => movePill(activeLink));
  linkWrap.addEventListener("focusout", (e) => {
    if (!linkWrap.contains(e.relatedTarget)) movePill(activeLink);
  });
  addEventListener("resize", () => movePill(pillOn, true));
  /* webfonts land after first paint and every label changes width */
  if (document.fonts) document.fonts.ready.then(() => movePill(pillOn, true));

  /* ---------- nav: full-width bar → pill once you leave the top ----------
     Hysteresis keeps the bar from flickering when a scroll settles right
     on the boundary. */
  const navEl = $("#nav");
  let navShrunk = false;
  function syncNav(y) {
    /* a wider deadband than the bar's own travel: a nudge of a scroll
       shouldn't commit the reader to a second-long contraction */
    const shrink = navShrunk ? y > 56 : y > 120;
    if (shrink === navShrunk) return;
    navShrunk = shrink;
    navEl.classList.toggle("shrunk", shrink);
    glue(1300); // a little past the 1.15s shell transition
  }
  if (lenis) lenis.on("scroll", ({ scroll }) => syncNav(scroll));
  addEventListener("scroll", () => syncNav(scrollY), { passive: true });
  syncNav(scrollY); // restored scroll positions land in the right state

  /* anchor links glide (nav + logo) — flush to the section's top edge. Each
     section already reserves the bar's height inside its own padding, so no
     offset is needed and none is wanted: any would open a dead band above. */
  $$('a[href^="#"]').forEach((a) =>
    a.addEventListener("click", (e) => {
      const el = $(a.getAttribute("href"));
      if (!el) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.2 });
      else el.scrollIntoView({ block: "start" });
    })
  );

  /* ---------- track title + current section per section ---------- */
  function markNav(id) {
    activeLink = null;
    navLinks.forEach((a) => {
      const on = a.getAttribute("href") === "#" + id;
      a.classList.toggle("is-active", on);
      if (on) {
        a.setAttribute("aria-current", "true");
        activeLink = a;
      } else a.removeAttribute("aria-current");
    });
    /* don't yank it out from under a cursor — or a keyboard focus — that's
       parked on another link */
    const held = linkWrap.matches(":hover") || linkWrap.contains(document.activeElement);
    if (!held) movePill(activeLink);
  }
  window.TRACKS.forEach((t) => {
    ScrollTrigger.create({
      trigger: "#" + t.id,
      start: "top 55%",
      end: "bottom 55%",
      onToggle: (s) => {
        if (!s.isActive) return;
        Player.setTrack(t.name);
        markNav(t.id);
      },
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
    /* the desk diorama keys its entrance off this; the flag covers the
       case where the module loads after the event already fired */
    window.__rhHeroIn = true;
    document.dispatchEvent(new CustomEvent("rh:hero-in"));
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
      .from(".nav-shell", { y: -22, opacity: 0, duration: 0.7, ease: "power3.out" }, "<")
      .from(".nav-shell > *", {
        y: -12, opacity: 0, duration: 0.6, ease: "power3.out", stagger: 0.08,
      }, "<0.08")
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
    const hello = $(".l-hello"), quip = $(".l-quip");
    let qi = 0;
    quip.textContent = window.QUIPS[0];
    const rot = setInterval(() => (quip.textContent = window.QUIPS[++qi % window.QUIPS.length]), 360);
    /* flash "hello" through each language once, then slide the loader up */
    let hi = 0;
    const flash = setInterval(() => {
      hi++;
      if (hi >= window.HELLOS.length) {
        clearInterval(flash);
        clearInterval(rot);
        gsap.to(loader, { yPercent: -100, duration: 0.55, ease: "power3.inOut", onComplete: () => loader.remove() });
        heroIn(false);
        return;
      }
      hello.textContent = window.HELLOS[hi];
    }, 95);
  }

  /* ---------- scroll reveals ---------- */
  if (!reduced) {
    $$(".sec-head").forEach((h) => {
      gsap.from(h.children, {
        y: 28, opacity: 0, duration: 0.8, ease: "power3.out", stagger: 0.08,
        scrollTrigger: { trigger: h, start: "top 82%", once: true },
      });
    });
    /* the gallery does not fade or slide in — all three rows stay up */
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
    /* open synchronously — popup blockers kill window.open once the click's
       user activation expires, so it can't wait for the animation */
    if (p.url) window.open(p.url, "_blank", "noopener");
    if (reduced) return; // no theatre for reduced motion
    transitioning = true;
    tLabel.textContent = p.wip ? "STILL IN THE STUDIO…" : "NOW PLAYING…";
    tName.textContent = p.title;
    tDur.textContent = p.wip ? "UNRELEASED" : p.dur;
    overlay.classList.add("open");
    gsap.timeline({
      onComplete: () => {
        overlay.classList.remove("open");
        transitioning = false;
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

  /* ---------- Lab: a peek card that rides the cursor ---------- */
  if (finePointer && !reduced) {
    const lab = $("#lab");
    const peek = document.createElement("div");
    peek.id = "labPeek";
    peek.setAttribute("aria-hidden", "true"); // pure decoration — the row itself is the label
    peek.innerHTML = '<div class="peek-in"></div>';
    document.body.appendChild(peek);
    const inner = peek.firstElementChild;

    const GAP = 28; // clears the cursor ring at its widest
    const px = gsap.quickTo(peek, "x", { duration: 0.34, ease: "power3" });
    const py = gsap.quickTo(peek, "y", { duration: 0.34, ease: "power3" });
    let shown = false, current = -1, mx = NaN, my = NaN, pw = 0, ph = 0;

    /* the cursor's position must be known before it ever enters the lab,
       or a scroll that slides a row under a still cursor can't summon the
       card — NaN means the pointer hasn't been seen yet */
    addEventListener("pointermove", (e) => {
      if (e.pointerType && e.pointerType !== "mouse") return;
      mx = e.clientX;
      my = e.clientY;
    }, { passive: true });

    const peekHTML = (p, i) => `
      <span class="peek-art">
        ${p.img
          ? `<img class="shot" src="${cover(p.img)}" alt="" loading="lazy" decoding="async" draggable="false">`
          : `<span class="ghost">${p.title.trim()[0]}</span>
             <span class="vinyl"><span class="v-label mono">B${i + 1}</span></span>`}
        <span class="peek-badge mono">${p.wip ? "UNRELEASED" : "B" + String(i + 1).padStart(2, "0")}</span>
      </span>
      <span class="peek-body">
        <span class="peek-meta mono"><span>${p.tags.join(" · ")}</span><span>${p.year} · ${p.dur}</span></span>
        <strong class="peek-title">${p.title}</strong>
        <span class="peek-desc">${p.blurb || p.desc}</span>
        <span class="peek-foot mono">
          <span class="peek-stack">${(p.stack || []).map((s) => `<i>${s}</i>`).join("")}</span>
          <span class="peek-cta">${p.url ? "OPEN ↗" : "IN THE LAB"}</span>
        </span>
      </span>`;

    /* the card sits below-right of the cursor, flipping at the viewport edge */
    function follow(snap) {
      let x = mx + GAP, y = my + GAP;
      if (x + pw > innerWidth - 14) x = Math.max(14, mx - pw - GAP);
      if (y + ph > innerHeight - 14) y = Math.max(14, my - ph - GAP);
      if (snap) gsap.set(peek, { x, y });
      else { px(x); py(y); }
    }

    function show(row) {
      const i = +row.dataset.i;
      if (shown && i === current) return follow();
      const p = window.BSIDES[i];
      current = i;
      inner.style.setProperty("--tint", p.tint || "var(--accent)");
      inner.innerHTML = peekHTML(p, i);
      pw = peek.offsetWidth;
      ph = peek.offsetHeight; // one read per row change, never per move
      if (shown) {
        follow();
        gsap.fromTo(inner, { y: 10, opacity: 0.3 },
          { y: 0, opacity: 1, duration: 0.32, ease: "power3.out" });
      } else {
        shown = true;
        follow(true);
        gsap.to(peek, { opacity: 1, duration: 0.22, ease: "power2.out" });
        gsap.fromTo(inner, { scale: 0.9, y: 14, opacity: 0 },
          { scale: 1, y: 0, opacity: 1, duration: 0.45, ease: "power3.out" });
      }
    }

    function hide() {
      if (!shown) return;
      shown = false;
      current = -1;
      gsap.to(peek, { opacity: 0, duration: 0.2, ease: "power2.in" });
      gsap.to(inner, { scale: 0.94, duration: 0.2, ease: "power2.in" });
    }

    lab.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      mx = e.clientX;
      my = e.clientY;
      const row = e.target.closest(".bside");
      if (row) show(row);
      else hide();
    }, { passive: true });
    lab.addEventListener("pointerleave", hide);

    /* scrolling slides a row under a still cursor and fires no pointer event —
       so re-read what's under it whenever the page moves. This must also run
       when nothing is shown yet: that's how the card first appears when the
       user scrolls into the lab without moving the mouse.

       elementFromPoint forces a hit-test against fresh layout, so it is held
       to one call per frame and only while the lab is actually in reach.
       Everywhere else — the hero above all — the scroll handler now costs a
       boolean. */
    /* starts true so that if the observer never reports, the behaviour is
       simply what it was before — the gate can only ever remove work */
    let labNear = true, queued = false;
    new IntersectionObserver((es) => {
      labNear = es[0].isIntersecting;
      if (!labNear) hide(); // scrolled clean past it with the card still up
    }, { rootMargin: "20% 0px" }).observe(lab);

    addEventListener("scroll", () => {
      if (!labNear || queued || Number.isNaN(mx)) return; // NaN = pointer never seen
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        const row = document.elementFromPoint(mx, my)?.closest(".bside");
        if (row && lab.contains(row)) show(row);
        else hide();
      });
    }, { passive: true });
  }

  /* keep triggers honest once fonts settle */
  document.fonts.ready.then(() => ScrollTrigger.refresh());
})();
