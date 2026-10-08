/* 3.0 Family & Kids Mode: backend/supabase-schema.sql in a real Postgres
   (PGlite), with Supabase's auth bits stubbed as in schema.test.js.
   Covers who can reach what: parents only their own children; a child's
   device only that one child; restrictions enforced by the database.
   Run: node --test tests/family.test.js */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const SQL = fs.readFileSync(path.join(__dirname, "..", "backend", "supabase-schema.sql"), "utf8");
const P1 = "11111111-1111-1111-1111-111111111111";
const P2 = "22222222-2222-2222-2222-222222222222";

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
  // Supabase grants table privileges to these roles by default; RLS is what protects rows.
  await pg.exec(`grant select, insert, update, delete on all tables in schema public to authenticated, anon;`);
  await pg.query(`insert into auth.users (id) values ($1), ($2)`, [P1, P2]);
  return pg;
}
/** Run as a signed-in user (uid) or as an anonymous device (uid = null). */
async function as(pg, uid, sql, params) {
  await pg.exec(`set role ${uid ? "authenticated" : "anon"}; select set_config('request.jwt.claim.sub', '${uid || ""}', false);`);
  try { return await pg.query(sql, params); } finally { await pg.exec("reset role;"); }
}
async function rpc(pg, uid, fn, args) {
  const names = Object.keys(args || {});
  const call = `select public.${fn}(${names.map((n, i) => `${n} => $${i + 1}`).join(", ")}) as r`;
  const r = await as(pg, uid, call, names.map((n) => args[n]));
  return r.rows[0].r;
}
const addChild = (pg, uid, child) => rpc(pg, uid, "family_child_save", { p_child: JSON.stringify(child) });

test("a parent creates, lists, edits and removes their children", async () => {
  const pg = await db();
  const a = await addChild(pg, P1, { name: "  Ahmed ", age_range: "7-9", avatar: "moon" });
  const m = await addChild(pg, P1, { name: "Maryam", age_range: "4-6", sections: ["quran", "duas", "duas"] });
  assert.equal(a.name, "Ahmed");
  assert.deepEqual(m.sections.sort(), ["duas", "quran"]);
  assert.equal(a.parent_id, undefined, "the parent's id is never sent back");
  let list = await rpc(pg, P1, "family_children_list");
  assert.deepEqual(list.map((c) => c.name), ["Ahmed", "Maryam"]);
  assert.equal(list[0].done, 0);
  const edited = await addChild(pg, P1, { id: a.id, name: "Ahmad", sections: ["prayer"], show_progress: false });
  assert.equal(edited.name, "Ahmad");
  assert.deepEqual(edited.sections, ["prayer"]);
  assert.equal(edited.show_progress, false);
  assert.equal(edited.age_range, "7-9", "fields not sent are kept");
  await rpc(pg, P1, "family_child_delete", { p_child: m.id });
  list = await rpc(pg, P1, "family_children_list");
  assert.deepEqual(list.map((c) => c.name), ["Ahmad"]);
});

test("input is validated: name, age range, avatar, sections, family size", async () => {
  const pg = await db();
  await assert.rejects(addChild(pg, P1, { name: "" }));
  await assert.rejects(addChild(pg, P1, { name: "x".repeat(25) }));
  await assert.rejects(addChild(pg, P1, { name: "A", age_range: "13-17" }));
  await assert.rejects(addChild(pg, P1, { name: "A", avatar: "<script>" }));
  await assert.rejects(addChild(pg, P1, { name: "A", sections: ["community"] }), /check/);
  await assert.rejects(addChild(pg, P1, { name: "A", sections: "quran" }), /array/);
  for (let i = 0; i < 10; i++) await addChild(pg, P1, { name: "Kid " + i });
  await assert.rejects(addChild(pg, P1, { name: "Eleven" }), /at most 10/);
});

test("one parent can never see or change another parent's children", async () => {
  const pg = await db();
  const a = await addChild(pg, P1, { name: "Ahmed" });
  assert.deepEqual(await rpc(pg, P2, "family_children_list"), []);
  await assert.rejects(rpc(pg, P2, "family_child_detail", { p_child: a.id }), /child not found/);
  await assert.rejects(addChild(pg, P2, { id: a.id, name: "Stolen" }), /child not found/);
  await assert.rejects(rpc(pg, P2, "family_child_delete", { p_child: a.id }), /child not found/);
  await assert.rejects(rpc(pg, P2, "family_pair_code", { p_child: a.id }), /child not found/);
  await assert.rejects(rpc(pg, P2, "family_device_token", { p_child: a.id }), /child not found/);
  await assert.rejects(rpc(pg, P2, "family_child_reset", { p_child: a.id }), /child not found/);
  // Direct table access: reads are limited to your own rows, writes are refused.
  assert.equal((await as(pg, P2, `select * from public.family_children`)).rows.length, 0);
  assert.equal((await as(pg, P1, `select * from public.family_children`)).rows.length, 1);
  await assert.rejects(as(pg, P2, `insert into public.family_children (parent_id, name) values ($1, 'x')`, [P1]));
  await assert.rejects(as(pg, P1, `insert into public.family_children (name) values ('x')`));
  const upd = await as(pg, P2, `update public.family_children set name = 'hacked'`);
  assert.equal(upd.affectedRows || 0, 0);
  assert.equal((await as(pg, P1, `select name from public.family_children`)).rows[0].name, "Ahmed");
  await assert.rejects(as(pg, P1, `insert into public.child_progress (child_id, item) values ($1, 'duas:x')`, [a.id]));
  await assert.rejects(as(pg, P1, `insert into public.child_achievements (child_id, code) values ($1, 'first_dua')`, [a.id]));
  // Device tokens and pairing codes are unreadable even to the parent.
  await rpc(pg, P1, "family_device_token", { p_child: a.id });
  assert.equal((await as(pg, P1, `select * from public.child_devices`)).rows.length, 0);
  // Nothing for an anonymous caller.
  await assert.rejects(rpc(pg, null, "family_children_list"));
  assert.equal((await as(pg, null, `select * from public.family_children`)).rows.length, 0);
});

test("a child's device sees only that child, never the parent or a sibling", async () => {
  const pg = await db();
  const a = await addChild(pg, P1, { name: "Ahmed" });
  const m = await addChild(pg, P1, { name: "Maryam" });
  const ta = (await rpc(pg, P1, "family_device_token", { p_child: a.id, p_label: "Family iPad" })).token;
  const tm = (await rpc(pg, P1, "family_device_token", { p_child: m.id })).token;
  assert.match(ta, /^kid_[0-9a-f]{64}$/);
  assert.notEqual(ta, tm);

  const s = await rpc(pg, null, "kid_session", { p_token: ta });
  assert.equal(s.name, "Ahmed");
  assert.equal(s.parent_id, undefined);
  await rpc(pg, null, "kid_save", { p_token: ta, p_items: JSON.stringify([{ item: "duas:before-eating" }, { item: "quiz:prayer", score: 80 }]) });
  await rpc(pg, null, "kid_save", { p_token: tm, p_items: JSON.stringify([{ item: "quran:112" }]) });
  const pa = await rpc(pg, null, "kid_progress", { p_token: ta });
  const pm = await rpc(pg, null, "kid_progress", { p_token: tm });
  assert.deepEqual(pa.progress.map((p) => p.item).sort(), ["duas:before-eating", "quiz:prayer"]);
  assert.deepEqual(pm.progress.map((p) => p.item), ["quran:112"]);
  assert.deepEqual(pm.achievements.map((x) => x.code), ["first_surah"]);

  // A device token can't be used for anything else.
  await assert.rejects(rpc(pg, null, "family_children_list"));
  await assert.rejects(rpc(pg, null, "family_child_detail", { p_child: m.id }));
  await assert.rejects(rpc(pg, null, "family_child_save", { p_child: JSON.stringify({ id: a.id, sections: ["prayer", "quran", "duas", "stories", "learn", "quiz"] }) }));
  await assert.rejects(as(pg, null, `select public.family_award($1)`, [a.id]), /permission denied/);
  await assert.rejects(as(pg, null, `select public.kid_child($1)`, [ta]), /permission denied/);
  assert.equal((await as(pg, null, `select * from public.child_progress`)).rows.length, 0);
  // Made-up or revoked tokens are refused.
  await assert.rejects(rpc(pg, null, "kid_session", { p_token: "kid_" + "0".repeat(64) }), /invalid or revoked/);
  await assert.rejects(rpc(pg, null, "kid_session", { p_token: null }), /invalid or revoked/);
  const devs = (await rpc(pg, P1, "family_child_detail", { p_child: a.id })).devices;
  assert.equal(devs.length, 1);
  assert.equal(devs[0].label, "Family iPad");
  assert.equal(devs[0].token_hash, undefined);
  await assert.rejects(rpc(pg, P2, "family_device_revoke", { p_device: devs[0].id }), /device not found/);
  await rpc(pg, P1, "family_device_revoke", { p_device: devs[0].id });
  await assert.rejects(rpc(pg, null, "kid_progress", { p_token: ta }), /invalid or revoked/);
  // The child can also forget their own device.
  await rpc(pg, null, "kid_unpair", { p_token: tm });
  await assert.rejects(rpc(pg, null, "kid_session", { p_token: tm }), /invalid or revoked/);
});

test("pairing codes work once, only for 15 minutes, and only the newest one", async () => {
  const pg = await db();
  const a = await addChild(pg, P1, { name: "Ahmed" });
  const first = await rpc(pg, P1, "family_pair_code", { p_child: a.id });
  const pc = await rpc(pg, P1, "family_pair_code", { p_child: a.id });
  assert.match(pc.code, /^[A-HJ-NP-Z2-9]{8}$/);
  assert.ok(new Date(pc.expires_at) - Date.now() <= 15 * 60000 + 5000);
  await assert.rejects(rpc(pg, null, "kid_pair", { p_code: first.code }), /invalid or expired/, "a new code replaces the old one");
  await assert.rejects(rpc(pg, null, "kid_pair", { p_code: "AAAAAAAA" }), /invalid or expired/);
  const typed = pc.code.toLowerCase().slice(0, 4) + "-" + pc.code.slice(4);
  const res = await rpc(pg, null, "kid_pair", { p_code: typed, p_label: "Ahmed's tablet" });
  assert.equal(res.child.name, "Ahmed");
  assert.match(res.token, /^kid_/);
  await assert.rejects(rpc(pg, null, "kid_pair", { p_code: pc.code }), /invalid or expired/, "single use");
  // Expired codes are refused.
  const old = await rpc(pg, P1, "family_pair_code", { p_child: a.id });
  await pg.exec(`update public.child_pair_codes set expires_at = now() - interval '1 minute'`);
  await assert.rejects(rpc(pg, null, "kid_pair", { p_code: old.code }), /invalid or expired/);
  // Nobody can read the codes table.
  await rpc(pg, P1, "family_pair_code", { p_child: a.id });
  assert.equal((await as(pg, P1, `select * from public.child_pair_codes`)).rows.length, 0);
  assert.equal((await as(pg, null, `select * from public.child_pair_codes`)).rows.length, 0);
});

test("parental restrictions are enforced by the database", async () => {
  const pg = await db();
  const a = await addChild(pg, P1, { name: "Ahmed", sections: ["duas", "quiz"] });
  const tok = (await rpc(pg, P1, "family_device_token", { p_child: a.id })).token;
  const r = await rpc(pg, null, "kid_save", { p_token: tok, p_items: JSON.stringify([{ item: "duas:after-eating" }, { item: "stories:yunus" }, { item: "quran:1" }]) });
  assert.deepEqual(r.rejected, ["stories:yunus", "quran:1"]);
  assert.deepEqual(r.progress.map((p) => p.item), ["duas:after-eating"]);
  // The parent turns a section off: new progress there is refused from then on.
  await addChild(pg, P1, { id: a.id, sections: ["quiz"] });
  const r2 = await rpc(pg, null, "kid_save", { p_token: tok, p_items: JSON.stringify([{ item: "duas:leaving-home" }]) });
  assert.deepEqual(r2.rejected, ["duas:leaving-home"]);
  assert.deepEqual((await rpc(pg, null, "kid_session", { p_token: tok })).sections, ["quiz"]);
  // Malformed items and oversized batches are refused.
  await assert.rejects(rpc(pg, null, "kid_save", { p_token: tok, p_items: JSON.stringify([{ item: "quiz:<b>" }]) }));
  await assert.rejects(rpc(pg, null, "kid_save", { p_token: tok, p_items: JSON.stringify([{ item: "quiz:a", status: "hacked" }]) }));
  await assert.rejects(rpc(pg, null, "kid_save", { p_token: tok, p_items: JSON.stringify([{ item: "quiz:a", score: 101 }]) }));
  const many = Array.from({ length: 51 }, (_, i) => ({ item: "quiz:q" + i }));
  await assert.rejects(rpc(pg, null, "kid_save", { p_token: tok, p_items: JSON.stringify(many) }), /at most 50/);
});

test("progress is never downgraded, quizzes keep the best score, repeats are harmless", async () => {
  const pg = await db();
  const a = await addChild(pg, P1, { name: "Ahmed" });
  const tok = (await rpc(pg, P1, "family_device_token", { p_child: a.id })).token;
  const save = (items) => rpc(pg, null, "kid_save", { p_token: tok, p_items: JSON.stringify(items) });
  await save([{ item: "quran:112", status: "started" }]);
  await save([{ item: "quran:112", status: "done" }]);
  await save([{ item: "quran:112", status: "started" }]);
  await save([{ item: "quiz:wudu", score: 60 }]);
  await save([{ item: "quiz:wudu", score: 40 }]);
  const r = await save([{ item: "quiz:wudu", score: 40 }]); // a duplicate request
  const by = Object.fromEntries(r.progress.map((p) => [p.item, p]));
  assert.equal(by["quran:112"].status, "done");
  assert.equal(by["quiz:wudu"].score, 60);
  assert.equal(r.progress.length, 2);
});

test("achievements come from saved progress only", async () => {
  const pg = await db();
  const a = await addChild(pg, P1, { name: "Ahmed" });
  const tok = (await rpc(pg, P1, "family_device_token", { p_child: a.id })).token;
  const save = (items) => rpc(pg, null, "kid_save", { p_token: tok, p_items: JSON.stringify(items.map((item) => ({ item }))) });
  let r = await save(["prayer:names", "prayer:rakahs"]);
  assert.deepEqual(r.achievements, []);
  r = await save(["prayer:steps", "prayer:wudu", "duas:before-eating", "stories:yunus", "quiz:prayer"]);
  assert.deepEqual(r.achievements.map((x) => x.code).sort(),
    ["first_dua", "first_quiz", "first_story", "five_lessons", "prayer_basics", "wudu_basics"]);
  const detail = await rpc(pg, P1, "family_child_detail", { p_child: a.id });
  assert.equal(detail.achievements.length, 6);
  assert.equal(detail.progress.length, 7);
  const list = await rpc(pg, P1, "family_children_list");
  assert.equal(list[0].done, 7);
  assert.equal(list[0].achievements, 6);
  // Start over.
  await rpc(pg, P1, "family_child_reset", { p_child: a.id });
  const after = await rpc(pg, null, "kid_progress", { p_token: tok });
  assert.deepEqual([after.progress, after.achievements], [[], []]);
});

test("removing a child or the parent's account deletes all of the child's data", async () => {
  const pg = await db();
  const a = await addChild(pg, P1, { name: "Ahmed" });
  const b = await addChild(pg, P1, { name: "Maryam" });
  const ta = (await rpc(pg, P1, "family_device_token", { p_child: a.id })).token;
  await rpc(pg, null, "kid_save", { p_token: ta, p_items: JSON.stringify([{ item: "duas:x" }]) });
  await rpc(pg, P1, "family_pair_code", { p_child: a.id });
  await rpc(pg, P1, "family_child_delete", { p_child: a.id });
  for (const t of ["child_progress", "child_achievements", "child_devices", "child_pair_codes"]) {
    assert.equal((await pg.query(`select count(*)::int n from public.${t} where child_id = $1`, [a.id])).rows[0].n, 0, t);
  }
  await assert.rejects(rpc(pg, null, "kid_session", { p_token: ta }), /invalid or revoked/);
  await as(pg, P1, `select public.delete_account()`);
  assert.equal((await pg.query(`select count(*)::int n from public.family_children where id = $1`, [b.id])).rows[0].n, 0);
});
