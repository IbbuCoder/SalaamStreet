/* SalaamStreet iOS — bridge.js
   Injected by the iOS app (NativeBridge.swift) at document start, before any
   website script. It is part of the app, not the website: in a browser it
   never runs, and inside the app it does nothing unless the native handler
   exists (window.webkit.messageHandlers.ssNative).

   It swaps the browser features that work differently in an app for native
   iOS ones, behind the same web APIs the website already uses, so the
   website's code stays the same:
     navigator.vibrate          → Taptic Engine (dhikr counter, Qibla lock-on)
     navigator.wakeLock         → keep the screen on (idle timer)
     navigator.setAppBadge      → app icon badge
     Notification               → local notifications (+ "I prayed" button)
     navigator.geolocation      → Core Location
     Audio + mediaSession       → AVPlayer: plays with the phone locked, Lock Screen controls
   and it sends iOS what the widgets, Live Activity, Siri, Spotlight and
   reminders need (prayer times in the location's time zone, tracker, Ayah of
   the Day), using the website's own settings, texts and calculations. */
(function () {
  "use strict";
  var handler = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.ssNative;
  if (!handler || window.SSNative) return;
  var CFG = window.__SSNativeConfig || {};
  var FIVE = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
  function noop() {}

  /** One request to iOS; resolves with its reply, rejects with its error. */
  function call(action, payload) {
    try { return Promise.resolve(handler.postMessage({ action: action, payload: payload || {} })); }
    catch (e) { return Promise.reject(e); }
  }
  var listeners = {};
  function on(name, fn) { (listeners[name] = listeners[name] || []).push(fn); }
  function define(obj, name, value) {
    try { Object.defineProperty(obj, name, { value: value, configurable: true, writable: true }); } catch (e) { try { obj[name] = value; } catch (e2) { /* read-only */ } }
  }

  window.SSNative = {
    platform: "ios",
    version: CFG.version,
    bundled: true,
    authRedirect: CFG.authRedirect,
    call: call,
    /** Native → page events (NativeBridge.emit). */
    _emit: function (name, data) {
      (listeners[name] || []).forEach(function (fn) { try { fn(data || {}); } catch (e) { report("error", e && (e.stack || e.message) || e); } });
    },
  };

  /* ── JavaScript errors → Xcode console (and the app's tests) ───────── */
  function report(level, msg) { call("log", { level: level, message: String(msg).slice(0, 1000) }).catch(noop); }
  window.addEventListener("error", function (e) {
    var t = e.target;
    if (t && t !== window && (t.src || t.href)) report("resource", "failed to load " + (t.src || t.href));
    else report("error", (e.message || "error") + " @ " + (e.filename || "") + ":" + (e.lineno || 0));
  }, true);
  window.addEventListener("unhandledrejection", function (e) {
    var r = e.reason;
    report("rejection", "unhandled rejection: " + (r && (r.stack || r.message) || r));
  });
  if (window.console && console.error) {
    var consoleError = console.error;
    console.error = function () {
      try { report("console", Array.prototype.map.call(arguments, function (a) { return a && a.stack || String(a); }).join(" ")); } catch (e) { /* noop */ }
      return consoleError.apply(console, arguments);
    };
  }

  /* ── Haptics ───────────────────────────────────────────────────────── */
  define(navigator, "vibrate", function (pattern) {
    if (pattern === undefined || pattern === null) return false;
    call("haptic", { pattern: Array.isArray(pattern) ? pattern.slice(0, 20).map(Number) : Number(pattern) }).catch(noop);
    return true;
  });

  /* ── Keep the screen on ────────────────────────────────────────────── */
  var locks = [];
  function syncIdle() { call("idleTimer", { on: locks.length > 0 }).catch(noop); }
  function Sentinel() { this.type = "screen"; this.released = false; this.onrelease = null; this._fns = []; }
  Sentinel.prototype.addEventListener = function (t, fn) { if (t === "release" && typeof fn === "function") this._fns.push(fn); };
  Sentinel.prototype.removeEventListener = function (t, fn) { this._fns = this._fns.filter(function (f) { return f !== fn; }); };
  Sentinel.prototype.release = function () {
    if (!this.released) {
      var self = this;
      this.released = true;
      locks = locks.filter(function (l) { return l !== self; });
      syncIdle();
      var ev = { type: "release", target: this };
      this._fns.forEach(function (fn) { try { fn(ev); } catch (e) { /* noop */ } });
      if (typeof this.onrelease === "function") this.onrelease(ev);
    }
    return Promise.resolve();
  };
  define(navigator, "wakeLock", {
    request: function () {
      if (document.visibilityState !== "visible") return Promise.reject(new Error("NotAllowedError"));
      var s = new Sentinel();
      locks.push(s);
      syncIdle();
      return Promise.resolve(s);
    },
  });
  // Like browsers: a wake lock ends when the page is hidden.
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "visible") locks.slice().forEach(function (l) { l.release(); });
  });

  /* ── App icon badge ────────────────────────────────────────────────── */
  define(navigator, "setAppBadge", function (n) {
    return call("badge", { count: Math.max(0, Math.min(99, Math.floor(+n || 0))) }).catch(noop);
  });
  define(navigator, "clearAppBadge", function () { return call("badge", { count: 0 }).catch(noop); });

  /* ── Notifications ─────────────────────────────────────────────────── */
  var notifPerm = CFG.notif === "granted" || CFG.notif === "denied" ? CFG.notif : "default";
  function toHash(url) {
    var m = String(url || "").match(/#\/[^\s]*$/);
    return m ? m[0] : "#/home";
  }
  function prayedOf(url) {
    var m = String(url || "").match(/#\/home\/prayed\/(Fajr|Dhuhr|Asr|Maghrib|Isha)(?:\/(\d{4}-\d{2}-\d{2}))?$/);
    return m ? { key: m[1], date: m[2] || localDate(new Date()) } : null;
  }
  function settings() { try { return window.SS && SS.store ? SS.store.settings() : {}; } catch (e) { return {}; } }
  function NativeNotification(title, opts) {
    opts = opts || {};
    this.title = String(title || "");
    this.body = opts.body || "";
    this.tag = opts.tag || "";
    this.data = opts.data;
    this.onclick = this.onclose = this.onerror = this.onshow = null;
    if (notifPerm !== "granted") return;
    var url = opts.data && opts.data.url, pr = prayedOf(opts.data && opts.data.prayed);
    call("notify.show", {
      tag: this.tag || "n-" + Date.now(), title: this.title, body: this.body, hash: toHash(url),
      prayedKey: pr && pr.key, prayedDate: pr && pr.date, sound: settings().reminderSound !== false,
    }).catch(noop);
  }
  NativeNotification.prototype.close = noop;
  NativeNotification.prototype.addEventListener = noop;
  NativeNotification.prototype.removeEventListener = noop;
  Object.defineProperty(NativeNotification, "permission", { get: function () { return notifPerm; } });
  NativeNotification.requestPermission = function (cb) {
    return call("notify.request").then(function (s) { return s; }, function () { return notifPerm; }).then(function (s) {
      notifPerm = s === "granted" || s === "denied" ? s : "default";
      if (typeof cb === "function") cb(notifPerm);
      syncSoon();
      return notifPerm;
    });
  };
  define(window, "Notification", NativeNotification);
  // Reminders that arrive with the app closed are planned below (planReminders),
  // so the website's Web Push option has nothing to do in the app.
  try { delete window.PushManager; } catch (e) { /* noop */ }
  if ("PushManager" in window) define(window, "PushManager", undefined);

  /* ── Location ──────────────────────────────────────────────────────── */
  var watches = {}, watchSeq = 0;
  function geoError(e) {
    var m = String(e && e.message || e), code = /geo:1/.test(m) ? 1 : /geo:3/.test(m) ? 3 : 2;
    return { code: code, message: ["", "User denied Geolocation", "Position unavailable", "Timeout expired"][code], PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 };
  }
  var geolocation = {
    getCurrentPosition: function (ok, fail, opts) {
      call("geo.get", { high: !!(opts && opts.enableHighAccuracy) }).then(function (r) {
        if (ok) ok({ coords: { latitude: r.lat, longitude: r.lng, accuracy: r.accuracy, altitude: r.altitude, altitudeAccuracy: null, heading: null, speed: null }, timestamp: r.timestamp });
      }, function (e) { if (fail) fail(geoError(e)); });
    },
    watchPosition: function (ok, fail, opts) {
      var id = ++watchSeq;
      var run = function () { if (watches[id]) geolocation.getCurrentPosition(ok, fail, opts); };
      watches[id] = setInterval(run, 15000);
      run();
      return id;
    },
    clearWatch: function (id) { clearInterval(watches[id]); delete watches[id]; },
  };
  define(navigator, "geolocation", geolocation);
  if (navigator.permissions && navigator.permissions.query) {
    var query = navigator.permissions.query.bind(navigator.permissions);
    var status = function (state) { return { state: state, status: state, onchange: null, addEventListener: noop, removeEventListener: noop }; };
    define(navigator.permissions, "query", function (d) {
      if (d && d.name === "geolocation") return call("geo.status").then(status, function () { return status("prompt"); });
      if (d && d.name === "notifications") return Promise.resolve(status(notifPerm === "default" ? "prompt" : notifPerm));
      return query(d);
    });
  }

  /* ── Qur'an recitation through AVPlayer ────────────────────────────── */
  var current = null;      // the Audio object iOS is playing for
  var adoptSeq = null;     // set when iOS moved to the next ayah by itself
  var advanceTimer = null;
  var playSeq = 0;
  function fire(target, type) { try { target.dispatchEvent(new Event(type)); } catch (e) { report("error", e); } }
  function later(target, type) { setTimeout(function () { fire(target, type); }, 0); }
  function surahTitle(s, a) {
    var meta = window.SS && SS.SURAHS && SS.SURAHS[s - 1];
    if (!meta) return "";
    var ar = SS.i18n && SS.i18n.isAr && SS.i18n.isAr();
    return (ar ? meta.ar : meta.en) + " " + s + ":" + a;
  }
  function fileKey(reciter, s, a) { return String(reciter).replace(/[^A-Za-z0-9._-]/g, "_") + "-" + s + "-" + a; }
  function toBase64(buf) {
    var bytes = new Uint8Array(buf), out = "", CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) out += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(out);
  }
  /** A downloaded ayah (website Cache storage, Offline page) → a file AVPlayer can play. */
  function sendFile(url, key) {
    return fetch(url).then(function (r) { return r.arrayBuffer(); }).then(function (b) {
      return call("audio.file", { fileKey: key, data: toBase64(b) });
    });
  }
  var offlineToken = 0;
  /** Copy the next downloaded ayahs to iOS in the background, so they play locked and offline. */
  function copyOfflineAhead(reciter, items) {
    var token = ++offlineToken;
    if (!(window.SS && SS.offline && SS.offline.hasAudio && SS.offline.audioUrl)) return;
    var list = items.filter(function (n) { return SS.offline.hasAudio(reciter, n.surah); }).slice(0, 300);
    (function next(i) {
      if (token !== offlineToken || i >= list.length) return;
      var n = list[i], key = fileKey(reciter, n.surah, n.ayah);
      call("audio.hasFile", { fileKey: key }).then(function (has) {
        if (has) return null;
        return SS.offline.audioUrl(reciter, n.surah, n.ayah).then(function (u) {
          if (!u) return null;
          return sendFile(u, key).then(function () { if (u.indexOf("blob:") === 0) URL.revokeObjectURL(u); });
        });
      }).catch(noop).then(function () { next(i + 1); });
    })(0);
  }

  class NativeAudio extends EventTarget {
    constructor(src) {
      super();
      this._src = ""; this._time = 0; this._rate = 1;
      this.paused = true; this.ended = false; this.duration = NaN; this.readyState = 0;
      this.preload = "auto"; this.volume = 1; this.muted = false; this.crossOrigin = null; this.error = null; this.autoplay = false;
      if (src) this.src = src;
    }
    get src() { return this._src; }
    set src(v) { this._src = v ? String(v) : ""; this._time = 0; this.duration = NaN; this.ended = false; this.readyState = 0; this.error = null; }
    get currentSrc() { return this._src; }
    get currentTime() { return this._time; }
    set currentTime(t) { this._time = +t || 0; if (current === this) call("audio.seek", { time: this._time }).catch(noop); }
    get playbackRate() { return this._rate; }
    set playbackRate(r) { this._rate = Math.min(4, Math.max(0.25, +r || 1)); if (current === this && !this.paused) call("audio.rate", { rate: this._rate }).catch(noop); }
    load() {}
    canPlayType() { return "maybe"; }
    play() {
      var self = this, src = this._src;
      if (!src) return Promise.reject(new DOMException("No source", "NotSupportedError"));
      current = this;
      var mine = ++playSeq;
      var plan = null;
      try { plan = window.SS && SS.audio && SS.audio.plan ? SS.audio.plan(300) : null; } catch (e) { plan = null; }
      var reciter = plan ? plan.reciter : "", cur = plan && plan.current;
      var isBlob = src.indexOf("blob:") === 0;
      var key = cur ? reciter + ":" + cur.surah + ":" + cur.ayah : src;
      var fk = cur ? fileKey(reciter, cur.surah, cur.ayah) : "blob-" + mine;
      var payload = {
        key: key, src: isBlob ? (cur ? cur.src : "") : src, fileKey: fk,
        title: cur ? surahTitle(cur.surah, cur.ayah) : "SalaamStreet", rate: this._rate,
        plan: (plan ? plan.next : []).map(function (n) {
          return { key: reciter + ":" + n.surah + ":" + n.ayah, src: n.src, title: surahTitle(n.surah, n.ayah), fileKey: fileKey(reciter, n.surah, n.ayah) };
        }),
      };
      if (adoptSeq !== null) { payload.adoptSeq = adoptSeq; adoptSeq = null; clearTimeout(advanceTimer); }
      this.paused = false; this.ended = false;
      later(this, "play");
      return (isBlob ? sendFile(src, fk) : Promise.resolve()).then(function () {
        return call("audio.play", payload);
      }).then(function () {
        if (plan && mine === playSeq) copyOfflineAhead(reciter, plan.next);
      }, function (e) {
        if (mine !== playSeq) return;
        self.paused = true;
        self.error = { code: 4, message: String(e && e.message || e) };
        fire(self, "error");
        throw e;
      });
    }
    pause() {
      if (this.paused) return;
      this.paused = true;
      if (current === this) call("audio.pause").catch(noop);
      later(this, "pause");
    }
  }
  define(window, "Audio", NativeAudio);

  on("audio", function (d) {
    var a = current;
    if (!a) return;
    switch (d.type) {
      case "play":
        if (a.paused) { a.paused = false; fire(a, "play"); }
        fire(a, "playing");
        break;
      case "pause":
        if (!a.paused) { a.paused = true; fire(a, "pause"); }
        break;
      case "loaded":
        if (d.duration) a.duration = d.duration;
        a.readyState = 4;
        fire(a, "loadedmetadata"); fire(a, "canplay");
        break;
      case "time":
        a._time = d.time || 0;
        if (d.duration) a.duration = d.duration;
        fire(a, "timeupdate");
        break;
      case "advance":
        // iOS already moved on to the ayah the website would pick next. The
        // website's "ended" handler asks for it, and the player adopts it.
        adoptSeq = d.seq;
        a.ended = true;
        fire(a, "ended");
        clearTimeout(advanceTimer);
        advanceTimer = setTimeout(function () {
          // The website chose to stop instead (e.g. a setting changed meanwhile).
          if (adoptSeq === d.seq) { adoptSeq = null; call("audio.stop").catch(noop); a.paused = true; fire(a, "pause"); }
        }, 4000);
        break;
      case "ended":
        a.paused = true; a.ended = true;
        fire(a, "pause"); fire(a, "ended");
        break;
      case "error":
        a.error = { code: 4 };
        fire(a, "error");
        break;
    }
  });

  var actionHandlers = {}, metadata = null;
  var mediaSession = {
    playbackState: "none",
    setActionHandler: function (action, fn) { actionHandlers[action] = fn; },
    setPositionState: noop,
    setMicrophoneActive: noop,
    setCameraActive: noop,
  };
  Object.defineProperty(mediaSession, "metadata", {
    get: function () { return metadata; },
    set: function (m) {
      metadata = m;
      if (m) call("audio.meta", { title: String(m.title || ""), artist: String(m.artist || "") }).catch(noop);
    },
  });
  define(navigator, "mediaSession", mediaSession);
  if (typeof window.MediaMetadata !== "function") {
    define(window, "MediaMetadata", function MediaMetadata(o) { o = o || {}; this.title = o.title || ""; this.artist = o.artist || ""; this.album = o.album || ""; this.artwork = o.artwork || []; });
  }
  on("remote", function (d) {
    var fn = actionHandlers[d.action];
    if (fn) fn({ action: d.action });
  });

  /* ── Small helpers shared with the website's data ──────────────────── */
  function pad(n) { return ("0" + n).slice(-2); }
  function localDate(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function deviceZone() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch (e) { return "UTC"; } }
  /** Minutes the zone is ahead of UTC at `ms`. */
  function zoneOffset(tz, ms) {
    try {
      var p = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" })
        .formatToParts(new Date(ms)).reduce(function (o, x) { o[x.type] = +x.value; return o; }, {});
      return (Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - Math.floor(ms / 1000) * 1000) / 60000;
    } catch (e) { return -new Date(ms).getTimezoneOffset(); }
  }
  /** "HH:MM" on "YYYY-MM-DD" in the location's time zone → epoch ms. */
  function zonedTime(day, hhmm, tz) {
    var d = day.split("-").map(Number), t = String(hhmm).slice(0, 5).split(":").map(Number);
    var guess = Date.UTC(d[0], d[1] - 1, d[2], t[0] || 0, t[1] || 0);
    var ms = guess - zoneOffset(tz, guess) * 60000;
    return guess - zoneOffset(tz, ms) * 60000;
  }
  function t(k) { return SS.i18n.t(k); }
  function f(k, v) { return SS.ui && SS.ui.f ? SS.ui.f(k, v) : t(k); }

  /* ── App-only words (the website has no text for these) ────────────── */
  var WORDS = {
    en: { live: "Prayer countdown on the Lock Screen and in the Dynamic Island", liveOff: "Turn on Live Activities for SalaamStreet in the iPhone's Settings.", inWord: "in", now: "Now" },
    ar: { live: "عدّ تنازلي للصلاة على شاشة القفل وفي الجزيرة الديناميكية", liveOff: "فعّل «الأنشطة الحية» لتطبيق SalaamStreet من إعدادات iPhone.", inWord: "بعد", now: "الآن" },
    ur: { live: "لاک اسکرین اور ڈائنامک آئی لینڈ پر نماز کی الٹی گنتی", liveOff: "iPhone کی سیٹنگز میں SalaamStreet کے لیے Live Activities آن کریں۔", inWord: "میں", now: "ابھی" },
    bn: { live: "লক স্ক্রিন ও ডায়নামিক আইল্যান্ডে নামাজের কাউন্টডাউন", liveOff: "iPhone-এর সেটিংসে SalaamStreet-এর জন্য Live Activities চালু করুন।", inWord: "বাকি", now: "এখন" },
    id: { live: "Hitung mundur salat di Layar Terkunci dan Dynamic Island", liveOff: "Nyalakan Aktivitas Langsung untuk SalaamStreet di Pengaturan iPhone.", inWord: "dalam", now: "Sekarang" },
    tr: { live: "Kilit Ekranında ve Dynamic Island'da namaz geri sayımı", liveOff: "iPhone Ayarları'nda SalaamStreet için Canlı Etkinlikler'i açın.", inWord: "içinde", now: "Şimdi" },
    fr: { live: "Compte à rebours de la prière sur l'écran verrouillé et dans la Dynamic Island", liveOff: "Activez les Activités en direct pour SalaamStreet dans les Réglages de l'iPhone.", inWord: "dans", now: "Maintenant" },
  };
  function word(k) { var l = SS.i18n.getLocale(); return (WORDS[l] || WORDS.en)[k] || WORDS.en[k]; }

  /* ── Website ready → hand iOS what it needs ────────────────────────── */
  function siteReady() {
    return !!(window.SS && SS.store && SS.api && SS.geo && SS.i18n && SS.i18n.t && SS.tracker && SS.audio && SS.ui && SS.SURAHS && SS.views);
  }
  var syncTimer = null, booted = false;
  function syncSoon() { if (!booted) return; clearTimeout(syncTimer); syncTimer = setTimeout(syncAll, 700); }

  /** Today and the next six days of prayer times, as the website calculates them. */
  function prayerDays(loc, s) {
    var la = loc.lat.toFixed(2), lo = loc.lng.toFixed(2);
    var base = new Date();
    var days = [];
    var first = [0, 1].map(function (i) {
      var d = addDays(base, i);
      return SS.api.prayerTimes({ lat: loc.lat, lng: loc.lng, method: s.method, school: s.school, date: d }).then(function (r) {
        return { date: localDate(d), hijri: r.hijri ? SS.hijriLabel(r.hijri) : null, timings: pick(r.timings) };
      }, function () { return null; });
    });
    return Promise.all(first).then(function (two) {
      two.forEach(function (x) { if (x) days.push(x); });
      for (var i = 2; i < 7; i++) {
        var d = addDays(base, i), tm = SS.localPrayerTimes ? SS.localPrayerTimes({ lat: loc.lat, lng: loc.lng, method: s.method, school: s.school }, d) : null;
        if (tm) days.push({ date: localDate(d), hijri: SS.hijriOf ? SS.hijriLabel(SS.hijriOf(d)) : null, timings: pick(tm) });
      }
      return { days: days, tz: SS.store.get("tz:" + la + ":" + lo) || deviceZone() };
    });
  }
  function pick(tm) {
    var out = {};
    ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"].forEach(function (k) { if (tm && tm[k]) out[k] = String(tm[k]).slice(0, 5); });
    return out;
  }
  function ayahsAhead() {
    var list = [0, 1, 2].map(function (i) {
      var d = addDays(new Date(), i);
      var seed = d.getFullYear() * 1000 + (d.getMonth() + 1) * 50 + d.getDate(); // same pick as the Home page
      var g = (seed * 48271) % SS.TOTAL_AYAHS + 1;
      return SS.api.ayah(g).then(function (a) {
        return { date: localDate(d), arabic: a.arabic, translation: a.translation, ref: a.surah.englishName + " " + a.surah.number + ":" + a.numberInSurah,
          surah: a.surah.number, ayah: a.numberInSurah, dir: SS.translation().dir };
      }, function () { return null; });
    });
    return Promise.all(list).then(function (x) { return x.filter(Boolean); });
  }

  function syncAll() {
    if (!siteReady()) return;
    var s = SS.store.settings();
    SS.geo.resolve().then(function (loc) {
      return Promise.all([prayerDays(loc, s), ayahsAhead()]).then(function (r) {
        var pd = r[0], names = {};
        ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"].forEach(function (k) { names[k] = t("prayer." + k); });
        var log = SS.tracker.log(), tracker = {};
        [0, -1].forEach(function (i) { var ds = localDate(addDays(new Date(), i)); if (log[ds]) tracker[ds] = log[ds]; });
        var snap = {
          v: 1, updatedAt: Date.now(), locale: SS.i18n.getLocale(), rtl: !!(SS.i18n.isRtl ? SS.i18n.isRtl() : SS.i18n.isAr()),
          timeFormat: String(s.timeFormat || "auto"),
          location: { label: SS.ui.locLabel ? SS.ui.locLabel(loc) : loc.label || "", lat: loc.lat, lng: loc.lng, tz: pd.tz },
          days: pd.days, names: names,
          labels: {
            next: t("dash.nextPrayer"), today: t("prayer.daily"), prayed: t("daily.iPrayed"), ayahOfDay: t("dash.dailyAyah"),
            qibla: t("nav.qibla"), "in": word("inWord"), now: word("now"),
            qaPrayer: t("nav.prayer"), qaQibla: t("nav.qibla"), qaQuran: t("nav.quran"), qaDhikr: t("nav.dhikr"),
          },
          tracker: tracker, ayahs: r[1], qibla: SS.qiblaBearing ? SS.qiblaBearing(loc.lat, loc.lng) : null,
          remindersOn: !!s.reminders,
        };
        if (!pd.days.length) return;
        call("snapshot", snap).catch(function (e) { report("console", "snapshot: " + (e && e.message || e)); });
        planReminders(pd, loc, s);
      });
    }).catch(function (e) { report("console", "sync: " + (e && e.message || e)); });
    indexSpotlight();
  }

  /** The website's reminders for the next 7 days, so they arrive with the app closed. */
  function planReminders(pd, loc, s) {
    var items = [], quiet = !!(SS.modes && SS.modes.quiet && SS.modes.quiet());
    var sound = s.reminderSound !== false && !quiet;
    var off = (+s.reminderOffset || 0) * 60000;
    var today = localDate(new Date());
    var place = SS.ui.locLabel ? SS.ui.locLabel(loc) : "";
    if (notifPerm === "granted") {
      pd.days.forEach(function (day) {
        if (s.reminders) {
          FIVE.forEach(function (key) {
            if (!day.timings[key]) return;
            var name = t("prayer." + key);
            items.push({
              tag: "prayer-" + day.date + "-" + key, at: zonedTime(day.date, day.timings[key], pd.tz) - off,
              title: off ? f("rem.soon", { p: name, n: s.reminderOffset }) : f("rem.now", { p: name }),
              body: SS.formatTime(day.timings[key]) + " · " + place, hash: "#/home", prayedKey: key, prayedDate: day.date, sound: sound,
            });
          });
          // Friday: Surah Al-Kahf at 10:00 (as on the website).
          var dd = day.date.split("-").map(Number), date = new Date(dd[0], dd[1] - 1, dd[2], 10, 0, 0);
          if (s.kahfReminder !== false && !quiet && date.getDay() === 5 && SS.store.get("kahf:notified") !== day.date) {
            items.push({ tag: "kahf-" + day.date, at: date.getTime(), title: t("friday.title"), body: t("friday.notify"), hash: "#/surah/18", sound: sound });
          }
        }
        if (s.adhkarReminders && !quiet) {
          var done = (SS.store.get("adhkar:done", {}) || {})[day.date] || {};
          [["morning", "Fajr"], ["evening", "Asr"]].forEach(function (x) {
            if (done[x[0]] || !day.timings[x[1]]) return;
            items.push({ tag: "adhkar-" + x[0] + "-" + day.date, at: zonedTime(day.date, day.timings[x[1]], pd.tz) + 20 * 60000,
              title: t("daily.adhkarRem_" + x[0]), body: t("daily.adhkarRemBody"), hash: "#/adhkar/" + x[0], sound: sound });
          });
        }
        if (s.goalTime && +s.quranGoal && !quiet) {
          var count = day.date === today && SS.quranGoal ? SS.quranGoal.count() : 0;
          if (count < +s.quranGoal) {
            var hm = s.goalTime.split(":"), p = day.date.split("-").map(Number);
            items.push({ tag: "goal-" + day.date, at: new Date(p[0], p[1] - 1, p[2], +hm[0], +hm[1]).getTime(),
              title: t("daily.goalRemTitle"), body: f("daily.goalRemBody", { n: count, goal: +s.quranGoal }), hash: "#/quran", sound: sound });
          }
        }
      });
    }
    call("notify.schedule", { prayedTitle: t("daily.iPrayed"), items: items }).catch(noop);
  }

  var spotlightDone = "";
  function indexSpotlight() {
    var version = (SS.VERSION || "") + ":" + SS.i18n.getLocale();
    if (spotlightDone === version) return;
    spotlightDone = version;
    var items = SS.SURAHS.map(function (m, i) {
      var n = m.n || i + 1;
      return { domain: "surah", hash: "#/surah/" + n, title: n + ". " + m.en + " · " + m.ar, subtitle: m.meaning + " · " + m.ayahs + " ayahs", keywords: [m.en, m.ar, m.meaning, "Surah", String(n), "Quran"] };
    });
    (SS.DUAS || []).forEach(function (d) {
      if (!d.titleEn) return;
      items.push({ domain: "dua", hash: "#/duas/" + encodeURIComponent(d.category || ""), title: d.titleEn, subtitle: d.translationEn || "", keywords: ["Dua", d.category || "", d.source || ""] });
    });
    [["#/prayer", "nav.prayer"], ["#/qibla", "nav.qibla"], ["#/quran", "nav.quran"], ["#/dhikr", "nav.dhikr"], ["#/duas", "nav.duas"],
      ["#/adhkar", "nav.adhkar"], ["#/names", "nav.names"], ["#/calendar", "nav.calendar"], ["#/hadith", "nav.hadith"], ["#/mosques", "nav.mosques"], ["#/learn", "nav.learn"]]
      .forEach(function (p) { items.push({ domain: "page", hash: p[0], title: t(p[1]) + " — SalaamStreet", subtitle: "", keywords: [t(p[1])] }); });
    call("spotlight", { version: version, items: items }).catch(noop);
  }

  /** "I prayed" from a notification button, a widget or Siri → the website's tracker. */
  function applyPrayed(items) {
    var done = [];
    (items || []).forEach(function (it) {
      if (FIVE.indexOf(it.key) < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(it.date)) return;
      if (!SS.tracker.isDone(it.date, it.key)) {
        SS.tracker.toggle(it.date, it.key);
        SS.toast(f("daily.marked", { p: t("prayer." + it.key) }));
      }
      done.push(it);
    });
    if (!done.length) return;
    if (SS.hooks && SS.hooks.trackerChanged) SS.hooks.trackerChanged();
    if (SS.currentView && SS.currentView() === "home" && window.dispatchEvent) window.dispatchEvent(new HashChangeEvent("hashchange"));
    call("prayedApplied", { items: done }).catch(noop);
    syncSoon();
  }
  on("prayed", function (d) { if (siteReady()) applyPrayed(d.items); });

  on("navigate", function (d) {
    if (typeof d.hash === "string" && /^#\/[\w\-/%.]*$/.test(d.hash)) {
      if (location.hash === d.hash) window.dispatchEvent(new HashChangeEvent("hashchange"));
      else location.hash = d.hash;
    }
  });
  on("playSurah", function (d) {
    var n = +d.surah;
    if (!(n >= 1 && n <= 114) || !siteReady()) return;
    if (location.hash.indexOf("#/surah/" + n) !== 0) location.hash = "#/surah/" + n;
    setTimeout(function () { SS.audio.start(n, 1, SS.SURAHS[n - 1]); }, 300);
  });

  /* ── Theme: status bar and system sheets follow the website ────────── */
  function sendTheme() {
    var pref = settings().theme;
    call("theme", { pref: pref === "light" || pref === "dark" ? pref : "system", resolved: document.documentElement.getAttribute("data-theme") || "" }).catch(noop);
  }

  /* ── Settings: the Lock Screen countdown switch (iOS only) ─────────── */
  function liveSwitch() {
    var kahf = document.getElementById("st-kahf");
    var row = kahf && kahf.closest(".set-row");
    if (!row || document.getElementById("st-ios-live")) return;
    var el = document.createElement("div");
    el.className = "set-row";
    el.id = "st-ios-live-row";
    el.innerHTML = '<span id="st-ios-live-l"></span><label class="switch"><input type="checkbox" id="st-ios-live" aria-labelledby="st-ios-live-l" /><span class="trk"></span><span class="th"></span></label>';
    row.parentNode.insertBefore(el, row.nextSibling);
    var box = el.querySelector("input");
    el.querySelector("span").textContent = word("live");
    call("activity.status").then(function (st) { box.checked = !!(st && st.running); }, noop);
    box.onchange = function () {
      if (box.checked) {
        call("activity.start").then(function () { SS.toast(t("settings.saved")); }, function (e) {
          box.checked = false;
          SS.toast(/turned off|disabled/i.test(String(e && e.message)) ? word("liveOff") : String(e && e.message || e));
        });
      } else call("activity.stop").catch(noop);
    };
  }

  /* ── Offline page: the app itself is always available offline ──────── */
  function fixOfflineStatus() {
    var li = document.querySelector("#view-offline .off-status-list li.is-warn");
    if (!li || li.getAttribute("data-ios")) return;
    li.setAttribute("data-ios", "1");
    li.className = "";
    var use = li.querySelector("use");
    if (use) use.setAttribute("href", "#i-check");
    var span = li.querySelector("span");
    if (span) span.textContent = t("offp.appReady");
  }

  /* ── The audio bar's sleep timer, run natively so it works locked ──── */
  document.addEventListener("click", function (e) {
    if (!e.target.closest || !e.target.closest("#ab-sleep")) return;
    setTimeout(function () {
      var n = document.getElementById("ab-sleep-n");
      var m = n && !n.hidden ? parseInt(n.textContent, 10) || 0 : 0;
      call("audio.sleep", { minutes: m }).catch(noop);
    }, 0);
  }, true);

  function boot() {
    if (booted) return;
    booted = true;
    sendTheme();
    new MutationObserver(sendTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    var mo = new MutationObserver(function () { liveSwitch(); fixOfflineStatus(); });
    mo.observe(document.body, { childList: true, subtree: true });
    liveSwitch(); fixOfflineStatus();
    // Changes the widgets and reminders depend on.
    var set = SS.store.set;
    SS.store.set = function (k) {
      var r = set.apply(this, arguments);
      // A theme choice must reach iOS even when the page's colours don't change
      // (e.g. Dark → System while iOS itself is showing the app dark).
      if (String(k) === "settings") sendTheme();
      if (/^(settings|prayers:log|tz:|adhkar:done|quran:today)/.test(String(k))) syncSoon();
      return r;
    };
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") syncSoon(); });
    setInterval(function () { if (document.visibilityState === "visible") syncAll(); }, 15 * 60000);
    call("ready", { version: SS.VERSION || "" }).then(function (r) {
      if (r && r.pendingPrayed && r.pendingPrayed.length) applyPrayed(r.pendingPrayed);
    }).catch(noop);
    syncAll();
  }
  var tries = 0;
  (function wait() {
    if (siteReady() && document.body && SS.i18n.getLocale) return setTimeout(boot, 400);
    if (++tries < 150) setTimeout(wait, 100);
    else report("error", "bridge: the website did not finish starting");
  })();
})();
