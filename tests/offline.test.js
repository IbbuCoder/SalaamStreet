/* Offline Qur'an (js/offline.js) in headless Chromium, with the real
   IndexedDB and Cache API: storage, the read-path fallback, resuming after
   a dropped connection or a closed tab, quota errors, and the Qur'an PDF
   card staying hidden while the PDF file is missing.
   Run: node --test tests/offline.test.js */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { routeQuranApis, testPdf } = require("./helpers/offline-fixtures");

const ROOT = path.resolve(__dirname, "..");
const VERSION = require("../package.json").version;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".png": "image/png", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".pdf": "application/pdf" };
const PDF_PATH = "/files/quran-english-sher-ali.pdf";
let server, base, browser;
const site = { pdf: null }; // a test PDF served at the real path, for one test at a time

function serve() {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (p === PDF_PATH && site.pdf) {
        res.writeHead(200, { "content-type": "application/pdf", "content-length": site.pdf.length, "cache-control": "no-store" });
        return res.end(req.method === "HEAD" ? undefined : site.pdf);
      }
      if (p.endsWith("/")) p += "index.html";
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404, { "content-type": "text/plain" }); return res.end("nf"); }
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
      fs.createReadStream(file).pipe(res);
    }).listen(0, "127.0.0.1", () => { base = "http://127.0.0.1:" + server.address().port + "/"; resolve(); });
  });
}

async function device(opts = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const api = await routeQuranApis(context, opts);
  if (opts.config) await context.route("**/js/config.js", (route) => route.fulfill({ contentType: "text/javascript", body: opts.config }));
  await context.addInitScript(({ v }) => {
    if (!sessionStorage.getItem("seeded")) {
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("salaamstreet:settings", JSON.stringify({ location: { lat: 41.88, lng: -87.63, label: "Chicago", consent: "manual" } }));
      localStorage.setItem("salaamstreet:onboarded", "true");
      localStorage.setItem("salaamstreet:seenVersion", JSON.stringify(v));
    }
  }, { v: VERSION });
  if (opts.init) await context.addInitScript(opts.init);
  const page = await context.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  return { context, page, api };
}
async function open(page, hash) {
  await page.goto(base + "index.html" + hash);
  await page.waitForFunction(() => !document.getElementById("boot"), null, { timeout: 8000 });
}
const editionCount = (page, ed) => page.evaluate((e) => SS.offline.packCount("text:" + e), ed);
const waitText = (page, eds, timeout = 30000) => page.waitForFunction((list) => list.every((e) => SS.offline.packCount("text:" + e) === 114) && !SS.offline.job("text"), eds, { timeout });
const dbNames = (page) => page.evaluate(() => indexedDB.databases().then((l) => l.map((d) => d.name)));

test.before(async () => { await serve(); browser = await chromium.launch(); });
test.after(async () => { await browser.close(); server.close(); });

test("without a download nothing changes: no database, the API and localStorage cache as before", async () => {
  const log = [];
  const { context, page } = await device({ log });
  await open(page, "#/surah/2");
  await page.waitForSelector("#ayah-286");
  assert.ok(log.includes("text 2 quran-uthmani,en.sahih,en.transliteration"), "fetched from the API");
  assert.ok(await page.evaluate(() => !!SS.store.get("cache:surah:2")), "cached in localStorage as before");
  assert.ok(!(await dbNames(page)).includes("salaamstreet-offline"), "no offline database for people who never download");
  // A surah already cached in localStorage still opens with no connection.
  await context.setOffline(true);
  await page.evaluate(() => { location.hash = "#/surah/1"; });
  await page.evaluate(() => { location.hash = "#/surah/2"; });
  await page.waitForSelector("#ayah-286");
  assert.deepEqual(page.errors, []);
  await context.close();
});

test("text download: all 114 surahs into IndexedDB, at most 4 requests at a time, read offline first", async () => {
  const log = [], stats = { active: 0, max: 0 };
  const { context, page } = await device({ log, stats, delay: 15 });
  await open(page, "#/settings/offline");
  await page.click('#st-offline [data-act="dl-text"]');
  await waitText(page, ["quran-uthmani", "en.sahih", "en.transliteration"]);
  const textCalls = log.filter((l) => l.startsWith("text "));
  assert.equal(textCalls.length, 114, "one request per surah");
  assert.ok(stats.max <= 4 && stats.max >= 2, "small parallel batches: " + stats.max);
  // Stored compactly: the ayah texts, per edition and surah.
  const stored = await page.evaluate(() => new Promise((resolve) => {
    const req = indexedDB.open("salaamstreet-offline");
    req.onsuccess = () => {
      const g = req.result.transaction("text").objectStore("text").get("quran-uthmani/2");
      g.onsuccess = () => resolve({ n: g.result.length, first: g.result[0] });
    };
  }));
  assert.deepEqual(stored, { n: 286, first: "quran-uthmani 2:1" });
  await page.waitForSelector('#st-offline [data-key="text"] .off-done');
  // Offline store first: no API call, and nothing written to localStorage.
  log.length = 0;
  await open(page, "#/surah/18");
  await page.waitForSelector("#ayah-110");
  assert.equal(log.filter((l) => l.startsWith("text ")).length, 0);
  assert.equal(await page.evaluate(() => SS.store.get("cache:surah:18")), null);
  assert.match(await page.textContent("#ayah-10"), /en\.sahih 18:10/);
  // The Ayah of the Day comes from the download too.
  log.length = 0;
  const a = await page.evaluate(() => SS.api.ayah(SS.globalAyahNumber(2, 255)));
  assert.equal(a.arabic, "quran-uthmani 2:255");
  assert.equal(a.surah.number, 2);
  assert.equal(log.length, 0);
  // Download state never syncs to an account.
  assert.deepEqual(await page.evaluate(() => ["offline:used", "offline:pdf", "offline:persist", "pdf:lastPage"].map((k) => !!(SS.store.watch && SS.store.watch(k)))), [false, false, false, false]);
  // Another translation: only the missing edition is fetched.
  log.length = 0;
  await page.evaluate(() => { location.hash = "#/settings/offline"; });
  await page.click('#st-offline details[data-key="tr"] > summary');
  await page.click('#st-offline [data-act="add-tr"][data-arg="fr.hamidullah"]');
  await page.waitForFunction(() => SS.offline.packCount("text:fr.hamidullah") === 114 && !SS.offline.job("tr:fr.hamidullah"));
  assert.ok(log.every((l) => / fr\.hamidullah$/.test(l)), "only the new translation: " + log[0]);
  // Switching to a translation that isn't downloaded falls back to the API.
  await page.evaluate(() => SS.store.saveSettings({ translation: "de.bubenheim" }));
  log.length = 0;
  await open(page, "#/surah/3");
  await page.waitForSelector("#ayah-200");
  assert.equal(log.filter((l) => l.startsWith("text 3 ")).length, 1);
  assert.deepEqual(page.errors, []);
  await context.close();
});

test("a failed request is retried; a lost connection pauses with a message and carries on when back online", async () => {
  const log = [];
  let failed = 0;
  const { context, page } = await device({ log, delay: 25, fail: (kind, key, attempt) => kind === "text" && key.startsWith("7 ") && attempt === 1 && ++failed });
  await open(page, "#/settings/offline");
  await page.evaluate(() => { SS.offline.config.retryDelay = 50; });
  await page.click('#st-offline [data-act="dl-text"]');
  await page.waitForFunction(() => SS.offline.packCount("text:quran-uthmani") >= 30);
  await context.setOffline(true);
  await page.waitForFunction(() => SS.offline.job("text") && SS.offline.job("text").status === "offline");
  await page.waitForSelector('#st-offline [data-key="text"] .off-job.is-error');
  assert.match(await page.textContent('#st-offline [data-key="text"]'), /Connection lost/);
  const before = await editionCount(page, "quran-uthmani");
  assert.ok(before < 114);
  await context.setOffline(false);
  await waitText(page, ["quran-uthmani", "en.sahih", "en.transliteration"]);
  assert.equal(failed, 1, "surah 7 failed once");
  const per = {};
  log.filter((l) => l.startsWith("text ")).forEach((l) => { const n = l.split(" ")[1]; per[n] = (per[n] || 0) + 1; });
  assert.equal(Object.keys(per).length, 114);
  const twice = Object.keys(per).filter((n) => per[n] > 1);
  assert.ok(twice.length <= 4, "only requests cut off by the drop are repeated: " + twice);
  await page.waitForSelector('#st-offline [data-key="text"] .off-done');
  assert.deepEqual(page.errors, []);
  await context.close();
});

test("closing the tab mid-download: it resumes on the next visit where it stopped", async () => {
  const log = [];
  const { context, page } = await device({ log, delay: 40 });
  await open(page, "#/quran");
  await page.evaluate(() => SS.offline.downloadText());
  await page.waitForFunction(() => SS.offline.packCount("text:quran-uthmani") >= 20);
  await page.goto("about:blank"); // tab closed
  const done = log.filter((l) => l.startsWith("text ")).length;
  const page2 = await context.newPage();
  await open(page2, "#/quran");
  // The Qur'an page shows the download carrying on.
  await page2.waitForSelector("#qi-offline .off-widget .progress");
  await waitText(page2, ["quran-uthmani", "en.sahih", "en.transliteration"]);
  const total = log.filter((l) => l.startsWith("text ")).length;
  assert.ok(done >= 20 && total <= 114 + 4, `resumed rather than restarted (${done} then ${total})`);
  await page2.waitForSelector("#qi-offline .off-widget");
  assert.match(await page2.textContent("#qi-offline"), /available offline/);
  assert.ok(await page2.locator('#qi-grid a[href="#/surah/2"] .off-mark-t').count(), "surah list shows downloaded ✓");
  await context.close();
});

test("pause, resume and cancel; cancel removes what wasn't finished", async () => {
  const { context, page } = await device({ delay: 30 });
  await open(page, "#/settings/offline");
  await page.click('#st-offline [data-act="dl-tafsir"]');
  await page.waitForFunction(() => SS.offline.packCount("tafsir") >= 5);
  await page.click('#st-offline [data-act="pause"][data-arg="tafsir"]');
  await page.waitForFunction(() => SS.offline.job("tafsir").status === "paused");
  const paused = await page.evaluate(() => SS.offline.packCount("tafsir"));
  await page.waitForTimeout(300);
  assert.ok((await page.evaluate(() => SS.offline.packCount("tafsir"))) <= paused + 4, "nothing new starts while paused");
  await page.click('#st-offline [data-act="resume"][data-arg="tafsir"]');
  await page.waitForFunction(() => SS.offline.packCount("tafsir") >= 30);
  await page.click('#st-offline [data-act="cancel"][data-arg="tafsir"]');
  await page.waitForFunction(() => !SS.offline.job("tafsir") && SS.offline.packCount("tafsir") === 0);
  await page.waitForSelector('#st-offline [data-act="dl-tafsir"]');
  // And a full tafsir download is read offline by the tafsir dialog's API.
  await page.click('#st-offline [data-act="dl-tafsir"]');
  await page.waitForFunction(() => SS.offline.packCount("tafsir") === 114 && !SS.offline.job("tafsir"), null, { timeout: 30000 });
  await context.setOffline(true);
  const r = await page.evaluate(() => SS.api.tafsir(2, 255));
  assert.equal(r.text, "Offline commentary for 2:255");
  assert.deepEqual(page.errors, []);
  await context.close();
});

test("a full disk stops the download with a clear message, never silently", async () => {
  const init = () => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (v, k) {
      if (typeof k === "string" && /\/(1[0-9])$/.test(k)) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      return put.apply(this, arguments);
    };
    const cput = Cache.prototype.put;
    Cache.prototype.put = function (req) {
      if (/\/audio\//.test(String(req.url || req))) return Promise.reject(new DOMException("The quota has been exceeded.", "QuotaExceededError"));
      return cput.apply(this, arguments);
    };
  };
  const { context, page } = await device({ init });
  await open(page, "#/settings/offline");
  await page.click('#st-offline [data-act="dl-text"]');
  await page.waitForFunction(() => SS.offline.job("text") && SS.offline.job("text").status === "error");
  assert.equal(await page.evaluate(() => SS.offline.job("text").reason), "quota");
  await page.waitForSelector('#st-offline [data-key="text"] .off-job.is-error');
  assert.match(await page.textContent('#st-offline [data-key="text"]'), /Not enough storage space/);
  assert.match(await page.textContent("#toast"), /Not enough storage space/);
  // Audio goes to the Cache API: the same message.
  await page.evaluate(() => SS.offline.cancel("text"));
  await page.evaluate(() => SS.offline.downloadAudio("ar.alafasy", [1]));
  await page.waitForFunction(() => SS.offline.job("audio:ar.alafasy") && SS.offline.job("audio:ar.alafasy").status === "error");
  assert.equal(await page.evaluate(() => SS.offline.job("audio:ar.alafasy").reason), "quota");
  await context.close();
});

test("audio: stored per surah in the Cache API, played from the device, removed per surah", async () => {
  const log = [];
  const { context, page } = await device({ log });
  await open(page, "#/settings/offline");
  await page.click('#st-offline details[data-key="surahs"] > summary');
  await page.click('#st-offline [data-act="dl-audio"][data-arg="112"]');
  await page.waitForFunction(() => SS.offline.hasAudio("ar.alafasy", 112) && !SS.offline.job("audio:ar.alafasy"));
  assert.equal(log.filter((l) => l.startsWith("audio ")).length, 4 + 1, "4 ayahs (+1 bitrate probe)");
  const keys = await page.evaluate(() => caches.open("ss-offline-audio").then((c) => c.keys()).then((k) => k.map((r) => r.url)));
  assert.equal(keys.length, 4);
  const url = await page.evaluate(() => SS.offline.audioUrl("ar.alafasy", 112, 1));
  assert.match(url, /^blob:/);
  assert.ok(await page.evaluate(() => SS.offline.estimate.audio("ar.alafasy", [2]) > SS.offline.estimate.audio("ar.alafasy", [112])), "sizes are estimated per surah");
  await page.click('#st-offline [data-act="rm-audio"][data-arg="112"]');
  await page.waitForFunction(() => !SS.offline.hasAudio("ar.alafasy", 112));
  assert.equal((await page.evaluate(() => caches.open("ss-offline-audio").then((c) => c.keys()))).length, 0);
  await context.close();
});

test("Qur'an PDF card: hidden while the file is missing or not configured, shown with its size when present", async () => {
  site.pdf = null;
  let d = await device();
  await open(d.page, "#/settings/offline");
  await d.page.waitForSelector('#st-offline [data-key="storage"]');
  await d.page.waitForTimeout(300);
  assert.equal(await d.page.locator("#st-offline .pdf-card").count(), 0, "settings: no card without the file");
  await d.page.evaluate(() => { location.hash = "#/quran"; });
  await d.page.waitForTimeout(300);
  assert.equal(await d.page.isHidden("#qi-pdf"), true, "Qur'an page: no card without the file");
  await d.context.close();

  site.pdf = testPdf(2);
  d = await device({ config: 'window.SS=window.SS||{};SS.CONFIG={supabaseUrl:"",supabaseAnonKey:"",signInMethods:[]};SS.QURAN_PDF="";' });
  await open(d.page, "#/quran");
  await d.page.waitForTimeout(300);
  assert.equal(await d.page.isHidden("#qi-pdf"), true, "no card while the config value is empty");
  await d.context.close();

  d = await device();
  await open(d.page, "#/quran");
  await d.page.waitForSelector("#qi-pdf .pdf-card");
  const text = await d.page.textContent("#qi-pdf");
  assert.match(text, /The Holy Qur'ān/);
  assert.match(text, /Maulawi Sher Ali/);
  assert.match(text, /alislam\.org/);
  assert.match(text, new RegExp("PDF · " + site.pdf.length + "|PDF · 1 KB"));
  site.pdf = null;
  await d.context.close();
});
