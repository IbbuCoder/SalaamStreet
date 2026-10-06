/* SalaamStreet — stories-ui.js (classic script)
   2.9 SalaamStreet Stories: the #/stories library, the full-screen
   tap-through viewer (#/stories/<id>[/<slide>]) and the row of story circles
   on Home. Story content is in js/stories.js; Qur'an quotes are loaded from
   the app's Qur'an source (SS.api.surahText — offline when downloaded).
   "Today" is a story built each day from the Ayah, Name, Dua and Hadith of
   the day. Progress stays on the device. */
(function () {
  "use strict";
  window.SS = window.SS || {};
  var $ = function (id) { return document.getElementById(id); };
  var DAY = 86400000;
  function t(k) { return SS.i18n.t(k); }
  function f(k, v) { return SS.ui.f(k, v); }
  function esc(s) { return SS.esc(s); }
  function icon(n, c) { return SS.ui.icon(n, c); }
  function isAr() { return SS.i18n.isAr(); }
  function L(o) { return o ? (isAr() && o.ar ? o.ar : o.en) : ""; }
  function dayOfYear() { var n = new Date(), s = new Date(n.getFullYear(), 0, 0); return Math.floor((n - s) / DAY); }
  function onHook(name, fn) {
    SS.hooks = SS.hooks || {};
    var prev = SS.hooks[name];
    SS.hooks[name] = function () { if (prev) prev.apply(null, arguments); fn.apply(null, arguments); };
  }

  /* ── Progress (on this device) ── */
  function progress() { return SS.store.get("stories:progress", {}) || {}; }
  function seen(id, n, total) {
    var p = progress(), cur = p[id] || { at: 0, done: false };
    if (n > cur.at) cur.at = n;
    if (n >= total) cur.done = true;
    p[id] = cur;
    SS.store.set("stories:progress", p);
  }
  function isDone(id) {
    if (id === "today") return SS.store.get("stories:today") === SS.localDate();
    var p = progress()[id];
    return !!(p && p.done);
  }
  function story(id) {
    if (id === "today") return todayStory();
    for (var i = 0; i < SS.STORIES.length; i++) if (SS.STORIES[i].id === id) return SS.STORIES[i];
    return null;
  }
  function coverHtml(s, cls) {
    var done = isDone(s.id);
    var longName = s.ar && s.ar.length > 4;
    return '<span class="st-cover' + (done ? " done" : "") + (longName ? " long" : "") + (cls ? " " + cls : "") + '" style="--hue:' + s.hue + '" aria-hidden="true">' +
      (s.id === "today" ? icon("sun") : '<span lang="ar">' + esc(s.ar) + "</span>") + "</span>";
  }

  /* ── "Today": a story made from the day's Ayah, Name, Dua and Hadith ── */
  function todayStory() {
    var doy = dayOfYear(), today = new Date();
    var seed = today.getFullYear() * 1000 + (today.getMonth() + 1) * 50 + today.getDate();
    var g = (seed * 48271) % SS.TOTAL_AYAHS + 1; // the same Ayah of the day as Home
    var nm = SS.NAMES[doy % SS.NAMES.length];
    var dua = SS.DUAS[doy % SS.DUAS.length];
    return {
      id: "today", en: "Today", ar: "اليوم", hue: 160,
      sub: { en: "Ayah, Name, Dua and Hadith of the day", ar: "آية واسم ودعاء وحديث اليوم" },
      slides: [
        { label: "stories.ayahOfDay", load: function () {
          return SS.api.ayah(g).then(function (a) {
            return { arabic: a.arabic, text: a.translation, ref: "Qur'an " + a.surah.number + ":" + a.numberInSurah + " · " + a.surah.englishName, play: [a.surah.number, a.numberInSurah] };
          });
        } },
        { label: "stories.nameOfDay", load: function () {
          return Promise.resolve({ arabic: nm.ar, big: true, text: nm.tr + " — " + nm.en, ref: t("names.title") + " · " + nm.n });
        } },
        { label: "stories.duaOfDay", load: function () {
          return Promise.resolve({ arabic: dua.arabic, text: isAr() ? "" : dua.translationEn, title: isAr() ? "" : dua.titleEn, ref: dua.source });
        } },
        { label: "stories.hadithOfDay", load: function () {
          var coll = SS.HADITH_COLLECTIONS[0];
          return Promise.all([SS.api.hadithEdition(coll.eng), SS.api.hadithEdition(coll.ara).catch(function () { return null; })]).then(function (r) {
            var list = r[0].hadiths.filter(function (h) { return h.text; }), h = list[doy % list.length];
            var ara = r[1] && r[1].hadiths.filter(function (x) { return x.hadithnumber === h.hadithnumber; })[0];
            var clip = function (s) { s = String(s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(); return s.length > 420 ? s.slice(0, 400).replace(/\s\S*$/, "") + " …" : s; };
            return { arabic: isAr() && ara ? clip(ara.text) : "", text: isAr() && ara ? "" : clip(h.text), ref: coll.cite + " " + h.hadithnumber, link: "#/hadith/" + coll.id + "/" + h.hadithnumber };
          });
        } },
      ],
    };
  }

  /* ═══════════ Library (#/stories) ═══════════ */
  function storiesInit(params) {
    var total = SS.STORIES.length, read = 0;
    for (var i = 0; i < total; i++) if (isDone(SS.STORIES[i].id)) read++;
    $("stl-progress").textContent = f("stories.progress", { n: read, total: total });
    var html = cardHtml(todayStory(), true);
    $("stl-today").innerHTML = html;
    html = "";
    SS.STORIES.forEach(function (s) { html += cardHtml(s); });
    $("stl-list").innerHTML = html;
    if (params && params[0]) open(params[0], +params[1] || 1, "#/stories");
    else if (viewerOpen) close(true);
  }
  function cardHtml(s, today) {
    var p = progress()[s.id], n = s.slides.length;
    var state = isDone(s.id) ? t("stories.read") : p && p.at ? f("stories.partOf", { n: p.at, total: n }) : f("stories.parts", { n: n });
    return '<a class="card st-card' + (today ? " st-today" : "") + '" href="#/stories/' + s.id + '">' + coverHtml(s) +
      '<span class="st-body"><span class="st-name">' + esc(L(s)) + (isAr() || s.id === "today" ? "" : ' <span class="st-ar" lang="ar">' + esc(s.ar) + "</span>") + "</span>" +
      '<span class="st-sub">' + esc(L(s.sub)) + '</span><span class="st-state">' + esc(state) + "</span></span>" +
      '<svg class="ic chev flip" aria-hidden="true"><use href="#i-chev-r"/></svg></a>';
  }

  /* ═══════════ Home row ═══════════ */
  function homeRow() {
    var el = $("story-row");
    if (!el || !SS.STORIES) return;
    var list = [todayStory()].concat(SS.STORIES);
    // Unread first (after Today), so there's always something new at the start.
    var rest = list.slice(1);
    rest.sort(function (a, b) { return (isDone(a.id) ? 1 : 0) - (isDone(b.id) ? 1 : 0); });
    list = [list[0]].concat(rest);
    el.innerHTML = list.map(function (s) {
      return '<a class="st-bubble" href="#/stories/' + s.id + '" data-from="home">' + coverHtml(s) +
        '<span class="st-bubble-name">' + esc(L(s)) + "</span></a>";
    }).join("") + '<a class="st-bubble st-all" href="#/stories">' + '<span class="st-cover st-more" aria-hidden="true">' + icon("grid") + '</span><span class="st-bubble-name">' + esc(t("stories.all")) + "</span></a>";
    el.onclick = function (e) {
      var a = e.target.closest("a[data-from]");
      if (a) returnTo = "#/home";
    };
  }
  onHook("homeInit", homeRow);

  /* ═══════════ Viewer ═══════════ */
  var cur = null, idx = 0, viewerOpen = false, returnTo = "#/stories", gen = 0, lastFocus = null;

  function open(id, n, from) {
    var s = story(id);
    if (!s) { location.hash = "#/stories"; return; }
    if (!viewerOpen) { lastFocus = document.activeElement; if (from && returnTo !== "#/home") returnTo = from; }
    cur = s;
    viewerOpen = true;
    var v = $("story-viewer");
    v.hidden = false;
    v.style.setProperty("--hue", s.hue);
    document.body.classList.add("sv-open");
    $("sv-title").textContent = L(s);
    $("sv-cover").outerHTML = coverHtml(s, "sv-cover-mini").replace('class="st-cover', 'id="sv-cover" class="st-cover');
    $("sv-bars").innerHTML = s.slides.map(function () { return "<i><b></b></i>"; }).join("");
    show(Math.max(0, Math.min(s.slides.length - 1, (n || 1) - 1)));
    setTimeout(function () { try { v.focus({ preventScroll: true }); } catch (e) { v.focus(); } }, 0);
  }
  function close(silent) {
    if (!viewerOpen) return;
    viewerOpen = false;
    gen++;
    $("story-viewer").hidden = true;
    document.body.classList.remove("sv-open");
    var back = returnTo || "#/stories";
    returnTo = "#/stories";
    if (!silent) location.hash = back;
    if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) { /* gone */ }
  }

  function show(i) {
    idx = i;
    var s = cur, slide = s.slides[i], my = ++gen;
    var bars = $("sv-bars").children;
    for (var k = 0; k < bars.length; k++) bars[k].className = k < i ? "done" : k === i ? "now" : "";
    $("sv-count").textContent = f("stories.slideOf", { n: i + 1, total: s.slides.length });
    $("sv-prev").disabled = i === 0;
    $("sv-next").setAttribute("aria-label", i === s.slides.length - 1 ? t("stories.finish") : t("stories.next"));
    try { history.replaceState(null, "", "#/stories/" + s.id + (i ? "/" + (i + 1) : "")); } catch (e) { /* file:// */ }
    var stage = $("sv-stage");
    stage.setAttribute("aria-busy", "true");
    stage.innerHTML = '<div class="sv-slide sv-loading"><span class="sk-text" style="inline-size:70%"></span><span class="sk-text" style="inline-size:85%"></span></div>';
    $("sv-listen").hidden = true;
    render(slide).then(function (html) {
      if (my !== gen) return;
      stage.innerHTML = html;
      stage.removeAttribute("aria-busy");
      var slideEl = stage.firstChild;
      var play = slideEl && slideEl.getAttribute("data-play");
      $("sv-listen").hidden = !play;
      if (play) $("sv-listen").setAttribute("data-play", play);
    });
    if (s.id === "today") { if (i === s.slides.length - 1) SS.store.set("stories:today", SS.localDate()); }
    else seen(s.id, i + 1, s.slides.length);
  }

  /** One slide → HTML. Qur'an text comes from the app's Qur'an source. */
  function render(slide) {
    var ar = isAr();
    if (slide.load) {
      return slide.load().then(function (d) {
        return '<div class="sv-slide"' + (d.play ? ' data-play="' + d.play.join(":") + '"' : "") + ">" +
          '<p class="sv-kicker">' + esc(t(slide.label)) + "</p>" +
          (d.title ? '<p class="sv-title2">' + esc(d.title) + "</p>" : "") +
          (d.arabic ? '<p class="sv-arabic' + (d.big ? " big" : "") + '" lang="ar" dir="rtl">' + esc(d.arabic) + "</p>" : "") +
          (d.text ? '<p class="sv-trans">' + esc(d.text) + "</p>" : "") +
          '<p class="sv-src">' + (d.link ? '<a href="' + d.link + '">' + esc(d.ref) + "</a>" : esc(d.ref)) + "</p></div>";
      }).catch(function () {
        return '<div class="sv-slide"><p class="sv-kicker">' + esc(t(slide.label)) + '</p><p class="sv-text">' + esc(t(navigator.onLine === false ? "common.offline" : "common.error")) + "</p></div>";
      });
    }
    var head = '<div class="sv-slide' + (slide.lesson ? " sv-lesson" : "") + '"' + (slide.q ? ' data-play="' + slide.q[0] + ":" + slide.q[1] + '"' : "") + ">" +
      (slide.lesson ? '<p class="sv-kicker">' + icon("sparkle") + "<span>" + esc(t("stories.lesson")) + "</span></p>" : "") +
      '<p class="sv-text">' + esc(L(slide.t)) + "</p>";
    if (!slide.q) return Promise.resolve(head + (slide.src ? '<p class="sv-src">' + esc(slide.src) + "</p>" : "") + "</div>");
    var s = slide.q[0], a = slide.q[1], b = slide.q[2] || slide.q[1];
    var meta = SS.SURAHS[s - 1];
    var ref = (ar ? "القرآن " : "Qur'an ") + s + ":" + a + (b > a ? "–" + b : "") + " · " + (ar ? meta.ar : meta.en);
    return SS.api.surahText(s).then(function (d) {
      var arabic = [], tr = [];
      for (var n = a; n <= b; n++) {
        var x = d.arabic[n - 1], y = d.translation[n - 1];
        if (x) arabic.push(n === 1 && s !== 1 && SS.ui.stripBasmala ? SS.ui.stripBasmala(x.text) : x.text);
        if (y) tr.push(y.text);
      }
      return head + '<blockquote class="sv-quran"><p class="sv-arabic" lang="ar" dir="rtl">' + esc(arabic.join(" ۝ ")) + "</p>" +
        (ar && SS.translation().lang === "ar" ? "" : '<p class="sv-trans"' + SS.ui.trAttrs() + ">" + esc(tr.join(" ")) + "</p>") +
        '<p class="sv-src"><a href="#/surah/' + s + "/" + a + '">' + esc(ref) + "</a></p></blockquote></div>";
    }).catch(function () {
      return head + '<p class="sv-src"><a href="#/surah/' + s + "/" + a + '">' + esc(ref) + "</a> · " + esc(t("stories.quranOffline")) + "</p></div>";
    });
  }

  function next() { if (idx < cur.slides.length - 1) show(idx + 1); else close(); }
  function prev() { if (idx > 0) show(idx - 1); }

  function share() {
    var stage = $("sv-stage");
    var arEl = stage.querySelector(".sv-arabic"), tr = stage.querySelector(".sv-trans"), txt = stage.querySelector(".sv-text"), src = stage.querySelector(".sv-src");
    if (!SS.share) return;
    SS.share.open({
      arabic: arEl ? arEl.textContent : "",
      text: tr ? tr.textContent : txt ? txt.textContent : "",
      ref: (src ? src.textContent + " · " : "") + "SalaamStreet Stories",
    });
  }

  function wire() {
    var v = $("story-viewer");
    if (!v) return;
    $("sv-close").onclick = function () { close(); };
    $("sv-next").onclick = next;
    $("sv-prev").onclick = prev;
    $("sv-share").onclick = share;
    $("sv-listen").onclick = function () {
      var p = (this.getAttribute("data-play") || "").split(":").map(Number);
      if (p[0] && SS.audio) SS.audio.start(p[0], p[1], SS.SURAHS[p[0] - 1], false, { single: true });
    };
    // Tap the left/right side of the slide (mirrored in right-to-left languages).
    $("sv-stage").addEventListener("click", function (e) {
      if (e.target.closest("a, button")) return;
      var r = this.getBoundingClientRect(), x = (e.clientX - r.left) / r.width;
      if (document.documentElement.dir === "rtl") x = 1 - x;
      if (x < 0.3) prev(); else next();
    });
    // Swipe.
    var sx = null, sy = null;
    v.addEventListener("pointerdown", function (e) { sx = e.clientX; sy = e.clientY; });
    v.addEventListener("pointerup", function (e) {
      if (sx === null) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      sx = null;
      if (Math.abs(dy) > 90 && dy > 0 && Math.abs(dx) < 60) { close(); return; }
      if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
      var forward = document.documentElement.dir === "rtl" ? dx > 0 : dx < 0;
      if (forward) next(); else prev();
    });
    document.addEventListener("keydown", function (e) {
      if (!viewerOpen) return;
      var rtl = document.documentElement.dir === "rtl";
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === (rtl ? "ArrowLeft" : "ArrowRight")) { e.preventDefault(); next(); }
      else if (e.key === (rtl ? "ArrowRight" : "ArrowLeft")) { e.preventDefault(); prev(); }
      else if (e.key === "Tab") {
        // Keep keyboard focus inside the viewer.
        var items = v.querySelectorAll("button:not([disabled]):not([hidden]), a[href]");
        var first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    // Leaving the Stories page (e.g. a link inside a slide) closes the viewer.
    window.addEventListener("hashchange", function () {
      if (viewerOpen && !/^#\/stories\//.test(location.hash)) close(true);
    });
  }

  SS.storiesUI = { open: open, close: close, isOpen: function () { return viewerOpen; } };
  SS.views = SS.views || {};
  SS.views.stories = storiesInit;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
  else wire();
})();
