#!/usr/bin/env node
/* SalaamStreet — tools/build-ios-webapp.js
   Copies the website's app shell into the iOS app (ios/SalaamStreet/WebApp/)
   and downloads its Google Fonts so the app works with no connection.

   The iOS app runs this exact copy of the website inside a WKWebView. It
   never updates itself from salaamstreet.com, so run this after every website
   change that should reach the app, then rebuild the app in Xcode:

     node tools/build-ios-webapp.js            # copy files + download fonts
     node tools/build-ios-webapp.js --offline  # copy files, keep the fonts already there
     node tools/build-ios-webapp.js --check    # exit 1 if WebApp/ is out of date (no writes)

   What is copied: index.html, css/, js/ (with js/lang, js/modes, js/vendor),
   icons/ (without the PWA launch images in icons/splash), the two web
   manifests and the Qur'an PDF in files/. The SEO pages (surah/, duas/, ...),
   widget/, sw.js, tests, docs and tools are not needed: the app opens those
   links on salaamstreet.com instead.

   The only change made to the copied files: index.html loads the bundled
   fonts (fonts/fonts.css) instead of fonts.googleapis.com. WebApp/BUILD.json
   records a SHA-256 of every file so tests can check the copy is current. */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const https = require("https");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "ios", "SalaamStreet", "WebApp");
const args = process.argv.slice(2);
const CHECK = args.includes("--check");
const OFFLINE = args.includes("--offline");

const FILES = ["index.html", "manifest.webmanifest", "manifest-dark.webmanifest", "files/quran-english-sher-ali.pdf"];
const DIRS = ["css", "js", "icons"];
const SKIP = [/^icons\/splash\//, /(^|\/)\.DS_Store$/];

const GOOGLE_FONTS_CSS = "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Scheherazade+New:wght@400;700&family=Amiri:wght@400;700&display=swap";
// Safari's user agent: Google serves WOFF2 with unicode-range subsets to it.
const SAFARI_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

function walk(rel) {
  const abs = path.join(ROOT, rel);
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    const r = rel + "/" + e.name;
    return e.isDirectory() ? walk(r) : [r];
  });
}
function sha(buf) { return crypto.createHash("sha256").update(buf).digest("hex"); }

/** The website files that make up the app shell, relative to the repo root. */
function shellFiles() {
  const list = FILES.slice();
  DIRS.forEach((d) => list.push(...walk(d)));
  return list.filter((f) => !SKIP.some((re) => re.test(f))).sort();
}

/** index.html for the app: the Google Fonts stylesheet and its preconnects point at the bundled copy. */
function transformIndex(html) {
  const link = '<link href="' + GOOGLE_FONTS_CSS + '" rel="stylesheet" />';
  if (!html.includes(link)) throw new Error("index.html: the Google Fonts <link> changed; update GOOGLE_FONTS_CSS in tools/build-ios-webapp.js");
  return html
    .replace(link, '<link href="fonts/fonts.css" rel="stylesheet" />')
    .replace(/\s*<link rel="preconnect" href="https:\/\/fonts\.(googleapis|gstatic)\.com"( crossorigin)? \/>/g, "");
}

function get(url, binary) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": SAFARI_UA } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(get(new URL(res.headers.location, url).toString(), binary));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error("HTTP " + res.statusCode + " " + url)); }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => { const b = Buffer.concat(chunks); resolve(binary ? b : b.toString("utf8")); });
    }).on("error", reject);
  });
}

/** Downloads the font CSS and every WOFF2 it uses; returns { "fonts/…": Buffer }. */
async function fetchFonts() {
  const css = await get(GOOGLE_FONTS_CSS);
  const out = {};
  const names = new Map();
  let local = css;
  const urls = [...new Set([...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map((m) => m[1]))];
  if (!urls.length) throw new Error("No font files in the Google Fonts CSS");
  for (const u of urls) {
    const fam = u.split("/s/")[1].split("/")[0];
    const name = fam + "-" + sha(Buffer.from(u)).slice(0, 10) + ".woff2";
    names.set(u, name);
    out["fonts/" + name] = await get(u, true);
  }
  for (const [u, name] of names) local = local.split(u).join(name);
  out["fonts/fonts.css"] = Buffer.from("/* Bundled copy of the website's Google Fonts (tools/build-ios-webapp.js). */\n" + local);
  return out;
}

function existingFonts() {
  const dir = path.join(OUT, "fonts");
  if (!fs.existsSync(dir)) return null;
  const out = {};
  fs.readdirSync(dir).forEach((f) => { out["fonts/" + f] = fs.readFileSync(path.join(dir, f)); });
  return out["fonts/fonts.css"] ? out : null;
}

/** Everything WebApp/ should contain: { relPath: Buffer }. */
async function expected() {
  const want = {};
  shellFiles().forEach((f) => {
    let buf = fs.readFileSync(path.join(ROOT, f));
    if (f === "index.html") buf = Buffer.from(transformIndex(buf.toString("utf8")));
    want[f] = buf;
  });
  const fonts = OFFLINE || CHECK ? existingFonts() : await fetchFonts();
  if (!fonts) throw new Error("No bundled fonts yet: run without --offline/--check once (needs fonts.googleapis.com)");
  Object.assign(want, fonts);
  const version = (fs.readFileSync(path.join(ROOT, "js/content.js"), "utf8").match(/SS\.VERSION = "([^"]+)"/) || [])[1] || "";
  const manifest = { note: "Generated by tools/build-ios-webapp.js. Do not edit files here: edit the website and run the script again.", websiteVersion: version, files: {} };
  Object.keys(want).sort().forEach((f) => { manifest.files[f] = sha(want[f]); });
  want["BUILD.json"] = Buffer.from(JSON.stringify(manifest, null, 1) + "\n");
  return want;
}

function currentFiles() {
  if (!fs.existsSync(OUT)) return [];
  const walkOut = (rel) => fs.readdirSync(path.join(OUT, rel), { withFileTypes: true }).flatMap((e) => {
    const r = rel ? rel + "/" + e.name : e.name;
    return e.isDirectory() ? walkOut(r) : [r];
  });
  return walkOut("");
}

(async function main() {
  const want = await expected();
  const have = currentFiles();
  const stale = Object.keys(want).filter((f) => !fs.existsSync(path.join(OUT, f)) || !fs.readFileSync(path.join(OUT, f)).equals(want[f]));
  const extra = have.filter((f) => !(f in want));
  if (CHECK) {
    if (stale.length || extra.length) {
      console.error("ios/SalaamStreet/WebApp is out of date. Run: node tools/build-ios-webapp.js");
      stale.slice(0, 20).forEach((f) => console.error("  changed: " + f));
      extra.slice(0, 20).forEach((f) => console.error("  extra:   " + f));
      process.exit(1);
    }
    console.log("ios/SalaamStreet/WebApp is up to date (" + Object.keys(want).length + " files).");
    return;
  }
  extra.forEach((f) => fs.unlinkSync(path.join(OUT, f)));
  stale.forEach((f) => {
    fs.mkdirSync(path.dirname(path.join(OUT, f)), { recursive: true });
    fs.writeFileSync(path.join(OUT, f), want[f]);
  });
  const bytes = Object.values(want).reduce((n, b) => n + b.length, 0);
  console.log("WebApp: " + Object.keys(want).length + " files, " + (bytes / 1048576).toFixed(1) + " MB (" + stale.length + " written, " + extra.length + " removed).");
})().catch((e) => { console.error(e.message || e); process.exit(1); });
