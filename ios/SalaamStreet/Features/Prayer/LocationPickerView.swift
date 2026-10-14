import SwiftUI
import SalaamStreetCore

/// Choose where prayer times are for: this iPhone's location, a city, or Makkah.
struct LocationPickerView: View {
    @EnvironmentObject private var model: AppModel
    @EnvironmentObject private var location: LocationService
    @EnvironmentObject private var network: NetworkMonitor
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var results: [PrayerLocation] = []
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        List {
            Section {
                Button {
                    Task { await useDevice() }
                } label: {
                    HStack {
                        Label("Use my current location", systemImage: "location.fill")
                        Spacer()
                        if busy { ProgressView() }
                    }
                }
                .disabled(busy)
            } footer: {
                Text("Your location is rounded to about 1 km and used only on this iPhone to calculate times, the Qibla and nearby mosques.")
            }

            Section("Search for a city") {
                TextField("City, e.g. Naperville", text: $query)
                    .textContentType(.addressCity)
                    .submitLabel(.search)
                    .onSubmit { Task { await search() } }
                if !network.isOnline {
                    Text("Searching needs an internet connection. Using your current location works offline.")
                        .font(.footnote).foregroundStyle(Brand.text2)
                }
                ForEach(results, id: \.self) { r in
                    Button(r.name) { choose(r) }
                }
            }

            if let error {
                Section { StatusBanner(kind: .error, text: error).listRowBackground(Color.clear).listRowInsets(EdgeInsets()) }
            }

            Section {
                Button("Use Makkah") { choose(nil) }
                if let current = model.settings.location {
                    LabeledContent("Current", value: current.name)
                }
            }
        }
        .navigationTitle("Location")
    }

    private func useDevice() async {
        busy = true
        error = nil
        defer { busy = false }
        do { choose(try await location.devicePrayerLocation()) }
        catch { self.error = error.localizedDescription }
    }

    private func search() async {
        let q = query.trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty else { return }
        error = nil
        do { results = try await location.search(q) }
        catch { results = []; self.error = error.localizedDescription }
    }

    private func choose(_ loc: PrayerLocation?) {
        model.setLocation(loc)
        dismiss()
    }
}
