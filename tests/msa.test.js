/* 3.1 NVHS MSA announcements: backend/supabase-schema.sql in a real Postgres
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
  const block = SQL.slice(SQL.indexOf("3.1 — NVHS MSA"));
  assert.doesNotMatch(block.replace(/name@example\.org/g, ""), /[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]+/i);
  const pg = await db();
  const r = await pg.query(`select count(*)::int as n from public.msa_admins`);
  assert.equal(r.rows[0].n, 5, "the MSA's four accounts, plus the test's own poster");
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
