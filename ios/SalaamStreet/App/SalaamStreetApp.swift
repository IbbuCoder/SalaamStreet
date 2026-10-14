import SwiftUI
import BackgroundTasks
import UserNotifications
import SalaamStreetCore

@main
struct SalaamStreetApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var services = AppServices.shared
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(services.model)
                .environmentObject(services.router)
                .environmentObject(services.offline)
                .environmentObject(services.player)
                .environmentObject(services.network)
                .environmentObject(services.location)
                .environmentObject(services.notifications)
                .environmentObject(services.liveActivity)
                .onOpenURL { services.router.open($0) }
                .onReceive(services.network.$isOnline) { services.offline.networkChanged(online: $0) }
        }
        .onChange(of: scenePhase) { _, phase in
            switch phase {
            case .active: services.model.becameActive()
            case .background: BackgroundRefresh.schedule(builder: services.model.builder)
            default: break
            }
        }
    }
}

/// The long-lived objects, created once.
@MainActor
final class AppServices: ObservableObject {
    static let shared = AppServices()

    let notifications = NotificationService()
    let liveActivity = LiveActivityController()
    let offline = OfflineLibrary()
    let network = NetworkMonitor()
    let location = LocationService()
    let router = Router()
    let model: AppModel
    let player: QuranAudioPlayer

    private init() {
        model = AppModel(notifications: notifications, liveActivity: liveActivity)
        player = QuranAudioPlayer(offline: offline)
        player.continuousPlay = { [weak model = self.model] in model?.settings.continuousPlay ?? false }
    }
}

extension AppearancePreference {
    var colorScheme: ColorScheme? {
        switch self {
        case .system: return nil
        case .light: return .light
        case .dark: return .dark
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        BackgroundRefresh.register()
        return true
    }

    /// Show reminders even while SalaamStreet is open.
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .list]
    }

    /// "I prayed" ticks the tracker; tapping a reminder opens the right screen.
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        let info = response.notification.request.content.userInfo
        let link = info["link"] as? String
        let prayer = (info["prayer"] as? String).flatMap(Prayer.init(rawValue:))
        let day = info["day"] as? String ?? ""
        let action = response.actionIdentifier
        await MainActor.run {
            let s = AppServices.shared
            if action == NotificationService.prayedAction, let prayer, !day.isEmpty {
                s.model.markPrayed(prayer, dayKey: day)
            } else if let link, let url = URL(string: link) {
                s.router.open(url)
            }
        }
    }
}

/// Background refresh: iOS decides when (if ever) this runs. When it does,
/// reminders are re-planned and the Live Activity moves on to the next prayer.
enum BackgroundRefresh {
    static let identifier = "com.salaamstreet.app.refresh"

    static func register() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: identifier, using: nil) { task in
            guard let task = task as? BGAppRefreshTask else { return }
            Task { @MainActor in
                let m = AppServices.shared.model
                m.liveActivity.refreshIfNeeded(builder: m.builder)
                m.notifications.reschedule(builder: m.builder, preferences: m.settings.reminders)
                schedule(builder: m.builder)
                task.setTaskCompleted(success: true)
            }
            task.expirationHandler = { task.setTaskCompleted(success: false) }
        }
    }

    /// Ask to run just after the next prayer begins (+16 min, when the Live Activity should move on).
    @MainActor
    static func schedule(builder: PrayerScheduleBuilder) {
        let request = BGAppRefreshTaskRequest(identifier: identifier)
        let next = builder.next(after: Date())?.date ?? Date().addingTimeInterval(3600)
        request.earliestBeginDate = next.addingTimeInterval(PrayerActivityPlanner.holdAfterStart + 60)
        try? BGTaskScheduler.shared.submit(request)
    }
}
