/* SalaamStreet — core.js (classic script)
   Config constants · storage · API clients with caching · location flow · helpers.
   Privacy-first: all personal data stays in localStorage on the device. */
(function () {
  "use strict";
  window.SS = window.SS || {};

  /* ── Config ─────────────────────────────────────────────────── */
  SS.KAABA = { lat: 21.4225, lng: 39.8262 };
  SS.ALADHAN = "https://api.aladhan.com/v1";
  SS.ALQURAN = "https://api.alquran.cloud/v1";
  /* The Islamic Network CDN hosts each reciter at SPECIFIC bitrates only
     (e.g. Alafasy at 128kbps, Abdul Basit Murattal at 192/64kbps). We probe
     from this list and remember what works per reciter. */
  SS.AUDIO_URL = "https://cdn.islamic.network/quran/audio/{bitrate}/{edition}/{ayah}.mp3";
  SS.AUDIO_BITRATES = [128, 64, 192, 48, 40, 32];

  /* Tafsir — spa5k tafsir_api. Ibn Kathir (en). Files live at
     {base}/{edition}/{surah}/{ayah}.json (one file per ayah). jsDelivr first,
     GitHub's raw CDN as a fallback mirror (both send CORS headers). */
  SS.TAFSIR_MIRRORS = [
    "https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir",
    "https://raw.githubusercontent.com/spa5k/tafsir_api/main/tafsir",
  ];
  SS.TAFSIR_BASE = SS.TAFSIR_MIRRORS[0];
  SS.TAFSIR_EDITION = "en-tafisr-ibn-kathir"; // note: repo spells it "tafisr"
  /** URL of one ayah's tafsir file. */
  SS.tafsirUrl = function (surah, ayah, base) {
    return (base || SS.TAFSIR_BASE) + "/" + SS.TAFSIR_EDITION + "/" + surah + "/" + ayah + ".json";
  };
  /* Hadith — fawazahmed0 hadith-api (CORS via jsDelivr). */
  SS.HADITH_BASE = "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions";
  /* Mosque finder — OpenStreetMap data via the public Overpass API (no key). */
  SS.OVERPASS = "https://overpass-api.de/api/interpreter";

  SS.CALC_METHODS = [
    { id: 3, en: "Muslim World League", ar: "رابطة العالم الإسلامي" },
    { id: 2, en: "ISNA (North America)", ar: "الجمعية الإسلامية لأمريكا الشمالية" },
    { id: 5, en: "Egyptian General Authority", ar: "الهيئة المصرية العامة للمساحة" },
    { id: 4, en: "Umm al-Qura (Makkah)", ar: "أم القرى (مكة)" },
    { id: 1, en: "University of Karachi", ar: "جامعة كراتشي" },
    { id: 12, en: "UOIF (France)", ar: "اتحاد المنظمات الإسلامية بفرنسا" },
    { id: 13, en: "Diyanet (Türkiye)", ar: "ديانت (تركيا)" },
  ];
  SS.ASR_METHODS = [
    { id: 0, en: "Standard (majority)", ar: "الجمهور" },
    { id: 1, en: "Hanafi", ar: "حنفي" },
  ];
  SS.RECITERS = [
    { id: "ar.alafasy", en: "Mishary Rashid Alafasy", ar: "مشاري راشد العفاسي" },
    { id: "ar.husary", en: "Mahmoud Khalil Al-Husary", ar: "محمود خليل الحصري" },
    { id: "ar.abdulbasitmurattal", en: "Abdul Basit (Murattal)", ar: "عبد الباسط عبد الصمد" },
    { id: "ar.minshawi", en: "Mohamed Siddiq El-Minshawi", ar: "محمد صديق المنشاوي" },
  ];
  SS.PRAYERS = [
    { key: "Fajr", ar: "الفجر" }, { key: "Sunrise", ar: "الشروق" }, { key: "Dhuhr", ar: "الظهر" },
    { key: "Asr", ar: "العصر" }, { key: "Maghrib", ar: "المغرب" }, { key: "Isha", ar: "العشاء" },
  ];
  SS.DEFAULTS = {
    locale: "en", theme: "system", method: 3, school: 0,
    reciter: "ar.alafasy", showTranslation: true, showTransliteration: false, location: null,
    translation: "en.sahih", timeFormat: "auto", units: "auto", extraTimes: false, continuousPlay: false,
    reminders: false, reminderOffset: 0, reminderSound: true, kahfReminder: true,
    quranGoal: 0, goalTime: "", keepAwake: true, adhkarReminders: false, iconBadge: false, pushReminders: false,
  };
  SS.FALLBACK_LOC = { lat: 21.4225, lng: 39.8262, label: "Makkah (default)", isFallback: true };

  /* ── Storage ────────────────────────────────────────────────── */
  var PREFIX = "salaamstreet:";
  /* Account sync (sync.js/account.js) watches writes to the keys it syncs:
     store.watch(key) says whether a key is synced, store.onWrite(key, old,
     new) is told about each change. Guests are tracked too (just timestamps
     on the device) so their data can be merged into an account later. */
  function notify(key, write) {
    var watched = false;
    try { watched = !!(store.watch && store.watch(key)); } catch (e) { /* noop */ }
    var old = watched ? store.get(key) : null;
    write();
    if (watched && store.onWrite) {
      try { store.onWrite(key, old, write.value); } catch (e) { if (window.console) console.error(e); }
    }
  }
  var store = {
    get: function (key, fb) {
      try {
        var raw = localStorage.getItem(PREFIX + key);
        return raw === null ? (fb === undefined ? null : fb) : JSON.parse(raw);
      } catch (e) { return fb === undefined ? null : fb; }
    },
    set: function (key, val) {
      var w = function () { store.setSilent(key, val); };
      w.value = val;
      notify(key, w);
    },
    remove: function (key) {
      var w = function () { store.removeSilent(key); };
      w.value = undefined;
      notify(key, w);
    },
    /** Raw write/remove that sync itself uses (not reported back to sync). */
    setSilent: function (key, val) {
      try { localStorage.setItem(PREFIX + key, JSON.stringify(val)); } catch (e) { /* full/unavailable */ }
    },
    removeSilent: function (key) {
      try { localStorage.removeItem(PREFIX + key); } catch (e) { /* unavailable */ }
    },
    /** All SalaamStreet keys (without the prefix). */
    keys: function () {
      var out = [];
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf(PREFIX) === 0) out.push(k.slice(PREFIX.length));
        }
      } catch (e) { /* unavailable */ }
      return out;
    },
    settings: function () {
      var s = store.get("settings", {});
      var out = {};
      for (var k in SS.DEFAULTS) out[k] = SS.DEFAULTS[k];
      for (var k2 in s) out[k2] = s[k2];
      return out;
    },
    saveSettings: function (patch) {
      var s = store.get("settings", {});
      for (var k in patch) s[k] = patch[k];
      store.set("settings", s);
    },
    exportAll: function () {
      var out = {};
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf(PREFIX) === 0 && k !== PREFIX + "sync:meta") { // sync bookkeeping isn't "your data"
            try { out[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k)); } catch (e) { /* skip */ }
          }
        }
      } catch (e) { /* unavailable */ }
      return out;
    },
    clearAll: function () {
      try {
        var keys = [];
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf(PREFIX) === 0) keys.push(k);
        }
        keys.forEach(function (k) { localStorage.removeItem(k); });
      } catch (e) { /* unavailable */ }
    },
  };
  SS.store = store;

  /** The Qur'an translation chosen in Settings (falls back to Saheeh International). */
  SS.translation = function () {
    var id = store.settings().translation;
    for (var i = 0; i < (SS.TRANSLATIONS || []).length; i++) if (SS.TRANSLATIONS[i].id === id) return SS.TRANSLATIONS[i];
    return { id: "en.sahih", label: "English — Saheeh International", lang: "en", dir: "ltr" };
  };

  /* ── Helpers ────────────────────────────────────────────────── */
  SS.esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  SS.formatTime = function (hhmm) {
    var parts = String(hhmm).slice(0, 5).split(":");
    var d = new Date();
    d.setHours(+parts[0] || 0, +parts[1] || 0, 0, 0);
    var fmt = store.settings().timeFormat;
    var opts = { hour: "numeric", minute: "2-digit" };
    if (fmt === "12") opts.hour12 = true;
    if (fmt === "24") { opts.hour12 = false; opts.hour = "2-digit"; }
    try {
      return d.toLocaleTimeString(SS.i18n.dateLocale(), opts);
    } catch (e) { return String(hhmm).slice(0, 5); }
  };
  /** "km" or "mi" — Settings choice, or the usual unit for the device's region. */
  SS.units = function () {
    var u = store.settings().units;
    if (u === "km" || u === "mi") return u;
    var lang = (navigator.languages && navigator.languages[0]) || navigator.language || "";
    return /-(US|GB|LR|MM)\b/i.test(lang) ? "mi" : "km";
  };
  /** Distance in km → localized "3.2 km" / "2 mi" / "450 m" / "800 ft". */
  SS.formatDistance = function (km, coarse) {
    var mi = SS.units() === "mi", loc = SS.i18n.dateLocale();
    var v = mi ? km * 0.621371 : km;
    var unit;
    if (!coarse && v < (mi ? 0.1 : 1)) {
      v = mi ? Math.round(km * 3280.84 / 10) * 10 : Math.round(km * 1000 / 10) * 10;
      unit = SS.i18n.t(mi ? "units.ft" : "units.m");
    } else {
      v = coarse || v >= 10 ? Math.round(v) : Math.round(v * 10) / 10;
      unit = SS.i18n.t(mi ? "units.mi" : "units.km");
    }
    var n;
    try { n = v.toLocaleString(loc); } catch (e) { n = String(v); }
    return n + "\u00a0" + unit;
  };
  /** YYYY-MM-DD in the device's local time zone (toISOString would use UTC). */
  SS.localDate = function (d) {
    d = d || new Date();
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  };
  /** "12 Ramadan 1447 AH" from an AlAdhan hijri object, localised. */
  SS.hijriLabel = function (h) {
    if (!h) return "";
    var rtl = SS.i18n.isRtl ? SS.i18n.isRtl() : SS.i18n.isAr();
    return h.day + " " + (rtl ? h.month.ar : h.month.en) + " " + h.year + (rtl ? " هـ" : " AH");
  };
  var toastTimer = null;
  SS.toast = function (msg) {
    var el = document.getElementById("toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.remove("show");
    void el.offsetWidth; // restart the enter animation
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2800);
  };

  /* ── Cached fetch ───────────────────────────────────────────── */
  var DAY = 86400000;
  /** fetch → JSON with a timeout, so a stalled network never leaves a spinner forever. */
  function fetchJson(url) {
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 15000) : null;
    return fetch(url, { headers: { Accept: "application/json" }, signal: ctrl ? ctrl.signal : undefined })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .finally(function () { if (timer) clearTimeout(timer); });
  }
  function cachedFetch(key, url, ttl) {
    var cached = store.get("cache:" + key);
    if (cached && Date.now() - cached.at < ttl) {
      return Promise.resolve({ data: cached.data, fromCache: true });
    }
    return fetchJson(url).then(function (json) {
      store.set("cache:" + key, { at: Date.now(), data: json });
      return { data: json, fromCache: false };
    }).catch(function (err) {
      if (cached) return { data: cached.data, fromCache: true, stale: true };
      throw err;
    });
  }

  /* ── On-device prayer times (js/praytimes.js) ───────────────────
     The location's time zone is remembered from AlAdhan when online, so a
     city typed in from abroad still gets its own clock time offline. */
  function rememberZone(la, lo, meta) {
    if (meta && meta.timezone && store.get("tz:" + la + ":" + lo) !== meta.timezone) store.set("tz:" + la + ":" + lo, meta.timezone);
  }
  function localTimes(o, d) {
    if (!SS.praytimes) return null;
    var zone = store.get("tz:" + o.lat.toFixed(2) + ":" + o.lng.toFixed(2)) || o.tz || null;
    return SS.praytimes.times(d, o.lat, o.lng, { method: o.method, school: o.school, tzOffset: SS.praytimes.tzOffset(d, zone) });
  }
  SS.localPrayerTimes = localTimes;
  /** Hijri date in AlAdhan's shape, from the browser's Umm al-Qura calendar (may differ by a day from local moon-sighting). */
  SS.hijriOf = function (d) {
    var MONTHS = {
      en: ["Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani", "Jumada al-Awwal", "Jumada al-Thani", "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhul-Qi'dah", "Dhul-Hijjah"],
      ar: ["محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"],
    };
    try {
      var p = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "numeric", year: "numeric" })
        .formatToParts(d).reduce(function (o, x) { o[x.type] = x.value; return o; }, {});
      var m = +p.month;
      return { day: String(+p.day), month: { number: m, en: MONTHS.en[m - 1], ar: MONTHS.ar[m - 1] }, year: String(parseInt(p.year, 10)) };
    } catch (e) { return null; }
  };

  /* ── API ────────────────────────────────────────────────────── */
  SS.api = {
    /** Daily prayer times + Hijri date. Coords rounded to 2dp (~1 km) for privacy. */
    prayerTimes: function (o) {
      var la = o.lat.toFixed(2), lo = o.lng.toFixed(2);
      var d = o.date || new Date();
      var dd = ("0" + d.getDate()).slice(-2) + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + d.getFullYear();
      var url = SS.ALADHAN + "/timings/" + dd + "?latitude=" + la + "&longitude=" + lo +
        "&method=" + o.method + "&school=" + o.school;
      return cachedFetch("pt:" + la + ":" + lo + ":" + dd + ":" + o.method + ":" + o.school, url, DAY)
        .then(function (r) {
          rememberZone(la, lo, r.data.data.meta);
          return { timings: r.data.data.timings, hijri: r.data.data.date.hijri, stale: !!r.stale };
        })
        .catch(function (err) {
          // No connection and nothing cached: calculate on the device instead.
          var local = localTimes(o, d);
          if (!local) throw err;
          return { timings: local, hijri: SS.hijriOf(d), stale: true, onDevice: true };
        });
    },
    monthlyTimes: function (o) {
      var la = o.lat.toFixed(2), lo = o.lng.toFixed(2);
      var url = SS.ALADHAN + "/calendar/" + o.year + "/" + o.month + "?latitude=" + la + "&longitude=" + lo +
        "&method=" + o.method + "&school=" + o.school;
      return cachedFetch("ptm:" + la + ":" + lo + ":" + o.year + ":" + o.month + ":" + o.method + ":" + o.school, url, 7 * DAY)
        .then(function (r) { return { days: r.data.data }; })
        .catch(function (err) {
          if (!SS.praytimes) throw err;
          var days = [], n = new Date(o.year, o.month, 0).getDate();
          for (var i = 1; i <= n; i++) {
            var day = new Date(o.year, o.month - 1, i);
            var dd = ("0" + i).slice(-2) + "-" + ("0" + o.month).slice(-2) + "-" + o.year;
            days.push({ timings: localTimes(o, day), date: { gregorian: { date: dd, day: String(i), weekday: { en: day.toLocaleDateString("en-US", { weekday: "long" }) } }, hijri: SS.hijriOf(day) } });
          }
          return { days: days, onDevice: true };
        });
    },
    geocodeCity: function (city) {
      return fetchJson(SS.ALADHAN + "/timingsByAddress?address=" + encodeURIComponent(city))
        .then(function (json) {
          var m = json && json.data && json.data.meta;
          if (!m || typeof m.latitude !== "number") throw new Error("not-found");
          return { lat: +m.latitude.toFixed(2), lng: +m.longitude.toFixed(2), label: city };
        });
    },
    /** Full surah: Arabic + chosen translation + transliteration. The offline
        Qur'an (js/offline.js) is used first when downloaded; otherwise the API,
        cached 30 days. */
    surahText: function (n) {
      var tr = SS.translation().id;
      var url = SS.ALQURAN + "/surah/" + n + "/editions/quran-uthmani," + tr + ",en.transliteration";
      function online() {
        return cachedFetch("surah:" + n + (tr === "en.sahih" ? "" : ":" + tr), url, 30 * DAY).then(function (r) {
          var d = r.data.data;
          return { arabic: d[0].ayahs, translation: d[1].ayahs, transliteration: d[2].ayahs };
        });
      }
      if (!SS.offline) return online();
      return SS.offline.surah(n, tr).then(function (r) { return r || online(); });
    },
    /** Single ayah by global number (daily ayah); offline Qur'an first when downloaded. */
    ayah: function (g) {
      var tr = SS.translation().id;
      var url = SS.ALQURAN + "/ayah/" + g + "/editions/quran-uthmani," + tr;
      function online() {
        return cachedFetch("ayah:" + g + (tr === "en.sahih" ? "" : ":" + tr), url, 30 * DAY).then(function (r) {
          var d = r.data.data;
          return { arabic: d[0].text, translation: d[1].text, surah: d[0].surah, numberInSurah: d[0].numberInSurah };
        });
      }
      if (!SS.offline) return online();
      return SS.offline.ayah(g, tr).then(function (r) { return r || online(); });
    },
    /** Search the chosen translation for a word or phrase. No matches → []. */
    searchQuran: function (q) {
      var tr = SS.translation().id;
      var url = SS.ALQURAN + "/search/" + encodeURIComponent(q) + "/all/" + tr;
      return cachedFetch("search:" + tr + ":" + q.toLowerCase(), url, 7 * DAY).then(function (r) {
        return (r.data && r.data.data && r.data.data.matches) || [];
      }).catch(function (err) {
        if (/HTTP 404/.test(String(err && err.message))) return [];
        throw err;
      });
    },
    /** Mosques near a point from OpenStreetMap (Overpass API). Cached 1 day. */
    mosques: function (lat, lng, radiusM) {
      var la = lat.toFixed(2), lo = lng.toFixed(2);
      var key = "cache:mosques:" + la + ":" + lo + ":" + radiusM;
      var cached = store.get(key);
      if (cached && Date.now() - cached.at < DAY) return Promise.resolve(cached.data);
      var q = "[out:json][timeout:20];(" +
        'node["amenity"="place_of_worship"]["religion"="muslim"](around:' + radiusM + "," + la + "," + lo + ");" +
        'way["amenity"="place_of_worship"]["religion"="muslim"](around:' + radiusM + "," + la + "," + lo + ");" +
        'relation["amenity"="place_of_worship"]["religion"="muslim"](around:' + radiusM + "," + la + "," + lo + ");" +
        ");out center 80;";
      var ctrl = typeof AbortController === "function" ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 25000) : null;
      return fetch(SS.OVERPASS, {
        method: "POST", body: "data=" + encodeURIComponent(q),
        headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: ctrl ? ctrl.signal : undefined,
      }).then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      }).then(function (json) {
        var out = (json.elements || []).map(function (e) {
          var t = e.tags || {};
          return {
            id: e.type + "/" + e.id,
            lat: e.lat != null ? e.lat : e.center && e.center.lat,
            lng: e.lon != null ? e.lon : e.center && e.center.lon,
            name: t["name:en"] || t.name || "", nameAr: t["name:ar"] || "",
            street: [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" "),
            city: t["addr:city"] || "", denomination: t.denomination || "",
          };
        }).filter(function (m) { return typeof m.lat === "number" && typeof m.lng === "number"; });
        store.set(key, { at: Date.now(), data: out });
        return out;
      }).catch(function (err) {
        if (cached) return cached.data;
        throw err;
      }).finally(function () { if (timer) clearTimeout(timer); });
    },
    /** Tafsir (Ibn Kathir, English) for a given surah:ayah. Cached 30 days.
        Tries each mirror in turn and checks the file really is for that ayah,
        so a wrong or stale response can never be shown for another verse. */
    tafsir: function (surah, ayah) {
      surah = +surah; ayah = +ayah;
      if (SS.offline) {
        return SS.offline.tafsir(surah, ayah).then(function (r) { return r || SS.api.tafsirOnline(surah, ayah); });
      }
      return SS.api.tafsirOnline(surah, ayah);
    },
    /** Tafsir from the network (with its own 30-day cache). */
    tafsirOnline: function (surah, ayah) {
      var key = "tafsir2:" + surah + ":" + ayah;
      var cached = store.get("cache:" + key);
      if (cached && Date.now() - cached.at < 30 * DAY && cached.data && cached.data.text) {
        return Promise.resolve({ text: cached.data.text, surah: surah, ayah: ayah, fromCache: true });
      }
      var mirrors = SS.TAFSIR_MIRRORS.slice();
      function attempt(i, lastErr) {
        if (i >= mirrors.length) return Promise.reject(lastErr || new Error("tafsir-unavailable"));
        return fetchJson(SS.tafsirUrl(surah, ayah, mirrors[i])).then(function (json) {
          if (!json || typeof json.text !== "string") throw new Error("tafsir-bad-response");
          if ((json.surah != null && +json.surah !== surah) || (json.ayah != null && +json.ayah !== ayah)) {
            throw new Error("tafsir-mismatch");
          }
          return json;
        }).catch(function (err) { return attempt(i + 1, err); });
      }
      return attempt(0).then(function (json) {
        var text = json.text || "";
        if (text) store.set("cache:" + key, { at: Date.now(), data: { text: text } });
        return { text: text, surah: surah, ayah: ayah, fromCache: false };
      }).catch(function (err) {
        if (cached && cached.data && cached.data.text) return { text: cached.data.text, surah: surah, ayah: ayah, fromCache: true, stale: true };
        throw err;
      });
    },
    /** A full hadith edition (e.g. "eng-nawawi"): metadata + hadiths[]. Cached 30 days. */
    hadithEdition: function (edition) {
      var url = SS.HADITH_BASE + "/" + edition + ".min.json";
      return cachedFetch("hadith:" + edition, url, 30 * DAY).then(function (r) {
        return r.data; // { metadata, hadiths: [{ hadithnumber, text, grades, reference }] }
      });
    },
    /** A single hadith by number from an edition (light; for large collections). */
    hadithOne: function (edition, num) {
      var url = SS.HADITH_BASE + "/" + edition + "/" + num + ".min.json";
      return cachedFetch("hadith1:" + edition + ":" + num, url, 30 * DAY).then(function (r) {
        return (r.data && r.data.hadiths && r.data.hadiths[0]) || null;
      });
    },
    /** Convert a Gregorian date (Date) to Hijri via AlAdhan. Cached 30 days. */
    gToH: function (date) {
      var d = date || new Date();
      var dd = ("0" + d.getDate()).slice(-2) + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + d.getFullYear();
      return cachedFetch("gToH:" + dd, SS.ALADHAN + "/gToH/" + dd, 30 * DAY).then(function (r) {
        return r.data.data.hijri; // { day, month:{number,en,ar}, year, weekday, ... }
      });
    },
  };

  /* ── Location flow ──────────────────────────────────────────── */
  SS.geo = {
    stored: function () { return store.settings().location || null; },
    session: function () {
      try {
        var raw = sessionStorage.getItem("salaamstreet:once-location");
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },
    /** Best available without prompting: session fix → saved → Makkah. */
    best: function () { return SS.geo.session() || SS.geo.stored() || SS.FALLBACK_LOC; },

    /**
     * Approximate location from the device's IANA time zone (no permission
     * needed, ~city accuracy). E.g. "Europe/London" → geocode "London".
     * Cached for the session. Resolves to null if unavailable.
     */
    approx: function () {
      try {
        var raw = sessionStorage.getItem("salaamstreet:approx-location");
        if (raw) return Promise.resolve(JSON.parse(raw));
      } catch (e) { /* noop */ }
      var tz = null;
      try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { /* noop */ }
      if (!tz || tz.indexOf("/") === -1) return Promise.resolve(null);
      var city = tz.split("/").pop().replace(/_/g, " ");
      return SS.api.geocodeCity(city).then(function (loc) {
        loc.approx = true;
        try { sessionStorage.setItem("salaamstreet:approx-location", JSON.stringify(loc)); } catch (e) { /* noop */ }
        return loc;
      }).catch(function () { return null; });
    },

    /**
     * Resolve the location to use, async:
     * session fix → saved (refreshed silently if consent allows) →
     * time-zone approximation → Makkah fallback. Never prompts.
     */
    resolve: function () {
      var session = SS.geo.session();
      if (session) return Promise.resolve(session);
      var stored = SS.geo.stored();
      if (stored) {
        if (stored.consent === "while-using" && navigator.geolocation &&
            window.isSecureContext !== false && navigator.permissions && navigator.permissions.query) {
          return navigator.permissions.query({ name: "geolocation" }).then(function (st) {
            if (st.state !== "granted") return stored;
            return SS.geo.devicePosition().then(function (fresh) {
              fresh.consent = "while-using";
              store.saveSettings({ location: fresh });
              return fresh;
            }).catch(function () { return stored; });
          }).catch(function () { return stored; });
        }
        return Promise.resolve(stored);
      }
      return SS.geo.approx().then(function (a) { return a || SS.FALLBACK_LOC; });
    },

    devicePosition: function () {
      return new Promise(function (resolve, reject) {
        if (!navigator.geolocation) return reject(new Error("unsupported"));
        navigator.geolocation.getCurrentPosition(function (pos) {
          resolve({
            lat: +pos.coords.latitude.toFixed(2),
            lng: +pos.coords.longitude.toFixed(2),
            label: SS.i18n.isAr() ? "موقعي" : "My location",
          });
        }, reject, { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 });
      });
    },

    /** Open the 4-option permission dialog. Resolves with a location or null. */
    request: function () {
      // Guard: if a request is already in flight, don't open a second dialog.
      if (SS.geo._busy) return SS.geo._busy;
      SS.geo._busy = new Promise(function (resolve) {
        var done = function (loc) { SS.geo._busy = null; resolve(loc); };
        var dlg = document.getElementById("loc-dialog");
        if (!dlg || typeof dlg.showModal !== "function") { done(null); return; }
        if (dlg.open) { try { dlg.close(); } catch (e) { /* noop */ } }
        var form = document.getElementById("loc-manual-form");
        var status = document.getElementById("loc-status");
        form.hidden = true; status.textContent = "";
        document.getElementById("loc-city").value = "";

        // Geolocation is blocked on http:// and file:// (insecure context) — in
        // that case only manual entry can work, so hide the device options.
        var deviceOk = !!navigator.geolocation && window.isSecureContext !== false;
        var whileBtn = dlg.querySelector('[data-act="while"]');
        var onceBtn = dlg.querySelector('[data-act="once"]');
        if (whileBtn) whileBtn.hidden = !deviceOk;
        if (onceBtn) onceBtn.hidden = !deviceOk;
        if (!deviceOk) form.hidden = false;

        var settled = false;
        function finish(loc) {
          if (settled) return;
          settled = true;
          dlg.removeEventListener("close", onClose);
          try { dlg.close(); } catch (e) { /* already closed */ }
          done(loc);
        }
        // Esc, the close button, or a backdrop tap dismiss without choosing.
        function onClose() { finish(null); }
        dlg.addEventListener("close", onClose);
        var x = document.getElementById("loc-close");
        if (x) x.onclick = function () { finish(null); };

        var btns = dlg.querySelectorAll("[data-act]");
        Array.prototype.forEach.call(btns, function (btn) {
          btn.onclick = function () {
            var act = btn.getAttribute("data-act");
            if (act === "deny") { store.saveSettings({ location: null }); return finish(null); }
            if (act === "manual") {
              form.hidden = false;
              document.getElementById("loc-city").focus();
              return;
            }
            btn.disabled = true;
            SS.geo.devicePosition().then(function (loc) {
              loc.consent = act === "while" ? "while-using" : "once";
              if (act === "while") store.saveSettings({ location: loc });
              else { try { sessionStorage.setItem("salaamstreet:once-location", JSON.stringify(loc)); } catch (e) { /* noop */ } }
              finish(loc);
            }).catch(function () {
              status.textContent = SS.i18n.t("loc.error");
              form.hidden = false;
              document.getElementById("loc-city").focus();
            }).finally(function () { btn.disabled = false; });
          };
        });

        form.onsubmit = function (e) {
          e.preventDefault();
          var city = document.getElementById("loc-city").value.trim();
          if (!city) return;
          var submit = form.querySelector('[type="submit"]');
          status.textContent = SS.i18n.t("loc.searching");
          if (submit) submit.disabled = true;
          SS.api.geocodeCity(city).then(function (loc) {
            loc.consent = "manual";
            store.saveSettings({ location: loc });
            finish(loc);
          }).catch(function () { status.textContent = SS.i18n.t("loc.notFound"); })
            .finally(function () { if (submit) submit.disabled = false; });
        };

        dlg.showModal();
      });
      return SS.geo._busy;
    },

    clear: function () {
      store.saveSettings({ location: null });
      try {
        sessionStorage.removeItem("salaamstreet:once-location");
        sessionStorage.removeItem("salaamstreet:approx-location");
      } catch (e) { /* noop */ }
    },
  };

  /* ── Qibla math (fully on-device) ──────────────────────────── */
  SS.qiblaBearing = function (lat, lng) {
    var rad = Math.PI / 180;
    var p1 = lat * rad, p2 = SS.KAABA.lat * rad, dl = (SS.KAABA.lng - lng) * rad;
    var y = Math.sin(dl) * Math.cos(p2);
    var x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  };
})();
