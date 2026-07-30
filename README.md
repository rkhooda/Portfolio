# rakshit hooda — portfolio (night sage mix)

A portfolio that plays like an album. Dark, minimal, music-first.
Plain HTML/CSS/JS + GSAP (ScrollTrigger) + Lenis — no framework, no build step.

## Run

Open `index.html` directly, or (needed for the ambient audio, which is
fetched over HTTP):

```sh
python3 serve.py        # http://localhost:8000, caching off
```

Use `serve.py` rather than `python3 -m http.server` while editing: the stdlib
server sends no `Cache-Control`, so browsers keep serving a stale `data.js`
and your changes appear not to land.

Note the loader only plays **once per tab session** (`sessionStorage`), so a
reload skips it — open a new tab to see the greetings again.

## Edit content

Everything editable lives in **`js/data.js`**:

- `PROJECTS` — Side A gallery. `wip: true` renders an UNRELEASED badge and
  skips the link. **Check the GitHub `url`s — they're best guesses from repo
  names.**
- `BSIDES` — the Lab tracklist. `blurb`, `stack` and `tint` only feed the
  hover card that follows the cursor — the current ones are placeholders.
- `TRACKS` — mini-player titles per section.
- `QUIPS` — loader one-liners.

## Swap in real project screenshots

Add `img: "assets/img/whatever.png"` to a project in `data.js`. The generated
album-art cover is replaced by the image automatically.

## Swap the ambient track

Replace `assets/audio/night-sage.wav` (any WAV/MP3/M4A works — update
`AUDIO_URL` in `js/player.js` if the filename changes). The current file is a
generated seamless 24s lo-fi pad loop, so there's nothing to license.

## Structure

```
index.html      all markup (sections = album tracks)
404.html        "this track doesn't exist. skipped."
css/style.css   the whole look — palette tokens at the top
js/data.js      content (edit this one most)
js/player.js    mini-player: scroll = progress, lazy ambient audio, EQ
js/main.js      loader, Lenis + GSAP, reveals, parallax, transitions
js/vendor/      gsap, ScrollTrigger, lenis (vendored, works offline)
assets/audio/   the ambient loop
```

Fonts (Clash Display via Fontshare, JetBrains Mono via Google) load from CDN;
offline you get system fallbacks.

Accessibility: respects `prefers-reduced-motion` (no loader, no smooth scroll,
no parallax), keyboard-navigable (the seek bar is a real range input), sound
strictly opt-in.
