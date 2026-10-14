import SwiftUI
import SalaamStreetCore

/// Everything beyond the four main tabs. Offline comes first.
struct MoreView: View {
    @EnvironmentObject private var offline: OfflineLibrary
    @EnvironmentObject private var network: NetworkMonitor

    var body: some View {
        List {
            Section {
                NavigationLink(value: Destination.offline) {
                    HStack {
                        Label("Offline", systemImage: "arrow.down.circle")
                        Spacer()
                        if !offline.manifest.jobs.isEmpty { Pill(text: "Downloading") }
                        else if !network.isOnline { Pill(text: "You're offline", systemImage: "wifi.slash") }
                        else if offline.manifest.totalBytes > 0 { Text(ByteSize.format(offline.manifest.totalBytes)).foregroundStyle(Brand.text3) }
                    }
                }
            } footer: {
                Text("Download the Qur'an, recitation, tafsir and hadith to use without internet.")
            }
            Section("Worship") {
                NavigationLink(value: Destination.tracker) { Label("Prayer tracker", systemImage: "checkmark.seal") }
                NavigationLink(value: Destination.timetable) { Label("Monthly timetable", systemImage: "calendar") }
                NavigationLink(value: Destination.mosques) { Label("Mosques near me", systemImage: "building.columns") }
                NavigationLink(value: Destination.dhikr) { Label("Dhikr counter", systemImage: "circle.dotted") }
            }
            Section("Knowledge") {
                NavigationLink(value: Destination.duas) { Label("Duas", systemImage: "hands.and.sparkles") }
                NavigationLink(value: Destination.hadith) { Label("Hadith", systemImage: "scroll") }
                NavigationLink(value: Destination.names) { Label("99 Names of Allah", systemImage: "sparkles") }
            }
            Section {
                NavigationLink(value: Destination.settings) { Label("Settings", systemImage: "gearshape") }
                NavigationLink(value: Destination.about) { Label("About", systemImage: "info.circle") }
            }
        }
        .navigationTitle("More")
        .navigationDestination(for: Destination.self) { d in
            switch d {
            case .offline: OfflineView()
            case .duas: DuasView()
            case .dhikr: DhikrView()
            case .names: NamesView()
            case .hadith: HadithCollectionsView()
            case .mosques: MosqueFinderView()
            case .tracker: TrackerView()
            case .timetable: TimetableView()
            case .settings: SettingsView()
            case .about: AboutView()
            }
        }
    }
}

struct AboutView: View {
    private var version: String {
        let v = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "3.0.0"
        let b = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "1"
        return "\(v) Beta (\(b))"
    }

    var body: some View {
        List {
            Section {
                VStack(spacing: 10) {
                    LogoMark(size: 72)
                    Text("SalaamStreet").font(.title2.weight(.bold))
                    Text("Version \(version)").font(.subheadline).foregroundStyle(Brand.text2)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
            }
            Section("Our promise") {
                Text("Everything you need — prayer times, the Qibla, the Qur'an, duas, dhikr and the prayer tracker — stays free. No ads. Your data stays on your iPhone.")
            }
            Section("Sources") {
                LabeledContent("Qur'an text", value: "Tanzil (Uthmani) via AlQuran Cloud")
                LabeledContent("Recitation", value: "Islamic Network CDN")
                LabeledContent("Tafsir", value: "Ibn Kathir (English), spa5k/tafsir_api")
                LabeledContent("Hadith", value: "fawazahmed0/hadith-api")
                LabeledContent("Prayer times", value: "Calculated on device (PrayTimes formulas)")
                LabeledContent("Qur'an font", value: "Scheherazade New, SIL OFL 1.1")
            }
            Section {
                Link("salaamstreet.com", destination: URL(string: "https://salaamstreet.com")!)
            } footer: {
                Text("Downloaded content is fetched by your iPhone directly from these sources and kept only on this device.")
            }
        }
        .navigationTitle("About")
    }
}
