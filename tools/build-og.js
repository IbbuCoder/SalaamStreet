#!/usr/bin/env node
/* SalaamStreet — share-card generator.
 *
 * Renders icons/og-image.png (1200×630), the picture shown when a SalaamStreet
 * link is shared (iMessage, WhatsApp, Slack…) and in some search results.
 *
 *   node tools/build-og.js
 *
 * Needs Playwright (Chromium). Colours mirror css/styles.css.
 */
"use strict";
const path = require("path");
const fs = require("fs");
let chromium;
try { ({ chromium } = require("playwright")); } catch (e) {
  ({ chromium } = require(path.join(require("child_process").execSync("npm root -g").toString().trim(), "playwright")));
}

const ROOT = path.resolve(__dirname, "..");
const logo = "data:image/png;base64," + fs.readFileSync(path.join(ROOT, "icons/brand/logo-mark-256.png")).toString("base64");
const FEATURES = ["Prayer times", "Qibla finder", "Qur'an with audio", "Hadith & duas", "Dhikr counter"];

const html = `<!doctype html><html><head><style>
  html,body{margin:0;width:1200px;height:630px}
  body{background:#064e3b;color:#fff;font-family:"DejaVu Sans","Segoe UI",system-ui,sans-serif;display:flex;align-items:center;
    padding:0 84px;box-sizing:border-box;gap:64px;position:relative;overflow:hidden}
  body::after{content:"";position:absolute;inset:auto -120px -220px auto;width:620px;height:620px;border-radius:50%;border:2px solid rgb(201 162 39/.25)}
  img{width:236px;height:236px;border-radius:52px;box-shadow:0 24px 60px rgb(0 0 0/.35);flex-shrink:0}
  .t{display:grid;gap:22px}
  h1{margin:0;font-size:84px;line-height:1;font-weight:800;letter-spacing:-.02em}
  h1 span{color:#e3c25a}
  p{margin:0;font-size:34px;line-height:1.3;color:#d1fae5;max-width:700px}
  ul{display:flex;flex-wrap:wrap;gap:12px;margin:6px 0 0;padding:0;list-style:none;max-width:760px}
  li{font-size:24px;font-weight:700;padding:10px 20px;border-radius:999px;background:rgb(255 255 255/.1);border:1px solid rgb(255 255 255/.18)}
  .free{color:#022c22;background:#e3c25a;border-color:#e3c25a}
</style></head><body>
  <img src="${logo}" alt="">
  <div class="t">
    <h1>Salaam<span>Street</span></h1>
    <p>Your free Islamic companion — calm, private, no ads.</p>
    <ul>${FEATURES.map((f) => `<li>${f}</li>`).join("")}<li class="free">Free forever</li></ul>
  </div>
</body></html>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(html);
  const out = path.join(ROOT, "icons/og-image.png");
  await page.screenshot({ path: out });
  await browser.close();
  console.log("wrote", path.relative(ROOT, out));
})().catch((e) => { console.error(e); process.exit(1); });
