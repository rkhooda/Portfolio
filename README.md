# rakshit hooda — portfolio (night sage mix)

A portfolio that plays like an album. Dark, minimal, music-first.
Plain HTML/CSS/JS + GSAP (ScrollTrigger) + Lenis — no framework, no build step,
no dependencies. The four serverless functions in `api/` are plain Node using
`fetch`, so there is still no `package.json`.

## Run

Open `index.html` directly, or (needed for the ambient audio, which is
fetched over HTTP):

```sh
python3 serve.py        # http://localhost:8000, caching off
vercel dev              # same, but /api/* actually runs
```

Use `serve.py` rather than `python3 -m http.server` while editing: the stdlib
server sends no `Cache-Control`, so browsers keep serving a stale `data.js`
and your changes appear not to land.

`serve.py` can't run the functions in `api/`, and that's fine for front-end
work — every live feature falls back to what's written in the HTML when its
endpoint 404s. Reach for `vercel dev` only when changing `api/`.

## Live data

Three parts of the page read from the network, all lazily (nothing is fetched
until the section scrolls into reach) and all edge-cached, so upstreams see a
handful of requests a day regardless of traffic:

| Endpoint | Feeds | Env |
|---|---|---|
| `api/github.js` | the contribution calendar and two of the four About stats | `GH_TOKEN` (classic PAT, `read:user` only), optional `GH_USER` |
| `api/nowplaying.js` | the NOW PLAYING card — what's on, or what was last | `LASTFM_KEY`, `LASTFM_USER` |
| `api/guestbook.js` | the signatures on the sleeve | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |

Set these in Vercel's project settings, and in `.env.local` for `vercel dev`
(gitignored). Missing env doesn't break the page — it falls back.

Now Playing goes through Last.fm rather than Spotify's own API: Spotify gates
the Web API behind a Premium subscription, while Last.fm scrobbles a free
Spotify account and answers both "playing now" and "last played" in a single
unauthenticated GET.

The other two About stats are counted off `data.js`, so they can't drift.

The guestbook is the one thing on this site a stranger can write to. It caps
lengths, flattens control characters, rate limits one signature per hashed IP
per hour, carries a honeypot field, checks `Origin`, and is rendered client-side
with `textContent` and never `innerHTML`. All of that is checked by:

```sh
node test/guestbook.js   # stubs Upstash — no account needed
node api/github.js       # the streak edge cases
```

Moderation is manual and deliberate: `LREM` the entry from the Upstash console.

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

Replace `assets/audio/night-sage.flac` (the `.wav` beside it is the fallback —
update `AUDIO_SRC` in `js/player.js` if the filenames change). The current file
is a generated seamless lo-fi pad loop, so there's nothing to license.

## Structure

```
index.html        all markup (sections = album tracks)
404.html          "this track doesn't exist. skipped."
css/style.css     the whole look — palette tokens at the top
js/data.js        content (edit this one most)
js/player.js      mini-player: scroll = progress, lazy ambient audio, analyser
js/main.js        loader, Lenis + GSAP, reveals, parallax, transitions
js/live.js        About: github stats, the calendar, the now-playing card
js/sleeve.js      outro panel: the waveform and the guestbook
js/hero-bg.js     the hero's canvas backdrop (reacts to Player.level())
js/desk-scene.js  the three.js desk diorama (module, hero only)
js/vendor/        gsap, ScrollTrigger, lenis, three (vendored, works offline)
api/              serverless functions — see Live data above
test/guestbook.js the guestbook's guards, against a stubbed Upstash
assets/audio/     the ambient loop
```

Fonts (Clash Display via Fontshare, JetBrains Mono via Google) load from CDN;
offline you get system fallbacks.

Accessibility: respects `prefers-reduced-motion` (no loader, no smooth scroll,
no parallax), keyboard-navigable (the seek bar is a real range input), sound
strictly opt-in.
