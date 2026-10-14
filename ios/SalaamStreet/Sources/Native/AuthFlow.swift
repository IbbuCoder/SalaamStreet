import AuthenticationServices
import UIKit

/// Google (and Apple, if enabled) sign-in. Google blocks sign-in inside
/// embedded web views, so the website's OAuth redirect is caught and opened in
/// ASWebAuthenticationSession — the system sign-in sheet that shares Safari's
/// logins. Supabase sends the result to salaamstreet://auth-callback; the app
/// then reloads the page with ?code=… and the website's own supabase-js
/// (PKCE) finishes signing in, exactly as in a browser.
@MainActor
final class AuthFlow: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = AuthFlow()
    private var session: ASWebAuthenticationSession?

    /// https://<project>.supabase.co/auth/v1/authorize?provider=…
    static func isAuthorizeURL(_ url: URL) -> Bool {
        guard url.scheme == "https", let host = url.host, host.hasSuffix(".supabase.co") else { return false }
        return url.path.hasSuffix("/auth/v1/authorize")
    }

    func start(url: URL, from controller: UIViewController) {
        session?.cancel()
        let s = ASWebAuthenticationSession(url: url, callbackURLScheme: "salaamstreet") { [weak self] callback, error in
            Task { @MainActor in
                self?.session = nil
                if let callback { AppRouter.shared.handle(url: callback) }
                // Cancelled: the website still shows its sign-in dialog; nothing else to do.
                _ = error
            }
        }
        s.presentationContextProvider = self
        s.prefersEphemeralWebBrowserSession = false
        session = s
        s.start()
    }

    func finish() {
        session = nil
    }

    nonisolated func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        MainActor.assumeIsolated {
            AppRouter.shared.controller?.view.window ?? ASPresentationAnchor()
        }
    }
}
