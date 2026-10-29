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
  await assert.rejects(pg.query("select public.admin_ban($1, $2, null, 'other', 'x', null, false)", [ID.user, ID.troll]), /forbidden/);
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
  assert.equal((await call("owner", { action: "ban", id: ID.troll, days: null, reason: "abusive email" })).status, 400, "a reason from the Community Rules");
  assert.equal((await call("owner", { action: "ban", id: ID.troll, days: null, reason: "other" })).status, 400, "“Other” needs a message");
  const ban = await call("owner", { action: "ban", id: ID.troll, days: null, reason: "offensive_name", message: "Your email contains a slur.", note: "troll", block: true });
  assert.equal(ban.status, 200, JSON.stringify(ban.body));
  const u = await one("select until > now() + interval '50 years' as forever from public.account_bans where user_id = $1", [ID.troll]);
  assert.equal(u.forever, true);
  assert.equal((await one("select count(*)::int as n from auth.sessions where user_id = $1", [ID.troll])).n, 2,
    "a ban doesn't sign them out: they can still see the ban and appeal (every online request is refused)");
  assert.equal((await one("select count(*)::int as n from public.blocked_emails")).n, 1, "the email is blocked");
  assert.equal((await one("select status from public.admin_flags where user_id = $1", [ID.troll])).status, "dismissed", "the flag is dealt with");
  const banned = await call("owner", { action: "users", filter: "banned" });
  assert.deepEqual(banned.body.users.map((x) => x.id), [ID.troll]);
  assert.equal((await call("owner", { action: "unban", id: ID.troll })).status, 200);
  assert.equal((await one("select count(*)::int as n from public.account_bans where user_id = $1", [ID.troll])).n, 0);
  assert.equal((await one("select count(*)::int as n from public.blocked_emails")).n, 0, "unbanning lifts the ban's email block");
  const week = await call("owner", { action: "ban", id: ID.troll, days: 7, reason: "ai_rules" });
  assert.equal(week.status, 200);
  assert.equal((await call("owner", { action: "ban", id: ID.troll, days: 0 })).status, 400);
  const so = await call("owner", { action: "sign_out", id: ID.user });
  assert.equal(so.body.sessions, 1);

  // Never yourself; never another admin.
  const self = await call("owner", { action: "ban", id: ID.owner, reason: "hacking" });
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

/* ═══════════ 3.0.2: what the banned person sees, warnings, appeals, blocked emails ═══════════ */
/** Run SQL as the signed-in user (RLS applies), optionally inside a given session. */
async function asUser(pg, uid, sid, sql, params) {
  const claims = JSON.stringify(Object.assign({ sub: uid }, sid ? { session_id: sid } : {}));
  await pg.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false), set_config('request.jwt.claims', '${claims}', false);`);
  try { return await pg.query(sql, params); } finally { await pg.exec("reset role; select set_config('request.jwt.claims', '', false), set_config('request.jwt.claim.sub', '', false);"); }
}

test("a banned account can still sign in and appeal, but every online feature refuses it (3.0.3)", async () => {
  const { pg, call, one } = await setup();
  const sid = (await one("select id from auth.sessions where user_id = $1 limit 1", [ID.troll])).id;
  // Before the ban: syncing works.
  await asUser(pg, ID.troll, sid, "insert into public.sync_records (user_id, col, key, value) values ($1, 'bookmarks', '1:1', '{}')", [ID.troll]);
  await call("owner", { action: "ban", id: ID.troll, days: 30, reason: "ai_abuse", message: "Mocking the Qur'an isn't allowed.", note: "private" });
  // Supabase Auth's own ban isn't used: they can still sign in.
  assert.equal((await one("select banned_until from auth.users where id = $1", [ID.troll])).banned_until, null);
  // Sync refuses the account at once: nothing to read, nothing written.
  assert.equal((await asUser(pg, ID.troll, sid, "select count(*)::int as n from public.sync_records")).rows[0].n, 0);
  await assert.rejects(asUser(pg, ID.troll, sid, "insert into public.sync_records (user_id, col, key, value) values ($1, 'bookmarks', '1:2', '{}')", [ID.troll]), /row-level security/);
  // So does the MSA (joining, posting) and SalaamStreet AI (account_is_banned, used by the ai-lab function).
  await assert.rejects(asUser(pg, ID.troll, sid, "select public.msa_join('Yusuf Khan')"), /account restricted/);
  assert.equal((await one("select public.account_is_banned($1) as r", [ID.troll])).r, true);
  assert.equal((await one("select public.account_is_banned($1) as r", [ID.user])).r, false);
  // They're told why (never the private note), and it isn't the strict kind.
  const st = (await asUser(pg, ID.troll, sid, "select public.account_status() as r")).rows[0].r;
  assert.deepEqual([st.banned, st.reason, st.message, st.strict, st.can_appeal], [true, "ai_abuse", "Mocking the Qur'an isn't allowed.", false, true]);
  assert.ok(!JSON.stringify(st).includes("private"));
  // Appeals, signed in.
  await assert.rejects(asUser(pg, ID.troll, sid, "select public.account_appeal('short')"), /appeal length/);
  const ap = (await asUser(pg, ID.troll, sid, "select public.account_appeal('I was joking, I will be respectful from now on.') as r")).rows[0].r;
  assert.equal(ap.appeal.status, "open");
  await assert.rejects(asUser(pg, ID.troll, sid, "select public.account_appeal('Another appeal while one is open')"), /appeal limit/);
  await assert.rejects(asUser(pg, ID.troll, sid, "select * from public.account_appeals"), /permission denied/);
  await pg.exec("set role anon;");
  await assert.rejects(pg.query("select public.account_appeal('Someone else appealing for them')"), /permission denied/);
  await pg.exec("reset role;");

  // Admins see it in Appeals, deny with a reply, then the person can appeal again (up to 3).
  const list = await call("owner", { action: "appeals" });
  assert.equal(list.body.appeals.length, 1);
  assert.equal(list.body.appeals[0].ban.note, "private");
  assert.equal((await call("owner", { action: "appeal_decide", id: list.body.appeals[0].id, accept: false, reply: "Not yet." })).status, 200);
  assert.equal((await call("owner", { action: "appeal_decide", id: list.body.appeals[0].id, accept: true })).body.error, "decided");
  const after = (await asUser(pg, ID.troll, sid, "select public.account_status() as r")).rows[0].r;
  assert.deepEqual([after.appeal.status, after.appeal.reply, after.appeals_left], ["denied", "Not yet.", 2]);
  await asUser(pg, ID.troll, sid, "select public.account_appeal('Please, I promise to follow the rules now.')");
  const second = (await call("owner", { action: "appeals" })).body.appeals[0];
  assert.equal((await call("owner", { action: "appeal_decide", id: second.id, accept: true, reply: "Welcome back." })).status, 200);
  assert.equal((await asUser(pg, ID.troll, sid, "select public.account_status() as r")).rows[0].r.banned, false, "accepting lifts the ban");
  assert.equal((await asUser(pg, ID.troll, sid, "select count(*)::int as n from public.sync_records")).rows[0].n, 2, "and sync works again (both items are back)");
  const acts = (await call("owner", { action: "audit" })).body.entries.map((e) => e.action);
  for (const a of ["ban", "appeal", "appeal_deny", "appeal_accept"]) assert.ok(acts.includes(a), a);
});

test("a ban for an offensive name or email is strict; an expired ban is over by itself", async () => {
  const { pg, call, one } = await setup();
  await call("owner", { action: "ban", id: ID.troll, days: 7, reason: "offensive_name" });
  assert.equal((await asUser(pg, ID.troll, null, "select public.account_status() as r")).rows[0].r.strict, true);
  await pg.query("update public.account_bans set until = now() - interval '1 minute' where user_id = $1", [ID.troll]);
  assert.equal((await asUser(pg, ID.troll, null, "select public.account_status() as r")).rows[0].r.banned, false);
  assert.equal((await one("select public.account_is_banned($1) as r", [ID.troll])).r, false);
  assert.equal((await call("owner", { action: "users", filter: "banned" })).body.total, 0);
});

test("sign out everywhere ends the session at once, even with a token that hasn't expired", async () => {
  const { pg, call, one } = await setup();
  const sid = (await one("select id from auth.sessions where user_id = $1", [ID.user])).id;
  assert.equal((await asUser(pg, ID.user, sid, "select public.account_status() as r")).rows[0].r.session_ended, false);
  await call("owner", { action: "sign_out", id: ID.user });
  assert.equal((await asUser(pg, ID.user, sid, "select public.account_status() as r")).rows[0].r.session_ended, true);
  assert.equal((await asUser(pg, ID.user, sid, "select public.am_blocked() as r")).rows[0].r, true);
});

test("warnings are shown once; the Community Rules are recorded; blocked emails can't sign up; the Home banner", async () => {
  const { pg, call, one } = await setup();
  assert.equal((await call("owner", { action: "warn", id: ID.user, reason: "ai_rules" })).status, 200);
  const st = (await asUser(pg, ID.user, null, "select public.account_status() as r")).rows[0].r;
  assert.equal(st.warnings.length, 1);
  assert.equal(st.warnings[0].reason, "ai_rules");
  assert.equal(st.rules_version, null);
  await asUser(pg, ID.user, null, "select public.account_warning_seen($1)", [st.warnings[0].id]);
  await asUser(pg, ID.user, null, "select public.account_accept_rules('2026-10-28')");
  const st2 = (await asUser(pg, ID.user, null, "select public.account_status() as r")).rows[0].r;
  assert.equal(st2.warnings.length, 0);
  assert.equal(st2.rules_version, "2026-10-28");
  assert.ok((await one("select rules_accepted_at from public.profiles where id = $1", [ID.user])).rules_accepted_at);
  const d = await call("owner", { action: "user", id: ID.user });
  assert.equal(d.body.user.warning_list.length, 1);
  assert.equal(d.body.user.rules_version, "2026-10-28");

  const b = await call("owner", { action: "blocked_set", add: "Spammer@Example.com", reason: "fake_accounts" });
  assert.equal(b.body.blocked[0].masked, "sp***@example.com");
  await assert.rejects(pg.query("insert into auth.users (id, email) values (gen_random_uuid(), 'spammer@example.com')"), /can't be used/);
  assert.equal((await call("owner", { action: "blocked_set", add: "ibrahim.asim.contact@gmail.com" })).body.error, "is_admin");
  await call("owner", { action: "blocked_set", remove: b.body.blocked[0].id });
  await pg.query("insert into auth.users (id, email) values (gen_random_uuid(), 'spammer@example.com')");

  assert.equal((await call("owner", { action: "notice_set", active: true, text: "" })).status, 400);
  const n = await call("owner", { action: "notice_set", active: true, text: "Eid Mubarak from SalaamStreet!", tone: "celebrate" });
  assert.equal(n.body.notice.active, true);
  await pg.exec("set role anon;");
  assert.equal((await pg.query("select public.app_notice_get() as r")).rows[0].r.text, "Eid Mubarak from SalaamStreet!");
  await pg.exec("reset role;");
  await call("owner", { action: "notice_set", active: false, text: "Eid Mubarak from SalaamStreet!" });
  assert.equal((await pg.query("select public.app_notice_get() as r")).rows[0].r, null);

  const csv = await call("owner", { action: "export_users", filter: "all" });
  assert.equal(csv.body.users.length, 5);
});

test("3.0.5: anonymous daily visit counts, and the Analytics tab's numbers", async () => {
  const { pg, call, one } = await setup();
  // The app (anon key, signed out or in) adds to today's total; only the day, kind and total are kept.
  await pg.exec("set role anon;");
  for (let i = 0; i < 3; i++) await pg.query("select public.visit_count('guest')");
  await pg.query("select public.visit_count('account')");
  await assert.rejects(pg.query("select public.visit_count('robot')"), /bad kind/);
  assert.equal((await pg.query("select * from public.app_visits")).rows.length, 0, "the public can't read the totals");
  await assert.rejects(pg.query("select public.admin_analytics($1)", [ID.owner]), /permission denied/);
  await pg.exec("reset role;");
  assert.deepEqual(Object.keys((await pg.query("select * from public.app_visits limit 1")).rows[0]).sort(), ["day", "kind", "n"], "no ids, addresses or devices");
  await pg.query("insert into public.app_visits (day, kind, n) values ((now() at time zone 'UTC')::date - 1, 'guest', 5), ((now() at time zone 'UTC')::date - 500, 'guest', 9)");
  await pg.query("select public.visit_count('account')");
  assert.equal((await one("select count(*)::int as n from public.app_visits where day < now()::date - 400")).n, 1, "old days go on a new day's first visit, not on every visit");

  const a = await call("owner", { action: "analytics" });
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.equal(a.body.visits.guests_today, 3);
  assert.equal(a.body.visits.guests_yesterday, 5);
  assert.equal(a.body.visits.guests_7d, 8);
  assert.equal(a.body.visits.accounts_today, 2);
  assert.equal(a.body.visits_30d.length, 30);
  assert.deepEqual(a.body.visits_30d.at(-1).guest, 3);
  assert.equal(a.body.signups_30d.length, 30);
  assert.equal(a.body.accounts.total, 4);
  assert.deepEqual(a.body.by_provider, { email: 1, google: 3 });
  assert.equal(a.body.features.synced_items, 1);
  assert.equal(a.body.features.syncing_accounts, 1);
  assert.equal(a.body.moderation.admins, 1);
  assert.ok(a.body.ai && typeof a.body.ai.week_requests === "number");
  assert.equal((await call("owner", { action: "overview" })).body.guests_today, 3, "the Overview shows guests today too");
  assert.equal((await call("user", { action: "analytics" })).status, 403, "admins only");
});
