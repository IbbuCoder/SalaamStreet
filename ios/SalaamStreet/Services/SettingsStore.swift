import Foundation
import SalaamStreetCore

/// Appearance, as on the website: follow the system, or always light/dark.
enum AppearancePreference: String, Codable, CaseIterable, Identifiable {
    case system, light, dark
    var id: String { rawValue }
    var title: String { rawValue.capitalized }
}

/// Everything the person chooses, saved on the device. Field names follow the
/// website's settings so the two stay easy to compare.
struct AppSettings: Codable, Equatable {
    var prayer = PrayerSettings()
    /// nil until the person chooses; Makkah is shown (and labelled) meanwhile.
    var location: PrayerLocation?
    var reminders = ReminderPreferences()
    var liveActivity = LiveActivityPreferences()
    var appearance: AppearancePreference = .system
    var translation = "en.sahih"
    var reciter = "ar.alafasy"
    var showTranslation = true
    var showTransliteration = false
    /// Multiplier for the Arabic text, 0.8…1.8.
    var arabicScale: Double = 1.0
    var continuousPlay = false
    var hasCompletedWelcome = false

    init() {}

    // Decode leniently so a newer field never wipes someone's saved settings.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let d = AppSettings()
        prayer = (try? c.decode(PrayerSettings.self, forKey: .prayer)) ?? d.prayer
        location = try? c.decode(PrayerLocation.self, forKey: .location)
        reminders = (try? c.decode(ReminderPreferences.self, forKey: .reminders)) ?? d.reminders
        liveActivity = (try? c.decode(LiveActivityPreferences.self, forKey: .liveActivity)) ?? d.liveActivity
        appearance = (try? c.decode(AppearancePreference.self, forKey: .appearance)) ?? d.appearance
        translation = (try? c.decode(String.self, forKey: .translation)) ?? d.translation
        reciter = (try? c.decode(String.self, forKey: .reciter)) ?? d.reciter
        showTranslation = (try? c.decode(Bool.self, forKey: .showTranslation)) ?? d.showTranslation
        showTransliteration = (try? c.decode(Bool.self, forKey: .showTransliteration)) ?? d.showTransliteration
        arabicScale = (try? c.decode(Double.self, forKey: .arabicScale)) ?? d.arabicScale
        continuousPlay = (try? c.decode(Bool.self, forKey: .continuousPlay)) ?? d.continuousPlay
        hasCompletedWelcome = (try? c.decode(Bool.self, forKey: .hasCompletedWelcome)) ?? d.hasCompletedWelcome
    }
}

/// Small JSON-in-UserDefaults persistence for settings and personal data.
enum LocalStore {
    static let defaults = UserDefaults.standard

    static func load<T: Decodable>(_ type: T.Type, key: String) -> T? {
        guard let data = defaults.data(forKey: "salaamstreet." + key) else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }

    static func save<T: Encodable>(_ value: T, key: String) {
        if let data = try? JSONEncoder().encode(value) { defaults.set(data, forKey: "salaamstreet." + key) }
    }

    static func remove(_ key: String) { defaults.removeObject(forKey: "salaamstreet." + key) }
}
