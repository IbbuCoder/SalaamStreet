/* 2.11 NVHS MSA announcements: backend/supabase-schema.sql in a real Postgres
   (PGlite), with Supabase's auth bits stubbed as in schema.test.js.
   Anyone can read current announcements; only accounts on the poster list
   can write them, and nothing is reachable through the table API.
   Run: node --test tests/msa.test.js */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const SQL = fs.readFileSync(path.join(__dirname, "..", "backend", "supabase-schema.sql"), "utf8");
const POSTER = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const ADDED = "33333333-3333-3333-3333-333333333333";
const IMG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";

async function db() {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite();
  await pg.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text, phone text, raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create publication supabase_realtime;
    grant usage on schema public, auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
  `);
  await pg.exec(SQL);
  // Supabase grants table privileges to these roles by default; the schema must take them away.
  await pg.exec(`grant select, insert, update, delete on all tables in schema public to authenticated, anon;`);
  await pg.exec(SQL); // re-running the file is how projects upgrade
  // A poster is added the way the README says; they sign in with Google, which reports the address in its own case.
  await pg.query(`insert into public.msa_admins (email_hash) values (sha256(convert_to(lower('poster@example.org'), 'UTF8')))`);
  await pg.query(`insert into auth.users (id, email) values ($1, 'Poster@Example.ORG'), ($2, 'someone@example.com'), ($3, 'advisor@example.org')`, [POSTER, OTHER, ADDED]);
  return pg;
}
async function as(pg, uid, sql, params) {
  await pg.exec(`set role ${uid ? "authenticated" : "anon"}; select set_config('request.jwt.claim.sub', '${uid || ""}', false);`);
  try { return await pg.query(sql, params); } finally { await pg.exec("reset role;"); }
}
async function rpc(pg, uid, fn, args) {
  const names = Object.keys(args || {});
  const r = await as(pg, uid, `select public.${fn}(${names.map((n, i) => `${n} => $${i + 1}`).join(", ")}) as r`, names.map((n) => args[n]));
  return r.rows[0].r;
}
const save = (pg, uid, post) => rpc(pg, uid, "msa_post_save", { p: JSON.stringify(post) });

test("the poster list ships as hashes, never email addresses", async () => {
  const block = SQL.slice(SQL.indexOf("2.11 — NVHS MSA"));
  assert.doesNotMatch(block.replace(/name@example\.org/g, ""), /[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]+/i);
  const pg = await db();
  const r = await pg.query(`select count(*)::int as n from public.msa_admins`);
  assert.equal(r.rows[0].n, 3, "2.11.8: the two owners, plus the test's own poster");
});

test("a poster posts, edits and deletes; everyone (even signed out) reads", async () => {
  const pg = await db();
  assert.equal(await rpc(pg, POSTER, "msa_is_poster"), true);
  const a = await save(pg, POSTER, { title: "  Bake sale Friday ", body: "Room 1234 after school.\nBring a friend!", image: IMG, on_home: true });
  assert.equal(a.title, "Bake sale Friday");
  assert.equal(a.has_image, true);
  assert.equal(a.created_by, undefined, "who posted is never sent out");
  const b = await save(pg, POSTER, { title: "Jumu'ah this week", pinned: true });
  let feed = await rpc(pg, null, "msa_feed");
  assert.deepEqual(feed.map((p) => p.title), ["Jumu'ah this week", "Bake sale Friday"], "pinned first, then newest");
  assert.equal(feed[1].image, undefined, "the feed leaves images out");
  assert.equal(await rpc(pg, null, "msa_image", { p_id: a.id }), IMG);
  assert.equal(await rpc(pg, OTHER, "msa_image", { p_id: b.id }), null);

  const edited = await save(pg, POSTER, { id: a.id, title: "Bake sale moved to Monday", body: "Same room." });
  assert.equal(edited.has_image, true, "the image is kept unless it's replaced or removed");
  assert.equal(edited.on_home, true, "switches not sent are kept");
  const noImg = await save(pg, POSTER, { id: a.id, title: "Bake sale moved to Monday", image: null });
  assert.equal(noImg.has_image, false);

  await rpc(pg, POSTER, "msa_post_delete", { p_id: b.id });
  feed = await rpc(pg, OTHER, "msa_feed");
  assert.deepEqual(feed.map((p) => p.title), ["Bake sale moved to Monday"]);
});

test("nobody else can post, edit or delete — signed in or not", async () => {
  const pg = await db();
  const a = await save(pg, POSTER, { title: "Meeting" });
  assert.equal(await rpc(pg, OTHER, "msa_is_poster"), false);
  await assert.rejects(save(pg, OTHER, { title: "Hacked" }), /not an MSA poster/);
  await assert.rejects(save(pg, OTHER, { id: a.id, title: "Hacked" }), /not an MSA poster/);
  await assert.rejects(rpc(pg, OTHER, "msa_post_delete", { p_id: a.id }), /not an MSA poster/);
  await assert.rejects(save(pg, null, { title: "Hacked" }), /permission denied/);
  await assert.rejects(rpc(pg, null, "msa_is_poster"), /permission denied/);
  // The table API is closed in both directions, and the list can't be read or extended.
  for (const uid of [OTHER, null, POSTER]) {
    await assert.rejects(as(pg, uid, `select * from public.msa_posts`), /permission denied/);
    await assert.rejects(as(pg, uid, `insert into public.msa_posts (title) values ('x')`), /permission denied/);
    await assert.rejects(as(pg, uid, `update public.msa_posts set title = 'x'`), /permission denied/);
    await assert.rejects(as(pg, uid, `select * from public.msa_admins`), /permission denied/);
    await assert.rejects(as(pg, uid, `insert into public.msa_admins values (sha256('x'))`), /permission denied/);
    await assert.rejects(rpc(pg, uid, "msa_poster"), /permission denied/);
  }
  const feed = await rpc(pg, null, "msa_feed");
  assert.deepEqual(feed.map((p) => p.title), ["Meeting"]);
});

test("adding a poster in the SQL editor works by email, in any case", async () => {
  const pg = await db();
  assert.equal(await rpc(pg, ADDED, "msa_is_poster"), false);
  await pg.query(`insert into public.msa_admins (email_hash) values (sha256(convert_to(lower('Advisor@Example.org'), 'UTF8')))`);
  assert.equal(await rpc(pg, ADDED, "msa_is_poster"), true);
  assert.equal((await save(pg, ADDED, { title: "From the advisor" })).title, "From the advisor");
});

test("input is checked: title, length, image format and size; expired posts disappear", async () => {
  const pg = await db();
  await assert.rejects(save(pg, POSTER, { title: "   " }), /check/);
  await assert.rejects(save(pg, POSTER, { title: "x".repeat(121) }), /check/);
  await assert.rejects(save(pg, POSTER, { title: "ok", body: "x".repeat(4001) }), /check/);
  await assert.rejects(save(pg, POSTER, { title: "ok", image: "https://evil.example/x.png" }), /check/);
  await assert.rejects(save(pg, POSTER, { title: "ok", image: "data:image/svg+xml;base64,PHN2Zz4=" }), /check/);
  await assert.rejects(save(pg, POSTER, { title: "ok", image: "data:image/jpeg;base64,\"><script>" }), /check/);
  await assert.rejects(save(pg, POSTER, { title: "ok", image: "data:image/jpeg;base64," + "A".repeat(700000) }), /check/);
  await assert.rejects(save(pg, POSTER, { id: "44444444-4444-4444-4444-444444444444", title: "ghost" }), /no such post/);
  const gone = await save(pg, POSTER, { title: "Yesterday's event", image: IMG, expires_at: new Date(Date.now() - 1000).toISOString() });
  await save(pg, POSTER, { title: "Next week", expires_at: new Date(Date.now() + 7 * 864e5).toISOString() });
  const feed = await rpc(pg, null, "msa_feed");
  assert.deepEqual(feed.map((p) => p.title), ["Next week"]);
  assert.equal(await rpc(pg, null, "msa_image", { p_id: gone.id }), null, "an expired post's image is gone too");
});

/* ═══════════ 2.11.6 Membership ═══════════ */
const APPROVER = "44444444-4444-4444-4444-444444444444";
const AMINA = "55555555-5555-5555-5555-555555555555";
const FAKE = "66666666-6666-6666-6666-666666666666";
async function club() {
  const pg = await db();
  // 2.11.8: one admin list — admins post and manage.
  await pg.query(`insert into public.msa_admins (email_hash) values (sha256(convert_to('approver@example.org', 'UTF8')))`);
  await pg.query(`insert into auth.users (id, email) values ($1, 'Approver@example.org'), ($2, 'amina@example.com'), ($3, 'fake@example.com')`, [APPROVER, AMINA, FAKE]);
  await rpc(pg, APPROVER, "msa_roster_set", { p_names: ["Amina Yusuf", "  Omar   Khan ", "Teachers"] });
  return pg;
}
const join = (pg, uid, name, code) => rpc(pg, uid, "msa_join", code === undefined ? { p_name: name } : { p_name: name, p_code: code });
const feedTitles = async (pg, uid) => (await rpc(pg, uid, "msa_feed")).map((p) => p.title);

test("members-only posts reach members, posters and the approver — nobody else", async () => {
  const pg = await club();
  await save(pg, POSTER, { title: "Public bake sale" });
  const secret = await save(pg, POSTER, { title: "Meeting in room 1234", members_only: true, image: IMG });
  assert.equal(secret.members_only, true);
  assert.deepEqual(await feedTitles(pg, null), ["Public bake sale"]);
  assert.deepEqual(await feedTitles(pg, AMINA), ["Public bake sale"]);
  assert.equal(await rpc(pg, AMINA, "msa_image", { p_id: secret.id }), null, "the image is members-only too");
  assert.equal((await feedTitles(pg, POSTER)).length, 2);
  assert.equal((await feedTitles(pg, APPROVER)).length, 2);
  // Amina asks; the approver approves; now she sees it.
  assert.equal((await join(pg, AMINA, "amina  YUSUF")).status, "pending");
  assert.deepEqual(await feedTitles(pg, AMINA), ["Public bake sale"], "waiting isn't membership");
  await rpc(pg, APPROVER, "msa_decide", { p_user: AMINA, p_action: "approve" });
  assert.deepEqual((await feedTitles(pg, AMINA)).sort(), ["Meeting in room 1234", "Public bake sale"]);
  assert.equal(await rpc(pg, AMINA, "msa_image", { p_id: secret.id }), IMG);
  // Membership ends at the end of the school year.
  await pg.query(`update public.msa_members set expires_at = now() - interval '1 second' where user_id = $1`, [AMINA]);
  assert.deepEqual(await feedTitles(pg, AMINA), ["Public bake sale"]);
  assert.equal((await rpc(pg, AMINA, "msa_status")).status, "none");
});

test("the approver sees requests with the roster check; approves, denies and removes; nobody else can", async () => {
  const pg = await club();
  await pg.query(`delete from public.msa_admins where email_hash = sha256(convert_to('poster@example.org', 'UTF8'))`);
  await join(pg, AMINA, "Amina Yusuf");
  await join(pg, FAKE, "Somebody Else");
  const people = await rpc(pg, APPROVER, "msa_people");
  const by = Object.fromEntries(people.map((p) => [p.name, p]));
  assert.equal(by["Amina Yusuf"].on_roster, true);
  assert.equal(by["Somebody Else"].on_roster, false);
  assert.equal(by["Amina Yusuf"].email, "amina@example.com", "the approver sees which account asked");
  assert.deepEqual(await rpc(pg, APPROVER, "msa_roster_get"), ["Amina Yusuf", "Omar Khan", "Teachers"]);
  await rpc(pg, APPROVER, "msa_decide", { p_user: FAKE, p_action: "deny" });
  assert.equal((await rpc(pg, FAKE, "msa_status")).status, "denied");
  await rpc(pg, APPROVER, "msa_decide", { p_user: AMINA, p_action: "approve" });
  const st = await rpc(pg, AMINA, "msa_status");
  assert.equal(st.status, "approved");
  assert.equal(new Date(st.expires_at).getUTCMonth(), 6, "until 1 July");
  await rpc(pg, APPROVER, "msa_decide", { p_user: AMINA, p_action: "remove" });
  assert.equal((await rpc(pg, AMINA, "msa_status")).status, "none");
  // Students never see the roster, the list of people, or the code — and can't decide anything.
  for (const uid of [AMINA, POSTER, FAKE]) {
    for (const fn of ["msa_people", "msa_roster_get", "msa_live_code"]) await assert.rejects(rpc(pg, uid, fn), /not an MSA admin/);
    await assert.rejects(rpc(pg, uid, "msa_decide", { p_user: AMINA, p_action: "approve" }), /not an MSA admin/);
    await assert.rejects(rpc(pg, uid, "msa_roster_set", { p_names: ["Me"] }), /not an MSA admin/);
  }
  for (const fn of ["msa_status", "msa_people", "msa_live_code"]) await assert.rejects(rpc(pg, null, fn), /permission denied/);
  await assert.rejects(join(pg, null, "Amina Yusuf"), /permission denied/);
  for (const t of ["msa_members", "msa_roster", "msa_secret", "msa_approvers", "msa_code_tries"]) {
    await assert.rejects(as(pg, AMINA, `select * from public.${t}`), /permission denied/);
  }
  await assert.rejects(as(pg, AMINA, `insert into public.msa_members (user_id, name, name_key, status, via) values ('${AMINA}', 'x y', 'x y', 'approved', 'code')`), /permission denied/);
});

test("the live meeting code: only the approver sees it, it changes every 10 minutes, and the right one lets you in at once", async () => {
  const pg = await club();
  const live = await rpc(pg, APPROVER, "msa_live_code");
  assert.match(live.code, /^\d{6}$/);
  const left = Date.parse(live.changes_at) - Date.now();
  assert.ok(left > 0 && left <= 600000, "changes within 10 minutes");
  const w = (await pg.query(`select public.msa_window() as w`)).rows[0].w;
  const codes = (await pg.query(`select public.msa_code_for($1) a, public.msa_code_for($2) b, public.msa_code_for($3) c`, [w, Number(w) + 1, Number(w) + 2])).rows[0];
  assert.equal(codes.a, live.code);
  assert.ok(new Set([codes.a, codes.b, codes.c]).size === 3, "a different code each 10 minutes");
  // An old code is refused; the right one approves straight away.
  const old = (await pg.query(`select public.msa_code_for($1) c`, [Number(w) - 5])).rows[0].c;
  const wrong = await join(pg, AMINA, "Amina Yusuf", old === live.code ? "000000" : old);
  assert.equal(wrong.error, "wrong-code");
  assert.equal(wrong.status, "none", "a wrong code changes nothing");
  const r = await join(pg, AMINA, "Amina Yusuf", " " + live.code.slice(0, 3) + " " + live.code.slice(3));
  assert.equal(r.status, "approved");
  const people = await rpc(pg, APPROVER, "msa_people");
  assert.equal(people[0].via, "code");
  // Guessing is stopped after 5 wrong tries.
  for (let i = 0; i < 5; i++) assert.equal((await join(pg, FAKE, "Fake Person", live.code === "111111" ? "222222" : "111111")).error, "wrong-code");
  await assert.rejects(join(pg, FAKE, "Fake Person", live.code), /too many tries/);
});

test("one account per name: a second account asking for a member's name is flagged — even with the right code", async () => {
  const pg = await club();
  const code = (await rpc(pg, APPROVER, "msa_live_code")).code;
  assert.equal((await join(pg, AMINA, "Amina Yusuf", code)).status, "approved");
  assert.equal((await join(pg, FAKE, "AMINA yusuf")).status, "flagged");
  assert.equal((await join(pg, FAKE, "Amina Yusuf", code)).status, "flagged", "the code doesn't get around it");
  assert.deepEqual(await feedTitles(pg, FAKE), []);
  const people = await rpc(pg, APPROVER, "msa_people");
  assert.equal(people[0].status, "flagged", "flagged requests come first");
  // The approver settles it in person: approving the second account needs the first one removed.
  await assert.rejects(rpc(pg, APPROVER, "msa_decide", { p_user: FAKE, p_action: "approve" }), /already belongs to another member/);
  await rpc(pg, APPROVER, "msa_decide", { p_user: AMINA, p_action: "remove" });
  await rpc(pg, APPROVER, "msa_decide", { p_user: FAKE, p_action: "approve" });
  assert.equal((await rpc(pg, FAKE, "msa_status")).status, "approved");
  // The database itself allows only one approved account per name.
  await assert.rejects(pg.query(`insert into public.msa_members (user_id, name, name_key, status, via, expires_at) values ($1, 'Amina Yusuf', 'amina yusuf', 'approved', 'code', now() + interval '1 day')`, [AMINA]), /duplicate key/);
});

test("names are checked: first and last name; a member stays a member; leaving works", async () => {
  const pg = await club();
  await assert.rejects(join(pg, AMINA, "Amina"), /first and last name/);
  await assert.rejects(join(pg, AMINA, "  "), /first and last name/);
  await assert.rejects(join(pg, AMINA, "x".repeat(81) + " y"), /first and last name/);
  const code = (await rpc(pg, APPROVER, "msa_live_code")).code;
  await join(pg, AMINA, "Amina Yusuf", code);
  assert.equal((await join(pg, AMINA, "Someone Else")).name, "Amina Yusuf", "an approved member can't swap names");
  await rpc(pg, AMINA, "msa_leave");
  assert.equal((await rpc(pg, AMINA, "msa_status")).status, "none");
  assert.equal((await rpc(pg, APPROVER, "msa_status")).approver, true);
  assert.equal((await rpc(pg, AMINA, "msa_status")).approver, false);
});

test("the roster and the code secret never appear in the code", () => {
  const block = SQL.slice(SQL.indexOf("2.11.6 — NVHS MSA membership"));
  assert.doesNotMatch(block.replace(/name@example\.org/g, ""), /[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]+/i);
  assert.doesNotMatch(block, /insert into public\.msa_roster \(name_key, name\)\s*values/i, "no names written into the schema");
});

/* ═══════════ 2.11.7 School accounts join automatically ═══════════ */
const S1 = "77777777-7777-7777-7777-777777777777";
const S2 = "88888888-8888-8888-8888-888888888888";
async function school() {
  const pg = await club();
  // Supabase records when an email address was confirmed (signing in with the emailed code does it).
  await pg.exec(`alter table auth.users add column if not exists email_confirmed_at timestamptz`);
  await rpc(pg, APPROVER, "msa_roster_set", { p_names: ["Amina Yusuf", "Omar Khan", "Adam Al Jallad", "Zayd Faiz-balagam", "Sara Ali", "Sara Alibhai"] });
  return pg;
}
async function student(pg, uid, email, confirmed) {
  await pg.query(`insert into auth.users (id, email, email_confirmed_at) values ($1, $2, $3)
    on conflict (id) do update set email = excluded.email, email_confirmed_at = excluded.email_confirmed_at`, [uid, email, confirmed === false ? null : new Date().toISOString()]);
}

test("school emails: first name + 3 letters of the last name, for every shape of name", async () => {
  const pg = await school();
  const keys = async (n) => (await pg.query(`select public.msa_email_keys($1) k`, [n])).rows[0].k.sort();
  assert.deepEqual(await keys("Amina Yusuf"), ["aminayus"]);
  assert.deepEqual(await keys("Adam Al Jallad"), ["adamal", "adamalj", "adamjal"]);
  assert.deepEqual(await keys("Zayd Faiz-balagam"), ["zaydfai"]);
  assert.deepEqual(await keys("Sara Ali"), ["saraali"]);
  assert.deepEqual(await keys("Madonna"), []);
});

test("a confirmed school email on the roster is a member at once, under the roster's name", async () => {
  const pg = await school();
  await save(pg, POSTER, { title: "Meeting in room 1234", members_only: true });
  await student(pg, S1, "aminayus4821@k12.ipsd.org");
  const st = await rpc(pg, S1, "msa_status");
  assert.equal(st.status, "approved");
  assert.equal(st.name, "Amina Yusuf");
  assert.equal(st.school, true);
  assert.deepEqual(await feedTitles(pg, S1), ["Meeting in room 1234"]);
  const people = await rpc(pg, APPROVER, "msa_people");
  assert.equal(people.find((p) => p.user_id === S1).via, "school");
  // Odd names work too.
  await student(pg, S2, "ADAMJAL0007@K12.IPSD.ORG");
  assert.equal((await rpc(pg, S2, "msa_status")).name, "Adam Al Jallad");
  // The approver sees who has joined from the roster.
  const roster = await rpc(pg, APPROVER, "msa_roster_status");
  assert.equal(roster.find((r) => r.name === "Amina Yusuf").via, "school");
  assert.equal(roster.find((r) => r.name === "Omar Khan").user_id, null);
});

test("no automatic membership without proof: unconfirmed, other domains, not on the roster, or two possible names", async () => {
  const pg = await school();
  const status = async (email, confirmed) => { await student(pg, S1, email, confirmed); return (await rpc(pg, S1, "msa_status")).status; };
  assert.equal(await status("aminayus4821@k12.ipsd.org", false), "none", "an address nobody has confirmed proves nothing");
  assert.equal(await status("aminayus4821@gmail.com"), "none");
  assert.equal(await status("aminayus4821@k12.ipsd.org.evil.com"), "none");
  assert.equal(await status("someonenew1234@k12.ipsd.org"), "none", "not on the roster");
  assert.equal(await status("saraali1234@k12.ipsd.org"), "none", "fits Sara Ali and Sara Alibhai: the approver decides");
  assert.equal((await rpc(pg, S1, "msa_status")).school, true);
});

test("the school account owns its name: someone who claimed it first is flagged", async () => {
  const pg = await school();
  const code = (await rpc(pg, APPROVER, "msa_live_code")).code;
  assert.equal((await join(pg, FAKE, "Amina Yusuf", code)).status, "approved");
  await student(pg, S1, "aminayus4821@k12.ipsd.org");
  assert.equal((await rpc(pg, S1, "msa_status")).status, "approved");
  assert.equal((await rpc(pg, FAKE, "msa_status")).status, "flagged");
  // Expired members re-join by themselves next year.
  await pg.query(`update public.msa_members set expires_at = now() - interval '1 second' where user_id = $1`, [S1]);
  assert.equal((await rpc(pg, S1, "msa_status")).status, "approved");
  await assert.rejects(rpc(pg, S1, "msa_roster_status"), /not an MSA admin/);
});

/* ═══════════ 2.11.8 One admin list, managed in the app ═══════════ */
const OWNER_A = "99999999-9999-9999-9999-999999999991";
const OWNER_B = "99999999-9999-9999-9999-999999999992";
const NEWBIE = "99999999-9999-9999-9999-999999999993";
// The owners' addresses are the only ones the app's admin list starts with.
// (The schema stores only their hashes; the test knows the addresses.)
const OWNERS = ["ibrahimahm6675@k12.ipsd.org", "ibrahim.asim.contact@gmail.com"];

test("only the two owners are admins after upgrading; posters from 2.11.7 lose access once, and re-running keeps admins added later", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite();
  await pg.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text, phone text, raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create publication supabase_realtime;
    grant usage on schema public, auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
  `);
  // A 2.11.7 database: the old poster list (here, one old exec account).
  const v317 = SQL.slice(0, SQL.indexOf("--  2.11.8 — One list of MSA admins"));
  await pg.exec(v317);
  await pg.query(`insert into public.msa_admins (email_hash) values (sha256(convert_to('old.exec@example.org', 'UTF8')))`);
  await pg.exec(SQL);
  const hashes = (await pg.query(`select encode(email_hash, 'hex') h, owner from public.msa_admins order by 1`)).rows;
  assert.equal(hashes.length, 2);
  assert.ok(hashes.every((r) => r.owner));
  const want = OWNERS.map((e) => require("crypto").createHash("sha256").update(e).digest("hex")).sort();
  assert.deepEqual(hashes.map((r) => r.h), want);
  // An admin added afterwards survives running the file again.
  await pg.query(`insert into public.msa_admins (email_hash) values (sha256(convert_to('new.exec@example.org', 'UTF8')))`);
  await pg.exec(SQL);
  assert.equal((await pg.query(`select count(*)::int n from public.msa_admins`)).rows[0].n, 3);
});

test("admins post and manage; they add and remove admins in the app, but never an owner or themselves", async () => {
  const pg = await db();
  await pg.query(`insert into auth.users (id, email) values ($1, $2), ($3, $4), ($5, 'newbie@example.org')`, [OWNER_A, OWNERS[0].toUpperCase(), OWNER_B, OWNERS[1], NEWBIE]);
  const st = await rpc(pg, OWNER_A, "msa_status");
  assert.equal(st.admin, true);
  assert.equal(st.poster, true);
  assert.equal(st.approver, true);
  assert.equal((await save(pg, OWNER_A, { title: "From an owner" })).title, "From an owner");
  // The admin list shows what's known: an owner's email once they've signed in.
  let list = await rpc(pg, OWNER_A, "msa_admin_list");
  assert.equal(list.find((a) => a.me).email, OWNERS[0]);
  assert.equal(list.filter((a) => a.owner).length, 2);
  assert.equal(list.find((a) => a.owner && !a.me).email, null, "the other owner hasn't signed in yet");
  // Not an admin yet: can't post or manage.
  await assert.rejects(save(pg, NEWBIE, { title: "Hi" }), /not an MSA poster/);
  await assert.rejects(rpc(pg, NEWBIE, "msa_admin_add", { p_email: "x@example.org" }), /not an MSA admin/);
  // Added by an owner (any case, spaces trimmed): can do everything.
  list = await rpc(pg, OWNER_A, "msa_admin_add", { p_email: "  NewBie@Example.org " });
  const added = list.find((a) => a.email === "newbie@example.org");
  assert.equal(added.added_by, OWNERS[0]);
  assert.equal((await save(pg, NEWBIE, { title: "Hello from the new admin" })).title, "Hello from the new admin");
  assert.equal((await rpc(pg, NEWBIE, "msa_status")).approver, true);
  await rpc(pg, NEWBIE, "msa_people");
  // Owners and yourself can't be removed; bad addresses are refused.
  const ownerB = list.find((a) => a.owner && !a.me);
  await assert.rejects(rpc(pg, NEWBIE, "msa_admin_remove", { p_id: ownerB.id }), /owners can't be removed/);
  await assert.rejects(rpc(pg, NEWBIE, "msa_admin_remove", { p_id: added.id }), /can't remove yourself/);
  await assert.rejects(rpc(pg, OWNER_A, "msa_admin_add", { p_email: "not an email" }), /isn't an email address/);
  // An owner removes the new admin: access ends at once.
  list = await rpc(pg, OWNER_A, "msa_admin_remove", { p_id: added.id });
  assert.equal(list.some((a) => a.email === "newbie@example.org"), false);
  await assert.rejects(save(pg, NEWBIE, { title: "Still here?" }), /not an MSA poster/);
  // Signed out or a student: no way in.
  await assert.rejects(rpc(pg, null, "msa_admin_list"), /permission denied/);
  await assert.rejects(as(pg, NEWBIE, `select * from public.msa_meta`), /permission denied/);
});

test("admins add students one by one; with an email, that account is a member at once — or when it first signs in", async () => {
  const pg = await club();
  await pg.exec(`alter table auth.users add column if not exists email_confirmed_at timestamptz`);
  await save(pg, POSTER, { title: "Members meeting", members_only: true });
  // Amina already has an account: she's in straight away.
  const r = await rpc(pg, APPROVER, "msa_student_add", { p_name: "  Amina   Yusuf ", p_email: "Amina@Example.com" });
  assert.deepEqual(r, { name: "Amina Yusuf", email: "amina@example.com", joined: true });
  assert.equal((await rpc(pg, AMINA, "msa_status")).status, "approved");
  assert.deepEqual(await feedTitles(pg, AMINA), ["Members meeting"]);
  // Yusuf hasn't signed up yet: he joins when his (confirmed) account first opens the MSA page.
  assert.equal((await rpc(pg, APPROVER, "msa_student_add", { p_name: "Yusuf Ahmed", p_email: "yusuf@gmail.com" })).joined, false);
  await student(pg, S1, "yusuf@gmail.com", false);
  assert.equal((await rpc(pg, S1, "msa_status")).status, "none", "an unconfirmed address proves nothing");
  await student(pg, S1, "yusuf@gmail.com");
  const st = await rpc(pg, S1, "msa_status");
  assert.equal(st.status, "approved");
  assert.equal(st.name, "Yusuf Ahmed");
  // A name alone goes on the list; editing the whole list keeps the emails.
  await rpc(pg, APPROVER, "msa_student_add", { p_name: "Bilal Khan" });
  await rpc(pg, APPROVER, "msa_roster_set", { p_names: ["Amina Yusuf", "Yusuf Ahmed", "Bilal Khan", "Omar Khan"] });
  const roster = await rpc(pg, APPROVER, "msa_roster_status");
  assert.equal(roster.find((x) => x.name === "Yusuf Ahmed").invite, "yusuf@gmail.com");
  assert.equal(roster.find((x) => x.name === "Bilal Khan").user_id, null);
  // Removing a student takes them off the list and ends their membership.
  await rpc(pg, APPROVER, "msa_student_remove", { p_name: "yusuf ahmed" });
  assert.equal((await rpc(pg, APPROVER, "msa_roster_status")).some((x) => x.name === "Yusuf Ahmed"), false);
  assert.equal((await rpc(pg, S1, "msa_status")).status, "none");
  // Students can't add anyone.
  await assert.rejects(rpc(pg, AMINA, "msa_student_add", { p_name: "Fake Friend" }), /not an MSA admin/);
  await assert.rejects(rpc(pg, APPROVER, "msa_student_add", { p_name: "Madonna" }), /first and last name/);
});

test("approve everyone waiting who is on the list, in one go — never a taken name", async () => {
  const pg = await club();
  await join(pg, AMINA, "Amina Yusuf");
  await join(pg, FAKE, "Somebody Else");
  await pg.query(`insert into auth.users (id, email) values ($1, 'omar@example.com'), ($2, 'omar2@example.com')`, [S1, S2]);
  await join(pg, S1, "Omar Khan");
  const code = (await rpc(pg, APPROVER, "msa_live_code")).code;
  await join(pg, S2, "Omar Khan", code); // S2 holds the name first
  assert.equal(await rpc(pg, APPROVER, "msa_approve_listed"), 1, "only Amina: Omar's name is taken, Somebody isn't on the list");
  assert.equal((await rpc(pg, AMINA, "msa_status")).status, "approved");
  assert.equal((await rpc(pg, FAKE, "msa_status")).status, "pending");
  assert.notEqual((await rpc(pg, S1, "msa_status")).status, "approved");
  await assert.rejects(rpc(pg, AMINA, "msa_approve_listed"), /not an MSA admin/);
});
