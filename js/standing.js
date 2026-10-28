/* SalaamStreet — standing.js (classic script, 3.0.2; 3.0.3)
   An account's standing with SalaamStreet, on the website and in the iPhone app:
   • Bans (3.0.3): a banned person can still sign in, see why and appeal, but
     their account's online features are off: SalaamStreet AI, the NVHS MSA,
     sync, Family and the Admin Panel (the server refuses them too — see
     public.am_blocked). Everything that works without an account still
     works. The device asks the server (account_status) when the app opens,
     when it comes back to the front and every few minutes, and remembers the
     answer so a reload is restricted straight away.
     A ban for an offensive name or email is strict: until it's lifted the app
     shows only the ban (appeal, or sign out).
   • "Sign out everywhere" by an admin: the device is signed out at once.
   • Warnings from an admin: shown once, with the reason.
   • The Community Rules: ticked before signing in (js/account.js) and
     recorded on the account; everyone already signed in agrees once per
     version (RULES_VERSION) on their next visit.
   • The Admin Panel link in the More menu and sidebar, for admins only, with
     a count of flags and appeals waiting.
   • The banner admins can show on everyone's Home (app_notice_get).
   The server decides all of this; this file only shows it. */
(function () {
  "use strict";
  window.SS = window.SS || {};
  var $ = function (id) { return document.getElementById(id); };
  function t(k) { return SS.i18n.t(k); }
  function f(k, v) { return SS.ui.f(k, v); }
  function esc(s) { return SS.esc(s); }
  function icon(n) { return SS.ui.icon(n); }
  var CFG = SS.CONFIG || {};

  /** Bump when the Community Rules change: everyone is asked to agree again. */
  var RULES_VERSION = "2026-10-28";
  var RULES = ["rules.r1", "rules.r2", "rules.r3", "rules.r4", "rules.r5", "rules.r6", "rules.r7"];
  var BAN_KEY = "ss-ban";              // { uid, ban }: the signed-in account's ban, remembered for the next open
  var AGREE_KEY = "ss-rules-agreed";   // sessionStorage: ticked in the sign-in dialog (survives the Google/Apple round trip)
  var ADMIN_KEY = "ss.adminCheck";     // { uid, admin, at, count }
  var NOTICE_KEY = "ss-notice";        // { at, notice }
  var HIDDEN_KEY = "ss-notice-hidden"; // the banner text someone hid
  var CHECK_MS = 5 * 60000;
  /** Pages that need the account (its online features): off while it's banned. */
  var ONLINE_VIEWS = { ai: 1, lab: 1, msa: 1, family: 1, admin: 1 };

  function configured() { return !!(CFG.supabaseUrl && CFG.supabaseAnonKey); }
  function base() { return CFG.supabaseUrl.replace(/\/+$/, ""); }
  function signedIn() { return !!(SS.account && SS.account.signedIn()); }
  function get(store, k) { try { return JSON.parse(store.getItem(k) || "null"); } catch (e) { return null; } }
  function put(store, k, v) { try { if (v == null) store.removeItem(k); else store.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }

  /** An RPC with only the public key (works signed out). */
  function anon(fn, args) {
    return fetch(base() + "/rest/v1/rpc/" + fn, {
      method: "POST", headers: { apikey: CFG.supabaseAnonKey, "content-type": "application/json" }, body: JSON.stringify(args || {}),
    }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (j) {
        if (!r.ok) throw Object.assign(new Error((j && j.message) || "http " + r.status), { status: r.status });
        return j;
      });
    });
  }
  /** An RPC as the signed-in account. */
  function rpc(fn, args) {
    return SS.account.client().then(function (c) { return c.rpc(fn, args || {}); }).then(function (r) {
      if (r.error) throw r.error;
      return r.data;
    });
  }

  /* ── The ban ──────────────────────────────────────────────────── */
  /** The signed-in account's ban, if it has one now (remembered on the device between checks). */
  function ban() {
    var user = signedIn() && SS.account.user(), c = get(localStorage, BAN_KEY);
    if (!user || !c || c.uid !== user.id || !c.ban || !c.ban.banned) return null;
    if (c.ban.until && new Date(c.ban.until).getTime() <= Date.now()) return null;
    return c.ban;
  }
  function restricted() { return !!ban(); }
  function setBan(info) {
    var user = signedIn() && SS.account.user();
    var was = restricted();
    put(localStorage, BAN_KEY, user && info && info.banned ? { uid: user.id, ban: info } : null);
    applyRestriction();
    if (was !== restricted() && SS.account && SS.account.syncNow && !restricted()) SS.account.syncNow().catch(function () { /* status shows it */ });
  }
  /** The red "Account restricted" bar, the page class, and the sync status. */
  function applyRestriction() {
    var b = ban(), bar = $("ban-bar");
    document.documentElement.classList.toggle("ss-restricted", !!b);
    if (bar) {
      bar.hidden = !b;
      bar.innerHTML = b ? icon("lock") + "<span>" + esc(t("ban.bar")) + "</span>" + icon("chev-r") : "";
    }
    if (b) showAdmin(false);
    if (SS.account && SS.account.refreshStatus) SS.account.refreshStatus();
    if (b && b.strict && !showingBan()) showBan(b);
  }

  /* ── Checking ─────────────────────────────────────────────────── */
  var lastCheck = 0, checking = false, shownThisOpen = false;
  function check(force) {
    if (!configured() || checking || !signedIn()) return;
    if (!force && Date.now() - lastCheck < 30000) return;
    lastCheck = Date.now();
    checking = true;
    rpc("account_status").then(function (s) {
      checking = false;
      if (!s) return;
      if (s.session_ended) return endedByAdmin();
      setBan(s.banned ? s : null);
      if (s.banned) {
        // Shown once each time the app opens (always, for a strict ban); the bar brings it back.
        var typing = $("standing-appeal-text");
        if ((s.strict || !shownThisOpen) && !(showingBan() && typing && typing.value.trim())) { shownThisOpen = true; showBan(s); }
        return;
      }
      if (showingBan()) closeDialog(); // the ban was lifted while it was showing
      if (s.warnings && s.warnings.length) { showWarnings(s.warnings); return; }
      if (s.rules_version !== RULES_VERSION) {
        if (agreedHere()) accept().catch(function () { showRules(); });
        else showRules();
      }
    }, function () { checking = false; /* offline: the remembered answer stands */ });
  }
  function endedByAdmin() {
    setBan(null);
    return Promise.resolve(SS.account.signOut(true)).then(function () { SS.toast(t("account.endedByAdmin")); });
  }

  /* ── The dialog ───────────────────────────────────────────────── */
  var locked = false; // the rules prompt and a strict ban can't be closed without an answer
  /** The ban screen is already up (don't redraw it under someone typing an appeal). */
  function showingBan() { var d = $("standing-dialog"); return !!(d && d.open && $("standing-body").querySelector(".standing-head.ban")); }
  function dialog(html, lockIt) {
    var dlg = $("standing-dialog");
    if (!dlg || typeof dlg.showModal !== "function") return null;
    if (!dlg._wired) {
      dlg._wired = true;
      dlg.addEventListener("cancel", function (e) { if (locked) e.preventDefault(); });
      dlg.addEventListener("click", function (e) { if (locked && e.target === dlg) e.stopImmediatePropagation(); }, true);
    }
    locked = !!lockIt;
    $("standing-body").innerHTML = html;
    if (!dlg.open) SS.openDialog(dlg);
    return dlg;
  }
  function closeDialog() { locked = false; var d = $("standing-dialog"); if (d && d.open) d.close(); }
  function dateLabel(iso) {
    try { return new Date(iso).toLocaleString(SS.i18n.dateLocale(), { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch (e) { return String(iso); }
  }
  function reasonLabel(code) { var k = "reason." + (code || "other"); var v = t(k); return v === k ? t("reason.other") : v; }

  /** The ban: why, until when, the appeal. note: a line about the page they tried to open. */
  function showBan(b, note) {
    var ap = b.appeal, strict = !!b.strict, html =
      '<div class="standing-head ban">' + icon("lock") + '<h2 id="standing-h">' + esc(t("ban.title")) + "</h2></div>" +
      (note ? '<p class="standing-note bad">' + esc(note) + "</p>" : "") +
      '<dl class="standing-dl"><div><dt>' + esc(t("ban.reason")) + "</dt><dd>" + esc(reasonLabel(b.reason)) + "</dd></div>" +
      (b.message ? "<div><dt>" + esc(t("ban.message")) + "</dt><dd>" + esc(b.message) + "</dd></div>" : "") +
      '</dl><p class="standing-when">' + icon("clock") + "<span>" + esc(b.until ? f("ban.until", { date: dateLabel(b.until) }) : t("ban.forever")) + "</span></p>" +
      "<p>" + esc(t(strict ? "ban.strictLead" : "ban.onlineOff")) + "</p>" +
      '<p class="tiny"><a href="terms/#rules" target="_blank" rel="noopener">' + esc(t("rules.title")) + "</a></p>";
    if (ap && ap.status === "open") {
      html += '<p class="standing-note">' + esc(f("ban.appealSent", { date: dateLabel(ap.at) })) + "</p>";
    } else {
      if (ap && ap.status === "denied") {
        html += '<p class="standing-note bad">' + esc(t("ban.appealDenied")) + (ap.reply ? " " + esc(f("ban.appealReply", { text: ap.reply })) : "") + "</p>";
      }
      if (b.can_appeal) {
        html += '<form class="standing-appeal" id="standing-appeal"><h3>' + esc(t("ban.appealTitle")) + '</h3><p class="tiny">' + esc(t("ban.appealHelp")) + "</p>" +
          '<label class="visually-hidden" for="standing-appeal-text">' + esc(t("ban.appealTitle")) + "</label>" +
          '<textarea class="input" id="standing-appeal-text" rows="4" minlength="10" maxlength="1000" placeholder="' + esc(t("ban.appealPh")) + '"></textarea>' +
          '<p class="acct-msg error" id="standing-err" role="alert" hidden></p>' +
          '<div class="row-between"><span class="tiny muted">' + esc(f("ban.appealsLeft", { n: b.appeals_left })) + "</span>" +
          '<button class="btn" type="submit" id="standing-appeal-go">' + icon("next") + "<span>" + esc(t("ban.appealSend")) + "</span></button></div></form>";
      } else if (ap) {
        html += '<p class="tiny muted">' + esc(t("ban.noAppeals")) + "</p>";
      }
    }
    html += '<div class="modal-actions">' +
      (strict ? "" : '<button class="btn btn-outline" type="button" id="standing-close">' + esc(t("ban.continueOffline")) + "</button>") +
      '<button class="btn btn-ghost" type="button" id="standing-signout">' + icon("logout") + "<span>" + esc(t("ban.signOut")) + "</span></button></div>";
    dialog(html, strict);
    if ($("standing-close")) $("standing-close").onclick = closeDialog;
    $("standing-signout").onclick = function () { closeDialog(); setBan(null); SS.account.signOut(true); };
    var form = $("standing-appeal");
    if (form) form.onsubmit = function (e) {
      e.preventDefault();
      var text = $("standing-appeal-text").value.trim(), err = $("standing-err"), btn = $("standing-appeal-go");
      if (text.length < 10) { err.textContent = t("ban.appealPh"); err.hidden = false; return; }
      btn.disabled = true;
      rpc("account_appeal", { p_text: text }).then(function (n) { setBan(n); showBan(n); }, function () {
        btn.disabled = false; err.textContent = t("ban.appealErr"); err.hidden = false;
      });
    };
  }
  /** Opening a page while restricted: pages that need the account show the ban instead; a strict ban covers every page. */
  function guard(view) {
    var b = ban();
    if (!b) return false;
    if (b.strict) { if (!showingBan()) showBan(b); return false; }
    if (!ONLINE_VIEWS[view]) return false;
    showBan(b, t("ban.pageBlocked"));
    return true;
  }

  var warnQueue = [];
  function showWarnings(list) {
    warnQueue = list.slice();
    nextWarning();
  }
  function nextWarning() {
    var w = warnQueue.shift();
    if (!w) { closeDialog(); lastCheck = 0; check(true); return; } // then the rules, if needed
    dialog('<div class="standing-head warn">' + icon("info") + '<h2 id="standing-h">' + esc(t("warn.title")) + "</h2></div>" +
      '<dl class="standing-dl"><div><dt>' + esc(t("ban.reason")) + "</dt><dd>" + esc(reasonLabel(w.reason)) + "</dd></div>" +
      (w.message ? "<div><dt>" + esc(t("ban.message")) + "</dt><dd>" + esc(w.message) + "</dd></div>" : "") + "</dl>" +
      "<p>" + esc(t("warn.lead")) + '</p><p class="tiny"><a href="terms/#rules" target="_blank" rel="noopener">' + esc(t("rules.title")) + "</a></p>" +
      '<div class="modal-actions"><button class="btn" type="button" id="standing-ok">' + icon("check") + "<span>" + esc(t("warn.ok")) + "</span></button></div>", true);
    $("standing-ok").onclick = function () {
      this.disabled = true;
      rpc("account_warning_seen", { p_id: w.id }).catch(function () { /* shown again next time */ }).then(nextWarning);
    };
  }

  function rulesList() {
    return '<p class="tiny">' + esc(t("rules.lead")) + '</p><ul class="standing-rules">' +
      RULES.map(function (k) { return "<li>" + esc(t(k)) + "</li>"; }).join("") + '</ul><p class="tiny">' + esc(t("rules.after")) + "</p>";
  }
  function showRules() {
    dialog('<div class="standing-head">' + icon("check") + '<h2 id="standing-h">' + esc(t("rules.updateTitle")) + "</h2></div>" +
      "<p>" + esc(t("rules.updateLead")) + "</p>" + rulesList() +
      '<p class="tiny"><a href="terms/#rules" target="_blank" rel="noopener">' + esc(t("rules.read")) + "</a></p>" +
      '<label class="acct-rules"><input type="checkbox" id="standing-rules-ok" /> <span>' + esc(t("rules.agree")) + "</span></label>" +
      '<p class="acct-msg error" id="standing-err" role="alert" hidden></p>' +
      '<div class="modal-actions"><button class="btn" type="button" id="standing-agree" disabled>' + icon("check") + "<span>" + esc(t("rules.agreeBtn")) + "</span></button>" +
      '<button class="btn btn-ghost" type="button" id="standing-signout">' + icon("logout") + "<span>" + esc(t("rules.signOut")) + "</span></button></div>", true);
    $("standing-rules-ok").onchange = function () { $("standing-agree").disabled = !this.checked; };
    $("standing-agree").onclick = function () {
      var btn = this;
      btn.disabled = true;
      accept().then(closeDialog, function () { btn.disabled = false; var e = $("standing-err"); e.textContent = t("common.error"); e.hidden = false; });
    };
    $("standing-signout").onclick = function () { closeDialog(); SS.account.signOut(true); };
  }
  function accept() {
    return rpc("account_accept_rules", { p_version: RULES_VERSION }).then(function () { agreeHere(false); });
  }
  function agreedHere() { var v = null; try { v = sessionStorage.getItem(AGREE_KEY); } catch (e) { v = null; } return v === RULES_VERSION; }
  function agreeHere(on) { try { if (on) sessionStorage.setItem(AGREE_KEY, RULES_VERSION); else sessionStorage.removeItem(AGREE_KEY); } catch (e) { /* noop */ } }

  /* ── Admin Panel link (admins only) ───────────────────────────── */
  function showAdmin(on, count) {
    [].forEach.call(document.querySelectorAll("[data-admin-link]"), function (a) { a.hidden = !on; });
    [].forEach.call(document.querySelectorAll("[data-admin-count]"), function (c) {
      c.textContent = count > 99 ? "99+" : String(count || "");
      c.hidden = !on || !count;
    });
  }
  /** Asked per account (the admin function's "me") and remembered on the device: a yes for 5 minutes
      (it also brings the count of flags and appeals), a no for 6 hours. */
  function adminLink(force) {
    var user = signedIn() && SS.account.user();
    if (!user || !configured()) { showAdmin(false); return; }
    var c = get(localStorage, ADMIN_KEY);
    if (c && c.uid === user.id) showAdmin(!!c.admin, c.count);
    else showAdmin(false);
    if (!force && c && c.uid === user.id && Date.now() - c.at < (c.admin ? CHECK_MS : 216e5)) return;
    SS.account.client().then(function (cl) { return cl.auth.getSession(); }).then(function (r) {
      var tok = r.data && r.data.session && r.data.session.access_token;
      if (!tok) return null;
      return fetch(base() + "/functions/v1/admin", {
        method: "POST", body: JSON.stringify({ action: "me" }),
        headers: { authorization: "Bearer " + tok, apikey: CFG.supabaseAnonKey, "content-type": "application/json" },
      }).then(function (res) {
        // Only a definite answer is remembered (not a network hiccup or an undeployed function).
        if (res.status !== 200 && res.status !== 403) return;
        return res.json().catch(function () { return {}; }).then(function (j) {
          var yes = res.status === 200, n = yes ? (Number(j.open_flags) || 0) + (Number(j.open_appeals) || 0) : 0;
          put(localStorage, ADMIN_KEY, { uid: user.id, admin: yes, at: Date.now(), count: n });
          if (SS.account.user() && SS.account.user().id === user.id) showAdmin(yes, n);
        });
      });
    }).catch(function () { /* offline: try next time */ });
  }

  /* ── The Home banner ──────────────────────────────────────────── */
  function hashOf(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return String(h); }
  function drawNotice(n) {
    var el = $("app-notice");
    if (!el) return;
    var hidden = null;
    try { hidden = localStorage.getItem(HIDDEN_KEY); } catch (e) { hidden = null; }
    if (!n || !n.text || hidden === hashOf(n.text)) { el.hidden = true; el.innerHTML = ""; return; }
    el.className = "app-notice " + (n.tone || "info");
    el.innerHTML = icon(n.tone === "warn" ? "info" : n.tone === "celebrate" ? "sparkle" : "bell") + "<p>" + esc(n.text) + "</p>" +
      '<button class="icon-btn" type="button" aria-label="' + esc(t("notice.hide")) + '" title="' + esc(t("notice.hide")) + '">' + icon("x") + "</button>";
    el.hidden = false;
    el.querySelector("button").onclick = function () {
      try { localStorage.setItem(HIDDEN_KEY, hashOf(n.text)); } catch (e) { /* noop */ }
      el.hidden = true;
    };
  }
  function loadNotice(force) {
    if (!configured()) return;
    var c = get(localStorage, NOTICE_KEY);
    if (c) drawNotice(c.notice);
    if (!force && c && Date.now() - c.at < 10 * 60000) return;
    anon("app_notice_get").then(function (n) {
      put(localStorage, NOTICE_KEY, { at: Date.now(), notice: n || null });
      drawNotice(n);
    }, function () { /* offline: keep what's shown */ });
  }

  /* ── Wiring ───────────────────────────────────────────────────── */
  SS.standing = {
    RULES_VERSION: RULES_VERSION,
    /** Signing out or deleting the account on purpose: forget its ban on this device. */
    forget: function () { put(localStorage, BAN_KEY, null); applyRestriction(); },
    agreedHere: agreedHere,
    agreeHere: agreeHere,
    check: function () { lastCheck = 0; check(true); },
    rulesHtml: rulesList,
    /** The signed-in account is banned: its online features (sync, AI, MSA, Family) are off. */
    restricted: restricted,
    /** Before a page opens (js/app.js): true when it needs the account and the account is banned. */
    guard: guard,
  };
  SS.standingBoot = function () {
    if (!configured()) return;
    loadNotice(false);
    var bar = $("ban-bar");
    if (bar) bar.onclick = function () { var b = ban(); if (b) showBan(b); };
    document.addEventListener("ss:auth", function (e) {
      if (e.detail && e.detail.signedIn) {
        applyRestriction();
        if (agreedHere()) accept().catch(function () { /* asked again by check() */ });
        setTimeout(function () { check(true); }, 800);
        if (!restricted()) adminLink(true);
      } else {
        showAdmin(false);
        applyRestriction();
      }
    });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) return;
      check(false);
      if (!restricted()) adminLink(false);
      loadNotice(false);
    });
    setInterval(function () { if (!document.hidden) { check(false); if (!restricted()) adminLink(false); } }, CHECK_MS);
  };
})();
