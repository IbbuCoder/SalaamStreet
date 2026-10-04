/* SalaamStreet — views.js (classic script)
   One controller per view. Each init(params) is called by the router;
   optional SS.leave[view]() runs when navigating away. */
(function () {
  "use strict";
  window.SS = window.SS || {};
  var $ = function (id) { return document.getElementById(id); };
  var esc, t;
  var DAY = 86400000;

  /* ═══════════ Shared helpers ═══════════ */
  function f(key, vars) {
    var s = t(key);
    for (var k in vars) s = s.split("{" + k + "}").join(vars[k]);
    return s;
  }
  function icon(name, cls) {
    return '<svg class="ic' + (cls ? " " + cls : "") + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  }
  /** Loading / empty / error block. `retry` wires a "Try again" button. */
  function renderState(el, o) {
    var kind = o.kind || "empty";
    var offline = kind === "error" && navigator.onLine === false;
    var msg = o.text || (offline ? t("common.offline") : t("common.error"));
    el.innerHTML = '<div class="state ' + kind + (o.inline ? " state-inline" : "") + '">' +
      '<span class="s-ic">' + icon(o.icon || (kind === "error" ? (offline ? "wifi-off" : "x") : "search")) + "</span>" +
      "<p>" + esc(msg) + "</p>" +
      (o.retry ? '<button class="btn btn-outline btn-sm" type="button" data-retry>' + icon("refresh") + "<span>" + esc(t("common.retry")) + "</span></button>" : "") +
      "</div>";
    el.removeAttribute("aria-busy");
    if (o.retry) el.querySelector("[data-retry]").onclick = o.retry;
  }
  function skeletons(n, h) {
    var s = "";
    for (var i = 0; i < n; i++) s += '<div class="skeleton" style="block-size:' + h + 'px"></div>';
    return s;
  }
  function locLabel(loc) { return loc.label || loc.lat + ", " + loc.lng; }
  /** Describe where the times come from, so it's never a mystery. */
  function locNote(loc) {
    if (loc.isFallback) return t("loc.fallbackNote");
    if (loc.approx) return t("loc.approx");
    return "";
  }
  function arDigits(n) {
    return String(n).replace(/\d/g, function (d) { return "٠١٢٣٤٥٦٧٨٩".charAt(+d); });
  }
  function surahName(s) { return SS.i18n.isAr() ? s.ar : s.en; }
  function copyText(text) {
    function ok() { SS.toast(t("common.copied")); }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(ok, function () { legacyCopy(text) && ok(); });
    } else if (legacyCopy(text)) ok();
  }
  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    var done = false;
    try { done = document.execCommand("copy"); } catch (e) { /* noop */ }
    document.body.removeChild(ta);
    return done;
  }
  function vibrate(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* noop */ } }

  function parseTime(hhmm, base) {
    var p = String(hhmm).slice(0, 5).split(":");
    var d = base ? new Date(base) : new Date();
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

  var leave = {};
  SS.leave = leave;
  SS.hooks = SS.hooks || {};
  function hook(name) {
    var fn = SS.hooks[name];
    if (!fn) return;
    try { fn.apply(null, Array.prototype.slice.call(arguments, 1)); } catch (e) { if (window.console) console.error(e); }
  }
  /** lang/dir attributes for translation text in the chosen language. */
  function trAttrs() {
    var tr = SS.translation();
    return ' lang="' + tr.lang + '" dir="' + tr.dir + '"';
  }

  /* ═══════════ HOME ═══════════ */
  var homeTimer = null, homeGen = 0;

  function homeInit() {
    $("loc-banner-btn").onclick = homeAskLocation;
    $("np-loc").onclick = homeAskLocation;

    // First visit: ask once, politely, before showing possibly-wrong times.
    if (!SS.geo.stored() && !SS.geo.session() && !SS.store.get("onboarded")) {
      SS.store.set("onboarded", true);
      SS.geo.request().then(function (loc) {
        if (!loc) SS.toast(t("loc.denied"));
        if (SS.currentView() === "home") homeRefresh();
      });
    }
    homeRefresh();
    homeLoadAyah();
    homeWidgets();
    hook("homeInit");
  }
  leave.home = function () { clearInterval(homeTimer); homeGen++; };

  function homeAskLocation() {
    SS.geo.request().then(function (loc) {
      if (loc) homeRefresh(); else SS.toast(t("loc.denied"));
    });
  }

  function homeRefresh() {
    var gen = ++homeGen;
    SS.geo.resolve().then(function (loc) {
      if (gen !== homeGen) return;
      $("np-loc-label").textContent = locLabel(loc);
      $("np-locnote").textContent = locNote(loc);
      $("loc-banner").hidden = !!SS.geo.stored() || !!SS.geo.session();
      homeLoadTimes(loc, gen);
    });
  }

  function homeLoadTimes(loc, gen) {
    var s = SS.store.settings();
    $("np-strip").setAttribute("aria-busy", "true");
    SS.api.prayerTimes({ lat: loc.lat, lng: loc.lng, method: s.method, school: s.school })
      .then(function (r) {
        if (gen !== homeGen) return;
        var nk = nextPrayerKey(r.timings);
        $("np-hijri").textContent = SS.hijriLabel(r.hijri);
        var html = "", now = new Date();
        for (var i = 0; i < SS.PRAYERS.length; i++) {
          var p = SS.PRAYERS[i];
          var cls = p.key === nk ? "next" : (parseTime(r.timings[p.key]) < now ? "past" : "");
          html += '<div class="slot ' + cls + '" data-key="' + p.key + '"><span>' + esc(t("prayer." + p.key)) + "</span><b>" +
            esc(SS.formatTime(r.timings[p.key])) + "</b></div>";
        }
        $("np-strip").innerHTML = html;
        $("np-strip").removeAttribute("aria-busy");
        hook("homeTimes", r, loc);

        if (nk) {
          $("np-name").textContent = t("prayer." + nk);
          $("np-at").textContent = f("dash.at", { time: SS.formatTime(r.timings[nk]) });
          homeCountdown(parseTime(r.timings[nk]), loc, gen);
        } else {
          // After Isha: count down to tomorrow's Fajr.
          var tomorrow = new Date(Date.now() + DAY);
          SS.api.prayerTimes({ lat: loc.lat, lng: loc.lng, method: s.method, school: s.school, date: tomorrow })
            .then(function (r2) {
              if (gen !== homeGen) return;
              $("np-name").textContent = t("prayer.Fajr");
              $("np-at").textContent = f("dash.atTomorrow", { time: SS.formatTime(r2.timings.Fajr) });
              homeCountdown(parseTime(r2.timings.Fajr, tomorrow), loc, gen);
            })
            .catch(function () {
              $("np-name").textContent = t("prayer.Fajr");
              $("np-at").textContent = "";
              $("np-countdown").textContent = "—";
            });
        }
      })
      .catch(function () {
        if (gen !== homeGen) return;
        clearInterval(homeTimer);
        $("np-name").textContent = "—";
        $("np-at").textContent = "";
        $("np-countdown").textContent = "--:--:--";
        renderState($("np-strip"), { kind: "error", inline: true, retry: homeRefresh });
      });
  }

  function homeCountdown(target, loc, gen) {
    clearInterval(homeTimer);
    var el = $("np-countdown");
    var tick = function () {
      if (gen !== homeGen) { clearInterval(homeTimer); return; }
      var ms = target - Date.now();
      if (ms <= 0) { clearInterval(homeTimer); homeLoadTimes(loc, gen); return; }
      var h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60;
      el.textContent = ("0" + h).slice(-2) + ":" + ("0" + m).slice(-2) + ":" + ("0" + sec).slice(-2);
      if (sec === 0 || !el.getAttribute("aria-label")) el.setAttribute("aria-label", f("dash.countdownLabel", { h: h, m: m }));
    };
    tick();
    homeTimer = setInterval(tick, 1000);
  }

  function homeLoadAyah() {
    var body = $("da-body");
    var today = new Date();
    var seed = today.getFullYear() * 1000 + (today.getMonth() + 1) * 50 + today.getDate();
    var g = (seed * 48271) % SS.TOTAL_AYAHS + 1;
    SS.api.ayah(g).then(function (a) {
      var ref = a.surah.englishName + " " + a.surah.number + ":" + a.numberInSurah;
      $("da-ref").textContent = ref;
      $("da-ref").setAttribute("href", "#/surah/" + a.surah.number + "/" + a.numberInSurah);
      body.className = "daily-ayah";
      body.innerHTML =
        '<p class="arabic" lang="ar">' + esc(a.arabic) + "</p>" +
        '<p class="translation mt-1"' + trAttrs() + ">" + esc(a.translation) + "</p>" +
        '<div class="card-foot"><span class="spacer"></span><button class="btn btn-ghost btn-sm" type="button" id="da-share">' + icon("share") + "<span>" + esc(t("common.share")) + "</span></button></div>";
      body.removeAttribute("aria-busy");
      $("da-share").onclick = function () {
        if (SS.share) SS.share.open({ arabic: a.arabic, text: a.translation, ref: "Qur'an " + a.surah.number + ":" + a.numberInSurah + " · " + a.surah.englishName, dir: SS.translation().dir });
      };
    }).catch(function () {
      renderState(body, { kind: "error", inline: true, retry: homeLoadAyah });
    });
  }

  /** Streak only counts if it was kept up today or yesterday. */
  function liveStreak() {
    var s = SS.store.get("dhikr:streak", { current: 0, longest: 0, lastDate: null });
    var today = SS.localDate(), yest = SS.localDate(new Date(Date.now() - DAY));
    return { current: (s.lastDate === today || s.lastDate === yest) ? (s.current || 0) : 0, longest: s.longest || 0 };
  }

  function homeWidgets() {
    var cur = liveStreak().current;
    $("ds-count").textContent = cur;
    $("ds-days").textContent = cur === 1 ? t("dash.day") : t("dash.days");
    var last = SS.store.get("quran:lastRead");
    if (last && SS.SURAHS[last.surah - 1]) {
      var s = SS.SURAHS[last.surah - 1];
      $("cr-title").textContent = t("dash.continueReading");
      $("cr-pos").textContent = surahName(s) + " · " + last.surah + ":" + last.ayah;
      $("cr-link").setAttribute("href", "#/surah/" + last.surah + "/" + last.ayah);
    } else {
      $("cr-title").textContent = t("dash.startReading");
      $("cr-pos").textContent = t("dash.startReadingSub");
      $("cr-link").setAttribute("href", "#/quran");
    }
  }

  /* ═══════════ PRAYER ═══════════ */
  function fillSelect(sel, list, val) {
    var html = "";
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      html += '<option value="' + esc(m.id) + '"' + (m.id === val ? " selected" : "") + ">" +
        esc(SS.i18n.isAr() ? m.ar : m.en) + "</option>";
    }
    sel.innerHTML = html;
  }
  var ptDaily = true, ptGen = 0;

  function prayerInit() {
    var s = SS.store.settings();
    fillSelect($("pt-method"), SS.CALC_METHODS, s.method);
    fillSelect($("pt-school"), SS.ASR_METHODS, s.school);
    $("pt-method").onchange = function () { SS.store.saveSettings({ method: +this.value }); prayerReload(); };
    $("pt-school").onchange = function () { SS.store.saveSettings({ school: +this.value }); prayerReload(); };
    $("pt-loc-chip").onclick = function () {
      SS.geo.request().then(function (loc) {
        if (!loc) SS.toast(t("loc.denied"));
        prayerReload();
      });
    };
    $("pt-extra").checked = !!s.extraTimes;
    $("pt-extra").onchange = function () { SS.store.saveSettings({ extraTimes: this.checked }); prayerReload(); };
    $("pt-tab-daily").onclick = function () { prayerTab(true); };
    $("pt-tab-monthly").onclick = function () { prayerTab(false); };
    $("pt-tab-daily").onkeydown = $("pt-tab-monthly").onkeydown = function (e) {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        var other = this.id === "pt-tab-daily" ? $("pt-tab-monthly") : $("pt-tab-daily");
        other.focus(); other.click();
      }
    };
    prayerTab(ptDaily);
  }

  function prayerTab(daily) {
    ptDaily = daily;
    $("pt-daily").hidden = !daily;
    $("pt-monthly").hidden = daily;
    $("pt-tab-daily").setAttribute("aria-selected", String(daily));
    $("pt-tab-monthly").setAttribute("aria-selected", String(!daily));
    $("pt-tab-daily").tabIndex = daily ? 0 : -1;
    $("pt-tab-monthly").tabIndex = daily ? -1 : 0;
    prayerReload();
  }

  function prayerReload() {
    var gen = ++ptGen;
    var s = SS.store.settings();
    SS.geo.resolve().then(function (loc) {
      if (gen !== ptGen) return;
      $("pt-loc-label").textContent = locLabel(loc);
      var note = locNote(loc);
      $("pt-locnote").textContent = note;
      $("pt-locnote").hidden = !note;
      if (ptDaily) prayerLoadDaily(loc, s, gen); else prayerLoadMonthly(loc, s, gen);
    });
  }

  function prayerLoadDaily(loc, s, gen) {
    var list = $("pt-list");
    SS.api.prayerTimes({ lat: loc.lat, lng: loc.lng, method: s.method, school: s.school })
      .then(function (r) {
        if (gen !== ptGen) return;
        $("pt-hijri").textContent = SS.hijriLabel(r.hijri);
        $("pt-cache-note").hidden = !r.stale;
        var nk = nextPrayerKey(r.timings), now = new Date();
        var html = "";
        for (var i = 0; i < SS.PRAYERS.length; i++) {
          var p = SS.PRAYERS[i];
          var past = p.key !== nk && parseTime(r.timings[p.key]) < now;
          var due = parseTime(r.timings[p.key]) <= now;
          var done = SS.tracker && SS.tracker.isDone(SS.localDate(), p.key);
          var check = p.key === "Sunrise" || !SS.tracker ? '<span class="pray-check-spacer" aria-hidden="true"></span>' :
            '<button class="pray-check' + (done ? " on" : "") + '" type="button" data-pray="' + p.key + '" aria-pressed="' + !!done + '"' +
            (due || done ? "" : " disabled") + ' aria-label="' + esc(f("track.markPrayed", { p: t("prayer." + p.key) })) + '">' + icon("check") + "</button>";
          html += '<div class="time-row' + (p.key === nk ? " next" : past ? " past" : "") + (done ? " prayed" : "") + '">' + check +
            '<span class="name">' + esc(t("prayer." + p.key)) +
            (SS.i18n.isAr() ? "" : '<span class="ar" lang="ar">' + esc(p.ar) + "</span>") +
            (p.key === nk ? ' <span class="badge">' + esc(t("prayer.next")) + "</span>" : "") +
            '</span><span class="t">' + esc(SS.formatTime(r.timings[p.key])) + "</span></div>";
        }
        if (s.extraTimes) {
          var extra = function (key) {
            return r.timings[key] ? '<div class="time-row extra"><span class="pray-check-spacer" aria-hidden="true"></span><span class="name">' + esc(t("prayer." + key)) +
              '</span><span class="t">' + esc(SS.formatTime(r.timings[key])) + "</span></div>" : "";
          };
          html = extra("Imsak") + html + extra("Midnight") + extra("Lastthird");
        }
        list.innerHTML = html;
        list.removeAttribute("aria-busy");
        list.onclick = function (e) {
          var b = e.target.closest("[data-pray]");
          if (!b || b.disabled || !SS.tracker) return;
          var on = SS.tracker.toggle(SS.localDate(), b.getAttribute("data-pray"));
          b.classList.toggle("on", on);
          b.setAttribute("aria-pressed", String(on));
          b.closest(".time-row").classList.toggle("prayed", on);
          if (on) vibrate(15);
          hook("trackerChanged");
        };
        hook("prayerTimes", r);
      })
      .catch(function () {
        if (gen !== ptGen) return;
        renderState(list, { kind: "error", retry: prayerReload });
      });
  }

  function prayerLoadMonthly(loc, s, gen) {
    var now = new Date();
    var table = $("pt-month-table");
    try {
      $("pt-month-title").textContent = now.toLocaleDateString(SS.i18n.dateLocale(), { month: "long", year: "numeric" });
    } catch (e) { $("pt-month-title").textContent = ""; }
    table.innerHTML = '<tbody><tr><td colspan="7" style="padding:20px">' + skeletons(6, 22) + "</td></tr></tbody>";
    SS.api.monthlyTimes({ lat: loc.lat, lng: loc.lng, method: s.method, school: s.school, year: now.getFullYear(), month: now.getMonth() + 1 })
      .then(function (r) {
        if (gen !== ptGen) return;
        var ar = SS.i18n.isAr();
        var html = "<thead><tr><th scope=\"col\">" + esc(t("prayer.day")) + "</th>";
        for (var i = 0; i < SS.PRAYERS.length; i++) html += '<th scope="col">' + esc(t("prayer." + SS.PRAYERS[i].key)) + "</th>";
        html += "</tr></thead><tbody>";
        var todayRow = 0;
        for (var d = 0; d < r.days.length; d++) {
          var day = r.days[d];
          var num = +day.date.gregorian.day;
          var isToday = num === now.getDate();
          if (isToday) todayRow = d;
          var wd = day.date.gregorian.weekday ? day.date.gregorian.weekday.en.slice(0, 3) : "";
          if (ar && day.date.hijri && day.date.hijri.weekday) wd = day.date.hijri.weekday.ar;
          html += '<tr class="' + (isToday ? "today" : "") + '"' + (isToday ? ' aria-current="date"' : "") + '><td>' + num + "<small>" + esc(wd) + "</small></td>";
          for (var j = 0; j < SS.PRAYERS.length; j++) {
            html += "<td>" + esc(SS.formatTime(day.timings[SS.PRAYERS[j].key])) + "</td>";
          }
          html += "</tr>";
        }
        table.innerHTML = html + "</tbody>";
        void todayRow;
      })
      .catch(function () {
        if (gen !== ptGen) return;
        table.innerHTML = '<tbody><tr><td colspan="7" id="pt-month-err"></td></tr></tbody>';
        renderState($("pt-month-err"), { kind: "error", retry: prayerReload });
      });
  }

  /* ═══════════ QIBLA ═══════════ — see js/qibla.js */

  /* ═══════════ QURAN INDEX ═══════════ */
  var qiTab = "all";

  function quranCard(s) {
    var type = t(s.type === "meccan" ? "quran.meccan" : "quran.medinan");
    return '<a class="surah-card" href="#/surah/' + s.n + '">' +
      '<span class="surah-num" aria-hidden="true"><span>' + s.n + "</span></span>" +
      '<span class="names"><span class="en">' + (SS.i18n.isAr() ? "" : '<span class="visually-hidden">' + s.n + ". </span>") + esc(surahName(s)) + "</span>" +
      '<span class="meta"><bdi>' + esc(SS.i18n.isAr() ? s.en : s.meaning) + "</bdi> · <bdi>" + s.ayahs + " " +
      esc(t("quran.verses")) + "</bdi> · <bdi>" + esc(type) + "</bdi></span></span>" +
      '<span class="arname" lang="ar" aria-hidden="true">' + esc(s.ar) + "</span></a>";
  }

  function normalize(s) {
    return String(s).toLowerCase().replace(/[ً-ْٰ']/g, "").replace(/[-‘’`]/g, " ").replace(/\s+/g, " ").trim();
  }

  function quranRender(filter) {
    var q = normalize(filter || "");
    var list = SS.SURAHS;
    if (q) {
      list = [];
      var qNoAl = q.replace(/^(al|an|ar|as|at|ad|az|ash|adh) ?/, "");
      for (var i = 0; i < SS.SURAHS.length; i++) {
        var s = SS.SURAHS[i];
        var en = normalize(s.en), en2 = en.replace(/^(al|an|ar|as|at|ad|az|ash|adh) /, "");
        if (en.indexOf(q) !== -1 || en2.indexOf(qNoAl) === 0 || normalize(s.meaning).indexOf(q) !== -1 ||
            normalize(s.ar).indexOf(q) !== -1 || String(s.n) === q) list.push(s);
      }
    }
    var html = "";
    for (var j = 0; j < list.length; j++) html += quranCard(list[j]);
    var grid = $("qi-grid");
    if (html) grid.innerHTML = html;
    else renderState(grid, { kind: "empty", icon: "search", text: f("quran.noResults", { q: filter.trim() }) });
    $("qi-count").textContent = q ? f("quran.count", { n: list.length }) : "";
  }

  var QI_TABS = { all: "qi-tab-all", juz: "qi-tab-juz", bm: "qi-tab-bm" };
  function quranTab(tab) {
    qiTab = tab;
    var all = tab === "all";
    for (var k in QI_TABS) {
      $(QI_TABS[k]).setAttribute("aria-selected", String(k === tab));
      $(QI_TABS[k]).tabIndex = k === tab ? 0 : -1;
    }
    $("qi-grid").hidden = !all;
    $("qi-search-wrap").hidden = !all;
    $("qi-count").hidden = !all;
    $("qi-search-tr").hidden = !all || $("qi-search").value.trim().length < 3;
    if (!all) $("qi-results").hidden = true;
    $("qi-bms").hidden = tab !== "bm";
    $("qi-juz").hidden = tab !== "juz";
    if (tab === "bm") quranBookmarks();
    if (tab === "juz") quranJuz();
  }

  function quranJuz() {
    var html = "";
    for (var i = 0; i < SS.JUZ.length; i++) {
      var j = SS.JUZ[i], s = SS.SURAHS[j[0] - 1];
      html += '<a class="surah-card" href="#/surah/' + j[0] + "/" + j[1] + '">' +
        '<span class="surah-num" aria-hidden="true"><span>' + (i + 1) + "</span></span>" +
        '<span class="names"><span class="en">' + esc(f("quran.juzN", { n: i + 1 })) + "</span>" +
        '<span class="meta">' + esc(f("quran.startsAt", { s: surahName(s), ref: j[0] + ":" + j[1] })) + "</span></span>" +
        '<span class="arname" lang="ar" aria-hidden="true">' + arDigits(i + 1) + "</span></a>";
    }
    $("qi-juz").innerHTML = html;
  }

  function quranBookmarks() {
    var b = SS.store.get("quran:bookmarks", {});
    var keys = Object.keys(b).sort(function (x, y) {
      var a = x.split(":"), c = y.split(":");
      return (+a[0] - +c[0]) || (+a[1] - +c[1]);
    });
    var el = $("qi-bms");
    if (!keys.length) {
      renderState(el, { kind: "empty", icon: "bookmark", text: t("quran.noBookmarks") });
      return;
    }
    var html = "";
    for (var i = 0; i < keys.length; i++) {
      var p = keys[i].split(":"), s = SS.SURAHS[+p[0] - 1];
      if (!s) continue;
      html += '<div class="card widget bm-card">' +
        '<span class="w-ic gold">' + icon("bookmark") + "</span>" +
        '<a class="w-body" href="#/surah/' + p[0] + "/" + p[1] + '" style="color:inherit">' +
        '<span class="w-title">' + esc(surahName(s)) + " · " + p[0] + ":" + p[1] + "</span>" +
        '<span class="w-sub">' + esc(SS.i18n.isAr() ? s.en : s.meaning) + "</span></a>" +
        '<button class="icon-btn" type="button" data-unbm="' + esc(keys[i]) + '" aria-label="' + esc(t("quran.removeBookmark") + " " + keys[i]) + '">' + icon("trash") + "</button></div>";
    }
    el.innerHTML = html;
    el.onclick = function (e) {
      var btn = e.target.closest("[data-unbm]");
      if (!btn) return;
      var bm = SS.store.get("quran:bookmarks", {});
      delete bm[btn.getAttribute("data-unbm")];
      SS.store.set("quran:bookmarks", bm);
      quranBookmarks();
      SS.toast(t("quran.bookmarkRemoved"));
    };
  }

  function quranInit() {
    $("qi-search").oninput = function () {
      quranRender(this.value);
      $("qi-search-tr").hidden = this.value.trim().length < 3;
      $("qi-search-tr-label").textContent = f("quran.searchTranslation", { q: this.value.trim() });
      $("qi-results").hidden = true;
    };
    $("qi-search").onkeydown = function (e) {
      if (e.key === "Enter") {
        var first = $("qi-grid").querySelector("a.surah-card");
        if (first) location.hash = first.getAttribute("href");
      }
    };
    var order = ["all", "juz", "bm"];
    order.forEach(function (k) {
      var b = $(QI_TABS[k]);
      b.onclick = function () { quranTab(k); };
      b.onkeydown = function (e) {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        var d = (e.key === "ArrowRight") !== (document.dir === "rtl") ? 1 : -1;
        var next = $(QI_TABS[order[(order.indexOf(k) + d + order.length) % order.length]]);
        next.focus(); next.click();
      };
    });
    $("qi-search-tr").onclick = function () { if (SS.quranSearch) SS.quranSearch($("qi-search").value.trim()); };
    quranRender($("qi-search").value);
    quranTab(qiTab);
    hook("quranInit");
    var last = SS.store.get("quran:lastRead");
    if (last && SS.SURAHS[last.surah - 1]) {
      var s = SS.SURAHS[last.surah - 1];
      $("qi-resume").hidden = false;
      $("qi-resume-pos").textContent = surahName(s) + " · " + last.surah + ":" + last.ayah;
      $("qi-resume").setAttribute("href", "#/surah/" + last.surah + "/" + last.ayah);
    } else {
      $("qi-resume").hidden = true;
    }
  }

  /* ═══════════ SURAH READER ═══════════ */
  var srN = 1, srSurah = null, srIO = null, srGen = 0, srData = null;
  var FONT_MIN = 0.8, FONT_MAX = 1.8;

  function srBookmarks() { return SS.store.get("quran:bookmarks", {}); }

  SS.applyQuranScale = function () {
    var sc = +SS.store.settings().quranScale || 1;
    document.documentElement.style.setProperty("--quran-scale", String(sc));
    if ($("sr-font-down")) {
      $("sr-font-down").disabled = sc <= FONT_MIN + 0.001;
      $("sr-font-up").disabled = sc >= FONT_MAX - 0.001;
    }
  };

  function srAyahCard(i, arText, trText, tlText) {
    var n = i + 1;
    var marked = !!srBookmarks()[srN + ":" + n];
    var s = SS.store.settings();
    var ref = srN + ":" + n;
    return '<article class="card ayah-card" id="ayah-' + n + '" data-n="' + n + '" aria-label="' + esc(t("quran.ayah")) + " " + ref + '">' +
      '<p class="arabic" lang="ar">' + esc(arText) + ' <span class="ayah-end" aria-hidden="true">﴿' + arDigits(n) + "﴾</span></p>" +
      '<p class="transliteration" data-tl' + (s.showTransliteration ? "" : " hidden") + ">" + esc(tlText) + "</p>" +
      '<p class="translation" data-tr' + trAttrs() + (s.showTranslation ? "" : " hidden") + ">" + esc(trText) + "</p>" +
      '<div class="ayah-tools"><span class="ayah-ref">' + ref + '</span><span class="spacer"></span>' +
      '<button class="tafsir-btn" data-tafsir="' + n + '" type="button" aria-label="' + esc(t("tafsir.title") + " " + ref) + '">' + icon("open-book") + "<span>" + esc(t("tafsir.button")) + "</span></button>" +
      '<button class="icon-btn" data-play="' + n + '" type="button" aria-label="' + esc(t("common.play") + " " + ref) + '">' + icon("play") + "</button>" +
      '<button class="icon-btn" data-copy="' + n + '" type="button" aria-label="' + esc(t("common.copy") + " " + ref) + '">' + icon("copy") + "</button>" +
      '<button class="icon-btn" data-share="' + n + '" type="button" aria-label="' + esc(t("common.share") + " " + ref) + '">' + icon("share") + "</button>" +
      '<button class="icon-btn' + (marked ? " fav-on" : "") + '" data-bm="' + n + '" type="button" aria-pressed="' + marked + '" aria-label="' + esc(t("quran.bookmark") + " " + ref) + '">' + icon("bookmark") + "</button></div></article>";
  }

  function fillReciters(sel, val) {
    var html = "";
    for (var i = 0; i < SS.RECITERS.length; i++) {
      var r = SS.RECITERS[i];
      html += '<option value="' + r.id + '"' + (r.id === val ? " selected" : "") + ">" +
        esc(SS.i18n.isAr() ? r.ar : r.en) + "</option>";
    }
    sel.innerHTML = html;
  }

  function srToggle(btn, key, selector) {
    var on = !!SS.store.settings()[key];
    btn.setAttribute("aria-pressed", String(on));
    btn.onclick = function () {
      var next = btn.getAttribute("aria-pressed") !== "true";
      var patch = {}; patch[key] = next;
      SS.store.saveSettings(patch);
      btn.setAttribute("aria-pressed", String(next));
      var els = document.querySelectorAll(selector);
      for (var i = 0; i < els.length; i++) els[i].hidden = !next;
    };
  }

  function surahInit(params) {
    var n = Math.min(114, Math.max(1, parseInt(params[0], 10) || 1));
    var jumpAyah = parseInt(params[1], 10) || 0;
    var sameSurah = n === srN && srData && $("sr-list").children.length && !$("sr-list").hasAttribute("aria-busy");
    srN = n;
    SS.readerSurah = srN;
    srSurah = SS.SURAHS[srN - 1];
    var s = SS.store.settings();

    $("sr-ar").textContent = srSurah.ar;
    $("sr-title").textContent = SS.i18n.isAr() ? srSurah.ar : srSurah.en;
    $("sr-ar").hidden = SS.i18n.isAr();
    $("sr-meta").textContent = (SS.i18n.isAr() ? srSurah.en : srSurah.meaning) + " · " + srSurah.ayahs + " " + t("quran.verses") + " · " +
      t(srSurah.type === "meccan" ? "quran.meccan" : "quran.medinan");
    document.title = srSurah.en + " — SalaamStreet";
    $("tb-title").textContent = srSurah.n + ". " + surahName(srSurah);
    $("sr-bismillah").hidden = srN === 1 || srN === 9;

    fillReciters($("sr-reciter"), s.reciter);
    $("sr-reciter").onchange = function () { SS.store.saveSettings({ reciter: this.value }); };

    var prev = SS.SURAHS[srN - 2], next = SS.SURAHS[srN];
    $("sr-prev").hidden = !prev;
    $("sr-next").hidden = !next;
    if (prev) { $("sr-prev").setAttribute("href", "#/surah/" + prev.n); $("sr-prev-name").textContent = prev.n + ". " + surahName(prev); }
    if (next) { $("sr-next").setAttribute("href", "#/surah/" + next.n); $("sr-next-name").textContent = next.n + ". " + surahName(next); }

    srToggle($("sr-tr"), "showTranslation", "[data-tr]");
    srToggle($("sr-tl"), "showTransliteration", "[data-tl]");
    SS.applyQuranScale();
    $("sr-font-down").onclick = function () { srScale(-0.1); };
    $("sr-font-up").onclick = function () { srScale(0.1); };
    $("sr-play").onclick = function () { SS.audio.start(srN, 1, srSurah); };
    var hz = !!s.hifz;
    $("sr-hifz").setAttribute("aria-pressed", String(hz));
    $("sr-list").classList.toggle("hifz", hz);
    $("sr-hifz-note").hidden = !hz;
    $("sr-hifz").onclick = function () {
      var on = this.getAttribute("aria-pressed") !== "true";
      SS.store.saveSettings({ hifz: on });
      this.setAttribute("aria-pressed", String(on));
      $("sr-list").classList.toggle("hifz", on);
      $("sr-hifz-note").hidden = !on;
      var rev = document.querySelectorAll("#sr-list .reveal");
      for (var i = 0; i < rev.length; i++) rev[i].classList.remove("reveal");
    };
    $("sr-source").textContent = f("quran.sourceDyn", { tr: SS.translation().label });

    if (sameSurah) { // e.g. "#/surah/2" → "#/surah/2/255": just scroll
      srRender(srData, jumpAyah);
      return;
    }
    var gen = ++srGen;
    var list = $("sr-list");
    list.setAttribute("aria-busy", "true");
    list.innerHTML = skeletons(4, 150);

    SS.api.surahText(srN).then(function (r) {
      if (gen !== srGen) return;
      srData = r;
      srRender(r, jumpAyah);
    }).catch(function () {
      if (gen !== srGen) return;
      srData = null;
      renderState(list, { kind: "error", retry: function () { surahInit([String(srN), String(jumpAyah)]); } });
    });
  }

  function srRender(r, jumpAyah) {
    var list = $("sr-list");
    var html = "";
    for (var i = 0; i < r.arabic.length; i++) {
      var ar = r.arabic[i].text;
      // AlQuran Cloud prefixes ayah 1 with the basmala (except Al-Fatihah); it's shown separately.
      if (i === 0 && srN !== 1 && srN !== 9) ar = stripBasmala(ar);
      html += srAyahCard(i, ar, r.translation[i].text, r.transliteration[i].text);
    }
    list.innerHTML = html;
    list.removeAttribute("aria-busy");
    srWireList();
    srObserveLastRead();
    SS.audio.sync();
    hook("surahRendered", srN);
    if (jumpAyah) {
      var go = function () {
        var el = $("ayah-" + jumpAyah);
        if (el) el.scrollIntoView({ block: "start" });
      };
      go();
      // content-visibility estimates heights; correct once real sizes are known.
      setTimeout(go, 120);
      setTimeout(go, 450);
    }
  }

  /** Remove a leading basmala, comparing letters only (diacritics vary by edition). */
  function stripBasmala(text) {
    var words = String(text).replace(/^\uFEFF/, "").split(/\s+/);
    var bare = words.slice(0, 4).join(" ").replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "").replace(/\u0671/g, "\u0627");
    return bare === "بسم الله الرحمن الرحيم" ? words.slice(4).join(" ") : text;
  }

  function srScale(d) {
    var sc = +SS.store.settings().quranScale || 1;
    sc = Math.round(Math.min(FONT_MAX, Math.max(FONT_MIN, sc + d)) * 10) / 10;
    SS.store.saveSettings({ quranScale: sc });
    SS.applyQuranScale();
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
        bm.setAttribute("aria-pressed", String(on));
        SS.toast(on ? t("quran.bookmarked") : t("quran.bookmarkRemoved"));
        return;
      }
      var tf = e.target.closest("[data-tafsir]");
      if (tf) { showTafsir(srN, +tf.getAttribute("data-tafsir")); return; }
      var cp = e.target.closest("[data-copy]");
      if (cp && srData) {
        var i = +cp.getAttribute("data-copy") - 1;
        copyText(srData.arabic[i].text + "\n\n" + srData.translation[i].text + "\n— Qur'an " + srN + ":" + (i + 1) + " (" + srSurah.en + ")");
        return;
      }
      var sh = e.target.closest("[data-share]");
      if (sh && srData && SS.share) {
        var k = +sh.getAttribute("data-share") - 1;
        var arT = srData.arabic[k].text;
        if (k === 0 && srN !== 1 && srN !== 9) arT = stripBasmala(arT);
        SS.share.open({ arabic: arT, text: srData.translation[k].text, ref: "Qur'an " + srN + ":" + (k + 1) + " · " + srSurah.en, dir: SS.translation().dir });
        return;
      }
      var hz = e.target.closest(".hifz .arabic");
      if (hz) { hz.closest(".ayah-card").classList.toggle("reveal"); return; }
      var pl = e.target.closest("[data-play]");
      if (pl) SS.audio.start(srN, +pl.getAttribute("data-play"), srSurah);
    };
  }

  /* Tafsir sheet. Every request gets a generation number; a response is only
     rendered if it is still for the ayah on screen, so tapping quickly between
     ayahs (or a slow network) can never show the commentary of another verse. */
  var tfGen = 0, tfSurah = 0, tfAyah = 0;
  function showTafsir(surah, ayah) {
    var dlg = $("tafsir-dialog");
    if (!dlg || typeof dlg.showModal !== "function") return;
    var meta = SS.SURAHS[surah - 1];
    if (!meta) return;
    ayah = Math.min(meta.ayahs, Math.max(1, ayah));
    var gen = ++tfGen;
    tfSurah = surah; tfAyah = ayah;
    var body = $("tafsir-body");
    $("tafsir-ref").textContent = surah + ":" + ayah;
    $("tafsir-surah").textContent = surahName(meta) + " · " + f("tafsir.ayahN", { n: ayah });
    $("tafsir-prev").disabled = ayah <= 1;
    $("tafsir-next").disabled = ayah >= meta.ayahs;
    $("tafsir-prev").onclick = function () { showTafsir(tfSurah, tfAyah - 1); };
    $("tafsir-next").onclick = function () { showTafsir(tfSurah, tfAyah + 1); };
    body.setAttribute("aria-busy", "true");
    body.innerHTML = '<p class="visually-hidden">' + esc(t("common.loading")) + "</p>" + skeletons(1, 18) + '<div class="mt-1">' + skeletons(1, 18) + '</div><div class="mt-1">' + skeletons(1, 80) + "</div>";
    if (!dlg.open) {
      SS.openDialog(dlg);
      if (!dlg._tfWired) {
        dlg._tfWired = true;
        // Closing invalidates any in-flight request and clears old text.
        dlg.addEventListener("close", function () { tfGen++; $("tafsir-body").innerHTML = ""; });
      }
    }
    dlg.querySelector(".modal-scroll").scrollTop = 0;
    SS.api.tafsir(surah, ayah).then(function (r) {
      if (gen !== tfGen || r.surah !== tfSurah || r.ayah !== tfAyah) return; // superseded
      var text = (r.text || "").trim();
      if (!text) { renderState(body, { kind: "empty", icon: "open-book", text: t("tafsir.none") }); return; }
      var paras = text.split(/\n\s*\n|\n/);
      var html = "";
      for (var i = 0; i < paras.length; i++) if (paras[i].trim()) html += "<p>" + esc(paras[i].trim()) + "</p>";
      if (r.stale) html = '<p class="note">' + esc(t("common.offline")) + "</p>" + html;
      body.innerHTML = html;
      body.removeAttribute("aria-busy");
    }).catch(function () {
      if (gen !== tfGen) return;
      renderState(body, { kind: "error", text: navigator.onLine === false ? t("common.offline") : t("tafsir.error"), retry: function () { showTafsir(surah, ayah); } });
    });
  }
  SS.showTafsir = showTafsir;

  /** Remember where the reader is: continue-reading position (with time, so
      the most recent device wins when synced), recently read surahs, and the
      furthest ayah reached in each surah (reading progress). */
  function srSaveProgress(surah, ayah) {
    var now = Date.now();
    SS.store.set("quran:lastRead", { surah: surah, ayah: ayah, at: now });
    var recent = SS.store.get("quran:recent", []);
    recent = (Array.isArray(recent) ? recent : []).filter(function (r) { return r && r.surah !== surah; });
    recent.unshift({ surah: surah, ayah: ayah, at: now });
    SS.store.set("quran:recent", recent.slice(0, 12));
    var prog = SS.store.get("quran:progress", {}) || {};
    if (!(prog[surah] >= ayah)) { prog[surah] = ayah; SS.store.set("quran:progress", prog); }
  }

  function srObserveLastRead() {
    if (srIO) { srIO.disconnect(); srIO = null; }
    if (typeof IntersectionObserver === "undefined") return;
    var pending = null, lastSaved = null;
    srIO = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) pending = +entries[i].target.getAttribute("data-n");
      }
      if (pending && pending !== lastSaved) { lastSaved = pending; srSaveProgress(srN, pending); }
    }, { rootMargin: "-35% 0px -60% 0px" });
    var cards = document.querySelectorAll("#sr-list .ayah-card");
    for (var j = 0; j < cards.length; j++) srIO.observe(cards[j]);
  }
  leave.surah = function () {
    if (srIO) { srIO.disconnect(); srIO = null; }
    var tf = $("tafsir-dialog");
    if (tf && tf.open) tf.close();
  };

  /* ═══════════ DUAS ═══════════ */
  function duFavs() { return SS.store.get("duas:favorites", {}); }

  function duasInit(params) {
    if (params && params[0]) duRenderCategory(decodeURIComponent(params[0]));
    else duRenderHome();
  }

  function duRenderHome() {
    $("du-detail").hidden = true;
    $("du-home").hidden = false;
    var ar = SS.i18n.isAr();
    var favCount = 0, f0 = duFavs();
    for (var x = 0; x < SS.DUAS.length; x++) if (f0[SS.DUAS[x].id]) favCount++;
    var html = '<a class="cat fav" href="#/duas/favs"><span class="c-emoji" aria-hidden="true">⭐</span>' +
      '<span class="c-title">' + esc(t("duas.favorites")) + '</span><span class="c-sub">' + esc(f("duas.count", { n: favCount })) + "</span></a>";
    for (var i = 0; i < SS.DUA_CATEGORIES.length; i++) {
      var c = SS.DUA_CATEGORIES[i];
      var count = 0;
      for (var j = 0; j < SS.DUAS.length; j++) if (SS.DUAS[j].category === c.id) count++;
      html += '<a class="cat" href="#/duas/' + encodeURIComponent(c.id) + '">' +
        '<span class="c-emoji" aria-hidden="true">' + c.icon + "</span>" +
        '<span class="c-title">' + esc(ar ? c.ar : c.en) + "</span>" +
        (ar ? "" : '<span class="c-ar" lang="ar">' + esc(c.ar) + "</span>") +
        '<span class="c-sub">' + esc(f("duas.count", { n: count })) + "</span></a>";
    }
    $("du-cats").innerHTML = html;
  }

  function duCard(d) {
    var fav = !!duFavs()[d.id];
    return '<article class="card dua-card"><div class="row-between" style="align-items:flex-start"><h3>' + esc(d.titleEn) + "</h3>" +
      '<div class="card-actions">' +
      '<button class="icon-btn" data-copy="' + esc(d.id) + '" type="button" aria-label="' + esc(t("common.copy")) + '">' + icon("copy") + "</button>" +
      '<button class="icon-btn" data-share="' + esc(d.id) + '" type="button" aria-label="' + esc(t("common.share")) + '">' + icon("share") + "</button>" +
      '<button class="icon-btn' + (fav ? " fav-on" : "") + '" data-fav="' + esc(d.id) + '" type="button" aria-pressed="' + fav + '" aria-label="' + esc(t("duas.addFavorite")) + '">' + icon("star") + "</button>" +
      "</div></div>" +
      '<p class="arabic-dua" lang="ar">' + esc(d.arabic) + "</p>" +
      '<p class="transliteration">' + esc(d.transliteration) + "</p>" +
      '<p class="translation">' + esc(d.translationEn) + "</p>" +
      '<div class="card-foot"><span class="badge badge-src">' + esc(t("duas.source")) + ": " + esc(d.source) + "</span></div></article>";
  }

  function duRenderCategory(catId) {
    var list = [], title = "";
    if (catId === "favs") {
      var fv = duFavs();
      for (var i = 0; i < SS.DUAS.length; i++) if (fv[SS.DUAS[i].id]) list.push(SS.DUAS[i]);
      title = t("duas.favorites");
    } else {
      var cat = null;
      for (var c = 0; c < SS.DUA_CATEGORIES.length; c++) if (SS.DUA_CATEGORIES[c].id === catId) cat = SS.DUA_CATEGORIES[c];
      if (!cat) return duRenderHome();
      for (var j = 0; j < SS.DUAS.length; j++) if (SS.DUAS[j].category === catId) list.push(SS.DUAS[j]);
      title = SS.i18n.isAr() ? cat.ar : cat.en;
    }
    $("du-home").hidden = true;
    $("du-detail").hidden = false;
    $("du-cat-title").textContent = title;
    $("tb-title").textContent = title;
    var html = "";
    for (var k = 0; k < list.length; k++) html += duCard(list[k]);
    var el = $("du-list");
    if (html) el.innerHTML = html;
    else renderState(el, { kind: "empty", icon: "star", text: t("duas.empty") });
    el.onclick = function (e) {
      var sh = e.target.closest("[data-share]");
      if (sh && SS.share) {
        for (var q2 = 0; q2 < SS.DUAS.length; q2++) {
          var dd = SS.DUAS[q2];
          if (dd.id === sh.getAttribute("data-share")) SS.share.open({ arabic: dd.arabic, text: dd.translationEn, ref: dd.source });
        }
        return;
      }
      var cp = e.target.closest("[data-copy]");
      if (cp) {
        var d = null;
        for (var q = 0; q < SS.DUAS.length; q++) if (SS.DUAS[q].id === cp.getAttribute("data-copy")) d = SS.DUAS[q];
        if (d) copyText(d.arabic + "\n\n" + d.transliteration + "\n\n" + d.translationEn + "\n— " + d.source);
        return;
      }
      var btn = e.target.closest("[data-fav]");
      if (!btn) return;
      var favs = duFavs();
      var id = btn.getAttribute("data-fav");
      if (favs[id]) delete favs[id]; else favs[id] = true;
      SS.store.set("duas:favorites", favs);
      var on = !!favs[id];
      btn.classList.toggle("fav-on", on);
      btn.setAttribute("aria-pressed", String(on));
      SS.toast(on ? t("duas.added") : t("duas.removed"));
    };
  }

  /* ═══════════ DHIKR ═══════════ */
  var CIRC = 553;
  var dkPreset = null, dkCount = 0, dkKeyBound = false;

  function dkKey() { return "dhikr:day:" + SS.localDate(); }
  function dkLoad() { var d = SS.store.get(dkKey(), {}); dkCount = d[dkPreset.id] || 0; }
  /** A preset's target — the sourced default, unless the user chose their own. */
  function dkTarget(p) { var c = SS.store.get("dhikr:targets", {})[p.id]; return c > 0 ? c : p.target; }
  function dkSave() { var d = SS.store.get(dkKey(), {}); d[dkPreset.id] = dkCount; SS.store.set(dkKey(), d); }

  function dkStreakBump() {
    var s = SS.store.get("dhikr:streak", { current: 0, longest: 0, lastDate: null });
    var today = SS.localDate();
    if (s.lastDate === today) return;
    var yest = SS.localDate(new Date(Date.now() - DAY));
    s.current = s.lastDate === yest ? (s.current || 0) + 1 : 1;
    s.longest = Math.max(s.longest || 0, s.current);
    s.lastDate = today;
    SS.store.set("dhikr:streak", s);
  }
  function dkRenderStreak() {
    var s = liveStreak();
    $("dk-streak-cur").textContent = s.current;
    $("dk-streak-max").textContent = s.longest;
  }
  function dkRenderPresets() {
    var html = "";
    for (var i = 0; i < SS.DHIKR_PRESETS.length; i++) {
      var p = SS.DHIKR_PRESETS[i];
      var on = p.id === dkPreset.id;
      html += '<button class="chip" role="radio" aria-checked="' + on + '" tabindex="' + (on ? 0 : -1) + '" data-preset="' + esc(p.id) + '" type="button">' +
        "<bdi>" + esc(SS.i18n.isAr() ? p.ar : p.en) + "</bdi> · " + dkTarget(p) + "</button>";
    }
    $("dk-presets").innerHTML = html;
  }
  function dkRenderToday() {
    var d = SS.store.get(dkKey(), {});
    var html = "";
    for (var i = 0; i < SS.DHIKR_PRESETS.length; i++) {
      var p = SS.DHIKR_PRESETS[i], c = d[p.id] || 0;
      html += '<li class="' + (c >= dkTarget(p) ? "done" : "") + '"><bdi>' + esc(SS.i18n.isAr() ? p.ar : p.en) + '</bdi><b dir="ltr">' + c + " / " + dkTarget(p) + "</b></li>";
    }
    $("dk-today").innerHTML = html;
  }
  function dkRenderCounter() {
    $("dk-text").textContent = dkPreset.ar;
    $("dk-meaning").textContent = SS.i18n.isAr() ? "" : dkPreset.en + " — " + dkPreset.meaning;
    $("dk-meaning").hidden = SS.i18n.isAr();
    $("dk-source").textContent = t("duas.source") + ": " + dkPreset.source;
    var tg = dkTarget(dkPreset);
    var opts = [dkPreset.target, 33, 34, 99, 100, 300, 500, 1000].filter(function (v, i, a) { return a.indexOf(v) === i; });
    if (opts.indexOf(tg) === -1) opts.push(tg);
    $("dk-target-sel").innerHTML = opts.map(function (v) {
      return '<option value="' + v + '"' + (v === tg ? " selected" : "") + ">" + v + (v === dkPreset.target ? " · " + esc(t("dhikr.default")) : "") + "</option>";
    }).join("");
    $("dk-of").textContent = "/ " + tg;
    $("dk-count").textContent = dkCount;
    var prog = Math.min(dkCount / tg, 1);
    $("dk-prog").style.strokeDashoffset = String(CIRC * (1 - prog));
    $("dk-undo").disabled = dkCount === 0;
    $("dk-ring").setAttribute("aria-label", f("dhikr.ringLabel", { n: dkCount, target: tg }));
  }
  function dkSelect(id) {
    for (var i = 0; i < SS.DHIKR_PRESETS.length; i++) if (SS.DHIKR_PRESETS[i].id === id) dkPreset = SS.DHIKR_PRESETS[i];
    SS.store.set("dhikr:preset", dkPreset.id);
    dkLoad(); dkRenderPresets(); dkRenderCounter();
  }
  function dkTap() {
    dkCount++;
    dkSave(); dkRenderCounter(); dkRenderToday();
    var num = $("dk-count");
    num.classList.remove("bump"); void num.offsetWidth; num.classList.add("bump");
    vibrate(10);
    if (dkCount === dkTarget(dkPreset)) {
      dkStreakBump(); dkRenderStreak();
      $("dk-ring").classList.add("completed-pulse");
      setTimeout(function () { $("dk-ring").classList.remove("completed-pulse"); }, 1600);
      SS.toast(t("dhikr.completed"));
      vibrate([30, 40, 30]);
    }
  }

  function dhikrInit() {
    if (!dkPreset) {
      var saved = SS.store.get("dhikr:preset");
      dkPreset = SS.DHIKR_PRESETS[0];
      for (var i = 0; i < SS.DHIKR_PRESETS.length; i++) if (SS.DHIKR_PRESETS[i].id === saved) dkPreset = SS.DHIKR_PRESETS[i];
    }
    dkLoad();
    dkRenderPresets();
    dkRenderCounter();
    dkRenderStreak();
    dkRenderToday();

    $("dk-presets").onclick = function (e) {
      var btn = e.target.closest("[data-preset]");
      if (btn) dkSelect(btn.getAttribute("data-preset"));
    };
    $("dk-presets").onkeydown = function (e) {
      var keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      if (!keys[e.key]) return;
      e.preventDefault();
      var dir = keys[e.key] * (document.dir === "rtl" && (e.key === "ArrowRight" || e.key === "ArrowLeft") ? -1 : 1);
      var idx = 0;
      for (var i = 0; i < SS.DHIKR_PRESETS.length; i++) if (SS.DHIKR_PRESETS[i].id === dkPreset.id) idx = i;
      idx = (idx + dir + SS.DHIKR_PRESETS.length) % SS.DHIKR_PRESETS.length;
      dkSelect(SS.DHIKR_PRESETS[idx].id);
      var b = $("dk-presets").querySelector('[aria-checked="true"]');
      if (b) { b.focus(); b.scrollIntoView({ block: "nearest", inline: "nearest" }); }
    };
    $("dk-ring").onclick = dkTap;
    $("dk-target-sel").onchange = function () {
      var all = SS.store.get("dhikr:targets", {});
      if (+this.value === dkPreset.target) delete all[dkPreset.id]; else all[dkPreset.id] = +this.value;
      SS.store.set("dhikr:targets", all);
      dkRenderPresets(); dkRenderCounter(); dkRenderToday();
    };
    $("dk-undo").onclick = function () {
      if (dkCount > 0) { dkCount--; dkSave(); dkRenderCounter(); dkRenderToday(); }
    };
    $("dk-reset").onclick = function () {
      if (dkCount === 0) return;
      if (dkCount >= 10 && !confirm(t("dhikr.resetConfirm"))) return;
      dkCount = 0; dkSave(); dkRenderCounter(); dkRenderToday();
    };
    // Desktop: Space/Enter anywhere on the page counts (unless a control has focus).
    if (!dkKeyBound) {
      dkKeyBound = true;
      document.addEventListener("keydown", function (e) {
        if (SS.currentView() !== "dhikr" || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key !== " " && e.key !== "Enter") return;
        var a = document.activeElement;
        if (a && a.closest && a.closest("button, a, input, select, textarea, dialog")) return;
        e.preventDefault();
        dkTap();
      });
    }
  }

  /* ═══════════ SETTINGS ═══════════ */
  function settingsInit(params) {
    var s = SS.store.settings();
    var lh = "";
    SS.i18n.LANGS.forEach(function (l) {
      lh += '<option value="' + l.code + '"' + (l.code === SS.i18n.getLocale() ? " selected" : "") + ">" + esc(l.name) + (l.draft ? " · " + esc(t("lang.draft")) : "") + "</option>";
    });
    $("st-locale").innerHTML = lh;
    $("st-draft-note").hidden = !SS.i18n.isDraft();
    $("st-theme").value = s.theme;
    $("st-translation").checked = !!s.showTranslation;
    $("st-translit").checked = !!s.showTransliteration;
    fillSelect($("st-method"), SS.CALC_METHODS, s.method);
    fillSelect($("st-school"), SS.ASR_METHODS, s.school);
    fillReciters($("st-reciter"), s.reciter);

    var loc = SS.geo.stored();
    $("st-loc-status").textContent = loc
      ? t("settings.locationSet") + ": " + locLabel(loc)
      : t("settings.locationNone");
    $("st-loc-clear").hidden = !loc;

    $("st-locale").onchange = function () { SS.changeLocale(this.value); };
    $("st-theme").onchange = function () { SS.store.saveSettings({ theme: this.value }); SS.applyTheme(); };
    $("st-translation").onchange = function () { SS.store.saveSettings({ showTranslation: this.checked }); };
    $("st-translit").onchange = function () { SS.store.saveSettings({ showTransliteration: this.checked }); };
    $("st-method").onchange = function () { SS.store.saveSettings({ method: +this.value }); SS.toast(t("settings.saved")); };
    $("st-school").onchange = function () { SS.store.saveSettings({ school: +this.value }); SS.toast(t("settings.saved")); };
    $("st-reciter").onchange = function () { SS.store.saveSettings({ reciter: this.value }); SS.toast(t("settings.saved")); };
    $("st-loc-set").onclick = function () { SS.geo.request().then(function () { settingsInit(); }); };
    $("st-loc-clear").onclick = function () { SS.geo.clear(); settingsInit(); SS.toast(t("settings.locationCleared")); };
    $("st-method").addEventListener("change", function () { if (SS.reminders) SS.reminders.schedule(); });
    $("st-school").addEventListener("change", function () { if (SS.reminders) SS.reminders.schedule(); });

    $("st-export").onclick = function () {
      var blob = new Blob([JSON.stringify(SS.store.exportAll(), null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "salaamstreet-data-" + SS.localDate() + ".json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    };
    $("st-delete").onclick = function () {
      var signedIn = SS.account && SS.account.signedIn();
      if (!confirm(t(signedIn ? "settings.deleteConfirmAccount" : "settings.deleteConfirm"))) return;
      // Signed in: this device forgets the account too (the account itself
      // is only deleted from Account → Delete account).
      (signedIn ? SS.account.signOut(false).catch(function () {}) : Promise.resolve()).then(function () {
        SS.store.clearAll();
        SS.geo.clear();
        location.hash = "#/home";
        location.reload();
      });
    };
    hook("settingsInit", params);
  }

  /* ═══════════ HADITH ═══════════ */
  var hdGen = 0;

  function hadithInit(params) {
    if (params && params[0]) hdRenderCollection(params[0], params[1]);
    else hdRenderHome();
  }

  function hdRenderHome() {
    $("hd-detail").hidden = true;
    $("hd-home").hidden = false;
    var ar = SS.i18n.isAr();
    var html = "";
    for (var i = 0; i < SS.HADITH_COLLECTIONS.length; i++) {
      var c = SS.HADITH_COLLECTIONS[i];
      html += '<a class="cat hd-coll" href="#/hadith/' + c.id + '">' +
        '<span class="hd-top"><span class="q-ic">' + icon("scroll") + "</span>" +
        '<span class="badge badge-src">' + esc(t(c.bounded ? "hadith.tagComplete" : "hadith.tagBrowse")) + "</span></span>" +
        '<span class="c-title">' + esc(ar ? c.ar : c.en) + "</span>" +
        (ar ? "" : '<span class="c-ar" lang="ar">' + esc(c.ar) + "</span>") +
        '<span class="hd-about">' + esc(t("hadith.about_" + c.id)) + "</span>" +
        '<span class="c-sub">' + esc(t(c.bounded ? "hadith.boundedDesc" : "hadith.browseDesc")) + ' <svg class="ic flip" aria-hidden="true"><use href="#i-chev-r"/></svg></span></a>';
    }
    $("hd-cats").innerHTML = html;
  }

  /** hadith-api text is plain, but some entries carry <br> or stray tags. */
  function hdClean(s) {
    return String(s || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim();
  }
  function hdParas(s, cls, lang) {
    var parts = hdClean(s).split(/\n+/), out = "";
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].trim()) out += '<p class="' + cls + '"' + (lang ? ' lang="' + lang + '"' : "") + ">" + esc(parts[i].trim()) + "</p>";
    }
    return out;
  }
  function hdCard(en, ar, ref, grade, num) {
    return '<article class="card dua-card">' +
      (num != null ? '<div class="row-between"><span class="badge">#' + esc(num) + '</span><div class="card-actions"><button class="icon-btn" type="button" data-copy aria-label="' + esc(t("common.copy")) + '">' + icon("copy") + "</button>" +
        '<button class="icon-btn" type="button" data-share aria-label="' + esc(t("common.share")) + '">' + icon("share") + "</button></div></div>" : "") +
      (ar ? hdParas(ar, "arabic-dua", "ar") : "") +
      (en ? hdParas(en, "translation mt-1") : "") +
      '<div class="card-foot"><span class="badge badge-src">' + esc(t("hadith.reference")) + ": " + esc(ref) + "</span>" +
      (grade ? '<span class="badge">' + esc(t("hadith.grade")) + ": " + esc(grade) + "</span>" : "") + "</div></article>";
  }

  function hdRef(coll, h) {
    var r = h && h.reference;
    if (r && r.book != null) return coll.cite + " — " + f("hadith.bookRef", { book: r.book, hadith: r.hadith });
    return coll.cite + " #" + (h ? h.hadithnumber : "?");
  }
  function hdGrade(h) {
    if (h && h.grades && h.grades.length) return h.grades[0].grade;
    return "";
  }
  function hdWireCopy(list) {
    list.onclick = function (e) {
      var sh = e.target.closest("[data-share]");
      if (sh && SS.share) {
        var c = sh.closest("article");
        var arEl = c.querySelector(".arabic-dua"), enEls = c.querySelectorAll(".translation"), src = c.querySelector(".badge-src");
        var en = []; for (var x = 0; x < enEls.length; x++) en.push(enEls[x].textContent);
        SS.share.open({ arabic: arEl ? arEl.textContent : "", text: en.join(" "), ref: src ? src.textContent : "" });
        return;
      }
      var b = e.target.closest("[data-copy]");
      if (!b) return;
      var card = b.closest("article");
      var parts = card.querySelectorAll(".arabic-dua, .translation, .badge-src");
      var txt = [];
      for (var i = 0; i < parts.length; i++) txt.push(parts[i].textContent);
      copyText(txt.join("\n\n"));
    };
  }

  function hdRenderCollection(id, numParam) {
    var coll = null;
    for (var i = 0; i < SS.HADITH_COLLECTIONS.length; i++) if (SS.HADITH_COLLECTIONS[i].id === id) coll = SS.HADITH_COLLECTIONS[i];
    if (!coll) return hdRenderHome();
    var title = SS.i18n.isAr() ? coll.ar : coll.en;
    $("hd-home").hidden = true;
    $("hd-detail").hidden = false;
    $("hd-title").textContent = title;
    $("tb-title").textContent = title;
    $("hd-browse").hidden = coll.bounded;
    var list = $("hd-list");
    hdWireCopy(list);
    var gen = ++hdGen;

    if (coll.bounded) {
      list.setAttribute("aria-busy", "true");
      list.innerHTML = skeletons(3, 160);
      Promise.all([SS.api.hadithEdition(coll.eng), SS.api.hadithEdition(coll.ara)])
        .then(function (res) {
          if (gen !== hdGen) return;
          var en = res[0].hadiths, araMap = {};
          res[1].hadiths.forEach(function (h) { araMap[h.hadithnumber] = h.text; });
          var html = "";
          for (var j = 0; j < en.length; j++) {
            var h = en[j];
            if (!h.text && !araMap[h.hadithnumber]) continue;
            html += hdCard(h.text, araMap[h.hadithnumber] || "", hdRef(coll, h), hdGrade(h), h.hadithnumber);
          }
          list.innerHTML = html;
          list.removeAttribute("aria-busy");
        })
        .catch(function () { if (gen === hdGen) renderState(list, { kind: "error", retry: function () { hdRenderCollection(id, numParam); } }); });
    } else {
      var num = Math.max(1, parseInt(numParam, 10) || 1);
      $("hd-num").value = num;
      $("hd-prev").disabled = num <= 1;
      $("hd-browse").onsubmit = function (e) {
        e.preventDefault();
        var n = Math.max(1, parseInt($("hd-num").value, 10) || 1);
        location.hash = "#/hadith/" + id + "/" + n;
      };
      $("hd-prev").onclick = function () { if (num > 1) location.hash = "#/hadith/" + id + "/" + (num - 1); };
      $("hd-next").onclick = function () { location.hash = "#/hadith/" + id + "/" + (num + 1); };
      hdLoadOne(coll, num, gen);
    }
  }

  function hdLoadOne(coll, num, gen) {
    var list = $("hd-list");
    list.setAttribute("aria-busy", "true");
    list.innerHTML = skeletons(1, 180);
    var safe = function (p) { return p.catch(function (err) { if (/404/.test(String(err && err.message))) return null; throw err; }); };
    Promise.all([safe(SS.api.hadithOne(coll.eng, num)), safe(SS.api.hadithOne(coll.ara, num))])
      .then(function (res) {
        if (gen !== hdGen) return;
        var en = res[0], ar = res[1];
        if ((!en || !en.text) && (!ar || !ar.text)) {
          renderState(list, { kind: "empty", icon: "scroll", text: f("hadith.notFound", { n: num }) });
          return;
        }
        list.innerHTML = hdCard(en ? en.text : "", ar ? ar.text : "", hdRef(coll, en || ar), hdGrade(en), num);
        list.removeAttribute("aria-busy");
      })
      .catch(function () { if (gen === hdGen) renderState(list, { kind: "error", retry: function () { hdLoadOne(coll, num, ++hdGen); } }); });
  }

  /* ═══════════ ISLAMIC CALENDAR ═══════════ */
  var HIJRI_MONTHS = {
    en: ["Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani", "Jumada al-Awwal", "Jumada al-Thani",
      "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhul-Qi'dah", "Dhul-Hijjah"],
    ar: ["محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة",
      "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"],
  };
  var calGen = 0;

  function calendarInit() {
    var gen = ++calGen;
    $("cal-hijri").innerHTML = '<span class="sk-text" style="inline-size:12ch"></span>';
    $("cal-next").textContent = "";
    try {
      $("cal-greg").textContent = new Date().toLocaleDateString(SS.i18n.dateLocale(),
        { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    } catch (e) { $("cal-greg").textContent = new Date().toDateString(); }
    $("cal-events").innerHTML = skeletons(5, 84);
    SS.api.gToH(new Date()).then(function (h) {
      if (gen !== calGen) return;
      $("cal-hijri").textContent = SS.hijriLabel(h);
      calRenderEvents(+h.month.number, +h.day);
    }).catch(function () {
      if (gen !== calGen) return;
      $("cal-hijri").textContent = "—";
      $("cal-next").textContent = navigator.onLine === false ? t("common.offline") : t("common.error");
      calRenderEvents(0, 0);
    });
  }

  function calRenderEvents(curMonth, curDay) {
    var ar = SS.i18n.isAr();
    var months = ar ? HIJRI_MONTHS.ar : HIJRI_MONTHS.en;
    var rows = [];
    for (var i = 0; i < SS.ISLAMIC_EVENTS.length; i++) {
      var e = SS.ISLAMIC_EVENTS[i];
      var diff = null;
      if (curMonth) {
        // Approximate: a lunar month averages 29.53 days.
        diff = Math.round((e.month - curMonth) * 29.53 + (e.day - curDay));
        if (e.month === curMonth) diff = e.day - curDay;
      }
      rows.push({ e: e, diff: diff });
    }
    var soonest = null;
    for (var k = 0; k < rows.length; k++) {
      if (rows[k].diff !== null && rows[k].diff >= 0 && (soonest === null || rows[k].diff < soonest.diff)) soonest = rows[k];
    }
    var nextYear = false;
    if (!soonest) { // every date has passed this Hijri year → the next one is early next year
      for (var m = 0; m < rows.length; m++) {
        if (rows[m].diff !== null && (soonest === null || rows[m].diff < soonest.diff)) soonest = rows[m];
      }
      nextYear = !!soonest;
    }
    var html = "";
    for (var j = 0; j < rows.length; j++) {
      var r = rows[j], ev = r.e;
      var cls = "", when = "";
      if (r.diff !== null) {
        if (r.diff === 0) { cls = "today-ev upcoming"; when = t("cal.todayEvent"); }
        else if (r.diff > 0) { cls = "upcoming"; when = f(r.diff === 1 ? "cal.inDay" : "cal.inDays", { n: r.diff }); }
        else { cls = "past"; when = t("cal.passed"); }
        if (r === soonest && r.diff > 0) cls += " soonest";
      }
      var approxDate = "";
      if (r.diff !== null && r.diff >= 0) {
        try {
          approxDate = "≈ " + new Date(Date.now() + r.diff * DAY).toLocaleDateString(SS.i18n.dateLocale(), { day: "numeric", month: "short", year: "numeric" });
        } catch (x) { approxDate = ""; }
      }
      html += '<div class="event ' + cls + '">' +
        '<span class="date"><span><b>' + ev.day + "</b><small>" + esc(months[ev.month - 1]) + "</small></span></span>" +
        '<div class="e-body"><div class="e-title">' + esc(ar ? ev.ar : ev.en) + "</div>" +
        ((ev.note && !ar) || approxDate ? '<div class="e-note">' + esc([approxDate, ar ? "" : ev.note].filter(Boolean).join(" · ")) + "</div>" : "") +
        "</div>" + (when ? '<span class="when">' + esc(when) + "</span>" : "") + "</div>";
    }
    $("cal-events").innerHTML = html;
    if (soonest) {
      if (nextYear) { $("cal-next").textContent = f("cal.next", { e: ar ? soonest.e.ar : soonest.e.en, n: soonest.diff + 354 }); return; }
      $("cal-next").textContent = soonest.diff === 0
        ? f("cal.nextToday", { e: ar ? soonest.e.ar : soonest.e.en })
        : f("cal.next", { e: ar ? soonest.e.ar : soonest.e.en, n: soonest.diff });
    }
  }

  /* ═══════════ Export view registry ═══════════ */
  SS.views = {
    home: homeInit,
    prayer: prayerInit,
    quran: quranInit,
    surah: surahInit,
    hadith: hadithInit,
    duas: duasInit,
    dhikr: dhikrInit,
    calendar: calendarInit,
    settings: settingsInit,
  };
  SS.ui = {
    f: function (k, v) { return f(k, v); }, icon: icon, renderState: renderState, skeletons: skeletons,
    locLabel: locLabel, locNote: locNote, arDigits: arDigits, surahName: surahName, copyText: copyText,
    vibrate: vibrate, parseTime: parseTime, nextPrayerKey: nextPrayerKey, liveStreak: liveStreak,
    fillSelect: fillSelect, fillReciters: fillReciters, trAttrs: trAttrs, stripBasmala: stripBasmala,
  };
  SS.viewsReady = function () {
    esc = SS.esc; t = SS.i18n.t;
    SS.applyQuranScale();
  };
})();
