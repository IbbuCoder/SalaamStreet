import Foundation

/// The five daily prayers plus sunrise (shown in the timetable, never counted or tracked).
public enum Prayer: String, CaseIterable, Codable, Hashable, Sendable, Identifiable {
    case fajr, sunrise, dhuhr, asr, maghrib, isha

    public var id: String { rawValue }

    /// The five obligatory prayers, in order.
    public static let obligatory: [Prayer] = [.fajr, .dhuhr, .asr, .maghrib, .isha]

    public var isObligatory: Bool { self != .sunrise }

    public var englishName: String {
        switch self {
        case .fajr: return "Fajr"
        case .sunrise: return "Sunrise"
        case .dhuhr: return "Dhuhr"
        case .asr: return "Asr"
        case .maghrib: return "Maghrib"
        case .isha: return "Isha"
        }
    }

    public var arabicName: String {
        switch self {
        case .fajr: return "الفجر"
        case .sunrise: return "الشروق"
        case .dhuhr: return "الظهر"
        case .asr: return "العصر"
        case .maghrib: return "المغرب"
        case .isha: return "العشاء"
        }
    }

    /// Name for a given day: Dhuhr is Jumu'ah on Fridays (in the location's calendar).
    public func englishName(isFriday: Bool) -> String { self == .dhuhr && isFriday ? "Jumu'ah" : englishName }
    public func arabicName(isFriday: Bool) -> String { self == .dhuhr && isFriday ? "الجمعة" : arabicName }
}

/// Asr calculation: the majority (Shafi'i, Maliki, Hanbali) or Hanafi. A choice, never a single "correct" view.
public enum AsrSchool: Int, Codable, CaseIterable, Sendable, Identifiable {
    case standard = 0
    case hanafi = 1

    public var id: Int { rawValue }
    public var title: String { self == .standard ? "Standard (majority)" : "Hanafi" }
    public var detail: String {
        self == .standard
            ? "Asr begins when an object's shadow equals its length (Shafi'i, Maliki, Hanbali)."
            : "Asr begins when an object's shadow is twice its length."
    }
}

/// A place prayer times are calculated for. Coordinates are rounded to ~1 km, as on the website.
public struct PrayerLocation: Codable, Equatable, Hashable, Sendable {
    public var latitude: Double
    public var longitude: Double
    public var name: String
    public var timeZoneIdentifier: String

    public init(latitude: Double, longitude: Double, name: String, timeZoneIdentifier: String) {
        self.latitude = (latitude * 100).rounded() / 100
        self.longitude = (longitude * 100).rounded() / 100
        self.name = name
        self.timeZoneIdentifier = timeZoneIdentifier
    }

    public var timeZone: TimeZone { TimeZone(identifier: timeZoneIdentifier) ?? .current }

    /// Makkah: used until someone chooses a location, and always labelled as such.
    public static let makkah = PrayerLocation(latitude: 21.4225, longitude: 39.8262, name: "Makkah (default)", timeZoneIdentifier: "Asia/Riyadh")
}

/// Everything that changes the calculation.
public struct PrayerSettings: Codable, Equatable, Hashable, Sendable {
    public var method: Int
    public var school: AsrSchool

    public init(method: Int = 3, school: AsrSchool = .standard) {
        self.method = PrayerCalculator.methods[method] == nil ? 3 : method
        self.school = school
    }
}
