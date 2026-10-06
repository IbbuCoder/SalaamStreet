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

/* Section names for breadcrumbs ("SalaamStreet › Prayer times › Chicago" in Google). */
const SECTIONS = { facts: "At a glance", surah: "Qur'an", "prayer-times": "Prayer times", duas: "Duas", "names-of-allah": "99 Names of Allah", qibla: "Qibla direction", about: "About", widget: "Widget" };
function structuredData(rel, canonical, h1, description, jsonld) {
  const parts = rel.split("/");
  const crumbs = [{ name: "SalaamStreet", url: SITE + "/" }];
  if (parts.length > 1) crumbs.push({ name: SECTIONS[parts[0]] || parts[0], url: SITE + "/" + parts[0] + "/" });
  crumbs.push({ name: h1, url: canonical });
  const pageLd = Object.assign({ "@type": "WebPage", name: h1, description }, jsonld || {}, {
    "@id": canonical + "#webpage", url: canonical, inLanguage: "en",
    isPartOf: { "@type": "WebSite", "@id": SITE + "/#website", name: "SalaamStreet", url: SITE + "/" },
    primaryImageOfPage: { "@type": "ImageObject", url: SITE + "/icons/og-image.png" },
  });
  delete pageLd["@context"];
  return { "@context": "https://schema.org", "@graph": [pageLd, {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.url })),
  }] };
}

function page({ rel, title, description, h1, lead, body, jsonld, extraHead = "" }) {
  const depth = rel.split("/").length;
  const up = "../".repeat(depth);
  const canonical = SITE + "/" + rel + "/";
  jsonld = structuredData(rel, canonical, h1, description, jsonld);
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
  <meta property="og:image" content="${SITE}/icons/og-image.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content="SalaamStreet" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${SITE}/icons/og-image.png" />
  <meta name="theme-color" content="#f6faf7" media="(prefers-color-scheme: light)" />
  <meta name="theme-color" content="#0a100d" media="(prefers-color-scheme: dark)" />
  <meta name="color-scheme" content="light dark" />
  <!-- Saved theme before any stylesheet loads, so there is no light/dark flash. -->
  <style>html{background:#f6faf7;color-scheme:light}html[data-theme="dark"]{background:#0a100d;color-scheme:dark}</style>
  <script>(function(){var d=document.documentElement,t="system";try{t=(JSON.parse(localStorage.getItem("salaamstreet:settings")||"{}")||{}).theme||"system"}catch(e){}var k=t==="dark"||(t!=="light"&&!!window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light";d.setAttribute("data-theme",k);var m=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<m.length;i++){m[i].setAttribute("content",k==="dark"?"#0a100d":"#f6faf7");m[i].removeAttribute("media")}var c=document.querySelector('meta[name="color-scheme"]');if(c)c.setAttribute("content",k)})();</script>
  <link rel="icon" href="${up}icons/icon-192.png" type="image/png" sizes="192x192" />
  <link rel="icon" href="${up}icons/favicon-32.png" type="image/png" sizes="32x32" />
  <link rel="icon" href="${up}icons/favicon-16.png" type="image/png" sizes="16x16" />
  <link rel="apple-touch-icon" href="${up}icons/apple-touch-icon.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;700;800&family=Scheherazade+New:wght@400;700&family=Amiri:wght@400;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="${up}css/styles.css" />
${jsonld ? `  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>\n` : ""}${extraHead}</head>
<body class="standalone">
  <header class="site-head">
    <a class="brand-sm" href="${up}#/home"><span class="brand-mark" aria-hidden="true"><img src="${up}icons/brand/logo-mark-128.png" alt="" width="30" height="30" /></span><span>Salaam<span class="g">Street</span></span></a>
    <nav class="site-links" aria-label="Main">
      <a href="${up}prayer-times/">Prayer times</a>
      <a href="${up}qibla/">Qibla</a>
      <a href="${up}surah/">Qur'an</a>
      <a href="${up}duas/">Duas</a>
      <a href="${up}names-of-allah/">99 Names</a>
      <a href="${up}about/">About</a>
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
    <p>SalaamStreet — free prayer times, Qibla, Qur'an, hadith, duas and more. No ads, no account needed; your data stays on your device unless you choose to sync it.</p>
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
/* Qibla direction from a place: great-circle bearing to the Kaaba (true north), as js/core.js computes it. */
const KAABA = { lat: 21.4225, lng: 39.8262 }; // SS.KAABA in js/core.js
const rad = Math.PI / 180;
function qibla(lat, lng) {
  const p1 = lat * rad, p2 = KAABA.lat * rad, dl = (KAABA.lng - lng) * rad;
  const y = Math.sin(dl) * Math.cos(p2), x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  const deg = (Math.atan2(y, x) / rad + 360) % 360;
  const a = Math.sin((KAABA.lat - lat) * rad / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  const km = 2 * 6371 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const point = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"][Math.round(deg / 45) % 8];
  return { deg, km, mi: km * 0.621371, point };
}
const fmtNum = (n) => Math.round(n).toLocaleString("en-US");
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
    description: `Accurate prayer times for ${city}, ${country} today: Fajr, sunrise, Dhuhr, Asr, Maghrib and Isha (${METHOD_NAMES[method]} method). Qibla direction from ${city}: ${qibla(lat, lng).deg.toFixed(1)}° ${qibla(lat, lng).point}.`,
    h1: `Prayer times in ${city}`,
    lead: `${esc(country)} · <span id="date">Today</span>`,
    body: `      <div class="times-list" id="times" aria-live="polite">
        <div class="skeleton row-sk"></div><div class="skeleton row-sk"></div><div class="skeleton row-sk"></div>
        <div class="skeleton row-sk"></div><div class="skeleton row-sk"></div><div class="skeleton row-sk"></div>
      </div>
      <p class="tiny mt-1">Calculation method: ${esc(METHOD_NAMES[method])}. Scholars differ on calculation methods — follow your local mosque's timetable where it differs.</p>
      <h2 class="mt-3">Qibla direction in ${esc(city)}</h2>
      ${city === "Makkah" ? `<p>You are in Makkah: face the Kaaba at Masjid al-Haram.</p>` : `<p>From central ${esc(city)}, the Qibla is <b>${qibla(lat, lng).deg.toFixed(1)}°</b> from true north (${qibla(lat, lng).point}). The Kaaba in Makkah is about <b>${fmtNum(qibla(lat, lng).km)} km</b> (${fmtNum(qibla(lat, lng).mi)} miles) away. For your exact spot, use the live compass in the app.</p>`}
      <div class="row wrap mt-2">
        <a class="btn" href="../../#/prayer">Monthly timetable &amp; reminders</a>
        <a class="btn btn-outline" href="../../#/qibla">Qibla direction</a>
        <a class="btn btn-ghost" href="../../widget/">Add these times to your website</a>
      </div>
      <h2 class="mt-3">Other cities</h2>
      <p class="city-links">${CITIES.filter((c) => c[0] !== city).map((c) => `<a href="../${slug(c[0])}/">${esc(c[0])}</a>`).join(" · ")}</p>
${cityScript(lat, lng, method)}`,
    jsonld: { "@type": "WebPage", name: `Prayer times in ${city}`, about: { "@type": "City", name: city, containedInPlace: { "@type": "Country", name: country }, geo: { "@type": "GeoCoordinates", latitude: lat, longitude: lng } } },
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

/* ── Qibla direction (landing page + table for every city) ───────────── */
write("qibla", page({
  rel: "qibla",
  title: "Qibla Direction Finder — Find the Qibla From Anywhere | SalaamStreet",
  description: "Find the Qibla direction from where you are with a live compass and camera mode, corrected to true north. Free, no ads. Plus the Qibla bearing for 60 cities worldwide.",
  h1: "Qibla direction finder",
  lead: `Face the Kaaba from anywhere. For your exact location, <a href="../#/qibla">open the Qibla finder</a>.`,
  body: `      <p><a class="btn" href="../#/qibla">Find the Qibla now</a></p>
      <h2 class="mt-3">How SalaamStreet finds the Qibla</h2>
      <ol class="steps">
        <li>It works out the great-circle direction from your location to the Kaaba in Makkah — the shortest path over the Earth's surface.</li>
        <li>Your phone's compass points to magnetic north, which can be 15–20° away from true north in some places. SalaamStreet corrects for that with the World Magnetic Model (WMM2025).</li>
        <li>Turn until the Kaaba marker reaches the pointer — or use Camera Mode, which shows the direction over your camera view and vibrates once you're facing the Qibla.</li>
      </ol>
      <p class="tiny mt-1">Everything is calculated on your device. Phone compasses can be thrown off by metal and magnets nearby — move away from them and wave the phone in a figure-8 to calibrate.</p>
      <h2 class="mt-3">Qibla direction by city</h2>
      <div class="card table-card"><div class="table-scroll"><table class="month-table">
        <thead><tr><th scope="col">City</th><th scope="col">Qibla (from true north)</th><th scope="col">Distance to Makkah</th></tr></thead>
        <tbody>${CITIES.filter((c) => c[0] !== "Makkah").map(([city, country, lat, lng]) => {
          const q = qibla(lat, lng);
          return `<tr><td><a href="../prayer-times/${slug(city)}/">${esc(city)}</a> <span class="tiny">${esc(country)}</span></td><td>${q.deg.toFixed(1)}° ${q.point}</td><td>${fmtNum(q.km)} km · ${fmtNum(q.mi)} mi</td></tr>`;
        }).join("")}</tbody>
      </table></div></div>`,
  jsonld: { "@type": "WebPage", about: { "@type": "Thing", name: "Qibla" } },
}));

/* ── About (shareable story page) ────────────────────────────────── */
{
  const C = SS.CHANGELOG, R = SS.ROADMAP;
  write("about", page({
    rel: "about",
    title: "About SalaamStreet — Ibrahim's Story | SalaamStreet",
    description: "SalaamStreet began as a 12-year-old's Islamic-themed shop. Today it's a free, private Islamic web app — prayer times, Qibla, Qur'an, duas and more. Here's the story and our promise.",
    h1: "The story behind SalaamStreet",
    lead: `Version ${esc(SS.VERSION)}`,
    body: `      <article class="card story">
        <p>SalaamStreet didn't start as an app. When Ibrahim was 12, it was an Islamic-themed online shop he built on Shopify. It didn't take off. His next attempt didn't either.</p>
        <p>But Ibrahim kept the name and changed the idea. Instead of selling things to Muslims, what if SalaamStreet gave them something — every day, for free?</p>
        <p>Today Ibrahim is a student at Neuqua Valley High School, where he's part of the Muslim Student Association.</p>
        <p>SalaamStreet is one calm place to find prayer times, face the Qibla, read and listen to the Qur'an, learn authentic duas, track your prayers, start learning Arabic and remember Allah — with no ads, no account required, and your data staying on your device unless you choose to sign in and sync it.</p>
        <p class="story-sign">Ibrahim had the idea; his father, Aquil, helped bring it to life.</p>
      </article>
      <article class="card promise mt-2">
        <h2>Our promise</h2>
        <ul class="promise-list">
          <li><span>Everything you need stays free, forever. Prayer times, Qibla, the Qur'an, duas, dhikr, the prayer tracker, Arabic learning and syncing across your devices will never be behind a paywall.</span></li>
          <li><span>Paid extras will only ever be for things that genuinely cost money to provide — like an AI tutor or live courses — and you'll be able to choose a subscription or pay once and own it forever.</span></li>
          <li><span>One day, the SalaamStreet shop may return too — while the app itself stays free.</span></li>
        </ul>
      </article>
      <h2 class="mt-3 mb-1">Coming next</h2>
      <div class="roadmap">${R.map((r) => `<div class="card road"><div class="w-body"><b class="w-title"><span class="ver-pill" dir="ltr">${esc(r.v)}</span> ${esc(r.en)}</b><span class="w-sub wrap-text">${esc(r.den)}</span></div></div>`).join("")}</div>
      <h2 class="mt-3 mb-1">Version history</h2>
      <ol class="timeline">${C.map((c, i) => `<li class="tl-item${i === 0 ? " current" : ""}"><span class="tl-dot" aria-hidden="true"></span><div class="card"><b>Version ${esc(c.v)}</b><p class="tl-title">${esc(c.en)}</p>${c.den ? `<p class="tl-desc">${esc(c.den)}</p>` : ""}${c.groups
        ? c.groups.map((g) => `<h3 class="tl-group">${esc(g.en)}</h3><ul>${g.items.map((it) => `<li>${esc(it.en)}</li>`).join("")}</ul>`).join("")
        : `<ul>${c.items.map((it) => `<li>${esc(it.en)}</li>`).join("")}</ul>`}</div></li>`).join("")}</ol>
      <article class="card dua-ask mt-3"><div><h2 class="h-sm">A small request</h2><p class="muted mt-1">We hope SalaamStreet becomes a sadaqah jariyah — a charity whose reward continues for everyone who benefits. If it has helped you, please remember Ibrahim and our family in your du'as.</p></div></article>
      <p class="mt-2"><a class="btn" href="../#/home">Open SalaamStreet</a> <a class="btn btn-outline" href="../facts/">SalaamStreet at a glance</a></p>`,
  }));
}

/* ── "SalaamStreet at a glance": facts + FAQ for people and AI search ──
   One set of facts feeds the visible /facts/ page, its FAQ structured data
   and /llms.txt, so what search engines and AI assistants read always
   matches what visitors see (never anything hidden from people). */
const FACTS = {
  summary: "SalaamStreet is a free Islamic web app for prayer times, the Qibla direction, the Qur'an with audio and tafsir, authentic hadith and duas, a dhikr counter and the Islamic calendar. It has no ads, needs no account, and works on any phone, tablet or computer — even offline.",
  founders: "SalaamStreet was founded by Ibrahim, a high-school student at Neuqua Valley High School and a member of its Muslim Student Association (MSA). He builds it together with his father, Aquil.",
  story: "It began as an Islamic-themed online shop Ibrahim built on Shopify when he was 12. When that didn't take off, he kept the name and changed the idea: instead of selling things to Muslims, SalaamStreet would give them something useful every day, for free.",
  features: [
    "Prayer times for your location, with 7 calculation methods and Standard or Hanafi Asr, plus a monthly timetable",
    "Qibla finder with a live compass corrected to true north (World Magnetic Model WMM2025) and a Camera Mode that locks on when you face the Qibla",
    "The full Qur'an (Uthmani script) with translation, transliteration, recitation by 4 reciters, Tafsir Ibn Kathir, bookmarks, reading plans and a memorize mode",
    "A hadith library of 10 collections — the 40 Hadith of an-Nawawi, Qudsi and Shah Waliullah, the Six Books (Bukhari, Muslim, Abu Dawud, Tirmidhi, Nasa'i, Ibn Majah) and the Muwatta of Imam Malik — with every grading shown, plus a dua library; every text shows its source",
    "Dhikr counter, morning and evening adhkar, prayer tracker with streaks, prayer reminders and Ramadan mode",
    "Islamic (Hijri) calendar, the 99 Names of Allah, a mosque finder and Learn to Read Arabic lessons",
    "Optional free account to sync bookmarks, streaks and settings across devices",
    "A free prayer-times widget mosques can put on their own website",
  ],
  privacy: "Privacy first: no ads, no tracking and no account required. As a guest, everything stays on the device. Signing in is optional and only syncs what the person chooses; their location is never synced.",
  sources: "Qur'an text from Tanzil (Uthmani) via AlQuran Cloud; English translation by Saheeh International; tafsir from Tafsir Ibn Kathir; prayer times calculated by the AlAdhan service. Nothing religious is generated by AI.",
  languages: "English and Arabic, plus Urdu, Bengali, Indonesian, Turkish and French (drafts pending native-speaker review), with full right-to-left layout.",
  price: "Free. Everything people need stays free forever; any future paid extras would only cover things that genuinely cost money to provide.",
};
const FAQ = [
  ["What is SalaamStreet?", FACTS.summary],
  ["Who made SalaamStreet?", FACTS.founders + " " + FACTS.story],
  ["Is SalaamStreet free?", FACTS.price + " There are no ads."],
  ["Do I need an account or an app store download?", "No. SalaamStreet works in any web browser on iPhone, Android, iPad, Windows, Mac and Chromebook, and can be added to the home screen like an app. An account is optional."],
  ["How does SalaamStreet find the Qibla?", "It calculates the great-circle direction from your location to the Kaaba in Makkah, and corrects the phone's magnetic compass to true north with the World Magnetic Model (WMM2025). Camera Mode shows the direction over the camera view and vibrates once you're facing the Qibla."],
  ["Where do the Qur'an, hadith and prayer times come from?", FACTS.sources],
  ["Is my data private?", FACTS.privacy],
  ["Which languages does SalaamStreet support?", FACTS.languages],
  ["Does SalaamStreet work offline?", "Yes. Anything you've opened once — including prayer times you've loaded — keeps working without a connection."],
  ["What is SalaamStreet for MSAs?", "Tools for Muslim Student Associations are planned for a future update, starting with the Neuqua Valley High School (NVHS) MSA: Jummah times, announcements, events and a link to the MSA's Google Classroom."],
];
const latest = SS.CHANGELOG[0];
write("facts", page({
  rel: "facts",
  title: "SalaamStreet at a Glance — Facts, Founders & FAQ | SalaamStreet",
  description: "Quick facts about SalaamStreet, the free Islamic app founded by Ibrahim and built with his father, Aquil: features, privacy, sources, languages and answers to common questions.",
  h1: "SalaamStreet at a glance",
  lead: esc(FACTS.summary),
  body: `      <article class="card">
        <dl class="facts">
          <div><dt>Founded by</dt><dd>Ibrahim, with his father, Aquil</dd></div>
          <div><dt>What it is</dt><dd>A free Islamic web app</dd></div>
          <div><dt>Price</dt><dd>Free · no ads · no account needed</dd></div>
          <div><dt>Works on</dt><dd>Any phone, tablet or computer, in a web browser</dd></div>
          <div><dt>Languages</dt><dd>7</dd></div>
          <div><dt>Current version</dt><dd>${esc(latest.v)} — ${esc(latest.en)}</dd></div>
          <div><dt>Website</dt><dd><a href="../">salaamstreet.com</a></dd></div>
        </dl>
      </article>
      <h2 class="mt-3">Who's behind it</h2>
      <p>${esc(FACTS.founders)}</p>
      <p>${esc(FACTS.story)}</p>
      <h2 class="mt-3">What it does</h2>
      <ul class="steps">${FACTS.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
      <h2 class="mt-3">Privacy &amp; sources</h2>
      <p>${esc(FACTS.privacy)}</p>
      <p>${esc(FACTS.sources)}</p>
      <h2 class="mt-3">Frequently asked questions</h2>
${FAQ.map(([q, a]) => `      <details class="card faq"><summary><b>${esc(q)}</b></summary><p class="mt-1">${esc(a)}</p></details>`).join("\n")}
      <p class="mt-2"><a class="btn" href="../#/home">Open SalaamStreet</a> <a class="btn btn-outline" href="../about/">Read the full story</a></p>`,
  jsonld: { "@type": ["WebPage", "FAQPage"], mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    about: { "@type": "WebApplication", name: "SalaamStreet", url: SITE + "/" } },
}));

/* llms.txt (llmstxt.org): a plain-text guide to the site for AI assistants. Public, like everything else. */
fs.writeFileSync(path.join(ROOT, "llms.txt"), `# SalaamStreet

> ${FACTS.summary}

${FACTS.founders} ${FACTS.story}

- Website: ${SITE}/
- Price: ${FACTS.price}
- Privacy: ${FACTS.privacy}
- Sources: ${FACTS.sources}
- Languages: ${FACTS.languages}
- Platforms: any modern web browser on iPhone, Android, iPad, Windows, Mac and ChromeOS; installable to the home screen; works offline.
- Current version: ${latest.v} — ${latest.en}

## Features

${FACTS.features.map((f) => "- " + f).join("\n")}

## Pages

- [SalaamStreet at a glance](${SITE}/facts/): facts, founders and FAQ
- [About SalaamStreet](${SITE}/about/): Ibrahim's story, our promise and version history
- [Qibla direction finder](${SITE}/qibla/): how the Qibla is found, with directions for 60 cities
- [Prayer times by city](${SITE}/prayer-times/): today's prayer times and Qibla direction for 60 major cities
- [Read the Qur'an](${SITE}/surah/): all 114 surahs with translation and audio
- [Duas](${SITE}/duas/): authentic supplications with sources
- [The 99 Names of Allah](${SITE}/names-of-allah/)
- [Prayer times widget for mosques](${SITE}/widget/)

## Optional

- [Open the app](${SITE}/): the full interactive app (needs JavaScript)
`);

/* ── sitemap.xml & robots.txt ────────────────────────────────────────── */
const today = new Date().toISOString().slice(0, 10);
const urls = ["/", "/widget/"].concat(written);
fs.writeFileSync(path.join(ROOT, "sitemap.xml"),
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod></url>`).join("\n") + "\n</urlset>\n");
// Search engines and AI assistants are welcome everywhere (a plain-text guide is at /llms.txt).
fs.writeFileSync(path.join(ROOT, "robots.txt"), ["*", "Googlebot", "Google-Extended", "Bingbot", "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Applebot", "Applebot-Extended"]
  .map((a) => `User-agent: ${a}\nAllow: /\nDisallow: /widget/embed.html\n`).join("\n") + `\n# A plain-text guide for AI assistants: ${SITE}/llms.txt\nSitemap: ${SITE}/sitemap.xml\n`);

console.log(`Wrote ${written.length} pages + sitemap.xml (${urls.length} URLs) + robots.txt`);
