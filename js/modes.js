/* SalaamStreet — modes.js (classic script)
   3.0 Modes: one SalaamStreet, five ways to use it.

   • The registry below says, per mode, which tools Home puts first, which Home
     blocks step back, and which module draws the mode's dashboard. Modes reuse
     the app's own prayer times, Qibla, Qur'an, duas, dhikr and mosque finder;
     nothing is duplicated.
   • The active mode is the synced key "mode:active" ({id, at}) — guests keep it
     on the device; signed-in people get it on all their devices. Kids Mode is
     different: it belongs to one device (the device holds a child's access
     token, "kids:device") and locks that device to the Kids area.
   • Mode modules (js/modes/*.js) are downloaded only when a mode is opened.
   Also here: the #/modes selector, the top-bar mode indicator, the mode panel
   on Home, gentle dismissible mode suggestions, Quiet Mode (Mosque Mode) and
   small shared pieces (dua cards, checklists) the modules use. */
(function () {
  "use strict";
  window.SS = window.SS || {};
  var $ = function (id) { return document.getElementById(id); };
  function t(k) { return SS.i18n.t(k); }
  function f(k, v) { return SS.ui.f(k, v); }
  function esc(s) { return SS.esc(s); }
  function icon(n, c) { return SS.ui.icon(n, c); }
  function isAr() { return SS.i18n.isAr(); }
  /** Pick the Arabic or English side of a {en, ar} content pair. */
  function L(o) { return !o ? "" : typeof o === "string" ? o : (isAr() && o.ar) || o.en || ""; }

  var QUICK = {
    qibla: ["#/qibla", "compass", "nav.qibla"], quran: ["#/quran", "book", "nav.quran"],
    adhkar: ["#/adhkar", "sunrise", "nav.adhkar"], mosques: ["#/mosques", "mosque", "nav.mosques"],
    duas: ["#/duas", "heart", "nav.duas"], dhikr: ["#/dhikr", "beads", "nav.dhikr"],
    prayer: ["#/prayer", "clock", "nav.prayerShort"], calendar: ["#/calendar", "calendar", "nav.calendar"],
    travelDuas: ["#/duas/travel", "heart", "modes.travelDuas"],
  };
  /* The five official modes. home: quick links on Home, in order. hide: Home
     blocks that step back while the mode is on (data-home="…" in index.html). */
  var MODES = [
    { id: "normal", emoji: "🏠", home: ["qibla", "quran", "adhkar", "mosques", "duas", "dhikr"], hide: [] },
    { id: "travel", emoji: "✈️", module: "travel", home: ["prayer", "qibla", "travelDuas", "mosques", "quran", "calendar"], hide: ["name", "browse"] },
    { id: "kids", emoji: "🧒", module: "kids", home: [], hide: [] },
    { id: "hajj", emoji: "🕋", module: "hajj", home: ["prayer", "qibla", "duas", "dhikr", "quran", "calendar"], hide: ["name", "browse"] },
    { id: "mosque", emoji: "🕌", module: "mosque", home: ["prayer", "qibla", "dhikr", "duas", "quran", "adhkar"], hide: ["ayah", "name", "browse", "plan"] },
  ];
  function get(id) { for (var i = 0; i < MODES.length; i++) if (MODES[i].id === id) return MODES[i]; return null; }

  /* ── Active mode ─────────────────────────────────────────────── */
  /** The child using this device: { id, token, child } — or null. "kids:device" is
      { active, profiles: { childId: { token, child } } } (siblings can share a device). */
  function kidDevice() {
    var d = SS.store.get("kids:device");
    if (!d || typeof d !== "object" || !d.profiles || typeof d.profiles !== "object") return null;
    var ids = Object.keys(d.profiles).filter(function (id) {
      var p = d.profiles[id];
      return p && typeof p.token === "string" && /^kid_[0-9a-f]{64}$/.test(p.token) && p.child && typeof p.child.name === "string";
    });
    if (!ids.length) return null;
    var id = ids.indexOf(d.active) > -1 ? d.active : ids[0];
    return { id: id, token: d.profiles[id].token, child: d.profiles[id].child, ids: ids };
  }
  function active() {
    if (kidDevice()) return "kids";
    var v = SS.store.get("mode:active");
    var id = v && typeof v === "object" ? v.id : null;
    return get(id) && id !== "kids" ? id : "normal";
  }
  function setMode(id, silent) {
    if (!get(id) || id === "kids") id = "normal";
    var was = active();
    if (id === "normal") SS.store.remove("mode:active");
    else SS.store.set("mode:active", { id: id, at: Date.now() });
    apply();
    if (!silent && was !== id) SS.toast(f("modes.nowOn", { m: t("modes.name_" + id) }));
  }
  function quietOn() { return active() === "mosque" && !!SS.store.get("modes:quiet"); }

  /** Reflect the active mode everywhere outside the views (cheap; runs on every navigation). */
  function apply() {
    var id = active(), m = get(id), d = document.documentElement;
    if (d.getAttribute("data-mode") !== id) d.setAttribute("data-mode", id);
    document.body.classList.toggle("kids-lock", id === "kids");
    d.classList.toggle("quiet", quietOn());
    var pill = $("mode-pill");
    if (pill) {
      pill.hidden = id === "normal" || id === "kids";
      $("mode-pill-emoji").textContent = m.emoji;
      $("mode-pill-label").textContent = t("modes.short_" + id);
      pill.setAttribute("aria-label", f("modes.current", { m: t("modes.name_" + id) }) + ". " + t("modes.change"));
    }
    var nav = document.querySelectorAll("[data-mode-now]");
    for (var i = 0; i < nav.length; i++) nav[i].textContent = id === "normal" ? "" : m.emoji;
  }

  /* ── Lazy-loaded mode modules ────────────────────────────────── */
  SS.modeModules = SS.modeModules || {};
  var loading = {};
  function load(name) {
    if (SS.modeModules[name]) return Promise.resolve(SS.modeModules[name]);
    if (loading[name]) return loading[name];
    loading[name] = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "js/modes/" + name + ".js";
      s.onload = function () {
        if (SS.modeModules[name]) resolve(SS.modeModules[name]);
        else { delete loading[name]; reject(new Error("module")); }
      };
      s.onerror = function () { delete loading[name]; reject(Object.assign(new Error("offline"), { offline: true })); };
      document.head.appendChild(s);
    });
    return loading[name];
  }
  /** Load a module into el, with a loading state and a retry on failure. */
  function withModule(name, el, draw) {
    if (!SS.modeModules[name]) el.innerHTML = '<div aria-busy="true">' + SS.ui.skeletons(3, 90) + "</div>";
    return load(name).then(draw, function () {
      SS.ui.renderState(el, { kind: "error", retry: function () { withModule(name, el, draw); } });
    });
  }

  /* ═══════════ #/modes — Choose Your Mode ═══════════ */
  function modesInit() {
    var cur = active(), kid = kidDevice();
    var html = "";
    MODES.forEach(function (m) {
      var on = m.id === cur;
      var action = on ? t(m.id === "normal" ? "modes.openHome" : "modes.openDash") : t("modes.activate");
      if (m.id === "kids") action = kid ? t("modes.openKids") : t("modes.kidsSetup");
      html += '<article class="card mode-card' + (on ? " on" : "") + '" data-m="' + m.id + '"' + (on ? ' aria-current="true"' : "") + ' aria-labelledby="mc-' + m.id + '">' +
        '<span class="mode-emoji" aria-hidden="true">' + m.emoji + "</span>" +
        '<div class="mode-body"><h2 class="mode-name" id="mc-' + m.id + '">' + esc(t("modes.name_" + m.id)) + "</h2>" +
        '<p class="mode-desc" id="md-' + m.id + '">' + esc(t("modes.desc_" + m.id)) + "</p></div>" +
        (on ? '<span class="badge mode-active">' + icon("check") + "<span>" + esc(t("modes.active")) + "</span></span>" : "") +
        '<button class="btn' + (on ? " btn-outline" : "") + ' mode-go" type="button" data-go="' + m.id + '" aria-describedby="md-' + m.id + '">' +
        "<span>" + esc(action) + '</span><span class="visually-hidden"> — ' + esc(t("modes.name_" + m.id)) + "</span></button></article>";
    });
    $("modes-list").innerHTML = html;
    $("modes-list").onclick = function (e) {
      var b = e.target.closest("[data-go]");
      if (!b) return;
      choose(b.getAttribute("data-go"));
    };
  }
  /** What tapping a mode card does. */
  function choose(id) {
    if (id === "kids") { location.hash = kidDevice() ? "#/kids" : "#/family"; return; }
    setMode(id);
    location.hash = id === "normal" ? "#/home" : "#/mode/" + id;
  }

  /* ═══════════ #/mode/<id> — a mode's full dashboard ═══════════ */
  function modeInit(params) {
    var id = params && params[0], m = get(id);
    var root = $("mode-root");
    if (!m || id === "normal") { location.replace("#/modes"); return; }
    if (id === "kids") { location.replace(kidDevice() ? "#/kids" : "#/family"); return; }
    var on = active() === id;
    $("mode-h").textContent = t("modes.name_" + id);
    $("mode-emoji").textContent = m.emoji;
    $("mode-sub").textContent = t("modes.desc_" + id);
    document.title = t("modes.name_" + id) + " — SalaamStreet";
    $("tb-title").textContent = t("modes.name_" + id);
    var bar = $("mode-off");
    bar.hidden = on;
    if (!on) {
      $("mode-off-text").textContent = f("modes.notActive", { m: t("modes.name_" + id) });
      $("mode-off-btn").onclick = function () { setMode(id); modeInit(params); };
    }
    if (shownModule && shownModule !== m.module) modeLeave();
    shownModule = m.module;
    withModule(m.module, root, function (mod) { if (shownModule === m.module && SS.currentView() === "mode") mod.page(root, params.slice(1)); });
  }
  var shownModule = null;
  function modeLeave() {
    var mod = shownModule && SS.modeModules[shownModule];
    shownModule = null;
    if (mod && mod.leave) mod.leave();
  }

  /* ═══════════ Home: quick links, blocks, and the mode panel ═══════════ */
  function homeMode() {
    var id = active(), m = get(id);
    var grid = $("quick-grid");
    if (grid && m.home.length) {
      grid.innerHTML = m.home.map(function (k) {
        var q = QUICK[k];
        return '<a class="quick" href="' + q[0] + '"><span class="q-ic"><svg aria-hidden="true"><use href="#i-' + q[1] + '"/></svg></span><span>' + esc(t(q[2])) + "</span></a>";
      }).join("");
    }
    var blocks = document.querySelectorAll("[data-home]");
    for (var i = 0; i < blocks.length; i++) {
      blocks[i].classList.toggle("mode-hidden", m.hide.indexOf(blocks[i].getAttribute("data-home")) > -1 || (quietOn() && blocks[i].getAttribute("data-quiet") === "hide"));
    }
    var panel = $("mode-home");
    if (!panel) return;
    if (!m.module || id === "kids") { panel.hidden = true; panel.innerHTML = ""; return; }
    panel.hidden = false;
    panel.innerHTML = '<div class="mode-strip"><span class="mode-emoji sm" aria-hidden="true">' + m.emoji + "</span>" +
      '<span class="mode-strip-t"><b>' + esc(t("modes.name_" + id)) + '</b></span><span class="spacer"></span>' +
      '<a class="btn btn-ghost btn-sm" href="#/modes">' + esc(t("modes.change")) + "</a></div>" +
      '<div id="mode-home-body"></div>';
    var body = $("mode-home-body");
    withModule(m.module, body, function (mod) { if (SS.currentView() === "home" && active() === id) mod.home(body); });
  }

  /* ═══════════ Suggestions: offered, never forced ═══════════ */
  var suggestedThisVisit = false;
  var SUGGEST_GAP = 30 * 86400000;
  function suggest(id, view) {
    if (suggestedThisVisit || active() === id || active() === "kids" || !get(id)) return;
    var dis = SS.store.get("mode:dismissed", {}) || {};
    if (dis[id] && Date.now() - dis[id] < SUGGEST_GAP) return;
    var sec = $("view-" + view);
    if (!sec || sec.querySelector(".mode-suggest")) return;
    suggestedThisVisit = true;
    var box = document.createElement("aside");
    box.className = "card mode-suggest";
    box.setAttribute("aria-label", t("modes.suggestLabel"));
    box.innerHTML = '<span class="mode-emoji sm" aria-hidden="true">' + get(id).emoji + "</span>" +
      '<p class="ms-text">' + esc(t("modes.suggest_" + id)) + "</p>" +
      '<div class="ms-acts"><button class="btn btn-sm" type="button" data-s="try">' + esc(t("modes.tryIt")) + "</button>" +
      '<button class="btn btn-ghost btn-sm" type="button" data-s="no">' + esc(t("modes.notNow")) + "</button></div>";
    var head = sec.querySelector(".page-head");
    if (head && head.nextSibling) sec.insertBefore(box, head.nextSibling); else sec.insertBefore(box, sec.firstChild);
    box.onclick = function (e) {
      var b = e.target.closest("[data-s]");
      if (!b) return;
      var d = SS.store.get("mode:dismissed", {}) || {};
      d[id] = Date.now();
      SS.store.set("mode:dismissed", d);
      box.parentNode.removeChild(box);
      if (b.getAttribute("data-s") === "try") choose(id);
    };
  }
  function clearSuggestions() {
    var s = document.querySelectorAll(".mode-suggest");
    for (var i = 0; i < s.length; i++) if (s[i].closest(".view") && s[i].closest(".view").hidden) s[i].parentNode.removeChild(s[i]);
  }

  /* ═══════════ Shared pieces for the mode modules ═══════════ */
  /** A dua card: Arabic, transliteration, meaning and its source. d.title / d.en may be {en, ar} or strings. */
  function duaHtml(d) {
    var title = d.title ? L(d.title) : (isAr() && d.titleAr) || d.titleEn || "";
    var meaning = d.meaning ? L(d.meaning) : d.translationEn || "";
    return '<article class="card dua-card mode-dua">' +
      (title ? '<h3 class="h-sm">' + esc(title) + "</h3>" : "") +
      '<p class="arabic-dua" lang="ar" dir="rtl">' + esc(d.arabic) + "</p>" +
      (d.transliteration ? '<p class="transliteration">' + esc(d.transliteration) + "</p>" : "") +
      (meaning && !(isAr() && !d.meaning) ? '<p class="translation">' + esc(meaning) + "</p>" : "") +
      '<p class="tiny badge-src-line"><span class="badge badge-src">' + esc(t("modes.source")) + "</span> " + esc(L(d.source)) + "</p></article>";
  }
  /** A dua from the app's dua library, by id. */
  function libraryDua(id) {
    for (var i = 0; i < (SS.DUAS || []).length; i++) if (SS.DUAS[i].id === id) return SS.DUAS[i];
    return null;
  }

  /**
   * A tickable checklist stored as a map under `key` ({itemId: 1}).
   * groups: [{ id, title: {en, ar}, items: [{ id, t: {en, ar} }] }]
   */
  function checklist(el, key, groups, onChange) {
    function done() { var v = SS.store.get(key, {}); return v && typeof v === "object" ? v : {}; }
    function count() {
      var d = done(), n = 0, total = 0;
      groups.forEach(function (g) { g.items.forEach(function (it) { total++; if (d[it.id]) n++; }); });
      return { n: n, total: total };
    }
    function draw() {
      var d = done(), c = count();
      var html = '<div class="cl-head"><div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="' + c.total + '" aria-valuenow="' + c.n + '" aria-label="' + esc(t("modes.checklistProgress")) + '"><span style="inline-size:' + (c.total ? Math.round(c.n / c.total * 100) : 0) + '%"></span></div>' +
        '<p class="tiny" aria-live="polite">' + esc(f("modes.doneOf", { n: c.n, total: c.total })) + "</p></div>";
      groups.forEach(function (g) {
        html += '<fieldset class="cl-group"><legend class="group-label">' + esc(L(g.title)) + "</legend>";
        g.items.forEach(function (it) {
          var id = "cl-" + key.replace(/[^a-z0-9]/gi, "") + "-" + it.id;
          html += '<label class="cl-item" for="' + id + '"><input type="checkbox" id="' + id + '" data-item="' + esc(it.id) + '"' + (d[it.id] ? " checked" : "") + " />" +
            '<span class="cl-box" aria-hidden="true">' + icon("check") + '</span><span class="cl-text">' + esc(L(it.t)) + "</span></label>";
        });
        html += "</fieldset>";
      });
      html += '<button class="btn btn-ghost btn-sm mt-1" type="button" data-reset>' + icon("refresh") + "<span>" + esc(t("modes.resetChecklist")) + "</span></button>";
      el.innerHTML = html;
    }
    el.onchange = function (e) {
      var cb = e.target.closest("[data-item]");
      if (!cb) return;
      var d = done(), id = cb.getAttribute("data-item");
      if (cb.checked) d[id] = 1; else delete d[id];
      SS.store.set(key, d);
      var c = count();
      var bar = el.querySelector(".progress");
      bar.setAttribute("aria-valuenow", c.n);
      bar.firstChild.style.inlineSize = (c.total ? Math.round(c.n / c.total * 100) : 0) + "%";
      el.querySelector(".cl-head .tiny").textContent = f("modes.doneOf", { n: c.n, total: c.total });
      if (onChange) onChange(c);
    };
    el.onclick = function (e) {
      if (!e.target.closest("[data-reset]")) return;
      if (!window.confirm(t("modes.resetConfirm"))) return;
      SS.store.set(key, {});
      draw();
      if (onChange) onChange(count());
      SS.toast(t("modes.checklistReset"));
    };
    draw();
    return { count: count };
  }
  /** Count of ticked items in a stored checklist (without drawing it). */
  function checklistCount(key, groups) {
    var d = SS.store.get(key, {}) || {}, n = 0, total = 0;
    groups.forEach(function (g) { g.items.forEach(function (it) { total++; if (d[it.id]) n++; }); });
    return { n: n, total: total };
  }

  /** "Available offline" / "Needs a connection" label, so it's never a guess. */
  function offlineBadge(ok) {
    return '<span class="badge ' + (ok ? "badge-ok" : "badge-net") + '">' + icon(ok ? "check" : "wifi-off") + "<span>" + esc(t(ok ? "modes.worksOffline" : "modes.needsNet")) + "</span></span>";
  }

  /** Tabs inside a mode page (segmented control, arrow-key friendly). */
  function tabs(el, list, cur, onPick) {
    el.innerHTML = list.map(function (x) {
      return '<button type="button" role="tab" id="mt-' + x[0] + '" aria-selected="' + (x[0] === cur) + '" tabindex="' + (x[0] === cur ? 0 : -1) + '" data-tab="' + x[0] + '">' + esc(x[1]) + "</button>";
    }).join("");
    el.setAttribute("role", "tablist");
    el.onclick = function (e) { var b = e.target.closest("[data-tab]"); if (b) onPick(b.getAttribute("data-tab")); };
    el.onkeydown = function (e) {
      var keys = { ArrowRight: 1, ArrowLeft: -1 };
      if (!keys[e.key]) return;
      var i = list.map(function (x) { return x[0]; }).indexOf(cur);
      var dir = keys[e.key] * (SS.i18n.isRtl() ? -1 : 1);
      var next = list[(i + dir + list.length) % list.length][0];
      onPick(next);
      var b = el.querySelector('[data-tab="' + next + '"]');
      if (b) b.focus();
    };
  }

  SS.modes = {
    LIST: MODES, get: get, active: active, set: setMode, apply: apply, choose: choose,
    kidDevice: kidDevice, kidLocked: function () { return !!kidDevice(); },
    quiet: quietOn, load: load, withModule: withModule, suggest: suggest,
    L: L, duaHtml: duaHtml, libraryDua: libraryDua, checklist: checklist, checklistCount: checklistCount,
    offlineBadge: offlineBadge, tabs: tabs,
  };
  SS.views.modes = modesInit;
  SS.views.mode = modeInit;
  SS.leave.mode = modeLeave;
  // Family (parent) and Kids (child) live in js/modes/kids.js, loaded when first opened.
  SS.views.family = function (params) {
    var el = $("fam-root");
    withModule("kids", el, function (mod) { if (SS.currentView() === "family") mod.family(el, params || []); });
  };
  SS.views.kids = function (params) {
    var el = $("kids-root");
    withModule("kids", el, function (mod) { if (SS.currentView() === "kids") mod.kids(params || []); });
  };
  SS.leave.kids = function () { try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) { /* noop */ } };

  /* ── Wiring into existing views (no edits to their controllers needed) ── */
  function after(view, fn) {
    var orig = SS.views[view];
    if (!orig) return;
    SS.views[view] = function (params) { orig(params); try { fn(params); } catch (e) { if (window.console) console.error(e); } };
  }
  SS.modesBoot = function () {
    var prevHome = SS.hooks.homeInit;
    SS.hooks.homeInit = function () { if (prevHome) prevHome.apply(null, arguments); homeMode(); };
    after("mosques", function () { suggest("mosque", "mosques"); });
    after("calendar", function () { suggest("hajj", "calendar"); });
    after("duas", function (p) { if (p && p[0] === "travel") suggest("travel", "duas"); });
    window.addEventListener("hashchange", clearSuggestions);
    apply();
  };
})();
