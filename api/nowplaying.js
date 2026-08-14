/* ------------------------------------------------------------------
   api/nowplaying.js — what's actually on.

   Last.fm rather than Spotify: one unauthenticated GET answers both
   states at once — a track carries "@attr.nowplaying" while it's
   playing, and a "date" once it's been scrobbled — so there's no OAuth,
   no refresh token, and no Premium requirement. It also picks up
   whatever else gets played, not just Spotify.
   ------------------------------------------------------------------ */

const API = "https://ws.audioscrobbler.com/2.0/";

module.exports = async (req, res) => {
  const key = process.env.LASTFM_KEY;
  const user = process.env.LASTFM_USER;
  if (!key || !user) {
    return res.status(500).json({ error: "LASTFM_KEY / LASTFM_USER are not set" });
  }

  try {
    const q = new URLSearchParams({
      method: "user.getrecenttracks",
      user, api_key: key, format: "json", limit: "1",
    });
    const r = await fetch(`${API}?${q}`, { headers: { "User-Agent": "rkhooda-portfolio" } });
    const j = await r.json();
    /* last.fm reports its own failures in a 200 body */
    if (j.error) throw new Error(j.message || `lastfm ${j.error}`);

    /* one result comes back bare, several as an array — and a track that's
       playing right now is handed over on top of the scrobbled ones, so the
       first entry is always the one to read */
    const raw = j.recenttracks && j.recenttracks.track;
    const t = Array.isArray(raw) ? raw[0] : raw;
    if (!t) return send(res, { live: false });

    const live = !!(t["@attr"] && t["@attr"].nowplaying);
    send(res, {
      live,
      artist: (t.artist && (t.artist["#text"] || t.artist.name)) || "",
      track: t.name || "",
      /* uts is seconds; the card wants something Date can parse */
      playedAt: !live && t.date && t.date.uts
        ? new Date(+t.date.uts * 1000).toISOString()
        : undefined,
    });
  } catch (err) {
    res.status(502).json({ error: String(err.message || err) });
  }
};

function send(res, body) {
  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
  res.json(body);
}
