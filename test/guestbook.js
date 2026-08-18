/* test/guestbook.js — run with `node test/guestbook.js`.

   Exercises api/guestbook.js against a stubbed Upstash, so the one part of
   this site a stranger can write to stays checkable without an account:
   origin, honeypot, input caps, rate limiting, method allowlist.

   Lives outside api/ on purpose — anything in there ships as a public
   serverless function. */
const http = require("node:http");
const assert = require("node:assert");

const store = { list: [], rate: new Set(), count: 0 };

const stub = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const cmds = JSON.parse(body);
    const run = (c) => {
      const [op, key, ...rest] = c;
      if (op === "SET") {
        if (store.rate.has(key)) return { result: null };   // NX fails
        store.rate.add(key);
        return { result: "OK" };
      }
      if (op === "LPUSH") { store.list.unshift(rest[0]); return { result: store.list.length }; }
      if (op === "LTRIM") { store.list = store.list.slice(0, 200); return { result: "OK" }; }
      if (op === "INCR") { return { result: ++store.count }; }
      if (op === "LRANGE") return { result: store.list.slice(0, 50) };
      if (op === "GET") return { result: String(store.count) };
      if (op === "DEL") { store.list = []; store.count = 0; return { result: 1 }; }
      return { result: null };
    };
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(req.url === "/pipeline" ? cmds.map(run) : run(cmds)));
  });
});

function fakeRes() {
  const r = { code: 200, headers: {}, body: null };
  r.status = (c) => ((r.code = c), r);
  r.setHeader = (k, v) => (r.headers[k.toLowerCase()] = v);
  r.json = (b) => ((r.body = b), r);
  return r;
}

const call = async (handler, { method = "POST", body = {}, ip = "1.2.3.4", origin = "http://site.test" }) => {
  const res = fakeRes();
  await handler(
    { method, body, headers: { host: "site.test", origin, "x-forwarded-for": ip } },
    res
  );
  return res;
};

(async () => {
  await new Promise((r) => stub.listen(0, r));
  process.env.UPSTASH_REDIS_REST_URL = `http://127.0.0.1:${stub.address().port}`;
  process.env.UPSTASH_REDIS_REST_TOKEN = "stub";
  const handler = require(require("node:path").join(__dirname, "../api/guestbook.js"));

  let r = await call(handler, { origin: "https://evil.example" });
  assert.equal(r.code, 403, "cross-origin POST is refused");

  r = await call(handler, { origin: "" }); // "" not undefined — a default param would swallow undefined
  assert.equal(r.code, 403, "a POST with no Origin is refused");

  r = await call(handler, { body: { name: "bot", note: "buy pills", website: "http://spam" } });
  assert.equal(r.code, 200, "the honeypot answers 200");
  assert.equal(store.list.length, 0, "...but stores nothing");

  r = await call(handler, { body: { name: "", note: "hi" } });
  assert.equal(r.code, 400, "an empty name is refused");

  r = await call(handler, { body: { name: "a", note: "x".repeat(141) } });
  assert.equal(r.code, 400, "an over-long note is refused");

  r = await call(handler, { body: { name: { $ne: 1 }, note: ["x"] } });
  assert.equal(r.code, 400, "non-string fields are refused");

  r = await call(handler, { body: { name: " rk ", note: "  hello   there " } });
  assert.equal(r.code, 201, "a good signature is accepted");
  assert.equal(JSON.parse(store.list[0]).n, "rk", "name is trimmed");
  assert.equal(JSON.parse(store.list[0]).m, "hello there", "whitespace is collapsed");
  assert.equal(r.headers["cache-control"], "no-store", "writes are never cached");

  r = await call(handler, { body: { name: "rk", note: "again" } });
  assert.equal(r.code, 429, "the same IP is rate limited");
  assert.equal(store.list.length, 1, "...and nothing extra is stored");

  r = await call(handler, { body: { name: "someone", note: "else" }, ip: "9.9.9.9" });
  assert.equal(r.code, 201, "a different IP is unaffected");

  r = await call(handler, { body: { name: "spammer", note: "buy crypto now" }, ip: "5.5.5.5" });
  assert.equal(r.code, 400, "blocklisted word in note is rejected");
  assert.equal(store.list.length, 2, "...and nothing is stored");

  r = await call(handler, { body: { name: "fuck", note: "hello" }, ip: "6.6.6.6" });
  assert.equal(r.code, 400, "blocklisted word in name is rejected");

  r = await call(handler, { method: "GET" });
  assert.equal(r.code, 200);
  assert.equal(r.body.items.length, 2, "GET lists what was stored");
  assert.equal(r.body.count, 2, "GET reports the lifetime count");
  assert.match(r.headers["cache-control"], /s-maxage=30/, "reads are edge-cached");

  r = await call(handler, { method: "DELETE" });
  assert.equal(r.code, 405, "other methods are refused");

  stub.close();
  console.log("all guestbook guards ok");
})();
