import SwiftUI
import SalaamStreetCore

/// The compact player above the tab bar.
struct MiniPlayer: View {
    @EnvironmentObject private var player: QuranAudioPlayer
    let open: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Button(action: open) {
                HStack(spacing: 12) {
                    Image("NowPlayingArtwork").resizable().frame(width: 38, height: 38)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(title).font(.subheadline.weight(.semibold)).lineLimit(1)
                        Text(player.reciterName).font(.caption).foregroundStyle(Brand.text2).lineLimit(1)
                    }
                    Spacer(minLength: 0)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityHint("Opens the player")

            if player.isBuffering { ProgressView().frame(width: 36) }
            Button { player.toggle() } label: {
                Image(systemName: player.isPlaying ? "pause.fill" : "play.fill").font(.title3).frame(width: 40, height: 44)
            }
            .accessibilityLabel(player.isPlaying ? "Pause" : "Play")
            Button { player.next() } label: {
                Image(systemName: "forward.fill").font(.body).frame(width: 36, height: 44)
            }
            .accessibilityLabel("Next ayah")
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(alignment: .bottom) {
            GeometryReader { g in
                Capsule().fill(Brand.primary)
                    .frame(width: g.size.width * (player.duration > 0 ? player.elapsed / player.duration : 0), height: 2)
            }
            .frame(height: 2)
            .padding(.horizontal, 14)
            .accessibilityHidden(true)
        }
        .shadow(color: .black.opacity(0.08), radius: 10, y: 3)
        .alert("Recitation", isPresented: Binding(get: { player.errorMessage != nil }, set: { if !$0 { player.errorMessage = nil } })) {
            Button("OK", role: .cancel) {}
        } message: { Text(player.errorMessage ?? "") }
    }

    private var title: String {
        guard let p = player.position, let s = player.surahMeta else { return "" }
        return "\(s.englishName) · \(p.surah):\(p.ayah)"
    }
}

/// The full player.
struct PlayerSheet: View {
    @EnvironmentObject private var player: QuranAudioPlayer
    @EnvironmentObject private var router: Router
    @Environment(\.dismiss) private var dismiss
    @State private var scrub: Double?

    var body: some View {
        VStack(spacing: 22) {
            Capsule().fill(Brand.border).frame(width: 40, height: 5).padding(.top, 8).accessibilityHidden(true)
            Image("NowPlayingArtwork").resizable().scaledToFit()
                .frame(maxWidth: 260)
                .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                .shadow(color: .black.opacity(0.15), radius: 20, y: 8)
                .accessibilityHidden(true)
            if let s = player.surahMeta, let p = player.position {
                VStack(spacing: 4) {
                    Text(s.arabicName).font(Brand.quran(size: 30))
                    Text("\(s.englishName) · Ayah \(p.ayah) of \(s.ayahCount)").font(.headline)
                    Text(player.reciterName).font(.subheadline).foregroundStyle(Brand.text2)
                    if player.playingFromDevice { Pill(text: "Playing from your downloads", systemImage: "arrow.down.circle") }
                }
                .accessibilityElement(children: .combine)
            }

            VStack(spacing: 4) {
                Slider(value: Binding(get: { scrub ?? player.elapsed }, set: { scrub = $0 }),
                       in: 0...max(player.duration, 1)) { editing in
                    if !editing, let s = scrub { player.seek(to: s); scrub = nil }
                }
                .accessibilityLabel("Position in this ayah")
                HStack {
                    Text(time(scrub ?? player.elapsed))
                    Spacer()
                    Text(time(player.duration))
                }
                .font(.caption.monospacedDigit()).foregroundStyle(Brand.text3)
            }

            HStack(spacing: 44) {
                Button { player.previous() } label: { Image(systemName: "backward.fill").font(.title) }
                    .accessibilityLabel("Previous ayah")
                Button { player.toggle() } label: {
                    Image(systemName: player.isPlaying ? "pause.circle.fill" : "play.circle.fill").font(.system(size: 64))
                }
                .accessibilityLabel(player.isPlaying ? "Pause" : "Play")
                Button { player.next() } label: { Image(systemName: "forward.fill").font(.title) }
                    .accessibilityLabel("Next ayah")
            }
            .foregroundStyle(Brand.primary)

            HStack {
                Menu {
                    Picker("Repeat each ayah", selection: $player.repeatTimes) {
                        Text("Off").tag(1)
                        Text("3×").tag(3)
                        Text("5×").tag(5)
                        Text("10×").tag(10)
                    }
                } label: {
                    Label(player.repeatTimes > 1 ? "Repeat \(player.repeatTimes)×" : "Repeat", systemImage: "repeat")
                }
                Spacer()
                Menu {
                    Picker("Speed", selection: $player.rate) {
                        ForEach([0.75, 1.0, 1.25, 1.5] as [Float], id: \.self) { Text(String(format: "%.2g×", $0)).tag($0) }
                    }
                } label: {
                    Label(String(format: "%.2g×", player.rate), systemImage: "speedometer")
                }
            }
            .font(.subheadline)

            HStack {
                if let p = player.position {
                    Button("Open in reader") {
                        dismiss()
                        router.open(URL(string: "salaamstreet://quran/\(p.surah)/\(p.ayah)")!)
                    }
                }
                Spacer()
                Button("Stop", role: .destructive) { player.stop(); dismiss() }
            }
            .font(.subheadline)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 24)
        .presentationDragIndicator(.hidden)
    }

    private func time(_ s: Double) -> String {
        guard s.isFinite, s > 0 else { return "0:00" }
        return String(format: "%d:%02d", Int(s) / 60, Int(s) % 60)
    }
}
