/* SalaamStreet — views.js (classic script)
   One controller per view. Each has init(params) called by the router. */
(function () {
  "use strict";
  window.SS = window.SS || {};
  var $ = function (id) { return document.getElementById(id); };
  var esc, t;

  /* ═══════════ HOME ═══════════ */
  var homeTimer = null;

  function parseTime(hhmm) {
    var p = String(hhmm).slice(0, 5).split(":");
    var d = new Date();
    d.setHours(+p[0] || 0, +p[1] || 0, 0, 0);
    return d;
  }
  function nextPrayerKey(timings) {
    var now = new Date();
    for (var i = 0; i < SS.PRAYERS.length; i++) {
      var p = SS.PRAYERS[i];
      if (p.key !== "Sunrise" && parseTime(timings[p.key]) > now) return p.key;
    }
    return null;
  }

  /** Describe where the times come from, so it's never a mystery. */
  function locNote(loc) {
    if (loc.isFallback) return t("loc.fallbackNote");
    if (loc.approx) return t("loc.approx");
    return "";
  }

  function homeInit() {
    $("loc-banner").hidden = !!SS.geo.stored();
    $("loc-banner-btn").onclick = homeAskLocation;
    $("np-loc").onclick = homeAskLocation;

    // First visit: ask once, politely, before showing possibly-wrong times.
    if (!SS.geo.stored() && !SS.geo.session() && !SS.store.get("onboarded")) {
      SS.store.set("onboarded", true);
      SS.geo.request().then(function (loc) {
        if (!loc) SS.toast(t("loc.denied"));
        homeRefresh();
      });
    }
    homeRefresh();
    homeLoadAyah();
    homeWidgets();
  }

  function homeAskLocation() {
    SS.geo.request().then(function (loc) {
      $("loc-banner").hidden = !!SS.geo.stored();
      if (loc) homeRefresh(); else SS.toast(t("loc.denied"));
    });
  }

  function homeRefresh() {
    SS.geo.resolve().then(function (loc) {
      $("np-loc").textContent = "📍 " + (loc.label || loc.lat + ", " + loc.lng);
      $("np-locnote").textContent = locNote(loc);
      $("loc-banner").hidden = !!SS.geo.stored() || !!SS.geo.session();
      homeLoadTimes(loc);
    });
  }

  function homeLoadTimes(loc) {
    var s = SS.store.settings();
    SS.api.prayerTimes({ lat: loc.lat, lng: loc.lng, method: s.method, school: s.school })
      .then(function (r) {
        var nk = nextPrayerKey(r.timings);
        $("np-hijri").textContent = r.hijri.day + " " + (SS.i18n.isAr() ? r.hijri.month.ar : r.hijri.month.en) + " " + r.hijri.year + " AH";
        var html = "";
        for (var i = 0; i < SS.PRAYERS.length; i++) {
          var p = SS.PRAYERS[i];
          var cls = p.key === nk ? "next" : (parseTime(r.timings[p.key]) < new Date() ? "past" : "");
          html += '<div class="slot ' + cls + '"><span>' + esc(t("prayer." + p.key)) + "</span><b>" +
            esc(SS.formatTime(r.timings[p.key])) + "</b></div>";
        }
        $("np-strip").innerHTML = html;

        if (nk) {
          $("np-name").textContent = t("prayer." + nk);
          homeCountdown(parseTime(r.timings[nk]), loc);
        } else {
          // After Isha: count down to tomorrow's Fajr.
          var tomorrow = new Date(Date.now() + 86400000);
          SS.api.prayerTimes({ lat: loc.lat, lng: loc.lng, method: s.method, school: s.school, date: tomorrow })
            .then(function (r2) {
              $("np-name").textContent = t("prayer.Fajr") + " (" + t("dash.tomorrow") + ")";
              var p2 = String(r2.timings.Fajr).slice(0, 5).split(":");
              var target = new Date(tomorrow);
              target.setHours(+p2[0] || 0, +p2[1] || 0, 0, 0);
              homeCountdown(target, loc);
            })
            .catch(function () {
              $("np-name").textContent = t("prayer.Fajr");
              $("np-countdown").textContent = "—";
            });
        }
      })
      .catch(function () {
        $("np-name").textContent = t("common.error");
        $("np-countdown").textContent = "—";
        $("np-strip").innerHTML = "";
      });
  }

  function homeCountdown(target, loc) {
    clearInterval(homeTimer);
    var tick = function () {
      var ms = target - Date.now();
      if (ms <= 0) { homeLoadTimes(loc); return; }
      var h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60;
      $("np-countdown").textContent =
        ("0" + h).slice(-2) + ":" + ("0" + m).slice(-2) + ":" + ("0" + sec).slice(-2);
    };
    tick();
    homeTimer = setInterval(tick, 1000);
  }

  function homeLoadAyah() {
    var today = new Date();
    var seed = today.getFullYear() * 1000 + (today.getMonth() + 1) * 50 + today.getDate();
    var g = (seed * 48271) % SS.TOTAL_AYAHS + 1;
    SS.api.ayah(g).then(function (a) {
      $("da-ref").textContent = a.surah.englishName + " " + a.surah.number + ":" + a.numberInSurah;
      $("da-body").innerHTML =
        '<p class="arabic" lang="ar">' + esc(a.arabic) + "</p>" +
        '<p class="translation mt-1">' + esc(a.translation) + "</p>";
    }).catch(function () {
      $("da-body").innerHTML = '<p class="error-state">' + esc(t("common.error")) + "</p>";
    });
  }

  function homeWidgets() {
    var streak = SS.store.get("dhikr:streak", { current: 0 });
    $("ds-count").textContent = streak.current || 0;
    var last = SS.store.get("quran:lastRead");
    if (last && SS.SURAHS[last.surah - 1]) {
      var s = SS.SURAHS[last.surah - 1];
      $("cr-pos").textContent = (SS.i18n.isAr() ? s.ar : s.en) + " · " + last.surah + ":" + last.ayah;
      $("cr-link").textContent = t("dash.continueReading");
      $("cr-link").setAttribute("href", "#/surah/" + last.surah + "/" + last.ayah);
    }
  }

  /* ═══════════ PRAYER ═══════════ */
  function fillMethodSelect(sel, list, val) {
    var html = "";
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      html += '<option value="' + m.id + '"' + (m.id === val ? " selected" : "") + ">" +
        esc(SS.i18n.isAr() ? m.ar : m.en) + "</option>";
    }
    sel.innerHTML = html;
  }

  function prayerInit() {
    var s = SS.store.settings();
    fillMethodSelect($("pt-method"), SS.CALC_METHODS, s.method);
    fillMethodSelect($("pt-school"), SS.ASR_METHODS, s.school);
    $("pt-method").onchange = function () { SS.store.saveSettings({ method: +this.value }); prayerLoadDaily(); prayerMaybeMonthly(); };
    $("pt-school").onchange = function () { SS.store.saveSettings({ school: +this.value }); prayerLoadDaily(); prayerMaybeMonthly(); };
    $("pt-loc-chip").onclick = function () {
      SS.geo.request().then(function (loc) {
        if (!loc) SS.toast(t("loc.denied"));
        prayerLoadDaily(); prayerMaybeMonthly();
      });
    };
    $("pt-tab-daily").onclick = function () { prayerTab(true); };
    $("pt-tab-monthly").onclick = function () { prayerTab(false); };
    prayerTab(true);
  }

  function prayerTab(daily) {
    $("pt-daily").hidden = !daily;
    $("pt-monthly").hidden = daily;
    $("pt-tab-daily").className = daily ? "btn btn-sm" : "btn btn-sm btn-ghost";
    $("pt-tab-monthly").className = daily ? "btn btn-sm btn-ghost" : "btn btn-sm";
    $("pt-tab-daily").setAttribute("aria-selected", String(daily));
    $("pt-tab-monthly").setAttribute("aria-selected", String(!daily));
    if (daily) prayerLoadDaily(); else prayerLoadMonthly();
  }
  function prayerMaybeMonthly() { if (!$("pt-monthly").hidden) prayerLoadMonthly(); }

  function prayerLoadDaily() {
    var s = SS.store.settings();
    SS.geo.resolve().then(function (loc) {
      $("pt-loc-chip").textContent = "📍 " + (loc.label || loc.lat + ", " + loc.lng);
      var note = locNote(loc);
      $("pt-locnote").textContent = note;
      $("pt-locnote").hidden = !note;
      prayerLoadDailyAt(loc, s);
    });
  }

  function prayerLoadDailyAt(loc, s) {
    SS.api.prayerTimes({ lat: loc.lat, lng: loc.lng, method: s.method, school: s.school })
      .then(function (r) {
        $("pt-hijri").textContent = r.hijri.day + " " + (SS.i18n.isAr() ? r.hijri.month.ar : r.hijri.month.en) + " " + r.hijri.year + " AH";
        $("pt-cache-note").hidden = !r.stale;
        var nk = nextPrayerKey(r.timings);
        var html = "";
        for (var i = 0; i < SS.PRAYERS.length; i++) {
          var p = SS.PRAYERS[i];
          html += '<div class="time-row' + (p.key === nk ? " next" : "") + '">' +
            '<span class="name">' + esc(t("prayer." + p.key)) +
            '<span class="ar" lang="ar">' + esc(p.ar) + "</span>" +
            (p.key === nk ? ' <span class="badge">' + esc(t("prayer.next")) + "</span>" : "") +
            '</span><span class="t">' + esc(SS.formatTime(r.timings[p.key])) + "</span></div>";
        }
        $("pt-list").innerHTML = html;
      })
      .catch(function () {
        $("pt-list").innerHTML = '<div class="error-state"><p>' + esc(t("common.error")) + "</p>" +
          '<button class="btn btn-outline btn-sm mt-1" id="pt-retry" type="button">' + esc(t("common.retry")) + "</button></div>";
        var b = $("pt-retry"); if (b) b.onclick = prayerLoadDaily;
      });
  }

  function prayerLoadMonthly() {
    var s = SS.store.settings();
    var now = new Date();
    var table = $("pt-month-table");
    table.innerHTML = '<tr><td class="muted">' + esc(t("common.loading")) + "</td></tr>";
    SS.geo.resolve().then(function (loc) { prayerLoadMonthlyAt(loc, s, now, table); });
  }

  function prayerLoadMonthlyAt(loc, s, now, table) {
    SS.api.monthlyTimes({ lat: loc.lat, lng: loc.lng, method: s.method, school: s.school, year: now.getFullYear(), month: now.getMonth() + 1 })
      .then(function (r) {
        var html = "<tr><th>#</th>";
        for (var i = 0; i < SS.PRAYERS.length; i++) html += "<th>" + esc(t("prayer." + SS.PRAYERS[i].key)) + "</th>";
        html += "</tr>";
        for (var d = 0; d < r.days.length; d++) {
          var day = r.days[d];
          var num = +day.date.gregorian.day;
          html += '<tr class="' + (num === now.getDate() ? "today" : "") + '"><td>' + num + "</td>";
          for (var j = 0; j < SS.PRAYERS.length; j++) {
            html += "<td>" + esc(SS.formatTime(day.timings[SS.PRAYERS[j].key])) + "</td>";
          }
          html += "</tr>";
        }
        table.innerHTML = html;
      })
      .catch(function () {
        table.innerHTML = '<tr><td class="error-state">' + esc(t("common.error")) + "</td></tr>";
      });
  }

  /* ═══════════ QIBLA ═══════════ */
  var qbBearing = 0, qbHasCompass = false, qbListening = false;

  function qbRender(heading) {
    var rot = qbBearing - heading;
    $("qb-needle").style.transform = "rotate(" + rot + "deg)";
    var diff = ((rot % 360) + 360) % 360;
    var aligned = qbHasCompass && (diff < 5 || diff > 355);
    $("qibla-card").classList.toggle("aligned", aligned);
    $("qb-aligned").hidden = !aligned;
  }
  function qbOnOrientation(e) {
    var heading = null;
    if (typeof e.webkitCompassHeading === "number") heading = e.webkitCompassHeading;
    else if (e.absolute && typeof e.alpha === "number") heading = 360 - e.alpha;
    if (heading === null) return;
    qbHasCompass = true;
    $("qb-hint").textContent = t("qibla.calibrate");
    qbRender(heading);
  }
  function qbEnable() {
    var DOE = window.DeviceOrientationEvent;
    function listen() {
      if (!qbListening) {
        window.addEventListener("deviceorientationabsolute", qbOnOrientation, true);
        window.addEventListener("deviceorientation", qbOnOrientation, true);
        qbListening = true;
      }
      $("qb-enable").hidden = true;
      setTimeout(function () { if (!qbHasCompass) $("qb-hint").textContent = t("qibla.noCompass"); }, 2500);
    }
    if (DOE && typeof DOE.requestPermission === "function") {
      DOE.requestPermission().then(function (res) {
        if (res === "granted") listen();
        else $("qb-hint").textContent = t("qibla.noCompass");
      }).catch(function () { $("qb-hint").textContent = t("qibla.noCompass"); });
    } else { listen(); }
  }

  function qiblaInit() {
    $("qb-loc-chip").onclick = function () {
      SS.geo.request().then(function (l) { if (!l) SS.toast(t("loc.denied")); qiblaInit(); });
    };
    SS.geo.resolve().then(function (loc) {
      $("qb-loc-chip").textContent = "📍 " + (loc.label || loc.lat + ", " + loc.lng);
      qbBearing = SS.qiblaBearing(loc.lat, loc.lng);
      $("qb-deg").textContent = qbBearing.toFixed(1);
      qbRender(0);
      $("qb-enable").onclick = qbEnable;
      var DOE = window.DeviceOrientationEvent;
      if (DOE && typeof DOE.requestPermission === "function") $("qb-enable").hidden = false;
      else qbEnable();
      if (loc.isFallback) $("qb-hint").textContent = t("dash.setLocation");
      else if (loc.approx) $("qb-hint").textContent = t("loc.approx");
    });
  }

  /* ═══════════ QURAN INDEX ═══════════ */
  function quranCard(s) {
    var type = t(s.type === "meccan" ? "quran.meccan" : "quran.medinan");
    return '<a class="surah-card" href="#/surah/' + s.n + '">' +
      '<span class="surah-num" aria-hidden="true"><span>' + s.n + "</span></span>" +
      '<span class="names"><span class="en">' + esc(SS.i18n.isAr() ? s.ar : s.en) + "</span>" +
      '<span class="meta">' + esc(SS.i18n.isAr() ? s.en : s.meaning) + " · " + s.ayahs + " " +
      esc(t("quran.verses")) + " · " + esc(type) + "</span></span>" +
      '<span class="arname" lang="ar" aria-hidden="true">' + esc(s.ar) + "</span></a>";
  }

  function quranRender(filter) {
    var q = (filter || "").trim().toLowerCase();
    var list = SS.SURAHS;
    if (q) {
      list = [];
      for (var i = 0; i < SS.SURAHS.length; i++) {
        var s = SS.SURAHS[i];
        if (s.en.toLowerCase().indexOf(q) !== -1 || s.meaning.toLowerCase().indexOf(q) !== -1 ||
            s.ar.indexOf(filter.trim()) !== -1 || String(s.n) === q) list.push(s);
      }
    }
    var html = "";
    for (var j = 0; j < list.length; j++) html += quranCard(list[j]);
    $("qi-grid").innerHTML = html || '<p class="empty-state">—</p>';
  }

  function quranInit() {
    $("qi-search").oninput = function () { quranRender(this.value); };
    quranRender($("qi-search").value);
    var last = SS.store.get("quran:lastRead");
    if (last && SS.SURAHS[last.surah - 1]) {
      var s = SS.SURAHS[last.surah - 1];
      $("qi-resume").hidden = false;
      $("qi-resume-pos").textContent = (SS.i18n.isAr() ? s.ar : s.en) + " · " + last.surah + ":" + last.ayah;
      $("qi-resume-link").setAttribute("href", "#/surah/" + last.surah + "/" + last.ayah);
    }
  }

  /* ═══════════ SURAH READER ═══════════ */
  var srN = 1, srSurah = null;

  function srBookmarks() { return SS.store.get("quran:bookmarks", {}); }

  function srAyahCard(i, arText, trText, tlText) {
    var n = i + 1;
    var marked = !!srBookmarks()[srN + ":" + n];
    var showTr = $("sr-tr").checked, showTl = $("sr-tl").checked;
    return '<article class="card ayah-card" id="ayah-' + n + '" data-n="' + n + '">' +
      '<p class="arabic" lang="ar">' + esc(arText) + ' <span style="color:var(--primary-strong)">﴿' + n + "﴾</span></p>" +
      '<p class="transliteration" data-tl' + (showTl ? "" : " hidden") + ">" + esc(tlText) + "</p>" +
      '<p class="translation" data-tr' + (showTr ? "" : " hidden") + ">" + esc(trText) + "</p>" +
      '<div class="ayah-tools"><span class="ayah-ref">' + srN + ":" + n + '</span><span class="spacer"></span>' +
      '<button class="icon-btn" data-play="' + n + '" type="button" aria-label="' + esc(t("common.play")) + " " + srN + ":" + n + '">▶</button>' +
      '<button class="icon-btn' + (marked ? " fav-on" : "") + '" data-bm="' + n + '" type="button" aria-pressed="' + marked + '" aria-label="' + esc(t("quran.bookmark")) + '">' + (marked ? "★" : "☆") + "</button></div></article>";
  }

  function surahInit(params) {
    srN = Math.min(114, Math.max(1, parseInt(params[0], 10) || 1));
    srSurah = SS.SURAHS[srN - 1];
    var jumpAyah = parseInt(params[1], 10) || 0;
    var s = SS.store.settings();

    $("sr-title").textContent = SS.i18n.isAr() ? srSurah.ar : srSurah.en;
    $("sr-meta").textContent = srSurah.meaning + " · " + srSurah.ayahs + " " + t("quran.verses") + " · " +
      t(srSurah.type === "meccan" ? "quran.meccan" : "quran.medinan");
    document.title = srSurah.en + " — SalaamStreet";
    $("sr-bismillah").hidden = srN === 1 || srN === 9;

    fillMethodSelectReciters($("sr-reciter"), s.reciter);
    $("sr-reciter").onchange = function () { SS.store.saveSettings({ reciter: this.value }); };

    $("sr-prev").style.visibility = srN > 1 ? "visible" : "hidden";
    $("sr-next").style.visibility = srN < 114 ? "visible" : "hidden";
    $("sr-prev").setAttribute("href", "#/surah/" + (srN - 1));
    $("sr-next").setAttribute("href", "#/surah/" + (srN + 1));

    $("sr-tr").onchange = function () {
      var els = document.querySelectorAll("[data-tr]");
      for (var i = 0; i < els.length; i++) els[i].hidden = !this.checked;
    };
    $("sr-tl").checked = !!s.showTransliteration;
    $("sr-tl").onchange = function () {
      SS.store.saveSettings({ showTransliteration: this.checked });
      var els = document.querySelectorAll("[data-tl]");
      for (var i = 0; i < els.length; i++) els[i].hidden = !this.checked;
    };

    $("sr-list").innerHTML =
      '<div class="skeleton" style="min-block-size:110px"></div>' +
      '<div class="skeleton" style="min-block-size:110px"></div>' +
      '<div class="skeleton" style="min-block-size:110px"></div>';

    SS.api.surahText(srN).then(function (r) {
      var html = "";
      for (var i = 0; i < r.arabic.length; i++) {
        html += srAyahCard(i, r.arabic[i].text, r.translation[i].text, r.transliteration[i].text);
      }
      $("sr-list").innerHTML = html;
      srWireList();
      srObserveLastRead();
      if (jumpAyah) {
        var el = $("ayah-" + jumpAyah);
        if (el) el.scrollIntoView({ block: "center" });
      }
    }).catch(function () {
      $("sr-list").innerHTML = '<div class="error-state"><p>' + esc(t("common.error")) + "</p>" +
        '<button class="btn btn-outline btn-sm mt-1" id="sr-retry" type="button">' + esc(t("common.retry")) + "</button></div>";
      var b = $("sr-retry"); if (b) b.onclick = function () { surahInit([String(srN), String(jumpAyah)]); };
    });

    $("sr-play").onclick = function () { SS.audio.start(srN, 1, srSurah); };
  }

  function fillMethodSelectReciters(sel, val) {
    var html = "";
    for (var i = 0; i < SS.RECITERS.length; i++) {
      var r = SS.RECITERS[i];
      html += '<option value="' + r.id + '"' + (r.id === val ? " selected" : "") + ">" +
        esc(SS.i18n.isAr() ? r.ar : r.en) + "</option>";
    }
    sel.innerHTML = html;
  }

  function srWireList() {
    $("sr-list").onclick = function (e) {
      var bm = e.target.closest("[data-bm]");
      if (bm) {
        var n = +bm.getAttribute("data-bm");
        var key = srN + ":" + n;
        var b = srBookmarks();
        if (b[key]) delete b[key]; else b[key] = { at: Date.now() };
        SS.store.set("quran:bookmarks", b);
        var on = !!b[key];
        bm.classList.toggle("fav-on", on);
        bm.textContent = on ? "★" : "☆";
        bm.setAttribute("aria-pressed", String(on));
        SS.toast(on ? t("quran.bookmarked") : t("quran.bookmark"));
        return;
      }
      var pl = e.target.closest("[data-play]");
      if (pl) SS.audio.start(srN, +pl.getAttribute("data-play"), srSurah);
    };
  }

  function srObserveLastRead() {
    if (typeof IntersectionObserver === "undefined") return;
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          SS.store.set("quran:lastRead", { surah: srN, ayah: +entries[i].target.getAttribute("data-n") });
        }
      }
    }, { rootMargin: "-40% 0px -55% 0px" });
    var cards = document.querySelectorAll(".ayah-card");
    for (var j = 0; j < cards.length; j++) io.observe(cards[j]);
  }

  /* ═══════════ DUAS ═══════════ */
  function duFavs() { return SS.store.get("duas:favorites", {}); }

  function duasInit(params) {
    if (params && params[0]) duRenderCategory(decodeURIComponent(params[0]));
    else duRenderHome();
    $("du-back").onclick = function () { location.hash = "#/duas"; };
  }

  function duRenderHome() {
    $("du-detail").hidden = true;
    $("du-cats").hidden = false;
    var ar = SS.i18n.isAr();
    var cats = [{ id: "favs", icon: "⭐", en: t("duas.favorites"), ar: t("duas.favorites"), count: Object.keys(duFavs()).length }];
    for (var i = 0; i < SS.DUA_CATEGORIES.length; i++) {
      var c = SS.DUA_CATEGORIES[i];
      var count = 0;
      for (var j = 0; j < SS.DUAS.length; j++) if (SS.DUAS[j].category === c.id) count++;
      cats.push({ id: c.id, icon: c.icon, en: c.en, ar: c.ar, count: count });
    }
    var html = "";
    for (var k = 0; k < cats.length; k++) {
      var cc = cats[k];
      html += '<a class="dua-cat" href="#/duas/' + encodeURIComponent(cc.id) + '">' +
        '<span class="ic" aria-hidden="true">' + cc.icon + "</span><span>" + esc(ar ? cc.ar : cc.en) +
        '</span><span class="tiny">' + cc.count + "</span></a>";
    }
    $("du-cats").innerHTML = html;
  }

  function duCard(d) {
    var fav = !!duFavs()[d.id];
    return '<article class="card dua-card"><div class="row-between"><h3>' + esc(d.titleEn) + "</h3>" +
      '<button class="icon-btn' + (fav ? " fav-on" : "") + '" data-fav="' + esc(d.id) + '" type="button" aria-pressed="' + fav + '" aria-label="' + esc(t("duas.favorites")) + '">' + (fav ? "★" : "☆") + "</button></div>" +
      '<p class="arabic-dua" lang="ar">' + esc(d.arabic) + "</p>" +
      '<p class="transliteration">' + esc(d.transliteration) + "</p>" +
      '<p class="translation">' + esc(d.translationEn) + "</p>" +
      '<p class="mt-1"><span class="badge badge-src">' + esc(t("duas.source")) + ": " + esc(d.source) + "</span></p></article>";
  }

  function duRenderCategory(catId) {
    var list = [], title = "";
    if (catId === "favs") {
      var f = duFavs();
      for (var i = 0; i < SS.DUAS.length; i++) if (f[SS.DUAS[i].id]) list.push(SS.DUAS[i]);
      title = t("duas.favorites");
    } else {
      var cat = null;
      for (var c = 0; c < SS.DUA_CATEGORIES.length; c++) if (SS.DUA_CATEGORIES[c].id === catId) cat = SS.DUA_CATEGORIES[c];
      if (!cat) return duRenderHome();
      for (var j = 0; j < SS.DUAS.length; j++) if (SS.DUAS[j].category === catId) list.push(SS.DUAS[j]);
      title = SS.i18n.isAr() ? cat.ar : cat.en;
    }
    $("du-cats").hidden = true;
    $("du-detail").hidden = false;
    $("du-cat-title").textContent = title;
    var html = "";
    for (var k = 0; k < list.length; k++) html += duCard(list[k]);
    $("du-list").innerHTML = html || '<p class="empty-state">' + esc(t("duas.empty")) + "</p>";
    $("du-list").onclick = function (e) {
      var btn = e.target.closest("[data-fav]");
      if (!btn) return;
      var f = duFavs();
      var id = btn.getAttribute("data-fav");
      if (f[id]) delete f[id]; else f[id] = true;
      SS.store.set("duas:favorites", f);
      var on = !!f[id];
      btn.classList.toggle("fav-on", on);
      btn.textContent = on ? "★" : "☆";
      btn.setAttribute("aria-pressed", String(on));
    };
  }

  /* ═══════════ DHIKR ═══════════ */
  var CIRC = 553;
  var dkPreset = null, dkCount = 0;

  function dkToday() { return new Date().toISOString().slice(0, 10); }
  function dkKey() { return "dhikr:day:" + dkToday(); }
  function dkLoad() { var d = SS.store.get(dkKey(), {}); dkCount = d[dkPreset.id] || 0; }
  function dkSave() { var d = SS.store.get(dkKey(), {}); d[dkPreset.id] = dkCount; SS.store.set(dkKey(), d); }

  function dkStreakBump() {
    var s = SS.store.get("dhikr:streak", { current: 0, longest: 0, lastDate: null });
    var today = dkToday();
    if (s.lastDate === today) return;
    var yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    s.current = s.lastDate === yest ? s.current + 1 : 1;
    s.longest = Math.max(s.longest, s.current);
    s.lastDate = today;
    SS.store.set("dhikr:streak", s);
  }
  function dkRenderStreak() {
    var s = SS.store.get("dhikr:streak", { current: 0, longest: 0 });
    $("dk-streak-cur").textContent = s.current || 0;
    $("dk-streak-max").textContent = s.longest || 0;
  }
  function dkRenderPresets() {
    var html = "";
    for (var i = 0; i < SS.DHIKR_PRESETS.length; i++) {
      var p = SS.DHIKR_PRESETS[i];
      html += '<button class="chip' + (p.id === dkPreset.id ? " active" : "") + '" role="radio" aria-checked="' +
        (p.id === dkPreset.id) + '" data-preset="' + esc(p.id) + '" type="button">' +
        esc(SS.i18n.isAr() ? p.ar : p.en) + " · " + p.target + "</button>";
    }
    $("dk-presets").innerHTML = html;
  }
  function dkRenderCounter() {
    $("dk-text").textContent = dkPreset.ar;
    $("dk-source").textContent = dkPreset.source;
    $("dk-target").textContent = dkPreset.target;
    $("dk-count").textContent = dkCount;
    var prog = Math.min(dkCount / dkPreset.target, 1);
    $("dk-prog").style.strokeDashoffset = String(CIRC * (1 - prog));
  }

  function dhikrInit() {
    if (!dkPreset) dkPreset = SS.DHIKR_PRESETS[0];
    dkLoad();
    dkRenderPresets();
    dkRenderCounter();
    dkRenderStreak();

    $("dk-presets").onclick = function (e) {
      var btn = e.target.closest("[data-preset]");
      if (!btn) return;
      for (var i = 0; i < SS.DHIKR_PRESETS.length; i++) {
        if (SS.DHIKR_PRESETS[i].id === btn.getAttribute("data-preset")) dkPreset = SS.DHIKR_PRESETS[i];
      }
      dkLoad(); dkRenderPresets(); dkRenderCounter();
    };
    $("dk-tap").onclick = function () {
      dkCount++;
      dkSave(); dkRenderCounter();
      if (navigator.vibrate) navigator.vibrate(10);
      if (dkCount === dkPreset.target) {
        dkStreakBump(); dkRenderStreak();
        $("dk-ring").classList.add("completed-pulse");
        setTimeout(function () { $("dk-ring").classList.remove("completed-pulse"); }, 1600);
        SS.toast(t("dhikr.completed"));
        if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
      }
    };
    $("dk-reset").onclick = function () { dkCount = 0; dkSave(); dkRenderCounter(); };
  }

  /* ═══════════ SETTINGS ═══════════ */
  function settingsInit() {
    var s = SS.store.settings();
    $("st-locale").value = SS.i18n.getLocale();
    $("st-theme").value = s.theme;
    $("st-translit").checked = !!s.showTransliteration;
    fillMethodSelect($("st-method"), SS.CALC_METHODS, s.method);
    fillMethodSelect($("st-school"), SS.ASR_METHODS, s.school);
    fillMethodSelectReciters($("st-reciter"), s.reciter);

    var loc = SS.geo.stored();
    $("st-loc-status").textContent = loc
      ? t("settings.locationSet") + ": " + (loc.label || loc.lat + ", " + loc.lng)
      : t("settings.locationNone");

    $("st-locale").onchange = function () {
      SS.store.saveSettings({ locale: this.value });
      SS.i18n.setLocale(this.value);
      SS.applyThemeLabel && SS.applyThemeLabel();
      settingsInit();
    };
    $("st-theme").onchange = function () { SS.store.saveSettings({ theme: this.value }); SS.applyTheme(); };
    $("st-translit").onchange = function () { SS.store.saveSettings({ showTransliteration: this.checked }); };
    $("st-method").onchange = function () { SS.store.saveSettings({ method: +this.value }); };
    $("st-school").onchange = function () { SS.store.saveSettings({ school: +this.value }); };
    $("st-reciter").onchange = function () { SS.store.saveSettings({ reciter: this.value }); };
    $("st-loc-set").onclick = function () { SS.geo.request().then(settingsInit); };
    $("st-loc-clear").onclick = function () { SS.geo.clear(); settingsInit(); SS.toast(t("settings.locationClear")); };

    $("st-export").onclick = function () {
      var blob = new Blob([JSON.stringify(SS.store.exportAll(), null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "salaamstreet-data-" + dkToday() + ".json";
      a.click();
      URL.revokeObjectURL(a.href);
    };
    $("st-delete").onclick = function () {
      if (confirm(t("settings.deleteConfirm"))) {
        SS.store.clearAll();
        SS.geo.clear();
        location.reload();
      }
    };
  }

  /* ═══════════ APPS ═══════════ */
  function appsInit() { /* static content; nothing dynamic needed yet */ }

  /* ═══════════ Export view registry ═══════════ */
  SS.views = {
    home: homeInit,
    prayer: prayerInit,
    qibla: qiblaInit,
    quran: quranInit,
    surah: surahInit,
    duas: duasInit,
    dhikr: dhikrInit,
    apps: appsInit,
    settings: settingsInit,
  };
  SS.viewsReady = function () { esc = SS.esc; t = SS.i18n.t; };
})();
