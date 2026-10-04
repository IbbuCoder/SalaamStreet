/* SalaamStreet — service worker.
   Keeps the app shell available offline. Same-origin files are fetched
   network-first (so a new deploy is picked up immediately) and fall back to
   the cache; Google Fonts are cached after first use. API responses are
   cached by the app itself in localStorage, so they are not handled here. */
var VERSION = "ss-v4";
var SHELL = [
  "./", "index.html", "css/styles.css",
  "js/surahs.js", "js/duas.js", "js/extras.js", "js/content.js", "js/i18n.js", "js/core.js",
  "js/views.js", "js/features.js", "js/app.js",
  "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png",
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);

  if (url.origin === self.location.origin) {
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

/* Prayer reminders: tapping a notification focuses (or opens) the app. */
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var target = (e.notification.data && e.notification.data.url) || "./#/home";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if ("focus" in list[i]) { list[i].navigate(target).catch(function () {}); return list[i].focus(); }
      }
      return self.clients.openWindow(target);
    })
  );
});
