import SwiftUI
import SalaamStreetCore

/// The hadith library (the website's 10 collections from fawazahmed0/hadith-api).
/// Downloaded collections open offline; others are read online.
struct HadithCollectionsView: View {
    @EnvironmentObject private var offline: OfflineLibrary
    private let groups: [(id: String, title: String)] = [("forty", "The forties"), ("six", "The Six Books"), ("more", "More collections")]

    var body: some View {
        List {
            ForEach(groups, id: \.id) { g in
                Section(g.title) {
                    ForEach(ContentLibrary.shared.hadithCollections.filter { $0.group == g.id }) { c in
                        NavigationLink { HadithCollectionView(collection: c) } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(c.englishName)
                                    Text(c.complete ? "\(c.lastNumber) hadith" : "Browse by number · 1–\(c.lastNumber)")
                                        .font(.caption).foregroundStyle(Brand.text3)
                                }
                                Spacer()
                                if offline.manifest.isComplete(.hadith(c.id)) {
                                    Image(systemName: "checkmark.circle").foregroundStyle(Brand.primary).accessibilityLabel("Downloaded")
                                }
                                Text(c.arabicName).font(.callout).foregroundStyle(Brand.text2)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Hadith")
    }
}

struct HadithCollectionView: View {
    @EnvironmentObject private var offline: OfflineLibrary
    @EnvironmentObject private var router: Router
    let collection: ContentLibrary.HadithCollection

    @State private var english: HadithEdition?
    @State private var arabic: HadithEdition?
    @State private var single: (en: HadithEdition.Hadith?, ar: HadithEdition.Hadith?)?
    @State private var number = 1
    @State private var error: String?
    @State private var loading = false

    private var downloaded: Bool { offline.manifest.isComplete(.hadith(collection.id)) }

    var body: some View {
        List {
            Section {
                HStack {
                    Label(downloaded ? "Available offline" : "Read online, or download to keep it on this iPhone",
                          systemImage: downloaded ? "checkmark.circle" : "icloud")
                        .font(.footnote).foregroundStyle(downloaded ? Brand.primary : Brand.text2)
                    Spacer()
                    if !downloaded { Button("Offline") { router.show(.offline) }.font(.footnote) }
                }
            }
            if let error {
                Section { StatusBanner(kind: .offline, text: error).listRowInsets(EdgeInsets()).listRowBackground(Color.clear) }
            }
            if collection.complete {
                if let english {
                    ForEach(english.hadiths) { h in
                        HadithView(collection: collection, english: h, arabic: arabic?.hadiths.first { $0.hadithnumber == h.hadithnumber })
                    }
                } else if loading {
                    ProgressView().frame(maxWidth: .infinity)
                }
            } else {
                Section("Hadith number") {
                    Stepper(value: $number, in: 1...collection.lastNumber) {
                        TextField("Number", value: $number, format: .number)
                            .keyboardType(.numberPad)
                            .font(.title3.monospacedDigit())
                    }
                }
                if let single, let en = single.en {
                    HadithView(collection: collection, english: en, arabic: single.ar)
                } else if loading {
                    ProgressView().frame(maxWidth: .infinity)
                }
            }
        }
        .navigationTitle(collection.englishName)
        .task { if collection.complete { await loadWhole() } else { await loadOne() } }
        .onChange(of: number) { _, _ in Task { await loadOne() } }
    }

    private func loadWhole() async {
        if let en = offline.hadith(collection: collection.id, arabic: false) {
            english = en
            arabic = offline.hadith(collection: collection.id, arabic: true)
            return
        }
        loading = true
        defer { loading = false }
        do {
            english = try await fetch(QuranMath.hadithEditionURL(collection.englishEdition))
            arabic = try? await fetch(QuranMath.hadithEditionURL(collection.arabicEdition))
        } catch { self.error = "This collection isn't downloaded and couldn't be loaded. Connect to the internet or download it in Offline." }
    }

    private func loadOne() async {
        let n = min(max(number, 1), collection.lastNumber)
        error = nil
        if let en = offline.hadith(collection: collection.id, arabic: false) {
            let ar = offline.hadith(collection: collection.id, arabic: true)
            single = (en.hadiths.first { Int($0.hadithnumber) == n }, ar?.hadiths.first { Int($0.hadithnumber) == n })
            if single?.en == nil { error = "There's no hadith numbered \(n) in this edition." }
            return
        }
        loading = true
        defer { loading = false }
        do {
            let en = try await fetch(QuranMath.hadithURL(edition: collection.englishEdition, number: n)).hadiths.first
            let ar = try? await fetch(QuranMath.hadithURL(edition: collection.arabicEdition, number: n)).hadiths.first
            if n == number { single = (en, ar) }
        } catch {
            single = nil
            self.error = "Hadith \(n) couldn't be loaded. Connect to the internet, or download \(collection.englishName) in Offline."
        }
    }

    private func fetch(_ url: URL) async throws -> HadithEdition {
        let (data, response) = try await URLSession.shared.data(from: url)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
        return try JSONDecoder().decode(HadithEdition.self, from: data)
    }
}

struct HadithView: View {
    let collection: ContentLibrary.HadithCollection
    let english: HadithEdition.Hadith
    let arabic: HadithEdition.Hadith?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("\(collection.citation) \(english.numberLabel)").font(.caption.weight(.semibold)).foregroundStyle(Brand.primaryStrong)
            if let arabic, !arabic.text.isEmpty { ArabicText(text: arabic.text, size: 22) }
            Text(english.text).font(.body)
            if let grades = english.grades, !grades.isEmpty {
                VStack(alignment: .leading, spacing: 2) {
                    ForEach(grades, id: \.self) { g in
                        Text("\(g.grade) — \(g.name)")
                            .font(.caption)
                            .foregroundStyle(g.grade.lowercased().contains("da") ? Brand.danger : Brand.text2)
                    }
                }
            }
            ShareLink(item: "\(english.text)\n— \(collection.citation) \(english.numberLabel)") {
                Label("Share", systemImage: "square.and.arrow.up").font(.footnote)
            }
            .buttonStyle(.borderless)
        }
        .padding(.vertical, 8)
    }
}
