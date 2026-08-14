/* ------------------------------------------------------------------
   player.js — the signature: a mini-player whose progress bar IS the
   scroll position. Ambient audio is a real looping file, off by
   default, lazily fetched the first time sound is turned on.
   Exposes window.Player = { onScroll, setTrack }.
   ------------------------------------------------------------------ */

window.Player = (() => {
  const $ = (s) => document.querySelector(s);
  const seek = $("#pSeek");
  const timeEl = $("#pTime");
  const totalEl = $("#pTotal");
  const trackEl = $("#pTrack");
  const playBtn = $("#playBtn");
  const navToggle = $("#soundToggle");
  const eqEl = $("#eq");
  const eqBars = [...eqEl.querySelectorAll("i")];

  const TOTAL = window.SITE.albumLength;
  /* FLAC first, wav second. The FLAC is lossless — it decodes to exactly the
     same samples as the wav, so the loop stays seamless — at a little over
     half the bytes. A lossy format would have been smaller still, but the
     encoder's priming samples would put an audible gap at the loop point. */
  const AUDIO_SRC = ["assets/audio/night-sage.flac", "assets/audio/night-sage.wav"];
  const fmt = (s) => {
    s = Math.round(s);
    return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  };
  totalEl.textContent = fmt(TOTAL);

  /* ---------- scroll → progress bar + timestamp ---------- */
  const playerEl = document.getElementById("player");
  let dragging = false;
  let lastSec = -1;
  let lastP = null;
  let scrollTimer = 0;

  function onScroll(p) {
    p = Math.min(1, Math.max(0, p || 0));
    if (!dragging) seek.value = Math.round(p * 1000);
    seek.style.setProperty("--p", (p * 100).toFixed(2) + "%");
    const sec = Math.round(p * TOTAL);
    if (sec !== lastSec) {
      lastSec = sec;
      timeEl.textContent = fmt(sec);
    }
    /* scrolling = the album is "playing": pause glyph + dancing bars,
       settling gently ~220ms after the scroll stops */
    if (lastP !== null && p !== lastP) {
      playerEl.classList.add("scrolling");
      eqEl.classList.remove("settling");
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(stopDance, 220);
    }
    lastP = p;
  }

  /* freeze each bar at its mid-dance pose, then release it under a slow
     transition so the bars sink to idle instead of snapping */
  function stopDance() {
    if (on) { // analyser owns the bars — just drop the scroll state
      playerEl.classList.remove("scrolling");
      return;
    }
    eqBars.forEach((b) => (b.style.transform = getComputedStyle(b).transform));
    playerEl.classList.remove("scrolling");
    eqEl.classList.add("settling");
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        eqBars.forEach((b) => (b.style.transform = ""));
        setTimeout(() => eqEl.classList.remove("settling"), 700);
      })
    );
  }

  /* Dragging the bar seeks the page — the album scrubs the scroll */
  function seekTo(ratio) {
    const max = document.documentElement.scrollHeight - innerHeight;
    const target = ratio * max;
    if (window.lenis) window.lenis.scrollTo(target, { duration: 0.9 });
    else window.scrollTo({ top: target });
  }
  seek.addEventListener("pointerdown", () => (dragging = true));
  addEventListener("pointerup", () => (dragging = false));
  seek.addEventListener("input", () => seekTo(seek.value / 1000));

  /* ---------- track title swaps per section ---------- */
  let current = "";
  function setTrack(name) {
    if (name === current) return;
    current = name;
    trackEl.classList.remove("swap");
    void trackEl.offsetWidth; // restart the CSS animation
    trackEl.textContent = name;
    trackEl.classList.add("swap");
  }

  /* ---------- ambient audio (lazy, gapless WebAudio loop) ---------- */
  let ctx = null, gain = null, analyser = null, freq = null;
  let el = null; // <audio> fallback when fetch/decode can't run (e.g. file://)
  let on = false, loading = false, raf = 0;
  const VOL = 0.9;

  async function ensureAudio() {
    if (ctx || el) return true;
    loading = true;
    ui("…");
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      let buf = null, lastErr = null;
      for (const url of AUDIO_SRC) {
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(res.status);
          buf = await ctx.decodeAudioData(await res.arrayBuffer());
          break;
        } catch (err) {
          lastErr = err; // couldn't fetch or couldn't decode — try the next one
        }
      }
      if (!buf) throw lastErr || new Error("no decodable audio source");
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      gain = ctx.createGain();
      gain.gain.value = 0;
      analyser = ctx.createAnalyser();
      /* 32 bins was plenty for five dancing bars, but far too coarse to
         draw a waveform with. Every index below is scaled by the same 16x
         so the bars and level() keep reading the frequencies they always
         did — the resolution changed, not the sound. */
      analyser.fftSize = 1024;
      freq = new Uint8Array(analyser.frequencyBinCount);
      src.connect(gain).connect(analyser).connect(ctx.destination);
      src.start(0);
      return true;
    } catch (err) {
      console.warn("web audio unavailable, using <audio> fallback:", err);
      try { ctx && ctx.close(); } catch (_) {}
      ctx = null;
      analyser = null;
      el = new Audio();
      el.src = el.canPlayType("audio/flac") ? AUDIO_SRC[0] : AUDIO_SRC[1];
      el.loop = true;
      el.volume = VOL;
      return true;
    } finally {
      loading = false;
    }
  }

  async function toggle() {
    if (loading) return;
    if (!on) {
      const ok = await ensureAudio();
      if (!ok) { ui("OFF"); return; }
      if (ctx) {
        await ctx.resume();
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setTargetAtTime(VOL, ctx.currentTime, 0.4);
      } else {
        try {
          await el.play();
        } catch (err) {
          console.warn("ambient audio unavailable:", err);
          el = null;
          ui("OFF");
          return;
        }
      }
      on = true;
      ui("ON");
      eqLive();
    } else {
      if (ctx) {
        gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.2);
        setTimeout(() => { if (!on && ctx) ctx.suspend(); }, 800);
      } else if (el) {
        el.pause();
      }
      on = false;
      ui("OFF");
    }
  }

  function ui(state) {
    navToggle.textContent = `[SOUND: ${state}]`;
    const playing = state === "ON";
    navToggle.classList.toggle("on", playing);
    playBtn.setAttribute("aria-pressed", playing);
    playBtn.classList.toggle("playing", playing);
    document.body.classList.toggle("sound-on", playing);
  }

  /* equalizer bars react to the actual signal while sound is on;
     without an analyser (fallback <audio>) CSS dances them instead */
  function eqLive() {
    eqEl.classList.toggle("fake", !analyser);
    if (!analyser) return;
    cancelAnimationFrame(raf);
    const step = () => {
      if (!on) {
        eqBars.forEach((b) => (b.style.transform = ""));
        return;
      }
      analyser.getByteFrequencyData(freq);
      eqBars.forEach((b, i) => {
        const v = freq[32 + i * 48] / 255; // was 2 + i*3 at fftSize 64
        b.style.transform = `scaleY(${(0.18 + v * 0.82).toFixed(3)})`;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  /* current ambient level (0..1) — whatever wants to move with the
     music can ask for it; silent or fallback audio simply reads 0 */
  function level() {
    if (!on || !analyser) return 0;
    analyser.getByteFrequencyData(freq);
    let s = 0;
    for (let i = 1; i < 9; i++) s += freq[i * 16]; // was freq[i] at fftSize 64
    return Math.min(1, (s / (8 * 255)) * 1.7);
  }

  /* The raw waveform, for anything that wants to draw the signal itself.
     Hands back the shared buffer — read it now, don't hold on to it — and
     null whenever there's nothing to read: sound off, or the <audio>
     fallback, which has no analyser at all. */
  let timeBuf = null;
  function wave() {
    if (!on || !analyser) return null;
    if (!timeBuf) timeBuf = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(timeBuf);
    return timeBuf;
  }

  navToggle.addEventListener("click", toggle);
  playBtn.addEventListener("click", toggle);

  setTrack(window.TRACKS[0].name);
  onScroll(0);

  return { onScroll, setTrack, level, wave };
})();
