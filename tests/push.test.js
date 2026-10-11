/* Reminders when SalaamStreet is closed: the server's "what's due now" logic
   (backend/functions/send-reminders/due.js) with the real calculator and texts.
   Run: node --test tests/push.test.js */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const pt = require("../js/praytimes.js");
const messages = require("../backend/functions/send-reminders/messages.json");

const ROOT = path.resolve(__dirname, "..");
const load = () => import(path.join(ROOT, "backend/functions/send-reminders/due.js"));
const chicago = { endpoint: "https://x", tz: "America/Chicago", lat: 41.88, lng: -87.63, method: 2, school: 0, offset_min: 0, prayers: true, kahf: true, adhkar: true, lang: "en", sent: {} };
const at = (iso) => new Date(iso).getTime();

test("the server sends each reminder once, at the device's own prayer time", async () => {
  const { dueReminders } = await load();
  const times = pt.times(new Date(2026, 9, 9), 41.88, -87.63, { method: 2, school: 0, tzOffset: -300 });
  const [h, m] = times.Asr.split(":").map(Number);
  // Friday 9 Oct 2026, Asr in Chicago (UTC-5) → UTC hour + 5.
  const asrUtc = Date.UTC(2026, 9, 9, h + 5, m);
  let r = dueReminders(chicago, asrUtc - 60000, pt, messages);
  assert.equal(r.send.filter((x) => x.id === "Asr").length, 0, "not before");
  r = dueReminders(chicago, asrUtc + 2 * 60000, pt, messages);
  const asr = r.send.find((x) => x.id === "Asr");
  assert.ok(asr, "sent within the window");
  assert.equal(asr.title, "It's time for Asr");
  assert.match(asr.body, /^\d{1,2}:\d{2} (AM|PM)$/);
  assert.equal(asr.prayed, "./#/home/prayed/Asr/2026-10-09");
  assert.equal(asr.action, "I prayed");
  // Remembered: the next run (5 minutes later) doesn't send it again.
  const again = dueReminders({ ...chicago, sent: r.sent }, asrUtc + 7 * 60000, pt, messages);
  assert.equal(again.send.filter((x) => x.id === "Asr").length, 0);
});

test("offset, Friday Al-Kahf, adhkar and the device's language", async () => {
  const { dueReminders } = await load();
  const times = pt.times(new Date(2026, 9, 9), 41.88, -87.63, { method: 2, school: 0, tzOffset: -300 });
  const [h, m] = times.Maghrib.split(":").map(Number);
  const r = dueReminders({ ...chicago, offset_min: 10, lang: "ar" }, Date.UTC(2026, 9, 9, h + 5, m - 10 + 1), pt, messages);
  const mg = r.send.find((x) => x.id === "Maghrib");
  assert.equal(mg.title, "المغرب بعد 10 دقائق");
  assert.equal(mg.body, times.Maghrib, "24-hour clock outside English");
  const kahf = dueReminders(chicago, at("2026-10-09T15:03:00Z"), pt, messages); // 10:03 in Chicago, a Friday
  assert.ok(kahf.send.some((x) => x.id === "kahf" && x.url === "./#/surah/18"));
  const thursday = dueReminders(chicago, at("2026-10-08T15:03:00Z"), pt, messages);
  assert.equal(thursday.send.some((x) => x.id === "kahf"), false);
  const [fh, fm] = times.Fajr.split(":").map(Number);
  const morning = dueReminders(chicago, Date.UTC(2026, 9, 9, fh + 5, fm + 21), pt, messages);
  assert.ok(morning.send.some((x) => x.id === "adhkar-morning" && x.url === "./#/adhkar/morning"));
  const off = dueReminders({ ...chicago, prayers: false, kahf: false, adhkar: false }, Date.UTC(2026, 9, 9, fh + 5, fm + 1), pt, messages);
  assert.deepEqual(off.send, []);
});

test("the server's copies of the calculator and texts match the app", () => {
  assert.equal(fs.readFileSync(path.join(ROOT, "backend/functions/send-reminders/praytimes.js"), "utf8"),
    fs.readFileSync(path.join(ROOT, "js/praytimes.js"), "utf8"), "run node tools/build-push-messages.js");
  for (const [lang, dict] of Object.entries(messages)) {
    assert.equal(Object.keys(dict).length, 13, lang + " has every reminder text (run node tools/build-push-messages.js)");
  }
});

test("the server makes its own VAPID keys in the format browsers and web-push expect", async () => {
  const { generateVapidKeys, unb64u } = await import(path.join(ROOT, "backend/functions/send-reminders/keys.js"));
  const a = await generateVapidKeys(), b = await generateVapidKeys();
  assert.notEqual(a.privateKey, b.privateKey, "fresh keys each time");
  const pub = unb64u(a.publicKey), priv = unb64u(a.privateKey);
  assert.equal(pub.length, 65);
  assert.equal(pub[0], 4, "uncompressed P-256 point");
  assert.equal(priv.length, 32);
  assert.match(a.publicKey, /^[A-Za-z0-9_-]+$/, "base64url, no padding");
  // The pair belongs together: sign with the private key, verify with the public one.
  const x = Buffer.from(pub.slice(1, 33)).toString("base64url"), y = Buffer.from(pub.slice(33)).toString("base64url");
  const sk = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", x, y, d: a.privateKey }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const pk = await crypto.subtle.importKey("raw", pub, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const data = new TextEncoder().encode("salaam");
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, sk, data);
  assert.ok(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pk, sig, data));
});

test("push_keys: a random schedule secret, and nobody but the server can read it", async () => {
  const { aiDb } = require("./helpers/ai-lab-store");
  const pg = await aiDb(); // runs backend/supabase-schema.sql twice
  const r = await pg.query("select cron_secret, vapid_public from public.push_keys");
  assert.equal(r.rows.length, 1);
  assert.match(r.rows[0].cron_secret, /^[0-9a-f]{64}$/);
  assert.equal(r.rows[0].vapid_public, null, "made by the server on its first run");
  for (const role of ["anon", "authenticated"]) {
    await pg.exec(`set role ${role}`);
    try { await assert.rejects(pg.query("select * from public.push_keys"), /permission denied/); } finally { await pg.exec("reset role"); }
  }
});
