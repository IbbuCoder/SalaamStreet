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

  /* Tafsir — spa5k tafsir_api (CORS via jsDelivr). Ibn Kathir (en). */
  SS.TAFSIR_BASE = "https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir";
  SS.TAFSIR_EDITION = "en-tafisr-ibn-kathir"; // note: repo spells it "tafisr"
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
  };
  SS.FALLBACK_LOC = { lat: 21.4225, lng: 39.8262, label: "Makkah (default)", isFallback: true };

  /* ── Storage ────────────────────────────────────────────────── */
  var PREFIX = "salaamstreet:";
  var store = {
    get: function (key, fb) {
      try {
        var raw = localStorage.getItem(PREFIX + key);
        return raw === null ? (fb === undefined ? null : fb) : JSON.parse(raw);
      } catch (e) { return fb === undefined ? null : fb; }
    },
    set: function (key, val) {
      try { localStorage.setItem(PREFIX + key, JSON.stringify(val)); } catch (e) { /* full/unavailable */ }
    },
    remove: function (key) {
      try { localStorage.removeItem(PREFIX + key); } catch (e) { /* unavailable */ }
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
          if (k && k.indexOf(PREFIX) === 0) {
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
          return { timings: r.data.data.timings, hijri: r.data.data.date.hijri, stale: !!r.stale };
        });
    },
    monthlyTimes: function (o) {
      var la = o.lat.toFixed(2), lo = o.lng.toFixed(2);
      var url = SS.ALADHAN + "/calendar/" + o.year + "/" + o.month + "?latitude=" + la + "&longitude=" + lo +
        "&method=" + o.method + "&school=" + o.school;
      return cachedFetch("ptm:" + la + ":" + lo + ":" + o.year + ":" + o.month + ":" + o.method + ":" + o.school, url, 7 * DAY)
        .then(function (r) { return { days: r.data.data }; });
    },
    geocodeCity: function (city) {
      return fetchJson(SS.ALADHAN + "/timingsByAddress?address=" + encodeURIComponent(city))
        .then(function (json) {
          var m = json && json.data && json.data.meta;
          if (!m || typeof m.latitude !== "number") throw new Error("not-found");
          return { lat: +m.latitude.toFixed(2), lng: +m.longitude.toFixed(2), label: city };
        });
    },
    /** Full surah: Arabic + chosen translation + transliteration (cached 30 days). */
    surahText: function (n) {
      var tr = SS.translation().id;
      var url = SS.ALQURAN + "/surah/" + n + "/editions/quran-uthmani," + tr + ",en.transliteration";
      return cachedFetch("surah:" + n + (tr === "en.sahih" ? "" : ":" + tr), url, 30 * DAY).then(function (r) {
        var d = r.data.data;
        return { arabic: d[0].ayahs, translation: d[1].ayahs, transliteration: d[2].ayahs };
      });
    },
    /** Single ayah by global number (daily ayah). */
    ayah: function (g) {
      var tr = SS.translation().id;
      var url = SS.ALQURAN + "/ayah/" + g + "/editions/quran-uthmani," + tr;
      return cachedFetch("ayah:" + g + (tr === "en.sahih" ? "" : ":" + tr), url, 30 * DAY).then(function (r) {
        var d = r.data.data;
        return { arabic: d[0].text, translation: d[1].text, surah: d[0].surah, numberInSurah: d[0].numberInSurah };
      });
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
    /** Tafsir (Ibn Kathir, English) for a given surah:ayah. Cached 30 days. */
    tafsir: function (surah, ayah) {
      var url = SS.TAFSIR_BASE + "/" + SS.TAFSIR_EDITION + "/" + surah + "_" + ayah + ".json";
      return cachedFetch("tafsir:" + surah + ":" + ayah, url, 30 * DAY).then(function (r) {
        return { text: (r.data && r.data.text) || "", surah: surah, ayah: ayah };
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
