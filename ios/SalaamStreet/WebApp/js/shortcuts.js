/* SalaamStreet — shortcuts.js (classic script)
   3.1: three things that make the website feel at home on a phone.

   1. Shortcut links (#/go/…) — fixed addresses that do one thing, for the
      iPhone Shortcuts app ("Hey Siri, continue Qur'an"), Android home-screen
      shortcuts, the installed app's icon menu and reminders:
        #/go/continue        the ayah you last read (or the Qur'an list)
        #/go/next-prayer     prayer times, with the next prayer
        #/go/qibla  #/go/dhikr  #/go/duas  #/go/calendar  #/go/ai
        #/go/morning  #/go/evening   the adhkar
        #/go/kahf            open Al-Kahf and recite it
        #/go/play/36         open a surah and recite it
        #/go/ayah            Home, at the Ayah of the Day
      Settings → Siri & Shortcuts lists them with a copy button.
   2. The Lock Screen while listening — a clean artwork card for the surah
      (Arabic and English name, ayah number, progress), drawn on a canvas and
      handed to the Media Session, so phones and computers show it on the
      Lock Screen, in Control Centre and on the media controls.
   3. Focus reading — a distraction-free, full-screen reader for the Qur'an. */
(function () {
  "use strict";
  window.SS = window.SS || {};
  var $ = function (id) { return document.getElementById(id); };
  function t(k) { return SS.i18n.t(k); }
  function f(k, v) { return SS.ui && SS.ui.f ? SS.ui.f(k, v) : t(k); }
  function esc(s) { return SS.esc ? SS.esc(s) : String(s); }

  /* ═══════════ 1. Shortcut links ═══════════ */
  var SIMPLE = {
    qibla: "#/qibla", dhikr: "#/dhikr", duas: "#/duas", calendar: "#/calendar", ai: "#/ai",
    morning: "#/adhkar/morning", evening: "#/adhkar/evening", "next-prayer": "#/prayer", quran: "#/quran", ayah: "#/home",
  };

  /** Where #/go/<parts> leads, and what to do once that page is open. */
  function resolve(parts) {
    var what = String(parts[0] || "").toLowerCase();
    if (SIMPLE[what]) {
      return { hash: SIMPLE[what], after: what === "ayah" ? scrollToAyahOfDay : null };
    }
    if (what === "continue") {
      var last = SS.store && SS.store.get("quran:lastRead");
      if (last && last.surah >= 1 && last.surah <= 114) return { hash: "#/surah/" + last.surah + "/" + (last.ayah || 1) };
      return { hash: "#/quran" };
    }
    var n = what === "kahf" ? 18 : what === "play" ? parseInt(parts[1], 10) : 0;
    if (n >= 1 && n <= 114) return { hash: "#/surah/" + n, after: function () { recite(n); } };
    return { hash: "#/home" };
  }

  function recite(n) {
    if (!SS.audio || !SS.SURAHS) return;
    SS.audio.start(n, 1, SS.SURAHS[n - 1]);
    // Browsers only start sound after a tap: when a shortcut opens the page,
    // the player waits, paused, with its play button ready.
    setTimeout(function () {
      if (SS.audio.state(n, 1).loaded && !SS.audio.state(n, 1).playing) SS.toast(t("sc.tapPlay"));
    }, 1500);
  }
  function scrollToAyahOfDay() {
    var card = document.querySelector("[data-home='ayah'], #daily-ayah, .daily-ayah");
    if (card) card.scrollIntoView({ block: "center" });
  }

  /** The shortcut links Settings offers, in the page's language. */
  function list() {
    return [
      ["continue", "sc.continue", "i-open-book"],
      ["next-prayer", "dash.nextPrayer", "i-clock"],
      ["qibla", "nav.qibla", "i-compass"],
      ["kahf", "sc.kahf", "i-play"],
      ["morning", "adhkar.morning", "i-sunrise"],
      ["evening", "adhkar.evening", "i-moon"],
      ["dhikr", "nav.dhikr", "i-beads"],
      ["ayah", "dash.dailyAyah", "i-book"],
      ["ai", "ai.title", "i-sparkle"],
    ];
  }
  function linkFor(id) {
    var base = location.protocol === "https:" || location.protocol === "http:"
      ? location.origin + location.pathname.replace(/index\.html$/, "") : "https://salaamstreet.com/";
    return base + "#/go/" + id;
  }
  function copy(text) {
    var done = function () { SS.toast(t("common.copied")); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(done, function () { SS.toast(text); });
    }
    SS.toast(text);
    return Promise.resolve();
  }

  function renderSettings() {
    var box = $("st-shortcuts");
    if (!box) return;
    box.innerHTML = list().map(function (s) {
      return '<div class="set-row sc-row"><span class="row sc-name"><svg class="ic" aria-hidden="true"><use href="#' + s[2] + '"/></svg>' +
        '<span><span class="sc-label">' + esc(t(s[1])) + '</span><code class="sc-link" dir="ltr">' + esc("#/go/" + s[0]) + "</code></span></span>" +
        '<button class="btn btn-outline btn-sm" type="button" data-sc="' + s[0] + '" aria-label="' + esc(t("common.copy") + " — " + t(s[1])) + '">' +
        '<svg class="ic" aria-hidden="true"><use href="#i-copy"/></svg><span>' + esc(t("common.copy")) + "</span></button></div>";
    }).join("");
    box.onclick = function (e) {
      var b = e.target.closest && e.target.closest("[data-sc]");
      if (b) copy(linkFor(b.getAttribute("data-sc")));
    };
  }

  /* ═══════════ 2. The Lock Screen while listening ═══════════ */
  var ART = 512, artCache = {}, artOrder = [];

  function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([
      document.fonts.load('700 96px "Amiri"', "الكهف"),
      document.fonts.load('700 34px "Figtree"', "Al-Kahf"),
    ]).catch(function () { /* the fallback fonts are fine */ });
  }
  function fitFont(ctx, text, weight, size, family, maxW) {
    var s = size;
    do { ctx.font = weight + " " + s + "px " + family; s -= 4; } while (s > 20 && ctx.measureText(text).width > maxW);
  }
  /** An eight-pointed star: two squares, one turned by 45°. */
  function star(ctx, cx, cy, r) {
    for (var k = 0; k < 2; k++) {
      ctx.beginPath();
      for (var i = 0; i < 4; i++) {
        var a = Math.PI / 4 * k + Math.PI / 2 * i;
        var x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }

  /** The artwork for one ayah, as a PNG data URL (or "" where canvases aren't available). */
  function drawArt(surah, ayah, meta) {
    var canvas = document.createElement("canvas");
    canvas.width = canvas.height = ART;
    var ctx = canvas.getContext && canvas.getContext("2d");
    if (!ctx) return "";
    var g = ctx.createLinearGradient(0, 0, ART, ART);
    g.addColorStop(0, "#065f46");
    g.addColorStop(1, "#022c22");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, ART, ART);
    ctx.strokeStyle = "rgba(201,162,39,.28)";
    ctx.lineWidth = 2;
    star(ctx, ART / 2, 212, 150);
    ctx.strokeStyle = "rgba(201,162,39,.12)";
    star(ctx, ART / 2, 212, 176);

    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ffffff";
    ctx.direction = "rtl";
    fitFont(ctx, meta.ar, "700", 104, '"Amiri", "Scheherazade New", serif', 330);
    ctx.fillText(meta.ar, ART / 2, 240);
    ctx.direction = "ltr";
    fitFont(ctx, meta.en, "800", 38, '"Figtree", system-ui, sans-serif', 420);
    ctx.fillText(meta.en, ART / 2, 340);
    ctx.fillStyle = "#a7f3d0";
    fitFont(ctx, meta.meaning || "", "500", 24, '"Figtree", system-ui, sans-serif', 420);
    ctx.fillText(meta.meaning || "", ART / 2, 374);

    // Progress through the surah.
    var x0 = 72, x1 = ART - 72, y = 440, frac = Math.max(0, Math.min(1, ayah / (meta.ayahs || 1)));
    ctx.fillStyle = "rgba(255,255,255,.16)";
    roundRect(ctx, x0, y, x1 - x0, 6, 3);
    ctx.fillStyle = "#c9a227";
    roundRect(ctx, x0, y, Math.max(6, (x1 - x0) * frac), 6, 3);
    ctx.font = '600 20px "Figtree", system-ui, sans-serif';
    ctx.fillStyle = "#d1fae5";
    ctx.textAlign = "left";
    ctx.fillText(surah + ":" + ayah, x0, y - 14);
    ctx.textAlign = "right";
    ctx.fillText(ayah + " / " + meta.ayahs, x1, y - 14);
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.font = '700 17px "Figtree", system-ui, sans-serif';
    ctx.fillText("SalaamStreet", ART / 2, 488);
    try { return canvas.toDataURL("image/png"); } catch (e) { return ""; }
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
    ctx.fill();
  }

  /** Media Session metadata for an ayah: a clean title, the reciter, and the artwork. */
  function metadata(surah, ayah, meta, reciter) {
    var ar = SS.i18n.isAr && SS.i18n.isAr();
    // The title keeps "18:23" (the iOS app's Lock Screen shows it as it is).
    return {
      title: (ar ? meta.ar : meta.en) + " " + surah + ":" + ayah,
      artist: reciter || "",
      album: f("np.ayahOf", { n: ayah, total: meta.ayahs }) + " · " + (ar ? meta.en : meta.meaning || meta.ar),
    };
  }

  /** Resolves with [{ src, sizes, type }] for MediaMetadata.artwork. */
  function artwork(surah, ayah, meta) {
    var key = surah + ":" + ayah;
    if (artCache[key]) return Promise.resolve(artCache[key]);
    return fontsReady().then(function () {
      var src = drawArt(surah, ayah, meta);
      var art = src ? [{ src: src, sizes: ART + "x" + ART, type: "image/png" }] : [];
      artCache[key] = art;
      artOrder.push(key);
      if (artOrder.length > 8) delete artCache[artOrder.shift()];
      return art;
    });
  }

  SS.nowPlaying = {
    metadata: metadata,
    artwork: artwork,
    /** Set the Lock Screen card for the ayah now playing (the art follows a moment later). */
    show: function (surah, ayah, meta, reciter) {
      if (!("mediaSession" in navigator) || typeof MediaMetadata !== "function" || !meta) return;
      var info = metadata(surah, ayah, meta, reciter);
      try { navigator.mediaSession.metadata = new MediaMetadata(info); } catch (e) { return; }
      // The iOS app draws its own Lock Screen; there the page's artwork isn't used.
      if (window.SSNative && window.SSNative.platform === "ios") return;
      var token = surah + ":" + ayah;
      SS.nowPlaying._token = token;
      artwork(surah, ayah, meta).then(function (art) {
        if (SS.nowPlaying._token !== token || !art.length) return;
        try { navigator.mediaSession.metadata = new MediaMetadata(Object.assign({ artwork: art }, info)); } catch (e) { /* noop */ }
      });
    },
  };

  /* ═══════════ 3. Focus reading ═══════════ */
  function focusOn() { return document.body.classList.contains("reading-focus"); }
  function setFocus(on) {
    document.body.classList.toggle("reading-focus", on);
    var b = $("sr-focus");
    if (b) b.setAttribute("aria-pressed", String(on));
    var root = document.documentElement;
    try {
      if (on && root.requestFullscreen && !document.fullscreenElement) root.requestFullscreen({ navigationUI: "hide" }).catch(function () {});
      if (!on && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
    } catch (e) { /* full screen isn't available here (e.g. iPhone Safari): the page still hides its own bars */ }
  }
  function wireFocus() {
    var b = $("sr-focus"), x = $("sr-focus-exit");
    if (b) b.onclick = function () { setFocus(!focusOn()); };
    if (x) x.onclick = function () { setFocus(false); };
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && focusOn()) setFocus(false);
    });
    // Leaving full screen with the system gesture ends focus too.
    document.addEventListener("fullscreenchange", function () {
      if (!document.fullscreenElement && focusOn() && window.matchMedia && !matchMedia("(display-mode: standalone)").matches) setFocus(false);
    });
    window.addEventListener("hashchange", function () {
      if (focusOn() && !/^#\/surah\//.test(location.hash)) setFocus(false);
    });
  }

  SS.shortcuts = { resolve: resolve, list: list, link: linkFor, focus: setFocus };

  function hooks() { return (SS.hooks = SS.hooks || {}); }
  var prev = hooks().settingsInit;
  hooks().settingsInit = function () {
    if (prev) prev.apply(null, arguments);
    renderSettings();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wireFocus);
  else wireFocus();
})();
