/* Fixtures for the Offline Qur'an tests: API mocks with the real ayah counts,
   a tiny valid MP3 (silence), and a small two-page PDF that stands in for the
   real Qur'an PDF during a test run only (it is never written to files/). */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..", "..");
const box = { window: {} };
box.window = box;
vm.createContext(box);
vm.runInContext(fs.readFileSync(path.join(ROOT, "js/surahs.js"), "utf8"), box);
const SURAHS = box.SS.SURAHS;
const OFFSETS = box.SS.OFFSETS;

/** About a second of silent MPEG-1 Layer III (mono, 128 kbps, 44.1 kHz). */
function silentMp3(frames = 40) {
  const frame = Buffer.alloc(417);
  frame.set([0xff, 0xfb, 0x90, 0xc4]);
  return Buffer.concat(Array.from({ length: frames }, () => frame));
}

/** A valid PDF with `pages` pages, each saying which page it is. */
function testPdf(pages = 2) {
  const objs = [];
  const kids = [];
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  for (let i = 0; i < pages; i++) {
    const pageId = 4 + i * 2, contentId = 5 + i * 2;
    const text = `BT /F1 28 Tf 72 700 Td (Test Quran PDF - page ${i + 1}) Tj ET`;
    objs[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objs[contentId] = `<< /Length ${text.length} >>\nstream\n${text}\nendstream`;
    kids.push(`${pageId} 0 R`);
  }
  objs[2] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages} >>`;
  let out = "%PDF-1.4\n";
  const offsets = [];
  for (let id = 1; id < objs.length; id++) {
    offsets[id] = Buffer.byteLength(out);
    out += `${id} 0 obj\n${objs[id]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objs.length; id++) out += String(offsets[id]).padStart(10, "0") + " 00000 n \n";
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

function edition(id, n) {
  const count = SURAHS[n - 1].ayahs;
  return {
    edition: { identifier: id },
    ayahs: Array.from({ length: count }, (_, i) => ({ number: OFFSETS[n - 1] + i + 1, numberInSurah: i + 1, text: `${id} ${n}:${i + 1}` })),
  };
}

/**
 * Route the Qur'an text, tafsir and audio APIs on a Playwright context.
 * opts.log: array that receives "text n eds" / "tafsir n" / "audio g" for each successful response.
 * opts.delay: ms per request. opts.fail(kind, key, attempt) → true to answer 500.
 * opts.stats: { active, max } concurrency counters.
 */
async function routeQuranApis(context, opts = {}) {
  const attempts = {};
  const stats = opts.stats || { active: 0, max: 0 };
  const mp3 = silentMp3();
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, async (route) => {
    const u = new URL(route.request().url());
    let kind = null, key = null, body = null, type = "application/json";
    let m;
    if (u.hostname === "api.alquran.cloud" && (m = u.pathname.match(/^\/v1\/surah\/(\d+)\/editions\/(.+)$/))) {
      const eds = decodeURIComponent(m[2]).split(",");
      kind = "text"; key = m[1] + " " + eds.join(",");
      body = JSON.stringify({ code: 200, data: eds.map((ed) => edition(ed, +m[1])) });
    } else if (u.hostname === "api.alquran.cloud" && (m = u.pathname.match(/^\/v1\/ayah\/(\d+)\//))) {
      kind = "ayah"; key = m[1];
      body = JSON.stringify({ data: [{ text: "آية", surah: { number: 1, englishName: "Al-Fatiha" }, numberInSurah: 1 }, { text: "In the name of Allah" }] });
    } else if ((m = u.pathname.match(/en-tafisr-ibn-kathir\/(\d+)\.json$/))) {
      const n = +m[1];
      kind = "tafsir"; key = String(n);
      body = JSON.stringify({ ayahs: Array.from({ length: SURAHS[n - 1].ayahs }, (_, i) => ({ surah: n, ayah: i + 1, text: `Offline commentary for ${n}:${i + 1}` })) });
    } else if (u.hostname === "cdn.islamic.network" && (m = u.pathname.match(/\/quran\/audio\/(\d+)\/([^/]+)\/(\d+)\.mp3$/))) {
      if (m[1] !== "128") return route.fulfill({ status: 404, body: "nf" });
      kind = "audio"; key = m[3]; body = mp3; type = "audio/mpeg";
    } else if (u.hostname === "api.aladhan.com") {
      return route.fulfill({ json: { data: { timings: { Fajr: "05:00", Sunrise: "06:30", Dhuhr: "12:30", Asr: "15:45", Maghrib: "18:30", Isha: "19:45" },
        date: { hijri: { day: "12", month: { number: 4, en: "Rabi al-Thani", ar: "ربيع الآخر" }, year: "1448" } } } } });
    } else {
      return route.abort();
    }
    const id = kind + " " + key;
    attempts[id] = (attempts[id] || 0) + 1;
    stats.active++;
    stats.max = Math.max(stats.max, stats.active);
    try {
      if (opts.delay) await new Promise((r) => setTimeout(r, opts.delay));
      if (opts.fail && opts.fail(kind, key, attempts[id])) return await route.fulfill({ status: 500, body: "oops" });
      if (opts.log) opts.log.push(id);
      await route.fulfill({ status: 200, contentType: type, body });
    } catch (e) { /* page went away mid-request */ } finally { stats.active--; }
  });
  return { attempts, stats };
}

module.exports = { SURAHS, silentMp3, testPdf, routeQuranApis };
