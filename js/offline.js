/* SalaamStreet — offline.js (classic script)
   Offline Qur'an (2.6.0): download the Qur'an once and use it with no internet.

   • Text (Arabic Uthmani, translations, transliteration) and Tafsir Ibn Kathir
     live in IndexedDB ("salaamstreet-offline"): localStorage (~5 MB) is far
     too small for the whole Qur'an.
   • Recitation audio and the Qur'an PDF live in the Cache API
     ("ss-offline-audio", "ss-offline-pdf"). The service worker never deletes
     caches whose names start with "ss-offline".
   • Downloads run as resumable jobs: a few requests at a time, each retried,
     and whatever is already stored is skipped, so a closed tab or a dropped
     connection carries on where it stopped.
   • Nothing here is synced to an account. Until someone downloads something,
     no database is even opened (the "offline:used" flag), so nothing changes
     for people who never use it.

   The interface for all this is in js/offline-ui.js. */
(function () {
  "use strict";
  window.SS = window.SS || {};

  var DB_NAME = "salaamstreet-offline", DB_VERSION = 1;
  var AUDIO_CACHE = "ss-offline-audio", PDF_CACHE = "ss-offline-pdf";
  var BASE_EDITIONS = ["quran-uthmani", "en.transliteration"];
  var AUDIO_KEY = "https://salaamstreet.offline/audio/"; // cache keys only; never fetched
  var PDFJS_FILES = ["js/vendor/pdfjs/boot.mjs", "js/vendor/pdfjs/pdf.min.mjs", "js/vendor/pdfjs/pdf.worker.min.mjs"];
  var MB = 1048576;
  var cfg = { parallel: 4, tries: 3, retryDelay: 800, timeout: 30000 };

  /* ── Size estimates (shown before downloading; real sizes replace them) ──
     Text: whole-Qur'an MB per edition. Audio: seconds of recitation per mushaf
     page for each reciter, at the bitrate the CDN serves. Per-surah figures are
     weighted by the page each surah starts on in the 604-page Madani mushaf. */
  var TEXT_MB = {
    "quran-uthmani": 1.4, "en.transliteration": 0.9, "en.sahih": 0.8, "ur.jalandhry": 1.3, "id.indonesian": 0.9,
    "tr.diyanet": 0.8, "bn.bengali": 2.2, "fr.hamidullah": 0.9, "ms.basmeih": 0.9, "es.cortes": 0.8, "de.bubenheim": 0.9,
  };
  var TAFSIR_MB = 16;
  var SEC_PER_PAGE = { "ar.alafasy": 105, "ar.husary": 130, "ar.abdulbasitmurattal": 150, "ar.minshawi": 135 };
  var PAGE_START = [1, 2, 50, 77, 106, 128, 151, 177, 187, 208, 221, 235, 249, 255, 262, 267, 282, 293, 305, 312, 322, 332,
    342, 350, 359, 367, 377, 385, 396, 404, 411, 415, 418, 428, 434, 440, 446, 453, 458, 467, 477, 483, 489, 496, 499, 502,
    507, 511, 515, 518, 520, 523, 526, 528, 531, 534, 537, 542, 545, 549, 551, 553, 554, 556, 558, 560, 562, 564, 566, 568,
    570, 572, 574, 575, 577, 578, 580, 582, 583, 585, 586, 587, 587, 589, 590, 591, 591, 592, 593, 594, 595, 595, 596, 596,
    597, 597, 598, 598, 599, 599, 600, 600, 601, 601, 601, 602, 602, 602, 603, 603, 603, 604, 604, 604];
  var WEIGHTS = (function () {
    var w = [], sum = 0;
    for (var i = 0; i < 114; i++) {
      var span = i < 113 ? PAGE_START[i + 1] - PAGE_START[i] : 0;
      w.push(Math.max(span, 0.3));
      sum += w[i];
    }
    return w.map(function (x) { return x / sum; });
  })();

  /* ── Small helpers ──────────────────────────────────────────── */
  function used() { return !!SS.store.get("offline:used"); }
  function markUsed() { if (!used()) SS.store.set("offline:used", true); }
  function surahCount(n) { return SS.SURAHS[n - 1].ayahs; }
  function range(a, b) { var out = []; for (var i = a; i <= b; i++) out.push(i); return out; }
  function sizeOf(x) {
    try { return new Blob([typeof x === "string" ? x : JSON.stringify(x)]).size; } catch (e) { return 0; }
  }
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  /** Write nothing more once a job is cancelled or everything was removed
      (a pause lets requests already under way finish and be kept). */
  function guard(job) {
    if (job.halt === "cancelled" || job.gen !== generation) throw err("halted");
  }
  function err(code, cause) {
    var e = new Error(code);
    e.code = code;
    if (cause) e.cause = cause;
    return e;
  }
  /** Map any failure to what the person is told: quota | offline | storage | failed. */
  function classify(e) {
    if (!e) return "failed";
    if (e.code === "quota" || e.code === "offline" || e.code === "storage") return e.code;
    if (e.name === "QuotaExceededError" || e.code === 22 || /quota/i.test(e.message || "")) return "quota";
    if (e.cause) return classify(e.cause);
    if (navigator.onLine === false) return "offline";
    return "failed";
  }
  function fetchWithTimeout(url, opts) {
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, cfg.timeout) : null;
    opts = Object.assign({ signal: ctrl ? ctrl.signal : undefined }, opts || {});
    return fetch(url, opts).finally(function () { if (timer) clearTimeout(timer); });
  }
  function fetchJson(url) {
    return fetchWithTimeout(url, { headers: { Accept: "application/json" } }).then(function (res) {
      if (!res.ok) throw err("http-" + res.status);
      return res.json();
    });
  }

  /* ── IndexedDB ──────────────────────────────────────────────── */
  var dbPromise = null;
  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(err("storage")); return; }
      var req;
      try { req = indexedDB.open(DB_NAME, DB_VERSION); } catch (e) { reject(err("storage", e)); return; }
      req.onupgradeneeded = function () {
        var d = req.result;
        ["text", "tafsir", "meta"].forEach(function (s) { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s); });
      };
      req.onsuccess = function () {
        var d = req.result;
        d.onversionchange = function () { d.close(); dbPromise = null; };
        resolve(d);
      };
      req.onerror = function () { reject(err("storage", req.error)); };
      req.onblocked = function () { reject(err("storage")); };
    });
    dbPromise.catch(function () { dbPromise = null; });
    return dbPromise;
  }
  /** One transaction; resolves with the last request's result once it commits. */
  function tx(store, mode, fn) {
    return openDb().then(function (d) {
      return new Promise(function (resolve, reject) {
        var t = d.transaction(store, mode), last = null;
        var r = fn(t.objectStore(store));
        if (r && "onsuccess" in r) r.onsuccess = function () { last = r.result; };
        t.oncomplete = function () { resolve(last); };
        t.onerror = function (ev) { if (ev && ev.preventDefault) ev.preventDefault(); reject(t.error || (r && r.error) || err("storage")); };
        t.onabort = function () { reject(t.error || err("storage")); };
      });
    });
  }
  var idb = {
    get: function (s, k) { return tx(s, "readonly", function (st) { return st.get(k); }); },
    put: function (s, k, v) { return tx(s, "readwrite", function (st) { return st.put(v, k); }); },
    putMany: function (s, pairs) {
      return tx(s, "readwrite", function (st) { var r; pairs.forEach(function (p) { r = st.put(p[1], p[0]); }); return r; });
    },
    del: function (s, k) { return tx(s, "readwrite", function (st) { return st.delete(k); }); },
    delPrefix: function (s, prefix) {
      return tx(s, "readwrite", function (st) { return st.delete(IDBKeyRange.bound(prefix, prefix + "￿")); });
    },
  };
  // A cursor read that returns { key: value } for a whole store.
  function readAll(s) {
    return openDb().then(function (d) {
      return new Promise(function (resolve, reject) {
        var out = {}, t = d.transaction(s, "readonly"), cur = t.objectStore(s).openCursor();
        cur.onsuccess = function () {
          var c = cur.result;
          if (c) { out[c.key] = c.value; c.continue(); }
        };
        t.oncomplete = function () { resolve(out); };
        t.onerror = function () { reject(t.error || err("storage")); };
      });
    });
  }

  /* ── State: what is downloaded (packs) and what is downloading (jobs) ──
     A pack is one downloadable thing: "text:<edition>", "audio:<reciter>" or
     "tafsir". pack.have maps surah → bytes stored for it. */
  var state = { packs: {}, jobs: {}, order: [] };
  var readyPromise = null;
  function ready() {
    if (readyPromise) return readyPromise;
    if (!used()) return Promise.resolve(state); // never opened for people who don't download
    readyPromise = readAll("meta").then(function (meta) {
      Object.keys(meta).forEach(function (k) {
        if (k.indexOf("pack:") === 0) state.packs[k.slice(5)] = meta[k];
      });
      Object.keys(meta).filter(function (k) { return k.indexOf("job:") === 0; })
        .sort(function (a, b) { return (meta[a].at || 0) - (meta[b].at || 0); })
        .forEach(function (k) {
          var d = meta[k];
          // Interrupted (tab closed, connection lost) → carry on; paused/failed → wait for the person.
          if (d.status === "running" || d.status === "offline") d.status = "queued";
          addJob(d, true);
        });
      emit();
      kick();
      return state;
    }).catch(function (e) {
      readyPromise = null;
      if (window.console) console.error(e);
      return state;
    });
    return readyPromise;
  }
  function pack(id, kind) {
    var p = state.packs[id];
    if (!p) p = state.packs[id] = { id: id, kind: kind, have: {} };
    return p;
  }
  function savePack(p) { return idb.put("meta", "pack:" + p.id, p); }
  function packBytes(p) {
    var b = 0;
    for (var k in (p && p.have) || {}) b += p.have[k] || 0;
    return b;
  }
  function packCount(p) { return p ? Object.keys(p.have || {}).length : 0; }

  var emitTimer = null;
  function emit() {
    if (emitTimer) return;
    emitTimer = setTimeout(function () {
      emitTimer = null;
      document.dispatchEvent(new CustomEvent("ss:offline"));
    }, 120);
  }

  /* ── Jobs ───────────────────────────────────────────────────── */
  var KINDS = {}; // kind → { units(job), skip(job, unit), perform(job, unit), cancel(job) }
  var running = null;
  var generation = 0; // bumped by removeAll(): older jobs must not write anything back

  function addJob(d, restoring) {
    var job = state.jobs[d.id];
    if (!job) {
      job = state.jobs[d.id] = { id: d.id, kind: d.kind, params: d.params, at: d.at || Date.now(), gen: generation };
      state.order.push(d.id);
    }
    job.status = d.status || "queued";
    job.reason = d.reason || "";
    if (!restoring) persistJob(job);
    return job;
  }
  function persistJob(job) {
    return idb.put("meta", "job:" + job.id, { id: job.id, kind: job.kind, params: job.params, status: job.status, reason: job.reason, at: job.at })
      .catch(function () { /* reported by the job itself */ });
  }
  function dropJob(job) {
    delete state.jobs[job.id];
    state.order = state.order.filter(function (id) { return id !== job.id; });
    return idb.del("meta", "job:" + job.id).catch(function () {});
  }

  function start(d) {
    markUsed();
    return ready().then(function () {
      var job = state.jobs[d.id];
      if (job && (job.status === "running" || job.status === "queued")) return job;
      d.at = Date.now();
      d.status = "queued";
      job = addJob(d);
      emit();
      kick();
      return job;
    });
  }

  /** Run the next queued job (one at a time; each runs a few requests in parallel). */
  function kick() {
    if (running) return;
    if (navigator.onLine === false) {
      state.order.forEach(function (id) {
        var j = state.jobs[id];
        if (j.status === "queued") { j.status = "offline"; j.reason = "offline"; persistJob(j); }
      });
      emit();
      return;
    }
    var next = null;
    for (var i = 0; i < state.order.length; i++) {
      var j = state.jobs[state.order[i]];
      if (j && j.status === "queued") { next = j; break; }
    }
    if (!next) return;
    running = next;
    runJob(next).catch(function (e) {
      if (window.console) console.error(e);
      if (!next.halt) halt(next, classify(e));
    }).then(function () {
      if (running === next) running = null;
      if (next.gen !== generation) return null;
      if (next.status === "done" || next.status === "cancelled") {
        if (next.status === "cancelled") {
          return Promise.resolve(KINDS[next.kind].cancel(next)).catch(function () {}).then(function () { return dropJob(next); });
        }
        return dropJob(next);
      }
      return persistJob(next);
    }).then(function () { emit(); kick(); });
  }

  function halt(job, reason) {
    if (job.halt) return;
    job.halt = reason;
    job.status = reason === "paused" || reason === "cancelled" || reason === "offline" ? reason : "error";
    job.reason = reason;
    if (job.abort) { try { job.abort.abort(); } catch (e) { /* noop */ } }
    emit();
  }

  function runJob(job) {
    var kind = KINDS[job.kind];
    job.halt = null;
    job.status = "running";
    job.reason = "";
    job.abort = typeof AbortController === "function" ? new AbortController() : null;
    persistJob(job);
    emit();
    return Promise.resolve(kind.prepare ? kind.prepare(job) : null).then(function () {
      var units = kind.units(job);
      job.total = units.length;
      job.bytes = 0;
      var queue = units.filter(function (u) { return !kind.skip(job, u); });
      job.done = units.length - queue.length;
      job.bytes = kind.doneBytes ? kind.doneBytes(job) : 0;
      emit();
      return pump(job, queue);
    }).then(function () {
      if (!job.halt) job.status = "done";
    });
  }

  function pump(job, queue) {
    var kind = KINDS[job.kind];
    return new Promise(function (resolve) {
      var active = 0;
      function finish() { if (!active && (job.halt || !queue.length)) resolve(); }
      function launch() {
        while (!job.halt && active < cfg.parallel && queue.length) {
          (function (u) {
            active++;
            attempt(job, function () { return kind.perform(job, u); }).then(function (bytes) {
              job.done++;
              job.bytes += bytes || 0;
              emit();
            }, function (e) {
              if (!job.halt) halt(job, classify(e));
            }).then(function () { active--; launch(); finish(); });
          })(queue.shift());
        }
        finish();
      }
      launch();
    });
  }

  /** Try a unit a few times with back-off; never retry a full disk or a lost connection. */
  function attempt(job, fn) {
    var n = 0;
    function go() {
      n++;
      return fn().catch(function (e) {
        var why = classify(e);
        if (job.halt || why === "quota" || why === "offline" || why === "storage" || n >= cfg.tries) throw e;
        return delay(cfg.retryDelay * Math.pow(2, n - 1)).then(function () {
          if (job.halt) throw e;
          if (navigator.onLine === false) throw err("offline");
          return go();
        });
      });
    }
    return go();
  }

  /* ── Kind: Qur'an text (several editions per request) ─────────
     params: { editions: [...] }. One unit per surah; each unit fetches only the
     editions that surah is still missing. */
  KINDS.text = {
    units: function () { return range(1, 114); },
    missing: function (job, n) {
      return job.params.editions.filter(function (ed) { return !pack("text:" + ed, "text").have[n]; });
    },
    skip: function (job, n) { return !KINDS.text.missing(job, n).length; },
    doneBytes: function (job) {
      return job.params.editions.reduce(function (s, ed) { return s + packBytes(state.packs["text:" + ed]); }, 0);
    },
    perform: function (job, n) {
      var eds = KINDS.text.missing(job, n);
      var url = SS.ALQURAN + "/surah/" + n + "/editions/" + eds.join(",");
      return fetchJson(url).then(function (json) {
        var data = json && json.data;
        if (data && !Array.isArray(data)) data = [data];
        if (!data || data.length !== eds.length) throw err("bad-response");
        var pairs = [], sizes = {}, len = -1;
        eds.forEach(function (ed, i) {
          var d = null;
          for (var k = 0; k < data.length; k++) if (data[k] && data[k].edition && data[k].edition.identifier === ed) d = data[k];
          d = d || data[i];
          var texts = (d && d.ayahs || []).map(function (a) { return a && a.text; });
          if (!texts.length || texts.some(function (t) { return typeof t !== "string"; })) throw err("bad-response");
          if (len !== -1 && texts.length !== len) throw err("bad-response");
          len = texts.length;
          pairs.push([ed + "/" + n, texts]);
          sizes[ed] = sizeOf(texts);
        });
        guard(job);
        return idb.putMany("text", pairs).then(function () {
          var total = 0;
          return Promise.all(eds.map(function (ed) {
            var p = pack("text:" + ed, "text");
            p.edition = ed;
            p.have[n] = sizes[ed];
            total += sizes[ed];
            return savePack(p);
          })).then(function () { return total; });
        });
      });
    },
    /** Cancel: editions this download hadn't finished are removed. */
    cancel: function (job) {
      return Promise.all(job.params.editions.map(function (ed) {
        var p = state.packs["text:" + ed];
        if (p && packCount(p) >= 114) return null;
        return removePack("text:" + ed);
      }));
    },
  };

  /* ── Kind: Tafsir Ibn Kathir (one file per surah, with a per-ayah fallback) ── */
  function tafsirSurah(n) {
    var mirrors = SS.TAFSIR_MIRRORS.slice(), count = surahCount(n);
    function clean(json) {
      var list = json && (json.ayahs || json.tafsirs);
      if (!Array.isArray(list)) throw err("bad-response");
      var texts = [];
      for (var i = 0; i < count; i++) texts.push("");
      list.forEach(function (a) {
        if (!a || typeof a.text !== "string") return;
        if (a.surah != null && +a.surah !== n) throw err("tafsir-mismatch");
        var i = +a.ayah - 1;
        if (i >= 0 && i < count) texts[i] = a.text;
      });
      return texts;
    }
    function bySurah(i) {
      if (i >= mirrors.length) return Promise.reject(err("not-found"));
      var url = mirrors[i] + "/" + SS.TAFSIR_EDITION + "/" + n + ".json";
      return fetchJson(url).then(clean).catch(function (e) {
        if (classify(e) === "offline") throw e;
        return bySurah(i + 1);
      });
    }
    function oneAyah(a, i) {
      if (i >= mirrors.length) return Promise.reject(err("not-found"));
      return fetchJson(SS.tafsirUrl(n, a, mirrors[i])).then(function (json) {
        if (!json || typeof json.text !== "string") throw err("bad-response");
        if ((json.surah != null && +json.surah !== n) || (json.ayah != null && +json.ayah !== a)) throw err("tafsir-mismatch");
        return json.text;
      }).catch(function (e) {
        if (classify(e) === "offline") throw e;
        return oneAyah(a, i + 1);
      });
    }
    return bySurah(0).catch(function (e) {
      if (classify(e) === "offline") throw e;
      var texts = [], chain = Promise.resolve();
      range(1, count).forEach(function (a) {
        chain = chain.then(function () { return oneAyah(a, 0); }).then(function (t) { texts.push(t); });
      });
      return chain.then(function () { return texts; });
    });
  }
  KINDS.tafsir = {
    units: function () { return range(1, 114); },
    skip: function (job, n) { return !!pack("tafsir", "tafsir").have[n]; },
    doneBytes: function () { return packBytes(state.packs.tafsir); },
    perform: function (job, n) {
      return tafsirSurah(n).then(function (texts) {
        var size = sizeOf(texts);
        guard(job);
        return idb.put("tafsir", String(n), texts).then(function () {
          var p = pack("tafsir", "tafsir");
          p.have[n] = size;
          return savePack(p).then(function () { return size; });
        });
      });
    },
    cancel: function () {
      var p = state.packs.tafsir;
      if (p && packCount(p) >= 114) return null;
      return removePack("tafsir");
    },
  };

  /* ── Kind: recitation audio (one file per ayah, kept per surah) ──
     params: { reciter, surahs: [...], bitrate }. Units are ayahs; a surah
     counts as downloaded once all of its ayahs are stored. */
  function audioKey(reciter, g) { return AUDIO_KEY + reciter + "/" + g + ".mp3"; }
  function audioNetUrl(reciter, bitrate, g) {
    return SS.AUDIO_URL.replace("{bitrate}", String(bitrate)).replace("{edition}", reciter).replace("{ayah}", String(g));
  }
  function openCache(name) {
    if (!window.caches) return Promise.reject(err("storage"));
    return caches.open(name).catch(function (e) { throw err("storage", e); });
  }
  /** The bitrate the CDN serves this reciter at (the player remembers it; otherwise probe). */
  function findBitrate(reciter) {
    var known = SS.store.get("audio:br:" + reciter);
    var list = SS.AUDIO_BITRATES.slice();
    if (known != null && list[known]) list.unshift(list.splice(known, 1)[0]);
    function probe(i) {
      if (i >= list.length) return Promise.reject(err("not-found"));
      return fetchWithTimeout(audioNetUrl(reciter, list[i], 1)).then(function (res) {
        if (!res.ok) return probe(i + 1);
        return list[i];
      });
    }
    return probe(0);
  }
  KINDS.audio = {
    prepare: function (job) {
      var p = job.params;
      var bitrate = p.bitrate ? Promise.resolve(p.bitrate) : findBitrate(p.reciter).then(function (b) { p.bitrate = b; persistJob(job); return b; });
      return Promise.all([bitrate, openCache(AUDIO_CACHE).then(function (c) { return c.keys(); })]).then(function (r) {
        var have = {};
        r[1].forEach(function (req) { have[req.url] = 1; });
        job.cached = have;
        job.groups = {};
        p.surahs.forEach(function (n) { job.groups[n] = { left: surahCount(n), bytes: 0 }; });
        var pk = pack("audio:" + p.reciter, "audio");
        pk.reciter = p.reciter;
        pk.bitrate = p.bitrate;
        // Files already stored for surahs not yet complete: count them back in.
        var reads = [];
        p.surahs.forEach(function (n) {
          if (pk.have[n]) { job.groups[n].left = 0; return; }
          range(1, surahCount(n)).forEach(function (a) {
            var key = audioKey(p.reciter, SS.globalAyahNumber(n, a));
            if (have[key]) reads.push(caches.match(key, { cacheName: AUDIO_CACHE }).then(function (res) {
              job.groups[n].left--;
              job.groups[n].bytes += +(res && res.headers.get("content-length")) || 0;
            }));
          });
        });
        return Promise.all(reads).then(function () {
          return Promise.all(p.surahs.filter(function (n) { return !pk.have[n] && job.groups[n].left === 0; })
            .map(function (n) { return finishSurah(job, n); }));
        });
      });
    },
    units: function (job) {
      var out = [];
      job.params.surahs.forEach(function (n) {
        range(1, surahCount(n)).forEach(function (a) { out.push([n, a]); });
      });
      return out;
    },
    skip: function (job, u) {
      var pk = pack("audio:" + job.params.reciter, "audio");
      return !!pk.have[u[0]] || !!job.cached[audioKey(job.params.reciter, SS.globalAyahNumber(u[0], u[1]))];
    },
    doneBytes: function (job) {
      var pk = state.packs["audio:" + job.params.reciter], b = 0;
      job.params.surahs.forEach(function (n) { b += (pk && pk.have[n]) || job.groups[n].bytes; });
      return b;
    },
    perform: function (job, u) {
      var p = job.params, g = SS.globalAyahNumber(u[0], u[1]);
      return fetchWithTimeout(audioNetUrl(p.reciter, p.bitrate, g), { signal: job.abort ? job.abort.signal : undefined }).then(function (res) {
        if (!res.ok) throw err("http-" + res.status);
        return res.blob();
      }).then(function (blob) {
        if (!blob.size) throw err("bad-response");
        guard(job);
        var stored = new Response(blob, { headers: { "Content-Type": "audio/mpeg", "Content-Length": String(blob.size) } });
        return openCache(AUDIO_CACHE).then(function (c) { return c.put(audioKey(p.reciter, g), stored); }).then(function () {
          var grp = job.groups[u[0]];
          grp.left--;
          grp.bytes += blob.size;
          return (grp.left === 0 ? finishSurah(job, u[0]) : Promise.resolve()).then(function () { return blob.size; });
        });
      });
    },
    /** Cancel: surahs that finished stay; part-downloaded ones are removed. */
    cancel: function (job) {
      var pk = state.packs["audio:" + job.params.reciter];
      var partial = job.params.surahs.filter(function (n) { return !(pk && pk.have[n]); });
      return removeAudio(job.params.reciter, partial);
    },
  };
  function finishSurah(job, n) {
    var pk = pack("audio:" + job.params.reciter, "audio");
    pk.have[n] = job.groups[n].bytes;
    return savePack(pk);
  }

  /* ── Removing ───────────────────────────────────────────────── */
  function removePack(id) {
    var p = state.packs[id];
    var work;
    if (id.indexOf("text:") === 0) work = idb.delPrefix("text", id.slice(5) + "/");
    else if (id === "tafsir") work = tx("tafsir", "readwrite", function (st) { return st.clear(); });
    else if (id.indexOf("audio:") === 0) return removeAudio(id.slice(6), range(1, 114));
    else work = Promise.resolve();
    return work.then(function () {
      delete state.packs[id];
      return idb.del("meta", "pack:" + id);
    }).then(function () { emit(); return p; });
  }
  function removeAudio(reciter, surahs) {
    var id = "audio:" + reciter;
    return openCache(AUDIO_CACHE).then(function (c) {
      var dels = [];
      surahs.forEach(function (n) {
        range(1, surahCount(n)).forEach(function (a) { dels.push(c.delete(audioKey(reciter, SS.globalAyahNumber(n, a)))); });
      });
      return Promise.all(dels);
    }).then(function () {
      var p = state.packs[id];
      if (!p) return null;
      surahs.forEach(function (n) { delete p.have[n]; });
      if (!packCount(p)) { delete state.packs[id]; return idb.del("meta", "pack:" + id); }
      return savePack(p);
    }).then(function () { emit(); });
  }
  /** Stop jobs that would write into what is being removed. */
  function stopJobsFor(test) {
    state.order.slice().forEach(function (id) {
      var j = state.jobs[id];
      if (j && test(j)) { halt(j, "cancelled"); if (running !== j) dropJob(j); }
    });
  }

  /* ── PDF (one file, Cache API; downloaded on request) ─────────── */
  var pdfCheck = null, pdfDl = null;
  function pdfUrl() {
    if (!SS.QURAN_PDF) return "";
    try { return new URL(SS.QURAN_PDF, location.href).href; } catch (e) { return ""; }
  }
  function pdfInfo() { return SS.QURAN_PDF_INFO || {}; }
  function pdfStored() { return SS.store.get("offline:pdf"); }
  function pdfFilename() { return (SS.QURAN_PDF || "quran.pdf").split("/").pop(); }
  function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); }

  var pdf = {
    url: pdfUrl,
    info: pdfInfo,
    stored: pdfStored,
    /** Is there a PDF to offer? → { available, stored, bytes }. Hidden when the
        config is empty or the file is missing (or unreachable and not stored). */
    check: function (force) {
      var url = pdfUrl();
      if (!url) return Promise.resolve({ available: false });
      var st = pdfStored();
      if (st) {
        return openCache(PDF_CACHE).then(function (c) { return c.match(url); }).then(function (hit) {
          if (hit) return { available: true, stored: true, bytes: st.bytes };
          SS.store.remove("offline:pdf");
          return pdf.check(force);
        }, function () { return { available: false }; });
      }
      if (pdfCheck && !force) return pdfCheck;
      if (navigator.onLine === false) return Promise.resolve({ available: false });
      pdfCheck = fetchWithTimeout(url, { method: "HEAD", cache: "no-store" }).then(function (res) {
        var type = res.headers.get("content-type") || "";
        if (!res.ok || /text\/html/i.test(type)) return { available: false };
        return { available: true, stored: false, bytes: +res.headers.get("content-length") || pdfInfo().bytes || 0 };
      }).catch(function () { pdfCheck = null; return { available: false }; });
      return pdfCheck;
    },
    /** Download with progress; pausable (resumes with a Range request when the
        server allows it). onProgress(received, total). Resolves with the Blob. */
    download: function (onProgress) {
      if (pdfDl && pdfDl.promise && !pdfDl.paused) return pdfDl.promise;
      var url = pdfUrl();
      if (!url) return Promise.reject(err("not-found"));
      markUsed();
      var dl = pdfDl && pdfDl.paused ? pdfDl : { chunks: [], received: 0, total: 0 };
      pdfDl = dl;
      dl.paused = false;
      dl.onProgress = onProgress || dl.onProgress;
      dl.ctrl = typeof AbortController === "function" ? new AbortController() : null;
      var headers = dl.received ? { Range: "bytes=" + dl.received + "-" } : {};
      dl.promise = fetch(url, { headers: headers, signal: dl.ctrl ? dl.ctrl.signal : undefined, cache: "no-store" }).then(function (res) {
        if (!res.ok) throw err(res.status === 404 ? "not-found" : "http-" + res.status);
        if (dl.received && res.status !== 206) { dl.chunks = []; dl.received = 0; } // server ignored Range: start over
        var len = +res.headers.get("content-length") || 0;
        if (!dl.total) dl.total = len ? len + dl.received : pdfInfo().bytes || 0;
        if (!res.body || !res.body.getReader) {
          return res.blob().then(function (b) { dl.chunks.push(b); dl.received += b.size; });
        }
        var reader = res.body.getReader();
        function pull() {
          return reader.read().then(function (r) {
            if (r.done) return null;
            dl.chunks.push(r.value);
            dl.received += r.value.byteLength;
            if (dl.onProgress) dl.onProgress(dl.received, dl.total);
            return pull();
          });
        }
        return pull();
      }).then(function () {
        var blob = new Blob(dl.chunks, { type: "application/pdf" });
        return pdf.store(blob).then(function () { pdfDl = null; return blob; });
      }, function (e) {
        if (dl.paused) throw err("paused");
        if (dl.cancelled) { pdfDl = null; throw err("cancelled"); }
        pdfDl = null;
        throw e;
      });
      return dl.promise;
    },
    progress: function () { return pdfDl ? { received: pdfDl.received, total: pdfDl.total, paused: !!pdfDl.paused } : null; },
    pause: function () { if (pdfDl && !pdfDl.paused) { pdfDl.paused = true; if (pdfDl.ctrl) pdfDl.ctrl.abort(); emit(); } },
    cancel: function () {
      if (!pdfDl) return;
      var dl = pdfDl;
      dl.cancelled = true;
      if (dl.paused) pdfDl = null;
      else if (dl.ctrl) dl.ctrl.abort();
      emit();
    },
    /** Keep a copy for offline use, plus the viewer's own files (pdf.js) so it opens offline. */
    store: function (blob) {
      var url = pdfUrl();
      return openCache(PDF_CACHE).then(function (c) {
        var res = new Response(blob, { headers: { "Content-Type": "application/pdf", "Content-Length": String(blob.size) } });
        return c.put(url, res).then(function () {
          SS.store.set("offline:pdf", { bytes: blob.size, at: Date.now() });
          emit();
          return Promise.all(PDFJS_FILES.map(function (f) {
            var u = new URL(f, location.href).href;
            return c.match(u).then(function (hit) {
              if (hit) return null;
              return fetch(u).then(function (r) { if (r.ok) return c.put(u, r); return null; });
            }).catch(function () { /* the viewer fetches it on first open instead */ });
          }));
        });
      }).then(function () { return blob; });
    },
    blob: function () {
      return openCache(PDF_CACHE).then(function (c) { return c.match(pdfUrl()); }).then(function (res) {
        if (!res) throw err("not-found");
        return res.blob();
      });
    },
    remove: function () {
      pdf.cancel();
      return (window.caches ? caches.delete(PDF_CACHE) : Promise.resolve()).catch(function () {})
        .then(function () {
          SS.store.remove("offline:pdf");
          SS.store.remove("pdf:lastPage");
          pdfCheck = null;
          emit();
        });
    },
    /** Save a copy to the device: the share sheet on iPhone/iPad (where a plain
        download opens a preview instead), a normal download everywhere else.
        Resolves "shared" | "downloaded" | "needs-tap" (the share sheet needs a fresh tap). */
    saveToDevice: function (blob) {
      var name = pdfFilename();
      if (isIOS() && navigator.canShare && typeof File === "function") {
        var file = new File([blob], name, { type: "application/pdf" });
        if (navigator.canShare({ files: [file] })) {
          return navigator.share({ files: [file], title: pdfInfo().title || name }).then(function () { return "shared"; }, function (e) {
            if (e && e.name === "AbortError") return "cancelled";
            if (e && e.name === "NotAllowedError") return "needs-tap";
            throw e;
          });
        }
      }
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 30000);
      return Promise.resolve("downloaded");
    },
    isIOS: isIOS,
  };

  var pdfjsPromise = null;
  /** Load pdf.js (vendored ES module) on first use. */
  function loadPdfjs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (pdfjsPromise) return pdfjsPromise;
    pdfjsPromise = new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { fail(err("pdfjs-timeout")); }, 30000);
      function done() { clearTimeout(timer); window.removeEventListener("ss:pdfjs", done); resolve(window.pdfjsLib); }
      function fail(e) { clearTimeout(timer); window.removeEventListener("ss:pdfjs", done); pdfjsPromise = null; reject(e); }
      window.addEventListener("ss:pdfjs", done);
      var s = document.createElement("script");
      s.type = "module";
      s.src = PDFJS_FILES[0];
      s.onerror = function () { s.remove(); fail(err(navigator.onLine === false ? "offline" : "pdfjs-failed")); };
      document.head.appendChild(s);
    });
    return pdfjsPromise;
  }

  /* ── Public API ─────────────────────────────────────────────── */
  function wrap(texts, n) {
    var base = SS.OFFSETS[n - 1];
    return texts.map(function (t, i) { return { number: base + i + 1, numberInSurah: i + 1, text: t }; });
  }
  function hasEdition(ed, n) { var p = state.packs["text:" + ed]; return !!(p && p.have[n]); }
  function jobFor(id) { return state.jobs[id] || null; }

  SS.offline = {
    ready: ready,
    config: cfg,
    used: used,
    MB: MB,
    PDF_CACHE: PDF_CACHE,
    AUDIO_CACHE: AUDIO_CACHE,
    BASE_EDITIONS: BASE_EDITIONS,

    /* Read paths ------------------------------------------------ */
    /** A surah from the offline store, or null (not downloaded in this translation). */
    surah: function (n, tr) {
      if (!used()) return Promise.resolve(null);
      return ready().then(function () {
        var eds = ["quran-uthmani", tr, "en.transliteration"];
        if (!eds.every(function (ed) { return hasEdition(ed, n); })) return null;
        return Promise.all(eds.map(function (ed) { return idb.get("text", ed + "/" + n); })).then(function (r) {
          if (!r[0] || !r[1] || !r[2]) return null;
          return { arabic: wrap(r[0], n), translation: wrap(r[1], n), transliteration: wrap(r[2], n), offline: true };
        });
      }).catch(function () { return null; });
    },
    /** One ayah by global number (Ayah of the Day, adhkar), or null. */
    ayah: function (g, tr) {
      if (!used()) return Promise.resolve(null);
      var n = 1;
      while (n < 114 && SS.OFFSETS[n] < g) n++;
      var a = g - SS.OFFSETS[n - 1], meta = SS.SURAHS[n - 1];
      return ready().then(function () {
        if (!hasEdition("quran-uthmani", n) || !hasEdition(tr, n)) return null;
        return Promise.all([idb.get("text", "quran-uthmani/" + n), idb.get("text", tr + "/" + n)]).then(function (r) {
          if (!r[0] || !r[1] || r[0][a - 1] == null) return null;
          return { arabic: r[0][a - 1], translation: r[1][a - 1], surah: { number: n, englishName: meta.en }, numberInSurah: a, offline: true };
        });
      }).catch(function () { return null; });
    },
    /** Tafsir Ibn Kathir for an ayah from the offline store, or null. */
    tafsir: function (s, a) {
      if (!used()) return Promise.resolve(null);
      return ready().then(function () {
        var p = state.packs.tafsir;
        if (!p || !p.have[s]) return null;
        return idb.get("tafsir", String(s)).then(function (texts) {
          return texts ? { text: texts[a - 1] || "", surah: s, ayah: a, offline: true } : null;
        });
      }).catch(function () { return null; });
    },
    /** Is this surah's recitation stored for the reciter? (sync; for the player) */
    hasAudio: function (reciter, s) {
      var p = state.packs["audio:" + reciter];
      return !!(p && p.have[s]);
    },
    /** A playable blob: URL for a stored ayah, or null. */
    audioUrl: function (reciter, s, a) {
      if (!SS.offline.hasAudio(reciter, s) || !window.caches) return Promise.resolve(null);
      return caches.match(audioKey(reciter, SS.globalAyahNumber(s, a)), { cacheName: AUDIO_CACHE }).then(function (res) {
        return res ? res.blob().then(function (b) { return URL.createObjectURL(b); }) : null;
      }).catch(function () { return null; });
    },
    hasText: function (n, tr) {
      return hasEdition("quran-uthmani", n) && hasEdition("en.transliteration", n) && hasEdition(tr || SS.translation().id, n);
    },

    /* Status ----------------------------------------------------- */
    pack: function (id) { return state.packs[id] || null; },
    packBytes: function (id) { return packBytes(state.packs[id]); },
    packCount: function (id) { return packCount(state.packs[id]); },
    job: jobFor,
    jobs: function () { return state.order.map(function (id) { return state.jobs[id]; }); },
    totalBytes: function () {
      var b = 0;
      for (var id in state.packs) b += packBytes(state.packs[id]);
      var st = pdfStored();
      return b + (st ? st.bytes || 0 : 0);
    },
    usage: function () {
      if (!navigator.storage || !navigator.storage.estimate) return Promise.resolve(null);
      return navigator.storage.estimate().catch(function () { return null; });
    },
    /** Ask the browser to keep downloads even when space runs low. → true | false | null (unsupported). */
    persist: function () {
      if (!navigator.storage || !navigator.storage.persist) return Promise.resolve(null);
      return navigator.storage.persisted().then(function (p) {
        return p || navigator.storage.persist();
      }).then(function (ok) {
        SS.store.set("offline:persist", ok ? "granted" : "refused");
        emit();
        return ok;
      }).catch(function () { return null; });
    },

    /* Estimates (bytes) ------------------------------------------ */
    estimate: {
      edition: function (ed) { return Math.round((TEXT_MB[ed] || 0.9) * MB); },
      text: function (tr) {
        return BASE_EDITIONS.concat([tr]).reduce(function (s, ed) { return s + SS.offline.estimate.edition(ed); }, 0);
      },
      tafsir: function () { return TAFSIR_MB * MB; },
      audio: function (reciter, surahs, bitrate) {
        var br = bitrate || SS.AUDIO_BITRATES[SS.store.get("audio:br:" + reciter, 0) || 0] || 128;
        var whole = (SEC_PER_PAGE[reciter] || 120) * 604 * br * 1000 / 8;
        var w = 0;
        (surahs || range(1, 114)).forEach(function (n) { w += WEIGHTS[n - 1]; });
        return Math.round(whole * w);
      },
    },

    /* Downloads ---------------------------------------------------- */
    /** The whole Qur'an: Arabic + the chosen translation + transliteration. */
    downloadText: function (tr) {
      tr = tr || SS.translation().id;
      return start({ id: "text", kind: "text", params: { editions: BASE_EDITIONS.concat([tr]) } });
    },
    /** Another translation for offline use (with the Arabic and transliteration
        too, if they aren't downloaded yet — a translation alone can't be read). */
    addTranslation: function (tr) {
      return start({ id: "tr:" + tr, kind: "text", params: { editions: BASE_EDITIONS.concat([tr]) } });
    },
    downloadTafsir: function () { return start({ id: "tafsir", kind: "tafsir", params: {} }); },
    /** Recitation for some surahs, or "all". */
    downloadAudio: function (reciter, surahs) {
      if (surahs === "all" || !surahs) surahs = range(1, 114);
      var id = "audio:" + reciter;
      return ready().then(function () {
        var job = state.jobs[id];
        if (job) {
          // Add surahs to a download already under way for this reciter.
          var more = surahs.filter(function (n) { return job.params.surahs.indexOf(n) === -1; });
          if (!more.length && (job.status === "running" || job.status === "queued")) return job;
          // A running job is stopped and re-queued, so it picks up the longer list.
          if (job === running) halt(job, "paused");
          job.params.surahs = job.params.surahs.concat(more).sort(function (a, b) { return a - b; });
          job.status = "queued";
          job.reason = "";
          persistJob(job);
          emit();
          kick();
          return job;
        }
        return start({ id: id, kind: "audio", params: { reciter: reciter, surahs: surahs } });
      });
    },
    pause: function (id) {
      var j = jobFor(id);
      if (!j) return;
      if (j === running) halt(j, "paused");
      else { j.status = "paused"; j.reason = "paused"; persistJob(j); emit(); }
    },
    resume: function (id) {
      var j = jobFor(id);
      if (!j || j === running) return;
      j.status = "queued";
      j.reason = "";
      persistJob(j);
      emit();
      kick();
    },
    cancel: function (id) {
      var j = jobFor(id);
      if (!j) return Promise.resolve();
      if (j === running) { halt(j, "cancelled"); return Promise.resolve(); }
      j.status = "cancelled";
      return Promise.resolve(KINDS[j.kind].cancel(j)).catch(function () {}).then(function () { return dropJob(j); }).then(emit);
    },

    /* Removing ------------------------------------------------------ */
    /** Remove one downloaded item ("text:<edition>", "audio:<reciter>" [surah], "tafsir"). */
    remove: function (id, surah) {
      return ready().then(function () {
        if (id.indexOf("audio:") === 0) {
          var reciter = id.slice(6);
          if (surah) return removeAudio(reciter, [surah]);
          stopJobsFor(function (j) { return j.id === id; });
          return removeAudio(reciter, range(1, 114));
        }
        stopJobsFor(function (j) {
          return (id === "tafsir" && j.kind === "tafsir") || (j.kind === "text" && j.params.editions.indexOf(id.slice(5)) !== -1);
        });
        return removePack(id);
      });
    },
    /** Remove every offline download from this device. */
    removeAll: function () {
      generation++;
      state.order.slice().forEach(function (id) { halt(state.jobs[id], "cancelled"); });
      pdf.cancel();
      var jobs = [];
      return Promise.resolve().then(function () {
        if (!window.indexedDB) return null;
        if (dbPromise) jobs.push(dbPromise.then(function (d) { d.close(); }).catch(function () {}));
        return Promise.all(jobs).then(function () {
          dbPromise = null;
          return new Promise(function (resolve) {
            var req = indexedDB.deleteDatabase(DB_NAME);
            req.onsuccess = req.onerror = req.onblocked = function () { resolve(); };
          });
        });
      }).then(function () {
        if (!window.caches) return null;
        return Promise.all([caches.delete(AUDIO_CACHE), caches.delete(PDF_CACHE)]).catch(function () {});
      }).then(function () {
        state.packs = {}; state.jobs = {}; state.order = [];
        running = null;
        readyPromise = null;
        pdfCheck = null;
        ["offline:used", "offline:pdf", "offline:persist", "pdf:lastPage"].forEach(function (k) { SS.store.remove(k); });
        emit();
      });
    },

    pdf: pdf,
    loadPdfjs: loadPdfjs,
    /** Human message key for a job's stop reason. */
    reasonKey: function (reason) {
      return { quota: "off.errQuota", offline: "off.errOffline", storage: "off.errStorage", failed: "off.errFailed" }[reason] || "";
    },
  };

  /* Lost connection → pause with a message; back online → carry on. */
  window.addEventListener("offline", function () {
    if (running) halt(running, "offline");
    if (pdfDl && !pdfDl.paused) { pdf.pause(); pdfDl.lost = true; }
  });
  window.addEventListener("online", function () {
    var any = false;
    state.order.forEach(function (id) {
      var j = state.jobs[id];
      if (j.status === "offline") { j.status = "queued"; j.reason = ""; any = true; }
    });
    if (any) { emit(); kick(); }
  });

  // Pick up downloads interrupted by a closed tab.
  if (used()) setTimeout(ready, 0);
})();
