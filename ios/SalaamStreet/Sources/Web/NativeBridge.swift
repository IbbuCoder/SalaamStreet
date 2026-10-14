import UIKit
import UserNotifications
import WebKit

/// Every message the website may send to iOS. Anything else is rejected.
enum BridgeAction: String, CaseIterable {
    case ready, log, haptic, idleTimer, badge, theme, prayedApplied
    case notifyStatus = "notify.status", notifyRequest = "notify.request"
    case notifyShow = "notify.show", notifySchedule = "notify.schedule"
    case geoStatus = "geo.status", geoGet = "geo.get"
    case audioPlay = "audio.play", audioPause = "audio.pause", audioResume = "audio.resume"
    case audioStop = "audio.stop", audioSeek = "audio.seek", audioRate = "audio.rate"
    case audioFile = "audio.file", audioHasFile = "audio.hasFile", audioSleep = "audio.sleep", audioMeta = "audio.meta"
    case snapshot
    case activityStart = "activity.start", activityStop = "activity.stop", activityStatus = "activity.status"
    case spotlight
    case openExternal = "open.external"
}

enum BridgeError: Error, CustomStringConvertible {
    case notAllowed, malformed, unknownAction(String), invalid(String), failed(String)
    var description: String {
        switch self {
        case .notAllowed: return "not-allowed"
        case .malformed: return "malformed"
        case .unknownAction(let a): return "unknown-action: \(a)"
        case .invalid(let f): return "invalid: \(f)"
        case .failed(let m): return m
        }
    }
}

/// Typed, bounded access to a message's payload.
struct Payload {
    let raw: [String: Any]
    func string(_ k: String, max: Int = 2000) throws -> String {
        guard let v = raw[k] as? String, v.count <= max else { throw BridgeError.invalid(k) }
        return v
    }
    func optString(_ k: String, max: Int = 2000) -> String? {
        guard let v = raw[k] as? String, v.count <= max else { return nil }
        return v
    }
    func number(_ k: String, in range: ClosedRange<Double>) throws -> Double {
        guard let v = raw[k] as? NSNumber, CFGetTypeID(v) != CFBooleanGetTypeID() else { throw BridgeError.invalid(k) }
        let d = v.doubleValue
        guard d.isFinite, range.contains(d) else { throw BridgeError.invalid(k) }
        return d
    }
    func optNumber(_ k: String, in range: ClosedRange<Double>) -> Double? { try? number(k, in: range) }
    func bool(_ k: String) -> Bool { (raw[k] as? Bool) ?? ((raw[k] as? NSNumber)?.boolValue ?? false) }
    func dict(_ k: String) -> [String: Any]? { raw[k] as? [String: Any] }
    func array(_ k: String, max: Int) throws -> [Any] {
        guard let v = raw[k] as? [Any], v.count <= max else { throw BridgeError.invalid(k) }
        return v
    }
}

/// Connects the website (bridge.js) to native iOS features through
/// WKScriptMessageHandlerWithReply. Only the bundled site, in the main frame,
/// may call it. The site keeps working without it: bridge.js only changes
/// browser APIs when this handler exists.
@MainActor
final class NativeBridge: NSObject, WKScriptMessageHandlerWithReply {
    static let handlerName = "ssNative"
    static let authRedirect = "salaamstreet://auth-callback"

    weak var webView: WKWebView?
    weak var host: WebViewController?
    private(set) var isReady = false
    /// JavaScript errors reported by the page (the tests require none).
    private(set) var jsErrors: [String] = []
    private var installed = false
    private var darwinObserver = false

    // MARK: Install

    func install(in controller: WKUserContentController, notificationStatus: String = "default") {
        guard !installed else { return }
        installed = true
        let config: [String: Any] = [
            "version": AppInfo.version,
            "build": AppInfo.build,
            "authRedirect": Self.authRedirect,
            "notif": notificationStatus,
            "geo": LocationService.shared.statusString,
            "uiTest": ProcessInfo.processInfo.arguments.contains("-SSUITest"),
        ]
        let json = (try? JSONSerialization.data(withJSONObject: config)).flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
        let source = "window.__SSNativeConfig = \(json);\n" + Self.bridgeSource
        controller.addUserScript(WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true, in: .page))
        controller.addScriptMessageHandler(self, contentWorld: .page, name: Self.handlerName)
        observeWidgetTicks()
    }

    static var bridgeSource: String {
        guard let url = Bundle.main.url(forResource: "bridge", withExtension: "js"),
              let s = try? String(contentsOf: url, encoding: .utf8) else { return "" }
        return s
    }

    // MARK: Native → website

    func emit(_ name: String, _ data: [String: Any] = [:]) {
        webView?.callAsyncJavaScript("if (window.SSNative && window.SSNative._emit) window.SSNative._emit(name, data);",
                                     arguments: ["name": name, "data": data], in: nil, in: .page, completionHandler: nil)
    }

    /// Ticks made by a notification button, a widget or Siri while the app runs.
    func deliverPendingPrayed() {
        let list = SharedStore.pendingPrayed()
        guard isReady, !list.isEmpty else { return }
        emit("prayed", ["items": list.map { ["key": $0.key, "date": $0.date] }])
    }

    private func observeWidgetTicks() {
        guard !darwinObserver else { return }
        darwinObserver = true
        let center = CFNotificationCenterGetDarwinNotifyCenter()
        CFNotificationCenterAddObserver(center, Unmanaged.passUnretained(self).toOpaque(), { _, observer, _, _, _ in
            guard let observer else { return }
            let bridge = Unmanaged<NativeBridge>.fromOpaque(observer).takeUnretainedValue()
            DispatchQueue.main.async { bridge.deliverPendingPrayed() }
        }, SharedStore.prayedDarwinName as CFString, nil, .deliverImmediately)
    }

    // MARK: Website → native

    nonisolated func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
        MainActor.assumeIsolated {
            let origin = message.frameInfo.securityOrigin
            guard message.frameInfo.isMainFrame, origin.protocol == AppSchemeHandler.scheme, origin.host == AppSchemeHandler.host else {
                return replyHandler(nil, BridgeError.notAllowed.description)
            }
            guard let body = message.body as? [String: Any], let name = body["action"] as? String else {
                return replyHandler(nil, BridgeError.malformed.description)
            }
            guard let action = BridgeAction(rawValue: name) else {
                return replyHandler(nil, BridgeError.unknownAction(String(name.prefix(40))).description)
            }
            let payload = Payload(raw: body["payload"] as? [String: Any] ?? [:])
            Task { @MainActor in
                do {
                    let result = try await self.handle(action, payload)
                    replyHandler(result ?? NSNull(), nil)
                } catch {
                    replyHandler(nil, (error as? BridgeError)?.description ?? error.localizedDescription)
                }
            }
        }
    }

    func handle(_ action: BridgeAction, _ p: Payload) async throws -> Any? {
        switch action {
        case .ready:
            isReady = true
            DispatchQueue.main.async {
                self.deliverPendingPrayed()
                AppRouter.shared.pageReady()
            }
            return ["pendingPrayed": SharedStore.pendingPrayed().map { ["key": $0.key, "date": $0.date] }]

        case .prayedApplied:
            let items = try p.array("items", max: 100).compactMap { $0 as? [String: Any] }
            SharedStore.clearPending(items.compactMap {
                guard let k = $0["key"] as? String, let d = $0["date"] as? String else { return nil }
                return PendingPrayed(key: k, date: d)
            })
            return nil

        case .log:
            let level = p.optString("level", max: 10) ?? "error"
            let msg = String((p.optString("message", max: 4000) ?? "").prefix(1000))
            if level == "error" { jsErrors.append(msg) }
            NSLog("[web %@] %@", level, msg)
            return nil

        case .haptic:
            if let one = p.optNumber("pattern", in: 0...5000) {
                Haptics.play([one])
            } else {
                let list = try p.array("pattern", max: 20).compactMap { ($0 as? NSNumber)?.doubleValue }
                Haptics.play(list.map { min(max($0, 0), 5000) })
            }
            return nil

        case .idleTimer:
            UIApplication.shared.isIdleTimerDisabled = p.bool("on")
            return nil

        case .badge:
            let n = Int(try p.number("count", in: 0...99))
            try? await UNUserNotificationCenter.current().setBadgeCount(n)
            return nil

        case .theme:
            let pref = p.optString("pref", max: 10) ?? "system"
            AppTheme.apply(pref: pref, window: host?.view.window)
            return nil

        case .notifyStatus:
            return await Notifications.shared.status()
        case .notifyRequest:
            return await Notifications.shared.request()
        case .notifyShow:
            try await Notifications.shared.show(p)
            return nil
        case .notifySchedule:
            return try await Notifications.shared.schedule(p)

        case .geoStatus:
            return LocationService.shared.statusString
        case .geoGet:
            let fix = try await LocationService.shared.current(highAccuracy: p.bool("high"))
            return ["lat": fix.coordinate.latitude, "lng": fix.coordinate.longitude, "accuracy": fix.horizontalAccuracy,
                    "altitude": fix.altitude, "timestamp": fix.timestamp.timeIntervalSince1970 * 1000]

        case .audioPlay:
            return try AudioPlayer.shared.play(p)
        case .audioPause:
            AudioPlayer.shared.pause(); return nil
        case .audioResume:
            AudioPlayer.shared.resume(); return nil
        case .audioStop:
            AudioPlayer.shared.stop(); return nil
        case .audioSeek:
            AudioPlayer.shared.seek(to: try p.number("time", in: 0...36000)); return nil
        case .audioRate:
            AudioPlayer.shared.setRate(Float(try p.number("rate", in: 0.25...4))); return nil
        case .audioFile:
            try AudioPlayer.shared.storeFile(key: try p.string("fileKey", max: 120), base64: try p.string("data", max: 12_000_000))
            return nil
        case .audioHasFile:
            return AudioPlayer.shared.hasFile(key: try p.string("fileKey", max: 120))
        case .audioSleep:
            AudioPlayer.shared.sleep(minutes: try p.number("minutes", in: 0...600)); return nil
        case .audioMeta:
            AudioPlayer.shared.setMetadata(title: p.optString("title", max: 300), artist: p.optString("artist", max: 300))
            return nil

        case .snapshot:
            guard let data = try? JSONSerialization.data(withJSONObject: p.raw),
                  let snap = try? JSONDecoder().decode(PrayerSnapshot.self, from: data) else { throw BridgeError.invalid("snapshot") }
            SharedStore.save(snap)
            SharedStore.reloadWidgets()
            QuickActions.update(labels: snap.labels)
            await PrayerActivityController.shared.refresh(from: snap)
            BackgroundRefresh.schedule()
            return nil

        case .activityStart:
            guard let snap = SharedStore.loadSnapshot() else { throw BridgeError.failed("no-prayer-times") }
            return try await PrayerActivityController.shared.start(from: snap)
        case .activityStop:
            await PrayerActivityController.shared.stopAll(); return nil
        case .activityStatus:
            return PrayerActivityController.shared.status

        case .spotlight:
            Spotlight.index(p)
            return nil

        case .openExternal:
            guard let url = URL(string: try p.string("url")), url.scheme == "https" else { throw BridgeError.invalid("url") }
            host?.openInSafari(url)
            return nil
        }
    }
}

/// Follows the website's theme choice so the status bar, keyboard and system
/// sheets match the page (light, dark, or the phone's setting).
enum AppTheme {
    static let key = "SSThemePref"
    static func apply(pref: String, window: UIWindow?) {
        UserDefaults.standard.set(pref, forKey: key)
        let style: UIUserInterfaceStyle = pref == "light" ? .light : pref == "dark" ? .dark : .unspecified
        let windows = window.map { [$0] } ?? UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.windows }.flatMap { $0 }
        windows.forEach { $0.overrideUserInterfaceStyle = style }
    }
    static func restore(on window: UIWindow) {
        apply(pref: UserDefaults.standard.string(forKey: key) ?? "system", window: window)
    }
}

/// navigator.vibrate() patterns as Taptic Engine taps: each "on" duration
/// becomes one tap, stronger for longer durations (dhikr 10 ms → light tick,
/// Qibla lock-on 30 ms → firm tap, [20, 30, 20] → a double tap).
enum Haptics {
    @MainActor static func play(_ pattern: [Double]) {
        var delay = 0.0
        for (i, ms) in pattern.enumerated() {
            if i % 2 == 0, ms > 0 {
                let intensity = CGFloat(min(1, max(0.35, ms / 40)))
                let style: UIImpactFeedbackGenerator.FeedbackStyle = ms <= 12 ? .light : ms <= 25 ? .medium : .heavy
                DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                    let g = UIImpactFeedbackGenerator(style: style)
                    g.impactOccurred(intensity: intensity)
                }
            }
            delay += ms / 1000
        }
    }
}
