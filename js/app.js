/* SalaamStreet — app.js (classic script)
   Hash router · theme · locale toggle · shared audio player · boot. */
(function () {
  "use strict";
  window.SS = window.SS || {};
  var $ = function (id) { return document.getElementById(id); };

  /* ── Theme ──────────────────────────────────────────────────── */
  SS.applyTheme = function () {
    var s = SS.store.settings();
    var dark = s.theme === "dark";
    if (s.theme === "system" && window.matchMedia) {
      try { dark = window.matchMedia("(prefers-color-scheme: dark)").matches; } catch (e) { /* noop */ }
    }
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  };

  function cycleTheme() {
    var order = ["light", "dark", "system"];
    var s = SS.store.settings();
    var next = order[(order.indexOf(s.theme) + 1) % order.length];
    SS.store.saveSettings({ theme: next });
    SS.applyTheme();
    SS.toast(SS.i18n.t("settings.theme") + ": " + SS.i18n.t("settings.theme" + next.charAt(0).toUpperCase() + next.slice(1)));
  }

  /* ── Audio player (shared, survives view switches) ─────────── */
  var audio = null, curSurah = 0, curAyah = 0, curMeta = null, repeatOne = false;
  var brIdx = 0; // index into SS.AUDIO_BITRATES currently being tried

  function currentReciter() { return SS.store.settings().reciter; }

  function audioSrc(surah, ayah) {
    return SS.AUDIO_URL
      .replace("{bitrate}", String(SS.AUDIO_BITRATES[brIdx]))
      .replace("{edition}", currentReciter())
      .replace("{ayah}", String(SS.globalAyahNumber(surah, ayah)));
  }
  function highlight(n) {
    var playing = document.querySelectorAll(".ayah-card.playing");
    for (var i = 0; i < playing.length; i++) playing[i].classList.remove("playing");
    var el = $("ayah-" + n);
    if (el) { el.classList.add("playing"); el.scrollIntoView({ block: "center", behavior: "smooth" }); }
  }
  function ensureAudio() {
    if (audio) return;
    audio = new Audio();
    audio.addEventListener("ended", function () {
      if (repeatOne) return SS.audio.start(curSurah, curAyah, curMeta);
      if (curMeta && curAyah < curMeta.ayahs) SS.audio.start(curSurah, curAyah + 1, curMeta);
      else {
        $("ab-play").textContent = "▶";
        var playing = document.querySelectorAll(".ayah-card.playing");
        for (var i = 0; i < playing.length; i++) playing[i].classList.remove("playing");
      }
    });
    // A reciter not hosted at the current bitrate 404s → try the next bitrate.
    audio.addEventListener("error", function () {
      if (brIdx < SS.AUDIO_BITRATES.length - 1) { brIdx++; playCurrent(); }
      else { SS.toast(SS.i18n.t("common.error")); $("ab-play").textContent = "▶"; }
    });
    // Once a bitrate works, remember it for this reciter (skip probing next time).
    audio.addEventListener("canplay", function () {
      SS.store.set("audio:br:" + currentReciter(), brIdx);
    });
  }

  function playCurrent() {
    audio.src = audioSrc(curSurah, curAyah);
    audio.playbackRate = +($("ab-speed").value || 1);
    var p = audio.play();
    if (p && p.catch) p.catch(function () { /* interrupted/blocked; error handler covers 404s */ });
  }

  SS.audio = {
    start: function (surah, ayah, meta) {
      ensureAudio();
      curSurah = surah; curAyah = ayah; curMeta = meta;
      brIdx = SS.store.get("audio:br:" + currentReciter(), 0) || 0;
      playCurrent();
      $("audio-bar").hidden = false;
      $("ab-play").textContent = "⏸";
      $("ab-now").textContent = (SS.i18n.isAr() ? meta.ar : meta.en) + " · " + surah + ":" + ayah;
      highlight(ayah);
    },
  };

  function wireAudioBar() {
    $("ab-play").onclick = function () {
      if (!audio) return;
      if (audio.paused) { var p = audio.play(); if (p && p.catch) p.catch(function () {}); this.textContent = "⏸"; }
      else { audio.pause(); this.textContent = "▶"; }
    };
    $("ab-speed").onchange = function () { if (audio) audio.playbackRate = +this.value; };
    $("ab-repeat").onclick = function () {
      repeatOne = !repeatOne;
      this.style.color = repeatOne ? "var(--gold)" : "";
    };
    $("ab-close").onclick = function () {
      if (audio) audio.pause();
      $("audio-bar").hidden = true;
      var playing = document.querySelectorAll(".ayah-card.playing");
      for (var i = 0; i < playing.length; i++) playing[i].classList.remove("playing");
    };
  }

  /* ── Router ─────────────────────────────────────────────────── */
  var VIEWS = ["home", "prayer", "qibla", "quran", "surah", "hadith", "duas", "dhikr",
    "calendar", "premium", "checkout", "membership", "apps", "settings"];
  // Which nav item to highlight for views that aren't themselves nav items.
  var NAV_ALIAS = { surah: "quran", checkout: "premium", membership: "premium" };
  var currentView = "";

  function parseHash() {
    var h = (location.hash || "#/home").replace(/^#\/?/, "");
    var parts = h.split("/");
    var view = parts.shift() || "home";
    if (VIEWS.indexOf(view) === -1) view = "home";
    return { view: view, params: parts };
  }

  function navigate() {
    var r = parseHash();
    currentView = r.view;

    for (var i = 0; i < VIEWS.length; i++) {
      var sec = $("view-" + VIEWS[i]);
      if (sec) sec.hidden = VIEWS[i] !== r.view;
    }

    // Nav highlighting (aliases: surah→quran, checkout/membership→premium).
    var navKey = NAV_ALIAS[r.view] || r.view;
    var links = document.querySelectorAll("[data-nav]");
    for (var j = 0; j < links.length; j++) {
      links[j].classList.toggle("active", links[j].getAttribute("data-nav") === navKey);
    }

    document.title = "SalaamStreet — Your Islamic Companion";
    try {
      if (SS.views[r.view]) SS.views[r.view](r.params);
    } catch (err) {
      // Never let one view break the shell.
      if (window.console) console.error(err);
    }
    window.scrollTo(0, 0);
  }

  /* ── Boot ───────────────────────────────────────────────────── */
  function boot() {
    var s = SS.store.settings();
    SS.viewsReady();
    SS.i18n.initLocale(s.locale);
    SS.applyTheme();
    if (window.matchMedia) {
      try {
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", SS.applyTheme);
      } catch (e) { /* older browsers */ }
    }

    var lt = $("locale-toggle");
    function localeLabel() { lt.textContent = SS.i18n.isAr() ? "English" : "العربية"; }
    localeLabel();
    lt.onclick = function () {
      var next = SS.i18n.isAr() ? "en" : "ar";
      SS.store.saveSettings({ locale: next });
      SS.i18n.setLocale(next);
      localeLabel();
      navigate(); // re-render active view in the new language
    };
    $("theme-toggle").onclick = cycleTheme;

    wireAudioBar();
    window.addEventListener("hashchange", navigate);
    if (!location.hash) location.hash = "#/home";
    navigate();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
