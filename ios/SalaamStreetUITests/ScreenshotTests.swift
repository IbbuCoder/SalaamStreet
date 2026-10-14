import XCTest

/// Screenshots of the app and of salaamstreet.com in the same simulator, page
/// by page, for side-by-side comparison (the workflow sets light or dark).
final class ScreenshotTests: XCTestCase {
    static let pages = ["#/home", "#/prayer", "#/quran", "#/surah/1", "#/duas", "#/dhikr", "#/qibla", "#/offline", "#/settings", "#/hadith"]

    override func setUp() { continueAfterFailure = true }

    private func launch(_ args: [String]) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-SSUITest"] + args
        app.launch()
        return app
    }

    private func settle(_ app: XCUIApplication, seconds: Double) {
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 30), "web view")
        Thread.sleep(forTimeInterval: seconds)
    }

    private func shot(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name
        a.lifetime = .keepAlways
        add(a)
    }

    private func pageName(_ hash: String) -> String { hash.dropFirst(2).replacingOccurrences(of: "/", with: "-") }

    func testAppPages() {
        for hash in Self.pages {
            let app = launch(["-SSStartHash", hash])
            settle(app, seconds: hash == "#/home" ? 7 : 5)
            shot(app, "app_" + pageName(hash))
            app.terminate()
        }
    }

    func testLiveSitePages() {
        for hash in Self.pages {
            let app = launch(["-SSCompareLiveSite", "YES", "-SSStartHash", hash])
            settle(app, seconds: hash == "#/home" ? 9 : 7)
            shot(app, "site_" + pageName(hash))
            app.terminate()
        }
    }

    func testOfflinePages() {
        for hash in ["#/home", "#/prayer", "#/duas", "#/offline"] {
            let app = launch(["-SSBlockNetwork", "YES", "-SSStartHash", hash])
            settle(app, seconds: 5)
            shot(app, "offline_" + pageName(hash))
            app.terminate()
        }
    }

    /// The main journey by touch: bottom navigation, a surah, the dhikr counter.
    func testMainJourney() {
        let app = launch([])
        settle(app, seconds: 6)
        let web = app.webViews.firstMatch
        let quran = web.links.matching(NSPredicate(format: "label CONTAINS[c] %@", "Qur")).firstMatch
        XCTAssertTrue(quran.waitForExistence(timeout: 10), "bottom navigation: Qur'an")
        quran.tap()
        let fatiha = web.links.matching(NSPredicate(format: "label CONTAINS[c] %@", "Al-Fatihah")).firstMatch
        XCTAssertTrue(fatiha.waitForExistence(timeout: 20), "surah list")
        fatiha.tap()
        Thread.sleep(forTimeInterval: 4)
        shot(app, "journey_surah")
        let dhikr = web.links.matching(NSPredicate(format: "label CONTAINS[c] %@", "Dhikr")).firstMatch
        if dhikr.waitForExistence(timeout: 5) { dhikr.tap() } else { app.terminate(); return }
        Thread.sleep(forTimeInterval: 2)
        shot(app, "journey_dhikr")
    }
}
