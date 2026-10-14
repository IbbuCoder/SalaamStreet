import SafariServices
import UIKit
import WebKit

/// The whole app: one full-screen WKWebView running the bundled website.
/// No native navigation bar or header — the site draws its own, and handles
/// the notch and home indicator with env(safe-area-inset-*).
final class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    static let liveSiteURL = URL(string: "https://salaamstreet.com/")!

    private(set) var webView: WKWebView!
    let schemeHandler = AppSchemeHandler()
    let bridge = NativeBridge()
    private var didFinishFirstLoad = false
    /// Hash routes asked for before the page finished loading (quick actions, Spotlight, widgets).
    private var pendingHash: String?
    /// For screenshot comparisons only: `-SSCompareLiveSite YES` loads salaamstreet.com instead of the bundle.
    private let compareLiveSite = UserDefaults.standard.bool(forKey: "SSCompareLiveSite")
    /// Tests only (`-SSBlockNetwork YES`): every http(s) request fails, as with no connection.
    var blockNetwork = UserDefaults.standard.bool(forKey: "SSBlockNetwork")

    override func loadView() {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(schemeHandler, forURLScheme: AppSchemeHandler.scheme)
        config.websiteDataStore = .default()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.applicationNameForUserAgent = "SalaamStreetApp/\(AppInfo.version)"
        config.preferences.javaScriptCanOpenWindowsAutomatically = false
        config.defaultWebpagePreferences.preferredContentMode = .mobile

        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.allowsBackForwardNavigationGestures = true // edge swipe = the site's back (hash history)
        web.allowsLinkPreview = false
        web.isOpaque = false
        web.backgroundColor = UIColor(named: "PageBackground")
        web.scrollView.backgroundColor = UIColor(named: "PageBackground")
        web.scrollView.contentInsetAdjustmentBehavior = .never
        #if DEBUG
        if #available(iOS 16.4, *) { web.isInspectable = true }
        #endif
        webView = web
        bridge.webView = web
        bridge.host = self
        view = web
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        if compareLiveSite {
            let hash = UserDefaults.standard.string(forKey: "SSStartHash") ?? ""
            webView.load(URLRequest(url: URL(string: Self.liveSiteURL.absoluteString + (hash.hasPrefix("#/") ? hash : "")) ?? Self.liveSiteURL))
            return
        }
        // The page reads Notification.permission at start, so ask iOS first.
        Task { @MainActor in
            let status = await Notifications.shared.status()
            if blockNetwork, let list = try? await WKContentRuleListStore.default().compileContentRuleList(
                forIdentifier: "ss-offline-test", encodedContentRuleList: #"[{"trigger":{"url-filter":"^https?://.*"},"action":{"type":"block"}}]"#) {
                webView.configuration.userContentController.add(list)
            }
            bridge.install(in: webView.configuration.userContentController, notificationStatus: status)
            webView.load(URLRequest(url: startURL()))
        }
    }

    private func startURL() -> URL {
        var url = AppSchemeHandler.startURL
        if let hash = pendingHash ?? UserDefaults.standard.string(forKey: "SSStartHash"), hash.hasPrefix("#/") {
            url = URL(string: AppSchemeHandler.startURL.absoluteString + hash) ?? url
            pendingHash = nil
        }
        return url
    }

    // MARK: Navigation from iOS (quick actions, Spotlight, widgets, Siri, auth)

    /// Show a page of the site, e.g. "#/qibla" or "#/surah/18".
    func open(hash: String) {
        guard hash.hasPrefix("#/"), hash.count < 200 else { return }
        guard didFinishFirstLoad else { pendingHash = hash; return }
        bridge.emit("navigate", ["hash": hash])
    }

    /// Load the page again with an auth result (?code=…) so supabase-js finishes signing in.
    func loadAuthResult(query: String) {
        var c = URLComponents(url: AppSchemeHandler.startURL, resolvingAgainstBaseURL: false)!
        c.percentEncodedQuery = query
        c.fragment = "/account"
        if let url = c.url { webView.load(URLRequest(url: url)) }
    }

    // MARK: WKNavigationDelegate

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { return decisionHandler(.cancel) }
        if compareLiveSite { return decisionHandler(.allow) }
        let mainFrame = action.targetFrame?.isMainFrame ?? true
        switch url.scheme?.lowercased() {
        case AppSchemeHandler.scheme:
            if url.host == AppSchemeHandler.host, schemeHandler.fileURL(for: url) != nil || url.path.isEmpty || url.path == "/" {
                return decisionHandler(.allow)
            }
            // A link to one of the website's own pages that isn't in the app
            // (terms/, surah/…, widget/): show it from salaamstreet.com.
            if mainFrame, url.host == AppSchemeHandler.host,
               let live = URL(string: url.path + (url.query.map { "?" + $0 } ?? ""), relativeTo: Self.liveSiteURL) {
                openInSafari(live.absoluteURL)
            }
            return decisionHandler(.cancel)
        case "http", "https":
            if mainFrame {
                if AuthFlow.isAuthorizeURL(url) {
                    AuthFlow.shared.start(url: url, from: self)
                } else {
                    openInSafari(url)
                }
                return decisionHandler(.cancel)
            }
            return decisionHandler(.allow) // embedded frames (e.g. a video) behave as on the website
        case "about", "blob", "data":
            return decisionHandler(.allow)
        case "salaamstreet":
            AppRouter.shared.handle(url: url)
            return decisionHandler(.cancel)
        default:
            // mailto:, tel:, sms:, maps…
            UIApplication.shared.open(url)
            return decisionHandler(.cancel)
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        didFinishFirstLoad = true
        if let hash = pendingHash {
            pendingHash = nil
            bridge.emit("navigate", ["hash": hash])
        }
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        // iOS reclaimed the page's memory in the background: start it again.
        didFinishFirstLoad = false
        webView.reload()
    }

    // MARK: WKUIDelegate — the website's alert(), confirm() and prompt()

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: NSLocalizedString("OK", comment: ""), style: .default) { _ in completionHandler() })
        presentAlert(a) { completionHandler() }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: NSLocalizedString("Cancel", comment: ""), style: .cancel) { _ in completionHandler(false) })
        a.addAction(UIAlertAction(title: NSLocalizedString("OK", comment: ""), style: .default) { _ in completionHandler(true) })
        presentAlert(a) { completionHandler(false) }
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let a = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        a.addTextField { $0.text = defaultText }
        a.addAction(UIAlertAction(title: NSLocalizedString("Cancel", comment: ""), style: .cancel) { _ in completionHandler(nil) })
        a.addAction(UIAlertAction(title: NSLocalizedString("OK", comment: ""), style: .default) { _ in completionHandler(a.textFields?.first?.text) })
        presentAlert(a) { completionHandler(nil) }
    }

    /// target="_blank" links and window.open(): open outside the app.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url {
            if url.scheme == AppSchemeHandler.scheme, url.host == AppSchemeHandler.host {
                if let live = URL(string: url.path, relativeTo: Self.liveSiteURL) { openInSafari(live.absoluteURL) }
            } else if url.scheme == "http" || url.scheme == "https" {
                openInSafari(url)
            } else {
                UIApplication.shared.open(url)
            }
        }
        return nil
    }

    /// Qibla camera mode: the camera is only ever asked for by the bundled site.
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        let ours = origin.protocol == AppSchemeHandler.scheme && origin.host == AppSchemeHandler.host
        decisionHandler(ours && type == .camera ? .grant : .deny)
    }

    /// Qibla compass: DeviceOrientationEvent.requestPermission() from the bundled site.
    func webView(_ webView: WKWebView, requestDeviceOrientationAndMotionPermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        let ours = origin.protocol == AppSchemeHandler.scheme && origin.host == AppSchemeHandler.host
        decisionHandler(ours ? .grant : .deny)
    }

    // MARK: Helpers

    func openInSafari(_ url: URL) {
        guard url.scheme == "http" || url.scheme == "https" else { return }
        let vc = SFSafariViewController(url: url)
        vc.preferredControlTintColor = UIColor(named: "Brand")
        topPresenter().present(vc, animated: true)
    }

    private func presentAlert(_ alert: UIAlertController, otherwise: @escaping () -> Void) {
        guard view.window != nil else { return otherwise() }
        topPresenter().present(alert, animated: true)
    }

    func topPresenter() -> UIViewController {
        var vc: UIViewController = self
        while let p = vc.presentedViewController, !p.isBeingDismissed { vc = p }
        return vc
    }
}

enum AppInfo {
    static var version: String { Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "3.0.0" }
    static var build: String { Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "1" }
}
