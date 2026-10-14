import SwiftUI
import UIKit
import SalaamStreetCore

/// The reader: Uthmani Arabic, translation and optional transliteration, with
/// recitation from any ayah and Tafsir Ibn Kathir.
struct SurahReaderView: View {
    @EnvironmentObject private var model: AppModel
    @EnvironmentObject private var offline: OfflineLibrary
    @EnvironmentObject private var player: QuranAudioPlayer
    @EnvironmentObject private var router: Router
    @AppStorage("salaamstreet.lastRead") private var lastRead = ""
    let route: SurahRoute

    @State private var content: SurahContent?
    @State private var error: String?
    @State private var tafsirAyah: Int?

    private var meta: ContentLibrary.Surah { ContentLibrary.shared.surah(route.surah)! }

    var body: some View {
        ScrollViewReader { proxy in
            List {
                header
                if let error {
                    VStack(spacing: 12) {
                        StatusBanner(kind: .offline, text: error)
                        HStack {
                            Button("Try again") { Task { await load() } }.buttonStyle(.bordered)
                            Button("Open Offline") { router.show(.offline) }.buttonStyle(.borderedProminent)
                        }
                    }
                    .listRowSeparator(.hidden)
                } else if let content {
                    if let note = content.note { StatusBanner(kind: .info, text: note).listRowSeparator(.hidden) }
                    if content.origin == .recentCache {
                        StatusBanner(kind: .offline, text: "You're offline — showing the copy saved when you last read this surah.").listRowSeparator(.hidden)
                    }
                    ForEach(Array(content.arabic.enumerated()), id: \.offset) { i, arabic in
                        AyahView(surah: route.surah, ayah: i + 1, arabic: i == 0 ? QuranMath.stripBasmala(arabic, surah: route.surah) : arabic,
                                 translation: model.settings.showTranslation ? content.translation?[safe: i] : nil,
                                 transliteration: model.settings.showTransliteration ? content.transliteration?[safe: i] : nil,
                                 isPlaying: player.position == QuranAudioPlayer.Position(surah: route.surah, ayah: i + 1),
                                 play: { player.play(surah: route.surah, ayah: i + 1, reciter: model.settings.reciter) },
                                 tafsir: { tafsirAyah = i + 1 })
                            .id(i + 1)
                            .onAppear { lastRead = "\(route.surah):\(i + 1)" }
                    }
                } else {
                    HStack { Spacer(); ProgressView("Loading \(meta.englishName)…"); Spacer() }
                        .padding(.vertical, 40)
                        .listRowSeparator(.hidden)
                }
            }
            .listStyle(.plain)
            .task {
                await load()
                if route.ayah > 1 { proxy.scrollTo(route.ayah, anchor: .top) }
            }
            .onChange(of: player.position) { _, p in
                guard let p, p.surah == route.surah else { return }
                withAnimation { proxy.scrollTo(p.ayah, anchor: .center) }
            }
        }
        .navigationTitle(meta.englishName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    if player.position?.surah == route.surah { player.toggle() }
                    else { player.play(surah: route.surah, ayah: 1, reciter: model.settings.reciter) }
                } label: {
                    Image(systemName: player.position?.surah == route.surah && player.isPlaying ? "pause.circle.fill" : "play.circle.fill")
                        .font(.title2)
                }
                .accessibilityLabel(player.position?.surah == route.surah && player.isPlaying ? "Pause recitation" : "Play the surah")
            }
        }
        .sheet(item: Binding(get: { tafsirAyah.map { AyahRef(surah: route.surah, ayah: $0) } }, set: { tafsirAyah = $0?.ayah })) { ref in
            TafsirSheet(ref: ref)
                .presentationDetents([.medium, .large])
        }
        .onChange(of: model.settings.translation) { _, _ in Task { await load() } }
    }

    private var header: some View {
        VStack(spacing: 8) {
            Text(meta.arabicName).font(Brand.quran(size: 34))
            Text("\(meta.englishName) · \(meta.meaning)").font(.subheadline.weight(.semibold))
            Text("\(meta.isMeccan ? "Meccan" : "Medinan") · \(meta.ayahCount) ayahs").font(.caption).foregroundStyle(Brand.text3)
            if route.surah != 1 && route.surah != 9 {
                ArabicText(text: "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ", size: 26, scale: model.settings.arabicScale)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.top, 6)
            }
            if offline.hasAudio(reciter: model.settings.reciter, surah: route.surah) {
                Pill(text: "Recitation downloaded", systemImage: "arrow.down.circle")
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .listRowSeparator(.hidden)
        .accessibilityElement(children: .combine)
    }

    private func load() async {
        error = nil
        do { content = try await QuranRepository.load(surah: route.surah, translation: model.settings.translation, offline: offline) }
        catch { self.error = error.localizedDescription }
    }
}

struct AyahRef: Identifiable, Hashable {
    let surah: Int, ayah: Int
    var id: String { "\(surah):\(ayah)" }
}

struct AyahView: View {
    @EnvironmentObject private var model: AppModel
    let surah: Int, ayah: Int
    let arabic: String
    let translation: String?
    let transliteration: String?
    let isPlaying: Bool
    let play: () -> Void
    let tafsir: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("\(surah):\(ayah)")
                    .font(.caption.weight(.semibold).monospacedDigit())
                    .foregroundStyle(Brand.primaryStrong)
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(Brand.primarySoft, in: Capsule())
                Spacer()
                Menu {
                    Button { play() } label: { Label("Play from here", systemImage: "play") }
                    Button { tafsir() } label: { Label("Tafsir Ibn Kathir", systemImage: "text.book.closed") }
                    Button {
                        UIPasteboard.general.string = arabic + "\n\n" + (translation ?? "") + "\n— Qur'an \(surah):\(ayah)"
                    } label: { Label("Copy", systemImage: "doc.on.doc") }
                    ShareLink(item: arabic + "\n\n" + (translation ?? "") + "\n— Qur'an \(surah):\(ayah)") {
                        Label("Share", systemImage: "square.and.arrow.up")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle").font(.title3).frame(width: 44, height: 44)
                }
                .accessibilityLabel("Actions for ayah \(ayah)")
            }
            ArabicText(text: arabic, size: 28, scale: model.settings.arabicScale)
            if let transliteration {
                Text(transliteration).font(.callout.italic()).foregroundStyle(Brand.text2)
            }
            if let translation {
                Text(translation).font(.body).foregroundStyle(Brand.text)
                    .environment(\.layoutDirection, ContentLibrary.shared.translation(model.settings.translation)?.rightToLeft == true ? .rightToLeft : .leftToRight)
            }
        }
        .padding(.vertical, 10)
        .listRowBackground(isPlaying ? Brand.primarySoft : Color.clear)
        .accessibilityElement(children: .contain)
    }
}

extension Array {
    subscript(safe i: Int) -> Element? { indices.contains(i) ? self[i] : nil }
}
