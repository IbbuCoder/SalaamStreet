/* SalaamStreet — account.js (classic script)
   Update 2.5: optional free accounts + guest mode.

   • Guest mode is the default and is complete: nothing here ever blocks a
     feature, shows a pop-up, or nags. Sign-in lives on the Account page, the
     profile button in the top bar, the sidebar/More menu and Settings.
   • Auth is Supabase Auth: Apple, Google, phone (SMS code) and email (code or
     link). Sessions persist and refresh automatically. The Supabase client
     (js/vendor/supabase.js) is only downloaded when someone uses accounts.
   • Sync is js/sync.js; this file connects it to Supabase (pull/push,
     realtime) and to the UI (refreshing views when another device changes
     something).
   • The Account page is also a personal dashboard — streaks, continue
     reading, progress, bookmarks, saved duas — for guests and members alike. */
(function () {
  "use strict";
  window.SS = window.SS || {};
  var $ = function (id) { return document.getElementById(id); };
  function t(k) { return SS.i18n.t(k); }
  function f(k, v) { return SS.ui.f(k, v); }
  function esc(s) { return SS.esc(s); }
  function icon(n, c) { return SS.ui.icon(n, c); }
  var CFG = SS.CONFIG || {};
  var AUTH_KEY = "ss-auth"; // supabase-js session storage key (outside the data prefix on purpose)
  var RETURN_KEY = "ss-auth-return";

  /* ═══════════ Sync engine (always on, so guest data can migrate later) ═══════════ */
  var engine = new SS.SyncEngine({
    storage: {
      get: function (k) { return SS.store.get(k); },
      setSilent: SS.store.setSilent, removeSilent: SS.store.removeSilent, keys: SS.store.keys,
    },
    onApplied: function (keys) { onRemoteChange(keys); },
    onStatus: function () { renderStatus(); },
  });
  SS.store.watch = function (k) { return engine.watches(k); };
  SS.store.onWrite = function (k, oldV, newV) {
    if (engine.trackWrite(k, oldV, newV) && state.user) schedule(2000);
  };

  var state = { client: null, user: null, profile: null, channel: null, ready: false, lastError: null };
  var syncTimer = null, pollTimer = null;

  function configured() { return !!(CFG.supabaseUrl && CFG.supabaseAnonKey); }
  function methods() { return (CFG.signInMethods || ["apple", "google", "phone", "email"]).slice(); }
  function hasStoredSession() { try { return !!localStorage.getItem(AUTH_KEY); } catch (e) { return false; } }
  function urlHasAuthResult() { return /[?&](code|error|error_description)=/.test(location.search); }

  /* ── Lazy-load the Supabase client ─────────────────────────────── */
  var loading = null;
  function client() {
    if (state.client) return Promise.resolve(state.client);
    if (!configured()) return Promise.reject(new Error("not-configured"));
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      if (window.supabase && window.supabase.createClient) return resolve();
      var s = document.createElement("script");
      s.src = "js/vendor/supabase.js";
      s.onload = function () { resolve(); };
      s.onerror = function () { loading = null; reject(Object.assign(new Error("offline"), { offline: true })); };
      document.head.appendChild(s);
    }).then(function () {
      state.client = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
        auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: AUTH_KEY },
      });
      state.client.auth.onAuthStateChange(function (event, session) {
        // Never call Supabase from inside this callback (it can deadlock): defer.
        setTimeout(function () { onAuthChange(event, session); }, 0);
      });
      return state.client;
    });
    return loading;
  }

  /* ── Auth state ───────────────────────────────────────────────── */
  function onAuthChange(event, session) {
    var user = session && session.user;
    if (event === "SIGNED_OUT" || !user) {
      if (state.user) handleSignedOut();
      return;
    }
    var first = !state.user || state.user.id !== user.id;
    state.user = user;
    if (first) handleSignedIn(user);
    else { renderNav(); if (SS.currentView() === "account") render(); }
    if (event === "PASSWORD_RECOVERY") {
      // Opened the "reset password" email link: let them choose a new one.
      setTimeout(function () { if (dlgStep !== "merge") openDialog("newpass", { recovery: true }); }, 60);
    }
  }

  function handleSignedIn(user) {
    renderNav();
    if (engine.foreignOwner(user.id)) {
      // This device holds another account's data: ask before mixing it in.
      openDialog("merge");
    } else {
      startSession(user, true);
    }
    loadProfile();
    var ret = null;
    try { ret = sessionStorage.getItem(RETURN_KEY); sessionStorage.removeItem(RETURN_KEY); } catch (e) { /* noop */ }
    if (ret && /^#\//.test(ret) && location.hash !== ret) location.hash = ret;
    var dlg = $("acct-dialog");
    if (dlg && dlg.open && dlgStep !== "merge") dlg.close();
  }
  function startSession(user, announce) {
    var res = engine.beginSession(user.id);
    engine.backend = backend();
    subscribeRealtime(user.id);
    clearInterval(pollTimer);
    pollTimer = setInterval(function () { if (!document.hidden) schedule(0); }, 5 * 60000);
    engine.sync().then(function () {
      if (announce && res.migrated > 0) SS.toast(t("account.migrated"));
      else if (announce) SS.toast(f("account.welcome", { name: displayName() }));
    }).catch(function () { /* status shows it */ });
    if (SS.currentView() === "account") render();
  }
  function handleSignedOut() {
    state.user = null; state.profile = null;
    engine.backend = null;
    unsubscribeRealtime();
    clearInterval(pollTimer);
    clearTimeout(syncTimer);
    renderNav();
    if (SS.currentView() === "account" || SS.currentView() === "settings") SS.navigate(true);
  }

  /* ── Supabase backend for the sync engine ─────────────────────── */
  function asNetErr(err) {
    if (navigator.onLine === false || (err && /fetch|network|Failed to fetch|Load failed/i.test(String(err.message || err)))) {
      return Object.assign(new Error("offline"), { offline: true });
    }
    return err;
  }
  function backend() {
    return {
      pull: function (since) {
        var out = [], PAGE = 1000;
        function page(from) {
          var q = state.client.from("sync_records").select("col,key,value,t,deleted,server_at")
            .eq("user_id", state.user.id).order("server_at", { ascending: true }).range(from, from + PAGE - 1);
          if (since) q = q.gt("server_at", since);
          return q.then(function (r) {
            if (r.error) throw r.error;
            out = out.concat(r.data || []);
            return (r.data || []).length === PAGE ? page(from + PAGE) : out;
          });
        }
        return page(0).catch(function (e) { throw asNetErr(e); });
      },
      push: function (items) {
        var rejected = [], CHUNK = 500, i = 0;
        function next() {
          if (i >= items.length) return Promise.resolve(rejected);
          var batch = items.slice(i, i + CHUNK); i += CHUNK;
          return state.client.rpc("sync_push", { items: batch }).then(function (r) {
            if (r.error) throw r.error;
            rejected = rejected.concat(r.data || []);
            return next();
          });
        }
        return next().catch(function (e) { throw asNetErr(e); });
      },
    };
  }
  function schedule(ms) {
    if (!state.user) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () {
      if (navigator.onLine === false) { renderStatus(); return; }
      engine.sync().catch(function () { /* status shows it */ });
    }, ms);
  }
  function subscribeRealtime(uid) {
    unsubscribeRealtime();
    try {
      state.channel = state.client.channel("sync-" + uid)
        .on("postgres_changes", { event: "*", schema: "public", table: "sync_records", filter: "user_id=eq." + uid },
          function () { schedule(800); })
        .subscribe();
    } catch (e) { state.channel = null; /* polling still keeps devices in step */ }
  }
  function unsubscribeRealtime() {
    if (state.channel && state.client) { try { state.client.removeChannel(state.channel); } catch (e) { /* noop */ } }
    state.channel = null;
  }

  /* ── Another device changed something: refresh without interrupting ── */
  function onRemoteChange(keys) {
    var k = {}; keys.forEach(function (x) { k[x] = 1; });
    if (k.settings) {
      SS.applyTheme(); // instant, no flash (see SS.paintTheme)
      SS.applyQuranScale();
      var loc = SS.store.settings().locale;
      if (loc && loc !== SS.i18n.getLocale()) {
        SS.i18n.load(loc).then(function (code) {
          SS.i18n.setLocale(code); SS.updateLocaleToggle(); SS.applyTheme(); SS.audio.refreshLabel(); refreshView();
        });
        return;
      }
      if (SS.reminders && SS.reminders.schedule) { try { SS.reminders.schedule(); } catch (e) { /* noop */ } }
    }
    refreshView();
  }
  function refreshView() {
    var v = SS.currentView();
    if (v === "surah") {
      // Never re-render the reader under someone's eyes: just update marks.
      var bm = SS.store.get("quran:bookmarks", {}) || {};
      var btns = document.querySelectorAll("#sr-list [data-bm]");
      for (var i = 0; i < btns.length; i++) {
        var on = !!bm[SS.readerSurah + ":" + btns[i].getAttribute("data-bm")];
        btns[i].classList.toggle("fav-on", on);
        btns[i].setAttribute("aria-pressed", String(on));
      }
      return;
    }
    if (v === "dhikr" || v === "learn" || v === "qibla") return; // mid-activity views
    var open = document.querySelector("dialog[open]");
    if (open) return; // don't redraw behind a dialog
    SS.navigate(true);
  }

  /* ── Profile ──────────────────────────────────────────────────── */
  function loadProfile() {
    if (!state.client || !state.user) return;
    state.client.from("profiles").select("display_name").eq("id", state.user.id).maybeSingle().then(function (r) {
      if (!r.error && r.data) state.profile = r.data;
      renderNav();
      if (SS.currentView() === "account") render();
    });
  }
  function displayName() {
    var u = state.user || {}, md = u.user_metadata || {};
    return (state.profile && state.profile.display_name) || md.full_name || md.name ||
      (u.email ? u.email.split("@")[0] : "") || u.phone || t("account.member");
  }
  function contactLine() {
    var u = state.user || {};
    return u.email || (u.phone ? "+" + String(u.phone).replace(/^\+/, "") : "");
  }
  function initials(name) {
    var parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    var s = parts.length > 1 ? parts[0].charAt(0) + parts[parts.length - 1].charAt(0) : (parts[0] || "?").slice(0, 2);
    return s.toUpperCase();
  }

  /* ── Errors in plain words ────────────────────────────────────── */
  function authError(err) {
    var m = String((err && (err.message || err.error_description || err.msg)) || err || "");
    var code = err && (err.code || err.error_code);
    if ((err && err.offline) || navigator.onLine === false || /Failed to fetch|NetworkError|Load failed/i.test(m)) return t("account.errOffline");
    if (code === "over_email_send_rate_limit" || code === "over_sms_send_rate_limit" || code === "over_request_rate_limit" || /rate limit|too many/i.test(m) || (err && err.status === 429)) return t("account.errRate");
    if (code === "invalid_credentials" || /invalid login credentials/i.test(m)) return t("account.errLogin");
    if (code === "user_already_exists" || code === "email_exists" || /user already registered/i.test(m)) return t("account.errExists");
    if (code === "weak_password" || /password should be|password is too weak|weak password/i.test(m)) return t("account.errWeak");
    if (code === "email_not_confirmed" || /email not confirmed/i.test(m)) return t("account.errNotConfirmed");
    if (code === "same_password") return t("account.errSamePassword");
    if (code === "otp_expired" || /expired|invalid.*(otp|token|code)|token has expired/i.test(m)) return t("account.errCode");
    if (/provider is not enabled|unsupported (\w+ )?provider|not enabled/i.test(m) || code === "provider_disabled" || code === "phone_provider_disabled" || code === "email_provider_disabled") return t("account.errProvider");
    if (/manual linking/i.test(m) || code === "manual_linking_disabled") return t("account.errLinking");
    if (code === "identity_already_exists" || /already (been )?(linked|registered|exists)|already in use/i.test(m)) return t("account.errInUse");
    if (code === "single_identity_not_deletable") return t("account.errLastMethod");
    if (/signups? not allowed/i.test(m) || code === "signup_disabled") return t("account.errSignups");
    if (/invalid.*phone|phone.*invalid/i.test(m) || code === "validation_failed" && /phone/i.test(m)) return t("account.errPhone");
    if (/invalid.*email|email.*invalid/i.test(m) || code === "email_address_invalid") return t("account.errEmail");
    if (m === "not-configured") return t("account.notConfigured");
    return m || t("common.error");
  }

  /* ═══════════ Auth actions ═══════════ */
  function returnUrl() { return location.origin + location.pathname; }
  function rememberReturn() {
    try { sessionStorage.setItem(RETURN_KEY, location.hash && location.hash !== "#/" ? location.hash : "#/account"); } catch (e) { /* noop */ }
  }
  function oauth(provider, link) {
    rememberReturn();
    return client().then(function (c) {
      var opts = { provider: provider, options: { redirectTo: returnUrl() } };
      return (link ? c.auth.linkIdentity(opts) : c.auth.signInWithOAuth(opts)).then(function (r) {
        if (r.error) throw r.error;
        // The browser now leaves for Apple/Google and comes back signed in.
      });
    });
  }
  function normPhone(raw) {
    var s = String(raw || "").replace(/[\s().-]/g, "");
    if (/^00\d/.test(s)) s = "+" + s.slice(2);
    return /^\+[1-9]\d{6,14}$/.test(s) ? s : null;
  }
  function normEmail(raw) {
    var s = String(raw || "").trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? s : null;
  }
  /* Email + password */
  function passwordSignIn(email, password) {
    return client().then(function (c) {
      return c.auth.signInWithPassword({ email: email, password: password }).then(function (r) { if (r.error) throw r.error; return r.data; });
    });
  }
  function passwordSignUp(email, password) {
    rememberReturn();
    return client().then(function (c) {
      return c.auth.signUp({ email: email, password: password, options: { emailRedirectTo: returnUrl() } }).then(function (r) {
        if (r.error) throw r.error;
        return r.data; // .session is null when Supabase wants the email confirmed first
      });
    });
  }
  function sendPasswordReset(email) {
    return client().then(function (c) {
      return c.auth.resetPasswordForEmail(email, { redirectTo: returnUrl() }).then(function (r) { if (r.error) throw r.error; });
    });
  }
  function setPassword(password) {
    return client().then(function (c) {
      return c.auth.updateUser({ password: password }).then(function (r) { if (r.error) throw r.error; });
    });
  }
  var MIN_PASSWORD = 8;

  function sendCode(kind, target) {
    rememberReturn();
    return client().then(function (c) {
      var p = kind === "email"
        ? c.auth.signInWithOtp({ email: target, options: { shouldCreateUser: true, emailRedirectTo: returnUrl() } })
        : c.auth.signInWithOtp({ phone: target, options: { shouldCreateUser: true, channel: "sms" } });
      return p.then(function (r) { if (r.error) throw r.error; });
    });
  }
  function verifyCode(kind, target, code, change) {
    return client().then(function (c) {
      var type = kind === "email" ? (change ? "email_change" : "email") : (change ? "phone_change" : "sms");
      var args = { token: code, type: type };
      args[kind === "email" ? "email" : "phone"] = target;
      return c.auth.verifyOtp(args).then(function (r) { if (r.error) throw r.error; return r.data; });
    });
  }
  function addContact(kind, target) {
    return client().then(function (c) {
      var attrs = {}; attrs[kind] = target;
      return c.auth.updateUser(attrs, kind === "email" ? { emailRedirectTo: returnUrl() } : undefined).then(function (r) { if (r.error) throw r.error; });
    });
  }

  /** Sign out. keepData=true leaves this device's copy as guest data. */
  function signOut(keepData) {
    var flush = state.user && engine.pendingCount() && navigator.onLine !== false
      ? Promise.race([engine.sync().catch(function () {}), new Promise(function (r) { setTimeout(r, 4000); })])
      : Promise.resolve();
    return flush.then(function () {
      return state.client ? state.client.auth.signOut({ scope: "local" }).catch(function () {}) : null;
    }).then(function () {
      engine.endSession(!!keepData);
      handleSignedOut();
      if (!keepData) {
        SS.applyTheme(); SS.applyQuranScale();
      }
    });
  }
  function deleteAccount() {
    return client().then(function (c) {
      return c.rpc("delete_account").then(function (r) {
        if (r.error) throw r.error;
        return c.auth.signOut({ scope: "local" }).catch(function () {});
      });
    }).then(function () {
      engine.endSession(true); // the device keeps its copy as guest data
      var m = engine.meta(); m.prevOwner = null; engine.saveMeta(m);
      handleSignedOut();
    });
  }

  /* ═══════════ Dialog (sign-in, codes, linking, merge, sign-out, delete) ═══════════ */
  var dlgStep = null, dlgCtx = {}, resendTimer = null;
  var ICON_FOR = { apple: "apple", google: "google", phone: "phone", email: "mail" };

  function openDialog(step, ctx) {
    var dlg = $("acct-dialog");
    if (!dlg || typeof dlg.showModal !== "function") return;
    if (!dlg._wired) {
      dlg._wired = true;
      // The merge question must be answered: sync can't start without it.
      dlg.addEventListener("cancel", function (e) { if (dlgStep === "merge") e.preventDefault(); });
      dlg.addEventListener("close", function () {
        clearInterval(resendTimer);
        if (dlgStep === "merge" && state.user && engine.meta().owner !== state.user.id) {
          setTimeout(function () { openDialog("merge"); }, 0);
        }
      });
    }
    dlgCtx = ctx || {};
    showStep(step);
    var x = dlg.querySelector(".modal-head [data-close]");
    if (x) x.hidden = step === "merge";
    if (!dlg.open) SS.openDialog(dlg);
  }
  function busy(btn, on) {
    if (!btn) return;
    btn.disabled = on;
    btn.setAttribute("aria-busy", String(on));
  }
  function setMsg(text, kind) {
    var el = $("acct-msg");
    if (!el) return;
    el.textContent = text || "";
    el.className = "acct-msg" + (kind ? " " + kind : "");
    el.hidden = !text;
  }
  function methodButton(m, link) {
    var label = t((link ? "account.link." : "account.with.") + m);
    return '<button class="btn acct-method acct-' + m + '" type="button" data-method="' + m + '">' +
      icon(ICON_FOR[m]) + "<span>" + esc(label) + "</span></button>";
  }

  function showStep(step) {
    // Email is the only method switched on: skip the one-button list.
    if (step === "methods" && methods().length === 1 && methods()[0] === "email") { dlgCtx = { mode: "signin" }; step = "password"; }
    dlgStep = step;
    clearInterval(resendTimer);
    var h = $("acct-h"), body = $("acct-body"), html = "";
    var c = dlgCtx;
    if (step === "methods") {
      h.textContent = t("account.signInTitle");
      html = '<p class="muted">' + esc(t("account.signInSub")) + "</p>" +
        '<div class="acct-methods mt-2">' + methods().map(function (m) { return methodButton(m, false); }).join("") + "</div>" +
        '<p class="acct-msg" id="acct-msg" role="alert" hidden></p>' +
        '<p class="tiny mt-2">' + esc(t("account.guestNote")) + "</p>" +
        '<p class="tiny mt-1">' + esc(t("account.privacyNote")) + "</p>";
    } else if (step === "password") {
      var signup = c.mode === "signup";
      h.textContent = t(signup ? "account.pwSignUpTitle" : "account.pwSignInTitle");
      html = '<div class="segmented acct-pw-tabs" role="group" aria-label="' + esc(t("account.with.email")) + '">' +
        '<button type="button" data-mode="signin" aria-pressed="' + !signup + '">' + esc(t("account.pwSignInTab")) + "</button>" +
        '<button type="button" data-mode="signup" aria-pressed="' + signup + '">' + esc(t("account.pwSignUpTab")) + "</button></div>" +
        '<form id="acct-form" class="mt-2" novalidate>' +
        '<div class="field"><label for="acct-email">' + esc(t("account.emailLabel")) + "</label>" +
        '<input class="input" id="acct-email" type="email" autocomplete="email" inputmode="email" placeholder="you@example.com" required value="' + esc(c.target || "") + '" /></div>' +
        '<div class="field mt-1"><label for="acct-pass">' + esc(t("account.passwordLabel")) + "</label>" +
        '<input class="input" id="acct-pass" type="password" autocomplete="' + (signup ? "new-password" : "current-password") + '" minlength="' + MIN_PASSWORD + '" required /></div>' +
        '<label class="acct-check tiny mt-1"><input type="checkbox" id="acct-show" /> <span>' + esc(t("account.showPassword")) + "</span></label>" +
        (signup ? '<p class="tiny mt-1">' + esc(f("account.passwordHint", { n: MIN_PASSWORD })) + "</p>" : "") +
        '<p class="acct-msg" id="acct-msg" role="alert" hidden></p>' +
        '<div class="modal-actions"><button class="btn" type="submit" id="acct-submit">' + esc(t(signup ? "account.pwSignUpBtn" : "account.pwSignInBtn")) + "</button>" +
        (signup ? "" : '<button class="btn btn-ghost" type="button" id="acct-forgot">' + esc(t("account.forgot")) + "</button>") +
        '<button class="btn btn-ghost" type="button" id="acct-use-link">' + esc(t("account.useLink")) + "</button>" +
        (methods().length > 1 ? '<button class="btn btn-ghost" type="button" data-back>' + esc(t("account.otherMethods")) + "</button>" : "") +
        "</div></form>" +
        (methods().length > 1 ? "" : '<p class="tiny mt-2">' + esc(t("account.guestNote")) + '</p><p class="tiny mt-1">' + esc(t("account.privacyNote")) + "</p>");
    } else if (step === "forgot") {
      h.textContent = t("account.forgotTitle");
      html = '<form id="acct-form" novalidate><p class="muted">' + esc(t("account.forgotSub")) + "</p>" +
        '<div class="field mt-2"><label for="acct-email">' + esc(t("account.emailLabel")) + "</label>" +
        '<input class="input" id="acct-email" type="email" autocomplete="email" inputmode="email" required value="' + esc(c.target || "") + '" /></div>' +
        '<p class="acct-msg" id="acct-msg" role="alert" hidden></p>' +
        '<div class="modal-actions"><button class="btn" type="submit" id="acct-submit">' + esc(t("account.forgotBtn")) + "</button>" +
        '<button class="btn btn-ghost" type="button" data-back>' + esc(t("account.backToSignIn")) + "</button></div></form>";
    } else if (step === "newpass") {
      h.textContent = t(c.recovery ? "account.newPassTitle" : "account.setPassTitle");
      html = '<form id="acct-form" novalidate><p class="muted">' + esc(f("account.passwordHint", { n: MIN_PASSWORD })) + "</p>" +
        '<div class="field mt-2"><label for="acct-pass">' + esc(t("account.newPasswordLabel")) + "</label>" +
        '<input class="input" id="acct-pass" type="password" autocomplete="new-password" minlength="' + MIN_PASSWORD + '" required /></div>' +
        '<label class="acct-check tiny mt-1"><input type="checkbox" id="acct-show" /> <span>' + esc(t("account.showPassword")) + "</span></label>" +
        '<p class="acct-msg" id="acct-msg" role="alert" hidden></p>' +
        '<div class="modal-actions"><button class="btn" type="submit" id="acct-submit">' + esc(t("account.savePassword")) + "</button>" +
        '<button class="btn btn-ghost" type="button" data-close>' + esc(t("common.cancel")) + "</button></div></form>";
    } else if (step === "notice") {
      h.textContent = c.title;
      html = '<p class="muted">' + esc(c.text) + "</p>" +
        '<div class="modal-actions"><button class="btn" type="button" data-back>' + esc(t("account.backToSignIn")) + "</button></div>";
    } else if (step === "email" || step === "phone" || step === "addEmail" || step === "addPhone") {
      var isEmail = step === "email" || step === "addEmail";
      var adding = step === "addEmail" || step === "addPhone";
      h.textContent = t(adding ? (isEmail ? "account.addEmailTitle" : "account.addPhoneTitle") : (isEmail ? "account.emailTitle" : "account.phoneTitle"));
      html = '<form id="acct-form" novalidate>' +
        '<p class="muted">' + esc(t(isEmail ? "account.emailSub" : "account.phoneSub")) + "</p>" +
        '<div class="field mt-2"><label for="acct-input">' + esc(t(isEmail ? "account.emailLabel" : "account.phoneLabel")) + "</label>" +
        '<input class="input" id="acct-input" ' + (isEmail
          ? 'type="email" autocomplete="email" inputmode="email" placeholder="you@example.com"'
          : 'type="tel" autocomplete="tel" inputmode="tel" placeholder="+1 555 123 4567"') +
        ' required value="' + esc(c.target || "") + '" /></div>' +
        (isEmail ? "" : '<p class="tiny mt-1">' + esc(t("account.phoneHint")) + "</p>") +
        '<p class="acct-msg" id="acct-msg" role="alert" hidden></p>' +
        '<div class="modal-actions"><button class="btn" type="submit" id="acct-submit">' + esc(t("account.sendCode")) + "</button>" +
        (adding ? "" : '<button class="btn btn-ghost" type="button" data-back>' + esc(t("account.otherMethods")) + "</button>") +
        "</div></form>";
    } else if (step === "code") {
      h.textContent = t("account.codeTitle");
      html = '<form id="acct-form" novalidate>' +
        '<p class="muted">' + esc(f(c.kind === "email" ? "account.codeSentEmail" : "account.codeSentPhone", { to: c.target })) + "</p>" +
        '<div class="field mt-2"><label for="acct-input">' + esc(t("account.codeLabel")) + "</label>" +
        '<input class="input acct-code" id="acct-input" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="10" required placeholder="123456" /></div>' +
        '<p class="acct-msg" id="acct-msg" role="alert" hidden></p>' +
        '<div class="modal-actions"><button class="btn" type="submit" id="acct-submit">' + esc(t("account.verify")) + "</button>" +
        '<button class="btn btn-outline" type="button" id="acct-resend" disabled></button>' +
        '<button class="btn btn-ghost" type="button" data-back>' + esc(t(c.kind === "email" ? "account.changeEmail" : "account.changePhone")) + "</button></div></form>";
    } else if (step === "merge") {
      h.textContent = t("account.mergeTitle");
      html = '<p class="muted">' + esc(t("account.mergeBody")) + "</p>" +
        '<div class="modal-actions"><button class="btn" type="button" id="acct-merge-yes">' + esc(t("account.mergeYes")) + "</button>" +
        '<button class="btn btn-outline" type="button" id="acct-merge-no">' + esc(t("account.mergeNo")) + "</button></div>";
    } else if (step === "signout") {
      h.textContent = t("account.signOutTitle");
      html = '<p class="muted">' + esc(t("account.signOutBody")) + "</p>" +
        (engine.pendingCount() && navigator.onLine === false ? '<p class="note mt-1">' + esc(t("account.signOutPending")) + "</p>" : "") +
        '<div class="modal-actions"><button class="btn" type="button" id="acct-so-keep">' + esc(t("account.signOutKeep")) + "</button>" +
        '<button class="btn btn-outline" type="button" id="acct-so-wipe">' + esc(t("account.signOutWipe")) + "</button>" +
        '<button class="btn btn-ghost" type="button" data-close>' + esc(t("common.cancel")) + "</button></div>";
    } else if (step === "delete") {
      h.textContent = t("account.deleteTitle");
      html = '<p class="muted">' + esc(t("account.deleteBody")) + "</p>" +
        '<label class="acct-check mt-2"><input type="checkbox" id="acct-del-ok" /> <span>' + esc(t("account.deleteConfirm")) + "</span></label>" +
        '<p class="acct-msg" id="acct-msg" role="alert" hidden></p>' +
        '<div class="modal-actions"><button class="btn btn-danger" type="button" id="acct-del-go" disabled>' + icon("trash") + "<span>" + esc(t("account.deleteBtn")) + "</span></button>" +
        '<button class="btn btn-ghost" type="button" data-close>' + esc(t("common.cancel")) + "</button></div>";
    }
    body.innerHTML = html;
    wireStep(step);
    var first = body.querySelector("input:not([type=checkbox]), .acct-method, .btn");
    if (first) setTimeout(function () { try { first.focus(); } catch (e) { /* noop */ } }, 40);
  }

  function wireStep(step) {
    var body = $("acct-body"), c = dlgCtx;
    var back = body.querySelector("[data-back]");
    if (back) back.onclick = function () {
      if (step === "code") showStep(c.adding ? (c.kind === "email" ? "addEmail" : "addPhone") : c.kind);
      else if (step === "forgot" || step === "notice" || (step === "email" && methods().length === 1)) { dlgCtx = { mode: "signin", target: c.target }; showStep("password"); }
      else showStep("methods");
    };
    var show = $("acct-show");
    if (show) show.onchange = function () { $("acct-pass").type = this.checked ? "text" : "password"; };
    if (step === "password") {
      body.querySelector(".acct-pw-tabs").onclick = function (e) {
        var b = e.target.closest("[data-mode]");
        if (!b) return;
        dlgCtx = { mode: b.getAttribute("data-mode"), target: $("acct-email").value.trim() };
        showStep("password");
      };
      if ($("acct-forgot")) $("acct-forgot").onclick = function () { dlgCtx = { target: $("acct-email").value.trim() }; showStep("forgot"); };
      $("acct-use-link").onclick = function () { dlgCtx = { target: $("acct-email").value.trim() }; showStep("email"); };
      $("acct-form").onsubmit = function (e) {
        e.preventDefault();
        var email = normEmail($("acct-email").value), pass = $("acct-pass").value;
        if (!email) { setMsg(t("account.errEmail"), "error"); $("acct-email").focus(); return; }
        if (c.mode === "signup" && pass.length < MIN_PASSWORD) { setMsg(t("account.errWeak"), "error"); $("acct-pass").focus(); return; }
        if (!pass) { setMsg(t("account.errLogin"), "error"); $("acct-pass").focus(); return; }
        var btn = $("acct-submit");
        busy(btn, true); setMsg(t(c.mode === "signup" ? "account.creating" : "account.signingIn"));
        if (c.mode === "signup") {
          passwordSignUp(email, pass).then(function (d) {
            if (!d.session) { // Supabase is set to confirm emails first
              dlgCtx = { title: t("account.confirmTitle"), text: f("account.confirmBody", { to: email }), target: email };
              showStep("notice");
            } // otherwise signed in → onAuthStateChange closes the dialog
          }).catch(function (err) { busy(btn, false); setMsg(authError(err), "error"); });
        } else {
          passwordSignIn(email, pass).catch(function (err) { busy(btn, false); setMsg(authError(err), "error"); });
        }
      };
    }
    if (step === "forgot") {
      $("acct-form").onsubmit = function (e) {
        e.preventDefault();
        var email = normEmail($("acct-email").value);
        if (!email) { setMsg(t("account.errEmail"), "error"); return; }
        var btn = $("acct-submit");
        busy(btn, true); setMsg(t("account.sending"));
        sendPasswordReset(email).then(function () {
          dlgCtx = { title: t("account.forgotSentTitle"), text: f("account.forgotSent", { to: email }), target: email };
          showStep("notice");
        }).catch(function (err) { busy(btn, false); setMsg(authError(err), "error"); });
      };
    }
    if (step === "newpass") {
      $("acct-form").onsubmit = function (e) {
        e.preventDefault();
        var pass = $("acct-pass").value;
        if (pass.length < MIN_PASSWORD) { setMsg(t("account.errWeak"), "error"); return; }
        var btn = $("acct-submit");
        busy(btn, true);
        setPassword(pass).then(function () {
          $("acct-dialog").close();
          SS.toast(t("account.passwordSaved"));
        }).catch(function (err) { busy(btn, false); setMsg(authError(err), "error"); });
      };
    }
    if (step === "methods") {
      body.querySelector(".acct-methods").onclick = function (e) {
        var b = e.target.closest("[data-method]");
        if (!b) return;
        var m = b.getAttribute("data-method");
        if (m === "email") { dlgCtx = { mode: "signin" }; showStep("password"); return; }
        if (m === "phone") { dlgCtx = {}; showStep(m); return; }
        busy(b, true); setMsg("");
        oauth(m, false).catch(function (err) { busy(b, false); setMsg(authError(err), "error"); });
      };
    }
    if (step === "email" || step === "phone" || step === "addEmail" || step === "addPhone") {
      var isEmail = step === "email" || step === "addEmail";
      var adding = step === "addEmail" || step === "addPhone";
      $("acct-form").onsubmit = function (e) {
        e.preventDefault();
        var raw = $("acct-input").value;
        var target = isEmail ? normEmail(raw) : normPhone(raw);
        if (!target) { setMsg(t(isEmail ? "account.errEmail" : "account.errPhone"), "error"); $("acct-input").focus(); return; }
        var btn = $("acct-submit");
        busy(btn, true); setMsg(t("account.sending"));
        var kind = isEmail ? "email" : "phone";
        (adding ? addContact(kind, target) : sendCode(kind, target)).then(function () {
          dlgCtx = { kind: kind, target: target, adding: adding, sentAt: Date.now() };
          showStep("code");
        }).catch(function (err) { busy(btn, false); setMsg(authError(err), "error"); });
      };
    }
    if (step === "code") {
      var input = $("acct-input"), resend = $("acct-resend");
      input.oninput = function () { this.value = this.value.replace(/\D/g, "").slice(0, 10); };
      function tickResend() {
        var left = Math.max(0, 60 - Math.round((Date.now() - (c.sentAt || 0)) / 1000));
        resend.disabled = left > 0;
        resend.textContent = left > 0 ? f("account.resendIn", { s: left }) : t("account.resend");
        if (!left) clearInterval(resendTimer);
      }
      tickResend();
      resendTimer = setInterval(tickResend, 1000);
      resend.onclick = function () {
        busy(resend, true);
        (c.adding ? addContact(c.kind, c.target) : sendCode(c.kind, c.target)).then(function () {
          c.sentAt = Date.now(); setMsg(t("account.codeResent")); tickResend(); clearInterval(resendTimer); resendTimer = setInterval(tickResend, 1000);
        }).catch(function (err) { setMsg(authError(err), "error"); }).finally(function () { resend.removeAttribute("aria-busy"); tickResend(); });
      };
      $("acct-form").onsubmit = function (e) {
        e.preventDefault();
        var code = input.value.replace(/\D/g, "");
        if (code.length < 6) { setMsg(t("account.errCode"), "error"); return; }
        var btn = $("acct-submit");
        busy(btn, true); setMsg(t("account.verifying"));
        verifyCode(c.kind, c.target, code, c.adding).then(function () {
          if (c.adding) {
            SS.toast(t("account.methodAdded"));
            $("acct-dialog").close();
            refreshUser();
          }
          // Sign-in completes through onAuthStateChange (closes the dialog).
        }).catch(function (err) { busy(btn, false); setMsg(authError(err), "error"); input.select(); });
      };
    }
    if (step === "merge") {
      $("acct-merge-yes").onclick = function () { dlgStep = null; $("acct-dialog").close(); if (state.user) startSession(state.user, true); };
      $("acct-merge-no").onclick = function () {
        engine.resetLocal();
        dlgStep = null;
        $("acct-dialog").close();
        if (state.user) startSession(state.user, false);
        SS.applyTheme();
      };
    }
    if (step === "signout") {
      $("acct-so-keep").onclick = function () { busy(this, true); signOut(true).then(done); };
      $("acct-so-wipe").onclick = function () { busy(this, true); signOut(false).then(done); };
      var done = function () { $("acct-dialog").close(); SS.toast(t("account.signedOut")); };
    }
    if (step === "delete") {
      $("acct-del-ok").onchange = function () { $("acct-del-go").disabled = !this.checked; };
      $("acct-del-go").onclick = function () {
        var btn = this;
        busy(btn, true); setMsg(t("account.deleting"));
        deleteAccount().then(function () {
          $("acct-dialog").close();
          SS.toast(t("account.deleted"));
        }).catch(function (err) { busy(btn, false); setMsg(authError(err), "error"); });
      };
    }
  }
  function refreshUser() {
    if (!state.client) return;
    state.client.auth.getUser().then(function (r) {
      if (r.data && r.data.user) { state.user = r.data.user; renderNav(); if (SS.currentView() === "account") render(); }
    });
  }

  /* ═══════════ Navigation affordances (quiet, never pushy) ═══════════ */
  function renderNav() {
    var btn = $("account-btn"), av = $("account-avatar");
    if (!btn || !av) return;
    if (state.user) {
      var name = displayName();
      av.innerHTML = '<span class="av-letters" aria-hidden="true">' + esc(initials(name)) + "</span>";
      btn.classList.add("signed-in");
      btn.setAttribute("aria-label", f("account.navSignedIn", { name: name }));
      btn.title = name;
    } else {
      av.innerHTML = icon("user");
      btn.classList.remove("signed-in");
      btn.setAttribute("aria-label", t("account.navGuest"));
      btn.title = t("account.navGuest");
    }
    var st = $("st-account");
    if (st) renderSettingsCard(st);
  }

  /* ═══════════ Sync status ═══════════ */
  function statusInfo() {
    if (!state.user) return { cls: "guest", icon: "user", text: t("account.statusGuest") };
    var s = engine.status, m = engine.meta();
    if (navigator.onLine === false) return { cls: "offline", icon: "wifi-off", text: engine.pendingCount() ? t("account.statusOfflinePending") : t("account.statusOffline") };
    if (s === "syncing") return { cls: "busy", icon: "refresh", text: t("account.statusSyncing") };
    if (s === "error") return { cls: "error", icon: "x", text: t("account.statusError") };
    if (s === "offline") return { cls: "offline", icon: "wifi-off", text: t("account.statusOfflinePending") };
    if (m.lastSync) return { cls: "ok", icon: "check", text: f("account.statusSynced", { when: ago(m.lastSync) }) };
    return { cls: "busy", icon: "refresh", text: t("account.statusSyncing") };
  }
  function ago(ms) {
    var s = Math.round((Date.now() - ms) / 1000);
    if (s < 45) return t("account.justNow");
    var mins = Math.round(s / 60);
    if (mins < 60) return f("account.minsAgo", { n: mins });
    try { return new Date(ms).toLocaleString(SS.i18n.dateLocale(), { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" }); } catch (e) { return ""; }
  }
  function statusHtml() {
    var s = statusInfo();
    return '<span class="sync-pill ' + s.cls + '" role="status">' + icon(s.icon) + "<span>" + esc(s.text) + "</span></span>";
  }
  function renderStatus() {
    var els = document.querySelectorAll("[data-sync-status]");
    for (var i = 0; i < els.length; i++) els[i].innerHTML = statusHtml();
    var retry = $("ac-sync-now");
    if (retry) retry.disabled = engine.status === "syncing";
  }

  /* ═══════════ Settings card ═══════════ */
  function renderSettingsCard(el) {
    if (state.user) {
      el.innerHTML = '<a class="card widget" href="#/account">' +
        '<span class="w-ic acct-av">' + esc(initials(displayName())) + "</span>" +
        '<span class="w-body"><span class="w-title">' + esc(displayName()) + '</span><span class="w-sub" data-sync-status>' + statusHtml() + "</span></span>" +
        icon("chev-r", "chev") + "</a>";
    } else {
      el.innerHTML = '<a class="card widget" href="#/account">' +
        '<span class="w-ic">' + icon("cloud") + "</span>" +
        '<span class="w-body"><span class="w-title">' + esc(t("account.settingsTitle")) + '</span><span class="w-sub wrap-text">' + esc(t("account.settingsSub")) + "</span></span>" +
        icon("chev-r", "chev") + "</a>";
    }
  }

  /* ═══════════ Account page: personal dashboard ═══════════ */
  var bmQuery = "", bmFolder = "all", bmSort = "recent", bmEditing = null;

  function prayerLongest() {
    var log = SS.store.get("prayers:log", {}) || {}, FIVE = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
    var days = Object.keys(log).filter(function (d) { return FIVE.every(function (p) { return log[d] && log[d][p]; }); }).sort();
    var best = 0, run = 0, prev = null;
    days.forEach(function (d) {
      var dt = new Date(d + "T12:00:00");
      run = prev && Math.round((dt - prev) / 86400000) === 1 ? run + 1 : 1;
      best = Math.max(best, run);
      prev = dt;
    });
    return best;
  }
  function quranProgress() {
    var prog = SS.store.get("quran:progress", {}) || {}, read = 0, done = 0;
    for (var i = 0; i < SS.SURAHS.length; i++) {
      var s = SS.SURAHS[i], a = Math.min(+prog[s.n] || 0, s.ayahs);
      read += a;
      if (a >= s.ayahs) done++;
    }
    return { ayahs: read, pct: read / 6236 * 100, surahs: done };
  }
  function folders() {
    var list = SS.store.get("quran:folders", []) || [], seen = {};
    list.forEach(function (x) { seen[x] = 1; });
    var bm = SS.store.get("quran:bookmarks", {}) || {};
    for (var k in bm) if (bm[k] && bm[k].folder && !seen[bm[k].folder]) { seen[bm[k].folder] = 1; list.push(bm[k].folder); }
    return list.sort(function (a, b) { return a.localeCompare(b); });
  }

  function profileCard() {
    if (!state.user) {
      var ok = configured();
      return '<article class="card acct-hero guest">' +
        '<div class="acct-hero-top"><span class="acct-av big">' + icon("user") + "</span>" +
        '<div><h2 class="h-sm">' + esc(t("account.guestTitle")) + '</h2><p class="muted">' + esc(t("account.guestSub")) + "</p></div></div>" +
        '<ul class="acct-benefits mt-2">' +
        ["account.benefit1", "account.benefit2", "account.benefit3"].map(function (k) { return "<li>" + icon("check") + "<span>" + esc(t(k)) + "</span></li>"; }).join("") +
        "</ul>" +
        (ok ? '<div class="row wrap mt-2"><button class="btn" type="button" id="ac-signin">' + icon("user") + "<span>" + esc(t("account.signInBtn")) + "</span></button></div>" +
          '<p class="tiny mt-1">' + esc(t("account.freeForever")) + "</p>"
          : '<p class="note mt-2">' + esc(t("account.notConfigured")) + "</p>") +
        "</article>";
    }
    var name = displayName();
    return '<article class="card acct-hero">' +
      '<div class="acct-hero-top"><span class="acct-av big">' + esc(initials(name)) + "</span>" +
      '<div class="acct-id"><h2 class="h-sm" id="ac-name">' + esc(name) + "</h2>" +
      '<p class="muted" dir="ltr">' + esc(contactLine()) + "</p></div>" +
      '<button class="icon-btn" type="button" id="ac-edit-name" aria-label="' + esc(t("account.editName")) + '">' + icon("edit") + "</button></div>" +
      '<form class="row wrap mt-1" id="ac-name-form" hidden><label class="visually-hidden" for="ac-name-input">' + esc(t("account.nameLabel")) + "</label>" +
      '<input class="input" id="ac-name-input" maxlength="80" autocomplete="name" value="' + esc(name) + '" />' +
      '<button class="btn btn-sm" type="submit">' + esc(t("common.save")) + '</button><button class="btn btn-ghost btn-sm" type="button" id="ac-name-cancel">' + esc(t("common.cancel")) + "</button></form>" +
      '<div class="row wrap mt-2 acct-sync"><span data-sync-status>' + statusHtml() + "</span>" +
      '<button class="btn btn-outline btn-sm" type="button" id="ac-sync-now">' + icon("refresh") + "<span>" + esc(t("account.syncNow")) + "</span></button></div>" +
      "</article>";
  }

  function statsCard() {
    var dk = SS.ui.liveStreak(), pCur = SS.tracker ? SS.tracker.streak() : 0, pBest = Math.max(prayerLongest(), pCur);
    function tile(n, label, sub, href) {
      return '<a class="acct-stat" href="' + href + '"><b>' + n + "</b><span>" + esc(label) + "</span>" + (sub ? '<small>' + esc(sub) + "</small>" : "") + "</a>";
    }
    return '<article class="card"><div class="card-title"><h2>' + esc(t("account.streaks")) + "</h2></div>" +
      '<div class="acct-stats">' +
      tile(pCur, t("account.prayerStreak"), f("account.best", { n: pBest }), "#/prayer") +
      tile(dk.current, t("account.dhikrStreak"), f("account.best", { n: dk.longest }), "#/dhikr") +
      tile(Math.max(pBest, dk.longest), t("account.longestStreak"), t("account.days"), "#/dhikr") +
      "</div></article>";
  }

  function readingCard() {
    var last = SS.store.get("quran:lastRead"), p = quranProgress(), plan = SS.store.get("quran:plan");
    var html = '<article class="card"><div class="card-title"><h2>' + esc(t("account.reading")) + "</h2></div>";
    if (last && SS.SURAHS[last.surah - 1]) {
      var s = SS.SURAHS[last.surah - 1];
      html += '<a class="widget acct-continue" href="#/surah/' + last.surah + "/" + last.ayah + '">' +
        '<span class="w-ic">' + icon("book") + "</span>" +
        '<span class="w-body"><span class="w-title">' + esc(t("dash.continueReading")) + "</span>" +
        '<span class="w-sub">' + esc(SS.ui.surahName(s) + " · " + last.surah + ":" + last.ayah) + (last.at ? " · " + esc(ago(last.at)) : "") + "</span></span>" +
        '<span class="btn btn-sm">' + esc(t("quran.resume")) + "</span></a>";
    } else {
      html += '<a class="widget acct-continue" href="#/quran"><span class="w-ic">' + icon("book") + "</span>" +
        '<span class="w-body"><span class="w-title">' + esc(t("dash.startReading")) + '</span><span class="w-sub">' + esc(t("dash.startReadingSub")) + "</span></span></a>";
    }
    var pct = Math.min(100, p.pct);
    html += '<div class="acct-progress mt-2"><div class="row-between"><span>' + esc(t("account.quranRead")) + "</span><b>" + (pct < 10 ? pct.toFixed(1) : Math.round(pct)) + "%</b></div>" +
      '<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(pct) + '" aria-label="' + esc(t("account.quranRead")) + '"><span style="inline-size:' + pct + '%"></span></div>' +
      '<p class="tiny">' + esc(f("account.progressDetail", { a: p.ayahs, s: p.surahs })) + "</p></div>";
    if (plan && plan.days) {
      var pp = Math.min(100, (plan.done || 0) / plan.days * 100);
      html += '<div class="acct-progress mt-2"><div class="row-between"><span>' + esc(f("account.planN", { n: plan.days })) + "</span><b>" + (plan.done || 0) + " / " + plan.days + "</b></div>" +
        '<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(pp) + '" aria-label="' + esc(f("account.planN", { n: plan.days })) + '"><span style="inline-size:' + pp + '%"></span></div></div>';
    }
    var recent = (SS.store.get("quran:recent", []) || []).filter(function (r) { return r && SS.SURAHS[r.surah - 1]; }).slice(0, 6);
    if (recent.length) {
      html += '<h3 class="acct-sub mt-2">' + esc(t("account.recent")) + '</h3><div class="acct-recent">';
      recent.forEach(function (r) {
        var s = SS.SURAHS[r.surah - 1];
        html += '<a class="chip" href="#/surah/' + r.surah + "/" + r.ayah + '"><bdi>' + esc(SS.ui.surahName(s)) + "</bdi> · " + r.surah + ":" + r.ayah + "</a>";
      });
      html += "</div>";
    }
    return html + "</article>";
  }

  function bookmarkList() {
    var bm = SS.store.get("quran:bookmarks", {}) || {}, q = bmQuery.trim().toLowerCase();
    var keys = Object.keys(bm).filter(function (k) {
      var p = k.split(":"), s = SS.SURAHS[+p[0] - 1], b = bm[k] || {};
      if (!s) return false;
      if (bmFolder === "none" && b.folder) return false;
      if (bmFolder !== "all" && bmFolder !== "none" && b.folder !== bmFolder) return false;
      if (!q) return true;
      return [s.en, s.ar, s.meaning, k, b.note || "", b.folder || "", String(s.n)].join(" ").toLowerCase().indexOf(q) > -1;
    });
    keys.sort(function (x, y) {
      if (bmSort === "mushaf") { var a = x.split(":"), c = y.split(":"); return (+a[0] - +c[0]) || (+a[1] - +c[1]); }
      return ((bm[y] || {}).at || 0) - ((bm[x] || {}).at || 0);
    });
    return { bm: bm, keys: keys, total: Object.keys(bm).length };
  }

  function bookmarksCard() {
    var fl = folders(), data = bookmarkList();
    var html = '<article class="card" id="ac-bm-card"><div class="card-title"><h2>' + esc(t("account.bookmarks")) + '</h2><span class="badge">' + data.total + "</span></div>";
    if (!data.total) {
      return html + '<div class="state state-inline"><span class="s-ic">' + icon("bookmark") + "</span><p>" + esc(t("account.noBookmarks")) + "</p>" +
        '<a class="btn btn-outline btn-sm" href="#/quran">' + esc(t("account.openQuran")) + "</a></div></article>";
    }
    html += '<div class="acct-bm-tools"><div class="search"><svg class="ic" aria-hidden="true"><use href="#i-search"/></svg>' +
      '<label class="visually-hidden" for="ac-bm-q">' + esc(t("account.searchBookmarks")) + "</label>" +
      '<input class="input" id="ac-bm-q" type="search" placeholder="' + esc(t("account.searchBookmarks")) + '" value="' + esc(bmQuery) + '" autocomplete="off" /></div>' +
      '<label class="visually-hidden" for="ac-bm-sort">' + esc(t("account.sort")) + "</label>" +
      '<select class="input input-sm" id="ac-bm-sort"><option value="recent"' + (bmSort === "recent" ? " selected" : "") + ">" + esc(t("account.sortRecent")) + "</option>" +
      '<option value="mushaf"' + (bmSort === "mushaf" ? " selected" : "") + ">" + esc(t("account.sortMushaf")) + "</option></select></div>";
    html += '<div class="acct-folders mt-1" role="group" aria-label="' + esc(t("account.collections")) + '">' +
      folderChip("all", t("account.allBookmarks")) + folderChip("none", t("account.unsorted")) +
      fl.map(function (x) { return folderChip(x, x); }).join("") +
      '<button class="chip" type="button" id="ac-folder-new">' + icon("plus") + "<span>" + esc(t("account.newCollection")) + "</span></button></div>";
    html += '<div class="stack mt-1" id="ac-bm-list">' + bookmarkRows(data, fl) + "</div></article>";
    return html;
  }
  function folderChip(id, label) {
    return '<button class="chip" type="button" data-folder="' + esc(id) + '" aria-pressed="' + (bmFolder === id) + '">' + esc(label) + "</button>";
  }
  function bookmarkRows(data, fl) {
    if (!data.keys.length) return '<p class="tiny center mt-1">' + esc(t("account.noMatches")) + "</p>";
    return data.keys.map(function (k) {
      var p = k.split(":"), s = SS.SURAHS[+p[0] - 1], b = data.bm[k] || {};
      if (bmEditing === k) {
        return '<form class="card acct-bm editing" data-edit-form="' + esc(k) + '">' +
          '<b>' + esc(SS.ui.surahName(s)) + " · " + esc(k) + "</b>" +
          '<div class="field"><label for="ac-bm-note">' + esc(t("account.note")) + '</label><textarea class="input" id="ac-bm-note" rows="2" maxlength="500">' + esc(b.note || "") + "</textarea></div>" +
          '<div class="field"><label for="ac-bm-folder">' + esc(t("account.collection")) + '</label><select class="input" id="ac-bm-folder"><option value="">' + esc(t("account.unsorted")) + "</option>" +
          fl.map(function (x) { return '<option value="' + esc(x) + '"' + (b.folder === x ? " selected" : "") + ">" + esc(x) + "</option>"; }).join("") + "</select></div>" +
          '<div class="row wrap"><button class="btn btn-sm" type="submit">' + esc(t("common.save")) + '</button><button class="btn btn-ghost btn-sm" type="button" data-edit-cancel>' + esc(t("common.cancel")) + "</button></div></form>";
      }
      return '<div class="card widget acct-bm">' +
        '<span class="w-ic gold">' + icon("bookmark") + "</span>" +
        '<a class="w-body" href="#/surah/' + p[0] + "/" + p[1] + '">' +
        '<span class="w-title">' + esc(SS.ui.surahName(s)) + " · " + esc(k) + "</span>" +
        '<span class="w-sub">' + esc(SS.i18n.isAr() ? s.en : s.meaning) + (b.folder ? ' · <span class="badge">' + esc(b.folder) + "</span>" : "") + "</span>" +
        (b.note ? '<span class="acct-note">' + esc(b.note) + "</span>" : "") + "</a>" +
        '<button class="icon-btn" type="button" data-bm-edit="' + esc(k) + '" aria-label="' + esc(t("account.editBookmark") + " " + k) + '">' + icon("edit") + "</button>" +
        '<button class="icon-btn" type="button" data-bm-del="' + esc(k) + '" aria-label="' + esc(t("quran.removeBookmark") + " " + k) + '">' + icon("trash") + "</button></div>";
    }).join("");
  }
  function rerenderBookmarks(keepFocus) {
    var card = $("ac-bm-card");
    if (!card) return;
    var wrap = document.createElement("div");
    wrap.innerHTML = bookmarksCard();
    card.parentNode.replaceChild(wrap.firstChild, card);
    wireBookmarks();
    if (keepFocus && $("ac-bm-q")) { var q = $("ac-bm-q"); q.focus(); try { q.setSelectionRange(q.value.length, q.value.length); } catch (e) { /* noop */ } }
  }
  function wireBookmarks() {
    var card = $("ac-bm-card");
    if (!card) return;
    if ($("ac-bm-q")) $("ac-bm-q").oninput = function () {
      bmQuery = this.value;
      $("ac-bm-list").innerHTML = bookmarkRows(bookmarkList(), folders());
    };
    if ($("ac-bm-sort")) $("ac-bm-sort").onchange = function () { bmSort = this.value; $("ac-bm-list").innerHTML = bookmarkRows(bookmarkList(), folders()); };
    card.onclick = function (e) {
      var fb = e.target.closest("[data-folder]");
      if (fb) { bmFolder = fb.getAttribute("data-folder"); rerenderBookmarks(); return; }
      if (e.target.closest("#ac-folder-new")) {
        var name = (window.prompt(t("account.newCollectionPrompt")) || "").trim().slice(0, 40);
        if (!name) return;
        var list = SS.store.get("quran:folders", []) || [];
        if (list.indexOf(name) === -1) { list.push(name); SS.store.set("quran:folders", list.sort()); }
        bmFolder = name; rerenderBookmarks(); return;
      }
      var ed = e.target.closest("[data-bm-edit]");
      if (ed) { bmEditing = ed.getAttribute("data-bm-edit"); rerenderBookmarks(); var n = $("ac-bm-note"); if (n) n.focus(); return; }
      if (e.target.closest("[data-edit-cancel]")) { bmEditing = null; rerenderBookmarks(); return; }
      var del = e.target.closest("[data-bm-del]");
      if (del) {
        var key = del.getAttribute("data-bm-del"), bm = SS.store.get("quran:bookmarks", {}) || {};
        delete bm[key];
        SS.store.set("quran:bookmarks", bm);
        SS.toast(t("quran.bookmarkRemoved"));
        rerenderBookmarks();
      }
    };
    var form = card.querySelector("[data-edit-form]");
    if (form) form.onsubmit = function (e) {
      e.preventDefault();
      var key = form.getAttribute("data-edit-form"), bm = SS.store.get("quran:bookmarks", {}) || {};
      if (!bm[key]) { bmEditing = null; rerenderBookmarks(); return; }
      var entry = Object.assign({}, bm[key]);
      var note = $("ac-bm-note").value.trim(), folder = $("ac-bm-folder").value;
      if (note) entry.note = note; else delete entry.note;
      if (folder) entry.folder = folder; else delete entry.folder;
      bm[key] = entry;
      SS.store.set("quran:bookmarks", bm);
      bmEditing = null;
      SS.toast(t("settings.saved"));
      rerenderBookmarks();
    };
  }

  function savedCard() {
    var favs = SS.store.get("duas:favorites", {}) || {}, list = [];
    (SS.DUAS || []).forEach(function (d) { if (favs[d.id]) list.push(d); });
    var html = '<article class="card"><div class="card-title"><h2>' + esc(t("account.savedDuas")) + '</h2><span class="badge">' + list.length + "</span></div>";
    if (!list.length) return html + '<p class="tiny">' + esc(t("account.noSavedDuas")) + ' <a href="#/duas">' + esc(t("nav.duas")) + "</a></p></article>";
    html += '<div class="stack">';
    list.slice(0, 6).forEach(function (d) {
      html += '<a class="widget acct-dua" href="#/duas/favs"><span class="w-ic gold">' + icon("heart") + '</span><span class="w-body"><span class="w-title wrap-text">' +
        esc((SS.i18n.isAr() && d.titleAr) || d.titleEn) + '</span><span class="w-sub">' + esc(d.source || "") + "</span></span></a>";
    });
    if (list.length > 6) html += '<a class="btn btn-ghost btn-sm" href="#/duas/favs">' + esc(f("account.seeAll", { n: list.length })) + "</a>";
    return html + "</div></article>";
  }

  function manageCard() {
    if (!state.user) {
      return '<article class="card"><div class="card-title"><h2>' + esc(t("account.whatSyncs")) + "</h2></div>" +
        '<p class="tiny">' + esc(t("account.whatSyncsBody")) + "</p>" +
        '<p class="tiny mt-1">' + esc(t("account.guestData")) + "</p></article>";
    }
    var ids = (state.user.identities || []).map(function (i) { return i.provider; });
    var has = function (p) { return ids.indexOf(p) > -1; };
    var rows = methods().map(function (m) {
      var on = has(m);
      var detail = m === "email" ? (state.user.email || "") : m === "phone" ? (state.user.phone ? "+" + String(state.user.phone).replace(/^\+/, "") : "") : identityEmail(m);
      return '<div class="set-row"><span class="acct-mrow">' + icon(ICON_FOR[m]) + "<span><b>" + esc(t("account.method." + m)) + "</b>" +
        (on && detail ? '<small dir="ltr">' + esc(detail) + "</small>" : "") + "</span></span>" +
        (on
          ? (ids.length > 1 && (m === "google" || m === "apple")
            ? '<button class="btn btn-ghost btn-sm" type="button" data-unlink="' + m + '">' + esc(t("account.unlink")) + "</button>"
            : '<span class="badge">' + icon("check") + " " + esc(t("account.connected")) + "</span>")
          : '<button class="btn btn-outline btn-sm" type="button" data-link="' + m + '">' + icon("link") + "<span>" + esc(t("account.add")) + "</span></button>") +
        "</div>";
    }).join("");
    return '<article class="card"><div class="card-title"><h2>' + esc(t("account.manage")) + "</h2></div>" +
      '<h3 class="acct-sub">' + esc(t("account.methods")) + '</h3><p class="tiny">' + esc(t("account.methodsHelp")) + "</p>" +
      '<div class="settings-group acct-methods-list mt-1" id="ac-methods">' + rows + "</div>" +
      '<p class="acct-msg" id="ac-methods-msg" role="alert" hidden></p>' +
      '<h3 class="acct-sub mt-2">' + esc(t("account.whatSyncs")) + '</h3><p class="tiny">' + esc(t("account.whatSyncsBody")) + "</p>" +
      '<div class="row wrap mt-2">' +
      '<a class="btn btn-outline btn-sm" href="#/settings">' + icon("settings") + "<span>" + esc(t("nav.settings")) + "</span></a>" +
      '<button class="btn btn-outline btn-sm" type="button" id="ac-password">' + icon("edit") + "<span>" + esc(t("account.setPassTitle")) + "</span></button>" +
      '<button class="btn btn-outline btn-sm" type="button" id="ac-signout">' + icon("logout") + "<span>" + esc(t("account.signOut")) + "</span></button>" +
      '<button class="btn btn-danger btn-sm" type="button" id="ac-delete">' + icon("trash") + "<span>" + esc(t("account.deleteBtn")) + "</span></button></div>" +
      "</article>";
  }
  function identityEmail(provider) {
    var ids = (state.user && state.user.identities) || [];
    for (var i = 0; i < ids.length; i++) if (ids[i].provider === provider) return (ids[i].identity_data && ids[i].identity_data.email) || "";
    return "";
  }

  function render() {
    var root = $("ac-root");
    if (!root) return;
    $("ac-sub").textContent = state.user ? t("account.subMember") : t("account.subGuest");
    root.innerHTML =
      '<div class="acct-grid">' +
      '<div class="acct-col">' + profileCard() + statsCard() + readingCard() + "</div>" +
      '<div class="acct-col">' + bookmarksCard() + savedCard() + manageCard() + "</div>" +
      "</div>";
    wire();
    wireBookmarks();
  }
  function wire() {
    if ($("ac-signin")) $("ac-signin").onclick = function () { openDialog("methods"); };
    if ($("ac-sync-now")) $("ac-sync-now").onclick = function () {
      engine.sync().then(function () { SS.toast(t("account.syncedToast")); }).catch(function (err) {
        SS.toast(err && err.offline ? t("account.errOffline") : t("account.statusError"));
      });
      renderStatus();
    };
    if ($("ac-edit-name")) $("ac-edit-name").onclick = function () {
      $("ac-name-form").hidden = false; this.hidden = true; $("ac-name-input").focus();
    };
    if ($("ac-name-cancel")) $("ac-name-cancel").onclick = function () { render(); };
    if ($("ac-name-form")) $("ac-name-form").onsubmit = function (e) {
      e.preventDefault();
      var name = $("ac-name-input").value.trim().slice(0, 80);
      if (!name || !state.client) return;
      state.client.from("profiles").upsert({ id: state.user.id, display_name: name, updated_at: new Date().toISOString() }).then(function (r) {
        if (r.error) { SS.toast(authError(r.error)); return; }
        state.profile = { display_name: name };
        renderNav(); render();
        SS.toast(t("settings.saved"));
      });
    };
    if ($("ac-signout")) $("ac-signout").onclick = function () { openDialog("signout"); };
    if ($("ac-password")) $("ac-password").onclick = function () { openDialog("newpass", {}); };
    if ($("ac-delete")) $("ac-delete").onclick = function () { openDialog("delete"); };
    var ml = $("ac-methods");
    if (ml) ml.onclick = function (e) {
      var msg = $("ac-methods-msg");
      var l = e.target.closest("[data-link]");
      if (l) {
        var m = l.getAttribute("data-link");
        if (m === "email") { openDialog("addEmail"); return; }
        if (m === "phone") { openDialog("addPhone"); return; }
        busy(l, true);
        oauth(m, true).catch(function (err) { busy(l, false); msg.hidden = false; msg.className = "acct-msg error"; msg.textContent = authError(err); });
        return;
      }
      var u = e.target.closest("[data-unlink]");
      if (u) {
        var p = u.getAttribute("data-unlink");
        if (!window.confirm(f("account.unlinkConfirm", { m: t("account.method." + p) }))) return;
        var ident = ((state.user && state.user.identities) || []).filter(function (i) { return i.provider === p; })[0];
        if (!ident) return;
        busy(u, true);
        state.client.auth.unlinkIdentity(ident).then(function (r) {
          if (r.error) throw r.error;
          SS.toast(t("account.methodRemoved"));
          refreshUser();
        }).catch(function (err) { busy(u, false); msg.hidden = false; msg.className = "acct-msg error"; msg.textContent = authError(err); });
      }
    };
  }

  function accountInit() {
    render();
    // Visiting the page is the moment to make sure we know who's signed in.
    if (configured() && !state.user && hasStoredSession()) boot();
    if (state.user) schedule(0);
  }

  /* ═══════════ Boot ═══════════ */
  var booted = false;
  function boot() {
    if (!configured()) return;
    var res = urlHasAuthResult();
    if (!hasStoredSession() && !res) return; // a guest: don't download anything
    if (booted) return;
    booted = true;
    client().then(function (c) {
      return c.auth.getSession().then(function (r) {
        if (res) {
          var p = new URLSearchParams(location.search);
          var err = p.get("error_description") || p.get("error");
          try { history.replaceState(null, "", location.pathname + (location.hash || "#/account")); } catch (e) { /* noop */ }
          if (err && !(r.data && r.data.session)) {
            SS.toast(authError({ message: err }));
            location.hash = "#/account";
          }
        }
        if (r.data && r.data.session) onAuthChange("INITIAL_SESSION", r.data.session);
      });
    }).catch(function (err) {
      booted = false;
      if (err && err.offline && hasStoredSession()) renderStatus(); // try again when back online
    });
  }

  SS.account = {
    signedIn: function () { return !!state.user; },
    user: function () { return state.user; },
    configured: configured,
    openSignIn: function () { openDialog("methods"); },
    signOut: signOut,
    syncNow: function () { return state.user ? engine.sync() : Promise.resolve([]); },
    engine: engine,
  };
  SS.views.account = accountInit;
  SS.accountBoot = function () {
    renderNav();
    boot();
    window.addEventListener("online", function () { if (!booted) boot(); schedule(500); renderStatus(); });
    window.addEventListener("offline", renderStatus);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && state.user && Date.now() - (engine.meta().lastSync || 0) > 30000) schedule(0);
    });
    // Keep "Synced · 3 min ago" honest while the page is open.
    setInterval(function () { if (state.user && !document.hidden) renderStatus(); }, 30000);
  };
  // Settings shows the account card at the top.
  var prevSettings = SS.hooks && SS.hooks.settingsInit;
  SS.hooks = SS.hooks || {};
  SS.hooks.settingsInit = function () {
    if (prevSettings) prevSettings.apply(null, arguments);
    var st = $("st-account");
    if (st) renderSettingsCard(st);
  };
})();
