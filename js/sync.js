/* SalaamStreet — sync.js (classic script, also loadable in Node for tests)
   Cross-device sync engine for signed-in accounts.

   Everything personal in SalaamStreet already lives in localStorage. This
   engine mirrors the parts worth keeping across devices into an account,
   record by record, and merges changes from other devices back in:

   • Each synced value is split into small RECORDS (one per bookmark, one per
     setting, one per day of the prayer log, …) so two devices editing
     different things never overwrite each other.
   • Each record carries `t`, the time it last changed on the device that
     changed it. Conflicts on the same record are resolved last-writer-wins,
     except where a smarter merge is safe and obvious (streaks keep the best
     run, reading progress keeps the furthest point, recent lists are unioned).
   • Deletions are synced as tombstones, so removing a bookmark on the phone
     removes it on the laptop too.
   • Local changes are queued (dirty flags persisted in localStorage) and pushed
     when online; pulls are incremental using the server's change cursor.
   • A guest's existing data is merged into the account on first sign-in —
     never wiped.

   The engine knows nothing about Supabase or the DOM: it talks to a
   `storage` adapter (raw local reads/writes) and a `backend` adapter
   ({ pull(since), push(records) }). See account.js for the real wiring. */
(function (root) {
  "use strict";
  var SS = (root.SS = root.SS || {});

  /* ── What syncs ──────────────────────────────────────────────────
     map:   the stored value is an object; each property is its own record.
     value: the whole stored value is one record.
     merge: (local, remote) → merged, for records where both sides' changes
            should be kept. Must be commutative and idempotent. */
  function num(x) { return typeof x === "number" && isFinite(x) ? x : 0; }
  var MERGE = {
    /** Furthest-along wins per key (reading progress, daily dhikr counts). */
    maxMap: function (a, b) {
      var out = {}, k;
      a = a && typeof a === "object" ? a : {}; b = b && typeof b === "object" ? b : {};
      for (k in a) out[k] = a[k];
      for (k in b) out[k] = typeof out[k] === "number" ? Math.max(out[k], num(b[k])) : b[k];
      return out;
    },
    max: function (a, b) { return Math.max(num(a), num(b)); },
    /** The most recent reading position (by `at`) wins. */
    newestAt: function (a, b) {
      if (!a) return b; if (!b) return a;
      var ta = num(a.at), tb = num(b.at);
      if (ta !== tb) return ta > tb ? a : b;
      return (num(a.surah) * 1000 + num(a.ayah)) >= (num(b.surah) * 1000 + num(b.ayah)) ? a : b;
    },
    /** Recently read surahs: union, newest first, one entry per surah. */
    recent: function (a, b) {
      var by = {};
      [].concat(Array.isArray(a) ? a : [], Array.isArray(b) ? b : []).forEach(function (r) {
        if (!r || !r.surah) return;
        var cur = by[r.surah];
        if (!cur || num(r.at) > num(cur.at) || (num(r.at) === num(cur.at) && num(r.ayah) > num(cur.ayah))) by[r.surah] = r;
      });
      return Object.keys(by).map(function (k) { return by[k]; })
        .sort(function (x, y) { return num(y.at) - num(x.at) || num(x.surah) - num(y.surah); })
        .slice(0, 12);
    },
    /** Union of names (bookmark collections), sorted. */
    union: function (a, b) {
      var seen = {}, out = [];
      [].concat(Array.isArray(a) ? a : [], Array.isArray(b) ? b : []).forEach(function (x) {
        if (typeof x === "string" && x && !seen[x]) { seen[x] = 1; out.push(x); }
      });
      return out.sort();
    },
    /** Dhikr streak: keep the latest run and the best-ever run. */
    streak: function (a, b) {
      if (!a) return b; if (!b) return a;
      var la = a.lastDate || "", lb = b.lastDate || "";
      var cur = la > lb ? a : lb > la ? b : (num(a.current) >= num(b.current) ? a : b);
      var current = num(cur.current);
      return { current: current, longest: Math.max(num(a.longest), num(b.longest), current), lastDate: cur.lastDate || null };
    },
  };

  var SPECS = [
    // Settings: per field. Location and reminders are per device on purpose
    // (where you are, and notification permission, belong to each device).
    { key: "settings", map: true, col: "pref", skip: { location: 1, reminders: 1 } },
    { key: "quran:bookmarks", map: true, col: "bm" },
    { key: "duas:favorites", map: true, col: "fav" },
    { key: "prayers:log", map: true, col: "prayers" },
    { key: "adhkar:done", map: true, col: "adhkar" },
    { key: "dhikr:targets", map: true, col: "dtarget" },
    { prefix: "ramadan:", map: true },
    { key: "quran:lastRead", merge: MERGE.newestAt },
    { key: "quran:recent", merge: MERGE.recent },
    { key: "quran:progress", merge: MERGE.maxMap },
    { key: "quran:folders", merge: MERGE.union },
    { key: "quran:plan" },
    { key: "dhikr:streak", merge: MERGE.streak },
    { key: "dhikr:preset" },
    { key: "learn:best", merge: MERGE.max },
    { prefix: "dhikr:day:", merge: MERGE.maxMap },
  ];
  var META_KEY = "sync:meta";

  function specFor(key) {
    for (var i = 0; i < SPECS.length; i++) {
      var s = SPECS[i];
      if (s.key ? s.key === key : key.indexOf(s.prefix) === 0) return s;
    }
    return null;
  }
  /** Server column for a map-mode storage key. */
  function mapCol(spec, key) { return spec.col || "m:" + key; }
  /** Reverse: a record's (col, key) → { storageKey, entry, spec }. */
  function locate(col, key) {
    if (col === "v") { var sv = specFor(key); return sv && !sv.map ? { storageKey: key, entry: null, spec: sv } : null; }
    if (col.indexOf("m:") === 0) {
      var sk = col.slice(2), sm = specFor(sk);
      return sm && sm.map && !sm.col ? { storageKey: sk, entry: key, spec: sm } : null;
    }
    for (var i = 0; i < SPECS.length; i++) {
      if (SPECS[i].col === col) {
        if (SPECS[i].skip && SPECS[i].skip[key]) return null;
        return { storageKey: SPECS[i].key, entry: key, spec: SPECS[i] };
      }
    }
    return null;
  }
  function rid(col, key) { return col + "\u0001" + key; }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function isObj(x) { return x && typeof x === "object" && !Array.isArray(x); }

  /** Split a stored value into { id: { col, key, value } } records. */
  function recordsOf(storageKey, value) {
    var spec = specFor(storageKey), out = {};
    if (!spec || value === undefined || value === null) return out;
    if (spec.map) {
      if (!isObj(value)) return out;
      var col = mapCol(spec, storageKey);
      for (var k in value) {
        if (spec.skip && spec.skip[k]) continue;
        if (value[k] === undefined) continue;
        out[rid(col, k)] = { col: col, key: k, value: value[k] };
      }
    } else {
      out[rid("v", storageKey)] = { col: "v", key: storageKey, value: value };
    }
    return out;
  }

  /**
   * new SyncEngine({ storage, backend, now, onApplied, onStatus })
   *   storage: { get(key), setSilent(key, val), removeSilent(key), keys() }
   *   backend: { pull(sinceIso) → Promise<rows>, push(records) → Promise<rejectedRows> }
   *            rows: { col, key, value, t, deleted, server_at }
   */
  function SyncEngine(o) {
    this.storage = o.storage;
    this.backend = o.backend || null;
    this.now = o.now || function () { return Date.now(); };
    this.onApplied = o.onApplied || function () {};
    this.onStatus = o.onStatus || function () {};
    this._running = null;
    this._again = false;
    this.status = "idle";
  }

  SyncEngine.prototype.meta = function () {
    var m = this.storage.get(META_KEY);
    if (!m || m.v !== 1) m = { v: 1, recs: {}, cursor: null, owner: null, prevOwner: null, lastSync: 0 };
    if (!m.recs) m.recs = {};
    return m;
  };
  SyncEngine.prototype.saveMeta = function (m) { this.storage.setSilent(META_KEY, m); };

  /** Is this storage key synced at all? (cheap check used by the store hook) */
  SyncEngine.prototype.watches = function (key) { return key !== META_KEY && !!specFor(key); };

  /** Record a local write: diff old vs new and stamp changed records dirty. */
  SyncEngine.prototype.trackWrite = function (storageKey, oldVal, newVal) {
    var spec = specFor(storageKey);
    if (!spec) return 0;
    var before = recordsOf(storageKey, oldVal), after = recordsOf(storageKey, newVal);
    var m = this.meta(), t = this.now(), n = 0, id;
    for (id in after) {
      if (!before[id] || !same(before[id].value, after[id].value)) { m.recs[id] = [t, 1]; n++; }
    }
    for (id in before) {
      if (!after[id]) { m.recs[id] = [t, 1]; n++; } // removed → tombstone
    }
    if (n) this.saveMeta(m);
    return n;
  };

  /** Current local value of one record (undefined if absent). */
  SyncEngine.prototype._localRecord = function (loc) {
    var v = this.storage.get(loc.storageKey);
    if (loc.entry === null) return v === null ? undefined : v;
    return isObj(v) && Object.prototype.hasOwnProperty.call(v, loc.entry) ? v[loc.entry] : undefined;
  };
  SyncEngine.prototype._writeRecord = function (loc, value, deleted) {
    if (loc.entry === null) {
      if (deleted || value === undefined || value === null) this.storage.removeSilent(loc.storageKey);
      else this.storage.setSilent(loc.storageKey, value);
      return;
    }
    var obj = this.storage.get(loc.storageKey);
    obj = isObj(obj) ? obj : {};
    if (deleted || value === undefined) delete obj[loc.entry];
    else obj[loc.entry] = value;
    if (Object.keys(obj).length || loc.storageKey === "settings") this.storage.setSilent(loc.storageKey, obj);
    else this.storage.removeSilent(loc.storageKey);
  };

  /** Every synced record currently on this device. */
  SyncEngine.prototype.localRecords = function () {
    var keys = this.storage.keys(), out = {};
    for (var i = 0; i < keys.length; i++) {
      if (!this.watches(keys[i])) continue;
      var r = recordsOf(keys[i], this.storage.get(keys[i]));
      for (var id in r) out[id] = r[id];
    }
    return out;
  };

  /**
   * Prepare the first sync of this device with an account. Everything on the
   * device is queued for upload; records never stamped keep t = 0 so that,
   * for single values like settings, the account's existing choice wins,
   * while collections (bookmarks, logs, favourites) are simply combined.
   */
  SyncEngine.prototype.beginSession = function (uid) {
    var m = this.meta();
    if (m.owner === uid) return { migrated: 0 };
    var recs = this.localRecords();
    for (var id in recs) {
      var cur = m.recs[id];
      m.recs[id] = [cur ? cur[0] : 0, 1];
    }
    // (Tombstones the guest made are already queued and stay queued.)
    m.owner = uid; m.prevOwner = null; m.cursor = null; m.lastSync = 0;
    this.saveMeta(m);
    return { migrated: Object.keys(recs).length };
  };
  /** Does the device hold data that belonged to a different account? */
  SyncEngine.prototype.foreignOwner = function (uid) {
    var m = this.meta();
    var other = m.owner && m.owner !== uid ? m.owner : m.prevOwner && m.prevOwner !== uid ? m.prevOwner : null;
    if (!other) return false;
    var recs = this.localRecords();
    return Object.keys(recs).length > 0;
  };
  /** Sign-out. keepData=false removes every synced value from the device. */
  SyncEngine.prototype.endSession = function (keepData) {
    var m = this.meta();
    if (!keepData) {
      var keys = this.storage.keys();
      for (var i = 0; i < keys.length; i++) if (this.watches(keys[i])) this.storage.removeSilent(keys[i]);
      this.storage.removeSilent(META_KEY);
      return;
    }
    m.prevOwner = m.owner; m.owner = null; m.cursor = null;
    // What's on the device is now guest data; nothing is queued for anyone.
    for (var id in m.recs) m.recs[id][1] = 0;
    this.saveMeta(m);
  };
  /** Drop local synced data so the account's copy replaces it. */
  SyncEngine.prototype.resetLocal = function () { this.endSession(false); };

  SyncEngine.prototype.pendingCount = function () {
    var m = this.meta(), n = 0;
    for (var id in m.recs) if (m.recs[id][1]) n++;
    return n;
  };

  /** Apply rows from the server. Returns the storage keys that changed. */
  SyncEngine.prototype.applyRemote = function (rows, m) {
    var changed = {};
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var loc = locate(r.col, r.key);
      if (!loc) continue;
      var id = rid(r.col, r.key);
      var meta = m.recs[id] || [0, 0];
      var lt = meta[0], dirty = !!meta[1], rt = num(+r.t);
      var local = this._localRecord(loc);
      var remoteVal = r.deleted ? undefined : r.value;
      if (loc.spec.merge && local !== undefined && remoteVal !== undefined && dirty) {
        var merged = loc.spec.merge(local, remoteVal);
        if (!same(merged, local)) { this._writeRecord(loc, merged, false); changed[loc.storageKey] = 1; }
        m.recs[id] = [Math.max(lt, rt), same(merged, remoteVal) ? 0 : 1];
      } else if (rt > lt || (rt === lt && (!dirty || lt === 0))) {
        // (lt === 0: unstamped data from before this device ever synced never
        // beats a value the account already has — even an equally old one.)
        if (!same(local, remoteVal)) { this._writeRecord(loc, remoteVal, !!r.deleted); changed[loc.storageKey] = 1; }
        m.recs[id] = [rt, 0];
      } else if (!dirty && !same(local, remoteVal)) {
        // Our copy is newer than the server's but isn't queued: queue it.
        m.recs[id] = [lt, 1];
      }
      if (r.server_at && (!m.cursor || r.server_at > m.cursor)) m.cursor = r.server_at;
    }
    return Object.keys(changed);
  };

  /** One full round: pull → merge → push. Concurrent calls coalesce. */
  SyncEngine.prototype.sync = function () {
    var self = this;
    if (!this.backend) return Promise.reject(new Error("no-backend"));
    if (this._running) { this._again = true; return this._running; }
    this._setStatus("syncing");
    this._running = this._round().then(function (changed) {
      self._running = null;
      self._setStatus("synced");
      if (changed.length) self.onApplied(changed);
      if (self._again) { self._again = false; return self.sync(); }
      return changed;
    }, function (err) {
      self._running = null;
      self._again = false;
      self._setStatus(err && err.offline ? "offline" : "error", err);
      throw err;
    });
    return this._running;
  };
  SyncEngine.prototype._setStatus = function (s, err) { this.status = s; this.onStatus(s, err); };

  SyncEngine.prototype._round = function () {
    var self = this, changed = {};
    var m0 = this.meta();
    // A few seconds of overlap: rows committed slightly out of order are
    // re-read rather than missed (applying a row twice is harmless).
    var since = m0.cursor ? new Date(Date.parse(m0.cursor) - 5000).toISOString() : null;
    return this.backend.pull(since).then(function (rows) {
      var m = self.meta();
      self.applyRemote(rows || [], m).forEach(function (k) { changed[k] = 1; });
      self.saveMeta(m);
      // Push everything queued.
      var push = [], ids = [];
      for (var id in m.recs) {
        if (!m.recs[id][1]) continue;
        var sep = id.indexOf("\u0001"), col = id.slice(0, sep), key = id.slice(sep + 1);
        var loc = locate(col, key);
        if (!loc) { delete m.recs[id]; continue; }
        var val = self._localRecord(loc);
        push.push({ col: col, key: key, value: val === undefined ? null : val, t: m.recs[id][0], deleted: val === undefined });
        ids.push(id);
      }
      self.saveMeta(m);
      if (!push.length) return [];
      var sentT = push.map(function (p) { return p.t; });
      return self.backend.push(push).then(function (rejected) {
        var mm = self.meta(), refused = {};
        (rejected || []).forEach(function (r) { refused[rid(r.col, r.key)] = 1; });
        // Clear the queue for what the server accepted, unless it changed
        // again meanwhile.
        for (var i = 0; i < ids.length; i++) {
          var cur = mm.recs[ids[i]];
          if (cur && cur[0] === sentT[i] && !refused[ids[i]]) cur[1] = 0;
        }
        // The server kept a newer copy of these (another device wrote first):
        // merge where we can, otherwise take theirs.
        self.applyRemote(rejected || [], mm).forEach(function (k) { changed[k] = 1; });
        for (var r in refused) if (mm.recs[r] && mm.recs[r][1]) self._again = true;
        self.saveMeta(mm);
        return [];
      });
    }).then(function () {
      var m = self.meta();
      m.lastSync = self.now();
      self.saveMeta(m);
      return Object.keys(changed);
    });
  };

  SS.SyncEngine = SyncEngine;
  SS.syncSpecs = { SPECS: SPECS, MERGE: MERGE, specFor: specFor, recordsOf: recordsOf, locate: locate };
  if (typeof module !== "undefined" && module.exports) module.exports = { SyncEngine: SyncEngine, MERGE: MERGE, SPECS: SPECS, recordsOf: recordsOf, locate: locate };
})(typeof window !== "undefined" ? window : globalThis);
