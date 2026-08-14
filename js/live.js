/* ------------------------------------------------------------------
   live.js — the parts of this page that shouldn't be typed by hand.

   Three sources: the shipped/studio counts fall straight out of data.js,
   the contribution calendar comes from /api/github, and the Now Playing
   card comes from /api/nowplaying.

   All of it is progressive enhancement. If an endpoint isn't there —
   serve.py, a dead upstream, a missing token — whatever shipped in the
   HTML is what stays on screen, and nothing throws.
   ------------------------------------------------------------------ */

(() => {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s) => document.querySelector(s);

  /* 12 and 03 read as track numbers; 1,284 reads as a number */
  const fmt = (n) => (n < 100 ? String(n).padStart(2, "0") : n.toLocaleString());

  function setStat(key, n) {
    const el = document.querySelector(`[data-stat="${key}"]`);
    if (!el) return;
    if (reduced || !window.gsap) {
      el.textContent = fmt(n);
      return;
    }
    /* the counter rolls up as the strip arrives — same easing family as
       every other entrance on the page */
    gsap.to({ v: 0 }, {
      v: n, duration: 1.1, ease: "power2.out",
      onUpdate() { el.textContent = fmt(Math.round(this.targets()[0].v)); },
    });
  }

  /* ---------- the contribution calendar ----------
     GitHub's weeks always start on Sunday and the first one is partial,
     so the weekday of the first day is the offset every square is laid
     out from. The svg is sized in its own units and scaled by CSS, which
     is what keeps it from ever overflowing a column. */
  const CELL = 12, GAP = 2, PITCH = CELL + GAP;
  const FILL = ["rgba(234,234,226,0.06)", 0.28, 0.48, 0.72, 1];

  function drawCalendar({ from, days }) {
    const fig = $("#cal");
    if (!fig || !days || !days.length) return;

    const off = new Date(from + "T00:00:00Z").getUTCDay();
    const cols = Math.ceil((days.length + off) / 7);
    const max = Math.max(1, ...days);

    const rects = days.map((c, i) => {
      const n = i + off;
      const x = ((n / 7) | 0) * PITCH;
      const y = (n % 7) * PITCH;
      const lvl = c === 0 ? 0 : Math.min(4, Math.ceil((c / max) * 4));
      const fill = lvl === 0 ? FILL[0] : `rgba(168,181,138,${FILL[lvl]})`;
      return `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${fill}"/>`;
    });

    fig.querySelector("svg").setAttribute(
      "viewBox", `0 0 ${cols * PITCH - GAP} ${7 * PITCH - GAP}`
    );
    fig.querySelector("svg").innerHTML = rects.join("");
    fig.hidden = false;
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  }

  /* ---------- the Now Playing card ----------
     The relative time is worked out here rather than server-side: the
     response is edge-cached for half a minute, so a "3 minutes ago" baked
     into it would arrive already wrong. */
  const ago = (iso) => {
    const s = (Date.now() - new Date(iso)) / 1000;
    if (!(s >= 0)) return "";
    /* narrow, because this has to sit in a 10px header next to the label:
       "3 min. ago", not "3 minutes ago" */
    const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "narrow" });
    for (const [unit, n] of [["day", 86400], ["hour", 3600], ["minute", 60]]) {
      if (s >= n) return rtf.format(-Math.floor(s / n), unit);
    }
    return "just now";
  };

  function setNowPlaying(d) {
    if (!d || !d.track) return;
    const set = (k, v) => {
      const el = document.querySelector(`[data-np="${k}"]`);
      if (el) el.textContent = v; /* someone else's track title — never innerHTML */
    };
    set("artist", d.artist);
    set("track", d.track);
    set("label", d.live ? "NOW PLAYING" : `LAST PLAYED${d.playedAt ? " · " + ago(d.playedAt) : ""}`);
    /* the card's own bars dance whenever the music is live, whether or not
       the visitor has turned the site's ambient loop on */
    $("#npCard").classList.toggle("live", !!d.live);
  }

  /* ---------- kick everything off when About first comes into reach ----------
     A visitor who never scrolls that far costs no request at all. Same
     observer discipline the gallery and the lab peek card already use. */
  const about = $("#about");
  if (!about) return;

  new IntersectionObserver((entries, obs) => {
    if (!entries[0].isIntersecting) return;
    obs.disconnect();

    const all = [...(window.PROJECTS || []), ...(window.BSIDES || [])];
    setStat("shipped", all.filter((p) => !p.wip).length);
    setStat("studio", all.filter((p) => p.wip).length);

    /* both endpoints fail silently: the markup they'd have replaced is
       already on screen and is the fallback */
    const get = (url) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));

    get("/api/github")
      .then((d) => {
        setStat("contrib", d.total);
        setStat("streak", d.streak);
        drawCalendar(d);
      })
      .catch(() => {});

    get("/api/nowplaying").then(setNowPlaying).catch(() => {});
  }, { rootMargin: "20% 0px" }).observe(about);
})();
