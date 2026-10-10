/* SalaamStreet — msa.js (classic script)
   3.1 NVHS MSA: the Neuqua Valley High School Muslim Student Association's
   announcements, at #/msa, and the newest "show on Home" announcement as a
   slim card on everyone's Home.

   • Reading needs no account: the feed comes from the msa_feed() database
     function over plain fetch (guests never download the account client).
     The last feed is kept on the device so the page works offline.
   • Posting is for the MSA's posters only — signed-in accounts whose email is
     on the list in backend/supabase-schema.sql. The database checks this on
     every write; the app only decides whether to show the buttons.
   • Images are shrunk and re-drawn on the poster's device before upload, which
     also strips camera and location metadata. Each image is fetched on its own
     (msa_image) so the feed stays small.
   • Kids Mode never shows any of this.
   3.1.6 membership: "members only" announcements reach approved members
   (and posters) only — the database leaves them out for everyone else. A
   signed-in person joins with their full name and either the live meeting
   code (6 digits, changes every 10 minutes, shown only to the approver) or a
   request the approver decides. A name that already belongs to a member is
   flagged: see the approver in person. The approver's page (#/msa/manage)
   shows the live code, requests (with a roster check), members and the
   roster, which lives only in the database. */
(function () {
  "use strict";
  window.SS = window.SS || {};
  var $ = function (id) { return document.getElementById(id); };
  function t(k) { return SS.i18n.t(k); }
  function f(k, v) { return SS.ui.f(k, v); }
  function esc(s) { return SS.esc(s); }
  function icon(n, c) { return SS.ui.icon(n, c); }

  var CFG = SS.CONFIG || {};
  var FEED_KEY = "msa:feed", DISMISS_KEY = "msa:dismissed";
  var FRESH_MS = 5 * 60000;
  var MAX_IMAGE = 650000; // characters of data URL; the database allows 700 000

  /* ── Data ─────────────────────────────────────────────────────── */
  function configured() { return !!(CFG.supabaseUrl && CFG.supabaseAnonKey); }
  function call(fn, args) {
    if (!configured()) return Promise.reject(new Error("not-configured"));
    return fetch(CFG.supabaseUrl + "/rest/v1/rpc/" + fn, {
      method: "POST",
      headers: { apikey: CFG.supabaseAnonKey, "Content-Type": "application/json" },
      body: JSON.stringify(args || {}),
    }).then(function (r) {
      if (!r.ok) throw new Error("http " + r.status);
      return r.json();
    });
  }
  function signedIn() { return !!(SS.account && SS.account.signedIn()); }
  function who() { var u = signedIn() && SS.account.user(); return u ? u.id : ""; }
  /** Reads go with the account when signed in, so members get members-only posts. */
  function read(fn, args) { return signedIn() ? rpc(fn, args) : call(fn, args); }
  function cached() {
    var c = SS.store.get(FEED_KEY);
    return c && Array.isArray(c.posts) && (c.who || "") === who() ? c : null;
  }
  var inflight = null, inflightWho = null;
  /** The feed: fresh from the server, or the saved copy when offline. */
  function feed(force) {
    var c = cached();
    if (!force && c && Date.now() - c.at < FRESH_MS) return Promise.resolve(c.posts);
    var asWho = who();
    if (inflight && inflightWho === asWho) return inflight;
    inflightWho = asWho;
    inflight = read("msa_feed").then(function (posts) {
      posts = Array.isArray(posts) ? posts : [];
      SS.store.set(FEED_KEY, { at: Date.now(), posts: posts, who: asWho });
      return posts;
    }).catch(function (err) {
      if (c) return c.posts;
      throw err;
    }).then(function (p) { inflight = null; return p; }, function (e) { inflight = null; throw e; });
    return inflight;
  }
  function live(posts) {
    var now = Date.now();
    return posts.filter(function (p) { return !p.expires_at || Date.parse(p.expires_at) > now; });
  }
  var images = {};
  function image(id) {
    if (!images[id]) images[id] = read("msa_image", { p_id: id }).then(function (src) {
      if (typeof src !== "string" || !/^data:image\/(jpeg|webp|png);base64,/.test(src)) throw new Error("no image");
      return src;
    }).catch(function (e) { delete images[id]; throw e; });
    return images[id];
  }

  /* Where the signed-in person stands (membership, poster, approver); the database decides. */
  var NOBODY = { status: "none", poster: false, approver: false };
  function status() {
    if (!signedIn()) return Promise.resolve(NOBODY);
    return rpc("msa_status").then(function (st) { return st && typeof st === "object" ? st : NOBODY; }, function () { return NOBODY; });
  }
  function rpc(fn, args) {
    return SS.account.client().then(function (c) { return c.rpc(fn, args || {}); }).then(function (r) {
      if (r.error) throw r.error;
      return r.data;
    });
  }

  /* ── Small helpers ────────────────────────────────────────────── */
  function dateLabel(iso) {
    var d = new Date(iso);
    try {
      var o = { month: "short", day: "numeric" };
      if (d.getFullYear() !== new Date().getFullYear()) o.year = "numeric";
      return d.toLocaleDateString(SS.i18n.dateLocale(), o);
    } catch (e) { return SS.localDate(d); }
  }
  function ago(iso) {
    var mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
    if (mins < 1) return t("msa.justNow");
    if (mins < 60) return f("msa.minsAgo", { n: mins });
    if (mins < 24 * 60) return f("msa.hoursAgo", { n: Math.round(mins / 60) });
    return dateLabel(iso);
  }
  /** Escaped text with line breaks kept and web links made tappable. */
  function richText(s) {
    return esc(s).replace(/https?:\/\/[^\s<]+/g, function (u) {
      var tail = (u.match(/[).,!?;:'"]+$/) || [""])[0];
      var url = u.slice(0, u.length - tail.length);
      return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + url.replace(/^https?:\/\//, "") + "</a>" + tail;
    });
  }
  function dismissed() { var d = SS.store.get(DISMISS_KEY, []); return Array.isArray(d) ? d : []; }
  function kidLocked() { return !!(SS.modes && SS.modes.kidLocked()); }

  /* ═══════════ Home: the newest "show on Home" announcement ═══════════ */
  var homeGen = 0;
  function homeCard() {
    var el = $("msa-home");
    if (!el) return;
    var my = ++homeGen;
    if (kidLocked() || !configured()) { el.hidden = true; return; }
    feed().then(function (posts) {
      if (my !== homeGen || SS.currentView() !== "home") return;
      var gone = dismissed();
      var p = live(posts).filter(function (x) { return x.on_home && gone.indexOf(x.id) === -1; })
        .sort(function (a, b) { return Date.parse(b.created_at) - Date.parse(a.created_at); })[0];
      if (!p) { el.hidden = true; el.innerHTML = ""; return; }
      el.innerHTML = '<a class="msa-home-link" href="#/msa/' + esc(p.id) + '">' +
        (p.has_image ? '<span class="msa-thumb" aria-hidden="true"></span>' : '<span class="msa-home-ic" aria-hidden="true">' + icon("bell") + "</span>") +
        '<span class="msa-home-body"><span class="msa-kicker">' + esc(t("msa.club")) + " · " + esc(ago(p.created_at)) + "</span>" +
        '<span class="msa-home-title">' + esc(p.title) + "</span></span>" + icon("chev-r", "chev") + "</a>" +
        '<button class="icon-btn msa-home-x" type="button" aria-label="' + esc(t("msa.dismiss")) + '">' + icon("x") + "</button>";
      el.hidden = false;
      el.querySelector(".msa-home-x").onclick = function () {
        var d = dismissed().concat(p.id).slice(-50);
        SS.store.set(DISMISS_KEY, d);
        el.hidden = true;
      };
      if (p.has_image) image(p.id).then(function (src) {
        var th = el.querySelector(".msa-thumb");
        if (th && my === homeGen) th.style.backgroundImage = 'url("' + src + '")';
      }, function () {
        var th = el.querySelector(".msa-thumb");
        if (th) th.outerHTML = '<span class="msa-home-ic" aria-hidden="true">' + icon("bell") + "</span>";
      });
    }).catch(function () { if (my === homeGen) el.hidden = true; });
  }

  /* ═══════════ #/msa — the MSA page ═══════════ */
  var pageGen = 0, poster = false, me = NOBODY, posts = [];
  function msaInit(params) {
    var my = ++pageGen, focusId = params && params[0];
    stopCode();
    if (focusId === "manage") return manageInit(my);
    $("msa-feed").hidden = false; $("msa-manage").hidden = true;
    var list = $("msa-list");
    $("msa-new").hidden = true; $("msa-admin-btn").hidden = true;
    if (!configured()) { SS.ui.renderState(list, { kind: "empty", icon: "bell", text: t("msa.unavailable") }); $("msa-member").innerHTML = ""; return; }
    var c = cached();
    if (c) draw(c.posts, focusId); else { list.setAttribute("aria-busy", "true"); list.innerHTML = SS.ui.skeletons(2, 180); }
    if (SS.account && SS.account.restore) SS.account.restore();
    memberCard();
    status().then(function (st) {
      if (my !== pageGen || SS.currentView() !== "msa") return null;
      me = st; poster = !!st.poster;
      $("msa-new").hidden = !poster;
      $("msa-admin-btn").hidden = !st.approver;
      memberCard();
      return feed(true).then(function (all) { if (my === pageGen && SS.currentView() === "msa") draw(all, focusId); });
    }).catch(function () {
      if (my !== pageGen) return;
      if (!cached()) SS.ui.renderState(list, { kind: "error", retry: function () { msaInit(params); } });
    });
    $("msa-new").onclick = function () { compose(null); };
    footer();
  }
  function footer() {
    var el = $("msa-foot");
    // 3.1.6: signing in now starts from the "Join the NVHS MSA" card.
    el.innerHTML = "";
  }

  /* ── Membership: join with your name and the meeting code, or ask ── */
  function memberCard() {
    var el = $("msa-member");
    if (!configured()) { el.innerHTML = ""; return; }
    var st = me.status;
    if (st === "approved" || me.approver || me.poster) {
      el.innerHTML = '<p class="msa-chip">' + icon("check") + "<span>" +
        esc(st === "approved" ? f("msa.memberUntil", { d: dateLabel(me.expires_at) }) : t(me.approver ? "msa.youApprove" : "msa.youPost")) + "</span></p>";
      return;
    }
    if (!signedIn()) { el.innerHTML = schoolHtml(false); wireSchool(el); return; }
    if (st === "pending" || st === "flagged") {
      el.innerHTML = '<div class="card msa-join ' + st + '" role="status"><span class="msa-join-ic" aria-hidden="true">' + icon(st === "flagged" ? "users" : "clock") + "</span>" +
        '<div class="msa-join-t"><b>' + esc(t(st === "flagged" ? "msa.flaggedTitle" : "msa.pendingTitle")) + "</b><span>" +
        esc(st === "flagged" ? t("msa.flaggedText") : f("msa.pendingText", { n: me.name })) + "</span>" +
        (st === "pending" ? '<button class="link-btn" type="button" id="msa-have-code">' + esc(t("msa.haveCode")) + "</button>" : "") + "</div>" +
        '<button class="btn btn-ghost btn-sm" type="button" id="msa-withdraw">' + esc(t("msa.withdraw")) + "</button></div>";
      $("msa-withdraw").onclick = function () {
        rpc("msa_leave").then(function () { me = { status: "none", poster: me.poster, approver: me.approver }; memberCard(); }).catch(function (e) { SS.toast(errText(e)); });
      };
      if ($("msa-have-code")) $("msa-have-code").onclick = function () { joinForm(el, me.name); };
      return;
    }
    // Not a member yet: the school-email way first, then the meeting code or a request.
    el.innerHTML = (me.school ? '<div class="card msa-join notfound" role="status"><span class="msa-join-ic" aria-hidden="true">' + icon("search") + "</span>" +
      '<div class="msa-join-t"><b>' + esc(t("msa.notOnListTitle")) + "</b><span>" + esc(f("msa.notOnListText", { e: me.email || "" })) + "</span></div></div>"
      : schoolHtml(true)) + '<div id="msa-join-other"></div>';
    wireSchool(el);
    joinForm($("msa-join-other"), "");
  }
  /** "NVHS student? Sign in with your school email — not Google — and you're in." */
  function schoolHtml(signedInElsewhere) {
    return '<section class="card msa-school" aria-labelledby="msa-school-h">' +
      '<h2 class="h-sm" id="msa-school-h">' + icon("users") + "<span>" + esc(t("msa.schoolTitle")) + "</span></h2>" +
      (signedInElsewhere ? '<p class="msa-school-now">' + esc(f("msa.signedInAs", { e: me.email || "" })) + "</p>" : "") +
      '<ol class="msa-steps"><li>' + esc(t("msa.step1")) + "</li><li>" + esc(t("msa.step2")) + "</li><li>" + esc(t("msa.step3")) + "</li></ol>" +
      '<p class="msa-not-google">' + icon("x") + "<span>" + esc(t("msa.notGoogle")) + "</span></p>" +
      '<button class="btn" type="button" id="msa-school-go">' + icon("mail") + "<span>" + esc(t(signedInElsewhere ? "msa.switchToSchool" : "msa.signInSchool")) + "</span></button>" +
      '<p class="tiny">' + esc(t("msa.schoolNote")) + "</p></section>";
  }
  function wireSchool(el) {
    var b = el.querySelector("#msa-school-go");
    if (!b) return;
    b.onclick = function () {
      if (!signedIn()) { SS.account.openSignIn("email"); return; }
      b.disabled = true;
      SS.account.signOut(true).then(function () { SS.account.openSignIn("email"); }, function () { b.disabled = false; });
    };
  }
  function joinForm(el, name) {
    var denied = me.status === "denied";
    el.innerHTML = '<form class="card msa-join-form" id="msa-join" novalidate>' +
      '<h2 class="h-sm">' + esc(t("msa.otherWay")) + "</h2>" +
      '<p class="tiny">' + esc(t(denied ? "msa.deniedText" : "msa.joinHelp")) + "</p>" +
      '<label class="field-l" for="msa-j-name"><b>' + esc(t("msa.fullName")) + "</b></label>" +
      '<input class="input" id="msa-j-name" autocomplete="name" maxlength="80" value="' + esc(name) + '" aria-describedby="msa-j-err" />' +
      '<label class="field-l" for="msa-j-code"><b>' + esc(t("msa.meetingCode")) + '</b> <span class="tiny">' + esc(t("msa.codeOptional")) + "</span></label>" +
      '<input class="input msa-code-in" id="msa-j-code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="123456" aria-describedby="msa-j-err msa-j-help" />' +
      '<p class="tiny" id="msa-j-help">' + esc(t("msa.codeHelp")) + "</p>" +
      '<p class="field-error" id="msa-j-err" role="alert"></p>' +
      '<button class="btn" type="submit" id="msa-j-go">' + esc(t("msa.join")) + "</button></form>";
    $("msa-join").onsubmit = function (e) {
      e.preventDefault();
      var nm = $("msa-j-name").value.trim(), code = $("msa-j-code").value.replace(/\D/g, ""), err = $("msa-j-err");
      err.textContent = "";
      if (nm.split(/\s+/).length < 2) { err.textContent = t("msa.needFullName"); $("msa-j-name").setAttribute("aria-invalid", "true"); $("msa-j-name").focus(); return; }
      $("msa-j-name").removeAttribute("aria-invalid");
      if (code && code.length !== 6) { err.textContent = t("msa.codeSix"); $("msa-j-code").focus(); return; }
      $("msa-j-go").disabled = true;
      rpc("msa_join", code ? { p_name: nm, p_code: code } : { p_name: nm }).then(function (r) {
        if (r && r.error === "wrong-code") {
          $("msa-j-go").disabled = false;
          err.textContent = t("msa.wrongCode");
          $("msa-j-code").setAttribute("aria-invalid", "true"); $("msa-j-code").select();
          return;
        }
        me = Object.assign({}, me, r);
        SS.toast(t(r.status === "approved" ? "msa.welcome" : r.status === "flagged" ? "msa.flaggedTitle" : "msa.requestSent"));
        if (r.status === "approved") refresh(); else memberCard();
      }).catch(function (er) {
        $("msa-j-go").disabled = false;
        err.textContent = /too many/.test((er && er.message) || "") ? t("msa.tooManyTries") : /first and last/.test((er && er.message) || "") ? t("msa.needFullName") : errText(er);
      });
    };
  }

  /* ═══════════ #/msa/manage — the approver's page ═══════════ */
  var codeTimer = null;
  function stopCode() { clearInterval(codeTimer); codeTimer = null; }
  function manageInit(my) {
    $("msa-feed").hidden = true;
    var root = $("msa-manage");
    root.hidden = false;
    root.innerHTML = '<div aria-busy="true">' + SS.ui.skeletons(3, 120) + "</div>";
    if (SS.account && SS.account.restore) SS.account.restore();
    status().then(function (st) {
      if (my !== pageGen) return;
      me = st;
      if (!st.approver) { SS.ui.renderState(root, { kind: "empty", icon: "lock", text: t("msa.approverOnly") }); return; }
      root.innerHTML =
        '<a class="back-link" href="#/msa">' + icon("chev-l", "flip") + "<span>" + esc(t("msa.club")) + "</span></a>" +
        '<h2 class="h-sm msa-manage-h">' + esc(t("msa.manage")) + "</h2>" +
        '<div class="msa-stats" id="msa-stats" aria-live="polite"></div>' +
        '<section aria-labelledby="msa-req-h"><h3 class="group-label" id="msa-req-h">' + esc(t("msa.needsYou")) + '</h3><div class="stack" id="msa-req"></div></section>' +
        '<details class="card msa-code-wrap" id="msa-code-wrap"><summary>' + icon("lock") + "<span>" + esc(t("msa.showCode")) + "</span></summary>" +
        '<div class="msa-code-card"><p class="msa-code" id="msa-code" aria-live="polite">······</p>' +
        '<div class="msa-code-bar" aria-hidden="true"><span id="msa-code-bar"></span></div>' +
        '<p class="tiny" id="msa-code-left"></p><p class="tiny">' + esc(t("msa.liveCodeHelp")) + "</p></div></details>" +
        '<section aria-labelledby="msa-list-h"><h3 class="group-label" id="msa-list-h">' + esc(t("msa.theList")) + "</h3>" +
        '<div class="search mb-1">' + icon("search") + '<label class="visually-hidden" for="msa-find">' + esc(t("msa.findName")) + "</label>" +
        '<input class="input" id="msa-find" type="search" autocomplete="off" placeholder="' + esc(t("msa.findName")) + '" /></div>' +
        '<div class="msa-roster-list" id="msa-mem"></div></section>' +
        '<details class="card msa-edit" id="msa-edit"><summary>' + icon("edit") + "<span>" + esc(t("msa.editList")) + "</span></summary>" +
        '<form id="msa-roster" novalidate><p class="tiny" id="msa-roster-help">' + esc(t("msa.rosterHelp")) + "</p>" +
        '<label class="visually-hidden" for="msa-roster-in">' + esc(t("msa.roster")) + "</label>" +
        '<textarea class="input msa-roster-in" id="msa-roster-in" rows="8" aria-describedby="msa-roster-help msa-roster-n"></textarea>' +
        '<p class="tiny" id="msa-roster-n"></p><button class="btn btn-sm" type="submit">' + esc(t("msa.saveRoster")) + "</button></form></details>" +
        '<p class="note msa-future">' + icon("info") + "<span>" + esc(t("msa.futureNote")) + "</span></p>";
      $("msa-code-wrap").addEventListener("toggle", function () { if (this.open) liveCode(my); else stopCode(); });
      $("msa-find").oninput = function () { drawList(); };
      people(my);
      rpc("msa_roster_get").then(function (names) {
        if (my !== pageGen || !$("msa-roster-in")) return;
        $("msa-roster-in").value = (names || []).join("\n");
        $("msa-roster-n").textContent = f("msa.rosterCount", { n: (names || []).length });
      });
      $("msa-roster").onsubmit = function (e) {
        e.preventDefault();
        var names = rosterLines($("msa-roster-in").value);
        rpc("msa_roster_set", { p_names: names }).then(function (n) {
          $("msa-roster-in").value = names.join("\n");
          $("msa-roster-n").textContent = f("msa.rosterCount", { n: n });
          SS.toast(f("msa.rosterSaved", { n: n }));
          people(my);
        }).catch(function (er) { SS.toast(errText(er)); });
      };
    });
  }
  /** One name per line; list bullets, headings ("Teachers", "124 students") and blanks dropped. */
  function rosterLines(text) {
    var seen = {};
    return String(text || "").split(/\r?\n/).map(function (l) { return l.replace(/^[\s*•\-–·]+/, "").replace(/\s+/g, " ").trim(); })
      .filter(function (l) {
        if (!l || /\d/.test(l) || l.split(" ").length < 2 || l.length > 80) return false;
        var k = l.toLowerCase();
        if (seen[k]) return false;
        seen[k] = 1;
        return true;
      });
  }
  function liveCode(my) {
    stopCode();
    var cur = null, fetching = false;
    function load() {
      if (fetching) return;
      fetching = true;
      rpc("msa_live_code").then(function (r) { fetching = false; cur = r; tick(); }, function () { fetching = false; });
    }
    function tick() {
      if (my !== pageGen || !$("msa-code")) return stopCode();
      if (!cur) return;
      var left = Date.parse(cur.changes_at) - Date.now();
      if (left <= 0) { cur = null; load(); return; }
      $("msa-code").textContent = cur.code.slice(0, 3) + " " + cur.code.slice(3);
      var m = Math.floor(left / 60000), sec = Math.floor(left / 1000) % 60;
      $("msa-code-left").textContent = f("msa.codeChanges", { t: m + ":" + (sec < 10 ? "0" : "") + sec });
      $("msa-code-bar").style.inlineSize = Math.max(0, Math.min(100, left / 6000)) + "%";
    }
    load();
    codeTimer = setInterval(tick, 1000);
  }
  var roster = [], others = [];
  function people(my) {
    Promise.all([rpc("msa_people"), rpc("msa_roster_status")]).then(function (r) {
      if (my !== pageGen || !$("msa-req")) return;
      var list = r[0] || [];
      roster = r[1] || [];
      var onList = {};
      roster.forEach(function (x) { if (x.user_id) onList[x.user_id] = 1; });
      var reqs = list.filter(function (p) { return p.status === "flagged" || p.status === "pending"; });
      others = list.filter(function (p) { return p.status === "approved" && !onList[p.user_id]; });
      var joined = roster.filter(function (x) { return x.user_id; }).length;
      var members = list.filter(function (p) { return p.status === "approved"; }).length;
      $("msa-stats").innerHTML = stat(members, t("msa.statMembers")) + stat(reqs.length, t("msa.statWaiting"), reqs.length ? "warn" : "") +
        stat(joined + "/" + roster.length, t("msa.statJoined"));
      $("msa-req").innerHTML = reqs.length ? reqs.map(personRow).join("") : '<p class="msa-caught">' + icon("check") + "<span>" + esc(t("msa.caughtUp")) + "</span></p>";
      drawList();
      $("msa-manage").onclick = function (e) {
        var b = e.target.closest("[data-act]");
        if (!b) return;
        var act = b.getAttribute("data-act"), uid = b.getAttribute("data-user"), nm = b.getAttribute("data-name");
        if (act === "remove" && !window.confirm(f("msa.removeConfirm", { n: nm }))) return;
        b.disabled = true;
        rpc("msa_decide", { p_user: uid, p_action: act }).then(function () {
          SS.toast(f("msa.did_" + act, { n: nm }));
          people(my);
        }).catch(function (er) {
          b.disabled = false;
          SS.toast(/already belongs/.test((er && er.message) || "") ? t("msa.nameTaken") : errText(er));
        });
      };
    }).catch(function () {
      if ($("msa-req")) SS.ui.renderState($("msa-req"), { kind: "error", retry: function () { people(my); } });
    });
  }
  function stat(n, label, cls) {
    return '<div class="msa-stat' + (cls ? " " + cls : "") + '"><b>' + esc(String(n)) + "</b><span>" + esc(label) + "</span></div>";
  }
  /** The list: everyone on the roster (joined or not), then members who joined another way. */
  function drawList() {
    var el = $("msa-mem");
    if (!el) return;
    var q = (($("msa-find") && $("msa-find").value) || "").trim().toLowerCase();
    var match = function (n) { return !q || String(n || "").toLowerCase().indexOf(q) > -1; };
    var rows = roster.filter(function (x) { return match(x.name); }).map(function (x) {
      return '<div class="msa-row' + (x.user_id ? " in" : "") + '"><span class="msa-row-n">' + esc(x.name) + "</span>" +
        (x.user_id ? '<span class="msa-row-s">' + icon("check") + "<span>" + esc(t("msa.via_" + x.via)) + "</span></span>" +
          '<button class="icon-btn msa-del" type="button" data-act="remove" data-user="' + esc(x.user_id) + '" data-name="' + esc(x.name) + '" aria-label="' + esc(f("msa.removeConfirm", { n: x.name })) + '">' + icon("x") + "</button>"
          : '<span class="msa-row-s no">' + esc(t("msa.notYet")) + "</span>") + "</div>";
    });
    var extra = others.filter(function (p) { return match(p.name); });
    el.innerHTML = (rows.length ? rows.join("") : '<p class="muted">' + esc(t(roster.length ? "msa.noMatch" : "msa.noRosterYet")) + "</p>") +
      (extra.length ? '<p class="group-label mt-2">' + esc(t("msa.othersJoined")) + "</p>" + extra.map(personRow).join("") : "");
  }
  function personRow(p) {
    var badge = p.status === "flagged" ? '<span class="badge badge-warn">' + icon("users") + "<span>" + esc(t("msa.flaggedBadge")) + "</span></span>"
      : p.status === "denied" ? '<span class="badge badge-muted">' + esc(t("msa.deniedBadge")) + "</span>"
      : p.status === "pending" ? '<span class="badge">' + esc(t("msa.pendingBadge")) + "</span>" : "";
    var roster = '<span class="msa-roster-tag ' + (p.on_roster ? "yes" : "no") + '">' + icon(p.on_roster ? "check" : "x") + "<span>" + esc(t(p.on_roster ? "msa.onRoster" : "msa.notOnRoster")) + "</span></span>";
    var acts = p.status === "approved"
      ? '<button class="btn btn-ghost btn-sm msa-del" type="button" data-act="remove" data-user="' + esc(p.user_id) + '" data-name="' + esc(p.name) + '">' + esc(t("msa.remove")) + "</button>"
      : '<button class="btn btn-sm" type="button" data-act="approve" data-user="' + esc(p.user_id) + '" data-name="' + esc(p.name) + '">' + esc(t(p.status === "flagged" ? "msa.approveMet" : "msa.approve")) + "</button>" +
        (p.status !== "denied" ? '<button class="btn btn-ghost btn-sm" type="button" data-act="deny" data-user="' + esc(p.user_id) + '" data-name="' + esc(p.name) + '">' + esc(t("msa.deny")) + "</button>" : "") +
        '<button class="btn btn-ghost btn-sm msa-del" type="button" data-act="remove" data-user="' + esc(p.user_id) + '" data-name="' + esc(p.name) + '">' + esc(t("msa.delete")) + "</button>";
    return '<article class="card msa-person' + (p.status === "flagged" ? " flagged" : "") + '"><div class="msa-person-t"><b>' + esc(p.name) + "</b> " + badge +
      '<span class="tiny">' + esc(p.email || "") + " · " + esc(t("msa.via_" + p.via)) + " · " + esc(dateLabel(p.created_at)) + "</span>" + roster +
      (p.status === "flagged" ? '<span class="tiny msa-flag-note">' + esc(t("msa.flaggedNote")) + "</span>" : "") + "</div>" +
      '<div class="msa-person-acts">' + acts + "</div></article>";
  }
    function draw(all, focusId) {
    var list = $("msa-list");
    posts = live(all);
    list.removeAttribute("aria-busy");
    if (!posts.length) {
      list.innerHTML = '<div class="card msa-empty">' + '<span class="msa-empty-ic" aria-hidden="true">' + icon("bell") + "</span>" +
        "<h2>" + esc(t("msa.emptyTitle")) + '</h2><p class="muted">' + esc(t("msa.emptyText")) + "</p></div>";
      return;
    }
    list.innerHTML = posts.map(function (p, i) { return postHtml(p, i === 0 && !focusId); }).join("");
    posts.forEach(function (p) {
      if (!p.has_image) return;
      image(p.id).then(function (src) {
        var box = $("msa-img-" + p.id);
        if (box) box.innerHTML = '<img src="' + src + '" alt="" decoding="async" />';
      }, function () {
        var box = $("msa-img-" + p.id);
        if (box) box.parentNode.removeChild(box);
      });
    });
    list.querySelectorAll(".msa-text").forEach(function (el) {
      if (el.scrollHeight > el.clientHeight + 4) el.parentNode.querySelector(".msa-more").hidden = false;
    });
    list.onclick = function (e) {
      var more = e.target.closest(".msa-more");
      if (more) {
        var txt = more.parentNode.querySelector(".msa-text");
        var open = txt.classList.toggle("open");
        more.textContent = t(open ? "msa.less" : "msa.more");
        more.setAttribute("aria-expanded", String(open));
        return;
      }
      var ed = e.target.closest("[data-edit]"), del = e.target.closest("[data-del]");
      var id = ed ? ed.getAttribute("data-edit") : del ? del.getAttribute("data-del") : null;
      var p = id && posts.filter(function (x) { return x.id === id; })[0];
      if (!p) return;
      if (ed) compose(p);
      else remove(p);
    };
    if (focusId) {
      var card = $("msa-p-" + focusId);
      if (card) { card.classList.add("focus"); card.scrollIntoView({ block: "start" }); }
    }
  }
  function postHtml(p, lead) {
    return '<article class="card msa-post' + (lead ? " lead" : "") + '" id="msa-p-' + esc(p.id) + '" aria-labelledby="msa-t-' + esc(p.id) + '">' +
      (p.has_image ? '<div class="msa-img" id="msa-img-' + esc(p.id) + '"><div class="skeleton"></div></div>' : "") +
      '<div class="msa-post-body">' +
      '<p class="msa-meta">' + (p.pinned ? '<span class="badge">' + icon("pin") + "<span>" + esc(t("msa.pinned")) + "</span></span>" : "") +
      (p.members_only ? '<span class="badge badge-gold">' + icon("lock") + "<span>" + esc(t("msa.membersOnly")) + "</span></span>" : "") +
      "<span>" + esc(t("msa.club")) + " · " + '<time datetime="' + esc(p.created_at) + '">' + esc(dateLabel(p.created_at)) + "</time></span></p>" +
      '<h2 class="msa-title" id="msa-t-' + esc(p.id) + '">' + esc(p.title) + "</h2>" +
      (p.body ? '<p class="msa-text">' + richText(p.body) + '</p><button class="link-btn msa-more" type="button" aria-expanded="false" hidden>' + esc(t("msa.more")) + "</button>" : "") +
      (poster ? '<div class="msa-admin"><button class="btn btn-ghost btn-sm" type="button" data-edit="' + esc(p.id) + '">' + icon("edit") + "<span>" + esc(t("msa.edit")) + "</span></button>" +
        '<button class="btn btn-ghost btn-sm msa-del" type="button" data-del="' + esc(p.id) + '">' + icon("trash") + "<span>" + esc(t("msa.delete")) + "</span></button>" +
        (p.on_home ? '<span class="badge badge-gold">' + esc(t("msa.onHomeBadge")) + "</span>" : "") +
        (p.expires_at ? '<span class="tiny">' + esc(f("msa.until", { d: dateLabel(p.expires_at) })) + "</span>" : "") + "</div>" : "") +
      "</div></article>";
  }
  function remove(p) {
    if (!window.confirm(f("msa.deleteConfirm", { t: p.title }))) return;
    rpc("msa_post_delete", { p_id: p.id }).then(function () {
      SS.toast(t("msa.deleted"));
      refresh();
    }).catch(function (err) { SS.toast(errText(err)); });
  }
  function refresh() {
    images = {};
    SS.store.remove(FEED_KEY);
    if (SS.currentView() === "msa") msaInit([]);
  }
  function errText(err) {
    var m = (err && (err.message || err.code)) || "";
    if (/not an MSA poster|42501/.test(m)) return t("msa.notPoster");
    if (/too many/.test(m)) return t("msa.tooMany");
    if (navigator.onLine === false || /fetch|network|offline/i.test(m)) return t("common.offline");
    return t("common.error");
  }

  /* ═══════════ Writing an announcement ═══════════ */
  /** Shrink a picked photo to a JPEG data URL small enough to post. */
  function shrink(file) {
    function load() {
      if (window.createImageBitmap) return window.createImageBitmap(file).catch(viaImg);
      return viaImg();
    }
    function viaImg() {
      return new Promise(function (resolve, reject) {
        var url = URL.createObjectURL(file), img = new Image();
        img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("image")); };
        img.src = url;
      });
    }
    return load().then(function (bmp) {
      var w = bmp.width, h = bmp.height;
      if (!w || !h) throw new Error("image");
      var sizes = [1280, 1080, 900, 720], quals = [0.82, 0.72, 0.62];
      for (var i = 0; i < sizes.length; i++) {
        var k = Math.min(1, sizes[i] / Math.max(w, h));
        var cv = document.createElement("canvas");
        cv.width = Math.round(w * k); cv.height = Math.round(h * k);
        var ctx = cv.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.drawImage(bmp, 0, 0, cv.width, cv.height);
        for (var j = 0; j < quals.length; j++) {
          var out = cv.toDataURL("image/jpeg", quals[j]);
          if (out.length <= MAX_IMAGE) return out;
        }
      }
      throw new Error("too big");
    });
  }
  var EXPIRY = [["never", 0], ["day", 1], ["week", 7], ["month", 30]];
  function compose(p) {
    var dlg = $("msa-dialog"), body = $("msa-dialog-body");
    var img = p && p.has_image ? "keep" : null; // "keep" | null (none) | data URL (new)
    var keepSrc = null;
    var exOpts = EXPIRY.map(function (x) { return '<option value="' + x[0] + '">' + esc(t("msa.exp_" + x[0])) + "</option>"; }).join("");
    if (p && p.expires_at) exOpts = '<option value="keep" selected>' + esc(f("msa.until", { d: dateLabel(p.expires_at) })) + "</option>" + exOpts;
    body.innerHTML =
      '<div class="modal-head"><h2 id="msa-dialog-h">' + esc(t(p ? "msa.editTitle" : "msa.newTitle")) + "</h2>" +
      '<button class="icon-btn" data-close type="button" aria-label="' + esc(t("common.close")) + '">' + icon("x") + "</button></div>" +
      '<form id="msa-form" class="msa-form" novalidate>' +
      '<label class="field-l" for="msa-f-title"><b>' + esc(t("msa.fTitle")) + "</b></label>" +
      '<input class="input" id="msa-f-title" maxlength="120" required autocomplete="off" aria-describedby="msa-f-err" value="' + esc(p ? p.title : "") + '" />' +
      '<label class="field-l" for="msa-f-body"><b>' + esc(t("msa.fBody")) + '</b> <span class="tiny">' + esc(t("msa.optional")) + "</span></label>" +
      '<textarea class="input msa-f-body" id="msa-f-body" maxlength="4000" rows="5">' + esc(p ? p.body : "") + "</textarea>" +
      '<p class="field-l"><b>' + esc(t("msa.fImage")) + '</b> <span class="tiny">' + esc(t("msa.optional")) + "</span></p>" +
      '<div class="msa-pick" id="msa-pick"></div>' +
      '<input type="file" id="msa-f-file" accept="image/*" hidden />' +
      '<p class="tiny msa-photo-note">' + esc(t("msa.photoNote")) + "</p>" +
      '<div class="set-row"><span id="msa-f-home-l"><b>' + esc(t("msa.fHome")) + '</b><br><span class="tiny">' + esc(t("msa.fHomeSub")) + "</span></span>" +
      '<label class="switch"><input type="checkbox" id="msa-f-home" aria-labelledby="msa-f-home-l"' + (p && p.on_home ? " checked" : "") + ' /><span class="trk"></span><span class="th"></span></label></div>' +
      '<div class="set-row"><span id="msa-f-mem-l"><b>' + esc(t("msa.fMembers")) + '</b><br><span class="tiny">' + esc(t("msa.fMembersSub")) + "</span></span>" +
      '<label class="switch"><input type="checkbox" id="msa-f-mem" aria-labelledby="msa-f-mem-l"' + (p && p.members_only ? " checked" : "") + ' /><span class="trk"></span><span class="th"></span></label></div>' +
      '<div class="set-row"><span id="msa-f-pin-l"><b>' + esc(t("msa.fPin")) + "</b></span>" +
      '<label class="switch"><input type="checkbox" id="msa-f-pin" aria-labelledby="msa-f-pin-l"' + (p && p.pinned ? " checked" : "") + ' /><span class="trk"></span><span class="th"></span></label></div>' +
      '<div class="set-row"><label for="msa-f-exp"><b>' + esc(t("msa.fExpires")) + "</b></label>" +
      '<select class="input msa-f-exp" id="msa-f-exp">' + exOpts + "</select></div>" +
      '<p class="field-error" id="msa-f-err" role="alert"></p>' +
      '<div class="msa-form-acts"><button class="btn btn-ghost" type="button" data-close>' + esc(t("common.cancel")) + "</button>" +
      '<button class="btn" type="submit" id="msa-f-go">' + icon(p ? "check" : "share") + "<span>" + esc(t(p ? "msa.save" : "msa.post")) + "</span></button></div>" +
      "</form>";
    function drawPick() {
      var pick = $("msa-pick");
      var src = img === "keep" ? keepSrc : img;
      if (!img) {
        pick.innerHTML = '<button class="msa-add-img" type="button" id="msa-f-add">' + icon("camera") + "<span>" + esc(t("msa.addImage")) + "</span></button>";
        $("msa-f-add").onclick = function () { $("msa-f-file").click(); };
        return;
      }
      pick.innerHTML = '<div class="msa-pick-prev">' + (src ? '<img src="' + src + '" alt="" />' : '<div class="skeleton"></div>') + "</div>" +
        '<div class="msa-pick-acts"><button class="btn btn-outline btn-sm" type="button" id="msa-f-change">' + icon("refresh") + "<span>" + esc(t("msa.changeImage")) + "</span></button>" +
        '<button class="btn btn-ghost btn-sm" type="button" id="msa-f-rm">' + icon("trash") + "<span>" + esc(t("msa.removeImage")) + "</span></button></div>";
      $("msa-f-change").onclick = function () { $("msa-f-file").click(); };
      $("msa-f-rm").onclick = function () { img = null; drawPick(); };
    }
    drawPick();
    if (img === "keep") image(p.id).then(function (src) { keepSrc = src; if (img === "keep") drawPick(); }, function () { /* keeps it anyway */ });
    $("msa-f-file").onchange = function () {
      var file = this.files && this.files[0];
      this.value = "";
      if (!file) return;
      $("msa-f-err").textContent = "";
      $("msa-pick").innerHTML = '<div class="msa-pick-prev"><div class="skeleton"></div></div>';
      shrink(file).then(function (src) { img = src; drawPick(); }, function () {
        $("msa-f-err").textContent = t("msa.imageError");
        drawPick();
      });
    };
    $("msa-form").onsubmit = function (e) {
      e.preventDefault();
      var title = $("msa-f-title").value.trim(), err = $("msa-f-err");
      err.textContent = "";
      if (!title) { err.textContent = t("msa.needTitle"); $("msa-f-title").setAttribute("aria-invalid", "true"); $("msa-f-title").focus(); return; }
      $("msa-f-title").removeAttribute("aria-invalid");
      var exp = $("msa-f-exp").value, days = 0;
      EXPIRY.forEach(function (x) { if (x[0] === exp) days = x[1]; });
      var post = {
        title: title, body: $("msa-f-body").value.trim(),
        on_home: $("msa-f-home").checked, pinned: $("msa-f-pin").checked, members_only: $("msa-f-mem").checked,
        expires_at: exp === "keep" ? p.expires_at : days ? new Date(Date.now() + days * 864e5).toISOString() : null,
      };
      if (p) post.id = p.id;
      if (img !== "keep") post.image = img;
      var go = $("msa-f-go");
      go.disabled = true;
      rpc("msa_post_save", { p: post }).then(function () {
        dlg.close();
        SS.toast(t(p ? "msa.saved" : "msa.posted"));
        refresh();
      }).catch(function (er) {
        go.disabled = false;
        err.textContent = errText(er);
      });
    };
    if (!dlg.open) SS.openDialog(dlg);
    setTimeout(function () { if (!p) $("msa-f-title").focus(); }, 50);
  }

  SS.views.msa = msaInit;
  SS.leave.msa = function () { stopCode(); pageGen++; };
  SS.msa = { feed: feed, homeCard: homeCard, shrink: shrink, richText: richText, rosterLines: rosterLines };
  SS.msaBoot = function () {
    // Sign-in is restored after the page first draws: redraw for the person, then.
    document.addEventListener("ss:auth", function () {
      images = {};
      if (SS.currentView() === "msa") msaInit((location.hash.split("/").slice(2)));
      else if (SS.currentView() === "home") homeCard();
    });
    var prevHome = SS.hooks.homeInit;
    SS.hooks.homeInit = function () { if (prevHome) prevHome.apply(null, arguments); homeCard(); };
  };
})();
