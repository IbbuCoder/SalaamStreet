/* SalaamStreet — app.js (classic script)
   Hash router · theme · locale toggle · navigation · dialogs · shared audio
   player · offline banner · boot. */
(function () {
  "use strict";
  window.SS = window.SS || {};
  var $ = function (id) { return document.getElementById(id); };
  function useIcon(el, name) {
    var u = el.querySelector("use");
    if (u) u.setAttribute("href", "#i-" + name);
  }

  /* ── Theme ──────────────────────────────────────────────────── */
  SS.applyTheme = function () {
    var s = SS.store.settings();
    var dark = s.theme === "dark";
    if (s.theme === "system" && window.matchMedia) {
      try { dark = window.matchMedia("(prefers-color-scheme: dark)").matches; } catch (e) { /* noop */ }
    }
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    var label = SS.i18n.t("settings.theme") + ": " + SS.i18n.t("settings.theme" + s.theme.charAt(0).toUpperCase() + s.theme.slice(1));
    var tb = $("theme-toggle");
    if (tb) { tb.setAttribute("aria-label", label); tb.title = label; }
  };

  function cycleTheme() {
    var order = ["system", "light", "dark"];
    var s = SS.store.settings();
    var next = order[(order.indexOf(s.theme) + 1) % order.length];
    SS.store.saveSettings({ theme: next });
    SS.applyTheme();
    SS.toast(SS.i18n.t("settings.theme") + ": " + SS.i18n.t("settings.theme" + next.charAt(0).toUpperCase() + next.slice(1)));
    if (currentView === "settings") $("st-theme").value = next;
  }

  /* ── Locale ─────────────────────────────────────────────────── */
  SS.updateLocaleToggle = function () {
    var ar = SS.i18n.isAr();
    $("locale-label").textContent = ar ? "English" : "العربية";
    $("locale-toggle").setAttribute("lang", ar ? "en" : "ar");
  };
  SS.changeLocale = function (next) {
    SS.store.saveSettings({ locale: next });
    SS.i18n.setLocale(next);
    SS.updateLocaleToggle();
    SS.applyTheme();
    SS.audio.refreshLabel();
    navigate(true); // re-render the active view in the new language
  };

  /* ── Audio player (shared, survives view switches) ─────────── */
  var audio = null, curSurah = 0, curAyah = 0, curMeta = null, repeatOne = false;
  var brIdx = 0; // index into SS.AUDIO_BITRATES currently being tried

  function currentReciter() { return SS.store.settings().reciter; }
  function reciterName() {
    var id = currentReciter();
    for (var i = 0; i < SS.RECITERS.length; i++) {
      if (SS.RECITERS[i].id === id) return SS.i18n.isAr() ? SS.RECITERS[i].ar : SS.RECITERS[i].en;
    }
    return "";
  }

  function audioSrc(surah, ayah) {
    return SS.AUDIO_URL
      .replace("{bitrate}", String(SS.AUDIO_BITRATES[brIdx]))
      .replace("{edition}", currentReciter())
      .replace("{ayah}", String(SS.globalAyahNumber(surah, ayah)));
  }
  function clearHighlight() {
    var playing = document.querySelectorAll(".ayah-card.playing");
    for (var i = 0; i < playing.length; i++) playing[i].classList.remove("playing");
  }
  /** Highlight the playing ayah — only if that surah is what's on screen. */
  function highlight() {
    clearHighlight();
    if (currentView !== "surah" || SS.readerSurah !== curSurah) return;
    var el = $("ayah-" + curAyah);
    if (el) {
      el.classList.add("playing");
      var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    }
  }
  function setPlayingUI(playing) {
    var b = $("ab-play");
    useIcon(b, playing ? "pause" : "play");
    b.setAttribute("aria-label", SS.i18n.t(playing ? "common.pause" : "common.play"));
    if ("mediaSession" in navigator) {
      try { navigator.mediaSession.playbackState = playing ? "playing" : "paused"; } catch (e) { /* noop */ }
    }
  }
  function ensureAudio() {
    if (audio) return;
    audio = new Audio();
    audio.preload = "auto";
    audio.addEventListener("play", function () { setPlayingUI(true); });
    audio.addEventListener("pause", function () { setPlayingUI(false); });
    audio.addEventListener("timeupdate", function () {
      var pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
      $("ab-progress").style.inlineSize = pct + "%";
    });
    audio.addEventListener("ended", function () {
      if (repeatOne) return SS.audio.start(curSurah, curAyah, curMeta);
      if (curMeta && curAyah < curMeta.ayahs) SS.audio.start(curSurah, curAyah + 1, curMeta);
      else { setPlayingUI(false); clearHighlight(); }
    });
    // A reciter not hosted at the current bitrate 404s → try the next bitrate.
    audio.addEventListener("error", function () {
      if (!audio.src) return;
      if (brIdx < SS.AUDIO_BITRATES.length - 1) { brIdx++; playCurrent(); }
      else {
        SS.toast(navigator.onLine === false ? SS.i18n.t("common.offline") : SS.i18n.t("quran.audioError"));
        setPlayingUI(false);
      }
    });
    // Once a bitrate works, remember it for this reciter (skip probing next time).
    audio.addEventListener("canplay", function () {
      SS.store.set("audio:br:" + currentReciter(), brIdx);
    });
    if ("mediaSession" in navigator) {
      var ms = navigator.mediaSession;
      try {
        ms.setActionHandler("play", function () { audio.play(); });
        ms.setActionHandler("pause", function () { audio.pause(); });
        ms.setActionHandler("previoustrack", function () { step(-1); });
        ms.setActionHandler("nexttrack", function () { step(1); });
      } catch (e) { /* unsupported action */ }
    }
  }

  function playCurrent() {
    audio.src = audioSrc(curSurah, curAyah);
    audio.playbackRate = +($("ab-speed").value || 1);
    var p = audio.play();
    if (p && p.catch) p.catch(function () { setPlayingUI(false); /* blocked/interrupted; error handler covers 404s */ });
  }

  function step(delta) {
    if (!curMeta) return;
    var n = curAyah + delta;
    if (n < 1 || n > curMeta.ayahs) return;
    SS.audio.start(curSurah, n, curMeta);
  }

  function nowLabel() {
    if (!curMeta) return "";
    return (SS.i18n.isAr() ? curMeta.ar : curMeta.en) + " · " + curSurah + ":" + curAyah;
  }

  SS.audio = {
    start: function (surah, ayah, meta) {
      ensureAudio();
      curSurah = surah; curAyah = ayah; curMeta = meta;
      brIdx = SS.store.get("audio:br:" + currentReciter(), 0) || 0;
      playCurrent();
      $("audio-bar").hidden = false;
      document.body.classList.add("has-audio");
      $("ab-now").textContent = nowLabel();
      $("ab-now").setAttribute("href", "#/surah/" + surah + "/" + ayah);
      $("ab-prev").disabled = ayah <= 1;
      $("ab-next").disabled = ayah >= meta.ayahs;
      setPlayingUI(true);
      highlight();
      if ("mediaSession" in navigator && typeof MediaMetadata === "function") {
        try {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: (SS.i18n.isAr() ? meta.ar : meta.en) + " " + surah + ":" + ayah,
            artist: reciterName(), album: "SalaamStreet",
          });
        } catch (e) { /* noop */ }
      }
    },
    /** Re-apply highlight after the reader re-renders. */
    sync: function () { if (audio && !audio.paused) highlight(); },
    refreshLabel: function () { if (curMeta) $("ab-now").textContent = nowLabel(); },
    isActive: function () { return !!audio && !$("audio-bar").hidden; },
    toggle: function () {
      if (!audio) return;
      if (audio.paused) { var p = audio.play(); if (p && p.catch) p.catch(function () {}); }
      else audio.pause();
    },
  };

  function wireAudioBar() {
    $("ab-play").onclick = SS.audio.toggle;
    $("ab-prev").onclick = function () { step(-1); };
    $("ab-next").onclick = function () { step(1); };
    $("ab-speed").onchange = function () { if (audio) audio.playbackRate = +this.value; };
    $("ab-repeat").onclick = function () {
      repeatOne = !repeatOne;
      this.setAttribute("aria-pressed", String(repeatOne));
    };
    $("ab-close").onclick = function () {
      if (audio) { audio.pause(); audio.removeAttribute("src"); audio.load(); }
      $("audio-bar").hidden = true;
      document.body.classList.remove("has-audio");
      clearHighlight();
    };
  }

  /* ── Dialogs: backdrop tap + [data-close] buttons close them ── */
  function wireDialogs() {
    var dialogs = document.querySelectorAll("dialog.modal");
    Array.prototype.forEach.call(dialogs, function (dlg) {
      dlg.addEventListener("click", function (e) {
        if (e.target === dlg) { // click landed on the backdrop area
          var r = dlg.getBoundingClientRect();
          var inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
          if (!inside) dlg.close();
        }
        if (e.target.closest("[data-close]")) dlg.close();
      });
    });
    // Remember what opened a dialog and give focus back when it closes.
    SS.openDialog = function (dlg) {
      var opener = document.activeElement;
      dlg.addEventListener("close", function restore() {
        dlg.removeEventListener("close", restore);
        if (opener && opener.focus && document.contains(opener)) { try { opener.focus({ preventScroll: true }); } catch (e) { /* noop */ } }
      });
      dlg.showModal();
    };
    var more = $("more-sheet");
    $("more-btn").onclick = function () { if (more.showModal) SS.openDialog(more); };
    more.addEventListener("click", function (e) { if (e.target.closest("a")) more.close(); });
  }

  /* ── Router ─────────────────────────────────────────────────── */
  var VIEWS = ["home", "prayer", "qibla", "quran", "surah", "hadith", "duas", "dhikr", "calendar", "settings"];
  // Which nav item to highlight for views that aren't themselves nav items.
  var NAV_ALIAS = { surah: "quran" };
  // Destinations that live in the phone "More" sheet light up the More tab.
  var IN_MORE = { hadith: 1, duas: 1, dhikr: 1, calendar: 1, settings: 1 };
  var TITLE_KEY = {
    home: "nav.dashboard", prayer: "prayer.title", qibla: "qibla.title", quran: "quran.title", surah: "quran.title",
    hadith: "hadith.title", duas: "duas.title", dhikr: "dhikr.title", calendar: "cal.title", settings: "settings.title",
  };
  var currentView = "", currentHash = "";
  SS.currentView = function () { return currentView; };

  function parseHash() {
    var h = (location.hash || "#/home").replace(/^#\/?/, "");
    var parts = h.split("/");
    var view = parts.shift() || "home";
    if (VIEWS.indexOf(view) === -1) view = "home";
    return { view: view, params: parts };
  }

  function navigate(sameView) {
    var r = parseHash();
    var prevView = currentView;
    var hashChanged = location.hash !== currentHash;
    currentHash = location.hash;

    if (prevView && prevView !== r.view && SS.leave && SS.leave[prevView]) {
      try { SS.leave[prevView](); } catch (e) { if (window.console) console.error(e); }
    }
    currentView = r.view;

    for (var i = 0; i < VIEWS.length; i++) {
      var sec = $("view-" + VIEWS[i]);
      if (sec) sec.hidden = VIEWS[i] !== r.view;
    }

    var navKey = NAV_ALIAS[r.view] || r.view;
    var links = document.querySelectorAll("[data-nav]");
    for (var j = 0; j < links.length; j++) {
      var key = links[j].getAttribute("data-nav");
      var on = key === navKey || (key === "more" && IN_MORE[navKey]);
      links[j].classList.toggle("active", !!on);
      if (links[j].tagName === "A") {
        if (key === navKey) links[j].setAttribute("aria-current", "page");
        else links[j].removeAttribute("aria-current");
      }
    }

    var title = SS.i18n.t(TITLE_KEY[r.view] || "nav.dashboard");
    $("tb-title").textContent = r.view === "home" ? "" : title;
    document.title = r.view === "home" ? "SalaamStreet — " + SS.i18n.t("app.tagline") : title + " — SalaamStreet";
    try {
      if (SS.views[r.view]) SS.views[r.view](r.params);
    } catch (err) {
      // Never let one view break the shell.
      if (window.console) console.error(err);
    }

    // New page → top of page, and move focus for screen-reader users.
    // (Skipped for in-page re-renders such as a language switch.)
    if (sameView !== true && hashChanged) {
      var jump = r.view === "surah" && r.params[1];
      if (!jump) window.scrollTo(0, 0);
      if (prevView) {
        var h1s = document.querySelectorAll("#view-" + r.view + " h1"), target = $("main");
        for (var k = 0; k < h1s.length; k++) {
          if (h1s[k].getClientRects().length && !h1s[k].classList.contains("visually-hidden")) { target = h1s[k]; break; }
        }
        if (target.getAttribute("tabindex") === null) target.setAttribute("tabindex", "-1");
        try { target.focus({ preventScroll: true }); } catch (e) { /* noop */ }
      }
    }
  }
  SS.navigate = navigate;

  /* ── Small global behaviours ────────────────────────────────── */
  function wireScrollState() {
    var ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        document.body.classList.toggle("scrolled", window.scrollY > 4);
        ticking = false;
      });
    }, { passive: true });
  }
  function wireNetwork() {
    var banner = $("net-banner");
    function update() { banner.hidden = navigator.onLine !== false; }
    window.addEventListener("online", function () { update(); if (currentView) navigate(true); });
    window.addEventListener("offline", update);
    update();
  }
  function registerServiceWorker() {
    // Service workers need http(s); skip silently when opened from file://.
    if (!("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) return;
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () { /* optional enhancement */ });
    });
  }

  /* ── Boot ───────────────────────────────────────────────────── */
  function boot() {
    var s = SS.store.settings();
    SS.viewsReady();
    SS.i18n.initLocale(s.locale);
    SS.applyTheme();
    SS.updateLocaleToggle();
    // Clean up data left by the retired paid-membership feature.
    SS.store.remove("premium");
    if (window.matchMedia) {
      try {
        var mq = window.matchMedia("(prefers-color-scheme: dark)");
        if (mq.addEventListener) mq.addEventListener("change", SS.applyTheme);
        else if (mq.addListener) mq.addListener(SS.applyTheme);
      } catch (e) { /* older browsers */ }
    }

    $("locale-toggle").onclick = function () { SS.changeLocale(SS.i18n.isAr() ? "en" : "ar"); };
    $("theme-toggle").onclick = cycleTheme;

    wireAudioBar();
    wireDialogs();
    wireScrollState();
    wireNetwork();
    registerServiceWorker();
    window.addEventListener("hashchange", function () { navigate(); });
    if (!location.hash) {
      try { history.replaceState(null, "", "#/home"); } catch (e) { location.hash = "#/home"; }
    }
    navigate();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
