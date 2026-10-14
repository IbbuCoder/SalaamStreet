/* The iOS app's bridge (ios/SalaamStreet/Sources/Web/bridge.js) running on the
   real website in headless Chromium, with a fake iOS message handler standing
   in for NativeBridge.swift. Checks what the website sends to iOS (prayer
   times in the location's time zone, reminders, "I prayed", recitation
   queue) and that the bundled copy of the website is current.
   Run: node --test tests/ios-bridge.test.js */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const BRIDGE = fs.readFileSync(path.join(ROOT, "ios/SalaamStreet/Sources/Web/bridge.js"), "utf8");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".png": "image/png", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml" };
let server, base, browser;

function serve() {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (p.endsWith("/")) p += "index.html";
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end("nf"); }
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
      fs.createReadStream(file).pipe(res);
    }).listen(0, "127.0.0.1", () => { base = "http://127.0.0.1:" + server.address().port + "/"; resolve(); });
  });
}

/** Prayer times from "AlAdhan" for a location in Riyadh time, whatever the device's zone. */
async function mockApis(context) {
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === "api.aladhan.com" && /\/timings\//.test(u.pathname)) {
      return route.fulfill({ json: { data: { timings: { Fajr: "05:00", Sunrise: "06:30", Dhuhr: "12:30", Asr: "15:45", Maghrib: "18:30", Isha: "19:45" },
        date: { hijri: { day: "12", month: { number: 4, en: "Rabi al-Thani", ar: "ربيع الآخر" }, year: "1448" } }, meta: { timezone: "Asia/Riyadh" } } } });
    }
    if (u.hostname === "api.alquran.cloud" && /\/v1\/ayah\//.test(u.pathname)) {
      return route.fulfill({ json: { data: [{ text: "آية", surah: { number: 94, englishName: "Ash-Sharh" }, numberInSurah: 6 }, { text: "Indeed, with hardship comes ease." }] } });
    }
    return route.abort();
  });
}

/** Open the site the way the iOS app does: fake handler + bridge.js before any website script. */
async function openInApp(opts = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Karachi", serviceWorkers: "block" });
  await mockApis(context);
  await context.addInitScript((o) => {
    window.__msgs = [];
    if (o.settings) localStorage.setItem("salaamstreet:settings", JSON.stringify(o.settings));
    window.__SSNativeConfig = { version: "3.0.0", build: "1", authRedirect: "salaamstreet://auth-callback", notif: "granted", geo: "prompt" };
    let seq = 0;
    window.webkit = { messageHandlers: { ssNative: { postMessage(m) {
      window.__msgs.push(JSON.parse(JSON.stringify(m)));
      switch (m.action) {
        case "ready": return Promise.resolve({ pendingPrayed: o.pending || [] });
        case "notify.request": return Promise.resolve("granted");
        case "audio.play": seq++; return Promise.resolve({ seq: seq, adopted: m.payload.adoptSeq !== undefined });
        case "audio.hasFile": return Promise.resolve(false);
        case "activity.status": return Promise.resolve({ running: false, enabled: true });
        case "geo.status": return Promise.resolve("prompt");
        case "net.fetch": return Promise.resolve({ status: 200, type: "audio/mpeg", data: "SUQzZmFrZS1tcDM=" }) // "ID3fake-mp3";
        case "eval": return Promise.reject(new Error("unknown-action: eval"));
        default: return Promise.resolve(null);
      }
    } } } };
  }, opts);
  await context.addInitScript({ content: BRIDGE });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base + "index.html" + (opts.hash || "#/home"));
  await page.waitForFunction(() => !document.getElementById("boot"), null, { timeout: 10000 });
  await page.waitForFunction(() => window.__msgs.some((m) => m.action === "snapshot"), null, { timeout: 15000 });
  return { context, page, errors, msgs: (action) => page.evaluate((a) => window.__msgs.filter((m) => m.action === a), action) };
}

test.before(async () => { await serve(); browser = await chromium.launch(); });
test.after(async () => { await browser.close(); server.close(); });

test("the bundled website in ios/ is the current website", () => {
  const out = execFileSync(process.execPath, [path.join(ROOT, "tools/build-ios-webapp.js"), "--check"], { encoding: "utf8" });
  assert.match(out, /up to date/);
  const html = fs.readFileSync(path.join(ROOT, "ios/SalaamStreet/WebApp/index.html"), "utf8");
  assert.ok(html.includes('href="fonts/fonts.css"'), "fonts are bundled");
  assert.ok(!html.includes("fonts.googleapis.com/css2"));
  const plist = fs.readFileSync(path.join(ROOT, "ios/SalaamStreet.xcodeproj/project.pbxproj"), "utf8");
  assert.match(plist, /MARKETING_VERSION = 3\.0\.0;/);
  assert.match(plist, /CURRENT_PROJECT_VERSION = 1;/);
  assert.match(plist, /PRODUCT_BUNDLE_IDENTIFIER = com\.salaamstreet\.app;/);
  assert.match(plist, /IPHONEOS_DEPLOYMENT_TARGET = 17\.0;/);
});

test("in a browser the bridge does nothing and the website is unchanged", async () => {
  const context = await browser.newContext({ serviceWorkers: "block" });
  await mockApis(context);
  await context.addInitScript({ content: BRIDGE });
  const page = await context.newPage();
  await page.goto(base + "index.html#/home");
  await page.waitForFunction(() => !document.getElementById("boot"));
  const r = await page.evaluate(() => ({ native: typeof window.SSNative, audio: Audio.name, plan: typeof SS.audio.plan }));
  assert.deepEqual(r, { native: "undefined", audio: "Audio", plan: "function" });
  await context.close();
});

test("the website hands iOS its prayer times in the location's time zone, and ticks from iOS reach the tracker", async () => {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
  const app = await openInApp({ pending: [{ key: "Fajr", date: today }] });
  const [snap] = (await app.msgs("snapshot")).map((m) => m.payload);
  assert.equal(snap.location.tz, "Asia/Riyadh", "the location's zone, not the phone's (Asia/Karachi)");
  assert.equal(snap.days.length, 7);
  assert.equal(snap.days[0].date, today);
  assert.equal(snap.days[0].timings.Asr, "15:45");
  assert.equal(snap.names.Maghrib, "Maghrib");
  assert.equal(snap.labels.next, "Next prayer");
  assert.equal(snap.ayahs[0].ref, "Ash-Sharh 94:6");
  assert.equal(typeof snap.qibla, "number");
  // "I prayed" from a notification while the app was closed → the website's tracker.
  const log = await app.page.evaluate(() => SS.tracker.log());
  assert.equal(log[today].Fajr, 1);
  const applied = await app.msgs("prayedApplied");
  assert.deepEqual(applied[0].payload.items, [{ key: "Fajr", date: today }]);
  // A tick arriving while the app is open.
  await app.page.evaluate((d) => window.SSNative._emit("prayed", { items: [{ key: "Dhuhr", date: d }] }), today);
  assert.equal(await app.page.evaluate((d) => SS.tracker.isDone(d, "Dhuhr"), today), true);
  await app.context.close();
});

test("reminders for the next days are planned with the website's settings and texts", async () => {
  const app = await openInApp({ settings: { reminders: true, reminderOffset: 10, kahfReminder: true, adhkarReminders: true } });
  await app.page.waitForFunction(() => window.__msgs.some((m) => m.action === "notify.schedule"));
  const plan = (await app.msgs("notify.schedule")).pop().payload;
  assert.equal(plan.prayedTitle, "I prayed");
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
  const asr = plan.items.find((i) => i.tag === "prayer-" + today + "-Asr");
  assert.ok(asr, "today's Asr reminder");
  const [y, m, d] = today.split("-").map(Number);
  // 15:45 in Riyadh (UTC+3) minus the 10-minute offset = 12:35 UTC.
  assert.equal(asr.at, Date.UTC(y, m - 1, d, 12, 35));
  assert.equal(asr.title, "Asr in 10 minutes");
  assert.equal(asr.prayedKey, "Asr");
  assert.equal(asr.prayedDate, today);
  assert.ok(plan.items.filter((i) => /^prayer-/.test(i.tag)).length >= 30, "a week of prayer reminders");
  assert.ok(plan.items.some((i) => /^adhkar-morning-/.test(i.tag)));
  const friday = plan.items.filter((i) => /^kahf-/.test(i.tag));
  assert.equal(friday.length, 1, "one Friday Al-Kahf reminder in the week");
  assert.equal(friday[0].hash, "#/surah/18");
  await app.context.close();
});

test("browser APIs go to iOS: haptics, notifications, wake lock, badge", async () => {
  const app = await openInApp();
  await app.page.evaluate(async () => {
    navigator.vibrate([20, 30, 20]);
    new Notification("Test", { body: "Body", tag: "test-1", data: { url: "./#/prayer" } });
    const l = await navigator.wakeLock.request("screen");
    await l.release();
    await navigator.setAppBadge(3);
  });
  assert.deepEqual((await app.msgs("haptic"))[0].payload, { pattern: [20, 30, 20] });
  const shown = (await app.msgs("notify.show"))[0].payload;
  assert.equal(shown.tag, "test-1");
  assert.equal(shown.hash, "#/prayer");
  assert.deepEqual((await app.msgs("idleTimer")).map((m) => m.payload.on), [true, false]);
  assert.equal((await app.msgs("badge")).pop().payload.count, 3);
  assert.equal(await app.page.evaluate(() => Notification.permission), "granted");
  assert.deepEqual(app.errors, []);
  await app.context.close();
});

test("recitation: iOS gets the ayahs that follow, and adopts the one it moved on to", async () => {
  const app = await openInApp({ hash: "#/surah/18" });
  await app.page.evaluate(() => SS.audio.start(18, 1, SS.SURAHS[17]));
  await app.page.waitForFunction(() => window.__msgs.some((m) => m.action === "audio.play"));
  const first = (await app.msgs("audio.play"))[0].payload;
  assert.equal(first.key, "ar.alafasy:18:1");
  assert.equal(first.plan.length, 109, "the rest of Al-Kahf");
  assert.equal(first.plan[0].key, "ar.alafasy:18:2");
  assert.match(first.plan[0].src, /^https:\/\/cdn\.islamic\.network\//);
  assert.match(first.plan[0].title, /Al-Kahf 18:2/);
  // The phone was locked: iOS moved on to 18:2 by itself.
  await app.page.evaluate(() => window.SSNative._emit("audio", { type: "advance", ended: 1, seq: 2, key: "ar.alafasy:18:2" }));
  await app.page.waitForFunction(() => window.__msgs.filter((m) => m.action === "audio.play").length >= 2);
  const second = (await app.msgs("audio.play"))[1].payload;
  assert.equal(second.key, "ar.alafasy:18:2");
  assert.equal(second.adoptSeq, 2);
  // A single ayah (Ayah of the Day) has nothing after it.
  await app.page.evaluate(() => SS.audio.start(2, 255, SS.SURAHS[1], false, { single: true }));
  await app.page.waitForFunction(() => window.__msgs.filter((m) => m.action === "audio.play").length >= 3);
  assert.equal((await app.msgs("audio.play"))[2].payload.plan.length, 0);
  assert.deepEqual(app.errors, []);
  await app.context.close();
});

test("SS.audio.plan follows repeats and continuous play like the player does", async () => {
  const app = await openInApp({ settings: { continuousPlay: true }, hash: "#/surah/112" });
  const plan = await app.page.evaluate(() => {
    SS.audio.start(112, 3, SS.SURAHS[111]);
    return SS.audio.plan(5).next.map((n) => n.surah + ":" + n.ayah);
  });
  assert.deepEqual(plan, ["112:4", "113:1", "113:2", "113:3", "113:4"]);
  await app.context.close();
});

test("the Settings page gets the Lock Screen countdown switch and the Offline page says the app works offline", async () => {
  const app = await openInApp({ hash: "#/settings" });
  await app.page.waitForSelector("#st-ios-live");
  await app.page.click("#st-ios-live-row .switch");
  await app.page.waitForFunction(() => window.__msgs.some((m) => m.action === "activity.start"));
  await app.page.evaluate(() => { location.hash = "#/offline"; });
  await app.page.waitForFunction(() => document.querySelector("#view-offline .off-status-list li[data-ios]"));
  const text = await app.page.textContent("#view-offline .off-status-list li[data-ios]");
  assert.match(text, /saved on this device/);
  await app.context.close();
});

test("recitation downloads go through iOS; every other request goes straight from the page", async () => {
  const app = await openInApp();
  const r = await app.page.evaluate(async () => {
    const res = await fetch("https://cdn.islamic.network/quran/audio/64/ar.alafasy/1.mp3");
    const text = await res.text();
    let other = "";
    try { await fetch("https://api.alquran.cloud/v1/x"); } catch (e) { other = "page"; }
    return { status: res.status, type: res.headers.get("content-type"), text, other };
  });
  assert.deepEqual(r, { status: 200, type: "audio/mpeg", text: "ID3fake-mp3", other: "page" });
  const proxied = await app.msgs("net.fetch");
  assert.equal(proxied.length, 1);
  assert.match(proxied[0].payload.url, /^https:\/\/cdn\.islamic\.network\//);
  await app.context.close();
});
