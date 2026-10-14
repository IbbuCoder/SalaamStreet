import WebKit
import XCTest
@testable import SalaamStreet

/// Runs inside the app on the simulator: the real bundled website in the real
/// WKWebView, with the real bridge.
@MainActor
final class WebAppTests: AppTestCase {

    // MARK: Bundle

    func testBundleHasWebsiteAndBridge() throws {
        let root = AppSchemeHandler.bundleRoot
        XCTAssertTrue(FileManager.default.fileExists(atPath: root.appendingPathComponent("index.html").path))
        XCTAssertTrue(FileManager.default.fileExists(atPath: root.appendingPathComponent("files/quran-english-sher-ali.pdf").path), "the Qur'an PDF ships in the app")
        let html = try String(contentsOf: root.appendingPathComponent("index.html"), encoding: .utf8)
        XCTAssertTrue(html.contains("fonts/fonts.css"))
        XCTAssertFalse(html.contains("fonts.googleapis.com/css2"), "fonts must be bundled")
        XCTAssertFalse(NativeBridge.bridgeSource.isEmpty, "bridge.js is in the app bundle")
        XCTAssertEqual(SurahCatalog.all.count, 114)
        XCTAssertEqual(SurahCatalog.all[17].en, "Al-Kahf")
        XCTAssertEqual(AppInfo.version, "3.0.0")
        XCTAssertEqual(AppInfo.build, "1")
    }

    func testSchemeHandlerServesOnlyTheBundle() {
        let h = AppSchemeHandler()
        XCTAssertNotNil(h.fileURL(for: URL(string: "app://salaamstreet/index.html")!))
        XCTAssertNotNil(h.fileURL(for: URL(string: "app://salaamstreet/")!))
        XCTAssertNotNil(h.fileURL(for: URL(string: "app://salaamstreet/js/vendor/pdfjs/pdf.min.mjs")!))
        XCTAssertNil(h.fileURL(for: URL(string: "app://salaamstreet/../Info.plist")!))
        XCTAssertNil(h.fileURL(for: URL(string: "app://salaamstreet/%2e%2e/Info.plist")!))
        XCTAssertNil(h.fileURL(for: URL(string: "app://other/index.html")!))
        XCTAssertNil(h.fileURL(for: URL(string: "app://salaamstreet/terms/")!))
        XCTAssertEqual(AppSchemeHandler.mimeType(for: URL(fileURLWithPath: "a.mjs")), "text/javascript")
        XCTAssertEqual(AppSchemeHandler.mimeType(for: URL(fileURLWithPath: "a.woff2")), "font/woff2")
        XCTAssertEqual(AppSchemeHandler.parseRange("bytes=0-99", length: 1000), 0..<100)
        XCTAssertEqual(AppSchemeHandler.parseRange("bytes=900-", length: 1000), 900..<1000)
        XCTAssertEqual(AppSchemeHandler.parseRange("bytes=-100", length: 1000), 900..<1000)
        XCTAssertNil(AppSchemeHandler.parseRange("bytes=2000-", length: 1000))
    }

    func testBridgeRejectsUnknownAndInvalidMessages() async {
        XCTAssertNil(BridgeAction(rawValue: "eval"))
        XCTAssertNil(BridgeAction(rawValue: "fs.read"))
        let bridge = NativeBridge()
        do {
            _ = try await bridge.handle(.badge, Payload(raw: ["count": "lots"]))
            XCTFail("a string badge count must be rejected")
        } catch {}
        do {
            _ = try await bridge.handle(.openExternal, Payload(raw: ["url": "javascript:alert(1)"]))
            XCTFail("only https links may open")
        } catch {}
        XCTAssertFalse(AudioPlayer.isSafeKey("../x"))
        XCTAssertTrue(AudioPlayer.isSafeKey("ar.alafasy-18-1"))
    }

    // MARK: The website in the app

    func testWebsiteStartsWithoutErrors() async throws {
        let vc = try app
        try await waitUntil(40, "website ready") { vc.bridge.isReady }
        _ = try await js(vc.webView, "if (location.hash !== '#/home') location.hash = '#/home'; return 1;")
        try await Task.sleep(nanoseconds: 3_000_000_000)
        let env = try await js(vc.webView, """
            await document.fonts.ready;
            const fonts = {};
            for (const f of ["Figtree", "IBM Plex Sans Arabic", "Scheherazade New", "Amiri"]) {
              fonts[f] = (await document.fonts.load("16px '" + f + "'", "aب")).length > 0;
            }
            return {
              origin: location.origin, secure: window.isSecureContext, idb: !!window.indexedDB, caches: !!window.caches,
              subtle: !!(window.crypto && crypto.subtle), sw: "serviceWorker" in navigator, push: "PushManager" in window && !!window.PushManager,
              native: !!window.SSNative, version: SS.VERSION, view: SS.currentView(), notification: typeof Notification,
              mediaDevices: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia), share: !!navigator.share,
              orientation: typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission,
              fonts: fonts, title: document.title
            };
            """) as? [String: Any]
        print("WEBAPP-ENV", env ?? [:])
        XCTAssertEqual(env?["native"] as? Bool, true)
        XCTAssertEqual(env?["view"] as? String, "home")
        XCTAssertEqual(env?["origin"] as? String, "app://salaamstreet")
        for (name, ok) in env?["fonts"] as? [String: Bool] ?? [:] { XCTAssertTrue(ok, "font \(name) loads from the bundle") }
        print("WEBAPP-JS-ERRORS", vc.bridge.jsErrors)
        print("WEBAPP-MISSING", vc.schemeHandler.missing)
        XCTAssertEqual(vc.bridge.jsErrors, [], "no uncaught JavaScript errors")
        XCTAssertEqual(vc.schemeHandler.missing.filter { !$0.hasSuffix("favicon.ico") }, [], "no missing bundled files")
    }

    /// Every online service the website uses, fetched from the app's page (origin app://salaamstreet).
    func testOnlineServicesAnswerTheApp() async throws {
        let vc = try await readyApp()
        let r = try await js(vc.webView, """
            const urls = {
              alquran: "https://api.alquran.cloud/v1/ayah/1/ar.alafasy",
              aladhan: "https://api.aladhan.com/v1/timings/14-10-2026?latitude=21.42&longitude=39.83&method=4",
              audio: "https://cdn.islamic.network/quran/audio/64/ar.alafasy/1.mp3",
              jsdelivr: "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/info.min.json",
              github: "https://raw.githubusercontent.com/spa5k/tafsir_api/main/tafsir/en-tafisr-ibn-kathir/1/1.json",
              overpass: "https://overpass-api.de/api/status",
              supabase: SS.CONFIG.supabaseUrl + "/auth/v1/settings",
            };
            const out = {};
            await Promise.all(Object.keys(urls).map(async (k) => {
              try {
                const res = await fetch(urls[k], k === "supabase" ? { headers: { apikey: SS.CONFIG.supabaseAnonKey } } : {});
                out[k] = res.status + " " + (res.headers.get("access-control-allow-origin") || "");
              } catch (e) { out[k] = "ERR " + e.message; }
            }));
            return out;
            """) as? [String: String]
        print("WEBAPP-NET", r ?? [:])
        // audio goes through iOS (NetProxy), the rest straight from the page.
        for (k, v) in r ?? [:] where k != "overpass" { XCTAssertFalse(v.hasPrefix("ERR"), "\(k): \(v)") }
    }

    func testStorageWorks() async throws {
        let vc = try app
        try await waitUntil(40, "website ready") { vc.bridge.isReady }
        let r = try await js(vc.webView, """
            const out = {};
            localStorage.setItem("ss-test", "1"); out.local = localStorage.getItem("ss-test") === "1";
            out.idb = await new Promise((ok) => {
              const req = indexedDB.open("ss-test", 1);
              req.onupgradeneeded = () => req.result.createObjectStore("s");
              req.onerror = () => ok(false);
              req.onsuccess = () => {
                const tx = req.result.transaction("s", "readwrite");
                tx.objectStore("s").put("v", "k");
                tx.oncomplete = () => ok(true); tx.onerror = () => ok(false);
              };
            });
            try {
              const c = await caches.open("ss-test");
              await c.put("https://example.com/x", new Response("hello"));
              out.cache = (await (await c.match("https://example.com/x")).text()) === "hello";
              await caches.delete("ss-test");
            } catch (e) { out.cache = String(e); }
            return out;
            """) as? [String: Any]
        print("WEBAPP-STORAGE", r ?? [:])
        XCTAssertEqual(r?["local"] as? Bool, true)
        XCTAssertEqual(r?["idb"] as? Bool, true, "IndexedDB (Offline page text, tafsir, hadith)")
        XCTAssertEqual(r?["cache"] as? Bool, true, "Cache API (Offline page recitation and PDF)")
    }

    func testPrayerDataReachesWidgets() async throws {
        let vc = try app
        try await waitUntil(40, "website ready") { vc.bridge.isReady }
        try await waitUntil(40, "snapshot") { (SharedStore.loadSnapshot()?.updatedAt ?? 0) > 0 }
        let snap = try XCTUnwrap(SharedStore.loadSnapshot())
        print("WEBAPP-SNAPSHOT", snap.location, snap.days.count, snap.days.first ?? "none", snap.names)
        XCTAssertGreaterThanOrEqual(snap.days.count, 5)
        XCTAssertNotNil(TimeZone(identifier: snap.location.tz))
        XCTAssertNotNil(snap.next(), "a next prayer is known")
        XCTAssertEqual(snap.names["Asr"]?.isEmpty, false)
    }

    func testLocationTimeZoneIsUsedForTimes() {
        // 13:00 in Makkah is 10:00 UTC, whatever the phone's own zone.
        let snap = PrayerSnapshot(timeFormat: "24", location: .init(label: "Makkah", lat: 21.42, lng: 39.83, tz: "Asia/Riyadh"),
                                  days: [.init(date: "2026-03-20", hijri: nil, timings: ["Fajr": "05:00", "Dhuhr": "13:00"])])
        let dhuhr = snap.times().first { $0.key == .dhuhr }!
        XCTAssertEqual(dhuhr.date, ISO8601DateFormatter().date(from: "2026-03-20T10:00:00Z"))
        XCTAssertTrue(snap.format(dhuhr.date).contains("13"), snap.format(dhuhr.date))
    }

    /// The bundled site with every http(s) request blocked, as with no connection.
    func testWorksOffline() async throws {
        let vc = WebViewController()
        vc.blockNetwork = true
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = vc
        window.isHidden = false
        defer { window.isHidden = true }
        try await waitUntil(40, "offline website ready") { vc.bridge.isReady }
        for hash in ["#/prayer", "#/duas", "#/dhikr", "#/qibla", "#/offline", "#/names", "#/quran"] {
            _ = try await js(vc.webView, "location.hash = '\(hash)';")
            try await Task.sleep(nanoseconds: 1_500_000_000)
            let r = try await js(vc.webView, """
                const v = document.getElementById("view-" + SS.currentView());
                return { view: SS.currentView(), text: v ? v.innerText.length : 0, error: !!(v && v.querySelector(".state-error, .state.error")) };
                """) as? [String: Any]
            print("WEBAPP-OFFLINE", hash, r ?? [:])
            XCTAssertGreaterThan(r?["text"] as? Int ?? 0, 40, "\(hash) shows content offline")
        }
        let times = try await js(vc.webView, "location.hash = '#/prayer'; await new Promise(r => setTimeout(r, 1500)); return document.getElementById('view-prayer').innerText;") as? String
        XCTAssertTrue(times?.contains(":") == true, "prayer times are calculated on the device offline")
        print("WEBAPP-OFFLINE-ERRORS", vc.bridge.jsErrors)
        XCTAssertEqual(vc.bridge.jsErrors, [])
    }
}
