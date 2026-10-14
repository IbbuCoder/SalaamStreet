import XCTest
@testable import SalaamStreetCore

final class OfflineModelTests: XCTestCase {
    func testPackIDsRoundTripLikeTheWebsite() {
        for s in ["text:quran-uthmani", "tafsir", "audio:ar.alafasy", "hadith:nawawi"] {
            XCTAssertEqual(OfflinePackID(string: s)?.description, s)
        }
        XCTAssertNil(OfflinePackID(string: "audio:"))
        XCTAssertNil(OfflinePackID(string: "video:x"))
        XCTAssertEqual(OfflinePackID.hadith("nawawi").unitCount, 2)
    }

    func testManifestRecordsCompletionAndBytes() {
        var m = OfflineManifest()
        let id = OfflinePackID.text("en.sahih")
        for s in 1...113 { m.record(id, unit: s, bytes: 100) }
        XCTAssertFalse(m.isComplete(id))
        m.record(id, unit: 114, bytes: 100)
        XCTAssertTrue(m.isComplete(id))
        XCTAssertEqual(m.bytes(id), 11400)
        m.forget(id, units: [1, 2])
        XCTAssertFalse(m.isComplete(id))
        XCTAssertEqual(m.bytes(id), 11200)
        m.forget(id)
        XCTAssertNil(m.pack(id))
        XCTAssertEqual(m.totalBytes, 0)
    }

    func testEnqueueNeverDuplicatesWork() {
        var m = OfflineManifest()
        let id = OfflinePackID.audio("ar.alafasy")
        m.record(id, unit: 1, bytes: 10)
        m.enqueue(id, units: [1, 2, 3])
        XCTAssertEqual(m.jobs.count, 1)
        XCTAssertEqual(m.jobs[0].units, [2, 3], "already-downloaded surahs are skipped")
        m.enqueue(id, units: [3, 4])
        XCTAssertEqual(m.jobs.count, 1, "one job per pack")
        XCTAssertEqual(m.jobs[0].units, [2, 3, 4])
        m.enqueue(.text("en.sahih"), units: [])
        XCTAssertEqual(m.jobs.count, 1, "nothing to do → no job")
        m.record(id, unit: 2, bytes: 5)
        XCTAssertEqual(m.remaining(m.jobs[0]), [3, 4])
    }

    func testInterruptedDownloadsResumeButPausedOnesWait() throws {
        var m = OfflineManifest()
        m.enqueue(.tafsir, units: [1, 2])
        m.enqueue(.text("en.sahih"), units: [1])
        m.enqueue(.hadith("nawawi"), units: [1, 2])
        m.jobs[0].status = .running
        m.jobs[1].status = .paused
        m.jobs[2].status = .waitingForNetwork
        let data = try JSONEncoder().encode(m)
        var back = try JSONDecoder().decode(OfflineManifest.self, from: data)
        XCTAssertEqual(back, m, "the manifest survives a relaunch")
        back.restoreAfterLaunch()
        XCTAssertEqual(back.jobs.map(\.status), [.queued, .paused, .queued])
    }

    func testPathsAndEstimates() {
        XCTAssertEqual(OfflinePaths.file(for: .text("en.sahih"), unit: 2), "quran/text/en.sahih/2.json")
        XCTAssertEqual(OfflinePaths.audioFile(reciter: "ar.alafasy", surah: 2, ayah: 1), "audio/ar.alafasy/2/8.mp3")
        XCTAssertEqual(OfflinePaths.file(for: .hadith("nawawi"), unit: 2), "hadith/nawawi/ara.json")
        let all = OfflineEstimate.audio(reciter: "ar.alafasy", surahs: Array(1...114))
        let one = OfflineEstimate.audio(reciter: "ar.alafasy", surahs: [2])
        XCTAssertGreaterThan(all, 500 * OfflineEstimate.megabyte)
        XCTAssertLessThan(all, 1500 * OfflineEstimate.megabyte)
        XCTAssertLessThan(one, all / 10)
        XCTAssertEqual(ByteSize.format(1_468_006), "1.4 MB")
        XCTAssertEqual(ByteSize.format(0), "1 KB")
        XCTAssertEqual(ByteSize.format(2_147_483_648), "2.0 GB")
    }
}

final class TrackerTests: XCTestCase {
    let utc = TimeZone(identifier: "UTC")!
    func day(_ k: String) -> Date { DayKey.parse(k, timeZone: utc)! }

    func testStreaks() {
        var log = PrayerLog()
        for k in ["2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13"] {
            Prayer.obligatory.forEach { log.set($0, on: k, prayed: true) }
        }
        log.set(.fajr, on: "2026-10-14", prayed: true)
        XCTAssertEqual(log.currentStreak(today: day("2026-10-14"), timeZone: utc), 4, "an unfinished today keeps yesterday's streak")
        Prayer.obligatory.forEach { log.set($0, on: "2026-10-14", prayed: true) }
        XCTAssertEqual(log.currentStreak(today: day("2026-10-14"), timeZone: utc), 5)
        XCTAssertEqual(log.currentStreak(today: day("2026-10-16"), timeZone: utc), 0)
        log.set(.isha, on: "2026-10-12", prayed: false)
        XCTAssertEqual(log.bestStreak, 2)
        log.set(.sunrise, on: "2026-10-14", prayed: true)
        XCTAssertEqual(log.count(on: "2026-10-14"), 5, "sunrise is never tracked")
        XCTAssertEqual(log.recent(3, today: day("2026-10-14"), timeZone: utc).map(\.count), [4, 5, 5])
    }
}

final class LiveActivityAndReminderTests: XCTestCase {
    let london = PrayerLocation(latitude: 51.51, longitude: -0.13, name: "London", timeZoneIdentifier: "Europe/London")

    func testActivityShowsUpcomingPrayerThenHoldsFifteenMinutes() {
        let b = PrayerScheduleBuilder(location: london, settings: .init())
        let day = b.schedule(year: 2026, month: 7, day: 1)
        let asr = day.time(of: .asr)!
        let before = PrayerActivityPlanner.state(builder: b, now: asr.date.addingTimeInterval(-600))!
        XCTAssertEqual(before.prayer, .asr)
        XCTAssertEqual(before.followingName, "Maghrib")
        XCTAssertEqual(before.locationName, "London")
        XCTAssertEqual(before.timeZone.identifier, "Europe/London", "times are shown in the location's clock")
        let during = PrayerActivityPlanner.state(builder: b, now: asr.date.addingTimeInterval(600))!
        XCTAssertEqual(during.prayer, .asr, "for 15 minutes it still says it's time for Asr")
        let after = PrayerActivityPlanner.state(builder: b, now: asr.date.addingTimeInterval(16 * 60))!
        XCTAssertEqual(after.prayer, .maghrib)
        XCTAssertEqual(PrayerActivityPlanner.staleDate(for: before), asr.date)
        XCTAssertTrue(PrayerActivityPlanner.needsUpdate(before, builder: b, now: asr.date.addingTimeInterval(16 * 60)))
        XCTAssertFalse(PrayerActivityPlanner.needsUpdate(before, builder: b, now: asr.date.addingTimeInterval(-60)))
        XCTAssertEqual(PrayerActivityPlanner.relevance(for: before, now: asr.date), 100)
    }

    func testRemindersRespectPreferencesAndLimit() {
        let b = PrayerScheduleBuilder(location: london, settings: .init())
        let start = DayKey.parse("2026-10-14", timeZone: london.timeZone)! // Wednesday noon
        let days = b.schedules(from: start, days: 14)
        var prefs = ReminderPreferences(enabled: true, minutesBefore: 10, prayers: [.fajr, .isha, .sunrise], kahfReminder: true)
        XCTAssertFalse(prefs.prayers.contains(.sunrise))
        let plan = ReminderPlanner.plan(schedules: days, preferences: prefs, now: start, timeZone: london.timeZone)
        XCTAssertTrue(plan.allSatisfy { $0.fireDate > start })
        XCTAssertEqual(plan.filter { $0.id.hasPrefix("kahf") }.count, 2, "two Fridays in two weeks")
        XCTAssertTrue(plan.contains { $0.title == "Isha in 10 minutes" })
        XCTAssertEqual(plan, plan.sorted { $0.fireDate < $1.fireDate })
        prefs.prayers = Set(Prayer.obligatory)
        prefs.minutesBefore = 0
        let full = ReminderPlanner.plan(schedules: b.schedules(from: start, days: 30), preferences: prefs, now: start, timeZone: london.timeZone)
        XCTAssertEqual(full.count, ReminderPlanner.limit, "stays under iOS's 64 pending notifications")
        XCTAssertTrue(full.contains { $0.title == "It's time for Jumu'ah" })
        XCTAssertEqual(ReminderPlanner.plan(schedules: days, preferences: .init(enabled: false, kahfReminder: false), now: start, timeZone: london.timeZone), [])
    }
}
