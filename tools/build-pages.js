#!/usr/bin/env node
/* SalaamStreet — static page generator (no dependencies).
 *
 * Builds search-engine-friendly pages from the app's own data so people can
 * find SalaamStreet from Google: one page per surah, the dua library, the 99
 * Names of Allah, and prayer-time pages for major cities, plus sitemap.xml.
 *
 *   node tools/build-pages.js
 *
 * Re-run after changing js/surahs.js, js/duas.js or js/content.js, and commit
 * the output. GitHub Pages serves the generated folders as-is.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const SITE = "https://salaamstreet.com";

/* ── Load the app's data files in a tiny browser-like sandbox ──────────── */
const sandbox = {};
sandbox.window = sandbox; // like a browser: `window` is the global object
vm.createContext(sandbox);
for (const f of ["js/surahs.js", "js/duas.js", "js/content.js"]) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), sandbox, { filename: f });
}
const SS = sandbox.window.SS;

/* ── Helpers ───────────────────────────────────────────────────────────── */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const slug = (s) => s.toLowerCase().replace(/['’`]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const written = [];
function write(rel, html) {
  const file = path.join(ROOT, rel, "index.html");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  written.push("/" + rel.replace(/\\/g, "/") + "/");
}

function page({ rel, title, description, h1, lead, body, jsonld, extraHead = "" }) {
  const depth = rel.split("/").length;
  const up = "../".repeat(depth);
  const canonical = SITE + "/" + rel + "/";
  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${canonical}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:type" content="article" />
  <meta property="og:image" content="${SITE}/icons/icon-512.png" />
  <meta name="theme-color" content="#f6faf7" media="(prefers-color-scheme: light)" />
  <meta name="theme-color" content="#0a100d" media="(prefers-color-scheme: dark)" />
  <link rel="icon" href="${up}icons/icon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="${up}icons/apple-touch-icon.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;700;800&family=Scheherazade+New:wght@400;700&family=Amiri:wght@400;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="${up}css/styles.css" />
  <script>try{var s=JSON.parse(localStorage.getItem("salaamstreet:settings")||"{}"),t=s.theme||"system";document.documentElement.setAttribute("data-theme",t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light")}catch(e){}</script>
${jsonld ? `  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>\n` : ""}${extraHead}</head>
<body class="standalone">
  <header class="site-head">
    <a class="brand-sm" href="${up}#/home"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m15.8 8.2-2.4 5.2-5.2 2.4 2.4-5.2z"/></svg></span><span>Salaam<span class="g">Street</span></span></a>
    <nav class="site-links" aria-label="Main">
      <a href="${up}prayer-times/">Prayer times</a>
      <a href="${up}surah/">Qur'an</a>
      <a href="${up}duas/">Duas</a>
      <a href="${up}names-of-allah/">99 Names</a>
      <a class="btn btn-sm" href="${up}#/home">Open app</a>
    </nav>
  </header>
  <main class="main" id="main">
    <article class="view view-narrow seo">
      <header class="page-head"><h1>${esc(h1)}</h1>${lead ? `<p>${lead}</p>` : ""}</header>
${body}
    </article>
  </main>
  <footer class="site-foot">
    <p>SalaamStreet — free prayer times, Qibla, Qur'an, hadith, duas and more. No ads, no accounts; your data stays on your device.</p>
    <p><a href="${up}#/home">Open SalaamStreet</a> · <a href="${up}widget/">Prayer times widget for mosques</a></p>
  </footer>
</body>
</html>
`;
}

/* ── Qur'an: one page per surah + index ───────────────────────────────── */
const juzOf = (n) => { let j = 0; SS.JUZ.forEach((b, i) => { if (b[0] <= n) j = i + 1; }); return j; };
const surahSlug = (s) => s.n + "-" + slug(s.en);
SS.SURAHS.forEach((s) => {
  const prev = SS.SURAHS[s.n - 2], next = SS.SURAHS[s.n];
  const type = s.type === "meccan" ? "Meccan" : "Medinan";
  const rel = "surah/" + surahSlug(s);
  const body = `
      <div class="card seo-hero">
        <p class="surah-ar" lang="ar" dir="rtl">${esc(s.ar)}</p>
        <dl class="facts">
          <div><dt>Surah number</dt><dd>${s.n} of 114</dd></div>
          <div><dt>Meaning</dt><dd>${esc(s.meaning)}</dd></div>
          <div><dt>Verses (ayahs)</dt><dd>${s.ayahs}</dd></div>
          <div><dt>Revealed in</dt><dd>${type === "Meccan" ? "Makkah (Meccan)" : "Madinah (Medinan)"}</dd></div>
          <div><dt>Found in</dt><dd>Juz ${juzOf(s.n)}</dd></div>
        </dl>
        <div class="row wrap mt-2">
          <a class="btn" href="../../#/surah/${s.n}">Read &amp; listen to ${esc(s.en)}</a>
          <a class="btn btn-outline" href="../../#/surah/${s.n}/1">Start at ayah 1</a>
        </div>
      </div>
      <p class="mt-2">Read Surah ${esc(s.en)} (${esc(s.meaning)}) in the original Uthmani Arabic script with the Saheeh International English translation, optional transliteration, Tafsir Ibn Kathir for every ayah, and recitation by Mishary Alafasy, Mahmoud Khalil Al-Husary, Abdul Basit or Al-Minshawi. You can also choose Urdu, Indonesian, Turkish, Bengali, French, Malay, Spanish or German translations, bookmark ayahs, and use memorize mode to loop an ayah while you learn it.</p>
      <nav class="reader-nav" aria-label="Surah navigation">
        ${prev ? `<a class="pager prev" href="../${surahSlug(prev)}/"><span><small>Previous</small><b>${prev.n}. ${esc(prev.en)}</b></span></a>` : "<span></span>"}
        ${next ? `<a class="pager next" href="../${surahSlug(next)}/"><span><small>Next</small><b>${next.n}. ${esc(next.en)}</b></span></a>` : ""}
      </nav>`;
  write(rel, page({
    rel,
    title: `Surah ${s.en} (${s.meaning}) — Read with Translation & Audio | SalaamStreet`,
    description: `Read Surah ${s.en} (${s.ar}), surah ${s.n} of the Qur'an — ${s.ayahs} ayahs, ${type}. Arabic text, English translation, tafsir and recitation audio. Free, no ads.`,
    h1: `Surah ${s.en}`,
    lead: `${esc(s.meaning)} · ${s.ayahs} ayahs · ${type}`,
    body,
    jsonld: { "@context": "https://schema.org", "@type": "WebPage", name: `Surah ${s.en}`, description: `Surah ${s.n} of the Qur'an — ${s.meaning}` },
  }));
});
write("surah", page({
  rel: "surah",
  title: "The Qur'an — All 114 Surahs with Translation & Audio | SalaamStreet",
  description: "Read all 114 surahs of the Qur'an in Uthmani Arabic with English and 8 other translations, tafsir, and recitation audio. Free and ad-free.",
  h1: "The Noble Qur'an — all 114 surahs",
  lead: "Arabic text, translation, tafsir and audio for every surah.",
  body: `      <div class="surah-grid">${SS.SURAHS.map((s) => `
        <a class="surah-card" href="${surahSlug(s)}/"><span class="surah-num" aria-hidden="true"><span>${s.n}</span></span><span class="names"><span class="en">${esc(s.en)}</span><span class="meta">${esc(s.meaning)} · ${s.ayahs} ayahs</span></span><span class="arname" lang="ar">${esc(s.ar)}</span></a>`).join("")}
      </div>`,
}));

/* ── Duas: one page per category (full text) + index ─────────────────── */
SS.DUA_CATEGORIES.forEach((c) => {
  const list = SS.DUAS.filter((d) => d.category === c.id);
  const rel = "duas/" + c.id;
  const body = `      <div class="stack">${list.map((d) => `
        <section class="card dua-card">
          <h2 class="h-sm">${esc(d.titleEn)}</h2>
          <p class="arabic-dua" lang="ar">${esc(d.arabic)}</p>
          <p class="transliteration">${esc(d.transliteration)}</p>
          <p class="translation">${esc(d.translationEn)}</p>
          <div class="card-foot"><span class="badge badge-src">Source: ${esc(d.source)}</span></div>
        </section>`).join("")}
      </div>
      <p class="mt-2"><a class="btn" href="../../#/duas/${c.id}">Open in SalaamStreet</a></p>`;
  write(rel, page({
    rel,
    title: `${c.en} Duas — Arabic, Transliteration & Meaning | SalaamStreet`,
    description: `Authentic ${c.en.toLowerCase()} duas in Arabic with transliteration, English translation and a hadith or Qur'an source for each one.`,
    h1: `${c.en} duas`,
    lead: `<span lang="ar">${esc(c.ar)}</span> · ${list.length} authentic supplications, each with its source.`,
    body,
  }));
});
write("duas", page({
  rel: "duas",
  title: "Authentic Duas with Sources — Dua Library | SalaamStreet",
  description: "Authentic supplications from the Qur'an and graded hadith: morning and evening, sleep, travel, distress and daily life — with Arabic, transliteration and translation.",
  h1: "Dua library",
  lead: "Every dua cites the Qur'an or a graded hadith.",
  body: `      <div class="cat-grid">${SS.DUA_CATEGORIES.map((c) => `
        <a class="cat" href="${c.id}/"><span class="c-emoji" aria-hidden="true">${c.icon}</span><span class="c-title">${esc(c.en)}</span><span class="c-ar" lang="ar">${esc(c.ar)}</span><span class="c-sub">${SS.DUAS.filter((d) => d.category === c.id).length} duas</span></a>`).join("")}
      </div>`,
}));

/* ── 99 Names of Allah ───────────────────────────────────────────────── */
write("names-of-allah", page({
  rel: "names-of-allah",
  title: "The 99 Names of Allah (Asma ul Husna) with Meanings | SalaamStreet",
  description: "All 99 Names of Allah — Al-Asma' al-Husna — in Arabic with transliteration and English meaning.",
  h1: "The 99 Names of Allah",
  lead: "“To Allah belong the most beautiful names, so call upon Him by them.” (Qur'an 7:180)",
  body: `      <div class="names-grid">${SS.NAMES.map((n) => `
        <article class="name-tile"><span class="nm-n">${n.n}</span><span class="nm-ar" lang="ar">${esc(n.ar)}</span><b class="nm-tr">${esc(n.tr)}</b><span class="nm-en">${esc(n.en)}</span></article>`).join("")}
      </div>
      <p class="tiny mt-2">This is the commonly circulated list based on the narration in at-Tirmidhi 3507; scholars differ on exactly which names that list includes.</p>
      <p class="mt-2"><a class="btn" href="../#/names">Open in SalaamStreet</a></p>`,
}));

/* ── Prayer times for major cities ───────────────────────────────────── */
const METHOD_NAMES = { 1: "University of Islamic Sciences, Karachi", 2: "ISNA (North America)", 3: "Muslim World League", 4: "Umm al-Qura, Makkah", 5: "Egyptian General Authority of Survey", 7: "Institute of Geophysics, University of Tehran", 8: "Gulf Region", 9: "Kuwait", 10: "Qatar", 11: "Majlis Ugama Islam Singapura", 12: "UOIF (France)", 13: "Diyanet İşleri Başkanlığı (Türkiye)", 17: "JAKIM (Malaysia)", 18: "Tunisia", 19: "Algeria", 20: "KEMENAG (Indonesia)", 21: "Morocco" };
const CITIES = [
  ["Makkah", "Saudi Arabia", 21.4225, 39.8262, 4], ["Madinah", "Saudi Arabia", 24.4672, 39.6111, 4], ["Riyadh", "Saudi Arabia", 24.7136, 46.6753, 4], ["Jeddah", "Saudi Arabia", 21.4858, 39.1925, 4],
  ["Dubai", "United Arab Emirates", 25.2048, 55.2708, 8], ["Abu Dhabi", "United Arab Emirates", 24.4539, 54.3773, 8], ["Doha", "Qatar", 25.2854, 51.531, 10], ["Kuwait City", "Kuwait", 29.3759, 47.9774, 9],
  ["Manama", "Bahrain", 26.2285, 50.586, 8], ["Muscat", "Oman", 23.588, 58.3829, 8], ["Cairo", "Egypt", 30.0444, 31.2357, 5], ["Alexandria", "Egypt", 31.2001, 29.9187, 5],
  ["Istanbul", "Türkiye", 41.0082, 28.9784, 13], ["Ankara", "Türkiye", 39.9334, 32.8597, 13], ["Amman", "Jordan", 31.9454, 35.9284, 3], ["Jerusalem", "Palestine", 31.7683, 35.2137, 3],
  ["Beirut", "Lebanon", 33.8938, 35.5018, 3], ["Baghdad", "Iraq", 33.3152, 44.3661, 3], ["Tehran", "Iran", 35.6892, 51.389, 7], ["Karachi", "Pakistan", 24.8607, 67.0011, 1],
  ["Lahore", "Pakistan", 31.5204, 74.3587, 1], ["Islamabad", "Pakistan", 33.6844, 73.0479, 1], ["Delhi", "India", 28.6139, 77.209, 1], ["Mumbai", "India", 19.076, 72.8777, 1],
  ["Hyderabad", "India", 17.385, 78.4867, 1], ["Dhaka", "Bangladesh", 23.8103, 90.4125, 1], ["Kuala Lumpur", "Malaysia", 3.139, 101.6869, 17], ["Jakarta", "Indonesia", -6.2088, 106.8456, 20],
  ["Singapore", "Singapore", 1.3521, 103.8198, 11], ["Casablanca", "Morocco", 33.5731, -7.5898, 21], ["Rabat", "Morocco", 34.0209, -6.8416, 21], ["Tunis", "Tunisia", 36.8065, 10.1815, 18],
  ["Algiers", "Algeria", 36.7538, 3.0588, 19], ["Lagos", "Nigeria", 6.5244, 3.3792, 3], ["Kano", "Nigeria", 12.0022, 8.592, 3], ["Nairobi", "Kenya", -1.2921, 36.8219, 3],
  ["Johannesburg", "South Africa", -26.2041, 28.0473, 3], ["Cape Town", "South Africa", -33.9249, 18.4241, 3], ["London", "United Kingdom", 51.5074, -0.1278, 3], ["Birmingham", "United Kingdom", 52.4862, -1.8904, 3],
  ["Manchester", "United Kingdom", 53.4808, -2.2426, 3], ["Bradford", "United Kingdom", 53.795, -1.7594, 3], ["Leicester", "United Kingdom", 52.6369, -1.1398, 3], ["Glasgow", "United Kingdom", 55.8642, -4.2518, 3],
  ["Paris", "France", 48.8566, 2.3522, 12], ["Marseille", "France", 43.2965, 5.3698, 12], ["Brussels", "Belgium", 50.8503, 4.3517, 3], ["Amsterdam", "Netherlands", 52.3676, 4.9041, 3],
  ["Berlin", "Germany", 52.52, 13.405, 3], ["Stockholm", "Sweden", 59.3293, 18.0686, 3], ["New York", "United States", 40.7128, -74.006, 2], ["Chicago", "United States", 41.8781, -87.6298, 2],
  ["Houston", "United States", 29.7604, -95.3698, 2], ["Dallas", "United States", 32.7767, -96.797, 2], ["Los Angeles", "United States", 34.0522, -118.2437, 2], ["Dearborn", "United States", 42.3223, -83.1763, 2],
  ["Toronto", "Canada", 43.6532, -79.3832, 2], ["Montreal", "Canada", 45.5017, -73.5673, 2], ["Sydney", "Australia", -33.8688, 151.2093, 3], ["Melbourne", "Australia", -37.8136, 144.9631, 3],
];
const cityScript = (lat, lng, method) => `
  <script>
  (function () {
    var KEYS = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"], el = document.getElementById("times");
    var d = new Date(), dd = ("0" + d.getDate()).slice(-2) + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + d.getFullYear();
    fetch("https://api.aladhan.com/v1/timings/" + dd + "?latitude=${lat}&longitude=${lng}&method=${method}")
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (j) {
        var t = j.data.timings, h = j.data.date.hijri, html = "";
        KEYS.forEach(function (k) { html += '<div class="time-row"><span class="name">' + k + '</span><span class="t">' + String(t[k]).slice(0, 5) + "</span></div>"; });
        el.innerHTML = html;
        document.getElementById("date").textContent = j.data.date.readable + " · " + h.day + " " + h.month.en + " " + h.year + " AH";
      })
      .catch(function () { el.innerHTML = '<p class="note">Times could not be loaded right now. Open the app for cached times.</p>'; });
  })();
  </script>`;
CITIES.forEach(([city, country, lat, lng, method]) => {
  const rel = "prayer-times/" + slug(city);
  write(rel, page({
    rel,
    title: `Prayer Times in ${city} Today — Fajr, Dhuhr, Asr, Maghrib, Isha | SalaamStreet`,
    description: `Accurate prayer times for ${city}, ${country} today: Fajr, sunrise, Dhuhr, Asr, Maghrib and Isha (${METHOD_NAMES[method]} method). Plus the Qibla direction and monthly timetable.`,
    h1: `Prayer times in ${city}`,
    lead: `${esc(country)} · <span id="date">Today</span>`,
    body: `      <div class="times-list" id="times" aria-live="polite">
        <div class="skeleton row-sk"></div><div class="skeleton row-sk"></div><div class="skeleton row-sk"></div>
        <div class="skeleton row-sk"></div><div class="skeleton row-sk"></div><div class="skeleton row-sk"></div>
      </div>
      <p class="tiny mt-1">Calculation method: ${esc(METHOD_NAMES[method])}. Scholars differ on calculation methods — follow your local mosque's timetable where it differs.</p>
      <div class="row wrap mt-2">
        <a class="btn" href="../../#/prayer">Monthly timetable &amp; reminders</a>
        <a class="btn btn-outline" href="../../#/qibla">Qibla direction</a>
        <a class="btn btn-ghost" href="../../widget/">Add these times to your website</a>
      </div>
      <h2 class="mt-3">Other cities</h2>
      <p class="city-links">${CITIES.filter((c) => c[0] !== city).map((c) => `<a href="../${slug(c[0])}/">${esc(c[0])}</a>`).join(" · ")}</p>
${cityScript(lat, lng, method)}`,
    jsonld: { "@context": "https://schema.org", "@type": "WebPage", name: `Prayer times in ${city}`, about: { "@type": "City", name: city, geo: { "@type": "GeoCoordinates", latitude: lat, longitude: lng } } },
  }));
});
write("prayer-times", page({
  rel: "prayer-times",
  title: "Prayer Times Today for Cities Worldwide | SalaamStreet",
  description: "Today's Fajr, Dhuhr, Asr, Maghrib and Isha times for major cities worldwide — or use your exact location in the SalaamStreet app.",
  h1: "Prayer times by city",
  lead: `For your exact location, <a href="../#/prayer">open SalaamStreet</a>.`,
  body: `      <div class="city-grid">${CITIES.map((c) => `<a class="chip" href="${slug(c[0])}/">${esc(c[0])}<span class="tiny">${esc(c[1])}</span></a>`).join("")}</div>`,
}));

/* ── sitemap.xml & robots.txt ────────────────────────────────────────── */
const today = new Date().toISOString().slice(0, 10);
const urls = ["/", "/widget/"].concat(written);
fs.writeFileSync(path.join(ROOT, "sitemap.xml"),
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod></url>`).join("\n") + "\n</urlset>\n");
fs.writeFileSync(path.join(ROOT, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /widget/embed.html\n\nSitemap: ${SITE}/sitemap.xml\n`);

console.log(`Wrote ${written.length} pages + sitemap.xml (${urls.length} URLs) + robots.txt`);
