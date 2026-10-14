#!/usr/bin/env node
/* SalaamStreet — tools/build-ios-assets.js
   Draws the iOS app's images from the website's own icons, so the app looks
   like the site from the very first frame:

   - AppIcon (1024×1024) from icons/maskable-512.png (full-bleed brand square)
   - LaunchLogo (@1x/@2x/@3x): the site's loading screen (#boot in index.html),
     an 84 pt logo with 20 pt corners and its soft shadow, light and dark
   - NowPlaying (600×600): Lock Screen artwork while the Qur'an is recited

     node tools/build-ios-assets.js

   Needs Playwright (Chromium). Run it only when the website's icons change. */
"use strict";
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const APP = path.join(ROOT, "ios/SalaamStreet/Sources/Assets.xcassets");
const SHARED = path.join(ROOT, "ios/Shared/SharedAssets.xcassets");
const data = (f) => "data:image/png;base64," + fs.readFileSync(path.join(ROOT, f)).toString("base64");
const MASKABLE = data("icons/maskable-512.png");
const MARK = data("icons/brand/logo-mark-256.png");
// The #boot overlay in index.html: 84px logo, 20px corners, theme shadow.
const BOOT = {
  light: "0 10px 30px rgb(6 78 59/.18)",
  dark: "0 10px 30px rgb(0 0 0/.55)",
};

async function shot(browser, html, w, h, scale, out, transparent) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  await page.setContent(html);
  await page.waitForFunction(() => Array.from(document.images).every((i) => i.complete));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out, omitBackground: !!transparent });
  await page.close();
  console.log("wrote", path.relative(ROOT, out));
}

(async () => {
  const browser = await chromium.launch();
  const css = "html,body{margin:0;width:100%;height:100%;background:transparent}body{display:grid;place-items:center}";
  // App icon: no transparency allowed.
  await shot(browser, `<style>${css}img{width:1024px;height:1024px}</style><img src="${MASKABLE}">`, 1024, 1024, 1,
    path.join(APP, "AppIcon.appiconset/AppIcon-1024.png"));
  // Launch logo: 84pt + room for the shadow (132pt canvas), per theme and scale.
  for (const theme of ["light", "dark"]) {
    for (const scale of [1, 2, 3]) {
      await shot(browser, `<style>${css}img{width:84px;height:84px;border-radius:20px;box-shadow:${BOOT[theme]}}</style><img src="${MARK}">`,
        132, 132, scale, path.join(APP, "LaunchLogo.imageset", `LaunchLogo-${theme}@${scale}x.png`), true);
    }
  }
  // Now Playing artwork.
  await shot(browser, `<style>${css}img{width:600px;height:600px}</style><img src="${MASKABLE}">`, 600, 600, 1,
    path.join(SHARED, "NowPlaying.imageset/NowPlaying.png"));
  // Small mark for widgets.
  await shot(browser, `<style>${css}img{width:64px;height:64px;border-radius:15px}</style><img src="${MARK}">`, 64, 64, 3,
    path.join(SHARED, "LogoMark.imageset/LogoMark@3x.png"), true);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
