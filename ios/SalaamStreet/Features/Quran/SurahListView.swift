import SwiftUI
import SalaamStreetCore

/// All 114 surahs, with marks for what's downloaded and a way to continue reading.
struct SurahListView: View {
    @EnvironmentObject private var model: AppModel
    @EnvironmentObject private var offline: OfflineLibrary
    @EnvironmentObject private var router: Router
    @State private var query = ""
    @AppStorage("salaamstreet.lastRead") private var lastRead = ""

    private var surahs: [ContentLibrary.Surah] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !q.isEmpty else { return ContentLibrary.shared.surahs }
        return ContentLibrary.shared.surahs.filter {
            String($0.number) == q || $0.englishName.lowercased().contains(q) || $0.meaning.lowercased().contains(q) || $0.arabicName.contains(q)
        }
    }

    private var textReady: Bool {
        offline.manifest.isComplete(.text(QuranRepository.arabicEdition)) && offline.manifest.isComplete(.text(model.settings.translation))
    }

    var body: some View {
        List {
            if query.isEmpty {
                if let route = continueRoute, let meta = ContentLibrary.shared.surah(route.surah) {
                    Section {
                        NavigationLink(value: route) {
                            Label {
                                VStack(alignment: .leading) {
                                    Text("Continue reading").font(.subheadline.weight(.semibold))
                                    Text("\(meta.englishName) · Ayah \(route.ayah)").font(.caption).foregroundStyle(Brand.text2)
                                }
                            } icon: { Image(systemName: "bookmark.fill").foregroundStyle(Brand.primary) }
                        }
                    }
                }
                Section {
                    Button { router.show(.offline) } label: {
                        Label {
                            VStack(alignment: .leading) {
                                Text(textReady ? "The Qur'an is on this iPhone" : "Read the Qur'an offline")
                                    .font(.subheadline.weight(.semibold)).foregroundStyle(Brand.text)
                                Text(textReady ? "Manage downloads, recitation and tafsir" : "Download the text once (\(ByteSize.approx(OfflineEstimate.edition("quran-uthmani") + OfflineEstimate.edition("en.transliteration") + OfflineEstimate.edition(model.settings.translation))))")
                                    .font(.caption).foregroundStyle(Brand.text2)
                            }
                        } icon: { Image(systemName: textReady ? "checkmark.circle.fill" : "arrow.down.circle").foregroundStyle(Brand.primary) }
                    }
                }
            }
            Section {
                ForEach(surahs) { s in
                    NavigationLink(value: SurahRoute(surah: s.number)) { SurahRow(surah: s) }
                }
            }
        }
        .listStyle(.insetGrouped)
        .searchable(text: $query, prompt: "Surah name or number")
        .navigationTitle("Qur'an")
        .navigationDestination(for: SurahRoute.self) { SurahReaderView(route: $0) }
        .overlay {
            if surahs.isEmpty { ContentUnavailableView.search(text: query) }
        }
    }

    private var continueRoute: SurahRoute? {
        let p = lastRead.split(separator: ":").compactMap { Int($0) }
        return p.count == 2 ? SurahRoute(surah: p[0], ayah: p[1]) : nil
    }
}

struct SurahRow: View {
    @EnvironmentObject private var offline: OfflineLibrary
    @EnvironmentObject private var model: AppModel
    let surah: ContentLibrary.Surah

    var body: some View {
        HStack(spacing: 12) {
            Text("\(surah.number)")
                .font(.footnote.weight(.semibold).monospacedDigit())
                .foregroundStyle(Brand.primaryStrong)
                .frame(width: 34, height: 34)
                .background(Brand.primarySoft, in: RoundedRectangle(cornerRadius: 9, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text(surah.englishName).font(.body.weight(.medium))
                Text("\(surah.meaning) · \(surah.ayahCount) ayahs").font(.caption).foregroundStyle(Brand.text3)
            }
            Spacer()
            if offline.hasText(surah: surah.number, editions: [QuranRepository.arabicEdition]) {
                Image(systemName: "checkmark.circle").font(.caption).foregroundStyle(Brand.primary)
                    .accessibilityLabel("Text downloaded")
            }
            if offline.hasAudio(reciter: model.settings.reciter, surah: surah.number) {
                Image(systemName: "waveform").font(.caption).foregroundStyle(Brand.primary)
                    .accessibilityLabel("Recitation downloaded")
            }
            Text(surah.arabicName).font(Brand.quran(size: 20)).foregroundStyle(Brand.text)
        }
        .accessibilityElement(children: .combine)
    }
}
