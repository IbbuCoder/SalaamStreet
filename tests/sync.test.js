/* Sync engine tests: two (or three) simulated devices against an in-memory
   server that mirrors backend/supabase-schema.sql (sync_records + sync_push).
   Run: node --test tests/ */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { SyncEngine, MERGE } = require("../js/sync.js");

/* ── In-memory server with the same rules as public.sync_push ── */
function makeServer() {
  const rows = new Map(); // `${uid}|${col}|${key}` → row
  let clock = Date.parse("2026-10-04T00:00:00Z");
  const tick = () => new Date((clock += 1000)).toISOString();
  return {
    rows,
    online: true,
    backendFor(uid) {
      const srv = this;
      return {
        pull(since) {
          if (!srv.online) return Promise.reject(Object.assign(new Error("offline"), { offline: true }));
          const out = [...rows.values()].filter((r) => r.uid === uid && (!since || r.server_at > since))
            .sort((a, b) => (a.server_at < b.server_at ? -1 : 1));
          return Promise.resolve(JSON.parse(JSON.stringify(out)));
        },
        push(items) {
          if (!srv.online) return Promise.reject(Object.assign(new Error("offline"), { offline: true }));
          const rejected = [];
          for (const it of items) {
            const k = `${uid}|${it.col}|${it.key}`;
            const cur = rows.get(k);
            if (!cur || it.t >= cur.t) {
              rows.set(k, { uid, col: it.col, key: it.key, value: it.value, t: it.t, deleted: !!it.deleted, server_at: tick() });
            } else rejected.push(JSON.parse(JSON.stringify(cur)));
          }
          return Promise.resolve(rejected);
        },
      };
    },
  };
}

/* ── A device: its own localStorage and clock ── */
function makeDevice(server, startClock) {
  const ls = new Map();
  let now = startClock || Date.parse("2026-10-04T10:00:00Z");
  const storage = {
    get: (k) => (ls.has(k) ? JSON.parse(ls.get(k)) : null),
    setSilent: (k, v) => ls.set(k, JSON.stringify(v)),
    removeSilent: (k) => ls.delete(k),
    keys: () => [...ls.keys()],
  };
  const applied = [];
  const engine = new SyncEngine({ storage, now: () => now, onApplied: (keys) => applied.push(...keys) });
  const dev = {
    ls, storage, engine, applied,
    advance(ms) { now += ms; },
    // What SS.store.set does in the app: write, then tell the engine.
    set(k, v) { const old = storage.get(k); storage.setSilent(k, v); engine.trackWrite(k, old, v); now += 10; },
    remove(k) { const old = storage.get(k); storage.removeSilent(k); engine.trackWrite(k, old, undefined); now += 10; },
    get: (k) => storage.get(k),
    signIn(uid) { engine.backend = server.backendFor(uid); return engine.beginSession(uid); },
    sync: () => engine.sync(),
  };
  return dev;
}

test("bookmark made on phone appears on computer", async () => {
  const server = makeServer();
  const phone = makeDevice(server), laptop = makeDevice(server);
  phone.signIn("u1"); laptop.signIn("u1");
  phone.set("quran:bookmarks", { "2:255": { at: 1 } });
  await phone.sync();
  await laptop.sync();
  assert.deepEqual(laptop.get("quran:bookmarks"), { "2:255": { at: 1 } });
  assert.ok(laptop.applied.includes("quran:bookmarks"));
});

test("removing a bookmark syncs as a deletion, not a resurrection", async () => {
  const server = makeServer();
  const a = makeDevice(server), b = makeDevice(server);
  a.signIn("u1"); b.signIn("u1");
  a.set("quran:bookmarks", { "1:1": { at: 1 }, "2:255": { at: 2 } });
  await a.sync(); await b.sync();
  b.set("quran:bookmarks", { "1:1": { at: 1 } });
  await b.sync(); await a.sync();
  assert.deepEqual(a.get("quran:bookmarks"), { "1:1": { at: 1 } });
});

test("edits to different bookmarks on two devices are both kept", async () => {
  const server = makeServer();
  const a = makeDevice(server), b = makeDevice(server);
  a.signIn("u1"); b.signIn("u1");
  a.set("quran:bookmarks", { "1:1": { at: 1 } });
  b.set("quran:bookmarks", { "3:3": { at: 2 } });
  await a.sync(); await b.sync(); await a.sync();
  assert.deepEqual(Object.keys(a.get("quran:bookmarks")).sort(), ["1:1", "3:3"]);
  assert.deepEqual(Object.keys(b.get("quran:bookmarks")).sort(), ["1:1", "3:3"]);
});

test("settings sync per field, last writer wins; location stays on the device", async () => {
  const server = makeServer();
  const a = makeDevice(server), b = makeDevice(server, Date.parse("2026-10-04T10:00:00Z"));
  a.signIn("u1"); b.signIn("u1");
  a.set("settings", { theme: "dark", location: { lat: 1, lng: 2 } });
  await a.sync();
  b.advance(60000);
  b.set("settings", { reciter: "ar.husary", location: { lat: 9, lng: 9 } });
  await b.sync(); await a.sync();
  assert.equal(b.get("settings").theme, "dark");
  assert.equal(a.get("settings").reciter, "ar.husary");
  assert.deepEqual(a.get("settings").location, { lat: 1, lng: 2 });
  assert.deepEqual(b.get("settings").location, { lat: 9, lng: 9 });
  b.advance(60000);
  b.set("settings", Object.assign({}, b.get("settings"), { theme: "light" }));
  await b.sync(); await a.sync();
  assert.equal(a.get("settings").theme, "light");
  for (const r of server.rows.values()) assert.notEqual(r.key, "location");
});

test("guest data is merged into an existing account, never wiped", async () => {
  const server = makeServer();
  const old = makeDevice(server);
  old.signIn("u1");
  old.set("quran:bookmarks", { "18:10": { at: 5 } });
  old.set("settings", { theme: "dark" });
  old.set("dhikr:streak", { current: 4, longest: 9, lastDate: "2026-10-03" });
  await old.sync();
  // A new phone used as a guest (pre-2.5 data has no timestamps at all).
  const phone = makeDevice(server);
  phone.storage.setSilent("quran:bookmarks", { "2:255": { at: 7 } });
  phone.storage.setSilent("settings", { theme: "light", reciter: "ar.minshawi" });
  phone.storage.setSilent("dhikr:streak", { current: 6, longest: 6, lastDate: "2026-10-04" });
  const res = phone.signIn("u1");
  assert.ok(res.migrated >= 4);
  await phone.sync();
  assert.deepEqual(Object.keys(phone.get("quran:bookmarks")).sort(), ["18:10", "2:255"]);
  // Unstamped guest setting loses to the account's choice; new ones are kept.
  assert.equal(phone.get("settings").theme, "dark");
  assert.equal(phone.get("settings").reciter, "ar.minshawi");
  // Streaks merge: latest run + best ever.
  assert.deepEqual(phone.get("dhikr:streak"), { current: 6, longest: 9, lastDate: "2026-10-04" });
  await old.sync();
  assert.deepEqual(Object.keys(old.get("quran:bookmarks")).sort(), ["18:10", "2:255"]);
  assert.equal(old.get("settings").reciter, "ar.minshawi");
  assert.deepEqual(old.get("dhikr:streak"), { current: 6, longest: 9, lastDate: "2026-10-04" });
});

test("two devices with old unstamped settings: the account's first value wins", async () => {
  const server = makeServer();
  const a = makeDevice(server), b = makeDevice(server);
  a.storage.setSilent("settings", { theme: "dark" });
  b.storage.setSilent("settings", { theme: "light" });
  a.signIn("u1"); await a.sync();
  b.signIn("u1"); await b.sync();
  await a.sync();
  assert.equal(b.get("settings").theme, "dark");
  assert.equal(a.get("settings").theme, "dark");
});

test("brand-new account receives everything from the guest device", async () => {
  const server = makeServer();
  const phone = makeDevice(server);
  phone.storage.setSilent("prayers:log", { "2026-10-01": { Fajr: 1 }, "2026-10-02": { Fajr: 1, Isha: 1 } });
  phone.storage.setSilent("duas:favorites", { "morning-1": true });
  phone.signIn("new");
  await phone.sync();
  const laptop = makeDevice(server); laptop.signIn("new");
  await laptop.sync();
  assert.deepEqual(laptop.get("prayers:log"), phone.get("prayers:log"));
  assert.deepEqual(laptop.get("duas:favorites"), { "morning-1": true });
});

test("offline changes are queued and pushed when back online", async () => {
  const server = makeServer();
  const a = makeDevice(server), b = makeDevice(server);
  a.signIn("u1"); b.signIn("u1");
  server.online = false;
  a.set("quran:lastRead", { surah: 36, ayah: 12, at: 100 });
  await assert.rejects(a.sync());
  assert.equal(a.engine.status, "offline");
  assert.equal(a.engine.pendingCount(), 1);
  server.online = true;
  await a.sync();
  assert.equal(a.engine.pendingCount(), 0);
  await b.sync();
  assert.deepEqual(b.get("quran:lastRead"), { surah: 36, ayah: 12, at: 100 });
});

test("continue reading follows the most recent device; progress keeps the furthest point", async () => {
  const server = makeServer();
  const a = makeDevice(server), b = makeDevice(server);
  a.signIn("u1"); b.signIn("u1");
  a.set("quran:lastRead", { surah: 2, ayah: 100, at: 1000 });
  a.set("quran:progress", { 2: 100, 3: 20 });
  b.set("quran:lastRead", { surah: 18, ayah: 5, at: 2000 });
  b.set("quran:progress", { 2: 40, 18: 5 });
  await a.sync(); await b.sync(); await a.sync();
  assert.deepEqual(a.get("quran:lastRead"), { surah: 18, ayah: 5, at: 2000 });
  assert.deepEqual(b.get("quran:lastRead"), { surah: 18, ayah: 5, at: 2000 });
  assert.deepEqual(a.get("quran:progress"), { 2: 100, 3: 20, 18: 5 });
  assert.deepEqual(b.get("quran:progress"), { 2: 100, 3: 20, 18: 5 });
});

test("a refused mergeable push is merged, not lost", async () => {
  const server = makeServer();
  const a = makeDevice(server, 1000), b = makeDevice(server, 5000);
  a.signIn("u1"); b.signIn("u1");
  b.set("quran:progress", { 5: 10 });
  await b.sync();
  // a writes with an older clock without pulling first → server refuses, a merges.
  a.set("quran:progress", { 7: 3 });
  await a.sync();
  assert.deepEqual(a.get("quran:progress"), { 5: 10, 7: 3 });
  await b.sync();
  assert.deepEqual(b.get("quran:progress"), { 5: 10, 7: 3 });
});

test("sign-out can remove synced data from the device, or keep it as guest data", async () => {
  const server = makeServer();
  const a = makeDevice(server);
  a.signIn("u1");
  a.set("quran:bookmarks", { "1:1": { at: 1 } });
  a.set("cache:surah:1", { big: true }); // not synced, must survive either way
  await a.sync();
  a.engine.endSession(true);
  assert.deepEqual(a.get("quran:bookmarks"), { "1:1": { at: 1 } });
  assert.equal(a.engine.foreignOwner("u2"), true);
  assert.equal(a.engine.foreignOwner("u1"), false);
  a.signIn("u1");
  a.engine.endSession(false);
  assert.equal(a.get("quran:bookmarks"), null);
  assert.equal(a.get("sync:meta"), null);
  assert.deepEqual(a.get("cache:surah:1"), { big: true });
});

test("three devices converge", async () => {
  const server = makeServer();
  const devs = [makeDevice(server, 1e6), makeDevice(server, 2e6), makeDevice(server, 3e6)];
  devs.forEach((d) => d.signIn("u1"));
  devs[0].set("duas:favorites", { a: true });
  devs[1].set("duas:favorites", { b: true });
  devs[2].set("duas:favorites", { c: true });
  devs[2].set("learn:best", 7);
  devs[0].set("learn:best", 9);
  for (let round = 0; round < 2; round++) for (const d of devs) await d.sync();
  for (const d of devs) {
    assert.deepEqual(Object.keys(d.get("duas:favorites")).sort(), ["a", "b", "c"]);
    assert.equal(d.get("learn:best"), 9);
  }
});

test("merge functions are commutative", () => {
  const s1 = { current: 3, longest: 10, lastDate: "2026-10-01" }, s2 = { current: 5, longest: 5, lastDate: "2026-10-02" };
  assert.deepEqual(MERGE.streak(s1, s2), MERGE.streak(s2, s1));
  const r1 = [{ surah: 1, ayah: 3, at: 5 }], r2 = [{ surah: 1, ayah: 7, at: 9 }, { surah: 2, ayah: 1, at: 1 }];
  assert.deepEqual(MERGE.recent(r1, r2), MERGE.recent(r2, r1));
  assert.deepEqual(MERGE.union(["b", "a"], ["c", "a"]), ["a", "b", "c"]);
});
