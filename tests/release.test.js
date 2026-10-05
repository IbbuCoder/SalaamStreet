/* Release checks: things that are easy to forget when shipping a version.
   Run: node --test tests/release.test.js */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

// content.js and i18n.js are browser scripts; give them just enough of a window.
const sandbox = { console };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(read("js/content.js"), sandbox);
vm.runInContext(read("js/i18n.js"), sandbox);
const SS = sandbox.SS;

test("version is the same in package.json, the app and the newest release notes", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(SS.VERSION, pkg.version);
  assert.equal(SS.CHANGELOG[0].v, pkg.version);
  assert.ok(SS.CHANGELOG[0].items.length > 0, "release notes list what changed");
  for (const item of SS.CHANGELOG[0].items) assert.ok(item.en && item.ar, "every note has English and Arabic: " + JSON.stringify(item));
});

test("the Qur'an PDF the app offers is in files/ with the size the card shows", () => {
  const box = { console };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(read("js/config.js"), box);
  const file = path.join(ROOT, box.SS.QURAN_PDF);
  assert.ok(fs.existsSync(file), "missing: " + box.SS.QURAN_PDF);
  assert.equal(fs.statSync(file).size, box.SS.QURAN_PDF_INFO.bytes, "SS.QURAN_PDF_INFO.bytes matches the file");
  assert.equal(fs.readFileSync(file).subarray(0, 5).toString(), "%PDF-");
});

test("light and dark manifests differ only in colour, and match the page backgrounds", () => {
  const light = JSON.parse(read("manifest.webmanifest"));
  const dark = JSON.parse(read("manifest-dark.webmanifest"));
  const css = read("css/styles.css");
  const bg = (sel) => css.match(new RegExp(sel + "\\s*\\{[^}]*?--bg:(#[0-9a-f]{6})"))[1];
  assert.equal(light.background_color, bg(":root"));
  assert.equal(light.theme_color, bg(":root"));
  assert.equal(dark.background_color, bg('html\\[data-theme="dark"\\]'));
  assert.equal(dark.theme_color, bg('html\\[data-theme="dark"\\]'));
  const strip = (m) => Object.assign({}, m, { background_color: "", theme_color: "" });
  assert.deepEqual(strip(dark), strip(light));
  assert.equal(light.id, "./", "a fixed id keeps installed apps the same app whichever manifest they read");
});

test("every file the offline cache lists exists", () => {
  const shell = read("sw.js").match(/var SHELL = \[([\s\S]*?)\];/)[1].match(/"([^"]+)"/g).map((s) => s.slice(1, -1));
  for (const f of shell) {
    if (f === "./") continue;
    assert.ok(fs.existsSync(path.join(ROOT, f)), "sw.js caches a missing file: " + f);
  }
});

test("every data-i18n key in the page has English text", () => {
  const keys = new Set([...read("index.html").matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]));
  const missing = [...keys].filter((k) => SS.i18n.t(k) === k);
  assert.deepEqual(missing, []);
});

test("every interface language has every English line (drafts included)", () => {
  const src = read("js/i18n.js");
  const en = Object.keys(Object.fromEntries([...src.slice(src.indexOf("en: {"), src.indexOf("\n    ar: {"))
    .matchAll(/"([a-zA-Z0-9_.]+)":/g)].map((m) => [m[1], 1])));
  const ar = Object.keys(Object.fromEntries([...src.slice(src.indexOf("\n    ar: {"))
    .matchAll(/"([a-zA-Z0-9_.]+)":/g)].map((m) => [m[1], 1])));
  assert.deepEqual(en.filter((k) => !ar.includes(k)), [], "missing in Arabic");
  for (const code of ["ur", "bn", "id", "tr", "fr"]) {
    let dict = null;
    const box = { SS: { i18n: { register: (c, d) => { dict = d; } } } };
    vm.runInNewContext(read("js/lang/" + code + ".js"), box);
    const missing = en.filter((k) => !(k in dict));
    assert.deepEqual(missing, [], "missing in " + code);
    for (const k of en) {
      const ph = (s) => (s.match(/\{[a-z]+\}/g) || []).sort().join();
      assert.equal(ph(dict[k]), ph(SS.i18n.t(k)), code + " " + k + " keeps its {placeholders}");
    }
  }
});

test("search engines: every public page has a title, description, canonical URL, share image and valid structured data", () => {
  const sitemap = read("sitemap.xml");
  const urls = [...sitemap.matchAll(/<loc>https:\/\/salaamstreet\.com\/([^<]*)<\/loc>/g)].map((m) => m[1]);
  assert.ok(urls.includes("qibla/"), "the Qibla landing page is in the sitemap");
  for (const u of urls) {
    const html = read(u + "index.html");
    const where = "/" + u;
    assert.match(html, /<title>[^<]{10,}<\/title>/, where + " title");
    assert.match(html, /<meta name="description" content="[^"]{50,}"/, where + " description");
    assert.match(html, new RegExp('<link rel="canonical" href="https://salaamstreet\\.com/' + u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '"'), where + " canonical");
    assert.match(html, /property="og:image" content="https:\/\/salaamstreet\.com\/icons\/og-image\.png"/, where + " share image");
    assert.match(html, /rel="icon" href="[^"]*icon-192\.png"/, where + " a favicon big enough for Google (48px+)");
    const ld = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) => JSON.parse(m[1]));
    assert.ok(ld.length, where + " structured data");
  }
  assert.match(read("404.html"), /<meta name="robots" content="noindex"/);
});

test("city pages show the same Qibla direction as the app's compass", () => {
  const box = { localStorage: { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 }, console };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(read("js/core.js"), box);
  const coords = { chicago: [41.8781, -87.6298], london: [51.5074, -0.1278], jakarta: [-6.2088, 106.8456], sydney: [-33.8688, 151.2093] };
  for (const [city, [lat, lng]] of Object.entries(coords)) {
    const shown = parseFloat(read("prayer-times/" + city + "/index.html").match(/the Qibla is <b>([\d.]+)°<\/b>/)[1]);
    assert.ok(Math.abs(shown - box.SS.qiblaBearing(lat, lng)) < 0.06, city + ": " + shown);
  }
});

test("AI assistants: llms.txt and the facts page agree with the app and name the founders", () => {
  const llms = read("llms.txt");
  assert.match(llms, /^# SalaamStreet\n\n> /, "llms.txt format: title, then a one-line summary");
  assert.match(llms, /founded by Ibrahim/);
  assert.match(llms, /his father, Aquil/);
  assert.match(llms, new RegExp("Current version: " + SS.VERSION.replace(/\./g, "\\.")));
  const facts = read("facts/index.html");
  assert.match(facts, /his father, Aquil/);
  const ld = JSON.parse(facts.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
  const pageLd = ld["@graph"].find((n) => [].concat(n["@type"]).includes("FAQPage"));
  assert.ok(pageLd.mainEntity.length >= 5, "FAQ questions");
  assert.ok(pageLd.mainEntity.some((q) => /Who made SalaamStreet/.test(q.name) && /Aquil/.test(q.acceptedAnswer.text)));
  assert.match(read("robots.txt"), /User-agent: GPTBot\nAllow: \//);
  assert.match(read("index.html"), /"founder":\{"@type":"Person","name":"Ibrahim"/);
});
