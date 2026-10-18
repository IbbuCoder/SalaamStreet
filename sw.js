/* SalaamStreet — service worker.
   Keeps the app shell available offline. Same-origin files are fetched
   network-first (so a new deploy is picked up immediately) and fall back to
   the cache; Google Fonts are cached after first use. API responses are
   cached by the app itself in localStorage, so they are not handled here.
   The account client (js/vendor/supabase.js) is cached the first time
   someone signs in, so guests never download it; Supabase API calls are
   never cached.
   Offline Qur'an (js/offline.js): downloaded audio and the Qur'an PDF live in
   caches named "ss-offline-…", which belong to the app and survive service
   worker updates. The PDF itself (files/) is fetched by the app, never cached
   here; pdf.js (js/vendor/pdfjs/) is cached on first use like supabase.js.
   3.0: on a connection that is there but barely working, a cached copy is
   served after a few seconds instead of leaving the page loading; the network
   answer still refreshes the cache when it arrives. */
var VERSION = "ss-v29";
var SLOW_MS = 4000;
var KEEP = /^ss-offline/;
var SHELL = [
  "./", "index.html", "css/styles.css",
  "js/surahs.js", "js/duas.js", "js/extras.js", "js/content.js", "js/i18n.js", "js/praytimes.js", "js/core.js",
  "js/offline.js", "js/views.js", "js/features.js", "js/stories.js", "js/stories-ui.js", "js/daily.js", "js/push.js", "js/offline-ui.js", "js/qibla.js", "js/config.js", "js/sync.js", "js/account.js", "js/modes.js", "js/msa.js", "js/shortcuts.js", "js/app.js",
  // 2.10 Modes: downloaded by the page only when a mode is opened; kept here so they work offline afterwards.
  "js/modes/travel.js", "js/modes/hajj.js", "js/modes/mosque.js", "js/modes/kids.js",
  "manifest.webmanifest", "manifest-dark.webmanifest", "icons/icon-192.png", "icons/apple-touch-icon.png", "icons/favicon-32.png",
  "icons/brand/logo-mark-128.png", "icons/brand/logo-mark-256.png",
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION && !KEEP.test(k); }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (/\/files\//.test(url.pathname)) return; // the Qur'an PDF: stored by the app only if someone downloads it
    var network = fetch(req).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        e.waitUntil(caches.open(VERSION).then(function (c) { return c.put(req, copy); }));
      }
      return res;
    });
    var cached = function () {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        return hit || (req.mode === "navigate" ? caches.match("index.html") : undefined);
      });
    };
    e.respondWith(new Promise(function (resolve) {
      var done = false;
      function settle(res) { if (!done && res) { done = true; resolve(res); } }
      // Slow network: answer from the cache if there is a copy; otherwise keep waiting.
      var timer = setTimeout(function () { cached().then(settle); }, SLOW_MS);
      network.then(function (res) { clearTimeout(timer); settle(res); }, function () {
        clearTimeout(timer);
        cached().then(function (hit) { if (hit) settle(hit); else if (!done) { done = true; resolve(Response.error()); } });
      });
    }));
    return;
  }

  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(
      caches.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) {
          if (res && (res.ok || res.type === "opaque")) {
            var copy = res.clone();
            caches.open(VERSION + "-fonts").then(function (c) { c.put(req, copy); });
          }
          return res;
        });
      })
    );
  }
});

/* Reminders sent while SalaamStreet is closed (2.8; backend/functions/send-reminders). */
self.addEventListener("push", function (e) {
  var m = {};
  try { m = e.data ? e.data.json() : {}; } catch (err) { m = { title: "SalaamStreet", body: e.data ? e.data.text() : "" }; }
  var opts = {
    body: m.body || "", tag: m.tag || "salaamstreet", icon: "icons/icon-192.png", badge: "icons/icon-192.png",
    data: { url: m.url || "./#/home", prayed: m.prayed || null }, timestamp: Date.now(), vibrate: [120, 80, 120],
  };
  // Prayer reminders: "I prayed" and a quick way to the Qibla.
  if (m.prayed) opts.actions = [{ action: "prayed", title: m.action || "I prayed" }, { action: "qibla", title: m.qibla || "Qibla" }];
  e.waitUntil(self.registration.showNotification(m.title || "SalaamStreet", opts));
});

/* Prayer reminders: tapping a notification focuses (or opens) the app. */
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var data = e.notification.data || {};
  // "I prayed" ticks the prayer in the tracker (the app reads the link and marks it).
  var target = (e.action === "prayed" && data.prayed) || (e.action === "qibla" && "./#/qibla") || data.url || "./#/home";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if ("focus" in list[i]) { list[i].navigate(target).catch(function () {}); return list[i].focus(); }
      }
      return self.clients.openWindow(target);
    })
  );
});
