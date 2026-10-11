/* SalaamStreet — ai-lab.js (classic script, loaded only on #/lab)
   The private AI Testing Lab: the admin's real Gemini conversations.

   • Not linked from any menu. Hiding it is NOT the protection: every request
     goes to the ai-lab Edge Function, which checks the signed-in account on
     the server (backend/functions/ai-lab/core.js) and refuses everyone else.
     This page only shows what the server allows.
   • The Gemini key never reaches the browser; this page sends the person's
     own Supabase session token and nothing else.
   • The conversation lives in this page's memory only: it's gone on reload,
     "New conversation" or "Clear", and is never saved on the device or the
     server. English only, like other admin tools. */
(function () {
  "use strict";
  window.SS = window.SS || {};
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return SS.esc(s); }
  function icon(n) { return SS.ui.icon(n); }
  var CFG = SS.CONFIG || {};

  var st = {
    msgs: [],          // { role: "user"|"model", text, meta? } — this page only
    busy: false,
    status: null,      // the server's last status reply
    session: { tokens: 0, cost: 0, requests: 0 },
    waitTimer: 0,
  };

  /* ── Server ───────────────────────────────────────────────────── */
  function fnUrl() { return CFG.supabaseUrl.replace(/\/+$/, "") + "/functions/v1/ai-lab"; }
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
      var body = Object.assign({ action: action }, extra || {});
      return fetch(fnUrl(), {
        method: "POST",
        headers: { authorization: "Bearer " + tok, apikey: CFG.supabaseAnonKey, "content-type": "application/json" },
        body: JSON.stringify(body),
      }).then(function (r) {
        return r.text().then(function (txt) {
          var j = null;
          try { j = JSON.parse(txt); } catch (e) { j = null; }
          if (!j || typeof j.ok !== "boolean") {
            return { ok: false, http: r.status, error: r.status === 404 ? "not_deployed" : "bad_response",
              message: r.status === 404 ? "The ai-lab function isn't deployed yet (see backend/README-ai.md)."
                : "The server sent an unexpected reply (HTTP " + r.status + ")." };
          }
          j.http = r.status;
          return j;
        });
      }, function () {
        return { ok: false, error: "unreachable", http: 0,
          message: navigator.onLine === false ? "You're offline." : "Couldn't reach the AI server. If the ai-lab function isn't deployed yet, see backend/README-ai.md." };
      });
    });
  }

  /* ── Formatting ───────────────────────────────────────────────── */
  function money(n) {
    if (n == null || isNaN(n)) return "—";
    if (n === 0) return "$0.00";
    return n < 0.01 ? "$" + Number(n).toFixed(4) : "$" + Number(n).toFixed(2);
  }
  function int(n) { return n == null ? "—" : Number(n).toLocaleString("en-US"); }
  /** Escaped text with **bold** and `code`; line breaks are kept by CSS. */
  function rich(s) {
    return esc(s).replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>").replace(/`([^`\n]+)`/g, "<code>$1</code>");
  }
  function timeUtc(iso) {
    if (!iso) return "midnight UTC";
    try { return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + " your time"; } catch (e) { return "midnight UTC"; }
  }

  /* ── Page ─────────────────────────────────────────────────────── */
  function shell() {
    var root = $("lab-root");
    if (root.getAttribute("data-ready")) return;
    root.setAttribute("data-ready", "1");
    root.innerHTML =
      '<header class="page-head lab-head"><span class="lab-logo" aria-hidden="true">' + icon("sparkle") + '</span>' +
      '<div><h1 id="lab-h" tabindex="-1">AI Testing Lab</h1><p>Private · admin only. Real Gemini replies — check anything important against trusted sources.</p></div></header>' +
      '<div id="lab-gate" aria-live="polite"></div>' +
      '<div id="lab-app" class="stack" hidden>' +
        '<section class="card lab-status" aria-labelledby="lab-st-h">' +
          '<div class="card-title"><h2 id="lab-st-h">Status</h2><div class="lab-acts">' +
            '<button class="btn btn-outline btn-sm" id="lab-test" type="button">' + icon("check") + '<span>Test connection</span></button>' +
            '<button class="btn btn-ghost btn-sm" id="lab-refresh" type="button" aria-label="Refresh status">' + icon("refresh") + '</button></div></div>' +
          '<div class="lab-badges" id="lab-badges"></div>' +
          '<dl class="lab-stats" id="lab-stats"></dl>' +
          '<p class="lab-line" id="lab-test-out" role="status"></p>' +
        '</section>' +
        '<section class="card lab-chat" aria-labelledby="lab-chat-h">' +
          '<div class="card-title"><h2 id="lab-chat-h">Conversation</h2><div class="lab-acts">' +
            '<button class="btn btn-outline btn-sm" id="lab-new" type="button">' + icon("plus") + '<span>New conversation</span></button>' +
            '<button class="btn btn-ghost btn-sm" id="lab-clear" type="button">' + icon("trash") + '<span>Clear</span></button></div></div>' +
          '<div class="lab-log" id="lab-log" role="log" aria-live="polite" aria-label="Messages"></div>' +
          '<p class="lab-err" id="lab-err" role="alert" hidden></p>' +
          '<form class="lab-form" id="lab-form">' +
            '<label class="visually-hidden" for="lab-input">Message</label>' +
            '<textarea class="input lab-input" id="lab-input" rows="3" placeholder="Ask anything — an Islamic question, tafsir help, schoolwork, planning…" autocomplete="off"></textarea>' +
            '<div class="row-between lab-form-foot"><span class="muted lab-count" id="lab-count"></span>' +
            '<button class="btn" id="lab-send" type="submit">' + icon("next") + '<span>Send</span></button></div>' +
            '<p class="muted lab-hint">Enter sends · Shift+Enter adds a line · This conversation is kept on this page only.</p>' +
          '</form>' +
          '<p class="muted lab-session" id="lab-session"></p>' +
        '</section>' +
        '<details class="card lab-settings" id="lab-settings"><summary><h2>Settings and emergency switch</h2></summary>' +
          '<div class="lab-kill row-between"><div><b>AI requests</b><p class="muted" id="lab-kill-note"></p></div>' +
            '<label class="switch"><input type="checkbox" id="lab-enabled" aria-label="AI requests on" /><span class="trk"></span><span class="th"></span></label></div>' +
          '<form id="lab-set-form" class="lab-set-grid">' +
            field("model", "Model ID", "text", "") +
            field("daily_limit", "Daily request limit", "number", 'min="0" max="2000" step="1"') +
            field("minute_limit", "Requests per minute", "number", 'min="1" max="60" step="1"') +
            field("max_output_tokens", "Max output tokens", "number", 'min="64" max="8192" step="1"') +
            field("max_input_chars", "Max message length (characters)", "number", 'min="200" max="30000" step="1"') +
            field("input_usd_per_mtok", "Input price, $ per 1M tokens", "number", 'min="0" step="0.01"') +
            field("output_usd_per_mtok", "Output price, $ per 1M tokens (incl. thinking)", "number", 'min="0" step="0.01"') +
            '<div class="lab-set-foot"><button class="btn btn-sm" type="submit">Save settings</button><span class="muted" id="lab-set-out" role="status"></span></div>' +
          '</form>' +
          '<p class="muted lab-small">Costs are estimates from the token counts Gemini reports and the prices above — when you change the model, change both prices to match it. Check them against Google’s pricing page; Google’s bill is what counts. These limits are app limits, not a hard spending cap — set a budget alert in Google Cloud too.</p>' +
        '</details>' +
        '<p class="muted lab-small">Privacy: messages go to Google’s Gemini API to be answered. SalaamStreet stores only counts, tokens and estimated costs — never what you wrote or the replies. Google’s own data terms depend on your API plan (see backend/README-ai.md).</p>' +
      '</div>';
    wire();
  }
  function field(id, label, type, attrs) {
    return '<div class="field"><label for="lab-s-' + id + '">' + esc(label) + '</label><input class="input input-sm" id="lab-s-' + id + '" name="' + id + '" type="' + type + '" ' + attrs + ' required /></div>';
  }

  function wire() {
    $("lab-form").addEventListener("submit", function (e) { e.preventDefault(); send(); });
    $("lab-input").addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
    });
    $("lab-input").addEventListener("input", count);
    $("lab-new").onclick = function () {
      if (st.busy) return;
      if (st.msgs.length && !confirm("Start a new conversation? This one isn't saved anywhere.")) return;
      reset(); $("lab-input").focus();
    };
    $("lab-clear").onclick = function () { if (!st.busy) { reset(); $("lab-input").value = ""; count(); } };
    $("lab-refresh").onclick = function () { loadStatus(); };
    $("lab-test").onclick = testConnection;
    $("lab-enabled").onchange = function () {
      var on = this.checked;
      if (!on || confirm("Turn AI requests back on?")) saveSettings({ enabled: on });
      else this.checked = false;
    };
    $("lab-set-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target, patch = {};
      ["model", "daily_limit", "minute_limit", "max_output_tokens", "max_input_chars", "input_usd_per_mtok", "output_usd_per_mtok"].forEach(function (k) {
        var v = f.elements[k].value.trim();
        patch[k] = k === "model" ? v : Number(v);
      });
      saveSettings(patch);
    });
    $("lab-log").addEventListener("click", function (e) {
      var b = e.target.closest("[data-copy]");
      if (b) SS.ui.copyText(st.msgs[+b.getAttribute("data-copy")].text);
    });
  }

  function reset() {
    st.msgs = [];
    st.session = { tokens: 0, cost: 0, requests: 0 };
    showErr("");
    drawLog(); drawSession();
  }
  function count() {
    var max = st.status ? st.status.settings.max_input_chars : 0;
    var n = $("lab-input").value.length;
    $("lab-count").textContent = max ? n.toLocaleString("en-US") + " / " + max.toLocaleString("en-US") : "";
    $("lab-count").classList.toggle("over", !!max && n > max);
  }
  function showErr(msg) {
    var el = $("lab-err");
    el.hidden = !msg;
    el.textContent = msg || "";
  }

  /* ── Gate (sign-in / not allowed / not set up) ────────────────── */
  function gate(kind, msg) {
    var g = $("lab-gate");
    $("lab-app").hidden = kind !== "ok";
    clearInterval(st.waitTimer);
    if (kind === "ok") { g.innerHTML = ""; return; }
    var html = '<div class="card lab-gate"><p>' + esc(msg) + "</p>";
    if (kind === "signin") html += '<button class="btn" id="lab-signin" type="button">' + icon("google") + "<span>Sign in with Google</span></button>";
    if (kind === "denied") html += '<button class="btn btn-outline" id="lab-switch" type="button">' + icon("logout") + "<span>Use another account</span></button>";
    if (kind === "retry") html += '<button class="btn btn-outline" id="lab-retry" type="button">' + icon("refresh") + "<span>Try again</span></button>";
    g.innerHTML = html + "</div>";
    if ($("lab-signin")) $("lab-signin").onclick = function () { SS.account.openSignIn(); };
    if ($("lab-switch")) $("lab-switch").onclick = function () { Promise.resolve(SS.account.signOut()).then(function () { gate("signin", "Sign in with the admin Google account."); waitForSignIn(); }); };
    if ($("lab-retry")) $("lab-retry").onclick = loadStatus;
  }
  function waitForSignIn() {
    clearInterval(st.waitTimer);
    st.waitTimer = setInterval(function () {
      if (SS.currentView() !== "lab") return clearInterval(st.waitTimer);
      if (SS.account.signedIn()) { clearInterval(st.waitTimer); loadStatus(); }
    }, 800);
  }

  /* ── Status ───────────────────────────────────────────────────── */
  function loadStatus() {
    return api("status").then(function (r) {
      if (r.ok) { st.status = r; gate("ok"); drawStatus(); count(); return r; }
      if (r.error === "signed_out" || r.error === "invalid_session") { gate("signin", "Sign in with the admin Google account to use the AI Testing Lab."); waitForSignIn(); }
      else if (r.error === "forbidden") gate("denied", r.message || "This account can't use the AI Testing Lab.");
      // Already open: a passing network problem shouldn't hide the page.
      else if (st.status) { if (!$("lab-err").textContent) showErr(r.message || "Couldn't refresh the status."); }
      else gate("retry", r.message || "Couldn't load the AI Testing Lab.");
      return r;
    });
  }
  function badge(cls, text) { return '<span class="badge ' + cls + '">' + esc(text) + "</span>"; }
  function drawStatus() {
    var s = st.status, set = s.settings, u = s.usage || {};
    var on = set.enabled && !s.disabled_by_secret;
    $("lab-badges").innerHTML =
      (on ? badge("badge-ok", "AI requests on") : badge("badge-warn", s.disabled_by_secret ? "Off (AI_DISABLED secret)" : "Off (emergency switch)")) +
      (s.gemini_key_set ? badge("badge-muted", "Gemini key set") : badge("badge-warn", "GEMINI_API_KEY not set")) +
      badge("badge-muted", "Model: " + set.model);
    $("lab-stats").innerHTML =
      stat("Today", int(u.today_requests) + " / " + int(set.daily_limit)) +
      stat("Remaining today", int(u.remaining_today)) +
      stat("Tokens today", int(u.today_tokens)) +
      stat("Cost today (est.)", money(u.today_cost_usd)) +
      stat("Last 7 days (est.)", money(u.week_cost_usd) + " · " + int(u.week_requests) + " req") +
      stat("Refused today", int(u.refused_today));
    var lim = $("lab-stats");
    lim.setAttribute("title", "Limits reset at " + timeUtc(u.resets_at));
    $("lab-send").disabled = st.busy || !on || !s.gemini_key_set;
    var f = $("lab-set-form");
    if (!f.contains(document.activeElement)) {
      Object.keys(set).forEach(function (k) { if (f.elements[k]) f.elements[k].value = set[k]; });
    }
    $("lab-enabled").checked = !!set.enabled;
    $("lab-kill-note").textContent = s.disabled_by_secret ? "The AI_DISABLED secret is set, so requests stay off whatever this switch says."
      : set.enabled ? "On. Turn off to stop all AI requests at once." : "Off. No AI requests are sent until you turn this back on.";
    if (!s.gemini_key_set) showErr("GEMINI_API_KEY isn't set yet. Add it in Supabase → Edge Functions → Secrets (backend/README-ai.md).");
    else if (!on) showErr("AI requests are switched off. Turn them on under Settings.");
    else if ($("lab-err").textContent.indexOf("GEMINI_API_KEY") === 0 || $("lab-err").textContent.indexOf("AI requests are switched off") === 0) showErr("");
  }
  function stat(label, value) { return "<div><dt>" + esc(label) + "</dt><dd>" + esc(value) + "</dd></div>"; }

  function testConnection() {
    var out = $("lab-test-out"), btn = $("lab-test");
    btn.disabled = true;
    out.className = "lab-line";
    out.textContent = "Testing the connection to Gemini…";
    api("test").then(function (r) {
      btn.disabled = false;
      out.className = "lab-line " + (r.ok ? "ok" : "bad");
      out.textContent = r.ok
        ? "Connected. " + r.model + (r.display_name ? " (" + r.display_name + ")" : "") + " answered in " + r.latency_ms + " ms."
        : (r.message || "The test failed.") + (r.provider ? " Google said: " + r.provider : "");
      loadStatus();
    });
  }

  function saveSettings(patch) {
    var out = $("lab-set-out");
    out.textContent = "Saving…";
    return api("settings", { patch: patch }).then(function (r) {
      out.textContent = r.ok ? "Saved." : (r.message || "Couldn't save.");
      if (r.ok) { st.status.settings = r.settings; drawStatus(); loadStatus(); }
      else if (st.status) $("lab-enabled").checked = !!st.status.settings.enabled;
    });
  }

  /* ── Chat ─────────────────────────────────────────────────────── */
  function drawLog() {
    var log = $("lab-log");
    if (!st.msgs.length && !st.busy) {
      log.innerHTML = '<div class="lab-empty muted">' + icon("sparkle") + "<p>Start a conversation. Try an Islamic question, ask for help with a surah’s tafsir, compare scholarly opinions, or get help with schoolwork or a plan.</p></div>";
      return;
    }
    log.innerHTML = st.msgs.map(function (m, i) {
      if (m.role === "user") return '<div class="lab-msg me"><div class="lab-bubble">' + esc(m.text) + "</div></div>";
      var meta = m.meta || {};
      var bits = [meta.model, meta.usage && meta.usage.total != null ? int(meta.usage.total) + " tokens" : "tokens not reported",
        meta.cost_usd != null ? "~" + money(meta.cost_usd) : "", meta.latency_ms ? (meta.latency_ms / 1000).toFixed(1) + " s" : ""].filter(Boolean);
      return '<div class="lab-msg ai"><div class="lab-bubble">' + rich(m.text) +
        (meta.truncated ? '<p class="lab-trunc">Cut short: the reply reached the max output tokens.</p>' : "") + "</div>" +
        '<div class="lab-meta"><span>' + esc(bits.join(" · ")) + '</span><button class="btn btn-ghost btn-sm" type="button" data-copy="' + i + '">' + icon("copy") + "<span>Copy</span></button></div></div>";
    }).join("") + (st.busy ? '<div class="lab-msg ai"><div class="lab-bubble lab-typing" aria-label="Gemini is answering"><span></span><span></span><span></span></div></div>' : "");
    log.scrollTop = log.scrollHeight;
  }
  function drawSession() {
    var s = st.session;
    $("lab-session").textContent = s.requests ? "This conversation: " + s.requests + " request" + (s.requests === 1 ? "" : "s") + " · " + int(s.tokens) + " tokens · ~" + money(s.cost) : "";
  }

  function send() {
    var input = $("lab-input"), text = input.value.trim();
    if (!text || st.busy || $("lab-send").disabled) return;
    var max = st.status ? st.status.settings.max_input_chars : 0;
    if (max && text.length > max) { showErr("That message is " + text.length + " characters; the limit is " + max + "."); return; }
    showErr("");
    st.msgs.push({ role: "user", text: text });
    input.value = ""; count();
    st.busy = true;
    $("lab-send").disabled = true;
    drawLog();
    api("chat", { messages: st.msgs.map(function (m) { return { role: m.role, text: m.text }; }) }).then(function (r) {
      st.busy = false;
      if (r.ok) {
        st.msgs.push({ role: "model", text: r.text, meta: r });
        st.session.requests++;
        st.session.tokens += (r.usage && r.usage.total) || 0;
        st.session.cost += r.cost_usd || 0;
        if (r.dropped_turns) showErr("The oldest " + r.dropped_turns + " messages were left out to stay within the size limit.");
      } else {
        // Put the question back so it can be sent again.
        var mine = st.msgs.pop();
        if (!input.value) { input.value = mine.text; count(); }
        showErr((r.message || "The request failed.") + (r.provider ? " Google said: " + r.provider : ""));
        if (r.error === "signed_out" || r.error === "invalid_session" || r.error === "forbidden") loadStatus();
      }
      drawLog(); drawSession();
      if (st.status) loadStatus(); else $("lab-send").disabled = false;
    });
  }

  /* ── View ─────────────────────────────────────────────────────── */
  SS.labView = function () {
    shell();
    document.title = "AI Testing Lab — SalaamStreet";
    $("tb-title").textContent = "AI Testing Lab";
    drawLog(); drawSession();
    if (!CFG.supabaseUrl || !CFG.supabaseAnonKey) {
      gate("none", "Accounts aren't set up on this copy of SalaamStreet, so the AI Testing Lab can't be used here.");
      return;
    }
    gate("retry", "Checking your account…");
    $("lab-gate").querySelector("button").hidden = true;
    loadStatus();
  };
})();
