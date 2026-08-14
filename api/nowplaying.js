/* ------------------------------------------------------------------
   api/nowplaying.js — what's actually on.

   Spotify answers 204 when nothing is playing, so "last played" is a
   second endpoint rather than a field on the first. Both shapes collapse
   into one response here, so the card only ever has to read `live`.
   ------------------------------------------------------------------ */

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API = "https://api.spotify.com/v1";

/* An access token lives an hour, so a warm invocation should not spend a
   round trip re-earning one. Module scope survives between warm calls and
   is simply missed on a cold start — which costs one extra request, not a
   wrong answer, so no store is worth introducing for it. */
let cached = { token: null, exp: 0 };

async function accessToken() {
  if (cached.token && Date.now() < cached.exp) return cached.token;

  const basic = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: process.env.SPOTIFY_REFRESH_TOKEN,
    }),
  });
  if (!r.ok) throw new Error(`token: ${r.status}`);

  const j = await r.json();
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in - 60) * 1000 };
  return cached.token;
}

const trackOf = (t) => ({
  artist: t.artists.map((a) => a.name).join(", "),
  track: t.name,
});

function send(res, body) {
  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
  res.json(body);
}

module.exports = async (req, res) => {
  if (!process.env.SPOTIFY_REFRESH_TOKEN) {
    return res.status(500).json({ error: "SPOTIFY_REFRESH_TOKEN is not set" });
  }

  try {
    const auth = { headers: { Authorization: `Bearer ${await accessToken()}` } };

    const now = await fetch(`${API}/me/player/currently-playing`, auth);
    if (now.status === 200) {
      const j = await now.json().catch(() => null);
      const t = j && j.is_playing && j.item;
      /* an ad or a podcast episode has no artists — that isn't something
         worth announcing, so it falls through to the last real track */
      if (t && t.artists && t.artists.length) {
        return send(res, { live: true, ...trackOf(t) });
      }
    }

    /* 204, paused, or mid-ad: all of them mean "here's what came last" */
    const recent = await fetch(`${API}/me/player/recently-played?limit=1`, auth);
    if (!recent.ok) throw new Error(`recently-played: ${recent.status}`);

    const first = (await recent.json()).items?.[0];
    if (!first) return send(res, { live: false });
    send(res, { live: false, playedAt: first.played_at, ...trackOf(first.track) });
  } catch (err) {
    res.status(502).json({ error: String(err.message || err) });
  }
};
