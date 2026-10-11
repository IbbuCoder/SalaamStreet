/* The private AI Testing Lab's backend (backend/functions/ai-lab/core.js)
   against a real Postgres running backend/supabase-schema.sql, with Gemini
   replaced by a local stand-in (no real Google requests are made here).
   Run: node --test tests/ai-lab.test.js */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const path = require("path");
const { aiDb, pgStore, fakeGemini } = require("./helpers/ai-lab-store");

const ROOT = path.resolve(__dirname, "..");
const load = () => import(path.join(ROOT, "backend/functions/ai-lab/core.js"));
const loadPlans = () => import(path.join(ROOT, "backend/functions/ai-lab/plans.js"));
const KEY = "AIzaTEST-not-a-real-key-0123456789abcdef";
const ORIGIN = "https://salaamstreet.com";

const ADMIN = { id: "a0000000-0000-0000-0000-000000000001", email: "Ibrahim.Asim.Contact@gmail.com", email_confirmed_at: "2026-10-01T00:00:00Z", app_metadata: { provider: "google", providers: ["google"] } };
const users = {
  admin: ADMIN,
  other: { id: "b0000000-0000-0000-0000-000000000002", email: "someone@gmail.com", email_confirmed_at: "2026-10-01T00:00:00Z", app_metadata: { providers: ["google"] } },
  adminByEmailCode: Object.assign({}, ADMIN, { id: "c0000000-0000-0000-0000-000000000003", app_metadata: { provider: "email", providers: ["email"] } }),
  adminUnconfirmed: Object.assign({}, ADMIN, { id: "d0000000-0000-0000-0000-000000000004", email_confirmed_at: null }),
  maxPlan: { id: "e0000000-0000-0000-0000-000000000005", email: "paid@gmail.com", email_confirmed_at: "2026-10-01T00:00:00Z", app_metadata: { providers: ["google"], plan: "max" }, plan: { plan: "max", status: "active" } },
};

async function setup(envOver) {
  const { createHandler } = await load();
  const pg = await aiDb();
  const g = fakeGemini();
  const env = Object.assign({ GEMINI_API_KEY: KEY }, envOver || {});
  const warnings = [];
  const handle = createHandler({
    env: (k) => env[k], fetch: g.fetch, store: pgStore(pg, (t) => users[t] || null),
    log: { warn: (...a) => warnings.push(a.join(" ")) },
  });
  async function call(token, body, extra) {
    const headers = { "content-type": "application/json", origin: ORIGIN };
    if (token) headers.authorization = "Bearer " + token;
    const res = await handle(new Request("https://x.supabase.co/functions/v1/ai-lab", Object.assign({ method: "POST", headers, body: JSON.stringify(body) }, extra || {})));
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, text, headers: res.headers };
  }
  const chat = (token, text, history) => call(token, { action: "chat", messages: (history || []).concat([{ role: "user", text }]) });
  return { pg, g, env, call, chat, warnings, handle };
}
const one = async (pg, sql, params) => (await pg.query(sql, params)).rows[0];

test("the admin gets a real-shaped Gemini reply; the key goes only in a header to Google", async () => {
  const { pg, g, chat } = await setup();
  const r = await chat("admin", "What does Surah Al-Ikhlas teach?", [{ role: "user", text: "Salaam" }, { role: "model", text: "Wa alaykum as-salaam" }]);
  assert.equal(r.status, 200, r.text);
  assert.equal(r.body.text, "Test reply to: What does Surah Al-Ikhlas teach?");
  assert.equal(r.body.model, "gemini-3.5-flash-lite");
  assert.deepEqual(r.body.usage, { prompt: 1000, output: 200, thoughts: 100, total: 1300 });
  // 1000 × $0.30 + (200 + 100 thinking) × $2.50, per million tokens.
  assert.equal(r.body.cost_usd, 0.00105);
  assert.equal(r.body.remaining_today, 49);
  const call = g.calls[0];
  assert.equal(call.url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent");
  assert.equal(call.headers["x-goog-api-key"], KEY);
  assert.ok(call.url.indexOf(KEY) === -1, "never in the URL");
  assert.deepEqual(call.body.contents.map((c) => c.role), ["user", "model", "user"]);
  assert.match(call.body.systemInstruction.parts[0].text, /Never invent Qur'an verses, hadith/);
  assert.match(call.body.systemInstruction.parts[0].text, /not a mufti/);
  assert.equal(call.body.generationConfig.maxOutputTokens, 2048);
  assert.ok(r.text.indexOf(KEY) === -1, "the key never comes back");
  const row = await one(pg, "select status, prompt_tokens, output_tokens, thought_tokens, total_tokens, cost_usd::float as cost, kind from public.ai_usage");
  assert.deepEqual(row, { status: "ok", prompt_tokens: 1000, output_tokens: 200, thought_tokens: 100, total_tokens: 1300, cost: 0.00105, kind: "chat" });
  // The conversation itself is never stored.
  const cols = (await pg.query("select column_name from information_schema.columns where table_schema = 'public' and table_name like 'ai_%'")).rows.map((x) => x.column_name);
  assert.ok(!cols.some((c) => /text|message|prompt$|content/.test(c)), cols.join(","));
});

test("no session, a bad or expired session, and other accounts are refused before anything else happens", async () => {
  const { pg, g, call, chat } = await setup();
  const cases = [
    [null, 401, "signed_out"], ["expired-or-forged", 401, "invalid_session"], ["other", 403, "forbidden"],
    ["adminByEmailCode", 403, "forbidden"], ["adminUnconfirmed", 403, "forbidden"],
  ];
  for (const [tok, status, code] of cases) {
    for (const body of [{ action: "chat", messages: [{ role: "user", text: "hi" }] }, { action: "status" }, { action: "test" },
      { action: "settings", patch: { enabled: false } }]) {
      const r = await call(tok, body);
      assert.equal(r.status, status, tok + " " + body.action);
      assert.equal(r.body.error, code);
    }
  }
  // A token in another shape (not "Bearer x") is no session.
  const r = await call(null, { action: "status" }, { headers: { authorization: "Basic YWRtaW4=", "content-type": "application/json" } });
  assert.equal(r.status, 401);
  assert.equal(g.calls.length, 0, "Google was never called");
  assert.equal((await one(pg, "select count(*)::int as n from public.ai_usage")).n, 0, "nothing counted");
  assert.equal((await one(pg, "select enabled from public.ai_settings")).enabled, true, "settings unchanged");
  const log = (await pg.query("select event, detail from public.ai_security_log order by id")).rows;
  assert.ok(log.length >= 20, "refusals are logged");
  assert.ok(log.some((l) => l.detail === "not signed in with Google"));
  assert.ok(log.every((l) => !/@|Bearer|AIza/.test(String(l.detail))), "no emails or tokens in the log");
  void chat;
});

test("a paid plan never unlocks the Lab, and billing is off: everyone is on Free", async () => {
  const { call } = await setup();
  const r = await call("maxPlan", { action: "chat", messages: [{ role: "user", text: "hi" }] });
  assert.equal(r.status, 403);
  const plans = await loadPlans();
  assert.equal(plans.BILLING_ENABLED, false);
  assert.equal(plans.planFor({ plan: "max", status: "active" }), "free");
  assert.equal(plans.aiAllowance({ plan: "pro", status: "active" }), 0);
  assert.deepEqual(Object.keys(plans.PLANS), ["free", "plus", "pro", "max"]);
  assert.deepEqual(["free", "plus", "pro", "max"].map((k) => plans.PLANS[k].usdPerMonth), [0, 4.99, 7.99, 9.99]);
  for (const k of ["plus", "pro", "max"]) assert.equal(plans.PLANS[k].status, "planned");
  assert.ok(!JSON.stringify(plans.PLANS).match(/unlimited/i), "no unlimited usage promised");
});

test("a missing Gemini key is a clear setup error, and nothing is counted", async () => {
  const { pg, g, chat, call } = await setup({ GEMINI_API_KEY: "" });
  for (const r of [await chat("admin", "hi"), await call("admin", { action: "test" })]) {
    assert.equal(r.status, 503);
    assert.equal(r.body.error, "not_configured");
    assert.match(r.body.message, /GEMINI_API_KEY/);
  }
  const st = await call("admin", { action: "status" });
  assert.equal(st.status, 200);
  assert.equal(st.body.gemini_key_set, false);
  assert.equal(g.calls.length, 0);
  assert.equal((await one(pg, "select count(*)::int as n from public.ai_usage")).n, 0);
});

test("Google's errors become safe, specific messages (and never echo the key)", async () => {
  const { g, chat, call, pg } = await setup({ AI_TIMEOUT_MS: "1000" });
  const cases = [
    [{ status: 400, json: { error: { code: 400, message: "API key not valid. Please pass a valid API key. key=" + KEY, status: "INVALID_ARGUMENT" } } }, 502, "provider_auth"],
    [{ status: 403, json: { error: { message: "Permission denied", status: "PERMISSION_DENIED" } } }, 502, "provider_auth"],
    [{ status: 404, json: { error: { message: "models/gemini-x is not found", status: "NOT_FOUND" } } }, 502, "model_not_found"],
    [{ status: 429, json: { error: { message: "Quota exceeded", status: "RESOURCE_EXHAUSTED" } } }, 429, "provider_quota"],
    [{ status: 503, json: { error: { message: "overloaded", status: "UNAVAILABLE" } } }, 502, "provider_error"],
    ["network", 502, "network"],
    ["hang", 504, "timeout"],
    [{ status: 200, json: { promptFeedback: { blockReason: "SAFETY" }, usageMetadata: { promptTokenCount: 10, totalTokenCount: 10 } } }, 502, "blocked"],
    [{ status: 200, json: { candidates: [{ content: { parts: [] }, finishReason: "MAX_TOKENS" }] } }, 502, "max_tokens"],
  ];
  for (const [next, status, code] of cases) {
    g.next = next;
    const r = await chat("admin", "hi");
    assert.equal(r.status, status, code + ": " + r.text);
    assert.equal(r.body.error, code);
    assert.ok(r.text.indexOf(KEY) === -1, "no key in " + code);
    // Wait out the per-minute limit between cases.
    await pg.query("update public.ai_usage set at = at - interval '2 minutes'");
  }
  const errs = (await pg.query("select status, error from public.ai_usage order by id")).rows;
  assert.ok(errs.every((e) => e.status === "error"));
  g.next = { status: 404, json: { error: { message: "not found" } } };
  const t = await call("admin", { action: "test" });
  assert.equal(t.body.error, "model_not_found");
});

test("connection test: checks the key and model with Google without spending a chat", async () => {
  const { g, call } = await setup();
  const r = await call("admin", { action: "test" });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.body.display_name, "Fake Gemini");
  assert.equal(g.calls[0].method, "GET");
  assert.equal(g.calls[0].url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite");
  const st = await call("admin", { action: "status" });
  assert.equal(st.body.usage.today_requests, 0, "tests don't use the daily allowance");
  assert.equal(st.body.usage.remaining_today, 50);
});

test("daily and per-minute limits are enforced by the database", async () => {
  const { pg, chat, call, g } = await setup();
  await call("admin", { action: "settings", patch: { daily_limit: 3, minute_limit: 2 } });
  assert.equal((await chat("admin", "1")).status, 200);
  assert.equal((await chat("admin", "2")).status, 200);
  const fast = await chat("admin", "3");
  assert.equal(fast.status, 429);
  assert.equal(fast.body.error, "rate_limit");
  await pg.query("update public.ai_usage set at = at - interval '2 minutes'");
  assert.equal((await chat("admin", "3")).status, 200);
  await pg.query("update public.ai_usage set at = at - interval '2 minutes'");
  const over = await chat("admin", "4");
  assert.equal(over.status, 429);
  assert.equal(over.body.error, "daily_limit");
  assert.equal(g.calls.length, 3, "Google was asked exactly three times");
  const st = await call("admin", { action: "status" });
  assert.equal(st.body.usage.today_requests, 3);
  assert.equal(st.body.usage.remaining_today, 0);
  assert.ok(st.body.usage.today_cost_usd > 0);
  // Usage from yesterday doesn't count today.
  await pg.query("update public.ai_usage set at = at - interval '1 day'");
  assert.equal((await chat("admin", "new day")).status, 200);
});

test("two requests at once can't both slip past the limit", async () => {
  const { chat, call } = await setup();
  await call("admin", { action: "settings", patch: { daily_limit: 1 } });
  const rs = await Promise.all([chat("admin", "a"), chat("admin", "b"), chat("admin", "c")]);
  assert.deepEqual(rs.map((r) => r.status).sort(), [200, 429, 429]);
});

test("emergency switches: the database switch (from the Lab) and the AI_DISABLED secret", async () => {
  const { g, chat, call } = await setup();
  const off = await call("admin", { action: "settings", patch: { enabled: false } });
  assert.equal(off.body.settings.enabled, false);
  const r = await chat("admin", "hi");
  assert.equal(r.status, 503);
  assert.equal(r.body.error, "disabled");
  assert.equal((await call("admin", { action: "test" })).body.error, "disabled");
  // The switch itself still works while off.
  assert.equal((await call("admin", { action: "settings", patch: { enabled: true } })).body.settings.enabled, true);
  assert.equal((await chat("admin", "hi")).status, 200);
  const sec = await setup({ AI_DISABLED: "true" });
  const r2 = await sec.chat("admin", "hi");
  assert.equal(r2.status, 503);
  assert.match(r2.body.message, /AI_DISABLED/);
  assert.equal((await sec.call("admin", { action: "status" })).body.disabled_by_secret, true);
  assert.equal(sec.g.calls.length, 0);
  assert.equal(g.calls.length, 1);
});

test("settings: model, limits and prices change only within safe ranges", async () => {
  const { call, chat, g } = await setup();
  const bad = [{ model: "../../etc" }, { model: "" }, { daily_limit: -1 }, { daily_limit: 1.5 }, { daily_limit: 99999 },
    { max_output_tokens: 1 }, { enabled: "yes" }, { input_usd_per_mtok: -2 }, { surprise: 1 }, {}, null, [1]];
  for (const patch of bad) {
    const r = await call("admin", { action: "settings", patch });
    assert.equal(r.status, 400, JSON.stringify(patch));
  }
  const ok = await call("admin", { action: "settings", patch: { model: "models/gemini-3.8-flash", max_output_tokens: 1024, input_usd_per_mtok: 0.75, output_usd_per_mtok: 3.75 } });
  assert.equal(ok.status, 200, ok.text);
  assert.equal(ok.body.settings.model, "gemini-3.8-flash");
  await chat("admin", "hi");
  assert.match(g.calls[0].url, /models\/gemini-3\.8-flash:generateContent$/);
  assert.equal(g.calls[0].body.generationConfig.maxOutputTokens, 1024);
});

test("size limits: one message, the whole conversation and the request body", async () => {
  const { call, chat, g } = await setup();
  const long = await chat("admin", "x".repeat(6001));
  assert.equal(long.status, 413);
  assert.equal(long.body.error, "too_long");
  for (const messages of [[], [{ role: "model", text: "hi" }], [{ role: "user", text: "" }], [{ role: "system", text: "x" }], "hi"]) {
    assert.equal((await call("admin", { action: "chat", messages })).status, 400);
  }
  // Long histories keep only the newest turns that fit (4 × the message limit).
  const history = [];
  for (let i = 0; i < 12; i++) history.push({ role: "user", text: "q" + i + " " + "y".repeat(3000) }, { role: "model", text: "a" + i });
  const r = await chat("admin", "latest", history);
  assert.equal(r.status, 200, r.text);
  assert.ok(r.body.dropped_turns > 0);
  const sent = g.calls[0].body.contents;
  assert.equal(sent[0].role, "user");
  assert.equal(sent[sent.length - 1].parts[0].text, "latest");
  assert.ok(sent.reduce((n, c) => n + c.parts[0].text.length, 0) <= 24000);
  const huge = await call("admin", { action: "chat", messages: [{ role: "user", text: "z".repeat(250000) }] });
  assert.equal(huge.status, 413);
});

test("only POST from the app's own sites; CORS answers other origins without permission", async () => {
  const { handle } = await setup();
  const pre = await handle(new Request("https://x/functions/v1/ai-lab", { method: "OPTIONS", headers: { origin: ORIGIN } }));
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("access-control-allow-origin"), ORIGIN);
  const evil = await handle(new Request("https://x/functions/v1/ai-lab", { method: "OPTIONS", headers: { origin: "https://evil.example" } }));
  assert.equal(evil.headers.get("access-control-allow-origin"), null);
  const get = await handle(new Request("https://x/functions/v1/ai-lab", { method: "GET", headers: { authorization: "Bearer admin" } }));
  assert.equal(get.status, 405);
});

test("the Lab's tables and functions can't be reached with the app's public key", async () => {
  const pg = await aiDb();
  for (const role of ["anon", "authenticated"]) {
    await pg.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${ADMIN.id}', false);`);
    try {
      for (const sql of ["select * from public.ai_settings", "select * from public.ai_usage", "select * from public.ai_security_log",
        "update public.ai_settings set enabled = false", "insert into public.ai_usage (user_id, kind) values (gen_random_uuid(), 'chat')",
        `select public.ai_reserve('${ADMIN.id}', 'chat')`, "select public.ai_usage_summary()"]) {
        await assert.rejects(pg.query(sql), /permission denied/, role + ": " + sql);
      }
    } finally { await pg.exec("reset role;"); }
  }
});

test("the admin list ships as a hash, and the server never logs message text or tokens", async () => {
  const fs = require("fs");
  const core = fs.readFileSync(path.join(ROOT, "backend/functions/ai-lab/core.js"), "utf8");
  const sql = fs.readFileSync(path.join(ROOT, "backend/supabase-schema.sql"), "utf8");
  const block = sql.slice(sql.indexOf("AI Testing Lab (private"));
  assert.doesNotMatch(core.replace(/"ibrahim\.asim\.contact@gmail\.com"/, ""), /[a-z0-9._-]+@[a-z0-9-]+\.[a-z.]+/i);
  assert.doesNotMatch(block, /[a-z0-9._-]+@[a-z0-9-]+\.[a-z.]+/i);
  const want = crypto.createHash("sha256").update("ibrahim.asim.contact@gmail.com").digest("hex");
  assert.ok(core.indexOf(want) > -1);
  const { warnings, chat, g } = await setup();
  g.next = { status: 503, json: { error: { message: "boom " + KEY } } };
  await chat("admin", "my private question");
  assert.ok(warnings.length > 0);
  assert.ok(warnings.every((w) => w.indexOf("private question") === -1 && w.indexOf(KEY) === -1));
});

test("no secrets in anything the website serves; the browser never talks to Gemini directly", () => {
  const fs = require("fs");
  const { execSync } = require("child_process");
  const served = execSync("git ls-files", { cwd: ROOT, encoding: "utf8" }).split("\n")
    .filter((f) => f && !/^(backend|tests|docs|tools)\//.test(f) && /\.(html|js|json|css|txt|webmanifest|xml|md)$/.test(f));
  const untracked = execSync("git ls-files --others --exclude-standard", { cwd: ROOT, encoding: "utf8" }).split("\n")
    .filter((f) => f && /^js\//.test(f));
  assert.ok(served.length > 50);
  for (const f of served.concat(untracked)) {
    const s = fs.readFileSync(path.join(ROOT, f), "utf8");
    assert.doesNotMatch(s, /AIza[0-9A-Za-z_-]{30,}/, "Google API key in " + f);
    assert.doesNotMatch(s, /generativelanguage\.googleapis\.com/, "Gemini called from the browser in " + f);
    assert.doesNotMatch(s, /sb_secret_[0-9A-Za-z_-]{10,}/, "Supabase secret key in " + f);
    // A service_role JWT has "service_role" in its (base64) payload: "c2VydmljZV9yb2xl".
    assert.doesNotMatch(s, /eyJ[0-9A-Za-z_-]+\.[0-9A-Za-z_-]*c2VydmljZV9yb2xl/, "service_role key in " + f);
  }
  const lab = fs.readFileSync(path.join(ROOT, "js/ai-lab.js"), "utf8");
  assert.doesNotMatch(lab, /localStorage|sessionStorage|indexedDB|SS\.store/, "the conversation is never saved on the device");
  const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  assert.doesNotMatch(sw, /ai-lab/, "the Lab isn't part of the offline app");
});
