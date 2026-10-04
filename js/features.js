/* SalaamStreet — features.js (classic script)
   Daily-habit and learning features built on top of views.js:
   prayer tracker · prayer reminders · Friday & Ramadan cards · adhkar ·
   99 Names · mosque finder · Arabic letters · Qur'an reading plans and
   translation search · share-as-image cards. */
(function () {
  "use strict";
  window.SS = window.SS || {};
  var $ = function (id) { return document.getElementById(id); };
  var DAY = 86400000;
  var FIVE = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
  function t(k) { return SS.i18n.t(k); }
  function f(k, v) { return SS.ui.f(k, v); }
  function esc(s) { return SS.esc(s); }
  function icon(n, c) { return SS.ui.icon(n, c); }
  function isAr() { return SS.i18n.isAr(); }
  function hooks() { return (SS.hooks = SS.hooks || {}); }
  function onHook(name, fn) {
    var prev = hooks()[name];
    hooks()[name] = function () {
      if (prev) prev.apply(null, arguments);
      fn.apply(null, arguments);
    };
  }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function weekdayShort(d) {
    try { return d.toLocaleDateString(SS.i18n.dateLocale(), { weekday: "short" }); } catch (e) { return ""; }
  }
  function keyActivate(handler) {
    return function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handler(e); } };
  }

  /* ═══════════ PRAYER TRACKER ═══════════ */
  var tracker = {
    log: function () { return SS.store.get("prayers:log", {}); },
    isDone: function (date, key) { var l = tracker.log(); return !!(l[date] && l[date][key]); },
    toggle: function (date, key) {
      var l = tracker.log();
      var d = l[date] || {};
      if (d[key]) delete d[key]; else d[key] = 1;
      if (Object.keys(d).length) l[date] = d; else delete l[date];
      // Keep about a year of history.
      var keys = Object.keys(l).sort();
      while (keys.length > 400) delete l[keys.shift()];
      SS.store.set("prayers:log", l);
      return !!d[key];
    },
    count: function (date) {
      var d = tracker.log()[date] || {}, n = 0;
      for (var i = 0; i < FIVE.length; i++) if (d[FIVE[i]]) n++;
      return n;
    },
    /** Consecutive days with all five prayers logged (today counts once complete). */
    streak: function () {
      var n = 0, day = new Date();
      if (tracker.count(SS.localDate(day)) < 5) day = addDays(day, -1);
      while (tracker.count(SS.localDate(day)) === 5) { n++; day = addDays(day, -1); }
      return n;
    },
  };
  SS.tracker = tracker;

  function renderWeek() {
    var grid = $("track-week");
    if (!grid) return;
    var html = '<div class="wk-row wk-head" role="row"><span role="columnheader"></span>';
    for (var p = 0; p < FIVE.length; p++) html += '<span role="columnheader">' + esc(t("prayer." + FIVE[p]).slice(0, isAr() ? 6 : 3)) + "</span>";
    html += "</div>";
    for (var i = 6; i >= 0; i--) {
      var d = addDays(new Date(), -i), ds = SS.localDate(d);
      html += '<div class="wk-row' + (i === 0 ? " today" : "") + '" role="row"><span class="wk-day" role="rowheader">' +
        esc(i === 0 ? t("cal.todayEvent") : weekdayShort(d)) + "</span>";
      for (var j = 0; j < FIVE.length; j++) {
        var on = tracker.isDone(ds, FIVE[j]);
        var label = f("track.cellLabel", { p: t("prayer." + FIVE[j]), d: i === 0 ? t("cal.todayEvent") : weekdayShort(d) });
        html += i === 0
          ? '<span class="wk-dot' + (on ? " on" : "") + '" role="cell" aria-label="' + esc(label + (on ? " ✓" : "")) + '"></span>'
          : '<button class="wk-dot' + (on ? " on" : "") + '" role="cell" type="button" data-d="' + ds + '" data-p="' + FIVE[j] + '" aria-pressed="' + on + '" aria-label="' + esc(label) + '"></button>';
      }
      html += "</div>";
    }
    grid.innerHTML = html;
    grid.onclick = function (e) {
      var b = e.target.closest("button[data-d]");
      if (!b) return;
      var on = tracker.toggle(b.getAttribute("data-d"), b.getAttribute("data-p"));
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", String(on));
      renderStreak();
    };
    renderStreak();
  }
  function renderStreak() {
    var el = $("track-streak");
    if (!el) return;
    var s = tracker.streak();
    el.textContent = f(s === 1 ? "track.streak1" : "track.streak", { n: s });
    el.hidden = s === 0;
  }

  function trackWidget() {
    var n = tracker.count(SS.localDate());
    $("track-sub").textContent = f("track.countOf", { n: n });
    var dots = "", d = tracker.log()[SS.localDate()] || {};
    for (var i = 0; i < FIVE.length; i++) dots += '<i class="' + (d[FIVE[i]] ? "on" : "") + '"></i>';
    $("track-dots").innerHTML = dots;
  }

  onHook("prayerTimes", function () {
    renderWeek();
    var st = $("pt-rem-state");
    if (st) st.textContent = SS.store.settings().reminders && notifPermission() === "granted" ? t("rem.on") : t("rem.off");
  });
  onHook("trackerChanged", renderWeek);

  /* ═══════════ REMINDERS ═══════════ */
  var remTimers = [], audioCtx = null;

  function notifSupported() { return typeof window.Notification !== "undefined"; }
  function notifPermission() { return notifSupported() ? Notification.permission : "unsupported"; }

  function chime() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = audioCtx || new AC();
      if (audioCtx.state === "suspended") audioCtx.resume();
      var now = audioCtx.currentTime;
      [[659.25, 0], [880, 0.35], [987.77, 0.7]].forEach(function (n) {
        var o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = "sine"; o.frequency.value = n[0];
        g.gain.setValueAtTime(0.0001, now + n[1]);
        g.gain.exponentialRampToValueAtTime(0.22, now + n[1] + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, now + n[1] + 1.6);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(now + n[1]); o.stop(now + n[1] + 1.7);
      });
    } catch (e) { /* audio unavailable */ }
  }

  function notify(title, body, tag, url) {
    var opts = { body: body, tag: tag, icon: "icons/icon-192.png", badge: "icons/icon-192.png", data: { url: url || "./#/prayer" } };
    var shown = false;
    if (notifPermission() === "granted") {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(function (reg) { return reg.showNotification(title, opts); }).catch(function () {
          try { new Notification(title, opts); } catch (e) { /* noop */ }
        });
        shown = true;
      } else {
        try { new Notification(title, opts); shown = true; } catch (e) { /* noop */ }
      }
    }
    if (document.visibilityState === "visible") SS.toast(title + (body ? " · " + body : ""));
    if (SS.store.settings().reminderSound) chime();
    return shown;
  }

  function clearReminders() {
    for (var i = 0; i < remTimers.length; i++) clearTimeout(remTimers[i]);
    remTimers = [];
  }

  function at(ms, fn) { if (ms > 0 && ms < 2 * DAY) remTimers.push(setTimeout(fn, ms)); }

  function scheduleReminders() {
    clearReminders();
    var s = SS.store.settings();
    var now = Date.now();
    // Re-plan just after midnight for the new day.
    var midnight = new Date(); midnight.setHours(24, 1, 0, 0);
    at(midnight - now, scheduleReminders);

    // Friday: one Al-Kahf reminder, from 10:00 local time.
    if (s.kahfReminder && new Date().getDay() === 5 && SS.store.get("kahf:notified") !== SS.localDate()) {
      var ten = new Date(); ten.setHours(10, 0, 0, 0);
      at(Math.max(ten - now, 4000), function () {
        if (SS.store.get("kahf:notified") === SS.localDate()) return;
        SS.store.set("kahf:notified", SS.localDate());
        if (s.reminders) notify(t("friday.title"), t("friday.notify"), "kahf-" + SS.localDate(), "./#/surah/18");
      });
    }

    if (!s.reminders || notifPermission() !== "granted") return;
    SS.geo.resolve().then(function (loc) {
      return SS.api.prayerTimes({ lat: loc.lat, lng: loc.lng, method: s.method, school: s.school }).then(function (r) {
        var off = (+s.reminderOffset || 0) * 60000;
        FIVE.forEach(function (key) {
          var when = SS.ui.parseTime(r.timings[key]).getTime() - off;
          at(when - Date.now(), function () {
            var tag = "prayer-" + SS.localDate() + "-" + key;
            if (SS.store.get("rem:last") === tag) return; // already shown (e.g. by another tab)
            SS.store.set("rem:last", tag);
            var name = t("prayer." + key);
            var title = off ? f("rem.soon", { p: name, n: s.reminderOffset }) : f("rem.now", { p: name });
            notify(title, SS.formatTime(r.timings[key]) + " · " + SS.ui.locLabel(loc), tag);
          });
        });
      });
    }).catch(function () { /* offline with no cache: try again when visible */ });
  }

  SS.reminders = {
    init: function () {
      scheduleReminders();
      document.addEventListener("visibilitychange", function () {
        // Background tabs throttle timers; re-plan whenever we're visible again.
        if (document.visibilityState === "visible") scheduleReminders();
      });
      // Unlock Web Audio on the first interaction so the chime can play later.
      var unlock = function () {
        try {
          var AC = window.AudioContext || window.webkitAudioContext;
          if (AC && !audioCtx) audioCtx = new AC();
          if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
        } catch (e) { /* noop */ }
        document.removeEventListener("pointerdown", unlock);
      };
      document.addEventListener("pointerdown", unlock);
    },
    schedule: scheduleReminders,
  };

  function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); }
  function isStandalone() { return (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true; }

  /* ═══════════ SETTINGS additions ═══════════ */
  onHook("settingsInit", function (params) {
    var s = SS.store.settings();
    var sel = $("st-trans-lang"), html = "";
    for (var i = 0; i < SS.TRANSLATIONS.length; i++) {
      var tr = SS.TRANSLATIONS[i];
      html += '<option value="' + tr.id + '"' + (tr.id === SS.translation().id ? " selected" : "") + ">" + esc(tr.label) + "</option>";
    }
    sel.innerHTML = html;
    sel.onchange = function () { SS.store.saveSettings({ translation: this.value }); SS.toast(t("settings.saved")); };

    var rem = $("st-rem");
    rem.checked = !!s.reminders && notifPermission() === "granted";
    $("st-rem-offset").value = String(s.reminderOffset || 0);
    $("st-rem-sound").checked = !!s.reminderSound;
    $("st-kahf").checked = s.kahfReminder !== false;
    var note = $("st-rem-note");
    if (!notifSupported()) note.textContent = isIOS() && !isStandalone() ? t("rem.iosNote") : t("rem.unsupported");
    else if (notifPermission() === "denied") note.textContent = t("rem.blocked");
    else note.textContent = t("rem.note");

    rem.onchange = function () {
      var box = this;
      if (!box.checked) { SS.store.saveSettings({ reminders: false }); scheduleReminders(); return; }
      if (!notifSupported()) {
        box.checked = false;
        SS.toast(isIOS() && !isStandalone() ? t("rem.iosNote") : t("rem.unsupported"));
        return;
      }
      Promise.resolve(Notification.requestPermission()).then(function (perm) {
        if (perm === "granted") {
          SS.store.saveSettings({ reminders: true });
          scheduleReminders();
          SS.toast(t("rem.enabled"));
        } else {
          box.checked = false;
          SS.store.saveSettings({ reminders: false });
          note.textContent = t("rem.blocked");
          SS.toast(t("rem.blocked"));
        }
      });
    };
    $("st-rem-offset").onchange = function () { SS.store.saveSettings({ reminderOffset: +this.value }); scheduleReminders(); };
    $("st-rem-sound").onchange = function () { SS.store.saveSettings({ reminderSound: this.checked }); };
    $("st-kahf").onchange = function () { SS.store.saveSettings({ kahfReminder: this.checked }); scheduleReminders(); };
    $("st-rem-test").onclick = function () {
      var shown = notify(t("rem.testTitle"), t("rem.testBody"), "test-" + Date.now());
      if (!shown && notifPermission() !== "granted") SS.toast(t("rem.testInApp"));
    };
    if (params && params[0] === "reminders") {
      setTimeout(function () { var h = $("reminders"); if (h) h.scrollIntoView({ block: "start" }); }, 60);
    }
  });

  /* ═══════════ HOME additions ═══════════ */
  onHook("homeInit", function () {
    trackWidget();
    adhkarWidget();
    nameOfDay();
    fridayCard();
    planWidget();
  });

  onHook("homeTimes", function (r) {
    // Prayed marks on the hero strip.
    var log = tracker.log()[SS.localDate()] || {};
    var slots = document.querySelectorAll("#np-strip .slot");
    for (var i = 0; i < slots.length; i++) {
      if (log[slots[i].getAttribute("data-key")]) slots[i].classList.add("prayed");
    }
    var n = tracker.count(SS.localDate());
    $("np-track").hidden = false;
    $("np-track").innerHTML = icon("check") + "<span>" + esc(f("track.countOf", { n: n })) + "</span>";
    trackWidget();
    ramadanCard(r);
  });

  function nameOfDay() {
    var el = $("name-of-day");
    var start = new Date(new Date().getFullYear(), 0, 0);
    var doy = Math.floor((new Date() - start) / DAY);
    var nm = SS.NAMES[doy % SS.NAMES.length];
    el.innerHTML = '<div class="card-title"><h2 id="nod-h">' + esc(t("names.ofDay")) + '</h2><a class="badge" href="#/names">' + esc(t("names.all")) + "</a></div>" +
      '<div class="nod"><span class="nod-ar" lang="ar">' + esc(nm.ar) + "</span><span><b>" + esc(nm.tr) + "</b><span class=\"muted\">" + esc(nm.en) + "</span></span></div>";
  }

  function fridayCard() {
    var el = $("friday-card");
    var on = new Date().getDay() === 5 && SS.store.settings().kahfReminder !== false;
    el.hidden = !on;
    if (!on) return;
    el.className = "banner friday";
    el.innerHTML = icon("moon") + "<p><b>" + esc(t("friday.title")) + "</b><br>" + esc(t("friday.body")) + "</p>" +
      '<a class="btn btn-sm" href="#/surah/18">' + esc(t("friday.read")) + "</a>";
  }

  var ramTimer = null;
  function ramadanCard(r) {
    var el = $("ramadan-card");
    clearInterval(ramTimer);
    var isRamadan = r && r.hijri && +r.hijri.month.number === 9;
    el.hidden = !isRamadan;
    if (!isRamadan) return;
    var year = r.hijri.year, day = +r.hijri.day;
    var fastsKey = "ramadan:" + year;
    var fasts = SS.store.get(fastsKey, {});
    var suhoorStr = r.timings.Imsak || r.timings.Fajr, iftarStr = r.timings.Maghrib;
    var suhoor = SS.ui.parseTime(suhoorStr), iftar = SS.ui.parseTime(iftarStr);
    var count = Object.keys(fasts).length;
    el.className = "card ramadan";
    el.innerHTML =
      '<div class="row-between wrap"><h2>' + icon("moon") + "<span>" + esc(f("ramadan.title", { d: day })) + "</span></h2>" +
      '<span class="badge badge-gold">' + esc(f(count === 1 ? "ramadan.fasted1" : "ramadan.fasted", { n: count })) + "</span></div>" +
      '<div class="ram-times mt-2">' +
      '<div><span class="tiny">' + esc(t("ramadan.suhoor")) + "</span><b>" + esc(SS.formatTime(suhoorStr)) + "</b></div>" +
      '<div><span class="tiny">' + esc(t("ramadan.iftar")) + "</span><b>" + esc(SS.formatTime(iftarStr)) + "</b></div>" +
      '<div class="ram-cd"><span class="tiny" id="ram-cd-l"></span><b id="ram-cd">--:--:--</b></div></div>' +
      '<div class="row wrap mt-2"><button class="toggle" id="ram-fast" type="button" aria-pressed="' + !!fasts[day] + '">' + esc(t("ramadan.fastingToday")) + "</button>" +
      '<a class="btn btn-ghost btn-sm" href="#/quran">' + esc(t("ramadan.plan")) + "</a></div>";
    $("ram-fast").onclick = function () {
      var fs = SS.store.get(fastsKey, {});
      if (fs[day]) delete fs[day]; else fs[day] = 1;
      SS.store.set(fastsKey, fs);
      ramadanCard(r);
    };
    var tick = function () {
      if (SS.currentView() !== "home") { clearInterval(ramTimer); return; }
      var now = new Date(), target, label;
      if (now < suhoor) { target = suhoor; label = t("ramadan.untilSuhoor"); }
      else if (now < iftar) { target = iftar; label = t("ramadan.untilIftar"); }
      else { $("ram-cd-l").textContent = t("ramadan.done"); $("ram-cd").textContent = "✓"; return; }
      var ms = target - now;
      var h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60;
      $("ram-cd-l").textContent = label;
      $("ram-cd").textContent = ("0" + h).slice(-2) + ":" + ("0" + m).slice(-2) + ":" + ("0" + sec).slice(-2);
    };
    tick();
    ramTimer = setInterval(tick, 1000);
  }

  /* ═══════════ ADHKAR ═══════════ */
  function adhkarDone() { return SS.store.get("adhkar:done", {})[SS.localDate()] || {}; }
  function markAdhkarDone(kind) {
    var all = SS.store.get("adhkar:done", {});
    var keys = Object.keys(all).sort();
    while (keys.length > 60) delete all[keys.shift()];
    all[SS.localDate()] = all[SS.localDate()] || {};
    all[SS.localDate()][kind] = true;
    SS.store.set("adhkar:done", all);
  }
  function suggestedAdhkar() { return new Date().getHours() < 14 ? "morning" : "evening"; }
  function adhkarItems(kind) {
    return SS.ADHKAR.filter(function (a) { return a.when === "both" || a.when === kind; });
  }

  function adhkarWidget() {
    var kind = suggestedAdhkar(), done = adhkarDone()[kind];
    $("adhkar-w-title").textContent = t("adhkar." + kind);
    $("adhkar-w-sub").textContent = done ? t("adhkar.doneToday") : f("adhkar.items", { n: adhkarItems(kind).length });
    $("adhkar-widget").setAttribute("href", "#/adhkar/" + kind);
  }

  var akKind = null, akIdx = 0, akCounts = {}, akQuran = {}, akKeyBound = false;

  function adhkarInit(params) {
    var kind = params && (params[0] === "morning" || params[0] === "evening") ? params[0] : null;
    $("ak-home").hidden = !!kind;
    $("ak-session").hidden = !kind;
    if (!kind) { adhkarHome(); return; }
    if (kind !== akKind) { akKind = kind; akIdx = 0; akCounts = {}; }
    $("ak-title").textContent = t("adhkar." + kind);
    $("tb-title").textContent = t("adhkar." + kind);
    loadAdhkarQuran().then(renderAdhkar, renderAdhkar);
    renderAdhkar();
    if (!akKeyBound) {
      akKeyBound = true;
      document.addEventListener("keydown", function (e) {
        if (SS.currentView() !== "adhkar" || $("ak-session").hidden || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key !== " " && e.key !== "Enter") return;
        var a = document.activeElement;
        if (a && a.closest && a.closest("button, a, input, select, textarea, dialog")) return;
        e.preventDefault();
        var b = $("ak-count");
        if (b) b.click();
      });
    }
  }

  function adhkarHome() {
    var done = adhkarDone(), sug = suggestedAdhkar(), html = "";
    ["morning", "evening"].forEach(function (k) {
      html += '<a class="card ak-choice ' + k + (k === sug ? " suggested" : "") + (done[k] ? " is-done" : "") + '" href="#/adhkar/' + k + '">' +
        '<span class="ak-deco" aria-hidden="true">' + icon(k === "morning" ? "sunrise" : "moon") + "</span>" +
        '<span class="ak-top"><span class="w-ic' + (k === "evening" ? " gold" : "") + '">' + icon(k === "morning" ? "sunrise" : "moon") + "</span>" +
        (done[k] ? '<span class="badge">' + icon("check") + esc(t("adhkar.doneShort")) + "</span>" : k === sug ? '<span class="badge badge-gold">' + esc(t("adhkar.now")) + "</span>" : "") + "</span>" +
        '<span class="w-title">' + esc(t("adhkar." + k)) + "</span>" +
        '<span class="ak-when">' + esc(t("adhkar.when" + (k === "morning" ? "Morning" : "Evening"))) + "</span>" +
        '<span class="w-sub">' + esc(f("adhkar.items", { n: adhkarItems(k).length })) + "</span>" +
        '<span class="ak-incl">' + esc(t("adhkar.includes")) + "</span>" +
        '<span class="btn btn-sm ak-go">' + esc(t(done[k] ? "adhkar.again" : "adhkar.begin")) + icon("chev-r", "flip") + "</span>" +
        "</a>";
    });
    $("ak-choices").innerHTML = html;
  }

  /** Fetch the Qur'anic adhkar (Ayat al-Kursi, the three Quls) from the Qur'an API. */
  function loadAdhkarQuran() {
    var jobs = [];
    SS.ADHKAR.forEach(function (a) {
      if (!a.quran || akQuran[a.id]) return;
      var parts = a.quran.map(function (q) {
        if (q[1]) {
          return SS.api.ayah(SS.globalAyahNumber(q[0], q[1])).then(function (x) {
            return { s: q[0], ar: x.arabic + " ﴿" + SS.ui.arDigits(q[1]) + "﴾", tr: x.translation };
          });
        }
        return SS.api.surahText(q[0]).then(function (x) {
          var ar = x.arabic.map(function (y, i) {
            return (i === 0 ? SS.ui.stripBasmala(y.text) : y.text) + " ﴿" + SS.ui.arDigits(i + 1) + "﴾";
          }).join(" ");
          var tr = x.translation.map(function (y) { return y.text; }).join(" ");
          return { s: q[0], ar: ar, tr: tr, basmala: true };
        });
      });
      jobs.push(Promise.all(parts).then(function (res) { akQuran[a.id] = res; }));
    });
    return Promise.all(jobs);
  }

  function itemText(a) {
    if (a.dua) {
      for (var i = 0; i < SS.DUAS.length; i++) if (SS.DUAS[i].id === a.dua) {
        var d = SS.DUAS[i];
        return { title: d.titleEn.replace(/\s*\(\d+×\)$/, ""), arabic: d.arabic, translit: d.transliteration, tr: d.translationEn, source: d.source };
      }
    }
    return { title: a.titleEn, arabic: a.arabic, translit: a.transliteration, tr: a.translationEn, source: a.source };
  }

  function renderAdhkar() {
    if (SS.currentView() !== "adhkar" || !akKind) return;
    var items = adhkarItems(akKind);
    var el = $("ak-item");
    var bar = "";
    for (var b = 0; b < items.length; b++) {
      var c = akCounts[items[b].id] || 0;
      bar += '<i class="' + (c >= items[b].count ? "done" : b === akIdx ? "cur" : "") + '"></i>';
    }
    $("ak-bar").innerHTML = bar;
    if (akIdx >= items.length) {
      $("ak-step").textContent = "✓";
      markAdhkarDone(akKind);
      el.innerHTML = '<div class="card center ak-done"><span class="s-ic big">' + icon("check") + "</span>" +
        "<h2>" + esc(t("adhkar.completeTitle")) + '</h2><p class="muted mt-1">' + esc(t("adhkar.completeBody")) + "</p>" +
        '<div class="row center-row wrap mt-2"><a class="btn" href="#/home">' + esc(t("nav.dashboard")) + '</a>' +
        '<button class="btn btn-outline" type="button" id="ak-restart">' + esc(t("adhkar.again")) + "</button></div></div>";
      $("ak-restart").onclick = function () { akIdx = 0; akCounts = {}; renderAdhkar(); };
      return;
    }
    var a = items[akIdx];
    $("ak-step").textContent = (akIdx + 1) + " / " + items.length;
    var count = akCounts[a.id] || 0;
    var body = "";
    var title = "", source = a.source || "";
    if (a.quran) {
      title = a.titleEn;
      var q = akQuran[a.id];
      if (!q) body = SS.ui.skeletons(1, 120);
      else {
        for (var i = 0; i < q.length; i++) {
          if (q[i].basmala) body += '<p class="ak-basmala" lang="ar">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>';
          body += '<p class="arabic" lang="ar">' + esc(q[i].ar) + "</p>";
        }
        var trs = q.map(function (x) { return x.tr; }).join(" ");
        body += '<p class="translation mt-1"' + SS.ui.trAttrs() + ">" + esc(trs) + "</p>";
      }
    } else {
      var it = itemText(a);
      title = it.title; source = it.source;
      body = '<p class="arabic-dua" lang="ar">' + esc(it.arabic) + "</p>" +
        (it.translit ? '<p class="transliteration">' + esc(it.translit) + "</p>" : "") +
        '<p class="translation mt-1">' + esc(it.tr) + "</p>";
    }
    var pct = Math.min(count / a.count, 1) * 100;
    el.innerHTML = '<article class="card ak-card">' +
      '<div class="row-between"><h2 class="h-sm">' + esc(title) + '</h2><span class="badge">' + esc(f("adhkar.times", { n: a.count })) + "</span></div>" +
      '<div class="ak-text mt-1">' + body + "</div>" +
      '<div class="card-foot"><span class="badge badge-src">' + esc(t("duas.source")) + ": " + esc(source) + "</span></div></article>" +
      '<div class="ak-controls">' +
      '<button class="icon-btn bordered" id="ak-prev" type="button" aria-label="' + esc(t("adhkar.prev")) + '"' + (akIdx === 0 ? " disabled" : "") + ">" + icon("chev-l", "flip") + "</button>" +
      '<button class="ak-count" id="ak-count" type="button" aria-label="' + esc(f("dhikr.ringLabel", { n: count, target: a.count })) + '">' +
      '<span class="ak-fill" style="inline-size:' + pct + '%"></span><span class="ak-num">' + count + " / " + a.count + "</span>" +
      '<span class="ak-tap">' + esc(t("adhkar.tap")) + "</span></button>" +
      '<button class="icon-btn bordered" id="ak-next" type="button" aria-label="' + esc(t("adhkar.next")) + '">' + icon("chev-r", "flip") + "</button></div>";
    $("ak-prev").onclick = function () { if (akIdx > 0) { akIdx--; renderAdhkar(); } };
    $("ak-next").onclick = function () { akIdx++; renderAdhkar(); };
    $("ak-count").onclick = function () {
      var n = (akCounts[a.id] || 0) + 1;
      akCounts[a.id] = n;
      SS.ui.vibrate(10);
      if (n >= a.count) {
        SS.ui.vibrate([20, 30, 20]);
        $("ak-count").classList.add("done");
        $("ak-count").querySelector(".ak-num").textContent = a.count + " / " + a.count;
        $("ak-count").querySelector(".ak-fill").style.inlineSize = "100%";
        setTimeout(function () { if (items[akIdx] === a) { akIdx++; renderAdhkar(); } }, 450);
      } else {
        $("ak-count").querySelector(".ak-num").textContent = n + " / " + a.count;
        $("ak-count").querySelector(".ak-fill").style.inlineSize = (n / a.count * 100) + "%";
        $("ak-count").setAttribute("aria-label", f("dhikr.ringLabel", { n: n, target: a.count }));
      }
    };
  }

  /* ═══════════ 99 NAMES ═══════════ */
  function namesInit() {
    var render = function (q) {
      q = (q || "").trim().toLowerCase();
      var html = "", n = 0;
      SS.NAMES.forEach(function (nm) {
        if (q && (nm.tr + " " + nm.en + " " + nm.ar + " " + nm.n).toLowerCase().indexOf(q) === -1) return;
        n++;
        html += '<article class="name-tile"><span class="nm-n">' + nm.n + '</span><span class="nm-ar" lang="ar">' + esc(nm.ar) +
          '</span><b class="nm-tr">' + esc(nm.tr) + '</b><span class="nm-en">' + esc(nm.en) + "</span></article>";
      });
      var grid = $("nm-grid");
      if (n) grid.innerHTML = html;
      else SS.ui.renderState(grid, { kind: "empty", icon: "search", text: f("quran.noResults", { q: q }) });
    };
    $("nm-search").oninput = function () { render(this.value); };
    render($("nm-search").value);
  }

  /* ═══════════ MOSQUE FINDER ═══════════ */
  var mqGen = 0;
  function mosquesInit() {
    fillRadius();
    $("mq-units").textContent = t(SS.units() === "mi" ? "units.switchToKm" : "units.switchToMi");
    $("mq-units").onclick = function () {
      SS.store.saveSettings({ units: SS.units() === "mi" ? "km" : "mi" });
      mosquesInit();
    };
    $("mq-radius").onchange = function () { SS.store.set("mosques:radius", +this.value); mosquesLoad(); };
    $("mq-loc").onclick = function () { SS.geo.request().then(function (l) { if (!l) SS.toast(t("loc.denied")); mosquesLoad(); }); };
    mosquesLoad();
  }
  function distKm(a, b, c, d) {
    var R = 6371, r = Math.PI / 180;
    var x = Math.sin((c - a) * r / 2), y = Math.sin((d - b) * r / 2);
    var h = x * x + Math.cos(a * r) * Math.cos(c * r) * y * y;
    return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }
  function fmtDist(km) { return SS.formatDistance(km); }
  /** Search-radius choices in the user's units (values are metres). */
  function fillRadius() {
    var mi = SS.units() === "mi";
    var opts = mi ? [[1609, 1], [4828, 3], [8047, 5], [24140, 15]] : [[2000, 2], [5000, 5], [10000, 10], [25000, 25]];
    var saved = +SS.store.get("mosques:radius") || (mi ? 4828 : 5000);
    var best = opts[0][0];
    opts.forEach(function (o) { if (Math.abs(o[0] - saved) < Math.abs(best - saved)) best = o[0]; });
    $("mq-radius").innerHTML = opts.map(function (o) {
      return '<option value="' + o[0] + '"' + (o[0] === best ? " selected" : "") + ">" + o[1] + "\u00a0" + esc(t(mi ? "units.mi" : "units.km")) + "</option>";
    }).join("");
  }
  function mapsLink(m) {
    var apple = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);
    return apple ? "https://maps.apple.com/?daddr=" + m.lat + "," + m.lng + "&q=" + encodeURIComponent(m.name || "Mosque")
      : "https://www.google.com/maps/dir/?api=1&destination=" + m.lat + "," + m.lng;
  }
  function mosquesLoad() {
    var gen = ++mqGen, list = $("mq-list");
    list.setAttribute("aria-busy", "true");
    list.innerHTML = SS.ui.skeletons(4, 76);
    $("mq-count").textContent = "";
    SS.geo.resolve().then(function (loc) {
      if (gen !== mqGen) return;
      $("mq-loc-label").textContent = SS.ui.locLabel(loc);
      var note = loc.isFallback ? t("mosques.needLocation") : loc.approx ? t("mosques.approx") : "";
      $("mq-note").textContent = note;
      $("mq-note").hidden = !note;
      if (loc.isFallback) {
        list.innerHTML = '<div class="state"><span class="s-ic">' + icon("pin") + "</span><p>" + esc(t("mosques.needLocation")) + '</p><button class="btn" type="button" id="mq-set">' + esc(t("dash.setLocationBtn")) + "</button></div>";
        list.removeAttribute("aria-busy");
        $("mq-set").onclick = $("mq-loc").onclick;
        return;
      }
      var radius = +$("mq-radius").value || 5000;
      SS.api.mosques(loc.lat, loc.lng, radius).then(function (items) {
        if (gen !== mqGen) return;
        items.forEach(function (m) { m.km = distKm(loc.lat, loc.lng, m.lat, m.lng); });
        items.sort(function (a, b) { return a.km - b.km; });
        list.removeAttribute("aria-busy");
        if (!items.length) {
          SS.ui.renderState(list, { kind: "empty", icon: "mosque", text: f("mosques.noneWithin", { r: SS.formatDistance(radius / 1000, true) }) });
          return;
        }
        $("mq-count").textContent = f("mosques.count", { n: items.length });
        var html = "";
        items.forEach(function (m) {
          var name = (isAr() && m.nameAr) || m.name || t("mosques.unnamed");
          var addr = [m.street, m.city].filter(Boolean).join(", ");
          html += '<article class="card mq-card"><span class="w-ic">' + icon("mosque") + "</span>" +
            '<div class="w-body"><b class="w-title">' + esc(name) + "</b>" +
            '<span class="w-sub">' + esc([fmtDist(m.km), addr].filter(Boolean).join(" · ")) + "</span></div>" +
            '<a class="btn btn-outline btn-sm" href="' + esc(mapsLink(m)) + '" target="_blank" rel="noopener">' + esc(t("mosques.directions")) + "</a></article>";
        });
        list.innerHTML = html;
      }).catch(function () {
        if (gen !== mqGen) return;
        SS.ui.renderState(list, { kind: "error", retry: mosquesLoad });
      });
    });
  }

  /* ═══════════ LEARN ARABIC ═══════════ */
  var lnTab = "letters", quiz = null, arVoice = null;
  function findVoice() {
    if (!("speechSynthesis" in window)) return null;
    var vs = speechSynthesis.getVoices() || [];
    for (var i = 0; i < vs.length; i++) if (/^ar/i.test(vs[i].lang)) return vs[i];
    return null;
  }
  function speak(text) {
    arVoice = arVoice || findVoice();
    if (!arVoice) return false;
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.voice = arVoice; u.lang = arVoice.lang; u.rate = 0.8;
      speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  }
  if ("speechSynthesis" in window) {
    try { speechSynthesis.onvoiceschanged = function () { arVoice = findVoice(); }; } catch (e) { /* noop */ }
  }
  function forms(L) {
    var T = "ـ";
    return L.joins
      ? [L.ch, L.ch + T, T + L.ch + T, T + L.ch]
      : [L.ch, L.ch, T + L.ch, T + L.ch];
  }

  function learnInit() {
    var tabs = ["letters", "vowels", "quiz"];
    tabs.forEach(function (k) {
      var b = $("ln-tab-" + k);
      b.onclick = function () { learnTab(k); };
      b.onkeydown = function (e) {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        var d = (e.key === "ArrowRight") !== (document.dir === "rtl") ? 1 : -1;
        var nx = tabs[(tabs.indexOf(k) + d + tabs.length) % tabs.length];
        $("ln-tab-" + nx).focus(); learnTab(nx);
      };
    });
    learnTab(lnTab);
  }
  function learnTab(k) {
    lnTab = k;
    ["letters", "vowels", "quiz"].forEach(function (x) {
      $("ln-tab-" + x).setAttribute("aria-selected", String(x === k));
      $("ln-tab-" + x).tabIndex = x === k ? 0 : -1;
      $("ln-" + x).hidden = x !== k;
    });
    if (k === "letters") renderLetters();
    if (k === "vowels") renderVowels();
    if (k === "quiz") startQuiz();
  }
  function renderLetters() {
    var html = "";
    SS.LETTERS.forEach(function (L, i) {
      html += '<button class="letter-tile" type="button" data-i="' + i + '"><span class="lt-ch" lang="ar">' + L.ch + '</span><span class="lt-name">' + esc(isAr() ? L.nameAr : L.name) + "</span></button>";
    });
    $("ln-grid").innerHTML = html;
    $("ln-grid").onclick = function (e) {
      var b = e.target.closest("[data-i]");
      if (b) showLetter(+b.getAttribute("data-i"));
    };
  }
  function showLetter(i) {
    var L = SS.LETTERS[i], fm = forms(L);
    var labels = [t("learn.isolated"), t("learn.initial"), t("learn.medial"), t("learn.final")];
    $("letter-h").innerHTML = '<span lang="ar" class="lt-head">' + L.ch + "</span> " + esc(L.name) + ' <span class="muted" lang="ar">' + esc(L.nameAr) + "</span>";
    var html = '<p class="muted">' + esc(L.hint) + "</p>";
    html += '<div class="forms mt-2">';
    for (var k = 0; k < 4; k++) html += '<div><span class="fm" lang="ar">' + fm[k] + '</span><span class="tiny">' + esc(labels[k]) + "</span></div>";
    html += "</div>";
    if (!L.joins) html += '<p class="note mt-2">' + esc(t("learn.nonJoining")) + "</p>";
    html += '<div class="row wrap mt-2">';
    if (findVoice()) html += '<button class="btn btn-outline btn-sm" type="button" id="lt-say">' + icon("play") + "<span>" + esc(t("learn.listen")) + "</span></button>";
    html += '<span class="spacer"></span>' +
      '<button class="icon-btn bordered" type="button" id="lt-prev" aria-label="' + esc(t("adhkar.prev")) + '"' + (i === 0 ? " disabled" : "") + ">" + icon("chev-l", "flip") + "</button>" +
      '<button class="icon-btn bordered" type="button" id="lt-next" aria-label="' + esc(t("adhkar.next")) + '"' + (i === SS.LETTERS.length - 1 ? " disabled" : "") + ">" + icon("chev-r", "flip") + "</button></div>";
    $("letter-body").innerHTML = html;
    if ($("lt-say")) $("lt-say").onclick = function () { speak(L.nameAr); };
    $("lt-prev").onclick = function () { if (i > 0) showLetter(i - 1); };
    $("lt-next").onclick = function () { if (i < SS.LETTERS.length - 1) showLetter(i + 1); };
    var dlg = $("letter-dialog");
    if (!dlg.open && dlg.showModal) SS.openDialog(dlg);
  }
  function renderVowels() {
    var html = "";
    SS.HARAKAT.forEach(function (h) {
      html += '<div class="card vowel"><span class="v-mark" lang="ar">' + h.mark + "</span>" +
        '<div class="w-body"><b>' + esc(isAr() ? h.ar : h.name) + ' <span class="badge">' + esc(h.sound) + "</span></b>" +
        '<span class="w-sub wrap-text">' + esc(h.hint) + "</span></div></div>";
    });
    $("ln-vowel-list").innerHTML = html;
  }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; }
    return a;
  }
  function startQuiz() {
    var order = shuffle(SS.LETTERS.map(function (_, i) { return i; })).slice(0, 10);
    quiz = { order: order, i: 0, score: 0, answered: false };
    renderQuiz();
  }
  function renderQuiz() {
    var el = $("ln-quiz");
    if (quiz.i >= quiz.order.length) {
      var best = Math.max(SS.store.get("learn:best", 0), quiz.score);
      SS.store.set("learn:best", best);
      el.innerHTML = '<div class="card center"><h2>' + esc(f("learn.score", { n: quiz.score, total: quiz.order.length })) + "</h2>" +
        '<p class="muted mt-1">' + esc(f("learn.best", { n: best })) + "</p>" +
        '<button class="btn mt-2" type="button" id="qz-again">' + esc(t("adhkar.again")) + "</button></div>";
      $("qz-again").onclick = startQuiz;
      return;
    }
    var L = SS.LETTERS[quiz.order[quiz.i]];
    var opts = [L];
    var pool = shuffle(SS.LETTERS.filter(function (x) { return x !== L && x.name !== L.name; }));
    for (var k = 0; opts.length < 4 && k < pool.length; k++) if (opts.indexOf(pool[k]) === -1) opts.push(pool[k]);
    opts = shuffle(opts);
    var html = '<div class="card quiz-card"><div class="row-between"><span class="tiny">' + esc(f("learn.question", { n: quiz.i + 1, total: quiz.order.length })) + '</span><span class="badge">' + quiz.score + "</span></div>" +
      '<p class="qz-ch" lang="ar">' + L.ch + '</p><p class="center muted">' + esc(t("learn.whichLetter")) + '</p><div class="qz-opts mt-2">';
    opts.forEach(function (o) {
      html += '<button class="btn btn-outline" type="button" data-ok="' + (o === L) + '">' + esc(o.name) + ' <span lang="ar" class="muted">' + esc(o.nameAr) + "</span></button>";
    });
    html += '</div><p class="note center mt-1" id="qz-fb" aria-live="polite"></p></div>';
    el.innerHTML = html;
    quiz.answered = false;
    el.querySelector(".qz-opts").onclick = function (e) {
      var b = e.target.closest("button");
      if (!b || quiz.answered) return;
      quiz.answered = true;
      var ok = b.getAttribute("data-ok") === "true";
      if (ok) quiz.score++;
      b.classList.add(ok ? "right" : "wrong");
      if (!ok) el.querySelector('[data-ok="true"]').classList.add("right");
      $("qz-fb").textContent = ok ? t("learn.correct") : f("learn.wrong", { name: L.name });
      SS.ui.vibrate(ok ? 15 : [30, 40, 30]);
      setTimeout(function () { quiz.i++; if (SS.currentView() === "learn" && lnTab === "quiz") renderQuiz(); }, ok ? 700 : 1400);
    };
  }

  /* ═══════════ QUR'AN READING PLANS ═══════════ */
  var PLAN_DAYS = [30, 60, 120, 365];
  function plan() { return SS.store.get("quran:plan", null); }
  function fromGlobal(g) {
    for (var s = SS.OFFSETS.length - 1; s >= 0; s--) if (g > SS.OFFSETS[s]) return [s + 1, g - SS.OFFSETS[s]];
    return [1, 1];
  }
  function planRange(p, dayIdx) {
    var T = SS.TOTAL_AYAHS;
    if (p.days === 30) { // one juz a day — the traditional division
      var j = SS.JUZ[dayIdx], nx = SS.JUZ[dayIdx + 1];
      var ga = SS.globalAyahNumber(j[0], j[1]), gb = nx ? SS.globalAyahNumber(nx[0], nx[1]) - 1 : T;
      return { from: fromGlobal(ga), to: fromGlobal(gb), a: ga, b: gb };
    }
    var a = Math.floor(dayIdx * T / p.days) + 1, b = Math.floor((dayIdx + 1) * T / p.days);
    return { from: fromGlobal(a), to: fromGlobal(b), a: a, b: b };
  }
  function refLabel(r) { var s = SS.SURAHS[r[0] - 1]; return SS.ui.surahName(s) + " " + r[0] + ":" + r[1]; }
  function daysSince(dateStr) {
    var p = dateStr.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2]);
    var now = new Date(); now.setHours(0, 0, 0, 0);
    return Math.round((now - d) / DAY);
  }
  function planHtml(compact) {
    var p = plan();
    if (!p) {
      var chips = PLAN_DAYS.map(function (d) { return '<button class="chip" type="button" data-plan="' + d + '">' + esc(f("plan.days", { n: d })) + "</button>"; }).join("");
      return '<div class="row-between"><h2 class="h-sm">' + icon("target") + " " + esc(t("plan.title")) + "</h2></div>" +
        '<p class="tiny mt-1">' + esc(t("plan.pitch")) + '</p><div class="row wrap mt-1">' + chips + "</div>";
    }
    if (p.done >= p.days) {
      return '<div class="row-between"><h2 class="h-sm">' + esc(t("plan.completeTitle")) + "</h2></div>" +
        '<p class="muted mt-1">' + esc(t("plan.completeBody")) + '</p><div class="row wrap mt-1"><button class="btn btn-sm" type="button" data-plan-restart>' + esc(t("plan.again")) + "</button></div>";
    }
    var r = planRange(p, p.done);
    var pct = Math.round(p.done / p.days * 100);
    var expected = Math.min(p.days, daysSince(p.start) + 1);
    var behind = expected - (p.done + 1);
    return '<div class="row-between"><h2 class="h-sm">' + icon("target") + " " + esc(f("plan.dayOf", { n: p.done + 1, total: p.days })) + '</h2><span class="badge">' + pct + "%</span></div>" +
      '<div class="progress mt-1" aria-hidden="true"><span style="inline-size:' + pct + '%"></span></div>' +
      '<p class="mt-1"><span class="tiny">' + esc(t("plan.today")) + "</span><br><b>" + esc(refLabel(r.from)) + " → " + esc(refLabel(r.to)) + "</b></p>" +
      (behind > 0 && !compact ? '<p class="tiny">' + esc(f("plan.behind", { n: behind })) + "</p>" : "") +
      '<div class="row wrap mt-1"><a class="btn btn-sm" href="#/surah/' + r.from[0] + "/" + r.from[1] + '">' + esc(t("plan.read")) + "</a>" +
      '<button class="btn btn-outline btn-sm" type="button" data-plan-done>' + icon("check") + "<span>" + esc(t("plan.markDone")) + "</span></button>" +
      (compact ? "" : '<span class="spacer"></span><button class="btn btn-ghost btn-sm" type="button" data-plan-end>' + esc(t("plan.end")) + "</button>") + "</div>";
  }
  function wirePlan(el, rerender) {
    el.onclick = function (e) {
      var b = e.target.closest("[data-plan]");
      if (b) {
        SS.store.set("quran:plan", { days: +b.getAttribute("data-plan"), start: SS.localDate(), done: 0 });
        SS.toast(t("plan.started"));
        return rerender();
      }
      if (e.target.closest("[data-plan-done]")) {
        var p = plan(); p.done = Math.min(p.days, p.done + 1); SS.store.set("quran:plan", p);
        SS.toast(p.done >= p.days ? t("plan.completeTitle") : t("plan.doneToast"));
        SS.ui.vibrate(20);
        return rerender();
      }
      if (e.target.closest("[data-plan-end]")) {
        if (confirm(t("plan.endConfirm"))) { SS.store.remove("quran:plan"); rerender(); }
        return;
      }
      if (e.target.closest("[data-plan-restart]")) { SS.store.remove("quran:plan"); rerender(); }
    };
  }
  function renderPlanCard() { var el = $("qi-plan"); el.innerHTML = planHtml(false); wirePlan(el, renderPlanCard); }
  function planWidget() {
    var el = $("plan-widget"), p = plan();
    el.hidden = !p;
    if (!p) return;
    el.innerHTML = planHtml(true);
    wirePlan(el, planWidget);
  }
  onHook("quranInit", function () { renderPlanCard(); });
  onHook("surahRendered", function (n) {
    var el = $("sr-plan"), p = plan();
    el.hidden = true;
    if (!p || p.done >= p.days) return;
    var r = planRange(p, p.done);
    if (r.from[0] > n || r.to[0] < n) return;
    el.hidden = false;
    el.className = "banner plan-banner";
    el.innerHTML = icon("target") + "<p>" + esc(f("plan.inReader", { from: refLabel(r.from), to: refLabel(r.to) })) + "</p>" +
      '<button class="btn btn-sm" type="button" data-plan-done>' + esc(t("plan.markDone")) + "</button>";
    wirePlan(el, function () { el.hidden = true; });
  });

  /* ═══════════ QUR'AN TRANSLATION SEARCH ═══════════ */
  var searchGen = 0;
  SS.quranSearch = function (q) {
    if (!q || q.length < 3) return;
    var el = $("qi-results"), gen = ++searchGen;
    el.hidden = false;
    el.setAttribute("aria-busy", "true");
    el.innerHTML = SS.ui.skeletons(3, 90);
    SS.api.searchQuran(q).then(function (matches) {
      if (gen !== searchGen) return;
      el.removeAttribute("aria-busy");
      if (!matches.length) { SS.ui.renderState(el, { kind: "empty", icon: "search", text: f("quran.searchNone", { q: q }) }); return; }
      var re;
      try { re = new RegExp("(" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi"); } catch (e) { re = null; }
      var html = '<p class="tiny">' + esc(f("quran.searchCount", { n: matches.length, q: q })) + "</p>";
      matches.slice(0, 60).forEach(function (m) {
        var text = esc(m.text);
        if (re) text = text.replace(re, "<mark>$1</mark>");
        var s = SS.SURAHS[m.surah.number - 1];
        html += '<a class="card result" href="#/surah/' + m.surah.number + "/" + m.numberInSurah + '">' +
          '<span class="badge">' + esc(SS.ui.surahName(s)) + " " + m.surah.number + ":" + m.numberInSurah + "</span>" +
          '<p class="translation mt-1"' + SS.ui.trAttrs() + ">" + text + "</p></a>";
      });
      if (matches.length > 60) html += '<p class="tiny">' + esc(f("quran.searchMore", { n: matches.length - 60 })) + "</p>";
      el.innerHTML = html;
    }).catch(function () {
      if (gen !== searchGen) return;
      SS.ui.renderState(el, { kind: "error", retry: function () { SS.quranSearch(q); } });
    });
  };

  /* ═══════════ SHARE AS IMAGE ═══════════ */
  var STYLES = {
    emerald: { bg: ["#0b6b50", "#064e3b", "#022c22"], text: "#ffffff", sub: "#d1fae5", accent: "#e3c25a", dot: "rgba(255,255,255,0.09)" },
    night: { bg: ["#1b2430", "#0f151c", "#070a0d"], text: "#f2efe6", sub: "#c9c3b4", accent: "#d9b542", dot: "rgba(255,255,255,0.06)" },
    light: { bg: ["#fbf8ef", "#f3efe2", "#ebe5d2"], text: "#0b1210", sub: "#3d4a43", accent: "#9a7614", dot: "rgba(6,78,59,0.08)" },
  };
  var shareData = null, shareStyle = "emerald";
  var shareLogo = new Image();
  shareLogo.src = "icons/brand/logo-mark-256.png";

  function wrapLines(ctx, text, maxW) {
    var words = String(text).split(/\s+/), lines = [], line = "";
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + " " + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = words[i]; }
      else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }
  function fitBlock(ctx, text, family, weight, maxSize, minSize, maxW, maxH, lh) {
    for (var size = maxSize; size >= minSize; size -= 2) {
      ctx.font = weight + " " + size + "px " + family;
      var lines = wrapLines(ctx, text, maxW);
      if (lines.length * size * lh <= maxH) return { size: size, lines: lines };
    }
    ctx.font = weight + " " + minSize + "px " + family;
    var all = wrapLines(ctx, text, maxW), max = Math.max(1, Math.floor(maxH / (minSize * lh)));
    if (all.length > max) { all = all.slice(0, max); all[max - 1] = all[max - 1].replace(/\s*\S*$/, "") + " …"; }
    return { size: minSize, lines: all };
  }

  function drawShare() {
    var c = $("share-canvas"), ctx = c.getContext("2d"), W = c.width, H = c.height, st = STYLES[shareStyle], d = shareData;
    var g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, st.bg[0]); g.addColorStop(0.55, st.bg[1]); g.addColorStop(1, st.bg[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = st.dot;
    for (var x = 18; x < W; x += 36) for (var y = 18; y < H; y += 36) { ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill(); }
    // Frame
    ctx.strokeStyle = st.accent; ctx.globalAlpha = 0.5; ctx.lineWidth = 3;
    ctx.strokeRect(48, 48, W - 96, H - 96); ctx.globalAlpha = 1;
    // Brand mark: the official SalaamStreet logo, with a rounded crop.
    // (Skipped when opened from disk: a file:// image would block exporting the canvas.)
    if (location.protocol !== "file:" && shareLogo.complete && shareLogo.naturalWidth) {
      var L = 96, lx = W / 2 - L / 2, ly = 102, rr = 22;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(lx + rr, ly); ctx.arcTo(lx + L, ly, lx + L, ly + L, rr); ctx.arcTo(lx + L, ly + L, lx, ly + L, rr);
      ctx.arcTo(lx, ly + L, lx, ly, rr); ctx.arcTo(lx, ly, lx + L, ly, rr); ctx.closePath(); ctx.clip();
      ctx.drawImage(shareLogo, lx, ly, L, L);
      ctx.restore();
    }
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    var top = 250, maxW = W - 220;
    var arH = d.text ? 470 : 760;
    if (d.arabic) {
      ctx.direction = "rtl";
      var ar = fitBlock(ctx, d.arabic, '"Scheherazade New","Amiri",serif', "400", 76, 38, maxW, arH, 1.75);
      ctx.fillStyle = st.text;
      var yy = top + ar.size;
      ar.lines.forEach(function (l) { ctx.fillText(l, W / 2, yy); yy += ar.size * 1.75; });
      top = yy - ar.size * 0.75 + 30;
      ctx.direction = "ltr";
    }
    if (d.arabic && d.text) {
      ctx.strokeStyle = st.accent; ctx.lineWidth = 3; ctx.beginPath();
      ctx.moveTo(W / 2 - 80, top); ctx.lineTo(W / 2 + 80, top); ctx.stroke();
      top += 50;
    }
    if (d.text) {
      ctx.direction = d.dir === "rtl" ? "rtl" : "ltr";
      var tr = fitBlock(ctx, d.text, '"Figtree","Noto Sans","Segoe UI",sans-serif', "500", 42, 24, maxW, H - top - 230, 1.45);
      ctx.fillStyle = st.sub;
      var ty = top + tr.size;
      tr.lines.forEach(function (l) { ctx.fillText(l, W / 2, ty); ty += tr.size * 1.45; });
      ctx.direction = "ltr";
    }
    if (d.ref) {
      ctx.font = '700 32px "Figtree","Segoe UI",sans-serif'; ctx.fillStyle = st.accent;
      var refLines = wrapLines(ctx, d.ref, maxW).slice(0, 2), ry = H - 190 - (refLines.length - 1) * 40;
      refLines.forEach(function (l) { ctx.fillText(l, W / 2, ry); ry += 40; });
    }
    ctx.font = '800 30px "Figtree","Segoe UI",sans-serif'; ctx.fillStyle = st.text; ctx.globalAlpha = 0.85;
    ctx.fillText("SalaamStreet.com", W / 2, H - 92); ctx.globalAlpha = 1;
  }

  function canvasBlob() {
    return new Promise(function (resolve) { $("share-canvas").toBlob(function (b) { resolve(b); }, "image/png"); });
  }
  function download(blob) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "salaamstreet-" + Date.now() + ".png";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  SS.share = {
    open: function (d) {
      shareData = d;
      var dlg = $("share-dialog");
      var stHtml = "";
      ["emerald", "night", "light"].forEach(function (k) {
        stHtml += '<button class="chip" role="radio" type="button" data-style="' + k + '" aria-checked="' + (k === shareStyle) + '">' + esc(t("share." + k)) + "</button>";
      });
      $("share-styles").innerHTML = stHtml;
      $("share-styles").onclick = function (e) {
        var b = e.target.closest("[data-style]");
        if (!b) return;
        shareStyle = b.getAttribute("data-style");
        var all = this.querySelectorAll("[data-style]");
        for (var i = 0; i < all.length; i++) all[i].setAttribute("aria-checked", String(all[i] === b));
        drawShare();
      };
      var fontsReady = document.fonts && document.fonts.load
        ? Promise.all([document.fonts.load('76px "Scheherazade New"'), document.fonts.load('500 42px "Figtree"')]).catch(function () {})
        : Promise.resolve();
      drawShare();
      fontsReady.then(drawShare);
      if (!shareLogo.complete) shareLogo.onload = function () { if ($("share-dialog").open) drawShare(); };
      $("share-go").hidden = !(navigator.share && navigator.canShare);
      $("share-go").onclick = function () {
        canvasBlob().then(function (blob) {
          var file = new File([blob], "salaamstreet.png", { type: "image/png" });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({ files: [file], text: (d.ref || "") + " — salaamstreet.com" }).catch(function () { /* cancelled */ });
          } else download(blob);
        });
      };
      $("share-dl").onclick = function () { canvasBlob().then(download); };
      if (!dlg.open && dlg.showModal) SS.openDialog(dlg);
    },
  };

  /* ═══════════ ABOUT, UPDATES & INSTALL ═══════════ */
  var deferredInstall = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    // Chrome/Edge/Android: keep the prompt so our own "Install app" button can show it.
    e.preventDefault();
    deferredInstall = e;
    renderInstall();
  });
  window.addEventListener("appinstalled", function () { deferredInstall = null; renderInstall(); });

  function isSafariIOS() {
    var ua = navigator.userAgent;
    return isIOS() && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  }
  function renderInstall() {
    var slots = document.querySelectorAll("[data-install]");
    if (!slots.length) return;
    var html;
    if (isStandalone()) {
      html = '<div class="card install done"><span class="w-ic">' + icon("check") + '</span><p class="muted">' + esc(t("install.done")) + "</p></div>";
    } else {
      var how;
      if (deferredInstall) how = '<button class="btn" type="button" data-install-btn>' + icon("download") + "<span>" + esc(t("install.btn")) + "</span></button>";
      else if (isIOS()) {
        how = '<ol class="install-steps"><li>' + icon("share") + "<span>" + esc(t("install.ios")) + "</span></li></ol>";
      } else how = '<p class="note">' + esc(t("install.other")) + "</p>";
      html = '<div class="card install"><img src="icons/brand/logo-mark-128.png" alt="" width="56" height="56" />' +
        '<div class="w-body"><b class="w-title">' + esc(t("install.title")) + '</b><span class="w-sub wrap-text">' + esc(t("install.sub")) + "</span>" +
        '<div class="mt-1">' + how + "</div></div></div>";
    }
    for (var i = 0; i < slots.length; i++) slots[i].innerHTML = html;
    var btns = document.querySelectorAll("[data-install-btn]");
    for (var j = 0; j < btns.length; j++) {
      btns[j].onclick = function () {
        if (!deferredInstall) return;
        deferredInstall.prompt();
        Promise.resolve(deferredInstall.userChoice).then(function () { deferredInstall = null; renderInstall(); });
      };
    }
  }
  void isSafariIOS;

  var abTab = "story";
  function aboutInit(params) {
    if (params && params[0] === "updates") abTab = "updates";
    else if (params && params[0] === "story") abTab = "story";
    $("ab-version").textContent = f("about.version", { v: SS.VERSION });
    ["story", "updates"].forEach(function (k) {
      var b = $("ab-tab-" + k);
      b.onclick = function () { aboutTab(k); };
      b.onkeydown = function (e) {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") { var o = k === "story" ? "updates" : "story"; $("ab-tab-" + o).focus(); aboutTab(o); }
      };
    });
    aboutTab(abTab);
    renderInstall();
    SS.store.set("seenVersion", SS.VERSION);
  }
  function aboutTab(k) {
    abTab = k;
    ["story", "updates"].forEach(function (x) {
      $("ab-tab-" + x).setAttribute("aria-selected", String(x === k));
      $("ab-tab-" + x).tabIndex = x === k ? 0 : -1;
      $("ab-" + x).hidden = x !== k;
    });
    if (k === "updates") renderUpdates();
  }
  function fmtReleaseDate(d) {
    if (!d) return "";
    try { var p = d.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString(SS.i18n.dateLocale(), { day: "numeric", month: "long", year: "numeric" }); }
    catch (e) { return d; }
  }
  function renderUpdates() {
    var ar = isAr();
    var latest = SS.CHANGELOG[0];
    // "You're up to date" summary for the version this device is running.
    $("ab-uptodate").innerHTML =
      '<img src="icons/brand/logo-mark-128.png" alt="" width="52" height="52" />' +
      '<div class="w-body"><span class="up-kicker">' + icon("check") + "<span>" + esc(t("updates.upToDate")) + "</span></span>" +
      '<b class="up-title">' + esc(f("settings.version", { v: SS.VERSION })) + "</b>" +
      '<span class="w-sub wrap-text">' + esc(ar ? latest.ar : latest.en) + (latest.date ? " · " + esc(fmtReleaseDate(latest.date)) : "") + "</span></div>";
    // Roadmap: planned versions, in order. Never shows dates.
    var html = "";
    SS.ROADMAP.forEach(function (r, i) {
      var milestone = /^3\./.test(r.v);
      html += '<li class="road-item' + (i === 0 ? " next" : "") + (milestone ? " milestone" : "") + '">' +
        '<span class="road-node" aria-hidden="true">' + icon(r.icon) + "</span>" +
        '<div class="card road-card"><div class="road-top">' +
        '<span class="ver-pill' + (milestone ? " gold" : "") + '" dir="ltr">' + esc(r.v) + "</span>" +
        '<span class="status-pill' + (i === 0 ? " next" : "") + '">' + esc(t(i === 0 ? "updates.upNext" : "updates.planned")) + "</span></div>" +
        '<b class="road-title">' + esc(ar ? r.ar : r.en) + "</b>" +
        '<p class="road-desc">' + esc(ar ? r.dar : r.den) + "</p></div></li>";
    });
    $("ab-roadmap").innerHTML = html;
    // Released history — rendered exactly as recorded, newest first.
    var hist = "";
    SS.CHANGELOG.forEach(function (c, i) {
      var date = fmtReleaseDate(c.date);
      hist += '<li class="tl-item' + (i === 0 ? " current" : "") + '"><span class="tl-dot" aria-hidden="true"></span><article class="card tl-card">' +
        '<div class="tl-top"><span class="ver-pill' + (i === 0 ? " solid" : "") + '" dir="ltr">' + esc(c.v) + "</span>" +
        (i === 0 ? '<span class="status-pill next">' + esc(t("updates.current")) + "</span>" : "") +
        (date ? '<time class="tiny" datetime="' + esc(c.date) + '">' + esc(date) + "</time>" : "") + "</div>" +
        '<h3 class="tl-title">' + esc(ar ? c.ar : c.en) + "</h3>" +
        (c.den ? '<p class="tl-desc">' + esc(ar ? c.dar : c.den) + "</p>" : "") +
        (c.groups
          ? c.groups.map(function (g) {
            return '<h4 class="tl-group">' + esc(ar ? g.ar : g.en) + '</h4><ul class="tl-list">' +
              g.items.map(function (it) { return "<li>" + icon("check") + "<span>" + esc(ar ? it.ar : it.en) + "</span></li>"; }).join("") + "</ul>";
          }).join("")
          : '<ul class="tl-list">' + c.items.map(function (it) { return "<li>" + icon("check") + "<span>" + esc(ar ? it.ar : it.en) + "</span></li>"; }).join("") + "</ul>") +
        "</article></li>";
    });
    $("ab-history").innerHTML = hist;
    $("ab-history-count").textContent = f("updates.releases", { n: SS.CHANGELOG.length });
    // In-tab jump links move focus to the section heading (and keep the URL clean).
    var jumps = document.querySelectorAll("#ab-updates [data-jump]");
    for (var j = 0; j < jumps.length; j++) {
      jumps[j].onclick = function (e) {
        e.preventDefault();
        var h = $(this.getAttribute("data-jump"));
        var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
        h.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
        try { h.focus({ preventScroll: true }); } catch (x) { /* noop */ }
      };
    }
  }

  onHook("settingsInit", function () {
    var st = SS.store.settings();
    $("st-version").textContent = f("settings.version", { v: SS.VERSION });
    $("st-timefmt").value = st.timeFormat || "auto";
    $("st-units").value = st.units || "auto";
    $("st-continuous").checked = !!st.continuousPlay;
    $("st-timefmt").onchange = function () { SS.store.saveSettings({ timeFormat: this.value }); SS.toast(t("settings.saved")); };
    $("st-units").onchange = function () { SS.store.saveSettings({ units: this.value }); SS.toast(t("settings.saved")); };
    $("st-continuous").onchange = function () { SS.store.saveSettings({ continuousPlay: this.checked }); };
    renderInstall();
  });

  /** On start: a one-time note when a returning visitor gets a new version. */
  SS.aboutBoot = function () {
    var seen = SS.store.get("seenVersion");
    if (!seen) { SS.store.set("seenVersion", SS.VERSION); return; } // first visit: nothing to announce
    if (seen !== SS.VERSION) {
      SS.store.set("seenVersion", SS.VERSION);
      setTimeout(function () { SS.toast(f("updates.newVersion", { v: SS.VERSION })); }, 1200);
    }
  };

  /* ═══════════ Register views ═══════════ */
  SS.views.adhkar = adhkarInit;
  SS.views.names = namesInit;
  SS.views.mosques = mosquesInit;
  SS.views.learn = learnInit;
  SS.views.about = aboutInit;
})();
