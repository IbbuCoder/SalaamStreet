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

  /* Payments — PayPal.me handle (real money link); server-side PayPal API is a
     future upgrade wired through env vars (see README). No secrets in this file. */
  SS.PAYPAL_HANDLE = "aqmoha";
  SS.PAYPAL_ME = "https://www.paypal.com/paypalme/aqmoha";
  SS.PLANS = [
    { id: "monthly", en: "Monthly", ar: "شهري", price: 4.99, per: "mo", perEn: "month", perAr: "شهر" },
    { id: "yearly", en: "Yearly", ar: "سنوي", price: 39.99, per: "yr", perEn: "year", perAr: "سنة", best: true },
    { id: "lifetime", en: "Lifetime", ar: "مدى الحياة", price: 99.0, per: "once", perEn: "one-time", perAr: "مرة واحدة" },
  ];

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
    reciter: "ar.alafasy", showTransliteration: false, location: null,
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
    try {
      return d.toLocaleTimeString(SS.i18n.isAr() ? "ar" : undefined, { hour: "numeric", minute: "2-digit" });
    } catch (e) { return String(hhmm).slice(0, 5); }
  };
  var toastTimer = null;
  SS.toast = function (msg) {
    var el = document.getElementById("toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2600);
  };

  /* ── Cached fetch ───────────────────────────────────────────── */
  var DAY = 86400000;
  function fetchJson(url) {
    return fetch(url, { headers: { Accept: "application/json" } }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    });
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
    /** Full surah: Arabic + Saheeh International + transliteration (cached 30 days). */
    surahText: function (n) {
      var url = SS.ALQURAN + "/surah/" + n + "/editions/quran-uthmani,en.sahih,en.transliteration";
      return cachedFetch("surah:" + n, url, 30 * DAY).then(function (r) {
        var d = r.data.data;
        return { arabic: d[0].ayahs, translation: d[1].ayahs, transliteration: d[2].ayahs };
      });
    },
    /** Single ayah by global number (daily ayah). */
    ayah: function (g) {
      var url = SS.ALQURAN + "/ayah/" + g + "/editions/quran-uthmani,en.sahih";
      return cachedFetch("ayah:" + g, url, 30 * DAY).then(function (r) {
        var d = r.data.data;
        return { arabic: d[0].text, translation: d[1].text, surah: d[0].surah, numberInSurah: d[0].numberInSurah };
      });
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

  /* ── Premium (client-side gating; provisional until server verification) ─── */
  SS.premium = {
    isActive: function () {
      var p = store.get("premium", null);
      if (!p || !p.active) return false;
      if (p.plan === "lifetime") return true;
      // monthly/yearly: honor an expiry timestamp if present.
      return !p.expires || Date.now() < p.expires;
    },
    plan: function () { var p = store.get("premium", null); return p && p.active ? p.plan : null; },
    activate: function (plan, reference) {
      var now = Date.now();
      var expires = plan === "monthly" ? now + 31 * DAY : plan === "yearly" ? now + 366 * DAY : null;
      store.set("premium", { active: true, plan: plan, reference: reference || "", since: now, expires: expires });
    },
    deactivate: function () { store.set("premium", { active: false }); },
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

        // Geolocation is blocked on http:// and file:// (insecure context) — in
        // that case only manual entry can work, so hide the device options.
        var deviceOk = !!navigator.geolocation && window.isSecureContext !== false;
        var whileBtn = dlg.querySelector('[data-act="while"]');
        var onceBtn = dlg.querySelector('[data-act="once"]');
        if (whileBtn) whileBtn.hidden = !deviceOk;
        if (onceBtn) onceBtn.hidden = !deviceOk;
        if (!deviceOk) form.hidden = false;

        function finish(loc) {
          try { dlg.close(); } catch (e) { /* already closed */ }
          done(loc);
        }

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
            }).finally(function () { btn.disabled = false; });
          };
        });

        form.onsubmit = function (e) {
          e.preventDefault();
          var city = document.getElementById("loc-city").value.trim();
          if (!city) return;
          status.textContent = SS.i18n.t("loc.searching");
          SS.api.geocodeCity(city).then(function (loc) {
            loc.consent = "manual";
            store.saveSettings({ location: loc });
            finish(loc);
          }).catch(function () { status.textContent = SS.i18n.t("loc.notFound"); });
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
