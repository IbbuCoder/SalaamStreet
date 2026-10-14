import Foundation
import SwiftUI
import SalaamStreetCore

/// App-wide state: settings, the location and its prayer schedule, and the
/// prayer tracker. Changes are saved immediately and passed on to reminders and
/// the Live Activity, so every surface shows the same times.
@MainActor
final class AppModel: ObservableObject {
    @Published var settings: AppSettings {
        didSet {
            guard settings != oldValue else { return }
            LocalStore.save(settings, key: "settings")
            if settings.prayer != oldValue.prayer || settings.location != oldValue.location {
                refreshSchedule()
            }
            if settings.prayer != oldValue.prayer || settings.location != oldValue.location || settings.reminders != oldValue.reminders {
                notifications.reschedule(builder: builder, preferences: settings.reminders)
            }
            if settings.liveActivity != oldValue.liveActivity || settings.prayer != oldValue.prayer || settings.location != oldValue.location {
                liveActivity.apply(preferences: settings.liveActivity, builder: builder, restart: settings.liveActivity != oldValue.liveActivity)
            }
        }
    }
    @Published private(set) var log: PrayerLog
    /// Today at the location, recomputed when the day changes.
    @Published private(set) var today: DaySchedule
    /// Bumped every 30 s so "next prayer" and "current prayer" stay right; countdowns tick on their own.
    @Published private(set) var clock = Date()

    let notifications: NotificationService
    let liveActivity: LiveActivityController
    private var timer: Timer?

    init(notifications: NotificationService, liveActivity: LiveActivityController) {
        let saved = LocalStore.load(AppSettings.self, key: "settings") ?? AppSettings()
        self.settings = saved
        self.log = LocalStore.load(PrayerLog.self, key: "tracker") ?? PrayerLog()
        self.notifications = notifications
        self.liveActivity = liveActivity
        let b = PrayerScheduleBuilder(location: saved.location ?? .makkah, settings: saved.prayer)
        self.today = b.schedule(for: Date())
        timer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.tick() }
        }
    }

    // MARK: Location and schedule

    var location: PrayerLocation { settings.location ?? .makkah }
    var isUsingDefaultLocation: Bool { settings.location == nil }
    var builder: PrayerScheduleBuilder { PrayerScheduleBuilder(location: location, settings: settings.prayer) }
    var nextPrayer: PrayerTime? { builder.next(after: clock) }
    var currentPrayer: PrayerTime? { builder.current(at: clock) }
    var hijri: HijriDate { HijriDate(date: clock, timeZone: location.timeZone) }
    var todayKey: String { DayKey.make(clock, timeZone: location.timeZone) }

    func refreshSchedule() {
        today = builder.schedule(for: Date())
        clock = Date()
    }

    private func tick() {
        let now = Date()
        let dayChanged = DayKey.make(now, timeZone: location.timeZone) != today.dayKey
        clock = now
        if dayChanged { refreshSchedule() }
        liveActivity.refreshIfNeeded(builder: builder)
    }

    /// Called when the app becomes active: catch up on anything that changed while it was away.
    func becameActive() {
        refreshSchedule()
        notifications.reschedule(builder: builder, preferences: settings.reminders)
        liveActivity.apply(preferences: settings.liveActivity, builder: builder, restart: false)
    }

    func setLocation(_ loc: PrayerLocation?) { settings.location = loc }

    // MARK: Tracker

    func prayed(_ prayer: Prayer, dayKey: String? = nil) -> Bool { log.prayed(prayer, on: dayKey ?? todayKey) }

    func togglePrayed(_ prayer: Prayer, dayKey: String? = nil) {
        log.toggle(prayer, on: dayKey ?? todayKey)
        LocalStore.save(log, key: "tracker")
    }

    func markPrayed(_ prayer: Prayer, dayKey: String) {
        log.set(prayer, on: dayKey, prayed: true)
        LocalStore.save(log, key: "tracker")
    }

    func clearTracker() {
        log = PrayerLog()
        LocalStore.save(log, key: "tracker")
    }
}
