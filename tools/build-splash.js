#!/usr/bin/env node
/* SalaamStreet — iOS launch-screen generator.
 *
 * iOS shows an apple-touch-startup-image while an installed SalaamStreet
 * opens. We ship a light and a dark set so the launch screen matches the
 * theme the person chose (index.html picks the right set before first paint).
 *
 *   node tools/build-splash.js          # renders icons/splash/*-dark.png
 *   node tools/build-splash.js --light  # also re-renders the light set
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
const SIZES = ["430x932@3x", "393x852@3x", "390x844@3x", "428x926@3x", "414x896@2x", "375x812@3x",
  "375x667@2x", "414x736@3x", "820x1180@2x", "834x1194@2x", "1024x1366@2x", "768x1024@2x"];
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

(async () => {
  const themes = process.argv.includes("--light") ? ["light", "dark"] : ["dark"];
  const browser = await chromium.launch();
  for (const name of themes) {
    for (const size of SIZES) {
      const [, w, h, dpr] = size.match(/(\d+)x(\d+)@(\d)x/);
      const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr });
      await page.setContent(html(THEMES[name]));
      const out = path.join(ROOT, "icons/splash", size + (name === "dark" ? "-dark" : "") + ".png");
      await page.screenshot({ path: out });
      await page.close();
      console.log("wrote", path.relative(ROOT, out));
    }
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
