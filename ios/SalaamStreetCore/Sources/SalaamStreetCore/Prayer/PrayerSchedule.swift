import Foundation

/// One prayer at a moment in time.
public struct PrayerTime: Equatable, Hashable, Sendable, Identifiable {
    public let prayer: Prayer
    public let date: Date
    /// The location's calendar day this belongs to ("yyyy-MM-dd").
    public let dayKey: String
    public let isFriday: Bool

    public var id: String { dayKey + "/" + prayer.rawValue }
    public var englishName: String { prayer.englishName(isFriday: isFriday) }
    public var arabicName: String { prayer.arabicName(isFriday: isFriday) }
}

/// A calendar day's times at a location.
public struct DaySchedule: Equatable, Sendable, Identifiable {
    public let dayKey: String
    public let year: Int, month: Int, day: Int
    public let isFriday: Bool
    /// In display order; a prayer is missing only where the sun never reaches its angle.
    public let times: [PrayerTime]

    public var id: String { dayKey }
    public func time(of prayer: Prayer) -> PrayerTime? { times.first { $0.prayer == prayer } }
}

/// Builds schedules for a location and settings, entirely on the device.
public struct PrayerScheduleBuilder: Sendable {
    public let location: PrayerLocation
    public let settings: PrayerSettings

    public init(location: PrayerLocation, settings: PrayerSettings) {
        self.location = location
        self.settings = settings
    }

    private var calendar: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = location.timeZone
        return c
    }

    /// Minutes east of UTC at local noon on that day (as the website does), so DST is right.
    func tzOffsetMinutes(year: Int, month: Int, day: Int) -> Int {
        let noon = calendar.date(from: DateComponents(year: year, month: month, day: day, hour: 12)) ?? Date()
        return location.timeZone.secondsFromGMT(for: noon) / 60
    }

    public func schedule(year: Int, month: Int, day: Int) -> DaySchedule {
        let offset = tzOffsetMinutes(year: year, month: month, day: day)
        let h = PrayerCalculator.hours(year: year, month: month, day: day, latitude: location.latitude, longitude: location.longitude,
                                       method: settings.method, school: settings.school, tzOffsetMinutes: offset)
        let key = DayKey.make(year: year, month: month, day: day)
        let weekday = calendar.component(.weekday, from: calendar.date(from: DateComponents(year: year, month: month, day: day, hour: 12)) ?? Date())
        let friday = weekday == 6
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC")!
        let midnightUTC = utc.date(from: DateComponents(year: year, month: month, day: day)) ?? Date()
        let pairs: [(Prayer, Double)] = [(.fajr, h.fajr), (.sunrise, h.sunrise), (.dhuhr, h.dhuhr), (.asr, h.asr), (.maghrib, h.maghrib), (.isha, h.isha)]
        let times = pairs.compactMap { prayer, hours -> PrayerTime? in
            guard let mins = PrayerCalculator.minutes(hours) else { return nil }
            // Clock minutes at the location → an absolute instant.
            let date = midnightUTC.addingTimeInterval(TimeInterval((mins - offset) * 60))
            return PrayerTime(prayer: prayer, date: date, dayKey: key, isFriday: friday)
        }
        return DaySchedule(dayKey: key, year: year, month: month, day: day, isFriday: friday, times: times)
    }

    /// The schedule for the location's calendar day containing `date`.
    public func schedule(for date: Date) -> DaySchedule {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return schedule(year: c.year!, month: c.month!, day: c.day!)
    }

    /// Consecutive days starting with the day containing `date`.
    public func schedules(from date: Date, days: Int) -> [DaySchedule] {
        (0..<max(days, 0)).compactMap { i in
            calendar.date(byAdding: .day, value: i, to: date).map { schedule(for: $0) }
        }
    }

    /// A whole month (timetable).
    public func month(year: Int, month: Int) -> [DaySchedule] {
        let first = calendar.date(from: DateComponents(year: year, month: month, day: 1, hour: 12)) ?? Date()
        let count = calendar.range(of: .day, in: .month, for: first)?.count ?? 30
        return (1...count).map { schedule(year: year, month: month, day: $0) }
    }

    /// The next prayer strictly after `now` (sunrise included only when asked).
    public func next(after now: Date, includeSunrise: Bool = false) -> PrayerTime? {
        upcoming(after: now, count: 1, includeSunrise: includeSunrise).first
    }

    /// The next `count` prayers after `now`, looking ahead up to three days.
    public func upcoming(after now: Date, count: Int, includeSunrise: Bool = false) -> [PrayerTime] {
        var out: [PrayerTime] = []
        for day in schedules(from: now.addingTimeInterval(-86400), days: 4) {
            for t in day.times where t.date > now && (includeSunrise || t.prayer.isObligatory) {
                out.append(t)
                if out.count == count { return out }
            }
        }
        return out
    }

    /// The prayer whose time it currently is (the latest one at or before `now`), if any today.
    public func current(at now: Date) -> PrayerTime? {
        var last: PrayerTime?
        for day in schedules(from: now.addingTimeInterval(-86400), days: 2) {
            for t in day.times where t.date <= now && t.prayer.isObligatory { last = t }
        }
        return last
    }
}

/// "yyyy-MM-dd" keys, independent of locale.
public enum DayKey {
    public static func make(year: Int, month: Int, day: Int) -> String {
        String(format: "%04d-%02d-%02d", year, month, day)
    }
    public static func make(_ date: Date, timeZone: TimeZone = .current) -> String {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = timeZone
        let d = c.dateComponents([.year, .month, .day], from: date)
        return make(year: d.year!, month: d.month!, day: d.day!)
    }
    public static func parse(_ key: String, timeZone: TimeZone = .current) -> Date? {
        let p = key.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3 else { return nil }
        var c = Calendar(identifier: .gregorian)
        c.timeZone = timeZone
        return c.date(from: DateComponents(year: p[0], month: p[1], day: p[2], hour: 12))
    }
}

/// Countdown text that matches the website: "2h 05m", "14m", "45s".
public enum Countdown {
    public static func components(from now: Date, to target: Date) -> (hours: Int, minutes: Int, seconds: Int) {
        let total = max(0, Int(target.timeIntervalSince(now).rounded(.down)))
        return (total / 3600, (total % 3600) / 60, total % 60)
    }

    public static func short(from now: Date, to target: Date) -> String {
        let c = components(from: now, to: target)
        if c.hours > 0 { return String(format: "%dh %02dm", c.hours, c.minutes) }
        if c.minutes > 0 { return "\(c.minutes)m" }
        return "\(c.seconds)s"
    }

    /// Spoken form for VoiceOver: "2 hours 5 minutes".
    public static func spoken(from now: Date, to target: Date) -> String {
        let c = components(from: now, to: target)
        var parts: [String] = []
        if c.hours > 0 { parts.append("\(c.hours) hour" + (c.hours == 1 ? "" : "s")) }
        if c.minutes > 0 { parts.append("\(c.minutes) minute" + (c.minutes == 1 ? "" : "s")) }
        if parts.isEmpty { parts.append("less than a minute") }
        return parts.joined(separator: " ")
    }
}
