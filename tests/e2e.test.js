/* End-to-end tests in headless Chromium (Playwright). The site is served
   from this folder; every external API is mocked, and accounts run the REAL
   supabase-js client against an in-memory Supabase (tests/helpers).
   Run: node --test tests/e2e.test.js   (screenshots: SS_SHOTS=dir) */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { createMock, URL_BASE } = require("./helpers/mock-supabase");
const { routeQuranApis, testPdf } = require("./helpers/offline-fixtures");

const ROOT = path.resolve(__dirname, "..");
const VERSION = require("../package.json").version;
const SHOTS = process.env.SS_SHOTS || "";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".pdf": "application/pdf", ".wasm": "application/wasm", ".css": "text/css", ".png": "image/png", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml" };
let server, base, browser;
const site = { pdf: null, down: false };

/* ── Static server ── */
function serve() {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      if (site.down) return req.socket.destroy(); // "offline": the site can't be reached at all
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      // A small test PDF stands in for the real Qur'an PDF during one test only.
      if (p === "/files/quran-english-sher-ali.pdf" && site.pdf) {
        res.writeHead(200, { "content-type": "application/pdf", "content-length": site.pdf.length, "cache-control": "no-store" });
        return res.end(req.method === "HEAD" ? undefined : site.pdf);
      }
      if (p.endsWith("/")) p += "index.html";
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end("nf"); }
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
      fs.createReadStream(file).pipe(res);
    }).listen(0, "127.0.0.1", () => { base = "http://127.0.0.1:" + server.address().port + "/"; resolve(); });
  });
}

/* ── External API mocks (Qur'an text, tafsir, prayer times) ── */
function surahJson(n, count) {
  const ed = (fmt) => ({ ayahs: Array.from({ length: count }, (_, i) => ({ number: i + 1, numberInSurah: i + 1, text: fmt(i + 1) })) });
  return { code: 200, data: [ed((i) => "آية " + i), ed((i) => `Translation of ${n}:${i}`), ed((i) => `Transliteration ${n}:${i}`)] };
}
const AYAHS = { 1: 7, 2: 286, 18: 110, 112: 4 };
async function mockApis(context, opts = {}) {
  const tafsir = opts.tafsir || {};
  await context.route(/^https?:\/\/(?!127\.0\.0\.1|test\.supabase\.co)/, async (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === "api.alquran.cloud") {
      const m = u.pathname.match(/\/v1\/surah\/(\d+)\//);
      if (m) return route.fulfill({ json: surahJson(+m[1], AYAHS[+m[1]] || 5) });
      if (/\/v1\/ayah\//.test(u.pathname)) return route.fulfill({ json: { data: [{ text: "آية", surah: { number: 1, englishName: "Al-Fatiha" }, numberInSurah: 1 }, { text: "In the name of Allah" }] } });
      return route.fulfill({ status: 404, json: {} });
    }
    const tm = u.pathname.match(/en-tafisr-ibn-kathir\/(\d+)\/(\d+)\.json$/);
    if (tm) {
      const key = tm[1] + ":" + tm[2], mirror = u.hostname.indexOf("jsdelivr") > -1 ? "cdn" : "raw";
      (opts.tafsirLog || []).push(mirror + " " + u.pathname);
      const spec = tafsir[key] || {};
      if (spec.delay) await new Promise((r) => setTimeout(r, spec.delay));
      if (spec.fail === "all" || spec.fail === mirror) return route.fulfill({ status: 404, body: "nf" });
      return route.fulfill({ json: { text: spec.text || `Commentary for ${key}`, surah: +tm[1], ayah: +tm[2] } });
    }
    if (u.hostname === "api.aladhan.com" && /\/timings\//.test(u.pathname)) {
      return route.fulfill({ json: { data: { timings: { Fajr: "05:00", Sunrise: "06:30", Dhuhr: "12:30", Asr: "15:45", Maghrib: "18:30", Isha: "19:45", Imsak: "04:50" },
        date: { hijri: { day: "12", month: { number: 4, en: "Rabi al-Thani", ar: "ربيع الآخر" }, year: "1448" } } } } });
    }
    return route.abort();
  });
}

const CHICAGO = { lat: 41.88, lng: -87.63, label: "Chicago", consent: "manual" };
async function device(opts = {}) {
  const context = await browser.newContext(Object.assign({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, serviceWorkers: "block" }, opts.context || {}));
  await mockApis(context, opts);
  let mockId = null;
  if (opts.mock) {
    mockId = await opts.mock.attach(context);
    await context.route("**/js/config.js", (route) => route.fulfill({ contentType: "text/javascript",
      body: `window.SS=window.SS||{};SS.CONFIG={supabaseUrl:"${URL_BASE}",supabaseAnonKey:"anon-test-key",signInMethods:["apple","google","phone","email"]};` }));
  }
  const settings = Object.assign({ location: CHICAGO }, opts.settings || {});
  if (opts.noSettings !== true) {
    await context.addInitScript(({ s, v }) => {
      if (!sessionStorage.getItem("seeded")) {
        sessionStorage.setItem("seeded", "1");
        localStorage.setItem("salaamstreet:settings", JSON.stringify(s));
        localStorage.setItem("salaamstreet:onboarded", "true");
        localStorage.setItem("salaamstreet:seenVersion", JSON.stringify(v)); // no "new version" toast
      }
    }, { s: settings, v: VERSION });
  }
  const page = await context.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  return { context, page, mockId };
}
async function open(page, hash) {
  await page.goto(base + "index.html" + hash);
  await page.waitForFunction(() => !document.getElementById("boot"), null, { timeout: 8000 });
}
async function shot(page, name) { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + ".png") }); }

test.before(async () => { await serve(); browser = await chromium.launch({ args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] }); });
test.after(async () => { await browser.close(); server.close(); });

/* ═══════════ Loading screen theme ═══════════ */
test("startup uses the saved theme from the very first frame", async () => {
  const cases = [
    { saved: "dark", scheme: "light", want: "dark", bg: "rgb(10, 16, 13)" },
    { saved: "light", scheme: "dark", want: "light", bg: "rgb(246, 250, 247)" },
    { saved: "system", scheme: "dark", want: "dark", bg: "rgb(10, 16, 13)" },
    { saved: null, scheme: "dark", want: "dark", bg: "rgb(10, 16, 13)" }, // first-time visitor, dark OS
    { saved: null, scheme: "light", want: "light", bg: "rgb(246, 250, 247)" }, // first-time visitor, light OS
  ];
  for (const c of cases) {
    const context = await browser.newContext({ colorScheme: c.scheme });
    await mockApis(context);
    // Hold the stylesheet back: whatever shows now is what people would see while it loads.
    let release;
    const held = new Promise((r) => (release = r));
    await context.route("**/css/styles.css", async (route) => { await held; await route.continue(); });
    if (c.saved) await context.addInitScript((t) => localStorage.setItem("salaamstreet:settings", JSON.stringify({ theme: t })), c.saved);
    const page = await context.newPage();
    await page.goto(base + "index.html#/home", { waitUntil: "commit" });
    await page.waitForSelector("#boot", { state: "attached" });
    const early = await page.evaluate(() => ({
      theme: document.documentElement.getAttribute("data-theme"),
      htmlBg: getComputedStyle(document.documentElement).backgroundColor,
      bootBg: getComputedStyle(document.getElementById("boot")).backgroundColor,
      themeColor: [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.content + "|" + (m.getAttribute("media") || "")),
      // The launch image iOS would use now: the one whose media matches this screen's appearance.
      splash: [...document.querySelectorAll('link[rel="apple-touch-startup-image"]')]
        .find((l) => matchMedia("(prefers-color-scheme: " + l.dataset.scheme + ")").matches).getAttribute("href"),
      splashes: [...document.querySelectorAll('link[rel="apple-touch-startup-image"]')].map((l) => l.dataset.scheme + ":" + l.getAttribute("href")),
      manifest: document.querySelector('link[rel="manifest"]').getAttribute("href"),
    }));
    const label = JSON.stringify(c);
    assert.equal(early.theme, c.want, label);
    assert.equal(early.htmlBg, c.bg, label);
    assert.equal(early.bootBg, c.bg, label);
    assert.ok(early.themeColor.every((m) => m === (c.want === "dark" ? "#0a100d|" : "#f6faf7|")), label + " " + early.themeColor);
    assert.equal(/-dark\.png$/.test(early.splash), c.want === "dark", label + " " + early.splash);
    // With the system theme, iOS gets a light and a dark image to choose from; a chosen theme uses it for both.
    for (const l of early.splashes) {
      const scheme = l.split(":")[0], dark = /-dark\.png$/.test(l);
      assert.equal(dark, (c.saved === "light" || c.saved === "dark") ? c.want === "dark" : scheme === "dark", label + " " + l);
    }
    // Installed apps take their launch-screen colour from the manifest.
    assert.equal(early.manifest, c.want === "dark" ? "manifest-dark.webmanifest" : "manifest.webmanifest", label);
    release();
    await page.waitForFunction(() => !document.getElementById("boot"));
    const after = await page.evaluate(() => [document.documentElement.getAttribute("data-theme"), getComputedStyle(document.body).backgroundColor]);
    assert.equal(after[0], c.want, label + " after boot");
    assert.equal(after[1], c.bg, label + " body after boot");
    await context.close();
  }
});

test("changing theme in the app updates page, browser chrome colour and launch images together", async () => {
  const { page, context } = await device({ settings: { theme: "light" } });
  await open(page, "#/home");
  await page.click("#theme-toggle"); // light → dark
  const s = await page.evaluate(() => [document.documentElement.getAttribute("data-theme"),
    document.querySelector('meta[name="theme-color"]').content, document.querySelector('link[rel="apple-touch-startup-image"][data-scheme="light"]').getAttribute("href"),
    document.querySelector('link[rel="manifest"]').getAttribute("href")]);
  assert.deepEqual(s.slice(0, 2), ["dark", "#0a100d"]);
  assert.match(s[2], /-dark\.png$/);
  assert.equal(s[3], "manifest-dark.webmanifest");
  await page.click("#theme-toggle"); // dark → system (light here)
  assert.equal(await page.getAttribute('link[rel="manifest"]', "href"), "manifest.webmanifest");
  assert.deepEqual(page.errors, []);
  await context.close();
});

/* ═══════════ Tafsir ═══════════ */
test("tafsir loads for the selected ayah, never shows a stale one, and handles errors", async () => {
  const log = [];
  const tafsir = {
    "112:1": { delay: 1500, text: "SLOW commentary for 112:1" },
    "112:2": { text: "Commentary for 112:2" },
    "112:3": { fail: "cdn", text: "From the fallback mirror 112:3" },
    "112:4": { fail: "all" },
  };
  const { page, context } = await device({ tafsir, tafsirLog: log });
  await open(page, "#/surah/112");
  await page.waitForSelector("#ayah-1 [data-tafsir]");
  await page.click("#ayah-1 [data-tafsir]");
  await page.waitForSelector("#tafsir-dialog[open]");
  assert.equal(await page.textContent("#tafsir-ref"), "112:1");
  // Move on before the slow response arrives.
  await page.click("#tafsir-next");
  await page.waitForFunction(() => /Commentary for 112:2/.test(document.getElementById("tafsir-body").textContent));
  await page.waitForTimeout(1800); // the slow 112:1 response lands now…
  assert.match(await page.textContent("#tafsir-body"), /Commentary for 112:2/); // …and is ignored
  assert.equal(await page.textContent("#tafsir-ref"), "112:2");
  assert.ok(log.some((l) => /\/112\/1\.json$/.test(l)), "uses /surah/ayah.json: " + log);
  assert.ok(!log.some((l) => /_/.test(l.split("/").pop())), "no surah_ayah URLs");
  // Primary CDN down → fallback mirror.
  await page.click("#tafsir-next");
  await page.waitForFunction(() => /fallback mirror 112:3/.test(document.getElementById("tafsir-body").textContent));
  // Both down → clear error with retry; no previous text left behind.
  await page.click("#tafsir-next");
  await page.waitForSelector("#tafsir-body .state.error");
  assert.doesNotMatch(await page.textContent("#tafsir-body"), /112:3/);
  assert.equal(await page.isDisabled("#tafsir-next"), true); // last ayah
  tafsir["112:4"] = { text: "Recovered 112:4" };
  await page.click("#tafsir-body [data-retry]");
  await page.waitForFunction(() => /Recovered 112:4/.test(document.getElementById("tafsir-body").textContent));
  await shot(page, "tafsir-mobile");
  // Closing clears it; opening another ayah shows that ayah, not the last one.
  await page.click("#tafsir-dialog [data-close]");
  await page.click("#ayah-2 [data-tafsir]");
  assert.equal(await page.textContent("#tafsir-ref"), "112:2");
  await page.waitForFunction(() => /Commentary for 112:2/.test(document.getElementById("tafsir-body").textContent));
  // Another surah.
  await page.click("#tafsir-dialog [data-close]");
  await open(page, "#/surah/18");
  await page.waitForSelector("#ayah-10 [data-tafsir]");
  await page.click("#ayah-10 [data-tafsir]");
  await page.waitForFunction(() => /Commentary for 18:10/.test(document.getElementById("tafsir-body").textContent));
  assert.deepEqual(page.errors, []);
  await context.close();
});

/* ═══════════ Qibla ═══════════ */
async function orient(page, o) {
  await page.evaluate((o) => {
    for (let i = 0; i < 25; i++) {
      const e = new Event(o.type || "deviceorientationabsolute");
      Object.assign(e, { alpha: o.alpha, beta: o.beta || 0, gamma: o.gamma || 0, absolute: true });
      window.dispatchEvent(e);
    }
  }, o);
  await page.waitForTimeout(120);
}
test("qibla compass: true bearing, declination-corrected heading, turn guidance", async () => {
  const { page, context } = await device();
  await open(page, "#/qibla");
  await page.waitForFunction(() => document.getElementById("qb-deg").textContent !== "—");
  const deg = parseFloat(await page.textContent("#qb-deg"));
  assert.ok(Math.abs(deg - 48.6) < 0.4, "Chicago bearing " + deg);
  assert.match(await page.textContent("#qb-decl"), /west/);
  const decl = await page.evaluate(() => SS.compass.declination());
  // Phone flat, magnetic heading chosen so the TRUE heading equals the bearing.
  const magHeading = deg - decl, alpha = (360 - magHeading + 360) % 360;
  await orient(page, { alpha });
  assert.equal(await page.isVisible("#qb-aligned"), true);
  assert.match(await page.textContent("#qb-hub-l"), /Locked on/);
  // Small wobble while locked on stays locked (no flicker)…
  await orient(page, { alpha: (alpha + 6) % 360 });
  assert.equal(await page.isVisible("#qb-aligned"), true);
  // …but turning further away unlocks it.
  await orient(page, { alpha: (alpha + 12) % 360 });
  assert.equal(await page.isVisible("#qb-aligned"), false);
  assert.match(await page.textContent("#qb-turn"), /Turn right 12°/);
  assert.notEqual(await page.getAttribute("#qb-arc", "d"), ""); // gold arc shows the way to turn
  await orient(page, { alpha });
  // Old behaviour ignored declination: pointing at magnetic 48.6 would be ~4° off.
  await orient(page, { alpha: (360 - deg + 360) % 360 });
  // Turn 90° away → told which way to turn.
  await orient(page, { alpha: (360 - (magHeading - 90) + 360) % 360 });
  assert.match(await page.textContent("#qb-turn"), /Turn right 90°/);
  assert.equal(await page.isVisible("#qb-aligned"), false);
  await shot(page, "qibla-compass-mobile");
  assert.deepEqual(page.errors, []);
  await context.close();
});

test("qibla never shows a made-up direction without a location", async () => {
  const { page, context } = await device({ settings: { location: null } });
  await open(page, "#/qibla");
  await page.waitForSelector("#qb-locwarn:not([hidden])");
  assert.equal(await page.textContent("#qb-deg"), "—");
  assert.equal(await page.isHidden("#qb-needle"), true);
  assert.equal(await page.isDisabled("#qb-mode-camera"), true);
  await context.close();
});

test("qibla camera mode: live camera, real direction overlay, clear exit", async () => {
  const { page, context } = await device();
  await context.grantPermissions(["camera"], { origin: base.slice(0, -1) });
  await open(page, "#/qibla");
  await page.waitForFunction(() => document.getElementById("qb-deg").textContent !== "—");
  await page.click("#qb-mode-camera");
  await page.waitForSelector("#qb-cam:not([hidden])");
  assert.equal(new URL(page.url()).hash, "#/qibla/camera");
  await page.waitForFunction(() => { const v = document.getElementById("qb-video"); return v.srcObject && v.srcObject.getVideoTracks()[0].readyState === "live"; });
  const deg = parseFloat(await page.textContent("#qb-deg")), decl = await page.evaluate(() => SS.compass.declination());
  // Phone upright (beta 90): camera faces 40° right of the Qibla.
  const camMag = deg + 40 - decl;
  await orient(page, { alpha: (360 - camMag + 360) % 360, beta: 90 });
  assert.match(await page.textContent("#qb-cam-msg"), /Turn left 40°/);
  assert.equal(await page.isVisible("#qb-cam-arrow.left"), true); // big edge arrow on the left
  assert.equal(await page.isVisible("#qb-tape-l"), true); // heading strip: the Qibla is off to the left
  assert.equal(await page.isVisible("#qb-cam-done"), false);
  assert.equal(await page.isVisible("#qb-cam-marker"), false); // outside the camera's view
  await orient(page, { alpha: (360 - (deg + 6 - decl) + 360) % 360, beta: 90 });
  assert.equal(await page.isVisible("#qb-cam-marker"), true); // Kaaba marker on screen, slightly left
  await orient(page, { alpha: (360 - (deg - decl) + 360) % 360, beta: 90 });
  assert.match(await page.textContent("#qb-cam-msg"), /facing the Qibla/);
  assert.equal(await page.isVisible("#qb-cam-arrow"), false);
  assert.equal(await page.isVisible("#qb-cam-done"), true);
  assert.match(await page.textContent("#qb-cam-sub"), /to Makkah/);
  await shot(page, "qibla-camera-mobile");
  // Exit button → back to compass, camera released.
  await page.click("#qb-cam-exit");
  await page.waitForSelector("#qb-cam", { state: "hidden" });
  assert.equal(new URL(page.url()).hash, "#/qibla");
  assert.equal(await page.evaluate(() => document.getElementById("qb-video").srcObject), null);
  // Escape and the browser Back button also leave camera mode.
  await page.click("#qb-mode-camera");
  await page.waitForSelector("#qb-cam:not([hidden])");
  await page.keyboard.press("Escape");
  await page.waitForSelector("#qb-cam", { state: "hidden" });
  await page.click("#qb-mode-camera");
  await page.waitForSelector("#qb-cam:not([hidden])");
  await page.goBack();
  await page.waitForSelector("#qb-cam", { state: "hidden" });
  assert.deepEqual(page.errors, []);
  await context.close();
});

test("qibla camera mode: the camera comes back after switching apps, and never stays on in the background", async () => {
  const { page, context } = await device();
  await context.grantPermissions(["camera"], { origin: base.slice(0, -1) });
  await open(page, "#/qibla");
  await page.waitForFunction(() => document.getElementById("qb-deg").textContent !== "—");
  const live = () => page.waitForFunction(() => { const v = document.getElementById("qb-video"); return v.srcObject && v.srcObject.getVideoTracks()[0].readyState === "live"; });
  const setHidden = (h) => page.evaluate((h) => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => h });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (h ? "hidden" : "visible") });
    document.dispatchEvent(new Event("visibilitychange"));
  }, h);
  await page.click("#qb-mode-camera");
  await live();
  await setHidden(true); // switched to another app: camera off
  assert.equal(await page.evaluate(() => document.getElementById("qb-video").srcObject), null);
  await setHidden(false); // back: camera on again without a tap — not a black screen
  await live();
  assert.equal(await page.isVisible("#qb-cam-start"), false);
  // Leave and come back into camera mode: live again.
  await page.click("#qb-cam-exit");
  await page.waitForSelector("#qb-cam", { state: "hidden" });
  await page.click("#qb-mode-camera");
  await live();
  await page.click("#qb-cam-exit");
  await page.waitForSelector("#qb-cam", { state: "hidden" });
  // Slow camera + leaving the page before it starts: no surprise camera, no jump back.
  await page.evaluate(() => {
    const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    window.__streams = [];
    navigator.mediaDevices.getUserMedia = (c) => new Promise((r) => setTimeout(r, 600)).then(() => real(c)).then((s) => { window.__streams.push(s); return s; });
  });
  await page.click("#qb-mode-camera");
  await page.evaluate(() => { location.hash = "#/home"; });
  await page.waitForTimeout(1200);
  assert.equal(new URL(page.url()).hash, "#/home");
  assert.ok(await page.evaluate(() => window.__streams.length && window.__streams.every((s) => s.getTracks().every((t) => t.readyState === "ended"))), "camera stopped");
  assert.deepEqual(page.errors, []);
  await context.close();
});

test("qibla camera mode: denied or unsupported camera is explained, compass keeps working", async () => {
  const { page, context } = await device();
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error("denied"), { name: "NotAllowedError" }));
  });
  await open(page, "#/qibla");
  await page.waitForFunction(() => document.getElementById("qb-deg").textContent !== "—");
  await page.click("#qb-mode-camera");
  await page.waitForFunction(() => /Camera access was denied/.test((document.getElementById("toast") || {}).textContent || ""));
  assert.equal(await page.isHidden("#qb-cam"), true);
  await page.evaluate(() => { delete navigator.mediaDevices; Object.defineProperty(navigator, "mediaDevices", { value: undefined }); });
  await page.click("#qb-mode-camera");
  await page.waitForFunction(() => /isn't supported/.test(document.getElementById("toast").textContent));
  await context.close();
});

/* ═══════════ Guest mode ═══════════ */
test("guest mode: everything works, no account prompts, no account network traffic", async () => {
  const mock = createMock();
  const { page, context } = await device({ mock });
  const supabaseHits = [];
  page.on("request", (r) => { if (/supabase/.test(r.url())) supabaseHits.push(r.url()); });
  for (const v of ["#/home", "#/prayer", "#/qibla", "#/quran", "#/surah/1", "#/duas", "#/dhikr", "#/adhkar", "#/names", "#/learn", "#/calendar", "#/settings", "#/about"]) {
    await open(page, v);
    assert.equal(await page.evaluate(() => !!document.querySelector("dialog[open]")), false, "no dialog on " + v);
  }
  assert.deepEqual(supabaseHits, [], "guests never download the auth client");
  // The one, quiet entry point in the top bar.
  assert.equal(await page.getAttribute("#account-btn", "aria-label"), "Account — sign in (optional)");
  await page.click("#account-btn");
  await page.waitForSelector("#ac-signin");
  assert.match(await page.textContent("#ac-root"), /using SalaamStreet as a guest/);
  await shot(page, "account-guest-mobile");
  assert.deepEqual(page.errors, []);
  await context.close();
});

test("site without account configuration: guest only, explained honestly", async () => {
  const { page, context } = await device();
  await context.route("**/js/config.js", (route) => route.fulfill({ contentType: "text/javascript",
    body: 'window.SS=window.SS||{};SS.CONFIG={supabaseUrl:"",supabaseAnonKey:"",signInMethods:["email"]};' }));
  await open(page, "#/account");
  assert.match(await page.textContent("#ac-root"), /Sign-in isn't available on this copy/);
  assert.equal(await page.$("#ac-signin"), null);
  await context.close();
});

/* ═══════════ Accounts ═══════════ */
async function emailSignIn(page, email, code) {
  await open(page, "#/account");
  await page.click("#ac-signin");
  await page.waitForSelector("#acct-dialog[open] .acct-methods");
  await page.click('[data-method="email"]');
  await page.click("#acct-use-link"); // the emailed-link/code route
  await page.fill("#acct-input", email);
  await page.click("#acct-submit");
  await page.waitForSelector("#acct-input.acct-code");
  await page.fill("#acct-input", code || "123456");
  await page.click("#acct-submit");
}
async function syncNow(page) {
  await page.evaluate(() => SS.account.syncNow());
}

test("accounts: email sign-in migrates guest data, syncs across devices, persists, signs out", async () => {
  const mock = createMock();
  // ── Phone (device A): a guest with a bookmark, a streak and a dark theme.
  const A = await device({ mock, settings: { location: CHICAGO, theme: "dark" } });
  await open(A.page, "#/surah/112");
  await A.page.click('#ayah-2 [data-bm]');
  await A.page.evaluate(() => SS.store.set("dhikr:streak", { current: 3, longest: 7, lastDate: SS.localDate() }));
  // Wrong code first: clear error, still on the code step.
  await emailSignIn(A.page, "amina@example.com", "000000");
  await A.page.waitForFunction(() => /wrong or has expired/.test(document.getElementById("acct-msg").textContent));
  await A.page.fill("#acct-input", "123456");
  await A.page.click("#acct-submit");
  await A.page.waitForSelector("#acct-dialog", { state: "hidden" });
  await A.page.waitForFunction(() => /now in your account/.test((document.getElementById("toast") || {}).textContent || ""));
  assert.equal((await A.page.textContent("#account-avatar")).trim(), "AM");
  const rows = mock.rowsFor("amina@example.com");
  assert.ok(rows.some((r) => r.col === "bm" && r.key === "112:2"), "guest bookmark migrated");
  assert.ok(rows.some((r) => r.col === "pref" && r.key === "theme" && r.value === "dark"), "settings migrated");
  assert.ok(!rows.some((r) => r.key === "location"), "location stays on the device");
  await A.page.waitForSelector(".sync-pill.ok");
  await shot(A.page, "account-member-mobile");

  // ── Laptop (device B): light theme, signs in → gets everything.
  const B = await device({ mock, settings: { theme: "light" }, context: { viewport: { width: 1440, height: 900 } } });
  await emailSignIn(B.page, "amina@example.com");
  await B.page.waitForSelector("#acct-dialog", { state: "hidden" });
  await B.page.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "dark");
  await B.page.waitForSelector("#ac-bm-card .acct-bm");
  assert.match(await B.page.textContent("#ac-bm-card"), /112:2/);
  assert.match(await B.page.textContent("#ac-root"), /Best: 7/);
  // Continue reading on the laptop where the phone left off.
  await A.page.evaluate(() => SS.store.set("quran:lastRead", { surah: 18, ayah: 10, at: Date.now() }));
  await syncNow(A.page);
  await syncNow(B.page);
  await open(B.page, "#/account");
  assert.match(await B.page.textContent(".acct-continue"), /18:10/);
  await shot(B.page, "account-member-desktop");
  // Organise + remove a bookmark on the laptop → gone on the phone.
  await B.page.click('[data-bm-edit="112:2"]');
  await B.page.fill("#ac-bm-note", "Surah Al-Ikhlas — memorise");
  await B.page.click('[data-edit-form] [type="submit"]');
  await syncNow(B.page); await syncNow(A.page);
  assert.equal(await A.page.evaluate(() => SS.store.get("quran:bookmarks")["112:2"].note), "Surah Al-Ikhlas — memorise");
  await B.page.fill("#ac-bm-q", "ikhlas");
  assert.equal(await B.page.locator("#ac-bm-list .acct-bm").count(), 1);
  await B.page.fill("#ac-bm-q", "nothing-matches");
  assert.equal(await B.page.locator("#ac-bm-list .acct-bm").count(), 0);
  await B.page.fill("#ac-bm-q", "");
  await B.page.click('[data-bm-del="112:2"]');
  await syncNow(B.page); await syncNow(A.page);
  assert.equal(await A.page.evaluate(() => (SS.store.get("quran:bookmarks") || {})["112:2"]), undefined);
  // Theme change on the phone reaches the laptop instantly, without a flash.
  await A.page.click("#theme-toggle"); // dark → system(light in tests)
  await A.page.click("#theme-toggle"); // → light
  await syncNow(A.page); await syncNow(B.page);
  await B.page.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "light");

  // ── Persistent session: reload the laptop, still signed in.
  await B.page.reload();
  await B.page.waitForFunction(() => document.getElementById("account-btn").classList.contains("signed-in"));
  // …and the next startup already uses the synced theme from the first frame.
  assert.equal(await B.page.evaluate(() => JSON.parse(localStorage.getItem("salaamstreet:settings")).theme), "light");

  // ── Offline on the phone: change queues, then syncs when back online.
  A.context.setOffline(true);
  mock.state.offlineContexts.add(A.mockId);
  await A.page.evaluate(() => SS.store.set("quran:bookmarks", Object.assign({}, SS.store.get("quran:bookmarks") || {}, { "1:1": { at: Date.now() } })));
  await A.page.evaluate(() => SS.account.syncNow().catch(() => {}));
  await open(A.page, "#/account").catch(() => {});
  await A.page.waitForFunction(() => /Offline/.test(document.querySelector("[data-sync-status]").textContent));
  mock.state.offlineContexts.delete(A.mockId);
  A.context.setOffline(false);
  await A.page.evaluate(() => window.dispatchEvent(new Event("online")));
  await A.page.waitForFunction(() => SS.account.engine.pendingCount() === 0, null, { timeout: 8000 });
  assert.ok(mock.rowsFor("amina@example.com").some((r) => r.key === "1:1" && !r.deleted));

  // ── Sign out, removing data from the laptop.
  await open(B.page, "#/account");
  await B.page.click("#ac-signout");
  await B.page.click("#acct-so-wipe");
  await B.page.waitForFunction(() => !document.getElementById("account-btn").classList.contains("signed-in"));
  assert.equal(await B.page.evaluate(() => SS.store.get("quran:bookmarks")), null);
  assert.equal(await B.page.evaluate(() => localStorage.getItem("ss-auth")), null);
  await B.page.reload();
  await B.page.waitForFunction(() => !document.getElementById("boot"));
  assert.equal(await B.page.evaluate(() => SS.account.signedIn()), false);

  // ── Sign out on the phone but keep data; then a DIFFERENT account signs in → asked first.
  await open(A.page, "#/account");
  await A.page.click("#ac-signout");
  await A.page.click("#acct-so-keep");
  await A.page.waitForFunction(() => !SS.account.signedIn());
  assert.ok(await A.page.evaluate(() => !!SS.store.get("quran:bookmarks")["1:1"]));
  await emailSignIn(A.page, "yusuf@example.com");
  await A.page.waitForSelector("#acct-merge-no");
  await A.page.keyboard.press("Escape"); // can't be dismissed without answering
  assert.equal(await A.page.isVisible("#acct-merge-no"), true);
  await A.page.click("#acct-merge-no");
  await A.page.waitForFunction(() => !SS.store.get("quran:bookmarks"));
  assert.equal(mock.rowsFor("yusuf@example.com").filter((r) => r.col === "bm").length, 0, "nothing leaked into the other account");
  for (const d of [A, B]) assert.deepEqual(d.page.errors, []);
  await A.context.close(); await B.context.close();
});

test("accounts: email + password — create account, wrong password, sign in elsewhere, change password, reset", async () => {
  const mock = createMock();
  const A = await device({ mock });
  await open(A.page, "#/account");
  await A.page.click("#ac-signin");
  await A.page.click('[data-method="email"]');
  await A.page.waitForSelector("#acct-pass");
  // Create account (too-short password is caught first).
  await A.page.click('[data-mode="signup"]');
  await A.page.fill("#acct-email", "zaid@example.com");
  await A.page.fill("#acct-pass", "short");
  await A.page.click("#acct-submit");
  assert.match(await A.page.textContent("#acct-msg"), /at least 8 characters/);
  await A.page.fill("#acct-pass", "bismillah123");
  await A.page.click("#acct-submit");
  await A.page.waitForSelector("#acct-dialog", { state: "hidden" });
  await A.page.waitForFunction(() => SS.account.signedIn());
  await A.page.evaluate(() => SS.store.set("quran:bookmarks", { "36:58": { at: Date.now() } }));
  await A.page.evaluate(() => SS.account.syncNow());
  // Signing up again with the same email explains what to do.
  const B = await device({ mock, context: { viewport: { width: 1280, height: 800 } } });
  await open(B.page, "#/account");
  await B.page.click("#ac-signin");
  await B.page.click('[data-method="email"]');
  await B.page.click('[data-mode="signup"]');
  await B.page.fill("#acct-email", "zaid@example.com");
  await B.page.fill("#acct-pass", "anotherpass1");
  await B.page.click("#acct-submit");
  await B.page.waitForFunction(() => /already an account/.test(document.getElementById("acct-msg").textContent));
  // Wrong password, then right one → same account, bookmark synced.
  await B.page.click('[data-mode="signin"]');
  assert.equal(await B.page.inputValue("#acct-email"), "zaid@example.com"); // kept when switching tabs
  await B.page.fill("#acct-pass", "wrongpass");
  await B.page.click("#acct-submit");
  await B.page.waitForFunction(() => /email or password is wrong/.test(document.getElementById("acct-msg").textContent));
  await B.page.fill("#acct-pass", "bismillah123");
  await B.page.click("#acct-submit");
  await B.page.waitForSelector("#acct-dialog", { state: "hidden" });
  await B.page.waitForSelector("#ac-bm-card .acct-bm");
  assert.match(await B.page.textContent("#ac-bm-card"), /36:58/);
  assert.equal(mock.state.users.size, 1);
  await shot(B.page, "account-password-desktop");
  // Change password while signed in.
  await B.page.click("#ac-password");
  await B.page.fill("#acct-pass", "newpassword9");
  await B.page.click("#acct-submit");
  await B.page.waitForSelector("#acct-dialog", { state: "hidden" });
  assert.equal(mock.userByEmail("zaid@example.com").password, "newpassword9");
  // Forgot password from a signed-out device.
  const C = await device({ mock });
  await open(C.page, "#/account");
  await C.page.click("#ac-signin");
  await C.page.click('[data-method="email"]');
  await C.page.fill("#acct-email", "zaid@example.com");
  await C.page.click("#acct-forgot");
  assert.equal(await C.page.inputValue("#acct-email"), "zaid@example.com");
  await C.page.click("#acct-submit");
  await C.page.waitForFunction(() => /we've sent a link to reset/.test(document.getElementById("acct-body").textContent));
  assert.equal(mock.state.recoverySent, "zaid@example.com");
  await C.page.click("[data-back]");
  await C.page.waitForSelector("#acct-pass");
  for (const d of [A, B, C]) { assert.deepEqual(d.page.errors, []); await d.context.close(); }
});

test("accounts: phone sign-in, validation and linking another method to the same account", async () => {
  const mock = createMock();
  const { page, context } = await device({ mock });
  await open(page, "#/account");
  await page.click("#ac-signin");
  await page.click('[data-method="phone"]');
  await page.fill("#acct-input", "07700 900123"); // missing country code
  await page.click("#acct-submit");
  assert.match(await page.textContent("#acct-msg"), /country code/);
  await page.fill("#acct-input", "+44 7700 900123");
  await page.click("#acct-submit");
  await page.waitForSelector("#acct-input.acct-code");
  assert.match(await page.textContent("#acct-body"), /\+447700900123/);
  assert.equal(await page.isDisabled("#acct-resend"), true); // resend cooldown
  await page.fill("#acct-input", "123456");
  await page.click("#acct-submit");
  await page.waitForSelector("#acct-dialog", { state: "hidden" });
  await page.waitForSelector("#ac-methods");
  // Add an email to the same account (no second account is created).
  await page.click('#ac-methods [data-link="email"]');
  await page.fill("#acct-input", "same.person@example.com");
  await page.click("#acct-submit");
  await page.waitForSelector("#acct-input.acct-code"); // wait for the code step before typing the code
  await page.fill("#acct-input", "123456");
  await page.click("#acct-submit");
  await page.waitForFunction(() => /same\.person@example\.com/.test(document.getElementById("ac-methods").textContent));
  assert.equal(mock.state.users.size, 1);
  // Link Google (OAuth round trip) → still one account, now with three methods.
  await page.click('#ac-methods [data-link="google"]');
  await page.waitForURL(/#\/account/);
  await page.waitForFunction(() => /Remove/.test((document.getElementById("ac-methods") || {}).textContent || ""), null, { timeout: 10000 });
  assert.equal(mock.state.users.size, 1);
  assert.deepEqual([...mock.state.users.values()][0].identities.map((i) => i.provider).sort(), ["email", "google", "phone"]);
  assert.deepEqual(page.errors, []);
  await context.close();
});

test("accounts: Continue with Google and Apple (OAuth + PKCE) and account deletion", async () => {
  const mock = createMock();
  for (const provider of ["google", "apple"]) {
    const { page, context } = await device({ mock });
    await open(page, "#/quran");
    await page.click("#account-btn");
    await page.click("#ac-signin");
    await page.click(`[data-method="${provider}"]`);
    await page.waitForURL(/#\/account/);
    await page.waitForFunction(() => window.SS && SS.account && SS.account.signedIn(), null, { timeout: 10000 });
    assert.doesNotMatch(page.url(), /[?&]code=/, "auth code removed from the address bar");
    const authorize = mock.state.log.find((l) => l.path === "/auth/v1/authorize" && l.search.indexOf("provider=" + provider) > -1);
    assert.match(authorize.search, /code_challenge=/, "PKCE in use");
    assert.match(await page.textContent("#ac-name"), provider === "google" ? /Google Person/ : /Apple Person/);
    if (provider === "apple") {
      await page.click("#ac-delete");
      assert.equal(await page.isDisabled("#acct-del-go"), true);
      await page.check("#acct-del-ok");
      await page.click("#acct-del-go");
      await page.waitForFunction(() => !SS.account.signedIn());
      assert.equal(mock.userByEmail("apple-user@example.com"), null);
    }
    assert.deepEqual(page.errors, []);
    await context.close();
  }
});

test("accounts: a sign-in method that isn't enabled yet gives a clear message", async () => {
  const mock = createMock();
  const { page, context } = await device({ mock });
  mock.state.failNext = { path: "/auth/v1/otp", status: 400, body: { code: 400, error_code: "phone_provider_disabled", msg: "Unsupported phone provider" } };
  await open(page, "#/account");
  await page.click("#ac-signin");
  await page.click('[data-method="phone"]');
  await page.fill("#acct-input", "+15551234567");
  await page.click("#acct-submit");
  await page.waitForFunction(() => /isn't switched on yet/.test(document.getElementById("acct-msg").textContent));
  await context.close();
});

/* ═══════════ Home & MSA ═══════════ */
test("ayah of the day: Listen plays just that ayah in the shared player", async () => {
  const { page, context } = await device();
  await open(page, "#/home");
  await page.waitForSelector("#da-play");
  assert.match(await page.textContent("#da-play"), /Listen/);
  await page.click("#da-play");
  await page.waitForSelector("#audio-bar:not([hidden])");
  assert.match(await page.textContent("#ab-now"), /1:1/);
  assert.deepEqual(await page.evaluate(() => SS.audio.state(1, 1).loaded), true);
  assert.deepEqual(page.errors, []);
  await context.close();
});

test("MSA tab: opening soon page, reachable from the navigation", async () => {
  const { page, context } = await device();
  await open(page, "#/home");
  await page.click("#more-btn");
  await page.click('#more-sheet a[href="#/msa"]');
  await page.waitForSelector("#view-msa:not([hidden])");
  assert.equal(await page.textContent("#msa-h"), "MSA");
  assert.match(await page.textContent("#view-msa"), /Opening soon/);
  assert.match(await page.textContent("#view-msa"), /Neuqua Valley High School \(NVHS\) MSA/);
  assert.equal(await page.getAttribute('#more-btn', "class"), "active"); // More tab lights up
  assert.deepEqual(page.errors, []);
  await context.close();
});

test("layout: no horizontal overflow on phone, tablet and desktop", async () => {
  const mock = createMock();
  for (const vp of [{ width: 320, height: 640 }, { width: 390, height: 844 }, { width: 820, height: 1180 }, { width: 1440, height: 900 }]) {
    const { page, context } = await device({ mock, context: { viewport: vp } });
    for (const v of ["#/account", "#/qibla", "#/settings", "#/home", "#/msa"]) {
      await open(page, v);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(over <= 0, `${v} overflows by ${over}px at ${vp.width}px`);
    }
    if (vp.width === 1440) await shot(page, "home-desktop");
    // Dialogs: centred on tablets/desktops, a bottom sheet on phones.
    await open(page, "#/account");
    await page.click("#ac-signin");
    await page.waitForTimeout(450); // let the open animation finish
    const r = await page.evaluate(() => document.getElementById("acct-dialog").getBoundingClientRect().toJSON());
    if (vp.width >= 600) assert.ok(Math.abs(r.left + r.width / 2 - vp.width / 2) < 2 && r.top > 0, `dialog centred at ${vp.width}px: ${JSON.stringify(r)}`);
    else assert.ok(Math.abs(r.bottom - vp.height) < 2, `bottom sheet at ${vp.width}px: ${JSON.stringify(r)}`);
    await context.close();
  }
});

/* ═══════════ Offline Qur'an (2.6.0) ═══════════ */
async function offlineDevice(opts = {}) {
  const context = await browser.newContext(Object.assign({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, serviceWorkers: "block" }, opts.context || {}));
  const log = [];
  const { net } = await routeQuranApis(context, { log });
  await context.addInitScript(({ s, v }) => {
    if (!sessionStorage.getItem("seeded")) {
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("salaamstreet:settings", JSON.stringify(s));
      localStorage.setItem("salaamstreet:onboarded", "true");
      localStorage.setItem("salaamstreet:seenVersion", JSON.stringify(v));
    }
  }, { s: Object.assign({ location: CHICAGO }, opts.settings || {}), v: VERSION });
  const page = await context.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  return { context, page, log, net };
}

test("offline Qur'an: download text and audio, go offline, read a surah, play across surahs, remove it all", async () => {
  const { context, page, log, net } = await offlineDevice({ settings: { continuousPlay: true } });
  await open(page, "#/settings/offline");
  await page.click('#st-offline [data-act="dl-text"]');
  await page.waitForSelector('#st-offline [data-key="text"] .progress');
  await page.waitForSelector('#st-offline [data-key="text"] .off-done', { timeout: 30000 });
  await page.click('#st-offline details[data-key="surahs"] > summary');
  for (const n of [113, 114]) {
    await page.click(`#st-offline [data-act="dl-audio"][data-arg="${n}"]`);
    await page.waitForSelector(`#st-offline [data-act="rm-audio"][data-arg="${n}"]`, { timeout: 15000 });
  }
  assert.match(await page.textContent('#st-offline [data-key="storage"]'), /Offline Qur'an uses [\d.]+ (KB|MB)/);
  await page.evaluate(() => window.scrollTo(0, document.getElementById("offline-quran").offsetTop - 70));
  await shot(page, "offline-settings-mobile");

  // No connection from here on.
  await context.setOffline(true);
  net.offline = true;
  log.length = 0;
  await page.evaluate(() => { location.hash = "#/quran"; });
  await page.waitForSelector('#qi-grid a[href="#/surah/113"] .off-mark-a');
  await page.evaluate(() => { location.hash = "#/surah/113"; });
  await page.waitForSelector("#ayah-5");
  assert.match(await page.textContent("#ayah-1"), /en\.sahih 113:1/);
  await page.evaluate(() => { location.hash = "#/surah/18"; });
  await page.waitForSelector("#ayah-110");
  await page.evaluate(() => { location.hash = "#/surah/113"; });
  await page.waitForSelector("#ayah-5");
  // Play the last ayah of Al-Falaq: it comes from the device and carries on into An-Nas.
  await page.evaluate(() => SS.audio.start(113, 5, SS.SURAHS[112]));
  await page.waitForFunction(() => document.getElementById("ab-now").textContent.includes("114:1"), null, { timeout: 15000 });
  const playing = await page.evaluate(() => new Promise((resolve) => setTimeout(() => resolve(SS.audio.state(114, 1).playing || SS.audio.state(114, 2).playing), 300)));
  assert.ok(playing, "An-Nas plays offline");
  assert.equal(log.length, 0, "nothing fetched while offline");
  assert.doesNotMatch(await page.textContent("#toast").catch(() => ""), /offline — showing|Couldn't play/);
  await page.click("#ab-close");

  // Remove everything.
  await page.evaluate(() => { location.hash = "#/settings/offline"; });
  await page.click('#st-offline [data-act="rm-all"]');
  await page.waitForFunction(() => !SS.offline.used() && SS.offline.totalBytes() === 0);
  assert.equal(await page.evaluate(() => caches.keys().then((k) => k.filter((n) => n.startsWith("ss-offline")).length)), 0);
  assert.ok(!(await page.evaluate(() => indexedDB.databases().then((l) => l.map((d) => d.name)))).includes("salaamstreet-offline"));
  await page.evaluate(() => { location.hash = "#/surah/18"; }); // read only from the download, never cached elsewhere
  await page.waitForSelector("#sr-list .state.error");
  assert.equal(await page.locator("#ayah-1").count(), 0, "gone from the device");
  assert.deepEqual(page.errors, []);
  await context.close();
});

test("Qur'an PDF: download it, go offline, open it in the viewer, then remove it", async () => {
  site.pdf = testPdf(3);
  try {
    for (const scheme of ["light", "dark"]) {
      const { context, page, net } = await offlineDevice({ context: { serviceWorkers: "allow", colorScheme: scheme } });
      await open(page, "#/quran");
      await page.waitForFunction(() => navigator.serviceWorker.controller || navigator.serviceWorker.ready.then(() => true), null, { timeout: 10000 });
      if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) await open(page, "#/quran");
      await page.waitForSelector("#qi-pdf .pdf-card");
      assert.match(await page.textContent("#qi-pdf"), /Translated by Maulawi Sher Ali · PDF/);
      const download = page.waitForEvent("download");
      await page.click('#qi-pdf [data-act="pdf-dl"]');
      assert.equal((await download).suggestedFilename(), "quran-english-sher-ali.pdf", "a copy is saved to the device");
      await page.waitForSelector('#qi-pdf [data-act="pdf-open"]');
      await page.waitForFunction(() => caches.open("ss-offline-pdf").then((c) => c.keys()).then((k) => k.length >= 4), null, { timeout: 10000 });

      // Offline: the site itself can't be reached; the app comes from the service worker.
      site.down = true;
      net.offline = true;
      await context.setOffline(true);
      await page.reload();
      await page.waitForFunction(() => !document.getElementById("boot"), null, { timeout: 10000 });
      await page.waitForSelector('#qi-pdf [data-act="pdf-open"]');
      await page.click('#qi-pdf [data-act="pdf-open"]');
      await page.waitForFunction(() => document.getElementById("pdf-total").textContent === "3", null, { timeout: 15000 });
      await page.waitForFunction(() => !document.getElementById("pdf-canvas").hidden && document.getElementById("pdf-canvas").width > 0);
      assert.match(await page.textContent("#pdf-credit"), /Maulawi Sher Ali · Source: alislam\.org/);
      await page.click("#pdf-next");
      await page.waitForFunction(() => document.getElementById("pdf-num").value === "2");
      await page.fill("#pdf-num", "3");
      await page.press("#pdf-num", "Enter");
      await page.waitForFunction(() => document.getElementById("pdf-num").value === "3" && document.getElementById("pdf-next").disabled);
      await page.click("#pdf-zoom-in");
      await page.waitForFunction(() => document.getElementById("pdf-zoom").textContent === "125%");
      await page.click("#pdf-zoom");
      await page.click("#pdf-prev");
      await page.waitForTimeout(400);
      await shot(page, "pdf-viewer-" + scheme);
      await page.click("#pdf-close");
      // The last page read is remembered on this device.
      await page.click('#qi-pdf [data-act="pdf-open"]');
      await page.waitForFunction(() => document.getElementById("pdf-num").value === "2", null, { timeout: 10000 });
      await page.click("#pdf-close");

      await page.click('#qi-pdf [data-act="pdf-remove"]');
      await page.waitForFunction(() => !SS.offline.pdf.stored());
      assert.equal(await page.evaluate(() => caches.has("ss-offline-pdf")), false, "the stored copy is gone");
      await page.waitForTimeout(300);
      assert.equal(await page.isHidden("#qi-pdf"), true, "offline and not stored: no card");
      assert.deepEqual(page.errors, []);
      site.down = false;
      await context.close();
    }
  } finally {
    site.pdf = null;
    site.down = false;
  }
});
