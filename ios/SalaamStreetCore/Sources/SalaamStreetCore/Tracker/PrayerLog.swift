import Foundation

/// The prayer tracker: which prayers were ticked on which day. Stored on the
/// device only, in the same shape as the website ("yyyy-MM-dd" → prayers).
public struct PrayerLog: Codable, Equatable, Sendable {
    public private(set) var days: [String: Set<Prayer>] = [:]

    public init(days: [String: Set<Prayer>] = [:]) {
        self.days = days.mapValues { $0.filter(\.isObligatory) }.filter { !$0.value.isEmpty }
    }

    public func prayed(_ prayer: Prayer, on dayKey: String) -> Bool { days[dayKey]?.contains(prayer) ?? false }

    public mutating func set(_ prayer: Prayer, on dayKey: String, prayed: Bool) {
        guard prayer.isObligatory else { return }
        var s = days[dayKey] ?? []
        if prayed { s.insert(prayer) } else { s.remove(prayer) }
        days[dayKey] = s.isEmpty ? nil : s
    }

    public mutating func toggle(_ prayer: Prayer, on dayKey: String) {
        set(prayer, on: dayKey, prayed: !self.prayed(prayer, on: dayKey))
    }

    public func count(on dayKey: String) -> Int { days[dayKey]?.count ?? 0 }
    public func isComplete(_ dayKey: String) -> Bool { count(on: dayKey) == Prayer.obligatory.count }

    /// Consecutive days, ending today, with all five prayers. Today counts only once it is
    /// complete, but an unfinished today doesn't break a streak that ran up to yesterday.
    public func currentStreak(today: Date, timeZone: TimeZone = .current) -> Int {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        var day = today
        if !isComplete(DayKey.make(day, timeZone: timeZone)) {
            guard let y = cal.date(byAdding: .day, value: -1, to: day) else { return 0 }
            day = y
        }
        var n = 0
        while isComplete(DayKey.make(day, timeZone: timeZone)) {
            n += 1
            guard let prev = cal.date(byAdding: .day, value: -1, to: day) else { break }
            day = prev
        }
        return n
    }

    /// Longest run of complete days ever recorded.
    public var bestStreak: Int {
        let complete = days.keys.filter { isComplete($0) }.compactMap { DayKey.parse($0, timeZone: TimeZone(identifier: "UTC")!) }.sorted()
        var best = 0, run = 0
        var prev: Date?
        for d in complete {
            if let p = prev, abs(d.timeIntervalSince(p) - 86400) < 3600 { run += 1 } else { run = 1 }
            best = max(best, run)
            prev = d
        }
        return best
    }

    /// The last `n` days (oldest first) with how many prayers were ticked.
    public func recent(_ n: Int, today: Date, timeZone: TimeZone = .current) -> [(dayKey: String, count: Int)] {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        return (0..<n).reversed().compactMap { i in
            cal.date(byAdding: .day, value: -i, to: today).map { d in
                let k = DayKey.make(d, timeZone: timeZone)
                return (k, count(on: k))
            }
        }
    }
}
