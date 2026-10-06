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
   here; pdf.js (js/vendor/pdfjs/) is cached on first use like supabase.js. */
var VERSION = "ss-v16";
var KEEP = /^ss-offline/;
var SHELL = [
  "./", "index.html", "css/styles.css",
  "js/surahs.js", "js/duas.js", "js/extras.js", "js/content.js", "js/i18n.js", "js/praytimes.js", "js/core.js",
  "js/offline.js", "js/views.js", "js/features.js", "js/stories.js", "js/stories-ui.js", "js/daily.js", "js/push.js", "js/offline-ui.js", "js/qibla.js", "js/config.js", "js/sync.js", "js/account.js", "js/app.js",
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
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req, { ignoreSearch: true }).then(function (hit) {
          return hit || (req.mode === "navigate" ? caches.match("index.html") : undefined);
        });
      })
    );
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
    data: { url: m.url || "./#/home", prayed: m.prayed || null },
  };
  if (m.prayed) opts.actions = [{ action: "prayed", title: m.action || "I prayed" }];
  e.waitUntil(self.registration.showNotification(m.title || "SalaamStreet", opts));
});

/* Prayer reminders: tapping a notification focuses (or opens) the app. */
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var data = e.notification.data || {};
  // "I prayed" ticks the prayer in the tracker (the app reads the link and marks it).
  var target = (e.action === "prayed" && data.prayed) || data.url || "./#/home";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if ("focus" in list[i]) { list[i].navigate(target).catch(function () {}); return list[i].focus(); }
      }
      return self.clients.openWindow(target);
    })
  );
});
