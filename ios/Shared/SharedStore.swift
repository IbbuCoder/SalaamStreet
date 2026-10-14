import Foundation
#if canImport(WidgetKit)
import WidgetKit
#endif

/// Data the website hands to iOS (prayer times, tracker, Ayah of the Day…),
/// shared with the widgets, Live Activity, Siri and Control Centre through the
/// App Group. The website stays the source of truth: the app only stores the
/// latest snapshot it sent (see `snapshot` in bridge.js).
enum AppGroup {
    static let id = "group.com.salaamstreet.app"
    static var defaults: UserDefaults { UserDefaults(suiteName: id) ?? .standard }
}

struct PrayerSnapshot: Codable, Equatable {
    struct Location: Codable, Equatable {
        var label: String
        var lat: Double
        var lng: Double
        /// IANA time zone of the location (not the phone's). Every time shown
        /// anywhere on iOS is formatted in this zone, like the website.
        var tz: String
    }
    struct Day: Codable, Equatable {
        /// YYYY-MM-DD in the location's calendar.
        var date: String
        var hijri: String?
        /// "HH:MM" wall-clock times in the location's time zone (AlAdhan / praytimes.js).
        var timings: [String: String]
    }
    struct Ayah: Codable, Equatable {
        var date: String
        var arabic: String
        var translation: String
        var ref: String
        var surah: Int
        var ayah: Int
        var dir: String?
    }

    var v: Int = 1
    var updatedAt: Double = 0
    var locale: String = "en"
    var rtl: Bool = false
    var timeFormat: String = "auto"
    var location: Location
    var days: [Day]
    var names: [String: String] = [:]
    var labels: [String: String] = [:]
    var tracker: [String: [String: Int]] = [:]
    var ayahs: [Ayah] = []
    var qibla: Double?
    var remindersOn: Bool?
}

enum PrayerKey: String, CaseIterable, Codable {
    case fajr = "Fajr", sunrise = "Sunrise", dhuhr = "Dhuhr", asr = "Asr", maghrib = "Maghrib", isha = "Isha"
    static let five: [PrayerKey] = [.fajr, .dhuhr, .asr, .maghrib, .isha]
}

struct PrayerTime: Hashable, Identifiable {
    var id: String { day + "-" + key.rawValue }
    let key: PrayerKey
    let name: String
    let date: Date
    /// The location-calendar day this time belongs to (YYYY-MM-DD).
    let day: String
}

extension PrayerSnapshot {
    var timeZone: TimeZone { TimeZone(identifier: location.tz) ?? .current }
    var localeObject: Locale { Locale(identifier: locale) }

    var calendar: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = timeZone
        return c
    }

    func name(_ key: PrayerKey) -> String { names[key.rawValue] ?? key.rawValue }
    func label(_ key: String, _ fallback: String) -> String { labels[key] ?? fallback }

    /// An absolute instant for "HH:MM" on `day` in the location's time zone.
    func instant(day: String, hhmm: String) -> Date? {
        let d = day.split(separator: "-").compactMap { Int($0) }
        let t = hhmm.prefix(5).split(separator: ":").compactMap { Int($0) }
        guard d.count == 3, t.count == 2 else { return nil }
        return calendar.date(from: DateComponents(year: d[0], month: d[1], day: d[2], hour: t[0], minute: t[1]))
    }

    /// Every known prayer time, oldest first.
    func times(includeSunrise: Bool = false) -> [PrayerTime] {
        var out: [PrayerTime] = []
        for day in days {
            for key in PrayerKey.allCases where includeSunrise || key != .sunrise {
                if let s = day.timings[key.rawValue], let at = instant(day: day.date, hhmm: s) {
                    out.append(PrayerTime(key: key, name: name(key), date: at, day: day.date))
                }
            }
        }
        return out.sorted { $0.date < $1.date }
    }

    func next(after now: Date = Date()) -> PrayerTime? { times().first { $0.date > now } }
    func following(after p: PrayerTime) -> PrayerTime? { times().first { $0.date > p.date } }
    func previous(before now: Date = Date()) -> PrayerTime? { times().last { $0.date <= now } }

    /// Today's date (YYYY-MM-DD) in the location's time zone.
    func dayString(for date: Date = Date()) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    func today(_ now: Date = Date()) -> Day? { days.first { $0.date == dayString(for: now) } }

    /// "3:45 PM" / "15:45" in the location's time zone and the site's language and 12/24 h choice.
    func format(_ date: Date) -> String {
        let f = DateFormatter()
        f.timeZone = timeZone
        f.locale = localeObject
        switch timeFormat {
        case "12": f.setLocalizedDateFormatFromTemplate("hmm")
        case "24": f.setLocalizedDateFormatFromTemplate("HHmm")
        default: f.timeStyle = .short
        }
        return f.string(from: date)
    }

    func isPrayed(_ key: PrayerKey, day: String) -> Bool { (tracker[day]?[key.rawValue] ?? 0) != 0 }

    func ayah(for now: Date = Date()) -> Ayah? {
        let d = dayString(for: now)
        return ayahs.first { $0.date == d } ?? ayahs.first
    }
}

/// "I prayed" ticks made outside the website (notification button, widget,
/// Siri). The app applies them to the website's tracker the next time it runs.
struct PendingPrayed: Codable, Equatable {
    var key: String
    var date: String
}

enum SharedStore {
    private static let snapshotKey = "snapshot.v1"
    private static let pendingKey = "pendingPrayed.v1"
    static let prayedDarwinName = "com.salaamstreet.app.prayed"

    static func loadSnapshot() -> PrayerSnapshot? {
        guard let data = AppGroup.defaults.data(forKey: snapshotKey) else { return nil }
        return try? JSONDecoder().decode(PrayerSnapshot.self, from: data)
    }

    static func save(_ snapshot: PrayerSnapshot) {
        guard let data = try? JSONEncoder().encode(snapshot) else { return }
        AppGroup.defaults.set(data, forKey: snapshotKey)
    }

    /// Record a tick and show it in the widgets at once.
    static func addPrayed(key: PrayerKey, date: String) {
        var list = pendingPrayed()
        if !list.contains(PendingPrayed(key: key.rawValue, date: date)) {
            list.append(PendingPrayed(key: key.rawValue, date: date))
        }
        if let data = try? JSONEncoder().encode(list) { AppGroup.defaults.set(data, forKey: pendingKey) }
        if var s = loadSnapshot() {
            var day = s.tracker[date] ?? [:]
            day[key.rawValue] = 1
            s.tracker[date] = day
            save(s)
        }
        reloadWidgets()
        CFNotificationCenterPostNotification(CFNotificationCenterGetDarwinNotifyCenter(),
                                             CFNotificationName(prayedDarwinName as CFString), nil, nil, true)
    }

    static func pendingPrayed() -> [PendingPrayed] {
        guard let data = AppGroup.defaults.data(forKey: pendingKey) else { return [] }
        return (try? JSONDecoder().decode([PendingPrayed].self, from: data)) ?? []
    }

    static func clearPending(_ done: [PendingPrayed]) {
        let left = pendingPrayed().filter { !done.contains($0) }
        if let data = try? JSONEncoder().encode(left) { AppGroup.defaults.set(data, forKey: pendingKey) }
    }

    static func reloadWidgets() {
        #if canImport(WidgetKit)
        WidgetCenter.shared.reloadAllTimelines()
        #endif
    }
}
