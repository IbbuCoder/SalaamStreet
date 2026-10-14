/* SalaamStreet — build-ios-assets.js
   Draws the SalaamStreet mark as a vector (the same eight-point star as
   icons/icon-512.png) and renders the iOS app icon, the logo image set, the
   Now Playing artwork and the launch colours into ios/…/Assets.xcassets.

     node tools/build-ios-assets.js            (needs the dev dependency playwright)
*/
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const GREEN = "#0B4A31", MINT = "#7FD9A8";

/** An eight-point star: a square and the same square turned 45°. */
function star(cx, cy, r, fill, stroke, sw, round) {
  const sq = (rot) => {
    const pts = [];
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI / 4) + rot + i * Math.PI / 2;
      pts.push((cx + r * Math.cos(a)).toFixed(2) + "," + (cy + r * Math.sin(a)).toFixed(2));
    }
    return `<polygon points="${pts.join(" ")}" fill="${fill}" stroke="${stroke || fill}" stroke-width="${sw || 0}" stroke-linejoin="${round ? "round" : "miter"}"/>`;
  };
  return sq(0) + sq(Math.PI / 4);
}

/** The mark on a square canvas of `size`; `bg` false = transparent. */
function markSvg(size, bg) {
  const c = size / 2, s = size / 512;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${bg ? `<rect width="${size}" height="${size}" fill="${GREEN}"/>` : ""}
  ${star(c, c, 196 * s, MINT, MINT, 22 * s, true)}
  ${star(c, c, 168 * s, "none", GREEN, 7 * s, false).replace(/fill="none" stroke="none"/g, 'fill="none"')}
  ${star(c, c, 104 * s, GREEN, GREEN, 10 * s, true)}
  ${star(c, c, 46 * s, MINT, MINT, 4 * s, true)}
</svg>`;
}

function artworkSvg(size) {
  const c = size / 2, s = size / 600;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${GREEN}"/>
  <g opacity="0.07">${star(c, c, 330 * s, MINT, MINT, 0, true)}</g>
  ${markSvg(size, false).replace(/^<svg[^>]*>|<\/svg>$/g, "").replace(/(\d+\.\d+),(\d+\.\d+)/g, (m, x, y) =>
    ((+x - c) * 0.62 + c).toFixed(2) + "," + ((+y - c) * 0.62 + c - 30 * s).toFixed(2)).replace(/stroke-width="([\d.]+)"/g, (m, w) => `stroke-width="${(+w * 0.62).toFixed(2)}"`)}
  <text x="${c}" y="${size - 92 * s}" text-anchor="middle" font-family="-apple-system, 'Helvetica Neue', Arial, sans-serif" font-size="${40 * s}" font-weight="700" fill="#FFFFFF" letter-spacing="${1 * s}">SalaamStreet</text>
  <text x="${c}" y="${size - 52 * s}" text-anchor="middle" font-family="-apple-system, 'Helvetica Neue', Arial, sans-serif" font-size="${24 * s}" font-weight="600" fill="${MINT}" letter-spacing="${3 * s}">QUR'AN</text>
</svg>`;
}

const json = (o) => JSON.stringify(o, null, 2) + "\n";
const colorset = (light, dark) => json({
  colors: [
    { idiom: "universal", color: { "color-space": "srgb", components: rgb(light) } },
    ...(dark ? [{ idiom: "universal", appearances: [{ appearance: "luminosity", value: "dark" }], color: { "color-space": "srgb", components: rgb(dark) } }] : []),
  ],
  info: { author: "xcode", version: 1 },
});
function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { red: ((n >> 16) & 255) / 255 + "", green: ((n >> 8) & 255) / 255 + "", blue: (n & 255) / 255 + "", alpha: "1.000" };
}

async function render(page, svg, size, file) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.locator("svg").screenshot({ path: file, omitBackground: true });
}

async function main() {
  const { chromium } = require("playwright");
  const browser = await chromium.launch(process.env.PLAYWRIGHT_BROWSERS_PATH ? {} : {});
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const catalogs = [path.join(ROOT, "ios/SalaamStreet/Assets.xcassets"), path.join(ROOT, "ios/SalaamStreetWidgets/Assets.xcassets")];
  for (const cat of catalogs) {
    fs.mkdirSync(cat, { recursive: true });
    fs.writeFileSync(path.join(cat, "Contents.json"), json({ info: { author: "xcode", version: 1 } }));
    const logo = path.join(cat, "LogoMark.imageset");
    for (const [scale, px] of [[1, 88], [2, 176], [3, 264]]) await render(page, markSvg(px, true), px, path.join(logo, `LogoMark@${scale}x.png`));
    fs.writeFileSync(path.join(logo, "Contents.json"), json({
      images: [1, 2, 3].map((n) => ({ idiom: "universal", filename: `LogoMark@${n}x.png`, scale: `${n}x` })),
      info: { author: "xcode", version: 1 },
    }));
  }
  const app = catalogs[0];
  await render(page, markSvg(1024, true), 1024, path.join(app, "AppIcon.appiconset/AppIcon-1024.png"));
  fs.writeFileSync(path.join(app, "AppIcon.appiconset/Contents.json"), json({
    images: [{ idiom: "universal", platform: "ios", size: "1024x1024", filename: "AppIcon-1024.png" }],
    info: { author: "xcode", version: 1 },
  }));
  const art = path.join(app, "NowPlayingArtwork.imageset");
  await render(page, artworkSvg(600), 600, path.join(art, "NowPlayingArtwork@2x.png"));
  await render(page, artworkSvg(900), 900, path.join(art, "NowPlayingArtwork@3x.png"));
  fs.writeFileSync(path.join(art, "Contents.json"), json({
    images: [{ idiom: "universal", scale: "1x" }, { idiom: "universal", filename: "NowPlayingArtwork@2x.png", scale: "2x" }, { idiom: "universal", filename: "NowPlayingArtwork@3x.png", scale: "3x" }],
    info: { author: "xcode", version: 1 },
  }));
  for (const [name, light, dark] of [["AccentColor", "#047857", "#10B981"], ["LaunchBackground", "#F6FAF7", "#0A100D"], ["BrandGreen", GREEN, null]]) {
    const dir = path.join(app, name + ".colorset");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "Contents.json"), colorset(light, dark));
  }
  if (process.argv.includes("--preview")) await render(page, markSvg(512, true), 512, process.argv[process.argv.indexOf("--preview") + 1]);
  await browser.close();
  console.log("iOS assets written.");
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { markSvg, artworkSvg };
