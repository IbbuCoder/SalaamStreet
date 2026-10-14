import SwiftUI
import SalaamStreetCore

/// Tab navigation that mirrors the website's phone layout (Home, Prayer,
/// Qur'an, Qibla, More); Offline is first in More and one tap from Today and the
/// Qur'an. The mini player sits above the tab bar whenever recitation is loaded.
struct RootView: View {
    @EnvironmentObject private var router: Router
    @EnvironmentObject private var model: AppModel

    var body: some View {
        TabView(selection: $router.tab) {
            NavigationStack { TodayView() }
                .withMiniPlayer()
                .tabItem { Label("Today", systemImage: "sun.horizon") }
                .tag(AppTab.today)

            NavigationStack(path: $router.prayerPath) { PrayerTimesView() }
                .withMiniPlayer()
                .tabItem { Label("Prayer", systemImage: "clock") }
                .tag(AppTab.prayer)

            NavigationStack(path: $router.quranPath) { SurahListView() }
                .withMiniPlayer()
                .tabItem { Label("Qur'an", systemImage: "book") }
                .tag(AppTab.quran)

            NavigationStack { QiblaView() }
                .tabItem { Label("Qibla", systemImage: "location.north.line") }
                .tag(AppTab.qibla)

            NavigationStack(path: $router.morePath) { MoreView() }
                .withMiniPlayer()
                .tabItem { Label("More", systemImage: "square.grid.2x2") }
                .tag(AppTab.more)
        }
        .tint(Brand.primary)
        .preferredColorScheme(model.settings.appearance.colorScheme)
        .sheet(isPresented: Binding(get: { !model.settings.hasCompletedWelcome }, set: { _ in })) {
            WelcomeView().interactiveDismissDisabled()
        }
    }
}

private struct MiniPlayerInset: ViewModifier {
    @EnvironmentObject private var player: QuranAudioPlayer
    @State private var showPlayer = false

    func body(content: Content) -> some View {
        content
            .safeAreaInset(edge: .bottom, spacing: 0) {
                if player.isActive {
                    MiniPlayer { showPlayer = true }
                        .padding(.horizontal, 12)
                        .padding(.bottom, 8)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .animation(.snappy, value: player.isActive)
            .sheet(isPresented: $showPlayer) { PlayerSheet() }
    }
}

extension View {
    func withMiniPlayer() -> some View { modifier(MiniPlayerInset()) }
}
