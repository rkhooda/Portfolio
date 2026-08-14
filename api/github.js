/* ------------------------------------------------------------------
   api/github.js — the contribution calendar behind the About strip.

   One GraphQL call (the REST API doesn't expose contributions at all).
   The edge cache below means GitHub sees roughly 24 requests a day no
   matter how much traffic the page gets, so no rate limit is in reach.
   ------------------------------------------------------------------ */

const QUERY = `query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`;

/* Consecutive days with at least one contribution, counting back from the
   end of the calendar. Today is the one day allowed to be empty without
   ending the streak — it isn't over yet, and a streak that reads 0 every
   morning until the first commit lands would be worse than useless. */
function streakOf(counts) {
  let n = 0;
  for (let i = counts.length - 1; i >= 0; i--) {
    if (counts[i] > 0) n++;
    else if (i !== counts.length - 1) break;
  }
  return n;
}

module.exports = async (req, res) => {
  const token = process.env.GH_TOKEN;
  const login = process.env.GH_USER || "rkhooda";
  if (!token) return res.status(500).json({ error: "GH_TOKEN is not set" });

  try {
    const r = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "rkhooda-portfolio",
      },
      body: JSON.stringify({ query: QUERY, variables: { login } }),
    });
    const json = await r.json();
    if (json.errors) throw new Error(json.errors[0].message);

    const cal = json.data.user.contributionsCollection.contributionCalendar;
    const days = cal.weeks.flatMap((w) => w.contributionDays);
    const counts = days.map((d) => d.contributionCount);

    /* counts alone, not 365 objects: the client only needs the numbers and
       the weekday the year starts on, which it derives from `from` */
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    res.json({
      total: cal.totalContributions,
      streak: streakOf(counts),
      from: days[0].date,
      days: counts,
    });
  } catch (err) {
    res.status(502).json({ error: String(err.message || err) });
  }
};

/* `node api/github.js` — the streak edge cases, which are the only real
   logic in this file */
if (require.main === module) {
  const assert = require("node:assert");
  assert.equal(streakOf([1, 1, 1]), 3, "all active");
  assert.equal(streakOf([1, 1, 0]), 2, "empty today doesn't break it");
  assert.equal(streakOf([1, 0, 1]), 1, "a gap does break it");
  assert.equal(streakOf([0, 0, 0]), 0, "nothing is nothing");
  assert.equal(streakOf([1, 0, 0]), 0, "yesterday empty ends it at zero");
  console.log("streakOf ok");
}
