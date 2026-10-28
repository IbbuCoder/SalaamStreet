/* SalaamStreet — admin.js (classic script, loaded only on #/admin)
   The Admin Panel (3.0.1), on the website and in the iPhone app, over one Edge
   Function (backend/functions/admin):
   • Overview — accounts, sign-ups by day, how people sign in, what they use,
     SalaamStreet AI today, the newest accounts, and anything flagged.
   • Users — search and filter every account; open one to see what it uses
     (counts only, never what anyone wrote) and to ban, unban, sign out
     everywhere, flag, pause SalaamStreet AI for it, or delete it.
   • Flags — sign-ups whose email or name contains a listed word, accounts
     flagged by hand, and SalaamStreet AI warnings and pauses; plus the word
     list and the switch that refuses matching sign-ups outright.
   • AI — SalaamStreet AI's main switches and limits (the Lab, #/lab, has the rest).
   • MSA — the NVHS MSA's numbers and latest posts (take one down if needed).
   • Admins — who can open this panel (each signs in with Google).
   • Log — every admin action: who, when, to which account.

   • Hiding the page is NOT the protection: every request carries the
     person's own Supabase session token and the server decides
     (backend/functions/admin/core.js and the public.admin_* database
     functions, which check the admin list again). This page only shows what
     the server returns. English only, like the AI Testing Lab.
   • Routes: #/admin, #/admin/<tab>, #/admin/user/<id> (opens one account). */
(function () {
  "use strict";
  window.SS = window.SS || {};
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return SS.esc(s); }
  function icon(n) { return SS.ui.icon(n); }
  var CFG = SS.CONFIG || {};

  var TABS = [
    ["overview", "Overview", "grid"], ["users", "Users", "users"], ["flags", "Flags", "info"], ["ai", "AI", "sparkle"],
    ["msa", "MSA", "mosque"], ["admins", "Admins", "lock"], ["log", "Log", "scroll"],
  ];
  var FILTERS = [["all", "All"], ["flagged", "Flagged"], ["banned", "Banned"], ["new", "New (7 days)"], ["never", "Never signed in"],
    ["unconfirmed", "Unconfirmed"], ["admins", "Admins"]];
  var ACTION_LABEL = {
    ban: "Banned", unban: "Unbanned", sign_out: "Signed out everywhere", "delete": "Deleted account", flag_add: "Flagged",
    flag_dismiss: "Dismissed flag", flag_reopen: "Reopened flag", ai_pause: "Paused SalaamStreet AI", ai_restore: "Restored SalaamStreet AI",
    screening: "Changed sign-up screening", word_add: "Added a screened word", word_remove: "Removed a screened word",
    admin_add: "Added an admin", admin_remove: "Removed an admin", ai_settings: "Changed AI settings",
    msa_post_delete: "Took down an MSA post", denied: "Refused (not an admin)",
  };

  var st = { ready: false, me: null, tab: "overview", users: null, q: { search: "", filter: "all" }, log: null, showWords: false, openId: "" };

  /* ── Server ───────────────────────────────────────────────────── */
  function fnUrl() { return CFG.supabaseUrl.replace(/\/+$/, "") + "/functions/v1/admin"; }
  function accessToken() {
    if (!SS.account || !SS.account.configured()) return Promise.resolve("");
    SS.account.restore();
    if (!SS.account.signedIn() && !SS.account.hasStoredSession()) return Promise.resolve("");
    return SS.account.client().then(function (c) { return c.auth.getSession(); })
      .then(function (r) { return (r.data && r.data.session && r.data.session.access_token) || ""; }, function () { return ""; });
  }
  /** POST to the Edge Function. Always resolves to { ok, error?, message?, http }. */
  function api(action, extra) {
    return accessToken().then(function (tok) {
      if (!tok) return { ok: false, error: "signed_out", http: 401 };
      return fetch(fnUrl(), {
        method: "POST",
        headers: { authorization: "Bearer " + tok, apikey: CFG.supabaseAnonKey, "content-type": "application/json" },
        body: JSON.stringify(Object.assign({ action: action }, extra || {})),
      }).then(function (r) {
        return r.text().then(function (txt) {
          var j = null;
          try { j = JSON.parse(txt); } catch (e) { j = null; }
          if (!j || typeof j.ok !== "boolean") {
            return { ok: false, http: r.status, error: r.status === 404 ? "not_deployed" : "bad_response",
              message: r.status === 404 ? "The admin function isn't deployed yet. Run Actions → Deploy Supabase (backend/README-backend.md)."
                : "The server sent an unexpected reply (HTTP " + r.status + ")." };
          }
          j.http = r.status;
          return j;
        });
      }, function () {
        return { ok: false, error: "unreachable", http: 0,
          message: navigator.onLine === false ? "You're offline. The Admin Panel needs a connection." : "Couldn't reach the server. Check your connection and try again." };
      });
    });
  }

  /* ── Formatting ───────────────────────────────────────────────── */
  function int(n) { return n == null ? "—" : Number(n).toLocaleString("en-US"); }
  function money(n) {
    if (n == null || isNaN(n)) return "—";
    return Number(n) === 0 ? "$0.00" : n < 0.01 ? "$" + Number(n).toFixed(4) : "$" + Number(n).toFixed(2);
  }
  function when(iso) {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }); } catch (e) { return String(iso); }
  }
  function ago(iso) {
    if (!iso) return "never";
    var s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (isNaN(s)) return "—";
    if (s < 0) return "in " + until(iso);
    if (s < 60) return "just now";
    if (s < 3600) return Math.round(s / 60) + " min ago";
    if (s < 86400) return Math.round(s / 3600) + " h ago";
    if (s < 86400 * 30) return Math.round(s / 86400) + " days ago";
    return when(iso);
  }
  function until(iso) {
    var d = (new Date(iso).getTime() - Date.now()) / 86400000;
    if (d > 3650) return "until unbanned";
    return d >= 1 ? Math.round(d) + " days" : Math.max(1, Math.round(d * 24)) + " h";
  }
  function who(u) { return u.email || (u.phone ? "+" + String(u.phone).replace(/^\+/, "") : "(no email)"); }
  /** "nigger" → "n••••r": screened words are shown masked unless "Show words" is on. */
  function mask(w) {
    w = String(w || "");
    if (st.showWords || w.length < 3) return w;
    return w.charAt(0) + new Array(w.length - 1).join("•") + w.charAt(w.length - 1);
  }
  function provider(p) { return { google: "Google", apple: "Apple", email: "Email", phone: "Phone" }[p] || (p ? p.charAt(0).toUpperCase() + p.slice(1) : "—"); }
  function badge(cls, text) { return '<span class="badge ' + cls + '">' + esc(text) + "</span>"; }
  function stat(label, value, cls) { return "<div" + (cls ? ' class="' + cls + '"' : "") + "><dt>" + esc(label) + "</dt><dd>" + esc(value) + "</dd></div>"; }
  function badges(u) {
    return (u.admin ? badge("badge-ok", "Admin") : "") + (u.flagged ? badge("badge-warn", "Flagged") : "") +
      (u.banned_until ? badge("badge-danger", "Banned · " + until(u.banned_until)) : "") +
      (u.confirmed === false ? badge("badge-muted", "Unconfirmed") : "");
  }
  function userRow(u, extra) {
    var initial = (who(u).replace(/^\+/, "").charAt(0) || "?").toUpperCase();
    return '<button class="adm-user" type="button" data-user="' + esc(u.id) + '">' +
      '<span class="adm-av" aria-hidden="true">' + esc(initial) + "</span>" +
      '<span class="adm-user-main"><span class="adm-user-top"><b>' + esc(who(u)) + "</b>" + badges(u) + "</span>" +
      '<span class="muted adm-user-sub">' + esc(provider(u.provider) + " · joined " + ago(u.created_at) + " · last sign-in " + ago(u.last_sign_in_at)) +
        (extra ? " · " + extra : "") + "</span></span>" + icon("chev-r") + "</button>";
  }

  /* ── Shell ────────────────────────────────────────────────────── */
  function shell() {
    var root = $("admin-root");
    if (root.getAttribute("data-built")) return;
    root.setAttribute("data-built", "1");
    root.innerHTML =
      '<header class="page-head lab-head"><span class="lab-logo" aria-hidden="true">' + icon("lock") + "</span>" +
      '<div><h1 id="adm-h" tabindex="-1">Admin Panel</h1><p>Private · admins only. Every change is recorded in the Log.</p></div></header>' +
      '<div id="adm-gate" aria-live="polite"></div>' +
      '<div id="adm-app" class="stack" hidden>' +
        '<nav class="adm-tabs" aria-label="Admin sections">' + TABS.map(function (t) {
          return '<a class="chip" href="#/admin/' + t[0] + '" data-tab="' + t[0] + '">' + icon(t[2]) + "<span>" + t[1] + '</span><span class="adm-count" data-count="' + t[0] + '" hidden></span></a>';
        }).join("") + "</nav>" +
        '<p class="lab-err" id="adm-err" role="alert" hidden></p>' +
        '<div id="adm-panel" class="stack" aria-live="polite"></div>' +
      "</div>";
    $("adm-panel").addEventListener("click", onPanelClick);
    $("adm-panel").addEventListener("submit", onPanelSubmit);
    $("adm-panel").addEventListener("change", onPanelChange);
    $("admin-dialog").addEventListener("close", function () {
      if (this.open) return; // closed and opened again (another account) before this event arrived
      st.openId = "";
      if (/^#\/admin\/user\//.test(location.hash)) try { history.replaceState(null, "", "#/admin/users"); } catch (e) { /* file:// */ }
    });
  }
  function gate(kind, msg) {
    var g = $("adm-gate");
    $("adm-app").hidden = kind !== "ok";
    if (kind === "ok") { g.innerHTML = ""; return; }
    var html = '<div class="card lab-gate"><p>' + esc(msg) + "</p>";
    if (kind === "signin") html += '<button class="btn" id="adm-signin" type="button">' + icon("google") + "<span>Sign in with Google</span></button>";
    if (kind === "denied") html += '<button class="btn btn-outline" id="adm-switch" type="button">' + icon("logout") + "<span>Use another account</span></button>";
    if (kind === "retry") html += '<button class="btn btn-outline" id="adm-retry" type="button">' + icon("refresh") + "<span>Try again</span></button>";
    g.innerHTML = html + "</div>";
    if ($("adm-signin")) $("adm-signin").onclick = function () { SS.account.openSignIn(); waitForSignIn(); };
    if ($("adm-switch")) $("adm-switch").onclick = function () {
      Promise.resolve(SS.account.signOut()).then(function () { gate("signin", "Sign in with your admin Google account."); waitForSignIn(); });
    };
    if ($("adm-retry")) $("adm-retry").onclick = start;
  }
  var waitTimer = 0;
  function waitForSignIn() {
    clearInterval(waitTimer);
    waitTimer = setInterval(function () {
      if (SS.currentView() !== "admin") return clearInterval(waitTimer);
      if (SS.account.signedIn()) { clearInterval(waitTimer); start(); }
    }, 800);
  }
  function showErr(msg) { var e = $("adm-err"); if (!e) return; e.textContent = msg || ""; e.hidden = !msg; }
  /** A failed request: sign-in problems go back to the gate; anything else shows above the panel. */
  function failed(r) {
    if (r.error === "signed_out" || r.error === "invalid_session") { st.ready = false; gate("signin", "Your sign-in has ended. Sign in again with your admin Google account."); waitForSignIn(); return; }
    if (r.error === "forbidden") { st.ready = false; gate("denied", r.message || "This account can't use the Admin Panel."); remember(false); return; }
    showErr(r.message || "Something went wrong. Try again.");
  }
  /** Settings shows the Admin Panel link only to admins (js/app.js reads this). */
  function remember(isAdmin) {
    var u = SS.account && SS.account.user();
    try { localStorage.setItem("ss.adminCheck", JSON.stringify({ uid: u ? u.id : "", admin: !!isAdmin, at: Date.now() })); } catch (e) { /* private mode */ }
  }
  function start() {
    if (!CFG.supabaseUrl || !CFG.supabaseAnonKey) { gate("none", "Accounts aren't set up on this copy of SalaamStreet, so the Admin Panel can't be used here."); return; }
    gate("retry", "Checking your account…");
    var b = $("adm-gate").querySelector("button");
    if (b) b.hidden = true;
    api("me").then(function (r) {
      if (!r.ok) {
        if (r.error === "signed_out" || r.error === "invalid_session") { gate("signin", "Sign in with your admin Google account to open the Admin Panel."); waitForSignIn(); }
        else if (r.error === "forbidden") { gate("denied", r.message || "This account can't use the Admin Panel."); remember(false); }
        else gate("retry", r.message || "Couldn't open the Admin Panel.");
        return;
      }
      st.me = r; st.ready = true;
      remember(true);
      gate("ok");
      counts({ flags: r.open_flags });
      draw();
    });
  }
  function counts(c) {
    Object.keys(c).forEach(function (k) {
      var el = document.querySelector('[data-count="' + k + '"]');
      if (el) { el.textContent = c[k] > 99 ? "99+" : String(c[k] || ""); el.hidden = !c[k]; }
    });
  }

  /* ── Tabs ─────────────────────────────────────────────────────── */
  function draw() {
    showErr("");
    [].forEach.call(document.querySelectorAll(".adm-tabs [data-tab]"), function (a) {
      var on = a.getAttribute("data-tab") === st.tab;
      a.classList.toggle("active", on);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    var p = $("adm-panel");
    p.innerHTML = '<div class="card"><p class="muted">Loading…</p></div>';
    ({ overview: drawOverview, users: drawUsers, flags: drawFlags, ai: drawAi, msa: drawMsa, admins: drawAdmins, log: drawLog }[st.tab] || drawOverview)();
    if (st.openId) openUser(st.openId);
  }
  function card(title, body, extra) {
    return '<section class="card adm-card"><div class="card-title"><h2>' + esc(title) + "</h2>" + (extra || "") + "</div>" + body + "</section>";
  }
  function refreshBtn(what) { return '<button class="btn btn-ghost btn-sm" type="button" data-act="refresh" data-what="' + what + '" aria-label="Refresh" title="Refresh">' + icon("refresh") + "</button>"; }

  function drawOverview() {
    api("overview").then(function (r) {
      if (st.tab !== "overview") return;
      if (!r.ok) return failed(r);
      counts({ flags: r.open_flags });
      var ai = r.ai || {}, prov = r.by_provider || {};
      var max = Math.max.apply(null, (r.signups_14d || []).map(function (d) { return d.n; }).concat([1]));
      var bars = (r.signups_14d || []).map(function (d) {
        var label = new Date(d.day + "T12:00:00Z").toLocaleDateString([], { month: "short", day: "numeric" });
        return '<div class="adm-bar" title="' + esc(label + ": " + d.n) + '"><span class="adm-bar-n">' + (d.n || "") + '</span><span class="adm-bar-fill" style="block-size:' +
          Math.max(d.n ? 6 : 2, Math.round(d.n / max * 100)) + '%"></span><span class="adm-bar-d">' + new Date(d.day + "T12:00:00Z").getUTCDate() + "</span></div>";
      }).join("");
      var how = Object.keys(prov).sort(function (a, b) { return prov[b] - prov[a]; }).map(function (k) { return stat(provider(k), int(prov[k])); }).join("");
      $("adm-panel").innerHTML =
        (r.open_flags ? '<a class="card adm-alert" href="#/admin/flags">' + icon("info") + "<span><b>" + int(r.open_flags) + " account" + (r.open_flags === 1 ? "" : "s") +
          " flagged</b><br><span class=\"muted\">Their email or name contains a screened word, or an admin flagged them. Review them.</span></span>" + icon("chev-r") + "</a>" : "") +
        card("Accounts", '<dl class="lab-stats">' + stat("Accounts", int(r.accounts)) + stat("New today", int(r.new_today)) + stat("New · 7 days", int(r.new_7d)) +
          stat("Signed in today", int(r.active_today)) + stat("Signed in · 7 days", int(r.active_7d)) + stat("Signed in · 30 days", int(r.active_30d)) +
          stat("Never signed in", int(r.never_signed_in)) + stat("Banned", int(r.banned)) + stat("Admins", int(r.admins)) + "</dl>",
          '<span class="muted lab-small">Updated ' + esc(ago(r.at)) + "</span>" + refreshBtn("overview")) +
        card("Sign-ups · last 14 days", '<div class="adm-chart" role="img" aria-label="Sign-ups per day for the last 14 days">' + bars + "</div>") +
        card("How people sign in", '<dl class="lab-stats">' + (how || stat("No accounts yet", "")) + "</dl>") +
        card("What people use", '<dl class="lab-stats">' + stat("Synced items", int(r.synced_items)) + stat("Reminder devices", int(r.reminder_devices)) +
          stat("Family: children", int(r.family_children)) + stat("MSA members", int(r.msa_members)) + stat("MSA waiting", int(r.msa_pending)) +
          stat("MSA posts", int(r.msa_posts)) + "</dl>") +
        card("SalaamStreet AI today", '<div class="lab-badges">' + (r.ai_enabled ? badge("badge-ok", "On and open") : badge("badge-warn", "Off or closed")) + "</div>" +
          '<dl class="lab-stats">' + stat("Questions today", int(ai.today_requests)) + stat("People today", int(ai.people_today)) + stat("Errors today", int(ai.today_errors)) +
          stat("Off-topic today", int(ai.off_topic_today)) + stat("Paused now", int(ai.banned_now)) + stat("If paid: today", money(ai.today_cost_usd)) +
          stat("If paid: 7 days", money(ai.week_cost_usd)) + stat("Helpful · 7 days", "👍 " + int(ai.helpful_7d) + " · 👎 " + int(ai.unhelpful_7d)) + "</dl>",
          '<a class="btn btn-ghost btn-sm" href="#/admin/ai">Settings</a>') +
        card("Newest accounts", '<div class="adm-list">' + ((r.recent || []).map(function (u) { return userRow(u); }).join("") || '<p class="muted">No accounts yet.</p>') + "</div>",
          '<a class="btn btn-ghost btn-sm" href="#/admin/users">All users</a>') +
        (r.block_signups ? "" : '<p class="muted lab-small">Sign-up screening flags matching accounts for you to review. To refuse them outright, turn it on in Flags.</p>');
    });
  }

  function drawUsers(more) {
    var p = $("adm-panel");
    if (!more) {
      p.innerHTML =
        '<section class="card adm-card"><form class="adm-search" id="adm-search" role="search">' +
          '<label class="visually-hidden" for="adm-q">Search users</label>' +
          '<input class="input" id="adm-q" type="search" placeholder="Email, phone, name or id" autocomplete="off" value="' + esc(st.q.search) + '" />' +
          '<button class="btn" type="submit">' + icon("search") + "<span>Search</span></button></form>" +
          '<div class="adm-filters" role="group" aria-label="Filter">' + FILTERS.map(function (f) {
            return '<button class="chip" type="button" data-act="filter" data-filter="' + f[0] + '" aria-pressed="' + (st.q.filter === f[0]) + '">' + esc(f[1]) + "</button>";
          }).join("") + "</div>" +
          '<p class="muted lab-small" id="adm-total" role="status"></p><div class="adm-list" id="adm-users"></div>' +
          '<button class="btn btn-outline btn-sm" type="button" id="adm-more" data-act="more" hidden>Load more</button></section>';
      st.users = null;
    }
    var offset = more && st.users ? st.users.users.length : 0;
    api("users", { search: st.q.search, filter: st.q.filter, offset: offset }).then(function (r) {
      if (st.tab !== "users" || !$("adm-users")) return;
      if (!r.ok) return failed(r);
      st.users = { total: r.total, users: (more && st.users ? st.users.users : []).concat(r.users || []) };
      $("adm-total").textContent = int(r.total) + (r.total === 1 ? " account" : " accounts") + (st.q.search ? " matching “" + st.q.search + "”" : "");
      $("adm-users").innerHTML = st.users.users.map(function (u) { return userRow(u); }).join("") || '<p class="muted">Nobody here.</p>';
      $("adm-more").hidden = st.users.users.length >= r.total;
    });
  }

  function drawFlags() {
    Promise.all([api("flags"), api("screening")]).then(function (rs) {
      if (st.tab !== "flags") return;
      var r = rs[0], s = rs[1];
      if (!r.ok) return failed(r);
      if (!s.ok) return failed(s);
      counts({ flags: (r.open || []).length });
      var open = (r.open || []).map(function (u) {
        var why = u.word ? "contains “" + mask(u.word) + "”" : u.note ? "flagged by an admin: " + u.note : "flagged by an admin";
        return '<div class="adm-flag">' + userRow(u, esc(why)) + '<div class="adm-flag-acts">' +
          '<button class="btn btn-danger btn-sm" type="button" data-act="ban-forever" data-id="' + esc(u.id) + '" data-email="' + esc(who(u)) + '">' + icon("lock") + "<span>Ban</span></button>" +
          '<button class="btn btn-outline btn-sm" type="button" data-act="flag" data-op="dismiss" data-id="' + esc(u.id) + '">' + icon("check") + "<span>It's fine</span></button></div></div>";
      }).join("");
      var ai = (r.ai || []).map(function (m) {
        return '<button class="adm-user" type="button" data-user="' + esc(m.id) + '"><span class="adm-av" aria-hidden="true">' + icon("sparkle") + "</span>" +
          '<span class="adm-user-main"><span class="adm-user-top"><b>' + esc(who(m)) + "</b>" +
          (m.paused_until ? badge("badge-danger", "Paused · " + until(m.paused_until)) : badge("badge-warn", m.strikes + " of 3 warnings")) + "</span>" +
          '<span class="muted adm-user-sub">Off-topic questions to SalaamStreet AI' + (m.pauses ? " · paused " + m.pauses + "× before" : "") + "</span></span>" + icon("chev-r") + "</button>";
      }).join("");
      var done = (r.reviewed || []).map(function (u) {
        return '<div class="adm-flag"><button class="adm-user adm-user-sm" type="button" data-user="' + esc(u.id) + '"><span class="adm-user-main"><span class="adm-user-top">' + esc(who(u)) + "</span>" +
          '<span class="muted adm-user-sub">' + esc((u.word ? "“" + mask(u.word) + "”" : u.note || "flagged by an admin") + " · reviewed " + ago(u.reviewed_at)) + "</span></span>" + icon("chev-r") + "</button>" +
          '<div class="adm-flag-acts"><button class="btn btn-ghost btn-sm" type="button" data-act="flag" data-op="reopen" data-id="' + esc(u.id) + '">Reopen</button></div></div>';
      }).join("");
      var words = (s.words || []).map(function (w) {
        return '<span class="chip adm-word"><span>' + esc(mask(w)) + '</span><button class="icon-btn" type="button" data-act="word-remove" data-word="' + esc(w) +
          '" aria-label="Remove ' + esc(mask(w)) + '">' + icon("x") + "</button></span>";
      }).join("");
      $("adm-panel").innerHTML =
        card("Waiting for review", open ? '<div class="adm-list">' + open + "</div>" : '<p class="muted">Nothing to review. ✨</p>', refreshBtn("flags")) +
        card("SalaamStreet AI warnings and pauses", ai ? '<div class="adm-list">' + ai + "</div>" : '<p class="muted">Nobody has warnings right now.</p>') +
        card("Sign-up screening",
          '<div class="lab-kill row-between"><div><b>Refuse matching sign-ups</b><p class="muted">' +
            (s.block_signups ? "On: a sign-up whose email or name contains a word below is refused with “This email address or name can’t be used on SalaamStreet.”"
              : "Off: matching sign-ups are let in and flagged here for you to review.") + "</p></div>" +
            '<label class="switch"><input type="checkbox" id="adm-block"' + (s.block_signups ? " checked" : "") + ' aria-label="Refuse matching sign-ups" /><span class="trk"></span><span class="th"></span></label></div>' +
          '<p class="muted lab-small">Checked against the part of the email before the @ and the name from Google or Apple, with spaces, digits and symbols like 1→i, 0→o, @→a undone. ' +
            "Words are matched anywhere inside, so keep them specific (a short word can match ordinary names).</p>" +
          '<div class="adm-words">' + (words || '<p class="muted">No words.</p>') + "</div>" +
          '<form class="adm-inline" id="adm-word-form"><label class="visually-hidden" for="adm-word">Add a word</label>' +
            '<input class="input input-sm" id="adm-word" maxlength="40" placeholder="Add a word" autocomplete="off" />' +
            '<button class="btn btn-sm" type="submit">' + icon("plus") + "<span>Add</span></button>" +
            '<button class="btn btn-ghost btn-sm" type="button" data-act="show-words">' + (st.showWords ? "Hide words" : "Show words") + "</button></form>" +
          '<p class="muted lab-small">Adding a word also flags existing accounts that match it.</p>') +
        (done ? card("Recently reviewed", '<div class="adm-list">' + done + "</div>") : "");
    });
  }

  function drawAi() {
    api("ai").then(function (r) {
      if (st.tab !== "ai") return;
      if (!r.ok) return failed(r);
      var u = r.usage || {};
      $("adm-panel").innerHTML =
        card("SalaamStreet AI",
          '<div class="lab-kill row-between"><div><b>AI requests</b><p class="muted">' + (r.enabled ? "On. Turn off to stop every AI request at once (the emergency switch)." : "Off. Nobody can use SalaamStreet AI until you turn this back on.") + "</p></div>" +
            '<label class="switch"><input type="checkbox" id="adm-ai-on"' + (r.enabled ? " checked" : "") + ' aria-label="AI requests on" /><span class="trk"></span><span class="th"></span></label></div>' +
          '<div class="lab-kill row-between"><div><b>Open to everyone with an account</b><p class="muted">' + (r.beta_open ? "Open: anyone signed in can ask " + int(r.user_daily_limit) + " questions a day." : "Closed: only the Lab's admin can use it.") + "</p></div>" +
            '<label class="switch"><input type="checkbox" id="adm-ai-open"' + (r.beta_open ? " checked" : "") + ' aria-label="Open to everyone with an account" /><span class="trk"></span><span class="th"></span></label></div>' +
          '<form class="lab-set-grid" id="adm-ai-form">' +
            '<div class="field"><label for="adm-ai-user">Questions per person per day</label><input class="input input-sm" id="adm-ai-user" name="user_daily_limit" type="number" min="0" max="1000" step="1" value="' + esc(r.user_daily_limit) + '" required /></div>' +
            '<div class="field"><label for="adm-ai-day">Questions per day, everyone together</label><input class="input input-sm" id="adm-ai-day" name="daily_limit" type="number" min="0" max="100000" step="1" value="' + esc(r.daily_limit) + '" required /></div>' +
            '<div class="lab-set-foot"><button class="btn btn-sm" type="submit">Save limits</button><span class="muted" id="adm-ai-out" role="status"></span></div></form>' +
          '<p class="muted lab-small">Model: ' + esc(r.model) + " · " + int(r.minute_limit) + " per minute · changed " + esc(ago(r.updated_at)) +
            '. The model, prices and a test chat are in the <a href="#/lab">AI Testing Lab</a> (the owner’s Google account).</p>', refreshBtn("ai")) +
        card("Usage", '<dl class="lab-stats">' + stat("Today", int(u.today_requests) + " / " + int(r.daily_limit)) + stat("People today", int(u.people_today)) +
          stat("Waiting now", int(u.waiting_now)) + stat("Errors today", int(u.today_errors)) + stat("Refused today", int(u.refused_today)) +
          stat("Off-topic today", int(u.off_topic_today)) + stat("Paused now", int(u.banned_now)) + stat("Tokens today", int(u.today_tokens)) +
          stat("If paid: today", money(u.today_cost_usd)) + stat("If paid: 7 days", money(u.week_cost_usd) + " · " + int(u.week_requests) + " questions") +
          stat("Helpful · 7 days", "👍 " + int(u.helpful_7d) + " · 👎 " + int(u.unhelpful_7d)) + "</dl>" +
          '<p class="muted lab-small">Only counts are stored — never anyone’s questions or the answers.</p>');
    });
  }

  function drawMsa() {
    api("msa").then(function (r) {
      if (st.tab !== "msa") return;
      if (!r.ok) return failed(r);
      var posts = (r.posts || []).map(function (p) {
        return '<div class="adm-post"><div class="adm-post-main"><b>' + esc(p.title) + "</b>" +
          '<span class="muted adm-user-sub">' + esc(ago(p.created_at) + (p.author ? " · by " + p.author : "")) + "</span>" +
          '<span class="lab-badges">' + (p.pinned ? badge("badge-ok", "Pinned") : "") + (p.on_home ? badge("badge-muted", "On Home") : "") +
            (p.has_image ? badge("badge-muted", "Picture") : "") + (p.expires_at ? badge("badge-muted", (new Date(p.expires_at) < new Date() ? "Expired " : "Until ") + when(p.expires_at)) : "") + "</span></div>" +
          '<button class="btn btn-danger btn-sm" type="button" data-act="post-delete" data-id="' + esc(p.id) + '" data-title="' + esc(p.title) + '">' + icon("trash") + "<span>Take down</span></button></div>";
      }).join("");
      $("adm-panel").innerHTML =
        card("NVHS MSA", '<dl class="lab-stats">' + stat("Members", int(r.members)) + stat("Waiting", int(r.pending)) + stat("MSA admins", int(r.admins)) +
          stat("On the roster", int(r.roster)) + stat("Posts", int((r.posts || []).length)) + "</dl>" +
          '<p class="muted lab-small">The MSA’s own admins post and approve members on the <a href="#/msa">MSA page</a>. Use this only when something has to come down now.</p>', refreshBtn("msa")) +
        card("Latest announcements", posts ? '<div class="adm-list">' + posts + "</div>" : '<p class="muted">No announcements.</p>');
    });
  }

  function drawAdmins(data) {
    var go = data ? Promise.resolve(data) : api("admins");
    go.then(function (r) {
      if (st.tab !== "admins") return;
      if (!r.ok) return failed(r);
      var rows = (r.admins || []).map(function (a) {
        return '<div class="adm-post"><div class="adm-post-main"><b>' + esc(a.email || "Hasn’t signed in yet") + "</b>" +
          '<span class="muted adm-user-sub">Added ' + esc(when(a.added_at)) + (a.email ? "" : " · id " + esc(a.id.slice(0, 10)) + "…") + "</span></div>" +
          (a.me ? badge("badge-ok", "You") : '<button class="btn btn-danger btn-sm" type="button" data-act="admin-remove" data-id="' + esc(a.id) + '" data-email="' + esc(a.email || "this admin") + '">' + icon("trash") + "<span>Remove</span></button>") + "</div>";
      }).join("");
      $("adm-panel").innerHTML =
        card("Admins", '<div class="adm-list">' + rows + "</div>" +
          '<form class="adm-inline" id="adm-admin-form"><label class="visually-hidden" for="adm-admin-email">Admin’s email</label>' +
            '<input class="input input-sm" id="adm-admin-email" type="email" placeholder="name@gmail.com" autocomplete="off" required />' +
            '<button class="btn btn-sm" type="submit">' + icon("plus") + "<span>Add admin</span></button></form>" +
          '<p class="muted lab-small">Admins can see every account’s email and use everything on this page. They open it by signing in with <b>Google</b> using this email (Settings shows them an Admin Panel link). ' +
            "Only a SHA-256 hash of the email is used to check. You can’t remove yourself, and there’s always at least one admin. The AI Testing Lab (#/lab) stays the owner’s.</p>", refreshBtn("admins"));
    });
  }

  function drawLog(more) {
    var offset = more && st.log ? st.log.entries.length : 0;
    api("audit", { offset: offset }).then(function (r) {
      if (st.tab !== "log") return;
      if (!r.ok) return failed(r);
      st.log = { total: r.total, entries: (more && st.log ? st.log.entries : []).concat(r.entries || []) };
      var rows = st.log.entries.map(function (e) {
        var target = e.target ? (e.target_id ? '<a href="#/admin/user/' + esc(e.target_id) + '">' + esc(e.target) + "</a>" : esc(e.target)) : "";
        return '<li class="adm-log-row"><span class="adm-log-when">' + esc(when(e.at)) + "</span>" +
          '<span><b>' + esc(ACTION_LABEL[e.action] || e.action) + "</b>" + (target ? " · " + target : "") + (e.detail ? ' <span class="muted">— ' + esc(e.detail) + "</span>" : "") +
          '<br><span class="muted adm-user-sub">' + esc(e.action === "denied" ? "by a signed-in account that isn’t an admin" : "by " + (e.by || "a deleted admin")) + "</span></span></li>";
      }).join("");
      $("adm-panel").innerHTML = card("Activity log", (rows ? '<ol class="adm-log">' + rows + "</ol>" : '<p class="muted">Nothing yet.</p>') +
        (st.log.entries.length < r.total ? '<button class="btn btn-outline btn-sm" type="button" data-act="log-more">Load more</button>' : ""),
        '<span class="muted lab-small">' + int(r.total) + " entries · kept 2 years</span>" + refreshBtn("log"));
    });
  }

  /* ── One account ──────────────────────────────────────────────── */
  function openUser(id) {
    st.openId = id;
    var dlg = $("admin-dialog"), body = $("admin-dialog-body");
    body.innerHTML = '<div class="modal-head"><h2 id="admin-dialog-h">Account</h2><button class="icon-btn" data-close type="button" aria-label="Close">' + icon("x") + "</button></div>" +
      '<p class="muted">Loading…</p>';
    if (!dlg.open) SS.openDialog(dlg);
    api("user", { id: id }).then(function (r) {
      if (st.openId !== id) return;
      if (!r.ok) {
        if (r.error === "forbidden" || r.error === "signed_out" || r.error === "invalid_session") { dlg.close(); return failed(r); }
        body.querySelector("p").textContent = r.message || "Couldn't load this account.";
        return;
      }
      drawUser(r.user);
    });
  }
  function drawUser(u) {
    var body = $("admin-dialog-body"), ai = u.ai || {}, sync = u.sync || {}, msa = u.msa, flag = u.flag;
    var me = st.me && u.email && u.email.toLowerCase() === st.me.email;
    var locked = u.admin || me;
    var html =
      '<div class="modal-head"><h2 id="admin-dialog-h" class="adm-dlg-title">' + esc(who(u)) + '</h2><button class="icon-btn" data-close type="button" aria-label="Close">' + icon("x") + "</button></div>" +
      '<div class="modal-scroll"><div class="lab-badges">' + badges(u) + (u.ai && u.ai.paused_until ? badge("badge-warn", "AI paused · " + until(u.ai.paused_until)) : "") + "</div>" +
      (flag && flag.status === "open" ? '<p class="adm-flagbox">' + icon("info") + "<span><b>Flagged " + esc(ago(flag.flagged_at)) + ":</b> " +
        esc(flag.word ? "the email or name contains “" + mask(flag.word) + "”" : flag.note || "by an admin") + "</span></p>" : "") +
      '<h3 class="adm-h3">Account</h3><dl class="adm-dl">' +
        dd("Name", u.name || "—") + dd("Signs in with", (u.providers && u.providers.length ? u.providers : [u.provider]).map(provider).join(", ")) +
        dd("Joined", when(u.created_at)) + dd("Last sign-in", u.last_sign_in_at ? when(u.last_sign_in_at) + " (" + ago(u.last_sign_in_at) + ")" : "Never") +
        dd("Email confirmed", u.email_confirmed_at ? when(u.email_confirmed_at) : u.confirmed ? "Phone confirmed" : "No") +
        dd("Language", u.locale || "—") + dd("Banned", u.banned_until ? "Until " + (until(u.banned_until) === "until unbanned" ? "unbanned" : when(u.banned_until)) : "No") +
        '<div><dt>Account id</dt><dd><code class="adm-id">' + esc(u.id) + '</code> <button class="btn btn-ghost btn-sm" type="button" data-uact="copy-id">' + icon("copy") + "<span>Copy</span></button></dd></div></dl>" +
      '<h3 class="adm-h3">Uses</h3><dl class="adm-dl">' +
        dd("Synced items", int(sync.items) + (sync.last ? " · last " + ago(sync.last) : "")) + dd("Family: children", int(u.family_children)) +
        dd("NVHS MSA", msa ? msa.name + " · " + msa.status + " (" + msa.via + ")" : "Not a member") +
        dd("MSA admin", u.msa_admin ? "Yes · " + int(u.msa_posts) + " posts" : "No") + "</dl>" +
      '<h3 class="adm-h3">SalaamStreet AI</h3><dl class="adm-dl">' +
        dd("Questions", int(ai.questions) + " in all · " + int(ai.questions_7d) + " this week") + dd("Last question", ai.last ? ago(ai.last) : "Never") +
        dd("Rated", "👍 " + int(ai.helpful) + " · 👎 " + int(ai.unhelpful)) + dd("Refused · 30 days", int(ai.refused_30d)) +
        dd("Warnings", int(ai.strikes) + " of 3" + (ai.pauses ? " · paused " + ai.pauses + "× in all" : "")) +
        dd("Terms", ai.terms_version ? "Accepted " + when(ai.terms_accepted_at) : "Not yet") + "</dl>" +
      '<p class="muted lab-small">Counts only. SalaamStreet never stores anyone’s AI conversations, and this page never shows synced notes or bookmarks.</p>';
    if (locked) {
      html += '<p class="adm-flagbox">' + icon("lock") + "<span>" + (me ? "This is your own account." : "This account is an admin.") +
        " Admins can’t be banned, signed out or deleted here" + (me ? "." : " — remove them from the admin list first.") + "</span></p>";
    } else {
      html += '<h3 class="adm-h3">Actions</h3><div class="adm-actions">' +
        (u.banned_until
          ? '<button class="btn btn-outline" type="button" data-uact="unban">' + icon("check") + "<span>Unban</span></button>"
          : '<div class="adm-ban"><label class="visually-hidden" for="adm-ban-days">Ban for</label><select class="input input-sm" id="adm-ban-days">' +
              '<option value="1">1 day</option><option value="7">7 days</option><option value="30">30 days</option><option value="" selected>Until unbanned</option></select>' +
              '<input class="input input-sm" id="adm-ban-why" maxlength="150" placeholder="Reason (for the log)" autocomplete="off" />' +
              '<button class="btn btn-danger" type="button" data-uact="ban">' + icon("lock") + "<span>Ban</span></button></div>") +
        '<button class="btn btn-outline" type="button" data-uact="sign-out">' + icon("logout") + "<span>Sign out everywhere</span></button>" +
        (flag && flag.status === "open"
          ? '<button class="btn btn-outline" type="button" data-uact="dismiss">' + icon("check") + "<span>Dismiss flag</span></button>"
          : '<button class="btn btn-outline" type="button" data-uact="flag">' + icon("info") + "<span>Flag for review</span></button>") +
        (ai.paused_until || ai.strikes
          ? '<button class="btn btn-outline" type="button" data-uact="ai-restore">' + icon("sparkle") + "<span>Restore SalaamStreet AI</span></button>"
          : "") +
        (ai.paused_until ? "" : '<button class="btn btn-outline" type="button" data-uact="ai-pause">' + icon("sparkle") + "<span>Pause SalaamStreet AI · 30 days</span></button>") +
        "</div>" +
        '<details class="adm-danger"><summary>' + icon("trash") + "<span>Delete this account</span></summary>" +
          "<p>This deletes the account and everything that belongs to it: synced data, Family children, MSA membership and AI record. It can’t be undone. " +
          "The person could sign up again with the same email — ban instead if you want to keep them out.</p>" +
          '<label class="field-l" for="adm-del-confirm">Type <b>' + esc(u.email || u.phone || "") + "</b> to confirm</label>" +
          '<input class="input" id="adm-del-confirm" autocomplete="off" autocapitalize="off" spellcheck="false" />' +
          '<input class="input input-sm" id="adm-del-why" maxlength="150" placeholder="Reason (for the log)" autocomplete="off" />' +
          '<button class="btn btn-danger" type="button" data-uact="delete" disabled>' + icon("trash") + "<span>Delete account</span></button></details>";
    }
    html += '<p class="lab-err" id="adm-u-err" role="alert" hidden></p>';
    if (u.history && u.history.length) {
      html += '<h3 class="adm-h3">History</h3><ol class="adm-log">' + u.history.map(function (e) {
        return '<li class="adm-log-row"><span class="adm-log-when">' + esc(when(e.at)) + "</span><span><b>" + esc(ACTION_LABEL[e.action] || e.action) + "</b>" +
          (e.detail ? ' <span class="muted">— ' + esc(e.detail) + "</span>" : "") + '<br><span class="muted adm-user-sub">by ' + esc(e.by || "a deleted admin") + "</span></span></li>";
      }).join("") + "</ol>";
    }
    body.innerHTML = html + "</div>";
    body.onclick = function (e) { var b = e.target.closest("[data-uact]"); if (b) userAction(u, b); };
    var conf = $("adm-del-confirm");
    if (conf) conf.oninput = function () {
      body.querySelector('[data-uact="delete"]').disabled = this.value.trim().toLowerCase() !== String(u.email || u.phone || "").trim().toLowerCase();
    };
  }
  function dd(label, value) { return "<div><dt>" + esc(label) + "</dt><dd>" + esc(value) + "</dd></div>"; }
  function userAction(u, b) {
    var a = b.getAttribute("data-uact"), err = $("adm-u-err");
    if (a === "copy-id") {
      SS.ui.copyText(u.id);
      return;
    }
    var req = null, done = "";
    if (a === "ban") {
      var days = $("adm-ban-days").value;
      if (!confirm("Ban " + who(u) + (days ? " for " + days + " day" + (days === "1" ? "" : "s") : " until you unban them") + "? They’ll be signed out everywhere and can’t sign in.")) return;
      req = ["ban", { id: u.id, days: days ? Number(days) : null, reason: $("adm-ban-why").value }]; done = "Banned.";
    } else if (a === "unban") { req = ["unban", { id: u.id }]; done = "Unbanned."; }
    else if (a === "sign-out") {
      if (!confirm("Sign " + who(u) + " out on every device?")) return;
      req = ["sign_out", { id: u.id }]; done = "Signed out everywhere.";
    } else if (a === "dismiss") { req = ["flag", { id: u.id, op: "dismiss" }]; done = "Flag dismissed."; }
    else if (a === "flag") {
      var note = window.prompt("Why are you flagging this account? (for the log)", "");
      if (note === null) return;
      req = ["flag", { id: u.id, op: "add", note: note }]; done = "Flagged.";
    } else if (a === "ai-pause") {
      if (!confirm("Pause SalaamStreet AI for " + who(u) + " for 30 days?")) return;
      req = ["ai_member", { id: u.id, op: "pause", days: 30 }]; done = "SalaamStreet AI paused.";
    } else if (a === "ai-restore") { req = ["ai_member", { id: u.id, op: "restore" }]; done = "SalaamStreet AI restored."; }
    else if (a === "delete") {
      if (!confirm("Delete " + who(u) + " and all their data for good?")) return;
      req = ["delete", { id: u.id, confirm: $("adm-del-confirm").value, reason: $("adm-del-why").value }]; done = "Deleted.";
    }
    if (!req) return;
    b.disabled = true;
    api(req[0], req[1]).then(function (r) {
      b.disabled = false;
      if (!r.ok) {
        if (r.error === "forbidden" || r.error === "signed_out" || r.error === "invalid_session") { $("admin-dialog").close(); return failed(r); }
        err.textContent = r.message || "That didn't work."; err.hidden = false; return;
      }
      SS.toast(done);
      if (a === "delete") { $("admin-dialog").close(); draw(); return; }
      openUser(u.id);
      reloadQuietly();
    });
  }
  /** After a change in the dialog: refresh the list behind it without losing the place. */
  function reloadQuietly() {
    if (st.tab === "users" && st.users) drawUsers();
    else if (st.tab !== "users") draw();
  }

  /* ── Panel events ─────────────────────────────────────────────── */
  function onPanelClick(e) {
    var b = e.target.closest("[data-act]");
    if (!b) {
      var u = e.target.closest("[data-user]");
      if (u) openUser(u.getAttribute("data-user"));
      return;
    }
    var act = b.getAttribute("data-act");
    if (act === "refresh") return draw();
    if (act === "filter") { st.q.filter = b.getAttribute("data-filter"); return drawUsers(); }
    if (act === "more") return drawUsers(true);
    if (act === "log-more") return drawLog(true);
    if (act === "show-words") { st.showWords = !st.showWords; return drawFlags(); }
    if (act === "flag") return simple("flag", { id: b.getAttribute("data-id"), op: b.getAttribute("data-op") }, b, b.getAttribute("data-op") === "dismiss" ? "Marked as fine." : "Reopened.");
    if (act === "ban-forever") {
      if (!confirm("Ban " + b.getAttribute("data-email") + " until you unban them? They’ll be signed out everywhere.")) return;
      return simple("ban", { id: b.getAttribute("data-id"), days: null, reason: "flagged sign-up" }, b, "Banned.");
    }
    if (act === "word-remove") return simple("screening_set", { remove: b.getAttribute("data-word") }, b, "Word removed.");
    if (act === "post-delete") {
      if (!confirm("Take down “" + b.getAttribute("data-title") + "” for everyone? This can’t be undone.")) return;
      return simple("msa_delete_post", { id: b.getAttribute("data-id") }, b, "Post taken down.");
    }
    if (act === "admin-remove") {
      if (!confirm("Remove " + b.getAttribute("data-email") + " as an admin? They lose access to this panel straight away.")) return;
      b.disabled = true;
      api("admins_set", { remove: b.getAttribute("data-id") }).then(function (r) {
        if (!r.ok) { b.disabled = false; return failed(r); }
        SS.toast("Admin removed.");
        drawAdmins(r);
      });
    }
  }
  function simple(action, body, b, done) {
    if (b) b.disabled = true;
    api(action, body).then(function (r) {
      if (b) b.disabled = false;
      if (!r.ok) return failed(r);
      SS.toast(done);
      draw();
    });
  }
  function onPanelSubmit(e) {
    var f = e.target;
    e.preventDefault();
    if (f.id === "adm-search") { st.q.search = $("adm-q").value.trim(); drawUsers(); return; }
    if (f.id === "adm-word-form") {
      var w = $("adm-word").value.trim();
      if (w) simple("screening_set", { add: w }, f.querySelector("button"), "Word added. Matching accounts are flagged.");
      return;
    }
    if (f.id === "adm-admin-form") {
      var mail = $("adm-admin-email").value.trim();
      if (!mail || !confirm("Make " + mail + " an admin? They’ll see every account and can ban and delete them.")) return;
      api("admins_set", { add: mail }).then(function (r) {
        if (!r.ok) return failed(r);
        SS.toast("Admin added.");
        drawAdmins(r);
      });
      return;
    }
    if (f.id === "adm-ai-form") {
      var out = $("adm-ai-out");
      out.textContent = "Saving…";
      api("ai_set", { patch: { user_daily_limit: Number(f.elements.user_daily_limit.value), daily_limit: Number(f.elements.daily_limit.value) } }).then(function (r) {
        if (!r.ok) { out.textContent = r.message || "Couldn't save."; return; }
        out.textContent = "Saved.";
      });
    }
  }
  function onPanelChange(e) {
    var t = e.target;
    if (t.id === "adm-block") {
      if (t.checked && !confirm("Refuse every new sign-up whose email or name contains a screened word?")) { t.checked = false; return; }
      simple("screening_set", { block: t.checked }, null, t.checked ? "Matching sign-ups will be refused." : "Matching sign-ups will be flagged.");
    } else if (t.id === "adm-ai-on") {
      if (!t.checked && !confirm("Turn off SalaamStreet AI for everyone?")) { t.checked = true; return; }
      simple("ai_set", { patch: { enabled: t.checked } }, null, t.checked ? "SalaamStreet AI is on." : "SalaamStreet AI is off.");
    } else if (t.id === "adm-ai-open") {
      if (!t.checked && !confirm("Close SalaamStreet AI? Everyone but the Lab's admin will be told it's closed for now.")) { t.checked = true; return; }
      simple("ai_set", { patch: { beta_open: t.checked } }, null, t.checked ? "Open to everyone." : "Closed.");
    }
  }

  /* ── View ─────────────────────────────────────────────────────── */
  /** #/admin, #/admin/<tab>, #/admin/user/<id>. */
  SS.adminPage = function (params) {
    shell();
    var first = (params && params[0]) || "overview";
    if (first === "user" && params[1]) { st.openId = params[1]; st.tab = st.tab === "overview" ? "users" : st.tab; }
    else st.tab = TABS.some(function (t) { return t[0] === first; }) ? first : "overview";
    document.title = "Admin Panel — SalaamStreet";
    $("tb-title").textContent = "Admin Panel";
    if (st.ready) { draw(); return; }
    start();
  };
  SS.adminLeave = function () { clearInterval(waitTimer); var d = $("admin-dialog"); if (d && d.open) d.close(); };
})();
