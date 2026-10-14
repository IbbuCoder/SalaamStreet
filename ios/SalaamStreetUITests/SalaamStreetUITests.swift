import XCTest

/// Launches SalaamStreet in the simulator and walks through the main screens,
/// keeping a screenshot of each (CI runs it in light and dark appearance).
final class SalaamStreetUITests: XCTestCase {
    private var app: XCUIApplication!

    override func setUp() {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
        // First launch: the welcome sheet asks about location; choose a city later.
        let later = app.buttons["Not now — I'll choose a city later"]
        if later.waitForExistence(timeout: 10) { later.tap() }
    }

    private func snap(_ name: String) {
        let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        shot.name = name
        shot.lifetime = .keepAlways
        add(shot)
    }

    func testTodayShowsTheNextPrayerAndTodaysTimes() {
        XCTAssertTrue(app.staticTexts["Next prayer"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Fajr"].exists)
        XCTAssertTrue(app.staticTexts["Isha"].exists)
        XCTAssertTrue(app.staticTexts["Showing times for Makkah until you choose your location."].exists)
        snap("01-Today")
        app.swipeUp()
        snap("02-Today-scrolled")
    }

    func testPrayerTabTimetableAndTracker() {
        app.tabBars.buttons["Prayer"].tap()
        XCTAssertTrue(app.navigationBars["Prayer Times"].waitForExistence(timeout: 5))
        snap("03-Prayer")
        app.swipeUp()
        app.buttons["Monthly timetable"].tap()
        XCTAssertTrue(app.navigationBars["Timetable"].waitForExistence(timeout: 5))
        snap("04-Timetable")
    }

    func testQuranListAndReader() {
        app.tabBars.buttons["Qur'an"].tap()
        XCTAssertTrue(app.navigationBars["Qur'an"].waitForExistence(timeout: 5))
        snap("05-Quran")
        app.staticTexts["Al-Fatihah"].firstMatch.tap()
        // Online in CI: the reader loads Al-Fatihah from AlQuran Cloud (or says it can't, never spins forever).
        let ayah = app.staticTexts["1:7"]
        let failed = app.buttons["Try again"]
        let loaded = NSPredicate { _, _ in ayah.exists || failed.exists }
        expectation(for: loaded, evaluatedWith: NSObject())
        waitForExpectations(timeout: 30)
        snap("06-Reader")
    }

    func testQibla() {
        app.tabBars.buttons["Qibla"].tap()
        XCTAssertTrue(app.navigationBars["Qibla"].waitForExistence(timeout: 5))
        snap("07-Qibla")
    }

    func testOfflinePageFromMore() {
        app.tabBars.buttons["More"].tap()
        app.buttons["Offline"].firstMatch.tap()
        XCTAssertTrue(app.navigationBars["Offline"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Qur'an text"].exists)
        snap("08-Offline")
        app.swipeUp()
        app.swipeUp()
        XCTAssertTrue(app.staticTexts["Prayer times & timetables"].exists)
        snap("09-Offline-built-in")
    }

    func testDuasAndLiveActivitySettings() {
        app.tabBars.buttons["More"].tap()
        app.buttons["Duas"].firstMatch.tap()
        XCTAssertTrue(app.navigationBars["Duas"].waitForExistence(timeout: 5))
        snap("10-Duas")
        app.navigationBars.buttons.element(boundBy: 0).tap()
        app.buttons["Settings"].firstMatch.tap()
        app.buttons["Lock Screen & Dynamic Island"].firstMatch.tap()
        XCTAssertTrue(app.switches["Show the next prayer"].waitForExistence(timeout: 5))
        snap("11-LiveActivity-settings")
    }
}
