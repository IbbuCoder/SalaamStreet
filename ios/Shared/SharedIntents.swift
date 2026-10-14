import AppIntents
import Foundation

enum PrayerAppEnum: String, AppEnum {
    case fajr = "Fajr", sunrise = "Sunrise", dhuhr = "Dhuhr", asr = "Asr", maghrib = "Maghrib", isha = "Isha"

    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Prayer"
    static let caseDisplayRepresentations: [PrayerAppEnum: DisplayRepresentation] = [
        .fajr: "Fajr", .sunrise: "Sunrise", .dhuhr: "Dhuhr", .asr: "Asr", .maghrib: "Maghrib", .isha: "Isha",
    ]
    var key: PrayerKey { PrayerKey(rawValue: rawValue) ?? .fajr }
}

/// "I prayed" — from a widget button or Siri. Ticks the website's tracker
/// (applied the next time the app runs; widgets show it at once).
struct MarkPrayedIntent: AppIntent {
    static let title: LocalizedStringResource = "Mark a prayer as prayed"
    static let description = IntentDescription("Ticks a prayer in SalaamStreet's prayer tracker.")

    @Parameter(title: "Prayer") var prayer: PrayerAppEnum
    @Parameter(title: "Day (YYYY-MM-DD)") var day: String?

    init() {}
    init(prayer: PrayerAppEnum, day: String?) {
        self.prayer = prayer
        self.day = day
    }

    static var parameterSummary: some ParameterSummary { Summary("Mark \(\.$prayer) as prayed") }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard prayer != .sunrise else { return .result(dialog: "Sunrise isn't a prayer to tick.") }
        let snap = SharedStore.loadSnapshot()
        let date = day ?? snap?.dayString() ?? PrayerSnapshot.deviceDay()
        SharedStore.addPrayed(key: prayer.key, date: date)
        let name = snap?.name(prayer.key) ?? prayer.rawValue
        return .result(dialog: "\(name) marked as prayed.")
    }
}

/// Start or stop the prayer countdown (Control Centre toggle, iOS 18+).
struct CountdownToggleIntent: SetValueIntent, LiveActivityIntent {
    static let title: LocalizedStringResource = "Prayer countdown"
    static let description = IntentDescription("Shows or hides the countdown to the next prayer on the Lock Screen and in the Dynamic Island.")

    @Parameter(title: "Show countdown") var value: Bool

    init() {}

    func perform() async throws -> some IntentResult {
        #if !WIDGET_EXTENSION
        if value {
            guard let snap = SharedStore.loadSnapshot() else { throw PrayerActivityController.ActivityError.noTimes }
            try await PrayerActivityController.shared.start(from: snap)
        } else {
            await PrayerActivityController.shared.stopAll()
        }
        #endif
        return .result()
    }
}

/// "Start the prayer countdown" (Siri, Shortcuts, Action button).
struct StartCountdownIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Start the prayer countdown"
    static let description = IntentDescription("Counts down to the next prayer on the Lock Screen and in the Dynamic Island.")

    init() {}

    func perform() async throws -> some IntentResult & ProvidesDialog {
        #if !WIDGET_EXTENSION
        guard let snap = SharedStore.loadSnapshot() else { throw PrayerActivityController.ActivityError.noTimes }
        try await PrayerActivityController.shared.start(from: snap)
        if let next = snap.next() {
            return .result(dialog: "Counting down to \(next.name) at \(snap.format(next.date)).")
        }
        #endif
        return .result(dialog: "Prayer countdown started.")
    }
}

struct StopCountdownIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Stop the prayer countdown"

    init() {}

    func perform() async throws -> some IntentResult {
        #if !WIDGET_EXTENSION
        await PrayerActivityController.shared.stopAll()
        #endif
        return .result()
    }
}

extension PrayerSnapshot {
    /// Today on the phone's own calendar (only when no snapshot exists yet).
    static func deviceDay() -> String {
        let c = Calendar(identifier: .gregorian).dateComponents([.year, .month, .day], from: Date())
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }
}
