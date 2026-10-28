/* SalaamStreet — standing.js (classic script, 3.0.2)
   An account's standing with SalaamStreet, on the website and in the iPhone app:
   • Bans: the device asks the server (account_status) when the app opens,
     when it comes back to the front and every few minutes. A banned account
     is signed out on this device at once and sees why: the Community Rules
     reason, the admin's message, when it ends, and an Appeal form. A
     banned account can't sign in any more, so the device keeps a copy of its
     last sign-in token (never sent anywhere else) and uses it to read the
     ban and appeal (account_notice / account_appeal). Signing out on purpose
     forgets it. Everything else keeps working as a guest.
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
  var TOKEN_KEY = "ss-standing";       // { rt, uid }: the last sign-in token, for the ban notice
  var AGREE_KEY = "ss-rules-agreed";   // sessionStorage: ticked in the sign-in dialog (survives the Google/Apple round trip)
  var ADMIN_KEY = "ss.adminCheck";     // { uid, admin, at, count }
  var NOTICE_KEY = "ss-notice";        // { at, notice }
  var HIDDEN_KEY = "ss-notice-hidden"; // the banner text someone hid
  var CHECK_MS = 5 * 60000;

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

  /* ── The sign-in token copy ───────────────────────────────────── */
  var hooked = false;
  function hook() {
    if (hooked || !configured() || !SS.account) return;
    hooked = true;
    SS.account.client().then(function (c) {
      c.auth.onAuthStateChange(function (event, session) {
        setTimeout(function () { onAuth(event, session); }, 0); // never call Supabase from inside this callback
      });
    }).catch(function () { hooked = false; });
  }
  function onAuth(event, session) {
    if (session && session.refresh_token && session.user) {
      put(localStorage, TOKEN_KEY, { rt: session.refresh_token, uid: session.user.id });
    } else if (!session && get(localStorage, TOKEN_KEY) && !showingBan()) {
      // Signed out without asking to (a ban, or the session ended): find out why.
      setTimeout(checkNotice, 300);
    }
  }

  /* ── Checking ─────────────────────────────────────────────────── */
  var lastCheck = 0, checking = false;
  function check(force) {
    if (!configured() || checking) return;
    if (!force && Date.now() - lastCheck < 30000) return;
    lastCheck = Date.now();
    if (!signedIn()) { if (get(localStorage, TOKEN_KEY)) checkNotice(); return; }
    checking = true;
    rpc("account_status").then(function (s) {
      checking = false;
      if (!s) return;
      if (s.banned) return kickOut(s);
      if (s.session_ended) return endedByAdmin();
      if (s.warnings && s.warnings.length) { showWarnings(s.warnings); return; }
      if (s.rules_version !== RULES_VERSION) {
        if (agreedHere()) accept().catch(function () { showRules(); });
        else showRules();
      }
    }, function (err) {
      checking = false;
      // A refused request while the token is still valid usually means a ban or an ended session: ask without it.
      if (err && (err.code === "42501" || /row-level security|permission/i.test(String(err.message)))) checkNotice();
    });
  }
  function checkNotice() {
    var saved = get(localStorage, TOKEN_KEY);
    if (!saved || !saved.rt || !configured()) return Promise.resolve(null);
    return anon("account_notice", { p_token: saved.rt }).then(function (n) {
      if (n && n.banned) {
        if (signedIn()) return kickOut(n);
        var typing = $("standing-appeal-text");
        if (!(showingBan() && typing && typing.value.trim())) showBan(n);
      } else if (!signedIn()) {
        put(localStorage, TOKEN_KEY, null); // not banned (or the ban was lifted): nothing to show
      }
      return n;
    }, function () { return null; /* offline: try again next time */ });
  }
  /** Banned: sign out on this device (keeping the token copy, to show the ban and appeal) and show why. */
  function kickOut(info) {
    var keep = get(localStorage, TOKEN_KEY);
    return Promise.resolve(SS.account.signOut(true)).then(function () {
      put(localStorage, TOKEN_KEY, keep);
      showBan(info);
    });
  }
  function endedByAdmin() {
    return Promise.resolve(SS.account.signOut(true)).then(function () { SS.toast(t("account.endedByAdmin")); });
  }

  /* ── The dialog ───────────────────────────────────────────────── */
  var locked = false; // the rules prompt can't be closed without an answer
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

  function showBan(b) {
    var ap = b.appeal, html =
      '<div class="standing-head ban">' + icon("lock") + '<h2 id="standing-h">' + esc(t("ban.title")) + "</h2></div>" +
      '<dl class="standing-dl"><div><dt>' + esc(t("ban.reason")) + "</dt><dd>" + esc(reasonLabel(b.reason)) + "</dd></div>" +
      (b.message ? "<div><dt>" + esc(t("ban.message")) + "</dt><dd>" + esc(b.message) + "</dd></div>" : "") +
      '</dl><p class="standing-when">' + icon("clock") + "<span>" + esc(b.until ? f("ban.until", { date: dateLabel(b.until) }) : t("ban.forever")) + "</span></p>" +
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
    html += '<p class="tiny standing-guest">' + esc(t("ban.guest")) + "</p>" +
      '<div class="modal-actions"><button class="btn btn-outline" type="button" id="standing-close">' + esc(t("ban.continue")) + "</button></div>";
    dialog(html, false);
    $("standing-close").onclick = closeDialog;
    var form = $("standing-appeal");
    if (form) form.onsubmit = function (e) {
      e.preventDefault();
      var text = $("standing-appeal-text").value.trim(), err = $("standing-err"), btn = $("standing-appeal-go");
      if (text.length < 10) { err.textContent = t("ban.appealPh"); err.hidden = false; return; }
      var saved = get(localStorage, TOKEN_KEY);
      btn.disabled = true;
      anon("account_appeal", { p_token: saved && saved.rt, p_text: text }).then(function (n) { showBan(n); }, function () {
        btn.disabled = false; err.textContent = t("ban.appealErr"); err.hidden = false;
      });
    };
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
    /** Signing out or deleting the account on purpose: no ban notice to keep. */
    forget: function () { put(localStorage, TOKEN_KEY, null); },
    agreedHere: agreedHere,
    agreeHere: agreeHere,
    check: function () { lastCheck = 0; check(true); },
    rulesHtml: rulesList,
  };
  SS.standingBoot = function () {
    if (!configured()) return;
    loadNotice(false);
    if (SS.account.hasStoredSession() || get(localStorage, TOKEN_KEY)) hook();
    if (!SS.account.hasStoredSession() && get(localStorage, TOKEN_KEY)) checkNotice();
    document.addEventListener("ss:auth", function (e) {
      if (e.detail && e.detail.signedIn) {
        hook();
        if (agreedHere()) accept().catch(function () { /* asked again by check() */ });
        setTimeout(function () { check(true); }, 800);
        adminLink(true);
      } else {
        showAdmin(false);
      }
    });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) return;
      check(false);
      adminLink(false);
      loadNotice(false);
    });
    setInterval(function () { if (!document.hidden) { check(false); adminLink(false); } }, CHECK_MS);
  };
})();
