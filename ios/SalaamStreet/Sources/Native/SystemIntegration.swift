import BackgroundTasks
import CoreSpotlight
import UIKit
import UniformTypeIdentifiers

/// Surahs and duas in Spotlight. bridge.js sends the list (in the website's
/// language); tapping a result opens that page of the site.
enum Spotlight {
    private static let versionKey = "spotlight.version"
    /// "indexed N" or the error from the last attempt (for the tests).
    @MainActor static var lastResult: String?

    @MainActor static func index(_ p: Payload) {
        guard let version = p.optString("version", max: 100),
              UserDefaults.standard.string(forKey: versionKey) != version,
              let raw = try? p.array("items", max: 2000) else { return }
        let items: [CSSearchableItem] = raw.compactMap { $0 as? [String: Any] }.compactMap { d in
            guard let hash = d["hash"] as? String, hash.hasPrefix("#/"), hash.count < 120,
                  let title = d["title"] as? String else { return nil }
            let attrs = CSSearchableItemAttributeSet(contentType: .text)
            attrs.title = String(title.prefix(200))
            attrs.contentDescription = (d["subtitle"] as? String).map { String($0.prefix(400)) }
            attrs.keywords = (d["keywords"] as? [String])?.prefix(20).map { String($0.prefix(60)) }
            attrs.displayName = attrs.title
            return CSSearchableItem(uniqueIdentifier: hash, domainIdentifier: (d["domain"] as? String) ?? "page", attributeSet: attrs)
        }
        let index = CSSearchableIndex.default()
        index.deleteAllSearchableItems { _ in
            index.indexSearchableItems(items) { error in
                DispatchQueue.main.async {
                    lastResult = error.map { "error: \($0.localizedDescription)" } ?? "indexed \(items.count)"
                    if error == nil { UserDefaults.standard.set(version, forKey: versionKey) }
                }
            }
        }
    }
}

/// Keeps the Live Activity and widgets on the right prayer while the app
/// isn't open (best effort — iOS decides when this runs).
enum BackgroundRefresh {
    static let id = "com.salaamstreet.app.refresh"

    static func register() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: id, using: nil) { task in
            schedule()
            Task { @MainActor in
                if let snap = SharedStore.loadSnapshot() { await PrayerActivityController.shared.refresh(from: snap) }
                SharedStore.reloadWidgets()
                task.setTaskCompleted(success: true)
            }
        }
    }

    static func schedule() {
        let request = BGAppRefreshTaskRequest(identifier: id)
        let next = SharedStore.loadSnapshot()?.next()?.date ?? Date().addingTimeInterval(3600)
        request.earliestBeginDate = max(next.addingTimeInterval(30), Date().addingTimeInterval(15 * 60))
        try? BGTaskScheduler.shared.submit(request)
    }
}

/// Home Screen quick actions (touch and hold the app icon), in the website's language.
enum QuickActions {
    @MainActor static func update(labels: [String: String]) {
        func item(_ type: String, _ key: String, _ fallback: String, _ symbol: String, _ hash: String) -> UIApplicationShortcutItem {
            UIApplicationShortcutItem(type: "com.salaamstreet.app." + type, localizedTitle: labels[key] ?? fallback, localizedSubtitle: nil,
                                      icon: UIApplicationShortcutIcon(systemImageName: symbol), userInfo: ["hash": hash as NSString])
        }
        UIApplication.shared.shortcutItems = [
            item("prayer", "qaPrayer", "Prayer times", "clock", "#/prayer"),
            item("qibla", "qaQibla", "Qibla", "location.north.line", "#/qibla"),
            item("quran", "qaQuran", "Qur'an", "book", "#/quran"),
            item("dhikr", "qaDhikr", "Dhikr", "circle.dotted", "#/dhikr"),
        ]
    }
}

/// The 114 surahs, read from the bundled website (js/surahs.js) so names never drift.
enum SurahCatalog {
    struct Surah: Hashable { let number: Int; let en: String; let ar: String; let meaning: String; let ayahs: Int }

    static let all: [Surah] = {
        guard let url = Bundle.main.url(forResource: "surahs", withExtension: "js", subdirectory: "WebApp/js"),
              let src = try? String(contentsOf: url, encoding: .utf8) else { return [] }
        let re = try! NSRegularExpression(pattern: #"\{ n: (\d+), ar: "([^"]+)", en: "([^"]+)", meaning: "([^"]*)", ayahs: (\d+)"#)
        return re.matches(in: src, range: NSRange(src.startIndex..., in: src)).compactMap { m in
            func g(_ i: Int) -> String { Range(m.range(at: i), in: src).map { String(src[$0]) } ?? "" }
            guard let n = Int(g(1)), let a = Int(g(5)) else { return nil }
            return Surah(number: n, en: g(3), ar: g(2), meaning: g(4), ayahs: a)
        }
    }()
}
