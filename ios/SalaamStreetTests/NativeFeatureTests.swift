import ActivityKit
import CoreLocation
import MediaPlayer
import UserNotifications
import XCTest
@testable import SalaamStreet

/// The native iPhone features, driven through the real website in the app.
/// The CI workflow grants location (London) before these run, and tries to
/// grant notifications; a test that needs a permission iOS didn't give is
/// skipped and says so.
@MainActor
final class NativeFeatureTests: AppTestCase {

    func testLocationComesFromCoreLocation() async throws {
        guard LocationService.shared.statusString == "granted" else { throw XCTSkip("location permission not granted on this simulator") }
        let vc = try await readyApp()
        let r = try await js(vc.webView, """
            return await new Promise((ok, ko) => navigator.geolocation.getCurrentPosition(
              p => ok({ lat: p.coords.latitude, lng: p.coords.longitude }), e => ko("code " + e.code), { timeout: 15000 }));
            """) as? [String: Double]
        print("NATIVE-GEO", r ?? [:])
        XCTAssertEqual(r?["lat"] ?? 0, 51.5, accuracy: 0.2, "the simulator's location (London)")
        let perm = try await js(vc.webView, "return (await navigator.permissions.query({ name: 'geolocation' })).state;") as? String
        XCTAssertEqual(perm, "granted")
    }

    func testWakeLockKeepsTheScreenOn() async throws {
        let vc = try await readyApp()
        // Home: the website itself only keeps the screen on while reading, in adhkar and dhikr.
        _ = try await js(vc.webView, "location.hash = '#/home'; await new Promise(r => setTimeout(r, 800)); return 1;")
        try await waitUntil(5, "screen may sleep on Home") { !UIApplication.shared.isIdleTimerDisabled }
        _ = try await js(vc.webView, "window.__lock = await navigator.wakeLock.request('screen'); return 1;")
        try await waitUntil(5, "idle timer off") { UIApplication.shared.isIdleTimerDisabled }
        _ = try await js(vc.webView, "await window.__lock.release(); return 1;")
        try await waitUntil(5, "idle timer back on") { !UIApplication.shared.isIdleTimerDisabled }
    }

    func testThemeFollowsTheWebsite() async throws {
        let vc = try await readyApp()
        _ = try await js(vc.webView, "location.hash = '#/home'; SS.store.saveSettings({ theme: 'dark' }); SS.applyTheme(); return 1;")
        try await waitUntil(5, "dark window") { vc.view.window?.overrideUserInterfaceStyle == .dark }
        _ = try await js(vc.webView, "SS.store.saveSettings({ theme: 'system' }); SS.applyTheme(); return 1;")
        try await waitUntil(5, "system window") { vc.view.window?.overrideUserInterfaceStyle == .unspecified }
    }

    /// Recitation goes through AVPlayer, shows on the Lock Screen, and moves on
    /// to the next ayah by itself (as it must with the phone locked).
    func testRecitationPlaysNativelyAndMovesOn() async throws {
        let vc = try await readyApp()
        _ = try await js(vc.webView, "location.hash = '#/surah/112'; await new Promise(r => setTimeout(r, 800)); SS.audio.start(112, 1, SS.SURAHS[111]); return 1;")
        let player = AudioPlayer.shared
        try await waitUntil(30, "native player is playing 112:1") {
            (player.debugState["key"] as? String) == "ar.alafasy:112:1" && (player.debugState["time"] as? Double ?? 0) > 0.3
        }
        XCTAssertEqual(player.debugState["upcoming"] as? Int, 3, "Al-Ikhlas has three more ayahs")
        let info = MPNowPlayingInfoCenterWrapper.title
        print("NATIVE-AUDIO", player.debugState, info ?? "")
        XCTAssertTrue(info?.contains("112:1") == true, "Lock Screen title")
        let firstSeq = player.debugState["seq"] as? Int ?? 0
        // The ayah ends; the player moves on without being told, and the page follows it.
        try await waitUntil(40, "moved on to 112:2") { (player.debugState["key"] as? String) == "ar.alafasy:112:2" }
        try await Task.sleep(nanoseconds: 1_500_000_000)
        XCTAssertGreaterThan(player.debugState["seq"] as? Int ?? 0, firstSeq)
        // The page follows the player (short ayahs may already be further on).
        player.pause()
        try await Task.sleep(nanoseconds: 800_000_000)
        let page = try await js(vc.webView, "const p = SS.audio.plan(); return { ayah: p.current.ayah };") as? [String: Any]
        let nativeKey = player.debugState["key"] as? String ?? ""
        print("NATIVE-AUDIO-PAGE", page ?? [:], nativeKey)
        let pageAyah = page?["ayah"] as? Int ?? 0
        XCTAssertGreaterThanOrEqual(pageAyah, 2, "the website moved on with the player")
        XCTAssertEqual(nativeKey, "ar.alafasy:112:\(pageAyah)", "the page and the player are on the same ayah (adopted, not restarted)")
        player.stop()
    }

    /// Recitation downloaded on the Offline page plays from the device, through the native player.
    func testDownloadedRecitationPlaysFromTheDevice() async throws {
        let vc = try await readyApp()
        _ = try await js(vc.webView, "SS.offline.downloadAudio('ar.alafasy', [112]); return 1;")
        let end = Date().addingTimeInterval(90)
        var have = false
        while !have && Date() < end {
            have = (try await js(vc.webView, "return SS.offline.hasAudio('ar.alafasy', 112);") as? Bool) ?? false
            if !have { try await Task.sleep(nanoseconds: 1_000_000_000) }
        }
        XCTAssertTrue(have, "the Offline page downloaded Al-Ikhlas into the website's Cache storage")
        _ = try await js(vc.webView, "SS.audio.start(112, 1, SS.SURAHS[111]); return 1;")
        let player = AudioPlayer.shared
        try await waitUntil(30, "playing from a local file") {
            (player.debugState["key"] as? String) == "ar.alafasy:112:1" && (player.debugState["localFile"] as? Bool) == true
        }
        try await waitUntil(30, "the next ayahs copied ahead") { player.hasFile(key: "ar.alafasy-112-4") }
        print("NATIVE-OFFLINE-AUDIO", player.debugState)
        player.stop()
    }

    /// "I prayed" from a notification button or widget reaches the website's tracker.
    func testPrayedFromOutsideReachesTheTracker() async throws {
        let vc = try await readyApp()
        let today = try await js(vc.webView, "return SS.localDate();") as? String ?? ""
        _ = try await js(vc.webView, "if (SS.tracker.isDone('\(today)', 'Maghrib')) SS.tracker.toggle('\(today)', 'Maghrib'); return 1;")
        SharedStore.addPrayed(key: .maghrib, date: today)
        vc.bridge.deliverPendingPrayed()
        var done = false
        let end = Date().addingTimeInterval(10)
        while !done && Date() < end {
            done = (try await js(vc.webView, "return SS.tracker.isDone('\(today)', 'Maghrib');") as? Bool) ?? false
            if !done { try await Task.sleep(nanoseconds: 300_000_000) }
        }
        XCTAssertTrue(done)
        try await waitUntil(5, "pending list cleared") { SharedStore.pendingPrayed().isEmpty }
    }

    /// The countdown shows clock times in the location's zone, not the phone's.
    func testLiveActivityUsesTheLocationsClock() async throws {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { throw XCTSkip("Live Activities are off on this simulator") }
        let now = Date()
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "Pacific/Auckland")!
        let c = cal.dateComponents([.year, .month, .day], from: now.addingTimeInterval(86400))
        let day = String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
        let snap = PrayerSnapshot(timeFormat: "24", location: .init(label: "Auckland", lat: -36.85, lng: 174.76, tz: "Pacific/Auckland"),
                                  days: [.init(date: day, hijri: nil, timings: ["Fajr": "05:10", "Dhuhr": "13:05", "Asr": "16:40", "Maghrib": "19:30", "Isha": "20:50"])])
        try await PrayerActivityController.shared.start(from: snap)
        try await waitUntil(10, "activity running") { PrayerActivityController.shared.isRunning }
        let state = try XCTUnwrap(Activity<PrayerActivityAttributes>.activities.first?.content.state)
        print("NATIVE-LIVE-ACTIVITY", state, TimeZone.current.identifier)
        XCTAssertEqual(state.timeText, "05:10", "Auckland's clock")
        XCTAssertEqual(Activity<PrayerActivityAttributes>.activities.first?.attributes.city, "Auckland")
        await PrayerActivityController.shared.stopAll()
        try await waitUntil(10, "activity ended") { !PrayerActivityController.shared.isRunning }
    }

    /// With notifications allowed, the website's reminders are planned a week ahead, each with "I prayed".
    func testRemindersArePlannedForTheWeek() async throws {
        guard await Notifications.shared.status() == "granted" else { throw XCTSkip("notification permission not granted on this simulator") }
        let vc = try await readyApp()
        _ = try await js(vc.webView, "SS.store.saveSettings({ reminders: true, kahfReminder: true, reminderOffset: 0 }); return 1;")
        var pending: [UNNotificationRequest] = []
        let end = Date().addingTimeInterval(20)
        while Date() < end {
            pending = await UNUserNotificationCenter.current().pendingNotificationRequests().filter { $0.identifier.hasPrefix("ss.prayer-") }
            if pending.count >= 25 { break }
            try await Task.sleep(nanoseconds: 500_000_000)
        }
        print("NATIVE-REMINDERS", pending.count, pending.prefix(3).map(\.identifier))
        XCTAssertGreaterThanOrEqual(pending.count, 25, "about a week of prayer reminders")
        XCTAssertEqual(pending.first?.content.categoryIdentifier, Notifications.prayerCategory, "with the I prayed button")
        let kahf = await UNUserNotificationCenter.current().pendingNotificationRequests().filter { $0.identifier.hasPrefix("ss.kahf-") }
        XCTAssertEqual(kahf.count, 1, "the Friday Al-Kahf reminder")
        // Each reminder fires at the prayer time in the location's zone.
        let snap = try XCTUnwrap(SharedStore.loadSnapshot())
        if let r = pending.first(where: { $0.identifier.hasSuffix("-Asr") }), let trigger = r.trigger as? UNCalendarNotificationTrigger,
           let fire = trigger.nextTriggerDate(), let day = r.identifier.split(separator: "-").dropFirst().prefix(3).joined(separator: "-") as String?,
           let asr = snap.days.first(where: { $0.date == day })?.timings["Asr"], let want = snap.instant(day: day, hhmm: asr) {
            XCTAssertEqual(fire.timeIntervalSince1970, want.timeIntervalSince1970, accuracy: 1)
        }
        _ = try await js(vc.webView, "SS.store.saveSettings({ reminders: false }); return 1;")
    }

    func testSpotlightAndQuickActions() async throws {
        _ = try await readyApp()
        try await waitUntil(30, "quick actions in the website's language") { (UIApplication.shared.shortcutItems ?? []).count == 4 }
        try await waitUntil(30, "Spotlight asked") { Spotlight.lastResult != nil || UserDefaults.standard.string(forKey: "spotlight.version") != nil }
        let end = Date().addingTimeInterval(20)
        while Spotlight.lastResult == "requested" && Date() < end { try await Task.sleep(nanoseconds: 500_000_000) }
        print("NATIVE-SPOTLIGHT", Spotlight.lastResult ?? "indexed earlier")
        if let r = Spotlight.lastResult, r == "requested" || r.hasPrefix("error") {
            throw XCTSkip("Spotlight didn't confirm indexing on this simulator (\(r)); the surahs and duas were handed to it")
        }
    }
}

enum MPNowPlayingInfoCenterWrapper {
    static var title: String? { MPNowPlayingInfoCenter.default().nowPlayingInfo?[MPMediaItemPropertyTitle] as? String }
}
