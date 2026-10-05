/* SalaamStreet — offline-ui.js (classic script)
   The interface for the Offline Qur'an (2.6.0; the logic is in js/offline.js):
   the "Offline Qur'an" section in Settings, the download card and per-surah
   marks on the Qur'an page, the Qur'an PDF card and the in-app PDF viewer. */
(function () {
  "use strict";
  window.SS = window.SS || {};
  var $ = function (id) { return document.getElementById(id); };
  function t(k) { return SS.i18n.t(k); }
  function f(k, v) { return SS.ui.f(k, v); }
  function esc(s) { return SS.esc(s); }
  function icon(n, c) { return SS.ui.icon(n, c); }
  function off() { return SS.offline; }
  function hooks() { return (SS.hooks = SS.hooks || {}); }
  function onHook(name, fn) {
    var prev = hooks()[name];
    hooks()[name] = function () {
      if (prev) prev.apply(null, arguments);
      fn.apply(null, arguments);
    };
  }
  var LARGE = 100 * 1048576; // ask before downloads bigger than this

  /* ── Formatting ─────────────────────────────────────────────── */
  function num(v, digits) {
    try { return v.toLocaleString(SS.i18n.dateLocale(), { maximumFractionDigits: digits }); } catch (e) { return String(Math.round(v * 10) / 10); }
  }
  /** Bytes → "820 KB" / "1.4 MB" / "1.1 GB". */
  function size(bytes) {
    bytes = bytes || 0;
    if (bytes >= 1073741824) return f("off.gb", { n: num(bytes / 1073741824, 1) });
    if (bytes >= 1048576) return f("off.mb", { n: num(bytes / 1048576, 1) });
    return f("off.kb", { n: num(Math.max(1, Math.round(bytes / 1024)), 0) });
  }
  function approx(bytes) { return f("off.approx", { size: size(bytes) }); }
  function trLabel(id) {
    for (var i = 0; i < SS.TRANSLATIONS.length; i++) if (SS.TRANSLATIONS[i].id === id) return SS.TRANSLATIONS[i].label;
    return id;
  }
  function reciterName(id) {
    for (var i = 0; i < SS.RECITERS.length; i++) if (SS.RECITERS[i].id === id) return SS.i18n.isAr() ? SS.RECITERS[i].ar : SS.RECITERS[i].en;
    return id;
  }
  function btn(act, label, opts) {
    opts = opts || {};
    return '<button class="btn btn-sm ' + (opts.cls || "btn-outline") + '" type="button" data-act="' + act + '"' +
      (opts.arg != null ? ' data-arg="' + esc(opts.arg) + '"' : "") + (opts.label ? ' aria-label="' + esc(opts.label) + '"' : "") + ">" +
      (opts.icon ? icon(opts.icon) : "") + "<span>" + esc(label) + "</span></button>";
  }
  function doneBadge() { return '<span class="badge off-done">' + icon("check") + "<span>" + esc(t("off.downloaded")) + "</span></span>"; }
  function bar(done, total) {
    var pct = total ? Math.min(100, Math.round(done / total * 100)) : 0;
    return '<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><span style="inline-size:' + pct + '%"></span></div>';
  }
  function statusText(job) {
    if (job.status === "queued") return t("off.queued");
    if (job.status === "paused") return t("off.paused");
    if (job.status === "offline") return t("off.errOffline");
    if (job.status === "error") return t(off().reasonKey(job.reason) || "off.errFailed");
    return t("off.downloading");
  }
  /** Progress block for a running/paused/failed job. */
  function jobBlock(job, unitKey) {
    var done = job.done || 0, total = job.total || 0;
    var err = job.status === "error" || job.status === "offline";
    var counts = total ? f(unitKey, { done: num(done, 0), total: num(total, 0) }) + " · " + size(job.bytes) : t("off.preparing");
    var acts = job.status === "running" || job.status === "queued"
      ? btn("pause", t("off.pause"), { arg: job.id, icon: "pause" })
      : btn("resume", t(err ? "common.retry" : "off.resume"), { arg: job.id, icon: err ? "refresh" : "play" });
    return '<div class="off-job' + (err ? " is-error" : "") + '">' + bar(done, total) +
      '<div class="off-job-row"><span class="tiny" aria-live="polite"><b>' + esc(statusText(job)) + "</b> · " + esc(counts) + "</span>" +
      '<span class="off-acts">' + acts + btn("cancel", t("common.cancel"), { arg: job.id, cls: "btn-ghost" }) + "</span></div></div>";
  }
  function row(ic, title, sub, right, extra) {
    return '<div class="off-row"><span class="w-ic">' + icon(ic) + '</span><span class="off-main"><span class="w-title">' + title + "</span>" +
      (sub ? '<span class="tiny">' + sub + "</span>" : "") + '</span><span class="off-acts">' + (right || "") + "</span></div>" + (extra || "");
  }

  /* ── Patch a container keyed by data-key, keeping focus and open <details> ── */
  function patch(el, parts) {
    var focusKey = document.activeElement && el.contains(document.activeElement) ? focusId(document.activeElement) : null;
    var existing = {};
    Array.prototype.forEach.call(el.children, function (c) { existing[c.getAttribute("data-key")] = c; });
    var tmp = document.createElement("div"), frag = [];
    parts.forEach(function (p) {
      var old = existing[p.key];
      if (old && old.getAttribute("data-html") === p.html) { frag.push(old); return; }
      tmp.innerHTML = '<div data-key="' + p.key + '" class="' + (p.cls || "") + '">' + p.html + "</div>";
      var node = tmp.firstChild;
      node.setAttribute("data-html", p.html);
      if (old) {
        var openD = old.querySelectorAll("details[open]");
        Array.prototype.forEach.call(openD, function (d) {
          var nd = node.querySelector('details[data-key="' + d.getAttribute("data-key") + '"]');
          if (nd) nd.open = true;
        });
        var sc = old.querySelector(".off-list");
        var nsc = node.querySelector(".off-list");
        if (sc && nsc) nsc.setAttribute("data-scroll", sc.scrollTop);
      }
      frag.push(node);
    });
    el.textContent = "";
    frag.forEach(function (n) {
      el.appendChild(n);
      var l = n.querySelector(".off-list[data-scroll]");
      if (l) { l.scrollTop = +l.getAttribute("data-scroll"); l.removeAttribute("data-scroll"); }
    });
    if (focusKey) {
      var again = el.querySelector(focusKey);
      if (again) { try { again.focus({ preventScroll: true }); } catch (e) { /* noop */ } }
    }
  }
  function focusId(node) {
    var b = node.closest("[data-act], select, summary");
    if (!b) return null;
    if (b.id) return "#" + b.id;
    if (b.tagName === "SUMMARY") return 'details[data-key="' + b.parentNode.getAttribute("data-key") + '"] > summary';
    return '[data-act="' + b.getAttribute("data-act") + '"]' + (b.getAttribute("data-arg") != null ? '[data-arg="' + b.getAttribute("data-arg") + '"]' : "");
  }

  /* ── Settings → Offline Qur'an ──────────────────────────────── */
  var audioReciter = null;
  function textComplete(ed) { return off().packCount("text:" + ed) >= 114; }
  function baseComplete() { return off().BASE_EDITIONS.every(textComplete); }

  function textPart() {
    var tr = SS.translation().id, job = off().job("text");
    var sub = esc(f("off.textDesc", { tr: trLabel(tr) }));
    var right = "", extra = "";
    if (job) extra = jobBlock(job, "off.nSurahs");
    else if (baseComplete() && textComplete(tr)) {
      var b = off().packBytes("text:quran-uthmani") + off().packBytes("text:en.transliteration") + off().packBytes("text:" + tr);
      sub += " · " + esc(size(b));
      right = doneBadge();
    } else if (baseComplete()) {
      sub += '<br><span class="off-warn">' + esc(f("off.trMissing", { tr: trLabel(tr) })) + "</span>";
      right = btn("dl-text", t("off.download"), { cls: "", icon: "download" });
    } else {
      sub += " · " + esc(approx(off().estimate.text(tr)));
      right = btn("dl-text", t("off.download"), { cls: "", icon: "download" });
    }
    return row("book", esc(t("off.text")), sub, right, extra);
  }

  function translationsPart() {
    var cur = SS.translation().id, textJob = off().job("text"), html = "";
    SS.TRANSLATIONS.forEach(function (tr) {
      var job = off().job("tr:" + tr.id), right, sub;
      var withText = textJob && textJob.params.editions.indexOf(tr.id) !== -1;
      if (job) {
        html += '<li class="off-li">' + '<span class="off-main"><span class="w-title"><bdi>' + esc(tr.label) + "</bdi></span></span>" + jobBlock(job, "off.nSurahs") + "</li>";
        return;
      }
      if (textComplete(tr.id)) {
        sub = size(off().packBytes("text:" + tr.id));
        right = doneBadge() + btn("rm", t("off.remove"), { arg: "text:" + tr.id, cls: "btn-ghost", icon: "trash", label: t("off.remove") + " — " + tr.label });
      } else if (withText) {
        sub = t("off.withText");
        right = "";
      } else {
        sub = approx(off().estimate.edition(tr.id));
        right = btn("add-tr", t("off.add"), { arg: tr.id, icon: "download", label: t("off.add") + " — " + tr.label });
      }
      html += '<li class="off-li"><span class="off-main"><span class="w-title"><bdi>' + esc(tr.label) + "</bdi>" +
        (tr.id === cur ? ' <span class="badge">' + esc(t("off.current")) + "</span>" : "") + "</span>" +
        '<span class="tiny">' + esc(sub) + '</span></span><span class="off-acts">' + right + "</span></li>";
    });
    return '<details class="off-details" data-key="tr"><summary>' + icon("globe") + "<span>" + esc(t("off.translations")) + "</span>" +
      '<span class="tiny">' + esc(f("off.trCount", { n: num(SS.TRANSLATIONS.filter(function (x) { return textComplete(x.id); }).length, 0) })) + "</span></summary>" +
      '<p class="tiny">' + esc(t("off.translationsNote")) + '</p><ul class="off-ul">' + html + "</ul></details>";
  }

  function audioPart() {
    var rec = audioReciter || SS.store.settings().reciter;
    var id = "audio:" + rec, job = off().job(id), pk = off().pack(id);
    var have = pk ? Object.keys(pk.have).length : 0;
    var opts = SS.RECITERS.map(function (r) {
      return '<option value="' + r.id + '"' + (r.id === rec ? " selected" : "") + ">" + esc(SS.i18n.isAr() ? r.ar : r.en) + "</option>";
    }).join("");
    var sub, right = "", extra = "";
    if (job) {
      sub = esc(f("off.audioFor", { r: reciterName(rec) }));
      extra = jobBlock(job, "off.nAyahs");
    } else if (have >= 114) {
      sub = esc(f("off.audioFor", { r: reciterName(rec) }) + " · " + size(off().packBytes(id)));
      right = doneBadge();
    } else {
      var missing = [];
      for (var n = 1; n <= 114; n++) if (!(pk && pk.have[n])) missing.push(n);
      sub = esc(f("off.audioFor", { r: reciterName(rec) }) + " · " + (have ? f("off.nOf114", { n: num(have, 0) }) + " · " + size(off().packBytes(id)) + " · " : "") +
        approx(off().estimate.audio(rec, missing, pk && pk.bitrate)));
      right = btn("dl-audio-all", t(have ? "off.downloadRest" : "off.downloadAll"), { cls: "", icon: "download" });
    }
    var list = "";
    SS.SURAHS.forEach(function (s) {
      var ok = pk && pk.have[s.n], r;
      if (ok) r = '<span class="off-ok" title="' + esc(t("off.downloaded")) + '">' + icon("check") + "</span>" +
        btn("rm-audio", t("off.remove"), { arg: s.n, cls: "btn-ghost", label: t("off.remove") + " — " + s.n + ". " + SS.ui.surahName(s) });
      else if (job && job.params.surahs.indexOf(s.n) !== -1) r = '<span class="tiny">' + esc(t("off.inQueue")) + "</span>";
      else r = btn("dl-audio", t("off.download"), { arg: s.n, label: t("off.download") + " — " + s.n + ". " + SS.ui.surahName(s) });
      list += '<li class="off-li"><span class="off-main"><span class="w-title">' + s.n + ". " + esc(SS.ui.surahName(s)) + "</span>" +
        '<span class="tiny">' + esc(ok ? size(pk.have[s.n]) : approx(off().estimate.audio(rec, [s.n], pk && pk.bitrate))) + "</span></span>" +
        '<span class="off-acts">' + r + "</span></li>";
    });
    return '<div class="off-reciter"><label for="off-reciter">' + esc(t("quran.reciter")) + '</label><select class="input input-sm" id="off-reciter">' + opts + "</select></div>" +
      row("play", esc(t("off.audio")), sub, right, extra) +
      '<details class="off-details" data-key="surahs"><summary>' + icon("grid") + "<span>" + esc(t("off.chooseSurahs")) + "</span></summary>" +
      '<ul class="off-ul off-list">' + list + "</ul></details>" +
      (have ? '<div class="off-foot">' + btn("rm", t("off.removeAudio"), { arg: id, cls: "btn-danger", icon: "trash" }) + "</div>" : "");
  }

  function tafsirPart() {
    var job = off().job("tafsir"), n = off().packCount("tafsir");
    var sub = esc(t("off.tafsirDesc")), right = "", extra = "";
    if (job) extra = jobBlock(job, "off.nSurahs");
    else if (n >= 114) { sub += " · " + esc(size(off().packBytes("tafsir"))); right = doneBadge(); }
    else { sub += " · " + esc(approx(off().estimate.tafsir())); right = btn("dl-tafsir", t("off.download"), { cls: "", icon: "download" }); }
    return row("open-book", esc(t("off.tafsir")), sub, right, extra);
  }

  function removeBtn(id, show) {
    return show ? '<div class="off-foot">' + btn("rm", t("off.remove"), { arg: id, cls: "btn-danger", icon: "trash" }) + "</div>" : "";
  }

  var usageCache = null;
  function storagePart() {
    var total = off().totalBytes(), persist = SS.store.get("offline:persist");
    var u = usageCache;
    var html = row("download", esc(t("off.storage")), esc(f("off.storageUsed", { size: size(total) })) +
      (u && u.quota ? "<br>" + esc(f("off.storageBrowser", { used: size(u.usage), quota: size(u.quota) })) : ""), "");
    if (persist === "refused") html += '<p class="note off-note">' + esc(t("off.persistRefused")) + "</p>";
    html += '<p class="tiny off-note">' + esc(t("off.private")) + "</p>";
    if (off().used()) html += '<div class="off-foot">' + btn("rm-all", t("off.removeAll"), { cls: "btn-danger", icon: "trash" }) + "</div>";
    return html;
  }

  function renderSettings() {
    var el = $("st-offline");
    if (!el || !off() || SS.currentView() !== "settings") return;
    off().ready().then(function () {
      patch(el, [
        { key: "intro", html: '<p class="note">' + esc(t("off.intro")) + "</p>" },
        { key: "text", cls: "card off-card", html: textPart() + removeBtn("text", !off().job("text") && baseComplete()) + translationsPart() },
        { key: "audio", cls: "card off-card", html: audioPart() },
        { key: "tafsir", cls: "card off-card", html: tafsirPart() + removeBtn("tafsir", !off().job("tafsir") && off().packCount("tafsir") > 0) },
        { key: "pdf", html: '<div class="off-pdf" hidden></div>' },
        { key: "storage", cls: "card off-card", html: storagePart() },
      ]);
      renderPdfCard(el.querySelector(".off-pdf"));
      refreshUsage();
    });
  }
  /** Browser storage figures (async); only the storage card is redrawn. */
  var usageAt = 0;
  function refreshUsage() {
    if (Date.now() - usageAt < 1500) return;
    usageAt = Date.now();
    off().usage().then(function (u) {
      if (!u || (usageCache && usageCache.usage === u.usage && usageCache.quota === u.quota)) return;
      usageCache = u;
      var slot = $("st-offline") && $("st-offline").querySelector('[data-key="storage"]');
      if (!slot) return;
      var html = storagePart();
      if (slot.getAttribute("data-html") !== html) { slot.innerHTML = html; slot.setAttribute("data-html", html); }
    });
  }

  /* ── Starting downloads ─────────────────────────────────────── */
  function askLarge(bytes) {
    if (bytes < LARGE) return true;
    var c = navigator.connection || {};
    var msg = f("off.confirmLarge", { size: size(bytes) });
    if (c.saveData || c.type === "cellular") msg += "\n\n" + t("off.confirmCellular");
    return confirm(msg);
  }
  function beginDownload(promise) {
    // Ask once for storage that the browser won't clear when space runs low.
    if (!SS.store.get("offline:persist")) off().persist();
    return Promise.resolve(promise).catch(function (e) {
      SS.toast(t(off().reasonKey(e && (e.code || e.name === "QuotaExceededError" && "quota")) || "off.errFailed"));
    });
  }

  function wire(el) {
    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (!b || !el.contains(b)) return;
      var act = b.getAttribute("data-act"), arg = b.getAttribute("data-arg");
      var rec = audioReciter || SS.store.settings().reciter;
      if (act === "dl-text") beginDownload(off().downloadText());
      else if (act === "add-tr") beginDownload(off().addTranslation(arg));
      else if (act === "dl-tafsir") beginDownload(off().downloadTafsir());
      else if (act === "dl-audio-all") {
        var pk = off().pack("audio:" + rec), missing = [];
        for (var n = 1; n <= 114; n++) if (!(pk && pk.have[n])) missing.push(n);
        if (!askLarge(off().estimate.audio(rec, missing, pk && pk.bitrate))) return;
        beginDownload(off().downloadAudio(rec, missing));
      } else if (act === "dl-audio") {
        var est = off().estimate.audio(rec, [+arg]);
        if (!askLarge(est)) return;
        beginDownload(off().downloadAudio(rec, [+arg]));
      } else if (act === "pause") off().pause(arg);
      else if (act === "resume") off().resume(arg);
      else if (act === "cancel") {
        stopped[arg] = 1;
        off().cancel(arg).then(function () { SS.toast(t("off.cancelled")); });
      }
      else if (act === "rm") {
        if (!confirm(t("off.removeConfirm"))) return;
        off().jobs().forEach(function (j) { stopped[j.id] = 1; });
        var target = arg === "text" ? off().BASE_EDITIONS.concat([SS.translation().id]).map(function (ed) { return "text:" + ed; }) : [arg];
        target.reduce(function (p, id) { return p.then(function () { return off().remove(id); }); }, Promise.resolve())
          .then(function () { SS.toast(t("off.removed")); });
      } else if (act === "rm-audio") {
        off().remove("audio:" + rec, +arg).then(function () { SS.toast(t("off.removed")); });
      } else if (act === "rm-all") {
        if (!confirm(t("off.removeAllConfirm"))) return;
        off().jobs().forEach(function (j) { stopped[j.id] = 1; });
        off().removeAll().then(function () { usageCache = null; SS.toast(t("off.removedAll")); render(); });
      } else return;
      renderSoon();
    });
    el.addEventListener("change", function (e) {
      if (e.target.id === "off-reciter") { audioReciter = e.target.value; render(); }
    });
  }

  /* ── Qur'an page: download card + per-surah marks ───────────── */
  /** Marks on a surah card: text downloaded (✓), recitation downloaded (♪). */
  function markHtml(n) {
    if (!off() || !off().used()) return "";
    var bits = "", rec = SS.store.settings().reciter;
    if (off().hasText(n)) bits += '<span class="off-mark-t" title="' + esc(t("off.markText")) + '">' + icon("check") + "</span>";
    if (off().hasAudio(rec, n)) bits += '<span class="off-mark-a" title="' + esc(t("off.markAudio")) + '">' + icon("play") + "</span>";
    if (!bits) return "";
    var label = [off().hasText(n) ? t("off.markText") : "", off().hasAudio(rec, n) ? t("off.markAudio") : ""].filter(Boolean).join(", ");
    return '<span class="off-mark"><span class="visually-hidden">' + esc(label) + "</span>" + bits + "</span>";
  }
  function updateMarks() {
    var cards = document.querySelectorAll("#qi-grid a.surah-card");
    Array.prototype.forEach.call(cards, function (a) {
      var n = +(a.getAttribute("href") || "").split("/")[2];
      if (!n) return;
      var html = markHtml(n), cur = a.querySelector(".off-mark");
      if ((cur ? cur.outerHTML : "") === html) return;
      if (cur) cur.remove();
      if (html) a.querySelector(".arname").insertAdjacentHTML("beforebegin", html);
    });
  }
  function renderQuranCard() {
    var el = $("qi-offline");
    if (!el || !off() || SS.currentView() !== "quran") return;
    off().ready().then(function () {
      var job = off().job("text") || off().job("tr:" + SS.translation().id), html;
      if (job) {
        html = '<a class="card widget off-widget" href="#/settings/offline"><span class="w-ic">' + icon("download") + '</span><span class="w-body">' +
          '<span class="w-title">' + esc(job.status === "running" ? t("off.qDownloading") : statusText(job)) + "</span>" +
          '<span class="w-sub">' + esc(job.total ? f("off.nSurahs", { done: num(job.done, 0), total: num(job.total, 0) }) : t("off.preparing")) + "</span>" +
          bar(job.done || 0, job.total || 0) + '</span><svg class="ic chev" aria-hidden="true"><use href="#i-chev-r"/></svg></a>';
      } else if (off().hasText(1) && baseComplete() && textComplete(SS.translation().id)) {
        html = '<a class="card widget off-widget" href="#/settings/offline"><span class="w-ic">' + icon("check") + '</span><span class="w-body">' +
          '<span class="w-title">' + esc(t("off.qReady")) + '</span><span class="w-sub">' + esc(t("off.qManage")) + "</span></span>" +
          '<svg class="ic chev" aria-hidden="true"><use href="#i-chev-r"/></svg></a>';
      } else {
        html = '<a class="card widget off-widget" href="#/settings/offline"><span class="w-ic">' + icon("download") + '</span><span class="w-body">' +
          '<span class="w-title">' + esc(t("off.qTitle")) + '</span><span class="w-sub wrap-text">' + esc(f("off.qSub", { size: approx(off().estimate.text(SS.translation().id)) })) + "</span></span>" +
          '<svg class="ic chev" aria-hidden="true"><use href="#i-chev-r"/></svg></a>';
      }
      if (el.getAttribute("data-html") !== html) { el.innerHTML = html; el.setAttribute("data-html", html); }
      updateMarks();
    });
    renderPdfCard($("qi-pdf"));
  }

  /* ── Qur'an PDF card (Settings and the Qur'an page) ─────────── */
  var pdfState = { status: "", error: "" };
  function pdfCredit(info) {
    return f("pdf.credit", { translator: info.translator || "", source: info.source || "" });
  }
  function renderPdfCard(el) {
    if (!el || !off()) return;
    off().pdf.check().then(function (r) {
      if (!r.available && !off().pdf.progress()) { el.hidden = true; el.innerHTML = ""; el.removeAttribute("data-html"); return; }
      var info = off().pdf.info(), prog = off().pdf.progress(), stored = r.stored;
      var total = (prog && prog.total) || r.bytes || info.bytes || 0;
      var sub = esc(f("pdf.by", { translator: info.translator || "" })) + " · " + esc(total ? f("pdf.size", { size: size(total) }) : t("pdf.pdf"));
      var right = "", extra = "";
      if (prog) {
        var pct = total ? f("off.mbOf", { done: size(prog.received), total: size(total) }) : size(prog.received);
        extra = '<div class="off-job' + (pdfState.error ? " is-error" : "") + '">' + bar(prog.received, total) +
          '<div class="off-job-row"><span class="tiny" aria-live="polite"><b>' + esc(pdfState.error ? t(pdfState.error) : prog.paused ? t("off.paused") : t("off.downloading")) + "</b> · " + esc(pct) + "</span>" +
          '<span class="off-acts">' + (prog.paused ? btn("pdf-resume", t(pdfState.error ? "common.retry" : "off.resume"), { icon: "play" }) : btn("pdf-pause", t("off.pause"), { icon: "pause" })) +
          btn("pdf-cancel", t("common.cancel"), { cls: "btn-ghost" }) + "</span></div></div>";
      } else if (stored) {
        right = doneBadge();
        extra = '<div class="off-foot">' + btn("pdf-open", t("pdf.open"), { cls: "", icon: "open-book" }) + btn("pdf-save", t(off().pdf.isIOS() ? "pdf.saveIOS" : "pdf.save"), { icon: "download" }) +
          btn("pdf-remove", t("off.remove"), { cls: "btn-danger", icon: "trash" }) + "</div>";
      } else {
        right = btn("pdf-dl", t("pdf.download"), { cls: "", icon: "download" });
        if (pdfState.error) extra = '<p class="note off-warn">' + esc(t(pdfState.error)) + "</p>";
      }
      var src = '<p class="tiny off-note">' + esc(t("pdf.sourceLabel")) + ' <a href="' + esc(info.sourceUrl || "#") + '" target="_blank" rel="noopener">' + esc(info.source || "") + "</a> · " + esc(t("pdf.note")) + "</p>";
      var html = '<div class="card off-card pdf-card">' + row("open-book", esc(info.title || "") , sub, right, extra) + src + "</div>";
      el.hidden = false;
      if (el.getAttribute("data-html") !== html) {
        var fk = document.activeElement && el.contains(document.activeElement) ? focusId(document.activeElement) : null;
        el.innerHTML = html;
        el.setAttribute("data-html", html);
        if (fk && el.querySelector(fk)) el.querySelector(fk).focus({ preventScroll: true });
      }
      if (!el.pdfWired) {
        el.pdfWired = true;
        el.addEventListener("click", pdfClick);
      }
    });
  }
  function pdfClick(e) {
    var b = e.target.closest("[data-act]");
    if (!b) return;
    var act = b.getAttribute("data-act");
    if (act.indexOf("pdf-") !== 0) return;
    e.stopPropagation();
    if (act === "pdf-dl" || act === "pdf-resume") pdfDownload();
    else if (act === "pdf-pause") off().pdf.pause();
    else if (act === "pdf-cancel") { off().pdf.cancel(); pdfState.error = ""; }
    else if (act === "pdf-open") viewer.open();
    else if (act === "pdf-save") pdfSave();
    else if (act === "pdf-remove") {
      if (!confirm(t("pdf.removeConfirm"))) return;
      off().pdf.remove().then(function () { SS.toast(t("off.removed")); render(); });
    }
    renderSoon();
  }
  function pdfDownload() {
    pdfState.error = "";
    if (!SS.store.get("offline:persist")) off().persist();
    off().pdf.download(function () { renderSoon(); }).then(function (blob) {
      SS.toast(t("pdf.ready"));
      render();
      // A copy on the device: a normal download, or (iPhone/iPad) the share sheet,
      // which needs a fresh tap after a long download — the Save button is there for that.
      if (!off().pdf.isIOS()) off().pdf.saveToDevice(blob).catch(function () {});
    }).catch(function (e) {
      var code = e && e.code;
      if (code === "paused" || code === "cancelled") { if (code === "cancelled") SS.toast(t("off.cancelled")); render(); return; }
      var why = e && (e.name === "QuotaExceededError" || /quota/i.test(e.message || "")) ? "quota" : navigator.onLine === false ? "offline" : code === "not-found" ? "missing" : "failed";
      pdfState.error = why === "missing" ? "pdf.errMissing" : off().reasonKey(why);
      SS.toast(t(pdfState.error));
      render();
    });
    renderSoon();
  }
  function pdfSave() {
    off().pdf.blob().then(function (blob) { return off().pdf.saveToDevice(blob); }).then(function (r) {
      if (r === "downloaded") SS.toast(t("pdf.saved"));
      else if (r === "needs-tap") SS.toast(t("pdf.tapAgain"));
    }).catch(function () { SS.toast(t("off.errFailed")); });
  }
  // Lost connection mid-download: say so (the download pauses and can resume).
  window.addEventListener("offline", function () {
    var p = off() && off().pdf.progress();
    if (p) { pdfState.error = "off.errOffline"; SS.toast(t("off.errOffline")); renderSoon(); }
  });

  /* ── PDF viewer (pdf.js) ────────────────────────────────────── */
  var viewer = (function () {
    var doc = null, page = 1, zoom = 1, rendering = false, pending = null, task = null, gen = 0;
    var pinch = null;
    function dlg() { return $("pdf-dialog"); }
    function status(msg, isErr) {
      var s = $("pdf-status");
      s.textContent = msg || "";
      s.className = "pdf-status" + (msg ? " show" : "") + (isErr ? " is-error" : "");
    }
    function labels() {
      var info = off().pdf.info();
      $("pdf-h").textContent = info.title || "";
      $("pdf-credit").textContent = pdfCredit(info);
      $("pdf-close").setAttribute("aria-label", t("pdf.close"));
      $("pdf-prev").setAttribute("aria-label", t("pdf.prev"));
      $("pdf-next").setAttribute("aria-label", t("pdf.next"));
      $("pdf-zoom-in").setAttribute("aria-label", t("pdf.zoomIn"));
      $("pdf-zoom-out").setAttribute("aria-label", t("pdf.zoomOut"));
      $("pdf-zoom").setAttribute("aria-label", t("pdf.fit"));
      $("pdf-zoom").title = t("pdf.fit");
      $("pdf-stage").setAttribute("aria-label", t("pdf.stage"));
    }
    function open() {
      var d = dlg();
      if (!d || d.open) return;
      labels();
      status(t("common.loading"));
      $("pdf-canvas").hidden = true;
      $("pdf-total").textContent = "–";
      var my = ++gen;
      SS.openDialog(d);
      Promise.all([off().loadPdfjs(), off().pdf.blob().then(function (b) { return b.arrayBuffer(); })]).then(function (r) {
        if (my !== gen) return null;
        task = r[0].getDocument({ data: new Uint8Array(r[1]), isEvalSupported: false, wasmUrl: off().pdfjsWasmUrl() });
        return task.promise;
      }).then(function (pdfDoc) {
        if (!pdfDoc || my !== gen) return;
        doc = pdfDoc;
        $("pdf-total").textContent = String(doc.numPages);
        $("pdf-num").max = String(doc.numPages);
        var last = +SS.store.get("pdf:lastPage") || 1;
        page = Math.min(Math.max(1, last), doc.numPages);
        zoom = 1;
        status("");
        show();
        $("pdf-stage").focus({ preventScroll: true });
      }).catch(function (e) {
        if (my !== gen) return;
        if (window.console) console.error(e);
        status(t(navigator.onLine === false && !window.pdfjsLib ? "pdf.errViewerOffline" : "pdf.errOpen"), true);
      });
    }
    function close() {
      gen++;
      if (task) { try { task.destroy(); } catch (e) { /* noop */ } task = null; }
      doc = null;
      var c = $("pdf-canvas");
      c.width = c.height = 0;
    }
    function fitScale(p) {
      var stage = $("pdf-stage"), vp = p.getViewport({ scale: 1 });
      var w = Math.max(200, stage.clientWidth - 24), h = Math.max(200, stage.clientHeight - 24);
      return Math.min(w / vp.width, stage.clientWidth >= 700 ? h / vp.height : Infinity);
    }
    function show() {
      if (!doc) return;
      if (rendering) { pending = page; return; }
      rendering = true;
      var n = page, my = gen;
      $("pdf-num").value = String(n);
      $("pdf-prev").disabled = n <= 1;
      $("pdf-next").disabled = n >= doc.numPages;
      $("pdf-zoom").textContent = Math.round(zoom * 100) + "%";
      SS.store.set("pdf:lastPage", n);
      doc.getPage(n).then(function (p) {
        if (my !== gen) return null;
        var scale = fitScale(p) * zoom, ratio = window.devicePixelRatio || 1;
        var vp = p.getViewport({ scale: scale });
        var c = $("pdf-canvas"), ctx = c.getContext("2d");
        c.width = Math.floor(vp.width * ratio);
        c.height = Math.floor(vp.height * ratio);
        c.style.inlineSize = Math.floor(vp.width) + "px";
        c.style.blockSize = Math.floor(vp.height) + "px";
        c.hidden = false;
        c.setAttribute("aria-label", f("pdf.pageOf", { n: n, total: doc.numPages }));
        c.setAttribute("role", "img");
        return p.render({ canvasContext: ctx, viewport: vp, transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : null }).promise;
      }).catch(function (e) {
        if (e && e.name === "RenderingCancelledException") return;
        status(t("pdf.errOpen"), true);
      }).then(function () {
        rendering = false;
        if (pending != null) { pending = null; show(); }
      });
    }
    function go(n) {
      if (!doc) return;
      n = Math.min(Math.max(1, Math.round(n) || 1), doc.numPages);
      if (n === page) { $("pdf-num").value = String(n); return; }
      page = n;
      $("pdf-stage").scrollTo(0, 0);
      show();
    }
    function setZoom(z) {
      zoom = Math.min(4, Math.max(0.5, z));
      show();
    }
    function wireViewer() {
      var d = dlg();
      if (!d) return;
      d.addEventListener("close", close);
      $("pdf-prev").onclick = function () { go(page - 1); };
      $("pdf-next").onclick = function () { go(page + 1); };
      $("pdf-zoom-in").onclick = function () { setZoom(zoom * 1.25); };
      $("pdf-zoom-out").onclick = function () { setZoom(zoom / 1.25); };
      $("pdf-zoom").onclick = function () { setZoom(1); };
      $("pdf-jump").onsubmit = function (e) { e.preventDefault(); go(+$("pdf-num").value); $("pdf-num").blur(); };
      $("pdf-num").onchange = function () { go(+this.value); };
      $("pdf-stage").addEventListener("keydown", function (e) {
        var rtl = document.dir === "rtl";
        if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); go(page + (rtl && e.key === "ArrowRight" ? -1 : 1)); }
        else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); go(page - (rtl && e.key === "ArrowLeft" ? -1 : 1)); }
        else if (e.key === "+" || e.key === "=") setZoom(zoom * 1.25);
        else if (e.key === "-") setZoom(zoom / 1.25);
        else if (e.key === "Home") go(1);
        else if (e.key === "End" && doc) go(doc.numPages);
      });
      // Pinch to zoom: scale the page with CSS while fingers move, re-render sharp when they lift.
      var stage = $("pdf-stage"), pg = $("pdf-page");
      function dist(ts) { var dx = ts[0].clientX - ts[1].clientX, dy = ts[0].clientY - ts[1].clientY; return Math.sqrt(dx * dx + dy * dy); }
      stage.addEventListener("touchstart", function (e) {
        if (e.touches.length === 2) pinch = { d: dist(e.touches), r: 1 };
      }, { passive: true });
      stage.addEventListener("touchmove", function (e) {
        if (!pinch || e.touches.length !== 2) return;
        e.preventDefault();
        pinch.r = Math.min(4 / zoom, Math.max(0.5 / zoom, dist(e.touches) / pinch.d));
        pg.style.transform = "scale(" + pinch.r + ")";
      }, { passive: false });
      stage.addEventListener("touchend", function (e) {
        if (!pinch || e.touches.length >= 2) return;
        var r = pinch.r;
        pinch = null;
        pg.style.transform = "";
        if (Math.abs(r - 1) > 0.02) setZoom(zoom * r);
      });
      // Trackpad pinch (and Ctrl + scroll) on computers.
      stage.addEventListener("wheel", function (e) {
        if (!e.ctrlKey) return;
        e.preventDefault();
        setZoom(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
      }, { passive: false });
      var rt = null;
      window.addEventListener("resize", function () {
        if (!doc || !d.open) return;
        clearTimeout(rt);
        rt = setTimeout(show, 150);
      });
    }
    return { open: open, wire: wireViewer, go: go, state: function () { return { page: page, total: doc ? doc.numPages : 0, zoom: zoom }; } };
  })();

  /* ── Toasts: never fail silently ────────────────────────────── */
  var lastStatus = {}, stopped = {};
  function announce() {
    if (!off()) return;
    var now = {};
    off().jobs().forEach(function (j) {
      now[j.id] = j.status;
      var was = lastStatus[j.id];
      if (was === j.status) return;
      if (j.status === "error") SS.toast(t(off().reasonKey(j.reason) || "off.errFailed"));
      else if (j.status === "offline" && was) SS.toast(t("off.errOffline"));
    });
    // A job that has gone without being cancelled or removed has finished.
    Object.keys(lastStatus).forEach(function (id) {
      if (now[id] || stopped[id]) return;
      if (lastStatus[id] === "running" || lastStatus[id] === "queued") SS.toast(t("off.done"));
    });
    stopped = {};
    lastStatus = now;
  }

  /* ── Wiring ─────────────────────────────────────────────────── */
  var rTimer = null;
  function render() {
    renderSettings();
    renderQuranCard();
  }
  function renderSoon() {
    clearTimeout(rTimer);
    rTimer = setTimeout(render, 30);
  }

  SS.offlineUI = { mark: markHtml, render: render, viewer: viewer, size: size };

  onHook("settingsInit", function (params) {
    renderSettings();
    if (params && params[0] === "offline") {
      setTimeout(function () {
        var h = $("offline-quran");
        if (h) h.scrollIntoView({ block: "start" });
      }, 0);
    }
  });
  onHook("quranInit", renderQuranCard);

  function boot() {
    var st = $("st-offline");
    if (st) wire(st);
    viewer.wire();
    document.addEventListener("ss:offline", function () {
      announce();
      render();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
