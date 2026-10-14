import SwiftUI
import SalaamStreetCore

/// Offline: choose what to keep on this iPhone, watch downloads, see the space
/// they use and remove them — plus a plain list of what always works offline
/// and what needs a connection.
struct OfflineView: View {
    @EnvironmentObject private var offline: OfflineLibrary
    @EnvironmentObject private var network: NetworkMonitor
    @EnvironmentObject private var model: AppModel
    @State private var reciter: String?
    @State private var confirm: PendingDownload?
    @State private var confirmRemoveAll = false

    struct PendingDownload: Identifiable {
        let id = UUID()
        let title: String
        let bytes: Int64
        let run: () -> Void
    }

    private var lib: ContentLibrary { .shared }
    private var currentReciter: String { reciter ?? model.settings.reciter }
    private var baseText: [OfflinePackID] {
        [.text(QuranRepository.arabicEdition), .text(QuranRepository.transliteration), .text(model.settings.translation)]
    }

    var body: some View {
        List {
            statusSection
            quranSection
            recitationSection
            tafsirSection
            hadithSection
            builtInSection
            needsInternetSection
            if offline.manifest.totalBytes > 0 || !offline.manifest.jobs.isEmpty {
                Section {
                    Button("Remove all downloads", role: .destructive) { confirmRemoveAll = true }
                } footer: {
                    Text("Downloads are kept only on this iPhone and aren't backed up to iCloud, since they can be downloaded again.")
                }
            }
        }
        .navigationTitle("Offline")
        .onAppear { offline.refreshDiskUsage() }
        .alert(confirm?.title ?? "", isPresented: Binding(get: { confirm != nil }, set: { if !$0 { confirm = nil } })) {
            Button("Download") { confirm?.run(); confirm = nil }
            Button("Cancel", role: .cancel) { confirm = nil }
        } message: {
            Text("This is \(ByteSize.approx(confirm?.bytes ?? 0)).\(network.isExpensive ? " You're on mobile data, which may cost you; Wi-Fi is better for large downloads." : "")")
        }
        .confirmationDialog("Remove everything downloaded for offline use?", isPresented: $confirmRemoveAll, titleVisibility: .visible) {
            Button("Remove all downloads", role: .destructive) { offline.removeAll() }
        } message: {
            Text("Your settings, tracker and favourites are kept. Prayer times keep working offline.")
        }
        .alert("Offline", isPresented: Binding(get: { offline.notice != nil }, set: { if !$0 { offline.notice = nil } })) {
            Button("OK", role: .cancel) {}
        } message: { Text(offline.notice ?? "") }
    }

    // MARK: Sections

    private var statusSection: some View {
        Section {
            HStack(spacing: 12) {
                Image(systemName: network.isOnline ? "wifi" : "wifi.slash")
                    .font(.title2)
                    .foregroundStyle(network.isOnline ? Brand.primary : Brand.gold)
                    .frame(width: 32)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(network.isOnline ? "You're online" : "You're offline").font(.headline)
                    Text(network.isOnline ? "Download what you want to keep for when you have no connection."
                         : "Everything below marked as downloaded works now. Downloads continue when you reconnect.")
                        .font(.footnote).foregroundStyle(Brand.text2)
                }
            }
            .accessibilityElement(children: .combine)
            LabeledContent("Used by SalaamStreet downloads", value: ByteSize.format(offline.diskBytes ?? offline.manifest.totalBytes))
            if let free = offline.freeSpace {
                LabeledContent("Free on this iPhone", value: ByteSize.format(free))
            }
        }
    }

    private var quranSection: some View {
        Section {
            MultiPackRow(title: "Qur'an text", icon: "book",
                         subtitle: "Arabic (Uthmani), transliteration and \(lib.translation(model.settings.translation)?.label ?? "your translation")",
                         packs: baseText, unitsPerPack: 114,
                         estimate: baseText.reduce(0) { $0 + OfflineEstimate.edition($1.key) }) {
                ask("Download the Qur'an text?", baseText.reduce(0) { $0 + offline.estimate($1, units: Array(1...114)) }) {
                    baseText.forEach { offline.download($0, units: Array(1...114)) }
                }
            }
            DisclosureGroup("Other translations") {
                ForEach(lib.translations.filter { $0.id != model.settings.translation }) { t in
                    PackRow(pack: .text(t.id), title: t.label, subtitle: nil, icon: nil, estimate: OfflineEstimate.edition(t.id), unitCount: 114) {
                        offline.download(.text(t.id), units: Array(1...114))
                    }
                }
            }
        } header: {
            Text("Qur'an")
        } footer: {
            Text("Text from Tanzil via AlQuran Cloud, downloaded straight to this iPhone.")
        }
    }

    private var recitationSection: some View {
        let id = OfflinePackID.audio(currentReciter)
        let have = offline.manifest.pack(id)?.units.count ?? 0
        let missing = (1...114).filter { !offline.manifest.has(id, unit: $0) }
        return Section {
            Picker("Reciter", selection: Binding(get: { currentReciter }, set: { reciter = $0 })) {
                ForEach(lib.reciters) { Text($0.englishName).tag($0.id) }
            }
            if let job = offline.manifest.job(id) {
                JobRow(job: job)
            } else if have >= 114 {
                DownloadedRow(title: "All 114 surahs", bytes: offline.manifest.bytes(id)) { offline.remove(id) }
            } else {
                Button {
                    ask("Download recitation of \(have > 0 ? "the remaining \(missing.count) surahs" : "the whole Qur'an")?", offline.estimate(id, units: missing)) {
                        offline.download(id, units: missing)
                    }
                } label: {
                    HStack {
                        Label(have > 0 ? "Download the rest" : "Download all 114 surahs", systemImage: "arrow.down.circle")
                        Spacer()
                        Text(ByteSize.approx(offline.estimate(id, units: missing))).font(.footnote).foregroundStyle(Brand.text3)
                    }
                }
                if have > 0 {
                    LabeledContent("Downloaded", value: "\(have) of 114 surahs · \(ByteSize.format(offline.manifest.bytes(id)))")
                }
            }
            NavigationLink {
                SurahAudioDownloadsView(reciter: currentReciter)
            } label: {
                Label("Choose surahs", systemImage: "list.bullet")
            }
        } header: {
            Text("Recitation")
        } footer: {
            Text("Downloaded recitation plays without internet, including with the screen locked. Recitation from the Islamic Network CDN.")
        }
    }

    private var tafsirSection: some View {
        Section {
            PackRow(pack: .tafsir, title: "Tafsir Ibn Kathir", subtitle: "English, for every ayah", icon: "text.book.closed",
                    estimate: OfflineEstimate.tafsir, unitCount: 114) {
                ask("Download Tafsir Ibn Kathir?", OfflineEstimate.tafsir) { offline.download(.tafsir, units: Array(1...114)) }
            }
        } header: {
            Text("Tafsir")
        } footer: {
            Text("From the open spa5k/tafsir_api project, as used on salaamstreet.com.")
        }
    }

    private var hadithSection: some View {
        Section {
            ForEach(lib.hadithCollections) { c in
                PackRow(pack: .hadith(c.id), title: c.englishName, subtitle: "English and Arabic · \(c.lastNumber) hadith", icon: nil,
                        estimate: OfflineEstimate.hadith(lastNumber: c.lastNumber), unitCount: 2) {
                    ask("Download \(c.englishName)?", OfflineEstimate.hadith(lastNumber: c.lastNumber)) {
                        offline.download(.hadith(c.id), units: [1, 2])
                    }
                }
            }
        } header: {
            Text("Hadith")
        } footer: {
            Text("From the open fawazahmed0/hadith-api. Sizes are estimates until downloaded.")
        }
    }

    private var builtInSection: some View {
        Section {
            BuiltInRow(icon: "clock", title: "Prayer times & timetables", detail: "Calculated on your iPhone for any date — no download needed.")
            BuiltInRow(icon: "location.north.line", title: "Qibla compass", detail: "Calculated on your iPhone.")
            BuiltInRow(icon: "hands.and.sparkles", title: "Duas & dhikr", detail: "\(lib.duas.count) duas with sources and \(lib.dhikrPresets.count) dhikr presets, built in.")
            BuiltInRow(icon: "sparkles", title: "99 Names of Allah", detail: "Built in.")
            BuiltInRow(icon: "bell", title: "Reminders, tracker & Lock Screen countdown", detail: "Work without internet once set up.")
        } header: {
            Text("Always available offline")
        }
    }

    private var needsInternetSection: some View {
        Section {
            BuiltInRow(icon: "icloud", title: "Anything not downloaded", detail: "Surahs, translations, recitation, tafsir and hadith stream when you're online.", needsNetwork: true)
            BuiltInRow(icon: "magnifyingglass", title: "Searching for a city", detail: "Use your current location instead when offline.", needsNetwork: true)
            BuiltInRow(icon: "building.columns", title: "Mosque finder", detail: "Uses Apple Maps.", needsNetwork: true)
        } header: {
            Text("Needs an internet connection")
        }
    }

    private func ask(_ title: String, _ bytes: Int64, run: @escaping () -> Void) {
        // Small downloads start straight away; large ones (or any on mobile data over 20 MB) are confirmed.
        if bytes >= 100 * OfflineEstimate.megabyte || (network.isExpensive && bytes >= 20 * OfflineEstimate.megabyte) {
            confirm = PendingDownload(title: title, bytes: bytes, run: run)
        } else {
            run()
        }
    }
}

// MARK: - Rows

/// One downloadable pack in any state.
struct PackRow: View {
    @EnvironmentObject private var offline: OfflineLibrary
    let pack: OfflinePackID
    let title: String
    let subtitle: String?
    let icon: String?
    let estimate: Int64
    let unitCount: Int
    let start: () -> Void

    var body: some View {
        let p = offline.manifest.pack(pack)
        if let job = offline.manifest.job(pack) {
            VStack(alignment: .leading, spacing: 6) {
                RowTitle(title: title, subtitle: subtitle, icon: icon)
                JobRow(job: job)
            }
        } else if let p, p.isComplete {
            DownloadedRow(title: title, subtitle: subtitle, icon: icon, bytes: p.bytes) { offline.remove(pack) }
        } else {
            HStack {
                RowTitle(title: title, subtitle: subtitle.map { $0 + " · " + ByteSize.approx(estimate) } ?? ByteSize.approx(estimate), icon: icon)
                Spacer()
                Button(action: start) {
                    Image(systemName: "arrow.down.circle").font(.title2).frame(width: 44, height: 44)
                }
                .buttonStyle(.borderless)
                .accessibilityLabel("Download \(title)")
            }
        }
    }
}

/// Several packs that make one item (the Qur'an text: Arabic, transliteration, translation).
struct MultiPackRow: View {
    @EnvironmentObject private var offline: OfflineLibrary
    let title: String
    let icon: String
    let subtitle: String
    let packs: [OfflinePackID]
    let unitsPerPack: Int
    let estimate: Int64
    let start: () -> Void

    var body: some View {
        let jobs = packs.compactMap { offline.manifest.job($0) }
        let complete = packs.allSatisfy { offline.manifest.isComplete($0) }
        if !jobs.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                RowTitle(title: title, subtitle: subtitle, icon: icon)
                ForEach(jobs) { JobRow(job: $0) }
            }
        } else if complete {
            DownloadedRow(title: title, subtitle: subtitle, icon: icon, bytes: packs.reduce(0) { $0 + offline.manifest.bytes($1) }) {
                packs.forEach { offline.remove($0) }
            }
        } else {
            HStack {
                RowTitle(title: title, subtitle: subtitle + " · " + ByteSize.approx(estimate), icon: icon)
                Spacer()
                Button(action: start) { Image(systemName: "arrow.down.circle").font(.title2).frame(width: 44, height: 44) }
                    .buttonStyle(.borderless)
                    .accessibilityLabel("Download \(title)")
            }
        }
    }
}

struct RowTitle: View {
    let title: String
    let subtitle: String?
    let icon: String?
    var body: some View {
        HStack(spacing: 12) {
            if let icon { Image(systemName: icon).foregroundStyle(Brand.primary).frame(width: 24).accessibilityHidden(true) }
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                if let subtitle { Text(subtitle).font(.caption).foregroundStyle(Brand.text3) }
            }
        }
        .accessibilityElement(children: .combine)
    }
}

struct DownloadedRow: View {
    let title: String
    var subtitle: String? = nil
    var icon: String? = nil
    let bytes: Int64
    let remove: () -> Void
    @State private var confirm = false

    var body: some View {
        HStack {
            RowTitle(title: title, subtitle: [subtitle, "Downloaded · \(ByteSize.format(bytes))"].compactMap { $0 }.joined(separator: " · "), icon: icon)
            Spacer()
            Image(systemName: "checkmark.circle.fill").foregroundStyle(Brand.primary).accessibilityHidden(true)
        }
        .swipeActions { Button("Remove", role: .destructive) { confirm = true } }
        .contextMenu { Button("Remove download", systemImage: "trash", role: .destructive) { confirm = true } }
        .confirmationDialog("Remove \(title)?", isPresented: $confirm, titleVisibility: .visible) {
            Button("Remove", role: .destructive, action: remove)
        } message: { Text("You can download it again at any time.") }
        .accessibilityAction(named: "Remove download") { confirm = true }
    }
}

/// Progress and controls for a download.
struct JobRow: View {
    @EnvironmentObject private var offline: OfflineLibrary
    let job: DownloadJob

    var body: some View {
        let p = offline.progress[job.id]
        VStack(alignment: .leading, spacing: 6) {
            ThinProgress(value: p?.fraction ?? 0)
            HStack {
                Text(statusText(p)).font(.caption).foregroundStyle(job.status == .failed ? Brand.danger : Brand.text2)
                Spacer()
                switch job.status {
                case .running, .queued:
                    Button("Pause") { offline.pause(job.pack) }
                case .paused, .failed, .waitingForNetwork:
                    Button(job.status == .failed ? "Retry" : "Resume") { offline.resume(job.pack) }
                }
                Button("Cancel", role: .destructive) { offline.cancel(job.pack) }
            }
            .font(.caption.weight(.semibold))
            .buttonStyle(.borderless)
        }
        .accessibilityElement(children: .contain)
    }

    private func statusText(_ p: OfflineLibrary.Progress?) -> String {
        let counts = p.map { "\($0.done) of \($0.total) · \(ByteSize.format($0.bytes))" } ?? ""
        switch job.status {
        case .queued: return "Waiting to start" + (counts.isEmpty ? "" : " · " + counts)
        case .running: return "Downloading " + counts
        case .paused: return "Paused · " + counts
        case .waitingForNetwork: return "Waiting for a connection"
        case .failed: return job.failure?.message ?? OfflineError.failed.message
        }
    }
}

struct BuiltInRow: View {
    let icon: String
    let title: String
    let detail: String
    var needsNetwork = false
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon).foregroundStyle(needsNetwork ? Brand.text3 : Brand.primary).frame(width: 24)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                Text(detail).font(.caption).foregroundStyle(Brand.text3)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// Recitation downloads surah by surah.
struct SurahAudioDownloadsView: View {
    @EnvironmentObject private var offline: OfflineLibrary
    let reciter: String

    var body: some View {
        let id = OfflinePackID.audio(reciter)
        let job = offline.manifest.job(id)
        List {
            if let job { Section { JobRow(job: job) } }
            Section {
                ForEach(ContentLibrary.shared.surahs) { s in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("\(s.number). \(s.englishName)")
                            Text(offline.manifest.has(id, unit: s.number)
                                 ? "Downloaded · \(ByteSize.format(offline.manifest.pack(id)?.units[s.number] ?? 0))"
                                 : ByteSize.approx(offline.estimate(id, units: [s.number])))
                                .font(.caption).foregroundStyle(Brand.text3)
                        }
                        Spacer()
                        if offline.manifest.has(id, unit: s.number) {
                            Button { offline.remove(id, units: [s.number]) } label: {
                                Image(systemName: "trash").frame(width: 44, height: 44)
                            }
                            .tint(Brand.danger)
                            .accessibilityLabel("Remove \(s.englishName) recitation")
                        } else if job?.units.contains(s.number) == true {
                            Text("In queue").font(.caption).foregroundStyle(Brand.text3)
                        } else {
                            Button { offline.download(id, units: [s.number]) } label: {
                                Image(systemName: "arrow.down.circle").font(.title3).frame(width: 44, height: 44)
                            }
                            .accessibilityLabel("Download \(s.englishName) recitation")
                        }
                    }
                    .buttonStyle(.borderless)
                }
            } footer: {
                Text("Reciter: \(ContentLibrary.shared.reciter(reciter)?.englishName ?? reciter)")
            }
        }
        .navigationTitle("Choose surahs")
    }
}
