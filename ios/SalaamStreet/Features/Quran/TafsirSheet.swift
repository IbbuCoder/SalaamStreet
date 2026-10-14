import SwiftUI
import SalaamStreetCore

/// Tafsir Ibn Kathir (English) for one ayah, with previous/next.
struct TafsirSheet: View {
    @EnvironmentObject private var offline: OfflineLibrary
    @EnvironmentObject private var router: Router
    @Environment(\.dismiss) private var dismiss
    @State var ref: AyahRef
    @State private var text: String?
    @State private var error: String?

    private var count: Int { ContentLibrary.shared.surah(ref.surah)?.ayahCount ?? 1 }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if let text {
                        Text(text).font(.body).textSelection(.enabled)
                        Text(offline.tafsir(surah: ref.surah) != nil ? "Tafsir Ibn Kathir · from your downloads" : "Tafsir Ibn Kathir (English)")
                            .font(.caption).foregroundStyle(Brand.text3)
                    } else if let error {
                        StatusBanner(kind: .offline, text: error)
                        Button("Open Offline downloads") { dismiss(); router.show(.offline) }
                            .buttonStyle(.bordered)
                    } else {
                        ProgressView().frame(maxWidth: .infinity).padding(.top, 40)
                    }
                }
                .padding(Layout.gutter)
            }
            .navigationTitle("Tafsir · \(ref.surah):\(ref.ayah)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Done") { dismiss() } }
                ToolbarItemGroup(placement: .bottomBar) {
                    Button { ref = AyahRef(surah: ref.surah, ayah: ref.ayah - 1) } label: { Label("Previous ayah", systemImage: "chevron.left") }
                        .disabled(ref.ayah <= 1)
                    Spacer()
                    Button { ref = AyahRef(surah: ref.surah, ayah: ref.ayah + 1) } label: { Label("Next ayah", systemImage: "chevron.right") }
                        .disabled(ref.ayah >= count)
                }
            }
            .task(id: ref) { await load() }
        }
    }

    private func load() async {
        text = nil
        error = nil
        do { text = try await QuranRepository.tafsir(surah: ref.surah, ayah: ref.ayah, offline: offline) }
        catch { self.error = "Tafsir for this ayah isn't downloaded and couldn't be loaded. Connect to the internet, or download Tafsir Ibn Kathir in Offline." }
    }
}
