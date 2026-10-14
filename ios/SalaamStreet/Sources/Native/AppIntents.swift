import AppIntents
import Foundation

/// "When is Asr?" — answered from the website's latest prayer times, in the location's time zone.
struct WhenIsPrayerIntent: AppIntent {
    static let title: LocalizedStringResource = "When is a prayer?"
    static let description = IntentDescription("Tells you today's time for a prayer, for your SalaamStreet location.")

    @Parameter(title: "Prayer") var prayer: PrayerAppEnum

    init() {}

    static var parameterSummary: some ParameterSummary { Summary("When is \(\.$prayer)?") }

    func perform() async throws -> some IntentResult & ProvidesDialog & ReturnsValue<String> {
        guard let snap = SharedStore.loadSnapshot() else {
            return .result(value: "", dialog: "Open SalaamStreet once so it knows your prayer times.")
        }
        let now = Date()
        let times = snap.times(includeSunrise: true).filter { $0.key == prayer.key }
        // Today's time, or tomorrow's once today's has passed.
        guard let t = times.first(where: { $0.day == snap.dayString(for: now) && $0.date > now }) ?? times.first(where: { $0.date > now }) else {
            return .result(value: "", dialog: "I don't have that time yet. Open SalaamStreet to update.")
        }
        let time = snap.format(t.date)
        let mins = Int(t.date.timeIntervalSince(now) / 60)
        let rel = mins >= 60 ? "\(mins / 60) h \(mins % 60) min" : "\(mins) min"
        return .result(value: time, dialog: "\(t.name) is at \(time) in \(snap.location.label) — in \(rel).")
    }
}

struct NextPrayerIntent: AppIntent {
    static let title: LocalizedStringResource = "Next prayer"
    static let description = IntentDescription("Tells you the next prayer and how long until it.")

    init() {}

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let snap = SharedStore.loadSnapshot(), let next = snap.next() else {
            return .result(dialog: "Open SalaamStreet once so it knows your prayer times.")
        }
        let mins = Int(next.date.timeIntervalSinceNow / 60)
        let rel = mins >= 60 ? "\(mins / 60) h \(mins % 60) min" : "\(mins) min"
        return .result(dialog: "\(next.name) is at \(snap.format(next.date)) in \(snap.location.label) — in \(rel).")
    }
}

struct SurahEntity: AppEntity {
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Surah"
    static let defaultQuery = SurahQuery()
    let id: Int
    let name: String
    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(name)", subtitle: "Surah \(id)") }
}

struct SurahQuery: EntityStringQuery {
    func entities(for identifiers: [Int]) async throws -> [SurahEntity] {
        identifiers.compactMap { id in SurahCatalog.all.first { $0.number == id }.map { SurahEntity(id: $0.number, name: $0.en) } }
    }
    func entities(matching string: String) async throws -> [SurahEntity] {
        let q = string.lowercased().replacingOccurrences(of: "surah ", with: "").filter { $0.isLetter || $0.isNumber }
        return SurahCatalog.all.filter { s in
            let n = s.en.lowercased().filter { $0.isLetter || $0.isNumber }
            return n.contains(q) || q.contains(n) || String(s.number) == q || s.meaning.lowercased().contains(string.lowercased())
        }.map { SurahEntity(id: $0.number, name: $0.en) }
    }
    func suggestedEntities() async throws -> [SurahEntity] {
        SurahCatalog.all.map { SurahEntity(id: $0.number, name: $0.en) }
    }
}

/// "Play Surah Al-Kahf" — opens the surah and starts the recitation, with the reciter chosen on the website.
struct PlaySurahIntent: AppIntent {
    static let title: LocalizedStringResource = "Play a surah"
    static let description = IntentDescription("Opens the surah in SalaamStreet and starts the recitation.")
    static let openAppWhenRun = true

    @Parameter(title: "Surah") var surah: SurahEntity

    init() {}
    init(surah: SurahEntity) { self.surah = surah }

    @MainActor
    func perform() async throws -> some IntentResult {
        AppRouter.shared.playSurah(surah.id)
        return .result()
    }
}

struct PlayKahfIntent: AppIntent {
    static let title: LocalizedStringResource = "Play Surah Al-Kahf"
    static let description = IntentDescription("The Friday surah: opens Al-Kahf and starts the recitation.")
    static let openAppWhenRun = true

    init() {}

    @MainActor
    func perform() async throws -> some IntentResult {
        AppRouter.shared.playSurah(18)
        return .result()
    }
}

struct OpenPageIntent: AppIntent {
    enum Page: String, AppEnum {
        case home, prayer, qibla, quran, dhikr, duas, adhkar, calendar, mosques, offline
        static let typeDisplayRepresentation: TypeDisplayRepresentation = "Page"
        static let caseDisplayRepresentations: [Page: DisplayRepresentation] = [
            .home: "Home", .prayer: "Prayer times", .qibla: "Qibla", .quran: "Qur'an", .dhikr: "Dhikr counter",
            .duas: "Duas", .adhkar: "Adhkar", .calendar: "Islamic calendar", .mosques: "Mosque finder", .offline: "Offline",
        ]
    }

    static let title: LocalizedStringResource = "Open SalaamStreet page"
    static let openAppWhenRun = true

    @Parameter(title: "Page") var page: Page

    init() {}
    init(page: Page) { self.page = page }

    @MainActor
    func perform() async throws -> some IntentResult {
        AppRouter.shared.open(hash: "#/" + page.rawValue)
        return .result()
    }
}

/// Siri phrases, the Shortcuts app and the Action button.
struct SalaamStreetShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: WhenIsPrayerIntent(), phrases: [
            "When is \(\.$prayer) in \(.applicationName)?",
            "\(.applicationName) \(\.$prayer) time",
        ], shortTitle: "Prayer time", systemImageName: "clock")
        AppShortcut(intent: NextPrayerIntent(), phrases: [
            "When is the next prayer in \(.applicationName)?",
            "Next prayer in \(.applicationName)",
        ], shortTitle: "Next prayer", systemImageName: "clock.badge")
        AppShortcut(intent: StartCountdownIntent(), phrases: [
            "Start the prayer countdown in \(.applicationName)",
            "Start \(.applicationName) countdown",
        ], shortTitle: "Prayer countdown", systemImageName: "timer")
        AppShortcut(intent: PlayKahfIntent(), phrases: [
            "Play Surah Al-Kahf in \(.applicationName)",
            "Play Al-Kahf with \(.applicationName)",
        ], shortTitle: "Play Al-Kahf", systemImageName: "play.circle")
        AppShortcut(intent: PlaySurahIntent(), phrases: [
            "Play \(\.$surah) in \(.applicationName)",
            "Recite \(\.$surah) with \(.applicationName)",
        ], shortTitle: "Play a surah", systemImageName: "book")
        AppShortcut(intent: MarkPrayedIntent(), phrases: [
            "I prayed \(\.$prayer) in \(.applicationName)",
            "Mark \(\.$prayer) as prayed in \(.applicationName)",
        ], shortTitle: "I prayed", systemImageName: "checkmark.circle")
        AppShortcut(intent: OpenPageIntent(page: .qibla), phrases: [
            "Find the Qibla with \(.applicationName)",
            "Open \(.applicationName) Qibla",
        ], shortTitle: "Qibla", systemImageName: "location.north.line")
        AppShortcut(intent: StopCountdownIntent(), phrases: [
            "Stop the prayer countdown in \(.applicationName)",
        ], shortTitle: "Stop countdown", systemImageName: "timer")
    }
}
