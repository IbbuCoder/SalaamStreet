/* SalaamStreet — daily.js (classic script)
   2.8 "The SalaamStreet App": everyday helpers, most useful when SalaamStreet
   is installed on a phone, tablet or computer.
   · "Did you pray?" check-in on the Home hero (and #/home/prayed/<Prayer>)
   · daily Qur'an goal, counted while reading, with an optional reminder
   · morning & evening adhkar reminders
   · keep the screen on while reading, following adhkar or counting dhikr
   · app icon badge with today's prayers not yet ticked
   · Friday summary of the week
   · audio sleep timer
   · "new version ready" prompt
   Everything stays on the device; reminders here fire while the app is open
   (js/push.js adds reminders that arrive when it's closed). */
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
  function settings() { return SS.store.settings(); }
  function onHook(name, fn) {
    SS.hooks = SS.hooks || {};
    var prev = SS.hooks[name];
    SS.hooks[name] = function () {
      if (prev) prev.apply(null, arguments);
      fn.apply(null, arguments);
    };
  }
  function fire(name) { var h = SS.hooks && SS.hooks[name]; if (h) h(); }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function today() { return SS.localDate(); }

  /* ═══════════ "Did you pray?" ═══════════ */
  var lastTimes = null, checkinTimer = null;

  /** The prayer whose time it is now (and the date it belongs to), or null
      between sunrise and Dhuhr. Before Fajr it is still last night's Isha. */
  function currentPrayer(timings, now) {
    now = now || new Date();
    var p = SS.ui.parseTime;
    if (now < p(timings.Fajr)) return { key: "Isha", date: SS.localDate(addDays(now, -1)) };
    if (now >= p(timings.Isha)) return { key: "Isha", date: SS.localDate(now) };
    if (now >= p(timings.Maghrib)) return { key: "Maghrib", date: SS.localDate(now) };
    if (now >= p(timings.Asr)) return { key: "Asr", date: SS.localDate(now) };
    if (now >= p(timings.Dhuhr)) return { key: "Dhuhr", date: SS.localDate(now) };
    if (now < p(timings.Sunrise)) return { key: "Fajr", date: SS.localDate(now) };
    return null;
  }
  SS.currentPrayer = currentPrayer;

  function markPrayed(key, date) {
    if (!SS.tracker || FIVE.indexOf(key) < 0) return false;
    date = date || today();
    if (SS.tracker.isDone(date, key)) return false;
    SS.tracker.toggle(date, key);
    fire("trackerChanged");
    updateBadge();
    return true;
  }

  function renderCheckin() {
    var el = $("np-track");
    if (!el || !lastTimes || !SS.tracker) return;
    var cur = currentPrayer(lastTimes);
    var n = SS.tracker.count(today());
    var count = "<span>" + esc(f("track.countOf", { n: n })) + "</span>";
    el.hidden = false;
    if (cur && !SS.tracker.isDone(cur.date, cur.key)) {
      el.classList.add("has-checkin");
      el.innerHTML = '<span class="ci-q">' + esc(f("daily.didYouPray", { p: t("prayer." + cur.key) })) + "</span>" +
        '<button class="chip chip-on-dark ci-btn" type="button" id="np-checkin" data-key="' + cur.key + '" data-date="' + cur.date + '">' +
        icon("check") + "<span>" + esc(t("daily.iPrayed")) + "</span></button>";
      $("np-checkin").onclick = function () {
        markPrayed(this.getAttribute("data-key"), this.getAttribute("data-date"));
        SS.toast(f("daily.marked", { p: t("prayer." + this.getAttribute("data-key")) }));
        if (SS.ui.vibrate) SS.ui.vibrate(15);
        refreshStrip();
        renderCheckin();
      };
    } else {
      el.classList.remove("has-checkin");
      el.innerHTML = icon("check") + count;
    }
  }
  function refreshStrip() {
    var log = (SS.tracker.log()[today()]) || {};
    var slots = document.querySelectorAll("#np-strip .slot");
    for (var i = 0; i < slots.length; i++) slots[i].classList.toggle("prayed", !!log[slots[i].getAttribute("data-key")]);
    var tw = $("track-sub");
    if (tw) tw.textContent = f("track.countOf", { n: SS.tracker.count(today()) });
  }

  onHook("homeTimes", function (r) {
    lastTimes = r.timings;
    renderCheckin();
    clearInterval(checkinTimer);
    checkinTimer = setInterval(function () { if (SS.currentView() === "home") renderCheckin(); else clearInterval(checkinTimer); }, 60000);
    updateBadge(r.timings);
  });

  /** #/home/prayed/Asr[/2026-10-05] — from a reminder's "I prayed" button. */
  function handlePrayedLink() {
    var m = (location.hash || "").match(/^#\/home\/prayed\/(Fajr|Dhuhr|Asr|Maghrib|Isha)(?:\/(\d{4}-\d{2}-\d{2}))?$/);
    if (!m) return;
    if (markPrayed(m[1], m[2])) SS.toast(f("daily.marked", { p: t("prayer." + m[1]) }));
    if (history.replaceState) history.replaceState(null, "", "#/home");
  }
  onHook("homeInit", handlePrayedLink);

  /* ═══════════ Daily Qur'an goal ═══════════ */
  var GOALS = [0, 5, 10, 20, 50, 100];
  /** Ayahs reached today, keyed "surah:ayah" so re-reading doesn't count twice. */
  var quran = {
    day: function () {
      var d = SS.store.get("quran:today", null);
      return d && d.date === today() ? d : { date: today(), seen: {} };
    },
    count: function () { return Object.keys(quran.day().seen).length; },
    history: function () { return SS.store.get("quran:daily", {}) || {}; },
    read: function (surah, ayah) {
      var d = quran.day(), id = surah + ":" + ayah;
      if (d.seen[id]) return;
      d.seen[id] = 1;
      SS.store.set("quran:today", d);
      var h = quran.history();
      h[d.date] = Object.keys(d.seen).length;
      var keys = Object.keys(h).sort();
      while (keys.length > 120) delete h[keys.shift()];
      SS.store.set("quran:daily", h);
      var goal = +settings().quranGoal || 0;
      if (goal && h[d.date] === goal) SS.toast(f("daily.goalDone", { n: goal }));
    },
  };
  SS.quranGoal = quran;
  // Reading on: a short jump forward in the same surah counts the ayahs passed
  // over too (a quick scroll skips past the ayah-in-view check).
  var prevRead = null;
  onHook("ayahRead", function (surah, ayah) {
    if (prevRead && prevRead.surah === surah && ayah > prevRead.ayah && ayah - prevRead.ayah <= 15) {
      for (var a = prevRead.ayah + 1; a < ayah; a++) quran.read(surah, a);
    }
    quran.read(surah, ayah);
    prevRead = { surah: surah, ayah: ayah };
  });

  function goalWidget() {
    var sub = $("cr-pos"), goal = +settings().quranGoal || 0;
    var ring = $("cr-ring");
    if (!sub) return;
    if (!goal) { if (ring) ring.hidden = true; return; }
    var n = Math.min(quran.count(), goal);
    if (!ring) {
      $("cr-link").insertAdjacentHTML("beforeend", '<span class="goal-ring" id="cr-ring" aria-hidden="true"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.5"/><circle class="gr-fill" cx="18" cy="18" r="15.5"/></svg><b></b></span>');
      ring = $("cr-ring");
    }
    ring.hidden = false;
    var c = 2 * Math.PI * 15.5;
    var fill = ring.querySelector(".gr-fill");
    fill.style.strokeDasharray = c;
    fill.style.strokeDashoffset = c * (1 - n / goal);
    ring.classList.toggle("done", n >= goal);
    ring.querySelector("b").textContent = n >= goal ? "✓" : n;
    var chev = $("cr-link").querySelector(".chev");
    if (chev) chev.hidden = true;
    sub.textContent = (sub.getAttribute("data-pos") || sub.textContent) + " · " + f("daily.goalProgress", { n: n, goal: goal });
  }
  onHook("homeInit", function () {
    var sub = $("cr-pos");
    if (sub) sub.removeAttribute("data-pos");
    setTimeout(function () {
      if (sub && !sub.getAttribute("data-pos")) sub.setAttribute("data-pos", sub.textContent);
      goalWidget();
    }, 0);
  });

  /* ═══════════ Reminders (adhkar, Qur'an goal) while the app is open ═══════════ */
  var timers = [];
  function at(ms, fn) { if (ms > 0 && ms < 2 * DAY) timers.push(setTimeout(fn, ms)); }
  function once(tag, fn) { if (SS.store.get("daily:last:" + tag.split("-")[0]) === tag) return; SS.store.set("daily:last:" + tag.split("-")[0], tag); fn(); }
  function schedule() {
    timers.forEach(clearTimeout);
    timers = [];
    var s = settings();
    if (typeof Notification === "undefined" || Notification.permission !== "granted" || !SS.reminders || !SS.reminders.notify) return;
    var now = Date.now(), day = today();
    if (s.goalTime && +s.quranGoal) {
      var hm = s.goalTime.split(":"), when = new Date(); when.setHours(+hm[0], +hm[1], 0, 0);
      at(when - now, function () {
        if (quran.count() >= +settings().quranGoal) return;
        once("goal-" + day, function () {
          SS.reminders.notify(t("daily.goalRemTitle"), f("daily.goalRemBody", { n: quran.count(), goal: +settings().quranGoal }), "goal-" + day, "./#/quran");
        });
      });
    }
    if (!s.adhkarReminders || (SS.push && SS.push.active())) return;
    SS.geo.resolve().then(function (loc) {
      return SS.api.prayerTimes({ lat: loc.lat, lng: loc.lng, method: s.method, school: s.school }).then(function (r) {
        // Morning adhkar: 20 minutes after Fajr. Evening: 20 minutes after Asr.
        [["morning", "Fajr"], ["evening", "Asr"]].forEach(function (x) {
          var when = SS.ui.parseTime(r.timings[x[1]]).getTime() + 20 * 60000;
          at(when - Date.now(), function () {
            var done = (SS.store.get("adhkar:done", {})[day] || {})[x[0]];
            if (done) return;
            once("adhkar" + x[0] + "-" + day, function () {
              SS.reminders.notify(t("daily.adhkarRem_" + x[0]), t("daily.adhkarRemBody"), "adhkar-" + x[0] + "-" + day, "./#/adhkar/" + x[0]);
            });
          });
        });
      });
    }).catch(function () { /* try again when visible */ });
  }
  SS.dailyReminders = { schedule: schedule };

  /* ═══════════ Keep the screen on ═══════════ */
  var wake = null, WAKE_VIEWS = { surah: 1, adhkar: 1, dhikr: 1 };
  function wakeWanted() { return settings().keepAwake !== false && WAKE_VIEWS[SS.currentView()] && document.visibilityState === "visible"; }
  function updateWake() {
    if (!("wakeLock" in navigator)) return;
    if (wakeWanted()) {
      if (wake) return;
      navigator.wakeLock.request("screen").then(function (l) {
        wake = l;
        l.addEventListener("release", function () { if (wake === l) wake = null; });
        if (!wakeWanted()) { l.release(); wake = null; }
      }).catch(function () { /* low battery, or not allowed */ });
    } else if (wake) {
      var w = wake; wake = null;
      w.release().catch(function () {});
    }
  }

  /* ═══════════ App icon badge ═══════════ */
  function updateBadge(timings) {
    if (!("setAppBadge" in navigator)) return;
    if (!settings().iconBadge || !SS.tracker) { if (navigator.clearAppBadge) navigator.clearAppBadge().catch(function () {}); return; }
    var use = function (tm) {
      var now = new Date(), n = 0;
      FIVE.forEach(function (k) { if (SS.ui.parseTime(tm[k]) <= now && !SS.tracker.isDone(today(), k)) n++; });
      (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(function () {});
    };
    if (timings) { use(timings); return; }
    if (lastTimes) { use(lastTimes); return; }
    var s = settings();
    SS.geo.resolve().then(function (loc) { return SS.api.prayerTimes({ lat: loc.lat, lng: loc.lng, method: s.method, school: s.school }); })
      .then(function (r) { lastTimes = r.timings; use(r.timings); }).catch(function () {});
  }
  SS.updateBadge = updateBadge;
  onHook("trackerChanged", function () { updateBadge(); });

  /* ═══════════ Friday summary ═══════════ */
  function weekStats() {
    var log = SS.tracker ? SS.tracker.log() : {}, adhkar = SS.store.get("adhkar:done", {}) || {}, qd = quran.history();
    var prayers = 0, fullDays = 0, adhkarDays = 0, ayahs = 0, readDays = 0;
    for (var i = 0; i < 7; i++) {
      var ds = SS.localDate(addDays(new Date(), -i));
      var c = SS.tracker ? SS.tracker.count(ds) : 0;
      prayers += c;
      if (c === 5) fullDays++;
      var a = adhkar[ds] || {};
      if (a.morning || a.evening) adhkarDays++;
      if (qd[ds]) { ayahs += qd[ds]; readDays++; }
    }
    void log;
    return { prayers: prayers, fullDays: fullDays, adhkarDays: adhkarDays, ayahs: ayahs, readDays: readDays };
  }
  SS.weekStats = weekStats;
  function weekCard() {
    var el = $("week-card");
    if (!el) return;
    var key = "week:dismissed";
    var friday = new Date().getDay() === 5;
    if (!friday || SS.store.get(key) === today()) { el.hidden = true; return; }
    var w = weekStats();
    var stat = function (n, label) { return '<div class="wk-stat"><b>' + esc(String(n)) + "</b><span>" + esc(label) + "</span></div>"; };
    el.hidden = false;
    el.innerHTML = '<div class="card-title"><h2 class="h-sm" id="week-h">' + esc(t("daily.weekTitle")) + "</h2>" +
      '<button class="icon-btn" type="button" id="week-close" aria-label="' + esc(t("daily.weekHide")) + '">' + icon("x") + "</button></div>" +
      '<div class="wk-stats">' + stat(w.prayers + "/35", t("daily.weekPrayers")) + stat(w.ayahs, t("daily.weekAyahs")) +
      stat(w.adhkarDays + "/7", t("daily.weekAdhkar")) + "</div>" +
      '<p class="tiny mt-1">' + esc(t(w.prayers >= 30 ? "daily.weekGreat" : w.prayers >= 15 ? "daily.weekGood" : "daily.weekStart")) + "</p>";
    $("week-close").onclick = function () { SS.store.set(key, today()); el.hidden = true; };
  }
  onHook("homeInit", weekCard);

  /* ═══════════ Audio sleep timer ═══════════ */
  var SLEEP = [0, 15, 30, 60], sleepIdx = 0, sleepTimer = null;
  function wireSleep() {
    var b = $("ab-sleep");
    if (!b) return;
    b.onclick = function () {
      sleepIdx = (sleepIdx + 1) % SLEEP.length;
      clearTimeout(sleepTimer);
      var m = SLEEP[sleepIdx];
      b.setAttribute("aria-pressed", String(m > 0));
      $("ab-sleep-n").hidden = !m;
      $("ab-sleep-n").textContent = m ? m + "′" : "";
      b.setAttribute("aria-label", m ? f("daily.sleepOn", { n: m }) : t("daily.sleepOff"));
      SS.toast(m ? f("daily.sleepOn", { n: m }) : t("daily.sleepOff"));
      if (m) {
        sleepTimer = setTimeout(function () {
          if (SS.audio && SS.audio.pause) SS.audio.pause();
          sleepIdx = 0; b.setAttribute("aria-pressed", "false"); $("ab-sleep-n").hidden = true;
          b.setAttribute("aria-label", t("daily.sleepOff"));
        }, m * 60000);
      }
    };
  }

  /* ═══════════ New version ready ═══════════ */
  function watchUpdates() {
    if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller) return; // first install: nothing to replace
    var shown = false;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (shown) return;
      shown = true;
      var el = $("update-banner");
      if (!el) return;
      el.hidden = false;
      $("update-reload").onclick = function () { location.reload(); };
      $("update-later").onclick = function () { el.hidden = true; };
    });
  }

  /* ═══════════ Settings ═══════════ */
  onHook("settingsInit", function () {
    var s = settings();
    var goal = $("st-goal");
    if (!goal) return;
    goal.innerHTML = GOALS.map(function (n) {
      return '<option value="' + n + '"' + (n === (+s.quranGoal || 0) ? " selected" : "") + ">" + esc(n ? f("daily.goalN", { n: n }) : t("daily.goalOff")) + "</option>";
    }).join("");
    goal.onchange = function () { SS.store.saveSettings({ quranGoal: +this.value }); $("st-goal-time-row").hidden = !+this.value; schedule(); };
    $("st-goal-time-row").hidden = !+s.quranGoal;
    $("st-goal-time").value = s.goalTime || "";
    $("st-goal-time").onchange = function () {
      var v = this.value;
      if (v) SS.reminders.ask().then(function (ok) { if (!ok) { $("st-goal-time").value = ""; v = ""; } SS.store.saveSettings({ goalTime: v }); schedule(); });
      else { SS.store.saveSettings({ goalTime: "" }); schedule(); }
    };
    $("st-wake").checked = s.keepAwake !== false;
    $("st-wake-row").hidden = !("wakeLock" in navigator);
    $("st-wake").onchange = function () { SS.store.saveSettings({ keepAwake: this.checked }); };
    $("st-adhkar-rem").checked = !!s.adhkarReminders && typeof Notification !== "undefined" && Notification.permission === "granted";
    $("st-adhkar-rem").onchange = function () {
      var box = this;
      if (!box.checked) { SS.store.saveSettings({ adhkarReminders: false }); schedule(); return; }
      SS.reminders.ask().then(function (ok) { box.checked = ok; SS.store.saveSettings({ adhkarReminders: ok }); schedule(); });
    };
    $("st-badge-row").hidden = !("setAppBadge" in navigator);
    $("st-badge").checked = !!s.iconBadge;
    $("st-badge").onchange = function () {
      var box = this;
      if (!box.checked) { SS.store.saveSettings({ iconBadge: false }); updateBadge(); return; }
      // Some systems only show badges for apps allowed to notify.
      var p = typeof Notification !== "undefined" && Notification.permission === "default" ? SS.reminders.ask() : Promise.resolve(true);
      p.then(function () { SS.store.saveSettings({ iconBadge: true }); updateBadge(); });
    };
  });

  /* ═══════════ Boot ═══════════ */
  function boot() {
    wireSleep();
    watchUpdates();
    schedule();
    updateBadge();
    document.addEventListener("visibilitychange", function () {
      updateWake();
      if (document.visibilityState === "visible") { schedule(); updateBadge(); }
    });
    window.addEventListener("hashchange", function () { setTimeout(updateWake, 0); });
    setTimeout(updateWake, 0);
  }
  SS.dailyBoot = boot; // called by app.js once the interface language is ready
})();
