import XCTest
@testable import SalaamStreetCore

/// The Swift calculator must give exactly the website's times (js/praytimes.js),
/// which tests/praytimes.test.js checks against the adhan library.
final class PrayerCalculatorTests: XCTestCase {
    struct Fixture: Decodable {
        let city: String, lat: Double, lng: Double, tzOffsetMinutes: Int
        let year: Int, month: Int, day: Int, method: Int, school: Int
        let fajr: String, sunrise: String, dhuhr: String, asr: String, maghrib: String, isha: String
    }

    func testMatchesWebsiteForEveryMethodSchoolCityAndSeason() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "praytimes", withExtension: "json", subdirectory: "Fixtures"))
        let fixtures = try JSONDecoder().decode([Fixture].self, from: Data(contentsOf: url))
        XCTAssertGreaterThan(fixtures.count, 300)
        var mismatches: [String] = []
        for f in fixtures {
            let h = PrayerCalculator.hours(year: f.year, month: f.month, day: f.day, latitude: f.lat, longitude: f.lng,
                                           method: f.method, school: AsrSchool(rawValue: f.school)!, tzOffsetMinutes: f.tzOffsetMinutes)
            let got = [h.fajr, h.sunrise, h.dhuhr, h.asr, h.maghrib, h.isha].map(PrayerCalculator.hhmm)
            let want = [f.fajr, f.sunrise, f.dhuhr, f.asr, f.maghrib, f.isha]
            if got != want { mismatches.append("\(f.city) \(f.year)-\(f.month)-\(f.day) m\(f.method) s\(f.school): \(got) ≠ \(want)") }
        }
        XCTAssertEqual(mismatches, [], mismatches.prefix(5).joined(separator: "\n"))
    }

    func testHanafiAsrIsLaterThanStandard() {
        let loc = PrayerLocation(latitude: 41.88, longitude: -87.63, name: "Chicago", timeZoneIdentifier: "America/Chicago")
        let std = PrayerScheduleBuilder(location: loc, settings: .init(method: 2, school: .standard)).schedule(year: 2026, month: 6, day: 1)
        let han = PrayerScheduleBuilder(location: loc, settings: .init(method: 2, school: .hanafi)).schedule(year: 2026, month: 6, day: 1)
        XCTAssertGreaterThan(han.time(of: .asr)!.date, std.time(of: .asr)!.date.addingTimeInterval(30 * 60))
        XCTAssertEqual(han.time(of: .fajr), std.time(of: .fajr))
    }

    func testUnknownMethodFallsBackToMuslimWorldLeague() {
        XCTAssertEqual(PrayerSettings(method: 99).method, 3)
    }
}

final class PrayerScheduleTests: XCTestCase {
    let chicago = PrayerLocation(latitude: 41.88, longitude: -87.63, name: "Chicago", timeZoneIdentifier: "America/Chicago")

    func date(_ s: String) -> Date { ISO8601DateFormatter().date(from: s)! }

    func testDatesAreTheLocationsClockTimeAcrossDST() {
        let b = PrayerScheduleBuilder(location: chicago, settings: .init(method: 2))
        // 2026-03-08 is the US DST change; times must be in CDT (UTC-5) that day.
        let day = b.schedule(year: 2026, month: 3, day: 8)
        let dhuhr = day.time(of: .dhuhr)!
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = chicago.timeZone
        let c = cal.dateComponents([.hour, .minute], from: dhuhr.date)
        XCTAssertEqual(c.hour, 13, "Dhuhr in Chicago after the clocks change is a little after 1 pm")
        XCTAssertEqual(PrayerCalculator.hhmm(PrayerCalculator.hours(year: 2026, month: 3, day: 8, latitude: 41.88, longitude: -87.63,
            method: 2, school: .standard, tzOffsetMinutes: -300).dhuhr), String(format: "%02d:%02d", c.hour!, c.minute!))
    }

    func testNextPrayerSkipsSunriseAndRollsOverMidnight() {
        let b = PrayerScheduleBuilder(location: chicago, settings: .init(method: 2))
        let today = b.schedule(year: 2026, month: 6, day: 10)
        let afterFajr = today.time(of: .fajr)!.date.addingTimeInterval(60)
        XCTAssertEqual(b.next(after: afterFajr)?.prayer, .dhuhr)
        XCTAssertEqual(b.next(after: afterFajr, includeSunrise: true)?.prayer, .sunrise)
        let afterIsha = today.time(of: .isha)!.date.addingTimeInterval(60)
        let next = b.next(after: afterIsha)!
        XCTAssertEqual(next.prayer, .fajr)
        XCTAssertEqual(next.dayKey, "2026-06-11")
        XCTAssertEqual(b.current(at: afterIsha)?.prayer, .isha)
    }

    func testFridayDhuhrIsJumuah() {
        let b = PrayerScheduleBuilder(location: chicago, settings: .init())
        let friday = b.schedule(year: 2026, month: 10, day: 16) // a Friday
        XCTAssertTrue(friday.isFriday)
        XCTAssertEqual(friday.time(of: .dhuhr)?.englishName, "Jumu'ah")
        XCTAssertEqual(b.schedule(year: 2026, month: 10, day: 15).time(of: .dhuhr)?.englishName, "Dhuhr")
    }

    func testMonthHasEveryDay() {
        let b = PrayerScheduleBuilder(location: chicago, settings: .init())
        XCTAssertEqual(b.month(year: 2028, month: 2).count, 29)
        XCTAssertEqual(b.month(year: 2026, month: 2).count, 28)
    }

    func testCountdownText() {
        let now = date("2026-01-01T10:00:00Z")
        XCTAssertEqual(Countdown.short(from: now, to: now.addingTimeInterval(2 * 3600 + 5 * 60 + 30)), "2h 05m")
        XCTAssertEqual(Countdown.short(from: now, to: now.addingTimeInterval(14 * 60 + 2)), "14m")
        XCTAssertEqual(Countdown.short(from: now, to: now.addingTimeInterval(45)), "45s")
        XCTAssertEqual(Countdown.short(from: now, to: now.addingTimeInterval(-5)), "0s")
        XCTAssertEqual(Countdown.spoken(from: now, to: now.addingTimeInterval(3660)), "1 hour 1 minute")
    }

    func testLocationIsRoundedForPrivacy() {
        let l = PrayerLocation(latitude: 41.87811, longitude: -87.62979, name: "x", timeZoneIdentifier: "UTC")
        XCTAssertEqual(l.latitude, 41.88)
        XCTAssertEqual(l.longitude, -87.63)
    }
}

final class QiblaTests: XCTestCase {
    func testBearingsMatchPublishedValues() {
        XCTAssertEqual(Qibla.bearing(latitude: 40.7128, longitude: -74.006), 58.48, accuracy: 0.1)
        XCTAssertEqual(Qibla.bearing(latitude: 51.5074, longitude: -0.1278), 118.99, accuracy: 0.1)
        XCTAssertEqual(Qibla.bearing(latitude: -6.2088, longitude: 106.8456), 295.15, accuracy: 0.1)
        XCTAssertEqual(Qibla.bearing(latitude: -33.8688, longitude: 151.2093), 277.5, accuracy: 0.5)
        XCTAssertEqual(Qibla.bearing(latitude: 30.0444, longitude: 31.2357), 136.1, accuracy: 0.5)
    }

    func testDistanceAndTurn() {
        XCTAssertEqual(Qibla.distanceKm(latitude: 51.5074, longitude: -0.1278), 4790, accuracy: 30)
        XCTAssertEqual(Qibla.turn(heading: 350, qibla: 10), 20, accuracy: 1e-9)
        XCTAssertEqual(Qibla.turn(heading: 10, qibla: 350), -20, accuracy: 1e-9)
        XCTAssertTrue(Qibla.isAligned(heading: 56, qibla: 58.5))
        XCTAssertFalse(Qibla.isAligned(heading: 40, qibla: 58.5))
        XCTAssertEqual(Qibla.compassPoint(58.5), "ENE")
        XCTAssertEqual(Qibla.compassPoint(359), "N")
    }
}
