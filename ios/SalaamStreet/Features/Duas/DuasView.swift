import SwiftUI
import UIKit
import SalaamStreetCore

/// The dua library — the website's own collection, every dua with its source. Bundled, so always offline.
struct DuasView: View {
    @AppStorage("salaamstreet.favouriteDuas") private var favouritesRaw = ""
    @State private var query = ""

    private var favourites: Set<String> { Set(favouritesRaw.split(separator: ",").map(String.init)) }
    private var lib: ContentLibrary { .shared }

    private var results: [ContentLibrary.Dua] {
        let q = query.lowercased()
        return lib.duas.filter { $0.title.lowercased().contains(q) || $0.translation.lowercased().contains(q) || $0.source.lowercased().contains(q) }
    }

    var body: some View {
        List {
            if query.isEmpty {
                let favs = lib.duas.filter { favourites.contains($0.id) }
                if !favs.isEmpty {
                    Section("Favourites") {
                        ForEach(favs) { d in NavigationLink { DuaDetailView(dua: d) } label: { DuaRow(dua: d) } }
                    }
                }
                ForEach(lib.duaCategories) { c in
                    Section {
                        ForEach(lib.duas(in: c.id)) { d in NavigationLink { DuaDetailView(dua: d) } label: { DuaRow(dua: d) } }
                    } header: {
                        Text("\(c.symbol)  \(c.englishName)")
                    }
                }
            } else {
                ForEach(results) { d in NavigationLink { DuaDetailView(dua: d) } label: { DuaRow(dua: d) } }
            }
        }
        .searchable(text: $query, prompt: "Search duas")
        .overlay { if !query.isEmpty && results.isEmpty { ContentUnavailableView.search(text: query) } }
        .navigationTitle("Duas")
    }
}

struct DuaRow: View {
    let dua: ContentLibrary.Dua
    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(dua.title).font(.body)
            Text(dua.source).font(.caption).foregroundStyle(Brand.text3)
        }
        .padding(.vertical, 2)
    }
}

struct DuaDetailView: View {
    @AppStorage("salaamstreet.favouriteDuas") private var favouritesRaw = ""
    let dua: ContentLibrary.Dua

    private var isFavourite: Bool { favouritesRaw.split(separator: ",").contains { String($0) == dua.id } }
    private var shareText: String { "\(dua.title)\n\n\(dua.arabic)\n\n\(dua.transliteration)\n\n\(dua.translation)\n— \(dua.source)" }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text(dua.title).font(.title3.weight(.bold))
                ArabicText(text: dua.arabic, size: 28)
                if !dua.transliteration.isEmpty {
                    Text(dua.transliteration).font(.callout.italic()).foregroundStyle(Brand.text2)
                }
                Text(dua.translation).font(.body)
                Label(dua.source, systemImage: "checkmark.seal").font(.footnote.weight(.medium)).foregroundStyle(Brand.primary)
            }
            .padding(Layout.gutter)
            .frame(maxWidth: 720, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .background(Brand.background)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button {
                    var set = favouritesRaw.split(separator: ",").map(String.init)
                    if isFavourite { set.removeAll { $0 == dua.id } } else { set.append(dua.id) }
                    favouritesRaw = set.joined(separator: ",")
                } label: { Image(systemName: isFavourite ? "heart.fill" : "heart") }
                .accessibilityLabel(isFavourite ? "Remove from favourites" : "Add to favourites")
                .sensoryFeedback(.selection, trigger: isFavourite)
                Button { UIPasteboard.general.string = shareText } label: { Image(systemName: "doc.on.doc") }
                    .accessibilityLabel("Copy")
                ShareLink(item: shareText) { Image(systemName: "square.and.arrow.up") }
            }
        }
    }
}

/// Dhikr counter with sourced presets, haptics and today's totals (on this iPhone).
struct DhikrView: View {
    @AppStorage("salaamstreet.dhikrPreset") private var presetID = "subhanallah"
    @State private var count = 0
    @State private var totals: [String: Int] = LocalStore.load([String: Int].self, key: "dhikr." + DayKey.make(Date())) ?? [:]

    private var preset: ContentLibrary.DhikrPreset {
        ContentLibrary.shared.dhikrPresets.first { $0.id == presetID } ?? ContentLibrary.shared.dhikrPresets[0]
    }

    var body: some View {
        VStack(spacing: 18) {
            Picker("Dhikr", selection: $presetID) {
                ForEach(ContentLibrary.shared.dhikrPresets) { Text($0.title).tag($0.id) }
            }
            .pickerStyle(.menu)
            .onChange(of: presetID) { _, _ in count = 0 }

            VStack(spacing: 6) {
                ArabicText(text: preset.arabic, size: 30).multilineTextAlignment(.center).frame(maxWidth: .infinity, alignment: .center)
                Text(preset.meaning).font(.subheadline).foregroundStyle(Brand.text2)
                Text(preset.source).font(.caption).foregroundStyle(Brand.text3)
            }

            Button {
                count += 1
                totals[preset.id, default: 0] += 1
                LocalStore.save(totals, key: "dhikr." + DayKey.make(Date()))
            } label: {
                ZStack {
                    Circle().fill(Brand.deepGreen)
                    Circle().trim(from: 0, to: min(1, Double(count) / Double(max(preset.target, 1))))
                        .stroke(Brand.mint, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .padding(10)
                        .animation(.easeOut(duration: 0.2), value: count)
                    VStack(spacing: 2) {
                        Text("\(count)").font(.system(size: 64, weight: .semibold, design: .rounded)).monospacedDigit()
                            .contentTransition(.numericText())
                        Text("of \(preset.target)").font(.subheadline)
                    }
                    .foregroundStyle(.white)
                }
                .frame(maxWidth: 280)
                .aspectRatio(1, contentMode: .fit)
            }
            .buttonStyle(.plain)
            .sensoryFeedback(.impact(weight: .light), trigger: count)
            .sensoryFeedback(.success, trigger: count == preset.target)
            .accessibilityLabel("Count \(count) of \(preset.target). Double-tap to count.")

            HStack(spacing: 20) {
                Button { if count > 0 { count -= 1; totals[preset.id, default: 1] -= 1; LocalStore.save(totals, key: "dhikr." + DayKey.make(Date())) } } label: {
                    Label("Undo", systemImage: "arrow.uturn.backward")
                }
                Button(role: .destructive) { count = 0 } label: { Label("Reset", systemImage: "arrow.counterclockwise") }
            }
            .buttonStyle(.bordered)

            Text("Today: \(totals.values.reduce(0, +)) remembrances").font(.footnote).foregroundStyle(Brand.text3)
            Spacer(minLength: 0)
        }
        .padding(Layout.gutter)
        .background(Brand.background)
        .navigationTitle("Dhikr")
    }
}

struct NamesView: View {
    @State private var query = ""
    private var names: [ContentLibrary.NameOfAllah] {
        let q = query.lowercased()
        return q.isEmpty ? ContentLibrary.shared.namesOfAllah
            : ContentLibrary.shared.namesOfAllah.filter { $0.transliteration.lowercased().contains(q) || $0.meaning.lowercased().contains(q) || $0.arabic.contains(query) }
    }

    var body: some View {
        List(names) { n in
            HStack(spacing: 14) {
                Text("\(n.number)").font(.caption.monospacedDigit()).foregroundStyle(Brand.text3).frame(width: 26)
                VStack(alignment: .leading, spacing: 2) {
                    Text(n.transliteration).font(.body.weight(.medium))
                    Text(n.meaning).font(.caption).foregroundStyle(Brand.text2)
                }
                Spacer()
                Text(n.arabic).font(Brand.quran(size: 24)).foregroundStyle(Brand.primary)
            }
            .accessibilityElement(children: .combine)
        }
        .searchable(text: $query)
        .navigationTitle("99 Names of Allah")
    }
}
