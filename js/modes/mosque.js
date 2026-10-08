/* SalaamStreet — modes/mosque.js (classic script, loaded on demand)
   3.0 Mosque Mode: the mosque you're at or going to, its prayer times,
   Jumu'ah, Qibla, useful duas, and an optional Quiet Mode.

   Honesty about data: mosques come from OpenStreetMap (the app's existing
   mosque finder) and are labelled that way. OpenStreetMap has no iqamah or
   Jumu'ah times and no announcements, so the prayer times shown are the
   calculated start times for the mosque's location, a Jumu'ah time can only be
   one you note yourself (shown as "your note"), and announcements/events show
   an honest empty state until mosques can publish them (roadmap 3.4).
   The chosen and saved mosques stay on this device (they reveal where you are). */
(function () {
  "use strict";
  var M = SS.modes;
  var $ = function (id) { return document.getElementById(id); };
  function t(k) { return SS.i18n.t(k); }
  function f(k, v) { return SS.ui.f(k, v); }
  function esc(s) { return SS.esc(s); }
  function icon(n, c) { return SS.ui.icon(n, c); }
  var FIVE = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

  var DUAS = [
    { title: { en: "Leaving the mosque", ar: "عند الخروج من المسجد" },
      arabic: "اللَّهُمَّ إِنِّي أَسْأَلُكَ مِنْ فَضْلِكَ",
      transliteration: "Allahumma inni as'aluka min fadlik.",
      meaning: { en: "O Allah, I ask You of Your bounty.", ar: "" },
      source: { en: "Sahih Muslim 713", ar: "صحيح مسلم ٧١٣" } },
    { title: { en: "After the adhan", ar: "بعد الأذان" },
      arabic: "اللَّهُمَّ رَبَّ هَذِهِ الدَّعْوَةِ التَّامَّةِ، وَالصَّلَاةِ الْقَائِمَةِ، آتِ مُحَمَّدًا الْوَسِيلَةَ وَالْفَضِيلَةَ، وَابْعَثْهُ مَقَامًا مَحْمُودًا الَّذِي وَعَدْتَهُ",
      transliteration: "Allahumma Rabba hadhihid-da'watit-tammah, was-salatil-qa'imah, ati Muhammadanil-wasilata wal-fadilah, wab'athhu maqaman mahmudanil-ladhi wa'adtah.",
      meaning: { en: "O Allah, Lord of this perfect call and the prayer about to be established, grant Muhammad the wasilah and excellence, and raise him to the praised station You have promised him.", ar: "" },
      source: { en: "Sahih al-Bukhari 614", ar: "صحيح البخاري ٦١٤" } },
  ];
  var ETIQUETTE = [
    { en: "Before sitting down, pray two rak'ahs to greet the mosque.", ar: "صلِّ ركعتين تحية المسجد قبل أن تجلس.", src: { en: "Sahih al-Bukhari 444", ar: "صحيح البخاري ٤٤٤" } },
    { en: "The dua between the adhan and the iqamah is not turned away.", ar: "الدعاء بين الأذان والإقامة لا يُرد.", src: { en: "Abu Dawud 521; At-Tirmidhi 212 — graded sahih", ar: "أبو داود ٥٢١، الترمذي ٢١٢ — صحيح" } },
    { en: "On Friday, come early and listen quietly to the khutbah.", ar: "يوم الجمعة بكّر وأنصت للخطبة.", src: { en: "Sahih al-Bukhari 881, 934", ar: "صحيح البخاري ٨٨١، ٩٣٤" } },
  ];

  /* ═══════════ Stored mosques (this device only) ═══════════ */
  function clean(m) {
    if (!m || typeof m.lat !== "number" || typeof m.lng !== "number" || typeof m.id !== "string") return null;
    var web = /^https?:\/\//i.test(m.website || "") ? String(m.website).slice(0, 300) : "";
    return { id: m.id.slice(0, 40), name: String(m.name || "").slice(0, 120), nameAr: String(m.nameAr || "").slice(0, 120),
      lat: m.lat, lng: m.lng, street: String(m.street || "").slice(0, 120), city: String(m.city || "").slice(0, 80),
      website: web, phone: String(m.phone || "").replace(/[^\d+()\-\s]/g, "").slice(0, 30), at: m.at || Date.now() };
  }
  function selected() { return clean(SS.store.get("mosque:selected")); }
  function saved() {
    var s = SS.store.get("mosque:saved", {}), out = [];
    for (var k in (s || {})) { var m = clean(s[k]); if (m) out.push(m); }
    return out.sort(function (a, b) { return (a.name || "").localeCompare(b.name || ""); });
  }
  function isSaved(id) { var s = SS.store.get("mosque:saved", {}) || {}; return !!s[id]; }
  function toggleSaved(m) {
    var s = SS.store.get("mosque:saved", {}) || {};
    if (s[m.id]) delete s[m.id]; else s[m.id] = clean(m);
    SS.store.set("mosque:saved", s);
    return !!s[m.id];
  }
  function select(m) { SS.store.set("mosque:selected", clean(Object.assign({}, m, { at: Date.now() }))); }
  function note(id) { var n = (SS.store.get("mosque:notes", {}) || {})[id]; return n && /^\d{2}:\d{2}$/.test(n.jumuah || "") ? n : null; }
  function setNote(id, hhmm) {
    var all = SS.store.get("mosque:notes", {}) || {};
    if (hhmm) all[id] = { jumuah: hhmm, at: Date.now() }; else delete all[id];
    SS.store.set("mosque:notes", all);
  }
  function nameOf(m) { return (SS.i18n.isAr() && m.nameAr) || m.name || t("mosques.unnamed"); }
  function addrOf(m) { return [m.street, m.city].filter(Boolean).join(", "); }
  function mapsLink(m) {
    var apple = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);
    return apple ? "https://maps.apple.com/?daddr=" + m.lat + "," + m.lng + "&q=" + encodeURIComponent(m.name || "Mosque")
      : "https://www.google.com/maps/dir/?api=1&destination=" + m.lat + "," + m.lng;
  }
  function distKm(a, b, c, d) {
    var R = 6371, r = Math.PI / 180;
    var x = Math.sin((c - a) * r / 2), y = Math.sin((d - b) * r / 2);
    var h = x * x + Math.cos(a * r) * Math.cos(c * r) * y * y;
    return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }
  function times(m, date) {
    var s = SS.store.settings();
    return SS.api.prayerTimes({ lat: m.lat, lng: m.lng, method: s.method, school: s.school, date: date });
  }
  function nextFriday() {
    var d = new Date(); d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7));
    return d;
  }
  function dateLabel(d) {
    try { return d.toLocaleDateString(SS.i18n.dateLocale(), { weekday: "long", day: "numeric", month: "long" }); } catch (e) { return SS.localDate(d); }
  }
  function quietSwitch(id) {
    var on = !!SS.store.get("modes:quiet");
    return '<div class="set-row"><span id="' + id + '-l"><b>' + esc(t("mosque.quiet")) + '</b><br><span class="tiny">' + esc(t("mosque.quietSub")) + "</span></span>" +
      '<label class="switch"><input type="checkbox" id="' + id + '" aria-labelledby="' + id + '-l"' + (on ? " checked" : "") + ' /><span class="trk"></span><span class="th"></span></label></div>';
  }
  function wireQuiet(id, after) {
    var cb = $(id);
    if (!cb) return;
    cb.onchange = function () {
      SS.store.set("modes:quiet", cb.checked);
      M.apply();
      SS.toast(t(cb.checked ? "mosque.quietOn" : "mosque.quietOff"));
      if (after) after();
    };
  }

  /* ═══════════ Home panel ═══════════ */
  var gen = 0;
  function home(el) {
    var my = ++gen, m = selected();
    el.innerHTML = '<div class="mode-tiles">' +
      '<a class="mode-tile" href="#/mode/mosque' + (m ? "" : "/find") + '"><small>' + esc(t("mosque.yourMosque")) + "</small><b>" + esc(m ? nameOf(m) : t("mosque.choose")) + "</b></a>" +
      '<div class="mode-tile"><small>' + esc(t("dash.nextPrayer")) + '</small><b id="mq-h-next">' + (m ? "…" : "—") + "</b></div>" +
      '<div class="mode-tile"><small>' + esc(t("mosque.jumuah")) + '</small><b id="mq-h-jum">' + (m ? "…" : "—") + "</b></div>" +
      '<a class="mode-tile" href="#/qibla"><small>' + esc(t("nav.qibla")) + "</small><b>" + (m ? Math.round(SS.qiblaBearing(m.lat, m.lng)) + "°" : "—") + "</b></a>" +
      "</div>" + quietSwitch("mq-h-quiet") +
      '<a class="btn btn-sm mt-1" href="#/mode/mosque">' + esc(t("modes.openDash")) + "</a>";
    wireQuiet("mq-h-quiet", function () { if (SS.currentView() === "home") SS.navigate(true); });
    if (!m) return;
    times(m).then(function (r) {
      if (my !== gen || !$("mq-h-next")) return;
      var k = SS.ui.nextPrayerKey(r.timings) || "Fajr";
      $("mq-h-next").textContent = t("prayer." + k) + " · " + SS.formatTime(r.timings[k]);
    }).catch(function () { if ($("mq-h-next")) $("mq-h-next").textContent = "—"; });
    var n = note(m.id);
    if (n) $("mq-h-jum").textContent = SS.formatTime(n.jumuah) + " · " + t("mosque.yourNoteShort");
    else times(m, nextFriday()).then(function (r) {
      if (my === gen && $("mq-h-jum")) $("mq-h-jum").textContent = f("mosque.dhuhrFrom", { t: SS.formatTime(r.timings.Dhuhr) });
    }).catch(function () { if ($("mq-h-jum")) $("mq-h-jum").textContent = "—"; });
  }

  /* ═══════════ Full page ═══════════ */
  function page(el, params) {
    gen++;
    el.onclick = null;
    var tab = params[0] === "find" || params[0] === "duas" ? params[0] : "today";
    if (tab === "today" && !selected()) tab = "find";
    el.innerHTML = '<div class="segmented mode-tabs" id="mq-tabs" aria-label="' + esc(t("modes.sections")) + '"></div><div id="mq-body" role="tabpanel" aria-labelledby="mt-' + tab + '"></div>';
    M.tabs($("mq-tabs"), [["today", t("mosque.tabToday")], ["find", t("mosque.tabFind")], ["duas", t("mosque.tabDuas")]], tab,
      function (k) { location.hash = "#/mode/mosque" + (k === "today" ? "" : "/" + k); });
    ({ today: today, find: find, duas: duasTab })[tab]($("mq-body"));
  }

  function today(el) {
    var my = gen, m = selected(), n = note(m.id), fri = nextFriday();
    var contact = "";
    if (m.website) contact += '<a class="btn btn-outline btn-sm" href="' + esc(m.website) + '" target="_blank" rel="noopener nofollow">' + icon("globe") + "<span>" + esc(t("mosque.website")) + "</span></a>";
    if (m.phone) contact += '<a class="btn btn-outline btn-sm" href="tel:' + esc(m.phone.replace(/[^\d+]/g, "")) + '">' + icon("phone") + "<span>" + esc(m.phone) + "</span></a>";
    el.innerHTML = '<div class="mode-grid"><div class="stack">' +
      '<article class="card" aria-labelledby="mq-name"><div class="fam-top"><span class="w-ic">' + icon("mosque") + '</span><div class="w-body"><h2 class="h-sm" id="mq-name">' + esc(nameOf(m)) + "</h2>" +
      '<p class="tiny">' + esc(addrOf(m) || t("mosque.noAddress")) + "</p></div></div>" +
      '<div class="form-row mt-1"><a class="btn btn-sm" href="' + esc(mapsLink(m)) + '" target="_blank" rel="noopener">' + esc(t("mosques.directions")) + "</a>" + contact +
      '<button class="btn btn-ghost btn-sm" type="button" id="mq-save" aria-pressed="' + isSaved(m.id) + '">' + icon("star") + "<span>" + esc(t(isSaved(m.id) ? "mosque.saved" : "mosque.save")) + "</span></button>" +
      '<a class="btn btn-ghost btn-sm" href="#/mode/mosque/find">' + esc(t("mosque.change")) + "</a></div>" +
      '<p class="tiny mt-1">' + esc(f("mosque.dataSource", { d: dateLabel(new Date(m.at)) })) + "</p></article>" +
      '<article class="card" aria-labelledby="mq-pt-h"><div class="card-title"><h2 id="mq-pt-h">' + esc(t("mosque.times")) + '</h2><span class="tiny" id="mq-hijri"></span></div>' +
      '<p class="np-name" id="mq-np"></p><div id="mq-times" aria-busy="true">' + SS.ui.skeletons(1, 160) + "</div>" +
      '<p class="note mt-1">' + esc(t("mosque.timesNote")) + "</p></article>" +
      '<article class="card" aria-labelledby="mq-j-h"><div class="card-title"><h2 id="mq-j-h">' + esc(t("mosque.jumuah")) + "</h2></div>" +
      "<p><b>" + esc(dateLabel(fri)) + '</b></p><p id="mq-jdhuhr" class="tiny"></p>' +
      '<form id="mq-jform" class="mt-1" novalidate><label for="mq-jtime" class="field-l"><b>' + esc(t("mosque.jumuahNote")) + "</b></label>" +
      '<p class="tiny" id="mq-jhelp">' + esc(t("mosque.jumuahNoteHelp")) + "</p>" +
      '<div class="form-row"><input class="input" id="mq-jtime" type="time" value="' + (n ? n.jumuah : "") + '" aria-describedby="mq-jhelp" />' +
      '<button class="btn btn-sm" type="submit">' + esc(t("travel.save")) + "</button>" +
      (n ? '<button class="btn btn-ghost btn-sm" type="button" id="mq-jclear">' + esc(t("mosque.clearNote")) + "</button>" : "") + "</div>" +
      (n ? '<p class="tiny mt-1">' + esc(f("mosque.yourNote", { t: SS.formatTime(n.jumuah) })) + "</p>" : "") + "</form></article>" +
      "</div><div class=\"stack\">" +
      '<article class="card"><div class="card-title"><h2>' + esc(t("nav.qibla")) + "</h2></div><p class=\"h-sm\">" + esc(f("travel.qiblaDeg", { d: Math.round(SS.qiblaBearing(m.lat, m.lng)) })) + "</p>" +
      '<a class="btn btn-sm mt-1" href="#/qibla">' + icon("compass") + "<span>" + esc(t("travel.openCompass")) + "</span></a></article>" +
      '<article class="card">' + quietSwitch("mq-quiet") + '<p class="tiny mt-1">' + esc(t("mosque.quietLimits")) + "</p></article>" +
      '<article class="card" aria-labelledby="mq-ann-h"><div class="card-title"><h2 id="mq-ann-h">' + esc(t("mosque.news")) + "</h2></div>" +
      '<div class="state state-inline"><span class="s-ic">' + icon("bell") + "</span><p>" + esc(t("mosque.newsEmpty")) + "</p>" +
      (m.website ? '<a class="btn btn-outline btn-sm" href="' + esc(m.website) + '" target="_blank" rel="noopener nofollow">' + esc(t("mosque.checkWebsite")) + "</a>" : "") + "</div></article>" +
      '<a class="card widget" href="#/mode/mosque/duas"><span class="w-ic">' + icon("heart") + '</span><span class="w-body"><span class="w-title">' + esc(t("mosque.tabDuas")) + "</span></span>" + icon("chev-r", "chev") + "</a>" +
      "</div></div>";
    times(m).then(function (r) {
      if (my !== gen) return;
      var k = SS.ui.nextPrayerKey(r.timings);
      $("mq-np").textContent = k ? t("dash.nextPrayer") + ": " + t("prayer." + k) + " · " + SS.formatTime(r.timings[k]) : "";
      $("mq-hijri").textContent = SS.hijriLabel(r.hijri);
      $("mq-times").innerHTML = '<ul class="times-list">' + FIVE.map(function (key) {
        return '<li class="time-row' + (key === k ? " next" : "") + '"><span>' + esc(t("prayer." + key)) + (key === k ? ' <span class="badge">' + esc(t("mosque.next")) + "</span>" : "") + "</span><b>" + esc(SS.formatTime(r.timings[key])) + "</b></li>";
      }).join("") + "</ul>" + (r.onDevice ? '<p class="tiny">' + esc(t("travel.calcOnDevice")) + "</p>" : "");
      $("mq-times").removeAttribute("aria-busy");
    }).catch(function () {
      if (my === gen) SS.ui.renderState($("mq-times"), { kind: "error", retry: function () { today(el); } });
    });
    times(m, fri).then(function (r) {
      if (my === gen && $("mq-jdhuhr")) $("mq-jdhuhr").textContent = f("mosque.jumuahDhuhr", { t: SS.formatTime(r.timings.Dhuhr) });
    }).catch(function () { /* the note still works */ });
    $("mq-save").onclick = function () {
      var on = toggleSaved(m);
      SS.toast(t(on ? "mosque.savedToast" : "mosque.removedToast"));
      today(el);
    };
    $("mq-jform").onsubmit = function (e) {
      e.preventDefault();
      var v = $("mq-jtime").value;
      if (v && !/^\d{2}:\d{2}$/.test(v)) { $("mq-jtime").setAttribute("aria-invalid", "true"); return; }
      setNote(m.id, v);
      SS.toast(t("settings.saved"));
      today(el);
    };
    if ($("mq-jclear")) $("mq-jclear").onclick = function () { setNote(m.id, ""); today(el); };
    wireQuiet("mq-quiet");
  }

  /* ── Find: near me, search an area, saved ── */
  var results = [], resultsFrom = "";
  function find(el) {
    var sv = saved(), cur = selected();
    el.innerHTML = '<div class="stack">' +
      '<article class="card"><h2 class="h-sm">' + esc(t("mosque.findTitle")) + "</h2>" +
      '<div class="form-row mt-1"><button class="btn btn-sm" type="button" id="mq-near">' + icon("pin") + "<span>" + esc(t("mosque.nearMe")) + "</span></button></div>" +
      '<form class="mt-1" id="mq-area" novalidate><label class="field-l" for="mq-area-q"><b>' + esc(t("mosque.searchArea")) + "</b></label>" +
      '<div class="form-row"><input class="input" id="mq-area-q" type="search" maxlength="80" autocomplete="off" placeholder="' + esc(t("travel.placePh")) + '" aria-describedby="mq-area-err" />' +
      '<button class="btn btn-outline btn-sm" type="submit">' + icon("search") + "<span>" + esc(t("mosque.search")) + "</span></button></div>" +
      '<p class="field-error" id="mq-area-err" role="alert"></p></form></article>' +
      '<section aria-labelledby="mq-res-h"><h2 class="group-label" id="mq-res-h">' + esc(t("mosque.results")) + '</h2>' +
      '<div class="search mb-1" id="mq-filter-wrap"' + (results.length ? "" : " hidden") + '>' + icon("search") +
      '<label class="visually-hidden" for="mq-filter">' + esc(t("mosque.filter")) + '</label><input class="input" id="mq-filter" type="search" placeholder="' + esc(t("mosque.filter")) + '" autocomplete="off" /></div>' +
      '<p class="tiny" id="mq-res-from" aria-live="polite"></p><div class="stack" id="mq-results"></div></section>' +
      '<section aria-labelledby="mq-saved-h"><h2 class="group-label" id="mq-saved-h">' + esc(t("mosque.savedTitle")) + "</h2>" +
      (sv.length ? '<div class="stack">' + sv.map(function (m) { return row(m, cur, "s"); }).join("") + "</div>" : '<p class="muted">' + esc(t("mosque.noSaved")) + "</p>") + "</section>" +
      '<p class="tiny">' + esc(t("mosque.credit")) + "</p></div>";
    drawResults();
    $("mq-near").onclick = function () {
      SS.geo.resolve().then(function (loc) {
        if (loc.isFallback || loc.approx) {
          return SS.geo.request().then(function (l) {
            if (!l) { $("mq-area-err").textContent = t("mosque.locDenied"); $("mq-area-q").focus(); return; }
            load(l, t("mosque.nearYou"));
          });
        }
        load(loc, t("mosque.nearYou"));
      });
    };
    $("mq-area").onsubmit = function (e) {
      e.preventDefault();
      var q = $("mq-area-q").value.trim(), err = $("mq-area-err");
      err.textContent = "";
      if (q.length < 2) { err.textContent = t("travel.placeTooShort"); $("mq-area-q").setAttribute("aria-invalid", "true"); $("mq-area-q").focus(); return; }
      $("mq-area-q").removeAttribute("aria-invalid");
      SS.api.geocodeCity(q).then(function (loc) { load(loc, loc.label); }).catch(function () {
        err.textContent = navigator.onLine === false ? t("travel.searchOffline") : t("loc.notFound");
      });
    };
    $("mq-filter").oninput = drawResults;
    el.onclick = function (e) {
      var s = e.target.closest("[data-sel]"), sv2 = e.target.closest("[data-save]");
      var id = (s || sv2 || {}).getAttribute ? (s || sv2).getAttribute(s ? "data-sel" : "data-save") : null;
      if (!id) return;
      var m = results.concat(saved()).filter(function (x) { return x.id === id; })[0];
      if (!m) return;
      if (s) {
        select(m);
        SS.toast(f("mosque.selected", { m: nameOf(m) }));
        if (location.hash === "#/mode/mosque") page($("mode-root"), []);
        else location.hash = "#/mode/mosque";
      } else {
        SS.toast(t(toggleSaved(m) ? "mosque.savedToast" : "mosque.removedToast"));
        find(el);
      }
    };
  }
  function row(m, cur, kind) {
    var on = cur && cur.id === m.id, sv = isSaved(m.id);
    return '<article class="card place-row"><span class="w-ic">' + icon("mosque") + "</span>" +
      '<div class="w-body"><b class="w-title">' + esc(nameOf(m)) + '</b><span class="w-sub">' + esc([m.km != null ? SS.formatDistance(m.km) : "", addrOf(m)].filter(Boolean).join(" · ")) + "</span></div>" +
      '<div class="place-acts">' + (on ? '<span class="badge">' + icon("check") + "<span>" + esc(t("mosque.current")) + "</span></span>"
        : '<button class="btn btn-sm" type="button" data-sel="' + esc(m.id) + '">' + esc(t("mosque.select")) + "</button>") +
      '<button class="icon-btn" type="button" data-save="' + esc(m.id) + '" aria-pressed="' + sv + '" aria-label="' + esc(f(sv ? "mosque.unsaveX" : "mosque.saveX", { m: nameOf(m) })) + '">' + icon("star", sv ? "fav-on" : "") + "</button>" +
      "</div></article>";
  }
  var loadGen = 0;
  function load(loc, from) {
    var my = ++loadGen, list = $("mq-results");
    if (!list) return;
    list.setAttribute("aria-busy", "true");
    list.innerHTML = SS.ui.skeletons(3, 76);
    $("mq-res-from").textContent = "";
    SS.api.mosques(loc.lat, loc.lng, 10000).then(function (items) {
      if (my !== loadGen || !$("mq-results")) return;
      items.forEach(function (m) { m.km = distKm(loc.lat, loc.lng, m.lat, m.lng); });
      results = items.sort(function (a, b) { return a.km - b.km; }).slice(0, 40);
      resultsFrom = from;
      $("mq-filter-wrap").hidden = !results.length;
      drawResults();
    }).catch(function () {
      if (my !== loadGen || !$("mq-results")) return;
      SS.ui.renderState(list, { kind: "error", retry: function () { load(loc, from); } });
    });
  }
  function drawResults() {
    var list = $("mq-results");
    if (!list) return;
    list.removeAttribute("aria-busy");
    var q = ($("mq-filter") && $("mq-filter").value.trim().toLowerCase()) || "";
    var shown = results.filter(function (m) { return !q || (m.name + " " + m.nameAr + " " + addrOf(m)).toLowerCase().indexOf(q) > -1; });
    if (!resultsFrom) { list.innerHTML = '<p class="muted">' + esc(t("mosque.searchHint")) + "</p>"; return; }
    $("mq-res-from").textContent = f("mosque.foundNear", { n: shown.length, p: resultsFrom });
    if (!shown.length) { SS.ui.renderState(list, { kind: "empty", icon: "mosque", text: t(results.length ? "mosque.noMatch" : "mosque.noneFound") }); return; }
    var cur = selected();
    list.innerHTML = shown.map(function (m) { return row(m, cur, "r"); }).join("");
  }

  function duasTab(el) {
    var html = '<div class="stack">';
    var lib = M.libraryDua("entering-mosque");
    if (lib) html += M.duaHtml(lib);
    DUAS.forEach(function (d) { html += M.duaHtml(d); });
    html += '<article class="card guide-text"><h2 class="h-sm">' + esc(t("mosque.etiquette")) + "</h2><ul>" + ETIQUETTE.map(function (e) {
      return "<li>" + esc(M.L(e)) + ' <span class="tiny">(' + esc(M.L(e.src)) + ")</span></li>";
    }).join("") + "</ul></article></div>";
    el.innerHTML = html;
  }

  SS.modeModules.mosque = { home: home, page: page, leave: function () { gen++; loadGen++; }, DUAS: DUAS };
})();
