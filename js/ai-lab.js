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
     server. English only, like other admin tools.
   • The assistant only answers Islamic questions (the rule lives in the
     server's system prompt). With "Use my app data" on, each message also
     carries a short summary of this device's SalaamStreet data (bookmarks,
     reading progress, prayers, dhikr) so answers can be personal. Slash
     commands (/help) build ready-made prompts from that data. */
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
    useData: true,     // attach appData() to each message
  };

  /* ── The person's app data ────────────────────────────────────── */
  function get(k, d) { var v = SS.store.get(k, d); return v == null ? d : v; }
  function surahName(n) { var s = (SS.SURAHS || [])[n - 1]; return s ? s.en : "Surah " + n; }
  function ref(key) { var p = String(key).split(":"); return surahName(+p[0]) + " " + p[0] + ":" + p[1]; }
  function day(d) { return SS.localDate ? SS.localDate(d) : d.toISOString().slice(0, 10); }
  /** A compact, bounded summary of what this device has stored. */
  function appData() {
    var bm = get("quran:bookmarks", {}), keys = Object.keys(bm).sort(function (a, b) { return ((bm[b] && bm[b].at) || 0) - ((bm[a] && bm[a].at) || 0); });
    var prog = get("quran:progress", {}), read = 0, done = 0;
    (SS.SURAHS || []).forEach(function (s) { var a = Math.min(+prog[s.n] || 0, s.ayahs); read += a; if (a >= s.ayahs) done++; });
    var last = get("quran:lastRead", null), streak = get("dhikr:streak", null), log = get("prayers:log", {});
    var week = {};
    for (var i = 6; i >= 0; i--) { var d = day(new Date(Date.now() - i * 864e5)); week[d] = Object.keys(log[d] || {}); }
    var favs = get("duas:favorites", {});
    return {
      today: day(new Date()),
      bookmarks: keys.slice(0, 80).map(function (k) {
        var e = bm[k] || {}, o = { ref: ref(k) };
        if (e.note) o.note = String(e.note).slice(0, 200);
        if (e.folder) o.folder = e.folder;
        if (e.at) o.saved = day(new Date(e.at));
        return o;
      }),
      bookmark_count: keys.length,
      last_read: last && last.surah ? ref(last.surah + ":" + (last.ayah || 1)) : null,
      quran_progress: { ayahs_read: read, of: 6236, percent: Math.round(read / 6236 * 1000) / 10, surahs_completed: done },
      dhikr_streak: streak ? { current: streak.current || 0, longest: streak.longest || 0, last_day: streak.lastDate || null } : null,
      prayers_logged_last_7_days: week,
      favourite_duas: (SS.DUAS || []).filter(function (x) { return favs[x.id]; }).slice(0, 40).map(function (x) { return x.titleEn; }),
    };
  }

  /* ── Slash commands ───────────────────────────────────────────── */
  /** Global ayah number (1–6236) for "2:255", or 0. */
  function globalAyah(sur, ay) {
    var list = SS.SURAHS || [], g = 0;
    if (!(sur >= 1 && sur <= list.length) || !(ay >= 1 && ay <= list[sur - 1].ayahs)) return 0;
    for (var i = 0; i < sur - 1; i++) g += list[i].ayahs;
    return g + ay;
  }
  /** A prompt about one ayah, with its text loaded by the app when possible; null if the ayah doesn't exist. */
  function ayahPrompt(sur, ay, ask) {
    var g = globalAyah(sur, ay);
    if (!g) return null;
    var head = ref(sur + ":" + ay) + ". " + ask;
    return SS.api.ayah(g).then(function (a) {
      return { prompt: head + "\n\nText from the app (quote it exactly if you quote it):\n" + a.arabic + "\n" + a.translation };
    }, function () {
      return { prompt: head + " (The app couldn't load the text, so don't quote it word for word.)" };
    });
  }
  var COMMANDS = [
    { name: "help", hint: "list the commands" },
    { name: "bookmarks", hint: "themes and reflections from your bookmarked ayahs", data: true,
      run: function () {
        if (!Object.keys(get("quran:bookmarks", {})).length) return { local: "You haven't bookmarked any ayahs on this device yet. Bookmark some in the Qur'an, then try /bookmarks again." };
        return { prompt: "Look at my bookmarked ayahs (and my notes and folders on them). Group them into themes, give a short reflection for each theme, and suggest one ayah to revisit this week and why." };
      } },
    { name: "ayah", args: "2:255", hint: "explain an ayah, with its text from the app",
      run: function (arg) {
        var m = String(arg || "").match(/^(\d{1,3})\s*[:.\s]\s*(\d{1,3})$/);
        return (m && ayahPrompt(+m[1], +m[2], "Explain it for me: its meaning, its context, the main lessons, and how I can act on it today."))
          || { local: "Give an ayah like /ayah 2:255 (surah:ayah)." };
      } },
    { name: "progress", hint: "how you're doing, and a next step", data: true,
      run: function () { return { prompt: "Using my app data, summarise how I'm doing with the Qur'an, my prayers this week and my dhikr streak. Be encouraging and honest, and give me one small, specific next step for each." }; } },
    { name: "plan", args: "30", hint: "a Qur'an reading plan from where you are", data: true,
      run: function (arg) {
        var days = Math.min(365, Math.max(1, parseInt(arg, 10) || 30));
        return { prompt: "Make me a Qur'an reading plan to finish the rest of the Qur'an in " + days + " days, starting from my progress and last-read position. Give a daily amount and a simple weekly checklist, and tips for staying consistent." };
      } },
    { name: "dua", args: "anxiety", hint: "duas for a need (checks your favourites)", data: true,
      run: function (arg) {
        if (!arg) return { local: "Say what the dua is for, like /dua exams or /dua anxiety." };
        return { prompt: "Suggest authentic duas for: " + arg + ". Mention any of my favourite duas that fit. For each, give the source if you're confident, and say it's from memory and should be checked." };
      } },
    { name: "quiz", args: "seerah", hint: "a short quiz on an Islamic topic",
      run: function (arg) { return { prompt: "Give me a 5-question multiple-choice quiz on " + (arg || "a mix of basic Islamic knowledge") + ". Ask one question at a time and wait for my answer before telling me if I'm right and asking the next." }; } },
    { name: "reflect", hint: "a short reflection on your last-read ayah",
      run: function () {
        var l = get("quran:lastRead", null);
        return (l && ayahPrompt(+l.surah, +l.ayah || 1, "I read this most recently. Give me a short, heartfelt reflection on it (under 150 words) and one question to think about."))
          || { local: "There's no last-read position on this device yet. Read a little in the Qur'an, then try /reflect again." };
      } },
  ];
  function findCommand(name) { for (var i = 0; i < COMMANDS.length; i++) if (COMMANDS[i].name === name) return COMMANDS[i]; return null; }
  function helpText() {
    return "Commands (they use this device's SalaamStreet data):\n" + COMMANDS.map(function (c) {
      return "/" + c.name + (c.args ? " " + c.args : "") + " — " + c.hint;
    }).join("\n") + "\n\nI only answer Islamic questions. Turn off “Use my app data” to stop sending your data with messages.";
  }
  /** "/cmd args" → Promise<{ prompt, data? } | { local }>; plain text → { prompt: text }. */
  function expand(text) {
    var m = text.match(/^\/([a-z]+)\b\s*([\s\S]*)$/i);
    if (!m) return Promise.resolve({ prompt: text });
    var name = m[1].toLowerCase(), c = findCommand(name === "verse" ? "ayah" : name);
    if (!c) return Promise.resolve({ local: "Unknown command /" + name + ". Type /help to see them all." });
    if (!c.run) return Promise.resolve({ local: helpText() });
    return Promise.resolve(c.run(m[2].trim())).then(function (r) { r.data = !!c.data; return r; });
  }

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
      '<div><h1 id="lab-h" tabindex="-1">AI Testing Lab</h1><p>Private · admin only. Islamic questions only. Real Gemini replies — check anything important against trusted sources.</p></div></header>' +
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
        '<section class="card lab-appstats" aria-labelledby="lab-as-h">' +
          '<div class="card-title"><h2 id="lab-as-h">App stats</h2><span class="muted lab-small">Counts only — no names or emails</span></div>' +
          '<dl class="lab-stats" id="lab-app-stats"><div><dt>Loading…</dt><dd>&nbsp;</dd></div></dl>' +
        '</section>' +
        '<section class="card lab-chat" aria-labelledby="lab-chat-h">' +
          '<div class="card-title"><h2 id="lab-chat-h">Conversation</h2><div class="lab-acts">' +
            '<button class="btn btn-outline btn-sm" id="lab-new" type="button">' + icon("plus") + '<span>New conversation</span></button>' +
            '<button class="btn btn-ghost btn-sm" id="lab-clear" type="button">' + icon("trash") + '<span>Clear</span></button></div></div>' +
          '<div class="lab-log" id="lab-log" role="log" aria-live="polite" aria-label="Messages"></div>' +
          '<p class="lab-err" id="lab-err" role="alert" hidden></p>' +
          '<form class="lab-form" id="lab-form">' +
            '<label class="visually-hidden" for="lab-input">Message</label>' +
            '<div class="lab-cmds" id="lab-cmds" role="group" aria-label="Commands">' + COMMANDS.map(function (c) {
              return '<button class="chip" type="button" data-cmd="' + c.name + '" title="' + esc(c.hint) + '">/' + c.name + "</button>";
            }).join("") + "</div>" +
            '<textarea class="input lab-input" id="lab-input" rows="3" placeholder="Ask an Islamic question, or type / for commands (/help)…" autocomplete="off"></textarea>' +
            '<div class="row-between lab-form-foot"><span class="muted lab-count" id="lab-count"></span>' +
            '<button class="btn" id="lab-send" type="submit">' + icon("next") + '<span>Send</span></button></div>' +
            '<label class="lab-data muted"><input type="checkbox" id="lab-usedata" checked /> Use my app data (bookmarks, progress, prayers, dhikr) to personalise answers</label>' +
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
          '<p class="muted lab-small">Costs shown are what this would cost on Google’s paid plan, worked out from the token counts Gemini reports and the prices above. On the free tier Google charges nothing — when you change the model, change both prices to match it. Check them against Google’s pricing page; Google’s bill is what counts. These limits are app limits, not a hard spending cap — set a budget alert in Google Cloud too.</p>' +
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
    $("lab-usedata").onchange = function () { st.useData = this.checked; };
    $("lab-cmds").onclick = function (e) {
      var b = e.target.closest("[data-cmd]");
      if (!b) return;
      var c = findCommand(b.getAttribute("data-cmd")), input = $("lab-input");
      input.value = "/" + c.name + (c.args ? " " : "");
      if (!c.args) { send(); return; }
      input.focus(); count();
    };
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
      if (r.ok) { st.status = r; gate("ok"); drawStatus(); count(); loadStats(); return r; }
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
      stat("If on a paid plan: today", money(u.today_cost_usd)) +
      stat("If on a paid plan: 7 days", money(u.week_cost_usd) + " · " + int(u.week_requests) + " req") +
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
  /** App-wide counts (admin only, checked by the server). */
  var statsAt = 0;
  function loadStats() {
    if (Date.now() - statsAt < 60000) return;
    statsAt = Date.now();
    api("stats").then(function (r) {
      var el = $("lab-app-stats");
      if (!r.ok) { el.innerHTML = stat("Couldn't load", r.message || "Try again later."); statsAt = 0; return; }
      var a = r.stats || {}, prov = a.by_provider || {};
      var how = Object.keys(prov).sort(function (x, y) { return prov[y] - prov[x]; })
        .map(function (k) { return k.charAt(0).toUpperCase() + k.slice(1) + " " + int(prov[k]); }).join(" · ");
      el.innerHTML =
        stat("Accounts", int(a.accounts)) +
        stat("New this week", int(a.new_7d)) +
        stat("Signed in this week", int(a.active_7d)) +
        stat("Sign-in methods", how || "—") +
        stat("Synced items", int(a.synced_items)) +
        stat("Closed-app reminders", int(a.reminder_devices) + " devices") +
        stat("Kids profiles", int(a.family_children)) +
        stat("MSA members", int(a.msa_members) + (a.msa_pending ? " (+" + int(a.msa_pending) + " waiting)" : "")) +
        stat("MSA posts", int(a.msa_posts));
    });
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
      log.innerHTML = '<div class="lab-empty muted">' + icon("sparkle") + "<p>Ask an Islamic question — tafsir, hadith, fiqh opinions, seerah, duas — or try a command like /bookmarks, /ayah 2:255 or /progress. Type /help for them all.</p></div>";
      return;
    }
    log.innerHTML = st.msgs.map(function (m, i) {
      if (m.role === "user") return '<div class="lab-msg me"><div class="lab-bubble">' + esc(m.shown || m.text) + "</div></div>";
      if (m.local) return '<div class="lab-msg ai lab-local"><div class="lab-bubble">' + rich(m.text) + "</div></div>";
      var meta = m.meta || {};
      var bits = [meta.model, meta.usage && meta.usage.total != null ? int(meta.usage.total) + " tokens" : "tokens not reported",
        meta.cost_usd != null ? "~" + money(meta.cost_usd) + " if paid" : "", meta.latency_ms ? (meta.latency_ms / 1000).toFixed(1) + " s" : ""].filter(Boolean);
      return '<div class="lab-msg ai"><div class="lab-bubble">' + rich(m.text) +
        (meta.truncated ? '<p class="lab-trunc">Cut short: the reply reached the max output tokens.</p>' : "") + "</div>" +
        '<div class="lab-meta"><span>' + esc(bits.join(" · ")) + '</span><button class="btn btn-ghost btn-sm" type="button" data-copy="' + i + '">' + icon("copy") + "<span>Copy</span></button></div></div>";
    }).join("") + (st.busy ? '<div class="lab-msg ai"><div class="lab-bubble lab-typing" aria-label="Gemini is answering"><span></span><span></span><span></span></div></div>' : "");
    log.scrollTop = log.scrollHeight;
  }
  function drawSession() {
    var s = st.session;
    $("lab-session").textContent = s.requests ? "This conversation: " + s.requests + " request" + (s.requests === 1 ? "" : "s") + " · " + int(s.tokens) + " tokens · ~" + money(s.cost) + " if on a paid plan" : "";
  }

  function send() {
    var input = $("lab-input"), text = input.value.trim();
    if (!text || st.busy || $("lab-send").disabled) return;
    var max = st.status ? st.status.settings.max_input_chars : 0;
    if (max && text.length > max) { showErr("That message is " + text.length + " characters; the limit is " + max + "."); return; }
    showErr("");
    input.value = ""; count();
    st.busy = true;
    $("lab-send").disabled = true;
    expand(text).then(function (x) {
      if (x.local) {
        // Answered on this page: shown, but never sent to Gemini.
        st.msgs.push({ role: "user", text: text, local: true }, { role: "model", text: x.local, local: true });
        st.busy = false; $("lab-send").disabled = false;
        drawLog();
        return;
      }
      if (x.data && !st.useData) {
        st.busy = false; $("lab-send").disabled = false;
        input.value = text; count();
        showErr("This command needs your app data. Turn on “Use my app data” first.");
        return;
      }
      st.msgs.push({ role: "user", text: x.prompt, shown: text });
      drawLog();
      ask(input);
    });
  }
  function ask(input) {
    var extra = { messages: st.msgs.filter(function (m) { return !m.local; }).map(function (m) { return { role: m.role, text: m.text }; }) };
    if (st.useData) { try { extra.context = appData(); } catch (_) { /* send without it */ } }
    api("chat", extra).then(function (r) {
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
        if (!input.value) { input.value = mine.shown || mine.text; count(); }
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
