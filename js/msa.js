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
   • Kids Mode never shows any of this. */
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
  function cached() {
    var c = SS.store.get(FEED_KEY);
    return c && Array.isArray(c.posts) ? c : null;
  }
  var inflight = null;
  /** The feed: fresh from the server, or the saved copy when offline. */
  function feed(force) {
    var c = cached();
    if (!force && c && Date.now() - c.at < FRESH_MS) return Promise.resolve(c.posts);
    if (inflight) return inflight;
    inflight = call("msa_feed").then(function (posts) {
      posts = Array.isArray(posts) ? posts : [];
      SS.store.set(FEED_KEY, { at: Date.now(), posts: posts });
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
    if (!images[id]) images[id] = call("msa_image", { p_id: id }).then(function (src) {
      if (typeof src !== "string" || !/^data:image\/(jpeg|webp|png);base64,/.test(src)) throw new Error("no image");
      return src;
    }).catch(function (e) { delete images[id]; throw e; });
    return images[id];
  }

  /* Posting (signed-in posters only; the database decides). */
  var posterFor = null, posterAns = false;
  function isPoster() {
    if (!SS.account || !SS.account.signedIn()) return Promise.resolve(false);
    var uid = SS.account.user() && SS.account.user().id;
    if (posterFor === uid) return Promise.resolve(posterAns);
    return rpc("msa_is_poster").then(function (yes) { posterFor = uid; posterAns = yes === true; return posterAns; }, function () { return false; });
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
  var pageGen = 0, poster = false, posts = [];
  function msaInit(params) {
    var my = ++pageGen, focusId = params && params[0];
    var list = $("msa-list");
    $("msa-new").hidden = true;
    if (!configured()) { SS.ui.renderState(list, { kind: "empty", icon: "bell", text: t("msa.unavailable") }); return; }
    var c = cached();
    if (c) draw(c.posts, focusId); else { list.setAttribute("aria-busy", "true"); list.innerHTML = SS.ui.skeletons(2, 180); }
    if (SS.account && SS.account.restore) SS.account.restore();
    Promise.all([feed(true), isPoster()]).then(function (r) {
      if (my !== pageGen || SS.currentView() !== "msa") return;
      poster = r[1];
      $("msa-new").hidden = !poster;
      draw(r[0], focusId);
    }).catch(function () {
      if (my !== pageGen) return;
      if (!cached()) SS.ui.renderState(list, { kind: "error", retry: function () { msaInit(params); } });
    });
    $("msa-new").onclick = function () { compose(null); };
    footer();
  }
  function footer() {
    var el = $("msa-foot");
    var signedIn = SS.account && SS.account.signedIn();
    el.innerHTML = signedIn ? "" : '<button class="link-btn" type="button" id="msa-signin">' + esc(t("msa.posterSignIn")) + "</button>";
    if ($("msa-signin")) $("msa-signin").onclick = function () { SS.account.openSignIn(); };
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
        on_home: $("msa-f-home").checked, pinned: $("msa-f-pin").checked,
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
  SS.msa = { feed: feed, homeCard: homeCard, shrink: shrink, richText: richText };
  SS.msaBoot = function () {
    var prevHome = SS.hooks.homeInit;
    SS.hooks.homeInit = function () { if (prevHome) prevHome.apply(null, arguments); homeCard(); };
  };
})();
