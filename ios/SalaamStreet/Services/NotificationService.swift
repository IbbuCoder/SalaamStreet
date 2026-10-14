import Foundation
import UserNotifications
import SalaamStreetCore

/// Prayer and Friday Al-Kahf reminders as local notifications. Everything is
/// scheduled on the device from the on-device prayer times, so reminders work
/// with no connection and nothing is sent to a server.
@MainActor
final class NotificationService: ObservableObject {
    static let category = "PRAYER_REMINDER"
    static let prayedAction = "PRAYED"
    private let center = UNUserNotificationCenter.current()

    @Published private(set) var authorization: UNAuthorizationStatus = .notDetermined

    init() {
        let prayed = UNNotificationAction(identifier: Self.prayedAction, title: "I prayed", options: [])
        center.setNotificationCategories([
            UNNotificationCategory(identifier: Self.category, actions: [prayed], intentIdentifiers: [], options: []),
        ])
        Task { await refreshAuthorization() }
    }

    func refreshAuthorization() async {
        authorization = await center.notificationSettings().authorizationStatus
    }

    /// Ask once; returns whether reminders can be shown.
    func requestPermission() async -> Bool {
        let granted = (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        await refreshAuthorization()
        return granted
    }

    /// Replace every SalaamStreet reminder with a fresh plan for the next two weeks
    /// (kept under iOS's limit of 64 pending notifications).
    func reschedule(builder: PrayerScheduleBuilder, preferences: ReminderPreferences) {
        Task {
            await refreshAuthorization()
            let pending = await center.pendingNotificationRequests().map(\.identifier)
            center.removePendingNotificationRequests(withIdentifiers: pending.filter { $0.hasPrefix("prayer-") || $0.hasPrefix("kahf-") })
            guard authorization == .authorized || authorization == .provisional else { return }
            let plan = ReminderPlanner.plan(schedules: builder.schedules(from: Date(), days: 14), preferences: preferences,
                                            now: Date(), timeZone: builder.location.timeZone)
            for r in plan {
                let content = UNMutableNotificationContent()
                content.title = r.title
                content.body = r.body
                content.sound = preferences.sound ? .default : nil
                content.userInfo = ["link": r.link, "prayer": r.prayer?.rawValue ?? "",
                                    // The prayer's own day (ids are "prayer-yyyy-MM-dd/<prayer>"), not the reminder's.
                                "day": r.prayer == nil ? "" : String(r.id.dropFirst("prayer-".count).prefix(10))]
                if r.prayer != nil { content.categoryIdentifier = Self.category }
                content.threadIdentifier = r.prayer == nil ? "jumuah" : "prayers"
                let comps = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: r.fireDate)
                let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
                try? await center.add(UNNotificationRequest(identifier: r.id, content: content, trigger: trigger))
            }
        }
    }
}
