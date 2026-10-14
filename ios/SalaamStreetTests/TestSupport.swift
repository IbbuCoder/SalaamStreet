import WebKit
import XCTest
@testable import SalaamStreet

/// Shared helpers: the app's own web view, waiting, and running JavaScript in the page.
@MainActor
class AppTestCase: XCTestCase {
    var app: WebViewController {
        get throws { try XCTUnwrap(AppRouter.shared.controller, "the app's web view") }
    }

    func waitUntil(_ timeout: TimeInterval, _ what: String, _ ok: () -> Bool) async throws {
        let end = Date().addingTimeInterval(timeout)
        while !ok() {
            if Date() > end { XCTFail("timed out: \(what)"); throw CancellationError() }
            try await Task.sleep(nanoseconds: 200_000_000)
        }
    }

    /// Runs an async JavaScript function body in the page and returns its JSON result.
    func js(_ web: WKWebView, _ body: String) async throws -> Any? {
        let id = "__t" + String(Int.random(in: 0..<1_000_000_000))
        let start = "(async () => { \(body) })().then(r => { window.\(id) = JSON.stringify({ ok: r === undefined ? null : r }); }, e => { window.\(id) = JSON.stringify({ err: String(e && e.stack || e) }); }); 1;"
        _ = try await web.evaluateJavaScript(start)
        let end = Date().addingTimeInterval(30)
        while Date() < end {
            if let s = try await web.evaluateJavaScript("window.\(id) || ''") as? String, !s.isEmpty,
               let obj = try JSONSerialization.jsonObject(with: Data(s.utf8)) as? [String: Any] {
                if let err = obj["err"] { XCTFail("JavaScript error: \(err)"); return nil }
                return obj["ok"] is NSNull ? nil : obj["ok"]
            }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        XCTFail("JavaScript timed out")
        return nil
    }

    /// The app's web view once the website has started and told iOS it is ready.
    func readyApp() async throws -> WebViewController {
        let vc = try app
        try await waitUntil(40, "website ready") { vc.bridge.isReady }
        return vc
    }
}
