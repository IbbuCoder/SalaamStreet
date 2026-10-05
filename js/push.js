/* SalaamStreet — push.js (classic script)
   2.8: prayer, Al-Kahf and adhkar reminders that arrive even when
   SalaamStreet is closed (Web Push). Opt-in, per device, no account needed.

   Turning it on subscribes this browser for push and stores, on SalaamStreet's
   Supabase project, only what the reminder server needs: the push address,
   the location rounded to ~1 km, the time zone and the reminder choices
   (backend/supabase-schema.sql → push_subscriptions). Turning it off deletes
   that row. Hidden until SS.CONFIG.pushPublicKey is set (backend/README-push.md). */
(function () {
  "use strict";
  window.SS = window.SS || {};
  var $ = function (id) { return document.getElementById(id); };
  function t(k) { return SS.i18n.t(k); }
  function cfg() { return SS.CONFIG || {}; }

  function supported() {
    return !!(cfg().pushPublicKey && cfg().supabaseUrl && cfg().supabaseAnonKey &&
      "serviceWorker" in navigator && "PushManager" in window && typeof Notification !== "undefined");
  }
  function keyBytes(b64) {
    var pad = "=".repeat((4 - (b64.length % 4)) % 4);
    var raw = window.atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function rpc(name, body) {
    return fetch(cfg().supabaseUrl.replace(/\/$/, "") + "/rest/v1/rpc/" + name, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: cfg().supabaseAnonKey, authorization: "Bearer " + cfg().supabaseAnonKey },
      body: JSON.stringify(body),
    }).then(function (r) { if (!r.ok) throw new Error("push " + name + " " + r.status); });
  }
  function zone() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch (e) { return "UTC"; } }

  /** What the server needs to know, from this device's settings. */
  function prefs(loc) {
    var s = SS.store.settings();
    var tz = SS.store.get("tz:" + loc.lat.toFixed(2) + ":" + loc.lng.toFixed(2)) || zone();
    return {
      lat: +loc.lat.toFixed(2), lng: +loc.lng.toFixed(2), tz: tz,
      method: +s.method, school: +s.school, offset: +s.reminderOffset || 0,
      prayers: !!s.reminders, kahf: s.kahfReminder !== false, adhkar: !!s.adhkarReminders,
      lang: SS.i18n.getLocale(),
    };
  }
  function subscription() {
    return navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); });
  }

  function enable() {
    return SS.reminders.ask().then(function (ok) {
      if (!ok) return false;
      return SS.geo.resolve().then(function (loc) {
        if (!loc || loc.isFallback) { SS.toast(t("push.needLocation")); return false; }
        return navigator.serviceWorker.ready.then(function (reg) {
          return reg.pushManager.getSubscription().then(function (sub) {
            return sub || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(cfg().pushPublicKey) });
          });
        }).then(function (sub) {
          return rpc("push_register", { sub: sub.toJSON(), prefs: prefs(loc) });
        }).then(function () {
          // Closed-app reminders build on prayer reminders: switch those on too.
          SS.store.saveSettings({ pushReminders: true, reminders: true });
          if ($("st-rem")) $("st-rem").checked = true;
          sync();
          return true;
        });
      });
    }).catch(function () { SS.toast(t("push.failed")); return false; });
  }
  function disable() {
    SS.store.saveSettings({ pushReminders: false });
    return subscription().then(function (sub) {
      if (!sub) return;
      var endpoint = sub.endpoint;
      return sub.unsubscribe().catch(function () {}).then(function () { return rpc("push_unregister", { endpoint: endpoint }); });
    }).catch(function () { /* offline: the server drops expired addresses by itself */ });
  }

  /** Keep the server's copy in step after settings change (debounced). */
  var syncTimer = null, lastSent = "";
  function sync() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () {
      if (!supported() || !SS.store.settings().pushReminders || Notification.permission !== "granted") return;
      Promise.all([subscription(), SS.geo.resolve()]).then(function (r) {
        var sub = r[0], loc = r[1];
        if (!sub) { SS.store.saveSettings({ pushReminders: false }); return; }
        if (!loc || loc.isFallback) return;
        var body = { sub: sub.toJSON(), prefs: prefs(loc) }, key = JSON.stringify(body);
        if (key === lastSent) return;
        return rpc("push_register", body).then(function () { lastSent = key; });
      }).catch(function () { /* try again next time */ });
    }, 800);
  }

  SS.push = {
    supported: supported,
    /** True when the server sends this device's prayer reminders (so the app doesn't repeat them). */
    active: function () { return supported() && !!SS.store.settings().pushReminders && Notification.permission === "granted"; },
    sync: sync,
  };

  /* ── Settings → Prayer reminders ── */
  function hooks() { return (SS.hooks = SS.hooks || {}); }
  var prev = hooks().settingsInit;
  hooks().settingsInit = function () {
    if (prev) prev.apply(null, arguments);
    var row = $("st-push-row");
    if (!row) return;
    row.hidden = !supported();
    $("st-push-note").hidden = !supported();
    if (!supported()) return;
    var box = $("st-push");
    box.checked = SS.push.active();
    box.onchange = function () {
      box.disabled = true;
      (box.checked ? enable() : disable().then(function () { return false; })).then(function (on) {
        box.checked = !!on;
        box.disabled = false;
        if (on) SS.toast(t("push.on"));
        if (SS.reminders) SS.reminders.schedule();
      });
    };
  };
  // Settings and location changes reach the server.
  var save = SS.store.saveSettings;
  SS.store.saveSettings = function (patch) {
    var r = save.apply(SS.store, arguments);
    if (patch && !("pushReminders" in patch)) sync();
    return r;
  };
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") sync(); });
})();
