/* Runs backend/supabase-schema.sql in a real Postgres (PGlite) with the bits
   of Supabase it relies on stubbed: the auth schema/users table, auth.uid()
   (read from a session setting, like Supabase's JWT claim), the
   authenticated/anon roles, and the supabase_realtime publication.
   Run: node --test tests/schema.test.js */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const SQL = fs.readFileSync(path.join(__dirname, "..", "backend", "supabase-schema.sql"), "utf8");
const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";

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
  await pg.exec(`grant select, insert, update, delete on all tables in schema public to authenticated;`);
  return pg;
}
/** Run statements as a signed-in user (RLS applies). */
async function as(pg, uid, sql, params) {
  await pg.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid || ""}', false);`);
  try { return await pg.query(sql, params); } finally { await pg.exec("reset role;"); }
}

test("schema applies cleanly and is re-runnable", async () => {
  const pg = await db();
  await pg.exec(SQL); // second run must not fail
  const r = await pg.query(`select tablename from pg_publication_tables where pubname = 'supabase_realtime'`);
  assert.deepEqual(r.rows.map((x) => x.tablename), ["sync_records"]);
});

test("sign-up creates a profile from provider metadata", async () => {
  const pg = await db();
  await pg.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'amina@example.com', '{"full_name":"Amina Y"}')`, [A]);
  await pg.query(`insert into auth.users (id, phone) values ($1, '15551234567')`, [B]);
  const r = await pg.query(`select id, display_name from public.profiles order by id`);
  assert.equal(r.rows[0].display_name, "Amina Y");
  assert.equal(r.rows[1].display_name, null); // phone-only: no name yet
});

test("sync_push: newest write wins and refused rows are returned", async () => {
  const pg = await db();
  await pg.query(`insert into auth.users (id, email) values ($1, 'a@x.io')`, [A]);
  const push = (items) => as(pg, A, `select col, key, value, t, deleted from public.sync_push($1::jsonb)`, [JSON.stringify(items)]);
  let r = await push([{ col: "bm", key: "2:255", value: { at: 5 }, t: 100 }, { col: "pref", key: "theme", value: "dark", t: 100 }]);
  assert.equal(r.rows.length, 0);
  r = await push([{ col: "pref", key: "theme", value: "light", t: 50 }]); // older → refused
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].value, "dark");
  r = await push([{ col: "pref", key: "theme", value: "light", t: 200 }, { col: "bm", key: "2:255", value: null, t: 300, deleted: true }]);
  assert.equal(r.rows.length, 0);
  const all = await as(pg, A, `select col, key, value, deleted, server_at from public.sync_records order by col`);
  assert.deepEqual(all.rows.map((x) => [x.col, x.key, x.value, x.deleted]), [["bm", "2:255", null, true], ["pref", "theme", "light", false]]);
  assert.ok(all.rows.every((x) => x.server_at instanceof Date));
});

test("row-level security: people only ever see and write their own rows", async () => {
  const pg = await db();
  await pg.query(`insert into auth.users (id) values ($1), ($2)`, [A, B]);
  await as(pg, A, `select * from public.sync_push('[{"col":"bm","key":"1:1","value":{"at":1},"t":1}]'::jsonb)`);
  const seenByB = await as(pg, B, `select * from public.sync_records`);
  assert.equal(seenByB.rows.length, 0);
  await assert.rejects(as(pg, B, `insert into public.sync_records (user_id, col, key, value, t) values ($1, 'bm', 'x', '1', 1)`, [A]));
  const upd = await as(pg, B, `update public.sync_records set value = '"hacked"' where user_id = $1`, [A]);
  assert.equal(upd.affectedRows || 0, 0);
  const prof = await as(pg, B, `select * from public.profiles`);
  assert.ok(prof.rows.every((p) => p.id === B));
  await assert.rejects(as(pg, null, `select * from public.sync_push('[]'::jsonb)`), /not signed in/);
});

test("server stamps the change cursor (clients can't spoof it)", async () => {
  const pg = await db();
  await pg.query(`insert into auth.users (id) values ($1)`, [A]);
  await as(pg, A, `insert into public.sync_records (col, key, value, t, server_at) values ('v', 'learn:best', '3', 1, '2000-01-01')`);
  const r = await as(pg, A, `select server_at from public.sync_records`);
  assert.ok(r.rows[0].server_at.getFullYear() > 2020);
});

test("delete_account removes the user and cascades their data", async () => {
  const pg = await db();
  await pg.query(`insert into auth.users (id) values ($1), ($2)`, [A, B]);
  await as(pg, A, `select * from public.sync_push('[{"col":"bm","key":"1:1","value":{"at":1},"t":1}]'::jsonb)`);
  await as(pg, B, `select * from public.sync_push('[{"col":"bm","key":"9:9","value":{"at":1},"t":1}]'::jsonb)`);
  await as(pg, A, `select public.delete_account()`);
  const users = await pg.query(`select id from auth.users`);
  assert.deepEqual(users.rows.map((u) => u.id), [B]);
  const recs = await pg.query(`select user_id from public.sync_records`);
  assert.deepEqual(recs.rows.map((u) => u.user_id), [B]);
  const profs = await pg.query(`select id from public.profiles`);
  assert.deepEqual(profs.rows.map((u) => u.id), [B]);
});

test("oversized and malformed pushes are rejected", async () => {
  const pg = await db();
  await pg.query(`insert into auth.users (id) values ($1)`, [A]);
  const many = Array.from({ length: 1001 }, (_, i) => ({ col: "bm", key: "k" + i, value: 1, t: 1 }));
  await assert.rejects(as(pg, A, `select * from public.sync_push($1::jsonb)`, [JSON.stringify(many)]), /at most 1000/);
  await assert.rejects(as(pg, A, `select * from public.sync_push('{"a":1}'::jsonb)`), /array/);
});

/* 2.8 — reminders when the app is closed */
async function asAnon(pg, sql, params) {
  await pg.exec(`set role anon; select set_config('request.jwt.claim.sub', '', false);`);
  try { return await pg.query(sql, params); } finally { await pg.exec("reset role;"); }
}
const SUB = { endpoint: "https://push.example.com/abc", keys: { p256dh: "BPk", auth: "au" } };

test("push reminders: guests register and remove their own device; nobody can read the table", async () => {
  const pg = await db();
  const prefs = { lat: 41.8781, lng: -87.6298, tz: "America/Chicago", method: 2, school: 1, offset: 10, adhkar: true, lang: "ar" };
  await asAnon(pg, `select public.push_register($1::jsonb, $2::jsonb)`, [JSON.stringify(SUB), JSON.stringify(prefs)]);
  let rows = (await pg.query(`select * from public.push_subscriptions`)).rows;
  assert.equal(rows.length, 1);
  assert.equal(String(rows[0].lat), "41.88", "location kept to ~1 km");
  assert.equal(String(rows[0].lng), "-87.63");
  assert.equal(rows[0].offset_min, 10);
  assert.equal(rows[0].lang, "ar");
  // Re-registering updates the same row.
  await asAnon(pg, `select public.push_register($1::jsonb, $2::jsonb)`, [JSON.stringify(SUB), JSON.stringify({ ...prefs, method: 3 })]);
  rows = (await pg.query(`select method from public.push_subscriptions`)).rows;
  assert.deepEqual(rows.map((r) => r.method), [3]);
  // The API can't list or change anyone's subscriptions directly.
  await assert.rejects(asAnon(pg, `select * from public.push_subscriptions`), /permission denied/);
  await assert.rejects(asAnon(pg, `delete from public.push_subscriptions`), /permission denied/);
  // Bad input is refused.
  await assert.rejects(asAnon(pg, `select public.push_register($1::jsonb, $2::jsonb)`,
    [JSON.stringify({ ...SUB, endpoint: "http://insecure" }), JSON.stringify(prefs)]));
  await assert.rejects(asAnon(pg, `select public.push_register($1::jsonb, $2::jsonb)`,
    [JSON.stringify({ ...SUB, endpoint: "https://x/2" }), JSON.stringify({ ...prefs, lat: 123 })]));
  // Turning reminders off deletes the row.
  await asAnon(pg, `select public.push_unregister($1)`, [SUB.endpoint]);
  rows = (await pg.query(`select * from public.push_subscriptions`)).rows;
  assert.equal(rows.length, 0);
});
