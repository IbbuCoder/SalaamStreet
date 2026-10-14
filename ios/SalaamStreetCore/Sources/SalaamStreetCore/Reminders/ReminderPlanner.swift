import Foundation

/// Reminder preferences (the same choices as the website's Settings → Reminders).
public struct ReminderPreferences: Codable, Equatable, Sendable {
    public var enabled: Bool
    /// Minutes before the prayer (0 = at the time).
    public var minutesBefore: Int
    public var prayers: Set<Prayer>
    /// Friday morning: a reminder to read Surah Al-Kahf.
    public var kahfReminder: Bool
    public var sound: Bool

    public init(enabled: Bool = false, minutesBefore: Int = 0, prayers: Set<Prayer> = Set(Prayer.obligatory),
                kahfReminder: Bool = true, sound: Bool = true) {
        self.enabled = enabled
        self.minutesBefore = max(0, min(60, minutesBefore))
        self.prayers = prayers.filter(\.isObligatory)
        self.kahfReminder = kahfReminder
        self.sound = sound
    }
}

/// A local notification to schedule.
public struct PlannedReminder: Equatable, Sendable, Identifiable {
    public let id: String
    public let fireDate: Date
    public let title: String
    public let body: String
    /// Deep link opened when the notification is tapped.
    public let link: String
    public let prayer: Prayer?
}

/// Turns schedules into notifications. iOS keeps at most 64 pending local
/// notifications per app, so the plan stays well under that and is refreshed
/// whenever the app opens or refreshes in the background.
public enum ReminderPlanner {
    public static let limit = 60

    public static func plan(schedules: [DaySchedule], preferences p: ReminderPreferences, now: Date,
                            timeZone: TimeZone) -> [PlannedReminder] {
        guard p.enabled || p.kahfReminder else { return [] }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        var out: [PlannedReminder] = []
        for day in schedules {
            if p.kahfReminder && day.isFriday,
               let morning = cal.date(from: DateComponents(year: day.year, month: day.month, day: day.day, hour: 9)), morning > now {
                out.append(PlannedReminder(id: "kahf-\(day.dayKey)", fireDate: morning, title: "Jumu'ah Mubarak",
                                           body: "A reminder to read Surah Al-Kahf today.", link: "salaamstreet://quran/18", prayer: nil))
            }
            guard p.enabled else { continue }
            for t in day.times where p.prayers.contains(t.prayer) {
                let fire = t.date.addingTimeInterval(-Double(p.minutesBefore) * 60)
                guard fire > now else { continue }
                let title = p.minutesBefore == 0 ? "It's time for \(t.englishName)" : "\(t.englishName) in \(p.minutesBefore) minutes"
                out.append(PlannedReminder(id: "prayer-\(t.id)", fireDate: fire, title: title,
                                           body: t.arabicName + " · Tap to mark it prayed in your tracker.",
                                           link: "salaamstreet://prayer", prayer: t.prayer))
            }
        }
        return Array(out.sorted { $0.fireDate < $1.fireDate }.prefix(limit))
    }
}
