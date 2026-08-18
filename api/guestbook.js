/* ------------------------------------------------------------------
   api/guestbook.js — visitors sign the sleeve.

   Upstash over its plain REST interface, so this stays a repo with no
   package.json and no build step. GET lists, POST signs.

   Everything a stranger can send is treated as hostile: capped, stripped
   of control characters, rate limited by a hashed IP, and rendered by the
   client with textContent rather than innerHTML.
   ------------------------------------------------------------------ */

const crypto = require("node:crypto");

const KEY = "guestbook";
const COUNT_KEY = "guestbook:count";
const KEEP = 200;      // signatures retained; the rest age out of the list
const SHOW = 50;       // signatures handed to the page
const NAME_MAX = 24;
const NOTE_MAX = 140;
const EVERY = 3600;    // one signature per IP per hour

const BLOCKLIST = [
  "fuck", "shit", "cunt", "bitch", "nigger", "nigga", "faggot", "fag", "retard",
  "kys", "kill yourself", "go die", "suicide", "rape", "pedo", "hitler", "nazi",
  "spam", "buy now", "click here", "http://", "https://", "www.", ".com", ".net",
  "crypto", "bitcoin", "ethereum", "investment", "trading", "forex", "casino",
  "porn", "sex", "xxx", "nude", "onlyfans", "escort", "viagra", "cialis"
];

/* Vercel's Upstash integration injects these as KV_REST_API_*; a database
   created straight from Upstash names them UPSTASH_REDIS_REST_*. Same REST
   API either way, so take whichever is present rather than making the
   provisioning route matter. */
const url = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function send(payload, path) {
  const r = await fetch(url() + path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`redis: ${r.status}`);
  return r.json();
}

/* one command answers with {result}, a pipeline with [{result}, ...] —
   two shapes, so two callers rather than one that guesses */
async function redis(command) {
  const j = await send(command, "");
  if (j.error) throw new Error(j.error);
  return j.result;
}

async function pipeline(commands) {
  const rows = await send(commands, "/pipeline");
  const bad = rows.find((x) => x.error);
  if (bad) throw new Error(bad.error);
  return rows.map((x) => x.result);
}

/* One line of plain text. Control characters are flattened to spaces
   rather than rejected — a stray tab shouldn't cost someone their note —
   and newlines go with them, because a signature is one line by design. */
function clean(v, max) {
  if (typeof v !== "string") return null;
  const s = [...v]
    .map((ch) => (ch.codePointAt(0) < 32 || ch.codePointAt(0) === 127 ? " " : ch))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return s && s.length <= max ? s : null;
}

function containsBlocked(text) {
  const lower = text.toLowerCase();
  return BLOCKLIST.some((word) => lower.includes(word));
}

/* the IP is hashed before it is ever a key: enough to rate limit the same
   visitor, not enough to be a record of who visited */
const rateKey = (req) =>
  "rl:" + crypto.createHash("sha256")
    .update((req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown")
    .digest("hex").slice(0, 16);

module.exports = async (req, res) => {
  if (!url()) return res.status(500).json({ error: "no redis url in env (KV_REST_API_URL)" });

  try {
    if (req.method === "GET") {
      const [rows, count] = await pipeline([
        ["LRANGE", KEY, "0", String(SHOW - 1)],
        ["GET", COUNT_KEY],
      ]);
      const items = (rows || [])
        .map((r) => { try { return JSON.parse(r); } catch (_) { return null; } })
        .filter(Boolean);
      res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=300");
      return res.json({ items, count: Number(count) || items.length });
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ error: "method not allowed" });
    }

    res.setHeader("Cache-Control", "no-store");

    /* a browser always sends Origin on a POST, so requiring it to match the
       host we were reached on costs nothing and turns away the laziest
       scripted abuse. Trivially spoofed — a speed bump, not a lock. */
    const origin = req.headers.origin;
    if (!origin || new URL(origin).host !== req.headers.host) {
      return res.status(403).json({ error: "bad origin" });
    }

    const body = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) || {};

    /* the honeypot is a field no human ever sees. Anything that fills it is
       told the signature landed and is quietly dropped — a bot handed an
       error just retries with different input. */
    if (body.website) return res.status(200).json({ ok: true });

    const name = clean(body.name, NAME_MAX);
    const note = clean(body.note, NOTE_MAX);
    if (!name || !note) {
      return res.status(400).json({
        error: `a name (1-${NAME_MAX}) and a note (1-${NOTE_MAX}) are both required`,
      });
    }

    if (containsBlocked(name) || containsBlocked(note)) {
      return res.status(400).json({ error: "that word isn't welcome here" });
    }

    const fresh = await redis(["SET", rateKey(req), "1", "NX", "EX", String(EVERY)]);
    if (fresh === null) {
      return res.status(429).json({ error: "one signature an hour — come back later" });
    }

    const entry = { n: name, m: note, t: Date.now() };
    await pipeline([
      ["LPUSH", KEY, JSON.stringify(entry)],
      ["LTRIM", KEY, "0", String(KEEP - 1)],
      ["INCR", COUNT_KEY],
    ]);
    res.status(201).json({ ok: true, entry });
  } catch (err) {
    res.status(502).json({ error: String(err.message || err) });
  }
};

/* `node api/guestbook.js` — the input guard, which is the only part of
   this file a stranger gets to aim at */
if (require.main === module) {
  const assert = require("node:assert");
  const ctrl = String.fromCharCode(9) + String.fromCharCode(10) + String.fromCharCode(0);
  assert.equal(clean("  hi   there ", 24), "hi there", "collapses whitespace");
  assert.equal(clean("a" + ctrl + "b", 24), "a b", "flattens control characters");
  assert.equal(clean("", 24), null, "empty is rejected");
  assert.equal(clean("   ", 24), null, "whitespace-only is rejected");
  assert.equal(clean(ctrl, 24), null, "control-only is rejected");
  assert.equal(clean("x".repeat(25), 24), null, "over the cap is rejected");
  assert.equal(clean("x".repeat(24), 24), "x".repeat(24), "at the cap is fine");
  assert.equal(clean(42, 24), null, "non-strings are rejected");
  assert.equal(clean(null, 24), null, "null is rejected");
  assert.equal(clean("héllo 🎧", 24), "héllo 🎧", "normal unicode survives");
  assert.equal(
    clean("<img src=x onerror=alert(1)>", 140),
    "<img src=x onerror=alert(1)>",
    "markup is stored verbatim — the client renders it as text, never as html"
  );
  console.log("clean ok");
}
