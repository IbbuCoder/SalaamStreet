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
