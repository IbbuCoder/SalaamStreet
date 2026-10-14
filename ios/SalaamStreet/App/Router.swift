import SwiftUI

enum AppTab: Hashable {
    case today, prayer, quran, qibla, more
}

/// Places a deep link can open (also used by the More list).
enum Destination: Hashable {
    case offline, duas, dhikr, names, hadith, mosques, tracker, timetable, settings, about
}

/// Navigation state, and the deep links the Live Activity, notifications and
/// widgets use: salaamstreet://prayer, ://quran/18, ://offline, ://qibla …
@MainActor
final class Router: ObservableObject {
    @Published var tab: AppTab = .today
    @Published var morePath = NavigationPath()
    @Published var quranPath = NavigationPath()
    @Published var prayerPath = NavigationPath()

    func open(_ url: URL) {
        guard url.scheme == "salaamstreet" else { return }
        let parts = ([url.host ?? ""] + url.pathComponents.filter { $0 != "/" }).filter { !$0.isEmpty }
        switch parts.first {
        case "today": tab = .today
        case "prayer":
            tab = .prayer
            prayerPath = NavigationPath()
        case "quran":
            tab = .quran
            quranPath = NavigationPath()
            if parts.count > 1, let n = Int(parts[1]), (1...114).contains(n) {
                let ayah = parts.count > 2 ? Int(parts[2]) ?? 1 : 1
                quranPath.append(SurahRoute(surah: n, ayah: ayah))
            }
        case "qibla": tab = .qibla
        case "offline": show(.offline)
        case "duas": show(.duas)
        case "dhikr": show(.dhikr)
        case "mosques": show(.mosques)
        case "settings": show(.settings)
        default: tab = .today
        }
    }

    func show(_ d: Destination) {
        tab = .more
        morePath = NavigationPath()
        morePath.append(d)
    }
}

/// A surah to open, optionally at an ayah.
struct SurahRoute: Hashable {
    let surah: Int
    var ayah: Int = 1
}
