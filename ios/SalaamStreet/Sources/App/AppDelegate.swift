import CoreSpotlight
import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        Notifications.shared.configure()
        AudioPlayer.shared.emit = { name, data in AppRouter.shared.bridge?.emit(name, data) }
        BackgroundRefresh.register()
        return true
    }

    func application(_ application: UIApplication, configurationForConnecting session: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default", sessionRole: session.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options: UIScene.ConnectionOptions) {
        guard let scene = scene as? UIWindowScene else { return }
        let window = UIWindow(windowScene: scene)
        let web = WebViewController()
        window.rootViewController = web
        window.backgroundColor = UIColor(named: "PageBackground")
        AppTheme.restore(on: window)
        AppRouter.shared.controller = web
        self.window = window
        window.makeKeyAndVisible()

        if let item = options.shortcutItem { AppRouter.shared.handle(shortcut: item) }
        options.urlContexts.forEach { AppRouter.shared.handle(url: $0.url) }
        options.userActivities.forEach { AppRouter.shared.handle(activity: $0) }
        if let response = options.notificationResponse, let hash = response.notification.request.content.userInfo["hash"] as? String {
            AppRouter.shared.open(hash: hash)
        }
    }

    func scene(_ scene: UIScene, openURLContexts contexts: Set<UIOpenURLContext>) {
        contexts.forEach { AppRouter.shared.handle(url: $0.url) }
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        AppRouter.shared.handle(activity: userActivity)
    }

    func windowScene(_ windowScene: UIWindowScene, performActionFor shortcutItem: UIApplicationShortcutItem, completionHandler: @escaping (Bool) -> Void) {
        completionHandler(AppRouter.shared.handle(shortcut: shortcutItem))
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        AppRouter.shared.bridge?.deliverPendingPrayed()
        if let snap = SharedStore.loadSnapshot() {
            Task { await PrayerActivityController.shared.refresh(from: snap) }
        }
    }

    func sceneDidEnterBackground(_ scene: UIScene) {
        BackgroundRefresh.schedule()
    }
}

/// Where iOS entry points (notifications, widgets, Spotlight, Siri, quick
/// actions, sign-in) reach the website.
@MainActor
final class AppRouter {
    static let shared = AppRouter()
    weak var controller: WebViewController?
    var bridge: NativeBridge? { controller?.bridge }
    private var pendingSurah: Int?

    func open(hash: String) { controller?.open(hash: hash) }

    /// salaamstreet://auth-callback?code=…  — sign-in result
    /// salaamstreet://page/qibla            — a page of the site (widgets)
    /// salaamstreet://play/18               — recite a surah
    func handle(url: URL) {
        guard url.scheme == "salaamstreet" else { return }
        switch url.host {
        case "auth-callback":
            AuthFlow.shared.finish()
            var query = URLComponents(url: url, resolvingAgainstBaseURL: false)?.percentEncodedQuery ?? ""
            if query.isEmpty, let frag = url.fragment { query = frag } // errors can come back in the fragment
            guard query.range(of: "(^|&)(code|error|error_description)=", options: .regularExpression) != nil else { return }
            controller?.loadAuthResult(query: query)
        case "page":
            let path = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            if path.range(of: "^[a-z0-9/-]{0,80}$", options: .regularExpression) != nil { open(hash: "#/" + path) }
        case "play":
            if let n = Int(url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))) { playSurah(n) }
        default:
            break
        }
    }

    func handle(activity: NSUserActivity) {
        if activity.activityType == CSSearchableItemActionType,
           let id = activity.userInfo?[CSSearchableItemActivityIdentifier] as? String, id.hasPrefix("#/") {
            open(hash: id)
        }
    }

    @discardableResult
    func handle(shortcut: UIApplicationShortcutItem) -> Bool {
        guard let hash = shortcut.userInfo?["hash"] as? String, hash.hasPrefix("#/") else { return false }
        open(hash: hash)
        return true
    }

    /// Open the surah and start recitation from its first ayah.
    func playSurah(_ n: Int) {
        guard (1...114).contains(n) else { return }
        guard let bridge, bridge.isReady else { pendingSurah = n; open(hash: "#/surah/\(n)"); return }
        bridge.emit("playSurah", ["surah": n])
    }

    /// Called by the bridge once the page is ready.
    func pageReady() {
        if let n = pendingSurah {
            pendingSurah = nil
            bridge?.emit("playSurah", ["surah": n])
        }
    }
}
