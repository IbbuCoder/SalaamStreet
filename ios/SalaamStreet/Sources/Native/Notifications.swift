import UIKit
import UserNotifications

/// Local notifications in place of the website's web notifications and Web
/// Push. bridge.js plans the next days' reminders with the website's own
/// settings, texts and prayer times (in the location's time zone) and hands
/// them over here, so they arrive even when the app is closed.
@MainActor
final class Notifications: NSObject, UNUserNotificationCenterDelegate {
    static let shared = Notifications()
    static let prayerCategory = "PRAYER"
    static let prayedAction = "PRAYED"
    /// Every notification id the app makes starts with this.
    static let prefix = "ss."
    private var prayedTitle = "I prayed"

    func configure() {
        UNUserNotificationCenter.current().delegate = self
        registerCategories()
    }

    private func registerCategories() {
        let prayed = UNNotificationAction(identifier: Self.prayedAction, title: prayedTitle, options: [], icon: UNNotificationActionIcon(systemImageName: "checkmark.circle"))
        let cat = UNNotificationCategory(identifier: Self.prayerCategory, actions: [prayed], intentIdentifiers: [], options: [])
        UNUserNotificationCenter.current().setNotificationCategories([cat])
    }

    /// The website's three states: "granted", "denied", "default".
    func status() async -> String {
        let s = await UNUserNotificationCenter.current().notificationSettings()
        switch s.authorizationStatus {
        case .authorized, .provisional, .ephemeral: return "granted"
        case .denied: return "denied"
        default: return "default"
        }
    }

    func request() async -> String {
        _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])
        return await status()
    }

    /// new Notification(title, { body, tag, data }) while the app is open.
    /// Skipped when the same reminder is already scheduled or shown.
    func show(_ p: Payload) async throws {
        let tag = String((p.optString("tag", max: 120) ?? UUID().uuidString).filter { $0.isLetter || $0.isNumber || "-_:.".contains($0) })
        let id = Self.prefix + tag
        let center = UNUserNotificationCenter.current()
        let pending = await center.pendingNotificationRequests().map(\.identifier)
        let delivered = await center.deliveredNotifications().map(\.request.identifier)
        if pending.contains(id) || delivered.contains(id) { return }
        let content = makeContent(p.raw)
        try await center.add(UNNotificationRequest(identifier: id, content: content, trigger: nil))
    }

    /// Replace every scheduled reminder with the website's plan.
    /// payload: { prayedTitle, items: [{ tag, at (ms), title, body, hash, prayedKey?, prayedDate?, sound, essential }] }
    func schedule(_ p: Payload) async throws -> Int {
        if let t = p.optString("prayedTitle", max: 60), t != prayedTitle {
            prayedTitle = t
            registerCategories()
        }
        let items = try p.array("items", max: 200).compactMap { $0 as? [String: Any] }
        let center = UNUserNotificationCenter.current()
        let ours = await center.pendingNotificationRequests().map(\.identifier).filter { $0.hasPrefix(Self.prefix) }
        center.removePendingNotificationRequests(withIdentifiers: ours)
        guard await status() == "granted" else { return 0 }
        let now = Date()
        var added = 0
        // iOS keeps at most 64 pending notifications per app.
        for item in items.sorted(by: { ($0["at"] as? Double ?? 0) < ($1["at"] as? Double ?? 0) }) {
            guard added < 60, let ms = item["at"] as? Double, let tag = item["tag"] as? String, tag.count <= 120 else { continue }
            let at = Date(timeIntervalSince1970: ms / 1000)
            guard at > now.addingTimeInterval(5), at < now.addingTimeInterval(8 * 86400) else { continue }
            let comps = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: at)
            let request = UNNotificationRequest(identifier: Self.prefix + tag, content: makeContent(item),
                                                trigger: UNCalendarNotificationTrigger(dateMatching: comps, repeats: false))
            try? await center.add(request)
            added += 1
        }
        return added
    }

    private func makeContent(_ d: [String: Any]) -> UNMutableNotificationContent {
        let c = UNMutableNotificationContent()
        c.title = String((d["title"] as? String ?? "SalaamStreet").prefix(200))
        c.body = String((d["body"] as? String ?? "").prefix(500))
        if (d["sound"] as? Bool) ?? true { c.sound = .default }
        var info: [String: Any] = [:]
        if let hash = d["hash"] as? String, hash.hasPrefix("#/"), hash.count < 200 { info["hash"] = hash }
        if let key = d["prayedKey"] as? String, PrayerKey(rawValue: key) != nil, let date = d["prayedDate"] as? String {
            info["prayedKey"] = key
            info["prayedDate"] = date
            c.categoryIdentifier = Self.prayerCategory
            // Prayer reminders may break through a Focus (needs the Time Sensitive capability).
            c.interruptionLevel = .timeSensitive
            c.threadIdentifier = "prayer"
        }
        c.userInfo = info
        return c
    }

    // MARK: UNUserNotificationCenterDelegate

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        let info = response.notification.request.content.userInfo
        let action = response.actionIdentifier
        let key = (info["prayedKey"] as? String).flatMap(PrayerKey.init(rawValue:))
        let date = info["prayedDate"] as? String
        let hash = info["hash"] as? String
        await MainActor.run {
            if action == Self.prayedAction, let key, let date {
                // Ticked without opening the app: the website's tracker gets it next time it runs.
                SharedStore.addPrayed(key: key, date: date)
                AppRouter.shared.bridge?.deliverPendingPrayed()
            } else if action == UNNotificationDefaultActionIdentifier, let hash {
                AppRouter.shared.open(hash: hash)
            }
        }
    }
}
