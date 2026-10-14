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
        // First run: the website asks about location. Answer "Not now", as a person would.
        let notNow = app.webViews.firstMatch.buttons["Not now"]
        if notNow.exists && notNow.isHittable {
            notNow.tap()
            Thread.sleep(forTimeInterval: 1)
        }
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

    /// Settings → the countdown switch → the Dynamic Island on the Home Screen.
    func testDynamicIslandCountdown() {
        let app = launch(["-SSStartHash", "#/settings"])
        settle(app, seconds: 5)
        let toggle = app.webViews.firstMatch.switches.matching(NSPredicate(format: "label CONTAINS[c] %@", "Dynamic Island")).firstMatch
        for _ in 0..<12 where !(toggle.exists && toggle.isHittable) { app.webViews.firstMatch.swipeUp() }
        XCTAssertTrue(toggle.waitForExistence(timeout: 5), "the countdown switch in Settings")
        guard toggle.exists else { return }
        toggle.tap()
        Thread.sleep(forTimeInterval: 3)
        shot(app, "island_settings")
        XCUIDevice.shared.press(.home)
        Thread.sleep(forTimeInterval: 3)
        let home = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        home.name = "island_home"
        home.lifetime = .keepAlways
        add(home)
        Thread.sleep(forTimeInterval: 6)
        let later = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        later.name = "island_home_later"
        later.lifetime = .keepAlways
        add(later)
        app.activate()
        Thread.sleep(forTimeInterval: 2)
        if toggle.exists && toggle.isHittable { toggle.tap() } // turn it off again
    }

    /// Google sign-in opens the iPhone's secure sign-in sheet (Google blocks embedded web views).
    func testGoogleSignInUsesTheSystemSheet() {
        let app = launch(["-SSStartHash", "#/account"])
        settle(app, seconds: 5)
        let web = app.webViews.firstMatch
        let open = web.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", "Sign in")).firstMatch
        if open.waitForExistence(timeout: 10) { open.tap() }
        let google = web.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", "Google")).firstMatch
        XCTAssertTrue(google.waitForExistence(timeout: 10), "the website's Continue with Google button")
        guard google.exists else { return }
        google.tap()
        // iOS asks: "SalaamStreet" Wants to Use "supabase.co" to Sign In.
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let alert = springboard.alerts.firstMatch
        let appeared = alert.waitForExistence(timeout: 15)
        let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        shot.name = "signin_sheet"
        shot.lifetime = .keepAlways
        add(shot)
        XCTAssertTrue(appeared, "the system sign-in prompt (ASWebAuthenticationSession)")
        if appeared {
            print("SIGNIN-ALERT", alert.label)
            let cancel = alert.buttons["Cancel"]
            if cancel.exists { cancel.tap() }
        }
    }

    /// The main journey by touch: the bottom bar's Qur'an, Qibla and Home tabs.
    func testMainJourney() {
        let app = launch([])
        settle(app, seconds: 6)
        func tapTab(_ x: CGFloat) { app.coordinate(withNormalizedOffset: CGVector(dx: x, dy: 0.935)).tap() }
        func shows(_ text: String) -> Bool {
            app.webViews.firstMatch.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch.waitForExistence(timeout: 10)
        }
        tapTab(0.5)
        XCTAssertTrue(shows("The Noble Qur"), "Qur'an tab")
        shot(app, "journey_quran")
        tapTab(0.7)
        XCTAssertTrue(shows("Qibla Finder"), "Qibla tab")
        shot(app, "journey_qibla")
        tapTab(0.1)
        XCTAssertTrue(shows("Next prayer"), "Home tab")
        shot(app, "journey_home")
    }
}
