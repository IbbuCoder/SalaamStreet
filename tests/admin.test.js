/* The Admin Panel's backend (backend/functions/admin/core.js) against a real
   Postgres running backend/supabase-schema.sql, with the bits of Supabase
   Auth it touches (auth.users, auth.sessions) stubbed.
   Run: node --test tests/admin.test.js */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { adminDb, adminStore } = require("./helpers/admin-store");

const ROOT = path.resolve(__dirname, "..");
const load = () => import(path.join(ROOT, "backend/functions/admin/core.js"));
const ORIGIN = "https://salaamstreet.com";

const ID = {
  owner: "a0000000-0000-0000-0000-000000000001",
  troll: "b0000000-0000-0000-0000-000000000002",
  user: "c0000000-0000-0000-0000-000000000003",
  helper: "e0000000-0000-0000-0000-000000000005",
};
const google = { provider: "google", providers: ["google"] };
const users = {
  owner: { id: ID.owner, email: "Ibrahim.Asim.Contact@gmail.com", email_confirmed_at: "2026-10-01T00:00:00Z", app_metadata: google },
  troll: { id: ID.troll, email: "n1gger.lol@gmail.com", email_confirmed_at: "2026-10-01T00:00:00Z", app_metadata: { provider: "email", providers: ["email"] } },
  user: { id: ID.user, email: "salam@example.com", email_confirmed_at: "2026-10-01T00:00:00Z", app_metadata: google },
  // The owner's account signed in another way (email): never enough for the panel.
  ownerByEmail: { id: ID.owner, email: "ibrahim.asim.contact@gmail.com", email_confirmed_at: "2026-10-01T00:00:00Z", app_metadata: { provider: "email", providers: ["email"] } },
  helper: { id: ID.helper, email: "helper@gmail.com", email_confirmed_at: "2026-10-01T00:00:00Z", app_metadata: google },
};

async function setup() {
  // An account that already existed before 3.0.1 is checked when the file runs.
  const pg = await adminDb((db) => db.query(`insert into auth.users (id, email, raw_app_meta_data, email_confirmed_at, created_at, last_sign_in_at)
    values ($1, $2, '{"provider":"email"}', now(), now() - interval '2 days', now())`, [ID.troll, users.troll.email]));
  for (const k of ["owner", "user", "helper"]) {
    await pg.query(`insert into auth.users (id, email, raw_app_meta_data, email_confirmed_at, last_sign_in_at) values ($1, $2, '{"provider":"google"}', now(), now())`,
      [users[k].id, users[k].email]);
  }
  await pg.query("insert into auth.sessions (user_id) values ($1), ($1), ($2)", [ID.troll, ID.user]);
  await pg.query("insert into public.sync_records (user_id, col, key, value) values ($1, 'bookmarks', '2:255', '{}')", [ID.troll]);
  const store = adminStore(pg, (t) => users[t] || null);
  const { createHandler } = await load();
  const warnings = [];
  const handle = createHandler({ env: () => undefined, store, log: { warn: (...a) => warnings.push(a.join(" ")) } });
  async function call(token, body, origin) {
    const headers = { "content-type": "application/json", origin: origin || ORIGIN };
    if (token) headers.authorization = "Bearer " + token;
    const res = await handle(new Request("https://x.supabase.co/functions/v1/admin", { method: "POST", headers, body: JSON.stringify(body) }));
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
  }
  const one = async (sql, params) => (await pg.query(sql, params)).rows[0];
  return { pg, call, one, warnings };
}

test("only the owner's Google account gets in; everyone else is refused and the attempt is logged", async () => {
  const { call, one } = await setup();
  const me = await call("owner", { action: "me" });
  assert.equal(me.status, 200, JSON.stringify(me.body));
  assert.equal(me.body.admin, true);
  assert.equal(me.body.email, "ibrahim.asim.contact@gmail.com");
  for (const [tok, status, code] of [[null, 401, "signed_out"], ["forged", 401, "invalid_session"], ["user", 403, "forbidden"],
    ["troll", 403, "forbidden"], ["ownerByEmail", 403, "forbidden"]]) {
    for (const action of ["overview", "users", "ban", "admins_set"]) {
      const r = await call(tok, { action, id: ID.user, add: "x@y.com" });
      assert.equal(r.status, status, tok + " " + action);
      assert.equal(r.body.error, code);
    }
  }
  const byEmail = await call("ownerByEmail", { action: "overview" });
  assert.match(byEmail.body.message, /Sign in with Google/);
  // "me" is only the app asking whether to show the link: not logged. Real attempts are.
  await call("user", { action: "me" });
  const denied = await one("select count(*)::int as n from public.admin_audit where action = 'denied' and admin_id = $1", [ID.user]);
  assert.equal(denied.n, 4);
  assert.equal((await one("select count(*)::int as n from public.app_admins")).n, 1, "nothing was added");
});

test("the database functions check the admin list themselves", async () => {
  const { pg } = await setup();
  await pg.exec("set role service_role;");
  await assert.rejects(pg.query("select public.admin_ban($1, $2, null, 'x')", [ID.user, ID.troll]), /forbidden/);
  await assert.rejects(pg.query("select public.admin_users($1, '', 'all', 0)", [ID.helper]), /forbidden/);
  await pg.exec("reset role;");
  // And the app's public roles can't call them at all.
  await pg.exec("set role authenticated;");
  await assert.rejects(pg.query("select public.admin_overview($1)", [ID.owner]), /permission denied/);
  await assert.rejects(pg.query("select * from public.admin_audit"), /permission denied/);
  await pg.exec("reset role;");
});

test("abusive sign-ups are flagged (old and new), and refused when the switch is on", async () => {
  const { pg, call, one } = await setup();
  const flag = await one("select word, status from public.admin_flags where user_id = $1", [ID.troll]);
  assert.deepEqual(flag, { word: "nigger", status: "open" }, "look-alike digits are undone");
  assert.equal((await one("select count(*)::int as n from public.admin_flags")).n, 1, "nobody else is flagged");
  // Names from Google are checked too; a normal name isn't.
  await pg.query(`insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'a@b.com', '{"full_name":"Towel Head"}'),
    (gen_random_uuid(), 'nigeria.fan@b.com', '{"full_name":"Grape Spice"}')`);
  assert.equal((await one("select count(*)::int as n from public.admin_flags")).n, 2);
  const s = await call("owner", { action: "screening_set", block: true });
  assert.equal(s.body.block_signups, true);
  await assert.rejects(pg.query("insert into auth.users (id, email) values (gen_random_uuid(), 'kike99@x.com')"), /can't be used/);
  await pg.query("insert into auth.users (id, email) values (gen_random_uuid(), 'fine@x.com')");
  // Adding a word flags existing accounts that match it.
  const w = await call("owner", { action: "screening_set", add: "Salam" });
  assert.ok(w.body.words.includes("salam"));
  assert.equal((await one("select status from public.admin_flags where user_id = $1", [ID.user])).status, "open");
  const r = await call("owner", { action: "screening_set", remove: "salam" });
  assert.ok(!r.body.words.includes("salam"));
  const bad = await call("owner", { action: "screening_set", add: "!!" });
  assert.equal(bad.status, 400);
});

test("overview and users: numbers, search, filters and one account's details", async () => {
  const { call } = await setup();
  const o = await call("owner", { action: "overview" });
  assert.equal(o.status, 200);
  assert.equal(o.body.accounts, 4);
  assert.equal(o.body.open_flags, 1);
  assert.equal(o.body.signups_14d.length, 14);
  assert.equal(o.body.recent.length, 4);
  assert.ok(o.body.ai && typeof o.body.ai.today_requests === "number");
  const all = await call("owner", { action: "users" });
  assert.equal(all.body.total, 4);
  const flagged = await call("owner", { action: "users", filter: "flagged" });
  assert.deepEqual(flagged.body.users.map((u) => u.id), [ID.troll]);
  const admins = await call("owner", { action: "users", filter: "admins" });
  assert.deepEqual(admins.body.users.map((u) => u.id), [ID.owner]);
  const found = await call("owner", { action: "users", search: "SALAM@" });
  assert.deepEqual(found.body.users.map((u) => u.email), ["salam@example.com"]);
  assert.equal((await call("owner", { action: "users", filter: "everyone" })).status, 400);
  const d = await call("owner", { action: "user", id: ID.troll });
  assert.equal(d.status, 200);
  assert.equal(d.body.user.sync.items, 1);
  assert.equal(d.body.user.flag.word, "nigger");
  assert.equal(d.body.user.ai.questions, 0);
  assert.equal((await call("owner", { action: "user", id: "not-an-id" })).status, 400);
  assert.equal((await call("owner", { action: "user", id: "f0000000-0000-0000-0000-000000000009" })).status, 404);
});

test("ban, sign out, unban and delete — with the log, and never on yourself or another admin", async () => {
  const { call, one } = await setup();
  const ban = await call("owner", { action: "ban", id: ID.troll, days: null, reason: "abusive email" });
  assert.equal(ban.status, 200, JSON.stringify(ban.body));
  const u = await one("select banned_until > now() + interval '50 years' as forever from auth.users where id = $1", [ID.troll]);
  assert.equal(u.forever, true);
  assert.equal((await one("select count(*)::int as n from auth.sessions where user_id = $1", [ID.troll])).n, 0, "signed out everywhere");
  assert.equal((await one("select status from public.admin_flags where user_id = $1", [ID.troll])).status, "dismissed", "the flag is dealt with");
  const banned = await call("owner", { action: "users", filter: "banned" });
  assert.deepEqual(banned.body.users.map((x) => x.id), [ID.troll]);
  assert.equal((await call("owner", { action: "unban", id: ID.troll })).status, 200);
  assert.equal((await one("select banned_until from auth.users where id = $1", [ID.troll])).banned_until, null);
  const week = await call("owner", { action: "ban", id: ID.troll, days: 7 });
  assert.equal(week.status, 200);
  assert.equal((await call("owner", { action: "ban", id: ID.troll, days: 0 })).status, 400);
  const so = await call("owner", { action: "sign_out", id: ID.user });
  assert.equal(so.body.sessions, 1);

  // Never yourself; never another admin.
  const self = await call("owner", { action: "ban", id: ID.owner });
  assert.equal(self.body.error, "self");
  await call("owner", { action: "admins_set", add: "helper@gmail.com" });
  const other = await call("owner", { action: "delete", id: ID.helper, confirm: "helper@gmail.com" });
  assert.equal(other.body.error, "is_admin");

  // Delete needs the email typed back exactly.
  const wrong = await call("owner", { action: "delete", id: ID.troll, confirm: "someone@gmail.com" });
  assert.equal(wrong.body.error, "confirm");
  assert.equal((await call("owner", { action: "delete", id: ID.troll })).body.error, "confirm");
  const del = await call("owner", { action: "delete", id: ID.troll, confirm: " N1GGER.LOL@gmail.com ", reason: "abuse" });
  assert.equal(del.status, 200, JSON.stringify(del.body));
  assert.equal((await one("select count(*)::int as n from auth.users where id = $1", [ID.troll])).n, 0);
  assert.equal((await one("select count(*)::int as n from public.sync_records where user_id = $1", [ID.troll])).n, 0, "their data goes too");

  const log = await call("owner", { action: "audit" });
  const acts = log.body.entries.map((e) => e.action);
  for (const a of ["ban", "unban", "sign_out", "admin_add", "delete"]) assert.ok(acts.includes(a), a);
  const d = log.body.entries.find((e) => e.action === "delete");
  assert.equal(d.target, "n1***@gmail.com", "the log keeps a masked email after the account is gone");
  assert.equal(d.by, "ib***@gmail.com");
});

test("flags, SalaamStreet AI pauses and the AI switches", async () => {
  const { call, one } = await setup();
  const f = await call("owner", { action: "flags" });
  assert.equal(f.body.open.length, 1);
  assert.equal(f.body.open[0].word, "nigger");
  assert.equal((await call("owner", { action: "flag", id: ID.troll, op: "dismiss" })).status, 200);
  assert.equal((await call("owner", { action: "flags" })).body.open.length, 0);
  await call("owner", { action: "flag", id: ID.user, op: "add", note: "keeps posting spam" });
  const f2 = await call("owner", { action: "flags" });
  assert.equal(f2.body.open[0].note, "keeps posting spam");

  const p = await call("owner", { action: "ai_member", id: ID.user, op: "pause", days: 30 });
  assert.equal(p.status, 200);
  assert.equal((await one("select banned_until > now() + interval '29 days' as ok from public.ai_members where user_id = $1", [ID.user])).ok, true);
  assert.equal((await call("owner", { action: "flags" })).body.ai.length, 1);
  await call("owner", { action: "ai_member", id: ID.user, op: "restore" });
  assert.equal((await one("select banned_until from public.ai_members where user_id = $1", [ID.user])).banned_until, null);

  const ai = await call("owner", { action: "ai_set", patch: { enabled: false, user_daily_limit: 5 } });
  assert.equal(ai.body.enabled, false);
  assert.equal(ai.body.user_daily_limit, 5);
  assert.equal((await one("select enabled from public.ai_settings")).enabled, false);
  assert.equal((await call("owner", { action: "ai_set", patch: { model: "x" } })).status, 400, "the model stays in the Lab");
  assert.equal((await call("owner", { action: "ai_set", patch: { user_daily_limit: -1 } })).status, 400);
});

test("the admin list: add, list, and never remove yourself or the last admin", async () => {
  const { call } = await setup();
  const add = await call("owner", { action: "admins_set", add: " Helper@Gmail.com " });
  assert.equal(add.status, 200);
  assert.deepEqual(add.body.admins.map((a) => a.email), ["ibrahim.asim.contact@gmail.com", "helper@gmail.com"]);
  // The new admin can now open the panel with their Google account.
  assert.equal((await call("helper", { action: "overview" })).status, 200);
  const mine = add.body.admins.find((a) => a.me);
  assert.equal((await call("owner", { action: "admins_set", remove: mine.id })).body.error, "self");
  const theirs = add.body.admins.find((a) => !a.me);
  const rm = await call("owner", { action: "admins_set", remove: theirs.id });
  assert.equal(rm.body.admins.length, 1);
  assert.equal((await call("helper", { action: "overview" })).status, 403);
  assert.equal((await call("owner", { action: "admins_set", add: "not-an-email" })).status, 400);
});

test("NVHS MSA: the latest posts, and an admin can take one down", async () => {
  const { pg, call } = await setup();
  const { rows } = await pg.query("insert into public.msa_posts (title, created_by) values ('Halaqa on Friday', $1) returning id", [ID.user]);
  const m = await call("owner", { action: "msa" });
  assert.equal(m.body.posts.length, 1);
  assert.equal(m.body.posts[0].author, "sa***@example.com");
  assert.equal((await call("owner", { action: "msa_delete_post", id: rows[0].id })).status, 200);
  assert.equal((await call("owner", { action: "msa" })).body.posts.length, 0);
  assert.equal((await call("owner", { action: "msa_delete_post", id: rows[0].id })).status, 404);
});

test("the website and the iPhone app may call it; other sites get no CORS header", async () => {
  const { call } = await setup();
  for (const o of ["https://salaamstreet.com", "app://salaamstreet"]) {
    const r = await call("owner", { action: "me" }, o);
    assert.equal(r.headers.get("access-control-allow-origin"), o);
  }
  const evil = await call("owner", { action: "me" }, "https://evil.example");
  assert.equal(evil.headers.get("access-control-allow-origin"), null);
  const ai = await import(path.join(ROOT, "backend/functions/ai-lab/core.js"));
  assert.ok(ai.DEFAULT_ORIGINS.includes("app://salaamstreet"), "SalaamStreet AI works in the iPhone app too");
});
