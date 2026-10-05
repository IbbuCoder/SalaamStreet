#!/usr/bin/env node
/* SalaamStreet — iOS launch-screen generator.
 *
 * iOS shows an apple-touch-startup-image while an installed SalaamStreet
 * opens. We ship a light and a dark set so the launch screen matches the
 * theme the person chose (index.html picks the right set before first paint).
 *
 *   node tools/build-splash.js              # renders the light and dark sets
 *   node tools/build-splash.js --dark-only  # just icons/splash/*-dark.png
 *
 * Needs Playwright (Chromium). Colours mirror --bg in css/styles.css.
 */
"use strict";
const path = require("path");
const fs = require("fs");
let chromium;
try { ({ chromium } = require("playwright")); } catch (e) {
  ({ chromium } = require(path.join(require("child_process").execSync("npm root -g").toString().trim(), "playwright")));
}

const ROOT = path.resolve(__dirname, "..");
// Every current iPhone and iPad screen. A device with no matching image gets
// a plain white launch screen, even in dark mode — so new sizes go here.
const SIZES = ["440x956@3x", "430x932@3x", "420x912@3x", "402x874@3x", "393x852@3x", "390x844@3x", "428x926@3x",
  "414x896@2x", "375x812@3x", "375x667@2x", "414x736@3x", "320x568@2x",
  "744x1133@2x", "768x1024@2x", "810x1080@2x", "820x1180@2x", "834x1112@2x", "834x1194@2x", "834x1210@2x",
  "1024x1366@2x", "1032x1376@2x"];
// iPads are often held sideways, so they also get a landscape image ("-land").
const LANDSCAPE = SIZES.filter((s) => +s.split("x")[0] >= 744);
const THEMES = {
  light: { bg: "#f6faf7", salaam: "#065f46", street: "#a8841a", shadow: "rgb(6 78 59/.18)" },
  dark: { bg: "#0a100d", salaam: "#6ee7b7", street: "#d9b542", shadow: "rgb(0 0 0/.6)" },
};
const logo = "data:image/png;base64," + fs.readFileSync(path.join(ROOT, "icons/brand/logo-mark-256.png")).toString("base64");

function html(th) {
  return `<!doctype html><html><head><style>
  html,body{margin:0;height:100%;background:${th.bg}}
  body{display:grid;place-items:center;font-family:"DejaVu Sans","Segoe UI",system-ui,sans-serif}
  .g{display:grid;justify-items:center;gap:22px;transform:translateY(-4%)}
  img{width:112px;height:112px;border-radius:26px;box-shadow:0 14px 40px ${th.shadow}}
  b{font-size:27px;font-weight:800;letter-spacing:-.01em;color:${th.salaam}}
  b span{color:${th.street}}
  </style></head><body><div class="g"><img src="${logo}" alt=""><b>Salaam<span>Street</span></b></div></body></html>`;
}

/** Keep index.html's launch-screen tags in step with the images: one light and
    one dark tag per size, chosen by the system appearance (the startup script
    in index.html re-points them when a theme is picked in the app). */
function writeLinks() {
  const file = path.join(ROOT, "index.html");
  const page = fs.readFileSync(file, "utf8");
  const tags = [];
  const add = (size, land) => {
    const [, w, h, dpr] = size.match(/(\d+)x(\d+)@(\d)x/);
    const base = "icons/splash/" + size + (land ? "-land" : "");
    for (const scheme of ["light", "dark"]) {
      tags.push(`  <link rel="apple-touch-startup-image" href="${base}${scheme === "dark" ? "-dark" : ""}.png" data-light="${base}.png" data-dark="${base}-dark.png" data-scheme="${scheme}" ` +
        `media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: ${land ? "landscape" : "portrait"}) and (prefers-color-scheme: ${scheme})" />`);
    }
  };
  SIZES.forEach((s) => add(s, false));
  LANDSCAPE.forEach((s) => add(s, true));
  const lines = page.split("\n");
  const isTag = (l) => /^\s*<link rel="apple-touch-startup-image"/.test(l);
  const first = lines.findIndex(isTag);
  const rest = lines.filter((l) => !isTag(l));
  rest.splice(first, 0, ...tags);
  fs.writeFileSync(file, rest.join("\n"));
  console.log("updated index.html:", tags.length, "launch-screen tags");
}

(async () => {
  const themes = process.argv.includes("--dark-only") ? ["dark"] : ["light", "dark"];
  const browser = await chromium.launch();
  for (const name of themes) {
    const jobs = SIZES.map((s) => [s, false]).concat(LANDSCAPE.map((s) => [s, true]));
    for (const [size, land] of jobs) {
      const [, w, h, dpr] = size.match(/(\d+)x(\d+)@(\d)x/);
      const page = await browser.newPage({ viewport: { width: land ? +h : +w, height: land ? +w : +h }, deviceScaleFactor: +dpr });
      await page.setContent(html(THEMES[name]));
      const out = path.join(ROOT, "icons/splash", size + (land ? "-land" : "") + (name === "dark" ? "-dark" : "") + ".png");
      await page.screenshot({ path: out });
      await page.close();
      console.log("wrote", path.relative(ROOT, out));
    }
  }
  await browser.close();
  writeLinks();
})().catch((e) => { console.error(e); process.exit(1); });
