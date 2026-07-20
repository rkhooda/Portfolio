/* ------------------------------------------------------------------
   main.js — render, loader, smooth scroll, reveals, gallery motion,
   track-change transition, magnetic buttons, console easter egg.
   ------------------------------------------------------------------ */

(() => {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(pointer: fine)").matches;
  const desktop = () => innerWidth >= 768;
  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => [...(c || document).querySelectorAll(s)];

  /* ---------- console easter egg ---------- */
  const mono = "font-family:monospace;";
  console.log("%c◉ NOW PLAYING — rakshit hooda · portfolio (night sage mix)", mono + "color:#A8B58A;font-size:12px;padding:6px 0;");
  console.log("%c▂▄▆█▆▄▂  oh hey, a fellow inspector. respect.", mono + "color:#7E827A;");
  console.log("%cthe un-minified truth lives at https://github.com/rkhooda", mono + "color:#EAEAE2;");
  console.log('%c"it works on my machine" — me, lying', mono + "color:#7E827A;font-style:italic;");

  /* ---------- render: Side A cards ---------- */
  const catNo = (i) => "RH-" + String(i + 1).padStart(2, "0");

  function coverHTML(p, i) {
    if (p.img) return `<img class="shot" src="${p.img}" alt="" loading="lazy">`;
    return `<span class="ghost" aria-hidden="true">${p.title.trim()[0]}</span>
      <span class="vinyl" aria-hidden="true"><span class="v-label mono">${catNo(i)}</span></span>
      <span class="cov-cat mono" aria-hidden="true">${catNo(i)} · ${p.year}</span>
      ${p.wip ? '<span class="cov-wip mono">UNRELEASED</span>' : ""}`;
  }

  function cardHTML(p, i) {
    const tag = p.url ? `a href="${p.url}" target="_blank" rel="noopener"` : 'button type="button"';
    const end = p.url ? "a" : "button";
    return `<${tag} class="card${p.wip ? " is-wip" : ""}" data-i="${i}" aria-label="${p.title} — ${p.desc}">
      <span class="cover" style="--tint:${p.tint}">${coverHTML(p, i)}</span>
      <span class="c-row"><span class="c-title">${p.title}</span><span class="c-dur mono">${p.dur}</span></span>
      <span class="c-desc">${p.desc}</span>
      <span class="c-row sub mono"><span>${p.tags.join(" · ")}</span><span>${p.year}</span></span>
    </${end}>`;
  }

  /* two staggered columns on desktop; one column in true order on mobile
     (stacked columns would shuffle the RH-01, RH-02… catalog sequence) */
  const colA = $("#colA"), colB = $("#colB");
  const galleryMQ = matchMedia("(min-width: 768px)");
  function layoutCards() {
    const cards = $$(".card").sort((a, b) => a.dataset.i - b.dataset.i);
    if (cards.length) {
      cards.forEach((c) => c.remove());
      window.PROJECTS.forEach((p, i) => {
        (galleryMQ.matches && i % 2 ? colB : colA).appendChild(cards[i]);
      });
    } else {
      window.PROJECTS.forEach((p, i) => {
        (galleryMQ.matches && i % 2 ? colB : colA).insertAdjacentHTML("beforeend", cardHTML(p, i));
      });
    }
  }
  layoutCards();
  galleryMQ.addEventListener("change", () => {
    layoutCards();
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  });

  /* ---------- render: B-sides tracklist ---------- */
  $("#bsides").innerHTML = window.BSIDES.map((p, i) => {
    const tag = p.url ? `a href="${p.url}" target="_blank" rel="noopener"` : 'button type="button"';
    const end = p.url ? "a" : "button";
    return `<li><${tag} class="bside" data-i="${i}">
      <span class="b-idx mono">B${i + 1}</span>
      <span class="b-name">${p.title}${p.wip ? ' <em class="mono">UNRELEASED</em>' : ""}</span>
      <span class="b-desc">${p.desc}</span>
      <span class="b-tags mono">${p.tags.join(" · ")}</span>
      <span class="b-dur mono">${p.dur}</span>
      <span class="b-arrow" aria-hidden="true">↗</span>
    </${end}></li>`;
  }).join("");

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
    gsap.from(chars, { yPercent: 112, duration: 0.9, ease: "power4.out", stagger: 0.028, delay: 0.1 });
    gsap.from([".hero-kicker", ".hero-tag", ".hero-roles", ".hero-cue"], {
      y: 24, opacity: 0, duration: 0.8, ease: "power3.out", stagger: 0.09, delay: 0.5,
    });
  }

  if (reduced || sessionStorage.getItem("rh-seen")) {
    loader.remove();
    heroIn(true);
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
    gsap.set(".card", { y: 56, opacity: 0 });
    ScrollTrigger.batch(".card", {
      start: "top 88%", once: true,
      onEnter: (b) => gsap.to(b, { y: 0, opacity: 1, duration: 0.9, ease: "power3.out", stagger: 0.1 }),
    });
    gsap.set(".bside", { x: -24, opacity: 0 });
    ScrollTrigger.batch(".bside", {
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

  /* ---------- gallery parallax (desktop only) ---------- */
  if (!reduced && desktop()) {
    gsap.fromTo("#colA", { y: -30 }, {
      y: 60, ease: "none",
      scrollTrigger: { trigger: ".gallery", start: "top bottom", end: "bottom top", scrub: 1.2 },
    });
    gsap.fromTo("#colB", { y: 40 }, {
      y: -110, ease: "none",
      scrollTrigger: { trigger: ".gallery", start: "top bottom", end: "bottom top", scrub: 1.2 },
    });
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
    const el = e.target.closest(".card, .bside");
    if (!el) return;
    e.preventDefault();
    const list = el.classList.contains("card") ? window.PROJECTS : window.BSIDES;
    playTransition(list[+el.dataset.i]);
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
